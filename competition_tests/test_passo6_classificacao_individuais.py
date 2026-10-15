"""Testes do Passo 6 para o módulo de classificação individual de provas e competições.

Testa:
- Formatação de tempo legível (milissegundos, segundos e minutos).
- Resolução de nome de atleta/aluno e número de peito.
- Classificação de prova por menor tempo_ms com posições sequenciais.
- Tratamento de atletas desqualificados (ficam ao final com posicao None).
- Identificação de pódio por prova (ouro, prata, bronze).
- Rejeição de competição em modo EQUIPE (ValueError).
- Rejeição de entidades inexistentes (404 / ValueError).
- Quadro consolidado de medalhas e ranking geral da competição com múltiplos atletas e provas.
- Critérios de desempate no quadro de medalhas (pratas, bronzes, nome alfabético).
"""

from datetime import date, time
import pytest

import models
from services.classificacao_individuais import (
    calcular_classificacao_individual_competicao,
    calcular_classificacao_prova,
    formatar_tempo,
    obter_nome_participante,
)


# ============================================================================
# Fixtures e Helpers de Setup
# ============================================================================

def _criar_cenario_base(db):
    """Cria entidades mínimas para competições e participantes."""
    evento = models.Evento(even_nome="Jogos Escolares 2026")
    modalidade_natacao = models.Modalidade(nome="Natação 50m Livre", duracao_minutos=30)
    modalidade_futsal = models.Modalidade(nome="Futsal", duracao_minutos=40)
    db.add_all([evento, modalidade_natacao, modalidade_futsal])
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

    comp_ind = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=modalidade_natacao.id_modalidade,
        nome="Torneio de Natação Individual 2026",
        categoria="Sub-17",
        modo_inscricao="INDIVIDUAL",
        formato="PROVAS",
        criterio_resultado="TEMPO",
        data_inicio=date(2026, 9, 10),
        data_fim=date(2026, 9, 15),
        status="EM_ANDAMENTO",
    )
    comp_equipe = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=modalidade_futsal.id_modalidade,
        nome="Copa Intercolegial de Futsal",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 9, 10),
        data_fim=date(2026, 9, 20),
        status="EM_ANDAMENTO",
    )
    db.add_all([comp_ind, comp_equipe])
    db.flush()

    local = models.Local(loca_nome="Parque Aquático Principal", ativo=True)
    db.add(local)
    db.flush()

    # Criar 5 participantes (4 atletas, 1 aluno)
    parts = [
        models.Participante(tipo="atleta"),
        models.Participante(tipo="atleta"),
        models.Participante(tipo="atleta"),
        models.Participante(tipo="atleta"),
        models.Participante(tipo="aluno"),
    ]
    db.add_all(parts)
    db.flush()

    a1 = models.Atleta(
        id_participante=parts[0].id_participante,
        nome_completo="Alice Nadadora",
        data_nascimento=date(2009, 1, 15),
        documento_pessoal="DOC-A1",
    )
    a2 = models.Atleta(
        id_participante=parts[1].id_participante,
        nome_completo="Bruno Velocista",
        data_nascimento=date(2009, 2, 20),
        documento_pessoal="DOC-B2",
    )
    a3 = models.Atleta(
        id_participante=parts[2].id_participante,
        nome_completo="Carlos Tubarão",
        data_nascimento=date(2009, 3, 25),
        documento_pessoal="DOC-C3",
    )
    a4 = models.Atleta(
        id_participante=parts[3].id_participante,
        nome_completo="Daniela Maratona",
        data_nascimento=date(2009, 4, 30),
        documento_pessoal="DOC-D4",
    )
    aluno5 = models.Aluno(
        id_participante=parts[4].id_participante,
        nome_completo="Eduardo Nadador Aluno",
        data_nascimento=date(2009, 5, 10),
        escola="Escola Municipal Esportiva",
        serie_ano="9º Ano",
        telefone_1="11999998888",
        endereco="Rua dos Esportes, 123",
    )
    db.add_all([a1, a2, a3, a4, aluno5])

    # Inscrever os participantes na competição individual com números de peito
    inscricoes = [
        models.InscricaoIndividual(id_competicao=comp_ind.id_competicao, id_participante=parts[0].id_participante, numero_peito=101),
        models.InscricaoIndividual(id_competicao=comp_ind.id_competicao, id_participante=parts[1].id_participante, numero_peito=102),
        models.InscricaoIndividual(id_competicao=comp_ind.id_competicao, id_participante=parts[2].id_participante, numero_peito=103),
        models.InscricaoIndividual(id_competicao=comp_ind.id_competicao, id_participante=parts[3].id_participante, numero_peito=104),
        models.InscricaoIndividual(id_competicao=comp_ind.id_competicao, id_participante=parts[4].id_participante, numero_peito=105),
    ]
    db.add_all(inscricoes)
    db.commit()

    return {
        "comp_ind": comp_ind,
        "comp_equipe": comp_equipe,
        "local": local,
        "participantes": parts,
    }


