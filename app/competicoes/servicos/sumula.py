"""Serviços de súmula detalhada, ocorrências, ciclo de vida de partida, reabertura e artilharia."""

from __future__ import annotations

import hashlib
import json

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from models import Usuario
from competicoes.contratos.partidas import PartidaDetalhe
from competicoes.contratos.sumula import (
    AlertaSuspensoPartida,
    OcorrenciaAutorAtualizar,
    OcorrenciaCriar,
    OcorrenciaDetalhe,
    PartidaFinalizar,
    SumulaDetalhe,
    TabelaArtilhariaDetalhe,
)
from competicoes.erros import ConfiguracaoInvalida, ConflitoEstado, NaoEncontrado
from competicoes.infra import (
    bloquear_edicao,
    incrementar_revisao,
    registrar_auditoria,
    transacao,
)
from competicoes.modelos.disciplina import SuspensaoCompeticao
from competicoes.modelos.disputa import DueloEliminatorio, VagaDuelo
from competicoes.modelos.operacao import AuditoriaCompeticao, RequisicaoPartida
from competicoes.modelos.organizacao import EdicaoCompeticao
from competicoes.modelos.partidas import OcorrenciaPartida, Partida
from competicoes.modelos.pessoas import IntegranteEquipe
from competicoes.servicos.motores.sumula import (
    analisar_impacto_reabertura,
    avaliar_derivacao_segundo_amarelo,
    calcular_artilharia,
    resolver_equipe_beneficiada,
)
from competicoes.servicos.partidas import (
    _calcular_placar,
    _carregar_partida_completa,
    _construir_partida_detalhe,
    _processar_avanco_duelo,
    _reconciliar_sancoes_edicao,
    _validar_penaltis,
    bloquear_partida,
)


def obter_sumula(db: Session, id_partida: int) -> SumulaDetalhe:
    """Retorna a súmula detalhada da partida com ocorrências e alertas de suspensos."""
    partida = _carregar_partida_completa(db, id_partida)
    partida_detalhe = _construir_partida_detalhe(db, partida)

    ocorrencias_orm = (
        db.execute(
            select(OcorrenciaPartida)
            .options(joinedload(OcorrenciaPartida.integrante))
            .where(OcorrenciaPartida.id_partida == id_partida)
        )
        .scalars()
        .all()
    )

    ocorrencias_ordenadas = sorted(
        ocorrencias_orm,
        key=lambda oc: (
            oc.minuto if oc.minuto is not None else 9999,
            oc.id_ocorrencia,
        ),
    )

    ocorrencias_detalhe = [
        OcorrenciaDetalhe(
            id_ocorrencia=oc.id_ocorrencia,
            id_partida=oc.id_partida,
            tipo=oc.tipo,
            id_equipe_beneficiada=oc.id_equipe_beneficiada,
            id_integrante=oc.id_integrante,
            nome_integrante=(
                oc.integrante.nome_esportivo if oc.integrante is not None else None
            ),
            numero_camisa=(
                oc.integrante.numero_camisa if oc.integrante is not None else None
            ),
            minuto=oc.minuto,
            periodo=oc.periodo,
            observacao=oc.observacao,
            id_ocorrencia_origem=oc.id_ocorrencia_origem,
            criado_em=oc.criado_em,
        )
        for oc in ocorrencias_ordenadas
    ]

    equipes_partida = [
        eq
        for eq in (partida.id_equipe_mandante, partida.id_equipe_visitante)
        if eq is not None
    ]

    alertas: list[AlertaSuspensoPartida] = []
    if equipes_partida:
        suspensoes_ativas = (
            db.execute(
                select(SuspensaoCompeticao)
                .join(
                    IntegranteEquipe,
                    IntegranteEquipe.id_integrante == SuspensaoCompeticao.id_integrante,
                )
                .options(
                    joinedload(SuspensaoCompeticao.integrante),
                    selectinload(SuspensaoCompeticao.cumprimentos),
                )
                .where(
                    SuspensaoCompeticao.id_edicao_competicao
                    == partida.id_edicao_competicao,
                    SuspensaoCompeticao.situacao == "ATIVA",
                    IntegranteEquipe.id_equipe.in_(equipes_partida),
                )
                .order_by(SuspensaoCompeticao.id_suspensao.asc())
            )
            .scalars()
            .unique()
            .all()
        )

        for susp in suspensoes_ativas:
            cumpridos = len(susp.cumprimentos or [])
            pendentes = int(susp.jogos) - cumpridos
            if pendentes > 0 and susp.integrante is not None:
                alertas.append(
                    AlertaSuspensoPartida(
                        id_integrante=susp.id_integrante,
                        nome_esportivo=susp.integrante.nome_esportivo,
                        id_equipe=susp.integrante.id_equipe,
                        id_suspensao=susp.id_suspensao,
                        jogos_pendentes=pendentes,
                        motivo=susp.motivo,
                    )
                )

    return SumulaDetalhe(
        partida=partida_detalhe,
        ocorrencias=ocorrencias_detalhe,
        alertas_suspensos=alertas,
    )


