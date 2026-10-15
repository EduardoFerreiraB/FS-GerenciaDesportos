from datetime import date

import models
from security import get_password_hash


def auth_headers(client, db, username):
    db.add(
        models.Usuario(
            username=username,
            password_hash=get_password_hash("password123"),
            role="coordenador",
            must_change_password=False,
        )
    )
    db.commit()
    response = client.post("/token", data={"username": username, "password": "password123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def criar_competicao(client, db, headers, suffix, *, modo_inscricao="EQUIPE"):
    evento = models.Evento(even_nome=f"Jogos {suffix}")
    modalidade = models.Modalidade(nome=f"Modalidade {suffix}")
    db.add_all([evento, modalidade])
    db.flush()
    edicao = models.Edicao(
        id_evento=evento.id_evento,
        edic_ano=2026,
        tipo_competicao="Pontos Corridos",
        data_inicio=date(2026, 8, 1),
        data_fim=date(2026, 8, 31),
    )
    db.add(edicao)
    db.commit()

    resposta = client.post(
        f"/edicoes/{edicao.id_edicao}/competicoes",
        json={
            "id_modalidade": modalidade.id_modalidade,
            "nome": f"Competição {suffix}",
            "categoria": "Sub-15",
            "modo_inscricao": modo_inscricao,
            "formato": "PROVAS" if modo_inscricao == "INDIVIDUAL" else "PONTOS_CORRIDOS",
            "criterio_resultado": "TEMPO" if modo_inscricao == "INDIVIDUAL" else "PLACAR",
            "data_inicio": "2026-08-01",
            "data_fim": "2026-08-31",
        },
        headers=headers,
    )
    assert resposta.status_code == 201
    return resposta.json()


def test_rejeita_equipe_em_competicao_de_inscricao_individual(client, db):
    # Removing the team-mode guard would allow a team in an individual competition.
    headers = auth_headers(client, db, "coord_equipe_individual")
    competicao = criar_competicao(client, db, headers, "individual", modo_inscricao="INDIVIDUAL")

    resposta = client.post(
        f"/competicoes/{competicao['id_competicao']}/equipes",
        json={"nome": "Equipe indevida"},
        headers=headers,
    )

    assert resposta.status_code == 422


def test_lista_equipes_da_competicao_solicitada(client, db):
    # Removing the competition filter would expose teams from another competition.
    headers = auth_headers(client, db, "coord_lista_equipes_competicao")
    primeira = criar_competicao(client, db, headers, "lista-primeira")
    segunda = criar_competicao(client, db, headers, "lista-segunda")

    equipe_primeira = client.post(
        f"/competicoes/{primeira['id_competicao']}/equipes",
        json={"nome": "Equipe da primeira competição"},
        headers=headers,
    )
    equipe_segunda = client.post(
        f"/competicoes/{segunda['id_competicao']}/equipes",
        json={"nome": "Equipe da segunda competição"},
        headers=headers,
    )
    assert equipe_primeira.status_code == 201
    assert equipe_segunda.status_code == 201

    resposta = client.get(f"/competicoes/{primeira['id_competicao']}/equipes", headers=headers)

    assert resposta.status_code == 200
    assert [equipe["id_equipe"] for equipe in resposta.json()] == [equipe_primeira.json()["id_equipe"]]
    assert resposta.json()[0]["id_competicao"] == primeira["id_competicao"]
    assert resposta.json()[0]["id_edicao"] == primeira["id_edicao"]


def test_adiciona_e_desvincula_participante_da_equipe(client, db):
    # Removing the association deletion would leave a roster member after unlinking.
    headers = auth_headers(client, db, "coord_desvincular_equipe")
    competicao = criar_competicao(client, db, headers, "desvincular")
    equipe = client.post(
        f"/competicoes/{competicao['id_competicao']}/equipes",
        json={"nome": "Equipe para desvincular"},
        headers=headers,
    )
    participante = models.Participante(tipo="aluno")
    db.add(participante)
    db.commit()

    adicionada = client.post(
        f"/equipes/{equipe.json()['id_equipe']}/participantes/{participante.id_participante}",
        headers=headers,
    )
    removida = client.delete(
        f"/equipes/{equipe.json()['id_equipe']}/participantes/{participante.id_participante}",
        headers=headers,
    )
    equipe_atualizada = client.get(f"/equipes/{equipe.json()['id_equipe']}", headers=headers)

    assert adicionada.status_code == 200
    assert removida.status_code == 204
    assert equipe_atualizada.json()["participantes"] == []


def test_rejeita_participante_em_duas_equipes_da_mesma_competicao(client, db):
    # Removing the competition-wide roster check would allow a participant on two rosters.
    headers = auth_headers(client, db, "coord_duplicidade_equipe")
    competicao = criar_competicao(client, db, headers, "duplicidade")
    primeira = client.post(
        f"/competicoes/{competicao['id_competicao']}/equipes",
        json={"nome": "Primeira equipe"},
        headers=headers,
    )
    segunda = client.post(
        f"/competicoes/{competicao['id_competicao']}/equipes",
        json={"nome": "Segunda equipe"},
        headers=headers,
    )
    participante = models.Participante(tipo="aluno")
    db.add(participante)
    db.commit()

    primeira_adicao = client.post(
        f"/equipes/{primeira.json()['id_equipe']}/participantes/{participante.id_participante}",
        headers=headers,
    )
    duplicada = client.post(
        f"/equipes/{segunda.json()['id_equipe']}/participantes/{participante.id_participante}",
        headers=headers,
    )

    assert primeira_adicao.status_code == 200
    assert duplicada.status_code == 422


def test_permite_participante_em_equipes_de_competicoes_diferentes(client, db):
    # Comparing by edition instead of competition would reject this valid cross-competition roster.
    headers = auth_headers(client, db, "coord_equipes_competicoes_distintas")
    primeira = criar_competicao(client, db, headers, "competicao-primeira")
    segunda = criar_competicao(client, db, headers, "competicao-segunda")
    equipe_primeira = client.post(
        f"/competicoes/{primeira['id_competicao']}/equipes",
        json={"nome": "Equipe da competição um"},
        headers=headers,
    )
    equipe_segunda = client.post(
        f"/competicoes/{segunda['id_competicao']}/equipes",
        json={"nome": "Equipe da competição dois"},
        headers=headers,
    )
    participante = models.Participante(tipo="aluno")
    db.add(participante)
    db.commit()

    primeira_adicao = client.post(
        f"/equipes/{equipe_primeira.json()['id_equipe']}/participantes/{participante.id_participante}",
        headers=headers,
    )
    segunda_adicao = client.post(
        f"/equipes/{equipe_segunda.json()['id_equipe']}/participantes/{participante.id_participante}",
        headers=headers,
    )

    assert primeira_adicao.status_code == 200
    assert segunda_adicao.status_code == 200
