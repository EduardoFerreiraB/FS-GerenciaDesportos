"""Passo 5 tests for individual registrations, provas, and results domain contracts."""

from datetime import date, time
import pytest

import models
from security import create_access_token, get_password_hash


def _headers(username: str):
    return {"Authorization": f"Bearer {create_access_token({'sub': username})}"}


def _setup_env(db):
    evento = models.Evento(even_nome="Jogos da Primavera 2026")
    modalidade = models.Modalidade(nome="Natação 50m", duracao_minutos=30)
    db.add_all([evento, modalidade])
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

    comp_ind = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=modalidade.id_modalidade,
        nome="Torneio de Natação Individual",
        categoria="Livre",
        modo_inscricao="INDIVIDUAL",
        formato="PROVAS",
        criterio_resultado="TEMPO",
        data_inicio=date(2026, 9, 10),
        data_fim=date(2026, 9, 20),
        status="EM_ANDAMENTO",
    )
    comp_equipe = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=modalidade.id_modalidade,
        nome="Copa de Futsal Equipes",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 9, 10),
        data_fim=date(2026, 9, 20),
        status="EM_ANDAMENTO",
    )
    db.add_all([comp_ind, comp_equipe])
    db.flush()

    local1 = models.Local(loca_nome="Parque Aquático Raia 1", ativo=True)
    db.add(local1)
    db.flush()

    # Participantes
    p1 = models.Participante(tipo="atleta")
    p2 = models.Participante(tipo="atleta")
    p3 = models.Participante(tipo="atleta")
    p4 = models.Participante(tipo="atleta")
    db.add_all([p1, p2, p3, p4])
    db.flush()

    a1 = models.Atleta(id_participante=p1.id_participante, nome_completo="Nadador Alpha", data_nascimento=date(2000, 1, 1), documento_pessoal="DOC1")
    a2 = models.Atleta(id_participante=p2.id_participante, nome_completo="Nadador Beta", data_nascimento=date(2001, 2, 2), documento_pessoal="DOC2")
    a3 = models.Atleta(id_participante=p3.id_participante, nome_completo="Nadador Gamma", data_nascimento=date(2002, 3, 3), documento_pessoal="DOC3")
    a4 = models.Atleta(id_participante=p4.id_participante, nome_completo="Nadador Delta", data_nascimento=date(2003, 4, 4), documento_pessoal="DOC4")
    db.add_all([a1, a2, a3, a4])

    users = [
        models.Usuario(username="p5-admin", password_hash=get_password_hash("pass"), role="admin"),
        models.Usuario(username="p5-coord", password_hash=get_password_hash("pass"), role="coordenador"),
        models.Usuario(username="p5-prof", password_hash=get_password_hash("pass"), role="professor"),
        models.Usuario(username="p5-assist", password_hash=get_password_hash("pass"), role="assistente"),
    ]
    db.add_all(users)
    db.commit()

    return {
        "comp_ind": comp_ind,
        "comp_equipe": comp_equipe,
        "local": local1,
        "participantes": [p1, p2, p3, p4],
    }


# ============================================================================
# 1. Inscrições Individuais
# ============================================================================