# ============================================================================
# 1. Testes de Formatação de Tempo Legível
# ============================================================================

def test_formatar_tempo_legivel():
    """Valida formatação de tempo para milissegundos, segundos e minutos."""
    # Sub-segundo / milissegundos
    assert formatar_tempo(0) == "00.000s"
    assert formatar_tempo(450) == "00.450s"
    assert formatar_tempo(999) == "00.999s"

    # Segundos (< 60000 ms) -> SS.mmm (ex: "25.432s")
    assert formatar_tempo(1000) == "01.000s"
    assert formatar_tempo(25432) == "25.432s"
    assert formatar_tempo(59999) == "59.999s"

    # Minutos (>= 60000 ms) -> MM:SS.mmm (ex: "01:14.210")
    assert formatar_tempo(60000) == "01:00.000"
    assert formatar_tempo(74210) == "01:14.210"
    assert formatar_tempo(125432) == "02:05.432"
    assert formatar_tempo(3661234) == "61:01.234"

    # Casos limites
    assert formatar_tempo(None) == ""
    assert formatar_tempo(-500) == "00.000s"


# ============================================================================
# 2. Testes de Resolução de Nome de Participante
# ============================================================================

def test_obter_nome_participante_derivado(db):
    """Testa obtenção do nome de participante derivado de atleta, aluno ou fallback."""
    env = _criar_cenario_base(db)
    part_atleta = env["participantes"][0]
    part_aluno = env["participantes"][4]

    assert obter_nome_participante(part_atleta) == "Alice Nadadora"
    assert obter_nome_participante(part_aluno) == "Eduardo Nadador Aluno"

    # Sem vínculo
    part_vazio = models.Participante(tipo="atleta")
    db.add(part_vazio)
    db.flush()
    assert f"Participante {part_vazio.id_participante}" == obter_nome_participante(part_vazio)
    assert obter_nome_participante(None) == "Participante Desconhecido"


# ============================================================================
# 3. Testes de Classificação de Prova
# ============================================================================

