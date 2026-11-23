"""Motor puro de cálculo de classificação esportiva e desempates."""

from collections import defaultdict
from itertools import combinations
from typing import Any

from competicoes.contratos.classificacao import LinhaClassificacao


def _extrair_gols(partida: dict) -> tuple[int, int]:
    """Extrai os gols do mandante e visitante de uma partida."""
    if "gols_mandante" in partida and partida["gols_mandante"] is not None:
        gm = int(partida["gols_mandante"])
        gv = int(partida.get("gols_visitante", 0) or 0)
        return gm, gv
    if "placar_mandante" in partida and partida["placar_mandante"] is not None:
        pm = int(partida["placar_mandante"])
        pv = int(partida.get("placar_visitante", 0) or 0)
        return pm, pv
    placar = partida.get("placar")
    if placar is not None:
        if isinstance(placar, dict):
            return int(placar.get("mandante", 0)), int(placar.get("visitante", 0))
        if hasattr(placar, "mandante") and hasattr(placar, "visitante"):
            return int(placar.mandante), int(placar.visitante)
    if "ocorrencias" in partida and isinstance(partida["ocorrencias"], list):
        id_m = partida.get("id_equipe_mandante")
        id_v = partida.get("id_equipe_visitante")
        gm = sum(
            1 for oc in partida["ocorrencias"]
            if oc.get("tipo") in ("GOL", "GOL_CONTRA") and oc.get("id_equipe_beneficiada") == id_m
        )
        gv = sum(
            1 for oc in partida["ocorrencias"]
            if oc.get("tipo") in ("GOL", "GOL_CONTRA") and oc.get("id_equipe_beneficiada") == id_v
        )
        return gm, gv
    return 0, 0


def _extrair_equipe_info(eq: dict | Any) -> tuple[int, str]:
    """Extrai id e nome da equipe suportando dicts e objetos."""
    if isinstance(eq, dict):
        eq_id = eq.get("id_equipe") or eq.get("id")
        nome = eq.get("nome_equipe") or eq.get("nome") or f"Equipe {eq_id}"
    else:
        eq_id = getattr(eq, "id_equipe", None) or getattr(eq, "id", None)
        nome = getattr(eq, "nome_equipe", None) or getattr(eq, "nome", None) or f"Equipe {eq_id}"
    return int(eq_id), str(nome)


def _todas_partidas_mutuas_finalizadas(
    tied_ids: set[int],
    partidas: list[dict],
) -> tuple[bool, list[dict]]:
    """Verifica se todos os confrontos diretos entre as equipes empatadas foram finalizados."""
    jogos_entre = [
        p for p in partidas
        if p.get("id_equipe_mandante") in tied_ids and p.get("id_equipe_visitante") in tied_ids
    ]
    if not jogos_entre:
        return False, []

    # Qualquer partida agendada ou em andamento impede o critério
    for p in jogos_entre:
        estado = str(p.get("estado", "")).upper()
        if estado != "FINALIZADA":
            return False, []

    # Verificar se cada par distinto de equipes disputou ao menos 1 partida entre si
    pares_jogados: set[tuple[int, int]] = set()
    for p in jogos_entre:
        m = p.get("id_equipe_mandante")
        v = p.get("id_equipe_visitante")
        pares_jogados.add((min(m, v), max(m, v)))

    for u, v in combinations(sorted(tied_ids), 2):
        if (min(u, v), max(u, v)) not in pares_jogados:
            return False, []

    return True, jogos_entre


def _aplicar_confronto_direto(
    tied_ids_list: list[int],
    partidas: list[dict],
    pts_cfg: dict[str, int],
) -> list[list[int]]:
    """Calcula a mini-tabela entre as equipes empatadas e particiona por PTS, Saldo e GP na mini-tabela."""
    tied_ids = set(tied_ids_list)
    valido, jogos_entre = _todas_partidas_mutuas_finalizadas(tied_ids, partidas)
    if not valido:
        # Se os jogos não estiverem finalizados, o empate se mantém intacto
        return [tied_ids_list]

    pts_vitoria = pts_cfg["vitoria"]
    pts_empate = pts_cfg["empate"]
    pts_derrota = pts_cfg["derrota"]

    mini_stats: dict[int, dict[str, int]] = {
        tid: {"pontos": 0, "gp": 0, "gc": 0} for tid in tied_ids
    }

    for p in jogos_entre:
        m = p.get("id_equipe_mandante")
        v = p.get("id_equipe_visitante")
        gm, gv = _extrair_gols(p)
        mini_stats[m]["gp"] += gm
        mini_stats[m]["gc"] += gv
        mini_stats[v]["gp"] += gv
        mini_stats[v]["gc"] += gm
        if gm > gv:
            mini_stats[m]["pontos"] += pts_vitoria
            mini_stats[v]["pontos"] += pts_derrota
        elif gv > gm:
            mini_stats[v]["pontos"] += pts_vitoria
            mini_stats[m]["pontos"] += pts_derrota
        else:
            mini_stats[m]["pontos"] += pts_empate
            mini_stats[v]["pontos"] += pts_empate

    sub_map: dict[tuple[int, int, int], list[int]] = defaultdict(list)
    for tid in tied_ids_list:
        p = mini_stats[tid]["pontos"]
        sg = mini_stats[tid]["gp"] - mini_stats[tid]["gc"]
        gp = mini_stats[tid]["gp"]
        sub_map[(p, sg, gp)].append(tid)

    return [sub_map[k] for k in sorted(sub_map.keys(), reverse=True)]


