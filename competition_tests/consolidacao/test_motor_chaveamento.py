"""Testes unitarios para os contratos de disputa e motor deterministico de chaveamento."""

import pytest

from competicoes.contratos.disputa import (
    DistribuicaoGruposEntrada,
    DueloDetalhe,
    GrupoCriar,
    GrupoDetalhe,
    PartidaSimples,
    RodadaGerada,
    TabelaGeradaResultado,
    VagaDueloDetalhe,
)
from competicoes.servicos.motores.chaveamento import (
    distribuir_equipes_grupos,
    gerar_arvore_mata_mata,
    gerar_cruzamentos_grupos_mata_mata,
    gerar_rodadas_pontos_corridos,
    gerar_tabela_grupos,
)


class TestContratosDisputa:
    """Testa contratos Pydantic do modulo de disputa."""

    def test_grupo_criar(self) -> None:
        grupo = GrupoCriar(nome="Grupo A", ordem=1)
        assert grupo.nome == "Grupo A"
        assert grupo.ordem == 1

    def test_grupo_detalhe(self) -> None:
        detalhe = GrupoDetalhe(id_grupo=10, id_edicao_competicao=1, nome="Grupo B", ordem=2)
        assert detalhe.id_grupo == 10
        assert detalhe.nome == "Grupo B"
        assert detalhe.ordem == 2

    def test_distribuicao_grupos_entrada(self) -> None:
        dados = {"Grupo A": [1, 2, 3], "Grupo B": [4, 5, 6]}
        dist = DistribuicaoGruposEntrada(distribuicao=dados)
        assert dist.distribuicao["Grupo A"] == [1, 2, 3]
        assert dist.distribuicao["Grupo B"] == [4, 5, 6]

    def test_vaga_duelo_detalhe(self) -> None:
        vaga = VagaDueloDetalhe(
            posicao=1,
            origem="EQUIPE_INICIAL",
            id_equipe=42,
        )
        assert vaga.posicao == 1
        assert vaga.origem == "EQUIPE_INICIAL"
        assert vaga.id_equipe == 42
        assert vaga.id_duelo_origem is None

    def test_duelo_detalhe(self) -> None:
        vaga1 = VagaDueloDetalhe(posicao=1, origem="EQUIPE_INICIAL", id_equipe=1)
        vaga2 = VagaDueloDetalhe(posicao=2, origem="EQUIPE_INICIAL", id_equipe=2)
        duelo = DueloDetalhe(
            fase="FINAL",
            posicao_chave=1,
            vagas=[vaga1, vaga2],
        )
        assert duelo.fase == "FINAL"
        assert duelo.posicao_chave == 1
        assert duelo.estado == "PENDENTE"
        assert len(duelo.vagas) == 2

    def test_tabela_gerada_resultado(self) -> None:
        p = PartidaSimples(id_equipe_mandante=1, id_equipe_visitante=2, rodada=1, ordem_jogo=1)
        r = RodadaGerada(rodada=1, partidas=[p])
        tabela = TabelaGeradaResultado(rodadas=[r], duelos=[])
        assert len(tabela.rodadas) == 1
        assert tabela.rodadas[0].partidas[0].id_equipe_mandante == 1


