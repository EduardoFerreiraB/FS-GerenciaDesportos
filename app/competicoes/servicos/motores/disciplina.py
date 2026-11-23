"""Motor puro determinístico de controle disciplinar, reconciliação de suspensões e hash de resultados."""

from __future__ import annotations

from collections import defaultdict
import hashlib
import json
from typing import Any

from competicoes.erros import ConfiguracaoInvalida, ConflitoEstado
from competicoes.servicos.motores.classificacao import _extrair_gols


def _como_dict(item: dict | Any) -> dict[str, Any]:
    if isinstance(item, dict):
        return item
    if hasattr(item, "model_dump"):
        return item.model_dump()
    return getattr(item, "__dict__", {})


def _obter_campo(item: dict | Any, campo: str, padrao: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(campo, padrao)
    return getattr(item, campo, padrao)


def calcular_sancoes_e_cartoes(
    id_edicao_competicao: int,
    ocorrencias: list[dict | Any],
    partidas: list[dict | Any],
    config_disciplina: dict[str, Any] | Any,
    grupos_encerrados: bool = False,
) -> dict[str, Any]:
    """Calcula sanções automáticas esperadas, estatísticas por integrante e cartões por equipe."""
    cfg = _como_dict(config_disciplina) if config_disciplina is not None else {}

    limite_amarelos: int | None = cfg["limite_amarelos"] if "limite_amarelos" in cfg else 3
    jogos_por_acumulo = int(cfg.get("jogos_por_acumulo") if cfg.get("jogos_por_acumulo") is not None else 1)
    jogos_por_vermelho = int(cfg.get("jogos_por_vermelho") if cfg.get("jogos_por_vermelho") is not None else 1)
    jogos_por_segundo_amarelo = int(
        cfg.get("jogos_por_segundo_amarelo") if cfg.get("jogos_por_segundo_amarelo") is not None else 1
    )
    zerar_amarelos = bool(cfg.get("zerar_amarelos_ao_encerrar_grupos", False))

    partidas_map: dict[int, dict[str, Any]] = {}
    cartoes_por_equipe: dict[int, dict[str, int]] = {}

    for p in partidas:
        p_d = _como_dict(p)
        id_p = int(p_d["id_partida"])
        partidas_map[id_p] = p_d
        for chave_eq in ("id_equipe_mandante", "id_equipe_visitante"):
            id_eq = p_d.get(chave_eq)
            if id_eq is not None and int(id_eq) not in cartoes_por_equipe:
                cartoes_por_equipe[int(id_eq)] = {"amarelos": 0, "vermelhos": 0}

    estatisticas_integrantes: dict[int, dict[str, Any]] = {}
    ocorrencias_por_partida: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for oc in ocorrencias:
        oc_d = _como_dict(oc)
        id_p = oc_d.get("id_partida")
        if id_p is None or int(id_p) not in partidas_map:
            continue
        p_d = partidas_map[int(id_p)]
        estado = str(p_d.get("estado", "")).upper()
        if estado == "CANCELADA" or estado not in ("EM_ANDAMENTO", "FINALIZADA"):
            continue

        ocorrencias_por_partida[int(id_p)].append(oc_d)

        id_eq = oc_d.get("id_equipe_beneficiada") or oc_d.get("id_equipe")
        if id_eq is not None and int(id_eq) not in cartoes_por_equipe:
            cartoes_por_equipe[int(id_eq)] = {"amarelos": 0, "vermelhos": 0}

        id_int = oc_d.get("id_integrante")
        tipo = str(oc_d.get("tipo", "")).upper()
        if id_int is not None and tipo in (
            "CARTAO_AMARELO",
            "CARTAO_VERMELHO_DIRETO",
            "EXPULSAO_SEGUNDO_AMARELO",
        ):
            id_int = int(id_int)
            if id_int not in estatisticas_integrantes:
                estatisticas_integrantes[id_int] = {
                    "id_integrante": id_int,
                    "id_equipe": int(id_eq) if id_eq is not None else None,
                    "amarelos_estatisticos": 0,
                    "amarelos_acumulo_atual": 0,
                    "vermelhos_diretos": 0,
                    "expulsoes_segundo_amarelo": 0,
                }
            elif id_eq is not None and estatisticas_integrantes[id_int].get("id_equipe") is None:
                estatisticas_integrantes[id_int]["id_equipe"] = int(id_eq)

            if tipo == "CARTAO_AMARELO":
                estatisticas_integrantes[id_int]["amarelos_estatisticos"] += 1
            elif tipo == "CARTAO_VERMELHO_DIRETO":
                estatisticas_integrantes[id_int]["vermelhos_diretos"] += 1
            elif tipo == "EXPULSAO_SEGUNDO_AMARELO":
                estatisticas_integrantes[id_int]["expulsoes_segundo_amarelo"] += 1

    partidas_finalizadas = [
        p_d
        for p_d in partidas_map.values()
        if str(p_d.get("estado", "")).upper() == "FINALIZADA"
    ]
    partidas_finalizadas.sort(
        key=lambda p: (
            0 if p.get("id_grupo") is not None else 1,
            p.get("rodada") or 9999,
            p.get("ordem_jogo") or 1,
            int(p["id_partida"]),
        )
    )

    partidas_grupos = [p for p in partidas_finalizadas if p.get("id_grupo") is not None]
    partidas_mata_mata = [p for p in partidas_finalizadas if p.get("id_grupo") is None]

    sancoes_esperadas: list[dict[str, Any]] = []
    saldo_amarelos: dict[int, int] = defaultdict(int)
    ciclos_amarelos: dict[int, int] = defaultdict(int)

    def _processar_partida(p_d: dict[str, Any]) -> None:
        id_p = int(p_d["id_partida"])
        ocs = sorted(
            ocorrencias_por_partida.get(id_p, []),
            key=lambda o: (
                o.get("minuto") if o.get("minuto") is not None else 9999,
                int(o.get("id_ocorrencia") or 0),
            ),
        )

        expulsos_segundo_amarelo: set[int] = {
            int(o["id_integrante"])
            for o in ocs
            if str(o.get("tipo", "")).upper() == "EXPULSAO_SEGUNDO_AMARELO"
            and o.get("id_integrante") is not None
        }

        for o in ocs:
            tipo = str(o.get("tipo", "")).upper()
            id_eq = o.get("id_equipe_beneficiada") or o.get("id_equipe")
            if id_eq is not None:
                id_eq = int(id_eq)
                if id_eq not in cartoes_por_equipe:
                    cartoes_por_equipe[id_eq] = {"amarelos": 0, "vermelhos": 0}
                if tipo == "CARTAO_AMARELO":
                    cartoes_por_equipe[id_eq]["amarelos"] += 1
                elif tipo in ("CARTAO_VERMELHO_DIRETO", "EXPULSAO_SEGUNDO_AMARELO"):
                    cartoes_por_equipe[id_eq]["vermelhos"] += 1

            id_int = o.get("id_integrante")
            if id_int is None:
                continue
            id_int = int(id_int)
            id_oc = o.get("id_ocorrencia")
            id_oc_int = int(id_oc) if id_oc is not None else None

            if tipo == "EXPULSAO_SEGUNDO_AMARELO":
                sancoes_esperadas.append(
                    {
                        "id_edicao_competicao": id_edicao_competicao,
                        "id_integrante": id_int,
                        "id_partida_origem": id_p,
                        "id_ocorrencia_origem": id_oc_int,
                        "origem": "SEGUNDO_AMARELO",
                        "chave_origem": f"ED{id_edicao_competicao}:INT{id_int}:SEG_AMA:OC{id_oc_int}",
                        "jogos": jogos_por_segundo_amarelo,
                        "motivo": "Suspensão automática por expulsão (2º cartão amarelo)",
                        "situacao": "ATIVA",
                    }
                )
            elif tipo == "CARTAO_VERMELHO_DIRETO":
                sancoes_esperadas.append(
                    {
                        "id_edicao_competicao": id_edicao_competicao,
                        "id_integrante": id_int,
                        "id_partida_origem": id_p,
                        "id_ocorrencia_origem": id_oc_int,
                        "origem": "VERMELHO_DIRETO",
                        "chave_origem": f"ED{id_edicao_competicao}:INT{id_int}:VERM_DIR:OC{id_oc_int}",
                        "jogos": jogos_por_vermelho,
                        "motivo": "Suspensão automática por cartão vermelho direto",
                        "situacao": "ATIVA",
                    }
                )
            elif tipo == "CARTAO_AMARELO":
                # Spec 7.4 / Ruling R31: amarelos de partida onde houve expulsão por 2º amarelo não acumulam
                if id_int in expulsos_segundo_amarelo:
                    continue
                if limite_amarelos is not None and limite_amarelos > 0:
                    saldo_amarelos[id_int] += 1
                    if saldo_amarelos[id_int] >= limite_amarelos:
                        ciclos_amarelos[id_int] += 1
                        ciclo = ciclos_amarelos[id_int]
                        saldo_amarelos[id_int] = 0
                        sancoes_esperadas.append(
                            {
                                "id_edicao_competicao": id_edicao_competicao,
                                "id_integrante": id_int,
                                "id_partida_origem": id_p,
                                "id_ocorrencia_origem": id_oc_int,
                                "origem": "ACUMULO_AMARELOS",
                                "chave_origem": f"ED{id_edicao_competicao}:INT{id_int}:ACUM_AMA:CICLO{ciclo}",
                                "jogos": jogos_por_acumulo,
                                "motivo": "Suspensão automática por acúmulo de cartões amarelos",
                                "situacao": "ATIVA",
                            }
                        )

    for p_d in partidas_grupos:
        _processar_partida(p_d)

    if zerar_amarelos and grupos_encerrados:
        for id_int in list(saldo_amarelos.keys()):
            saldo_amarelos[id_int] = 0

    for p_d in partidas_mata_mata:
        _processar_partida(p_d)

    for id_int, est in estatisticas_integrantes.items():
        est["amarelos_acumulo_atual"] = saldo_amarelos.get(id_int, 0)

    return {
        "sancoes_esperadas": sancoes_esperadas,
        "estatisticas_integrantes": estatisticas_integrantes,
        "resumo_por_integrante": estatisticas_integrantes,
        "cartoes_por_equipe": cartoes_por_equipe,
    }


def reconciliar_suspensoes_existentes(
    sancoes_esperadas: list[dict[str, Any]],
    suspensoes_banco: list[dict[str, Any] | Any],
) -> dict[str, list[Any]]:
    """Reconcilia sanções automáticas esperadas com as suspensões já persistidas no banco."""
    esperadas_por_chave: dict[str, dict[str, Any]] = {
        str(s["chave_origem"]): s
        for s in sancoes_esperadas
        if s.get("chave_origem") is not None
    }

    chaves_existentes_ativas: set[str] = set()
    para_revisao: list[Any] = []
    para_cancelar: list[Any] = []

    for susp in suspensoes_banco:
        origem = _obter_campo(susp, "origem")
        if origem == "MANUAL":
            continue

        chave = _obter_campo(susp, "chave_origem")
        situacao = str(_obter_campo(susp, "situacao", "")).upper()

        jogos_cumpridos = _obter_campo(susp, "jogos_cumpridos")
        if jogos_cumpridos is None:
            cumprimentos = _obter_campo(susp, "cumprimentos") or []
            jogos_cumpridos = len(cumprimentos)
        else:
            jogos_cumpridos = int(jogos_cumpridos)

        if chave is not None and str(chave) in esperadas_por_chave:
            if situacao != "CANCELADA":
                chaves_existentes_ativas.add(str(chave))
            continue

        # A suspensão automática não possui mais lastro nas ocorrências das partidas finalizadas
        if situacao == "CANCELADA":
            continue

        if jogos_cumpridos > 0 or situacao == "CUMPRIDA":
            para_revisao.append(susp)
        elif jogos_cumpridos == 0 and situacao == "ATIVA":
            para_cancelar.append(susp)

    para_criar: list[dict[str, Any]] = [
        s
        for s in sancoes_esperadas
        if s.get("chave_origem") is not None and str(s["chave_origem"]) not in chaves_existentes_ativas
    ]

    return {
        "para_criar": para_criar,
        "para_revisao": para_revisao,
        "para_cancelar": para_cancelar,
    }


def validar_elegibilidade_cumprimento(
    suspensao: dict[str, Any] | Any,
    partida: dict[str, Any] | Any,
    id_equipe_integrante: int,
    cumprimentos_existentes_integrante: list[dict[str, Any] | Any],
    participante_atuou_na_partida: bool = False,
) -> None:
    """Valida se uma suspensão ativa pode ser cumprida na partida informada."""
    situacao = str(_obter_campo(suspensao, "situacao", "")).upper()
    if situacao != "ATIVA":
        raise ConflitoEstado(
            "Apenas suspensões ativas podem receber cumprimento.",
            campos=["id_suspensao"],
        )

    jogos = _obter_campo(suspensao, "jogos")
    jogos_cumpridos = _obter_campo(suspensao, "jogos_cumpridos")
    if jogos_cumpridos is None:
        cumprimentos_susp = _obter_campo(suspensao, "cumprimentos")
        if cumprimentos_susp is not None:
            jogos_cumpridos = len(cumprimentos_susp)
    if jogos is not None and jogos_cumpridos is not None and int(jogos_cumpridos) >= int(jogos):
        raise ConflitoEstado(
            "Esta suspensão já teve todos os seus jogos cumpridos.",
            campos=["id_suspensao"],
        )

    estado_partida = str(_obter_campo(partida, "estado", "")).upper()
    if estado_partida != "FINALIZADA":
        raise ConflitoEstado(
            "A suspensão só pode ser cumprida em partida finalizada.",
            campos=["id_partida"],
        )

    id_edicao_susp = _obter_campo(suspensao, "id_edicao_competicao")
    id_edicao_part = _obter_campo(partida, "id_edicao_competicao")
    if (
        id_edicao_susp is not None
        and id_edicao_part is not None
        and int(id_edicao_susp) != int(id_edicao_part)
    ):
        raise ConfiguracaoInvalida(
            "A partida não pertence à mesma edição de competição da suspensão.",
            campos=["id_partida"],
        )

    id_mandante = _obter_campo(partida, "id_equipe_mandante")
    id_visitante = _obter_campo(partida, "id_equipe_visitante")
    if int(id_equipe_integrante) not in (
        int(id_mandante) if id_mandante is not None else -1,
        int(id_visitante) if id_visitante is not None else -1,
    ):
        raise ConfiguracaoInvalida(
            "A partida informada não envolve a equipe do integrante suspenso.",
            campos=["id_partida"],
        )

    id_partida = int(_obter_campo(partida, "id_partida"))
    id_partida_origem = _obter_campo(suspensao, "id_partida_origem")
    if id_partida_origem is not None:
        id_partida_origem = int(id_partida_origem)
        rodada_partida = _obter_campo(partida, "rodada")
        rodada_origem = _obter_campo(suspensao, "rodada_origem")
        if id_partida == id_partida_origem:
            raise ConflitoEstado(
                "A suspensão só pode ser cumprida em partida posterior à sua origem.",
                campos=["id_partida"],
            )
        if rodada_partida is not None and rodada_origem is not None:
            if int(rodada_partida) < int(rodada_origem) or (
                int(rodada_partida) == int(rodada_origem) and id_partida <= id_partida_origem
            ):
                raise ConflitoEstado(
                    "A suspensão só pode ser cumprida em partida posterior à sua origem.",
                    campos=["id_partida"],
                )
        elif id_partida <= id_partida_origem:
            raise ConflitoEstado(
                "A suspensão só pode ser cumprida em partida posterior à sua origem.",
                campos=["id_partida"],
            )

    if any(
        int(_obter_campo(c, "id_partida", -1)) == id_partida
        for c in cumprimentos_existentes_integrante
    ):
        raise ConflitoEstado(
            "Uma partida cumpre no máximo uma suspensão por integrante.",
            campos=["id_partida"],
        )

    if participante_atuou_na_partida:
        raise ConflitoEstado(
            "O integrante possui ocorrência registrada nesta partida; exija revisão ou ajuste disciplinar manual.",
            campos=["id_integrante"],
        )


def calcular_hash_resultados(partidas: list[dict[str, Any] | Any]) -> str:
    """Calcula hash SHA-256 canônico dos placares das partidas finalizadas."""
    finalizadas: list[tuple[int, int, int]] = []
    for p in partidas:
        p_d = _como_dict(p)
        if str(p_d.get("estado", "")).upper() != "FINALIZADA":
            continue
        id_p = int(p_d.get("id_partida") or 0)
        gm, gv = _extrair_gols(p_d)
        finalizadas.append((id_p, gm, gv))

    finalizadas.sort(key=lambda item: item[0])
    payload = json.dumps(finalizadas, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
