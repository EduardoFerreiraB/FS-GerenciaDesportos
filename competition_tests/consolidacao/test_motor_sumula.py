"""Testes unitários dos contratos e do motor puro de súmula, artilharia e travas de grafo (Task 2 - Fatia 3)."""

from datetime import datetime
import pytest
from pydantic import ValidationError

from competicoes.contratos.sumula import (
    AlertaSuspensoPartida,
    ArtilheiroDetalhe,
    MotivoOperacao,
    OcorrenciaAutorAtualizar,
    OcorrenciaCriar,
    OcorrenciaDetalhe,
    OcorrenciaRemover,
    PartidaFinalizar,
    SumulaDetalhe,
    TabelaArtilhariaDetalhe,
)
from competicoes.erros import ConfiguracaoInvalida
from competicoes.servicos.motores.sumula import (
    analisar_impacto_reabertura,
    avaliar_derivacao_segundo_amarelo,
    calcular_artilharia,
    resolver_equipe_beneficiada,
    validar_ajuste_resultado_simples,
)


# ============================================================================
# 0. Contratos Pydantic de Súmula
# ============================================================================


def test_contratos_sumula_validacao_basica():
    oc = OcorrenciaCriar(
        tipo="GOL",
        id_equipe=10,
        id_integrante=100,
        minuto=45,
        periodo="1T",
    )
    assert oc.tipo == "GOL"
    assert oc.id_equipe == 10
    assert oc.id_integrante == 100
    assert oc.minuto == 45

    # EXPULSAO_SEGUNDO_AMARELO não pode ser lançada diretamente no input
    with pytest.raises(ValidationError):
        OcorrenciaCriar(
            tipo="EXPULSAO_SEGUNDO_AMARELO",  # type: ignore[arg-type]
            id_equipe=10,
            id_integrante=100,
        )

    # MotivoOperacao exige ao menos 3 caracteres
    with pytest.raises(ValidationError):
        MotivoOperacao(motivo="ab")

    mot = MotivoOperacao(motivo="Erro de digitação na súmula")
    assert mot.motivo == "Erro de digitação na súmula"


# ============================================================================
# 1. resolver_equipe_beneficiada
# ============================================================================


def test_resolver_equipe_beneficiada_gol_sem_autor():
    beneficiada = resolver_equipe_beneficiada(
        tipo="GOL",
        id_equipe_informada=10,
        id_integrante=None,
        id_equipe_integrante=None,
        id_mandante=10,
        id_visitante=20,
    )
    assert beneficiada == 10


def test_resolver_equipe_beneficiada_gol_com_autor_valido():
    beneficiada = resolver_equipe_beneficiada(
        tipo="GOL",
        id_equipe_informada=20,
        id_integrante=501,
        id_equipe_integrante=20,
        id_mandante=10,
        id_visitante=20,
    )
    assert beneficiada == 20


def test_resolver_equipe_beneficiada_gol_autor_equipe_divergente_rejeitado():
    with pytest.raises(ConfiguracaoInvalida) as exc:
        resolver_equipe_beneficiada(
            tipo="GOL",
            id_equipe_informada=10,
            id_integrante=501,
            id_equipe_integrante=20,
            id_mandante=10,
            id_visitante=20,
        )
    assert "id_integrante" in exc.value.campos


def test_resolver_equipe_beneficiada_gol_contra_inverte_para_adversario():
    # Integrante pertence ao mandante (10) -> GOL_CONTRA beneficia o visitante (20)
    beneficiada_visitante = resolver_equipe_beneficiada(
        tipo="GOL_CONTRA",
        id_equipe_informada=10,
        id_integrante=101,
        id_equipe_integrante=10,
        id_mandante=10,
        id_visitante=20,
    )
    assert beneficiada_visitante == 20

    # Integrante pertence ao visitante (20) -> GOL_CONTRA beneficia o mandante (10)
    beneficiada_mandante = resolver_equipe_beneficiada(
        tipo="GOL_CONTRA",
        id_equipe_informada=20,
        id_integrante=202,
        id_equipe_integrante=20,
        id_mandante=10,
        id_visitante=20,
    )
    assert beneficiada_mandante == 10


