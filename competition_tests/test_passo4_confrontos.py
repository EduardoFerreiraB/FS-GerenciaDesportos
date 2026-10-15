"""Passo 4 tests for Confronto domain contracts, rules and endpoints."""

from datetime import date, time
import io
import pytest

import models
from security import create_access_token, get_password_hash


def _headers(username: str):
    return {"Authorization": f"Bearer {create_access_token({'sub': username})}"}


def _setup_competition_env(db, *, modo="EQUIPE", formato="PONTOS_CORRIDOS"):
    evento = models.Evento(even_nome="Jogos Passo 4")
    modalidade = models.Modalidade(nome="Futsal Passo 4", duracao_minutos=60)
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
    db.flush()

    competicao = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=modalidade.id_modalidade,
        nome="Copa Futsal",
        categoria="Livre",
        modo_inscricao=modo,
        formato=formato,
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 8, 1),
        data_fim=date(2026, 8, 31),
        status="EM_ANDAMENTO" if modo == "EQUIPE" else "RASCUNHO",
    )
    db.add(competicao)
    db.flush()

    local1 = models.Local(loca_nome="Quadra 1", ativo=True)
    local2 = models.Local(loca_nome="Quadra 2", ativo=True)
    arbitro1 = models.Arbitro(apito_nome="Arbitro 1", apito_doc="111", apito_tel="111")
    arbitro2 = models.Arbitro(apito_nome="Arbitro 2", apito_doc="222", apito_tel="222")
    db.add_all([local1, local2, arbitro1, arbitro2])
    db.flush()

    equipes = []
    if modo == "EQUIPE":
        for nome in ["Time Alpha", "Time Beta", "Time Gamma", "Time Delta"]:
            eq = models.Equipe(
                nome=nome,
                id_edicao=edicao.id_edicao,
                id_competicao=competicao.id_competicao,
            )
            db.add(eq)
            equipes.append(eq)
        db.flush()

    # Users
    users = [
        models.Usuario(username="p4-admin", password_hash=get_password_hash("pass"), role="admin"),
        models.Usuario(username="p4-coord", password_hash=get_password_hash("pass"), role="coordenador"),
        models.Usuario(username="p4-coordenador", password_hash=get_password_hash("pass"), role="coordenador"),
        models.Usuario(username="p4-prof", password_hash=get_password_hash("pass"), role="professor"),
        models.Usuario(username="p4-professor", password_hash=get_password_hash("pass"), role="professor"),
        models.Usuario(username="p4-assist", password_hash=get_password_hash("pass"), role="assistente"),
        models.Usuario(username="p4-assistente", password_hash=get_password_hash("pass"), role="assistente"),
    ]
    db.add_all(users)
    db.commit()

    return {
        "evento": evento,
        "modalidade": modalidade,
        "edicao": edicao,
        "competicao": competicao,
        "locais": [local1, local2],
        "arbitros": [arbitro1, arbitro2],
        "equipes": equipes,
    }


