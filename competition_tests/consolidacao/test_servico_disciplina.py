"""Testes de consolidação da Task 5 (Fatia 3): Serviços e API de Disciplina — Suspensões, Cumprimentos, Alertas e Ajustes."""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from competicoes.contratos.disciplina import (
    CumprimentoCriar,
    SuspensaoAjustar,
    SuspensaoManualCriar,
)
from competicoes.erros import ConfiguracaoInvalida, ConflitoEstado, NaoEncontrado
from competicoes.modelos.disciplina import CumprimentoSuspensao, SuspensaoCompeticao
from competicoes.modelos.disputa import DueloEliminatorio, GrupoCompeticao, VagaDuelo
from competicoes.modelos.operacao import AuditoriaCompeticao
from competicoes.modelos.partidas import OcorrenciaPartida, Partida
from competicoes.servicos.disciplina import (
    ajustar_suspensao,
    criar_suspensao_manual,
    cumprir_suspensao,
    obter_painel_disciplinar,
    reconciliar_sancoes_edicao,
)
from .factories import (
    criar_competidor,
    criar_edicao_competicao,
    criar_equipe,
    criar_integrante,
)


# ==============================================================================
# FIXTURES LOCAIS (sem alterar conftest.py)
# ==============================================================================


@pytest.fixture()
def cenario_pontos_corridos(db: Session):
    edicao = criar_edicao_competicao(
        db,
        formato="PONTOS_CORRIDOS",
        estado="EM_ANDAMENTO",
        configuracao={
            "formato": "PONTOS_CORRIDOS",
            "desempates": ["SALDO_GOLS"],
            "disciplina": {
                "limite_amarelos": 3,
                "jogos_por_acumulo": 1,
                "jogos_por_vermelho": 2,
                "jogos_por_segundo_amarelo": 1,
                "zerar_amarelos_ao_encerrar_grupos": False,
            },
        },
    )
    eq1 = criar_equipe(db, edicao=edicao, nome="Time A")
    eq2 = criar_equipe(db, edicao=edicao, nome="Time B")
    eq3 = criar_equipe(db, edicao=edicao, nome="Time C")

    atleta1 = criar_integrante(
        db,
        equipe=eq1,
        competidor=criar_competidor(db, nome="Atleta Um"),
        nome_esportivo="Atleta Um",
        numero_camisa=10,
    )
    atleta2 = criar_integrante(
        db,
        equipe=eq1,
        competidor=criar_competidor(db, nome="Atleta Dois"),
        nome_esportivo="Atleta Dois",
        numero_camisa=9,
    )
    atleta_adversario = criar_integrante(
        db,
        equipe=eq2,
        competidor=criar_competidor(db, nome="Atleta Rival"),
        nome_esportivo="Atleta Rival",
        numero_camisa=5,
    )
    atleta_outra_equipe = criar_integrante(
        db,
        equipe=eq3,
        competidor=criar_competidor(db, nome="Atleta Terceiro"),
        nome_esportivo="Atleta Terceiro",
        numero_camisa=7,
    )

    p1 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        rodada=1,
        ordem_jogo=1,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="FINALIZADA",
    )
    p2 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        rodada=2,
        ordem_jogo=1,
        id_equipe_mandante=eq2.id_equipe,
        id_equipe_visitante=eq1.id_equipe,
        estado="FINALIZADA",
    )
    p3 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        rodada=3,
        ordem_jogo=1,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="FINALIZADA",
    )
    p4 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        rodada=4,
        ordem_jogo=1,
        id_equipe_mandante=eq2.id_equipe,
        id_equipe_visitante=eq1.id_equipe,
        estado="FINALIZADA",
    )
    p5_agendada = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        rodada=5,
        ordem_jogo=1,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="AGENDADA",
    )
    p_outra_equipe = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        rodada=5,
        ordem_jogo=2,
        id_equipe_mandante=eq2.id_equipe,
        id_equipe_visitante=eq3.id_equipe,
        estado="FINALIZADA",
    )
    db.add_all([p1, p2, p3, p4, p5_agendada, p_outra_equipe])
    db.commit()

    return {
        "edicao": edicao,
        "eq1": eq1,
        "eq2": eq2,
        "eq3": eq3,
        "atleta1": atleta1,
        "atleta2": atleta2,
        "atleta_adversario": atleta_adversario,
        "atleta_outra_equipe": atleta_outra_equipe,
        "p1": p1,
        "p2": p2,
        "p3": p3,
        "p4": p4,
        "p5_agendada": p5_agendada,
        "p_outra_equipe": p_outra_equipe,
    }