def test_resolver_equipe_beneficiada_cartoes_e_gol_contra_exigem_integrante():
    for tipo in ("CARTAO_AMARELO", "CARTAO_VERMELHO_DIRETO", "GOL_CONTRA"):
        with pytest.raises(ConfiguracaoInvalida) as exc:
            resolver_equipe_beneficiada(
                tipo=tipo,
                id_equipe_informada=10,
                id_integrante=None,
                id_equipe_integrante=None,
                id_mandante=10,
                id_visitante=20,
            )
        assert "id_integrante" in exc.value.campos


def test_resolver_equipe_beneficiada_cartoes_retornam_equipe_do_integrante():
    for tipo in ("CARTAO_AMARELO", "CARTAO_VERMELHO_DIRETO"):
        eq = resolver_equipe_beneficiada(
            tipo=tipo,
            id_equipe_informada=20,
            id_integrante=205,
            id_equipe_integrante=20,
            id_mandante=10,
            id_visitante=20,
        )
        assert eq == 20


def test_resolver_equipe_beneficiada_rejeita_equipe_ou_integrante_fora_da_partida():
    with pytest.raises(ConfiguracaoInvalida) as exc_eq:
        resolver_equipe_beneficiada(
            tipo="GOL",
            id_equipe_informada=99,
            id_integrante=None,
            id_equipe_integrante=None,
            id_mandante=10,
            id_visitante=20,
        )
    assert "id_equipe" in exc_eq.value.campos

    with pytest.raises(ConfiguracaoInvalida) as exc_int:
        resolver_equipe_beneficiada(
            tipo="CARTAO_AMARELO",
            id_equipe_informada=10,
            id_integrante=999,
            id_equipe_integrante=99,
            id_mandante=10,
            id_visitante=20,
        )
    assert "id_integrante" in exc_int.value.campos


# ============================================================================
# 2. avaliar_derivacao_segundo_amarelo
# ============================================================================


def test_avaliar_derivacao_segundo_amarelo_fluxo_completo():
    ocorrencias: list[dict] = []

    # 1º amarelo não expulsa
    deriva_1 = avaliar_derivacao_segundo_amarelo(
        ocorrencias_partida=ocorrencias,
        tipo_novo="CARTAO_AMARELO",
        id_integrante=101,
    )
    assert deriva_1 is False

    # Outro jogador recebe amarelo -> não afeta o 101
    ocorrencias.append(
        {"id_ocorrencia": 1, "tipo": "CARTAO_AMARELO", "id_integrante": 202}
    )
    assert (
        avaliar_derivacao_segundo_amarelo(ocorrencias, "CARTAO_AMARELO", 101)
        is False
    )

    # Registra 1º amarelo do 101
    ocorrencias.append(
        {"id_ocorrencia": 2, "tipo": "CARTAO_AMARELO", "id_integrante": 101}
    )

    # Outros tipos para o 101 não disparam 2º amarelo
    assert avaliar_derivacao_segundo_amarelo(ocorrencias, "GOL", 101) is False
    assert (
        avaliar_derivacao_segundo_amarelo(
            ocorrencias, "CARTAO_VERMELHO_DIRETO", 101
        )
        is False
    )

    # 2º amarelo do 101 dispara EXPULSAO_SEGUNDO_AMARELO
    deriva_2 = avaliar_derivacao_segundo_amarelo(
        ocorrencias_partida=ocorrencias,
        tipo_novo="CARTAO_AMARELO",
        id_integrante=101,
    )
    assert deriva_2 is True

    # Após ter 2 amarelos e expulsão derivada, um 3º amarelo é rejeitado
    ocorrencias.append(
        {"id_ocorrencia": 3, "tipo": "CARTAO_AMARELO", "id_integrante": 101}
    )
    ocorrencias.append(
        {
            "id_ocorrencia": 4,
            "tipo": "EXPULSAO_SEGUNDO_AMARELO",
            "id_integrante": 101,
            "id_ocorrencia_origem": 3,
        }
    )
    with pytest.raises(ConfiguracaoInvalida) as exc:
        avaliar_derivacao_segundo_amarelo(
            ocorrencias_partida=ocorrencias,
            tipo_novo="CARTAO_AMARELO",
            id_integrante=101,
        )
    assert "id_integrante" in exc.value.campos


