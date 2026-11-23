"""Correções do chaveamento (T3): DF-RT12-03, DF-RT16-01, DF-RT16-06."""

from __future__ import annotations

import re
import uuid

import pytest

from models import Modalidade


def _modalidade(db) -> int:
    mod = db.query(Modalidade).first()
    if mod is None:
        mod = Modalidade(nome="Futebol Chave")
        db.add(mod)
        db.commit()
        db.refresh(mod)
    return mod.id_modalidade


def _resultado(client, cab, id_partida, gm, gv, pm=None, pv=None):
    corpo = {"gols_mandante": gm, "gols_visitante": gv}
    if pm is not None:
        corpo |= {"penaltis_mandante": pm, "penaltis_visitante": pv}
    r = client.post(f"/competicoes/partidas/{id_partida}/resultado-simples",
                    headers={**cab, "Idempotency-Key": str(uuid.uuid4())}, json=corpo)
    assert r.status_code == 200, r.text


@pytest.fixture()
def cab(cabecalhos_por_papel):
    return cabecalhos_por_papel("coordenador")


@pytest.fixture()
def edicao_com_semifinais(client, cab, db, usuario):
    """2 grupos de 2, 2 classificados, 3º lugar; grupos encerrados e publicada."""
    r = client.post("/competicoes/competicoes", headers=cab, json={
        "nome": "Copa Chave",
        "id_modalidade": _modalidade(db),
        "edicao": {
            "identificacao": "2026", "data_inicio": "2026-07-01", "data_fim": "2026-07-31",
            "formato": "GRUPOS_MATA_MATA",
            "configuracao": {
                "formato": "GRUPOS_MATA_MATA", "quantidade_grupos": 2, "classificados_por_grupo": 2,
                "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                "desempates": ["SALDO_GOLS", "VITORIAS"], "turno_e_returno_grupos": False,
                "ida_volta_eliminatoria": False, "final_unica": True, "terceiro_lugar": True,
            },
        },
    })
    assert r.status_code == 201, r.text
    id_edicao = r.json()["edicoes"][0]["id_edicao_competicao"]
    for i in range(1, 5):
        r = client.post(f"/competicoes/edicoes/{id_edicao}/equipes", headers=cab, json={"nome": f"Time {i}"})
        id_equipe = r.json()["id_equipe"]
        r = client.post("/competicoes/competidores", headers=cab, json={"nome": f"Jogador {i}"})
        client.post(f"/competicoes/equipes/{id_equipe}/integrantes", headers=cab, json={
            "id_competidor": r.json()["id_competidor"], "nome_esportivo": f"Jogador {i}",
        })
    assert client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=cab, json={}).status_code == 201
    for p in client.get(f"/competicoes/edicoes/{id_edicao}/partidas", headers=cab).json():
        _resultado(client, cab, p["id_partida"], 2, 1)
    assert client.post(f"/competicoes/edicoes/{id_edicao}/encerrar-grupos", headers=cab).status_code == 200

    from competicoes.servicos.organizacao import publicar_edicao

    publicar_edicao(db, id_edicao, True, usuario)
    return id_edicao


def _disputa(client, cab, id_edicao):
    r = client.get(f"/competicoes/edicoes/{id_edicao}/disputa", headers=cab)
    assert r.status_code == 200, r.text
    return r.json()


def _publico(client, id_edicao):
    r = client.get(f"/competicoes/publico/edicoes/{id_edicao}/chaveamento")
    assert r.status_code == 200, r.text
    return r.json()


def _semifinal(client, cab, id_edicao, posicao):
    disputa = _disputa(client, cab, id_edicao)
    duelo = next(d for d in disputa["duelos"] if d["fase"] == "SEMIFINAL" and d["posicao_chave"] == posicao)
    partida = next(p for p in disputa["partidas"] if p["id_duelo"] == duelo["id_duelo"])
    return duelo, partida


def test_vaga_posicao_grupo_tem_letra(client, cab, edicao_com_semifinais):
    disputa = _disputa(client, cab, edicao_com_semifinais)
    vagas = [v for d in disputa["duelos"] for v in d["vagas"] if v["origem"] == "POSICAO_GRUPO"]
    assert vagas
    assert {v["nome_grupo"] for v in vagas} == {"Grupo A", "Grupo B"}
    assert {v["descricao_origem"] for v in vagas} == {
        "1º do Grupo A", "2º do Grupo A", "1º do Grupo B", "2º do Grupo B",
    }
    publicas = [v for d in _publico(client, edicao_com_semifinais)["duelos"] for v in d["vagas"]
                if v["origem"] == "POSICAO_GRUPO"]
    assert {v["nome_grupo"] for v in publicas} == {"Grupo A", "Grupo B"}


def test_duelo_traz_placar_e_penaltis(client, cab, edicao_com_semifinais):
    id_edicao = edicao_com_semifinais
    duelo, partida = _semifinal(client, cab, id_edicao, 1)
    assert duelo["placar"] is None  # jogo ainda não começou

    _resultado(client, cab, partida["id_partida"], 1, 1, 4, 3)
    duelo, _ = _semifinal(client, cab, id_edicao, 1)
    # A ordem do placar segue a ordem das vagas.
    vagas = sorted(duelo["vagas"], key=lambda v: v["posicao"])
    mandante_primeiro = (vagas[0]["id_equipe_resolvida"] or vagas[0]["id_equipe"]) == partida["id_equipe_mandante"]
    esperado = {"gols": [1, 1], "penaltis": [4, 3] if mandante_primeiro else [3, 4]}
    assert duelo["placar"] == esperado

    publico = next(d for d in _publico(client, id_edicao)["duelos"] if d["id_duelo"] == duelo["id_duelo"])
    assert publico["placar"] == esperado


def test_descricao_origem_sem_enum(client, cab, edicao_com_semifinais):
    id_edicao = edicao_com_semifinais
    for posicao in (1, 2):
        _, partida = _semifinal(client, cab, id_edicao, posicao)
        _resultado(client, cab, partida["id_partida"], 2, 0)

    descricoes = [v["descricao_origem"] for d in _disputa(client, cab, id_edicao)["duelos"] for v in d["vagas"]]
    publicas = [v["descricao_origem"] for d in _publico(client, id_edicao)["duelos"] for v in d["vagas"]]
    for texto in descricoes + publicas:
        assert texto and not re.search(r"[A-Z]{4,}|_", texto), texto
    assert {"Vencedor da Semifinal 1", "Vencedor da Semifinal 2",
            "Perdedor da Semifinal 1", "Perdedor da Semifinal 2"} <= set(publicas)


def test_rotulos_de_fase():
    from competicoes.servicos.chave import rotulo_fase

    assert rotulo_fase("QUARTAS") == "Quartas de final"
    assert rotulo_fase("TERCEIRO_LUGAR") == "Disputa de 3º lugar"
    assert rotulo_fase("FASE_6") == "Fase de 6"