def test_crud_confronto_competicao_equipe(client, db):
    """Test standard CRUD operations for Confronto in EQUIPE mode."""
    env = _setup_competition_env(db)
    comp_id = env["competicao"].id_competicao
    t1 = env["equipes"][0].id_equipe
    t2 = env["equipes"][1].id_equipe
    loc_id = env["locais"][0].id_local
    arb_id = env["arbitros"][0].id_arbitro

    # CREATE
    payload = {
        "id_equipe_mandante": t1,
        "id_equipe_visitante": t2,
        "fase": "Rodada 1",
        "rodada": 1,
        "data": "2026-08-10",
        "hora": "10:00:00",
        "id_local": loc_id,
        "id_arbitro": arb_id,
        "placar_mandante": 0,
        "placar_visitante": 0,
        "status": "Agendado",
        "observacoes": "Jogo inaugural",
    }
    create_resp = client.post(
        f"/competicoes/{comp_id}/confrontos",
        json=payload,
        headers=_headers("p4-coord"),
    )
    assert create_resp.status_code == 201, create_resp.text
    created = create_resp.json()
    confronto_id = created["id_confronto"]
    assert created["id_competicao"] == comp_id
    assert created["status"] == "Agendado"
    assert created["observacoes"] == "Jogo inaugural"

    # LIST
    list_resp = client.get(
        f"/competicoes/{comp_id}/confrontos",
        headers=_headers("p4-prof"),
    )
    assert list_resp.status_code == 200
    itens = list_resp.json()
    assert len(itens) == 1
    assert itens[0]["id_confronto"] == confronto_id

    # GET
    get_resp = client.get(
        f"/confrontos/{confronto_id}",
        headers=_headers("p4-prof"),
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["id_confronto"] == confronto_id

    # UPDATE
    update_payload = {
        "placar_mandante": 3,
        "placar_visitante": 1,
        "status": "Finalizado",
        "observacoes": "Finalizado com sucesso",
    }
    put_resp = client.put(
        f"/confrontos/{confronto_id}",
        json=update_payload,
        headers=_headers("p4-admin"),
    )
    assert put_resp.status_code == 200
    updated = put_resp.json()
    assert updated["placar_mandante"] == 3
    assert updated["placar_visitante"] == 1
    assert updated["status"] == "Finalizado"
    assert updated["id_equipe_vencedora"] == t1

    # DELETE: Reopening to Agendado so delete is allowed
    put_resp2 = client.put(
        f"/confrontos/{confronto_id}",
        json={"status": "Agendado"},
        headers=_headers("p4-admin"),
    )
    assert put_resp2.status_code == 200

    del_resp = client.delete(
        f"/confrontos/{confronto_id}",
        headers=_headers("p4-admin"),
    )
    assert del_resp.status_code == 204

    # Verification: should now be 404
    assert client.get(f"/confrontos/{confronto_id}", headers=_headers("p4-prof")).status_code == 404


def test_confronto_rejeita_exclusao_se_iniciado_ou_finalizado(client, db):
    """Deleting a match that is in progress or completed must be rejected (422)."""
    env = _setup_competition_env(db)
    comp_id = env["competicao"].id_competicao

    payload = {
        "id_equipe_mandante": env["equipes"][0].id_equipe,
        "id_equipe_visitante": env["equipes"][1].id_equipe,
        "data": "2026-08-10",
        "hora": "10:00:00",
        "id_local": env["locais"][0].id_local,
        "id_arbitro": env["arbitros"][0].id_arbitro,
        "status": "Em Andamento",
    }
    create_resp = client.post(
        f"/competicoes/{comp_id}/confrontos",
        json=payload,
        headers=_headers("p4-coord"),
    )
    assert create_resp.status_code == 201
    c_id = create_resp.json()["id_confronto"]

    del_resp = client.delete(f"/confrontos/{c_id}", headers=_headers("p4-coord"))
    assert del_resp.status_code == 422


def test_confronto_rejeita_competicao_individual(client, db):
    """Confronto operations must fail with 422 for INDIVIDUAL competitions."""
    env = _setup_competition_env(db, modo="INDIVIDUAL")
    comp_id = env["competicao"].id_competicao
    loc_id = env["locais"][0].id_local
    arb_id = env["arbitros"][0].id_arbitro

    payload = {
        "data": "2026-08-10",
        "hora": "10:00:00",
        "id_local": loc_id,
        "id_arbitro": arb_id,
    }
    # Create manual
    resp_create = client.post(
        f"/competicoes/{comp_id}/confrontos",
        json=payload,
        headers=_headers("p4-coord"),
    )
    assert resp_create.status_code == 422

    # List
    resp_list = client.get(
        f"/competicoes/{comp_id}/confrontos",
        headers=_headers("p4-prof"),
    )
    assert resp_list.status_code == 422

    # Generate
    resp_gen = client.post(
        f"/competicoes/{comp_id}/gerar-confrontos",
        json={},
        headers=_headers("p4-coord"),
    )
    assert resp_gen.status_code == 422


def test_confronto_valida_equipes_mesma_competicao(client, db):
    """Teams participating in a confrontation must belong to the same competition."""
    env1 = _setup_competition_env(db)
    comp1_id = env1["competicao"].id_competicao
    t1_comp1 = env1["equipes"][0].id_equipe

    # Create second competition with teams
    evento = env1["evento"]
    modalidade = env1["modalidade"]
    edicao = env1["edicao"]
    comp2 = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=modalidade.id_modalidade,
        nome="Outra Copa",
        categoria="Sub-20",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        status="EM_ANDAMENTO",
    )
    db.add(comp2)
    db.flush()
    t_comp2 = models.Equipe(nome="Time Estranho", id_edicao=edicao.id_edicao, id_competicao=comp2.id_competicao)
    db.add(t_comp2)
    db.commit()

    # Try creating confrontation in comp1 with team from comp2 as visitor
    payload = {
        "id_equipe_mandante": t1_comp1,
        "id_equipe_visitante": t_comp2.id_equipe,
        "data": "2026-08-12",
        "hora": "14:00:00",
        "id_local": env1["locais"][0].id_local,
        "id_arbitro": env1["arbitros"][0].id_arbitro,
    }
    resp = client.post(
        f"/competicoes/{comp1_id}/confrontos",
        json=payload,
        headers=_headers("p4-coord"),
    )
    assert resp.status_code == 422
    assert "competicao" in resp.text.lower() or "equipe" in resp.text.lower()


