"""Correções de elencos (T2b): PD-RT11-02, PD-RT11-03 e DF-RT11-02 (API)."""

from __future__ import annotations

import uuid

import pytest

from models import Modalidade


def _modalidade(db) -> int:
    mod = db.query(Modalidade).first()
    if mod is None:
        mod = Modalidade(nome="Futebol Elencos")
        db.add(mod)
        db.commit()
        db.refresh(mod)
    return mod.id_modalidade


def _configuracao() -> dict:
    return {
        "formato": "PONTOS_CORRIDOS",
        "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
        "desempates": ["SALDO_GOLS"],
        "turno_e_returno": False,
    }


def _edicao(identificacao: str) -> dict:
    return {
        "identificacao": identificacao,
        "data_inicio": f"{identificacao}-03-01",
        "data_fim": f"{identificacao}-03-31",
        "formato": "PONTOS_CORRIDOS",
        "configuracao": _configuracao(),
    }


@pytest.fixture()
def cab(cabecalhos_por_papel):
    return cabecalhos_por_papel("coordenador")


@pytest.fixture()
def competicao(client, cab, db):
    """Competição com edições 2026 e 2027 (ids) e uma equipe com 2 integrantes em 2026."""
    r = client.post("/competicoes/competicoes", headers=cab, json={
        "nome": f"Copa Elencos {uuid.uuid4().hex[:6]}",
        "id_modalidade": _modalidade(db),
        "edicao": _edicao("2026"),
    })
    assert r.status_code == 201, r.text
    corpo = r.json()
    id_2026 = corpo["edicoes"][0]["id_edicao_competicao"]
    r = client.post(f"/competicoes/competicoes/{corpo['id_competicao']}/edicoes", headers=cab,
                    json=_edicao("2027"))
    assert r.status_code == 201, r.text
    id_2027 = r.json()["id_edicao_competicao"]

    r = client.post(f"/competicoes/edicoes/{id_2026}/equipes", headers=cab,
                    json={"nome": "Leões", "sigla": "LEO"})
    assert r.status_code == 201, r.text
    id_equipe = r.json()["id_equipe"]
    integrantes = []
    for nome in ("Ativo", "Inativo"):
        r = client.post("/competicoes/competidores", headers=cab, json={"nome": f"Atleta {nome}"})
        assert r.status_code == 201, r.text
        r = client.post(f"/competicoes/equipes/{id_equipe}/integrantes", headers=cab, json={
            "id_competidor": r.json()["id_competidor"], "nome_esportivo": nome, "numero_camisa": 7,
        })
        assert r.status_code == 201, r.text
        integrantes.append(r.json()["id_integrante"])
    return {
        "id_competicao": corpo["id_competicao"], "nome": corpo["nome"],
        "id_2026": id_2026, "id_2027": id_2027, "id_equipe": id_equipe,
        "id_ativo": integrantes[0], "id_inativo": integrantes[1],
    }


def test_copia_ignora_integrante_inativo(client, cab, competicao):
    r = client.patch(f"/competicoes/integrantes/{competicao['id_inativo']}", headers=cab,
                     json={"situacao": "INATIVO"})
    assert r.status_code == 200, r.text

    r = client.post(f"/competicoes/edicoes/{competicao['id_2027']}/copiar-equipes", headers=cab,
                    json={"id_edicao_origem": competicao["id_2026"]})
    assert r.status_code == 201, r.text
    [equipe] = r.json()
    assert [i["nome_esportivo"] for i in equipe["integrantes"]] == ["Ativo"]
    assert all(i["situacao"] == "ATIVO" for i in equipe["integrantes"])


def test_patch_integrante_camisa_posicao_e_nome_esportivo(client, cab, competicao):
    url = f"/competicoes/integrantes/{competicao['id_ativo']}"
    r = client.patch(url, headers=cab, json={"numero_camisa": 10, "posicao": "Goleiro"})
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert (corpo["numero_camisa"], corpo["posicao"], corpo["situacao"]) == (10, "Goleiro", "ATIVO")

    # Campo ausente não muda; null limpa.
    r = client.patch(url, headers=cab, json={"posicao": None, "nome_esportivo": "Ativão"})
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert (corpo["numero_camisa"], corpo["posicao"], corpo["nome_esportivo"]) == (10, None, "Ativão")

    # Inativar e reativar (DF-RT11-01 depende da volta).
    assert client.patch(url, headers=cab, json={"situacao": "INATIVO"}).json()["situacao"] == "INATIVO"
    assert client.patch(url, headers=cab, json={"situacao": "ATIVO"}).json()["situacao"] == "ATIVO"