# ============================================================================
# 3. validar_ajuste_resultado_simples
# ============================================================================


def test_validar_ajuste_resultado_simples_protege_gols_identificados_e_contra():
    # Mandante (10) tem: 1 gol com autor (id 1), 1 gol contra a seu favor (id 2), 1 gol sem autor (id 3) -> 2 fixos, 1 sem autor
    # Visitante (20) tem: 1 gol com autor (id 4), 1 cartão amarelo (id 5) -> 1 fixo
    ocorrencias = [
        {
            "id_ocorrencia": 1,
            "tipo": "GOL",
            "id_equipe_beneficiada": 10,
            "id_integrante": 101,
        },
        {
            "id_ocorrencia": 2,
            "tipo": "GOL_CONTRA",
            "id_equipe_beneficiada": 10,
            "id_integrante": 201,
        },
        {
            "id_ocorrencia": 3,
            "tipo": "GOL",
            "id_equipe_beneficiada": 10,
            "id_integrante": None,
        },
        {
            "id_ocorrencia": 4,
            "tipo": "GOL",
            "id_equipe_beneficiada": 20,
            "id_integrante": 202,
        },
        {
            "id_ocorrencia": 5,
            "tipo": "CARTAO_AMARELO",
            "id_equipe_beneficiada": 20,
            "id_integrante": 202,
        },
    ]

    # Placar menor que os 2 gols fixos do mandante deve falhar
    with pytest.raises(ConfiguracaoInvalida) as exc_m:
        validar_ajuste_resultado_simples(
            ocorrencias_partida=ocorrencias,
            id_mandante=10,
            id_visitante=20,
            novos_gols_mandante=1,
            novos_gols_visitante=1,
        )
    assert "gols_mandante" in exc_m.value.campos

    # Placar menor que o 1 gol fixo do visitante deve falhar
    with pytest.raises(ConfiguracaoInvalida) as exc_v:
        validar_ajuste_resultado_simples(
            ocorrencias_partida=ocorrencias,
            id_mandante=10,
            id_visitante=20,
            novos_gols_mandante=2,
            novos_gols_visitante=0,
        )
    assert "gols_visitante" in exc_v.value.campos

    # Ajuste válido para 4 x 2 -> precisa de (4 - 2 = 2) gols sem autoria para mandante e (2 - 1 = 1) para visitante
    ajuste = validar_ajuste_resultado_simples(
        ocorrencias_partida=ocorrencias,
        id_mandante=10,
        id_visitante=20,
        novos_gols_mandante=4,
        novos_gols_visitante=2,
    )
    assert ajuste == {
        "gols_sem_autoria_mandante": 2,
        "gols_sem_autoria_visitante": 1,
        "ids_gols_sem_autoria_remover": [3],
    }


# ============================================================================
# 4. calcular_artilharia
# ============================================================================