def test_classificacao_prova_ordenacao_por_menor_tempo_e_podio(db):
    """Testa classificação de prova por menor tempo_ms, atribuição de posições e pódio."""
    env = _criar_cenario_base(db)
    comp_ind = env["comp_ind"]
    parts = env["participantes"]

    prova = models.Prova(
        id_competicao=comp_ind.id_competicao,
        nome="50m Nado Livre Masculino/Feminino",
        data=date(2026, 9, 11),
        hora=time(10, 0),
        status="Finalizada",
    )
    db.add(prova)
    db.flush()

    # Lançar 3 resultados com tempos diferentes:
    # Bruno: 25.432s (1º lugar)
    # Alice: 27.100s (2º lugar)
    # Carlos: 29.850s (3º lugar)
    r1 = models.ResultadoProva(id_prova=prova.id_prova, id_participante=parts[1].id_participante, tempo_ms=25432)
    r2 = models.ResultadoProva(id_prova=prova.id_prova, id_participante=parts[0].id_participante, tempo_ms=27100)
    r3 = models.ResultadoProva(id_prova=prova.id_prova, id_participante=parts[2].id_participante, tempo_ms=29850)
    db.add_all([r1, r2, r3])
    db.commit()

    classificacao = calcular_classificacao_prova(db, prova.id_prova)

    assert classificacao["id_prova"] == prova.id_prova
    assert classificacao["nome_prova"] == "50m Nado Livre Masculino/Feminino"
    assert len(classificacao["resultados"]) == 3

    # 1º lugar: Bruno
    res_1 = classificacao["resultados"][0]
    assert res_1["posicao"] == 1
    assert res_1["id_participante"] == parts[1].id_participante
    assert res_1["nome_participante"] == "Bruno Velocista"
    assert res_1["numero_peito"] == 102
    assert res_1["tempo_ms"] == 25432
    assert res_1["tempo_formatado"] == "25.432s"
    assert res_1["desqualificado"] is False

    # 2º lugar: Alice
    res_2 = classificacao["resultados"][1]
    assert res_2["posicao"] == 2
    assert res_2["id_participante"] == parts[0].id_participante
    assert res_2["nome_participante"] == "Alice Nadadora"
    assert res_2["numero_peito"] == 101
    assert res_2["tempo_formatado"] == "27.100s"

    # 3º lugar: Carlos
    res_3 = classificacao["resultados"][2]
    assert res_3["posicao"] == 3
    assert res_3["id_participante"] == parts[2].id_participante
    assert res_3["nome_participante"] == "Carlos Tubarão"
    assert res_3["numero_peito"] == 103
    assert res_3["tempo_formatado"] == "29.850s"

    # Pódio
    assert classificacao["podio"]["ouro"]["nome_participante"] == "Bruno Velocista"
    assert classificacao["podio"]["prata"]["nome_participante"] == "Alice Nadadora"
    assert classificacao["podio"]["bronze"]["nome_participante"] == "Carlos Tubarão"
    assert len(classificacao["podio_lista"]) == 3


def test_classificacao_prova_desqualificados_ao_final_sem_posicao(db):
    """Testa que atletas desqualificados ficam ao final com posicao None e fora do pódio."""
    env = _criar_cenario_base(db)
    comp_ind = env["comp_ind"]
    parts = env["participantes"]

    prova = models.Prova(
        id_competicao=comp_ind.id_competicao,
        nome="100m Borboleta",
        data=date(2026, 9, 12),
        hora=time(14, 30),
        status="Finalizada",
    )
    db.add(prova)
    db.flush()

    # Alice teve o melhor tempo (20s), mas foi desqualificada por falsa largada
    # Bruno: 24s (válido -> deve ser 1º / ouro)
    # Carlos: 26s (válido -> deve ser 2º / prata)
    # Daniela: 28s (válido -> deve ser 3º / bronze)
    r_dq = models.ResultadoProva(
        id_prova=prova.id_prova,
        id_participante=parts[0].id_participante,
        tempo_ms=20000,
        desqualificado=True,
        motivo_desqualificacao="Queimou a largada",
    )
    r_b = models.ResultadoProva(id_prova=prova.id_prova, id_participante=parts[1].id_participante, tempo_ms=24000)
    r_c = models.ResultadoProva(id_prova=prova.id_prova, id_participante=parts[2].id_participante, tempo_ms=26000)
    r_d = models.ResultadoProva(id_prova=prova.id_prova, id_participante=parts[3].id_participante, tempo_ms=28000)
    db.add_all([r_dq, r_b, r_c, r_d])
    db.commit()

    classificacao = calcular_classificacao_prova(db, prova.id_prova)
    res = classificacao["resultados"]
    assert len(res) == 4

    # 1º, 2º e 3º são os atletas válidos
    assert res[0]["posicao"] == 1
    assert res[0]["nome_participante"] == "Bruno Velocista"
    assert res[1]["posicao"] == 2
    assert res[1]["nome_participante"] == "Carlos Tubarão"
    assert res[2]["posicao"] == 3
    assert res[2]["nome_participante"] == "Daniela Maratona"

    # O desqualificado fica por último, com posicao None
    assert res[3]["posicao"] is None
    assert res[3]["nome_participante"] == "Alice Nadadora"
    assert res[3]["desqualificado"] is True
    assert res[3]["motivo_desqualificacao"] == "Queimou a largada"

    # Pódio não inclui a atleta desqualificada
    assert classificacao["podio"]["ouro"]["nome_participante"] == "Bruno Velocista"
    assert classificacao["podio"]["prata"]["nome_participante"] == "Carlos Tubarão"
    assert classificacao["podio"]["bronze"]["nome_participante"] == "Daniela Maratona"