def test_conflito_horarios_local_arbitro_equipes(client, db):
    """Schedule overlap conflicts (same local, referee, or team) must return 422."""
    env = _setup_competition_env(db)
    comp_id = env["competicao"].id_competicao
    t1 = env["equipes"][0].id_equipe
    t2 = env["equipes"][1].id_equipe
    t3 = env["equipes"][2].id_equipe
    t4 = env["equipes"][3].id_equipe
    loc1 = env["locais"][0].id_local
    loc2 = env["locais"][1].id_local
    arb1 = env["arbitros"][0].id_arbitro
    arb2 = env["arbitros"][1].id_arbitro

    # Initial match: 14:00 - 15:00 (duration is 60 min)
    payload_base = {
        "id_equipe_mandante": t1,
        "id_equipe_visitante": t2,
        "data": "2026-08-15",
        "hora": "14:00:00",
        "id_local": loc1,
        "id_arbitro": arb1,
    }
    r = client.post(f"/competicoes/{comp_id}/confrontos", json=payload_base, headers=_headers("p4-coord"))
    assert r.status_code == 201

    # 1. Local conflict at 14:30
    payload_loc_conflict = {
        "id_equipe_mandante": t3,
        "id_equipe_visitante": t4,
        "data": "2026-08-15",
        "hora": "14:30:00",
        "id_local": loc1,
        "id_arbitro": arb2,
    }
    r_loc = client.post(f"/competicoes/{comp_id}/confrontos", json=payload_loc_conflict, headers=_headers("p4-coord"))
    assert r_loc.status_code == 422
    assert "local" in r_loc.text.lower()

    # 2. Referee conflict at 14:30
    payload_arb_conflict = {
        "id_equipe_mandante": t3,
        "id_equipe_visitante": t4,
        "data": "2026-08-15",
        "hora": "14:30:00",
        "id_local": loc2,
        "id_arbitro": arb1,
    }
    r_arb = client.post(f"/competicoes/{comp_id}/confrontos", json=payload_arb_conflict, headers=_headers("p4-coord"))
    assert r_arb.status_code == 422
    assert "árbitro" in r_arb.text.lower() or "arbitro" in r_arb.text.lower()

    # 3. Team conflict at 14:30 (t1 playing again)
    payload_team_conflict = {
        "id_equipe_mandante": t1,
        "id_equipe_visitante": t3,
        "data": "2026-08-15",
        "hora": "14:30:00",
        "id_local": loc2,
        "id_arbitro": arb2,
    }
    r_team = client.post(f"/competicoes/{comp_id}/confrontos", json=payload_team_conflict, headers=_headers("p4-coord"))
    assert r_team.status_code == 422
    assert "equipe" in r_team.text.lower()

    # 4. No conflict after duration (15:00:00)
    payload_ok = {
        "id_equipe_mandante": t3,
        "id_equipe_visitante": t4,
        "data": "2026-08-15",
        "hora": "15:00:00",
        "id_local": loc1,
        "id_arbitro": arb1,
    }
    r_ok = client.post(f"/competicoes/{comp_id}/confrontos", json=payload_ok, headers=_headers("p4-coord"))
    assert r_ok.status_code == 201


