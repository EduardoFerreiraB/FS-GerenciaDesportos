"""Testes para o Motor de Classificação & Artilharia V2.

Cobre:
- calcular_classificacao_v2:
  - Pontos Corridos com ordenação dinâmica por critérios de desempate
    (pontos, vitorias, saldo_gols, gols_pro, confronto_direto, menos_cartoes, nome)
  - Grupos + Mata-Mata com tabelas por grupo, classificados_por_grupo e eliminatórias
  - Mata-Mata com ida/volta, pênaltis, campeão, vice e 3º colocado
- obter_artilharia_v2:
  - Consolidação de gols a partir de OcorrenciaPartida (tipo == 'GOL')
  - Exclusão de gols contra (GOL_CONTRA)
  - Ordenação por gols DESC, nome ASC
- obter_disciplinar_v2:
  - Contagem de cartões amarelos e vermelhos por jogador e por equipe
  - Identificação de atletas suspensos (vermelho direto ou acúmulo de amarelos)
- Tratamento de exceções (CompeticaoNaoEncontradaError, ModoCompeticaoInvalidoError)
"""

from datetime import date, time
import pytest

import models
from app.services.classificacao_v2 import (
    calcular_classificacao_v2,
    obter_artilharia_v2,
    obter_disciplinar_v2,
    CompeticaoNaoEncontradaError,
    ModoCompeticaoInvalidoError,
)


def _criar_base_cenario(db):
    """Cria modalidade, local e árbitro para os confrontos."""
    modalidade = models.Modalidade(nome="Futebol V2", duracao_minutos=90)
    local = models.Local(loca_nome="Estádio Central", loca_descricao="Campo A")
    arbitro = models.Arbitro(apito_nome="Árbitro V2", apito_doc="DOC-12345", apito_tel="11988887777")
    db.add_all([modalidade, local, arbitro])
    db.commit()
    db.refresh(modalidade)
    db.refresh(local)
    db.refresh(arbitro)
    return modalidade, local, arbitro


# ==============================================================================
# 1. TESTES DE PONTOS CORRIDOS & CRITÉRIOS DE DESEMPATE DINÂMICOS
# ==============================================================================

