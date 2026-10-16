"""Testes unitários dos contratos e motores puros de disciplina e desempate manual (Task 3 - Fatia 3)."""

import pytest
from pydantic import ValidationError

from competicoes.contratos.configuracao import CriterioDesempate, validar_configuracao
from competicoes.contratos.disciplina import (
    CumprimentoCriar,
    CumprimentoDetalhe,
    DecisaoClassificacaoCriar,
    DecisaoClassificacaoDetalhe,
    PainelDisciplinarDetalhe,
    ResumoCartoesIntegrante,
    SuspensaoAjustar,
    SuspensaoDetalhe,
    SuspensaoManualCriar,
)
from competicoes.erros import ConfiguracaoInvalida, ConflitoEstado
from competicoes.servicos.motores.classificacao import calcular_classificacao
from competicoes.servicos.motores.disciplina import (
    calcular_hash_resultados,
    calcular_sancoes_e_cartoes,
    reconciliar_suspensoes_existentes,
    validar_elegibilidade_cumprimento,
)


def test_criterios_desempate_disciplinares_na_configuracao():
    cfg = validar_configuracao(
        "PONTOS_CORRIDOS",
        {
            "desempates": [
                "VITORIAS",
                "SALDO_GOLS",
                "GOLS_PRO",
                "MENOS_CARTOES_VERMELHOS",
                "MENOS_CARTOES_AMARELOS",
            ]
        },
    )
    assert CriterioDesempate.MENOS_CARTOES_VERMELHOS in cfg.desempates
    assert CriterioDesempate.MENOS_CARTOES_AMARELOS in cfg.desempates


def test_contratos_disciplina_validacao_estrita():
    manual = SuspensaoManualCriar(id_integrante=10, jogos=2, motivo="Atitude antidesportiva")
    assert manual.id_integrante == 10
    assert manual.jogos == 2

    with pytest.raises(ValidationError):
        SuspensaoManualCriar(id_integrante=10, jogos=0, motivo="Curto")

    with pytest.raises(ValidationError):
        SuspensaoAjustar(jogos=1, situacao="ATIVA", motivo="ab")

    decisao = DecisaoClassificacaoCriar(
        id_grupo=1,
        conjunto_equipes=[10, 20],
        ordem_escolhida=[20, 10],
        motivo="Sorteio oficial em congresso técnico",
    )
    assert decisao.ordem_escolhida == [20, 10]

    painel = PainelDisciplinarDetalhe(
        id_edicao_competicao=1,
        suspensoes=[
            SuspensaoDetalhe(
                id_suspensao=1,
                id_edicao_competicao=1,
                id_integrante=10,
                motivo="Cartão vermelho direto",
                origem="VERMELHO_DIRETO",
                chave_origem="ED1:INT10:VERM_DIR:OC100",
                jogos=1,
                jogos_cumpridos=1,
                jogos_pendentes=0,
                situacao="CUMPRIDA",
                cumprimentos=[
                    CumprimentoDetalhe(
                        id_cumprimento=1,
                        id_suspensao=1,
                        id_integrante=10,
                        id_partida=2,
                    )
                ],
            )
        ],
        resumo_cartoes=[
            ResumoCartoesIntegrante(
                id_integrante=10,
                nome_esportivo="Jogador 10",
                id_equipe=1,
                nome_equipe="Equipe 1",
                amarelos_estatisticos=2,
                amarelos_acumulo_atual=0,
                vermelhos_diretos=1,
                expulsoes_segundo_amarelo=0,
                suspenso_atualmente=False,
            )
        ],
    )
    assert len(painel.suspensoes) == 1
    assert len(painel.resumo_cartoes) == 1

    cumprimento_in = CumprimentoCriar(id_partida=5)
    assert cumprimento_in.id_partida == 5

    dec_det = DecisaoClassificacaoDetalhe(
        id_decisao=1,
        id_edicao_competicao=1,
        id_grupo=None,
        conjunto_equipes=[1, 2],
        ordem_escolhida=[2, 1],
        motivo="Sorteio",
        revisao_resultados="abc123",
        valida=True,
    )
    assert dec_det.valida is True


