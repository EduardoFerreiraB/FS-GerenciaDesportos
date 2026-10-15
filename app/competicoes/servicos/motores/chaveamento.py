"""Motor deterministico puro de chaveamento e geracao de confrontos/tabelas.

Opera sem dependencias de banco de dados ou persistencia, manipulando
identificadores e estruturas tipadas Pydantic.
"""

from competicoes.contratos.disputa import (
    DueloDetalhe,
    PartidaSimples,
    RodadaGerada,
    VagaDueloDetalhe,
)

NOMES_FASES: dict[int, str] = {
    1: "FINAL",
    2: "SEMIFINAL",
    4: "QUARTAS",
    8: "OITAVAS",
    16: "DEZESSEIS_AVOS",
    32: "TRINTA_E_DOIS_AVOS",
    64: "SESSENTA_E_QUATRO_AVOS",
}


def gerar_rodadas_pontos_corridos(
    equipes_ids: list[int], turno_returno: bool = False
) -> list[RodadaGerada]:
    """Gera tabela de pontos corridos usando o algoritmo round-robin do poligono / Berger.

    Se a quantidade de equipes for impar, adiciona folga imaginaria: em cada rodada,
    a equipe pareada com a folga descansa (nenhum jogo ficticio e gerado).
    Se turno_returno for True, gera o dobro de rodadas com inversao estrita de mandos.
    """
    if len(equipes_ids) < 2:
        raise ValueError("Mínimo de 2 equipes para gerar tabela")

    times: list[int | None] = list(equipes_ids)
    if len(times) % 2 != 0:
        times.append(None)

    n = len(times)
    total_rodadas = n - 1
    meio = n // 2

    rodadas_turno: list[RodadaGerada] = []
    t = list(times)

    for r in range(total_rodadas):
        partidas: list[PartidaSimples] = []
        ordem = 1
        for i in range(meio):
            t1 = t[i]
            t2 = t[n - 1 - i]
            if t1 is None or t2 is None:
                continue

            # Balanceamento de mandante e visitante na tabela Berger
            if i == 0:
                mandante, visitante = (t1, t2) if r % 2 == 0 else (t2, t1)
            else:
                mandante, visitante = (t1, t2) if i % 2 == 1 else (t2, t1)

            partidas.append(
                PartidaSimples(
                    id_equipe_mandante=mandante,
                    id_equipe_visitante=visitante,
                    rodada=r + 1,
                    ordem_jogo=ordem,
                )
            )
            ordem += 1

        rodadas_turno.append(RodadaGerada(rodada=r + 1, partidas=partidas))
        # Rotacao Berger: fixa t[0] e desloca os demais
        t = [t[0]] + [t[-1]] + t[1:-1]

    if not turno_returno:
        return rodadas_turno

    rodadas_returno: list[RodadaGerada] = []
    for rodada in rodadas_turno:
        num_rodada = rodada.rodada + total_rodadas
        partidas_rev: list[PartidaSimples] = []
        for p in rodada.partidas:
            partidas_rev.append(
                PartidaSimples(
                    id_equipe_mandante=p.id_equipe_visitante,
                    id_equipe_visitante=p.id_equipe_mandante,
                    rodada=num_rodada,
                    ordem_jogo=p.ordem_jogo,
                    id_grupo=p.id_grupo,
                    nome_grupo=p.nome_grupo,
                    id_duelo=p.id_duelo,
                )
            )
        rodadas_returno.append(RodadaGerada(rodada=num_rodada, partidas=partidas_rev))

    return rodadas_turno + rodadas_returno


def distribuir_equipes_grupos(
    equipes_ids: list[int], nomes_grupos: list[str] | int
) -> dict[str, list[int]]:
    """Distribui uniformemente os IDs de equipes entre os grupos informados."""
    if isinstance(nomes_grupos, int):
        grupos_lista = [f"Grupo {chr(65 + i)}" for i in range(nomes_grupos)]
    else:
        grupos_lista = list(nomes_grupos)

    if len(grupos_lista) < 1:
        raise ValueError("Mínimo de 1 grupo para distribuição")

    if len(equipes_ids) < len(grupos_lista) * 2:
        raise ValueError("Cada grupo deve ter no mínimo 2 equipes")

    grupos: dict[str, list[int]] = {nome: [] for nome in grupos_lista}
    for i, equipe_id in enumerate(equipes_ids):
        nome = grupos_lista[i % len(grupos_lista)]
        grupos[nome].append(equipe_id)

    return grupos