def test_calcular_classificacao_pontos_corridos_basico(db):
    """Valida o cálculo completo dos pontos corridos (J, V, E, D, GP, GC, SG, PTS, aproveitamento)."""
    modalidade, local, arbitro = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Brasileirão V2",
        categoria="Principal",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        regras_formato={
            "turno_e_returno": False,
            "vitoria_pontos": 3,
            "empate_pontos": 1,
            "derrota_pontos": 0,
            "criterios_desempate": ["pontos", "vitorias", "saldo_gols", "gols_pro"],
        },
        status="EM_ANDAMENTO",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    # 4 equipes
    eq_fla = models.Equipe(nome="Flamengo", id_competicao=comp.id_competicao)
    eq_pal = models.Equipe(nome="Palmeiras", id_competicao=comp.id_competicao)
    eq_cor = models.Equipe(nome="Corinthians", id_competicao=comp.id_competicao)
    eq_sao = models.Equipe(nome="São Paulo", id_competicao=comp.id_competicao)
    db.add_all([eq_fla, eq_pal, eq_cor, eq_sao])
    db.commit()

    # Partidas:
    # Rodada 1: FLA 3 x 0 PAL (Finalizado)
    # Rodada 1: COR 1 x 1 SAO (Finalizado)
    # Rodada 2: FLA 2 x 1 COR (Finalizado)
    # Rodada 2: PAL x SAO (Agendado - não deve contar)
    c1 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_fla.id_equipe,
        id_equipe_visitante=eq_pal.id_equipe,
        data=date(2026, 9, 1),
        hora=time(16, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=3,
        placar_visitante=0,
        status="Finalizado",
    )
    c2 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_cor.id_equipe,
        id_equipe_visitante=eq_sao.id_equipe,
        data=date(2026, 9, 1),
        hora=time(16, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=1,
        placar_visitante=1,
        status="Finalizado",
    )
    c3 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_fla.id_equipe,
        id_equipe_visitante=eq_cor.id_equipe,
        data=date(2026, 9, 8),
        hora=time(16, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=2,
        placar_visitante=1,
        status="Finalizado",
    )
    c4 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_pal.id_equipe,
        id_equipe_visitante=eq_sao.id_equipe,
        data=date(2026, 9, 8),
        hora=time(16, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=0,
        placar_visitante=0,
        status="Agendado",
    )
    db.add_all([c1, c2, c3, c4])
    db.commit()

    resultado = calcular_classificacao_v2(db, comp.id_competicao)

    assert resultado["id_competicao"] == comp.id_competicao
    assert resultado["formato"] == "PONTOS_CORRIDOS"
    assert resultado["total_equipes"] == 4
    assert resultado["confrontos_disputados"] == 3

    tabela = resultado["classificacao"]
    assert len(tabela) == 4

    # 1º Lugar: Flamengo (2J, 2V, 0E, 0D, 5GP, 1GC, +4SG, 6PTS, 100% aprov)
    assert tabela[0]["nome_equipe"] == "Flamengo"
    assert tabela[0]["posicao"] == 1
    assert tabela[0]["jogos"] == 2
    assert tabela[0]["vitorias"] == 2
    assert tabela[0]["empates"] == 0
    assert tabela[0]["derrotas"] == 0
    assert tabela[0]["gols_pro"] == 5
    assert tabela[0]["gols_contra"] == 1
    assert tabela[0]["saldo_gols"] == 4
    assert tabela[0]["pontos"] == 6
    assert tabela[0]["aproveitamento"] == 100.0

    # 2º Lugar: São Paulo (1J, 0V, 1E, 0D, 1GP, 1GC, 0SG, 1PTS, 33.33% aprov)
    # 3º Lugar: Corinthians (2J, 0V, 1E, 1D, 2GP, 3GC, -1SG, 1PTS, 16.67% aprov)
    assert tabela[1]["nome_equipe"] == "São Paulo"
    assert tabela[1]["posicao"] == 2
    assert tabela[1]["saldo_gols"] == 0
    assert tabela[1]["pontos"] == 1

    assert tabela[2]["nome_equipe"] == "Corinthians"
    assert tabela[2]["posicao"] == 3
    assert tabela[2]["saldo_gols"] == -1
    assert tabela[2]["pontos"] == 1

    # 4º Lugar: Palmeiras (1J, 0V, 0E, 1D, 0GP, 3GC, -3SG, 0PTS, 0.0% aprov)
    assert tabela[3]["nome_equipe"] == "Palmeiras"
    assert tabela[3]["posicao"] == 4
    assert tabela[3]["pontos"] == 0


def test_calcular_classificacao_desempate_confronto_direto(db):
    """Valida o critério de desempate por confronto direto quando equipes têm mesmos pontos."""
    modalidade, local, arbitro = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Torneio Triangular",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        regras_formato={
            "vitoria_pontos": 3,
            "empate_pontos": 1,
            "derrota_pontos": 0,
            "criterios_desempate": ["pontos", "confronto_direto", "vitorias", "saldo_gols"],
        },
        status="EM_ANDAMENTO",
    )
    db.add(comp)
    db.commit()

    eq_a = models.Equipe(nome="Time Alfa", id_competicao=comp.id_competicao)
    eq_b = models.Equipe(nome="Time Beta", id_competicao=comp.id_competicao)
    eq_c = models.Equipe(nome="Time Gama", id_competicao=comp.id_competicao)
    db.add_all([eq_a, eq_b, eq_c])
    db.commit()

    # Alfa 2 x 1 Beta (Alfa venceu Beta)
    c1 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_a.id_equipe,
        id_equipe_visitante=eq_b.id_equipe,
        data=date(2026, 9, 1),
        hora=time(10, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=2,
        placar_visitante=1,
        status="Finalizado",
    )
    # Alfa 1 x 0 Gama
    c2 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_a.id_equipe,
        id_equipe_visitante=eq_c.id_equipe,
        data=date(2026, 9, 2),
        hora=time(10, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=1,
        placar_visitante=0,
        status="Finalizado",
    )
    # Beta 2 x 0 Gama
    c3 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_b.id_equipe,
        id_equipe_visitante=eq_c.id_equipe,
        data=date(2026, 9, 3),
        hora=time(10, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=2,
        placar_visitante=0,
        status="Finalizado",
    )
    db.add_all([c1, c2, c3])
    db.commit()

    resultado = calcular_classificacao_v2(db, comp.id_competicao)
    tabela = resultado["classificacao"]
    assert tabela[0]["nome_equipe"] == "Time Alfa"
    assert tabela[1]["nome_equipe"] == "Time Beta"
    assert tabela[2]["nome_equipe"] == "Time Gama"


