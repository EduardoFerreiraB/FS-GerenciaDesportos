"""Testes do motor puro de classificação (Task 3 - Fatia 2).

Cobre:
- Pontos corridos com 4 equipes (J, V, E, D, GP, GC, SG, PTS, % aproveitamento).
- Desempates progressivos: vitórias, saldo de gols, gols pró.
- Confronto direto com mini-tabela entre equipes empatadas.
- Confronto direto suspenso se partidas mútuas não finalizadas.
- Empate persistente sinalizado com empate_persistente=True sem ordenação fictícia por ID.
- Configurações customizadas de pontos.
- Ignora partidas não finalizadas.
"""

import pytest

from competicoes.contratos.classificacao import LinhaClassificacao
from competicoes.servicos.motores.classificacao import calcular_classificacao


def test_classificacao_pontos_corridos_quatro_equipes():
    equipes = [
        {"id_equipe": 1, "nome_equipe": "Time A"},
        {"id_equipe": 2, "nome_equipe": "Time B"},
        {"id_equipe": 3, "nome_equipe": "Time C"},
        {"id_equipe": 4, "nome_equipe": "Time D"},
    ]
    # Partidas:
    # A 2x0 B, A 1x0 C, A 3x1 D -> A: 3V, 9 pts, GP=6, GC=1, SG=+5
    # B 2x1 C, B 1x1 D -> B: 1V, 1E, 1D, 4 pts, GP=4, GC=4, SG=0
    # C 1x0 D -> C: 1V, 0E, 2D, 3 pts, GP=2, GC=4, SG=-2
    # D: 0V, 1E, 2D, 1 pt, GP=2, GC=5, SG=-3
    partidas = [
        {"id_equipe_mandante": 1, "id_equipe_visitante": 2, "gols_mandante": 2, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 1, "id_equipe_visitante": 3, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 1, "id_equipe_visitante": 4, "gols_mandante": 3, "gols_visitante": 1, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 2, "id_equipe_visitante": 3, "gols_mandante": 2, "gols_visitante": 1, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 2, "id_equipe_visitante": 4, "gols_mandante": 1, "gols_visitante": 1, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 3, "id_equipe_visitante": 4, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
    ]

    linhas = calcular_classificacao(equipes, partidas)

    assert len(linhas) == 4
    assert all(isinstance(l, LinhaClassificacao) for l in linhas)

    # 1º Time A
    l1 = linhas[0]
    assert l1.id_equipe == 1
    assert l1.posicao == 1
    assert l1.jogos == 3
    assert l1.vitorias == 3
    assert l1.empates == 0
    assert l1.derrotas == 0
    assert l1.gols_pro == 6
    assert l1.gols_contra == 1
    assert l1.saldo_gols == 5
    assert l1.pontos == 9
    assert l1.aproveitamento == 100.0
    assert l1.empate_persistente is False

    # 2º Time B
    l2 = linhas[1]
    assert l2.id_equipe == 2
    assert l2.posicao == 2
    assert l2.jogos == 3
    assert l2.vitorias == 1
    assert l2.empates == 1
    assert l2.derrotas == 1
    assert l2.gols_pro == 3
    assert l2.gols_contra == 4
    assert l2.saldo_gols == -1
    assert l2.pontos == 4
    assert l2.aproveitamento == pytest.approx(44.44, abs=0.01)
    assert l2.empate_persistente is False

    # 3º Time C
    l3 = linhas[2]
    assert l3.id_equipe == 3
    assert l3.posicao == 3
    assert l3.jogos == 3
    assert l3.vitorias == 1
    assert l3.empates == 0
    assert l3.derrotas == 2
    assert l3.gols_pro == 2
    assert l3.gols_contra == 3
    assert l3.saldo_gols == -1
    assert l3.pontos == 3
    assert l3.aproveitamento == pytest.approx(33.33, abs=0.01)
    assert l3.empate_persistente is False

    # 4º Time D
    l4 = linhas[3]
    assert l4.id_equipe == 4
    assert l4.posicao == 4
    assert l4.jogos == 3
    assert l4.vitorias == 0
    assert l4.empates == 1
    assert l4.derrotas == 2
    assert l4.gols_pro == 2
    assert l4.gols_contra == 5
    assert l4.saldo_gols == -3
    assert l4.pontos == 1
    assert l4.aproveitamento == pytest.approx(11.11, abs=0.01)
    assert l4.empate_persistente is False


def test_desempate_por_vitorias_saldo_e_gols_pro():
    equipes = [
        {"id_equipe": 1, "nome_equipe": "Time 1"},
        {"id_equipe": 2, "nome_equipe": "Time 2"},
    ]
    # Ambos com 3 pontos, mas Time 1 tem 1 vitória e Time 2 tem 3 empates
    # Time 1: 1 J, 1 V, 0 E, 0 D -> 3 pts
    # Time 2: 3 J, 0 V, 3 E, 0 D -> 3 pts
    partidas = [
        {"id_equipe_mandante": 1, "id_equipe_visitante": 99, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 2, "id_equipe_visitante": 97, "gols_mandante": 0, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 2, "id_equipe_visitante": 98, "gols_mandante": 1, "gols_visitante": 1, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 2, "id_equipe_visitante": 99, "gols_mandante": 2, "gols_visitante": 2, "estado": "FINALIZADA"},
    ]

    linhas = calcular_classificacao(equipes, partidas)
    assert linhas[0].id_equipe == 1
    assert linhas[1].id_equipe == 2
    assert linhas[0].posicao == 1
    assert linhas[1].posicao == 2
    assert linhas[0].empate_persistente is False
    assert linhas[1].empate_persistente is False


def test_desempate_confronto_direto_duas_equipes():
    equipes = [
        {"id_equipe": 10, "nome_equipe": "Alfa"},
        {"id_equipe": 20, "nome_equipe": "Beta"},
        {"id_equipe": 30, "nome_equipe": "Gama"},
    ]
    # Alfa e Beta terminam com 6 pontos cada, 2 vitórias cada, saldo +2, 4 gols pró:
    # Alfa 2x1 Beta (confronto direto favorável ao Alfa)
    # Alfa 2x1 Gama
    # Beta 3x1 Gama
    # Gama 0 vitórias
    partidas = [
        {"id_equipe_mandante": 10, "id_equipe_visitante": 20, "gols_mandante": 2, "gols_visitante": 1, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 10, "id_equipe_visitante": 30, "gols_mandante": 2, "gols_visitante": 1, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 20, "id_equipe_visitante": 30, "gols_mandante": 3, "gols_visitante": 1, "estado": "FINALIZADA"},
    ]

    # Ambos Alfa e Beta têm:
    # Alfa: 2V, 0E, 0D, GP=4, GC=2, SG=+2, PTS=6
    # Beta: 1V, 0E, 1D -> Ops, vamos igualar vitórias e pontos!
    # Adicionamos mais um jogo para Beta ter 6 pts também:
    # Beta 1x0 Alfa (se retorno) ou contra outro time. Vamos fazer triangular fechado:
    # Alfa 2x1 Beta
    # Beta 3x0 Gama -> Beta: 1V, 1D, 3 pts, GP=4, GC=2, SG=+2
    # Alfa 2x4 Gama -> Alfa: 1V, 1D, 3 pts, GP=4, GC=5, SG=-1
    # Vamos criar caso exato onde PTS, V, SG, GP são IDÊNTICOS para Alfa e Beta:
    # Alfa x Gama: 2x0 (Alfa: GP=2, GC=0)
    # Beta x Gama: 3x1 (Beta: GP=3, GC=1) -> Alfa e Beta não jogaram contra Gama o mesmo.
    # Vamos fazer exatamente:
    # Alfa 1x0 Beta
    # Alfa 0x2 Gama
    # Beta 2x0 Gama
    # Totais:
    # Alfa: vs Beta 1x0, vs Gama 0x2 -> J=2, V=1, E=0, D=1, GP=1, GC=2, SG=-1, PTS=3
    # Beta: vs Alfa 0x1, vs Gama 2x0 -> J=2, V=1, E=0, D=1, GP=2, GC=1, SG=+1 -> aqui saldo desempata.
    # Para empatar em PTS(3), V(1), SG(0), GP(2):
    # Alfa:
    # - Alfa 2x1 Beta (finalizada) -> Alfa GP=2, GC=1
    # - Alfa 0x1 Gama (finalizada) -> Alfa GP=2, GC=2, SG=0, V=1, PTS=3
    # Beta:
    # - Beta 1x2 Alfa (já é o jogo acima) -> Beta GP=1, GC=2
    # - Beta 1x0 Gama (finalizada) -> Beta GP=2, GC=2, SG=0, V=1, PTS=3
    # Gama:
    # - Gama 1x0 Alfa
    # - Gama 0x1 Beta -> Gama GP=1, GC=1, SG=0, V=1, PTS=3
    # Perfeito! Alfa e Beta têm rigorosamente:
    # J=2, V=1, E=0, D=1, GP=2, GC=2, SG=0, PTS=3!
    partidas_exatas = [
        {"id_equipe_mandante": 10, "id_equipe_visitante": 20, "gols_mandante": 2, "gols_visitante": 1, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 30, "id_equipe_visitante": 10, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 20, "id_equipe_visitante": 30, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
    ]

    # No triangular:
    # Alfa vs Beta: 2x1 (Alfa venceu Beta)
    # Gama vs Alfa: 1x0 (Gama venceu Alfa)
    # Beta vs Gama: 1x0 (Beta venceu Gama)
    # Todos têm 3 pts, 1V, 0E, 1D, GP=2, GC=2, SG=0!
    # No confronto direto triplo (mini-tabela entre Alfa, Beta e Gama):
    # Alfa: 3 pts, SG=0, GP=2
    # Beta: 3 pts, SG=0, GP=2
    # Gama: 3 pts, SG=0, GP=2
    # Então no triangular todos empatam no CD!
    # Mas se fizermos um torneio com um 4º time (Delta, o lanterna com 0 pts):
    equipes_4 = [
        {"id_equipe": 10, "nome_equipe": "Alfa"},
        {"id_equipe": 20, "nome_equipe": "Beta"},
        {"id_equipe": 99, "nome_equipe": "Delta"},
    ]
    # Alfa e Beta empatam em tudo na tabela geral:
    # Alfa vence Delta por 3x0
    # Beta vence Delta por 3x0
    # Alfa e Beta jogam entre si e Alfa vence por 1x0:
    # Alfa: 2V, 0E, 0D -> PTS 6, GP 4, GC 0, SG +4
    # Beta: 1V, 0E, 1D -> PTS 3...
    # Para empatar em pontos:
    # Alfa x Delta: 1x0 (Alfa PTS 3, GP 1, GC 0)
    # Beta x Delta: 2x0 (Beta PTS 3, GP 2, GC 0)
    # Alfa x Beta: 2x1 (Alfa PTS 6, GP 3, GC 1, SG +2, V 2)
    # e Beta x Outro jogo...
    # A forma mais simples de testar CD puro entre 2 equipes:
    # Ordem de desempate configurada como ["CONFRONTO_DIRETO", "VITORIAS", "SALDO_GOLS", "GOLS_PRO"]
    # OU ambas empatadas em V, SG, GP:
    # Equipes: Alfa (10) e Beta (20)
    # Alfa 2x1 Beta
    # Beta 2x1 Alfa (se turno/returno: empataria).
    # Se jogo único:
    # Alfa 1x0 Beta -> Alfa tem 3 pts, Beta tem 0 pts.
    # Para terem os mesmos pontos e estatísticas gerais, ambas jogam contra terceiros:
    # Alfa 1x0 Beta (Alfa +3 pts, GP +1, GC 0; Beta 0 pts, GP 0, GC 1)
    # Alfa 0x1 Delta (Alfa 0 pts, GP 0, GC 1; Delta +3)
    # Beta 1x0 Delta (Beta +3 pts, GP +1, GC 0; Delta 0)
    # Agora calculamos totais gerais para Alfa e Beta:
    # Alfa: vs Beta (1x0), vs Delta (0x1) -> PTS=3, V=1, E=0, D=1, GP=1, GC=1, SG=0
    # Beta: vs Alfa (0x1), vs Delta (1x0) -> PTS=3, V=1, E=0, D=1, GP=1, GC=1, SG=0
    # Delta: vs Alfa (1x0), vs Beta (0x1) -> PTS=3, V=1, E=0, D=1, GP=1, GC=1, SG=0
    # Se olharmos apenas para Alfa e Beta (por exemplo, Delta tem pontuação diferente se fizermos Delta empatar outro):
    # Vamos fazer Delta perder mais um jogo:
    # Delta 0x5 Ômega (Delta fica com saldo -4).
    # Então Alfa e Beta estão empatados entre si no topo com 3 PTS, 1 V, 0 SG, 1 GP!
    # Critérios:
    # PTS: empatados (3)
    # VITORIAS: empatados (1)
    # SALDO_GOLS: empatados (0)
    # GOLS_PRO: empatados (1)
    # CONFRONTO_DIRETO:
    # Alfa 1x0 Beta -> Alfa 3 pts na mini-tabela, Beta 0 pts na mini-tabela!
    # Alfa fica na frente de Beta!
    partidas_cd = [
        {"id_equipe_mandante": 10, "id_equipe_visitante": 20, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 10, "id_equipe_visitante": 99, "gols_mandante": 0, "gols_visitante": 1, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 20, "id_equipe_visitante": 99, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 99, "id_equipe_visitante": 88, "gols_mandante": 0, "gols_visitante": 5, "estado": "FINALIZADA"},
    ]
    eqs = [
        {"id_equipe": 10, "nome_equipe": "Alfa"},
        {"id_equipe": 20, "nome_equipe": "Beta"},
        {"id_equipe": 99, "nome_equipe": "Delta"},
    ]

    linhas = calcular_classificacao(eqs, partidas_cd)
    # Alfa e Beta têm 3 pts, Delta tem 3 pts mas saldo -4.
    # Alfa e Beta têm saldo 0 e GP 1.
    # Alfa venceu confronto direto contra Beta (1x0).
    assert linhas[0].id_equipe == 10
    assert linhas[1].id_equipe == 20
    assert linhas[0].posicao == 1
    assert linhas[1].posicao == 2
    assert linhas[0].empate_persistente is False
    assert linhas[1].empate_persistente is False


def test_desempate_confronto_direto_mini_tabela_tres_equipes():
    # Três equipes empatadas no topo com 6 pontos cada.
    # Todas venceram o time lanterna (id 99).
    # Entre elas:
    # Time 1 (3x0) Time 2
    # Time 2 (1x0) Time 3
    # Time 3 (1x0) Time 1
    # Mini-tabela entre 1, 2 e 3:
    # Time 1: 1V, 1D, 3 pts, GP 3, GC 1 -> SG +2
    # Time 2: 1V, 1D, 3 pts, GP 1, GC 3 -> SG -2
    # Time 3: 1V, 1D, 3 pts, GP 1, GC 1 -> SG 0
    # Ordem esperada na mini-tabela: Time 1 (+2), Time 3 (0), Time 2 (-2)
    equipes = [
        {"id_equipe": 1, "nome_equipe": "Time 1"},
        {"id_equipe": 2, "nome_equipe": "Time 2"},
        {"id_equipe": 3, "nome_equipe": "Time 3"},
        {"id_equipe": 99, "nome_equipe": "Lanterna"},
    ]
    # Lanterna perdeu para todos por placares que igualam o saldo geral:
    # Time 1 precisa compensar os gols para empatar em GP e SG geral com 2 e 3:
    # Geral queremos que 1, 2 e 3 tenham:
    # PTS=6, V=2, GP=5, GC=4, SG=+1
    # Time 1 nos jogos mútuos tem GP 3, GC 1. Contra 99: Time 1 (2x3) Time 99 -> não, 99 perde!
    # Basta colocar ordem de desempate = ["CONFRONTO_DIRETO"] direto após pontos!
    partidas = [
        {"id_equipe_mandante": 1, "id_equipe_visitante": 2, "gols_mandante": 3, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 2, "id_equipe_visitante": 3, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 3, "id_equipe_visitante": 1, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
        # Contra o lanterna:
        {"id_equipe_mandante": 1, "id_equipe_visitante": 99, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 2, "id_equipe_visitante": 99, "gols_mandante": 3, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_equipe_mandante": 3, "id_equipe_visitante": 99, "gols_mandante": 3, "gols_visitante": 0, "estado": "FINALIZADA"},
    ]
    # Geral:
    # Time 1: 4J, 2V, 0E, 1D... espera, 1 venceu 2 e 99 (2V, 1D), PTS 6.
    # Time 2: 2 venceu 3 e 99 (2V, 1D), PTS 6.
    # Time 3: 3 venceu 1 e 99 (2V, 1D), PTS 6.
    # Ordem de desempate prioritária por confronto direto:
    linhas = calcular_classificacao(
        equipes,
        partidas,
        ordem_desempates=["CONFRONTO_DIRETO", "VITORIAS", "SALDO_GOLS", "GOLS_PRO"],
    )

    assert [l.id_equipe for l in linhas[:3]] == [1, 3, 2]
    assert [l.posicao for l in linhas[:3]] == [1, 2, 3]


def test_confronto_direto_ignorado_se_jogos_mutuos_nao_finalizados():
    # Equipes A e B têm mesma pontuação e stats, mas o jogo entre elas é AGENDADA
    equipes = [
        {"id_equipe": 10, "nome_equipe": "Time A"},
        {"id_equipe": 20, "nome_equipe": "Time B"},
    ]
    partidas = [
        {"id_equipe_mandante": 10, "id_equipe_visitante": 20, "gols_mandante": None, "gols_visitante": None, "estado": "AGENDADA"},
    ]

    linhas = calcular_classificacao(equipes, partidas)
    assert len(linhas) == 2
    # Sem jogo finalizado não há empate a resolver (DF-RT12-11): mesma posição, sem alerta.
    assert linhas[0].empate_persistente is False
    assert linhas[1].empate_persistente is False
    assert linhas[0].posicao == 1
    assert linhas[1].posicao == 1


def test_empate_persistente_sem_desempate_por_id():
    # Time 10 e Time 2 empatam em 0x0
    # Time 10 não pode passar na frente de Time 2 por ID, nem Time 2 de Time 10 por menor ID
    equipes = [
        {"id_equipe": 10, "nome_equipe": "Time Dez"},
        {"id_equipe": 2, "nome_equipe": "Time Dois"},
    ]
    partidas = [
        {"id_equipe_mandante": 10, "id_equipe_visitante": 2, "gols_mandante": 0, "gols_visitante": 0, "estado": "FINALIZADA"},
    ]

    linhas = calcular_classificacao(equipes, partidas)
    assert len(linhas) == 2
    assert linhas[0].empate_persistente is True
    assert linhas[1].empate_persistente is True
    assert linhas[0].posicao == 1
    assert linhas[1].posicao == 1
    assert linhas[0].pontos == 1
    assert linhas[1].pontos == 1
    assert linhas[0].saldo_gols == 0
    assert linhas[1].saldo_gols == 0


def test_aproveitamento_pontos_customizados():
    equipes = [{"id_equipe": 1, "nome_equipe": "Time A"}]
    partidas = [
        {"id_equipe_mandante": 1, "id_equipe_visitante": 2, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"}
    ]
    # Com vitória valendo 2 pontos, 1 vitória = 2 pts (100%)
    linhas = calcular_classificacao(
        equipes,
        partidas,
        configuracao_pontos={"vitoria": 2, "empate": 1, "derrota": 0},
    )
    assert linhas[0].pontos == 2
    assert linhas[0].aproveitamento == 100.0


def test_ignora_partidas_nao_finalizadas():
    equipes = [
        {"id_equipe": 1, "nome_equipe": "Time A"},
        {"id_equipe": 2, "nome_equipe": "Time B"},
    ]
    partidas = [
        {"id_equipe_mandante": 1, "id_equipe_visitante": 2, "gols_mandante": 5, "gols_visitante": 0, "estado": "EM_ANDAMENTO"},
        {"id_equipe_mandante": 2, "id_equipe_visitante": 1, "gols_mandante": 3, "gols_visitante": 0, "estado": "CANCELADA"},
        {"id_equipe_mandante": 1, "id_equipe_visitante": 2, "gols_mandante": 0, "gols_visitante": 0, "estado": "AGENDADA"},
    ]

    linhas = calcular_classificacao(equipes, partidas)
    assert linhas[0].jogos == 0
    assert linhas[0].pontos == 0
    assert linhas[1].jogos == 0
    assert linhas[1].pontos == 0


def test_contratos_tabela_e_detalhe():
    from app.competicoes.contratos.classificacao import (
        ClassificacaoEdicaoDetalhe,
        TabelaClassificacao,
    )

    linhas = [
        LinhaClassificacao(posicao=1, id_equipe=1, nome_equipe="Time 1", pontos=3),
        LinhaClassificacao(posicao=2, id_equipe=2, nome_equipe="Time 2", pontos=0),
    ]
    tabela = TabelaClassificacao(id_grupo=10, nome_grupo="Grupo A", linhas=linhas)
    assert tabela.id_grupo == 10
    assert tabela.nome_grupo == "Grupo A"
    assert len(tabela.linhas) == 2

    detalhe = ClassificacaoEdicaoDetalhe(geral=tabela, grupos=[tabela])
    assert detalhe.geral is not None
    assert len(detalhe.grupos) == 1


def test_classificacao_tabela_vazia():
    linhas = calcular_classificacao([], [])
    assert linhas == []


def test_classificacao_sem_jogos_todas_empatadas():
    equipes = [
        {"id_equipe": 10, "nome_equipe": "Time 1"},
        {"id_equipe": 20, "nome_equipe": "Time 2"},
        {"id_equipe": 30, "nome_equipe": "Time 3"},
    ]
    linhas = calcular_classificacao(equipes, [])
    assert len(linhas) == 3
    for l in linhas:
        assert l.posicao == 1
        assert l.empate_persistente is False  # DF-RT12-11
        assert l.jogos == 0
        assert l.pontos == 0
        assert l.aproveitamento == 0.0


def test_suporte_ocorrencias_gol():
    equipes = [
        {"id_equipe": 1, "nome_equipe": "Time A"},
        {"id_equipe": 2, "nome_equipe": "Time B"},
    ]
    partidas = [
        {
            "id_equipe_mandante": 1,
            "id_equipe_visitante": 2,
            "estado": "FINALIZADA",
            "ocorrencias": [
                {"tipo": "GOL", "id_equipe_beneficiada": 1},
                {"tipo": "GOL", "id_equipe_beneficiada": 1},
                {"tipo": "GOL", "id_equipe_beneficiada": 2},
            ],
        }
    ]
    linhas = calcular_classificacao(equipes, partidas)
    assert linhas[0].id_equipe == 1
    assert linhas[0].gols_pro == 2
    assert linhas[0].gols_contra == 1
    assert linhas[0].pontos == 3
    assert linhas[1].id_equipe == 2
    assert linhas[1].gols_pro == 1
    assert linhas[1].gols_contra == 2
    assert linhas[1].pontos == 0

