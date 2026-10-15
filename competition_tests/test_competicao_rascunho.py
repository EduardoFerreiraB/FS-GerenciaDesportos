from datetime import date

import pytest
import models
import schemas
from security import create_access_token
from services import competicoes as competition_service
from services import edicoes as edicao_service


def headers(role: str):
    return {"Authorization": f"Bearer {create_access_token({'sub': role})}"}


def edition_and_modalities(db):
    admin = models.Usuario(username="admin", password_hash="x", role="admin", must_change_password=False)
    coordinator = models.Usuario(username="coordenador", password_hash="x", role="coordenador", must_change_password=False)
    professor = models.Usuario(username="professor", password_hash="x", role="professor", must_change_password=False)
    assistente = models.Usuario(username="assistente", password_hash="x", role="assistente", must_change_password=False)
    event = models.Evento(even_nome="Jogos Escolares")
    swimming = models.Modalidade(nome="Natação")
    football = models.Modalidade(nome="Futebol")
    db.add_all([admin, coordinator, professor, assistente, event, swimming, football])
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
    return edition, swimming, football


def draft_payload(modality_id, **overrides):
    payload = {"id_modalidade": modality_id, "nome": "100 m livre", "categoria": "Sub-15"}
    payload.update(overrides)
    return payload


def full_team_configuration(modality_id):
    return draft_payload(
        modality_id,
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        data_inicio="2026-08-01",
        data_fim="2026-08-31",
    )


def create_draft(client, edition, modality, **overrides):
    response = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=draft_payload(modality.id_modalidade, **overrides),
        headers=headers("coordenador"),
    )
    assert response.status_code == 201
    return response.json()


def test_cria_rascunho_minimo_e_configura_incrementalmente(client, db):
    # Making draft configuration mandatory would reject this minimal create.
    edition, swimming, _ = edition_and_modalities(db)
    draft = create_draft(client, edition, swimming)

    assert draft["status"] == "RASCUNHO"
    assert draft["modo_inscricao"] is None
    assert draft["data_inicio"] is None

    configured = client.put(
        f"/competicoes/{draft['id_competicao']}",
        json={"modo_inscricao": "INDIVIDUAL", "formato": "PROVAS", "criterio_resultado": "TEMPO", "data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
        headers=headers("coordenador"),
    )
    assert configured.status_code == 200
    assert configured.json()["formato"] == "PROVAS"


def test_rejeita_configuracao_resultante_invalida_e_campos_basicos_vazios(client, db):
    # Removing merged-pair/blank validation would persist an impossible competition.
    edition, swimming, _ = edition_and_modalities(db)
    draft = create_draft(client, edition, swimming, modo_inscricao="INDIVIDUAL")

    invalid_merge = client.put(
        f"/competicoes/{draft['id_competicao']}",
        json={"formato": "PONTOS_CORRIDOS"},
        headers=headers("coordenador"),
    )
    blank_name = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=draft_payload(swimming.id_modalidade, nome="   "),
        headers=headers("coordenador"),
    )
    null_modality = client.put(
        f"/competicoes/{draft['id_competicao']}",
        json={"id_modalidade": None},
        headers=headers("coordenador"),
    )

    assert invalid_merge.status_code == 422
    assert blank_name.status_code == 422
    assert null_modality.status_code == 422


def test_iniciar_exige_configuracao_completa_e_eh_transicao_unica(client, db):
    # Skipping completeness or state checks would allow an unusable/repeated start.
    edition, swimming, _ = edition_and_modalities(db)
    draft = create_draft(client, edition, swimming)

    incomplete = client.post(f"/competicoes/{draft['id_competicao']}/iniciar", headers=headers("admin"))
    configured = client.put(
        f"/competicoes/{draft['id_competicao']}",
        json={"modo_inscricao": "INDIVIDUAL", "formato": "PROVAS", "criterio_resultado": "TEMPO", "data_inicio": "2026-08-01", "data_fim": "2026-08-31"},
        headers=headers("admin"),
    )
    started = client.post(f"/competicoes/{draft['id_competicao']}/iniciar", headers=headers("admin"))
    repeated = client.post(f"/competicoes/{draft['id_competicao']}/iniciar", headers=headers("admin"))

    assert incomplete.status_code == 422
    assert configured.status_code == 200
    assert started.status_code == 200
    assert started.json()["status"] == "EM_ANDAMENTO"
    assert repeated.status_code == 409