def iniciar_partida(
    db: Session, id_partida: int, responsavel: Usuario
) -> PartidaDetalhe:
    """Inicia uma partida agendada (AGENDADA -> EM_ANDAMENTO)."""
    with transacao(db):
        partida = bloquear_partida(db, id_partida)
        edicao = bloquear_edicao(db, partida.id_edicao_competicao)

        if edicao.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "A edição precisa estar em andamento para iniciar uma partida.",
                campos=["estado"],
            )

        if partida.estado == "EM_ANDAMENTO":
            return _construir_partida_detalhe(db, partida)

        if partida.estado != "AGENDADA":
            raise ConflitoEstado(
                "Apenas partidas agendadas podem ser iniciadas.",
                campos=["estado"],
            )

        if not partida.id_equipe_mandante or not partida.id_equipe_visitante:
            raise ConflitoEstado(
                "Partida não possui mandante e visitante definidos.",
                campos=["id_equipe_mandante", "id_equipe_visitante"],
            )

        antes = {"estado": partida.estado}
        partida.estado = "EM_ANDAMENTO"
        incrementar_revisao(partida)

        registrar_auditoria(
            db,
            entidade="partida",
            id_entidade=partida.id_partida,
            acao="INICIAR_PARTIDA",
            antes=antes,
            depois={"estado": partida.estado},
            id_edicao_competicao=partida.id_edicao_competicao,
            responsavel=responsavel,
        )

    partida = _carregar_partida_completa(db, id_partida)
    return _construir_partida_detalhe(db, partida)


