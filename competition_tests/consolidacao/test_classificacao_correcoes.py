"""Correções de classificação, decisões e artilharia (T4).

DF-RT12-11, DF-RT13-04, DF-RT13-06, DF-RT14-04, DF-RT12-13 e PD-RT13-01.
"""

from __future__ import annotations

import uuid

import pytest

from models import Modalidade


@pytest.fixture()
def cab(cabecalhos_por_papel):
    return cabecalhos_por_papel("coordenador")


def _idem(cab):
    return {**cab, "Idempotency-Key": str(uuid.uuid4())}


@pytest.fixture()
def edicao(client, cab, db):
    """Pontos corridos com 3 equipes (3 jogos), iniciada; nenhum jogo disputado."""
    mod = db.query(Modalidade).first()
    if mod is None:
        mod = Modalidade(nome="Futebol Classificação")
        db.add(mod)
        db.commit()
    r = client.post("/competicoes/competicoes", headers=cab, json={
        "nome": "Copa Classificação", "id_modalidade": mod.id_modalidade,
        "edicao": {
            "identificacao": "2026", "data_inicio": "2026-09-01", "data_fim": "2026-09-30",
            "formato": "PONTOS_CORRIDOS",
            "configuracao": {
                "formato": "PONTOS_CORRIDOS", "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                "desempates": ["SALDO_GOLS"], "turno_e_returno": False,
            },
        },
    })
    assert r.status_code == 201, r.text
    id_edicao = r.json()["edicoes"][0]["id_edicao_competicao"]
    equipes, atletas = [], []
    for nome in ("Leões", "Tigres", "Águias"):
        r = client.post(f"/competicoes/edicoes/{id_edicao}/equipes", headers=cab, json={"nome": nome})
        equipes.append(r.json()["id_equipe"])
        r = client.post("/competicoes/competidores", headers=cab, json={"nome": f"Atleta {nome}"})
        r = client.post(f"/competicoes/equipes/{equipes[-1]}/integrantes", headers=cab, json={
            "id_competidor": r.json()["id_competidor"], "nome_esportivo": f"Atleta {nome}",
        })
        atletas.append(r.json()["id_integrante"])
    assert client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=cab, json={}).status_code == 201
    assert client.post(f"/competicoes/edicoes/{id_edicao}/iniciar", headers=cab).status_code == 200
    partidas = client.get(f"/competicoes/edicoes/{id_edicao}/partidas", headers=cab).json()
    return {"id_edicao": id_edicao, "equipes": equipes, "atletas": atletas, "partidas": partidas}


def _jogo(edicao, a, b):
    ea, eb = edicao["equipes"][a], edicao["equipes"][b]
    return next(p for p in edicao["partidas"] if {p["id_equipe_mandante"], p["id_equipe_visitante"]} == {ea, eb})


def _placar(client, cab, partida, gols_por_equipe: dict[int, int]):
    r = client.post(f"/competicoes/partidas/{partida['id_partida']}/resultado-simples", headers=_idem(cab), json={
        "gols_mandante": gols_por_equipe[partida["id_equipe_mandante"]],
        "gols_visitante": gols_por_equipe[partida["id_equipe_visitante"]],
    })
    assert r.status_code == 200, r.text


def _classificacao(client, cab, id_edicao):
    r = client.get(f"/competicoes/edicoes/{id_edicao}/classificacao", headers=cab)
    assert r.status_code == 200, r.text
    return r.json()


def _empate_triplo(client, cab, edicao):
    """Cada equipe vence uma vez por 1×0: as três empatam em tudo."""
    l, t, a = edicao["equipes"]
    _placar(client, cab, _jogo(edicao, 0, 1), {l: 1, t: 0})
    _placar(client, cab, _jogo(edicao, 1, 2), {t: 1, a: 0})
    _placar(client, cab, _jogo(edicao, 0, 2), {a: 1, l: 0})


def _decidir(client, cab, edicao):
    r = client.post(f"/competicoes/edicoes/{edicao['id_edicao']}/decisoes-classificacao", headers=cab, json={
        "conjunto_equipes": edicao["equipes"], "ordem_escolhida": edicao["equipes"], "motivo": "Sorteio público",
    })
    assert r.status_code in (200, 201), r.text
    return r.json()


def test_sem_jogos_nao_sinaliza_empate(client, cab, edicao):
    tabela = _classificacao(client, cab, edicao["id_edicao"])
    assert tabela["possui_empate_persistente"] is False
    assert all(not l["empate_persistente"] for l in tabela["linhas"])