def test_calcular_artilharia_ignora_gol_contra_sem_autor_e_canceladas():
    partidas = [
        {"id_partida": 1, "estado": "FINALIZADA"},
        {"id_partida": 2, "estado": "EM_ANDAMENTO"},
        {"id_partida": 3, "estado": "CANCELADA"},
    ]
    integrantes = {
        101: {
            "id_integrante": 101,
            "id_competidor": 1001,
            "nome_esportivo": "Carlos Silva",
            "numero_camisa": 9,
            "id_equipe": 10,
            "nome_equipe": "Tigres",
        },
        102: {
            "id_integrante": 102,
            "id_competidor": 1002,
            "nome_esportivo": "André Souza",
            "numero_camisa": 11,
            "id_equipe": 10,
            "nome_equipe": "Tigres",
        },
        201: {
            "id_integrante": 201,
            "id_competidor": 2001,
            "nome_esportivo": "Bruno Lima",
            "numero_camisa": 10,
            "id_equipe": 20,
            "nome_equipe": "Leões",
        },
    }
    ocorrencias = [
        # Partida 1 (FINALIZADA): 2 gols de Carlos (101), 1 de Bruno (201), 1 GOL_CONTRA de André (102), 1 GOL sem autor
        {"id_ocorrencia": 1, "id_partida": 1, "tipo": "GOL", "id_integrante": 101},
        {"id_ocorrencia": 2, "id_partida": 1, "tipo": "GOL", "id_integrante": 101},
        {"id_ocorrencia": 3, "id_partida": 1, "tipo": "GOL", "id_integrante": 201},
        {"id_ocorrencia": 4, "id_partida": 1, "tipo": "GOL_CONTRA", "id_integrante": 102},
        {"id_ocorrencia": 5, "id_partida": 1, "tipo": "GOL", "id_integrante": None},
        # Partida 2 (EM_ANDAMENTO): 1 gol de Bruno (201), 2 gols de André (102)
        {"id_ocorrencia": 6, "id_partida": 2, "tipo": "GOL", "id_integrante": 201},
        {"id_ocorrencia": 7, "id_partida": 2, "tipo": "GOL", "id_integrante": 102},
        {"id_ocorrencia": 8, "id_partida": 2, "tipo": "GOL", "id_integrante": 102},
        # Partida 3 (CANCELADA): 5 gols de Carlos (101) -> devem ser ignorados
        {"id_ocorrencia": 9, "id_partida": 3, "tipo": "GOL", "id_integrante": 101},
    ]

    tabela = calcular_artilharia(
        id_edicao_competicao=7,
        ocorrencias=ocorrencias,
        partidas=partidas,
        integrantes=integrantes,
    )

    assert isinstance(tabela, TabelaArtilhariaDetalhe)
    assert tabela.id_edicao_competicao == 7
    assert tabela.possui_jogos_em_andamento is True
    assert len(tabela.artilheiros) == 3

    # Todos empatados com 2 gols -> ordenados por nome_esportivo ("André Souza", "Bruno Lima", "Carlos Silva")
    assert tabela.artilheiros[0].nome_esportivo == "André Souza"
    assert tabela.artilheiros[0].posicao == 1
    assert tabela.artilheiros[0].gols == 2
    assert tabela.artilheiros[0].gols_em_andamento == 2

    assert tabela.artilheiros[1].nome_esportivo == "Bruno Lima"
    assert tabela.artilheiros[1].posicao == 2
    assert tabela.artilheiros[1].gols == 2
    assert tabela.artilheiros[1].gols_em_andamento == 1

    assert tabela.artilheiros[2].nome_esportivo == "Carlos Silva"
    assert tabela.artilheiros[2].posicao == 3
    assert tabela.artilheiros[2].gols == 2
    assert tabela.artilheiros[2].gols_em_andamento == 0


# ============================================================================
# 5. analisar_impacto_reabertura
# ============================================================================


def _grafo_semifinais_final_terceiro():
    """Cria estrutura de Semifinais (100, 101) -> Final (200) e 3º Lugar (201)."""
    duelos = [
        {"id_duelo": 100, "fase": "SEMIFINAL", "ida_volta": False, "estado": "RESOLVIDO"},
        {"id_duelo": 101, "fase": "SEMIFINAL", "ida_volta": False, "estado": "RESOLVIDO"},
        {"id_duelo": 200, "fase": "FINAL", "ida_volta": False, "estado": "DEFINIDO"},
        {"id_duelo": 201, "fase": "TERCEIRO_LUGAR", "ida_volta": False, "estado": "DEFINIDO"},
    ]
    vagas = [
        {"id_vaga": 1, "id_duelo": 100, "posicao": 1, "origem": "POSICAO_GRUPO", "id_equipe_resolvida": 10},
        {"id_vaga": 2, "id_duelo": 100, "posicao": 2, "origem": "POSICAO_GRUPO", "id_equipe_resolvida": 20},
        {"id_vaga": 3, "id_duelo": 101, "posicao": 1, "origem": "POSICAO_GRUPO", "id_equipe_resolvida": 30},
        {"id_vaga": 4, "id_duelo": 101, "posicao": 2, "origem": "POSICAO_GRUPO", "id_equipe_resolvida": 40},
        {"id_vaga": 5, "id_duelo": 200, "posicao": 1, "origem": "VENCEDOR_DUELO", "id_duelo_origem": 100, "id_equipe_resolvida": 10},
        {"id_vaga": 6, "id_duelo": 200, "posicao": 2, "origem": "VENCEDOR_DUELO", "id_duelo_origem": 101, "id_equipe_resolvida": 30},
        {"id_vaga": 7, "id_duelo": 201, "posicao": 1, "origem": "PERDEDOR_DUELO", "id_duelo_origem": 100, "id_equipe_resolvida": 20},
        {"id_vaga": 8, "id_duelo": 201, "posicao": 2, "origem": "PERDEDOR_DUELO", "id_duelo_origem": 101, "id_equipe_resolvida": 40},
    ]
    partidas = [
        {"id_partida": 10, "id_duelo": 100, "ordem_jogo": 1, "estado": "FINALIZADA", "tem_ocorrencias": True},
        {"id_partida": 11, "id_duelo": 101, "ordem_jogo": 1, "estado": "FINALIZADA", "tem_ocorrencias": True},
        {"id_partida": 20, "id_duelo": 200, "ordem_jogo": 1, "estado": "AGENDADA", "tem_ocorrencias": False},
        {"id_partida": 21, "id_duelo": 201, "ordem_jogo": 1, "estado": "AGENDADA", "tem_ocorrencias": False},
    ]
    return duelos, vagas, partidas


