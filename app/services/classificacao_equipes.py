"""Serviço para cálculo da classificação de equipes em competições."""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

import models


class CompeticaoNaoEncontradaError(LookupError, ValueError):
    """Exceção levantada quando a competição não é encontrada."""
    pass


class ModoCompeticaoInvalidoError(ValueError):
    """Exceção levantada quando a competição não está no modo EQUIPE."""
    pass


def _calcular_tabela(
    equipes: List[models.Equipe],
    confrontos_finalizados: List[models.Confronto],
) -> List[Dict[str, Any]]:
    """Calcula e ordena a tabela de classificação para uma lista de equipes e confrontos finalizados.

    Critérios de desempate ordenados:
    1. pontos DESC (V*3 + E*1)
    2. vitórias DESC
    3. saldo_gols DESC
    4. gols_pro DESC
    5. confronto_direto (pontos, saldo e gols marcados entre as equipes empatadas)
    6. nome_equipe ASC
    """
    tabela_map: Dict[int, Dict[str, Any]] = {}
    for eq in equipes:
        tabela_map[eq.id_equipe] = {
            "id_equipe": eq.id_equipe,
            "nome_equipe": eq.nome,
            "grupo": eq.grupo,
            "jogos": 0,
            "vitorias": 0,
            "empates": 0,
            "derrotas": 0,
            "gols_pro": 0,
            "gols_contra": 0,
            "saldo_gols": 0,
            "pontos": 0,
            "aproveitamento": 0.0,
        }

    for c in confrontos_finalizados:
        m_id = c.id_equipe_mandante
        v_id = c.id_equipe_visitante

        if m_id in tabela_map and v_id in tabela_map:
            t_m = tabela_map[m_id]
            t_v = tabela_map[v_id]

            t_m["jogos"] += 1
            t_v["jogos"] += 1

            t_m["gols_pro"] += c.placar_mandante
            t_m["gols_contra"] += c.placar_visitante

            t_v["gols_pro"] += c.placar_visitante
            t_v["gols_contra"] += c.placar_mandante

            if c.placar_mandante > c.placar_visitante:
                t_m["vitorias"] += 1
                t_m["pontos"] += 3
                t_v["derrotas"] += 1
            elif c.placar_mandante < c.placar_visitante:
                t_v["vitorias"] += 1
                t_v["pontos"] += 3
                t_m["derrotas"] += 1
            else:
                t_m["empates"] += 1
                t_m["pontos"] += 1
                t_v["empates"] += 1
                t_v["pontos"] += 1

    for t in tabela_map.values():
        t["saldo_gols"] = t["gols_pro"] - t["gols_contra"]
        if t["jogos"] > 0:
            t["aproveitamento"] = round((t["pontos"] / (t["jogos"] * 3)) * 100.0, 2)
        else:
            t["aproveitamento"] = 0.0

    lista_equipes = list(tabela_map.values())

    # Agrupa por critérios primários (pontos, vitórias, saldo, gols_pró) para aplicar confronto direto
    grupos_empate: Dict[tuple, List[Dict[str, Any]]] = {}
    for t in lista_equipes:
        chave = (t["pontos"], t["vitorias"], t["saldo_gols"], t["gols_pro"])
        grupos_empate.setdefault(chave, []).append(t)

    for chave, times_empatados in grupos_empate.items():
        if len(times_empatados) <= 1:
            for t in times_empatados:
                t["_h2h_pontos"] = 0
                t["_h2h_saldo"] = 0
                t["_h2h_gp"] = 0
        else:
            tied_ids = {t["id_equipe"] for t in times_empatados}
            h2h_jogos = [
                c
                for c in confrontos_finalizados
                if c.id_equipe_mandante in tied_ids and c.id_equipe_visitante in tied_ids
            ]
            h2h_stats = {tid: {"pontos": 0, "gp": 0, "gc": 0} for tid in tied_ids}
            for g in h2h_jogos:
                m_id = g.id_equipe_mandante
                v_id = g.id_equipe_visitante
                m_gols = g.placar_mandante
                v_gols = g.placar_visitante

                h2h_stats[m_id]["gp"] += m_gols
                h2h_stats[m_id]["gc"] += v_gols
                h2h_stats[v_id]["gp"] += v_gols
                h2h_stats[v_id]["gc"] += m_gols

                if m_gols > v_gols:
                    h2h_stats[m_id]["pontos"] += 3
                elif m_gols < v_gols:
                    h2h_stats[v_id]["pontos"] += 3
                else:
                    h2h_stats[m_id]["pontos"] += 1
                    h2h_stats[v_id]["pontos"] += 1

            for t in times_empatados:
                tid = t["id_equipe"]
                t["_h2h_pontos"] = h2h_stats[tid]["pontos"]
                t["_h2h_saldo"] = h2h_stats[tid]["gp"] - h2h_stats[tid]["gc"]
                t["_h2h_gp"] = h2h_stats[tid]["gp"]

    def sort_key(t: Dict[str, Any]):
        return (
            -t["pontos"],
            -t["vitorias"],
            -t["saldo_gols"],
            -t["gols_pro"],
            -t.get("_h2h_pontos", 0),
            -t.get("_h2h_saldo", 0),
            -t.get("_h2h_gp", 0),
            (t["nome_equipe"] or "").lower(),
            t["nome_equipe"] or "",
            t["id_equipe"],
        )

    ordenados = sorted(lista_equipes, key=sort_key)

    for idx, t in enumerate(ordenados, start=1):
        t["posicao"] = idx
        t.pop("_h2h_pontos", None)
        t.pop("_h2h_saldo", None)
        t.pop("_h2h_gp", None)

    return ordenados