def test_decisao_traz_responsavel(client, cab, edicao):
    _empate_triplo(client, cab, edicao)
    decisao = _decidir(client, cab, edicao)
    assert decisao["responsavel_nome"] == "teste-coordenador"
    assert decisao["criado_em"]
    lista = client.get(f"/competicoes/edicoes/{edicao['id_edicao']}/decisoes-classificacao", headers=cab).json()
    assert lista[0]["responsavel_nome"] == "teste-coordenador"


def test_decisao_invalidada_nao_revalida_ao_voltar_resultado(client, cab, edicao):
    l, t, _ = edicao["equipes"]
    _empate_triplo(client, cab, edicao)
    _decidir(client, cab, edicao)
    assert _classificacao(client, cab, edicao["id_edicao"])["possui_empate_persistente"] is False

    jogo = _jogo(edicao, 0, 1)
    for gols in ({l: 2, t: 0}, {l: 1, t: 0}):  # muda o resultado e depois volta ao original
        r = client.post(f"/competicoes/partidas/{jogo['id_partida']}/reabrir", headers=cab,
                        json={"motivo": "Correção de súmula"})
        assert r.status_code == 200, r.text
        _placar(client, cab, jogo, gols)

    decisoes = client.get(f"/competicoes/edicoes/{edicao['id_edicao']}/decisoes-classificacao", headers=cab).json()
    assert [d["valida"] for d in decisoes] == [False]
    assert _classificacao(client, cab, edicao["id_edicao"])["possui_empate_persistente"] is True
    # Uma decisão nova volta a resolver.
    assert _decidir(client, cab, edicao)["valida"] is True
    assert _classificacao(client, cab, edicao["id_edicao"])["possui_empate_persistente"] is False


def test_bloqueio_cita_a_posicao_em_disputa(client, cab, edicao):
    _empate_triplo(client, cab, edicao)
    r = client.post(f"/competicoes/edicoes/{edicao['id_edicao']}/finalizar", headers=cab)
    assert r.status_code == 409
    assert r.json()["mensagem"] == (
        "Há empate não resolvido pelo título (Leões, Tigres e Águias). Registre a decisão antes de finalizar."
    )


def test_bloqueio_pela_segunda_posicao(client, cab, edicao):
    l, t, a = edicao["equipes"]
    _placar(client, cab, _jogo(edicao, 0, 1), {l: 1, t: 0})
    _placar(client, cab, _jogo(edicao, 0, 2), {l: 1, a: 0})
    _placar(client, cab, _jogo(edicao, 1, 2), {t: 1, a: 1})
    r = client.post(f"/competicoes/edicoes/{edicao['id_edicao']}/finalizar", headers=cab)
    assert r.status_code == 409
    assert r.json()["mensagem"] == (
        "Há empate não resolvido pela 2ª posição (Tigres e Águias). Registre a decisão antes de finalizar."
    )


def test_artilharia_empate_mesma_posicao(client, cab, edicao):
    l, t, a = edicao["equipes"]
    al, at, aa = edicao["atletas"]
    for (x, y), gols in (((0, 1), {l: 1, t: 1}), ((0, 2), {l: 2, a: 0})):
        jogo = _jogo(edicao, x, y)
        id_p = jogo["id_partida"]
        assert client.post(f"/competicoes/partidas/{id_p}/iniciar", headers=cab).status_code == 200
        for id_equipe, quantidade in gols.items():
            autor = {l: al, t: at, a: aa}[id_equipe]
            for _ in range(quantidade):
                r = client.post(f"/competicoes/partidas/{id_p}/ocorrencias", headers=cab, json={
                    "tipo": "GOL", "id_equipe": id_equipe, "id_integrante": autor, "minuto": 5,
                })
                assert r.status_code == 201, r.text
        assert client.post(f"/competicoes/partidas/{id_p}/finalizar", headers=cab, json={}).status_code == 200
    # Leões: 3 gols; Tigres: 1 gol. Mais um atleta de Águias com 1 gol empata com Tigres.
    jogo = _jogo(edicao, 1, 2)
    assert client.post(f"/competicoes/partidas/{jogo['id_partida']}/iniciar", headers=cab).status_code == 200
    client.post(f"/competicoes/partidas/{jogo['id_partida']}/ocorrencias", headers=cab, json={
        "tipo": "GOL", "id_equipe": a, "id_integrante": aa, "minuto": 5,
    })
    assert client.post(f"/competicoes/partidas/{jogo['id_partida']}/finalizar", headers=cab, json={}).status_code == 200

    r = client.get(f"/competicoes/edicoes/{edicao['id_edicao']}/artilharia", headers=cab)
    assert r.status_code == 200, r.text
    linhas = [(x["nome_esportivo"], x["gols"], x["posicao"]) for x in r.json()["artilheiros"]]
    assert linhas == [("Atleta Leões", 3, 1), ("Atleta Tigres", 1, 2), ("Atleta Águias", 1, 2)]