def test_classificacao_prova_menos_de_tres_atletas(db):
    """Testa pódio em provas com menos de 3 atletas ou prova sem resultados."""
    env = _criar_cenario_base(db)
    comp_ind = env["comp_ind"]
    parts = env["participantes"]

    prova_1_atleta = models.Prova(id_competicao=comp_ind.id_competicao, nome="Prova Solitária")
    db.add(prova_1_atleta)
    db.flush()

    r1 = models.ResultadoProva(id_prova=prova_1_atleta.id_prova, id_participante=parts[0].id_participante, tempo_ms=30000)
    db.add(r1)
    db.commit()

    res = calcular_classificacao_prova(db, prova_1_atleta.id_prova)
    assert res["podio"]["ouro"] is not None
    assert res["podio"]["ouro"]["nome_participante"] == "Alice Nadadora"
    assert res["podio"]["prata"] is None
    assert res["podio"]["bronze"] is None
    assert len(res["podio_lista"]) == 1

    # Prova sem nenhum resultado
    prova_vazia = models.Prova(id_competicao=comp_ind.id_competicao, nome="Prova Vazia")
    db.add(prova_vazia)
    db.commit()

    res_vazia = calcular_classificacao_prova(db, prova_vazia.id_prova)
    assert res_vazia["resultados"] == []
    assert res_vazia["podio"]["ouro"] is None
    assert res_vazia["podio"]["prata"] is None
    assert res_vazia["podio"]["bronze"] is None
    assert res_vazia["podio_lista"] == []


def test_classificacao_prova_inexistente_levanta_value_error(db):
    """Valida erro ValueError quando id_prova não existe."""
    with pytest.raises(ValueError, match="não encontrada"):
        calcular_classificacao_prova(db, id_prova=999999)


# ============================================================================
# 4. Testes de Restrição de Modo e Competição Inexistente
# ============================================================================

def test_classificacao_individual_competicao_rejeita_modo_equipe(db):
    """Testa que competição em modo EQUIPE é rejeitada com ValueError."""
    env = _criar_cenario_base(db)
    comp_equipe = env["comp_equipe"]

    with pytest.raises(ValueError, match="requer modo INDIVIDUAL"):
        calcular_classificacao_individual_competicao(db, comp_equipe.id_competicao)


def test_classificacao_individual_competicao_inexistente(db):
    """Testa que id de competição inexistente levanta ValueError."""
    with pytest.raises(ValueError, match="não encontrada"):
        calcular_classificacao_individual_competicao(db, id_competicao=999999)


def test_classificacao_prova_rejeita_competicao_equipe(db):
    """Testa que se uma prova estiver associada a competição EQUIPE, levanta ValueError."""
    env = _criar_cenario_base(db)
    comp_equipe = env["comp_equipe"]

    prova_irregular = models.Prova(id_competicao=comp_equipe.id_competicao, nome="Prova Irregular em Equipe")
    db.add(prova_irregular)
    db.commit()

    with pytest.raises(ValueError, match="requer modo INDIVIDUAL"):
        calcular_classificacao_prova(db, prova_irregular.id_prova)


# ============================================================================
# 5. Testes do Quadro Geral de Medalhas e Ranking Geral
# ============================================================================

