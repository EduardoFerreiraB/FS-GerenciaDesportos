"""Serviços de partidas, agendamento e resultado simples."""

from __future__ import annotations

from datetime import datetime, time
import hashlib
import json

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload, selectinload

from models import Local, Usuario
from competicoes.contratos.partidas import (
    PartidaAgendar,
    PartidaDetalhe,
    PlacarPartida,
    ResultadoSimples,
)
from competicoes.erros import ConflitoEstado, NaoEncontrado
from competicoes.infra import incrementar_revisao, registrar_auditoria, transacao
from competicoes.modelos.disputa import DueloEliminatorio, VagaDuelo
from competicoes.modelos.operacao import RequisicaoPartida
from competicoes.modelos.organizacao import EdicaoCompeticao
from competicoes.modelos.partidas import OcorrenciaPartida, Partida
from competicoes.servicos.motores.avanco import propagar_avanco_grafo, resolver_duelo

# Garante compatibilidade de atributo status <-> estado
if not hasattr(Partida, "status"):
    Partida.status = property(
        lambda self: self.estado,
        lambda self, val: setattr(self, "estado", val),
    )


def bloquear_partida(db: Session, id_partida: int) -> Partida:
    """Bloqueia e recupera a partida para atualização."""
    consulta = (
        select(Partida)
        .options(
            joinedload(Partida.equipe_mandante),
            joinedload(Partida.equipe_visitante),
            joinedload(Partida.local),
        )
        .where(Partida.id_partida == id_partida)
        .execution_options(populate_existing=True)
    )
    if db.get_bind().dialect.name == "mysql":
        consulta = consulta.with_for_update()
    partida = db.execute(consulta).scalar_one_or_none()
    if partida is None:
        raise NaoEncontrado("Partida nao encontrada.", campos=["id_partida"])
    return partida


def _carregar_partida_completa(db: Session, id_partida: int) -> Partida:
    """Carrega uma partida com relacionamentos carregados."""
    consulta = (
        select(Partida)
        .options(
            joinedload(Partida.equipe_mandante),
            joinedload(Partida.equipe_visitante),
            joinedload(Partida.local),
        )
        .where(Partida.id_partida == id_partida)
    )
    partida = db.execute(consulta).scalar_one_or_none()
    if partida is None:
        raise NaoEncontrado("Partida nao encontrada.", campos=["id_partida"])
    return partida


def _calcular_placar(db: Session, partida: Partida) -> PlacarPartida:
    """Calcula o placar contando ocorrências de GOL (RULING R28)."""
    ocorrencias = db.execute(
        select(OcorrenciaPartida).where(
            OcorrenciaPartida.id_partida == partida.id_partida,
            OcorrenciaPartida.tipo == "GOL",
        )
    ).scalars().all()

    gm = sum(
        1
        for oc in ocorrencias
        if oc.id_equipe_beneficiada == partida.id_equipe_mandante
    )
    gv = sum(
        1
        for oc in ocorrencias
        if oc.id_equipe_beneficiada == partida.id_equipe_visitante
    )
    return PlacarPartida(
        gols_mandante=gm,
        gols_visitante=gv,
        penaltis_mandante=partida.penaltis_mandante,
        penaltis_visitante=partida.penaltis_visitante,
    )