def test_patch_integrante_recusa_nome_esportivo_vazio(client, cab, competicao):
    r = client.patch(f"/competicoes/integrantes/{competicao['id_ativo']}", headers=cab,
                     json={"nome_esportivo": None})
    assert r.status_code == 422
    assert r.json()["campos"] == ["nome_esportivo"]


def test_patch_equipe_nome_e_sigla(client, cab, competicao):
    url = f"/competicoes/equipes/{competicao['id_equipe']}"
    r = client.patch(url, headers=cab, json={"nome": "Leões RT"})
    assert r.status_code == 200, r.text
    assert (r.json()["nome"], r.json()["sigla"]) == ("Leões RT", "LEO")
    r = client.patch(url, headers=cab, json={"sigla": None})
    assert r.status_code == 200, r.text
    assert r.json()["sigla"] is None
    assert len(r.json()["integrantes"]) == 2


def test_patch_equipe_permitido_com_edicao_em_andamento(client, cab, competicao):
    id_2026 = competicao["id_2026"]
    r = client.post(f"/competicoes/edicoes/{id_2026}/equipes", headers=cab, json={"nome": "Tigres"})
    id_tigres = r.json()["id_equipe"]
    r = client.post("/competicoes/competidores", headers=cab, json={"nome": "Atleta Tigre"})
    client.post(f"/competicoes/equipes/{id_tigres}/integrantes", headers=cab, json={
        "id_competidor": r.json()["id_competidor"], "nome_esportivo": "Tigre",
    })
    assert client.post(f"/competicoes/edicoes/{id_2026}/gerar-tabela", headers=cab, json={}).status_code == 201
    assert client.post(f"/competicoes/edicoes/{id_2026}/iniciar", headers=cab).status_code == 200

    r = client.patch(f"/competicoes/equipes/{competicao['id_equipe']}", headers=cab,
                     json={"nome": "Leões FC", "sigla": "LFC"})
    assert r.status_code == 200, r.text
    assert r.json()["nome"] == "Leões FC"


def test_sigla_duplicada_409(client, cab, competicao):
    id_2026 = competicao["id_2026"]
    r = client.post(f"/competicoes/edicoes/{id_2026}/equipes", headers=cab,
                    json={"nome": "Tigres", "sigla": "TIG"})
    assert r.status_code == 201, r.text
    id_tigres = r.json()["id_equipe"]

    r = client.patch(f"/competicoes/equipes/{id_tigres}", headers=cab, json={"sigla": "leo"})
    assert r.status_code == 409
    assert (r.json()["codigo"], r.json()["campos"]) == ("DUPLICIDADE", ["sigla"])

    r = client.post(f"/competicoes/edicoes/{id_2026}/equipes", headers=cab,
                    json={"nome": "Águias", "sigla": "LEO"})
    assert r.status_code == 409
    assert r.json()["campos"] == ["sigla"]

    # A própria equipe pode manter a sigla.
    r = client.patch(f"/competicoes/equipes/{competicao['id_equipe']}", headers=cab, json={"sigla": "LEO"})
    assert r.status_code == 200, r.text


def test_nome_de_equipe_duplicado_no_patch_409(client, cab, competicao):
    r = client.post(f"/competicoes/edicoes/{competicao['id_2026']}/equipes", headers=cab,
                    json={"nome": "Tigres"})
    r = client.patch(f"/competicoes/equipes/{r.json()['id_equipe']}", headers=cab, json={"nome": "Leões"})
    assert r.status_code == 409
    assert r.json()["campos"] == ["nome"]


def test_origens_de_copia_listam_edicoes_da_competicao_menos_a_atual(client, cab, competicao):
    r = client.get(f"/competicoes/edicoes/{competicao['id_2027']}/copiar-equipes/origens", headers=cab)
    assert r.status_code == 200, r.text
    origens = r.json()
    assert origens[0] == {
        "id_edicao_competicao": competicao["id_2026"],
        "rotulo": f"{competicao['nome']} · 2026",
        "equipes": 1,
    }
    assert competicao["id_2027"] not in {o["id_edicao_competicao"] for o in origens}
    # Edição sem equipes não serve de origem.
    r = client.get(f"/competicoes/edicoes/{competicao['id_2026']}/copiar-equipes/origens", headers=cab)
    assert competicao["id_2027"] not in {o["id_edicao_competicao"] for o in r.json()}


def test_origens_de_copia_edicao_inexistente_404(client, cab):
    r = client.get("/competicoes/edicoes/999999/copiar-equipes/origens", headers=cab)
    assert r.status_code == 404