def test_mata_mata_promocao_vencedor_e_rejeicao_empate(client, db):
    """Knockout matches reject ties and promote the winner to the next confrontation."""
    env = _setup_competition_env(db, formato="MATA_MATA")
    comp_id = env["competicao"].id_competicao
    t1 = env["equipes"][0].id_equipe
    t2 = env["equipes"][1].id_equipe
    t3 = env["equipes"][2].id_equipe
    t4 = env["equipes"][3].id_equipe
    loc_id = env["locais"][0].id_local
    arb_id = env["arbitros"][0].id_arbitro

    # Create Final (proximo_confronto = None)
    payload_final = {
        "fase": "Final",
        "data": "2026-08-25",
        "hora": "16:00:00",
        "id_local": loc_id,
        "id_arbitro": arb_id,
    }
    r_final = client.post(f"/competicoes/{comp_id}/confrontos", json=payload_final, headers=_headers("p4-coord"))
    assert r_final.status_code == 201
    final_id = r_final.json()["id_confronto"]

    # Create Semi 1 pointing to Final
    payload_semi1 = {
        "id_equipe_mandante": t1,
        "id_equipe_visitante": t2,
        "id_proximo_confronto": final_id,
        "fase": "Semifinal 1",
        "data": "2026-08-20",
        "hora": "14:00:00",
        "id_local": loc_id,
        "id_arbitro": arb_id,
    }
    r_semi1 = client.post(f"/competicoes/{comp_id}/confrontos", json=payload_semi1, headers=_headers("p4-coord"))
    assert r_semi1.status_code == 201
    semi1_id = r_semi1.json()["id_confronto"]

    # Create Semi 2 pointing to Final
    payload_semi2 = {
        "id_equipe_mandante": t3,
        "id_equipe_visitante": t4,
        "id_proximo_confronto": final_id,
        "fase": "Semifinal 2",
        "data": "2026-08-20",
        "hora": "16:00:00",
        "id_local": loc_id,
        "id_arbitro": arb_id,
    }
    r_semi2 = client.post(f"/competicoes/{comp_id}/confrontos", json=payload_semi2, headers=_headers("p4-coord"))
    assert r_semi2.status_code == 201
    semi2_id = r_semi2.json()["id_confronto"]

    # Finalizing Semi 1 with tie (2x2) must be rejected
    r_tie = client.put(
        f"/confrontos/{semi1_id}",
        json={"placar_mandante": 2, "placar_visitante": 2, "status": "Finalizado"},
        headers=_headers("p4-coord"),
    )
    assert r_tie.status_code == 422
    assert "empat" in r_tie.text.lower()

    # Finalizing Semi 1 with T1 win (3x1)
    r_win1 = client.put(
        f"/confrontos/{semi1_id}",
        json={"placar_mandante": 3, "placar_visitante": 1, "status": "Finalizado"},
        headers=_headers("p4-coord"),
    )
    assert r_win1.status_code == 200
    assert r_win1.json()["id_equipe_vencedora"] == t1

    # Final should now have t1 as mandante
    final_data1 = client.get(f"/confrontos/{final_id}", headers=_headers("p4-prof")).json()
    assert final_data1["id_equipe_mandante"] == t1
    assert final_data1["id_equipe_visitante"] is None

    # Finalizing Semi 2 with T4 win (0x2)
    r_win2 = client.put(
        f"/confrontos/{semi2_id}",
        json={"placar_mandante": 0, "placar_visitante": 2, "status": "Finalizado"},
        headers=_headers("p4-coord"),
    )
    assert r_win2.status_code == 200
    assert r_win2.json()["id_equipe_vencedora"] == t4

    # Final should now have t4 as visitante
    final_data2 = client.get(f"/confrontos/{final_id}", headers=_headers("p4-prof")).json()
    assert final_data2["id_equipe_mandante"] == t1
    assert final_data2["id_equipe_visitante"] == t4