def test_inscricao_individual_fluxo_sucesso_e_listagem(client, db):
    """Inscreve participante em competição individual e lista as inscrições."""
    env = _setup_env(db)
    comp_id = env["comp_ind"].id_competicao
    p_id = env["participantes"][0].id_participante

    # Inscrever com numero_peito
    res = client.post(
        f"/competicoes/{comp_id}/inscricoes",
        json={"id_participante": p_id, "numero_peito": 42},
        headers=_headers("p5-coord"),
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["id_competicao"] == comp_id
    assert data["id_participante"] == p_id
    assert data["numero_peito"] == 42
    assert "id_inscricao" in data

    # Listar
    list_res = client.get(
        f"/competicoes/{comp_id}/inscricoes",
        headers=_headers("p5-prof"),
    )
    assert list_res.status_code == 200
    inscricoes = list_res.json()
    assert len(inscricoes) == 1
    assert inscricoes[0]["id_participante"] == p_id
    assert inscricoes[0]["numero_peito"] == 42


def test_inscricao_individual_rejeita_competicao_equipe(client, db):
    """Inscrições individuais são terminantemente proibidas em competições EQUIPE (422)."""
    env = _setup_env(db)
    comp_equipe_id = env["comp_equipe"].id_competicao
    p_id = env["participantes"][0].id_participante

    # POST
    res = client.post(
        f"/competicoes/{comp_equipe_id}/inscricoes",
        json={"id_participante": p_id},
        headers=_headers("p5-admin"),
    )
    assert res.status_code == 422
    assert "modo" in res.text.lower() or "individual" in res.text.lower() or "equipe" in res.text.lower()

    # GET
    res_get = client.get(
        f"/competicoes/{comp_equipe_id}/inscricoes",
        headers=_headers("p5-prof"),
    )
    assert res_get.status_code == 422

    # DELETE
    res_del = client.delete(
        f"/competicoes/{comp_equipe_id}/inscricoes/{p_id}",
        headers=_headers("p5-admin"),
    )
    assert res_del.status_code == 422


def test_inscricao_individual_valida_participante_inexistente_e_duplicidade(client, db):
    """Participante inexistente retorna 404 e duplicidade na mesma competição retorna 422."""
    env = _setup_env(db)
    comp_id = env["comp_ind"].id_competicao
    p_id = env["participantes"][0].id_participante

    # Participante 999999 não existe -> 404
    res_404 = client.post(
        f"/competicoes/{comp_id}/inscricoes",
        json={"id_participante": 999999},
        headers=_headers("p5-coord"),
    )
    assert res_404.status_code == 404

    # Primeira inscrição -> 201
    res_ok = client.post(
        f"/competicoes/{comp_id}/inscricoes",
        json={"id_participante": p_id},
        headers=_headers("p5-coord"),
    )
    assert res_ok.status_code == 201

    # Segunda inscrição mesmo participante -> 422
    res_dup = client.post(
        f"/competicoes/{comp_id}/inscricoes",
        json={"id_participante": p_id},
        headers=_headers("p5-coord"),
    )
    assert res_dup.status_code == 422


def test_inscricao_individual_remocao_e_bloqueio_com_resultados(client, db):
    """Remoção de inscrição permitida se não houver resultados, mas bloqueada (422) se houver resultados vinculados."""
    env = _setup_env(db)
    comp_id = env["comp_ind"].id_competicao
    p1_id = env["participantes"][0].id_participante
    p2_id = env["participantes"][1].id_participante

    # Inscrever p1 e p2
    client.post(f"/competicoes/{comp_id}/inscricoes", json={"id_participante": p1_id}, headers=_headers("p5-admin"))
    client.post(f"/competicoes/{comp_id}/inscricoes", json={"id_participante": p2_id}, headers=_headers("p5-admin"))

    # Criar prova e lançar resultado para p1
    res_p = client.post(
        f"/competicoes/{comp_id}/provas",
        json={"nome": "50m Livre"},
        headers=_headers("p5-admin"),
    )
    assert res_p.status_code == 201
    prova_id = res_p.json()["id_prova"]

    res_r = client.post(
        f"/provas/{prova_id}/resultados",
        json={"id_participante": p1_id, "tempo_ms": 25000},
        headers=_headers("p5-admin"),
    )
    assert res_r.status_code == 201

    # Tentar remover p1 -> Bloqueado 422
    res_del_p1 = client.delete(
        f"/competicoes/{comp_id}/inscricoes/{p1_id}",
        headers=_headers("p5-admin"),
    )
    assert res_del_p1.status_code == 422
    assert "resultado" in res_del_p1.text.lower()

    # Remover p2 (não tem resultados) -> 204
    res_del_p2 = client.delete(
        f"/competicoes/{comp_id}/inscricoes/{p2_id}",
        headers=_headers("p5-admin"),
    )
    assert res_del_p2.status_code == 204

    # p2 não existe mais na lista
    list_res = client.get(f"/competicoes/{comp_id}/inscricoes", headers=_headers("p5-prof")).json()
    assert len(list_res) == 1
    assert list_res[0]["id_participante"] == p1_id


# ============================================================================
# 2. Provas Internas
# ============================================================================

def test_prova_crud_e_rejeicao_modo_equipe(client, db):
    """CRUD de provas em competição INDIVIDUAL e rejeição em competição EQUIPE (422)."""
    env = _setup_env(db)
    comp_ind_id = env["comp_ind"].id_competicao
    comp_eq_id = env["comp_equipe"].id_competicao
    local_id = env["local"].id_local

    # Rejeição em EQUIPE
    res_eq = client.post(
        f"/competicoes/{comp_eq_id}/provas",
        json={"nome": "Revezamento"},
        headers=_headers("p5-coord"),
    )
    assert res_eq.status_code == 422

    res_get_eq = client.get(
        f"/competicoes/{comp_eq_id}/provas",
        headers=_headers("p5-prof"),
    )
    assert res_get_eq.status_code == 422

    # CREATE em INDIVIDUAL
    payload = {
        "nome": "100m Borboleta",
        "data": "2026-09-15",
        "hora": "14:30:00",
        "id_local": local_id,
        "status": "Agendada",
        "observacoes": "Piscina olímpica aquecida",
    }
    res_create = client.post(
        f"/competicoes/{comp_ind_id}/provas",
        json=payload,
        headers=_headers("p5-coord"),
    )
    assert res_create.status_code == 201, res_create.text
    prova = res_create.json()
    prova_id = prova["id_prova"]
    assert prova["nome"] == "100m Borboleta"
    assert prova["status"] == "Agendada"
    assert prova["id_competicao"] == comp_ind_id

    # LIST
    res_list = client.get(f"/competicoes/{comp_ind_id}/provas", headers=_headers("p5-prof"))
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1

    # GET
    res_get = client.get(f"/provas/{prova_id}", headers=_headers("p5-prof"))
    assert res_get.status_code == 200
    assert res_get.json()["id_prova"] == prova_id
    assert res_get.json()["resultados"] == []

    # UPDATE
    res_up = client.put(
        f"/provas/{prova_id}",
        json={"nome": "100m Borboleta Final", "status": "Em Andamento"},
        headers=_headers("p5-coord"),
    )
    assert res_up.status_code == 200
    assert res_up.json()["nome"] == "100m Borboleta Final"
    assert res_up.json()["status"] == "Em Andamento"

    # DELETE
    res_del = client.delete(f"/provas/{prova_id}", headers=_headers("p5-admin"))
    assert res_del.status_code == 204

    # 404 após remoção
    assert client.get(f"/provas/{prova_id}", headers=_headers("p5-prof")).status_code == 404


def test_prova_bloqueio_exclusao_se_finalizada_ou_com_resultados(client, db):
    """Não é permitida a exclusão de provas com status Finalizada ou com resultados cadastrados (422)."""
    env = _setup_env(db)
    comp_id = env["comp_ind"].id_competicao
    p_id = env["participantes"][0].id_participante

    client.post(f"/competicoes/{comp_id}/inscricoes", json={"id_participante": p_id}, headers=_headers("p5-admin"))

    # 1. Prova finalizada sem resultados
    res1 = client.post(
        f"/competicoes/{comp_id}/provas",
        json={"nome": "50m Costas", "status": "Finalizada"},
        headers=_headers("p5-admin"),
    )
    p1_id = res1.json()["id_prova"]
    del1 = client.delete(f"/provas/{p1_id}", headers=_headers("p5-admin"))
    assert del1.status_code == 422
    assert "finalizada" in del1.text.lower()

    # 2. Prova em andamento com resultado
    res2 = client.post(
        f"/competicoes/{comp_id}/provas",
        json={"nome": "50m Peito", "status": "Em Andamento"},
        headers=_headers("p5-admin"),
    )
    p2_id = res2.json()["id_prova"]
    client.post(
        f"/provas/{p2_id}/resultados",
        json={"id_participante": p_id, "tempo_ms": 31000},
        headers=_headers("p5-admin"),
    )

    del2 = client.delete(f"/provas/{p2_id}", headers=_headers("p5-admin"))
    assert del2.status_code == 422
    assert "resultado" in del2.text.lower()


# ============================================================================
# 3. Resultados Finais por Prova
# ============================================================================

def test_resultado_validacao_inscricao_previa_e_tempo_positivo(client, db):
    """Lançamento de resultados exige inscrição prévia na competição (422) e tempo positivo > 0 (422)."""
    env = _setup_env(db)
    comp_id = env["comp_ind"].id_competicao
    p_inscrito = env["participantes"][0].id_participante
    p_nao_inscrito = env["participantes"][1].id_participante

    # Inscrever apenas p_inscrito
    client.post(f"/competicoes/{comp_id}/inscricoes", json={"id_participante": p_inscrito}, headers=_headers("p5-admin"))

    # Criar prova
    r_prova = client.post(f"/competicoes/{comp_id}/provas", json={"nome": "200m Medley"}, headers=_headers("p5-admin"))
    prova_id = r_prova.json()["id_prova"]

    # Rejeitar participante não inscrito -> 422
    res_nao_insc = client.post(
        f"/provas/{prova_id}/resultados",
        json={"id_participante": p_nao_inscrito, "tempo_ms": 120000},
        headers=_headers("p5-admin"),
    )
    assert res_nao_insc.status_code == 422
    assert "inscrito" in res_nao_insc.text.lower() or "inscrição" in res_nao_insc.text.lower()

    # Rejeitar tempo <= 0 -> 422
    res_tempo_zero = client.post(
        f"/provas/{prova_id}/resultados",
        json={"id_participante": p_inscrito, "tempo_ms": 0},
        headers=_headers("p5-admin"),
    )
    assert res_tempo_zero.status_code == 422

    res_tempo_neg = client.post(
        f"/provas/{prova_id}/resultados",
        json={"id_participante": p_inscrito, "tempo_ms": -500},
        headers=_headers("p5-admin"),
    )
    assert res_tempo_neg.status_code == 422

    # Lançamento válido -> 201
    res_ok = client.post(
        f"/provas/{prova_id}/resultados",
        json={"id_participante": p_inscrito, "tempo_ms": 125000},
        headers=_headers("p5-admin"),
    )
    assert res_ok.status_code == 201
    assert res_ok.json()["posicao"] == 1


def test_resultado_unicidade_por_participante_por_prova(client, db):
    """Apenas um resultado final por participante por prova (duplicidade retorna 422)."""
    env = _setup_env(db)
    comp_id = env["comp_ind"].id_competicao
    p_id = env["participantes"][0].id_participante

    client.post(f"/competicoes/{comp_id}/inscricoes", json={"id_participante": p_id}, headers=_headers("p5-admin"))
    r_prova = client.post(f"/competicoes/{comp_id}/provas", json={"nome": "50m Livre"}, headers=_headers("p5-admin"))
    prova_id = r_prova.json()["id_prova"]

    # Primeiro resultado -> 201
    res1 = client.post(
        f"/provas/{prova_id}/resultados",
        json={"id_participante": p_id, "tempo_ms": 26000},
        headers=_headers("p5-admin"),
    )
    assert res1.status_code == 201

    # Segundo resultado para mesmo atleta na mesma prova -> 422
    res2 = client.post(
        f"/provas/{prova_id}/resultados",
        json={"id_participante": p_id, "tempo_ms": 25500},
        headers=_headers("p5-admin"),
    )
    assert res2.status_code == 422
    assert "já possui" in res2.text.lower() or "duplic" in res2.text.lower() or "existe" in res2.text.lower()


def test_ordenacao_tempo_desqualificados_e_recalculo_posicoes(client, db):
    """Classificação por menor tempo, desqualificados no final (sem colocação regular) e recálculo dinâmico."""
    env = _setup_env(db)
    comp_id = env["comp_ind"].id_competicao
    p1 = env["participantes"][0].id_participante
    p2 = env["participantes"][1].id_participante
    p3 = env["participantes"][2].id_participante
    p4 = env["participantes"][3].id_participante

    # Inscrever os 4
    for p in [p1, p2, p3, p4]:
        client.post(f"/competicoes/{comp_id}/inscricoes", json={"id_participante": p}, headers=_headers("p5-admin"))

    r_prova = client.post(f"/competicoes/{comp_id}/provas", json={"nome": "100m Livre Final"}, headers=_headers("p5-admin"))
    prova_id = r_prova.json()["id_prova"]

    # 1. Inserir p1: 30000 ms (1º lugar)
    res_p1 = client.post(f"/provas/{prova_id}/resultados", json={"id_participante": p1, "tempo_ms": 30000}, headers=_headers("p5-admin"))
    assert res_p1.status_code == 201
    assert res_p1.json()["posicao"] == 1

    # 2. Inserir p2: 28000 ms (mais rápido, assume 1º lugar, p1 vira 2º)
    res_p2 = client.post(f"/provas/{prova_id}/resultados", json={"id_participante": p2, "tempo_ms": 28000}, headers=_headers("p5-admin"))
    assert res_p2.status_code == 201
    assert res_p2.json()["posicao"] == 1

    # Verificar listagem atual
    res_list = client.get(f"/provas/{prova_id}/resultados", headers=_headers("p5-prof")).json()
    assert len(res_list) == 2
    assert res_list[0]["id_participante"] == p2 and res_list[0]["posicao"] == 1
    assert res_list[1]["id_participante"] == p1 and res_list[1]["posicao"] == 2

    # 3. Inserir p3: 32000 ms (fica em 3º)
    res_p3 = client.post(f"/provas/{prova_id}/resultados", json={"id_participante": p3, "tempo_ms": 32000}, headers=_headers("p5-admin"))
    assert res_p3.status_code == 201
    assert res_p3.json()["posicao"] == 3

    # 4. Inserir p4: 26000 ms mas DESQUALIFICADO (queimou a largada)
    # Mesmo com tempo menor, desqualificado fica no final e sem colocação regular (posicao None)
    res_p4 = client.post(
        f"/provas/{prova_id}/resultados",
        json={
            "id_participante": p4,
            "tempo_ms": 26000,
            "desqualificado": True,
            "motivo_desqualificacao": "Falsa largada",
        },
        headers=_headers("p5-admin"),
    )
    assert res_p4.status_code == 201
    r4_data = res_p4.json()
    assert r4_data["desqualificado"] is True
    assert r4_data["posicao"] is None

    # Listar resultados da prova
    results = client.get(f"/provas/{prova_id}/resultados", headers=_headers("p5-prof")).json()
    assert len(results) == 4
    # Ordem deve ser: p2 (28000, pos 1), p1 (30000, pos 2), p3 (32000, pos 3), p4 (desqualificado no final)
    assert results[0]["id_participante"] == p2 and results[0]["posicao"] == 1
    assert results[1]["id_participante"] == p1 and results[1]["posicao"] == 2
    assert results[2]["id_participante"] == p3 and results[2]["posicao"] == 3
    assert results[3]["id_participante"] == p4 and results[3]["posicao"] is None

    # 5. Detalhes da prova pelo endpoint GET /provas/{id} também devem trazer os resultados ordenados
    detalhe_prova = client.get(f"/provas/{prova_id}", headers=_headers("p5-prof")).json()
    assert len(detalhe_prova["resultados"]) == 4
    assert [r["id_participante"] for r in detalhe_prova["resultados"]] == [p2, p1, p3, p4]

    # 6. Atualizar p3 (recurso concedido / correção de tempo para 27000 ms)
    # p3 passa a ter 27000 ms, assumindo a 1ª colocação!
    id_resultado_p3 = res_p3.json()["id_resultado"]
    res_up_p3 = client.put(
        f"/provas/{prova_id}/resultados/{id_resultado_p3}",
        json={"tempo_ms": 27000},
        headers=_headers("p5-admin"),
    )
    assert res_up_p3.status_code == 200
    assert res_up_p3.json()["posicao"] == 1

    # Listar novamente para verificar recálculo total
    results_after_up = client.get(f"/provas/{prova_id}/resultados", headers=_headers("p5-prof")).json()
    assert [r["id_participante"] for r in results_after_up] == [p3, p2, p1, p4]
    assert results_after_up[0]["posicao"] == 1
    assert results_after_up[1]["posicao"] == 2
    assert results_after_up[2]["posicao"] == 3
    assert results_after_up[3]["posicao"] is None

    # 7. Excluir resultado de p2 (2º lugar)
    id_resultado_p2 = res_p2.json()["id_resultado"]
    res_del_p2 = client.delete(
        f"/provas/{prova_id}/resultados/{id_resultado_p2}",
        headers=_headers("p5-admin"),
    )
    assert res_del_p2.status_code == 204

    # Posições restantes devem ter sido recalculadas: p3 vira 1º, p1 vira 2º, p4 permanece desqualificado
    results_after_del = client.get(f"/provas/{prova_id}/resultados", headers=_headers("p5-prof")).json()
    assert len(results_after_del) == 3
    assert results_after_del[0]["id_participante"] == p3 and results_after_del[0]["posicao"] == 1
    assert results_after_del[1]["id_participante"] == p1 and results_after_del[1]["posicao"] == 2
    assert results_after_del[2]["id_participante"] == p4 and results_after_del[2]["posicao"] is None


# ============================================================================
# 4. Autorização RBAC
# ============================================================================

@pytest.mark.parametrize("role, expected_status", [
    ("admin", 201),
    ("coord", 201),
    ("prof", 403),
    ("assist", 403),
])
def test_rbac_inscricoes_provas_resultados_mutacoes(client, db, role, expected_status):
    """Endpoints de escrita exigem papel admin ou coordenador; professor/assistente recebem 403."""
    env = _setup_env(db)
    comp_id = env["comp_ind"].id_competicao
    p_id = env["participantes"][0].id_participante

    # Testar POST inscricao
    res_ins = client.post(
        f"/competicoes/{comp_id}/inscricoes",
        json={"id_participante": p_id},
        headers=_headers(f"p5-{role}"),
    )
    assert res_ins.status_code == expected_status

    # Testar POST prova
    res_prv = client.post(
        f"/competicoes/{comp_id}/provas",
        json={"nome": f"Prova Teste {role}"},
        headers=_headers(f"p5-{role}"),
    )
    assert res_prv.status_code == expected_status


def test_rbac_anonimo_rejeitado_com_401(client, db):
    """Chamadas sem token de autenticação são rejeitadas com 401."""
    env = _setup_env(db)
    comp_id = env["comp_ind"].id_competicao

    # GET inscricoes
    assert client.get(f"/competicoes/{comp_id}/inscricoes").status_code == 401
    # POST inscricoes
    assert client.post(f"/competicoes/{comp_id}/inscricoes", json={}).status_code == 401
    # GET provas
    assert client.get(f"/competicoes/{comp_id}/provas").status_code == 401
    # POST provas
    assert client.post(f"/competicoes/{comp_id}/provas", json={}).status_code == 401
    # GET prova/{id}
    assert client.get(f"/provas/1").status_code == 401
    # GET resultados
    assert client.get(f"/provas/1/resultados").status_code == 401
