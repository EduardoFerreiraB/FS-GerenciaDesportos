"""Passo 7 tests: Public Individual Endpoints and Security/Privacy Audit.

Covers:
1. Public individual endpoints:
   - GET /publico/competicoes/{id_competicao}/inscricoes (and alias /atletas)
   - GET /publico/competicoes/{id_competicao}/provas
   - GET /publico/provas/{id_prova}/classificacao
   - GET /publico/competicoes/{id_competicao}/classificacao-individual
2. Validation rules:
   - 404 for non-existent or RASCUNHO competitions/provas.
   - 422 when calling individual endpoints on EQUIPE competitions.
3. Privacy audit:
   - Ensuring NO sensitive personal data (CPF, RG, contato, telefone, endereco,
     email, password_hash) is exposed across public endpoints.
4. RBAC write audit:
   - Ensuring mutating operations (POST, PUT, DELETE) on competitions, teams,
     matches/confrontos, individual registrations, provas, and results
     strictly reject anonymous (401), reject professor/assistente (403),
     and allow coordenador and admin (200, 201, 204).
"""

from datetime import date, time
from typing import Any, Dict, List, Set
import pytest

import models
from security import create_access_token, get_password_hash


# ============================================================================
# Helpers e Fixture de Setup
# ============================================================================

def _auth_headers(username: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token({'sub': username})}"}


SENSITIVE_KEYS: Set[str] = {
    "documento_pessoal",
    "cpf",
    "rg",
    "contato",
    "telefone",
    "telefone_1",
    "telefone_2",
    "endereco",
    "email",
    "password_hash",
    "senha",
    "password",
}

SENSITIVE_VALUES: List[str] = [
    "CPF-SENSIVEL-111",
    "CPF-SENSIVEL-222",
    "CPF-SENSIVEL-333",
    "11988887777",
    "11977776666",
    "Rua Secreta dos Atletas, 100",
    "Rua Confidencial dos Alunos, 200",
    "atleta_privado@teste.com",
]


def _assert_no_sensitive_data(data: Any):
    """Verifica recursivamente se nenhuma chave ou valor sensível está presente."""
    if isinstance(data, dict):
        for k, v in data.items():
            k_lower = str(k).lower()
            for sensitive_key in SENSITIVE_KEYS:
                assert sensitive_key != k_lower, f"Chave sensível encontrada no JSON: '{k}'"
            _assert_no_sensitive_data(v)
    elif isinstance(data, list):
        for item in data:
            _assert_no_sensitive_data(item)
    elif isinstance(data, str):
        for sens_val in SENSITIVE_VALUES:
            assert sens_val not in data, f"Valor sensível vazado no JSON: '{sens_val}'"


