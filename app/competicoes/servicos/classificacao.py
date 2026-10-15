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
from competicoes.contratos.classificacao import (
    GrupoClassificacaoDetalhe,
    LinhaClassificacao,
    TabelaClassificacaoDetalhe,
)
from competicoes.erros import ConfiguracaoInvalida, NaoEncontrado
from competicoes.modelos.disputa import GrupoCompeticao
from competicoes.modelos.organizacao import EdicaoCompeticao
from competicoes.modelos.partidas import OcorrenciaPartida, Partida
from competicoes.modelos.pessoas import Equipe
from competicoes.servicos.motores.classificacao import calcular_classificacao


def _extrair_configuracao_classificacao(
    configuracao: dict | None,
) -> tuple[dict[str, int], list[str] | None]:
    """Extrai pontos e ordem de desempate da configuração da edição."""
    cfg = configuracao or {}

    pts_cfg = {"vitoria": 3, "empate": 1, "derrota": 0}
    if "configuracao_pontos" in cfg and isinstance(cfg["configuracao_pontos"], dict):
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
    if "ordem_desempates" in cfg and isinstance(cfg["ordem_desempates"], list):
        ordem = [str(x) for x in cfg["ordem_desempates"]]
    elif "criterios_desempate" in cfg and isinstance(cfg["criterios_desempate"], list):
        ordem = [str(x) for x in cfg["criterios_desempate"]]

    return pts_cfg, ordem


def _computar_placares_por_ocorrencias(
    db: Session,
    partidas: list[Partida],
) -> dict[int, dict[int, int]]:
    """Agrega contagem de ocorrências do tipo GOL por partida e equipe beneficiada (RULING R28)."""
    if not partidas:
        return {}

    ids_partidas = [p.id_partida for p in partidas]
    ocorrencias_gol = (
        db.query(OcorrenciaPartida)
        .filter(
            OcorrenciaPartida.id_partida.in_(ids_partidas),
            OcorrenciaPartida.tipo == "GOL",
        )
        .all()
    )

    gols_map: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for oc in ocorrencias_gol:
        gols_map[oc.id_partida][oc.id_equipe_beneficiada] += 1

    return gols_map


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
        partidas_convertidas = _converter_partidas_para_motor(partidas, gols_map)
        equipes_convertidas = [{"id_equipe": eq.id_equipe, "nome_equipe": eq.nome} for eq in equipes]

        linhas = calcular_classificacao(
            equipes=equipes_convertidas,
            partidas=partidas_convertidas,
            configuracao_pontos=pts_cfg,
            ordem_desempates=ordem,
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

            linhas_g = calcular_classificacao(
                equipes=equipes_g,
                partidas=partidas_g,
                configuracao_pontos=pts_cfg,
                ordem_desempates=ordem,
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
