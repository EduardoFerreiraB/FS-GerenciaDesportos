"""Serviço V2 para cálculo de Classificação, Estatísticas, Artilharia e Controle Disciplinar.

Suporta:
- Formato PONTOS_CORRIDOS com ordenação dinâmica por critérios configuráveis
  (pontos, vitorias, saldo_gols, gols_pro, confronto_direto, menos_cartoes, menos_vermelhos, nome).
- Formato GRUPOS_MATA_MATA com classificação particionada por grupo, corte de
  classificados_por_grupo e árvore da fase eliminatória.
- Formato MATA_MATA / MATA_MATA_DIRETO com suporte a jogos únicos, ida e volta,
  decisão por pênaltis, apuração de campeão, vice e 3º colocado.
- Consolidação de Artilharia positiva a partir de OcorrenciaPartida (desconsiderando gol contra).
- Controle Disciplinar de cartões amarelos e vermelhos com lista de atletas suspensos.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any, Dict, List, Optional, Set
from sqlalchemy.orm import Session

try:
    import models
except ImportError:
    from app import models


class CompeticaoNaoEncontradaError(LookupError, ValueError):
    """Exceção levantada quando a competição solicitada não existe no banco de dados."""
    pass


class ModoCompeticaoInvalidoError(ValueError):
    """Exceção levantada quando o cálculo de classificação por equipes é acionado para modalidade individual."""
    pass


# ==============================================================================
# 1. FUNÇÕES AUXILIARES DE CÁLCULO
# ==============================================================================

def _extrair_regras_formato(competicao: models.Competicao) -> Dict[str, Any]:
    """Extrai o dicionário de regras de formato da competição, tolerando None ou JSON string."""
    regras = getattr(competicao, "regras_formato", None)
    if not regras:
        return {}
    if isinstance(regras, str):
        try:
            return json.loads(regras)
        except Exception:
            return {}
    if isinstance(regras, dict):
        return regras
    return {}


def _obter_cartoes_por_equipe(db: Session, id_competicao: int) -> Dict[int, Dict[str, int]]:
    """Calcula total de cartões amarelos, vermelhos e pontos disciplinares por equipe."""
    ocorrencias = (
        db.query(models.OcorrenciaPartida)
        .join(models.Confronto, models.OcorrenciaPartida.id_confronto == models.Confronto.id_confronto)
        .filter(models.Confronto.id_competicao == id_competicao)
        .all()
    )

    stats_cartoes: Dict[int, Dict[str, int]] = {}
    for oc in ocorrencias:
        if not oc.id_equipe:
            continue
        eq_id = oc.id_equipe
        if eq_id not in stats_cartoes:
            stats_cartoes[eq_id] = {"amarelos": 0, "vermelhos": 0, "pontos": 0}

        tipo_upper = (oc.tipo or "").strip().upper()
        if tipo_upper in ("CARTAO_AMARELO", "AMARELO"):
            stats_cartoes[eq_id]["amarelos"] += 1
            stats_cartoes[eq_id]["pontos"] += 1
        elif tipo_upper in ("CARTAO_VERMELHO", "VERMELHO"):
            stats_cartoes[eq_id]["vermelhos"] += 1
            stats_cartoes[eq_id]["pontos"] += 3

    return stats_cartoes


def _calcular_tabela_pontos(
    equipes: List[models.Equipe],
    confrontos_finalizados: List[models.Confronto],
    regras_formato: Dict[str, Any],
    stats_cartoes: Optional[Dict[int, Dict[str, int]]] = None,
) -> List[Dict[str, Any]]:
    """Calcula e ordena a tabela de pontos corridos aplicando critérios dinâmicos de desempate."""
    if stats_cartoes is None:
        stats_cartoes = {}

    pts_vitoria = int(regras_formato.get("vitoria_pontos", regras_formato.get("pontos_vitoria", 3)))
    pts_empate = int(regras_formato.get("empate_pontos", regras_formato.get("pontos_empate", 1)))
    pts_derrota = int(regras_formato.get("derrota_pontos", regras_formato.get("pontos_derrota", 0)))

    tabela_map: Dict[int, Dict[str, Any]] = {}
    for eq in equipes:
        c_info = stats_cartoes.get(eq.id_equipe, {"amarelos": 0, "vermelhos": 0, "pontos": 0})
        tabela_map[eq.id_equipe] = {
            "id_equipe": eq.id_equipe,
            "nome_equipe": eq.nome,
            "sigla_equipe": getattr(eq, "sigla", None),
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
            "cartoes_amarelos": c_info["amarelos"],
            "cartoes_vermelhos": c_info["vermelhos"],
            "pontos_disciplinar": c_info["pontos"],
        }

    for c in confrontos_finalizados:
        m_id = c.id_equipe_mandante
        v_id = c.id_equipe_visitante
        if m_id in tabela_map and v_id in tabela_map:
            t_m = tabela_map[m_id]
            t_v = tabela_map[v_id]
            pm = c.placar_mandante if c.placar_mandante is not None else 0
            pv = c.placar_visitante if c.placar_visitante is not None else 0

            t_m["jogos"] += 1
            t_v["jogos"] += 1

            t_m["gols_pro"] += pm
            t_m["gols_contra"] += pv
            t_v["gols_pro"] += pv
            t_v["gols_contra"] += pm

            if pm > pv:
                t_m["vitorias"] += 1
                t_m["pontos"] += pts_vitoria
                t_v["derrotas"] += 1
                t_v["pontos"] += pts_derrota
            elif pv > pm:
                t_v["vitorias"] += 1
                t_v["pontos"] += pts_vitoria
                t_m["derrotas"] += 1
                t_m["pontos"] += pts_derrota
            else:
                t_m["empates"] += 1
                t_m["pontos"] += pts_empate
                t_v["empates"] += 1
                t_v["pontos"] += pts_empate

    for t in tabela_map.values():
        t["saldo_gols"] = t["gols_pro"] - t["gols_contra"]
        pontos_possiveis = t["jogos"] * pts_vitoria
        if pontos_possiveis > 0:
            t["aproveitamento"] = round((t["pontos"] / pontos_possiveis) * 100.0, 2)
        else:
            t["aproveitamento"] = 0.0

    raw_criterios = regras_formato.get("criterios_desempate")
    if not raw_criterios:
        criterios = ["pontos", "vitorias", "saldo_gols", "gols_pro", "confronto_direto", "menos_cartoes", "nome"]
    else:
        criterios = [str(crit).strip().lower() for crit in raw_criterios]

    # Algoritmo de particionamento progressivo de baldes (bucket refinement)
    buckets: List[List[Dict[str, Any]]] = [list(tabela_map.values())]

    for crit in criterios:
        new_buckets: List[List[Dict[str, Any]]] = []
        for bucket in buckets:
            if len(bucket) <= 1:
                new_buckets.append(bucket)
                continue

            sub_map: Dict[Any, List[Dict[str, Any]]] = {}

            if crit == "pontos":
                for t in bucket:
                    sub_map.setdefault(t["pontos"], []).append(t)
                for val in sorted(sub_map.keys(), reverse=True):
                    new_buckets.append(sub_map[val])

            elif crit == "vitorias":
                for t in bucket:
                    sub_map.setdefault(t["vitorias"], []).append(t)
                for val in sorted(sub_map.keys(), reverse=True):
                    new_buckets.append(sub_map[val])

            elif crit == "saldo_gols":
                for t in bucket:
                    sub_map.setdefault(t["saldo_gols"], []).append(t)
                for val in sorted(sub_map.keys(), reverse=True):
                    new_buckets.append(sub_map[val])

            elif crit == "gols_pro":
                for t in bucket:
                    sub_map.setdefault(t["gols_pro"], []).append(t)
                for val in sorted(sub_map.keys(), reverse=True):
                    new_buckets.append(sub_map[val])

            elif crit in ("gols_contra", "menos_gols_contra"):
                for t in bucket:
                    sub_map.setdefault(t["gols_contra"], []).append(t)
                for val in sorted(sub_map.keys()):  # Menos gols contra é melhor
                    new_buckets.append(sub_map[val])

            elif crit in ("menos_cartoes", "disciplinar"):
                for t in bucket:
                    sub_map.setdefault(t["pontos_disciplinar"], []).append(t)
                for val in sorted(sub_map.keys()):  # Menos pontos disciplinares é melhor
                    new_buckets.append(sub_map[val])

            elif crit in ("menos_vermelhos", "cartoes_vermelhos"):
                for t in bucket:
                    sub_map.setdefault(t["cartoes_vermelhos"], []).append(t)
                for val in sorted(sub_map.keys()):
                    new_buckets.append(sub_map[val])

            elif crit in ("menos_amarelos", "cartoes_amarelos"):
                for t in bucket:
                    sub_map.setdefault(t["cartoes_amarelos"], []).append(t)
                for val in sorted(sub_map.keys()):
                    new_buckets.append(sub_map[val])

            elif crit == "confronto_direto":
                tied_ids = {t["id_equipe"] for t in bucket}
                h2h_jogos = [
                    c for c in confrontos_finalizados
                    if c.id_equipe_mandante in tied_ids and c.id_equipe_visitante in tied_ids
                ]
                h2h_stats = {tid: {"pontos": 0, "gp": 0, "gc": 0} for tid in tied_ids}
                for c in h2h_jogos:
                    mid = c.id_equipe_mandante
                    vid = c.id_equipe_visitante
                    pm = c.placar_mandante if c.placar_mandante is not None else 0
                    pv = c.placar_visitante if c.placar_visitante is not None else 0

                    h2h_stats[mid]["gp"] += pm
                    h2h_stats[mid]["gc"] += pv
                    h2h_stats[vid]["gp"] += pv
                    h2h_stats[vid]["gc"] += pm

                    if pm > pv:
                        h2h_stats[mid]["pontos"] += pts_vitoria
                        h2h_stats[vid]["pontos"] += pts_derrota
                    elif pv > pm:
                        h2h_stats[vid]["pontos"] += pts_vitoria
                        h2h_stats[mid]["pontos"] += pts_derrota
                    else:
                        h2h_stats[mid]["pontos"] += pts_empate
                        h2h_stats[vid]["pontos"] += pts_empate

                for t in bucket:
                    tid = t["id_equipe"]
                    h_pts = h2h_stats[tid]["pontos"]
                    h_sg = h2h_stats[tid]["gp"] - h2h_stats[tid]["gc"]
                    h_gp = h2h_stats[tid]["gp"]
                    sub_map.setdefault((h_pts, h_sg, h_gp), []).append(t)

                for val in sorted(sub_map.keys(), reverse=True):
                    new_buckets.append(sub_map[val])

            elif crit == "nome":
                for t in bucket:
                    sub_map.setdefault((t["nome_equipe"] or "").strip().lower(), []).append(t)
                for val in sorted(sub_map.keys()):
                    new_buckets.append(sub_map[val])

            else:
                new_buckets.append(bucket)

        buckets = new_buckets

    # Desempate residual final por nome e id
    tabela_ordenada: List[Dict[str, Any]] = []
    for bucket in buckets:
        sub_ordenado = sorted(bucket, key=lambda x: ((x["nome_equipe"] or "").lower(), x["id_equipe"]))
        tabela_ordenada.extend(sub_ordenado)

    for idx, t in enumerate(tabela_ordenada, start=1):
        t["posicao"] = idx

    return tabela_ordenada


def _resolver_vencedor_confronto(
    confronto: models.Confronto,
    confrontos_map: Dict[int, models.Confronto],
) -> Optional[int]:
    """Determina o ID da equipe vencedora do confronto, inclusive com ida/volta e pênaltis."""
    if confronto.id_equipe_vencedora:
        return confronto.id_equipe_vencedora

    if confronto.status != "Finalizado":
        return None

    # Caso seja jogo de volta (ordem_jogo == 2 ou id_confronto_ida apontado)
    if (confronto.ordem_jogo == 2 or confronto.id_confronto_ida) and confronto.id_confronto_ida in confrontos_map:
        ida = confrontos_map[confronto.id_confronto_ida]
        pm_ida = ida.placar_mandante if ida.placar_mandante is not None else 0
        pv_ida = ida.placar_visitante if ida.placar_visitante is not None else 0
        pm_volta = confronto.placar_mandante if confronto.placar_mandante is not None else 0
        pv_volta = confronto.placar_visitante if confronto.placar_visitante is not None else 0

        # Mapeia mandante da volta para seus gols na ida
        if ida.id_equipe_mandante == confronto.id_equipe_mandante:
            gols_mandante_volta = pm_volta + pm_ida
            gols_visitante_volta = pv_volta + pv_ida
        else:
            gols_mandante_volta = pm_volta + pv_ida
            gols_visitante_volta = pv_volta + pm_ida

        if gols_mandante_volta > gols_visitante_volta:
            return confronto.id_equipe_mandante
        elif gols_visitante_volta > gols_mandante_volta:
            return confronto.id_equipe_visitante
        else:
            # Empate no agregado -> verifica pênaltis no jogo de volta
            if confronto.penaltis_mandante is not None and confronto.penaltis_visitante is not None:
                if confronto.penaltis_mandante > confronto.penaltis_visitante:
                    return confronto.id_equipe_mandante
                elif confronto.penaltis_visitante > confronto.penaltis_mandante:
                    return confronto.id_equipe_visitante
            return None

    # Jogo único
    pm = confronto.placar_mandante if confronto.placar_mandante is not None else 0
    pv = confronto.placar_visitante if confronto.placar_visitante is not None else 0

    if pm > pv:
        return confronto.id_equipe_mandante
    elif pv > pm:
        return confronto.id_equipe_visitante
    else:
        if confronto.penaltis_mandante is not None and confronto.penaltis_visitante is not None:
            if confronto.penaltis_mandante > confronto.penaltis_visitante:
                return confronto.id_equipe_mandante
            elif confronto.penaltis_visitante > confronto.penaltis_mandante:
                return confronto.id_equipe_visitante
        return None


def _calcular_mata_mata_v2(
    competicao: models.Competicao,
    equipes: List[models.Equipe],
    todos_confrontos: List[models.Confronto],
) -> Dict[str, Any]:
    """Apura chaveamento eliminatório com suporte a ida/volta, pênaltis, campeão, vice e 3º colocado."""
    team_map = {eq.id_equipe: eq for eq in equipes}
    confrontos_map = {c.id_confronto: c for c in todos_confrontos}
    confrontos_finalizados = [c for c in todos_confrontos if c.status == "Finalizado"]

    arvore: List[Dict[str, Any]] = []
    fases_agrupadas: Dict[str, List[Dict[str, Any]]] = {}

    for c in sorted(todos_confrontos, key=lambda x: (x.rodada or 0, x.data or date.min, x.id_confronto or 0)):
        venc_id = _resolver_vencedor_confronto(c, confrontos_map)
        item = {
            "id_confronto": c.id_confronto,
            "fase": c.fase,
            "rodada": c.rodada,
            "grupo": c.grupo,
            "ordem_jogo": getattr(c, "ordem_jogo", 1),
            "id_confronto_ida": getattr(c, "id_confronto_ida", None),
            "status": c.status,
            "id_equipe_mandante": c.id_equipe_mandante,
            "nome_equipe_mandante": team_map[c.id_equipe_mandante].nome if c.id_equipe_mandante in team_map else None,
            "sigla_equipe_mandante": getattr(team_map.get(c.id_equipe_mandante), "sigla", None),
            "id_equipe_visitante": c.id_equipe_visitante,
            "nome_equipe_visitante": team_map[c.id_equipe_visitante].nome if c.id_equipe_visitante in team_map else None,
            "sigla_equipe_visitante": getattr(team_map.get(c.id_equipe_visitante), "sigla", None),
            "placar_mandante": c.placar_mandante,
            "placar_visitante": c.placar_visitante,
            "penaltis_mandante": getattr(c, "penaltis_mandante", None),
            "penaltis_visitante": getattr(c, "penaltis_visitante", None),
            "id_equipe_vencedora": venc_id,
            "nome_equipe_vencedora": team_map[venc_id].nome if venc_id in team_map else None,
            "id_proximo_confronto": c.id_proximo_confronto,
            "data": c.data.isoformat() if c.data else None,
            "hora": c.hora.isoformat() if c.hora else None,
            "observacoes": c.observacoes,
        }
        arvore.append(item)
        fase_nome = c.fase or "Eliminatória"
        fases_agrupadas.setdefault(fase_nome, []).append(item)

    # Identificação da Grande Final
    final_confronto: Optional[models.Confronto] = None
    candidatos_final = [
        c for c in todos_confrontos
        if c.fase and "final" in c.fase.lower() and not any(k in c.fase.lower() for k in ("semi", "oitav", "quart", "3", "terceir", "bronze"))
    ]
    if candidatos_final:
        # Se ida e volta, pega o jogo de volta (ordem_jogo == 2)
        candidatos_final.sort(key=lambda x: getattr(x, "ordem_jogo", 1), reverse=True)
        final_confronto = candidatos_final[0]
    else:
        # Confronto sem próximo confronto e sem ser disputa de 3º lugar
        sem_prox = [
            c for c in todos_confrontos
            if c.id_proximo_confronto is None and not (c.fase and any(k in c.fase.lower() for k in ("3", "terceir", "bronze")))
        ]
        if sem_prox:
            final_confronto = sem_prox[-1]

    campeao: Optional[Dict[str, Any]] = None
    vice_campeao: Optional[Dict[str, Any]] = None

    if final_confronto and final_confronto.status == "Finalizado":
        venc_final = _resolver_vencedor_confronto(final_confronto, confrontos_map)
        if venc_final:
            perd_final = (
                final_confronto.id_equipe_visitante
                if final_confronto.id_equipe_mandante == venc_final
                else final_confronto.id_equipe_mandante
            )
            if venc_final in team_map:
                campeao = {"id_equipe": venc_final, "nome_equipe": team_map[venc_final].nome}
            if perd_final and perd_final in team_map:
                vice_campeao = {"id_equipe": perd_final, "nome_equipe": team_map[perd_final].nome}

    # Identificação da Disputa de 3º Lugar
    terceiro_confronto: Optional[models.Confronto] = None
    for c in todos_confrontos:
        if c.fase and any(k in c.fase.lower() for k in ("3", "terceir", "bronze")):
            terceiro_confronto = c
            break

    terceiro_colocado: Optional[Dict[str, Any]] = None
    if terceiro_confronto and terceiro_confronto.status == "Finalizado":
        venc_3 = _resolver_vencedor_confronto(terceiro_confronto, confrontos_map)
        if venc_3 and venc_3 in team_map:
            terceiro_colocado = {"id_equipe": venc_3, "nome_equipe": team_map[venc_3].nome}

    # Identificação de Semifinalistas
    confrontos_semi = [
        c for c in todos_confrontos
        if c.fase and any(k in c.fase.lower() for k in ("semi", "semifinal", "semi-final"))
    ]
    semifinalistas_ids: Set[int] = set()
    for c in confrontos_semi:
        if c.id_equipe_mandante:
            semifinalistas_ids.add(c.id_equipe_mandante)
        if c.id_equipe_visitante:
            semifinalistas_ids.add(c.id_equipe_visitante)

    semifinalistas: List[Dict[str, Any]] = [
        {"id_equipe": tid, "nome_equipe": team_map[tid].nome}
        for tid in sorted(semifinalistas_ids, key=lambda tid: team_map[tid].nome if tid in team_map else "")
        if tid in team_map
    ]

    return {
        "id_competicao": competicao.id_competicao,
        "nome_competicao": competicao.nome,
        "formato": "MATA_MATA",
        "total_equipes": len(equipes),
        "total_confrontos": len(todos_confrontos),
        "confrontos_disputados": len(confrontos_finalizados),
        "campeao": campeao,
        "vice_campeao": vice_campeao,
        "terceiro_colocado": terceiro_colocado,
        "semifinalistas": semifinalistas,
        "fases": fases_agrupadas,
        "arvore": arvore,
    }


# ==============================================================================
# 2. MOTOR DE CLASSIFICAÇÃO V2
# ==============================================================================

def calcular_classificacao_v2(db: Session, id_competicao: int) -> Dict[str, Any]:
    """Calcula a classificação esportiva e chaveamento para a V2 do domínio de competições.

    Args:
        db: Sessão SQLAlchemy.
        id_competicao: ID da competição alvo.

    Returns:
        Dicionário estruturado com as tabelas, desempates e fases eliminatórias.

    Raises:
        CompeticaoNaoEncontradaError: Caso a competição não exista.
        ModoCompeticaoInvalidoError: Caso a competição seja estritamente individual.
    """
    competicao = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not competicao:
        raise CompeticaoNaoEncontradaError(f"Competição com id {id_competicao} não encontrada.")

    modo = (competicao.modo_inscricao or "").strip().upper()
    if modo == "INDIVIDUAL":
        raise ModoCompeticaoInvalidoError(
            f"A classificação esportiva de equipes é exclusiva para competições em modo EQUIPE. Modo atual: {competicao.modo_inscricao}"
        )

    equipes = competicao.equipes or db.query(models.Equipe).filter(models.Equipe.id_competicao == id_competicao).all()
    todos_confrontos = competicao.confrontos or db.query(models.Confronto).filter(models.Confronto.id_competicao == id_competicao).all()
    confrontos_finalizados = [c for c in todos_confrontos if c.status == "Finalizado"]

    regras_formato = _extrair_regras_formato(competicao)
    stats_cartoes = _obter_cartoes_por_equipe(db, id_competicao)

    formato_raw = (competicao.formato or "PONTOS_CORRIDOS").strip().upper()

    # Formato: PONTOS_CORRIDOS
    if formato_raw == "PONTOS_CORRIDOS":
        tabela = _calcular_tabela_pontos(equipes, confrontos_finalizados, regras_formato, stats_cartoes)
        return {
            "id_competicao": competicao.id_competicao,
            "nome_competicao": competicao.nome,
            "formato": "PONTOS_CORRIDOS",
            "total_equipes": len(equipes),
            "confrontos_disputados": len(confrontos_finalizados),
            "classificacao": tabela,
        }

    # Formato: GRUPOS ou GRUPOS_MATA_MATA
    elif formato_raw in ("GRUPOS", "GRUPOS_MATA_MATA"):
        grupos_map: Dict[str, List[models.Equipe]] = {}
        for eq in equipes:
            g_nome = (eq.grupo or "A").strip()
            grupos_map.setdefault(g_nome, []).append(eq)

        classificados_por_grupo = int(regras_formato.get("classificados_por_grupo", 2))

        tabelas_por_grupo: Dict[str, List[Dict[str, Any]]] = {}
        classificados_geral: List[Dict[str, Any]] = []
        classificacao_geral: List[Dict[str, Any]] = []

        for g_nome in sorted(grupos_map.keys()):
            eqs_grupo = grupos_map[g_nome]
            ids_grupo = {eq.id_equipe for eq in eqs_grupo}

            # Confrontos da fase de grupos
            confrontos_grupo = [
                c for c in confrontos_finalizados
                if (c.grupo == g_nome) or (
                    c.id_equipe_mandante in ids_grupo
                    and c.id_equipe_visitante in ids_grupo
                    and not (c.fase and any(k in c.fase.lower() for k in ("semi", "final", "oitav", "quart", "3", "terceir")))
                )
            ]

            tab_g = _calcular_tabela_pontos(eqs_grupo, confrontos_grupo, regras_formato, stats_cartoes)
            for t in tab_g:
                is_classificado = t["posicao"] <= classificados_por_grupo
                t["classificado"] = is_classificado
                if is_classificado:
                    classificados_geral.append(t)

            tabelas_por_grupo[g_nome] = tab_g
            classificacao_geral.extend(tab_g)

        # Confrontos da fase eliminatória (se houver)
        confrontos_mata_mata = [
            c for c in todos_confrontos
            if (c.fase and any(k in c.fase.lower() for k in ("semi", "final", "oitav", "quart", "3", "terceir")))
            or getattr(c, "id_proximo_confronto", None) is not None
        ]
        mata_mata_info = _calcular_mata_mata_v2(competicao, equipes, confrontos_mata_mata)

        return {
            "id_competicao": competicao.id_competicao,
            "nome_competicao": competicao.nome,
            "formato": formato_raw,
            "total_equipes": len(equipes),
            "confrontos_disputados": len(confrontos_finalizados),
            "grupos": tabelas_por_grupo,
            "classificacao_por_grupo": [
                {
                    "grupo": g_nome,
                    "classificados": [t for t in tab if t.get("classificado")],
                    "classificacao": tab,
                }
                for g_nome, tab in tabelas_por_grupo.items()
            ],
            "classificados": classificados_geral,
            "classificacao": classificacao_geral,
            "fase_eliminatoria": mata_mata_info,
        }

    # Formato: MATA_MATA ou MATA_MATA_DIRETO
    elif formato_raw in ("MATA_MATA", "MATA_MATA_DIRETO"):
        return _calcular_mata_mata_v2(competicao, equipes, todos_confrontos)

    # Formatos genéricos/outros
    else:
        tabela = _calcular_tabela_pontos(equipes, confrontos_finalizados, regras_formato, stats_cartoes)
        return {
            "id_competicao": competicao.id_competicao,
            "nome_competicao": competicao.nome,
            "formato": formato_raw,
            "total_equipes": len(equipes),
            "confrontos_disputados": len(confrontos_finalizados),
            "classificacao": tabela,
        }


# ==============================================================================
# 3. MOTOR DE ARTILHARIA V2
# ==============================================================================

def obter_artilharia_v2(db: Session, id_competicao: int) -> List[Dict[str, Any]]:
    """Consolida os artilheiros da competição a partir das súmulas rápidas (OcorrenciaPartida).

    Regras:
    - Considera apenas ocorrências do tipo 'GOL' (exclui 'GOL_CONTRA').
    - Exclui partidas com status 'Cancelado'.
    - Agrupa por atleta e ordena por total de gols DESC, nome do jogador ASC.
    """
    competicao = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not competicao:
        raise CompeticaoNaoEncontradaError(f"Competição com id {id_competicao} não encontrada.")

    ocorrencias_gols = (
        db.query(models.OcorrenciaPartida)
        .join(models.Confronto, models.OcorrenciaPartida.id_confronto == models.Confronto.id_confronto)
        .filter(
            models.Confronto.id_competicao == id_competicao,
            models.OcorrenciaPartida.tipo == "GOL",
            models.Confronto.status != "Cancelado",
        )
        .all()
    )

    contagem_gols: Dict[int, int] = {}
    jogador_map: Dict[int, models.Jogador] = {}
    equipe_map: Dict[int, models.Equipe] = {}

    for oc in ocorrencias_gols:
        if not oc.id_jogador:
            continue
        jid = oc.id_jogador
        contagem_gols[jid] = contagem_gols.get(jid, 0) + 1
        if jid not in jogador_map and oc.jogador:
            jogador_map[jid] = oc.jogador
        if oc.id_equipe and oc.id_equipe not in equipe_map and oc.equipe:
            equipe_map[oc.id_equipe] = oc.equipe

    # Busca no banco jogadores ou equipes que faltaram carregar via lazy
    faltando_jogadores = set(contagem_gols.keys()) - set(jogador_map.keys())
    if faltando_jogadores:
        encontrados = db.query(models.Jogador).filter(models.Jogador.id_jogador.in_(faltando_jogadores)).all()
        for j in encontrados:
            jogador_map[j.id_jogador] = j

    artilharia_lista: List[Dict[str, Any]] = []
    for jid, total in contagem_gols.items():
        j = jogador_map.get(jid)
        eq = equipe_map.get(j.id_equipe) if (j and j.id_equipe) else None
        if not eq and j and j.id_equipe:
            eq = db.query(models.Equipe).filter(models.Equipe.id_equipe == j.id_equipe).first()
            if eq:
                equipe_map[eq.id_equipe] = eq

        artilharia_lista.append({
            "id_jogador": jid,
            "nome_jogador": j.nome if j else f"Jogador #{jid}",
            "numero_camisa": getattr(j, "numero_camisa", None),
            "posicao": getattr(j, "posicao", None),
            "id_equipe": eq.id_equipe if eq else (j.id_equipe if j else None),
            "nome_equipe": eq.nome if eq else "Equipe Não Identificada",
            "gols": total,
        })

    # Ordenação por total de gols DESC, nome do jogador ASC
    artilharia_lista.sort(key=lambda x: (-x["gols"], (x["nome_jogador"] or "").lower()))

    for idx, item in enumerate(artilharia_lista, start=1):
        item["posicao"] = idx

    return artilharia_lista


# ==============================================================================
# 4. MOTOR DE CONTROLE DISCIPLINAR & SUSPENSÕES V2
# ==============================================================================

def obter_disciplinar_v2(db: Session, id_competicao: int) -> Dict[str, Any]:
    """Consolida cartões amarelos e vermelhos por jogador e por equipe e identifica suspensões.

    Regras de suspensão:
    - 1 cartão vermelho (direto ou por segundo amarelo) gera suspensão automática.
    - Acúmulo de cartões amarelos (padrão = 3 ou definido em regras_formato.limite_amarelos_suspensao).
    """
    competicao = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not competicao:
        raise CompeticaoNaoEncontradaError(f"Competição com id {id_competicao} não encontrada.")

    regras = _extrair_regras_formato(competicao)
    limite_amarelos = int(regras.get("limite_amarelos_suspensao", 3))

    ocorrencias = (
        db.query(models.OcorrenciaPartida)
        .join(models.Confronto, models.OcorrenciaPartida.id_confronto == models.Confronto.id_confronto)
        .filter(
            models.Confronto.id_competicao == id_competicao,
            models.Confronto.status != "Cancelado",
            models.OcorrenciaPartida.tipo.in_(["CARTAO_AMARELO", "CARTAO_VERMELHO", "AMARELO", "VERMELHO"]),
        )
        .all()
    )

    cartoes_jogadores: Dict[int, Dict[str, Any]] = {}
    cartoes_equipes: Dict[int, Dict[str, Any]] = {}

    total_amarelos = 0
    total_vermelhos = 0

    for oc in ocorrencias:
        tipo_upper = (oc.tipo or "").strip().upper()
        is_amarelo = tipo_upper in ("CARTAO_AMARELO", "AMARELO")
        is_vermelho = tipo_upper in ("CARTAO_VERMELHO", "VERMELHO")

        if is_amarelo:
            total_amarelos += 1
        elif is_vermelho:
            total_vermelhos += 1

        # Agrupamento por jogador
        if oc.id_jogador:
            jid = oc.id_jogador
            if jid not in cartoes_jogadores:
                cartoes_jogadores[jid] = {
                    "id_jogador": jid,
                    "nome_jogador": oc.jogador.nome if oc.jogador else f"Jogador #{jid}",
                    "numero_camisa": getattr(oc.jogador, "numero_camisa", None),
                    "id_equipe": oc.id_equipe,
                    "nome_equipe": oc.equipe.nome if oc.equipe else "Equipe",
                    "cartoes_amarelos": 0,
                    "cartoes_vermelhos": 0,
                }
            if is_amarelo:
                cartoes_jogadores[jid]["cartoes_amarelos"] += 1
            elif is_vermelho:
                cartoes_jogadores[jid]["cartoes_vermelhos"] += 1

        # Agrupamento por equipe
        if oc.id_equipe:
            eid = oc.id_equipe
            if eid not in cartoes_equipes:
                cartoes_equipes[eid] = {
                    "id_equipe": eid,
                    "nome_equipe": oc.equipe.nome if oc.equipe else f"Equipe #{eid}",
                    "cartoes_amarelos": 0,
                    "cartoes_vermelhos": 0,
                    "pontos_disciplinar": 0,
                }
            if is_amarelo:
                cartoes_equipes[eid]["cartoes_amarelos"] += 1
                cartoes_equipes[eid]["pontos_disciplinar"] += 1
            elif is_vermelho:
                cartoes_equipes[eid]["cartoes_vermelhos"] += 1
                cartoes_equipes[eid]["pontos_disciplinar"] += 3

    # Identifica suspensões dos atletas
    jogadores_lista: List[Dict[str, Any]] = []
    suspensos: List[Dict[str, Any]] = []

    for jid, dados in cartoes_jogadores.items():
        ca = dados["cartoes_amarelos"]
        cv = dados["cartoes_vermelhos"]
        pts = (ca * 1) + (cv * 3)
        dados["pontos_disciplinar"] = pts

        suspenso = False
        motivo = None

        if cv > 0:
            suspenso = True
            motivo = "Cartão Vermelho"
        elif ca >= limite_amarelos:
            suspenso = True
            motivo = f"Acúmulo de {ca} cartões amarelos"

        dados["suspenso"] = suspenso
        dados["motivo_suspensao"] = motivo

        jogadores_lista.append(dados)
        if suspenso:
            suspensos.append(dados)

    # Ordenações
    jogadores_lista.sort(key=lambda x: (-x["cartoes_vermelhos"], -x["cartoes_amarelos"], (x["nome_jogador"] or "").lower()))
    suspensos.sort(key=lambda x: (-x["cartoes_vermelhos"], -x["cartoes_amarelos"], (x["nome_jogador"] or "").lower()))

    equipes_lista = list(cartoes_equipes.values())
    equipes_lista.sort(key=lambda x: (x["pontos_disciplinar"], -x["cartoes_vermelhos"], -x["cartoes_amarelos"], (x["nome_equipe"] or "").lower()))

    return {
        "id_competicao": id_competicao,
        "nome_competicao": competicao.nome,
        "total_amarelos": total_amarelos,
        "total_vermelhos": total_vermelhos,
        "jogadores": jogadores_lista,
        "equipes": equipes_lista,
        "suspensos": suspensos,
    }
