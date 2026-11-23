"""Correções do agendamento (T2): DF-RT12-04, DF-RT13-09, DF-RT13-07 (mensagem)."""

from __future__ import annotations

import uuid

import pytest

from models import Modalidade


@pytest.fixture()
def cab(cabecalhos_por_papel):
    return cabecalhos_por_papel("coordenador")


@pytest.fixture()
def edicao(client, cab, db):
    """Pontos corridos, 2 equipes, período 23/11/2026 a 20/12/2026, tabela gerada."""
    mod = db.query(Modalidade).first()
    if mod is None:
        mod = Modalidade(nome="Futebol Agenda")
        db.add(mod)
        db.commit()
    r = client.post("/competicoes/competicoes", headers=cab, json={
        "nome": "Copa Agenda", "id_modalidade": mod.id_modalidade,
        "edicao": {
            "identificacao": "2026", "data_inicio": "2026-11-23", "data_fim": "2026-12-20",
            "formato": "PONTOS_CORRIDOS",
            "configuracao": {
                "formato": "PONTOS_CORRIDOS", "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                "desempates": ["SALDO_GOLS"], "turno_e_returno": True,
            },
        },
    })
    assert r.status_code == 201, r.text
    id_edicao = r.json()["edicoes"][0]["id_edicao_competicao"]
    for i in (1, 2):
        r = client.post(f"/competicoes/edicoes/{id_edicao}/equipes", headers=cab, json={"nome": f"Time {i}"})
        id_equipe = r.json()["id_equipe"]
        r = client.post("/competicoes/competidores", headers=cab, json={"nome": f"Atleta {i}"})
        client.post(f"/competicoes/equipes/{id_equipe}/integrantes", headers=cab, json={
            "id_competidor": r.json()["id_competidor"], "nome_esportivo": f"Atleta {i}",
        })
    assert client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=cab, json={}).status_code == 201
    partidas = client.get(f"/competicoes/edicoes/{id_edicao}/partidas", headers=cab).json()
    return {"id_edicao": id_edicao, "partidas": [p["id_partida"] for p in partidas]}


def _agendar(client, cab, id_partida, corpo):
    return client.patch(f"/competicoes/partidas/{id_partida}/agendamento", headers=cab, json=corpo)


def test_agendar_dentro_do_periodo_ok(client, cab, edicao):
    r = _agendar(client, cab, edicao["partidas"][0], {"data": "2026-11-23", "hora": "10:00:00"})
    assert r.status_code == 200, r.text
    r = _agendar(client, cab, edicao["partidas"][0], {"data_hora": "2026-12-20T18:30:00"})
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("corpo", [{"data": "2026-11-22"}, {"data_hora": "2026-12-21T10:00:00"}])
def test_agendar_fora_do_periodo_422(client, cab, edicao, corpo):
    r = _agendar(client, cab, edicao["partidas"][0], corpo)
    assert r.status_code == 422
    assert (r.json()["codigo"], r.json()["campos"]) == ("CONFIGURACAO_INVALIDA", ["data"])
    assert r.json()["mensagem"] == "A data precisa estar entre 23/11/2026 e 20/12/2026."


def test_agendar_em_edicao_cancelada_409(client, cab, edicao):
    r = client.post(f"/competicoes/edicoes/{edicao['id_edicao']}/cancelar", headers=cab,
                    json={"motivo": "Chuva forte"})
    assert r.status_code == 200, r.text
    r = _agendar(client, cab, edicao["partidas"][0], {"data": "2026-11-25"})
    assert r.status_code == 409
    assert (r.json()["codigo"], r.json()["campos"]) == ("CONFLITO_ESTADO", ["estado"])
    assert r.json()["mensagem"] == "A edição precisa estar em rascunho ou em andamento para agendar jogos."


def test_agendar_jogo_finalizado_409(client, cab, edicao):
    assert client.post(f"/competicoes/edicoes/{edicao['id_edicao']}/iniciar", headers=cab).status_code == 200
    id_partida = edicao["partidas"][0]
    r = client.post(f"/competicoes/partidas/{id_partida}/resultado-simples",
                    headers={**cab, "Idempotency-Key": str(uuid.uuid4())},
                    json={"gols_mandante": 1, "gols_visitante": 0})
    assert r.status_code == 200, r.text
    r = _agendar(client, cab, id_partida, {"data": "2026-11-25"})
    assert r.status_code == 409
    assert (r.json()["codigo"], r.json()["campos"]) == ("CONFLITO_ESTADO", ["estado"])
    assert r.json()["mensagem"] == "Jogo finalizado não pode ser reagendado."


def test_limpar_agendamento_de_jogo_agendado_ok(client, cab, edicao):
    id_partida = edicao["partidas"][1]
    assert _agendar(client, cab, id_partida, {"data": "2026-11-30", "local": "Quadra 1"}).status_code == 200
    r = _agendar(client, cab, id_partida, {})
    assert r.status_code == 200, r.text
    assert (r.json()["data"], r.json()["local"]) == (None, None)