def test_inicio_bloqueia_edicao_e_exclusao(client, db):
    # Dropping the lifecycle guard would alter or delete the published regulation.
    edition, _, football = edition_and_modalities(db)
    response = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=full_team_configuration(football.id_modalidade),
        headers=headers("admin"),
    )
    competition_id = response.json()["id_competicao"]
    client.post(f"/competicoes/{competition_id}/iniciar", headers=headers("admin"))

    update = client.put(f"/competicoes/{competition_id}", json={"nome": "Mudado"}, headers=headers("admin"))
    delete = client.delete(f"/competicoes/{competition_id}", headers=headers("admin"))

    assert update.status_code == 409
    assert delete.status_code == 409


def test_equipes_protegem_modo_modalidade_e_exclusao(client, db):
    # Ignoring associated teams would invalidate their registration after an edit.
    edition, swimming, football = edition_and_modalities(db)
    response = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=full_team_configuration(football.id_modalidade),
        headers=headers("coordenador"),
    )
    competition_id = response.json()["id_competicao"]
    team = client.post(f"/competicoes/{competition_id}/equipes", json={"nome": "Tigres"}, headers=headers("coordenador"))
    assert team.status_code == 201

    mode = client.put(f"/competicoes/{competition_id}", json={"modo_inscricao": "INDIVIDUAL"}, headers=headers("coordenador"))
    modality = client.put(f"/competicoes/{competition_id}", json={"id_modalidade": swimming.id_modalidade}, headers=headers("coordenador"))
    delete = client.delete(f"/competicoes/{competition_id}", headers=headers("coordenador"))

    assert mode.status_code == 409
    assert modality.status_code == 409
    assert delete.status_code == 409


def test_http_permissions_cover_writers_readers_and_anonymous(client, db):
    # Replacing role dependencies would let unauthorized callers mutate a draft.
    edition, swimming, _ = edition_and_modalities(db)
    payload = draft_payload(swimming.id_modalidade)
    created = client.post(f"/edicoes/{edition.id_edicao}/competicoes", json=payload, headers=headers("admin"))
    competition_id = created.json()["id_competicao"]

    assert client.post(f"/edicoes/{edition.id_edicao}/competicoes", json=payload, headers=headers("professor")).status_code == 403
    assert client.put(f"/competicoes/{competition_id}", json={"nome": "x"}, headers=headers("assistente")).status_code == 403
    assert client.post(f"/competicoes/{competition_id}/iniciar", headers=headers("professor")).status_code == 403
    assert client.delete(f"/competicoes/{competition_id}", headers=headers("assistente")).status_code == 403
    assert client.get(f"/competicoes/{competition_id}", headers=headers("professor")).status_code == 200
    assert client.get(f"/competicoes/{competition_id}", headers=headers("assistente")).status_code == 200
    assert client.get(f"/competicoes/{competition_id}").status_code == 401
    assert client.post(f"/edicoes/{edition.id_edicao}/competicoes", json=payload).status_code == 401
    assert client.put(f"/competicoes/{competition_id}", json={"nome": "Sem token"}).status_code == 401
    assert client.post(f"/competicoes/{competition_id}/iniciar").status_code == 401
    assert client.delete(f"/competicoes/{competition_id}").status_code == 401


def test_http_rejeita_bypass_de_status_datas_invalidas_nulos_e_referencias(client, db):
    # Accepting these payloads would bypass lifecycle/integrity validation at the HTTP boundary.
    edition, swimming, _ = edition_and_modalities(db)
    status_bypass = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=draft_payload(swimming.id_modalidade, status="EM_ANDAMENTO"),
        headers=headers("admin"),
    )
    invalid_dates = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=draft_payload(swimming.id_modalidade, data_inicio="2026-08-31", data_fim="2026-08-01"),
        headers=headers("admin"),
    )
    null_category = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=draft_payload(swimming.id_modalidade, categoria=None),
        headers=headers("admin"),
    )
    missing_parent = client.post("/edicoes/9999/competicoes", json=draft_payload(swimming.id_modalidade), headers=headers("admin"))
    missing_modality = client.post(f"/edicoes/{edition.id_edicao}/competicoes", json=draft_payload(9999), headers=headers("admin"))
    draft = create_draft(client, edition, swimming)
    status_update = client.put(
        f"/competicoes/{draft['id_competicao']}", json={"status": "EM_ANDAMENTO"}, headers=headers("admin")
    )
    null_name = client.put(
        f"/competicoes/{draft['id_competicao']}", json={"nome": None}, headers=headers("admin")
    )

    assert status_bypass.status_code == 422
    assert invalid_dates.status_code == 422
    assert null_category.status_code == 422
    assert missing_parent.status_code == 404
    assert missing_modality.status_code == 404
    assert status_update.status_code == 422
    assert null_name.status_code == 422


