"""Suíte de testes para o serviço de Classificação de Equipes (Passo 6)."""

from datetime import date, time
import pytest

import models
from services.classificacao_equipes import (
    calcular_classificacao_equipes,
    CompeticaoNaoEncontradaError,
    ModoCompeticaoInvalidoError,
)


def _criar_cenario_base(db, *, modo="EQUIPE", formato="PONTOS_CORRIDOS"):
    """Cria a infraestrutura básica de Evento, Modalidade, Edição e Competição."""
    evento = models.Evento(even_nome="Jogos Escolares 2026")
    modalidade = models.Modalidade(nome="Futebol de Campo", duracao_minutos=90)
    db.add_all([evento, modalidade])
    db.flush()

    edicao = models.Edicao(
        id_evento=evento.id_evento,
        edic_ano=2026,
        tipo_competicao="Pontos Corridos",
        data_inicio=date(2026, 9, 1),
        data_fim=date(2026, 9, 30),
    )
    db.add(edicao)
    db.flush()

    competicao = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=modalidade.id_modalidade,
        nome="Torneio Principal",
        categoria="Sub-17",
        modo_inscricao=modo,
        formato=formato,
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 9, 1),
        data_fim=date(2026, 9, 30),
        status="EM_ANDAMENTO",
    )
    db.add(competicao)
    db.flush()

    local = models.Local(loca_nome="Estádio Central", ativo=True)
    arbitro = models.Arbitro(apito_nome="Árbitro Principal", apito_doc="123456", apito_tel="9999-8888")
    db.add_all([local, arbitro])
    db.flush()

    return {
        "evento": evento,
        "modalidade": modalidade,
        "edicao": edicao,
        "competicao": competicao,
        "local": local,
        "arbitro": arbitro,
    }


def test_classificacao_rejeita_modo_individual(db):
    """Garante que calcular classificação de equipes para competição INDIVIDUAL levanta ValueError."""
    cenario = _criar_cenario_base(db, modo="INDIVIDUAL", formato="PROVAS")
    comp = cenario["competicao"]

    with pytest.raises(ValueError) as exc_info:
        calcular_classificacao_equipes(db, comp.id_competicao)

    assert "EQUIPE" in str(exc_info.value)
    assert isinstance(exc_info.value, ModoCompeticaoInvalidoError)


def test_classificacao_competicao_inexistente(db):
    """Garante que ID inexistente levanta ValueError (e LookupError)."""
    with pytest.raises(ValueError) as exc_info:
        calcular_classificacao_equipes(db, 999999)

    assert "não encontrada" in str(exc_info.value)
    assert isinstance(exc_info.value, CompeticaoNaoEncontradaError)