class TestMotorPontosCorridos:
    """Testa round-robin para campeonatos em formato liga."""

    def test_validacao_minimo_equipes(self) -> None:
        with pytest.raises(ValueError, match="Mínimo de 2 equipes"):
            gerar_rodadas_pontos_corridos([1])

    def test_liga_par_4_equipes_turno_unico(self) -> None:
        equipes = [10, 20, 30, 40]
        rodadas = gerar_rodadas_pontos_corridos(equipes, turno_returno=False)

        # 4 equipes -> 3 rodadas
        assert len(rodadas) == 3

        # Cada rodada tem 2 partidas (total 6 jogos)
        todas_partidas: list[PartidaSimples] = []
        confrontos: set[tuple[int, int]] = set()

        for r_idx, rodada in enumerate(rodadas, start=1):
            assert rodada.rodada == r_idx
            assert len(rodada.partidas) == 2
            for p in rodada.partidas:
                assert p.rodada == r_idx
                assert p.id_equipe_mandante != p.id_equipe_visitante
                par = tuple(sorted([p.id_equipe_mandante, p.id_equipe_visitante]))
                confrontos.add(par)
                todas_partidas.append(p)

        assert len(todas_partidas) == 6
        # Todos os pares possiveis (4 * 3 / 2 = 6) devem ter sido jogados exatamente uma vez
        assert len(confrontos) == 6

    def test_liga_impar_5_equipes_com_folgas_reais(self) -> None:
        equipes = [1, 2, 3, 4, 5]
        rodadas = gerar_rodadas_pontos_corridos(equipes, turno_returno=False)

        # 5 equipes -> 5 rodadas no turno
        assert len(rodadas) == 5

        folgas_por_equipe: dict[int, int] = {e: 0 for e in equipes}
        total_jogos = 0
        confrontos: set[tuple[int, int]] = set()

        for r_idx, rodada in enumerate(rodadas, start=1):
            assert rodada.rodada == r_idx
            # Cada rodada deve ter exatamente 2 jogos (4 equipes jogam, 1 descansa)
            assert len(rodada.partidas) == 2
            equipes_jogando = set()
            for p in rodada.partidas:
                equipes_jogando.add(p.id_equipe_mandante)
                equipes_jogando.add(p.id_equipe_visitante)
                par = tuple(sorted([p.id_equipe_mandante, p.id_equipe_visitante]))
                confrontos.add(par)
                total_jogos += 1

            assert len(equipes_jogando) == 4
            folgada = (set(equipes) - equipes_jogando).pop()
            folgas_por_equipe[folgada] += 1

        # Total de jogos: 5 rodadas * 2 = 10 jogos (5 * 4 / 2 = 10)
        assert total_jogos == 10
        assert len(confrontos) == 10

        # Cada equipe folgou exatamente 1 vez
        for e in equipes:
            assert folgas_por_equipe[e] == 1

    def test_turno_e_returno_inversao_estrita_mandos(self) -> None:
        equipes = [1, 2, 3, 4]
        rodadas = gerar_rodadas_pontos_corridos(equipes, turno_returno=True)

        # 4 equipes -> 3 rodadas no turno, 6 no total
        assert len(rodadas) == 6

        turno = rodadas[:3]
        returno = rodadas[3:]

        # Verifica inversao estrita: para cada partida no turno,
        # existe a mesma partida com mandos invertidos no returno
        partidas_turno = [p for r in turno for p in r.partidas]
        partidas_returno = [p for r in returno for p in r.partidas]

        assert len(partidas_turno) == 6
        assert len(partidas_returno) == 6

        for pt in partidas_turno:
            partida_espelho = next(
                (
                    pr
                    for pr in partidas_returno
                    if pr.id_equipe_mandante == pt.id_equipe_visitante
                    and pr.id_equipe_visitante == pt.id_equipe_mandante
                ),
                None,
            )
            assert partida_espelho is not None, f"Partida espelho para {pt} nao encontrada no returno"