def test_bloqueio_retroativo_quando_proximo_confronto_iniciado_ou_finalizado(client, db):
    """Cannot change score/winner or reopen match if the next match is already started or finished."""
    env = _setup_competition_env(db, formato="MATA_MATA")
    comp_id = env["competicao"].id_competicao
    t1 = env["equipes"][0].id_equipe
    t2 = env["equipes"][1].id_equipe
    loc_id = env["locais"][0].id_local
    arb_id = env["arbitros"][0].id_arbitro

    # Final
    r_final = client.post(
        f"/competicoes/{comp_id}/confrontos",
        json={"fase": "Final", "data": "2026-08-25", "hora": "16:00:00", "id_local": loc_id, "id_arbitro": arb_id},
        headers=_headers("p4-coord"),
    )
    final_id = r_final.json()["id_confronto"]

    # Semi 1
    r_semi = client.post(
        f"/competicoes/{comp_id}/confrontos",
        json={
            "id_equipe_mandante": t1,
            "id_equipe_visitante": t2,
            "id_proximo_confronto": final_id,
            "fase": "Semifinal",
            "data": "2026-08-20",
            "hora": "14:00:00",
            "id_local": loc_id,
            "id_arbitro": arb_id,
        },
        headers=_headers("p4-coord"),
    )
    semi_id = r_semi.json()["id_confronto"]

    # Finalize semi: t1 wins
    client.put(
        f"/confrontos/{semi_id}",
        json={"placar_mandante": 2, "placar_visitante": 1, "status": "Finalizado"},
        headers=_headers("p4-coord"),
    )

    # Start the Final (status = "Em Andamento")
    client.put(
        f"/confrontos/{final_id}",
        json={"status": "Em Andamento"},
        headers=_headers("p4-coord"),
    )

    # Attempt to change semi score to reverse winner -> must fail 422
    r_rev = client.put(
        f"/confrontos/{semi_id}",
        json={"placar_mandante": 1, "placar_visitante": 3},
        headers=_headers("p4-coord"),
    )
    assert r_rev.status_code == 422
    assert "próximo confronto" in r_rev.text.lower() or "proximo confronto" in r_rev.text.lower()

    # Attempt to reopen semi -> must fail 422
    r_reopen = client.put(
        f"/confrontos/{semi_id}",
        json={"status": "Agendado"},
        headers=_headers("p4-coord"),
    )
    assert r_reopen.status_code == 422


def test_geracao_automatica_pontos_corridos(client, db):
    """Generating Round Robin matches for 4 teams produces 6 confrontations."""
    env = _setup_competition_env(db, formato="PONTOS_CORRIDOS")
    comp_id = env["competicao"].id_competicao

    resp = client.post(
        f"/competicoes/{comp_id}/gerar-confrontos",
        json={"data_inicio": "2026-08-10"},
        headers=_headers("p4-coord"),
    )
    assert resp.status_code in [200, 201]
    confrontos = resp.json()
    assert len(confrontos) == 6  # 4 teams -> 3 rounds * 2 matches = 6
    assert all(c["id_competicao"] == comp_id for c in confrontos)
    assert all(c["status"] == "Agendado" for c in confrontos)


def test_geracao_automatica_grupos(client, db):
    """Generating matches for GRUPOS splits teams into groups and sets up knockout cross."""
    env = _setup_competition_env(db, formato="GRUPOS")
    comp_id = env["competicao"].id_competicao

    resp = client.post(
        f"/competicoes/{comp_id}/gerar-confrontos",
        json={"data_inicio": "2026-08-10"},
        headers=_headers("p4-coord"),
    )
    assert resp.status_code in [200, 201]
    confrontos = resp.json()
    # 4 teams split in 2 groups of 2: each group has 1 match (2 total) + 2 semis + 1 final = 5 matches
    assert len(confrontos) >= 3
    final_matches = [c for c in confrontos if c["fase"] == "Final"]
    assert len(final_matches) == 1


def test_geracao_automatica_mata_mata(client, db):
    """Generating matches for MATA_MATA sets up bracket with next-match linkages."""
    env = _setup_competition_env(db, formato="MATA_MATA")
    comp_id = env["competicao"].id_competicao

    resp = client.post(
        f"/competicoes/{comp_id}/gerar-confrontos",
        json={"data_inicio": "2026-08-10"},
        headers=_headers("p4-coord"),
    )
    assert resp.status_code in [200, 201]
    confrontos = resp.json()
    assert len(confrontos) == 3  # 4 teams -> 2 Semifinals + 1 Final
    final = next(c for c in confrontos if c["fase"] == "Final")
    semis = [c for c in confrontos if "Semifinal" in c["fase"]]
    assert len(semis) == 2
    assert all(s["id_proximo_confronto"] == final["id_confronto"] for s in semis)