def test_calcular_classificacao_desempate_menos_cartoes(db):
    """Valida desempate pelo critério 'menos_cartoes' (amarelo=1, vermelho=3) quando tudo mais empata."""
    modalidade, local, arbitro = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Copa Fair Play",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        regras_formato={
            "criterios_desempate": ["pontos", "saldo_gols", "gols_pro", "confronto_direto", "menos_cartoes", "nome"],
        },
        status="EM_ANDAMENTO",
    )
    db.add(comp)
    db.commit()

    eq_limpo = models.Equipe(nome="Time Limpo", id_competicao=comp.id_competicao)
    eq_falta = models.Equipe(nome="Time Faltoso", id_competicao=comp.id_competicao)
    db.add_all([eq_limpo, eq_falta])
    db.commit()

    j_limpo = models.Jogador(id_equipe=eq_limpo.id_equipe, nome="Atleta Limpo", numero_camisa=10)
    j_falta = models.Jogador(id_equipe=eq_falta.id_equipe, nome="Atleta Duro", numero_camisa=5)
    db.add_all([j_limpo, j_falta])
    db.commit()

    # Jogo entre os dois termina 1 x 1
    conf = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_limpo.id_equipe,
        id_equipe_visitante=eq_falta.id_equipe,
        data=date(2026, 9, 1),
        hora=time(15, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=1,
        placar_visitante=1,
        status="Finalizado",
    )
    db.add(conf)
    db.commit()

    # Time Limpo: 1 cartão amarelo (1 pt)
    # Time Faltoso: 1 cartão vermelho (3 pts)
    oc_amarelo = models.OcorrenciaPartida(
        id_confronto=conf.id_confronto,
        id_equipe=eq_limpo.id_equipe,
        id_jogador=j_limpo.id_jogador,
        tipo="CARTAO_AMARELO",
        minuto=20,
    )
    oc_vermelho = models.OcorrenciaPartida(
        id_confronto=conf.id_confronto,
        id_equipe=eq_falta.id_equipe,
        id_jogador=j_falta.id_jogador,
        tipo="CARTAO_VERMELHO",
        minuto=40,
    )
    db.add_all([oc_amarelo, oc_vermelho])
    db.commit()

    resultado = calcular_classificacao_v2(db, comp.id_competicao)
    tabela = resultado["classificacao"]

    assert tabela[0]["nome_equipe"] == "Time Limpo"
    assert tabela[0]["posicao"] == 1
    assert tabela[1]["nome_equipe"] == "Time Faltoso"
    assert tabela[1]["posicao"] == 2


# ==============================================================================
# 2. TESTES DE FORMATO GRUPOS_MATA_MATA
# ==============================================================================