def test_quadro_medalhas_multiplas_provas_multiplos_atletas(db):
    """Testa consolidação do quadro de medalhas com múltiplas provas e atletas."""
    env = _criar_cenario_base(db)
    comp_ind = env["comp_ind"]
    parts = env["participantes"]

    # Prova 1: 50m Costas
    # 1º Alice (Ouro), 2º Bruno (Prata), 3º Carlos (Bronze), 4º Daniela
    p1 = models.Prova(id_competicao=comp_ind.id_competicao, nome="50m Costas")
    db.add(p1)
    db.flush()
    db.add_all([
        models.ResultadoProva(id_prova=p1.id_prova, id_participante=parts[0].id_participante, tempo_ms=31000),
        models.ResultadoProva(id_prova=p1.id_prova, id_participante=parts[1].id_participante, tempo_ms=32000),
        models.ResultadoProva(id_prova=p1.id_prova, id_participante=parts[2].id_participante, tempo_ms=33000),
        models.ResultadoProva(id_prova=p1.id_prova, id_participante=parts[3].id_participante, tempo_ms=34000),
    ])

    # Prova 2: 100m Peito
    # 1º Alice (Ouro), 2º Carlos (Prata), 3º Bruno (Bronze), 4º Daniela
    p2 = models.Prova(id_competicao=comp_ind.id_competicao, nome="100m Peito")
    db.add(p2)
    db.flush()
    db.add_all([
        models.ResultadoProva(id_prova=p2.id_prova, id_participante=parts[0].id_participante, tempo_ms=75000),
        models.ResultadoProva(id_prova=p2.id_prova, id_participante=parts[2].id_participante, tempo_ms=76000),
        models.ResultadoProva(id_prova=p2.id_prova, id_participante=parts[1].id_participante, tempo_ms=77000),
        models.ResultadoProva(id_prova=p2.id_prova, id_participante=parts[3].id_participante, tempo_ms=78000),
    ])

    # Prova 3: 200m Medley
    # 1º Bruno (Ouro), 2º Alice (Prata), 3º Carlos (Bronze)
    p3 = models.Prova(id_competicao=comp_ind.id_competicao, nome="200m Medley")
    db.add(p3)
    db.flush()
    db.add_all([
        models.ResultadoProva(id_prova=p3.id_prova, id_participante=parts[1].id_participante, tempo_ms=130000),
        models.ResultadoProva(id_prova=p3.id_prova, id_participante=parts[0].id_participante, tempo_ms=131000),
        models.ResultadoProva(id_prova=p3.id_prova, id_participante=parts[2].id_participante, tempo_ms=132000),
    ])
    db.commit()

    res = calcular_classificacao_individual_competicao(db, comp_ind.id_competicao)

    assert res["id_competicao"] == comp_ind.id_competicao
    assert res["total_provas"] == 3
    assert len(res["provas"]) == 3

    ranking = res["ranking_geral"]
    # Atletas:
    # 1º Alice: 2 ouros, 1 prata, 0 bronze -> total 3 medalhas, 3 disputadas, melhor_posicao 1
    # 2º Bruno: 1 ouro, 1 prata, 1 bronze -> total 3 medalhas, 3 disputadas, melhor_posicao 1
    # 3º Carlos: 0 ouros, 1 prata, 2 bronzes -> total 3 medalhas, 3 disputadas, melhor_posicao 2
    # 4º Daniela: 0 ouros, 0 pratas, 0 bronze -> total 0 medalhas, 2 disputadas, melhor_posicao 4
    # 5º Eduardo: 0 ouros, 0 pratas, 0 bronze -> total 0 medalhas, 0 disputadas, melhor_posicao None

    assert ranking[0]["nome_participante"] == "Alice Nadadora"
    assert ranking[0]["posicao"] == 1
    assert ranking[0]["ouros"] == 2
    assert ranking[0]["pratas"] == 1
    assert ranking[0]["bronzes"] == 0
    assert ranking[0]["total_medalhas"] == 3
    assert ranking[0]["provas_disputadas"] == 3
    assert ranking[0]["melhor_posicao"] == 1

    assert ranking[1]["nome_participante"] == "Bruno Velocista"
    assert ranking[1]["posicao"] == 2
    assert ranking[1]["ouros"] == 1
    assert ranking[1]["pratas"] == 1
    assert ranking[1]["bronzes"] == 1
    assert ranking[1]["total_medalhas"] == 3
    assert ranking[1]["provas_disputadas"] == 3
    assert ranking[1]["melhor_posicao"] == 1

    assert ranking[2]["nome_participante"] == "Carlos Tubarão"
    assert ranking[2]["posicao"] == 3
    assert ranking[2]["ouros"] == 0
    assert ranking[2]["pratas"] == 1
    assert ranking[2]["bronzes"] == 2
    assert ranking[2]["total_medalhas"] == 3
    assert ranking[2]["provas_disputadas"] == 3
    assert ranking[2]["melhor_posicao"] == 2

    assert ranking[3]["nome_participante"] == "Daniela Maratona"
    assert ranking[3]["posicao"] == 4
    assert ranking[3]["ouros"] == 0
    assert ranking[3]["pratas"] == 0
    assert ranking[3]["bronzes"] == 0
    assert ranking[3]["total_medalhas"] == 0
    assert ranking[3]["provas_disputadas"] == 2
    assert ranking[3]["melhor_posicao"] == 4

    # Eduardo (inscrito que não disputou nenhuma prova)
    assert ranking[4]["nome_participante"] == "Eduardo Nadador Aluno"
    assert ranking[4]["posicao"] == 5
    assert ranking[4]["provas_disputadas"] == 0
    assert ranking[4]["melhor_posicao"] is None

    # quadro_medalhas e ranking_geral são consistentes
    assert res["quadro_medalhas"] == res["ranking_geral"]


