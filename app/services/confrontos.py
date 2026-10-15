"""Service module for Confronto domain operations and tournament rules."""

from datetime import date, time, datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session

import models
import schemas


def verificar_conflito_confronto(
    db: Session,
    id_competicao: int,
    id_local: int,
    id_arbitro: int,
    data: date,
    hora: time,
    id_confronto_ignorar: Optional[int] = None,
    id_equipe_mandante: Optional[int] = None,
    id_equipe_visitante: Optional[int] = None,
) -> Optional[str]:
    """Check schedule overlaps for local, referee, or teams within modality duration."""
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    duracao = comp.modalidade.duracao_minutos if comp and comp.modalidade and comp.modalidade.duracao_minutos else 60

    inicio_novo = datetime.combine(data, hora)
    fim_novo = inicio_novo + timedelta(minutes=duracao)

    confrontos_dia = db.query(models.Confronto).filter(
        models.Confronto.data == data,
        models.Confronto.status != "Cancelado",
    )
    if id_confronto_ignorar:
        confrontos_dia = confrontos_dia.filter(models.Confronto.id_confronto != id_confronto_ignorar)

    for c in confrontos_dia.all():
        c_duracao = c.competicao.modalidade.duracao_minutos if c.competicao and c.competicao.modalidade and c.competicao.modalidade.duracao_minutos else 60
        inicio_existente = datetime.combine(c.data, c.hora)
        fim_existente = inicio_existente + timedelta(minutes=c_duracao)

        if (inicio_existente < fim_novo) and (inicio_novo < fim_existente):
            if c.id_local == id_local:
                return "O local já possui um confronto agendado com sobreposição de horário."
            if c.id_arbitro == id_arbitro:
                return "O árbitro já possui um confronto agendado com sobreposição de horário."
            equipes_novas = {id_equipe_mandante, id_equipe_visitante} - {None}
            equipes_existentes = {c.id_equipe_mandante, c.id_equipe_visitante} - {None}
            if equipes_novas & equipes_existentes:
                return "Uma das equipes participantes já possui um confronto agendado com sobreposição de horário."

    return None


def validar_equipes_competicao(
    db: Session,
    id_competicao: int,
    id_equipe_mandante: Optional[int] = None,
    id_equipe_visitante: Optional[int] = None,
) -> None:
    """Ensure both teams belong to the competition and are not identical."""
    if id_equipe_mandante and id_equipe_visitante and id_equipe_mandante == id_equipe_visitante:
        raise ValueError("Equipe mandante e visitante não podem ser a mesma.")

    if id_equipe_mandante:
        eq_mandante = db.query(models.Equipe).filter(models.Equipe.id_equipe == id_equipe_mandante).first()
        if not eq_mandante or eq_mandante.id_competicao != id_competicao:
            raise ValueError("Equipe mandante não pertence à competição.")

    if id_equipe_visitante:
        eq_visitante = db.query(models.Equipe).filter(models.Equipe.id_equipe == id_equipe_visitante).first()
        if not eq_visitante or eq_visitante.id_competicao != id_competicao:
            raise ValueError("Equipe visitante não pertence à competição.")


def criar_confronto(
    db: Session,
    id_competicao: int,
    dados_confronto: schemas.ConfrontoCreate,
) -> models.Confronto:
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise ValueError("Competição não encontrada.")
    if comp.modo_inscricao == "INDIVIDUAL":
        raise ValueError("Operações de confronto só são permitidas para competições em modo EQUIPE.")

    local = db.query(models.Local).filter(models.Local.id_local == dados_confronto.id_local).first()
    if not local or not local.ativo:
        raise ValueError("Local não encontrado ou inativo.")

    arbitro = db.query(models.Arbitro).filter(models.Arbitro.id_arbitro == dados_confronto.id_arbitro).first()
    if not arbitro:
        raise ValueError("Árbitro não encontrado.")

    validar_equipes_competicao(
        db,
        id_competicao,
        dados_confronto.id_equipe_mandante,
        dados_confronto.id_equipe_visitante,
    )

    erro_conflito = verificar_conflito_confronto(
        db,
        id_competicao,
        dados_confronto.id_local,
        dados_confronto.id_arbitro,
        dados_confronto.data,
        dados_confronto.hora,
        id_equipe_mandante=dados_confronto.id_equipe_mandante,
        id_equipe_visitante=dados_confronto.id_equipe_visitante,
    )
    if erro_conflito:
        raise ValueError(erro_conflito)

    if dados_confronto.id_proximo_confronto:
        prox = db.query(models.Confronto).filter(models.Confronto.id_confronto == dados_confronto.id_proximo_confronto).first()
        if not prox or prox.id_competicao != id_competicao:
            raise ValueError("Próximo confronto não encontrado ou pertence a outra competição.")

    payload = dados_confronto.model_dump()
    payload["id_competicao"] = id_competicao

    db_confronto = models.Confronto(**payload)
    db.add(db_confronto)
    db.commit()
    db.refresh(db_confronto)
    return db_confronto