def registrar_ocorrencia(
    db: Session,
    id_partida: int,
    dados: OcorrenciaCriar,
    idempotency_key: str | None,
    responsavel: Usuario,
) -> SumulaDetalhe:
    """Registra ocorrência na súmula da partida com suporte opcional a Idempotency-Key."""
    hash_payload: str | None = None
    if idempotency_key:
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
                return SumulaDetalhe.model_validate(req_existente.resultado)
            return obter_sumula(db, id_partida)

    with transacao(db):
        partida = bloquear_partida(db, id_partida)
        edicao = bloquear_edicao(db, partida.id_edicao_competicao)

        if edicao.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "A edição precisa estar em andamento para registrar ocorrências.",
                campos=["estado"],
            )

        if partida.estado not in ("AGENDADA", "EM_ANDAMENTO"):
            raise ConflitoEstado(
                "Não é permitido registrar ocorrências em partida finalizada ou cancelada. Reabra a partida primeiro.",
                campos=["estado"],
            )

        if not partida.id_equipe_mandante or not partida.id_equipe_visitante:
            raise ConflitoEstado(
                "Partida não possui mandante e visitante definidos.",
                campos=["id_equipe_mandante", "id_equipe_visitante"],
            )

        integrante = None
        if dados.id_integrante is not None:
            integrante = db.get(IntegranteEquipe, dados.id_integrante)
            if (
                integrante is None
                or integrante.id_edicao_competicao != partida.id_edicao_competicao
            ):
                raise ConfiguracaoInvalida(
                    "O integrante informado não pertence às equipes desta partida.",
                    campos=["id_integrante"],
                )

        id_equipe_integrante = (
            integrante.id_equipe if integrante is not None else None
        )

        id_equipe_beneficiada = resolver_equipe_beneficiada(
            tipo=dados.tipo,
            id_equipe_informada=dados.id_equipe,
            id_integrante=dados.id_integrante,
            id_equipe_integrante=id_equipe_integrante,
            id_mandante=partida.id_equipe_mandante,
            id_visitante=partida.id_equipe_visitante,
        )

        ocorrencias_atuais = (
            db.execute(
                select(OcorrenciaPartida).where(
                    OcorrenciaPartida.id_partida == id_partida
                )
            )
            .scalars()
            .all()
        )

        deve_derivar_expulsao = avaliar_derivacao_segundo_amarelo(
            ocorrencias_partida=ocorrencias_atuais,
            tipo_novo=dados.tipo,
            id_integrante=dados.id_integrante,
        )

        if partida.estado == "AGENDADA":
            partida.estado = "EM_ANDAMENTO"

        nova_oc = OcorrenciaPartida(
            id_partida=id_partida,
            tipo=dados.tipo,
            id_equipe_beneficiada=id_equipe_beneficiada,
            id_integrante=dados.id_integrante,
            minuto=dados.minuto,
            periodo=dados.periodo,
            observacao=dados.observacao,
            id_usuario_autor=responsavel.id_usuario,
        )
        db.add(nova_oc)
        db.flush()

        id_expulsao_derivada: int | None = None
        if deve_derivar_expulsao:
            oc_expulsao = OcorrenciaPartida(
                id_partida=id_partida,
                tipo="EXPULSAO_SEGUNDO_AMARELO",
                id_equipe_beneficiada=id_equipe_beneficiada,
                id_integrante=dados.id_integrante,
                minuto=dados.minuto,
                periodo=dados.periodo,
                observacao="Expulsão automática por 2º cartão amarelo",
                id_usuario_autor=responsavel.id_usuario,
                id_ocorrencia_origem=nova_oc.id_ocorrencia,
            )
            db.add(oc_expulsao)
            db.flush()
            id_expulsao_derivada = oc_expulsao.id_ocorrencia

        incrementar_revisao(partida)

        registrar_auditoria(
            db,
            entidade="ocorrencia_partida",
            id_entidade=nova_oc.id_ocorrencia,
            acao="REGISTRAR_OCORRENCIA",
            antes=None,
            depois={
                "id_ocorrencia": nova_oc.id_ocorrencia,
                "id_partida": id_partida,
                "tipo": nova_oc.tipo,
                "id_equipe_beneficiada": nova_oc.id_equipe_beneficiada,
                "id_integrante": nova_oc.id_integrante,
                "minuto": nova_oc.minuto,
                "id_expulsao_derivada": id_expulsao_derivada,
            },
            id_edicao_competicao=partida.id_edicao_competicao,
            responsavel=responsavel,
            motivo=dados.motivo,
        )

        sumula = obter_sumula(db, id_partida)

        if idempotency_key and hash_payload:
            req = RequisicaoPartida(
                id_partida=id_partida,
                chave_idempotencia=idempotency_key,
                hash_payload=hash_payload,
                resultado=sumula.model_dump(mode="json"),
            )
            db.add(req)

    return obter_sumula(db, id_partida)


