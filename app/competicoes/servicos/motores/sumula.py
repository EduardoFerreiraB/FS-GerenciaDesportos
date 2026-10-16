"""Motor puro e determinístico de súmula, derivação de cartões, artilharia e travas de grafo."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from competicoes.contratos.sumula import ArtilheiroDetalhe, TabelaArtilhariaDetalhe
from competicoes.erros import ConfiguracaoInvalida


def _get(obj: dict | Any, campo: str, padrao: Any = None) -> Any:
    """Extrai atributo ou chave de dicionário de forma uniforme."""
    if isinstance(obj, dict):
        return obj.get(campo, padrao)
    return getattr(obj, campo, padrao)


def resolver_equipe_beneficiada(
    tipo: str,
    id_equipe_informada: int,
    id_integrante: int | None,
    id_equipe_integrante: int | None,
    id_mandante: int,
    id_visitante: int,
) -> int:
    """Determina a equipe beneficiada por uma ocorrência e valida vínculos com a partida.

    - Em GOL normal sem autor, beneficia id_equipe_informada.
    - Em GOL normal com autor, beneficia id_equipe_integrante (que deve coincidir com id_equipe_informada).
    - Em GOL_CONTRA, exige integrante e beneficia obrigatoriamente a equipe adversária.
    - Em cartões (CARTAO_AMARELO, CARTAO_VERMELHO_DIRETO), exige integrante e retorna sua equipe.
    """
    participantes = (id_mandante, id_visitante)
    if id_equipe_informada not in participantes:
        raise ConfiguracaoInvalida(
            "A equipe informada não participa desta partida.",
            campos=["id_equipe"],
        )

    if id_integrante is not None and id_equipe_integrante not in participantes:
        raise ConfiguracaoInvalida(
            "O integrante informado não pertence às equipes desta partida.",
            campos=["id_integrante"],
        )

    if tipo in ("CARTAO_AMARELO", "CARTAO_VERMELHO_DIRETO", "GOL_CONTRA") and id_integrante is None:
        raise ConfiguracaoInvalida(
            "Este tipo de ocorrência exige um integrante identificado.",
            campos=["id_integrante"],
        )

    if tipo == "GOL":
        if id_integrante is not None:
            if id_equipe_informada != id_equipe_integrante:
                raise ConfiguracaoInvalida(
                    "Em gol normal, o integrante deve pertencer à equipe beneficiada.",
                    campos=["id_integrante"],
                )
            return int(id_equipe_integrante)  # type: ignore[arg-type]
        return int(id_equipe_informada)

    if tipo == "GOL_CONTRA":
        return int(id_visitante if id_equipe_integrante == id_mandante else id_mandante)

    if tipo in ("CARTAO_AMARELO", "CARTAO_VERMELHO_DIRETO", "EXPULSAO_SEGUNDO_AMARELO"):
        if id_equipe_integrante is not None:
            return int(id_equipe_integrante)
        return int(id_equipe_informada)

    raise ConfiguracaoInvalida("Tipo de ocorrência inválido.", campos=["tipo"])


def avaliar_derivacao_segundo_amarelo(
    ocorrencias_partida: list[dict | Any],
    tipo_novo: str,
    id_integrante: int | None,
) -> bool:
    """Avalia se o lançamento de um cartão amarelo deve derivar expulsão por 2º amarelo.

    - 1º amarelo: retorna False.
    - 2º amarelo: retorna True (deve gerar EXPULSAO_SEGUNDO_AMARELO derivada).
    - 3º amarelo (ou se já possui EXPULSAO_SEGUNDO_AMARELO): levanta ConfiguracaoInvalida.
    """
    if tipo_novo != "CARTAO_AMARELO" or id_integrante is None:
        return False

    amarelos = 0
    expulsoes_segundo_amarelo = 0

    for oc in ocorrencias_partida:
        if _get(oc, "id_integrante") != id_integrante:
            continue
        tipo_oc = _get(oc, "tipo")
        if tipo_oc == "CARTAO_AMARELO":
            amarelos += 1
        elif tipo_oc == "EXPULSAO_SEGUNDO_AMARELO":
            expulsoes_segundo_amarelo += 1

    if expulsoes_segundo_amarelo > 0 or amarelos >= 2:
        raise ConfiguracaoInvalida(
            "Integrante já recebeu dois cartões amarelos nesta partida.",
            campos=["id_integrante"],
        )

    return amarelos == 1


def validar_ajuste_resultado_simples(
    ocorrencias_partida: list[dict | Any],
    id_mandante: int,
    id_visitante: int,
    novos_gols_mandante: int,
    novos_gols_visitante: int,
) -> dict[str, Any]:
    """Valida o ajuste de placar simples preservando gols com autoria, gols contra e cartões."""
    fixos_mandante = 0
    fixos_visitante = 0
    ids_gols_sem_autoria_remover: list[int] = []

    for oc in ocorrencias_partida:
        tipo = _get(oc, "tipo")
        id_int = _get(oc, "id_integrante")
        eq_ben = _get(oc, "id_equipe_beneficiada")
        id_oc = _get(oc, "id_ocorrencia")

        if (tipo == "GOL" and id_int is not None) or tipo == "GOL_CONTRA":
            if eq_ben == id_mandante:
                fixos_mandante += 1
            elif eq_ben == id_visitante:
                fixos_visitante += 1
        elif tipo == "GOL" and id_int is None:
            if id_oc is not None:
                ids_gols_sem_autoria_remover.append(int(id_oc))

    if novos_gols_mandante < fixos_mandante or novos_gols_visitante < fixos_visitante:
        raise ConfiguracaoInvalida(
            "O placar simples não pode ser menor que os gols com autoria ou gols contra já registrados na súmula.",
            campos=["gols_mandante", "gols_visitante"],
        )

    return {
        "gols_sem_autoria_mandante": novos_gols_mandante - fixos_mandante,
        "gols_sem_autoria_visitante": novos_gols_visitante - fixos_visitante,
        "ids_gols_sem_autoria_remover": ids_gols_sem_autoria_remover,
    }


def calcular_artilharia(
    id_edicao_competicao: int,
    ocorrencias: list[dict | Any],
    partidas: list[dict | Any],
    integrantes: dict[int, dict | Any],
) -> TabelaArtilhariaDetalhe:
    """Calcula a tabela de artilharia da edição.

    - Ignora partidas CANCELADA (e AGENDADA).
    - Contabiliza apenas tipo == 'GOL' com id_integrante is not None (exclui GOL_CONTRA e sem autor).
    - Sinaliza possui_jogos_em_andamento e separa gols totais e gols_em_andamento.
    - Ordena por (-gols, nome_esportivo, id_integrante).
    """
    estado_por_partida: dict[int, str] = {}
    for p in partidas:
        id_p = _get(p, "id_partida")
        if id_p is not None:
            estado_por_partida[int(id_p)] = str(_get(p, "estado", "FINALIZADA")).upper()

    possui_jogos_em_andamento = any(
        est == "EM_ANDAMENTO" for est in estado_por_partida.values()
    )

    gols_totais: dict[int, int] = defaultdict(int)
    gols_andamento: dict[int, int] = defaultdict(int)

    for oc in ocorrencias:
        tipo = _get(oc, "tipo")
        id_int = _get(oc, "id_integrante")
        id_p = _get(oc, "id_partida")

        if tipo != "GOL" or id_int is None:
            continue

        estado = estado_por_partida.get(int(id_p), "FINALIZADA") if id_p is not None else "FINALIZADA"
        if estado in ("CANCELADA", "AGENDADA"):
            continue

        id_int_int = int(id_int)
        gols_totais[id_int_int] += 1
        if estado == "EM_ANDAMENTO":
            gols_andamento[id_int_int] += 1

    candidatos: list[tuple[int, str, int, dict[str, Any]]] = []
    for id_int, total in gols_totais.items():
        if total <= 0 or id_int not in integrantes:
            continue
        info = integrantes[id_int]
        nome_esportivo = str(
            _get(info, "nome_esportivo") or _get(info, "nome") or f"Integrante {id_int}"
        )
        id_competidor = int(_get(info, "id_competidor") or id_int)
        numero_camisa = _get(info, "numero_camisa")
        id_equipe = int(_get(info, "id_equipe") or 0)
        nome_equipe = str(
            _get(info, "nome_equipe") or _get(info, "equipe") or f"Equipe {id_equipe}"
        )
        candidatos.append(
            (
                -total,
                nome_esportivo,
                id_int,
                {
                    "id_integrante": id_int,
                    "id_competidor": id_competidor,
                    "nome_esportivo": nome_esportivo,
                    "numero_camisa": numero_camisa,
                    "id_equipe": id_equipe,
                    "nome_equipe": nome_equipe,
                    "gols": total,
                    "gols_em_andamento": gols_andamento.get(id_int, 0),
                },
            )
        )

    candidatos.sort(key=lambda item: (item[0], item[1], item[2]))

    artilheiros = [
        ArtilheiroDetalhe(posicao=idx, **item[3])
        for idx, item in enumerate(candidatos, start=1)
    ]

    return TabelaArtilhariaDetalhe(
        id_edicao_competicao=id_edicao_competicao,
        possui_jogos_em_andamento=possui_jogos_em_andamento,
        artilheiros=artilheiros,
    )


def _partida_ja_iniciou(partida: dict | Any) -> bool:
    """Verifica se uma partida já foi iniciada, finalizada ou possui ocorrências lançadas."""
    estado = str(_get(partida, "estado", "AGENDADA")).upper()
    tem_oc = bool(_get(partida, "tem_ocorrencias", False)) or bool(
        _get(partida, "ocorrencias")
    )
    return estado in ("EM_ANDAMENTO", "FINALIZADA") or tem_oc


def analisar_impacto_reabertura(
    duelos: list[dict | Any],
    vagas: list[dict | Any],
    partidas: list[dict | Any],
    id_partida_alvo: int | None = None,
    reabrir_grupos: bool = False,
) -> dict[str, Any]:
    """Analisa transitivamente o impacto no grafo de duelos e vagas ao reabrir partida ou grupos."""
    duelos_map: dict[int, dict | Any] = {}
    todas_vagas_map: dict[int, dict | Any] = {}
    todas_partidas_map: dict[int, dict | Any] = {}

    for d in duelos:
        id_d = _get(d, "id_duelo")
        if id_d is not None:
            duelos_map[int(id_d)] = d
        vagas_aninhadas = _get(d, "vagas")
        if isinstance(vagas_aninhadas, list):
            for v in vagas_aninhadas:
                id_v = _get(v, "id_vaga")
                if id_v is not None:
                    todas_vagas_map[int(id_v)] = v
        partidas_aninhadas = _get(d, "partidas")
        if isinstance(partidas_aninhadas, list):
            for p in partidas_aninhadas:
                id_p = _get(p, "id_partida")
                if id_p is not None:
                    todas_partidas_map[int(id_p)] = p

    for v in vagas:
        id_v = _get(v, "id_vaga")
        if id_v is not None:
            todas_vagas_map[int(id_v)] = v

    for p in partidas:
        id_p = _get(p, "id_partida")
        if id_p is not None:
            todas_partidas_map[int(id_p)] = p

    todas_vagas = list(todas_vagas_map.values())
    todas_partidas = list(todas_partidas_map.values())

    ids_duelos_afetados: set[int] = set()
    ids_vagas_afetadas: set[int] = set()
    fila_duelos: list[int] = []

    if reabrir_grupos:
        for v in todas_vagas:
            if _get(v, "origem") == "POSICAO_GRUPO":
                id_v = _get(v, "id_vaga")
                id_d = _get(v, "id_duelo")
                if id_v is not None:
                    ids_vagas_afetadas.add(int(id_v))
                if id_d is not None and int(id_d) not in ids_duelos_afetados:
                    ids_duelos_afetados.add(int(id_d))
                    fila_duelos.append(int(id_d))

    elif id_partida_alvo is not None:
        partida_alvo = todas_partidas_map.get(int(id_partida_alvo))
        if partida_alvo is None:
            return {
                "bloqueado": False,
                "motivo": None,
                "ids_duelos_afetados": set(),
                "ids_vagas_afetadas": set(),
                "ids_partidas_remover": set(),
            }

        id_duelo_alvo = _get(partida_alvo, "id_duelo")
        if id_duelo_alvo is None:
            # Partida de grupo ou pontos corridos
            grupos_encerrados = any(
                _get(v, "origem") == "POSICAO_GRUPO"
                and _get(v, "id_equipe_resolvida") is not None
                for v in todas_vagas
            )
            if grupos_encerrados:
                return {
                    "bloqueado": True,
                    "motivo": "A fase de grupos já foi encerrada e avançou equipes para o mata-mata. Reabra a fase de grupos antes de reabrir esta partida.",
                    "ids_duelos_afetados": set(),
                    "ids_vagas_afetadas": set(),
                    "ids_partidas_remover": set(),
                }
            return {
                "bloqueado": False,
                "motivo": None,
                "ids_duelos_afetados": set(),
                "ids_vagas_afetadas": set(),
                "ids_partidas_remover": set(),
            }

        id_duelo_int = int(id_duelo_alvo)
        duelo_alvo = duelos_map.get(id_duelo_int)
        ordem_jogo = int(_get(partida_alvo, "ordem_jogo", 1) or 1)
        is_ida_volta = bool(_get(duelo_alvo, "ida_volta", False)) if duelo_alvo is not None else False

        if ordem_jogo == 1:
            partidas_volta = [
                p
                for p in todas_partidas
                if _get(p, "id_duelo") == id_duelo_int
                and int(_get(p, "ordem_jogo", 1) or 1) == 2
            ]
            if is_ida_volta or partidas_volta:
                if any(_partida_ja_iniciou(p2) for p2 in partidas_volta):
                    return {
                        "bloqueado": True,
                        "motivo": "O jogo de volta deste confronto já foi iniciado ou finalizado.",
                        "ids_duelos_afetados": set(),
                        "ids_vagas_afetadas": set(),
                        "ids_partidas_remover": set(),
                    }

        fila_duelos.append(id_duelo_int)

    # Caminhada transitiva pelo grafo de vagas (VENCEDOR_DUELO e PERDEDOR_DUELO)
    while fila_duelos:
        atual_duelo_id = fila_duelos.pop(0)
        for v in todas_vagas:
            origem = _get(v, "origem")
            duelo_origem = _get(v, "id_duelo_origem")
            if (
                duelo_origem == atual_duelo_id
                and origem in ("VENCEDOR_DUELO", "PERDEDOR_DUELO")
            ):
                id_v = _get(v, "id_vaga")
                id_d_filho = _get(v, "id_duelo")
                if id_v is not None:
                    ids_vagas_afetadas.add(int(id_v))
                if id_d_filho is not None and int(id_d_filho) not in ids_duelos_afetados:
                    ids_duelos_afetados.add(int(id_d_filho))
                    fila_duelos.append(int(id_d_filho))

    bloqueado = False
    motivo: str | None = None
    ids_partidas_remover: set[int] = set()

    for p in todas_partidas:
        id_d_part = _get(p, "id_duelo")
        if id_d_part is None or int(id_d_part) not in ids_duelos_afetados:
            continue
        id_p = _get(p, "id_partida")
        if _partida_ja_iniciou(p):
            bloqueado = True
            motivo = "Confronto eliminatório subsequente já foi iniciado ou possui ocorrências registradas."
        elif str(_get(p, "estado", "AGENDADA")).upper() == "AGENDADA" and id_p is not None:
            ids_partidas_remover.add(int(id_p))

    return {
        "bloqueado": bloqueado,
        "motivo": motivo,
        "ids_duelos_afetados": ids_duelos_afetados,
        "ids_vagas_afetadas": ids_vagas_afetadas,
        "ids_partidas_remover": ids_partidas_remover,
    }