def test_calcular_classificacao_grupos_mata_mata(db):
    """Valida apuração por grupos, corte de classificados_por_grupo e árvore do mata-mata."""
    modalidade, local, arbitro = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Copa dos Campeões V2",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="GRUPOS",
        regras_formato={
            "qtd_grupos": 2,
            "classificados_por_grupo": 2,
            "criterios_desempate": ["pontos", "saldo_gols", "gols_pro", "nome"],
        },
        status="EM_ANDAMENTO",
    )
    db.add(comp)
    db.commit()

    # Grupo A: A1, A2, A3
    a1 = models.Equipe(nome="Time A1", grupo="A", id_competicao=comp.id_competicao)
    a2 = models.Equipe(nome="Time A2", grupo="A", id_competicao=comp.id_competicao)
    a3 = models.Equipe(nome="Time A3", grupo="A", id_competicao=comp.id_competicao)

    # Grupo B: B1, B2, B3
    b1 = models.Equipe(nome="Time B1", grupo="B", id_competicao=comp.id_competicao)
    b2 = models.Equipe(nome="Time B2", grupo="B", id_competicao=comp.id_competicao)
    b3 = models.Equipe(nome="Time B3", grupo="B", id_competicao=comp.id_competicao)

    db.add_all([a1, a2, a3, b1, b2, b3])
    db.commit()

    # Jogos Grupo A:
    # A1 3 x 0 A2
    # A1 2 x 0 A3
    # A2 1 x 0 A3
    ja1 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=a1.id_equipe, id_equipe_visitante=a2.id_equipe,
        data=date(2026, 9, 1), hora=time(14, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=3, placar_visitante=0, grupo="A", status="Finalizado", fase="Fase de Grupos"
    )
    ja2 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=a1.id_equipe, id_equipe_visitante=a3.id_equipe,
        data=date(2026, 9, 2), hora=time(14, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=2, placar_visitante=0, grupo="A", status="Finalizado", fase="Fase de Grupos"
    )
    ja3 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=a2.id_equipe, id_equipe_visitante=a3.id_equipe,
        data=date(2026, 9, 3), hora=time(14, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=1, placar_visitante=0, grupo="A", status="Finalizado", fase="Fase de Grupos"
    )

    # Jogos Grupo B:
    # B1 2 x 1 B2
    # B2 4 x 0 B3
    jb1 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=b1.id_equipe, id_equipe_visitante=b2.id_equipe,
        data=date(2026, 9, 1), hora=time(16, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=2, placar_visitante=1, grupo="B", status="Finalizado", fase="Fase de Grupos"
    )
    jb2 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=b2.id_equipe, id_equipe_visitante=b3.id_equipe,
        data=date(2026, 9, 2), hora=time(16, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=4, placar_visitante=0, grupo="B", status="Finalizado", fase="Fase de Grupos"
    )

    # Fase Eliminatória: Semifinal A1 x B2
    semi = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=a1.id_equipe, id_equipe_visitante=b2.id_equipe,
        data=date(2026, 9, 10), hora=time(18, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=2, placar_visitante=1, status="Finalizado", fase="Semifinal", id_equipe_vencedora=a1.id_equipe
    )

    db.add_all([ja1, ja2, ja3, jb1, jb2, semi])
    db.commit()

    resultado = calcular_classificacao_v2(db, comp.id_competicao)

    assert "grupos" in resultado
    assert "A" in resultado["grupos"]
    assert "B" in resultado["grupos"]

    # Grupo A:
    tab_a = resultado["grupos"]["A"]
    assert len(tab_a) == 3
    assert tab_a[0]["nome_equipe"] == "Time A1"
    assert tab_a[0]["posicao"] == 1
    assert tab_a[0]["classificado"] is True
    assert tab_a[1]["nome_equipe"] == "Time A2"
    assert tab_a[1]["posicao"] == 2
    assert tab_a[1]["classificado"] is True
    assert tab_a[2]["nome_equipe"] == "Time A3"
    assert tab_a[2]["classificado"] is False

    # Checa lista agregada de classificados
    assert len(resultado["classificados"]) == 4  # 2 de A + 2 de B
    classificados_a_nomes = [t["nome_equipe"] for t in resultado["classificados"] if t["grupo"] == "A"]
    assert "Time A1" in classificados_a_nomes
    assert "Time A2" in classificados_a_nomes

    # Checa chaveamento eliminatório
    assert "fase_eliminatoria" in resultado
    assert resultado["fase_eliminatoria"]["total_confrontos"] >= 1


# ==============================================================================
# 3. TESTES DE MATA-MATA DIRETO (IDA/VOLTA, PÊNALTIS E 3º LUGAR)
# ==============================================================================