# ==============================================================================
# 1. RECONCILIAÇÃO DE SANÇÕES AUTOMÁTICAS E PAINEL DISCIPLINAR
# ==============================================================================


def test_reconciliacao_vermelho_segundo_amarelo_e_acumulo_idempotente(
    db: Session, cenario_pontos_corridos, usuario
):
    """Testa geração de sanções por vermelho direto, 2º amarelo (sem somar no acúmulo)
    e acúmulo de amarelos, garantindo idempotência em chamadas repetidas.
    """
    edicao = cenario_pontos_corridos["edicao"]
    eq1 = cenario_pontos_corridos["eq1"]
    atleta1 = cenario_pontos_corridos["atleta1"]
    atleta2 = cenario_pontos_corridos["atleta2"]
    p1 = cenario_pontos_corridos["p1"]
    p2 = cenario_pontos_corridos["p2"]
    p3 = cenario_pontos_corridos["p3"]
    p4 = cenario_pontos_corridos["p4"]

    # Atleta 1:
    # - P1: 1 amarelo (acumulo = 1)
    # - P2: 1 amarelo (acumulo = 2)
    # - P3: 2 amarelos -> EXPULSAO_SEGUNDO_AMARELO (NÃO soma no acúmulo! acumulo permanece 2)
    oc_p1 = OcorrenciaPartida(
        id_partida=p1.id_partida,
        tipo="CARTAO_AMARELO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta1.id_integrante,
        minuto=15,
    )
    oc_p2 = OcorrenciaPartida(
        id_partida=p2.id_partida,
        tipo="CARTAO_AMARELO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta1.id_integrante,
        minuto=20,
    )
    oc_p3_am1 = OcorrenciaPartida(
        id_partida=p3.id_partida,
        tipo="CARTAO_AMARELO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta1.id_integrante,
        minuto=10,
    )
    oc_p3_am2 = OcorrenciaPartida(
        id_partida=p3.id_partida,
        tipo="CARTAO_AMARELO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta1.id_integrante,
        minuto=35,
    )
    db.add_all([oc_p1, oc_p2, oc_p3_am1, oc_p3_am2])
    db.flush()

    oc_p3_exp = OcorrenciaPartida(
        id_partida=p3.id_partida,
        tipo="EXPULSAO_SEGUNDO_AMARELO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta1.id_integrante,
        id_ocorrencia_origem=oc_p3_am2.id_ocorrencia,
        minuto=35,
    )
    # Atleta 2:
    # - P1: cartão vermelho direto (configurado com 2 jogos)
    oc_p1_verm = OcorrenciaPartida(
        id_partida=p1.id_partida,
        tipo="CARTAO_VERMELHO_DIRETO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta2.id_integrante,
        minuto=40,
    )
    db.add_all([oc_p3_exp, oc_p1_verm])
    db.commit()

    # 1ª chamada de reconciliação (até P3)
    suspensoes_1 = reconciliar_sancoes_edicao(
        db, edicao.id_edicao_competicao, responsavel=usuario
    )
    assert len(suspensoes_1) == 2

    por_origem = {s.origem: s for s in suspensoes_1}
    assert "SEGUNDO_AMARELO" in por_origem
    assert por_origem["SEGUNDO_AMARELO"].id_integrante == atleta1.id_integrante
    assert por_origem["SEGUNDO_AMARELO"].jogos == 1
    assert por_origem["SEGUNDO_AMARELO"].id_partida_origem == p3.id_partida
    assert por_origem["SEGUNDO_AMARELO"].situacao == "ATIVA"

    assert "VERMELHO_DIRETO" in por_origem
    assert por_origem["VERMELHO_DIRETO"].id_integrante == atleta2.id_integrante
    assert por_origem["VERMELHO_DIRETO"].jogos == 2
    assert por_origem["VERMELHO_DIRETO"].id_partida_origem == p1.id_partida
    assert por_origem["VERMELHO_DIRETO"].jogos_pendentes == 2

    # 2ª chamada repetida não deve duplicar
    suspensoes_2 = reconciliar_sancoes_edicao(
        db, edicao.id_edicao_competicao, responsavel=usuario
    )
    assert len(suspensoes_2) == 2
    assert [s.id_suspensao for s in suspensoes_1] == [
        s.id_suspensao for s in suspensoes_2
    ]

    # Painel disciplinar reflete saldo de acúmulo = 2 e amarelos estatísticos = 4 para Atleta 1
    painel_p3 = obter_painel_disciplinar(db, edicao.id_edicao_competicao)
    resumo_map = {r.id_integrante: r for r in painel_p3.resumo_cartoes}
    r1 = resumo_map[atleta1.id_integrante]
    assert r1.amarelos_estatisticos == 4
    assert r1.amarelos_acumulo_atual == 2
    assert r1.expulsoes_segundo_amarelo == 1
    assert r1.suspenso_atualmente is True

    # Agora em P4 Atleta 1 recebe mais 1 amarelo avulso -> fecha ciclo de 3 amarelos!
    oc_p4_am = OcorrenciaPartida(
        id_partida=p4.id_partida,
        tipo="CARTAO_AMARELO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta1.id_integrante,
        minuto=22,
    )
    db.add(oc_p4_am)
    db.commit()

    painel_p4 = obter_painel_disciplinar(db, edicao.id_edicao_competicao)
    assert len(painel_p4.suspensoes) == 3
    origens = [s.origem for s in painel_p4.suspensoes]
    assert "ACUMULO_AMARELOS" in origens

    resumo_map_p4 = {r.id_integrante: r for r in painel_p4.resumo_cartoes}
    assert resumo_map_p4[atleta1.id_integrante].amarelos_estatisticos == 5
    assert resumo_map_p4[atleta1.id_integrante].amarelos_acumulo_atual == 0