def _calcular_mata_mata(
    competicao: models.Competicao,
    equipes: List[models.Equipe],
    todos_confrontos: List[models.Confronto],
) -> Dict[str, Any]:
    """Consolida o chaveamento de mata-mata identificando campeão, vice, semifinalistas e árvore."""
    team_map = {eq.id_equipe: eq for eq in equipes}
    confrontos_finalizados = [c for c in todos_confrontos if c.status == "Finalizado"]

    # Identifica o confronto da final
    final_confronto: Optional[models.Confronto] = None
    for c in todos_confrontos:
        if c.fase and c.fase.strip().lower() == "final":
            final_confronto = c
            break

    if not final_confronto:
        confrontos_sem_prox = [c for c in todos_confrontos if c.id_proximo_confronto is None]
        if len(confrontos_sem_prox) == 1:
            final_confronto = confrontos_sem_prox[0]
        elif confrontos_sem_prox:
            for c in confrontos_sem_prox:
                if c.fase and "final" in c.fase.strip().lower():
                    final_confronto = c
                    break
            if not final_confronto and confrontos_sem_prox:
                final_confronto = confrontos_sem_prox[0]

    campeao: Optional[Dict[str, Any]] = None
    vice_campeao: Optional[Dict[str, Any]] = None

    if final_confronto and final_confronto.status == "Finalizado" and final_confronto.id_equipe_vencedora:
        venc_id = final_confronto.id_equipe_vencedora
        perd_id = (
            final_confronto.id_equipe_visitante
            if final_confronto.id_equipe_mandante == venc_id
            else final_confronto.id_equipe_mandante
        )

        if venc_id in team_map:
            campeao = {"id_equipe": venc_id, "nome_equipe": team_map[venc_id].nome}
        if perd_id and perd_id in team_map:
            vice_campeao = {"id_equipe": perd_id, "nome_equipe": team_map[perd_id].nome}

    # Identifica semifinais
    confrontos_semi: List[models.Confronto] = []
    for c in todos_confrontos:
        fase_lower = (c.fase or "").lower()
        if "semifinal" in fase_lower or "semi-final" in fase_lower or fase_lower == "semi":
            confrontos_semi.append(c)
        elif final_confronto and c.id_proximo_confronto == final_confronto.id_confronto:
            confrontos_semi.append(c)

    equipes_semi_ids = set()
    for c in confrontos_semi:
        if c.id_equipe_mandante:
            equipes_semi_ids.add(c.id_equipe_mandante)
        if c.id_equipe_visitante:
            equipes_semi_ids.add(c.id_equipe_visitante)

    if campeao and vice_campeao:
        semi_derrotados_ids = equipes_semi_ids - {campeao["id_equipe"], vice_campeao["id_equipe"]}
        semifinalistas = [
            {"id_equipe": tid, "nome_equipe": team_map[tid].nome}
            for tid in sorted(semi_derrotados_ids, key=lambda tid: team_map[tid].nome if tid in team_map else "")
            if tid in team_map
        ]
    else:
        semifinalistas = [
            {"id_equipe": tid, "nome_equipe": team_map[tid].nome}
            for tid in sorted(equipes_semi_ids, key=lambda tid: team_map[tid].nome if tid in team_map else "")
            if tid in team_map
        ]

    # Constrói a árvore de confrontos
    arvore = []
    for c in sorted(todos_confrontos, key=lambda x: (x.rodada or 0, x.data or date.min, x.id_confronto or 0)):
        arvore.append({
            "id_confronto": c.id_confronto,
            "fase": c.fase,
            "rodada": c.rodada,
            "grupo": c.grupo,
            "status": c.status,
            "id_equipe_mandante": c.id_equipe_mandante,
            "nome_equipe_mandante": team_map[c.id_equipe_mandante].nome if c.id_equipe_mandante in team_map else None,
            "id_equipe_visitante": c.id_equipe_visitante,
            "nome_equipe_visitante": team_map[c.id_equipe_visitante].nome if c.id_equipe_visitante in team_map else None,
            "placar_mandante": c.placar_mandante,
            "placar_visitante": c.placar_visitante,
            "id_equipe_vencedora": c.id_equipe_vencedora,
            "nome_equipe_vencedora": team_map[c.id_equipe_vencedora].nome if c.id_equipe_vencedora in team_map else None,
            "id_proximo_confronto": c.id_proximo_confronto,
            "data": c.data.isoformat() if c.data else None,
            "hora": c.hora.isoformat() if c.hora else None,
            "observacoes": c.observacoes,
        })

    # Constrói tabela classificatória consolidada
    stats_equipes = _calcular_tabela(equipes, confrontos_finalizados)
    stats_dict = {t["id_equipe"]: t for t in stats_equipes}

    # Atribui posições com base nas colocações de mata-mata quando disponíveis
    classificacao_ordenada = []
    utilizados = set()

    if campeao:
        t_camp = stats_dict.get(campeao["id_equipe"])
        if t_camp:
            t_camp["posicao"] = 1
            classificacao_ordenada.append(t_camp)
            utilizados.add(campeao["id_equipe"])

    if vice_campeao:
        t_vice = stats_dict.get(vice_campeao["id_equipe"])
        if t_vice:
            t_vice["posicao"] = 2
            classificacao_ordenada.append(t_vice)
            utilizados.add(vice_campeao["id_equipe"])

    for semi in semifinalistas:
        t_semi = stats_dict.get(semi["id_equipe"])
        if t_semi and semi["id_equipe"] not in utilizados:
            t_semi["posicao"] = 3
            classificacao_ordenada.append(t_semi)
            utilizados.add(semi["id_equipe"])

    # Demais equipes mantêm posição sequencial ou pelo ranking de pontos
    proxima_pos = len(classificacao_ordenada) + 1
    for t in stats_equipes:
        if t["id_equipe"] not in utilizados:
            t["posicao"] = proxima_pos
            proxima_pos += 1
            classificacao_ordenada.append(t)

    return {
        "id_competicao": competicao.id_competicao,
        "nome_competicao": competicao.nome,
        "formato": "MATA_MATA",
        "total_equipes": len(equipes),
        "confrontos_disputados": len(confrontos_finalizados),
        "campeao": campeao,
        "vice_campeao": vice_campeao,
        "semifinalistas": semifinalistas,
        "arvore": arvore,
        "classificacao": classificacao_ordenada,
    }