def test_segundo_amarelo_nao_conta_para_acumulo_de_amarelos():
    """Ruling R31 / Spec 7.4:
    Jogador tem 2 amarelos acumulados (partidas 1 e 2).
    Na partida 3, recebe 2 amarelos e é expulso por 2º amarelo (EXPULSAO_SEGUNDO_AMARELO).
    - Deve gerar suspensão por SEGUNDO_AMARELO da partida 3.
    - Os amarelos da partida 3 NÃO entram na fila de acúmulo (saldo de acúmulo continua em 2, não fecha ciclo de 3!).
    - Na partida 4, recebe 1 amarelo avulso -> agora sim atinge 3 amarelos de acúmulo e gera ACUMULO_AMARELOS (CICLO1).
    """
    partidas = [
        {"id_partida": 1, "id_grupo": 1, "rodada": 1, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
        {"id_partida": 2, "id_grupo": 1, "rodada": 2, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
        {"id_partida": 3, "id_grupo": 1, "rodada": 3, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
        {"id_partida": 4, "id_grupo": 1, "rodada": 4, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
    ]
    ocorrencias = [
        {"id_ocorrencia": 10, "id_partida": 1, "tipo": "CARTAO_AMARELO", "id_integrante": 50, "id_equipe_beneficiada": 1},
        {"id_ocorrencia": 20, "id_partida": 2, "tipo": "CARTAO_AMARELO", "id_integrante": 50, "id_equipe_beneficiada": 1},
        # Partida 3: dois amarelos -> expulsão por 2º amarelo
        {"id_ocorrencia": 30, "id_partida": 3, "tipo": "CARTAO_AMARELO", "id_integrante": 50, "id_equipe_beneficiada": 1},
        {"id_ocorrencia": 31, "id_partida": 3, "tipo": "CARTAO_AMARELO", "id_integrante": 50, "id_equipe_beneficiada": 1},
        {"id_ocorrencia": 32, "id_partida": 3, "tipo": "EXPULSAO_SEGUNDO_AMARELO", "id_integrante": 50, "id_equipe_beneficiada": 1, "id_ocorrencia_origem": 31},
    ]
    config = {
        "limite_amarelos": 3,
        "jogos_por_acumulo": 1,
        "jogos_por_vermelho": 2,
        "jogos_por_segundo_amarelo": 1,
        "zerar_amarelos_ao_encerrar_grupos": False,
    }

    # Até a partida 3: apenas 1 sanção (SEGUNDO_AMARELO) e saldo de acúmulo = 2
    res_ate_p3 = calcular_sancoes_e_cartoes(1, ocorrencias, partidas[:3], config)
    sancoes_p3 = res_ate_p3["sancoes_esperadas"]
    assert len(sancoes_p3) == 1
    assert sancoes_p3[0]["origem"] == "SEGUNDO_AMARELO"
    assert sancoes_p3[0]["chave_origem"] == "ED1:INT50:SEG_AMA:OC32"
    assert sancoes_p3[0]["id_partida_origem"] == 3
    assert sancoes_p3[0]["id_ocorrencia_origem"] == 32
    assert sancoes_p3[0]["jogos"] == 1

    est_p3 = res_ate_p3["estatisticas_integrantes"][50]
    assert est_p3["amarelos_estatisticos"] == 4
    assert est_p3["amarelos_acumulo_atual"] == 2
    assert est_p3["expulsoes_segundo_amarelo"] == 1
    assert est_p3["vermelhos_diretos"] == 0

    # Agora adiciona amarelo na partida 4 -> fecha o CICLO1 de acúmulo!
    ocorrencias.append(
        {"id_ocorrencia": 40, "id_partida": 4, "tipo": "CARTAO_AMARELO", "id_integrante": 50, "id_equipe_beneficiada": 1}
    )
    res_ate_p4 = calcular_sancoes_e_cartoes(1, ocorrencias, partidas, config)
    sancoes_p4 = res_ate_p4["sancoes_esperadas"]
    assert len(sancoes_p4) == 2
    chaves = {s["chave_origem"]: s for s in sancoes_p4}
    assert "ED1:INT50:SEG_AMA:OC32" in chaves
    assert "ED1:INT50:ACUM_AMA:CICLO1" in chaves
    assert chaves["ED1:INT50:ACUM_AMA:CICLO1"]["id_partida_origem"] == 4
    assert chaves["ED1:INT50:ACUM_AMA:CICLO1"]["id_ocorrencia_origem"] == 40

    est_p4 = res_ate_p4["estatisticas_integrantes"][50]
    assert est_p4["amarelos_estatisticos"] == 5
    assert est_p4["amarelos_acumulo_atual"] == 0


def test_zeragem_amarelos_ao_encerrar_grupos_preserva_suspensoes_anteriores():
    """Ao encerrar grupos com zerar_amarelos_ao_encerrar_grupos=True:
    - Jogador A fechou 3 amarelos nos grupos (CICLO1) e levou mais 1 amarelo residual no último jogo do grupo (saldo 1).
    - Ao encerrar grupos, o saldo residual 1 é zerado, mas a suspensão CICLO1 é preservada!
    - No mata-mata (id_duelo=10), Jogador A leva 2 amarelos -> saldo fica em 2 (não gera CICLO2 indevido!).
    """
    partidas = [
        {"id_partida": 1, "id_grupo": 1, "id_duelo": None, "rodada": 1, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
        {"id_partida": 2, "id_grupo": 1, "id_duelo": None, "rodada": 2, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
        {"id_partida": 3, "id_grupo": 1, "id_duelo": None, "rodada": 3, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
        {"id_partida": 4, "id_grupo": 1, "id_duelo": None, "rodada": 4, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
        {"id_partida": 5, "id_grupo": None, "id_duelo": 10, "rodada": 1, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
        {"id_partida": 6, "id_grupo": None, "id_duelo": 11, "rodada": 2, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 1, "id_equipe_visitante": 2},
    ]
    ocorrencias = [
        {"id_ocorrencia": 1, "id_partida": 1, "tipo": "CARTAO_AMARELO", "id_integrante": 7, "id_equipe_beneficiada": 1},
        {"id_ocorrencia": 2, "id_partida": 2, "tipo": "CARTAO_AMARELO", "id_integrante": 7, "id_equipe_beneficiada": 1},
        {"id_ocorrencia": 3, "id_partida": 3, "tipo": "CARTAO_AMARELO", "id_integrante": 7, "id_equipe_beneficiada": 1},
        {"id_ocorrencia": 4, "id_partida": 4, "tipo": "CARTAO_AMARELO", "id_integrante": 7, "id_equipe_beneficiada": 1},
        # Mata-mata:
        {"id_ocorrencia": 5, "id_partida": 5, "tipo": "CARTAO_AMARELO", "id_integrante": 7, "id_equipe_beneficiada": 1},
        {"id_ocorrencia": 6, "id_partida": 6, "tipo": "CARTAO_AMARELO", "id_integrante": 7, "id_equipe_beneficiada": 1},
    ]
    config = {
        "limite_amarelos": 3,
        "jogos_por_acumulo": 1,
        "jogos_por_vermelho": 1,
        "jogos_por_segundo_amarelo": 1,
        "zerar_amarelos_ao_encerrar_grupos": True,
    }

    res = calcular_sancoes_e_cartoes(1, ocorrencias, partidas, config, grupos_encerrados=True)
    sancoes = res["sancoes_esperadas"]
    assert len(sancoes) == 1
    assert sancoes[0]["chave_origem"] == "ED1:INT7:ACUM_AMA:CICLO1"
    assert sancoes[0]["id_partida_origem"] == 3

    est = res["estatisticas_integrantes"][7]
    assert est["amarelos_estatisticos"] == 6
    assert est["amarelos_acumulo_atual"] == 2


def test_reconciliar_suspensoes_idempotencia_e_protecao_em_revisao():
    """Quando um cartão é removido após correção de súmula:
    - Suspensão automática ainda NÃO cumprida (jogos_cumpridos=0, ATIVA) vai para para_cancelar.
    - Suspensão automática JÁ cumprida (jogos_cumpridos>0 ou CUMPRIDA) vai para para_revisao (EM_REVISAO), nunca apagada!
    - Suspensão MANUAL é ignorada.
    """
    sancoes_esperadas = [
        {
            "id_edicao_competicao": 1,
            "id_integrante": 10,
            "id_partida_origem": 1,
            "id_ocorrencia_origem": 100,
            "origem": "VERMELHO_DIRETO",
            "chave_origem": "ED1:INT10:VERM_DIR:OC100",
            "jogos": 1,
            "motivo": "Suspensão automática por cartão vermelho direto",
        }
    ]
    suspensoes_banco = [
        # 1. Já existe igual às esperadas -> idempotente
        {
            "id_suspensao": 1,
            "origem": "VERMELHO_DIRETO",
            "chave_origem": "ED1:INT10:VERM_DIR:OC100",
            "jogos": 1,
            "jogos_cumpridos": 0,
            "situacao": "ATIVA",
        },
        # 2. Perdeu lastro e já tinha cumprimento -> deve ir para EM_REVISAO
        {
            "id_suspensao": 2,
            "origem": "ACUMULO_AMARELOS",
            "chave_origem": "ED1:INT20:ACUM_AMA:CICLO1",
            "jogos": 1,
            "jogos_cumpridos": 1,
            "situacao": "CUMPRIDA",
        },
        # 3. Perdeu lastro e ainda não teve cumprimento -> pode cancelar/remover
        {
            "id_suspensao": 3,
            "origem": "SEGUNDO_AMARELO",
            "chave_origem": "ED1:INT30:SEG_AMA:OC300",
            "jogos": 1,
            "jogos_cumpridos": 0,
            "situacao": "ATIVA",
        },
        # 4. Suspensão manual -> intocada
        {
            "id_suspensao": 4,
            "origem": "MANUAL",
            "chave_origem": None,
            "jogos": 2,
            "jogos_cumpridos": 0,
            "situacao": "ATIVA",
        },
    ]

    rec = reconciliar_suspensoes_existentes(sancoes_esperadas, suspensoes_banco)
    assert rec["para_criar"] == []
    assert [s["id_suspensao"] for s in rec["para_revisao"]] == [2]
    assert [s["id_suspensao"] for s in rec["para_cancelar"]] == [3]


def test_validar_elegibilidade_cumprimento_regras():
    suspensao = {
        "id_suspensao": 10,
        "id_edicao_competicao": 1,
        "id_integrante": 50,
        "id_partida_origem": 2,
        "situacao": "ATIVA",
        "jogos": 1,
        "jogos_cumpridos": 0,
    }
    partida_valida = {
        "id_partida": 3,
        "id_edicao_competicao": 1,
        "id_equipe_mandante": 1,
        "id_equipe_visitante": 2,
        "estado": "FINALIZADA",
    }

    # Caso válido: não levanta exceção
    validar_elegibilidade_cumprimento(
        suspensao=suspensao,
        partida=partida_valida,
        id_equipe_integrante=1,
        cumprimentos_existentes_integrante=[],
        participante_atuou_na_partida=False,
    )

    # 1. Partida não finalizada -> ConflitoEstado
    with pytest.raises(ConflitoEstado):
        validar_elegibilidade_cumprimento(
            suspensao=suspensao,
            partida={**partida_valida, "estado": "AGENDADA"},
            id_equipe_integrante=1,
            cumprimentos_existentes_integrante=[],
        )

    # 2. Partida igual ou anterior à origem -> ConflitoEstado
    with pytest.raises(ConflitoEstado, match="posterior"):
        validar_elegibilidade_cumprimento(
            suspensao=suspensao,
            partida={**partida_valida, "id_partida": 2},
            id_equipe_integrante=1,
            cumprimentos_existentes_integrante=[],
        )

    # 3. Equipe do integrante não participou da partida -> ConfiguracaoInvalida
    with pytest.raises(ConfiguracaoInvalida):
        validar_elegibilidade_cumprimento(
            suspensao=suspensao,
            partida=partida_valida,
            id_equipe_integrante=99,
            cumprimentos_existentes_integrante=[],
        )

    # 4. Já cumpriu outra suspensão na mesma partida -> ConflitoEstado
    with pytest.raises(ConflitoEstado, match="no máximo uma suspensão"):
        validar_elegibilidade_cumprimento(
            suspensao=suspensao,
            partida=partida_valida,
            id_equipe_integrante=1,
            cumprimentos_existentes_integrante=[{"id_partida": 3, "id_suspensao": 9}],
        )

    # 5. Integrante atuou na partida (teve ocorrência registrada) -> ConflitoEstado
    with pytest.raises(ConflitoEstado, match="ocorrência registrada"):
        validar_elegibilidade_cumprimento(
            suspensao=suspensao,
            partida=partida_valida,
            id_equipe_integrante=1,
            cumprimentos_existentes_integrante=[],
            participante_atuou_na_partida=True,
        )


def test_calcular_hash_resultados_determinismo_e_invalidacao():
    p1 = {"id_partida": 1, "gols_mandante": 1, "gols_visitante": 0, "estado": "FINALIZADA"}
    p2 = {"id_partida": 2, "gols_mandante": 2, "gols_visitante": 2, "estado": "FINALIZADA"}
    p_agendada = {"id_partida": 3, "gols_mandante": 0, "gols_visitante": 0, "estado": "AGENDADA"}

    h1 = calcular_hash_resultados([p2, p1, p_agendada])
    h2 = calcular_hash_resultados([p1, p2])
    assert h1 == h2

    # Mudança de placar altera o hash
    p2_alterada = {**p2, "gols_visitante": 3}
    h3 = calcular_hash_resultados([p1, p2_alterada])
    assert h3 != h1


def test_classificacao_desempate_cartoes_e_decisao_manual():
    equipes = [
        {"id_equipe": 10, "nome_equipe": "Time A"},
        {"id_equipe": 20, "nome_equipe": "Time B"},
        {"id_equipe": 30, "nome_equipe": "Time C"},
    ]
    # Todos empataram em 0x0 (mesmos pontos, vitórias, saldo, gols pró e confronto direto)
    partidas = [
        {"id_partida": 1, "id_equipe_mandante": 10, "id_equipe_visitante": 20, "gols_mandante": 0, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_partida": 2, "id_equipe_mandante": 20, "id_equipe_visitante": 30, "gols_mandante": 0, "gols_visitante": 0, "estado": "FINALIZADA"},
        {"id_partida": 3, "id_equipe_mandante": 30, "id_equipe_visitante": 10, "gols_mandante": 0, "gols_visitante": 0, "estado": "FINALIZADA"},
    ]
    # Time 30 tem 1 cartão vermelho (fica em 3º).
    # Time 10 e Time 20 têm 0 vermelhos e 2 amarelos cada (continuam empatados após cartões!).
    cartoes_por_equipe = {
        10: {"amarelos": 2, "vermelhos": 0},
        20: {"amarelos": 2, "vermelhos": 0},
        30: {"amarelos": 0, "vermelhos": 1},
    }
    criterios = [
        "VITORIAS",
        "SALDO_GOLS",
        "GOLS_PRO",
        "CONFRONTO_DIRETO",
        "MENOS_CARTOES_VERMELHOS",
        "MENOS_CARTOES_AMARELOS",
    ]

    # Sem decisão manual: 10 e 20 ficam empatados em 1º, e 30 isolado em 3º
    linhas_sem_decisao = calcular_classificacao(
        equipes=equipes,
        partidas=partidas,
        ordem_desempates=criterios,
        cartoes_por_equipe=cartoes_por_equipe,
    )
    assert linhas_sem_decisao[0].posicao == 1
    assert linhas_sem_decisao[0].empate_persistente is True
    assert linhas_sem_decisao[1].posicao == 1
    assert linhas_sem_decisao[1].empate_persistente is True
    assert linhas_sem_decisao[2].id_equipe == 30
    assert linhas_sem_decisao[2].posicao == 3
    assert linhas_sem_decisao[2].empate_persistente is False

    # Com decisão manual válida escolhendo [20, 10]: desfaz o empate persistente!
    linhas_com_decisao = calcular_classificacao(
        equipes=equipes,
        partidas=partidas,
        ordem_desempates=criterios,
        cartoes_por_equipe=cartoes_por_equipe,
        decisoes_manuais=[
            {
                "conjunto_equipes": [10, 20],
                "ordem_escolhida": [20, 10],
                "valida": True,
            }
        ],
    )
    assert [l.id_equipe for l in linhas_com_decisao] == [20, 10, 30]
    assert [l.posicao for l in linhas_com_decisao] == [1, 2, 3]
    assert all(l.empate_persistente is False for l in linhas_com_decisao)

    # Se a decisão manual estiver marcada como inválida (valida=False), o empate persistente permanece
    linhas_decisao_invalida = calcular_classificacao(
        equipes=equipes,
        partidas=partidas,
        ordem_desempates=criterios,
        cartoes_por_equipe=cartoes_por_equipe,
        decisoes_manuais=[
            {
                "conjunto_equipes": [10, 20],
                "ordem_escolhida": [20, 10],
                "valida": False,
            }
        ],
    )
    assert linhas_decisao_invalida[0].empate_persistente is True
    assert linhas_decisao_invalida[1].empate_persistente is True


def test_partidas_canceladas_e_em_andamento_e_cartoes_por_equipe():
    """Partidas CANCELADA são ignoradas; EM_ANDAMENTO entram em estatísticas mas não geram sanções nem cartões de desempate."""
    partidas = [
        {"id_partida": 1, "id_grupo": 1, "rodada": 1, "ordem_jogo": 1, "estado": "FINALIZADA", "id_equipe_mandante": 10, "id_equipe_visitante": 20},
        {"id_partida": 2, "id_grupo": 1, "rodada": 2, "ordem_jogo": 1, "estado": "EM_ANDAMENTO", "id_equipe_mandante": 10, "id_equipe_visitante": 20},
        {"id_partida": 3, "id_grupo": 1, "rodada": 3, "ordem_jogo": 1, "estado": "CANCELADA", "id_equipe_mandante": 10, "id_equipe_visitante": 20},
    ]
    ocorrencias = [
        # Partida 1 (FINALIZADA): 1 amarelo e 1 vermelho direto para equipe 10
        {"id_ocorrencia": 1, "id_partida": 1, "tipo": "CARTAO_AMARELO", "id_integrante": 100, "id_equipe_beneficiada": 10},
        {"id_ocorrencia": 2, "id_partida": 1, "tipo": "CARTAO_VERMELHO_DIRETO", "id_integrante": 101, "id_equipe_beneficiada": 10},
        # Partida 2 (EM_ANDAMENTO): 1 vermelho direto para 100 (conta em estatística, mas não gera sanção ainda)
        {"id_ocorrencia": 3, "id_partida": 2, "tipo": "CARTAO_VERMELHO_DIRETO", "id_integrante": 100, "id_equipe_beneficiada": 10},
        # Partida 3 (CANCELADA): totalmente ignorada
        {"id_ocorrencia": 4, "id_partida": 3, "tipo": "CARTAO_VERMELHO_DIRETO", "id_integrante": 102, "id_equipe_beneficiada": 20},
    ]
    res = calcular_sancoes_e_cartoes(1, ocorrencias, partidas, {"limite_amarelos": None, "jogos_por_vermelho": 2})

    assert len(res["sancoes_esperadas"]) == 1
    assert res["sancoes_esperadas"][0]["chave_origem"] == "ED1:INT101:VERM_DIR:OC2"
    assert res["sancoes_esperadas"][0]["jogos"] == 2

    # Integrante 100 tem 1 amarelo (P1) e 1 vermelho direto (P2 em andamento) nas estatísticas
    assert res["estatisticas_integrantes"][100]["amarelos_estatisticos"] == 1
    assert res["estatisticas_integrantes"][100]["vermelhos_diretos"] == 1
    assert 102 not in res["estatisticas_integrantes"]

    # Cartões por equipe contabiliza apenas partidas FINALIZADA
    assert res["cartoes_por_equipe"][10] == {"amarelos": 1, "vermelhos": 1}
    assert res["cartoes_por_equipe"][20] == {"amarelos": 0, "vermelhos": 0}