def test_classificacao_sem_jogos(db):
    """Testa competição de equipes sem nenhum jogo disputado."""
    cenario = _criar_cenario_base(db, modo="EQUIPE", formato="PONTOS_CORRIDOS")
    comp = cenario["competicao"]
    edicao = cenario["edicao"]

    # Adiciona 3 equipes desordenadas
    eq_c = models.Equipe(nome="Time Charlie", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    eq_a = models.Equipe(nome="Time Alpha", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    eq_b = models.Equipe(nome="Time Bravo", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    db.add_all([eq_c, eq_a, eq_b])
    db.commit()

    res = calcular_classificacao_equipes(db, comp.id_competicao)

    assert res["id_competicao"] == comp.id_competicao
    assert res["formato"] == "PONTOS_CORRIDOS"
    assert res["total_equipes"] == 3
    assert res["confrontos_disputados"] == 0

    classificacao = res["classificacao"]
    assert len(classificacao) == 3

    # Ordenação alfabética por nome ASC quando todos empatados com 0 pontos
    assert classificacao[0]["nome_equipe"] == "Time Alpha"
    assert classificacao[0]["posicao"] == 1
    assert classificacao[1]["nome_equipe"] == "Time Bravo"
    assert classificacao[1]["posicao"] == 2
    assert classificacao[2]["nome_equipe"] == "Time Charlie"
    assert classificacao[2]["posicao"] == 3

    for item in classificacao:
        assert item["jogos"] == 0
        assert item["vitorias"] == 0
        assert item["empates"] == 0
        assert item["derrotas"] == 0
        assert item["gols_pro"] == 0
        assert item["gols_contra"] == 0
        assert item["saldo_gols"] == 0
        assert item["pontos"] == 0
        assert item["aproveitamento"] == 0.0


def test_classificacao_pontos_corridos_completo(db):
    """Testa cálculo de pontos corridos com vitórias, empates, derrotas, saldo de gols e aproveitamento."""
    cenario = _criar_cenario_base(db, modo="EQUIPE", formato="PONTOS_CORRIDOS")
    comp = cenario["competicao"]
    edicao = cenario["edicao"]
    local = cenario["local"]
    arbitro = cenario["arbitro"]

    t_alpha = models.Equipe(nome="Time Alpha", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_beta = models.Equipe(nome="Time Beta", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_gamma = models.Equipe(nome="Time Gamma", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_delta = models.Equipe(nome="Time Delta", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    db.add_all([t_alpha, t_beta, t_gamma, t_delta])
    db.flush()

    # Alpha 3 x 0 Beta (Alpha: 3 pts, Beta: 0 pts)
    c1 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_alpha.id_equipe,
        id_equipe_visitante=t_beta.id_equipe,
        placar_mandante=3,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_alpha.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 2),
        hora=time(10, 0),
    )
    # Gamma 2 x 2 Delta (Gamma: 1 pt, Delta: 1 pt)
    c2 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_gamma.id_equipe,
        id_equipe_visitante=t_delta.id_equipe,
        placar_mandante=2,
        placar_visitante=2,
        status="Finalizado",
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 2),
        hora=time(14, 0),
    )
    # Alpha 2 x 1 Gamma (Alpha: 6 pts, Gamma: 1 pt)
    c3 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_alpha.id_equipe,
        id_equipe_visitante=t_gamma.id_equipe,
        placar_mandante=2,
        placar_visitante=1,
        status="Finalizado",
        id_equipe_vencedora=t_alpha.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 9),
        hora=time(10, 0),
    )
    # Beta 1 x 0 Delta (Beta: 3 pts, Delta: 1 pt)
    c4 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_beta.id_equipe,
        id_equipe_visitante=t_delta.id_equipe,
        placar_mandante=1,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_beta.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 9),
        hora=time(14, 0),
    )
    db.add_all([c1, c2, c3, c4])
    db.commit()

    res = calcular_classificacao_equipes(db, comp.id_competicao)

    assert res["formato"] == "PONTOS_CORRIDOS"
    assert res["total_equipes"] == 4
    assert res["confrontos_disputados"] == 4

    tab = res["classificacao"]

    # 1º Alpha: 2 jogos, 2 V, 0 E, 0 D, GP: 5, GC: 1, SG: +4, PTS: 6, Aproveitamento: 100.0%
    assert tab[0]["nome_equipe"] == "Time Alpha"
    assert tab[0]["posicao"] == 1
    assert tab[0]["jogos"] == 2
    assert tab[0]["vitorias"] == 2
    assert tab[0]["empates"] == 0
    assert tab[0]["derrotas"] == 0
    assert tab[0]["gols_pro"] == 5
    assert tab[0]["gols_contra"] == 1
    assert tab[0]["saldo_gols"] == 4
    assert tab[0]["pontos"] == 6
    assert tab[0]["aproveitamento"] == 100.0

    # 2º Beta: 2 jogos, 1 V, 0 E, 1 D, GP: 1, GC: 3, SG: -2, PTS: 3, Aproveitamento: 50.0%
    assert tab[1]["nome_equipe"] == "Time Beta"
    assert tab[1]["posicao"] == 2
    assert tab[1]["jogos"] == 2
    assert tab[1]["vitorias"] == 1
    assert tab[1]["empates"] == 0
    assert tab[1]["derrotas"] == 1
    assert tab[1]["gols_pro"] == 1
    assert tab[1]["gols_contra"] == 3
    assert tab[1]["saldo_gols"] == -2
    assert tab[1]["pontos"] == 3
    assert tab[1]["aproveitamento"] == 50.0

    # Gamma e Delta têm 1 ponto e saldo -1. Desempate por gols pró: Gamma (3 GP) > Delta (2 GP)
    assert tab[2]["nome_equipe"] == "Time Gamma"
    assert tab[2]["posicao"] == 3
    assert tab[2]["jogos"] == 2
    assert tab[2]["vitorias"] == 0
    assert tab[2]["empates"] == 1
    assert tab[2]["derrotas"] == 1
    assert tab[2]["gols_pro"] == 3
    assert tab[2]["gols_contra"] == 4
    assert tab[2]["saldo_gols"] == -1
    assert tab[2]["pontos"] == 1
    assert tab[2]["aproveitamento"] == 16.67

    assert tab[3]["nome_equipe"] == "Time Delta"
    assert tab[3]["posicao"] == 4
    assert tab[3]["jogos"] == 2
    assert tab[3]["vitorias"] == 0
    assert tab[3]["empates"] == 1
    assert tab[3]["derrotas"] == 1
    assert tab[3]["gols_pro"] == 2
    assert tab[3]["gols_contra"] == 3
    assert tab[3]["saldo_gols"] == -1
    assert tab[3]["pontos"] == 1
    assert tab[3]["aproveitamento"] == 16.67