def gerar_tabela_grupos(
    grupos: dict[str, list[int]], turno_returno: bool = False
) -> list[RodadaGerada]:
    """Gera round-robin para cada grupo e agrupa as partidas por rodada geral."""
    rodadas_por_grupo: dict[str, list[RodadaGerada]] = {}
    max_rodadas = 0

    for nome_grupo, times in grupos.items():
        id_grupo_num = int(nome_grupo) if nome_grupo.isdigit() else None
        rodadas_g = gerar_rodadas_pontos_corridos(times, turno_returno=turno_returno)
        for rg in rodadas_g:
            for p in rg.partidas:
                p.nome_grupo = nome_grupo
                p.id_grupo = id_grupo_num
        rodadas_por_grupo[nome_grupo] = rodadas_g
        if len(rodadas_g) > max_rodadas:
            max_rodadas = len(rodadas_g)

    resultado: list[RodadaGerada] = []
    for r in range(1, max_rodadas + 1):
        partidas_rodada: list[PartidaSimples] = []
        ordem = 1
        for nome_grupo in grupos.keys():
            rodadas_g = rodadas_por_grupo[nome_grupo]
            if r <= len(rodadas_g):
                for p in rodadas_g[r - 1].partidas:
                    p_copia = PartidaSimples(
                        id_equipe_mandante=p.id_equipe_mandante,
                        id_equipe_visitante=p.id_equipe_visitante,
                        rodada=r,
                        ordem_jogo=ordem,
                        id_grupo=p.id_grupo,
                        nome_grupo=p.nome_grupo,
                    )
                    partidas_rodada.append(p_copia)
                    ordem += 1
        resultado.append(RodadaGerada(rodada=r, partidas=partidas_rodada))

    return resultado


def _calcular_arvore_fases(capacidade: int) -> list[tuple[str, int]]:
    """Calcula a lista de fases e quantidade de duelos da menor potencia ate a final."""
    fases: list[tuple[str, int]] = []
    qtd = capacidade // 2
    while qtd >= 1:
        nome_fase = NOMES_FASES.get(qtd, f"FASE_{qtd}")
        fases.append((nome_fase, qtd))
        qtd //= 2
    return fases


def _montar_fases_subsequentes(
    duelos_iniciais: list[DueloDetalhe],
    fases_arvore: list[tuple[str, int]],
    ida_volta: bool = False,
    terceiro_lugar: bool = False,
) -> list[DueloDetalhe]:
    """Cria os duelos subsequentes (semifinais, final, 3º lugar) conectados por VENCEDOR_DUELO."""
    todos_duelos = list(duelos_iniciais)

    for p in range(1, len(fases_arvore)):
        nome_fase, qtd = fases_arvore[p]
        nome_fase_anterior, _ = fases_arvore[p - 1]

        for k in range(1, qtd + 1):
            duelo_ant_1 = 2 * k - 1
            duelo_ant_2 = 2 * k

            v1 = VagaDueloDetalhe(
                posicao=1,
                origem="VENCEDOR_DUELO",
                posicao_duelo_origem=duelo_ant_1,
                id_duelo_origem=duelo_ant_1,
                fase_origem=nome_fase_anterior,
            )
            v2 = VagaDueloDetalhe(
                posicao=2,
                origem="VENCEDOR_DUELO",
                posicao_duelo_origem=duelo_ant_2,
                id_duelo_origem=duelo_ant_2,
                fase_origem=nome_fase_anterior,
            )
            duelo = DueloDetalhe(
                fase=nome_fase,
                posicao_chave=k,
                ida_volta=ida_volta,
                vagas=[v1, v2],
            )
            todos_duelos.append(duelo)

    # Disputa de terceiro lugar (apenas quando houve semifinal)
    tem_semifinal = any(nome == "SEMIFINAL" for nome, _ in fases_arvore)
    if terceiro_lugar and tem_semifinal:
        v1_3 = VagaDueloDetalhe(
            posicao=1,
            origem="PERDEDOR_DUELO",
            posicao_duelo_origem=1,
            id_duelo_origem=1,
            fase_origem="SEMIFINAL",
        )
        v2_3 = VagaDueloDetalhe(
            posicao=2,
            origem="PERDEDOR_DUELO",
            posicao_duelo_origem=2,
            id_duelo_origem=2,
            fase_origem="SEMIFINAL",
        )
        duelo_3 = DueloDetalhe(
            fase="TERCEIRO_LUGAR",
            posicao_chave=1,
            ida_volta=ida_volta,
            vagas=[v1_3, v2_3],
        )
        todos_duelos.append(duelo_3)

    return todos_duelos


def gerar_arvore_mata_mata(
    equipes_ids: list[int],
    ida_volta: bool = False,
    terceiro_lugar: bool = False,
) -> list[DueloDetalhe]:
    """Gera arvore eliminatoria deterministica com alocacao de folgas nas primeiras posicoes."""
    if len(equipes_ids) < 2:
        raise ValueError("Mínimo de 2 equipes para mata-mata")

    n = len(equipes_ids)
    capacidade = 2
    while capacidade < n:
        capacidade *= 2

    byes = capacidade - n
    fases = _calcular_arvore_fases(capacidade)
    nome_primeira_fase, qtd_primeira = fases[0]

    duelos_primeira_fase: list[DueloDetalhe] = []
    idx_equipe = 0

    for k in range(1, qtd_primeira + 1):
        if k <= byes:
            vaga1 = VagaDueloDetalhe(
                posicao=1,
                origem="EQUIPE_INICIAL",
                id_equipe=equipes_ids[idx_equipe],
            )
            idx_equipe += 1
            vaga2 = VagaDueloDetalhe(
                posicao=2,
                origem="FOLGA",
                id_equipe=None,
            )
        else:
            vaga1 = VagaDueloDetalhe(
                posicao=1,
                origem="EQUIPE_INICIAL",
                id_equipe=equipes_ids[idx_equipe],
            )
            idx_equipe += 1
            vaga2 = VagaDueloDetalhe(
                posicao=2,
                origem="EQUIPE_INICIAL",
                id_equipe=equipes_ids[idx_equipe],
            )
            idx_equipe += 1

        duelo = DueloDetalhe(
            fase=nome_primeira_fase,
            posicao_chave=k,
            ida_volta=ida_volta,
            vagas=[vaga1, vaga2],
        )
        duelos_primeira_fase.append(duelo)

    return _montar_fases_subsequentes(
        duelos_primeira_fase,
        fases,
        ida_volta=ida_volta,
        terceiro_lugar=terceiro_lugar,
    )


