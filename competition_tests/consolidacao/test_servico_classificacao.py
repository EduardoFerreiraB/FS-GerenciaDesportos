"""Testes de serviço e API de classificação esportiva (Task 6 - Fatia 2).

Cobre:
- Consulta de classificação em edições de pontos corridos (ordenação, estatísticas, desempates e empate persistente).
- Consulta de classificação em edições de grupos + mata-mata (separados por grupo).
- Retorno vazio em edições de mata-mata puro.
- Respeito estrito ao RULING R28 (placar calculado unicamente a partir de ocorrencias_partida de tipo GOL).
- Endpoints HTTP REST (/competicoes/edicoes/{id}/classificacao): 200, 401 e 404.
"""

from __future__ import annotations

import pytest

import models
from competicoes.contratos.classificacao import (
    GrupoClassificacaoDetalhe,
    LinhaClassificacao,
    TabelaClassificacaoDetalhe,
)
from competicoes.erros import NaoEncontrado
from competicoes.modelos.disputa import GrupoCompeticao
from competicoes.modelos.partidas import OcorrenciaPartida, Partida
from competicoes.servicos.classificacao import (
    calcular_tabela,
    obter_classificacao_edicao,
)
from .factories import criar_edicao_competicao, criar_equipe


# =============================================================================
# 1. Serviços: Casos de Erro e Casos de Borda
# =============================================================================

def test_obter_classificacao_edicao_nao_encontrada(db):
    """Edição inexistente deve levantar NaoEncontrado com status 404."""
    with pytest.raises(NaoEncontrado) as exc_info:
        obter_classificacao_edicao(db, id_edicao=999999)
    assert "não encontrada" in str(exc_info.value)
    assert exc_info.value.codigo == "NAO_ENCONTRADO"


def test_obter_classificacao_mata_mata_retorna_vazio(db):
    """Mata-mata puro não possui fase de grupos/pontos; retorna linhas=[] e grupos=[]."""
    edicao = criar_edicao_competicao(
        db,
        formato="MATA_MATA",
        configuracao={"formato": "MATA_MATA"},
    )
    db.commit()

    resultado = obter_classificacao_edicao(db, edicao.id_edicao_competicao)

    assert isinstance(resultado, TabelaClassificacaoDetalhe)
    assert resultado.linhas == []
    assert resultado.grupos == []
    assert resultado.possui_empate_persistente is False


# =============================================================================
# 2. Serviços: Pontos Corridos
# =============================================================================

