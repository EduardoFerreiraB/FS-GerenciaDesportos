from sqlalchemy.orm import Session
from datetime import date, time, timedelta
import models
import schemas

def criar_edicao(db: Session, edicao: schemas.EdicaoCreate):
    db_edicao = models.Edicao(**edicao.model_dump())

    db.add(db_edicao)
    db.commit()
    db.refresh(db_edicao)
    return db_edicao

def listar_edicao_id(db: Session, edicao_id: int):
    return db.query(models.Edicao).filter(models.Edicao.id_edicao == edicao_id).first()

def listar_edicoes(db: Session, skip: int = 0, limit: int = 10):
    return db.query(models.Edicao).offset(skip).limit(limit).all()

def atualizar_edicao(db: Session, edicao_id: int, edicao_atualizada: schemas.EdicaoCreate):
    db_edicao = listar_edicao_id(db, edicao_id)

    if not db_edicao:
        return None
    
    dados = edicao_atualizada.model_dump(exclude_unset=True)
    for key, value in dados.items():
        setattr(db_edicao, key, value)

    db.commit()
    db.refresh(db_edicao)
    return db_edicao

def excluir_edicao(db: Session, id_edicao: int):
    db_edicao = listar_edicao_id(db, id_edicao)

    if db_edicao:
        db.delete(db_edicao)
        db.commit()
        return True
    return False

def clonar_equipes(db: Session, id_edicao_origem: int, id_edicao_destino: int):
    # 1. Buscar equipes da edição de origem
    equipes_origem = db.query(models.Equipe).filter(models.Equipe.id_edicao == id_edicao_origem).all()
    
    novas_equipes = []
    for eq_origem in equipes_origem:
        # 2. Criar nova equipe para o destino
        nova_equipe = models.Equipe(
            nome=eq_origem.nome,
            id_edicao=id_edicao_destino
        )
        db.add(nova_equipe)
        db.flush() # Para gerar o id_equipe
        
        # 3. Copiar os participantes (vínculos)
        for participante in eq_origem.participantes:
            nova_equipe.participantes.append(participante)
        
        novas_equipes.append(nova_equipe)
    
    db.commit()
    return novas_equipes

def gerar_confrontos_pontos_corridos(db: Session, edicao_id: int, id_modalidade: int, data_inicio: date, part_hora: time = None):
    # 1. Obter a edição
    edicao = db.query(models.Edicao).filter(models.Edicao.id_edicao == edicao_id).first()
    if not edicao:
        raise ValueError("Edição não encontrada.")
    
    # 2. Obter equipes
    equipes = db.query(models.Equipe).filter(models.Equipe.id_edicao == edicao_id).all()
    if len(equipes) < 2:
        raise ValueError("É necessário ter pelo menos 2 equipes registradas para gerar as rodadas.")
    
    # 3. Obter local e árbitro padrões
    local = db.query(models.Local).filter(models.Local.ativo == True).first()
    arbitro = db.query(models.Arbitro).first()
    if not local:
        raise ValueError("Nenhum local ativo cadastrado. Cadastre um local antes de gerar as rodadas.")
    if not arbitro:
        raise ValueError("Nenhum árbitro cadastrado. Cadastre um árbitro antes de gerar as rodadas.")
    
    # 4. Verificar se existem partidas ativas/finalizadas
    partidas_existentes = db.query(models.Partida).filter(
        models.Partida.id_edicao == edicao_id,
        models.Partida.id_modalidade == id_modalidade
    ).all()
    if any(p.status in ["Em Andamento", "Finalizada"] for p in partidas_existentes):
        raise ValueError("Não é possível gerar novos confrontos porque já existem partidas em andamento ou finalizadas.")
    
    # Deletar partidas anteriores da mesma modalidade e edição
    for p in partidas_existentes:
        db.delete(p)
    db.flush()
    
    # 5. Algoritmo de Round Robin
    lista_equipes = list(equipes)
    if len(lista_equipes) % 2 != 0:
        lista_equipes.append(None)
    
    n = len(lista_equipes)
    rodadas = n - 1
    jogos_por_rodada = n // 2
    
    default_time = part_hora or time(14, 0)
    
    partidas_geradas = []
    
    for r in range(rodadas):
        # Uma rodada por semana
        data_rodada = data_inicio + timedelta(weeks=r)
        
        for j in range(jogos_por_rodada):
            casa = lista_equipes[j]
            visitante = lista_equipes[n - 1 - j]
            
            if casa is not None and visitante is not None:
                nova_partida = models.Partida(
                    id_edicao=edicao_id,
                    id_local=local.id_local,
                    id_arbitro=arbitro.id_arbitro,
                    id_modalidade=id_modalidade,
                    id_equipe_casa=casa.id_equipe,
                    id_equipe_visitante=visitante.id_equipe,
                    fase=f"Rodada {r + 1}",
                    part_data=data_rodada,
                    part_hora=default_time,
                    status="Agendada"
                )
                db.add(nova_partida)
                partidas_geradas.append(nova_partida)
        
        # Rotacionar a lista
        lista_equipes = [lista_equipes[0]] + [lista_equipes[-1]] + lista_equipes[1:-1]
        
    db.commit()
    return partidas_geradas