def _construir_partida_detalhe(
    db: Session, partida: Partida, placar: PlacarPartida | None = None
) -> PartidaDetalhe:
    """Serializa Partida em PartidaDetalhe."""
    if placar is None:
        placar = _calcular_placar(db, partida)

    data_hora = None
    if partida.data and partida.hora:
        data_hora = datetime.combine(partida.data, partida.hora)
    elif partida.data:
        data_hora = datetime.combine(partida.data, time(0, 0))

    local_nome = partida.local.loca_nome if partida.local else None
    campo_desc = partida.local.loca_descricao if partida.local else None
    nome_m = partida.equipe_mandante.nome if partida.equipe_mandante else None
    nome_v = partida.equipe_visitante.nome if partida.equipe_visitante else None

    return PartidaDetalhe(
        id_partida=partida.id_partida,
        id_edicao_competicao=partida.id_edicao_competicao,
        id_grupo=partida.id_grupo,
        id_duelo=partida.id_duelo,
        rodada=partida.rodada,
        ordem_jogo=partida.ordem_jogo,
        id_equipe_mandante=partida.id_equipe_mandante,
        nome_mandante=nome_m,
        id_equipe_visitante=partida.id_equipe_visitante,
        nome_visitante=nome_v,
        data=partida.data,
        hora=partida.hora,
        data_hora=data_hora,
        id_local=partida.id_local,
        local=local_nome,
        campo=campo_desc,
        id_arbitro=partida.id_arbitro,
        estado=partida.estado,
        status=partida.estado,
        placar=placar,
        revisao=partida.revisao,
    )


def listar_partidas(
    db: Session,
    id_edicao: int,
    id_grupo: int | None = None,
    fase: str | None = None,
    rodada: int | None = None,
) -> list[PartidaDetalhe]:
    """Lista partidas da edição filtrando por grupo, fase ou rodada se informados."""
    stmt = (
        select(Partida)
        .options(
            joinedload(Partida.equipe_mandante),
            joinedload(Partida.equipe_visitante),
            joinedload(Partida.local),
        )
        .where(Partida.id_edicao_competicao == id_edicao)
    )

    if id_grupo is not None:
        stmt = stmt.where(Partida.id_grupo == id_grupo)
    if rodada is not None:
        stmt = stmt.where(Partida.rodada == rodada)
    if fase is not None:
        stmt = stmt.join(
            DueloEliminatorio, Partida.id_duelo == DueloEliminatorio.id_duelo
        ).where(DueloEliminatorio.fase == fase)

    stmt = stmt.order_by(
        Partida.rodada.asc(), Partida.ordem_jogo.asc(), Partida.id_partida.asc()
    )
    partidas = db.execute(stmt).scalars().unique().all()
    return [_construir_partida_detalhe(db, p) for p in partidas]


def agendar_partida(
    db: Session, id_partida: int, dados: PartidaAgendar, responsavel: Usuario
) -> PartidaDetalhe:
    """Atualiza agendamento (data/hora/local/campo) de uma partida."""
    with transacao(db):
        partida = bloquear_partida(db, id_partida)

        antes = {
            "data": str(partida.data) if partida.data else None,
            "hora": str(partida.hora) if partida.hora else None,
            "id_local": partida.id_local,
        }

        # Atualizar data e hora
        if dados.data_hora is not None:
            partida.data = dados.data_hora.date()
            partida.hora = dados.data_hora.time()
        elif dados.data is not None or dados.hora is not None:
            partida.data = dados.data
            partida.hora = dados.hora
        else:
            partida.data = None
            partida.hora = None

        # Atualizar local e campo
        if dados.id_local is not None:
            partida.id_local = dados.id_local
        elif dados.local is not None or dados.campo is not None:
            nome_local = dados.local or f"Local {dados.campo or 'Geral'}"
            local_obj = db.execute(
                select(Local).where(Local.loca_nome == nome_local)
            ).scalar_one_or_none()
            if local_obj is None:
                local_obj = Local(loca_nome=nome_local, loca_descricao=dados.campo)
                db.add(local_obj)
                db.flush()
            else:
                if dados.campo is not None:
                    local_obj.loca_descricao = dados.campo
            partida.id_local = local_obj.id_local
        else:
            partida.id_local = None

        depois = {
            "data": str(partida.data) if partida.data else None,
            "hora": str(partida.hora) if partida.hora else None,
            "id_local": partida.id_local,
        }

        incrementar_revisao(partida)
        registrar_auditoria(
            db,
            entidade="partida",
            id_entidade=partida.id_partida,
            acao="AGENDAR_PARTIDA",
            antes=antes,
            depois=depois,
            id_edicao_competicao=partida.id_edicao_competicao,
            responsavel=responsavel,
        )

    partida = _carregar_partida_completa(db, id_partida)
    return _construir_partida_detalhe(db, partida)