# ==============================================================================
# 2. ZERAGEM DE AMARELOS AO ENCERRAR GRUPOS PRESERVANDO SUSPENSÕES ATIVAS
# ==============================================================================


def test_zeragem_amarelos_ao_encerrar_grupos_preserva_suspensao_ativa(
    db: Session, usuario
):
    """Ao encerrar grupos em GRUPOS_MATA_MATA com zerar_amarelos_ao_encerrar_grupos=True:
    - O saldo residual de amarelos é zerado ao entrar no mata-mata.
    - Suspensão já gerada na fase de grupos continua ATIVA para ser cumprida no mata-mata.
    """
    edicao = criar_edicao_competicao(
        db,
        formato="GRUPOS_MATA_MATA",
        estado="EM_ANDAMENTO",
        configuracao={
            "formato": "GRUPOS_MATA_MATA",
            "quantidade_grupos": 1,
            "classificados_por_grupo": 2,
            "desempates": ["SALDO_GOLS"],
            "disciplina": {
                "limite_amarelos": 2,
                "jogos_por_acumulo": 1,
                "jogos_por_vermelho": 1,
                "jogos_por_segundo_amarelo": 1,
                "zerar_amarelos_ao_encerrar_grupos": True,
            },
        },
    )
    grupo = GrupoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao, nome="Grupo A", ordem=1
    )
    db.add(grupo)
    db.flush()

    eq1 = criar_equipe(db, edicao=edicao, nome="Time G1", id_grupo=grupo.id_grupo)
    eq2 = criar_equipe(db, edicao=edicao, nome="Time G2", id_grupo=grupo.id_grupo)
    atleta_suspenso = criar_integrante(
        db,
        equipe=eq1,
        competidor=criar_competidor(db, nome="Suspenso nos Grupos"),
        nome_esportivo="Suspenso nos Grupos",
    )
    atleta_pendurado = criar_integrante(
        db,
        equipe=eq1,
        competidor=criar_competidor(db, nome="Pendurado nos Grupos"),
        nome_esportivo="Pendurado nos Grupos",
    )

    pg1 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_grupo=grupo.id_grupo,
        rodada=1,
        ordem_jogo=1,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="FINALIZADA",
    )
    pg2 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_grupo=grupo.id_grupo,
        rodada=2,
        ordem_jogo=1,
        id_equipe_mandante=eq2.id_equipe,
        id_equipe_visitante=eq1.id_equipe,
        estado="FINALIZADA",
    )
    db.add_all([pg1, pg2])
    db.flush()

    # atleta_suspenso leva 2 amarelos nos grupos (limite=2) -> gera suspensão ATIVA
    # atleta_pendurado leva 1 amarelo nos grupos -> fica pendurado com saldo 1
    db.add_all(
        [
            OcorrenciaPartida(
                id_partida=pg1.id_partida,
                tipo="CARTAO_AMARELO",
                id_equipe_beneficiada=eq1.id_equipe,
                id_integrante=atleta_suspenso.id_integrante,
                minuto=10,
            ),
            OcorrenciaPartida(
                id_partida=pg2.id_partida,
                tipo="CARTAO_AMARELO",
                id_equipe_beneficiada=eq1.id_equipe,
                id_integrante=atleta_suspenso.id_integrante,
                minuto=20,
            ),
            OcorrenciaPartida(
                id_partida=pg2.id_partida,
                tipo="CARTAO_AMARELO",
                id_equipe_beneficiada=eq1.id_equipe,
                id_integrante=atleta_pendurado.id_integrante,
                minuto=25,
            ),
        ]
    )

    duelo = DueloEliminatorio(
        id_edicao_competicao=edicao.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
        estado="PENDENTE",
    )
    db.add(duelo)
    db.flush()

    vaga1 = VagaDuelo(
        id_duelo=duelo.id_duelo,
        posicao=1,
        origem="POSICAO_GRUPO",
        id_grupo=grupo.id_grupo,
        posicao_grupo=1,
        id_equipe_resolvida=None,
    )
    vaga2 = VagaDuelo(
        id_duelo=duelo.id_duelo,
        posicao=2,
        origem="POSICAO_GRUPO",
        id_grupo=grupo.id_grupo,
        posicao_grupo=2,
        id_equipe_resolvida=None,
    )
    db.add_all([vaga1, vaga2])
    db.commit()

    # Antes de encerrar os grupos: atleta_pendurado tem amarelos_acumulo_atual == 1
    painel_antes = obter_painel_disciplinar(db, edicao.id_edicao_competicao)
    res_antes = {r.id_integrante: r for r in painel_antes.resumo_cartoes}
    assert res_antes[atleta_pendurado.id_integrante].amarelos_acumulo_atual == 1
    assert res_antes[atleta_suspenso.id_integrante].suspenso_atualmente is True
    assert len(painel_antes.suspensoes) == 1

    # Encerra os grupos (resolve as vagas do mata-mata) e realiza jogo da final
    vaga1.id_equipe_resolvida = eq1.id_equipe
    vaga2.id_equipe_resolvida = eq2.id_equipe
    duelo.estado = "DEFINIDO"
    p_final = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_grupo=None,
        id_duelo=duelo.id_duelo,
        rodada=1,
        ordem_jogo=1,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="FINALIZADA",
    )
    db.add(p_final)
    db.flush()

    # Na final, atleta_pendurado recebe 1 amarelo -> como o saldo de grupos foi zerado,
    # seu novo saldo fica em 1 (não atinge 2 nem gera suspensão indevida!)
    db.add(
        OcorrenciaPartida(
            id_partida=p_final.id_partida,
            tipo="CARTAO_AMARELO",
            id_equipe_beneficiada=eq1.id_equipe,
            id_integrante=atleta_pendurado.id_integrante,
            minuto=30,
        )
    )
    db.commit()

    painel_depois = obter_painel_disciplinar(db, edicao.id_edicao_competicao)
    res_depois = {r.id_integrante: r for r in painel_depois.resumo_cartoes}

    # Suspensão de atleta_suspenso continua ATIVA
    assert len(painel_depois.suspensoes) == 1
    assert painel_depois.suspensoes[0].id_integrante == atleta_suspenso.id_integrante
    assert painel_depois.suspensoes[0].situacao == "ATIVA"

    # atleta_pendurado tem 2 amarelos estatísticos, mas apenas 1 no acúmulo atual e não foi suspenso
    assert res_depois[atleta_pendurado.id_integrante].amarelos_estatisticos == 2
    assert res_depois[atleta_pendurado.id_integrante].amarelos_acumulo_atual == 1
    assert res_depois[atleta_pendurado.id_integrante].suspenso_atualmente is False


