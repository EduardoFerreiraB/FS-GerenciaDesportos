"""Passo 3 HTTP authorization checks using the real ASGI application."""

from datetime import date

import pytest

import models
from security import create_access_token, get_password_hash


def _headers(username):
    return {"Authorization": f"Bearer {create_access_token({'sub': username})}"}


def _competition(db):
    evento = models.Evento(even_nome="Jogos Passo 3")
    modalidade = models.Modalidade(nome="Futebol Passo 3")
    db.add_all([evento, modalidade])
    db.flush()
    edicao = models.Edicao(id_evento=evento.id_evento, edic_ano=2026, tipo_competicao="Pontos Corridos", data_inicio=date(2026, 8, 1), data_fim=date(2026, 8, 31))
    db.add(edicao)
    db.flush()
    competicao = models.Competicao(id_edicao=edicao.id_edicao, id_modalidade=modalidade.id_modalidade, nome="Equipe", categoria="Livre", modo_inscricao="EQUIPE", formato="PONTOS_CORRIDOS", criterio_resultado="PLACAR", data_inicio=date(2026, 8, 1), data_fim=date(2026, 8, 31))
    db.add(competicao)
    db.commit()
    return competicao


@pytest.mark.parametrize("role, expected", [("admin", 201), ("coordenador", 201), ("professor", 403), ("assistente", 403)])
def test_creation_requires_admin_or_coordinator(client, db, role, expected):
    """Weakening the role dependency would permit a non-manager to change a roster."""
    competition = _competition(db)
    username = f"passo3-{role}"
    db.add(models.Usuario(username=username, password_hash=get_password_hash("senha-segura"), role=role))
    db.commit()

    response = client.post(f"/competicoes/{competition.id_competicao}/equipes", json={"nome": role}, headers=_headers(username))

    assert response.status_code == expected


def test_team_creation_and_membership_reject_anonymous_users(client, db):
    """Removing authentication would expose team mutations to anonymous callers."""
    competition = _competition(db)

    created = client.post(f"/competicoes/{competition.id_competicao}/equipes", json={"nome": "Sem login"})
    member = client.post("/equipes/999/participantes/999")

    assert created.status_code == 401
    assert member.status_code == 401


@pytest.mark.parametrize("role, expected", [("admin", 200), ("coordenador", 200), ("professor", 403), ("assistente", 403)])
def test_membership_mutation_requires_admin_or_coordinator(client, db, role, expected):
    """Weakening the membership role guard would let a teacher or assistant alter a roster."""
    competition = _competition(db)
    team = models.Equipe(nome=f"Time {role}", id_edicao=competition.id_edicao, id_competicao=competition.id_competicao)
    participant = models.Participante(tipo="aluno")
    username = f"passo3-membro-{role}"
    db.add_all([team, participant, models.Usuario(username=username, password_hash=get_password_hash("senha-segura"), role=role)])
    db.commit()

    response = client.post(
        f"/equipes/{team.id_equipe}/participantes/{participant.id_participante}",
        headers=_headers(username),
    )

    assert response.status_code == expected


def test_team_list_rejects_individual_competition(client, db):
    """Removing the mode guard would present a team flow for an individual competition."""
    competition = _competition(db)
    competition.modo_inscricao = "INDIVIDUAL"
    db.commit()
    username = "passo3-lista-individual"
    db.add(models.Usuario(username=username, password_hash=get_password_hash("senha-segura"), role="professor"))
    db.commit()

    response = client.get(f"/competicoes/{competition.id_competicao}/equipes", headers=_headers(username))

    assert response.status_code == 422


def test_membership_service_rejects_second_team_in_same_competition(db):
    """Removing the competition lock/check would permit a duplicate roster through the service."""
    from services import equipes as team_service

    competition = _competition(db)
    first = models.Equipe(nome="Primeira", id_edicao=competition.id_edicao, id_competicao=competition.id_competicao)
    second = models.Equipe(nome="Segunda", id_edicao=competition.id_edicao, id_competicao=competition.id_competicao)
    participant = models.Participante(tipo="aluno")
    db.add_all([first, second, participant])
    db.commit()
    assert team_service.adicionar_participante_equipe(db, first.id_equipe, participant.id_participante) is True

    with pytest.raises(ValueError, match="outra equipe desta competição"):
        team_service.adicionar_participante_equipe(db, second.id_equipe, participant.id_participante)


def test_membership_service_restarts_read_transaction_before_competition_lock(db, monkeypatch):
    """Keeping the scope lookup transaction open would let MySQL reuse an older membership snapshot."""
    from services import equipes as team_service

    competition = _competition(db)
    team = models.Equipe(nome="Time lock", id_edicao=competition.id_edicao, id_competicao=competition.id_competicao)
    participant = models.Participante(tipo="aluno")
    db.add_all([team, participant])
    db.commit()
    rollback_calls = []
    original_rollback = db.rollback

    def capture_rollback():
        rollback_calls.append(True)
        original_rollback()

    monkeypatch.setattr(db, "rollback", capture_rollback)
    assert team_service.adicionar_participante_equipe(db, team.id_equipe, participant.id_participante) is True
    assert rollback_calls == [True]