def test_calcular_classificacao_mata_mata_completo(db):
    """Valida mata-mata com campeão, vice, disputa de 3º lugar e pênaltis."""
    modalidade, local, arbitro = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Copa Mata-Mata V2",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="MATA_MATA",
        regras_formato={
            "fase_inicial": "SEMIFINAL",
            "disputa_terceiro_lugar": True,
            "penaltis_desempate": True,
        },
        status="FINALIZADA",
    )
    db.add(comp)
    db.commit()

    eq1 = models.Equipe(nome="Equipe Ouro", id_competicao=comp.id_competicao)
    eq2 = models.Equipe(nome="Equipe Prata", id_competicao=comp.id_competicao)
    eq3 = models.Equipe(nome="Equipe Bronze", id_competicao=comp.id_competicao)
    eq4 = models.Equipe(nome="Equipe Quarto", id_competicao=comp.id_competicao)
    db.add_all([eq1, eq2, eq3, eq4])
    db.commit()

    # Semifinal 1: Ouro 3 x 1 Bronze
    s1 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=eq1.id_equipe, id_equipe_visitante=eq3.id_equipe,
        data=date(2026, 9, 5), hora=time(15, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=3, placar_visitante=1, status="Finalizado", fase="Semifinal", id_equipe_vencedora=eq1.id_equipe
    )
    # Semifinal 2: Prata 2 x 0 Quarto
    s2 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=eq2.id_equipe, id_equipe_visitante=eq4.id_equipe,
        data=date(2026, 9, 5), hora=time(17, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=2, placar_visitante=0, status="Finalizado", fase="Semifinal", id_equipe_vencedora=eq2.id_equipe
    )
    # Disputa 3º Lugar: Bronze 2 x 2 Quarto (Pênaltis: 4 x 3 para Bronze)
    disp3 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=eq3.id_equipe, id_equipe_visitante=eq4.id_equipe,
        data=date(2026, 9, 12), hora=time(15, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=2, placar_visitante=2, penaltis_mandante=4, penaltis_visitante=3,
        status="Finalizado", fase="3º Lugar", id_equipe_vencedora=eq3.id_equipe
    )
    # Grande Final: Ouro 1 x 0 Prata
    final = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=eq1.id_equipe, id_equipe_visitante=eq2.id_equipe,
        data=date(2026, 9, 12), hora=time(18, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=1, placar_visitante=0, status="Finalizado", fase="Final", id_equipe_vencedora=eq1.id_equipe
    )

    db.add_all([s1, s2, disp3, final])
    db.commit()

    resultado = calcular_classificacao_v2(db, comp.id_competicao)

    assert resultado["campeao"] is not None
    assert resultado["campeao"]["id_equipe"] == eq1.id_equipe
    assert resultado["campeao"]["nome_equipe"] == "Equipe Ouro"

    assert resultado["vice_campeao"] is not None
    assert resultado["vice_campeao"]["id_equipe"] == eq2.id_equipe
    assert resultado["vice_campeao"]["nome_equipe"] == "Equipe Prata"

    assert resultado["terceiro_colocado"] is not None
    assert resultado["terceiro_colocado"]["id_equipe"] == eq3.id_equipe
    assert resultado["terceiro_colocado"]["nome_equipe"] == "Equipe Bronze"

    assert len(resultado["arvore"]) == 4


# ==============================================================================
# 4. TESTES DE ARTILHARIA V2
# ==============================================================================

def test_obter_artilharia_v2(db):
    """Valida consolidação de gols, exclusão de gol contra e ordenação decrescente."""
    modalidade, local, arbitro = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Artilharia Cup",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        status="EM_ANDAMENTO",
    )
    db.add(comp)
    db.commit()

    time_x = models.Equipe(nome="Time X", id_competicao=comp.id_competicao)
    time_y = models.Equipe(nome="Time Y", id_competicao=comp.id_competicao)
    db.add_all([time_x, time_y])
    db.commit()

    artilheiro_top = models.Jogador(id_equipe=time_x.id_equipe, nome="Goleador Máximo", numero_camisa=9)
    vice_artilheiro = models.Jogador(id_equipe=time_y.id_equipe, nome="Segundo Artilheiro", numero_camisa=11)
    zagueiro_azazarado = models.Jogador(id_equipe=time_x.id_equipe, nome="Zagueiro Gol Contra", numero_camisa=4)
    db.add_all([artilheiro_top, vice_artilheiro, zagueiro_azazarado])
    db.commit()

    conf = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=time_x.id_equipe, id_equipe_visitante=time_y.id_equipe,
        data=date(2026, 9, 1), hora=time(16, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=3, placar_visitante=2, status="Finalizado"
    )
    db.add(conf)
    db.commit()

    # Ocorrências:
    # Goleador Máximo marca 3 gols
    # Segundo Artilheiro marca 2 gols
    # Zagueiro marca 1 GOL_CONTRA (NÃO deve ser contabilizado na artilharia positiva!)
    gols = [
        models.OcorrenciaPartida(id_confronto=conf.id_confronto, id_equipe=time_x.id_equipe, id_jogador=artilheiro_top.id_jogador, tipo="GOL", minuto=10),
        models.OcorrenciaPartida(id_confronto=conf.id_confronto, id_equipe=time_x.id_equipe, id_jogador=artilheiro_top.id_jogador, tipo="GOL", minuto=25),
        models.OcorrenciaPartida(id_confronto=conf.id_confronto, id_equipe=time_x.id_equipe, id_jogador=artilheiro_top.id_jogador, tipo="GOL", minuto=70),
        models.OcorrenciaPartida(id_confronto=conf.id_confronto, id_equipe=time_y.id_equipe, id_jogador=vice_artilheiro.id_jogador, tipo="GOL", minuto=30),
        models.OcorrenciaPartida(id_confronto=conf.id_confronto, id_equipe=time_y.id_equipe, id_jogador=vice_artilheiro.id_jogador, tipo="GOL", minuto=80),
        models.OcorrenciaPartida(id_confronto=conf.id_confronto, id_equipe=time_x.id_equipe, id_jogador=zagueiro_azazarado.id_jogador, tipo="GOL_CONTRA", minuto=85),
    ]
    db.add_all(gols)
    db.commit()

    artilharia = obter_artilharia_v2(db, comp.id_competicao)

    assert len(artilharia) == 2  # Apenas Goleador Máximo e Segundo Artilheiro

    # 1º lugar: Goleador Máximo com 3 gols
    assert artilharia[0]["posicao"] == 1
    assert artilharia[0]["id_jogador"] == artilheiro_top.id_jogador
    assert artilharia[0]["nome_jogador"] == "Goleador Máximo"
    assert artilharia[0]["nome_equipe"] == "Time X"
    assert artilharia[0]["gols"] == 3

    # 2º lugar: Segundo Artilheiro com 2 gols
    assert artilharia[1]["posicao"] == 2
    assert artilharia[1]["id_jogador"] == vice_artilheiro.id_jogador
    assert artilharia[1]["gols"] == 2


