from sqlalchemy.orm import Session
from datetime import date, time, datetime, timedelta
import models
import schemas

def verificar_conflito_partida(
    db: Session, 
    id_local: int, 
    id_arbitro: int, 
    id_modalidade: int, 
    data: date, 
    hora: time, 
    id_partida_ignorar: int = None,
    id_equipe_casa: int = None,
    id_equipe_visitante: int = None
):
    # 1. Obter duração da modalidade
    mod = db.query(models.Modalidade).filter(models.Modalidade.id_modalidade == id_modalidade).first()
    duracao = mod.duracao_minutos if mod else 60

    inicio_nova = datetime.combine(data, hora)
    fim_nova = inicio_nova + timedelta(minutes=duracao)

    # 2. Buscar todas as partidas da mesma data que não estejam canceladas
    partidas_dia = db.query(models.Partida).filter(
        models.Partida.part_data == data,
        models.Partida.status != "Cancelada"
    )
    if id_partida_ignorar:
        partidas_dia = partidas_dia.filter(models.Partida.id_partida != id_partida_ignorar)

    partidas_list = partidas_dia.all()

    for partida in partidas_list:
        # Obter duração da partida existente
        mod_existente = db.query(models.Modalidade).filter(models.Modalidade.id_modalidade == partida.id_modalidade).first()
        duracao_existente = mod_existente.duracao_minutos if mod_existente else 60

        inicio_existente = datetime.combine(partida.part_data, partida.part_hora)
        fim_existente = inicio_existente + timedelta(minutes=duracao_existente)

        # Verificar sobreposição de horários (Overlap)
        if (inicio_existente < fim_nova) and (inicio_nova < fim_existente):
            # Conflito de Local
            if partida.id_local == id_local:
                return "O local já possui uma partida agendada com sobreposição de horário."
            
            # Conflito de Árbitro
            if partida.id_arbitro == id_arbitro:
                return "O árbitro já possui uma partida agendada com sobreposição de horário."
            
            # Conflito de Equipes
            equipes_novas = {id_equipe_casa, id_equipe_visitante} - {None}
            equipes_existentes = {partida.id_equipe_casa, partida.id_equipe_visitante} - {None}
            if equipes_novas & equipes_existentes:
                return "Uma das equipes participantes já possui uma partida agendada com sobreposição de horário."

    return None

def criar_partida(db: Session, partida: schemas.PartidaCreate):
    # 1. Resolve local inline
    id_local = partida.id_local
    if not id_local:
        if not partida.local_inline:
            raise ValueError("É necessário informar o id_local ou os dados para criação inline (local_inline).")
        nome_busca = partida.local_inline.loca_nome.strip()
        db_local = db.query(models.Local).filter(models.Local.loca_nome == nome_busca).first()
        if not db_local:
            db_local = models.Local(
                loca_nome=nome_busca,
                loca_descricao=partida.local_inline.loca_descricao,
                ativo=True
            )
            db.add(db_local)
            db.flush()
        id_local = db_local.id_local

    # 2. Resolve arbitro inline
    id_arbitro = partida.id_arbitro
    if not id_arbitro:
        if not partida.arbitro_inline:
            raise ValueError("É necessário informar o id_arbitro ou os dados para criação inline (arbitro_inline).")
        doc_busca = partida.arbitro_inline.apito_doc.strip()
        db_arbitro = db.query(models.Arbitro).filter(models.Arbitro.apito_doc == doc_busca).first()
        if not db_arbitro:
            db_arbitro = models.Arbitro(
                apito_nome=partida.arbitro_inline.apito_nome,
                apito_doc=doc_busca,
                apito_tel=partida.arbitro_inline.apito_tel
            )
            db.add(db_arbitro)
            db.flush()
        id_arbitro = db_arbitro.id_arbitro

    erro = verificar_conflito_partida(
        db, 
        id_local, 
        id_arbitro, 
        partida.id_modalidade, 
        partida.part_data, 
        partida.part_hora,
        id_equipe_casa=partida.id_equipe_casa,
        id_equipe_visitante=partida.id_equipe_visitante
    )
    if erro:
        raise ValueError(erro)

    dados = partida.model_dump(exclude={"local_inline", "arbitro_inline"})
    dados["id_local"] = id_local
    dados["id_arbitro"] = id_arbitro

    db_partida = models.Partida(**dados)
    db.add(db_partida)
    db.commit()
    db.refresh(db_partida)
    return db_partida

def listar_partida(db: Session, id_partida: int):
    return db.query(models.Partida).filter(models.Partida.id_partida == id_partida).first()

def listar_partidas_edicao(db: Session, id_edicao: int):
    return db.query(models.Partida).filter(models.Partida.id_edicao == id_edicao).all()

