"""Testes do motor puro de avanço de fase eliminatória e propagação no grafo (Task 3 - Fatia 2).

Cobre:
- Resolução imediata de duelo com vaga de FOLGA (sem partidas).
- Resolução de duelo em jogo único no tempo normal.
- Resolução de duelo em jogo único decidido nos pênaltis.
- Duelo jogo único empatado sem pênaltis -> estado DEFINIDO sem vencedor.
- Resolução de duelo ida e volta no placar agregado (Jogo 1: 1x0, Jogo 2: 0x2 -> 1x2).
- Resolução de duelo ida e volta empatado no agregado decidido nos pênaltis da volta.
- Duelo ida e volta com 1 partida pendente -> estado DEFINIDO sem vencedor.
- Propagação no grafo de vagas dependentes de VENCEDOR_DUELO e PERDEDOR_DUELO (3º lugar).
"""

from competicoes.contratos.classificacao import (
    AtualizacaoVaga,
    ResultadoDueloResolvido,
)
from competicoes.servicos.motores.avanco import (
    propagar_avanco_grafo,
    resolver_duelo,
)


def test_resolver_duelo_com_folga_imediata():
    duelo = {
        "id_duelo": 10,
        "ida_volta": False,
        "estado": "PENDENTE",
        "vagas": [
            {"id_vaga": 101, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe": 42, "id_equipe_resolvida": 42},
            {"id_vaga": 102, "posicao": 2, "origem": "FOLGA", "id_equipe": None, "id_equipe_resolvida": None},
        ],
    }

    resultado = resolver_duelo(duelo, partidas=[])

    assert isinstance(resultado, ResultadoDueloResolvido)
    assert resultado.id_duelo == 10
    assert resultado.estado == "RESOLVIDO"
    assert resultado.id_equipe_vencedora == 42
    assert resultado.id_equipe_perdedora is None
    assert resultado.foi_penaltis is False
    assert resultado.placar_agregado_mandante == 0
    assert resultado.placar_agregado_visitante == 0


def test_resolver_duelo_jogo_unico_tempo_normal():
    duelo = {
        "id_duelo": 20,
        "ida_volta": False,
        "estado": "DEFINIDO",
        "vagas": [
            {"id_vaga": 201, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe": 10, "id_equipe_resolvida": 10},
            {"id_vaga": 202, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe": 20, "id_equipe_resolvida": 20},
        ],
    }
    partidas = [
        {
            "id_partida": 1,
            "id_duelo": 20,
            "ordem_jogo": 1,
            "id_equipe_mandante": 10,
            "id_equipe_visitante": 20,
            "gols_mandante": 3,
            "gols_visitante": 1,
            "penaltis_mandante": None,
            "penaltis_visitante": None,
            "estado": "FINALIZADA",
        }
    ]

    resultado = resolver_duelo(duelo, partidas)

    assert resultado.id_duelo == 20
    assert resultado.estado == "RESOLVIDO"
    assert resultado.id_equipe_vencedora == 10
    assert resultado.id_equipe_perdedora == 20
    assert resultado.foi_penaltis is False
    assert resultado.placar_agregado_mandante == 3
    assert resultado.placar_agregado_visitante == 1


def test_resolver_duelo_jogo_unico_penaltis():
    duelo = {
        "id_duelo": 30,
        "ida_volta": False,
        "estado": "DEFINIDO",
        "vagas": [
            {"id_vaga": 301, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe": 10, "id_equipe_resolvida": 10},
            {"id_vaga": 302, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe": 20, "id_equipe_resolvida": 20},
        ],
    }
    partidas = [
        {
            "id_partida": 2,
            "id_duelo": 30,
            "ordem_jogo": 1,
            "id_equipe_mandante": 10,
            "id_equipe_visitante": 20,
            "gols_mandante": 2,
            "gols_visitante": 2,
            "penaltis_mandante": 5,
            "penaltis_visitante": 4,
            "estado": "FINALIZADA",
        }
    ]

    resultado = resolver_duelo(duelo, partidas)

    assert resultado.id_duelo == 30
    assert resultado.estado == "RESOLVIDO"
    assert resultado.id_equipe_vencedora == 10
    assert resultado.id_equipe_perdedora == 20
    assert resultado.foi_penaltis is True
    assert resultado.placar_agregado_mandante == 2
    assert resultado.placar_agregado_visitante == 2


def test_resolver_duelo_jogo_unico_empate_sem_penaltis():
    duelo = {
        "id_duelo": 35,
        "ida_volta": False,
        "estado": "DEFINIDO",
        "vagas": [
            {"id_vaga": 351, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe": 10, "id_equipe_resolvida": 10},
            {"id_vaga": 352, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe": 20, "id_equipe_resolvida": 20},
        ],
    }
    partidas = [
        {
            "id_partida": 3,
            "id_duelo": 35,
            "ordem_jogo": 1,
            "id_equipe_mandante": 10,
            "id_equipe_visitante": 20,
            "gols_mandante": 1,
            "gols_visitante": 1,
            "penaltis_mandante": None,
            "penaltis_visitante": None,
            "estado": "FINALIZADA",
        }
    ]

    resultado = resolver_duelo(duelo, partidas)

    assert resultado.id_duelo == 35
    assert resultado.estado == "DEFINIDO"
    assert resultado.id_equipe_vencedora is None
    assert resultado.id_equipe_perdedora is None


def test_resolver_duelo_ida_e_volta_agregado_direto():
    # Jogo 1: Team 10 (1) x (0) Team 20 -> Mandante 10 marcou 1
    # Jogo 2: Team 20 (2) x (0) Team 10 -> Mandante 20 marcou 2
    # Agregado: Team 10 (1) x (2) Team 20 -> Vencedor: 20
    duelo = {
        "id_duelo": 40,
        "ida_volta": True,
        "estado": "DEFINIDO",
        "vagas": [
            {"id_vaga": 401, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe": 10, "id_equipe_resolvida": 10},
            {"id_vaga": 402, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe": 20, "id_equipe_resolvida": 20},
        ],
    }
    partidas = [
        {
            "id_partida": 4,
            "id_duelo": 40,
            "ordem_jogo": 1,
            "id_equipe_mandante": 10,
            "id_equipe_visitante": 20,
            "gols_mandante": 1,
            "gols_visitante": 0,
            "estado": "FINALIZADA",
        },
        {
            "id_partida": 5,
            "id_duelo": 40,
            "ordem_jogo": 2,
            "id_equipe_mandante": 20,
            "id_equipe_visitante": 10,
            "gols_mandante": 2,
            "gols_visitante": 0,
            "estado": "FINALIZADA",
        },
    ]

    resultado = resolver_duelo(duelo, partidas)

    assert resultado.id_duelo == 40
    assert resultado.estado == "RESOLVIDO"
    assert resultado.id_equipe_vencedora == 20
    assert resultado.id_equipe_perdedora == 10
    assert resultado.placar_agregado_mandante == 1  # Equipe 10 (mandante da ida / vaga 1)
    assert resultado.placar_agregado_visitante == 2  # Equipe 20 (visitante da ida / vaga 2)
    assert resultado.foi_penaltis is False


def test_resolver_duelo_ida_e_volta_empate_agregado_penaltis():
    # Jogo 1: Team 10 (1) x (0) Team 20
    # Jogo 2: Team 20 (1) x (0) Team 10 -> Agregado 1x1
    # Pênaltis na volta: Team 20 (3) x (4) Team 10
    duelo = {
        "id_duelo": 50,
        "ida_volta": True,
        "estado": "DEFINIDO",
        "vagas": [
            {"id_vaga": 501, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe": 10, "id_equipe_resolvida": 10},
            {"id_vaga": 502, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe": 20, "id_equipe_resolvida": 20},
        ],
    }
    partidas = [
        {
            "id_partida": 6,
            "id_duelo": 50,
            "ordem_jogo": 1,
            "id_equipe_mandante": 10,
            "id_equipe_visitante": 20,
            "gols_mandante": 1,
            "gols_visitante": 0,
            "estado": "FINALIZADA",
        },
        {
            "id_partida": 7,
            "id_duelo": 50,
            "ordem_jogo": 2,
            "id_equipe_mandante": 20,
            "id_equipe_visitante": 10,
            "gols_mandante": 1,
            "gols_visitante": 0,
            "penaltis_mandante": 3,
            "penaltis_visitante": 4,
            "estado": "FINALIZADA",
        },
    ]

    resultado = resolver_duelo(duelo, partidas)

    assert resultado.id_duelo == 50
    assert resultado.estado == "RESOLVIDO"
    assert resultado.id_equipe_vencedora == 10
    assert resultado.id_equipe_perdedora == 20
    assert resultado.placar_agregado_mandante == 1
    assert resultado.placar_agregado_visitante == 1
    assert resultado.foi_penaltis is True


def test_resolver_duelo_ida_e_volta_uma_partida_pendente():
    duelo = {
        "id_duelo": 60,
        "ida_volta": True,
        "estado": "DEFINIDO",
        "vagas": [
            {"id_vaga": 601, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe": 10, "id_equipe_resolvida": 10},
            {"id_vaga": 602, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe": 20, "id_equipe_resolvida": 20},
        ],
    }
    partidas = [
        {
            "id_partida": 8,
            "id_duelo": 60,
            "ordem_jogo": 1,
            "id_equipe_mandante": 10,
            "id_equipe_visitante": 20,
            "gols_mandante": 2,
            "gols_visitante": 0,
            "estado": "FINALIZADA",
        },
        {
            "id_partida": 9,
            "id_duelo": 60,
            "ordem_jogo": 2,
            "id_equipe_mandante": 20,
            "id_equipe_visitante": 10,
            "gols_mandante": None,
            "gols_visitante": None,
            "estado": "AGENDADA",
        },
    ]

    resultado = resolver_duelo(duelo, partidas)

    assert resultado.id_duelo == 60
    assert resultado.estado == "DEFINIDO"
    assert resultado.id_equipe_vencedora is None
    assert resultado.id_equipe_perdedora is None


def test_propagar_avanco_grafo_vencedor_e_terceiro_lugar():
    # Semifinal 1 (duelo 100) vencida pelo Time 1 sobre Time 2.
    # A Final possui vaga para VENCEDOR_DUELO de 100.
    # O 3º lugar possui vaga para PERDEDOR_DUELO de 100.
    vagas = [
        {
            "id_vaga": 701,
            "id_duelo": 200,  # Final
            "posicao": 1,
            "origem": "VENCEDOR_DUELO",
            "id_duelo_origem": 100,
            "id_equipe_resolvida": None,
        },
        {
            "id_vaga": 702,
            "id_duelo": 201,  # 3º Lugar
            "posicao": 1,
            "origem": "PERDEDOR_DUELO",
            "id_duelo_origem": 100,
            "id_equipe_resolvida": None,
        },
        {
            "id_vaga": 703,
            "id_duelo": 200,
            "posicao": 2,
            "origem": "VENCEDOR_DUELO",
            "id_duelo_origem": 101,  # Outra semifinal
            "id_equipe_resolvida": None,
        },
    ]
    duelos = [
        {"id_duelo": 100, "fase": "SEMIFINAL"},
        {"id_duelo": 101, "fase": "SEMIFINAL"},
        {"id_duelo": 200, "fase": "FINAL"},
        {"id_duelo": 201, "fase": "TERCEIRO_LUGAR"},
    ]

    atualizacoes = propagar_avanco_grafo(
        duelos=duelos,
        vagas=vagas,
        duelo_resolvido_id=100,
        equipe_vencedora_id=1,
        equipe_perdedora_id=2,
    )

    assert len(atualizacoes) == 2
    assert all(isinstance(a, AtualizacaoVaga) for a in atualizacoes)

    mapa_at = {a.id_vaga: a.id_equipe_resolvida for a in atualizacoes}
    assert mapa_at[701] == 1  # Vencedor da semifinal vai para a Final
    assert mapa_at[702] == 2  # Perdedor da semifinal vai para o 3º Lugar
    assert 703 not in mapa_at


def test_resolver_duelo_com_folga_posicao_1():
    duelo = {
        "id_duelo": 15,
        "ida_volta": False,
        "estado": "PENDENTE",
        "vagas": [
            {"id_vaga": 151, "posicao": 1, "origem": "FOLGA", "id_equipe": None, "id_equipe_resolvida": None},
            {"id_vaga": 152, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe": 99, "id_equipe_resolvida": 99},
        ],
    }
    resultado = resolver_duelo(duelo, partidas=[])
    assert resultado.id_duelo == 15
    assert resultado.estado == "RESOLVIDO"
    assert resultado.id_equipe_vencedora == 99
    assert resultado.id_equipe_perdedora is None


def test_resolver_duelo_sem_partidas_nem_folga():
    duelo = {
        "id_duelo": 16,
        "ida_volta": False,
        "estado": "DEFINIDO",
        "vagas": [
            {"id_vaga": 161, "posicao": 1, "origem": "EQUIPE_INICIAL", "id_equipe": 1, "id_equipe_resolvida": 1},
            {"id_vaga": 162, "posicao": 2, "origem": "EQUIPE_INICIAL", "id_equipe": 2, "id_equipe_resolvida": 2},
        ],
    }
    resultado = resolver_duelo(duelo, partidas=[])
    assert resultado.id_duelo == 16
    assert resultado.estado == "DEFINIDO"
    assert resultado.id_equipe_vencedora is None


def test_resolver_duelo_ida_e_volta_mandante_ida_vence():
    duelo = {
        "id_duelo": 45,
        "ida_volta": True,
        "estado": "DEFINIDO",
    }
    partidas = [
        {
            "id_partida": 10,
            "id_duelo": 45,
            "ordem_jogo": 1,
            "id_equipe_mandante": 10,
            "id_equipe_visitante": 20,
            "gols_mandante": 3,
            "gols_visitante": 0,
            "estado": "FINALIZADA",
        },
        {
            "id_partida": 11,
            "id_duelo": 45,
            "ordem_jogo": 2,
            "id_equipe_mandante": 20,
            "id_equipe_visitante": 10,
            "gols_mandante": 1,
            "gols_visitante": 0,
            "estado": "FINALIZADA",
        },
    ]
    resultado = resolver_duelo(duelo, partidas)
    assert resultado.id_duelo == 45
    assert resultado.estado == "RESOLVIDO"
    assert resultado.id_equipe_vencedora == 10
    assert resultado.id_equipe_perdedora == 20
    assert resultado.placar_agregado_mandante == 3
    assert resultado.placar_agregado_visitante == 1


def test_propagar_avanco_grafo_sem_perdedor():
    vagas = [
        {
            "id_vaga": 801,
            "id_duelo": 300,
            "posicao": 1,
            "origem": "VENCEDOR_DUELO",
            "id_duelo_origem": 50,
            "id_equipe_resolvida": None,
        },
        {
            "id_vaga": 802,
            "id_duelo": 301,
            "posicao": 1,
            "origem": "PERDEDOR_DUELO",
            "id_duelo_origem": 50,
            "id_equipe_resolvida": None,
        },
    ]
    atualizacoes = propagar_avanco_grafo(
        duelos=[],
        vagas=vagas,
        duelo_resolvido_id=50,
        equipe_vencedora_id=10,
        equipe_perdedora_id=None,
    )
    assert len(atualizacoes) == 1
    assert atualizacoes[0].id_vaga == 801
    assert atualizacoes[0].id_equipe_resolvida == 10