# ============================================================================
# 6. Testes de Critérios de Desempate no Quadro de Medalhas
# ============================================================================

def test_empate_quadro_medalhas_criterios_desempate(db):
    """Testa os critérios de desempate ordenados:
    1. Ouros DESC
    2. Pratas DESC
    3. Bronzes DESC
    4. Total de Medalhas DESC
    5. Nome do Participante ASC
    """
    evento = models.Evento(even_nome="Copa Desempate")
    mod = models.Modalidade(nome="Atletismo", duracao_minutos=30)
    db.add_all([evento, mod])
    db.flush()

    edicao = models.Edicao(id_evento=evento.id_evento, edic_ano=2026, data_inicio=date(2026, 1, 1), data_fim=date(2026, 1, 10))
    db.add(edicao)
    db.flush()

    comp = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod.id_modalidade,
        nome="Torneio de Desempate",
        categoria="Livre",
        modo_inscricao="INDIVIDUAL",
        formato="PROVAS",
        criterio_resultado="TEMPO",
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 1, 10),
    )
    db.add(comp)
    db.flush()

    # Criar 4 atletas:
    # Atleta A ("Bia"): 1 ouro, 2 pratas, 0 bronze (total 3)
    # Atleta B ("Caio"): 1 ouro, 1 prata, 4 bronzes (total 6) -> Bia ganha no desempate por pratas (2 > 1)!
    # Atleta C ("Ana"): 1 ouro, 1 prata, 4 bronzes (total 6) -> Empata em tudo com Caio, mas Ana ganha por nome ("Ana" < "Caio")!
    # Atleta D ("Zeca"): 1 ouro, 1 prata, 1 bronze (total 3) -> Fica atrás de Ana e Caio por ter menos bronzes (1 < 4).
    p_a = models.Participante(tipo="atleta")
    p_b = models.Participante(tipo="atleta")
    p_c = models.Participante(tipo="atleta")
    p_d = models.Participante(tipo="atleta")
    db.add_all([p_a, p_b, p_c, p_d])
    db.flush()

    db.add_all([
        models.Atleta(id_participante=p_a.id_participante, nome_completo="Bia Prata", data_nascimento=date(2000, 1, 1), documento_pessoal="D1"),
        models.Atleta(id_participante=p_b.id_participante, nome_completo="Caio Bronze", data_nascimento=date(2000, 1, 1), documento_pessoal="D2"),
        models.Atleta(id_participante=p_c.id_participante, nome_completo="Ana Bronze", data_nascimento=date(2000, 1, 1), documento_pessoal="D3"),
        models.Atleta(id_participante=p_d.id_participante, nome_completo="Zeca Pouco", data_nascimento=date(2000, 1, 1), documento_pessoal="D4"),
    ])
    db.commit()

    # Vamos simular provas que entregam exatamente as medalhas desejadas:
    # Prova 1: 1º Bia (ouro), 2º Caio (prata), 3º Zeca (bronze)
    # Prova 2: 1º Caio (ouro), 2º Bia (prata), 3º Ana (bronze)
    # Prova 3: 1º Ana (ouro), 2º Bia (prata), 3º Caio (bronze)
    # Prova 4: 1º Zeca (ouro), 2º Ana (prata), 3º Caio (bronze)
    # Prova 5: 1º Outro, 2º Outro, 3º Ana (bronze)
    # Prova 6: 1º Outro, 2º Outro, 3º Caio (bronze)
    # Prova 7: 1º Outro, 2º Outro, 3º Ana (bronze)
    # Vamos conferir:
    # Bia: Prova 1 (ouro), Prova 2 (prata), Prova 3 (prata) -> 1 ouro, 2 pratas, 0 bronze.
    # Caio: Prova 2 (ouro), Prova 1 (prata), Prova 3 (bronze), Prova 4 (bronze), Prova 6 (bronze) -> precisa de mais 1 bronze: Prova 8 (bronze) -> 1 ouro, 1 prata, 3 bronzes?
    # Vamos montar as provas de forma direta e transparente:

    def _criar_prova_com_podio(nome, ouro_p, prata_p, bronze_p):
        p = models.Prova(id_competicao=comp.id_competicao, nome=nome)
        db.add(p)
        db.flush()
        db.add_all([
            models.ResultadoProva(id_prova=p.id_prova, id_participante=ouro_p.id_participante, tempo_ms=10000),
            models.ResultadoProva(id_prova=p.id_prova, id_participante=prata_p.id_participante, tempo_ms=20000),
            models.ResultadoProva(id_prova=p.id_prova, id_participante=bronze_p.id_participante, tempo_ms=30000),
        ])

    # Outro atleta neutro para fechar vagas de ouro/prata quando quisermos dar apenas bronze:
    p_dummy1 = models.Participante(tipo="atleta")
    p_dummy2 = models.Participante(tipo="atleta")
    db.add_all([p_dummy1, p_dummy2])
    db.flush()
    db.add_all([
        models.Atleta(id_participante=p_dummy1.id_participante, nome_completo="Dummy 1", data_nascimento=date(1990, 1, 1), documento_pessoal="DM1"),
        models.Atleta(id_participante=p_dummy2.id_participante, nome_completo="Dummy 2", data_nascimento=date(1990, 1, 1), documento_pessoal="DM2"),
    ])

    # 1 ouro para cada um de A, B, C, D:
    _criar_prova_com_podio("Prova 1", p_a, p_b, p_dummy1)       # Bia: ouro 1; Caio: prata 1
    _criar_prova_com_podio("Prova 2", p_b, p_a, p_c)            # Caio: ouro 1; Bia: prata 1; Ana: bronze 1
    _criar_prova_com_podio("Prova 3", p_c, p_a, p_d)            # Ana: ouro 1; Bia: prata 2; Zeca: bronze 1
    _criar_prova_com_podio("Prova 4", p_d, p_c, p_b)            # Zeca: ouro 1; Ana: prata 1; Caio: bronze 1
    _criar_prova_com_podio("Prova 5", p_dummy1, p_dummy2, p_b)  # Caio: bronze 2
    _criar_prova_com_podio("Prova 6", p_dummy1, p_dummy2, p_c)  # Ana: bronze 2
    _criar_prova_com_podio("Prova 7", p_dummy1, p_dummy2, p_b)  # Caio: bronze 3
    _criar_prova_com_podio("Prova 8", p_dummy1, p_dummy2, p_c)  # Ana: bronze 3
    _criar_prova_com_podio("Prova 9", p_dummy1, p_dummy2, p_b)  # Caio: bronze 4
    _criar_prova_com_podio("Prova 10", p_dummy1, p_dummy2, p_c) # Ana: bronze 4
    _criar_prova_com_podio("Prova 11", p_dummy1, p_d, p_dummy2) # Zeca: prata 1
    db.commit()

    # Resumo esperado de medalhas (ignorando dummies):
    # - Bia: 1 ouro, 2 pratas, 0 bronzes -> total 3
    # - Ana: 1 ouro, 1 prata, 4 bronzes -> total 6
    # - Caio: 1 ouro, 1 prata, 4 bronzes -> total 6
    # - Zeca: 1 ouro, 1 prata, 1 bronze -> total 3
    #
    # Ordem esperada:
    # 1º Bia (mais pratas: 2 vs 1)
    # 2º Ana (empata com Caio em ouros, pratas, bronzes e total; desempate por nome "Ana" < "Caio")
    # 3º Caio (empata com Ana, mas nome "Caio" > "Ana")
    # 4º Zeca (mesmo ouro e prata que Ana/Caio, mas menos bronzes: 1 < 4)

    resultado = calcular_classificacao_individual_competicao(db, comp.id_competicao)
    ranking = [r for r in resultado["ranking_geral"] if not r["nome_participante"].startswith("Dummy")]

    assert ranking[0]["nome_participante"] == "Bia Prata"
    assert ranking[0]["ouros"] == 1
    assert ranking[0]["pratas"] == 2
    assert ranking[0]["bronzes"] == 0

    assert ranking[1]["nome_participante"] == "Ana Bronze"
    assert ranking[1]["ouros"] == 1
    assert ranking[1]["pratas"] == 1
    assert ranking[1]["bronzes"] == 4

    assert ranking[2]["nome_participante"] == "Caio Bronze"
    assert ranking[2]["ouros"] == 1
    assert ranking[2]["pratas"] == 1
    assert ranking[2]["bronzes"] == 4

    assert ranking[3]["nome_participante"] == "Zeca Pouco"
    assert ranking[3]["ouros"] == 1
    assert ranking[3]["pratas"] == 1
    assert ranking[3]["bronzes"] == 1


