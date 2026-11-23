"""Contratos transversais das correções dos testes manuais (T0.2).

- ``numero_jogo``: numeração 1..N por edição, grupos antes do mata-mata, estável.
- Erro 422 com mensagem geral legível e ``detalhes`` por campo.
"""

from __future__ import annotations

import uuid

import pytest

from competicoes.servicos.numeracao import numerar_jogos
from models import Modalidade


def _modalidade(db) -> int:
    mod = db.query(Modalidade).first()
    if mod is None:
        mod = Modalidade(nome="Futebol Numeração")
        db.add(mod)
        db.commit()
        db.refresh(mod)
    return mod.id_modalidade


def _idem(cab: dict[str, str]) -> dict[str, str]:
    return {**cab, "Idempotency-Key": str(uuid.uuid4())}


def _partidas(client, cab, id_edicao) -> list[dict]:
    r = client.get(f"/competicoes/edicoes/{id_edicao}/partidas", headers=cab)
    assert r.status_code == 200, r.text
    return r.json()


def _fases(client, cab, id_edicao) -> dict[int, str]:
    r = client.get(f"/competicoes/edicoes/{id_edicao}/disputa", headers=cab)
    assert r.status_code == 200, r.text
    return {d["id_duelo"]: d["fase"] for d in r.json()["duelos"]}


def _resultado(client, cab, id_partida, gm, gv):
    r = client.post(
        f"/competicoes/partidas/{id_partida}/resultado-simples",
        headers=_idem(cab), json={"gols_mandante": gm, "gols_visitante": gv},
    )
    assert r.status_code == 200, r.text


def _numero_por_fase(client, cab, id_edicao) -> dict[str, list[int]]:
    fases = _fases(client, cab, id_edicao)
    resultado: dict[str, list[int]] = {}
    for p in _partidas(client, cab, id_edicao):
        fase = "GRUPOS" if p["id_duelo"] is None else fases[p["id_duelo"]]
        resultado.setdefault(fase, []).append(p["numero_jogo"])
    return {fase: sorted(nums) for fase, nums in resultado.items()}


def _mapa_numero_por_id(client, cab, id_edicao) -> dict[int, int]:
    return {p["id_partida"]: p["numero_jogo"] for p in _partidas(client, cab, id_edicao)}


@pytest.fixture()
def edicao_grupos_mata_mata_concluida(client, cabecalhos_por_papel, db):
    """2 grupos de 2, 2 classificados por grupo, final única e disputa de 3º lugar."""
    cab = cabecalhos_por_papel("coordenador")
    r = client.post("/competicoes/competicoes", headers=cab, json={
        "nome": "Copa Numeração",
        "id_modalidade": _modalidade(db),
        "edicao": {
            "identificacao": "2026",
            "data_inicio": "2026-07-01",
            "data_fim": "2026-07-31",
            "formato": "GRUPOS_MATA_MATA",
            "configuracao": {
                "formato": "GRUPOS_MATA_MATA",
                "quantidade_grupos": 2,
                "classificados_por_grupo": 2,
                "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                "desempates": ["SALDO_GOLS", "VITORIAS"],
                "turno_e_returno_grupos": False,
                "ida_volta_eliminatoria": False,
                "final_unica": True,
                "terceiro_lugar": True,
            },
        },
    })
    assert r.status_code == 201, r.text
    id_edicao = r.json()["edicoes"][0]["id_edicao_competicao"]
    for i in range(1, 5):
        r = client.post(f"/competicoes/edicoes/{id_edicao}/equipes", headers=cab,
                        json={"nome": f"Time N{i}", "sigla": f"TN{i}"})
        assert r.status_code == 201, r.text
        id_equipe = r.json()["id_equipe"]
        r = client.post("/competicoes/competidores", headers=cab, json={"nome": f"Jogador N{i}"})
        assert r.status_code == 201, r.text
        r = client.post(f"/competicoes/equipes/{id_equipe}/integrantes", headers=cab, json={
            "id_competidor": r.json()["id_competidor"], "nome_esportivo": f"Atleta N{i}",
        })
        assert r.status_code == 201, r.text

    r = client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=cab, json={})
    assert r.status_code == 201, r.text
    for p in _partidas(client, cab, id_edicao):
        _resultado(client, cab, p["id_partida"], 2, 1)
    r = client.post(f"/competicoes/edicoes/{id_edicao}/encerrar-grupos", headers=cab)
    assert r.status_code == 200, r.text

    # Semifinais, depois final e 3º lugar (criadas quando as semifinais terminam).
    for _ in range(3):
        pendentes = [p for p in _partidas(client, cab, id_edicao) if p["estado"] != "FINALIZADA"]
        if not pendentes:
            break
        for p in pendentes:
            _resultado(client, cab, p["id_partida"], 1, 0)
    assert all(p["estado"] == "FINALIZADA" for p in _partidas(client, cab, id_edicao))
    return id_edicao


def test_numero_jogo_sequencial_grupos_e_mata_mata(
    client, cabecalhos_por_papel, edicao_grupos_mata_mata_concluida
):
    cab = cabecalhos_por_papel("professor")
    id_edicao = edicao_grupos_mata_mata_concluida
    partidas = _partidas(client, cab, id_edicao)
    numeros = [p["numero_jogo"] for p in partidas]
    assert numeros == list(range(1, len(partidas) + 1))  # lista já vem na ordem do número
    assert _numero_por_fase(client, cab, id_edicao) == {
        "GRUPOS": [1, 2], "SEMIFINAL": [3, 4], "TERCEIRO_LUGAR": [5], "FINAL": [6],
    }