def _processar_avanco_duelo(db: Session, partida: Partida) -> None:
    """Resolve duelo eliminatório e propaga avanço automático no grafo de mata-mata."""
    duelo = db.execute(
        select(DueloEliminatorio)
        .options(selectinload(DueloEliminatorio.vagas))
        .where(DueloEliminatorio.id_duelo == partida.id_duelo)
    ).scalar_one_or_none()
    if duelo is None:
        return

    partidas_duelo = db.execute(
        select(Partida)
        .where(Partida.id_duelo == duelo.id_duelo)
    ).scalars().all()

    p_dicts = []
    for p in partidas_duelo:
        # Consulta ocorrências do banco para garantir que as alterações da transação estão incluídas
        ocorrs_p = db.execute(
            select(OcorrenciaPartida).where(
                OcorrenciaPartida.id_partida == p.id_partida,
                OcorrenciaPartida.tipo == "GOL",
            )
        ).scalars().all()

        gm = sum(
            1
            for oc in ocorrs_p
            if oc.id_equipe_beneficiada == p.id_equipe_mandante
        )
        gv = sum(
            1
            for oc in ocorrs_p
            if oc.id_equipe_beneficiada == p.id_equipe_visitante
        )
        p_dicts.append({
            "id_partida": p.id_partida,
            "id_duelo": p.id_duelo,
            "ordem_jogo": p.ordem_jogo,
            "id_equipe_mandante": p.id_equipe_mandante,
            "id_equipe_visitante": p.id_equipe_visitante,
            "estado": p.estado,
            "gols_mandante": gm,
            "gols_visitante": gv,
            "penaltis_mandante": p.penaltis_mandante,
            "penaltis_visitante": p.penaltis_visitante,
        })

    duelo_dict = {
        "id_duelo": duelo.id_duelo,
        "ida_volta": duelo.ida_volta,
        "vagas": [
            {
                "id_vaga": v.id_vaga,
                "origem": v.origem,
                "id_equipe": v.id_equipe,
                "id_equipe_resolvida": v.id_equipe_resolvida,
            }
            for v in duelo.vagas
        ],
    }

    resultado_duelo = resolver_duelo(duelo_dict, p_dicts)
    if resultado_duelo.estado == "RESOLVIDO" and resultado_duelo.id_equipe_vencedora is not None:
        duelo.estado = "RESOLVIDO"
        duelo.id_equipe_vencedora = resultado_duelo.id_equipe_vencedora

        # Propagar avanço no grafo de vagas
        todos_duelos = db.execute(
            select(DueloEliminatorio)
            .options(
                selectinload(DueloEliminatorio.vagas),
                selectinload(DueloEliminatorio.partidas),
            )
            .where(DueloEliminatorio.id_edicao_competicao == partida.id_edicao_competicao)
        ).scalars().all()

        todas_vagas = db.execute(
            select(VagaDuelo)
            .join(DueloEliminatorio, DueloEliminatorio.id_duelo == VagaDuelo.id_duelo)
            .where(DueloEliminatorio.id_edicao_competicao == partida.id_edicao_competicao)
        ).scalars().all()

        atualizacoes = propagar_avanco_grafo(
            todos_duelos,
            todas_vagas,
            duelo_resolvido_id=duelo.id_duelo,
            equipe_vencedora_id=resultado_duelo.id_equipe_vencedora,
            equipe_perdedora_id=resultado_duelo.id_equipe_perdedora,
        )

        vagas_por_id = {v.id_vaga: v for v in todas_vagas}
        duelos_afetados: set[int] = set()

        for att in atualizacoes:
            vaga = vagas_por_id.get(att.id_vaga)
            if vaga is not None:
                vaga.id_equipe_resolvida = att.id_equipe_resolvida
                vaga.id_equipe = att.id_equipe_resolvida
                duelos_afetados.add(vaga.id_duelo)

        db.flush()

        # Atualizar duelos e partidas afetadas
        for id_d in duelos_afetados:
            d_afetado = next((d for d in todos_duelos if d.id_duelo == id_d), None)
            if d_afetado is None:
                continue
            vagas_d = sorted(d_afetado.vagas, key=lambda v: v.posicao)
            times = [v.id_equipe_resolvida or v.id_equipe for v in vagas_d]
            if len(times) == 2 and all(t is not None for t in times):
                if d_afetado.estado == "PENDENTE":
                    d_afetado.estado = "DEFINIDO"

                partidas_prox = db.execute(
                    select(Partida).where(Partida.id_duelo == d_afetado.id_duelo)
                ).scalars().all()

                if partidas_prox:
                    for p in partidas_prox:
                        if p.ordem_jogo == 1:
                            p.id_equipe_mandante = times[0]
                            p.id_equipe_visitante = times[1]
                        elif p.ordem_jogo == 2:
                            p.id_equipe_mandante = times[1]
                            p.id_equipe_visitante = times[0]
                else:
                    p1 = Partida(
                        id_edicao_competicao=partida.id_edicao_competicao,
                        id_duelo=d_afetado.id_duelo,
                        ordem_jogo=1,
                        id_equipe_mandante=times[0],
                        id_equipe_visitante=times[1],
                        estado="AGENDADA",
                    )
                    db.add(p1)
                    if d_afetado.ida_volta:
                        p2 = Partida(
                            id_edicao_competicao=partida.id_edicao_competicao,
                            id_duelo=d_afetado.id_duelo,
                            ordem_jogo=2,
                            id_equipe_mandante=times[1],
                            id_equipe_visitante=times[0],
                            estado="AGENDADA",
                        )
                        db.add(p2)