class TestDistribuicaoETabelaGrupos:
    """Testa distribuicao uniforme de equipes e geracao de rodadas de grupos."""

    def test_validacao_distribuicao_minimo_equipes(self) -> None:
        with pytest.raises(ValueError, match="no mínimo"):
            distribuir_equipes_grupos([1, 2, 3], ["Grupo A", "Grupo B"])

    def test_distribuicao_8_equipes_em_2_grupos(self) -> None:
        equipes = [1, 2, 3, 4, 5, 6, 7, 8]
        grupos = distribuir_equipes_grupos(equipes, ["Grupo A", "Grupo B"])

        assert len(grupos) == 2
        assert "Grupo A" in grupos
        assert "Grupo B" in grupos
        assert len(grupos["Grupo A"]) == 4
        assert len(grupos["Grupo B"]) == 4

        # Todos os times distribuidos sem repeticao
        uniao = set(grupos["Grupo A"]) | set(grupos["Grupo B"])
        assert uniao == set(equipes)

    def test_gerar_tabela_grupos_agrupa_por_rodada(self) -> None:
        grupos = {
            "Grupo A": [10, 20, 30, 40],
            "Grupo B": [50, 60, 70, 80],
        }
        rodadas = gerar_tabela_grupos(grupos, turno_returno=False)

        # 4 times em cada grupo -> 3 rodadas
        assert len(rodadas) == 3

        for r_idx, r in enumerate(rodadas, start=1):
            assert r.rodada == r_idx
            # 2 jogos do Grupo A + 2 jogos do Grupo B = 4 jogos na rodada
            assert len(r.partidas) == 4
            ordens = [p.ordem_jogo for p in r.partidas]
            assert ordens == [1, 2, 3, 4]


class TestMotorMataMata:
    """Testa geracao deterministica de arvore eliminatoria."""

    def test_validacao_minimo_equipes_mata_mata(self) -> None:
        with pytest.raises(ValueError, match="Mínimo de 2 equipes"):
            gerar_arvore_mata_mata([1])

    def test_arvore_potencia_de_2_8_equipes(self) -> None:
        equipes = [1, 2, 3, 4, 5, 6, 7, 8]
        duelos = gerar_arvore_mata_mata(equipes, ida_volta=False, terceiro_lugar=False)

        # 8 equipes -> 4 Quartas, 2 Semis, 1 Final = 7 duelos
        assert len(duelos) == 7

        quartas = [d for d in duelos if d.fase == "QUARTAS"]
        semis = [d for d in duelos if d.fase == "SEMIFINAL"]
        finais = [d for d in duelos if d.fase == "FINAL"]

        assert len(quartas) == 4
        assert len(semis) == 2
        assert len(finais) == 1

        # Nenhuma folga em potencia de 2
        for q in quartas:
            for v in q.vagas:
                assert v.origem == "EQUIPE_INICIAL"
                assert v.id_equipe is not None

        # Semis apontam para quartas
        for s in semis:
            for v in s.vagas:
                assert v.origem == "VENCEDOR_DUELO"
                assert v.id_duelo_origem is not None

    def test_arvore_nao_potencia_de_2_6_equipes_com_folgas(self) -> None:
        equipes = [10, 20, 30, 40, 50, 60]
        duelos = gerar_arvore_mata_mata(equipes, ida_volta=False, terceiro_lugar=False)

        # 6 equipes -> chave de 8: 4 quartas, 2 semis, 1 final = 7 duelos
        assert len(duelos) == 7

        quartas = [d for d in duelos if d.fase == "QUARTAS"]
        assert len(quartas) == 4

        # Byes = 8 - 6 = 2 folgas na primeira fase
        vagas_folga = [v for q in quartas for v in q.vagas if v.origem == "FOLGA"]
        assert len(vagas_folga) == 2

        # Folgas alocadas nas primeiras posicoes de chave
        assert any(v.origem == "FOLGA" for v in quartas[0].vagas)
        assert any(v.origem == "FOLGA" for v in quartas[1].vagas)
        assert not any(v.origem == "FOLGA" for v in quartas[2].vagas)
        assert not any(v.origem == "FOLGA" for v in quartas[3].vagas)

    def test_terceiro_lugar_com_semifinais(self) -> None:
        equipes = [1, 2, 3, 4]
        duelos = gerar_arvore_mata_mata(equipes, terceiro_lugar=True)

        # 4 equipes -> 2 Semis, 1 Final, 1 Terceiro Lugar = 4 duelos
        assert len(duelos) == 4
        disputa_3 = [d for d in duelos if d.fase == "TERCEIRO_LUGAR"]
        assert len(disputa_3) == 1
        d3 = disputa_3[0]
        assert len(d3.vagas) == 2
        for v in d3.vagas:
            assert v.origem == "PERDEDOR_DUELO"

    def test_terceiro_lugar_ignorado_quando_nao_ha_semifinais(self) -> None:
        # Com 2 equipes só há final; nao deve criar disputa de 3º lugar
        duelos = gerar_arvore_mata_mata([1, 2], terceiro_lugar=True)
        assert len(duelos) == 1
        assert duelos[0].fase == "FINAL"