def test_numero_jogo_estavel_apos_reabrir(
    client, cabecalhos_por_papel, edicao_grupos_mata_mata_concluida
):
    cab = cabecalhos_por_papel("coordenador")
    id_edicao = edicao_grupos_mata_mata_concluida
    antes = _mapa_numero_por_id(client, cab, id_edicao)
    fases = _fases(client, cab, id_edicao)
    final = next(
        p for p in _partidas(client, cab, id_edicao)
        if p["id_duelo"] is not None and fases[p["id_duelo"]] == "FINAL"
    )

    r = client.post(f"/competicoes/partidas/{final['id_partida']}/reabrir", headers=cab,
                    json={"motivo": "Correção do placar"})
    assert r.status_code == 200, r.text
    assert r.json()["numero_jogo"] == antes[final["id_partida"]]
    assert _mapa_numero_por_id(client, cab, id_edicao) == antes

    _resultado(client, cab, final["id_partida"], 3, 0)
    assert _mapa_numero_por_id(client, cab, id_edicao) == antes


def test_numero_jogo_no_portal_publico(
    client, cabecalhos_por_papel, edicao_grupos_mata_mata_concluida, db, usuario
):
    from competicoes.servicos.organizacao import publicar_edicao

    cab = cabecalhos_por_papel("coordenador")
    id_edicao = edicao_grupos_mata_mata_concluida
    publicar_edicao(db, id_edicao, True, usuario)
    r = client.get(f"/competicoes/publico/edicoes/{id_edicao}/partidas")
    assert r.status_code == 200, r.text
    publicos = {p["id_partida"]: p["numero_jogo"] for p in r.json()}
    assert publicos == _mapa_numero_por_id(client, cab, id_edicao)
    assert [p["numero_jogo"] for p in r.json()] == sorted(publicos.values())


def test_numerar_jogos_ordem_das_fases():
    class P:  # partida mínima
        def __init__(self, id_partida, id_duelo=None, rodada=None, id_grupo=None, ordem_jogo=1):
            self.id_partida, self.id_duelo = id_partida, id_duelo
            self.rodada, self.id_grupo, self.ordem_jogo = rodada, id_grupo, ordem_jogo

    partidas = [
        P(10, id_duelo=4), P(11, id_duelo=3), P(12, id_duelo=2), P(13, id_duelo=1),
        P(20, rodada=2, id_grupo=1), P(21, rodada=1, id_grupo=2), P(22, rodada=1, id_grupo=1),
    ]
    duelos = {1: ("QUARTAS", 2), 2: ("QUARTAS", 1), 3: ("TERCEIRO_LUGAR", 1), 4: ("FINAL", 1)}
    assert numerar_jogos(partidas, duelos) == {
        22: 1, 21: 2, 20: 3, 12: 4, 13: 5, 11: 6, 10: 7,
    }


def test_validacao_422_traz_detalhes_legiveis(client, cabecalhos_por_papel):
    r = client.post("/competicoes/eventos", headers=cabecalhos_por_papel("coordenador"), json={
        "nome": "",
        "edicao": {"identificacao": "2026", "data_inicio": "2026-12-31", "data_fim": "2026-11-01"},
    })
    corpo = r.json()
    assert r.status_code == 422
    assert corpo["mensagem"] == "Dados inválidos. Verifique os campos destacados."
    detalhes = {d["campo"]: d["mensagem"] for d in corpo["detalhes"]}
    assert set(detalhes) >= {"nome", "edicao.data_fim"}
    assert detalhes["nome"] == "Texto muito curto."
    assert detalhes["edicao.data_fim"] == (
        "A data de término deve ser igual ou posterior à data de início."
    )
    assert all(d["mensagem"] for d in corpo["detalhes"])


def test_detail_com_codigo_fora_de_competicoes_vai_na_raiz():
    """Contrato pedido pela T7: HTTPException com detail dict contendo ``codigo``."""
    from fastapi import FastAPI, HTTPException
    from fastapi.testclient import TestClient

    from competicoes.erros import registrar_tratadores

    app = FastAPI()
    registrar_tratadores(app)

    @app.get("/alunos")
    def fora():
        raise HTTPException(403, detail={"detail": "Troque a senha.", "codigo": "SENHA_TROCA_OBRIGATORIA"})

    @app.get("/competicoes/x")
    def dentro():
        raise HTTPException(403, detail={"detail": "Troque a senha.", "codigo": "SENHA_TROCA_OBRIGATORIA"})

    c = TestClient(app)
    assert c.get("/alunos").json() == {"detail": "Troque a senha.", "codigo": "SENHA_TROCA_OBRIGATORIA"}
    corpo = c.get("/competicoes/x").json()
    assert corpo["codigo"] == "SENHA_TROCA_OBRIGATORIA"
    assert corpo["mensagem"] == "Troque a senha."


def test_partidas_trazem_sigla_das_equipes(
    client, cabecalhos_por_papel, edicao_grupos_mata_mata_concluida, db, usuario
):
    """DF-RT12-06: o escudo mostra a sigla cadastrada (admin e portal)."""
    from competicoes.servicos.organizacao import publicar_edicao

    id_edicao = edicao_grupos_mata_mata_concluida
    siglas = {f"TN{i}" for i in range(1, 5)}
    admin = _partidas(client, cabecalhos_por_papel("professor"), id_edicao)
    assert {p["sigla_mandante"] for p in admin} | {p["sigla_visitante"] for p in admin} == siglas
    publicar_edicao(db, id_edicao, True, usuario)
    publico = client.get(f"/competicoes/publico/edicoes/{id_edicao}/partidas").json()
    assert {p["sigla_mandante"] for p in publico} <= siglas