# ==============================================================================
# 5. TESTES DE CONTROLE DISCIPLINAR & SUSPENSÕES V2
# ==============================================================================

def test_obter_disciplinar_v2(db):
    """Valida agregação de cartões e identificação de atletas suspensos."""
    modalidade, local, arbitro = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Liga Disciplinar",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        status="EM_ANDAMENTO",
    )
    db.add(comp)
    db.commit()

    eq_vermelha = models.Equipe(nome="Time Raça", id_competicao=comp.id_competicao)
    eq_amarela = models.Equipe(nome="Time Falta", id_competicao=comp.id_competicao)
    db.add_all([eq_vermelha, eq_amarela])
    db.commit()

    j_expulso = models.Jogador(id_equipe=eq_vermelha.id_equipe, nome="Atleta Expulso", numero_camisa=3)
    j_pendurado = models.Jogador(id_equipe=eq_amarela.id_equipe, nome="Atleta 3 Amarelos", numero_camisa=8)
    j_com_um = models.Jogador(id_equipe=eq_amarela.id_equipe, nome="Atleta 1 Amarelo", numero_camisa=10)
    db.add_all([j_expulso, j_pendurado, j_com_um])
    db.commit()

    c1 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=eq_vermelha.id_equipe, id_equipe_visitante=eq_amarela.id_equipe,
        data=date(2026, 9, 1), hora=time(16, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=0, placar_visitante=0, status="Finalizado"
    )
    c2 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=eq_amarela.id_equipe, id_equipe_visitante=eq_vermelha.id_equipe,
        data=date(2026, 9, 8), hora=time(16, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=0, placar_visitante=0, status="Finalizado"
    )
    c3 = models.Confronto(
        id_competicao=comp.id_competicao, id_equipe_mandante=eq_vermelha.id_equipe, id_equipe_visitante=eq_amarela.id_equipe,
        data=date(2026, 9, 15), hora=time(16, 0), id_local=local.id_local, id_arbitro=arbitro.id_arbitro,
        placar_mandante=0, placar_visitante=0, status="Finalizado"
    )
    db.add_all([c1, c2, c3])
    db.commit()

    # j_expulso: recebe 1 cartão vermelho no jogo 1
    # j_pendurado: recebe 1 amarelo no jogo 1, 1 amarelo no jogo 2, 1 amarelo no jogo 3 (total = 3 amarelos)
    # j_com_um: recebe 1 amarelo no jogo 2
    cartoes = [
        models.OcorrenciaPartida(id_confronto=c1.id_confronto, id_equipe=eq_vermelha.id_equipe, id_jogador=j_expulso.id_jogador, tipo="CARTAO_VERMELHO", minuto=15),
        models.OcorrenciaPartida(id_confronto=c1.id_confronto, id_equipe=eq_amarela.id_equipe, id_jogador=j_pendurado.id_jogador, tipo="CARTAO_AMARELO", minuto=20),
        models.OcorrenciaPartida(id_confronto=c2.id_confronto, id_equipe=eq_amarela.id_equipe, id_jogador=j_pendurado.id_jogador, tipo="CARTAO_AMARELO", minuto=50),
        models.OcorrenciaPartida(id_confronto=c3.id_confronto, id_equipe=eq_amarela.id_equipe, id_jogador=j_pendurado.id_jogador, tipo="CARTAO_AMARELO", minuto=60),
        models.OcorrenciaPartida(id_confronto=c2.id_confronto, id_equipe=eq_amarela.id_equipe, id_jogador=j_com_um.id_jogador, tipo="CARTAO_AMARELO", minuto=75),
    ]
    db.add_all(cartoes)
    db.commit()

    disciplinar = obter_disciplinar_v2(db, comp.id_competicao)

    assert "jogadores" in disciplinar
    assert "equipes" in disciplinar
    assert "suspensos" in disciplinar

    # Jogadores suspensos: j_expulso (vermelho) e j_pendurado (3 amarelos)
    suspensos = disciplinar["suspensos"]
    ids_suspensos = [s["id_jogador"] for s in suspensos]
    assert j_expulso.id_jogador in ids_suspensos
    assert j_pendurado.id_jogador in ids_suspensos
    assert j_com_um.id_jogador not in ids_suspensos

    # Estatísticas por equipe
    equipes_disc = {eq["id_equipe"]: eq for eq in disciplinar["equipes"]}
    assert equipes_disc[eq_vermelha.id_equipe]["cartoes_vermelhos"] == 1
    assert equipes_disc[eq_amarela.id_equipe]["cartoes_amarelos"] == 4