def test_servico_valida_merge_e_bloqueia_alteracao_apos_inicio(db):
    # Removing service guards would permit invalid direct callers to bypass routes.
    edition, swimming, _ = edition_and_modalities(db)
    draft = models.Competicao(
        id_edicao=edition.id_edicao,
        id_modalidade=swimming.id_modalidade,
        nome="Prova direta",
        categoria="Sub-15",
        modo_inscricao="INDIVIDUAL",
        status="RASCUNHO",
    )
    db.add(draft)
    db.commit()

    with pytest.raises(competition_service.CompeticaoErroConfiguracao):
        competition_service.atualizar_competicao(
            db, draft, schemas.CompeticaoUpdate(formato="PONTOS_CORRIDOS")
        )

    draft.formato = "PROVAS"
    draft.criterio_resultado = "TEMPO"
    draft.data_inicio = date(2026, 8, 1)
    draft.data_fim = date(2026, 8, 31)
    db.commit()
    competition_service.iniciar_competicao(db, draft)

    with pytest.raises(competition_service.CompeticaoErroConflito):
        competition_service.atualizar_competicao(db, draft, schemas.CompeticaoUpdate(nome="Depois do início"))


def test_exclusao_edicao_bloqueada_com_competicoes_iniciadas(client, db):
    edition, _, football = edition_and_modalities(db)
    response = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=full_team_configuration(football.id_modalidade),
        headers=headers("coordenador"),
    )
    competition_id = response.json()["id_competicao"]
    client.post(f"/competicoes/{competition_id}/iniciar", headers=headers("coordenador"))

    res_delete = client.delete(f"/edicoes/{edition.id_edicao}", headers=headers("coordenador"))
    assert res_delete.status_code == 400
    assert "ativas ou iniciadas" in res_delete.json()["detail"] or "Remova as competições primeiro" in res_delete.json()["detail"]

    with pytest.raises(ValueError, match="ativas ou iniciadas|Remova as competições primeiro"):
        edicao_service.excluir_edicao(db, edition.id_edicao)

    assert db.query(models.Edicao).filter(models.Edicao.id_edicao == edition.id_edicao).first() is not None


def test_exclusao_edicao_bloqueada_com_equipes_ou_confrontos_vinculados(client, db):
    edition, _, football = edition_and_modalities(db)
    response = client.post(
        f"/edicoes/{edition.id_edicao}/competicoes",
        json=full_team_configuration(football.id_modalidade),
        headers=headers("coordenador"),
    )
    competition_id = response.json()["id_competicao"]
    client.post(f"/competicoes/{competition_id}/equipes", json={"nome": "Águias Douradas"}, headers=headers("coordenador"))

    res_delete = client.delete(f"/edicoes/{edition.id_edicao}", headers=headers("coordenador"))
    assert res_delete.status_code == 400
    assert "dados vinculados" in res_delete.json()["detail"] or "Remova as competições primeiro" in res_delete.json()["detail"]

    with pytest.raises(ValueError, match="dados vinculados|Remova as competições primeiro"):
        edicao_service.excluir_edicao(db, edition.id_edicao)


def test_exclusao_edicao_sem_competicoes_permitida(client, db):
    edition, _, _ = edition_and_modalities(db)
    res_delete = client.delete(f"/edicoes/{edition.id_edicao}", headers=headers("coordenador"))
    assert res_delete.status_code == 204
    assert db.query(models.Edicao).filter(models.Edicao.id_edicao == edition.id_edicao).first() is None