def listar_confrontos_competicao(
    db: Session,
    id_competicao: int,
    fase: Optional[str] = None,
    rodada: Optional[int] = None,
    grupo: Optional[str] = None,
) -> List[models.Confronto]:
    query = db.query(models.Confronto).filter(models.Confronto.id_competicao == id_competicao)
    if fase:
        query = query.filter(models.Confronto.fase == fase)
    if rodada is not None:
        query = query.filter(models.Confronto.rodada == rodada)
    if grupo:
        query = query.filter(models.Confronto.grupo == grupo)
    return query.order_by(models.Confronto.data, models.Confronto.hora, models.Confronto.id_confronto).all()


def obter_confronto(db: Session, id_confronto: int) -> Optional[models.Confronto]:
    return db.query(models.Confronto).filter(models.Confronto.id_confronto == id_confronto).first()


def atualizar_confronto(
    db: Session,
    id_confronto: int,
    confronto_atualizado: schemas.ConfrontoUpdate,
) -> Optional[models.Confronto]:
    db_confronto = obter_confronto(db, id_confronto)
    if not db_confronto:
        return None

    dados = confronto_atualizado.model_dump(exclude_unset=True)
    comp = db_confronto.competicao

    novo_local = dados.get("id_local", db_confronto.id_local)
    novo_arbitro = dados.get("id_arbitro", db_confronto.id_arbitro)
    nova_data = dados.get("data", db_confronto.data)
    nova_hora = dados.get("hora", db_confronto.hora)
    novo_mandante = dados.get("id_equipe_mandante", db_confronto.id_equipe_mandante)
    novo_visitante = dados.get("id_equipe_visitante", db_confronto.id_equipe_visitante)

    if any(k in dados for k in ["id_equipe_mandante", "id_equipe_visitante"]):
        validar_equipes_competicao(db, db_confronto.id_competicao, novo_mandante, novo_visitante)

    if any(k in dados for k in ["id_local", "id_arbitro", "data", "hora", "id_equipe_mandante", "id_equipe_visitante"]):
        erro = verificar_conflito_confronto(
            db,
            db_confronto.id_competicao,
            novo_local,
            novo_arbitro,
            nova_data,
            nova_hora,
            id_confronto_ignorar=id_confronto,
            id_equipe_mandante=novo_mandante,
            id_equipe_visitante=novo_visitante,
        )
        if erro:
            raise ValueError(erro)

    status_anterior = db_confronto.status
    novo_status = dados.get("status", db_confronto.status)
    novo_placar_mandante = dados.get("placar_mandante", db_confronto.placar_mandante)
    novo_placar_visitante = dados.get("placar_visitante", db_confronto.placar_visitante)

    # Winner and knockout logic
    if novo_status == "Finalizado":
        if novo_placar_mandante > novo_placar_visitante:
            novo_vencedor = novo_mandante
        elif novo_placar_visitante > novo_placar_mandante:
            novo_vencedor = novo_visitante
        else:
            if db_confronto.id_proximo_confronto is not None or comp.formato == "MATA_MATA":
                raise ValueError("Confrontos eliminatórios (mata-mata) não podem terminar empatados.")
            novo_vencedor = None

        if db_confronto.id_proximo_confronto:
            proximo = db.query(models.Confronto).filter(models.Confronto.id_confronto == db_confronto.id_proximo_confronto).first()
            if proximo and proximo.status != "Agendado":
                if status_anterior == "Finalizado":
                    if db_confronto.id_equipe_vencedora != novo_vencedor:
                        raise ValueError("Não é possível alterar o vencedor pois o próximo confronto já foi iniciado ou finalizado.")
                else:
                    raise ValueError("Não é possível finalizar o confronto pois o próximo confronto já foi iniciado ou finalizado.")

            if proximo:
                vencedor_antigo = db_confronto.id_equipe_vencedora
                if vencedor_antigo and vencedor_antigo != novo_vencedor:
                    if proximo.id_equipe_mandante == vencedor_antigo:
                        proximo.id_equipe_mandante = None
                    elif proximo.id_equipe_visitante == vencedor_antigo:
                        proximo.id_equipe_visitante = None

                if novo_vencedor:
                    if proximo.id_equipe_mandante != novo_vencedor and proximo.id_equipe_visitante != novo_vencedor:
                        if proximo.id_equipe_mandante is None:
                            proximo.id_equipe_mandante = novo_vencedor
                        elif proximo.id_equipe_visitante is None:
                            proximo.id_equipe_visitante = novo_vencedor
                        else:
                            raise ValueError("Ambas as vagas do próximo confronto já estão ocupadas.")

        db_confronto.id_equipe_vencedora = novo_vencedor

    elif status_anterior == "Finalizado" and novo_status != "Finalizado":
        if db_confronto.id_proximo_confronto:
            proximo = db.query(models.Confronto).filter(models.Confronto.id_confronto == db_confronto.id_proximo_confronto).first()
            if proximo and proximo.status != "Agendado":
                raise ValueError("Não é possível reabrir o confronto pois o próximo confronto já foi iniciado ou finalizado.")
            vencedor_antigo = db_confronto.id_equipe_vencedora
            if proximo and vencedor_antigo:
                if proximo.id_equipe_mandante == vencedor_antigo:
                    proximo.id_equipe_mandante = None
                elif proximo.id_equipe_visitante == vencedor_antigo:
                    proximo.id_equipe_visitante = None
        db_confronto.id_equipe_vencedora = None

    for chave, valor in dados.items():
        setattr(db_confronto, chave, valor)

    db.commit()
    db.refresh(db_confronto)
    return db_confronto