# ==============================================================================
# 3. CUMPRIMENTO EXPLÍCITO DE SUSPENSÃO E REGRAS DE BLOQUEIO
# ==============================================================================


def test_cumprimento_suspensao_fluxo_completo_e_bloqueios(
    db: Session, client, cabecalhos_por_papel, cenario_pontos_corridos, usuario
):
    """Testa cumprimento explícito de suspensão e todos os bloqueios:
    - Mesma partida de origem ou anterior -> 409
    - Partida agendada -> 409
    - Equipe do atleta não participa da partida -> 422
    - Atleta teve ocorrência registrada na partida -> 409
    - Cumprir duas suspensões na mesma partida para o mesmo atleta -> 409
    """
    edicao = cenario_pontos_corridos["edicao"]
    eq1 = cenario_pontos_corridos["eq1"]
    atleta1 = cenario_pontos_corridos["atleta1"]
    p2 = cenario_pontos_corridos["p2"]
    p3 = cenario_pontos_corridos["p3"]
    p4 = cenario_pontos_corridos["p4"]
    p5_agendada = cenario_pontos_corridos["p5_agendada"]
    p_outra_equipe = cenario_pontos_corridos["p_outra_equipe"]

    # Cartão vermelho direto em P2 (gera suspensão de 2 jogos, mas vamos ajustar ou testar com 1 jogo também)
    oc_verm = OcorrenciaPartida(
        id_partida=p2.id_partida,
        tipo="CARTAO_VERMELHO_DIRETO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta1.id_integrante,
        minuto=12,
    )
    # Em P3 o atleta1 teve uma ocorrência registrada (atuou irregularmente!)
    oc_atuou_p3 = OcorrenciaPartida(
        id_partida=p3.id_partida,
        tipo="CARTAO_AMARELO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta1.id_integrante,
        minuto=5,
    )
    db.add_all([oc_verm, oc_atuou_p3])
    db.commit()

    suspensoes = reconciliar_sancoes_edicao(
        db, edicao.id_edicao_competicao, responsavel=usuario
    )
    assert len(suspensoes) == 1
    susp = suspensoes[0]
    assert susp.jogos == 2
    assert susp.situacao == "ATIVA"

    # Cria também uma 2ª suspensão manual de 1 jogo para o mesmo atleta1
    susp_manual = criar_suspensao_manual(
        db,
        edicao.id_edicao_competicao,
        SuspensaoManualCriar(
            id_integrante=atleta1.id_integrante,
            jogos=1,
            motivo="Relatório disciplinar extra-campo",
        ),
        responsavel=usuario,
    )

    headers_coord = cabecalhos_por_papel("coordenador")

    # 1. Tentar cumprir na mesma partida de origem (P2) -> 409 ConflitoEstado
    r_mesma = client.post(
        f"/competicoes/suspensoes/{susp.id_suspensao}/cumprimentos",
        json={"id_partida": p2.id_partida},
        headers=headers_coord,
    )
    assert r_mesma.status_code == 409
    assert r_mesma.json()["codigo"] == "CONFLITO_ESTADO"

    # 2. Tentar cumprir em partida agendada (P5) -> 409 ConflitoEstado
    r_agendada = client.post(
        f"/competicoes/suspensoes/{susp.id_suspensao}/cumprimentos",
        json={"id_partida": p5_agendada.id_partida},
        headers=headers_coord,
    )
    assert r_agendada.status_code == 409

    # 3. Tentar cumprir em partida de outras equipes -> 422 ConfiguracaoInvalida
    r_outra_eq = client.post(
        f"/competicoes/suspensoes/{susp.id_suspensao}/cumprimentos",
        json={"id_partida": p_outra_equipe.id_partida},
        headers=headers_coord,
    )
    assert r_outra_eq.status_code == 422

    # 4. Tentar cumprir em P3 onde o atleta teve ocorrência registrada -> 409 ConflitoEstado
    r_atuou = client.post(
        f"/competicoes/suspensoes/{susp.id_suspensao}/cumprimentos",
        json={"id_partida": p3.id_partida},
        headers=headers_coord,
    )
    assert r_atuou.status_code == 409
    assert "ocorrência" in r_atuou.json()["mensagem"].lower()

    # 5. Cumprir a suspensão manual (1 jogo) em P4 (FINALIZADA, posterior e sem atuação de atleta1) -> 201
    r_ok = client.post(
        f"/competicoes/suspensoes/{susp_manual.id_suspensao}/cumprimentos",
        json={"id_partida": p4.id_partida},
        headers=headers_coord,
    )
    assert r_ok.status_code == 201
    dados_ok = r_ok.json()
    assert dados_ok["jogos_cumpridos"] == 1
    assert dados_ok["jogos_pendentes"] == 0
    assert dados_ok["situacao"] == "CUMPRIDA"
    assert len(dados_ok["cumprimentos"]) == 1
    assert dados_ok["cumprimentos"][0]["id_partida"] == p4.id_partida

    # 6. Tentar usar a mesma partida P4 para cumprir a outra suspensão (susp) do mesmo atleta1 -> 409
    r_duplo = client.post(
        f"/competicoes/suspensoes/{susp.id_suspensao}/cumprimentos",
        json={"id_partida": p4.id_partida},
        headers=headers_coord,
    )
    assert r_duplo.status_code == 409
    assert "no máximo uma suspensão" in r_duplo.json()["mensagem"].lower()