# ============================================================================
# 7. Teste de Atleta Desqualificado em Todas as Provas
# ============================================================================

def test_atleta_desqualificado_em_todas_as_provas(db):
    """Testa que um atleta que disputou provas mas foi desqualificado em todas tem melhor_posicao = None."""
    env = _criar_cenario_base(db)
    comp_ind = env["comp_ind"]
    parts = env["participantes"]

    p1 = models.Prova(id_competicao=comp_ind.id_competicao, nome="Prova DQ 1")
    p2 = models.Prova(id_competicao=comp_ind.id_competicao, nome="Prova DQ 2")
    db.add_all([p1, p2])
    db.flush()

    db.add_all([
        models.ResultadoProva(id_prova=p1.id_prova, id_participante=parts[0].id_participante, tempo_ms=25000, desqualificado=True),
        models.ResultadoProva(id_prova=p2.id_prova, id_participante=parts[0].id_participante, tempo_ms=26000, desqualificado=True),
    ])
    db.commit()

    resultado = calcular_classificacao_individual_competicao(db, comp_ind.id_competicao)
    atleta_res = next(r for r in resultado["ranking_geral"] if r["id_participante"] == parts[0].id_participante)

    assert atleta_res["provas_disputadas"] == 2
    assert atleta_res["ouros"] == 0
    assert atleta_res["pratas"] == 0
    assert atleta_res["bronzes"] == 0
    assert atleta_res["total_medalhas"] == 0
    assert atleta_res["melhor_posicao"] is None