def excluir_confronto(db: Session, id_confronto: int) -> bool:
    db_confronto = obter_confronto(db, id_confronto)
    if not db_confronto:
        return False
    if db_confronto.status != "Agendado":
        raise ValueError("Apenas confrontos não iniciados (Agendado) podem ser excluídos.")

    db.query(models.Confronto).filter(models.Confronto.id_proximo_confronto == id_confronto).update({"id_proximo_confronto": None})
    db.delete(db_confronto)
    db.commit()
    return True


def gerar_confrontos(
    db: Session,
    id_competicao: int,
    params: Optional[schemas.GerarConfrontosCompeticaoRequest] = None,
) -> List[models.Confronto]:
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise ValueError("Competição não encontrada.")
    if comp.modo_inscricao == "INDIVIDUAL":
        raise ValueError("Não é possível gerar confrontos para competição em modo INDIVIDUAL.")
    if comp.status == "RASCUNHO":
        raise ValueError("Não é possível gerar confrontos para competição em status RASCUNHO.")

    existentes = db.query(models.Confronto).filter(models.Confronto.id_competicao == id_competicao).all()
    if any(c.status in ["Em Andamento", "Finalizado"] for c in existentes):
        raise ValueError("Não é possível gerar novos confrontos porque já existem confrontos em andamento ou finalizados.")

    equipes = db.query(models.Equipe).filter(models.Equipe.id_competicao == id_competicao).all()

    local = None
    if params and params.id_local_padrao:
        local = db.query(models.Local).filter(models.Local.id_local == params.id_local_padrao, models.Local.ativo == True).first()
    if not local:
        local = db.query(models.Local).filter(models.Local.ativo == True).first()
    if not local:
        raise ValueError("Nenhum local ativo cadastrado.")

    arbitro = None
    if params and params.id_arbitro_padrao:
        arbitro = db.query(models.Arbitro).filter(models.Arbitro.id_arbitro == params.id_arbitro_padrao).first()
    if not arbitro:
        arbitro = db.query(models.Arbitro).first()
    if not arbitro:
        raise ValueError("Nenhum árbitro cadastrado.")

    data_inicio = (params.data_inicio if params and params.data_inicio else None) or comp.data_inicio or date.today()
    default_time = (params.hora_padrao if params and params.hora_padrao else None) or time(14, 0)

    for c in existentes:
        db.delete(c)
    db.flush()

    formato = comp.formato
    confrontos_gerados = []

    if formato == "PONTOS_CORRIDOS":
        if len(equipes) < 2:
            raise ValueError("É necessário ter pelo menos 2 equipes registradas para gerar confrontos de pontos corridos.")
        lista_equipes = list(equipes)
        if len(lista_equipes) % 2 != 0:
            lista_equipes.append(None)
        n = len(lista_equipes)
        rodadas = n - 1
        jogos_por_rodada = n // 2

        for r in range(rodadas):
            data_rodada = data_inicio + timedelta(weeks=r)
            for j in range(jogos_por_rodada):
                casa = lista_equipes[j]
                visitante = lista_equipes[n - 1 - j]
                if casa is not None and visitante is not None:
                    novo = models.Confronto(
                        id_competicao=id_competicao,
                        id_equipe_mandante=casa.id_equipe,
                        id_equipe_visitante=visitante.id_equipe,
                        fase=f"Rodada {r + 1}",
                        rodada=r + 1,
                        data=data_rodada,
                        hora=default_time,
                        id_local=local.id_local,
                        id_arbitro=arbitro.id_arbitro,
                        status="Agendado",
                    )
                    db.add(novo)
                    confrontos_gerados.append(novo)
            lista_equipes = [lista_equipes[0]] + [lista_equipes[-1]] + lista_equipes[1:-1]

    elif formato == "GRUPOS":
        if len(equipes) < 4:
            raise ValueError("É necessário ter pelo menos 4 equipes registradas para gerar uma competição de grupos.")
        if all(eq.grupo is None for eq in equipes):
            sorted_eqs = sorted(equipes, key=lambda x: x.nome)
            mid = len(sorted_eqs) // 2
            for idx, eq in enumerate(sorted_eqs):
                eq.grupo = "A" if idx < mid else "B"
            db.flush()

        grupos = {}
        for eq in equipes:
            g_nome = eq.grupo or "A"
            grupos.setdefault(g_nome, []).append(eq)

        max_weeks = 1
        for g_nome, lista_eqs in grupos.items():
            if len(lista_eqs) < 2:
                continue
            lista_rot = list(lista_eqs)
            if len(lista_rot) % 2 != 0:
                lista_rot.append(None)
            n = len(lista_rot)
            rodadas = n - 1
            jogos_por_rodada = n // 2
            max_weeks = max(max_weeks, rodadas)
            for r in range(rodadas):
                data_rodada = data_inicio + timedelta(weeks=r)
                for j in range(jogos_por_rodada):
                    casa = lista_rot[j]
                    visitante = lista_rot[n - 1 - j]
                    if casa is not None and visitante is not None:
                        novo = models.Confronto(
                            id_competicao=id_competicao,
                            id_equipe_mandante=casa.id_equipe,
                            id_equipe_visitante=visitante.id_equipe,
                            fase=f"Grupo {g_nome} - Rodada {r + 1}",
                            rodada=r + 1,
                            grupo=g_nome,
                            data=data_rodada,
                            hora=default_time,
                            id_local=local.id_local,
                            id_arbitro=arbitro.id_arbitro,
                            status="Agendado",
                        )
                        db.add(novo)
                        confrontos_gerados.append(novo)
                lista_rot = [lista_rot[0]] + [lista_rot[-1]] + lista_rot[1:-1]

        data_semis = data_inicio + timedelta(weeks=max_weeks)
        data_final = data_semis + timedelta(weeks=1)

        final = models.Confronto(
            id_competicao=id_competicao,
            fase="Final",
            data=data_final,
            hora=default_time,
            id_local=local.id_local,
            id_arbitro=arbitro.id_arbitro,
            status="Agendado",
            observacoes="Vencedor Semifinal 1 vs Vencedor Semifinal 2",
        )
        db.add(final)
        db.flush()

        semi1 = models.Confronto(
            id_competicao=id_competicao,
            id_proximo_confronto=final.id_confronto,
            fase="Semifinal 1",
            data=data_semis,
            hora=default_time,
            id_local=local.id_local,
            id_arbitro=arbitro.id_arbitro,
            status="Agendado",
            observacoes="1º Grupo A vs 2º Grupo B",
        )
        semi2 = models.Confronto(
            id_competicao=id_competicao,
            id_proximo_confronto=final.id_confronto,
            fase="Semifinal 2",
            data=data_semis,
            hora=default_time,
            id_local=local.id_local,
            id_arbitro=arbitro.id_arbitro,
            status="Agendado",
            observacoes="1º Grupo B vs 2º Grupo A",
        )
        db.add_all([semi1, semi2])
        confrontos_gerados.extend([final, semi1, semi2])

    elif formato == "MATA_MATA":
        if len(equipes) < 2:
            raise ValueError("É necessário ter pelo menos 2 equipes registradas para gerar o chaveamento de mata-mata.")
        fases_possiveis = ["Final", "Semifinal", "Quartas", "Oitavas"]
        fase_inicial = params.fase_inicial if params and params.fase_inicial else None
        if not fase_inicial:
            if len(equipes) <= 2:
                fase_inicial = "Final"
            elif len(equipes) <= 4:
                fase_inicial = "Semifinal"
            elif len(equipes) <= 8:
                fase_inicial = "Quartas"
            else:
                fase_inicial = "Oitavas"
        elif fase_inicial not in fases_possiveis:
            raise ValueError(f"Fase inicial inválida: {fase_inicial}")

        idx_limite = fases_possiveis.index(fase_inicial)
        max_equipes = 2 ** (idx_limite + 1)
        if len(equipes) > max_equipes:
            raise ValueError(f"Quantidade de equipes ({len(equipes)}) excede o limite máximo permitido para a fase inicial {fase_inicial} ({max_equipes} equipes).")

        fases_a_gerar = fases_possiveis[:idx_limite + 1]
        confrontos_por_fase = {}
        for idx, fase in enumerate(fases_a_gerar):
            num_jogos = 2 ** idx
            semanas = idx_limite - idx
            data_fase = data_inicio + timedelta(weeks=semanas)
            jogos_fase = []
            for j in range(num_jogos):
                id_prox = None
                if fase != "Final":
                    fase_seg = fases_a_gerar[idx - 1]
                    jogo_seg = confrontos_por_fase[fase_seg][j // 2]
                    id_prox = jogo_seg.id_confronto
                novo = models.Confronto(
                    id_competicao=id_competicao,
                    id_proximo_confronto=id_prox,
                    fase=fase,
                    data=data_fase,
                    hora=default_time,
                    id_local=local.id_local,
                    id_arbitro=arbitro.id_arbitro,
                    status="Agendado",
                )
                db.add(novo)
                db.flush()
                jogos_fase.append(novo)
            confrontos_por_fase[fase] = jogos_fase

        jogos_iniciais = confrontos_por_fase[fase_inicial]
        for i, c in enumerate(jogos_iniciais):
            idx_c = 2 * i
            idx_v = 2 * i + 1
            if idx_c < len(equipes):
                c.id_equipe_mandante = equipes[idx_c].id_equipe
            if idx_v < len(equipes):
                c.id_equipe_visitante = equipes[idx_v].id_equipe

        for j_list in confrontos_por_fase.values():
            confrontos_gerados.extend(j_list)

    db.commit()
    for c in confrontos_gerados:
        db.refresh(c)
    return confrontos_gerados
