"""Passo 6 tests for classification endpoints: team standings, individual rankings, and unified route."""

from datetime import date, time
import pytest

import models
from security import create_access_token, get_password_hash


def _headers(username: str):
    return {"Authorization": f"Bearer {create_access_token({'sub': username})}"}


def _setup_classificacao_env(db):
    evento = models.Evento(even_nome="Jogos Municipais 2026")
    mod_equipe = models.Modalidade(nome="Futsal", duracao_minutos=40)
    mod_ind = models.Modalidade(nome="Natação", duracao_minutos=20)
    local = models.Local(loca_nome="Ginásio Poliesportivo", ativo=True)
    arbitro = models.Arbitro(apito_nome="Árbitro Principal", apito_doc="11122233344", apito_tel="11999999999")
    db.add_all([evento, mod_equipe, mod_ind, local, arbitro])
    db.flush()

    edicao = models.Edicao(
        id_evento=evento.id_evento,
        edic_ano=2026,
        tipo_competicao="Pontos Corridos",
        data_inicio=date(2026, 9, 1),
        data_fim=date(2026, 9, 30),
    )
    db.add(edicao)
    db.flush()

    comp_equipe = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_equipe.id_modalidade,
        nome="Campeonato de Futsal",
        categoria="Adulto",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 9, 5),
        data_fim=date(2026, 9, 25),
        status="EM_ANDAMENTO",
    )
    comp_ind = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_ind.id_modalidade,
        nome="Torneio de Natação",
        categoria="Livre",
        modo_inscricao="INDIVIDUAL",
        formato="PROVAS",
        criterio_resultado="TEMPO",
        data_inicio=date(2026, 9, 10),
        data_fim=date(2026, 9, 20),
        status="EM_ANDAMENTO",
    )
    db.add_all([comp_equipe, comp_ind])
    db.flush()

    # Equipes e confronto
    eq1 = models.Equipe(nome="Águias FC", id_edicao=edicao.id_edicao, id_competicao=comp_equipe.id_competicao)
    eq2 = models.Equipe(nome="Leões FC", id_edicao=edicao.id_edicao, id_competicao=comp_equipe.id_competicao)
    db.add_all([eq1, eq2])
    db.flush()

    conf = models.Confronto(
        id_competicao=comp_equipe.id_competicao,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        data=date(2026, 9, 10),
        hora=time(14, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=3,
        placar_visitante=1,
        id_equipe_vencedora=eq1.id_equipe,
        status="Finalizado",
    )
    db.add(conf)

    # Atleta, inscrição e prova individual
    part = models.Participante(tipo="atleta")
    db.add(part)
    db.flush()
    atleta = models.Atleta(
        id_participante=part.id_participante,
        nome_completo="Carlos Nadador",
        data_nascimento=date(2005, 5, 20),
        documento_pessoal="DOC1",
    )
    db.add(atleta)
    db.flush()

    insc = models.InscricaoIndividual(
        id_competicao=comp_ind.id_competicao,
        id_participante=part.id_participante,
        numero_peito=101,
    )
    prova = models.Prova(
        id_competicao=comp_ind.id_competicao,
        nome="50m Livre",
        data=date(2026, 9, 15),
        hora=time(10, 0),
        id_local=local.id_local,
        status="Finalizada",
    )
    db.add_all([insc, prova])
    db.flush()

    res = models.ResultadoProva(
        id_prova=prova.id_prova,
        id_participante=part.id_participante,
        tempo_ms=25430,
        posicao=1,
        desqualificado=False,
    )
    db.add(res)

    # Usuários
    user_coordenador = models.Usuario(
        username="coord@teste.com",
        password_hash=get_password_hash("secret123"),
        role="coordenador",
    )
    user_professor = models.Usuario(
        username="prof@teste.com",
        password_hash=get_password_hash("secret123"),
        role="professor",
    )
    db.add_all([user_coordenador, user_professor])
    db.commit()

    return {
        "comp_equipe": comp_equipe,
        "comp_ind": comp_ind,
        "prova": prova,
        "eq1": eq1,
        "eq2": eq2,
        "part": part,
    }


def test_classificacao_unificada_competicao_equipe(client, db):
    data = _setup_classificacao_env(db)
    comp_id = data["comp_equipe"].id_competicao

    resp = client.get(f"/competicoes/{comp_id}/classificacao", headers=_headers("coord@teste.com"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["formato"] == "PONTOS_CORRIDOS"
    assert "classificacao" in body
    assert len(body["classificacao"]) == 2
    assert body["classificacao"][0]["nome_equipe"] == "Águias FC"
    assert body["classificacao"][0]["pontos"] == 3
    assert body["classificacao"][1]["nome_equipe"] == "Leões FC"
    assert body["classificacao"][1]["pontos"] == 0


def test_classificacao_unificada_competicao_individual(client, db):
    data = _setup_classificacao_env(db)
    comp_id = data["comp_ind"].id_competicao

    resp = client.get(f"/competicoes/{comp_id}/classificacao", headers=_headers("prof@teste.com"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["id_competicao"] == comp_id
    assert "provas" in body
    assert "quadro_medalhas" in body
    assert len(body["provas"]) == 1
    assert body["quadro_medalhas"][0]["nome_participante"] == "Carlos Nadador"
    assert body["quadro_medalhas"][0]["ouros"] == 1


def test_classificacao_unificada_404(client, db):
    _setup_classificacao_env(db)
    resp = client.get("/competicoes/99999/classificacao", headers=_headers("coord@teste.com"))
    assert resp.status_code == 404


def test_classificacao_unificada_anonimo_401(client, db):
    data = _setup_classificacao_env(db)
    comp_id = data["comp_equipe"].id_competicao
    resp = client.get(f"/competicoes/{comp_id}/classificacao")
    assert resp.status_code == 401


def test_classificacao_equipes_especifica_sucesso_e_rejeicao(client, db):
    data = _setup_classificacao_env(db)
    eq_id = data["comp_equipe"].id_competicao
    ind_id = data["comp_ind"].id_competicao

    # Sucesso em EQUIPE
    resp = client.get(f"/competicoes/{eq_id}/classificacao-equipes", headers=_headers("prof@teste.com"))
    assert resp.status_code == 200
    assert resp.json()["total_equipes"] == 2

    # 422 em INDIVIDUAL
    resp_ind = client.get(f"/competicoes/{ind_id}/classificacao-equipes", headers=_headers("prof@teste.com"))
    assert resp_ind.status_code == 422


def test_classificacao_individual_especifica_sucesso_e_rejeicao(client, db):
    data = _setup_classificacao_env(db)
    eq_id = data["comp_equipe"].id_competicao
    ind_id = data["comp_ind"].id_competicao

    # Sucesso em INDIVIDUAL
    resp = client.get(f"/competicoes/{ind_id}/classificacao-individual", headers=_headers("coord@teste.com"))
    assert resp.status_code == 200
    assert len(resp.json()["provas"]) == 1

    # 422 em EQUIPE
    resp_eq = client.get(f"/competicoes/{eq_id}/classificacao-individual", headers=_headers("coord@teste.com"))
    assert resp_eq.status_code == 422


def test_classificacao_prova_detalhada(client, db):
    data = _setup_classificacao_env(db)
    prova_id = data["prova"].id_prova

    resp = client.get(f"/provas/{prova_id}/classificacao", headers=_headers("prof@teste.com"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["id_prova"] == prova_id
    assert len(body["classificacao"]) == 1
    assert body["classificacao"][0]["posicao"] == 1
    assert body["classificacao"][0]["tempo_formatado"] == "25.430s"
    assert body["podio"]["ouro"]["nome_participante"] == "Carlos Nadador"

    # 404 em prova inexistente
    resp_404 = client.get("/provas/99999/classificacao", headers=_headers("prof@teste.com"))
    assert resp_404.status_code == 404