def atribuir_autor_ocorrencia(
    db: Session,
    id_ocorrencia: int,
    dados: OcorrenciaAutorAtualizar,
    responsavel: Usuario,
) -> SumulaDetalhe:
    """Atribui ou corrige o autor de uma ocorrência existente sem alterar o placar."""
    with transacao(db):
        oc = db.get(OcorrenciaPartida, id_ocorrencia)
        if oc is None:
            raise NaoEncontrado(
                "Ocorrência não encontrada.", campos=["id_ocorrencia"]
            )

        partida = bloquear_partida(db, oc.id_partida)
        edicao = bloquear_edicao(db, partida.id_edicao_competicao)

        if edicao.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "A edição precisa estar em andamento para alterar ocorrências.",
                campos=["estado"],
            )

        if partida.estado == "CANCELADA":
            raise ConflitoEstado(
                "Não é permitido alterar ocorrências de partida cancelada.",
                campos=["estado"],
            )

        motivo_limpo = (dados.motivo or "").strip() if dados.motivo else None
        if partida.estado == "FINALIZADA":
            if not motivo_limpo or len(motivo_limpo) < 3:
                raise ConfiguracaoInvalida(
                    "Informe um motivo com ao menos 3 caracteres para corrigir autoria em partida finalizada.",
                    campos=["motivo"],
                )

        if (
            oc.tipo
            in (
                "GOL_CONTRA",
                "CARTAO_AMARELO",
                "CARTAO_VERMELHO_DIRETO",
                "EXPULSAO_SEGUNDO_AMARELO",
            )
            and dados.id_integrante is None
        ):
            raise ConfiguracaoInvalida(
                "Este tipo de ocorrência exige um integrante identificado.",
                campos=["id_integrante"],
            )

        if dados.id_integrante is not None:
            integrante = db.get(IntegranteEquipe, dados.id_integrante)
            if (
                integrante is None
                or integrante.id_edicao_competicao != partida.id_edicao_competicao
            ):
                raise ConfiguracaoInvalida(
                    "O integrante informado não pertence a esta edição.",
                    campos=["id_integrante"],
                )

            if oc.tipo == "GOL":
                if integrante.id_equipe != oc.id_equipe_beneficiada:
                    raise ConfiguracaoInvalida(
                        "Em gol normal, o integrante deve pertencer à equipe beneficiada.",
                        campos=["id_integrante"],
                    )
            elif oc.tipo == "GOL_CONTRA":
                equipe_adversaria = (
                    partida.id_equipe_visitante
                    if oc.id_equipe_beneficiada == partida.id_equipe_mandante
                    else partida.id_equipe_mandante
                )
                if integrante.id_equipe != equipe_adversaria:
                    raise ConfiguracaoInvalida(
                        "Em gol contra, o integrante deve pertencer à equipe adversária da beneficiada.",
                        campos=["id_integrante"],
                    )
            else:
                if integrante.id_equipe != oc.id_equipe_beneficiada:
                    raise ConfiguracaoInvalida(
                        "O integrante deve pertencer à equipe da ocorrência.",
                        campos=["id_integrante"],
                    )

        antes = {"id_integrante": oc.id_integrante}
        oc.id_integrante = dados.id_integrante
        incrementar_revisao(partida)
        db.flush()

        registrar_auditoria(
            db,
            entidade="ocorrencia_partida",
            id_entidade=oc.id_ocorrencia,
            acao="ATRIBUIR_AUTOR_OCORRENCIA",
            antes=antes,
            depois={"id_integrante": oc.id_integrante},
            id_edicao_competicao=partida.id_edicao_competicao,
            responsavel=responsavel,
            motivo=motivo_limpo,
        )

        id_partida = partida.id_partida

    return obter_sumula(db, id_partida)