def test_classificacao_desempate_saldo_e_gols_pro(db):
    """Testa critérios de desempate por saldo de gols e gols pró."""
    cenario = _criar_cenario_base(db)
    comp = cenario["competicao"]
    edicao = cenario["edicao"]
    local = cenario["local"]
    arbitro = cenario["arbitro"]

    t_a = models.Equipe(nome="Time A", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_b = models.Equipe(nome="Time B", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_c = models.Equipe(nome="Time C", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_d = models.Equipe(nome="Time D", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    db.add_all([t_a, t_b, t_c, t_d])
    db.flush()

    # Time A vence Time C por 4x0 (GP 4, GC 0, Saldo +4)
    # Time B vence Time D por 2x0 (GP 2, GC 0, Saldo +2)
    c1 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_a.id_equipe,
        id_equipe_visitante=t_c.id_equipe,
        placar_mandante=4,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_a.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 2),
        hora=time(10, 0),
    )
    c2 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_b.id_equipe,
        id_equipe_visitante=t_d.id_equipe,
        placar_mandante=2,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_b.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 2),
        hora=time(14, 0),
    )
    db.add_all([c1, c2])
    db.commit()

    res = calcular_classificacao_equipes(db, comp.id_competicao)
    tab = res["classificacao"]

    # Ambos A e B têm 3 pontos e 1 vitória. Desempate por saldo de gols: A (+4) > B (+2)
    assert tab[0]["nome_equipe"] == "Time A"
    assert tab[0]["posicao"] == 1
    assert tab[1]["nome_equipe"] == "Time B"
    assert tab[1]["posicao"] == 2


def test_classificacao_desempate_confronto_direto(db):
    """Testa desempate por confronto direto quando pontos, vitórias, saldo e gols pró são iguais."""
    cenario = _criar_cenario_base(db)
    comp = cenario["competicao"]
    edicao = cenario["edicao"]
    local = cenario["local"]
    arbitro = cenario["arbitro"]

    t_a = models.Equipe(nome="Time A", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_b = models.Equipe(nome="Time B", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_c = models.Equipe(nome="Time C", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    db.add_all([t_a, t_b, t_c])
    db.flush()

    # Jogo 1: Time A 2 x 1 Time B  (A vence B no confronto direto)
    # Jogo 2: Time B 1 x 0 Time C  (B vence C)
    # Jogo 3: Time C 1 x 0 Time A  (C vence A)
    #
    # Totais:
    # Time A: 1 V, 0 E, 1 D | GP: 2, GC: 2 | Saldo: 0 | Pts: 3
    # Time B: 1 V, 0 E, 1 D | GP: 2, GC: 2 | Saldo: 0 | Pts: 3
    # Time C: 1 V, 0 E, 1 D | GP: 1, GC: 2 | Saldo: -1 | Pts: 3
    #
    # A e B empatados em Pts (3), V (1), Saldo (0), GP (2).
    # Confronto direto entre A e B: A venceu por 2x1 -> A fica em 1º, B em 2º!
    c1 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_a.id_equipe,
        id_equipe_visitante=t_b.id_equipe,
        placar_mandante=2,
        placar_visitante=1,
        status="Finalizado",
        id_equipe_vencedora=t_a.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 2),
        hora=time(10, 0),
    )
    c2 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_b.id_equipe,
        id_equipe_visitante=t_c.id_equipe,
        placar_mandante=1,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_b.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 5),
        hora=time(10, 0),
    )
    c3 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_c.id_equipe,
        id_equipe_visitante=t_a.id_equipe,
        placar_mandante=1,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_c.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 8),
        hora=time(10, 0),
    )
    db.add_all([c1, c2, c3])
    db.commit()

    res = calcular_classificacao_equipes(db, comp.id_competicao)
    tab = res["classificacao"]

    assert tab[0]["nome_equipe"] == "Time A"
    assert tab[0]["posicao"] == 1
    assert tab[1]["nome_equipe"] == "Time B"
    assert tab[1]["posicao"] == 2
    assert tab[2]["nome_equipe"] == "Time C"
    assert tab[2]["posicao"] == 3