def test_obter_classificacao_pontos_corridos_estatisticas_completas(db):
    """Calcula estatísticas completas e ignora partidas não finalizadas."""
    edicao = criar_edicao_competicao(
        db,
        formato="PONTOS_CORRIDOS",
        configuracao={"pontos_vitoria": 3, "pontos_empate": 1, "pontos_derrota": 0},
    )
    tA = criar_equipe(db, edicao, nome="Time A")
    tB = criar_equipe(db, edicao, nome="Time B")
    tC = criar_equipe(db, edicao, nome="Time C")
    tD = criar_equipe(db, edicao, nome="Time D")

    # Partidas finalizadas:
    # A vs B: A vence 2x0
    p1 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=tA.id_equipe,
        id_equipe_visitante=tB.id_equipe,
        estado="FINALIZADA",
    )
    db.add(p1)
    db.flush()
    db.add_all([
        OcorrenciaPartida(id_partida=p1.id_partida, tipo="GOL", id_equipe_beneficiada=tA.id_equipe, minuto=10),
        OcorrenciaPartida(id_partida=p1.id_partida, tipo="GOL", id_equipe_beneficiada=tA.id_equipe, minuto=30),
    ])

    # A vs C: A vence 1x0
    p2 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=tA.id_equipe,
        id_equipe_visitante=tC.id_equipe,
        estado="FINALIZADA",
    )
    db.add(p2)
    db.flush()
    db.add(OcorrenciaPartida(id_partida=p2.id_partida, tipo="GOL", id_equipe_beneficiada=tA.id_equipe, minuto=15))

    # B vs C: B vence 2x1
    p3 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=tB.id_equipe,
        id_equipe_visitante=tC.id_equipe,
        estado="FINALIZADA",
    )
    db.add(p3)
    db.flush()
    db.add_all([
        OcorrenciaPartida(id_partida=p3.id_partida, tipo="GOL", id_equipe_beneficiada=tB.id_equipe, minuto=5),
        OcorrenciaPartida(id_partida=p3.id_partida, tipo="GOL", id_equipe_beneficiada=tC.id_equipe, minuto=20),
        OcorrenciaPartida(id_partida=p3.id_partida, tipo="GOL", id_equipe_beneficiada=tB.id_equipe, minuto=40),
    ])

    # C vs D: C vence 1x0
    p4 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=tC.id_equipe,
        id_equipe_visitante=tD.id_equipe,
        estado="FINALIZADA",
    )
    db.add(p4)
    db.flush()
    db.add(OcorrenciaPartida(id_partida=p4.id_partida, tipo="GOL", id_equipe_beneficiada=tC.id_equipe, minuto=88))

    # Partida ainda agendada (D vs A) - NÃO DEVE CONTAR
    p5 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=tD.id_equipe,
        id_equipe_visitante=tA.id_equipe,
        estado="AGENDADA",
    )
    db.add(p5)
    db.commit()

    resultado = obter_classificacao_edicao(db, edicao.id_edicao_competicao)

    assert resultado.grupos is None
    assert resultado.linhas is not None
    assert len(resultado.linhas) == 4
    assert resultado.possui_empate_persistente is False

    # 1º Time A: 2 jogos, 2V, 0E, 0D, GP=3, GC=0, SG=+3, PTS=6, Apr=100.0%
    lA = resultado.linhas[0]
    assert lA.id_equipe == tA.id_equipe
    assert lA.nome_equipe == "Time A"
    assert lA.posicao == 1
    assert lA.jogos == 2
    assert lA.vitorias == 2
    assert lA.empates == 0
    assert lA.derrotas == 0
    assert lA.gols_pro == 3
    assert lA.gols_contra == 0
    assert lA.saldo_gols == 3
    assert lA.pontos == 6
    assert lA.aproveitamento == 100.0
    assert lA.empate_persistente is False

    # 2º Time B: 2 jogos, 1V, 0E, 1D, GP=2, GC=3, SG=-1, PTS=3
    lB = resultado.linhas[1]
    assert lB.id_equipe == tB.id_equipe
    assert lB.posicao == 2
    assert lB.pontos == 3
    assert lB.saldo_gols == -1

    # 3º Time C: 3 jogos, 1V, 0E, 2D, GP=2, GC=3, SG=-1, PTS=3 (Time B venceu C no confronto direto)
    lC = resultado.linhas[2]
    assert lC.id_equipe == tC.id_equipe
    assert lC.posicao == 3
    assert lC.pontos == 3

    # 4º Time D: 1 jogo, 0V, 0E, 1D, GP=0, GC=1, SG=-1, PTS=0
    lD = resultado.linhas[3]
    assert lD.id_equipe == tD.id_equipe
    assert lD.posicao == 4
    assert lD.pontos == 0


def test_obter_classificacao_pontos_corridos_empate_persistente(db):
    """Duas equipes que empataram entre si em 0x0 sem outras partidas mantém empate persistente."""
    edicao = criar_edicao_competicao(db, formato="PONTOS_CORRIDOS")
    t1 = criar_equipe(db, edicao, nome="Equipe Um")
    t2 = criar_equipe(db, edicao, nome="Equipe Dois")

    partida = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=t1.id_equipe,
        id_equipe_visitante=t2.id_equipe,
        estado="FINALIZADA",
    )
    db.add(partida)
    db.commit()

    resultado = obter_classificacao_edicao(db, edicao.id_edicao_competicao)

    assert resultado.possui_empate_persistente is True
    assert len(resultado.linhas) == 2
    for linha in resultado.linhas:
        assert linha.posicao == 1
        assert linha.pontos == 1
        assert linha.jogos == 1
        assert linha.empates == 1
        assert linha.empate_persistente is True


# =============================================================================
# 3. Serviços: Grupos + Mata-Mata
# =============================================================================

