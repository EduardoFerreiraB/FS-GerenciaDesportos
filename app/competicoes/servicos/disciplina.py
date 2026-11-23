"""Serviços de controle disciplinar: reconciliação de sanções, cumprimentos, painel e ajustes."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, object_session, selectinload

from models import Usuario
from competicoes.contratos.configuracao import DisciplinaSchema
from competicoes.contratos.disciplina import (
    CumprimentoCriar,
    CumprimentoDetalhe,
    HistoricoSuspensao,
    PainelDisciplinarDetalhe,
    PartidaElegivelCumprimento,
    ResumoCartoesIntegrante,
    SuspensaoAjustar,
    SuspensaoDetalhe,
    SuspensaoManualCriar,
)
from competicoes.erros import ConfiguracaoInvalida, ConflitoEstado, NaoEncontrado
from competicoes.infra import bloquear_edicao, registrar_auditoria, transacao
from competicoes.modelos.disciplina import CumprimentoSuspensao, SuspensaoCompeticao
from competicoes.modelos.disputa import DueloEliminatorio, GrupoCompeticao, VagaDuelo
from competicoes.modelos.operacao import AuditoriaCompeticao
from competicoes.modelos.organizacao import EdicaoCompeticao
from competicoes.modelos.partidas import OcorrenciaPartida, Partida
from competicoes.modelos.pessoas import Equipe, IntegranteEquipe
from competicoes.servicos.numeracao import mapa_numeros_jogos
from competicoes.servicos.motores.disciplina import (
    calcular_sancoes_e_cartoes,
    reconciliar_suspensoes_existentes,
    validar_elegibilidade_cumprimento,
)


@contextmanager
def _escopo_transacao(db: Session, dentro_transacao: bool) -> Iterator[None]:
    if dentro_transacao:
        yield
        db.flush()
    else:
        with transacao(db):
            yield


def _extrair_config_disciplina(edicao: EdicaoCompeticao) -> dict[str, Any]:
    """Extrai e normaliza a configuração disciplinar da edição."""
    cfg_bruta = dict(edicao.configuracao or {})
    disc_bruta: dict[str, Any] = {}
    if isinstance(cfg_bruta.get("disciplina"), dict):
        disc_bruta.update(cfg_bruta["disciplina"])
    for chave in (
        "limite_amarelos",
        "jogos_por_acumulo",
        "jogos_por_vermelho",
        "jogos_por_segundo_amarelo",
        "zerar_amarelos_ao_encerrar_grupos",
    ):
        if chave not in disc_bruta and chave in cfg_bruta:
            disc_bruta[chave] = cfg_bruta[chave]

    try:
        schema = DisciplinaSchema.model_validate(disc_bruta)
        return schema.model_dump()
    except Exception:
        return {
            "limite_amarelos": disc_bruta.get("limite_amarelos", 3)
            if "limite_amarelos" in disc_bruta
            else 3,
            "jogos_por_acumulo": int(disc_bruta.get("jogos_por_acumulo") or 1),
            "jogos_por_vermelho": int(disc_bruta.get("jogos_por_vermelho") or 1),
            "jogos_por_segundo_amarelo": int(
                disc_bruta.get("jogos_por_segundo_amarelo") or 1
            ),
            "zerar_amarelos_ao_encerrar_grupos": bool(
                disc_bruta.get("zerar_amarelos_ao_encerrar_grupos", False)
            ),
        }


def _verificar_grupos_encerrados(
    db: Session, edicao: EdicaoCompeticao, partidas: list[Partida]
) -> bool:
    """Verifica se a fase de grupos já foi encerrada em edições GRUPOS_MATA_MATA."""
    if edicao.formato != "GRUPOS_MATA_MATA":
        return False

    vaga_resolvida = db.execute(
        select(VagaDuelo.id_vaga)
        .join(DueloEliminatorio, DueloEliminatorio.id_duelo == VagaDuelo.id_duelo)
        .where(
            DueloEliminatorio.id_edicao_competicao == edicao.id_edicao_competicao,
            VagaDuelo.origem == "POSICAO_GRUPO",
            VagaDuelo.id_equipe_resolvida.is_not(None),
        )
        .limit(1)
    ).scalar_one_or_none()
    if vaga_resolvida is not None:
        return True

    return any(p.id_grupo is None and p.id_duelo is not None for p in partidas)


def _carregar_mapas_integrantes_equipes(
    db: Session, id_edicao: int
) -> tuple[dict[int, IntegranteEquipe], dict[int, Equipe]]:
    equipes = (
        db.execute(
            select(Equipe).where(Equipe.id_edicao_competicao == id_edicao)
        )
        .scalars()
        .all()
    )
    integrantes = (
        db.execute(
            select(IntegranteEquipe).where(
                IntegranteEquipe.id_edicao_competicao == id_edicao
            )
        )
        .scalars()
        .all()
    )
    return (
        {i.id_integrante: i for i in integrantes},
        {e.id_equipe: e for e in equipes},
    )


_ACOES_HISTORICO = {
    "CRIAR_MANUAL": "Criada manualmente",
    "AJUSTAR": "Ajuste",
    "CUMPRIR_SUSPENSAO": "Cumprimento registrado",
}

# Campos que não entram no ``antes``/``depois`` da auditoria (evita aninhar o histórico).
SEM_HISTORICO = {"historico"}


def _nome_usuario(usuario) -> str | None:
    return usuario.username if usuario is not None else None


def _historico_suspensao(suspensao: SuspensaoCompeticao) -> list[HistoricoSuspensao]:
    """Histórico lido da auditoria; a suspensão automática ganha a linha de origem."""
    db = object_session(suspensao)
    auditorias = [] if db is None or suspensao.id_suspensao is None else db.execute(
        select(AuditoriaCompeticao)
        .where(
            AuditoriaCompeticao.entidade == "suspensoes_competicao",
            AuditoriaCompeticao.id_entidade == suspensao.id_suspensao,
        )
        .order_by(AuditoriaCompeticao.instante, AuditoriaCompeticao.id_auditoria)
    ).scalars().all()
    historico = [
        HistoricoSuspensao(
            em=a.instante,
            responsavel_nome=a.responsavel_nome,
            acao=_ACOES_HISTORICO.get(a.acao, a.acao.replace("_", " ").capitalize()),
            situacao_anterior=(a.antes or {}).get("situacao"),
            situacao_nova=(a.depois or {}).get("situacao"),
            justificativa=a.motivo,
        )
        for a in auditorias
    ]
    if suspensao.origem != "MANUAL":
        historico.insert(0, HistoricoSuspensao(
            em=suspensao.criado_em,
            acao="Gerada pela súmula",
            situacao_nova="ATIVA",
            justificativa=suspensao.motivo,
        ))
    return historico


def _para_suspensao_detalhe(
    suspensao: SuspensaoCompeticao,
    integrantes_map: dict[int, IntegranteEquipe] | None = None,
    equipes_map: dict[int, Equipe] | None = None,
) -> SuspensaoDetalhe:
    integrante = (
        integrantes_map.get(suspensao.id_integrante)
        if integrantes_map is not None
        else suspensao.integrante
    )
    id_equipe = integrante.id_equipe if integrante is not None else None
    equipe = (
        equipes_map.get(id_equipe)
        if (equipes_map is not None and id_equipe is not None)
        else (integrante.equipe if integrante is not None else None)
    )

    cumprimentos_ordenados = sorted(
        suspensao.cumprimentos or [],
        key=lambda c: (c.id_cumprimento or 0, c.id_partida),
    )
    cumprimentos_detalhe = [
        CumprimentoDetalhe(
            id_cumprimento=c.id_cumprimento,
            id_suspensao=c.id_suspensao,
            id_integrante=c.id_integrante,
            id_partida=c.id_partida,
            criado_em=c.criado_em,
            responsavel_nome=_nome_usuario(c.usuario_responsavel),
        )
        for c in cumprimentos_ordenados
    ]
    jogos_cumpridos = len(cumprimentos_detalhe)
    jogos_pendentes = max(0, int(suspensao.jogos) - jogos_cumpridos)

    return SuspensaoDetalhe(
        id_suspensao=suspensao.id_suspensao,
        id_edicao_competicao=suspensao.id_edicao_competicao,
        id_integrante=suspensao.id_integrante,
        nome_esportivo=integrante.nome_esportivo if integrante is not None else None,
        id_equipe=id_equipe,
        nome_equipe=equipe.nome if equipe is not None else None,
        id_partida_origem=suspensao.id_partida_origem,
        id_ocorrencia_origem=suspensao.id_ocorrencia_origem,
        motivo=suspensao.motivo,
        origem=suspensao.origem,
        chave_origem=suspensao.chave_origem,
        jogos=suspensao.jogos,
        jogos_cumpridos=jogos_cumpridos,
        jogos_pendentes=jogos_pendentes,
        situacao=suspensao.situacao,
        cumprimentos=cumprimentos_detalhe,
        criado_em=suspensao.criado_em,
        responsavel_nome=_nome_usuario(suspensao.usuario_responsavel),
        historico=_historico_suspensao(suspensao),
    )


def _executar_reconciliacao_interna(
    db: Session,
    edicao: EdicaoCompeticao,
    responsavel: Usuario | None = None,
) -> tuple[
    list[SuspensaoDetalhe],
    dict[str, Any],
    dict[int, IntegranteEquipe],
    dict[int, Equipe],
]:
    id_edicao = edicao.id_edicao_competicao
    config_disciplina = _extrair_config_disciplina(edicao)

    # Toda alteração de resultado passa por aqui: grava a perda de validade das
    # decisões de classificação antes que o resultado possa voltar ao original.
    from competicoes.servicos.classificacao import invalidar_decisoes_desatualizadas

    invalidar_decisoes_desatualizadas(db, id_edicao)

    partidas = (
        db.execute(
            select(Partida)
            .where(Partida.id_edicao_competicao == id_edicao)
            .order_by(Partida.id_partida)
        )
        .scalars()
        .all()
    )
    ids_partidas = [p.id_partida for p in partidas]
    ocorrencias: list[OcorrenciaPartida] = []
    if ids_partidas:
        ocorrencias = (
            db.execute(
                select(OcorrenciaPartida)
                .where(OcorrenciaPartida.id_partida.in_(ids_partidas))
                .order_by(OcorrenciaPartida.id_ocorrencia)
            )
            .scalars()
            .all()
        )

    grupos_encerrados = _verificar_grupos_encerrados(db, edicao, partidas)

    partidas_dicts = [
        {
            "id_partida": p.id_partida,
            "id_edicao_competicao": p.id_edicao_competicao,
            "id_grupo": p.id_grupo,
            "id_duelo": p.id_duelo,
            "rodada": p.rodada,
            "ordem_jogo": p.ordem_jogo,
            "id_equipe_mandante": p.id_equipe_mandante,
            "id_equipe_visitante": p.id_equipe_visitante,
            "estado": p.estado,
        }
        for p in partidas
    ]
    ocorrencias_dicts = [
        {
            "id_ocorrencia": o.id_ocorrencia,
            "id_partida": o.id_partida,
            "tipo": o.tipo,
            "id_equipe_beneficiada": o.id_equipe_beneficiada,
            "id_integrante": o.id_integrante,
            "minuto": o.minuto,
            "id_ocorrencia_origem": o.id_ocorrencia_origem,
        }
        for o in ocorrencias
    ]

    resultado_motor = calcular_sancoes_e_cartoes(
        id_edicao_competicao=id_edicao,
        ocorrencias=ocorrencias_dicts,
        partidas=partidas_dicts,
        config_disciplina=config_disciplina,
        grupos_encerrados=grupos_encerrados,
    )
    sancoes_esperadas = resultado_motor["sancoes_esperadas"]
    esperadas_por_chave = {
        str(s["chave_origem"]): s
        for s in sancoes_esperadas
        if s.get("chave_origem") is not None
    }

    suspensoes_banco = (
        db.execute(
            select(SuspensaoCompeticao)
            .options(selectinload(SuspensaoCompeticao.cumprimentos))
            .where(SuspensaoCompeticao.id_edicao_competicao == id_edicao)
            .order_by(SuspensaoCompeticao.id_suspensao)
            .execution_options(populate_existing=True)
        )
        .scalars()
        .all()
    )

    rec = reconciliar_suspensoes_existentes(sancoes_esperadas, suspensoes_banco)

    # DF-RT14-06: com um jogo reaberto, os cartões dele saem da conta do motor (só conta
    # jogo finalizado) e a sanção some das esperadas, embora nada tenha mudado de fato.
    # A suspensão fica como está e é reaproveitada ao finalizar de novo. Ela só é segurada
    # enquanto a dúvida existe: cartão de origem ainda na súmula E (o jogo de origem está
    # reaberto OU o atleta tem cartão em algum jogo reaberto). Se o cartão que sustentava
    # a sanção foi removido de um jogo já finalizado de novo, ela cai normalmente
    # (revisão #63: acúmulo com amarelo anterior removido).
    ids_ocorrencias = {o.id_ocorrencia for o in ocorrencias}
    estado_partida = {p.id_partida: p.estado for p in partidas}
    tipos_cartao = {"CARTAO_AMARELO", "CARTAO_VERMELHO_DIRETO", "EXPULSAO_SEGUNDO_AMARELO"}
    atletas_com_cartao_pendente = {
        o.id_integrante
        for o in ocorrencias
        if o.tipo in tipos_cartao and estado_partida.get(o.id_partida) != "FINALIZADA"
    }

    def origem_presente(susp: SuspensaoCompeticao) -> bool:
        if susp.id_ocorrencia_origem is None or susp.id_ocorrencia_origem not in ids_ocorrencias:
            return False
        origem_reaberta = (
            susp.id_partida_origem is not None
            and estado_partida.get(susp.id_partida_origem) != "FINALIZADA"
        )
        return origem_reaberta or susp.id_integrante in atletas_com_cartao_pendente

    rec["para_cancelar"] = [s for s in rec["para_cancelar"] if not origem_presente(s)]
    rec["para_revisao"] = [s for s in rec["para_revisao"] if not origem_presente(s)]

    # Identifica suspensões que já tiveram revisão manual resolvida pelo coordenador
    ids_em_revisao_resolvidos: set[int] = set()
    if rec["para_revisao"]:
        auditorias_ajuste = (
            db.execute(
                select(AuditoriaCompeticao).where(
                    AuditoriaCompeticao.id_edicao_competicao == id_edicao,
                    AuditoriaCompeticao.entidade == "suspensoes_competicao",
                    AuditoriaCompeticao.acao == "AJUSTAR",
                )
            )
            .scalars()
            .all()
        )
        for aud in auditorias_ajuste:
            antes_sit = (aud.antes or {}).get("situacao")
            depois_sit = (aud.depois or {}).get("situacao")
            if antes_sit == "EM_REVISAO" and depois_sit in ("CUMPRIDA", "ATIVA", "CANCELADA"):
                ids_em_revisao_resolvidos.add(aud.id_entidade)

    for susp in rec["para_revisao"]:
        if susp.id_suspensao not in ids_em_revisao_resolvidos:
            susp.situacao = "EM_REVISAO"

    # Sem lastro e sem cumprimento: cancela preservando o registro e libera a
    # chave para que o cartão, se voltar à súmula, gere uma suspensão nova.
    for susp in rec["para_cancelar"]:
        susp.situacao = "CANCELADA"
        susp.chave_origem = None

    # Se uma suspensão foi cancelada e sua chave de origem já não existe nas ocorrências,
    # limpa chave_origem para permitir futura recriação sem conflito de UniqueConstraint
    chaves_mantidas_no_banco: set[str] = set()
    for susp in suspensoes_banco:
        if susp.chave_origem is not None:
            if (
                susp.situacao == "CANCELADA"
                and susp.chave_origem not in esperadas_por_chave
                and not origem_presente(susp)
            ):
                susp.chave_origem = None
            else:
                chaves_mantidas_no_banco.add(str(susp.chave_origem))
                # Se estava EM_REVISAO e o cartão voltou a existir (ex: partida reaberta e refinalizada)
                if susp.situacao == "EM_REVISAO" and susp.chave_origem in esperadas_por_chave:
                    susp.situacao = (
                        "CUMPRIDA"
                        if len(susp.cumprimentos or []) >= susp.jogos
                        else "ATIVA"
                    )

    db.flush()

    for item in rec["para_criar"]:
        chave = str(item["chave_origem"])
        if chave in chaves_mantidas_no_banco:
            continue
        nova_susp = SuspensaoCompeticao(
            id_edicao_competicao=id_edicao,
            id_integrante=int(item["id_integrante"]),
            id_partida_origem=item.get("id_partida_origem"),
            id_ocorrencia_origem=item.get("id_ocorrencia_origem"),
            motivo=str(item["motivo"]),
            origem=str(item["origem"]),
            chave_origem=chave,
            jogos=int(item["jogos"]),
            situacao="ATIVA",
            id_usuario_responsavel=(
                responsavel.id_usuario if responsavel is not None else None
            ),
        )
        db.add(nova_susp)
        chaves_mantidas_no_banco.add(chave)

    db.flush()

    suspensoes_finais = (
        db.execute(
            select(SuspensaoCompeticao)
            .options(selectinload(SuspensaoCompeticao.cumprimentos))
            .where(SuspensaoCompeticao.id_edicao_competicao == id_edicao)
            .order_by(SuspensaoCompeticao.id_suspensao)
            .execution_options(populate_existing=True)
        )
        .scalars()
        .all()
    )

    for susp in suspensoes_finais:
        if susp.situacao == "ATIVA" and len(susp.cumprimentos or []) >= susp.jogos:
            susp.situacao = "CUMPRIDA"

    db.flush()

    integrantes_map, equipes_map = _carregar_mapas_integrantes_equipes(db, id_edicao)
    suspensoes_detalhe = [
        _para_suspensao_detalhe(s, integrantes_map, equipes_map)
        for s in suspensoes_finais
    ]

    return suspensoes_detalhe, resultado_motor, integrantes_map, equipes_map


def reconciliar_sancoes_edicao(
    db: Session,
    id_edicao: int,
    responsavel: Usuario | None = None,
    dentro_transacao: bool = False,
) -> list[SuspensaoDetalhe]:
    """Reconcilia as sanções automáticas da edição com base nas súmulas das partidas."""
    with _escopo_transacao(db, dentro_transacao):
        edicao = bloquear_edicao(db, id_edicao)
        suspensoes_detalhe, _, _, _ = _executar_reconciliacao_interna(
            db, edicao, responsavel=responsavel
        )
        return suspensoes_detalhe


def obter_painel_disciplinar(
    db: Session,
    id_edicao: int,
    responsavel: Usuario | None = None,
    dentro_transacao: bool = False,
) -> PainelDisciplinarDetalhe:
    """Reconcilia e retorna o painel disciplinar completo da edição (suspensões e resumo de cartões)."""
    with _escopo_transacao(db, dentro_transacao):
        edicao = bloquear_edicao(db, id_edicao)
        (
            suspensoes_detalhe,
            resultado_motor,
            integrantes_map,
            equipes_map,
        ) = _executar_reconciliacao_interna(db, edicao, responsavel=responsavel)

        estatisticas_integrantes: dict[int, dict[str, Any]] = resultado_motor[
            "estatisticas_integrantes"
        ]
        ids_com_suspensao_ativa = {
            s.id_integrante
            for s in suspensoes_detalhe
            if s.situacao == "ATIVA" and s.jogos_pendentes > 0
        }

        ids_relevantes = sorted(
            set(estatisticas_integrantes.keys())
            | {s.id_integrante for s in suspensoes_detalhe}
        )

        resumo_cartoes: list[ResumoCartoesIntegrante] = []
        for id_int in ids_relevantes:
            integrante = integrantes_map.get(id_int)
            if integrante is None:
                continue
            equipe = equipes_map.get(integrante.id_equipe)
            est = estatisticas_integrantes.get(id_int, {})
            resumo_cartoes.append(
                ResumoCartoesIntegrante(
                    id_integrante=id_int,
                    nome_esportivo=integrante.nome_esportivo,
                    id_equipe=integrante.id_equipe,
                    nome_equipe=equipe.nome if equipe is not None else f"Equipe {integrante.id_equipe}",
                    amarelos_estatisticos=int(est.get("amarelos_estatisticos", 0)),
                    amarelos_acumulo_atual=int(est.get("amarelos_acumulo_atual", 0)),
                    vermelhos_diretos=int(est.get("vermelhos_diretos", 0)),
                    expulsoes_segundo_amarelo=int(
                        est.get("expulsoes_segundo_amarelo", 0)
                    ),
                    suspenso_atualmente=id_int in ids_com_suspensao_ativa,
                )
            )

        return PainelDisciplinarDetalhe(
            id_edicao_competicao=id_edicao,
            suspensoes=suspensoes_detalhe,
            resumo_cartoes=resumo_cartoes,
        )


def cumprir_suspensao(
    db: Session,
    id_suspensao: int,
    dados: CumprimentoCriar,
    responsavel: Usuario,
) -> SuspensaoDetalhe:
    """Registra o cumprimento explícito de uma suspensão em uma partida finalizada."""
    with transacao(db):
        suspensao = (
            db.execute(
                select(SuspensaoCompeticao)
                .options(
                    selectinload(SuspensaoCompeticao.cumprimentos),
                    joinedload(SuspensaoCompeticao.integrante).joinedload(
                        IntegranteEquipe.equipe
                    ),
                    joinedload(SuspensaoCompeticao.partida_origem),
                )
                .where(SuspensaoCompeticao.id_suspensao == id_suspensao)
                .execution_options(populate_existing=True)
            )
            .scalars()
            .first()
        )
        if suspensao is None:
            raise NaoEncontrado("Suspensão não encontrada.", campos=["id_suspensao"])

        edicao = bloquear_edicao(db, suspensao.id_edicao_competicao)
        if edicao.estado == "CANCELADA":
            raise ConflitoEstado(
                "Não é possível registrar cumprimento em edição cancelada.",
                campos=["estado"],
            )

        partida = db.get(Partida, dados.id_partida)
        if partida is None:
            raise NaoEncontrado("Partida não encontrada.", campos=["id_partida"])

        integrante = suspensao.integrante or db.get(
            IntegranteEquipe, suspensao.id_integrante
        )
        if integrante is None:
            raise NaoEncontrado("Integrante não encontrado.", campos=["id_integrante"])

        cumprimentos_existentes = (
            db.execute(
                select(CumprimentoSuspensao).where(
                    CumprimentoSuspensao.id_integrante == suspensao.id_integrante
                )
            )
            .scalars()
            .all()
        )

        atuou = (
            db.execute(
                select(OcorrenciaPartida.id_ocorrencia)
                .where(
                    OcorrenciaPartida.id_partida == dados.id_partida,
                    OcorrenciaPartida.id_integrante == suspensao.id_integrante,
                )
                .limit(1)
            ).scalar_one_or_none()
            is not None
        )

        rodada_origem = None
        if (
            suspensao.partida_origem is not None
            and partida.id_grupo == suspensao.partida_origem.id_grupo
            and partida.id_duelo == suspensao.partida_origem.id_duelo
        ):
            rodada_origem = suspensao.partida_origem.rodada

        susp_dict = {
            "id_suspensao": suspensao.id_suspensao,
            "id_edicao_competicao": suspensao.id_edicao_competicao,
            "id_integrante": suspensao.id_integrante,
            "id_partida_origem": suspensao.id_partida_origem,
            "rodada_origem": rodada_origem,
            "situacao": suspensao.situacao,
            "jogos": suspensao.jogos,
            "jogos_cumpridos": len(suspensao.cumprimentos or []),
        }
        partida_dict = {
            "id_partida": partida.id_partida,
            "id_edicao_competicao": partida.id_edicao_competicao,
            "id_equipe_mandante": partida.id_equipe_mandante,
            "id_equipe_visitante": partida.id_equipe_visitante,
            "rodada": partida.rodada,
            "estado": partida.estado,
        }

        validar_elegibilidade_cumprimento(
            suspensao=susp_dict,
            partida=partida_dict,
            id_equipe_integrante=integrante.id_equipe,
            cumprimentos_existentes_integrante=[
                {"id_partida": c.id_partida, "id_suspensao": c.id_suspensao}
                for c in cumprimentos_existentes
            ],
            participante_atuou_na_partida=atuou,
        )

        antes = _para_suspensao_detalhe(suspensao).model_dump(mode="json", exclude=SEM_HISTORICO)

        novo_cumprimento = CumprimentoSuspensao(
            id_suspensao=suspensao.id_suspensao,
            id_integrante=suspensao.id_integrante,
            id_partida=dados.id_partida,
            id_usuario_responsavel=responsavel.id_usuario,
        )
        db.add(novo_cumprimento)
        suspensao.cumprimentos.append(novo_cumprimento)
        db.flush()

        if len(suspensao.cumprimentos) >= suspensao.jogos:
            suspensao.situacao = "CUMPRIDA"
            db.flush()

        detalhe = _para_suspensao_detalhe(suspensao)
        registrar_auditoria(
            db,
            entidade="suspensoes_competicao",
            id_entidade=suspensao.id_suspensao,
            acao="CUMPRIR_SUSPENSAO",
            antes=antes,
            depois=detalhe.model_dump(mode="json", exclude=SEM_HISTORICO),
            id_edicao_competicao=suspensao.id_edicao_competicao,
            responsavel=responsavel,
            motivo=f"Cumprimento registrado no jogo {mapa_numeros_jogos(db, partida.id_edicao_competicao).get(partida.id_partida, '?')}.",
        )
        return _para_suspensao_detalhe(suspensao)


def criar_suspensao_manual(
    db: Session,
    id_edicao: int,
    dados: SuspensaoManualCriar,
    responsavel: Usuario,
) -> SuspensaoDetalhe:
    """Cria uma suspensão disciplinar manual para um integrante da edição."""
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao)
        if edicao.estado == "CANCELADA":
            raise ConflitoEstado(
                "Não é possível criar suspensão em uma edição cancelada.",
                campos=["estado"],
            )

        integrante = (
            db.execute(
                select(IntegranteEquipe)
                .options(joinedload(IntegranteEquipe.equipe))
                .where(IntegranteEquipe.id_integrante == dados.id_integrante)
            )
            .scalars()
            .first()
        )
        if integrante is None or integrante.id_edicao_competicao != id_edicao:
            raise ConfiguracaoInvalida(
                "O integrante informado não pertence a uma equipe desta edição.",
                campos=["id_integrante"],
            )

        if dados.jogos < 1:
            raise ConfiguracaoInvalida(
                "A quantidade de jogos de suspensão deve ser ao menos 1.",
                campos=["jogos"],
            )

        motivo = dados.motivo.strip()
        if len(motivo) < 3:
            raise ConfiguracaoInvalida(
                "O motivo da suspensão deve ter ao menos 3 caracteres.",
                campos=["motivo"],
            )

        suspensao = SuspensaoCompeticao(
            id_edicao_competicao=id_edicao,
            id_integrante=dados.id_integrante,
            id_partida_origem=None,
            id_ocorrencia_origem=None,
            motivo=motivo,
            origem="MANUAL",
            chave_origem=None,
            jogos=dados.jogos,
            situacao="ATIVA",
            id_usuario_responsavel=responsavel.id_usuario,
        )
        db.add(suspensao)
        db.flush()

        detalhe = _para_suspensao_detalhe(suspensao)
        registrar_auditoria(
            db,
            entidade="suspensoes_competicao",
            id_entidade=suspensao.id_suspensao,
            acao="CRIAR_MANUAL",
            antes=None,
            depois=detalhe.model_dump(mode="json", exclude=SEM_HISTORICO),
            id_edicao_competicao=id_edicao,
            responsavel=responsavel,
            motivo=motivo,
        )
        return _para_suspensao_detalhe(suspensao)


def ajustar_suspensao(
    db: Session,
    id_suspensao: int,
    dados: SuspensaoAjustar,
    responsavel: Usuario,
) -> SuspensaoDetalhe:
    """Ajusta manualmente a quantidade de jogos e/ou situação de uma suspensão com justificativa."""
    with transacao(db):
        suspensao = (
            db.execute(
                select(SuspensaoCompeticao)
                .options(
                    selectinload(SuspensaoCompeticao.cumprimentos),
                    joinedload(SuspensaoCompeticao.integrante).joinedload(
                        IntegranteEquipe.equipe
                    ),
                )
                .where(SuspensaoCompeticao.id_suspensao == id_suspensao)
                .execution_options(populate_existing=True)
            )
            .scalars()
            .first()
        )
        if suspensao is None:
            raise NaoEncontrado("Suspensão não encontrada.", campos=["id_suspensao"])

        edicao = bloquear_edicao(db, suspensao.id_edicao_competicao)
        if edicao.estado == "CANCELADA":
            raise ConflitoEstado(
                "Não é possível ajustar suspensão em uma edição cancelada.",
                campos=["estado"],
            )

        motivo = (dados.motivo or "").strip()
        if len(motivo) < 3:
            raise ConfiguracaoInvalida(
                "O motivo do ajuste deve ter ao menos 3 caracteres.",
                campos=["motivo"],
            )

        antes = _para_suspensao_detalhe(suspensao).model_dump(mode="json", exclude=SEM_HISTORICO)
        jogos_cumpridos = len(suspensao.cumprimentos or [])

        if dados.jogos is not None:
            if dados.jogos < 1:
                raise ConfiguracaoInvalida(
                    "A quantidade de jogos deve ser maior ou igual a 1.",
                    campos=["jogos"],
                )
            if dados.jogos < jogos_cumpridos:
                raise ConfiguracaoInvalida(
                    "A quantidade de jogos não pode ser menor que os jogos já cumpridos.",
                    campos=["jogos"],
                )
            suspensao.jogos = dados.jogos

        if dados.situacao == "CUMPRIDA" and jogos_cumpridos < suspensao.jogos:
            # PD-RT14-01: encerrar sem cumprimento é "Cancelada" com justificativa.
            raise ConfiguracaoInvalida(
                "Para marcar como cumprida, registre os cumprimentos nas partidas.",
                campos=["situacao"],
            )
        if dados.situacao is not None:
            suspensao.situacao = dados.situacao
        elif suspensao.situacao == "ATIVA" and jogos_cumpridos >= suspensao.jogos:
            suspensao.situacao = "CUMPRIDA"
        elif (
            suspensao.situacao == "CUMPRIDA"
            and dados.jogos is not None
            and jogos_cumpridos < suspensao.jogos
        ):
            suspensao.situacao = "ATIVA"

        if (
            suspensao.situacao == "ATIVA"
            and dados.jogos is not None
            and jogos_cumpridos >= suspensao.jogos
            and dados.situacao is None
        ):
            suspensao.situacao = "CUMPRIDA"

        suspensao.id_usuario_responsavel = responsavel.id_usuario
        db.flush()

        detalhe = _para_suspensao_detalhe(suspensao)
        registrar_auditoria(
            db,
            entidade="suspensoes_competicao",
            id_entidade=suspensao.id_suspensao,
            acao="AJUSTAR",
            antes=antes,
            depois=detalhe.model_dump(mode="json", exclude=SEM_HISTORICO),
            id_edicao_competicao=suspensao.id_edicao_competicao,
            responsavel=responsavel,
            motivo=motivo,
        )
        return _para_suspensao_detalhe(suspensao)


def listar_partidas_elegiveis(db: Session, id_suspensao: int) -> list[PartidaElegivelCumprimento]:
    """Jogos em que a suspensão pode ser cumprida (DF-RT14-02).

    Aplica a mesma validação do registro de cumprimento: jogo finalizado da equipe do
    atleta, posterior à origem, sem ocorrência do atleta e sem outro cumprimento dele.
    """
    from competicoes.servicos.chave import rotulo_fase

    suspensao = db.execute(
        select(SuspensaoCompeticao)
        .options(
            selectinload(SuspensaoCompeticao.cumprimentos),
            joinedload(SuspensaoCompeticao.integrante),
            joinedload(SuspensaoCompeticao.partida_origem),
        )
        .where(SuspensaoCompeticao.id_suspensao == id_suspensao)
    ).scalars().first()
    if suspensao is None:
        raise NaoEncontrado("Suspensão não encontrada.", campos=["id_suspensao"])
    integrante = suspensao.integrante
    if integrante is None:
        return []

    id_edicao = suspensao.id_edicao_competicao
    partidas = db.execute(
        select(Partida).where(
            Partida.id_edicao_competicao == id_edicao,
            Partida.estado == "FINALIZADA",
            (Partida.id_equipe_mandante == integrante.id_equipe)
            | (Partida.id_equipe_visitante == integrante.id_equipe),
        )
    ).scalars().all()
    if not partidas:
        return []

    ids = [p.id_partida for p in partidas]
    jogou = set(db.scalars(
        select(OcorrenciaPartida.id_partida).where(
            OcorrenciaPartida.id_partida.in_(ids),
            OcorrenciaPartida.id_integrante == suspensao.id_integrante,
        )
    ))
    cumprimentos_integrante = [
        {"id_partida": c.id_partida, "id_suspensao": c.id_suspensao}
        for c in db.execute(
            select(CumprimentoSuspensao).where(
                CumprimentoSuspensao.id_integrante == suspensao.id_integrante
            )
        ).scalars()
    ]
    origem = suspensao.partida_origem
    numeros = mapa_numeros_jogos(db, id_edicao)
    equipes = {
        e.id_equipe: e.nome
        for e in db.execute(select(Equipe).where(Equipe.id_edicao_competicao == id_edicao)).scalars()
    }
    grupos = {
        g.id_grupo: g.nome
        for g in db.execute(
            select(GrupoCompeticao).where(GrupoCompeticao.id_edicao_competicao == id_edicao)
        ).scalars()
    }
    fases = {
        d.id_duelo: d.fase
        for d in db.execute(
            select(DueloEliminatorio).where(DueloEliminatorio.id_edicao_competicao == id_edicao)
        ).scalars()
    }

    elegiveis: list[PartidaElegivelCumprimento] = []
    for partida in sorted(partidas, key=lambda p: numeros.get(p.id_partida, 0)):
        rodada_origem = None
        if origem is not None and partida.id_grupo == origem.id_grupo and partida.id_duelo == origem.id_duelo:
            rodada_origem = origem.rodada
        try:
            validar_elegibilidade_cumprimento(
                suspensao={
                    "id_suspensao": suspensao.id_suspensao,
                    "id_edicao_competicao": id_edicao,
                    "id_integrante": suspensao.id_integrante,
                    "id_partida_origem": suspensao.id_partida_origem,
                    "rodada_origem": rodada_origem,
                    "situacao": suspensao.situacao,
                    "jogos": suspensao.jogos,
                    "jogos_cumpridos": len(suspensao.cumprimentos or []),
                },
                partida={
                    "id_partida": partida.id_partida,
                    "id_edicao_competicao": partida.id_edicao_competicao,
                    "id_equipe_mandante": partida.id_equipe_mandante,
                    "id_equipe_visitante": partida.id_equipe_visitante,
                    "rodada": partida.rodada,
                    "estado": partida.estado,
                },
                id_equipe_integrante=integrante.id_equipe,
                cumprimentos_existentes_integrante=cumprimentos_integrante,
                participante_atuou_na_partida=partida.id_partida in jogou,
            )
        except (ConflitoEstado, ConfiguracaoInvalida):
            continue

        numero = numeros.get(partida.id_partida, 0)
        if partida.id_duelo is not None:
            contexto = rotulo_fase(fases.get(partida.id_duelo, ""))
        elif partida.id_grupo is not None:
            contexto = f"{grupos.get(partida.id_grupo, 'Grupo')} · Rodada {partida.rodada}"
        else:
            contexto = f"Rodada {partida.rodada}"
        confronto = (
            f"{equipes.get(partida.id_equipe_mandante, '?')} × {equipes.get(partida.id_equipe_visitante, '?')}"
        )
        elegiveis.append(PartidaElegivelCumprimento(
            id_partida=partida.id_partida,
            numero_jogo=numero,
            rotulo=f"Jogo {numero} · {contexto} · {confronto}",
        ))
    return elegiveis