def test_classificacao_fase_de_grupos(db):
    """Testa fase de grupos com tabelas classificadas separadamente por grupo."""
    cenario = _criar_cenario_base(db, modo="EQUIPE", formato="GRUPOS")
    comp = cenario["competicao"]
    edicao = cenario["edicao"]
    local = cenario["local"]
    arbitro = cenario["arbitro"]

    # Grupo A
    t_a1 = models.Equipe(nome="Alpha 1", grupo="A", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_a2 = models.Equipe(nome="Alpha 2", grupo="A", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    # Grupo B
    t_b1 = models.Equipe(nome="Beta 1", grupo="B", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_b2 = models.Equipe(nome="Beta 2", grupo="B", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    db.add_all([t_a1, t_a2, t_b1, t_b2])
    db.flush()

    # Jogo Grupo A: Alpha 1 vence Alpha 2 por 3x1
    c_a = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_a1.id_equipe,
        id_equipe_visitante=t_a2.id_equipe,
        fase="Grupo A - Rodada 1",
        grupo="A",
        placar_mandante=3,
        placar_visitante=1,
        status="Finalizado",
        id_equipe_vencedora=t_a1.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 2),
        hora=time(10, 0),
    )
    # Jogo Grupo B: Beta 2 vence Beta 1 por 2x0
    c_b = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_b2.id_equipe,
        id_equipe_visitante=t_b1.id_equipe,
        fase="Grupo B - Rodada 1",
        grupo="B",
        placar_mandante=2,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_b2.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 2),
        hora=time(14, 0),
    )
    db.add_all([c_a, c_b])
    db.commit()

    res = calcular_classificacao_equipes(db, comp.id_competicao)

    assert res["formato"] == "GRUPOS"
    assert "A" in res["grupos"]
    assert "B" in res["grupos"]

    tab_a = res["grupos"]["A"]
    assert len(tab_a) == 2
    assert tab_a[0]["nome_equipe"] == "Alpha 1"
    assert tab_a[0]["posicao"] == 1
    assert tab_a[0]["pontos"] == 3
    assert tab_a[1]["nome_equipe"] == "Alpha 2"
    assert tab_a[1]["posicao"] == 2
    assert tab_a[1]["pontos"] == 0

    tab_b = res["grupos"]["B"]
    assert len(tab_b) == 2
    assert tab_b[0]["nome_equipe"] == "Beta 2"
    assert tab_b[0]["posicao"] == 1
    assert tab_b[0]["pontos"] == 3
    assert tab_b[1]["nome_equipe"] == "Beta 1"
    assert tab_b[1]["posicao"] == 2
    assert tab_b[1]["pontos"] == 0

    # Verifica também a lista de classificação por grupo
    cpg = res["classificacao_por_grupo"]
    assert len(cpg) == 2
    assert {g["grupo"] for g in cpg} == {"A", "B"}


