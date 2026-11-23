"""Correções de súmula e disciplina (T5): DF-RT14-02/05/06/07 e PD-RT14-01."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from competicoes.modelos import AuditoriaCompeticao, SuspensaoCompeticao
from models import Modalidade


def _modalidade(db) -> int:
    mod = db.query(Modalidade).first()
    if mod is None:
        mod = Modalidade(nome="Futebol Disciplina")
        db.add(mod)
        db.commit()
        db.refresh(mod)
    return mod.id_modalidade


@pytest.fixture()
def cab(cabecalhos_por_papel):
    return cabecalhos_por_papel("coordenador")


def _idem(cab):
    return {**cab, "Idempotency-Key": str(uuid.uuid4())}


def _partidas(client, cab, id_edicao):
    return client.get(f"/competicoes/edicoes/{id_edicao}/partidas", headers=cab).json()


def _resultado(client, cab, id_partida, gm=1, gv=0):
    r = client.post(f"/competicoes/partidas/{id_partida}/resultado-simples", headers=_idem(cab),
                    json={"gols_mandante": gm, "gols_visitante": gv})
    assert r.status_code == 200, r.text


def _ocorrencia(client, cab, id_partida, tipo, id_equipe, id_integrante):
    r = client.post(f"/competicoes/partidas/{id_partida}/ocorrencias", headers=cab, json={
        "tipo": tipo, "id_equipe": id_equipe, "id_integrante": id_integrante, "minuto": 10,
    })
    assert r.status_code == 201, r.text
    return next(o for o in reversed(r.json()["ocorrencias"]) if o["tipo"] == tipo)["id_ocorrencia"]


@pytest.fixture()
def edicao(client, cab, db):
    """Pontos corridos com returno (6 jogos por equipe), em andamento.

    O atleta suspenso é do Time 1 e recebe vermelho direto no 1º jogo do Time 1.
    """
    r = client.post("/competicoes/competicoes", headers=cab, json={
        "nome": "Copa Disciplina", "id_modalidade": _modalidade(db),
        "edicao": {
            "identificacao": "2026", "data_inicio": "2026-08-01", "data_fim": "2026-08-31",
            "formato": "PONTOS_CORRIDOS",
            "configuracao": {
                "formato": "PONTOS_CORRIDOS", "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                "desempates": ["SALDO_GOLS"], "turno_e_returno": True,
            },
        },
    })
    assert r.status_code == 201, r.text
    id_edicao = r.json()["edicoes"][0]["id_edicao_competicao"]
    equipes, atletas = [], []
    for i in range(1, 5):
        r = client.post(f"/competicoes/edicoes/{id_edicao}/equipes", headers=cab, json={"nome": f"Time {i}"})
        id_equipe = r.json()["id_equipe"]
        equipes.append(id_equipe)
        r = client.post("/competicoes/competidores", headers=cab, json={"nome": f"Atleta {i}"})
        r = client.post(f"/competicoes/equipes/{id_equipe}/integrantes", headers=cab, json={
            "id_competidor": r.json()["id_competidor"], "nome_esportivo": f"Atleta {i}",
        })
        atletas.append(r.json()["id_integrante"])
    assert client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=cab, json={}).status_code == 201
    assert client.post(f"/competicoes/edicoes/{id_edicao}/iniciar", headers=cab).status_code == 200

    time1 = [p for p in _partidas(client, cab, id_edicao) if equipes[0] in (p["id_equipe_mandante"], p["id_equipe_visitante"])]
    origem = time1[0]["id_partida"]
    assert client.post(f"/competicoes/partidas/{origem}/iniciar", headers=cab).status_code == 200
    id_vermelho = _ocorrencia(client, cab, origem, "CARTAO_VERMELHO_DIRETO", equipes[0], atletas[0])
    assert client.post(f"/competicoes/partidas/{origem}/finalizar", headers=cab, json={}).status_code == 200
    return {"id_edicao": id_edicao, "equipes": equipes, "atletas": atletas, "origem": origem,
            "id_vermelho": id_vermelho, "jogos_time1": [p["id_partida"] for p in time1]}


def _suspensoes_do_atleta(db, id_integrante):
    db.expire_all()
    return db.execute(
        select(SuspensaoCompeticao).where(SuspensaoCompeticao.id_integrante == id_integrante)
    ).scalars().all()


def _reabrir(client, cab, id_partida):
    r = client.post(f"/competicoes/partidas/{id_partida}/reabrir", headers=cab, json={"motivo": "Correção"})
    assert r.status_code == 200, r.text


# --------------------------------------------------------------------------- remover ocorrência


def test_remover_ocorrencia_de_partida_reaberta_exige_motivo(client, cab, db, edicao):
    _reabrir(client, cab, edicao["origem"])
    url = f"/competicoes/ocorrencias/{edicao['id_vermelho']}"
    r = client.request("DELETE", url, headers=cab, json={})
    assert r.status_code == 422
    assert r.json()["campos"] == ["motivo"]
    r = client.request("DELETE", url, headers=cab, json={"motivo": "ok"})
    assert r.status_code == 422  # menos de 3 caracteres

    r = client.request("DELETE", url, headers=cab, json={"motivo": "Cartão lançado no atleta errado"})
    assert r.status_code == 200, r.text
    auditoria = db.execute(
        select(AuditoriaCompeticao).where(AuditoriaCompeticao.acao == "REMOVER_OCORRENCIA")
    ).scalars().one()
    assert auditoria.motivo == "Cartão lançado no atleta errado"


def test_remover_ocorrencia_em_partida_nunca_finalizada_sem_motivo_ok(client, cab, edicao):
    id_partida = edicao["jogos_time1"][1]
    assert client.post(f"/competicoes/partidas/{id_partida}/iniciar", headers=cab).status_code == 200
    id_oc = _ocorrencia(client, cab, id_partida, "CARTAO_AMARELO", edicao["equipes"][0], edicao["atletas"][0])
    r = client.delete(f"/competicoes/ocorrencias/{id_oc}", headers=cab)
    assert r.status_code == 200, r.text


# --------------------------------------------------------------------------- reprocessamento


def test_reprocessar_nao_cria_copia_cancelada(client, cab, db, edicao):
    [antes] = _suspensoes_do_atleta(db, edicao["atletas"][0])
    for _ in range(2):
        _reabrir(client, cab, edicao["origem"])
        r = client.post(f"/competicoes/partidas/{edicao['origem']}/finalizar", headers=cab, json={})
        assert r.status_code == 200, r.text
    [depois] = _suspensoes_do_atleta(db, edicao["atletas"][0])
    assert (depois.id_suspensao, depois.situacao) == (antes.id_suspensao, "ATIVA")


def test_suspensao_cancelada_quando_o_cartao_e_removido(client, cab, db, edicao):
    _reabrir(client, cab, edicao["origem"])
    r = client.request("DELETE", f"/competicoes/ocorrencias/{edicao['id_vermelho']}", headers=cab,
                       json={"motivo": "Cartão anulado"})
    assert r.status_code == 200, r.text
    [suspensao] = _suspensoes_do_atleta(db, edicao["atletas"][0])
    assert suspensao.situacao == "CANCELADA"


# --------------------------------------------------------------------------- responsável e histórico


def test_suspensao_traz_responsavel_e_historico(client, cab, edicao):
    id_edicao = edicao["id_edicao"]
    r = client.post(f"/competicoes/edicoes/{id_edicao}/suspensoes", headers=cab, json={
        "id_integrante": edicao["atletas"][1], "jogos": 1, "motivo": "Agressão verbal",
    })
    assert r.status_code == 201, r.text
    id_suspensao = r.json()["id_suspensao"]
    assert r.json()["responsavel_nome"] == "teste-coordenador"

    r = client.put(f"/competicoes/suspensoes/{id_suspensao}", headers=cab,
                   json={"jogos": 2, "motivo": "Recurso negado"})
    assert r.status_code == 200, r.text
    historico = r.json()["historico"]
    assert [h["acao"] for h in historico] == ["Criada manualmente", "Ajuste"]
    assert historico[1]["justificativa"] == "Recurso negado"
    assert historico[1]["responsavel_nome"] == "teste-coordenador"
    assert all(h["em"] for h in historico)

    painel = client.get(f"/competicoes/edicoes/{id_edicao}/disciplinar", headers=cab).json()
    automatica = next(s for s in painel["suspensoes"] if s["id_integrante"] == edicao["atletas"][0])
    assert automatica["historico"][0]["acao"] == "Gerada pela súmula"


def test_cumprimento_traz_responsavel(client, cab, edicao):
    jogo = edicao["jogos_time1"][1]
    _resultado(client, cab, jogo)
    painel = client.get(f"/competicoes/edicoes/{edicao['id_edicao']}/disciplinar", headers=cab).json()
    suspensao = next(s for s in painel["suspensoes"] if s["id_integrante"] == edicao["atletas"][0])
    r = client.post(f"/competicoes/suspensoes/{suspensao['id_suspensao']}/cumprimentos", headers=cab,
                    json={"id_partida": jogo})
    assert r.status_code in (200, 201), r.text
    assert r.json()["cumprimentos"][0]["responsavel_nome"] == "teste-coordenador"
    assert r.json()["situacao"] == "CUMPRIDA"
    assert "Cumprimento registrado" in [h["acao"] for h in r.json()["historico"]]
    assert all("partida" not in (h["justificativa"] or "") for h in r.json()["historico"])


def test_cumprida_sem_cumprimento_422(client, cab, edicao):
    painel = client.get(f"/competicoes/edicoes/{edicao['id_edicao']}/disciplinar", headers=cab).json()
    suspensao = painel["suspensoes"][0]
    r = client.put(f"/competicoes/suspensoes/{suspensao['id_suspensao']}", headers=cab,
                   json={"situacao": "CUMPRIDA", "motivo": "Encerrar"})
    assert r.status_code == 422
    assert r.json()["campos"] == ["situacao"]
    assert r.json()["mensagem"] == "Para marcar como cumprida, registre os cumprimentos nas partidas."
    # Encerramento administrativo continua possível como "Cancelada" com justificativa.
    r = client.put(f"/competicoes/suspensoes/{suspensao['id_suspensao']}", headers=cab,
                   json={"situacao": "CANCELADA", "motivo": "Anistia da organização"})
    assert r.status_code == 200, r.text


# --------------------------------------------------------------------------- partidas elegíveis


def test_partidas_elegiveis_filtra_origem_outra_equipe_agendada_e_jogada(client, cab, edicao):
    id_edicao, equipes, atletas = edicao["id_edicao"], edicao["equipes"], edicao["atletas"]
    _, elegivel, jogou, agendada, *_ = edicao["jogos_time1"]
    _resultado(client, cab, elegivel)
    # O suspenso entrou em campo (marcou gol): esse jogo não serve para cumprimento.
    assert client.post(f"/competicoes/partidas/{jogou}/iniciar", headers=cab).status_code == 200
    _ocorrencia(client, cab, jogou, "GOL", equipes[0], atletas[0])
    assert client.post(f"/competicoes/partidas/{jogou}/finalizar", headers=cab, json={}).status_code == 200
    # Jogo finalizado de outras equipes.
    outra = next(p for p in _partidas(client, cab, id_edicao)
                 if equipes[0] not in (p["id_equipe_mandante"], p["id_equipe_visitante"]))
    _resultado(client, cab, outra["id_partida"])

    painel = client.get(f"/competicoes/edicoes/{id_edicao}/disciplinar", headers=cab).json()
    suspensao = next(s for s in painel["suspensoes"] if s["id_integrante"] == atletas[0])
    r = client.get(f"/competicoes/suspensoes/{suspensao['id_suspensao']}/partidas-elegiveis", headers=cab)
    assert r.status_code == 200, r.text
    assert [p["id_partida"] for p in r.json()] == [elegivel]
    [item] = r.json()
    numero = next(p["numero_jogo"] for p in _partidas(client, cab, id_edicao) if p["id_partida"] == elegivel)
    assert item["numero_jogo"] == numero
    assert item["rotulo"].startswith(f"Jogo {numero} · Rodada ")
    assert " × " in item["rotulo"] and "#" not in item["rotulo"]
    assert agendada not in [p["id_partida"] for p in r.json()]


def test_partidas_elegiveis_suspensao_inexistente_404(client, cab):
    assert client.get("/competicoes/suspensoes/999999/partidas-elegiveis", headers=cab).status_code == 404


def _edicao_limite_2_amarelos(client, cab, db):
    """Pontos corridos com returno, limite de 2 amarelos; Time 1 tem um atleta."""
    r = client.post("/competicoes/competicoes", headers=cab, json={
        "nome": "Copa Acúmulo", "id_modalidade": _modalidade(db),
        "edicao": {
            "identificacao": "2026", "data_inicio": "2026-08-01", "data_fim": "2026-08-31",
            "formato": "PONTOS_CORRIDOS",
            "configuracao": {
                "formato": "PONTOS_CORRIDOS", "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                "desempates": ["SALDO_GOLS"], "turno_e_returno": True,
                "disciplina": {"limite_amarelos": 2, "jogos_por_acumulo": 1, "jogos_por_vermelho": 1,
                               "jogos_por_segundo_amarelo": 1, "zerar_amarelos_ao_encerrar_grupos": False},
            },
        },
    })
    assert r.status_code == 201, r.text
    id_edicao = r.json()["edicoes"][0]["id_edicao_competicao"]
    equipes, atletas = [], []
    for i in (1, 2):
        r = client.post(f"/competicoes/edicoes/{id_edicao}/equipes", headers=cab, json={"nome": f"Time {i}"})
        equipes.append(r.json()["id_equipe"])
        r = client.post("/competicoes/competidores", headers=cab, json={"nome": f"Atleta Acúmulo {i}"})
        r = client.post(f"/competicoes/equipes/{equipes[-1]}/integrantes", headers=cab, json={
            "id_competidor": r.json()["id_competidor"], "nome_esportivo": f"Atleta {i}",
        })
        atletas.append(r.json()["id_integrante"])
    assert client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=cab, json={}).status_code == 201
    assert client.post(f"/competicoes/edicoes/{id_edicao}/iniciar", headers=cab).status_code == 200
    jogos = [p["id_partida"] for p in _partidas(client, cab, id_edicao)]
    return equipes, atletas, jogos


def test_acumulo_cancelado_quando_amarelo_anterior_e_removido(client, cab, db):
    """Revisão #63: amarelos nos jogos A e B (B gera a suspensão); reabrir A e remover o amarelo."""
    equipes, atletas, (jogo_a, jogo_b, *_) = _edicao_limite_2_amarelos(client, cab, db)
    ids_amarelo = {}
    for jogo in (jogo_a, jogo_b):
        assert client.post(f"/competicoes/partidas/{jogo}/iniciar", headers=cab).status_code == 200
        ids_amarelo[jogo] = _ocorrencia(client, cab, jogo, "CARTAO_AMARELO", equipes[0], atletas[0])
        assert client.post(f"/competicoes/partidas/{jogo}/finalizar", headers=cab, json={}).status_code == 200
    [suspensao] = _suspensoes_do_atleta(db, atletas[0])
    assert (suspensao.origem, suspensao.situacao) == ("ACUMULO_AMARELOS", "ATIVA")

    _reabrir(client, cab, jogo_a)
    # Com A reaberto e o amarelo ainda lá, a suspensão fica (pode voltar a valer ao refinalizar).
    [suspensao] = _suspensoes_do_atleta(db, atletas[0])
    assert suspensao.situacao == "ATIVA"

    r = client.request("DELETE", f"/competicoes/ocorrencias/{ids_amarelo[jogo_a]}", headers=cab,
                       json={"motivo": "Amarelo lançado por engano"})
    assert r.status_code == 200, r.text
    assert client.post(f"/competicoes/partidas/{jogo_a}/finalizar", headers=cab, json={}).status_code == 200
    [suspensao] = _suspensoes_do_atleta(db, atletas[0])
    assert suspensao.situacao == "CANCELADA"


def test_acumulo_reaproveitado_ao_reabrir_jogo_anterior_sem_mudar_cartoes(client, cab, db):
    equipes, atletas, (jogo_a, jogo_b, *_) = _edicao_limite_2_amarelos(client, cab, db)
    for jogo in (jogo_a, jogo_b):
        assert client.post(f"/competicoes/partidas/{jogo}/iniciar", headers=cab).status_code == 200
        _ocorrencia(client, cab, jogo, "CARTAO_AMARELO", equipes[0], atletas[0])
        assert client.post(f"/competicoes/partidas/{jogo}/finalizar", headers=cab, json={}).status_code == 200
    [antes] = _suspensoes_do_atleta(db, atletas[0])
    _reabrir(client, cab, jogo_a)
    assert client.post(f"/competicoes/partidas/{jogo_a}/finalizar", headers=cab, json={}).status_code == 200
    [depois] = _suspensoes_do_atleta(db, atletas[0])
    assert (depois.id_suspensao, depois.situacao) == (antes.id_suspensao, "ATIVA")