def atualizar_partida(db: Session, id_partida: int, partida_atualizada: schemas.PartidaUpdate):
    db_partida = listar_partida(db, id_partida)
    if not db_partida:
        return None
    
    dados = partida_atualizada.model_dump(exclude_unset=True)
    
    # Se mudar local, arbitro, modalidade, data, hora ou equipes, revalidar conflitos
    novo_local = dados.get("id_local", db_partida.id_local)
    novo_arbitro = dados.get("id_arbitro", db_partida.id_arbitro)
    nova_modalidade = dados.get("id_modalidade", db_partida.id_modalidade)
    nova_data = dados.get("part_data", db_partida.part_data)
    nova_hora = dados.get("part_hora", db_partida.part_hora)
    nova_casa = dados.get("id_equipe_casa", db_partida.id_equipe_casa)
    nova_visitante = dados.get("id_equipe_visitante", db_partida.id_equipe_visitante)
    
    if any(k in dados for k in ["id_local", "id_arbitro", "id_modalidade", "part_data", "part_hora", "id_equipe_casa", "id_equipe_visitante"]):
        erro = verificar_conflito_partida(
            db, 
            novo_local, 
            novo_arbitro, 
            nova_modalidade, 
            nova_data, 
            nova_hora, 
            id_partida_ignorar=id_partida,
            id_equipe_casa=nova_casa,
            id_equipe_visitante=nova_visitante
        )
        if erro:
            raise ValueError(erro)

    status_anterior = db_partida.status
    placar_casa_anterior = db_partida.placar_casa
    placar_visitante_anterior = db_partida.placar_visitante

    for chave, valor in dados.items():
        setattr(db_partida, chave, valor)

    # Se a partida foi finalizada e tem próxima partida, promover o vencedor
    if db_partida.status == "Finalizada" and db_partida.id_proxima_partida:
        if db_partida.placar_casa == db_partida.placar_visitante:
            raise ValueError("Partidas de mata-mata não podem terminar empatadas. Por favor, defina um vencedor (placar diferente).")
        
        vencedor_id = db_partida.id_equipe_casa if db_partida.placar_casa > db_partida.placar_visitante else db_partida.id_equipe_visitante
        
        if status_anterior != "Finalizada" or placar_casa_anterior != db_partida.placar_casa or placar_visitante_anterior != db_partida.placar_visitante:
            proxima = db.query(models.Partida).filter(models.Partida.id_partida == db_partida.id_proxima_partida).first()
            if proxima and proxima.status != "Agendada":
                # Se mudou o vencedor ou a partida estava finalizada e mudou o status, mas a próxima não está agendada
                if status_anterior == "Finalizada":
                    vencedor_antigo_id = db_partida.id_equipe_casa if placar_casa_anterior > placar_visitante_anterior else db_partida.id_equipe_visitante
                    if vencedor_antigo_id != vencedor_id:
                        raise ValueError("Não é possível alterar o vencedor pois a próxima partida do chaveamento já foi iniciada ou concluída.")
                else:
                    raise ValueError("Não é possível finalizar a partida pois a próxima partida do chaveamento já foi iniciada ou concluída.")

            if status_anterior == "Finalizada":
                vencedor_antigo_id = db_partida.id_equipe_casa if placar_casa_anterior > placar_visitante_anterior else db_partida.id_equipe_visitante
                if vencedor_antigo_id != vencedor_id:
                    if proxima and proxima.status == "Agendada":
                        if proxima.id_equipe_casa == vencedor_antigo_id:
                            proxima.id_equipe_casa = None
                        elif proxima.id_equipe_visitante == vencedor_antigo_id:
                            proxima.id_equipe_visitante = None
            
            if proxima:
                if proxima.id_equipe_casa != vencedor_id and proxima.id_equipe_visitante != vencedor_id:
                    if proxima.id_equipe_casa is None:
                        proxima.id_equipe_casa = vencedor_id
                    elif proxima.id_equipe_visitante is None:
                        proxima.id_equipe_visitante = vencedor_id
                    else:
                        raise ValueError("Ambas as vagas da próxima partida já estão ocupadas.")

    # Se a partida deixou de ser finalizada, remover da próxima
    elif db_partida.status != "Finalizada" and status_anterior == "Finalizada" and db_partida.id_proxima_partida:
        proxima = db.query(models.Partida).filter(models.Partida.id_partida == db_partida.id_proxima_partida).first()
        if proxima and proxima.status != "Agendada":
            raise ValueError("Não é possível reabrir a partida pois a próxima partida do chaveamento já foi iniciada ou concluída.")
            
        vencedor_antigo_id = db_partida.id_equipe_casa if placar_casa_anterior > placar_visitante_anterior else db_partida.id_equipe_visitante
        if proxima and proxima.status == "Agendada":
            if proxima.id_equipe_casa == vencedor_antigo_id:
                proxima.id_equipe_casa = None
            elif proxima.id_equipe_visitante == vencedor_antigo_id:
                proxima.id_equipe_visitante = None

    db.commit()
    db.refresh(db_partida)
    return db_partida

def excluir_partida(db: Session, id_partida: int):
    db_partida = listar_partida(db, id_partida)
    if db_partida:
        db.delete(db_partida)
        db.commit()
        return True
    return False