def test_obter_classificacao_grupos_separados(db):
    """Classificação para GRUPOS_MATA_MATA deve retornar grupos isolados com suas próprias tabelas."""
    edicao = criar_edicao_competicao(db, formato="GRUPOS_MATA_MATA")

    gA = GrupoCompeticao(id_edicao_competicao=edicao.id_edicao_competicao, nome="Grupo A", ordem=1)
    gB = GrupoCompeticao(id_edicao_competicao=edicao.id_edicao_competicao, nome="Grupo B", ordem=2)
    db.add_all([gA, gB])
    db.flush()

    # Equipes Grupo A
    tA1 = criar_equipe(db, edicao, nome="Time A1", id_grupo=gA.id_grupo)
    tA2 = criar_equipe(db, edicao, nome="Time A2", id_grupo=gA.id_grupo)

    # Equipes Grupo B
    tB1 = criar_equipe(db, edicao, nome="Time B1", id_grupo=gB.id_grupo)
    tB2 = criar_equipe(db, edicao, nome="Time B2", id_grupo=gB.id_grupo)

    # Jogo Grupo A: A1 2x1 A2
    pA = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_grupo=gA.id_grupo,
        id_equipe_mandante=tA1.id_equipe,
        id_equipe_visitante=tA2.id_equipe,
        estado="FINALIZADA",
    )
    db.add(pA)
    db.flush()
    db.add_all([
        OcorrenciaPartida(id_partida=pA.id_partida, tipo="GOL", id_equipe_beneficiada=tA1.id_equipe),
        OcorrenciaPartida(id_partida=pA.id_partida, tipo="GOL", id_equipe_beneficiada=tA2.id_equipe),
        OcorrenciaPartida(id_partida=pA.id_partida, tipo="GOL", id_equipe_beneficiada=tA1.id_equipe),
    ])

    # Jogo Grupo B: B1 0x3 B2
    pB = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_grupo=gB.id_grupo,
        id_equipe_mandante=tB1.id_equipe,
        id_equipe_visitante=tB2.id_equipe,
        estado="FINALIZADA",
    )
    db.add(pB)
    db.flush()
    db.add_all([
        OcorrenciaPartida(id_partida=pB.id_partida, tipo="GOL", id_equipe_beneficiada=tB2.id_equipe),
        OcorrenciaPartida(id_partida=pB.id_partida, tipo="GOL", id_equipe_beneficiada=tB2.id_equipe),
        OcorrenciaPartida(id_partida=pB.id_partida, tipo="GOL", id_equipe_beneficiada=tB2.id_equipe),
    ])
    db.commit()

    resultado = obter_classificacao_edicao(db, edicao.id_edicao_competicao)

    assert resultado.linhas is None
    assert resultado.grupos is not None
    assert len(resultado.grupos) == 2

    grupo_a = resultado.grupos[0]
    assert isinstance(grupo_a, GrupoClassificacaoDetalhe)
    assert grupo_a.id_grupo == gA.id_grupo
    assert grupo_a.nome == "Grupo A"
    assert len(grupo_a.linhas) == 2
    assert grupo_a.linhas[0].id_equipe == tA1.id_equipe
    assert grupo_a.linhas[0].pontos == 3
    assert grupo_a.linhas[1].id_equipe == tA2.id_equipe
    assert grupo_a.linhas[1].pontos == 0

    grupo_b = resultado.grupos[1]
    assert isinstance(grupo_b, GrupoClassificacaoDetalhe)
    assert grupo_b.id_grupo == gB.id_grupo
    assert grupo_b.nome == "Grupo B"
    assert len(grupo_b.linhas) == 2
    assert grupo_b.linhas[0].id_equipe == tB2.id_equipe
    assert grupo_b.linhas[0].pontos == 3
    assert grupo_b.linhas[0].saldo_gols == 3
    assert grupo_b.linhas[1].id_equipe == tB1.id_equipe
    assert grupo_b.linhas[1].pontos == 0


# =============================================================================
# 4. RULING R28: Agregação Estrita de Ocorrências GOL
# =============================================================================