class TestCruzamentoGruposMataMata:
    """Testa cruzamentos matematicos entre classificados de grupos e eliminatorias."""

    def test_cruzamento_2_grupos_2_classificados(self) -> None:
        duelos = gerar_cruzamentos_grupos_mata_mata(["Grupo A", "Grupo B"], classificados_por_grupo=2)

        # 4 classificados -> 2 Semis e 1 Final
        semis = [d for d in duelos if d.fase == "SEMIFINAL"]
        final = [d for d in duelos if d.fase == "FINAL"]

        assert len(semis) == 2
        assert len(final) == 1

        # Semi 1: 1ºA x 2ºB
        s1 = semis[0]
        assert s1.posicao_chave == 1
        assert s1.vagas[0].origem == "POSICAO_GRUPO"
        assert s1.vagas[0].posicao_grupo == 1
        assert s1.vagas[0].nome_grupo == "Grupo A"
        assert s1.vagas[1].origem == "POSICAO_GRUPO"
        assert s1.vagas[1].posicao_grupo == 2
        assert s1.vagas[1].nome_grupo == "Grupo B"

        # Semi 2: 1ºB x 2ºA
        s2 = semis[1]
        assert s2.posicao_chave == 2
        assert s2.vagas[0].origem == "POSICAO_GRUPO"
        assert s2.vagas[0].posicao_grupo == 1
        assert s2.vagas[0].nome_grupo == "Grupo B"
        assert s2.vagas[1].origem == "POSICAO_GRUPO"
        assert s2.vagas[1].posicao_grupo == 2
        assert s2.vagas[1].nome_grupo == "Grupo A"

    def test_cruzamento_4_grupos_2_classificados(self) -> None:
        duelos = gerar_cruzamentos_grupos_mata_mata(
            ["Grupo A", "Grupo B", "Grupo C", "Grupo D"], classificados_por_grupo=2
        )

        # 8 classificados -> 4 Quartas, 2 Semis, 1 Final = 7 duelos
        quartas = [d for d in duelos if d.fase == "QUARTAS"]
        assert len(quartas) == 4

        # Quartas 1: 1ºA x 2ºB
        assert quartas[0].vagas[0].nome_grupo == "Grupo A"
        assert quartas[0].vagas[0].posicao_grupo == 1
        assert quartas[0].vagas[1].nome_grupo == "Grupo B"
        assert quartas[0].vagas[1].posicao_grupo == 2

        # Quartas 2: 1ºC x 2ºD
        assert quartas[1].vagas[0].nome_grupo == "Grupo C"
        assert quartas[1].vagas[0].posicao_grupo == 1
        assert quartas[1].vagas[1].nome_grupo == "Grupo D"
        assert quartas[1].vagas[1].posicao_grupo == 2

        # Quartas 3: 1ºB x 2ºA
        assert quartas[2].vagas[0].nome_grupo == "Grupo B"
        assert quartas[2].vagas[0].posicao_grupo == 1
        assert quartas[2].vagas[1].nome_grupo == "Grupo A"
        assert quartas[2].vagas[1].posicao_grupo == 2

        # Quartas 4: 1ºD x 2ºC
        assert quartas[3].vagas[0].nome_grupo == "Grupo D"
        assert quartas[3].vagas[0].posicao_grupo == 1
        assert quartas[3].vagas[1].nome_grupo == "Grupo C"
        assert quartas[3].vagas[1].posicao_grupo == 2

    def test_cruzamento_com_terceiro_lugar(self) -> None:
        duelos = gerar_cruzamentos_grupos_mata_mata(
            ["Grupo A", "Grupo B"], classificados_por_grupo=2, terceiro_lugar=True
        )
        # 2 Semis, 1 Final, 1 Terceiro Lugar = 4 duelos
        assert len(duelos) == 4
        d3 = next(d for d in duelos if d.fase == "TERCEIRO_LUGAR")
        assert d3.posicao_chave == 1
        assert len(d3.vagas) == 2
        assert d3.vagas[0].origem == "PERDEDOR_DUELO"
        assert d3.vagas[1].origem == "PERDEDOR_DUELO"

    def test_cruzamento_validacoes_erro(self) -> None:
        with pytest.raises(ValueError, match="Mínimo de 2 grupos"):
            gerar_cruzamentos_grupos_mata_mata(["Grupo A"], classificados_por_grupo=2)

        with pytest.raises(ValueError, match="no mínimo 1"):
            gerar_cruzamentos_grupos_mata_mata(["Grupo A", "Grupo B"], classificados_por_grupo=0)

        with pytest.raises(ValueError, match="potência de 2"):
            # 3 grupos * 2 classificados = 6 (não é potência de 2)
            gerar_cruzamentos_grupos_mata_mata(
                ["Grupo A", "Grupo B", "Grupo C"], classificados_por_grupo=2
            )


