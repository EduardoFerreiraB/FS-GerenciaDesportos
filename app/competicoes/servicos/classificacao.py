"""Serviço de cálculo e consulta de classificação esportiva (Fatia 2).

Implementa a consolidação determinística da tabela de classificação para edições
de pontos corridos e grupos + mata-mata, respeitando:
- RULING R28: O placar é estritamente a contagem de ocorrências do tipo GOL.
- Resolução de desempates e indicação explícita de empates persistentes.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

import models  # Garante registro de Modalidade, Usuario, etc. no Base.metadata
from models import Usuario
from competicoes.contratos.classificacao import (
    GrupoClassificacaoDetalhe,
    LinhaClassificacao,
    TabelaClassificacaoDetalhe,
)
from competicoes.contratos.disciplina import (
    DecisaoClassificacaoCriar,
    DecisaoClassificacaoDetalhe,
)
from competicoes.erros import ConfiguracaoInvalida, ConflitoEstado, NaoEncontrado
from competicoes.infra import (
    bloquear_edicao,
    incrementar_revisao,
    registrar_auditoria,
    transacao,
)
from competicoes.modelos.disciplina import DecisaoClassificacao
from competicoes.modelos.disputa import GrupoCompeticao
from competicoes.modelos.organizacao import EdicaoCompeticao
from competicoes.modelos.partidas import OcorrenciaPartida, Partida
from competicoes.modelos.pessoas import Equipe
from competicoes.servicos.motores.classificacao import calcular_classificacao
from competicoes.servicos.motores.disciplina import calcular_hash_resultados


def _extrair_configuracao_classificacao(
    configuracao: dict | None,
) -> tuple[dict[str, int], list[str] | None]:
    """Extrai pontos e ordem de desempate da configuração da edição."""
    cfg = configuracao or {}

    pts_cfg = {"vitoria": 3, "empate": 1, "derrota": 0}
    if "pontuacao" in cfg and isinstance(cfg["pontuacao"], dict):
        for k, v in cfg["pontuacao"].items():
            pts_cfg[str(k).lower()] = int(v)
    elif "configuracao_pontos" in cfg and isinstance(cfg["configuracao_pontos"], dict):
        for k, v in cfg["configuracao_pontos"].items():
            pts_cfg[str(k).lower()] = int(v)
    else:
        if "pontos_vitoria" in cfg and cfg["pontos_vitoria"] is not None:
            pts_cfg["vitoria"] = int(cfg["pontos_vitoria"])
        if "pontos_empate" in cfg and cfg["pontos_empate"] is not None:
            pts_cfg["empate"] = int(cfg["pontos_empate"])
        if "pontos_derrota" in cfg and cfg["pontos_derrota"] is not None:
            pts_cfg["derrota"] = int(cfg["pontos_derrota"])

    ordem = None
    if "desempates" in cfg and isinstance(cfg["desempates"], list):
        ordem = [x.value if hasattr(x, "value") else str(x) for x in cfg["desempates"]]
    elif "ordem_desempates" in cfg and isinstance(cfg["ordem_desempates"], list):
        ordem = [str(x) for x in cfg["ordem_desempates"]]
    elif "criterios_desempate" in cfg and isinstance(cfg["criterios_desempate"], list):
        ordem = [str(x) for x in cfg["criterios_desempate"]]

    return pts_cfg, ordem


def _computar_placares_por_ocorrencias(
    db: Session,
    partidas: list[Partida],
) -> dict[int, dict[int, int]]:
    """Agrega contagem de ocorrências de GOL e GOL_CONTRA por partida e equipe beneficiada (RULING R28)."""
    if not partidas:
        return {}

    ids_partidas = [p.id_partida for p in partidas]
    ocorrencias_gol = (
        db.query(OcorrenciaPartida)
        .filter(
            OcorrenciaPartida.id_partida.in_(ids_partidas),
            OcorrenciaPartida.tipo.in_(["GOL", "GOL_CONTRA"]),
        )
        .all()
    )

    gols_map: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for oc in ocorrencias_gol:
        gols_map[oc.id_partida][oc.id_equipe_beneficiada] += 1

    return gols_map


def _computar_cartoes_por_equipe(
    db: Session,
    partidas: list[Partida],
) -> dict[int, dict[str, int]]:
    """Agrega cartões amarelos e vermelhos por equipe em partidas FINALIZADA."""
    partidas_finalizadas = [
        p for p in partidas if str(p.estado).upper() == "FINALIZADA"
    ]
    if not partidas_finalizadas:
        return {}

    ids_partidas = [p.id_partida for p in partidas_finalizadas]
    ocorrencias_cartao = (
        db.query(OcorrenciaPartida)
        .filter(
            OcorrenciaPartida.id_partida.in_(ids_partidas),
            OcorrenciaPartida.tipo.in_(
                [
                    "CARTAO_AMARELO",
                    "CARTAO_VERMELHO_DIRETO",
                    "EXPULSAO_SEGUNDO_AMARELO",
                ]
            ),
        )
        .all()
    )

    cartoes_por_equipe: dict[int, dict[str, int]] = defaultdict(
        lambda: {"amarelos": 0, "vermelhos": 0}
    )
    for oc in ocorrencias_cartao:
        if oc.id_equipe_beneficiada is None:
            continue
        id_eq = int(oc.id_equipe_beneficiada)
        if oc.tipo == "CARTAO_AMARELO":
            cartoes_por_equipe[id_eq]["amarelos"] += 1
        elif oc.tipo in ("CARTAO_VERMELHO_DIRETO", "EXPULSAO_SEGUNDO_AMARELO"):
            cartoes_por_equipe[id_eq]["vermelhos"] += 1

    return dict(cartoes_por_equipe)


def _obter_decisoes_avaliadas(
    db: Session,
    id_edicao: int,
    id_grupo: int | None,
    partidas_convertidas: list[dict[str, Any]],
) -> list[DecisaoClassificacaoDetalhe]:
    """Busca decisões de classificação do escopo e avalia sua validade contra o hash atual."""
    hash_atual = calcular_hash_resultados(partidas_convertidas)
    consulta = db.query(DecisaoClassificacao).filter(
        DecisaoClassificacao.id_edicao_competicao == id_edicao
    )
    if id_grupo is None:
        consulta = consulta.filter(DecisaoClassificacao.id_grupo.is_(None))
    else:
        consulta = consulta.filter(DecisaoClassificacao.id_grupo == id_grupo)

    decisoes = consulta.order_by(DecisaoClassificacao.id_decisao).all()
    return [
        DecisaoClassificacaoDetalhe(
            id_decisao=d.id_decisao,
            id_edicao_competicao=d.id_edicao_competicao,
            id_grupo=d.id_grupo,
            conjunto_equipes=[int(x) for x in (d.conjunto_equipes or [])],
            ordem_escolhida=[int(x) for x in (d.ordem_escolhida or [])],
            motivo=d.motivo,
            revisao_resultados=d.revisao_resultados,
            valida=(d.revisao_resultados == hash_atual),
            criado_em=d.criado_em,
        )
        for d in decisoes
    ]


def _converter_partidas_para_motor(
    partidas: list[Partida],
    gols_map: dict[int, dict[int, int]],
) -> list[dict[str, Any]]:
    """Converte instâncias ORM de Partida para dicionários compreensíveis pelo motor puro."""
    resultado: list[dict[str, Any]] = []
    for p in partidas:
        gm = gols_map[p.id_partida][p.id_equipe_mandante]
        gv = gols_map[p.id_partida][p.id_equipe_visitante]
        resultado.append({
            "id_partida": p.id_partida,
            "id_equipe_mandante": p.id_equipe_mandante,
            "id_equipe_visitante": p.id_equipe_visitante,
            "gols_mandante": gm,
            "gols_visitante": gv,
            "estado": p.estado,
        })
    return resultado


def calcular_tabela(
    partidas: list[dict | Any],
    equipes: list[dict | Any] | None = None,
    configuracao: dict | None = None,
) -> list[LinhaClassificacao]:
    """Helper que calcula a tabela de classificação a partir de listas em memória."""
    pts_cfg, ordem = _extrair_configuracao_classificacao(configuracao)

    if equipes is None:
        eq_ids: set[int] = set()
        for p in partidas:
            p_d = p if isinstance(p, dict) else getattr(p, "__dict__", {})
            if "id_equipe_mandante" in p_d:
                eq_ids.add(p_d["id_equipe_mandante"])
            if "id_equipe_visitante" in p_d:
                eq_ids.add(p_d["id_equipe_visitante"])
        equipes = [{"id_equipe": eid, "nome_equipe": f"Equipe {eid}"} for eid in sorted(eq_ids)]

    return calcular_classificacao(
        equipes=equipes,
        partidas=partidas,
        configuracao_pontos=pts_cfg,
        ordem_desempates=ordem,
    )


def obter_classificacao_edicao(db: Session, id_edicao: int) -> TabelaClassificacaoDetalhe:
    """Busca a edição e calcula deterministamente sua classificação esportiva."""
    edicao = db.get(EdicaoCompeticao, id_edicao)
    if not edicao:
        raise NaoEncontrado(
            f"Edição de competição {id_edicao} não encontrada.",
            campos=["id_edicao_competicao"],
        )

    formato = str(edicao.formato).upper()
    pts_cfg, ordem = _extrair_configuracao_classificacao(edicao.configuracao)

    # 1. Mata-mata puro não possui fase de classificação em pontos
    if formato == "MATA_MATA":
        return TabelaClassificacaoDetalhe(linhas=[], grupos=[], possui_empate_persistente=False)

    # 2. Pontos corridos
    if formato == "PONTOS_CORRIDOS":
        equipes = (
            db.query(Equipe)
            .filter(Equipe.id_edicao_competicao == id_edicao)
            .order_by(Equipe.id_equipe)
            .all()
        )
        partidas = (
            db.query(Partida)
            .filter(Partida.id_edicao_competicao == id_edicao)
            .all()
        )

        gols_map = _computar_placares_por_ocorrencias(db, partidas)
        cartoes_por_equipe = _computar_cartoes_por_equipe(db, partidas)
        partidas_convertidas = _converter_partidas_para_motor(partidas, gols_map)
        equipes_convertidas = [{"id_equipe": eq.id_equipe, "nome_equipe": eq.nome} for eq in equipes]
        decisoes_manuais = _obter_decisoes_avaliadas(
            db, id_edicao, None, partidas_convertidas
        )

        linhas = calcular_classificacao(
            equipes=equipes_convertidas,
            partidas=partidas_convertidas,
            configuracao_pontos=pts_cfg,
            ordem_desempates=ordem,
            cartoes_por_equipe=cartoes_por_equipe,
            decisoes_manuais=decisoes_manuais,
        )

        tem_empate = any(l.empate_persistente for l in linhas)
        return TabelaClassificacaoDetalhe(
            linhas=linhas,
            possui_empate_persistente=tem_empate,
            grupos=None,
        )

    # 3. Grupos + Mata-Mata
    if formato == "GRUPOS_MATA_MATA":
        grupos = (
            db.query(GrupoCompeticao)
            .filter(GrupoCompeticao.id_edicao_competicao == id_edicao)
            .order_by(GrupoCompeticao.ordem, GrupoCompeticao.id_grupo)
            .all()
        )
        equipes = (
            db.query(Equipe)
            .filter(Equipe.id_edicao_competicao == id_edicao)
            .order_by(Equipe.id_equipe)
            .all()
        )
        partidas = (
            db.query(Partida)
            .filter(
                Partida.id_edicao_competicao == id_edicao,
                Partida.id_grupo.isnot(None),
            )
            .all()
        )

        gols_map = _computar_placares_por_ocorrencias(db, partidas)
        cartoes_por_equipe = _computar_cartoes_por_equipe(db, partidas)
        partidas_convertidas = _converter_partidas_para_motor(partidas, gols_map)

        # Indexar partidas por id_grupo
        partidas_por_grupo: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for p_orm, p_dict in zip(partidas, partidas_convertidas):
            if p_orm.id_grupo is not None:
                partidas_por_grupo[p_orm.id_grupo].append(p_dict)

        grupos_detalhe: list[GrupoClassificacaoDetalhe] = []
        for g in grupos:
            equipes_g = [
                {"id_equipe": eq.id_equipe, "nome_equipe": eq.nome}
                for eq in equipes
                if eq.id_grupo == g.id_grupo
            ]
            partidas_g = partidas_por_grupo.get(g.id_grupo, [])
            decisoes_g = _obter_decisoes_avaliadas(
                db, id_edicao, g.id_grupo, partidas_g
            )

            linhas_g = calcular_classificacao(
                equipes=equipes_g,
                partidas=partidas_g,
                configuracao_pontos=pts_cfg,
                ordem_desempates=ordem,
                cartoes_por_equipe=cartoes_por_equipe,
                decisoes_manuais=decisoes_g,
            )

            tem_empate_g = any(l.empate_persistente for l in linhas_g)
            grupos_detalhe.append(
                GrupoClassificacaoDetalhe(
                    id_grupo=g.id_grupo,
                    nome=g.nome,
                    linhas=linhas_g,
                    possui_empate_persistente=tem_empate_g,
                )
            )

        tem_empate_total = any(gd.possui_empate_persistente for gd in grupos_detalhe)
        return TabelaClassificacaoDetalhe(
            linhas=None,
            possui_empate_persistente=tem_empate_total,
            grupos=grupos_detalhe,
        )

    raise ConfiguracaoInvalida(
        f"Formato de edição '{edicao.formato}' não suportado para cálculo de classificação.",
        campos=["formato"],
    )


def registrar_decisao_classificacao(
    db: Session,
    id_edicao: int,
    dados: DecisaoClassificacaoCriar,
    responsavel: Usuario,
) -> DecisaoClassificacaoDetalhe:
    """Registra uma decisão manual de desempate para um bloco de equipes empatadas."""
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao)
        if edicao.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "A edição deve estar em andamento para registrar decisão de classificação.",
                campos=["estado"],
            )

        formato = str(edicao.formato).upper()
        if formato == "MATA_MATA":
            raise ConflitoEstado(
                "Edições de mata-mata puro não possuem tabela de classificação.",
                campos=["formato"],
            )
        if formato == "PONTOS_CORRIDOS" and dados.id_grupo is not None:
            raise ConfiguracaoInvalida(
                "Edição de pontos corridos não possui grupos.",
                campos=["id_grupo"],
            )
        if formato == "GRUPOS_MATA_MATA" and dados.id_grupo is None:
            raise ConfiguracaoInvalida(
                "É obrigatório informar o grupo para decisão de classificação em formato com grupos.",
                campos=["id_grupo"],
            )

        conjunto_int = [int(x) for x in dados.conjunto_equipes]
        ordem_int = [int(x) for x in dados.ordem_escolhida]
        if (
            len(conjunto_int) < 2
            or len(set(conjunto_int)) != len(conjunto_int)
            or len(set(ordem_int)) != len(ordem_int)
            or sorted(conjunto_int) != sorted(ordem_int)
        ):
            raise ConfiguracaoInvalida(
                "A ordem escolhida deve ser uma permutação exata do conjunto de equipes empatadas.",
                campos=["ordem_escolhida"],
            )

        if dados.id_grupo is not None:
            grupo = (
                db.query(GrupoCompeticao)
                .filter(
                    GrupoCompeticao.id_edicao_competicao == id_edicao,
                    GrupoCompeticao.id_grupo == dados.id_grupo,
                )
                .first()
            )
            if grupo is None:
                raise ConfiguracaoInvalida(
                    "O grupo informado não pertence a esta edição.",
                    campos=["id_grupo"],
                )
            equipes_escopo = (
                db.query(Equipe)
                .filter(
                    Equipe.id_edicao_competicao == id_edicao,
                    Equipe.id_grupo == dados.id_grupo,
                )
                .all()
            )
        else:
            equipes_escopo = (
                db.query(Equipe)
                .filter(Equipe.id_edicao_competicao == id_edicao)
                .all()
            )

        ids_validos = {eq.id_equipe for eq in equipes_escopo}
        if not set(conjunto_int).issubset(ids_validos):
            raise ConfiguracaoInvalida(
                "Todas as equipes informadas devem pertencer à edição e ao grupo correspondente.",
                campos=["conjunto_equipes"],
            )

        consulta_partidas = db.query(Partida).filter(
            Partida.id_edicao_competicao == id_edicao
        )
        if dados.id_grupo is not None:
            consulta_partidas = consulta_partidas.filter(
                Partida.id_grupo == dados.id_grupo
            )
        else:
            consulta_partidas = consulta_partidas.filter(
                Partida.id_grupo.is_(None)
            )
        partidas_escopo = consulta_partidas.all()
        gols_map = _computar_placares_por_ocorrencias(db, partidas_escopo)
        partidas_convertidas = _converter_partidas_para_motor(
            partidas_escopo, gols_map
        )
        revisao_resultados = calcular_hash_resultados(partidas_convertidas)

        conjunto_ordenado = sorted(conjunto_int)
        consulta_existentes = db.query(DecisaoClassificacao).filter(
            DecisaoClassificacao.id_edicao_competicao == id_edicao
        )
        if dados.id_grupo is not None:
            consulta_existentes = consulta_existentes.filter(
                DecisaoClassificacao.id_grupo == dados.id_grupo
            )
        else:
            consulta_existentes = consulta_existentes.filter(
                DecisaoClassificacao.id_grupo.is_(None)
            )

        for ex in consulta_existentes.all():
            if sorted(int(x) for x in (ex.conjunto_equipes or [])) == conjunto_ordenado:
                db.delete(ex)
        db.flush()

        nova = DecisaoClassificacao(
            id_edicao_competicao=id_edicao,
            id_grupo=dados.id_grupo,
            conjunto_equipes=conjunto_ordenado,
            ordem_escolhida=ordem_int,
            motivo=dados.motivo.strip(),
            revisao_resultados=revisao_resultados,
            id_usuario_responsavel=responsavel.id_usuario,
        )
        db.add(nova)
        db.flush()

        incrementar_revisao(edicao)
        registrar_auditoria(
            db,
            entidade="decisoes_classificacao",
            id_entidade=nova.id_decisao,
            acao="REGISTRAR_DECISAO_CLASSIFICACAO",
            antes=None,
            depois={
                "id_grupo": dados.id_grupo,
                "conjunto_equipes": conjunto_ordenado,
                "ordem_escolhida": ordem_int,
                "revisao_resultados": revisao_resultados,
            },
            id_edicao_competicao=id_edicao,
            responsavel=responsavel,
            motivo=dados.motivo.strip(),
        )
        db.refresh(nova)

        return DecisaoClassificacaoDetalhe(
            id_decisao=nova.id_decisao,
            id_edicao_competicao=nova.id_edicao_competicao,
            id_grupo=nova.id_grupo,
            conjunto_equipes=conjunto_ordenado,
            ordem_escolhida=ordem_int,
            motivo=nova.motivo,
            revisao_resultados=nova.revisao_resultados,
            valida=True,
            criado_em=nova.criado_em,
        )


def listar_decisoes_classificacao(
    db: Session,
    id_edicao: int,
) -> list[DecisaoClassificacaoDetalhe]:
    """Lista todas as decisões de classificação da edição indicando sua validade atual."""
    edicao = db.get(EdicaoCompeticao, id_edicao)
    if not edicao:
        raise NaoEncontrado(
            f"Edição de competição {id_edicao} não encontrada.",
            campos=["id_edicao_competicao"],
        )

    decisoes = (
        db.query(DecisaoClassificacao)
        .filter(DecisaoClassificacao.id_edicao_competicao == id_edicao)
        .order_by(DecisaoClassificacao.id_decisao)
        .all()
    )
    if not decisoes:
        return []

    partidas = (
        db.query(Partida)
        .filter(Partida.id_edicao_competicao == id_edicao)
        .all()
    )
    gols_map = _computar_placares_por_ocorrencias(db, partidas)
    partidas_convertidas = _converter_partidas_para_motor(partidas, gols_map)

    partidas_por_escopo: dict[int | None, list[dict[str, Any]]] = defaultdict(list)
    for p_orm, p_dict in zip(partidas, partidas_convertidas):
        if p_orm.id_duelo is None:
            partidas_por_escopo[p_orm.id_grupo].append(p_dict)

    hashes_escopo: dict[int | None, str] = {}
    resultado: list[DecisaoClassificacaoDetalhe] = []
    for d in decisoes:
        if d.id_grupo not in hashes_escopo:
            hashes_escopo[d.id_grupo] = calcular_hash_resultados(
                partidas_por_escopo.get(d.id_grupo, [])
            )
        hash_atual = hashes_escopo[d.id_grupo]
        resultado.append(
            DecisaoClassificacaoDetalhe(
                id_decisao=d.id_decisao,
                id_edicao_competicao=d.id_edicao_competicao,
                id_grupo=d.id_grupo,
                conjunto_equipes=[int(x) for x in (d.conjunto_equipes or [])],
                ordem_escolhida=[int(x) for x in (d.ordem_escolhida or [])],
                motivo=d.motivo,
                revisao_resultados=d.revisao_resultados,
                valida=(d.revisao_resultados == hash_atual),
                criado_em=d.criado_em,
            )
        )
    return resultado