# ==============================================================================
# 4. REMOÇÃO DE CARTÃO APÓS CUMPRIMENTO -> EM_REVISAO (SEM APAGAR CUMPRIMENTO)
# ==============================================================================


def test_remocao_cartao_apos_cumprimento_coloca_suspensao_em_revisao(
    db: Session, cenario_pontos_corridos, usuario
):
    """Quando uma súmula é corrigida removendo o cartão que gerou uma suspensão:
    - Se a suspensão já possuía cumprimento, passa para EM_REVISAO e preserva o cumprimento.
    - Se a suspensão ainda não tinha cumprimento (jogos_cumpridos == 0), é cancelada e libera a chave para recriação.
    """
    edicao = cenario_pontos_corridos["edicao"]
    eq1 = cenario_pontos_corridos["eq1"]
    atleta1 = cenario_pontos_corridos["atleta1"]
    atleta2 = cenario_pontos_corridos["atleta2"]
    p1 = cenario_pontos_corridos["p1"]
    p2 = cenario_pontos_corridos["p2"]

    # Ajusta vermelho direto para 1 jogo na configuração para testar transição CUMPRIDA -> EM_REVISAO
    edicao.configuracao = {
        **edicao.configuracao,
        "disciplina": {
            "limite_amarelos": 3,
            "jogos_por_acumulo": 1,
            "jogos_por_vermelho": 1,
            "jogos_por_segundo_amarelo": 1,
            "zerar_amarelos_ao_encerrar_grupos": False,
        },
    }

    oc_verm_1 = OcorrenciaPartida(
        id_partida=p1.id_partida,
        tipo="CARTAO_VERMELHO_DIRETO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta1.id_integrante,
        minuto=10,
    )
    oc_verm_2 = OcorrenciaPartida(
        id_partida=p1.id_partida,
        tipo="CARTAO_VERMELHO_DIRETO",
        id_equipe_beneficiada=eq1.id_equipe,
        id_integrante=atleta2.id_integrante,
        minuto=20,
    )
    db.add_all([oc_verm_1, oc_verm_2])
    db.commit()

    suspensoes = reconciliar_sancoes_edicao(
        db, edicao.id_edicao_competicao, responsavel=usuario
    )
    por_atleta = {s.id_integrante: s for s in suspensoes}
    susp_atleta1 = por_atleta[atleta1.id_integrante]
    susp_atleta2 = por_atleta[atleta2.id_integrante]

    # Atleta 1 cumpre sua suspensão em P2 -> passa para CUMPRIDA
    susp_atleta1_cumprida = cumprir_suspensao(
        db,
        susp_atleta1.id_suspensao,
        CumprimentoCriar(id_partida=p2.id_partida),
        responsavel=usuario,
    )
    assert susp_atleta1_cumprida.situacao == "CUMPRIDA"
    assert susp_atleta1_cumprida.jogos_cumpridos == 1

    # Agora corrige-se a súmula de P1 removendo ambos os cartões vermelhos
    db.delete(oc_verm_1)
    db.delete(oc_verm_2)
    db.commit()

    # Reconcilia novamente
    suspensoes_pos = reconciliar_sancoes_edicao(
        db, edicao.id_edicao_competicao, responsavel=usuario
    )
    # A suspensão de atleta2 (sem cumprimento) foi cancelada, preservando o registro;
    # a de atleta1 (com cumprimento) foi para EM_REVISAO.
    por_id = {s.id_suspensao: s for s in suspensoes_pos}
    assert por_id[susp_atleta2.id_suspensao].situacao == "CANCELADA"
    assert por_id[susp_atleta2.id_suspensao].chave_origem is None
    susp_rev = por_id[susp_atleta1.id_suspensao]
    assert susp_rev.situacao == "EM_REVISAO"
    assert susp_rev.jogos_cumpridos == 1
    assert len(susp_rev.cumprimentos) == 1
    assert susp_rev.cumprimentos[0].id_partida == p2.id_partida