# ==============================================================================
# 6. TESTES DE EXCEÇÕES E VALIDAÇÕES
# ==============================================================================

def test_excecoes_classificacao_v2(db):
    """Garante levantamento de exceções adequadas para ID inexistente ou modo inválido."""
    with pytest.raises(CompeticaoNaoEncontradaError):
        calcular_classificacao_v2(db, 999999)

    with pytest.raises(CompeticaoNaoEncontradaError):
        obter_artilharia_v2(db, 999999)

    with pytest.raises(CompeticaoNaoEncontradaError):
        obter_disciplinar_v2(db, 999999)

    modalidade, _, _ = _criar_base_cenario(db)
    comp_ind = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Natação Individual",
        categoria="Livre",
        modo_inscricao="INDIVIDUAL",
        formato="PROVAS",
        status="EM_ANDAMENTO",
    )
    db.add(comp_ind)
    db.commit()

    with pytest.raises(ModoCompeticaoInvalidoError):
        calcular_classificacao_v2(db, comp_ind.id_competicao)


# ==============================================================================
# 7. TESTES ADICIONAIS DE COBERTURA & CASOS DE BORDA
# ==============================================================================

def test_calcular_classificacao_mata_mata_ida_e_volta_agregado_e_penaltis(db):
    """Valida mata-mata com jogos de ida e volta, placar agregado e decisão por pênaltis na volta."""
    modalidade, local, arbitro = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Copa Ida e Volta V2",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="MATA_MATA",
        regras_formato={
            "fase_inicial": "FINAL",
            "jogos_ida_volta": True,
            "penaltis_desempate": True,
        },
        status="FINALIZADA",
    )
    db.add(comp)
    db.commit()

    eq_casa = models.Equipe(nome="Time da Casa", id_competicao=comp.id_competicao)
    eq_fora = models.Equipe(nome="Time de Fora", id_competicao=comp.id_competicao)
    db.add_all([eq_casa, eq_fora])
    db.commit()

    # Jogo de Ida: Time da Casa 2 x 1 Time de Fora
    j_ida = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_casa.id_equipe,
        id_equipe_visitante=eq_fora.id_equipe,
        data=date(2026, 9, 1),
        hora=time(20, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=2,
        placar_visitante=1,
        ordem_jogo=1,
        status="Finalizado",
        fase="Final",
    )
    db.add(j_ida)
    db.commit()

    # Jogo de Volta: Time de Fora 2 x 1 Time da Casa (Agregado 3 x 3) -> Pênaltis: Fora 5 x 4 Casa
    j_volta = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_fora.id_equipe,
        id_equipe_visitante=eq_casa.id_equipe,
        data=date(2026, 9, 8),
        hora=time(20, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=2,
        placar_visitante=1,
        ordem_jogo=2,
        id_confronto_ida=j_ida.id_confronto,
        penaltis_mandante=5,
        penaltis_visitante=4,
        status="Finalizado",
        fase="Final",
    )
    db.add(j_volta)
    db.commit()

    resultado = calcular_classificacao_v2(db, comp.id_competicao)

    assert resultado["campeao"] is not None
    assert resultado["campeao"]["id_equipe"] == eq_fora.id_equipe
    assert resultado["campeao"]["nome_equipe"] == "Time de Fora"

    assert resultado["vice_campeao"] is not None
    assert resultado["vice_campeao"]["id_equipe"] == eq_casa.id_equipe
    assert resultado["vice_campeao"]["nome_equipe"] == "Time da Casa"