class TestCasosDeBorda:
    """Casos extremos e integracao de flags de disputa."""

    def test_liga_minima_2_equipes(self) -> None:
        rodadas = gerar_rodadas_pontos_corridos([1, 2], turno_returno=True)
        assert len(rodadas) == 2
        assert len(rodadas[0].partidas) == 1
        assert len(rodadas[1].partidas) == 1
        # Ida: 1 x 2, Volta: 2 x 1
        p1 = rodadas[0].partidas[0]
        p2 = rodadas[1].partidas[0]
        assert p1.id_equipe_mandante == p2.id_equipe_visitante
        assert p1.id_equipe_visitante == p2.id_equipe_mandante

    def test_liga_3_equipes_impar(self) -> None:
        rodadas = gerar_rodadas_pontos_corridos([1, 2, 3], turno_returno=False)
        assert len(rodadas) == 3
        # Cada rodada tem exatamente 1 jogo
        for r in rodadas:
            assert len(r.partidas) == 1
        # Todos os 3 confrontos possiveis
        times_confronto = {tuple(sorted([r.partidas[0].id_equipe_mandante, r.partidas[0].id_equipe_visitante])) for r in rodadas}
        assert times_confronto == {(1, 2), (1, 3), (2, 3)}

    def test_mata_mata_ida_volta_propaga_flag(self) -> None:
        duelos = gerar_arvore_mata_mata([1, 2, 3, 4], ida_volta=True, terceiro_lugar=True)
        assert len(duelos) == 4
        for d in duelos:
            assert d.ida_volta is True

    def test_mata_mata_7_equipes_uma_folga(self) -> None:
        duelos = gerar_arvore_mata_mata([1, 2, 3, 4, 5, 6, 7])
        quartas = [d for d in duelos if d.fase == "QUARTAS"]
        assert len(quartas) == 4
        folgas = [v for q in quartas for v in q.vagas if v.origem == "FOLGA"]
        assert len(folgas) == 1
        assert quartas[0].vagas[1].origem == "FOLGA"
        # As outras 3 partidas das quartas têm 2 times reais cada
        for q in quartas[1:]:
            assert all(v.origem == "EQUIPE_INICIAL" for v in q.vagas)