def _valor_criterio(
    crit: str,
    id_eq: int,
    stats: dict[int, dict[str, Any]],
    cartoes_por_equipe: dict[int, dict[str, int]] | None = None,
) -> int | None:
    if crit == "VITORIAS":
        return int(stats[id_eq]["vitorias"])
    if crit == "SALDO_GOLS":
        return int(stats[id_eq]["saldo_gols"])
    if crit == "GOLS_PRO":
        return int(stats[id_eq]["gols_pro"])
    if crit == "MENOS_CARTOES_VERMELHOS":
        return -int((cartoes_por_equipe or {}).get(id_eq, {}).get("vermelhos", 0))
    if crit == "MENOS_CARTOES_AMARELOS":
        return -int((cartoes_por_equipe or {}).get(id_eq, {}).get("amarelos", 0))
    return None


def calcular_classificacao(
    equipes: list[dict | Any],
    partidas: list[dict | Any],
    configuracao_pontos: dict | None = None,
    ordem_desempates: list[str] | None = None,
    cartoes_por_equipe: dict[int, dict[str, int]] | None = None,
    decisoes_manuais: list[dict | Any] | None = None,
) -> list[LinhaClassificacao]:
    """Calcula deterministamente a tabela de classificação esportiva.

    - Ordenação primária: Pontos (PTS) DESC.
    - Critérios de desempate configuráveis (padrão: VITORIAS, SALDO_GOLS, GOLS_PRO, CONFRONTO_DIRETO).
    - Suporta MENOS_CARTOES_VERMELHOS e MENOS_CARTOES_AMARELOS via cartoes_por_equipe.
    - Confronto direto utiliza mini-tabela entre as equipes empatadas.
    - Empate persistente pode ser resolvido por decisão manual válida (decisoes_manuais).
    - Empate persistente não resolvido sinalizado explicitamente com empate_persistente=True sem desempate fictício por ID.
    """
    pts_cfg = {"vitoria": 3, "empate": 1, "derrota": 0}
    if configuracao_pontos:
        pts_cfg.update(configuracao_pontos)

    criterios = (
        ordem_desempates
        if ordem_desempates is not None
        else ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"]
    )
    criterios_normalizados = [
        c.value.upper() if hasattr(c, "value") else str(c).upper() for c in criterios
    ]

    # Inicializar estatísticas de todas as equipes informadas
    equipes_map: dict[int, str] = {}
    stats: dict[int, dict[str, Any]] = {}
    ordem_original: list[int] = []

    for eq in equipes:
        eq_id, nome = _extrair_equipe_info(eq)
        equipes_map[eq_id] = nome
        ordem_original.append(eq_id)
        stats[eq_id] = {
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

    # Computar partidas finalizadas
    for p in partidas:
        p_dict = p if isinstance(p, dict) else p.__dict__
        estado = str(p_dict.get("estado", "")).upper()
        if estado != "FINALIZADA":
            continue

        m = p_dict.get("id_equipe_mandante")
        v = p_dict.get("id_equipe_visitante")
        gm, gv = _extrair_gols(p_dict)

        if m in stats:
            stats[m]["jogos"] += 1
            stats[m]["gols_pro"] += gm
            stats[m]["gols_contra"] += gv
            if gm > gv:
                stats[m]["vitorias"] += 1
                stats[m]["pontos"] += pts_cfg["vitoria"]
            elif gm == gv:
                stats[m]["empates"] += 1
                stats[m]["pontos"] += pts_cfg["empate"]
            else:
                stats[m]["derrotas"] += 1
                stats[m]["pontos"] += pts_cfg["derrota"]

        if v in stats:
            stats[v]["jogos"] += 1
            stats[v]["gols_pro"] += gv
            stats[v]["gols_contra"] += gm
            if gv > gm:
                stats[v]["vitorias"] += 1
                stats[v]["pontos"] += pts_cfg["vitoria"]
            elif gv == gm:
                stats[v]["empates"] += 1
                stats[v]["pontos"] += pts_cfg["empate"]
            else:
                stats[v]["derrotas"] += 1
                stats[v]["pontos"] += pts_cfg["derrota"]

    pts_vit = pts_cfg["vitoria"]
    for eq_id, s in stats.items():
        s["saldo_gols"] = s["gols_pro"] - s["gols_contra"]
        if s["jogos"] > 0 and pts_vit > 0:
            max_pts = s["jogos"] * pts_vit
            s["aproveitamento"] = round((s["pontos"] / max_pts) * 100.0, 2)
        else:
            s["aproveitamento"] = 0.0

    # Particionamento primário por PONTOS (DESC)
    sub_map_pts: dict[int, list[int]] = defaultdict(list)
    for eq_id in ordem_original:
        sub_map_pts[stats[eq_id]["pontos"]].append(eq_id)

    buckets: list[list[int]] = [
        sub_map_pts[pt] for pt in sorted(sub_map_pts.keys(), reverse=True)
    ]

    # Particionamento sucessivo pelos critérios de desempate
    partidas_dicts = [p if isinstance(p, dict) else p.__dict__ for p in partidas]

    for crit in criterios_normalizados:
        novos_buckets: list[list[int]] = []
        for b in buckets:
            if len(b) <= 1:
                novos_buckets.append(b)
                continue

            if crit == "CONFRONTO_DIRETO":
                sub_h2h = _aplicar_confronto_direto(b, partidas_dicts, pts_cfg)
                novos_buckets.extend(sub_h2h)
            else:
                primeiro_val = _valor_criterio(crit, b[0], stats, cartoes_por_equipe)
                if primeiro_val is not None:
                    sub: dict[int, list[int]] = defaultdict(list)
                    for tid in b:
                        val = _valor_criterio(crit, tid, stats, cartoes_por_equipe)
                        sub[int(val)].append(tid)
                    for val in sorted(sub.keys(), reverse=True):
                        novos_buckets.append(sub[val])
                else:
                    # Critério desconhecido é preservado sem alterar ordenação
                    novos_buckets.append(b)

        buckets = novos_buckets

    # Aplicar decisões manuais válidas em blocos que permaneceram empatados
    if decisoes_manuais:
        buckets_resolvidos: list[list[int]] = []
        for b in buckets:
            if len(b) > 1:
                bloco_ordenado = sorted(int(x) for x in b)
                decisao_aplicada = None
                for d in decisoes_manuais:
                    valida = d.get("valida", True) if isinstance(d, dict) else getattr(d, "valida", True)
                    if valida is not True:
                        continue
                    conjunto = d.get("conjunto_equipes", []) if isinstance(d, dict) else getattr(d, "conjunto_equipes", [])
                    ordem = d.get("ordem_escolhida", []) if isinstance(d, dict) else getattr(d, "ordem_escolhida", [])
                    conjunto_int = [int(x) for x in (conjunto or [])]
                    ordem_int = [int(x) for x in (ordem or [])]
                    if (
                        len(ordem_int) == len(bloco_ordenado)
                        and len(set(ordem_int)) == len(bloco_ordenado)
                        and sorted(conjunto_int) == bloco_ordenado
                        and sorted(ordem_int) == bloco_ordenado
                    ):
                        decisao_aplicada = ordem_int
                        break
                if decisao_aplicada is not None:
                    for eq_id in decisao_aplicada:
                        buckets_resolvidos.append([eq_id])
                else:
                    buckets_resolvidos.append(b)
            else:
                buckets_resolvidos.append(b)
        buckets = buckets_resolvidos

    # Construção das linhas com atribuição de posição e indicação de empate persistente
    linhas: list[LinhaClassificacao] = []
    current_pos = 1

    for b in buckets:
        # Sem jogo disputado não há empate a resolver (DF-RT12-11).
        is_tied = len(b) > 1 and all(stats[tid]["jogos"] > 0 for tid in b)
        for tid in b:
            s = stats[tid]
            linhas.append(
                LinhaClassificacao(
                    posicao=current_pos,
                    id_equipe=tid,
                    nome_equipe=equipes_map[tid],
                    jogos=s["jogos"],
                    vitorias=s["vitorias"],
                    empates=s["empates"],
                    derrotas=s["derrotas"],
                    gols_pro=s["gols_pro"],
                    gols_contra=s["gols_contra"],
                    saldo_gols=s["saldo_gols"],
                    pontos=s["pontos"],
                    aproveitamento=s["aproveitamento"],
                    empate_persistente=is_tied,
                )
            )
        current_pos += len(b)

    return linhas