def registrar_resultado_simples(
    db: Session,
    id_partida: int,
    dados: ResultadoSimples,
    idempotency_key: str,
    responsavel: Usuario,
) -> PartidaDetalhe:
    """Registra resultado simples de partida com idempotência por Idempotency-Key."""
    # 1. Idempotência (RULING R29)
    payload_bytes = json.dumps(
        dados.model_dump(), sort_keys=True, default=str
    ).encode("utf-8")
    hash_payload = hashlib.sha256(payload_bytes).hexdigest()

    req_existente = db.execute(
        select(RequisicaoPartida).where(
            RequisicaoPartida.id_partida == id_partida,
            RequisicaoPartida.chave_idempotencia == idempotency_key,
        )
    ).scalar_one_or_none()

    if req_existente is not None:
        if req_existente.hash_payload != hash_payload:
            raise ConflitoEstado(
                "Chave de idempotência já utilizada com payload divergente.",
                campos=["idempotency_key"],
            )
        if req_existente.resultado:
            return PartidaDetalhe.model_validate(req_existente.resultado)
        partida = _carregar_partida_completa(db, id_partida)
        return _construir_partida_detalhe(db, partida)

    # 2. Validações pré-transação
    partida = bloquear_partida(db, id_partida)

    edicao = db.execute(
        select(EdicaoCompeticao).where(
            EdicaoCompeticao.id_edicao_competicao == partida.id_edicao_competicao
        )
    ).scalar_one_or_none()
    if edicao is None or edicao.estado != "EM_ANDAMENTO":
        raise ConflitoEstado(
            "A edição deve estar EM_ANDAMENTO para registrar resultado.",
            campos=["estado"],
        )

    if not partida.id_equipe_mandante or not partida.id_equipe_visitante:
        raise ConflitoEstado(
            "Partida não possui mandante e visitante definidos.",
            campos=["id_equipe_mandante", "id_equipe_visitante"],
        )

    # 3. Transação atômica
    with transacao(db):
        partida = bloquear_partida(db, id_partida)

        # Ocorrências existentes antes da exclusão
        ocorrs_antigas = db.execute(
            select(OcorrenciaPartida).where(
                OcorrenciaPartida.id_partida == id_partida,
                OcorrenciaPartida.tipo == "GOL",
            )
        ).scalars().all()

        antes = {
            "estado": partida.estado,
            "penaltis_mandante": partida.penaltis_mandante,
            "penaltis_visitante": partida.penaltis_visitante,
            "gols_mandante": sum(
                1
                for oc in ocorrs_antigas
                if oc.id_equipe_beneficiada == partida.id_equipe_mandante
            ),
            "gols_visitante": sum(
                1
                for oc in ocorrs_antigas
                if oc.id_equipe_beneficiada == partida.id_equipe_visitante
            ),
        }

        # Remove ocorrências anteriores (caso de re-registro / retificação)
        db.execute(
            delete(OcorrenciaPartida).where(OcorrenciaPartida.id_partida == id_partida)
        )

        gols_m = dados.gols_mandante
        gols_v = dados.gols_visitante
        if dados.wo and dados.equipe_wo_id is not None and gols_m == 0 and gols_v == 0:
            if dados.equipe_wo_id == partida.id_equipe_mandante:
                gols_v = 3
            elif dados.equipe_wo_id == partida.id_equipe_visitante:
                gols_m = 3

        obs = "W.O." if dados.wo else None
        for _ in range(gols_m):
            db.add(
                OcorrenciaPartida(
                    id_partida=id_partida,
                    tipo="GOL",
                    id_equipe_beneficiada=partida.id_equipe_mandante,
                    minuto=0,
                    observacao=obs,
                    id_usuario_autor=responsavel.id_usuario,
                )
            )
        for _ in range(gols_v):
            db.add(
                OcorrenciaPartida(
                    id_partida=id_partida,
                    tipo="GOL",
                    id_equipe_beneficiada=partida.id_equipe_visitante,
                    minuto=0,
                    observacao=obs,
                    id_usuario_autor=responsavel.id_usuario,
                )
            )

        partida.penaltis_mandante = dados.penaltis_mandante
        partida.penaltis_visitante = dados.penaltis_visitante
        partida.estado = "FINALIZADA"
        incrementar_revisao(partida)

        db.flush()

        # Avanço no mata-mata se duelo eliminatório
        if partida.id_duelo is not None:
            _processar_avanco_duelo(db, partida)

        depois = {
            "estado": partida.estado,
            "penaltis_mandante": partida.penaltis_mandante,
            "penaltis_visitante": partida.penaltis_visitante,
            "gols_mandante": gols_m,
            "gols_visitante": gols_v,
            "wo": dados.wo,
        }

        registrar_auditoria(
            db,
            entidade="partida",
            id_entidade=partida.id_partida,
            acao="REGISTRAR_RESULTADO_SIMPLES",
            antes=antes,
            depois=depois,
            id_edicao_competicao=partida.id_edicao_competicao,
            responsavel=responsavel,
        )

        placar_final = PlacarPartida(
            gols_mandante=gols_m,
            gols_visitante=gols_v,
            penaltis_mandante=dados.penaltis_mandante,
            penaltis_visitante=dados.penaltis_visitante,
        )
        detalhe_obj = _construir_partida_detalhe(db, partida, placar=placar_final)
        resultado_json = detalhe_obj.model_dump(mode="json")
        req = RequisicaoPartida(
            id_partida=id_partida,
            chave_idempotencia=idempotency_key,
            hash_payload=hash_payload,
            resultado=resultado_json,
        )
        db.add(req)

    partida = _carregar_partida_completa(db, id_partida)
    return _construir_partida_detalhe(db, partida)