def test_ruling_r28_placar_estritamente_por_ocorrencias_gol(db):
    """Garante que o placar é 100% derivado de ocorrencias_partida com tipo GOL."""
    edicao = criar_edicao_competicao(db, formato="PONTOS_CORRIDOS")
    t1 = criar_equipe(db, edicao, nome="Time 1")
    t2 = criar_equipe(db, edicao, nome="Time 2")

    partida = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=t1.id_equipe,
        id_equipe_visitante=t2.id_equipe,
        estado="FINALIZADA",
    )
    db.add(partida)
    db.flush()

    # Inserção de 4 gols: 3 para Time 1 e 1 para Time 2
    db.add_all([
        OcorrenciaPartida(id_partida=partida.id_partida, tipo="GOL", id_equipe_beneficiada=t1.id_equipe, minuto=12),
        OcorrenciaPartida(id_partida=partida.id_partida, tipo="GOL", id_equipe_beneficiada=t2.id_equipe, minuto=25),
        OcorrenciaPartida(id_partida=partida.id_partida, tipo="GOL", id_equipe_beneficiada=t1.id_equipe, minuto=60),
        OcorrenciaPartida(id_partida=partida.id_partida, tipo="GOL", id_equipe_beneficiada=t1.id_equipe, minuto=89),
    ])
    db.commit()

    resultado = obter_classificacao_edicao(db, edicao.id_edicao_competicao)

    l1 = next(l for l in resultado.linhas if l.id_equipe == t1.id_equipe)
    l2 = next(l for l in resultado.linhas if l.id_equipe == t2.id_equipe)

    assert l1.gols_pro == 3
    assert l1.gols_contra == 1
    assert l1.saldo_gols == 2
    assert l1.vitorias == 1
    assert l1.pontos == 3

    assert l2.gols_pro == 1
    assert l2.gols_contra == 3
    assert l2.saldo_gols == -2
    assert l2.derrotas == 1
    assert l2.pontos == 0


# =============================================================================
# 5. Helper calcular_tabela
# =============================================================================

def test_helper_calcular_tabela_delegacao_pura():
    """Valida que calcular_tabela delega ao motor aceitando dicts em memória."""
    equipes = [
        {"id_equipe": 10, "nome_equipe": "Alfa"},
        {"id_equipe": 20, "nome_equipe": "Beta"},
    ]
    partidas = [
        {
            "id_equipe_mandante": 10,
            "id_equipe_visitante": 20,
            "gols_mandante": 1,
            "gols_visitante": 0,
            "estado": "FINALIZADA",
        }
    ]
    linhas = calcular_tabela(equipes=equipes, partidas=partidas)
    assert len(linhas) == 2
    assert linhas[0].id_equipe == 10
    assert linhas[0].pontos == 3
    assert linhas[1].id_equipe == 20
    assert linhas[1].pontos == 0


# =============================================================================
# 6. Endpoints REST (/competicoes/edicoes/{id}/classificacao)
# =============================================================================

def test_endpoint_obter_classificacao_sucesso(client, cabecalhos_por_papel, db):
    """GET /competicoes/edicoes/{id}/classificacao autenticado retorna 200 com a tabela."""
    edicao = criar_edicao_competicao(db, formato="PONTOS_CORRIDOS")
    t1 = criar_equipe(db, edicao, nome="Time HTTP 1")
    t2 = criar_equipe(db, edicao, nome="Time HTTP 2")

    partida = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=t1.id_equipe,
        id_equipe_visitante=t2.id_equipe,
        estado="FINALIZADA",
    )
    db.add(partida)
    db.flush()
    db.add(OcorrenciaPartida(id_partida=partida.id_partida, tipo="GOL", id_equipe_beneficiada=t1.id_equipe))
    db.commit()

    resp = client.get(
        f"/competicoes/edicoes/{edicao.id_edicao_competicao}/classificacao",
        headers=cabecalhos_por_papel("professor"),
    )

    assert resp.status_code == 200
    dados = resp.json()
    assert "linhas" in dados
    assert "possui_empate_persistente" in dados
    assert len(dados["linhas"]) == 2
    assert dados["linhas"][0]["nome_equipe"] == "Time HTTP 1"
    assert dados["linhas"][0]["pontos"] == 3


def test_endpoint_obter_classificacao_404_edicao_inexistente(client, cabecalhos_por_papel):
    """GET para edição inexistente retorna 404 padronizado."""
    resp = client.get(
        "/competicoes/edicoes/999999/classificacao",
        headers=cabecalhos_por_papel("professor"),
    )
    assert resp.status_code == 404
    dados = resp.json()
    assert dados["codigo"] == "NAO_ENCONTRADO"


def test_endpoint_obter_classificacao_401_nao_autenticado(client, db):
    """GET sem cabeçalho Authorization deve retornar 401."""
    edicao = criar_edicao_competicao(db, formato="PONTOS_CORRIDOS")
    db.commit()

    resp = client.get(f"/competicoes/edicoes/{edicao.id_edicao_competicao}/classificacao")
    assert resp.status_code == 401