def remover_ocorrencia(
    db: Session,
    id_ocorrencia: int,
    motivo: str | None,
    responsavel: Usuario,
) -> SumulaDetalhe:
    """Remove uma ocorrência de partida em andamento e reconcilia derivações e sanções."""
    with transacao(db):
        oc = db.get(OcorrenciaPartida, id_ocorrencia)
        if oc is None:
            raise NaoEncontrado(
                "Ocorrência não encontrada.", campos=["id_ocorrencia"]
            )

        partida = bloquear_partida(db, oc.id_partida)
        edicao = bloquear_edicao(db, partida.id_edicao_competicao)

        if edicao.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "A edição precisa estar em andamento para remover ocorrências.",
                campos=["estado"],
            )

        if partida.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "O jogo precisa estar em andamento para remover ocorrências. Reabra o jogo primeiro.",
                campos=["estado"],
            )

        # DF-RT14-07: corrigir súmula de jogo que já foi finalizado exige justificativa (spec 7.2).
        ja_finalizada = db.execute(
            select(AuditoriaCompeticao.id_auditoria).where(
                AuditoriaCompeticao.entidade == "partida",
                AuditoriaCompeticao.id_entidade == partida.id_partida,
                AuditoriaCompeticao.acao == "REABRIR_PARTIDA",
            ).limit(1)
        ).first() is not None
        motivo = (motivo or "").strip() or None
        if ja_finalizada and (motivo is None or len(motivo) < 3):
            raise ConfiguracaoInvalida(
                "Informe o motivo da remoção (mínimo de 3 caracteres): este jogo já tinha sido finalizado.",
                campos=["motivo"],
            )

        if oc.tipo == "EXPULSAO_SEGUNDO_AMARELO":
            raise ConfiguracaoInvalida(
                "Remova o cartão amarelo que originou a expulsão.",
                campos=["id_ocorrencia"],
            )

        if oc.tipo == "CARTAO_AMARELO" and oc.id_integrante is not None:
            expulsoes_derivadas = (
                db.execute(
                    select(OcorrenciaPartida).where(
                        OcorrenciaPartida.id_partida == partida.id_partida,
                        OcorrenciaPartida.tipo == "EXPULSAO_SEGUNDO_AMARELO",
                        OcorrenciaPartida.id_integrante == oc.id_integrante,
                    )
                )
                .scalars()
                .all()
            )
            for exp in expulsoes_derivadas:
                db.delete(exp)

        id_partida = partida.id_partida
        id_edicao = partida.id_edicao_competicao
        antes = {
            "id_ocorrencia": oc.id_ocorrencia,
            "tipo": oc.tipo,
            "id_equipe_beneficiada": oc.id_equipe_beneficiada,
            "id_integrante": oc.id_integrante,
            "minuto": oc.minuto,
        }

        db.delete(oc)
        db.flush()

        incrementar_revisao(partida)
        _reconciliar_sancoes_edicao(db, id_edicao, responsavel)

        registrar_auditoria(
            db,
            entidade="ocorrencia_partida",
            id_entidade=id_ocorrencia,
            acao="REMOVER_OCORRENCIA",
            antes=antes,
            depois=None,
            id_edicao_competicao=id_edicao,
            responsavel=responsavel,
            motivo=motivo,
        )

    return obter_sumula(db, id_partida)


def finalizar_partida(
    db: Session,
    id_partida: int,
    dados: PartidaFinalizar | None,
    responsavel: Usuario,
) -> PartidaDetalhe:
    """Finaliza a partida consolidando placar, avanço de mata-mata e sanções disciplinares."""
    with transacao(db):
        partida = bloquear_partida(db, id_partida)
        edicao = bloquear_edicao(db, partida.id_edicao_competicao)

        if edicao.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "A edição precisa estar em andamento para finalizar uma partida.",
                campos=["estado"],
            )

        if partida.estado in ("CANCELADA", "FINALIZADA"):
            raise ConflitoEstado(
                f"Partida com estado {partida.estado} não pode ser finalizada.",
                campos=["estado"],
            )

        if not partida.id_equipe_mandante or not partida.id_equipe_visitante:
            raise ConflitoEstado(
                "Partida não possui mandante e visitante definidos.",
                campos=["id_equipe_mandante", "id_equipe_visitante"],
            )

        placar = _calcular_placar(db, partida)

        pm = (
            dados.penaltis_mandante
            if dados is not None and dados.penaltis_mandante is not None
            else (
                None
                if dados is not None
                and (
                    dados.penaltis_mandante is not None
                    or dados.penaltis_visitante is not None
                )
                else partida.penaltis_mandante
            )
        )
        pv = (
            dados.penaltis_visitante
            if dados is not None and dados.penaltis_visitante is not None
            else (
                None
                if dados is not None
                and (
                    dados.penaltis_mandante is not None
                    or dados.penaltis_visitante is not None
                )
                else partida.penaltis_visitante
            )
        )

        _validar_penaltis(db, partida, placar, pm, pv)

        antes = {
            "estado": partida.estado,
            "penaltis_mandante": partida.penaltis_mandante,
            "penaltis_visitante": partida.penaltis_visitante,
        }
        partida.penaltis_mandante = pm
        partida.penaltis_visitante = pv
        partida.estado = "FINALIZADA"
        incrementar_revisao(partida)
        db.flush()

        if partida.id_duelo is not None:
            _processar_avanco_duelo(db, partida)

        _reconciliar_sancoes_edicao(db, partida.id_edicao_competicao, responsavel)

        registrar_auditoria(
            db,
            entidade="partida",
            id_entidade=partida.id_partida,
            acao="FINALIZAR_PARTIDA",
            antes=antes,
            depois={
                "estado": partida.estado,
                "gols_mandante": placar.gols_mandante,
                "gols_visitante": placar.gols_visitante,
                "penaltis_mandante": partida.penaltis_mandante,
                "penaltis_visitante": partida.penaltis_visitante,
            },
            id_edicao_competicao=partida.id_edicao_competicao,
            responsavel=responsavel,
        )

    partida = _carregar_partida_completa(db, id_partida)
    return _construir_partida_detalhe(db, partida)