def test_classificacao_mata_mata_campeao_vice_semis(db):
    """Testa mata-mata identificando campeão, vice-campeão, semifinalistas e árvore."""
    cenario = _criar_cenario_base(db, modo="EQUIPE", formato="MATA_MATA")
    comp = cenario["competicao"]
    edicao = cenario["edicao"]
    local = cenario["local"]
    arbitro = cenario["arbitro"]

    t_1 = models.Equipe(nome="Time Campeão", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_2 = models.Equipe(nome="Time Vice", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_3 = models.Equipe(nome="Time Semi 1", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_4 = models.Equipe(nome="Time Semi 2", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    db.add_all([t_1, t_2, t_3, t_4])
    db.flush()

    # Final
    final = models.Confronto(
        id_competicao=comp.id_competicao,
        fase="Final",
        id_equipe_mandante=t_1.id_equipe,
        id_equipe_visitante=t_2.id_equipe,
        placar_mandante=3,
        placar_visitante=2,
        status="Finalizado",
        id_equipe_vencedora=t_1.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 20),
        hora=time(16, 0),
    )
    db.add(final)
    db.flush()

    # Semifinal 1: Time Campeão vence Time Semi 1
    semi1 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_proximo_confronto=final.id_confronto,
        fase="Semifinal 1",
        id_equipe_mandante=t_1.id_equipe,
        id_equipe_visitante=t_3.id_equipe,
        placar_mandante=2,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_1.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 13),
        hora=time(10, 0),
    )
    # Semifinal 2: Time Vice vence Time Semi 2
    semi2 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_proximo_confronto=final.id_confronto,
        fase="Semifinal 2",
        id_equipe_mandante=t_2.id_equipe,
        id_equipe_visitante=t_4.id_equipe,
        placar_mandante=1,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_2.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 13),
        hora=time(14, 0),
    )
    db.add_all([semi1, semi2])
    db.commit()

    res = calcular_classificacao_equipes(db, comp.id_competicao)

    assert res["formato"] == "MATA_MATA"
    assert res["total_equipes"] == 4
    assert res["confrontos_disputados"] == 3

    assert res["campeao"] is not None
    assert res["campeao"]["id_equipe"] == t_1.id_equipe
    assert res["campeao"]["nome_equipe"] == "Time Campeão"

    assert res["vice_campeao"] is not None
    assert res["vice_campeao"]["id_equipe"] == t_2.id_equipe
    assert res["vice_campeao"]["nome_equipe"] == "Time Vice"

    semis = res["semifinalistas"]
    semi_nomes = {s["nome_equipe"] for s in semis}
    assert "Time Semi 1" in semi_nomes
    assert "Time Semi 2" in semi_nomes

    arvore = res["arvore"]
    assert len(arvore) == 3
    for c in arvore:
        assert c["status"] == "Finalizado"
        assert c["id_equipe_vencedora"] is not None

    classificacao = res["classificacao"]
    assert classificacao[0]["nome_equipe"] == "Time Campeão"
    assert classificacao[0]["posicao"] == 1
    assert classificacao[1]["nome_equipe"] == "Time Vice"
    assert classificacao[1]["posicao"] == 2


def test_classificacao_apenas_confrontos_finalizados(db):
    """Garante que apenas confrontos com status 'Finalizado' entram no cálculo da tabela."""
    cenario = _criar_cenario_base(db)
    comp = cenario["competicao"]
    edicao = cenario["edicao"]
    local = cenario["local"]
    arbitro = cenario["arbitro"]

    t_1 = models.Equipe(nome="Time 1", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_2 = models.Equipe(nome="Time 2", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    t_3 = models.Equipe(nome="Time 3", id_edicao=edicao.id_edicao, id_competicao=comp.id_competicao)
    db.add_all([t_1, t_2, t_3])
    db.flush()

    # Jogo 1: Finalizado (2x0 para Time 1)
    c_fin = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_1.id_equipe,
        id_equipe_visitante=t_2.id_equipe,
        placar_mandante=2,
        placar_visitante=0,
        status="Finalizado",
        id_equipe_vencedora=t_1.id_equipe,
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 2),
        hora=time(10, 0),
    )
    # Jogo 2: Agendado
    c_agd = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_1.id_equipe,
        id_equipe_visitante=t_3.id_equipe,
        placar_mandante=0,
        placar_visitante=0,
        status="Agendado",
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 9),
        hora=time(10, 0),
    )
    # Jogo 3: Em Andamento
    c_and = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_2.id_equipe,
        id_equipe_visitante=t_3.id_equipe,
        placar_mandante=5,
        placar_visitante=5,
        status="Em Andamento",
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 16),
        hora=time(10, 0),
    )
    # Jogo 4: Cancelado
    c_canc = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=t_1.id_equipe,
        id_equipe_visitante=t_2.id_equipe,
        placar_mandante=0,
        placar_visitante=0,
        status="Cancelado",
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        data=date(2026, 9, 23),
        hora=time(10, 0),
    )
    db.add_all([c_fin, c_agd, c_and, c_canc])
    db.commit()

    res = calcular_classificacao_equipes(db, comp.id_competicao)

    assert res["confrontos_disputados"] == 1
    tab = {item["nome_equipe"]: item for item in res["classificacao"]}

    assert tab["Time 1"]["jogos"] == 1
    assert tab["Time 1"]["pontos"] == 3
    assert tab["Time 1"]["saldo_gols"] == 2

    assert tab["Time 2"]["jogos"] == 1
    assert tab["Time 2"]["pontos"] == 0
    assert tab["Time 2"]["saldo_gols"] == -2

    assert tab["Time 3"]["jogos"] == 0
    assert tab["Time 3"]["pontos"] == 0
    assert tab["Time 3"]["aproveitamento"] == 0.0