def test_geracao_rejeita_se_ja_iniciada(client, db):
    """Cannot generate confrontations if competition already has started/completed matches."""
    env = _setup_competition_env(db, formato="PONTOS_CORRIDOS")
    comp_id = env["competicao"].id_competicao

    # Create a match and start it
    payload = {
        "id_equipe_mandante": env["equipes"][0].id_equipe,
        "id_equipe_visitante": env["equipes"][1].id_equipe,
        "data": "2026-08-10",
        "hora": "10:00:00",
        "id_local": env["locais"][0].id_local,
        "id_arbitro": env["arbitros"][0].id_arbitro,
        "status": "Em Andamento",
    }
    client.post(f"/competicoes/{comp_id}/confrontos", json=payload, headers=_headers("p4-coord"))

    resp = client.post(
        f"/competicoes/{comp_id}/gerar-confrontos",
        json={},
        headers=_headers("p4-coord"),
    )
    assert resp.status_code == 422


@pytest.mark.parametrize("role, expected", [
    ("admin", 201),
    ("coordenador", 201),
    ("professor", 403),
    ("assistente", 403),
])
def test_autorizacao_permissoes_confrontos(client, db, role, expected):
    """Mutation endpoints require admin/coordinator; professor/assistant are forbidden."""
    env = _setup_competition_env(db)
    comp_id = env["competicao"].id_competicao

    payload = {
        "id_equipe_mandante": env["equipes"][0].id_equipe,
        "id_equipe_visitante": env["equipes"][1].id_equipe,
        "data": "2026-08-18",
        "hora": "10:00:00",
        "id_local": env["locais"][0].id_local,
        "id_arbitro": env["arbitros"][0].id_arbitro,
    }
    resp = client.post(
        f"/competicoes/{comp_id}/confrontos",
        json=payload,
        headers=_headers(f"p4-{role}"),
    )
    assert resp.status_code == expected


def test_confronto_rejeita_anonimo(client, db):
    """Anonymous calls receive 401 Unauthorized."""
    env = _setup_competition_env(db)
    comp_id = env["competicao"].id_competicao

    r_post = client.post(f"/competicoes/{comp_id}/confrontos", json={})
    assert r_post.status_code == 401

    r_get = client.get(f"/competicoes/{comp_id}/confrontos")
    assert r_get.status_code == 401


def test_upload_sumula_confronto(client, db):
    """Uploading a match sheet verifies extensions and content-types."""
    env = _setup_competition_env(db)
    comp_id = env["competicao"].id_competicao

    payload = {
        "id_equipe_mandante": env["equipes"][0].id_equipe,
        "id_equipe_visitante": env["equipes"][1].id_equipe,
        "data": "2026-08-10",
        "hora": "10:00:00",
        "id_local": env["locais"][0].id_local,
        "id_arbitro": env["arbitros"][0].id_arbitro,
    }
    r = client.post(f"/competicoes/{comp_id}/confrontos", json=payload, headers=_headers("p4-coord"))
    c_id = r.json()["id_confronto"]

    # 1. Invalid extension .txt -> 400
    files_invalid_ext = {"file": ("sumula.txt", io.BytesIO(b"dados"), "application/pdf")}
    resp_bad_ext = client.post(f"/confrontos/{c_id}/sumula", files=files_invalid_ext, headers=_headers("p4-coord"))
    assert resp_bad_ext.status_code == 400

    # 2. Invalid mime-type -> 400
    files_invalid_mime = {"file": ("sumula.pdf", io.BytesIO(b"dados"), "text/plain")}
    resp_bad_mime = client.post(f"/confrontos/{c_id}/sumula", files=files_invalid_mime, headers=_headers("p4-coord"))
    assert resp_bad_mime.status_code == 400

    # 3. Valid PDF -> 200
    files_valid = {"file": ("sumula.pdf", io.BytesIO(b"%PDF-1.4 mock pdf"), "application/pdf")}
    resp_ok = client.post(f"/confrontos/{c_id}/sumula", files=files_valid, headers=_headers("p4-coord"))
    assert resp_ok.status_code == 200
    assert "sumula_arquivo" in resp_ok.json()
    assert resp_ok.json()["sumula_arquivo"].endswith(".pdf")