# ==============================================================================
# 5. SUSPENSÃO MANUAL E AJUSTE MANUAL COM AUDITORIA
# ==============================================================================


def test_suspensao_manual_e_ajuste_com_auditoria_via_api(
    db: Session, client, cabecalhos_por_papel, cenario_pontos_corridos
):
    """Testa criação de suspensão manual (POST /edicoes/{id}/suspensoes)
    e ajuste manual (PUT /suspensoes/{id}) com validação de motivo e gravação de auditoria.
    """
    edicao = cenario_pontos_corridos["edicao"]
    atleta1 = cenario_pontos_corridos["atleta1"]
    p1 = cenario_pontos_corridos["p1"]

    headers_coord = cabecalhos_por_papel("coordenador")
    headers_prof = cabecalhos_por_papel("professor")

    # Professor não pode criar suspensão manual (403)
    r_forbidden = client.post(
        f"/competicoes/edicoes/{edicao.id_edicao_competicao}/suspensoes",
        json={
            "id_integrante": atleta1.id_integrante,
            "jogos": 2,
            "motivo": "Conduta antidesportiva relatada em súmula",
        },
        headers=headers_prof,
    )
    assert r_forbidden.status_code == 403

    # Coordenador cria suspensão manual (201)
    r_criar = client.post(
        f"/competicoes/edicoes/{edicao.id_edicao_competicao}/suspensoes",
        json={
            "id_integrante": atleta1.id_integrante,
            "jogos": 2,
            "motivo": "Conduta antidesportiva relatada em súmula",
        },
        headers=headers_coord,
    )
    assert r_criar.status_code == 201
    susp_criada = r_criar.json()
    id_susp = susp_criada["id_suspensao"]
    assert susp_criada["origem"] == "MANUAL"
    assert susp_criada["jogos"] == 2
    assert susp_criada["situacao"] == "ATIVA"
    assert susp_criada["nome_esportivo"] == "Atleta Um"

    # Cumpre 1 jogo em P1
    r_cump = client.post(
        f"/competicoes/suspensoes/{id_susp}/cumprimentos",
        json={"id_partida": p1.id_partida},
        headers=headers_coord,
    )
    assert r_cump.status_code == 201
    assert r_cump.json()["jogos_cumpridos"] == 1
    assert r_cump.json()["situacao"] == "ATIVA"

    # Ajustar jogos para 1 (igual a jogos_cumpridos) -> deve mudar automaticamente para CUMPRIDA!
    r_ajuste = client.put(
        f"/competicoes/suspensoes/{id_susp}",
        json={
            "jogos": 1,
            "motivo": "Redução de pena após recurso deferido pela comissão",
        },
        headers=headers_coord,
    )
    assert r_ajuste.status_code == 200
    dados_ajuste = r_ajuste.json()
    assert dados_ajuste["jogos"] == 1
    assert dados_ajuste["jogos_cumpridos"] == 1
    assert dados_ajuste["jogos_pendentes"] == 0
    assert dados_ajuste["situacao"] == "CUMPRIDA"

    # Tentar ajustar jogos para valor menor que jogos_cumpridos (ex: 0 falha no schema 422;
    # se tiver 2 cumprimentos e tentar ajustar para 1, falha 422 no serviço)
    r_invalido = client.put(
        f"/competicoes/suspensoes/{id_susp}",
        json={"jogos": 1, "motivo": "ab"},  # motivo menor que 3 caracteres -> 422
        headers=headers_coord,
    )
    assert r_invalido.status_code == 422

    # Verifica registros de auditoria no banco
    auditorias = (
        db.execute(
            select(AuditoriaCompeticao).where(
                AuditoriaCompeticao.id_edicao_competicao == edicao.id_edicao_competicao
            )
        )
        .scalars()
        .all()
    )
    acoes = [a.acao for a in auditorias]
    assert len(auditorias) >= 3
    assert any("CRIAR" in a for a in acoes)
    assert any("CUMPR" in a for a in acoes)
    assert any("AJUST" in a for a in acoes)

    # Qualquer usuário autenticado pode consultar o painel disciplinar
    r_painel = client.get(
        f"/competicoes/edicoes/{edicao.id_edicao_competicao}/disciplinar",
        headers=headers_prof,
    )
    assert r_painel.status_code == 200
    painel_json = r_painel.json()
    assert painel_json["id_edicao_competicao"] == edicao.id_edicao_competicao
    assert len(painel_json["suspensoes"]) == 1
    assert len(painel_json["resumo_cartoes"]) == 1