def reabrir_partida(
    db: Session,
    id_partida: int,
    motivo: str,
    responsavel: Usuario,
) -> PartidaDetalhe:
    """Reabre uma partida finalizada ou cancelada validando impacto transitivo no grafo."""
    motivo_limpo = (motivo or "").strip()
    if len(motivo_limpo) < 3:
        raise ConfiguracaoInvalida(
            "Informe um motivo com ao menos 3 caracteres para reabrir a partida.",
            campos=["motivo"],
        )

    with transacao(db):
        partida = bloquear_partida(db, id_partida)
        edicao = bloquear_edicao(db, partida.id_edicao_competicao)

        if edicao.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "A edição precisa estar em andamento para reabrir uma partida.",
                campos=["estado"],
            )

        if partida.estado not in ("FINALIZADA", "CANCELADA"):
            raise ConflitoEstado(
                "Apenas partidas finalizadas ou canceladas podem ser reabertas.",
                campos=["estado"],
            )

        todos_duelos = (
            db.execute(
                select(DueloEliminatorio).where(
                    DueloEliminatorio.id_edicao_competicao
                    == partida.id_edicao_competicao
                )
            )
            .scalars()
            .all()
        )
        todas_vagas = (
            db.execute(
                select(VagaDuelo)
                .join(
                    DueloEliminatorio,
                    DueloEliminatorio.id_duelo == VagaDuelo.id_duelo,
                )
                .where(
                    DueloEliminatorio.id_edicao_competicao
                    == partida.id_edicao_competicao
                )
            )
            .scalars()
            .all()
        )
        todas_partidas = (
            db.execute(
                select(Partida)
                .options(selectinload(Partida.ocorrencias))
                .where(
                    Partida.id_edicao_competicao == partida.id_edicao_competicao
                )
            )
            .scalars()
            .all()
        )

        partidas_info = [
            {
                "id_partida": p.id_partida,
                "id_duelo": p.id_duelo,
                "ordem_jogo": p.ordem_jogo,
                "estado": p.estado,
                "tem_ocorrencias": len(p.ocorrencias or []) > 0,
            }
            for p in todas_partidas
        ]

        impacto = analisar_impacto_reabertura(
            duelos=todos_duelos,
            vagas=todas_vagas,
            partidas=partidas_info,
            id_partida_alvo=id_partida,
        )

        if impacto["bloqueado"]:
            raise ConflitoEstado(
                impacto["motivo"]
                or "Reabertura bloqueada por dependências já iniciadas.",
                campos=["id_partida"],
            )

        for id_p_rem in impacto["ids_partidas_remover"]:
            p_rem = db.get(Partida, id_p_rem)
            if p_rem is not None:
                db.delete(p_rem)
        db.flush()

        for id_v in impacto["ids_vagas_afetadas"]:
            vaga = db.get(VagaDuelo, id_v)
            if vaga is not None:
                vaga.id_equipe_resolvida = None
                if vaga.origem in ("VENCEDOR_DUELO", "PERDEDOR_DUELO"):
                    vaga.id_equipe = None

        for id_d in impacto["ids_duelos_afetados"]:
            duelo_af = db.get(DueloEliminatorio, id_d)
            if duelo_af is not None:
                duelo_af.estado = "PENDENTE"
                duelo_af.id_equipe_vencedora = None

        if partida.id_duelo is not None:
            duelo_proprio = db.get(DueloEliminatorio, partida.id_duelo)
            if duelo_proprio is not None:
                duelo_proprio.estado = "DEFINIDO"
                duelo_proprio.id_equipe_vencedora = None

        antes = {"estado": partida.estado}
        partida.estado = (
            "AGENDADA" if partida.estado == "CANCELADA" else "EM_ANDAMENTO"
        )
        incrementar_revisao(partida)
        db.flush()

        _reconciliar_sancoes_edicao(db, partida.id_edicao_competicao, responsavel)

        registrar_auditoria(
            db,
            entidade="partida",
            id_entidade=partida.id_partida,
            acao="REABRIR_PARTIDA",
            antes=antes,
            depois={"estado": partida.estado},
            id_edicao_competicao=partida.id_edicao_competicao,
            responsavel=responsavel,
            motivo=motivo_limpo,
        )

    partida = _carregar_partida_completa(db, id_partida)
    return _construir_partida_detalhe(db, partida)


