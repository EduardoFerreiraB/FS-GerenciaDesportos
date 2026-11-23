"""Correções de eventos (T1): PD-RT15-01/02, PD-RT09-03, DF-RT15-01/02/05/08."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import func, select

from competicoes.modelos import (
    Competicao,
    CumprimentoSuspensao,
    DecisaoClassificacao,
    DueloEliminatorio,
    EdicaoCompeticao,
    EdicaoEvento,
    Equipe,
    Evento,
    GrupoCompeticao,
    IntegranteEquipe,
    OcorrenciaPartida,
    Partida,
    RequisicaoPartida,
    SuspensaoCompeticao,
)
from models import Modalidade


def _modalidade(db) -> int:
    mod = db.query(Modalidade).first()
    if mod is None:
        mod = Modalidade(nome="Futebol Eventos")
        db.add(mod)
        db.commit()
        db.refresh(mod)
    return mod.id_modalidade


def _edicao_competicao(identificacao="2026", inicio="2026-05-10", fim="2026-05-20", id_edicao_evento=None):
    return {
        "identificacao": identificacao,
        "data_inicio": inicio,
        "data_fim": fim,
        "id_edicao_evento": id_edicao_evento,
        "formato": "PONTOS_CORRIDOS",
        "configuracao": {
            "formato": "PONTOS_CORRIDOS",
            "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
            "desempates": ["SALDO_GOLS"],
            "turno_e_returno": False,
        },
    }


@pytest.fixture()
def cab(cabecalhos_por_papel):
    return cabecalhos_por_papel("coordenador")


def _criar_evento(client, cab, nome="Jogos Escolares", inicio="2026-05-01", fim="2026-05-31"):
    return client.post("/competicoes/eventos", headers=cab, json={
        "nome": nome, "descricao": "Descrição inicial",
        "edicao": {"identificacao": "2026", "data_inicio": inicio, "data_fim": fim},
    })


def _criar_competicao(client, cab, db, nome="Copa X", **edicao):
    return client.post("/competicoes/competicoes", headers=cab, json={
        "nome": nome, "id_modalidade": _modalidade(db), "edicao": _edicao_competicao(**edicao),
    })


@pytest.fixture()
def evento_simples(client, cab):
    r = _criar_evento(client, cab)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture()
def evento_com_edicao_em_andamento(client, cab, db, usuario, evento_simples):
    """Evento → edição → competição em andamento com jogos, súmula, suspensão, decisão e publicação."""
    id_edicao_evento = evento_simples["edicoes"][0]["id_edicao_evento"]
    r = _criar_competicao(client, cab, db, id_edicao_evento=id_edicao_evento)
    assert r.status_code == 201, r.text
    competicao = r.json()
    id_edicao = competicao["edicoes"][0]["id_edicao_competicao"]

    integrantes = []
    for i in range(1, 5):
        r = client.post(f"/competicoes/edicoes/{id_edicao}/equipes", headers=cab, json={"nome": f"Time {i}"})
        id_equipe = r.json()["id_equipe"]
        r = client.post("/competicoes/competidores", headers=cab, json={"nome": f"Atleta {i}"})
        r = client.post(f"/competicoes/equipes/{id_equipe}/integrantes", headers=cab, json={
            "id_competidor": r.json()["id_competidor"], "nome_esportivo": f"Atleta {i}",
        })
        integrantes.append(r.json()["id_integrante"])
    assert client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=cab, json={}).status_code == 201
    assert client.post(f"/competicoes/edicoes/{id_edicao}/iniciar", headers=cab).status_code == 200

    partidas = client.get(f"/competicoes/edicoes/{id_edicao}/partidas", headers=cab).json()
    r = client.post(
        f"/competicoes/partidas/{partidas[0]['id_partida']}/resultado-simples",
        headers={**cab, "Idempotency-Key": str(uuid.uuid4())},
        json={"gols_mandante": 2, "gols_visitante": 1},
    )
    assert r.status_code == 200, r.text
    r = client.post(f"/competicoes/edicoes/{id_edicao}/suspensoes", headers=cab, json={
        "id_integrante": integrantes[0], "jogos": 1, "motivo": "Conduta antidesportiva",
    })
    assert r.status_code == 201, r.text
    db.add(DecisaoClassificacao(
        id_edicao_competicao=id_edicao, conjunto_equipes=[1, 2], ordem_escolhida=[1, 2],
        motivo="Sorteio", revisao_resultados="x", id_usuario_responsavel=usuario.id_usuario,
    ))
    db.commit()
    r = client.post(f"/competicoes/edicoes/{id_edicao}/publicar", headers=cab, json={"publicada": True})
    assert r.status_code == 200, r.text
    return {"evento": evento_simples, "competicao": competicao, "id_edicao": id_edicao,
            "id_edicao_evento": id_edicao_evento}


def _contagens(db, id_evento, id_competicao, id_edicao) -> dict[str, int]:
    def contar(modelo, *condicoes) -> int:
        db.expire_all()
        return db.scalar(select(func.count()).select_from(modelo).where(*condicoes))

    return {
        "eventos": contar(Evento, Evento.id_evento == id_evento),
        "edicoes_evento": contar(EdicaoEvento, EdicaoEvento.id_evento == id_evento),
        "competicoes": contar(Competicao, Competicao.id_competicao == id_competicao),
        "edicoes_competicao": contar(EdicaoCompeticao, EdicaoCompeticao.id_edicao_competicao == id_edicao),
        "partidas": contar(Partida, Partida.id_edicao_competicao == id_edicao),
        "ocorrencias": contar(OcorrenciaPartida, OcorrenciaPartida.id_partida.in_(
            select(Partida.id_partida).where(Partida.id_edicao_competicao == id_edicao))),
        "requisicoes": contar(RequisicaoPartida),
        "suspensoes": contar(SuspensaoCompeticao, SuspensaoCompeticao.id_edicao_competicao == id_edicao),
        "cumprimentos": contar(CumprimentoSuspensao),
        "decisoes": contar(DecisaoClassificacao, DecisaoClassificacao.id_edicao_competicao == id_edicao),
        "equipes": contar(Equipe, Equipe.id_edicao_competicao == id_edicao),
        "integrantes": contar(IntegranteEquipe, IntegranteEquipe.id_edicao_competicao == id_edicao),
        "grupos": contar(GrupoCompeticao, GrupoCompeticao.id_edicao_competicao == id_edicao),
        "duelos": contar(DueloEliminatorio, DueloEliminatorio.id_edicao_competicao == id_edicao),
    }


def _excluir_evento(client, cab, id_evento, nome):
    return client.request("DELETE", f"/competicoes/eventos/{id_evento}", headers=cab,
                          json={"confirmacao_nome": nome})


# --------------------------------------------------------------------------- exclusão


def test_excluir_evento_apaga_toda_a_arvore(client, cab, db, evento_com_edicao_em_andamento):
    ctx = evento_com_edicao_em_andamento
    ids = (ctx["evento"]["id_evento"], ctx["competicao"]["id_competicao"], ctx["id_edicao"])
    antes = _contagens(db, *ids)
    assert antes["partidas"] > 0 and antes["ocorrencias"] > 0 and antes["suspensoes"] > 0
    assert antes["decisoes"] == 1 and antes["integrantes"] == 4

    r = _excluir_evento(client, cab, ctx["evento"]["id_evento"], ctx["evento"]["nome"])
    assert r.status_code == 204, r.text
    assert _contagens(db, *ids) == {chave: 0 for chave in antes}
    assert client.get(f"/competicoes/publico/edicoes/{ctx['id_edicao']}").status_code == 404


def test_excluir_evento_preserva_competicao_com_outra_edicao(client, cab, db, evento_com_edicao_em_andamento):
    ctx = evento_com_edicao_em_andamento
    id_competicao = ctx["competicao"]["id_competicao"]
    r = client.post(f"/competicoes/competicoes/{id_competicao}/edicoes", headers=cab,
                    json=_edicao_competicao("2027", "2027-05-10", "2027-05-20"))
    assert r.status_code == 201, r.text
    id_outra = r.json()["id_edicao_competicao"]

    assert _excluir_evento(client, cab, ctx["evento"]["id_evento"], ctx["evento"]["nome"]).status_code == 204
    restante = client.get(f"/competicoes/competicoes/{id_competicao}", headers=cab)
    assert restante.status_code == 200
    assert [e["id_edicao_competicao"] for e in restante.json()["edicoes"]] == [id_outra]


def test_excluir_evento_exige_nome_exato(client, cab, evento_simples):
    for errado in (evento_simples["nome"].lower(), evento_simples["nome"] + " ", "outro"):
        r = _excluir_evento(client, cab, evento_simples["id_evento"], errado)
        assert r.status_code == 409
        assert (r.json()["codigo"], r.json()["campos"]) == ("CONFIRMACAO_INVALIDA", ["confirmacao_nome"])
    assert client.get(f"/competicoes/eventos/{evento_simples['id_evento']}", headers=cab).status_code == 200


def test_excluir_evento_exige_coordenador(client, cabecalhos_por_papel, evento_simples):
    r = client.request("DELETE", f"/competicoes/eventos/{evento_simples['id_evento']}",
                       headers=cabecalhos_por_papel("professor"),
                       json={"confirmacao_nome": evento_simples["nome"]})
    assert r.status_code == 403


def test_excluir_edicao_de_evento_em_cascata(client, cab, db, evento_com_edicao_em_andamento):
    ctx = evento_com_edicao_em_andamento
    id_evento = ctx["evento"]["id_evento"]
    r = client.post(f"/competicoes/eventos/{id_evento}/edicoes", headers=cab, json={
        "identificacao": "2027", "data_inicio": "2027-05-01", "data_fim": "2027-05-31",
    })
    assert r.status_code == 201, r.text

    url = f"/competicoes/edicoes-evento/{ctx['id_edicao_evento']}"
    r = client.request("DELETE", url, headers=cab, json={"confirmacao_identificacao": "2027"})
    assert r.status_code == 409
    assert r.json()["campos"] == ["confirmacao_identificacao"]
    r = client.request("DELETE", url, headers=cab, json={"confirmacao_identificacao": "2026"})
    assert r.status_code == 204, r.text

    evento = client.get(f"/competicoes/eventos/{id_evento}", headers=cab).json()
    assert [e["identificacao"] for e in evento["edicoes"]] == ["2027"]
    contagens = _contagens(db, id_evento, ctx["competicao"]["id_competicao"], ctx["id_edicao"])
    assert contagens["eventos"] == 1 and contagens["edicoes_evento"] == 1
    assert all(v == 0 for k, v in contagens.items() if k not in ("eventos", "edicoes_evento"))


def test_previa_exclusao_conta_impacto(client, cab, evento_com_edicao_em_andamento):
    ctx = evento_com_edicao_em_andamento
    r = client.get(f"/competicoes/eventos/{ctx['evento']['id_evento']}/exclusao/previa", headers=cab)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "edicoes_evento": 1, "edicoes_competicao": 1, "partidas": 6, "equipes": 4, "publicadas": 1,
    }


# --------------------------------------------------------------------------- nomes únicos


def test_nome_de_evento_duplicado_recusado_ignorando_caixa_e_acento(client, cab):
    assert _criar_evento(client, cab, "Jogos Escolares de Goiás").status_code == 201
    for repetido in ("JOGOS ESCOLARES DE GOIAS ", "jogos  escolares de goiás"):
        r = _criar_evento(client, cab, repetido)
        assert r.status_code == 409, repetido
        assert (r.json()["codigo"], r.json()["campos"]) == ("DUPLICIDADE", ["nome"])


def test_nome_de_competicao_duplicado_recusado(client, cab, db):
    assert _criar_competicao(client, cab, db, "Copa Ação").status_code == 201
    r = _criar_competicao(client, cab, db, " copa acao")
    assert r.status_code == 409
    assert (r.json()["codigo"], r.json()["campos"]) == ("DUPLICIDADE", ["nome"])


def test_renomear_evento_para_nome_existente_recusado(client, cab, evento_simples):
    outro = _criar_evento(client, cab, "Olimpíada Interna").json()
    r = client.patch(f"/competicoes/eventos/{outro['id_evento']}", headers=cab,
                     json={"nome": "jogos escolares"})
    assert r.status_code == 409
    assert r.json()["campos"] == ["nome"]
    # Renomear para o próprio nome (mudando só a caixa) é permitido.
    r = client.patch(f"/competicoes/eventos/{outro['id_evento']}", headers=cab,
                     json={"nome": "Olimpíada INTERNA"})
    assert r.status_code == 200, r.text


def test_renomear_competicao_para_nome_existente_recusado(client, cab, db):
    _criar_competicao(client, cab, db, "Copa Um")
    dois = _criar_competicao(client, cab, db, "Copa Dois").json()
    r = client.patch(f"/competicoes/competicoes/{dois['id_competicao']}", headers=cab,
                     json={"nome": "COPA UM"})
    assert r.status_code == 409
    assert r.json()["campos"] == ["nome"]


def test_patch_evento_descricao_null_apaga(client, cab, evento_simples):
    r = client.patch(f"/competicoes/eventos/{evento_simples['id_evento']}", headers=cab,
                     json={"descricao": None})
    assert r.status_code == 200, r.text
    assert r.json()["descricao"] is None
    assert r.json()["nome"] == evento_simples["nome"]


def test_patch_competicao_descricao_null_apaga(client, cab, db):
    comp = _criar_competicao(client, cab, db, "Copa Descrição").json()
    client.patch(f"/competicoes/competicoes/{comp['id_competicao']}", headers=cab, json={"descricao": "x"})
    r = client.patch(f"/competicoes/competicoes/{comp['id_competicao']}", headers=cab, json={"descricao": None})
    assert r.status_code == 200, r.text
    assert r.json()["descricao"] is None


# --------------------------------------------------------------------------- vínculos


def test_edicao_evento_lista_competicoes_vinculadas(client, cab, evento_com_edicao_em_andamento):
    ctx = evento_com_edicao_em_andamento
    detalhe = client.get(f"/competicoes/eventos/{ctx['evento']['id_evento']}", headers=cab).json()
    [vinculada] = detalhe["edicoes"][0]["competicoes"]
    assert vinculada == {
        "id_competicao": ctx["competicao"]["id_competicao"],
        "nome": "Copa X",
        "id_edicao_competicao": ctx["id_edicao"],
        "identificacao": "2026",
        "estado": "EM_ANDAMENTO",
        "publicada": True,
    }


def test_vincular_edicao_existente_dentro_do_periodo(client, cab, db, evento_simples):
    id_edicao_evento = evento_simples["edicoes"][0]["id_edicao_evento"]
    id_edicao = _criar_competicao(client, cab, db).json()["edicoes"][0]["id_edicao_competicao"]
    url = f"/competicoes/edicoes-evento/{id_edicao_evento}/vinculos"

    r = client.post(url, headers=cab, json={"id_edicao_competicao": id_edicao})
    assert r.status_code == 200, r.text
    assert [c["id_edicao_competicao"] for c in r.json()["competicoes"]] == [id_edicao]
    edicao = client.get(f"/competicoes/edicoes/{id_edicao}", headers=cab).json()
    assert edicao["id_edicao_evento"] == id_edicao_evento

    # Repetir é idempotente.
    assert client.post(url, headers=cab, json={"id_edicao_competicao": id_edicao}).status_code == 200

    r = client.delete(f"{url}/{id_edicao}", headers=cab)
    assert r.status_code == 200, r.text
    assert r.json()["competicoes"] == []
    assert client.get(f"/competicoes/edicoes/{id_edicao}", headers=cab).json()["id_edicao_evento"] is None
    assert client.delete(f"{url}/{id_edicao}", headers=cab).status_code == 404


def test_vincular_edicao_fora_do_periodo_422(client, cab, db, evento_simples):
    id_edicao_evento = evento_simples["edicoes"][0]["id_edicao_evento"]
    id_edicao = _criar_competicao(client, cab, db, inicio="2026-06-10", fim="2026-06-20").json()[
        "edicoes"][0]["id_edicao_competicao"]
    r = client.post(f"/competicoes/edicoes-evento/{id_edicao_evento}/vinculos", headers=cab,
                    json={"id_edicao_competicao": id_edicao})
    assert r.status_code == 422
    assert r.json()["campos"] == ["id_edicao_competicao"]
    assert "01/05/2026" in r.json()["mensagem"]


def test_vincular_edicao_ja_vinculada_409(client, cab, db, evento_com_edicao_em_andamento):
    ctx = evento_com_edicao_em_andamento
    outro = _criar_evento(client, cab, "Outro Evento").json()
    r = client.post(f"/competicoes/edicoes-evento/{outro['edicoes'][0]['id_edicao_evento']}/vinculos",
                    headers=cab, json={"id_edicao_competicao": ctx["id_edicao"]})
    assert r.status_code == 409
    assert r.json()["campos"] == ["id_edicao_competicao"]
    assert "Jogos Escolares" in r.json()["mensagem"]


def test_edicao_de_competicao_informa_o_evento(client, cab, evento_com_edicao_em_andamento):
    """DF-RT15-03: o cabeçalho da competição mostra o selo do evento com link."""
    ctx = evento_com_edicao_em_andamento
    edicao = client.get(f"/competicoes/edicoes/{ctx['id_edicao']}", headers=cab).json()
    assert edicao["evento"] == {
        "id_evento": ctx["evento"]["id_evento"],
        "nome": "Jogos Escolares",
        "identificacao_edicao": "2026",
    }