def test_analisar_impacto_reabertura_semifinal_desfaz_final_e_terceiro_agendados():
    duelos, vagas, partidas = _grafo_semifinais_final_terceiro()

    impacto = analisar_impacto_reabertura(
        duelos=duelos,
        vagas=vagas,
        partidas=partidas,
        id_partida_alvo=10,  # Semifinal 100
    )

    assert impacto["bloqueado"] is False
    assert impacto["motivo"] is None
    assert impacto["ids_duelos_afetados"] == {200, 201}
    assert impacto["ids_vagas_afetadas"] == {5, 7}
    assert impacto["ids_partidas_remover"] == {20, 21}


def test_analisar_impacto_reabertura_bloqueia_se_terceiro_lugar_ja_iniciou():
    duelos, vagas, partidas = _grafo_semifinais_final_terceiro()
    # 3º lugar já entrou EM_ANDAMENTO
    partidas[3]["estado"] = "EM_ANDAMENTO"

    impacto = analisar_impacto_reabertura(
        duelos=duelos,
        vagas=vagas,
        partidas=partidas,
        id_partida_alvo=10,
    )

    assert impacto["bloqueado"] is True
    assert impacto["motivo"] is not None


def test_analisar_impacto_reabertura_ida_volta_bloqueia_se_volta_iniciou():
    duelos = [
        {"id_duelo": 50, "fase": "FINAL", "ida_volta": True, "estado": "DEFINIDO"},
    ]
    vagas = [
        {"id_vaga": 1, "id_duelo": 50, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe_resolvida": 10},
        {"id_vaga": 2, "id_duelo": 50, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe_resolvida": 20},
    ]
    partidas = [
        {"id_partida": 1, "id_duelo": 50, "ordem_jogo": 1, "estado": "FINALIZADA", "tem_ocorrencias": True},
        {"id_partida": 2, "id_duelo": 50, "ordem_jogo": 2, "estado": "AGENDADA", "tem_ocorrencias": False},
    ]

    # Volta agendada e sem ocorrências -> permite reabrir a ida
    imp_ok = analisar_impacto_reabertura(duelos, vagas, partidas, id_partida_alvo=1)
    assert imp_ok["bloqueado"] is False
    assert imp_ok["ids_partidas_remover"] == set()

    # Volta já finalizada -> bloqueia reabertura da ida
    partidas[1]["estado"] = "FINALIZADA"
    imp_bloq = analisar_impacto_reabertura(duelos, vagas, partidas, id_partida_alvo=1)
    assert imp_bloq["bloqueado"] is True
    assert "volta" in imp_bloq["motivo"].lower()


def test_analisar_impacto_reabertura_partida_grupo_e_reabrir_grupos():
    duelos, vagas, partidas = _grafo_semifinais_final_terceiro()
    # Partida de grupo (id_grupo=1, id_duelo=None)
    partidas.append(
        {"id_partida": 5, "id_grupo": 1, "id_duelo": None, "estado": "FINALIZADA", "tem_ocorrencias": True}
    )

    # Como as vagas POSICAO_GRUPO (1..4) já estão resolvidas, reabrir a partida 5 direto é bloqueado
    imp_part_grupo = analisar_impacto_reabertura(duelos, vagas, partidas, id_partida_alvo=5)
    assert imp_part_grupo["bloqueado"] is True

    # Reabrir fase de grupos enquanto Semifinais (partidas 10 e 11) estão FINALIZADAS -> bloqueado
    imp_grupos_bloq = analisar_impacto_reabertura(duelos, vagas, partidas, reabrir_grupos=True)
    assert imp_grupos_bloq["bloqueado"] is True

    # Se Semifinais e Finais estiverem apenas AGENDADAS sem ocorrências -> reabrir_grupos=True é permitido
    for p in partidas:
        if p.get("id_duelo") is not None:
            p["estado"] = "AGENDADA"
            p["tem_ocorrencias"] = False

    imp_grupos_ok = analisar_impacto_reabertura(duelos, vagas, partidas, reabrir_grupos=True)
    assert imp_grupos_ok["bloqueado"] is False
    assert imp_grupos_ok["ids_duelos_afetados"] == {100, 101, 200, 201}
    assert imp_grupos_ok["ids_vagas_afetadas"] == {1, 2, 3, 4, 5, 6, 7, 8}
    assert imp_grupos_ok["ids_partidas_remover"] == {10, 11, 20, 21}


def test_analisar_impacto_reabertura_transitivo_multinivel_quartas_ate_final_e_terceiro():
    """Quartas (10) -> Semifinal (100) -> Final (200) e 3º Lugar (201)."""
    duelos = [
        {"id_duelo": 10, "fase": "QUARTAS", "ida_volta": False, "estado": "RESOLVIDO"},
        {"id_duelo": 100, "fase": "SEMIFINAL", "ida_volta": False, "estado": "DEFINIDO"},
        {"id_duelo": 200, "fase": "FINAL", "ida_volta": False, "estado": "PENDENTE"},
        {"id_duelo": 201, "fase": "TERCEIRO_LUGAR", "ida_volta": False, "estado": "PENDENTE"},
    ]
    vagas = [
        {"id_vaga": 1, "id_duelo": 10, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe_resolvida": 1},
        {"id_vaga": 2, "id_duelo": 10, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe_resolvida": 2},
        {"id_vaga": 11, "id_duelo": 100, "posicao": 1, "origem": "VENCEDOR_DUELO", "id_duelo_origem": 10, "id_equipe_resolvida": 1},
        {"id_vaga": 12, "id_duelo": 100, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe_resolvida": 3},
        {"id_vaga": 21, "id_duelo": 200, "posicao": 1, "origem": "VENCEDOR_DUELO", "id_duelo_origem": 100, "id_equipe_resolvida": None},
        {"id_vaga": 22, "id_duelo": 201, "posicao": 1, "origem": "PERDEDOR_DUELO", "id_duelo_origem": 100, "id_equipe_resolvida": None},
    ]
    partidas = [
        {"id_partida": 1001, "id_duelo": 10, "ordem_jogo": 1, "estado": "FINALIZADA", "tem_ocorrencias": True},
        {"id_partida": 1002, "id_duelo": 100, "ordem_jogo": 1, "estado": "AGENDADA", "tem_ocorrencias": False},
    ]

    impacto = analisar_impacto_reabertura(duelos, vagas, partidas, id_partida_alvo=1001)
    assert impacto["bloqueado"] is False
    assert impacto["ids_duelos_afetados"] == {100, 200, 201}
    assert impacto["ids_vagas_afetadas"] == {11, 21, 22}
    assert impacto["ids_partidas_remover"] == {1002}

    # Se a partida agendada da semifinal já tiver ocorrências lançadas, deve bloquear
    partidas[1]["tem_ocorrencias"] = True
    impacto_bloq = analisar_impacto_reabertura(duelos, vagas, partidas, id_partida_alvo=1001)
    assert impacto_bloq["bloqueado"] is True