def gerar_cruzamentos_grupos_mata_mata(
    nomes_grupos: list[str],
    classificados_por_grupo: int,
    ida_volta: bool = False,
    terceiro_lugar: bool = False,
) -> list[DueloDetalhe]:
    """Gera duelos da fase eliminatoria a partir da classificacao dos grupos."""
    if len(nomes_grupos) < 2:
        raise ValueError("Mínimo de 2 grupos para cruzamento")
    if classificados_por_grupo < 1:
        raise ValueError("Classificados por grupo deve ser no mínimo 1")

    total_classificados = len(nomes_grupos) * classificados_por_grupo
    capacidade = 2
    while capacidade < total_classificados:
        capacidade *= 2

    if capacidade != total_classificados:
        raise ValueError(
            f"Total de classificados ({total_classificados}) deve ser uma potência de 2"
        )

    fases = _calcular_arvore_fases(capacidade)
    nome_primeira_fase, qtd_primeira = fases[0]

    pares_primeira_fase: list[tuple[str, int, str, int]] = []

    if classificados_por_grupo == 2:
        if len(nomes_grupos) == 2:
            # 2 grupos com 2 classificados: 1ºA x 2ºB, 1ºB x 2ºA
            gA, gB = nomes_grupos[0], nomes_grupos[1]
            pares_primeira_fase = [
                (gA, 1, gB, 2),
                (gB, 1, gA, 2),
            ]
        elif len(nomes_grupos) == 4:
            # 4 grupos com 2 classificados: 1ºA x 2ºB, 1ºC x 2ºD, 1ºB x 2ºA, 1ºD x 2ºC
            gA, gB, gC, gD = nomes_grupos[0], nomes_grupos[1], nomes_grupos[2], nomes_grupos[3]
            pares_primeira_fase = [
                (gA, 1, gB, 2),
                (gC, 1, gD, 2),
                (gB, 1, gA, 2),
                (gD, 1, gC, 2),
            ]
        else:
            # Generalizacao para N grupos pares com 2 classificados
            metade = len(nomes_grupos) // 2
            for i in range(metade):
                g1 = nomes_grupos[2 * i]
                g2 = nomes_grupos[2 * i + 1]
                pares_primeira_fase.append((g1, 1, g2, 2))
            for i in range(metade):
                g1 = nomes_grupos[2 * i]
                g2 = nomes_grupos[2 * i + 1]
                pares_primeira_fase.append((g2, 1, g1, 2))
    elif classificados_por_grupo == 1:
        # 1 classificado por grupo: cruza em pares consecutivos (1ºA x 1ºB, 1ºC x 1ºD, ...)
        for i in range(0, len(nomes_grupos), 2):
            g1 = nomes_grupos[i]
            g2 = nomes_grupos[i + 1]
            pares_primeira_fase.append((g1, 1, g2, 1))
    elif classificados_por_grupo == 4 and len(nomes_grupos) == 2:
        gA, gB = nomes_grupos[0], nomes_grupos[1]
        pares_primeira_fase = [
            (gA, 1, gB, 4),
            (gB, 2, gA, 3),
            (gB, 1, gA, 4),
            (gA, 2, gB, 3),
        ]
    else:
        raise ValueError(
            f"Configuração de cruzamento não suportada para {len(nomes_grupos)} grupos e {classificados_por_grupo} classificados"
        )

    duelos_primeira_fase: list[DueloDetalhe] = []
    for k, (g1, pos1, g2, pos2) in enumerate(pares_primeira_fase, start=1):
        v1 = VagaDueloDetalhe(
            posicao=1,
            origem="POSICAO_GRUPO",
            nome_grupo=g1,
            posicao_grupo=pos1,
        )
        v2 = VagaDueloDetalhe(
            posicao=2,
            origem="POSICAO_GRUPO",
            nome_grupo=g2,
            posicao_grupo=pos2,
        )
        duelo = DueloDetalhe(
            fase=nome_primeira_fase,
            posicao_chave=k,
            ida_volta=ida_volta,
            vagas=[v1, v2],
        )
        duelos_primeira_fase.append(duelo)

    return _montar_fases_subsequentes(
        duelos_primeira_fase,
        fases,
        ida_volta=ida_volta,
        terceiro_lugar=terceiro_lugar,
    )