def cancelar_partida(
    db: Session,
    id_partida: int,
    motivo: str,
    responsavel: Usuario,
) -> PartidaDetalhe:
    """Cancela uma partida agendada sem ocorrências."""
    motivo_limpo = (motivo or "").strip()
    if len(motivo_limpo) < 3:
        raise ConfiguracaoInvalida(
            "Informe um motivo com ao menos 3 caracteres para cancelar a partida.",
            campos=["motivo"],
        )

    with transacao(db):
        partida = bloquear_partida(db, id_partida)
        edicao = bloquear_edicao(db, partida.id_edicao_competicao)

        if edicao.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "A edição precisa estar em andamento para cancelar uma partida.",
                campos=["estado"],
            )

        tem_ocorrencias = (
            db.execute(
                select(OcorrenciaPartida.id_ocorrencia)
                .where(OcorrenciaPartida.id_partida == id_partida)
                .limit(1)
            ).scalar_one_or_none()
            is not None
        )

        if partida.estado != "AGENDADA" or tem_ocorrencias:
            raise ConflitoEstado(
                "Apenas partidas agendadas e sem ocorrências registradas podem ser canceladas.",
                campos=["estado"],
            )

        antes = {"estado": partida.estado}
        partida.estado = "CANCELADA"
        incrementar_revisao(partida)

        registrar_auditoria(
            db,
            entidade="partida",
            id_entidade=partida.id_partida,
            acao="CANCELAR_PARTIDA",
            antes=antes,
            depois={"estado": partida.estado},
            id_edicao_competicao=partida.id_edicao_competicao,
            responsavel=responsavel,
            motivo=motivo_limpo,
        )

    partida = _carregar_partida_completa(db, id_partida)
    return _construir_partida_detalhe(db, partida)


def obter_artilharia_edicao(
    db: Session, id_edicao: int
) -> TabelaArtilhariaDetalhe:
    """Calcula e retorna a tabela de artilharia da edição."""
    edicao = db.get(EdicaoCompeticao, id_edicao)
    if edicao is None:
        raise NaoEncontrado(
            f"Edição de competição {id_edicao} não encontrada.",
            campos=["id_edicao_competicao"],
        )

    partidas = (
        db.execute(
            select(Partida).where(Partida.id_edicao_competicao == id_edicao)
        )
        .scalars()
        .all()
    )
    ids_partidas = [p.id_partida for p in partidas]

    ocorrencias = (
        db.execute(
            select(OcorrenciaPartida).where(
                OcorrenciaPartida.id_partida.in_(ids_partidas)
            )
        )
        .scalars()
        .all()
        if ids_partidas
        else []
    )

    integrantes_orm = (
        db.execute(
            select(IntegranteEquipe)
            .options(joinedload(IntegranteEquipe.equipe))
            .where(IntegranteEquipe.id_edicao_competicao == id_edicao)
        )
        .scalars()
        .all()
    )

    integrantes_map = {
        i.id_integrante: {
            "id_integrante": i.id_integrante,
            "id_competidor": i.id_competidor,
            "nome_esportivo": i.nome_esportivo,
            "numero_camisa": i.numero_camisa,
            "id_equipe": i.id_equipe,
            "nome_equipe": (
                i.equipe.nome if i.equipe is not None else f"Equipe {i.id_equipe}"
            ),
        }
        for i in integrantes_orm
    }

    return calcular_artilharia(
        id_edicao_competicao=id_edicao,
        ocorrencias=ocorrencias,
        partidas=partidas,
        integrantes=integrantes_map,
    )