def _setup_passo7_data(db):
    """Prepara o ambiente de teste com dados para competições individuais e auditorias."""
    # 1. Usuários com papéis RBAC
    usuarios = [
        models.Usuario(username="p7_admin", password_hash=get_password_hash("pass"), role="admin"),
        models.Usuario(username="p7_coord", password_hash=get_password_hash("pass"), role="coordenador"),
        models.Usuario(username="p7_prof", password_hash=get_password_hash("pass"), role="professor"),
        models.Usuario(username="p7_assist", password_hash=get_password_hash("pass"), role="assistente"),
    ]
    db.add_all(usuarios)
    db.flush()

    # 2. Estrutura base do evento
    evento = models.Evento(even_nome="Jogos da Cidade 2026", descricao="Evento Geral")
    mod_ind = models.Modalidade(nome="Natação 50m Livre", duracao_minutos=30)
    mod_eq = models.Modalidade(nome="Basquete 3x3", duracao_minutos=40)
    local = models.Local(loca_nome="Complexo Aquático Central", ativo=True)
    arbitro = models.Arbitro(apito_nome="Árbitro Geral", apito_doc="12345678901", apito_tel="11999990000")
    db.add_all([evento, mod_ind, mod_eq, local, arbitro])
    db.flush()

    edicao = models.Edicao(
        id_evento=evento.id_evento,
        edic_ano=2026,
        tipo_competicao="Pontos Corridos",
        data_inicio=date(2026, 10, 1),
        data_fim=date(2026, 10, 31),
    )
    db.add(edicao)
    db.flush()

    # 3. Competições: Individual Ativa, Individual Rascunho, e Equipe Ativa
    comp_ind_ativa = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_ind.id_modalidade,
        nome="Torneio de Natação Individual 2026",
        categoria="Sub-20",
        modo_inscricao="INDIVIDUAL",
        formato="PROVAS",
        criterio_resultado="TEMPO",
        data_inicio=date(2026, 10, 5),
        data_fim=date(2026, 10, 15),
        status="EM_ANDAMENTO",
    )
    comp_ind_rascunho = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_ind.id_modalidade,
        nome="Torneio Secreto de Natação (Rascunho)",
        categoria="Livre",
        modo_inscricao="INDIVIDUAL",
        formato="PROVAS",
        criterio_resultado="TEMPO",
        data_inicio=date(2026, 10, 20),
        data_fim=date(2026, 10, 25),
        status="RASCUNHO",
    )
    comp_equipe = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_eq.id_modalidade,
        nome="Campeonato de Basquete por Equipes",
        categoria="Aberto",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 10, 5),
        data_fim=date(2026, 10, 25),
        status="EM_ANDAMENTO",
    )
    db.add_all([comp_ind_ativa, comp_ind_rascunho, comp_equipe])
    db.flush()

    # 4. Participantes com dados sensíveis
    p1 = models.Participante(tipo="atleta")
    p2 = models.Participante(tipo="atleta")
    p3 = models.Participante(tipo="aluno")
    p4 = models.Participante(tipo="atleta")
    p_extra = models.Participante(tipo="atleta")
    db.add_all([p1, p2, p3, p4, p_extra])
    db.flush()

    a1 = models.Atleta(
        id_participante=p1.id_participante,
        nome_completo="Atleta Ouro",
        data_nascimento=date(2006, 1, 15),
        documento_pessoal="CPF-SENSIVEL-111",
        contato="11988887777",
        endereco="Rua Secreta dos Atletas, 100",
    )
    a2 = models.Atleta(
        id_participante=p2.id_participante,
        nome_completo="Atleta Prata",
        data_nascimento=date(2007, 3, 20),
        documento_pessoal="CPF-SENSIVEL-222",
        contato="11977776666",
        endereco="Rua Confidencial dos Alunos, 200",
    )
    aluno3 = models.Aluno(
        id_participante=p3.id_participante,
        nome_completo="Aluno Bronze",
        data_nascimento=date(2008, 5, 10),
        escola="Escola Estadual Esportiva",
        serie_ano="1º Ano EM",
        telefone_1="11988887777",
        endereco="Rua Confidencial dos Alunos, 200",
        documento_pessoal="CPF-SENSIVEL-333",
    )
    a4 = models.Atleta(
        id_participante=p4.id_participante,
        nome_completo="Atleta Desqualificado",
        data_nascimento=date(2006, 7, 7),
        documento_pessoal="DOC-SENSIVEL-444",
        contato="11955554444",
        endereco="Avenida Oculta, 400",
    )
    a_extra = models.Atleta(
        id_participante=p_extra.id_participante,
        nome_completo="Atleta Avulso RBAC",
        data_nascimento=date(2005, 9, 9),
        documento_pessoal="DOC-EXTRA-555",
    )
    db.add_all([a1, a2, aluno3, a4, a_extra])
    db.flush()

    # 5. Inscrições na competição individual ativa
    insc1 = models.InscricaoIndividual(
        id_competicao=comp_ind_ativa.id_competicao,
        id_participante=p1.id_participante,
        numero_peito=101,
    )
    insc2 = models.InscricaoIndividual(
        id_competicao=comp_ind_ativa.id_competicao,
        id_participante=p2.id_participante,
        numero_peito=102,
    )
    insc3 = models.InscricaoIndividual(
        id_competicao=comp_ind_ativa.id_competicao,
        id_participante=p3.id_participante,
        numero_peito=103,
    )
    insc4 = models.InscricaoIndividual(
        id_competicao=comp_ind_ativa.id_competicao,
        id_participante=p4.id_participante,
        numero_peito=104,
    )
    db.add_all([insc1, insc2, insc3, insc4])
    db.flush()

    # 6. Provas
    prova1 = models.Prova(
        id_competicao=comp_ind_ativa.id_competicao,
        nome="50m Nado Livre Final",
        data=date(2026, 10, 10),
        hora=time(10, 0),
        id_local=local.id_local,
        status="Finalizada",
    )
    prova2 = models.Prova(
        id_competicao=comp_ind_ativa.id_competicao,
        nome="100m Borboleta Preliminares",
        data=date(2026, 10, 11),
        hora=time(14, 0),
        id_local=local.id_local,
        status="Agendada",
    )
    prova_rascunho = models.Prova(
        id_competicao=comp_ind_rascunho.id_competicao,
        nome="Prova de Rascunho Não Pública",
        data=date(2026, 10, 21),
        hora=time(9, 0),
        id_local=local.id_local,
        status="Agendada",
    )
    db.add_all([prova1, prova2, prova_rascunho])
    db.flush()

    # 7. Resultados na Prova 1
    # p1: 24500ms (1º, ouro)
    # p2: 25100ms (2º, prata)
    # p3: 26200ms (3º, bronze)
    # p4: 24000ms (desqualificado por falsa largada)
    res1 = models.ResultadoProva(
        id_prova=prova1.id_prova,
        id_participante=p1.id_participante,
        tempo_ms=24500,
        posicao=1,
        desqualificado=False,
    )
    res2 = models.ResultadoProva(
        id_prova=prova1.id_prova,
        id_participante=p2.id_participante,
        tempo_ms=25100,
        posicao=2,
        desqualificado=False,
    )
    res3 = models.ResultadoProva(
        id_prova=prova1.id_prova,
        id_participante=p3.id_participante,
        tempo_ms=26200,
        posicao=3,
        desqualificado=False,
    )
    res4 = models.ResultadoProva(
        id_prova=prova1.id_prova,
        id_participante=p4.id_participante,
        tempo_ms=24000,
        posicao=None,
        desqualificado=True,
        motivo_desqualificacao="Falsa largada",
    )
    db.add_all([res1, res2, res3, res4])
    db.flush()

    # 8. Equipes e confronto para auditoria RBAC e testes de rejeição
    eq1 = models.Equipe(nome="Equipe Alpha", id_edicao=edicao.id_edicao, id_competicao=comp_equipe.id_competicao)
    eq2 = models.Equipe(nome="Equipe Beta", id_edicao=edicao.id_edicao, id_competicao=comp_equipe.id_competicao)
    db.add_all([eq1, eq2])
    db.flush()

    confronto = models.Confronto(
        id_competicao=comp_equipe.id_competicao,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        fase="CLASSIFICATORIA",
        rodada=1,
        data=date(2026, 10, 10),
        hora=time(10, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        status="Agendado",
    )
    db.add(confronto)
    db.commit()

    return {
        "evento": evento,
        "edicao": edicao,
        "comp_ind_ativa": comp_ind_ativa,
        "comp_ind_rascunho": comp_ind_rascunho,
        "comp_equipe": comp_equipe,
        "prova1": prova1,
        "prova2": prova2,
        "prova_rascunho": prova_rascunho,
        "res1": res1,
        "res2": res2,
        "res3": res3,
        "res4": res4,
        "participantes": [p1, p2, p3, p4, p_extra],
        "local": local,
        "arbitro": arbitro,
        "eq1": eq1,
        "eq2": eq2,
        "confronto": confronto,
    }


# ============================================================================
# 1. Testes de GET /publico/competicoes/{id}/inscricoes (e alias /atletas)
# ============================================================================

def test_publico_inscricoes_sucesso_e_conteudo(client, db):
    """Retorna lista pública de atletas inscritos sem expor documentos pessoais."""
    data = _setup_passo7_data(db)
    comp_id = data["comp_ind_ativa"].id_competicao

    # Testar rota principal
    resp = client.get(f"/publico/competicoes/{comp_id}/inscricoes")
    assert resp.status_code == 200, resp.text
    inscricoes = resp.json()
    assert len(inscricoes) == 4

    # Verificar estrutura esperada
    nomes = {item["nome_completo"] for item in inscricoes}
    assert "Atleta Ouro" in nomes
    assert "Atleta Prata" in nomes
    assert "Aluno Bronze" in nomes
    assert "Atleta Desqualificado" in nomes

    numeros_peito = {item["numero_peito"] for item in inscricoes}
    assert {101, 102, 103, 104} == numeros_peito

    # Nenhum documento sensível presente
    _assert_no_sensitive_data(inscricoes)

    # Testar alias /atletas
    resp_alias = client.get(f"/publico/competicoes/{comp_id}/atletas")
    assert resp_alias.status_code == 200
    assert resp_alias.json() == inscricoes


def test_publico_inscricoes_rejeita_rascunho(client, db):
    """Competição em RASCUNHO deve retornar 404 no portal público."""
    data = _setup_passo7_data(db)
    comp_rascunho_id = data["comp_ind_rascunho"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_rascunho_id}/inscricoes")
    assert resp.status_code == 404


def test_publico_inscricoes_competicao_inexistente(client, db):
    """Competição inexistente deve retornar 404."""
    _setup_passo7_data(db)
    resp = client.get("/publico/competicoes/999999/inscricoes")
    assert resp.status_code == 404


def test_publico_inscricoes_rejeita_equipe_com_422(client, db):
    """Endpoint de inscrições individuais deve rejeitar competições em modo EQUIPE com 422."""
    data = _setup_passo7_data(db)
    comp_eq_id = data["comp_equipe"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_eq_id}/inscricoes")
    assert resp.status_code == 422


# ============================================================================
# 2. Testes de GET /publico/competicoes/{id}/provas
# ============================================================================

def test_publico_provas_sucesso(client, db):
    """Retorna lista de provas públicas de competição individual ativa."""
    data = _setup_passo7_data(db)
    comp_id = data["comp_ind_ativa"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/provas")
    assert resp.status_code == 200, resp.text
    provas = resp.json()
    assert len(provas) == 2

    nomes_provas = [p["nome"] for p in provas]
    assert "50m Nado Livre Final" in nomes_provas
    assert "100m Borboleta Preliminares" in nomes_provas

    # Verificar chaves mínimas requeridas pela especificação
    for p in provas:
        assert "id_prova" in p
        assert "id_competicao" in p
        assert "nome" in p
        assert "data" in p
        assert "hora" in p
        assert "id_local" in p
        assert "status" in p

    _assert_no_sensitive_data(provas)


def test_publico_provas_rejeita_rascunho(client, db):
    """Provas de competição em RASCUNHO não são visíveis no portal público (404)."""
    data = _setup_passo7_data(db)
    comp_rascunho_id = data["comp_ind_rascunho"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_rascunho_id}/provas")
    assert resp.status_code == 404


def test_publico_provas_competicao_inexistente(client, db):
    """Competição inexistente retorna 404."""
    _setup_passo7_data(db)
    resp = client.get("/publico/competicoes/999999/provas")
    assert resp.status_code == 404


def test_publico_provas_rejeita_equipe_com_422(client, db):
    """Competição em modo EQUIPE rejeita listagem de provas individuais com 422."""
    data = _setup_passo7_data(db)
    comp_eq_id = data["comp_equipe"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_eq_id}/provas")
    assert resp.status_code == 422


# ============================================================================
# 3. Testes de GET /publico/provas/{id_prova}/classificacao
# ============================================================================

def test_publico_classificacao_prova_sucesso_e_podio(client, db):
    """Retorna classificação da prova com tempos formatados, posições e pódio."""
    data = _setup_passo7_data(db)
    prova_id = data["prova1"].id_prova

    resp = client.get(f"/publico/provas/{prova_id}/classificacao")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["id_prova"] == prova_id
    assert "resultados" in body
    resultados = body["resultados"]
    assert len(resultados) == 4

    # 1º lugar - Ouro
    r1 = resultados[0]
    assert r1["posicao"] == 1
    assert r1["nome_participante"] == "Atleta Ouro"
    assert r1["numero_peito"] == 101
    assert r1["tempo_ms"] == 24500
    assert r1["tempo_formatado"] == "24.500s"
    assert r1["desqualificado"] is False
    assert r1["podio"] == "ouro"

    # 2º lugar - Prata
    r2 = resultados[1]
    assert r2["posicao"] == 2
    assert r2["nome_participante"] == "Atleta Prata"
    assert r2["podio"] == "prata"

    # 3º lugar - Bronze
    r3 = resultados[2]
    assert r3["posicao"] == 3
    assert r3["nome_participante"] == "Aluno Bronze"
    assert r3["podio"] == "bronze"

    # Desqualificado
    r4 = resultados[3]
    assert r4["posicao"] is None
    assert r4["desqualificado"] is True
    assert r4["motivo_desqualificacao"] == "Falsa largada"
    assert r4["podio"] is None

    # Objeto podio da raiz
    assert "podio" in body
    assert body["podio"]["ouro"]["nome_participante"] == "Atleta Ouro"
    assert body["podio"]["prata"]["nome_participante"] == "Atleta Prata"
    assert body["podio"]["bronze"]["nome_participante"] == "Aluno Bronze"

    _assert_no_sensitive_data(body)


def test_publico_classificacao_prova_inexistente(client, db):
    """Prova inexistente retorna 404."""
    _setup_passo7_data(db)
    resp = client.get("/publico/provas/999999/classificacao")
    assert resp.status_code == 404


def test_publico_classificacao_prova_rascunho_retorna_404(client, db):
    """Prova pertencente a competição em rascunho não deve ser exposta publicamente."""
    data = _setup_passo7_data(db)
    prova_rascunho_id = data["prova_rascunho"].id_prova

    resp = client.get(f"/publico/provas/{prova_rascunho_id}/classificacao")
    assert resp.status_code == 404


# ============================================================================
# 4. Testes de GET /publico/competicoes/{id}/classificacao-individual
# ============================================================================

def test_publico_classificacao_individual_competicao_sucesso(client, db):
    """Retorna quadro de medalhas e resumo consolidado da competição individual."""
    data = _setup_passo7_data(db)
    comp_id = data["comp_ind_ativa"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/classificacao-individual")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["id_competicao"] == comp_id
    assert body["modo_inscricao"] == "INDIVIDUAL"
    assert body["total_provas"] == 2
    assert "quadro_medalhas" in body

    quadro = body["quadro_medalhas"]
    assert len(quadro) >= 3

    # Atleta Ouro lidera o quadro com 1 ouro
    top1 = quadro[0]
    assert top1["posicao"] == 1
    assert top1["nome_participante"] == "Atleta Ouro"
    assert top1["ouros"] == 1
    assert top1["total_medalhas"] == 1

    _assert_no_sensitive_data(body)


def test_publico_classificacao_individual_rejeita_rascunho(client, db):
    """Competição em rascunho retorna 404 no ranking consolidado."""
    data = _setup_passo7_data(db)
    comp_rascunho_id = data["comp_ind_rascunho"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_rascunho_id}/classificacao-individual")
    assert resp.status_code == 404


def test_publico_classificacao_individual_competicao_inexistente(client, db):
    """Competição inexistente retorna 404."""
    _setup_passo7_data(db)
    resp = client.get("/publico/competicoes/999999/classificacao-individual")
    assert resp.status_code == 404


def test_publico_classificacao_individual_rejeita_equipe_com_422(client, db):
    """Competição em modo EQUIPE rejeita consulta de classificação individual com 422."""
    data = _setup_passo7_data(db)
    comp_eq_id = data["comp_equipe"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_eq_id}/classificacao-individual")
    assert resp.status_code == 422


# ============================================================================
# 5. Auditoria de Privacidade Integral (/publico)
# ============================================================================

def test_auditoria_privacidade_completa_portal_publico(client, db):
    """Garante que nenhum endpoint sob /publico vaze dados confidenciais de participantes."""
    data = _setup_passo7_data(db)
    comp_id = data["comp_ind_ativa"].id_competicao
    prova_id = data["prova1"].id_prova
    evento_id = data["evento"].id_evento
    edicao_id = data["edicao"].id_edicao

    rotas_publicas = [
        f"/publico/competicoes/{comp_id}/inscricoes",
        f"/publico/competicoes/{comp_id}/atletas",
        f"/publico/competicoes/{comp_id}/provas",
        f"/publico/provas/{prova_id}/classificacao",
        f"/publico/competicoes/{comp_id}/classificacao-individual",
        "/publico/eventos",
        f"/publico/eventos/{evento_id}",
        "/publico/edicoes",
        f"/publico/edicoes/{edicao_id}/equipes",
    ]

    for rota in rotas_publicas:
        res = client.get(rota)
        assert res.status_code == 200, f"Rota pública {rota} falhou com status {res.status_code}"
        _assert_no_sensitive_data(res.json())


# ============================================================================
# 6. Auditoria de Permissões RBAC (Operações de Escrita Restritas)
# ============================================================================

def test_auditoria_rbac_escrita_rotas_mutadoras(client, db):
    """Verifica que todas as operações mutadoras em competições, equipes, confrontos,
    inscrições individuais, provas e resultados:
    1. Rejeitam requisições sem autenticação com 401.
    2. Rejeitam papéis inferiores ('professor', 'assistente') com 403.
    3. Permitem papéis autorizados ('coordenador', 'admin') com 200/201/204.
    """
    data = _setup_passo7_data(db)
    edicao_id = data["edicao"].id_edicao
    comp_id = data["comp_ind_ativa"].id_competicao
    comp_eq_id = data["comp_equipe"].id_competicao
    prova_id = data["prova1"].id_prova
    prova2_id = data["prova2"].id_prova
    res1_id = data["res1"].id_resultado
    p_extra_id = data["participantes"][4].id_participante
    eq1_id = data["eq1"].id_equipe
    eq2_id = data["eq2"].id_equipe
    confronto_id = data["confronto"].id_confronto

    # Definição dos casos de teste de escrita
    # Cada caso tem: method, url, json_payload
    casos_escrita = [
        # /competicoes
        ("POST", f"/edicoes/{edicao_id}/competicoes", {
            "id_modalidade": data["comp_ind_ativa"].id_modalidade,
            "nome": "Competição RBAC Test",
            "categoria": "Livre",
            "modo_inscricao": "INDIVIDUAL",
            "formato": "PROVAS",
            "criterio_resultado": "TEMPO",
            "status": "RASCUNHO",
        }),
        ("PUT", f"/competicoes/{comp_id}", {
            "nome": "Nome Atualizado RBAC",
        }),
        # /equipes
        ("POST", "/equipes/", {
            "nome": "Equipe RBAC Nova",
            "id_competicao": comp_eq_id,
            "id_edicao": edicao_id,
        }),
        # /confrontos
        ("POST", f"/competicoes/{comp_eq_id}/confrontos", {
            "id_equipe_mandante": eq1_id,
            "id_equipe_visitante": eq2_id,
            "fase": "CLASSIFICATORIA",
            "rodada": 2,
            "data": "2026-10-12",
            "hora": "14:00:00",
            "id_local": data["local"].id_local,
            "id_arbitro": data["arbitro"].id_arbitro,
            "status": "Agendado",
        }),
        ("PUT", f"/confrontos/{confronto_id}", {
            "fase": "FINAL",
        }),
        # /competicoes/{id}/inscricoes
        ("POST", f"/competicoes/{comp_id}/inscricoes", {
            "id_participante": p_extra_id,
            "numero_peito": 888,
        }),
        # /competicoes/{id}/provas
        ("POST", f"/competicoes/{comp_id}/provas", {
            "nome": "200m Medley RBAC",
            "status": "Agendada",
        }),
        # /provas/{id}/resultados
        ("POST", f"/provas/{prova2_id}/resultados", {
            "id_participante": p_extra_id,
            "tempo_ms": 31000,
        }),
        ("PUT", f"/provas/{prova_id}/resultados/{res1_id}", {
            "tempo_ms": 24200,
        }),
    ]

    # 1. Teste de 401 para requisições não autenticadas
    for method, url, payload in casos_escrita:
        resp = client.request(method, url, json=payload)
        assert resp.status_code == 401, f"Esperava 401 anônimo para {method} {url}, obteve {resp.status_code}"

    # 2. Teste de 403 para papel 'professor'
    for method, url, payload in casos_escrita:
        resp = client.request(method, url, json=payload, headers=_auth_headers("p7_prof"))
        assert resp.status_code == 403, f"Esperava 403 professor para {method} {url}, obteve {resp.status_code}"

    # 3. Teste de 403 para papel 'assistente'
    for method, url, payload in casos_escrita:
        resp = client.request(method, url, json=payload, headers=_auth_headers("p7_assist"))
        assert resp.status_code == 403, f"Esperava 403 assistente para {method} {url}, obteve {resp.status_code}"

    # 4. Teste de autorização bem-sucedida para 'coordenador'
    # Testamos operações selecionadas representativas para cada recurso
    # a) POST /competicoes
    res_comp = client.post(
        f"/edicoes/{edicao_id}/competicoes",
        json={
            "id_modalidade": data["comp_ind_ativa"].id_modalidade,
            "nome": "Comp Criada por Coord",
            "categoria": "Livre",
            "modo_inscricao": "INDIVIDUAL",
            "formato": "PROVAS",
            "criterio_resultado": "TEMPO",
            "status": "RASCUNHO",
        },
        headers=_auth_headers("p7_coord"),
    )
    assert res_comp.status_code == 201, res_comp.text
    comp_coord_id = res_comp.json()["id_competicao"]

    # b) DELETE /competicoes por coordenador
    res_del_comp = client.delete(
        f"/competicoes/{comp_coord_id}",
        headers=_auth_headers("p7_coord"),
    )
    assert res_del_comp.status_code == 204

    # c) POST /equipes por coordenador
    res_eq = client.post(
        "/equipes/",
        json={"nome": "Equipe Coord", "id_competicao": comp_eq_id, "id_edicao": edicao_id},
        headers=_auth_headers("p7_coord"),
    )
    assert res_eq.status_code == 201
    eq_coord_id = res_eq.json()["id_equipe"]

    # d) DELETE /equipes por coordenador
    res_del_eq = client.delete(f"/equipes/{eq_coord_id}", headers=_auth_headers("p7_coord"))
    assert res_del_eq.status_code == 204

    # e) POST /competicoes/{id}/inscricoes por coordenador
    res_insc = client.post(
        f"/competicoes/{comp_id}/inscricoes",
        json={"id_participante": p_extra_id, "numero_peito": 777},
        headers=_auth_headers("p7_coord"),
    )
    assert res_insc.status_code == 201

    # f) DELETE /competicoes/{id}/inscricoes/{id_part} por admin
    res_del_insc = client.delete(
        f"/competicoes/{comp_id}/inscricoes/{p_extra_id}",
        headers=_auth_headers("p7_admin"),
    )
    assert res_del_insc.status_code == 204

    # g) POST /competicoes/{id}/provas por admin
    res_prova = client.post(
        f"/competicoes/{comp_id}/provas",
        json={"nome": "Prova Admin", "status": "Agendada"},
        headers=_auth_headers("p7_admin"),
    )
    assert res_prova.status_code == 201
    prova_admin_id = res_prova.json()["id_prova"]

    # h) DELETE /provas/{id} por admin
    res_del_prova = client.delete(f"/provas/{prova_admin_id}", headers=_auth_headers("p7_admin"))
    assert res_del_prova.status_code == 204
