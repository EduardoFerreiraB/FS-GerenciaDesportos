from datetime import date

import pytest

import models
from security import get_password_hash


def auth_headers(client, db, username, role):
    db.add(
        models.Usuario(
            username=username,
            password_hash=get_password_hash("password123"),
            role=role,
            must_change_password=False,
        )
    )
    db.commit()
    response = client.post("/token", data={"username": username, "password": "password123"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def edition_and_modality(db, suffix):
    event = models.Evento(even_nome=f"Jogos {suffix}")
    modality = models.Modalidade(nome=f"Modalidade {suffix}")
    db.add_all([event, modality])
    db.flush()
    edition = models.Edicao(
        id_evento=event.id_evento,
        edic_ano=2026,
        tipo_competicao="Pontos Corridos",
        data_inicio=date(2026, 8, 1),
        data_fim=date(2026, 8, 31),
    )
    db.add(edition)
    db.commit()
    return edition, modality


def competition_payload(id_modalidade, **overrides):
    payload = {
        "id_modalidade": id_modalidade,
        "nome": "Campeonato de Futebol",
        "categoria": "Sub-15",
        "modo_inscricao": "EQUIPE",
        "formato": "PONTOS_CORRIDOS",
        "criterio_resultado": "PLACAR",
        "data_inicio": "2026-08-01",
        "data_fim": "2026-08-31",
        "regras": "Três pontos por vitória.",
    }
    payload.update(overrides)
    return payload


def test_cria_le_e_exclui_competicao_de_futebol_por_equipes(client, db):
    # A missing competition router/model must make this endpoint return 404.
    headers = auth_headers(client, db, "coord_comp_futebol", "coordenador")
    edition, modality = edition_and_modality(db, "futebol")

    created = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=competition_payload(modality.id_modalidade),
        headers=headers,
    )

    assert created.status_code == 201
    competition = created.json()
    assert competition["id_edicao"] == edition.id_edicao
    assert competition["id_modalidade"] == modality.id_modalidade
    assert competition["status"] == "RASCUNHO"
    assert competition["modo_inscricao"] == "EQUIPE"
    assert competition["formato"] == "PONTOS_CORRIDOS"

    fetched = client.get(f"/competicoes/{competition['id_competicao']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["nome"] == "Campeonato de Futebol"

    updated = client.put(
        f"/competicoes/{competition['id_competicao']}",
        json={"nome": "Futebol Escolar"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["nome"] == "Futebol Escolar"
    assert updated.json()["status"] == "RASCUNHO"

    started = client.post(f"/competicoes/{competition['id_competicao']}/iniciar", headers=headers)
    assert started.status_code == 200
    assert started.json()["status"] == "EM_ANDAMENTO"

    deleted = client.delete(f"/competicoes/{competition['id_competicao']}", headers=headers)
    assert deleted.status_code == 409


def test_cria_competicao_individual_de_natacao(client, db):
    # Rejecting INDIVIDUAL/PROVAS would break an explicitly supported competition type.
    headers = auth_headers(client, db, "coord_comp_natacao", "coordenador")
    edition, modality = edition_and_modality(db, "natacao")

    response = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=competition_payload(
            modality.id_modalidade,
            nome="Natação 100m livre",
            modo_inscricao="INDIVIDUAL",
            formato="PROVAS",
            criterio_resultado="TEMPO",
        ),
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["modo_inscricao"] == "INDIVIDUAL"
    assert response.json()["formato"] == "PROVAS"
    assert response.json()["criterio_resultado"] == "TEMPO"


@pytest.mark.parametrize(
    ("modo_inscricao", "formato"),
    [("EQUIPE", "PROVAS"), ("INDIVIDUAL", "PONTOS_CORRIDOS"), ("INDIVIDUAL", "GRUPOS"), ("INDIVIDUAL", "MATA_MATA")],
)
def test_rejeita_pares_de_modo_e_formato_incompativeis(client, db, modo_inscricao, formato):
    # Removing the invariant would allow a competition with an impossible registration flow.
    headers = auth_headers(client, db, f"coord_comp_invalido_{modo_inscricao}_{formato}", "coordenador")
    edition, modality = edition_and_modality(db, f"invalido-{modo_inscricao}-{formato}")

    response = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=competition_payload(modality.id_modalidade, modo_inscricao=modo_inscricao, formato=formato),
        headers=headers,
    )

    assert response.status_code == 422


def test_retorna_404_quando_edicao_ou_modalidade_nao_existe(client, db):
    # Accepting dangling foreign keys would create unusable competitions.
    headers = auth_headers(client, db, "coord_comp_not_found", "coordenador")
    edition, modality = edition_and_modality(db, "not-found")

    missing_edition = client.post(
        "/edicoes/999999/competicoes",
        json=competition_payload(modality.id_modalidade),
        headers=headers,
    )
    missing_modality = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=competition_payload(999999),
        headers=headers,
    )

    assert missing_edition.status_code == 404
    assert missing_modality.status_code == 404


def test_lista_apenas_competicoes_da_edicao_solicitada(client, db):
    # Dropping the edition filter would leak competitions from another event edition.
    headers = auth_headers(client, db, "coord_comp_lista", "coordenador")
    first_edition, modality = edition_and_modality(db, "lista-1")
    second_edition, _ = edition_and_modality(db, "lista-2")

    first = client.post(
        f"/edicoes/{first_edition.id_edicao}/competicoes",
        json=competition_payload(modality.id_modalidade, nome="Competição da primeira edição"),
        headers=headers,
    )
    second = client.post(
        f"/edicoes/{second_edition.id_edicao}/competicoes",
        json=competition_payload(modality.id_modalidade, nome="Competição da segunda edição"),
        headers=headers,
    )
    assert first.status_code == 201
    assert second.status_code == 201

    listed = client.get(f"/edicoes/{first_edition.id_edicao}/competicoes", headers=headers)

    assert listed.status_code == 200
    assert [item["id_competicao"] for item in listed.json()] == [first.json()["id_competicao"]]


def test_apenas_coordenador_pode_escrever_competicoes(client, db):
    # Replacing the coordinator dependency would allow teachers to alter competition setup.
    coordinator_headers = auth_headers(client, db, "coord_comp_autorizacao", "coordenador")
    professor_headers = auth_headers(client, db, "prof_comp_autorizacao", "professor")
    edition, modality = edition_and_modality(db, "autorizacao")
    created = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=competition_payload(modality.id_modalidade),
        headers=coordinator_headers,
    )
    assert created.status_code == 201
    competition_id = created.json()["id_competicao"]

    assert client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=competition_payload(modality.id_modalidade, nome="Sem permissão"),
        headers=professor_headers,
    ).status_code == 403
    assert client.put(
        f"/competicoes/{competition_id}",
        json={"nome": "Sem permissão"},
        headers=professor_headers,
    ).status_code == 403
    assert client.delete(f"/competicoes/{competition_id}", headers=professor_headers).status_code == 403