def calcular_classificacao_equipes(db: Session, id_competicao: int) -> Dict[str, Any]:
    """Calcula a classificação de equipes de uma competição.

    Args:
        db: Sessão ativa do SQLAlchemy.
        id_competicao: ID da competição.

    Returns:
        Dicionário estruturado com as informações de classificação conforme o formato da competição.

    Raises:
        CompeticaoNaoEncontradaError (ValueError, LookupError): Se a competição não existir.
        ModoCompeticaoInvalidoError (ValueError): Se a competição não for do modo EQUIPE.
    """
    competicao = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not competicao:
        raise CompeticaoNaoEncontradaError(f"Competição com id {id_competicao} não encontrada.")

    if competicao.modo_inscricao != "EQUIPE":
        raise ModoCompeticaoInvalidoError(
            f"A classificação de equipes é exclusiva para competições em modo EQUIPE. Modo atual: {competicao.modo_inscricao}"
        )

    equipes = competicao.equipes or db.query(models.Equipe).filter(models.Equipe.id_competicao == id_competicao).all()
    todos_confrontos = competicao.confrontos or db.query(models.Confronto).filter(models.Confronto.id_competicao == id_competicao).all()
    confrontos_finalizados = [c for c in todos_confrontos if c.status == "Finalizado"]

    formato = competicao.formato or "PONTOS_CORRIDOS"

    if formato == "PONTOS_CORRIDOS":
        tabela = _calcular_tabela(equipes, confrontos_finalizados)
        return {
            "id_competicao": competicao.id_competicao,
            "nome_competicao": competicao.nome,
            "formato": "PONTOS_CORRIDOS",
            "total_equipes": len(equipes),
            "confrontos_disputados": len(confrontos_finalizados),
            "classificacao": tabela,
        }

    elif formato == "GRUPOS":
        # Agrupa as equipes por grupo
        grupos_map: Dict[str, List[models.Equipe]] = {}
        for eq in equipes:
            g_nome = eq.grupo or "A"
            grupos_map.setdefault(g_nome, []).append(eq)

        tabelas_por_grupo: Dict[str, List[Dict[str, Any]]] = {}
        tabela_unificada: List[Dict[str, Any]] = []

        for g_nome in sorted(grupos_map.keys()):
            eqs_grupo = grupos_map[g_nome]
            ids_grupo = {eq.id_equipe for eq in eqs_grupo}

            confrontos_grupo = [
                c
                for c in confrontos_finalizados
                if (c.grupo == g_nome)
                or (
                    c.id_equipe_mandante in ids_grupo
                    and c.id_equipe_visitante in ids_grupo
                    and not (c.fase and ("final" in c.fase.lower() or "semi" in c.fase.lower()))
                )
            ]

            tab_g = _calcular_tabela(eqs_grupo, confrontos_grupo)
            tabelas_por_grupo[g_nome] = tab_g
            tabela_unificada.extend(tab_g)

        return {
            "id_competicao": competicao.id_competicao,
            "nome_competicao": competicao.nome,
            "formato": "GRUPOS",
            "total_equipes": len(equipes),
            "confrontos_disputados": len(confrontos_finalizados),
            "grupos": tabelas_por_grupo,
            "classificacao_por_grupo": [
                {"grupo": g_nome, "classificacao": tab}
                for g_nome, tab in tabelas_por_grupo.items()
            ],
            "classificacao": tabela_unificada,
        }

    elif formato == "MATA_MATA":
        return _calcular_mata_mata(competicao, equipes, todos_confrontos)

    else:
        # Para outros formatos (ex: PROVAS em modo equipe caso exista), retorna cálculo padrão de pontos
        tabela = _calcular_tabela(equipes, confrontos_finalizados)
        return {
            "id_competicao": competicao.id_competicao,
            "nome_competicao": competicao.nome,
            "formato": formato,
            "total_equipes": len(equipes),
            "confrontos_disputados": len(confrontos_finalizados),
            "classificacao": tabela,
        }