def gerar_confrontos_mata_mata(db: Session, edicao_id: int, id_modalidade: int, fase_inicial: str, data_inicio: date, part_hora: time = None):
    # 1. Obter a edição
    edicao = db.query(models.Edicao).filter(models.Edicao.id_edicao == edicao_id).first()
    if not edicao:
        raise ValueError("Edição não encontrada.")
    
    # 2. Obter equipes
    equipes = db.query(models.Equipe).filter(models.Equipe.id_edicao == edicao_id).all()
    if not equipes:
        raise ValueError("É necessário ter equipes registradas para gerar o chaveamento.")
    
    fases_possiveis = ["Final", "Semifinal", "Quartas", "Oitavas"]
    if fase_inicial not in fases_possiveis:
        raise ValueError(f"Fase inicial inválida: {fase_inicial}")
    
    idx_limite = fases_possiveis.index(fase_inicial)
    max_equipes = 2 ** (idx_limite + 1)
    if len(equipes) > max_equipes:
        raise ValueError(f"Quantidade de equipes ({len(equipes)}) excede o limite máximo permitido para a fase inicial {fase_inicial} ({max_equipes} equipes).")
    
    # 3. Obter local e árbitro padrões
    local = db.query(models.Local).filter(models.Local.ativo == True).first()
    arbitro = db.query(models.Arbitro).first()
    if not local:
        raise ValueError("Nenhum local ativo cadastrado. Cadastre um local antes de gerar o chaveamento.")
    if not arbitro:
        raise ValueError("Nenhum árbitro cadastrado. Cadastre um árbitro antes de gerar o chaveamento.")
    
    # 4. Verificar se existem partidas ativas/finalizadas
    partidas_existentes = db.query(models.Partida).filter(
        models.Partida.id_edicao == edicao_id,
        models.Partida.id_modalidade == id_modalidade
    ).all()
    if any(p.status in ["Em Andamento", "Finalizada"] for p in partidas_existentes):
        raise ValueError("Não é possível gerar novos confrontos porque já existem partidas em andamento ou finalizadas.")
    
    # Deletar partidas anteriores da mesma modalidade e edição
    for p in partidas_existentes:
        db.delete(p)
    db.flush()
    
    # 5. Mapear as fases
    fases_possiveis = ["Final", "Semifinal", "Quartas", "Oitavas"]
    if fase_inicial not in fases_possiveis:  # pragma: no cover
        raise ValueError(f"Fase inicial inválida: {fase_inicial}")
    
    idx_limite = fases_possiveis.index(fase_inicial)
    fases_a_gerar = fases_possiveis[:idx_limite + 1] # e.g., ["Final", "Semifinal", "Quartas"]
    
    default_time = part_hora or time(14, 0)
    partidas_por_fase = {}
    
    # Gerar de trás para frente (Final -> Semifinal -> ...)
    for idx, fase in enumerate(fases_a_gerar):
        num_partidas = 2 ** idx
        semanas_distancia = idx_limite - idx
        data_fase = data_inicio + timedelta(weeks=semanas_distancia)
        
        partidas_fase = []
        for j in range(num_partidas):
            id_proxima = None
            if fase != "Final":
                fase_seguinte = fases_a_gerar[idx - 1]
                partida_seguinte = partidas_por_fase[fase_seguinte][j // 2]
                id_proxima = partida_seguinte.id_partida
                
            nova_partida = models.Partida(
                id_edicao=edicao_id,
                id_local=local.id_local,
                id_arbitro=arbitro.id_arbitro,
                id_modalidade=id_modalidade,
                id_proxima_partida=id_proxima,
                fase=fase,
                part_data=data_fase,
                part_hora=default_time,
                status="Agendada"
            )
            db.add(nova_partida)
            db.flush() # Gerar ID
            partidas_fase.append(nova_partida)
            
        partidas_por_fase[fase] = partidas_fase
        
    # 6. Distribuir as equipes na fase inicial
    partidas_iniciais = partidas_por_fase[fase_inicial]
    for i, partida in enumerate(partidas_iniciais):
        idx_casa = 2 * i
        idx_visitante = 2 * i + 1
        
        if idx_casa < len(equipes):
            partida.id_equipe_casa = equipes[idx_casa].id_equipe
        if idx_visitante < len(equipes):
            partida.id_equipe_visitante = equipes[idx_visitante].id_equipe
            
    db.commit()
    
    todas_partidas = []
    for p_list in partidas_por_fase.values():
        todas_partidas.extend(p_list)
    return todas_partidas

def gerar_confrontos_grupos(db: Session, edicao_id: int, id_modalidade: int, part_hora: time = None):
    # 1. Obter a edição
    edicao = db.query(models.Edicao).filter(models.Edicao.id_edicao == edicao_id).first()
    if not edicao:
        raise ValueError("Edição não encontrada.")
    
    # 2. Obter equipes
    equipes = db.query(models.Equipe).filter(models.Equipe.id_edicao == edicao_id).all()
    if len(equipes) < 4:
        raise ValueError("É necessário ter pelo menos 4 equipes registradas para gerar uma competição de grupos.")
    
    # 3. Obter local e árbitro padrões
    local = db.query(models.Local).filter(models.Local.ativo == True).first()
    arbitro = db.query(models.Arbitro).first()
    if not local:
        raise ValueError("Nenhum local ativo cadastrado. Cadastre um local antes de gerar as rodadas.")
    if not arbitro:
        raise ValueError("Nenhum árbitro cadastrado. Cadastre um árbitro antes de gerar as rodadas.")
    
    # 4. Verificar se existem partidas ativas/finalizadas
    partidas_existentes = db.query(models.Partida).filter(
        models.Partida.id_edicao == edicao_id,
        models.Partida.id_modalidade == id_modalidade
    ).all()
    if any(p.status in ["Em Andamento", "Finalizada"] for p in partidas_existentes):
        raise ValueError("Não é possível gerar novos confrontos porque já existem partidas em andamento ou finalizadas.")
    
    # Deletar partidas anteriores da mesma modalidade e edição
    for p in partidas_existentes:
        db.delete(p)
    db.flush()
    
    # 5. Distribuir equipes em grupos caso nenhuma possua grupo
    if all(eq.grupo is None for eq in equipes):
        sorted_eqs = sorted(equipes, key=lambda x: x.nome)
        mid = len(sorted_eqs) // 2
        for idx, eq in enumerate(sorted_eqs):
            eq.grupo = "A" if idx < mid else "B"
        db.flush()
        
    # Agrupar equipes por grupo
    grupos = {}
    for eq in equipes:
        g_nome = eq.grupo or "A"
        if g_nome not in grupos:
            grupos[g_nome] = []
        grupos[g_nome].append(eq)
        
    default_time = part_hora or time(14, 0)
    partidas_geradas = []
    
    # 6. Gerar rodadas para cada grupo
    for g_nome, lista_eqs in grupos.items():
        if len(lista_eqs) < 2:
            continue
            
        lista_rot = list(lista_eqs)
        if len(lista_rot) % 2 != 0:
            lista_rot.append(None)
            
        n = len(lista_rot)
        rodadas = n - 1
        jogos_por_rodada = n // 2
        
        for r in range(rodadas):
            data_rodada = edicao.data_inicio + timedelta(weeks=r)
            for j in range(jogos_por_rodada):
                casa = lista_rot[j]
                visitante = lista_rot[n - 1 - j]
                
                if casa is not None and visitante is not None:
                    nova_partida = models.Partida(
                        id_edicao=edicao_id,
                        id_local=local.id_local,
                        id_arbitro=arbitro.id_arbitro,
                        id_modalidade=id_modalidade,
                        id_equipe_casa=casa.id_equipe,
                        id_equipe_visitante=visitante.id_equipe,
                        fase=f"Grupo {g_nome} - Rodada {r + 1}",
                        part_data=data_rodada,
                        part_hora=default_time,
                        status="Agendada"
                    )
                    db.add(nova_partida)
                    partidas_geradas.append(nova_partida)
            
            # Rotacionar
            lista_rot = [lista_rot[0]] + [lista_rot[-1]] + lista_rot[1:-1]
            
    # 7. Gerar cruzamento de mata-mata (Semifinal e Final)
    max_weeks = max([len(eqs) - 1 if len(eqs) % 2 == 0 else len(eqs) for eqs in grupos.values()] + [2])
    data_semis = edicao.data_inicio + timedelta(weeks=max_weeks)
    data_final = data_semis + timedelta(weeks=1)
    
    # Grande Final
    final_match = models.Partida(
        id_edicao=edicao_id,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        id_modalidade=id_modalidade,
        id_equipe_casa=None,
        id_equipe_visitante=None,
        fase="Final",
        part_data=data_final,
        part_hora=default_time,
        status="Agendada",
        observacoes="Vencedor Semifinal 1 vs Vencedor Semifinal 2"
    )
    db.add(final_match)
    db.flush()
    partidas_geradas.append(final_match)
    
    # Semifinal 1: 1º Grupo A vs 2º Grupo B
    semi1 = models.Partida(
        id_edicao=edicao_id,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        id_modalidade=id_modalidade,
        id_proxima_partida=final_match.id_partida,
        fase="Semifinal",
        part_data=data_semis,
        part_hora=default_time,
        status="Agendada",
        observacoes="1º Grupo A vs 2º Grupo B"
    )
    # Semifinal 2: 1º Grupo B vs 2º Grupo A
    semi2 = models.Partida(
        id_edicao=edicao_id,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        id_modalidade=id_modalidade,
        id_proxima_partida=final_match.id_partida,
        fase="Semifinal",
        part_data=data_semis,
        part_hora=default_time,
        status="Agendada",
        observacoes="1º Grupo B vs 2º Grupo A"
    )
    db.add_all([semi1, semi2])
    db.flush()
    partidas_geradas.extend([semi1, semi2])
    
    db.commit()
    return partidas_geradas

def gerar_confrontos_edicao(db: Session, edicao_id: int, id_modalidade: int, part_hora: time = None):
    edicao = db.query(models.Edicao).filter(models.Edicao.id_edicao == edicao_id).first()
    if not edicao:
        raise ValueError("Edição não encontrada.")
    
    if edicao.tipo_competicao == "Pontos Corridos":
        return gerar_confrontos_pontos_corridos(
            db=db,
            edicao_id=edicao_id,
            id_modalidade=id_modalidade,
            data_inicio=edicao.data_inicio,
            part_hora=part_hora
        )
    elif edicao.tipo_competicao == "Mata-Mata":
        if not edicao.fase_inicial:
            raise ValueError("Uma fase inicial deve ser definida para torneios Mata-Mata.")
        return gerar_confrontos_mata_mata(
            db=db,
            edicao_id=edicao_id,
            id_modalidade=id_modalidade,
            fase_inicial=edicao.fase_inicial,
            data_inicio=edicao.data_inicio,
            part_hora=part_hora
        )
    elif edicao.tipo_competicao == "Grupos":
        return gerar_confrontos_grupos(
            db=db,
            edicao_id=edicao_id,
            id_modalidade=id_modalidade,
            part_hora=part_hora
        )
    else:
        raise ValueError(f"Geração automática de confrontos não implementada para o tipo de competição: {edicao.tipo_competicao}")