def test_calcular_classificacao_pontos_corridos_sem_jogos(db):
    """Valida pontuação zerada e aproveitamento 0.0 quando a competição não teve jogos finalizados."""
    modalidade, _, _ = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Campeonato Novo",
        categoria="Sub-20",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        status="CONFIGURACAO",
    )
    db.add(comp)
    db.commit()

    e1 = models.Equipe(nome="Alpha", id_competicao=comp.id_competicao)
    e2 = models.Equipe(nome="Beta", id_competicao=comp.id_competicao)
    db.add_all([e1, e2])
    db.commit()

    resultado = calcular_classificacao_v2(db, comp.id_competicao)
    assert resultado["total_equipes"] == 2
    assert resultado["confrontos_disputados"] == 0
    tabela = resultado["classificacao"]
    assert len(tabela) == 2
    assert tabela[0]["jogos"] == 0
    assert tabela[0]["pontos"] == 0
    assert tabela[0]["aproveitamento"] == 0.0


def test_obter_artilharia_empate_ordena_por_nome(db):
    """Valida desempate alfabético quando dois atletas marcam o mesmo número de gols."""
    modalidade, local, arbitro = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Torneio de Goleadores",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        status="EM_ANDAMENTO",
    )
    db.add(comp)
    db.commit()

    time_unico = models.Equipe(nome="Time Único", id_competicao=comp.id_competicao)
    time_rival = models.Equipe(nome="Time Rival", id_competicao=comp.id_competicao)
    db.add_all([time_unico, time_rival])
    db.commit()

    j_ze = models.Jogador(id_equipe=time_unico.id_equipe, nome="Zé da Silva", numero_camisa=7)
    j_andre = models.Jogador(id_equipe=time_unico.id_equipe, nome="André Silveira", numero_camisa=9)
    db.add_all([j_ze, j_andre])
    db.commit()

    conf = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=time_unico.id_equipe,
        id_equipe_visitante=time_rival.id_equipe,
        data=date(2026, 9, 1),
        hora=time(16, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=2,
        placar_visitante=0,
        status="Finalizado",
    )
    db.add(conf)
    db.commit()

    # Cada um marca 1 gol
    g1 = models.OcorrenciaPartida(id_confronto=conf.id_confronto, id_equipe=time_unico.id_equipe, id_jogador=j_ze.id_jogador, tipo="GOL", minuto=10)
    g2 = models.OcorrenciaPartida(id_confronto=conf.id_confronto, id_equipe=time_unico.id_equipe, id_jogador=j_andre.id_jogador, tipo="GOL", minuto=20)
    db.add_all([g1, g2])
    db.commit()

    artilharia = obter_artilharia_v2(db, comp.id_competicao)
    assert len(artilharia) == 2
    # Ambos têm 1 gol, André Silveira deve vir antes de Zé da Silva pelo critério alfabético
    assert artilharia[0]["nome_jogador"] == "André Silveira"
    assert artilharia[1]["nome_jogador"] == "Zé da Silva"


def test_obter_disciplinar_sem_ocorrencias(db):
    """Valida relatório disciplinar em competição sem cartões."""
    modalidade, _, _ = _criar_base_cenario(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Copa Limpa",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        status="EM_ANDAMENTO",
    )
    db.add(comp)
    db.commit()

    disciplinar = obter_disciplinar_v2(db, comp.id_competicao)
    assert disciplinar["total_amarelos"] == 0
    assert disciplinar["total_vermelhos"] == 0
    assert len(disciplinar["jogadores"]) == 0
    assert len(disciplinar["suspensos"]) == 0

