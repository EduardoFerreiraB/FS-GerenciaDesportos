"""Testes do Passo 7: Endpoints públicos de competições, equipes, confrontos e classificação.

Valida:
- Omissão de competições em RASCUNHO no portal público.
- Retorno de dados públicos de competições e edição.
- Listagem pública de equipes e jogadores (sem dados sensíveis como CPF, RG, contato, endereço).
- Listagem pública de confrontos (com local, árbitro público sem doc/tel, equipes, placares).
- Despacho inteligente de classificação (/classificacao) para EQUIPE e INDIVIDUAL.
- Classificação específica de equipes (/classificacao-equipes) com rejeição 422 para INDIVIDUAL.
- Respostas 404 para entidades inexistentes ou em rascunho.
- Total ausência de campos confidenciais.
- Acesso anônimo sem token.
"""

from datetime import date, time
import pytest

import models


def _setup_passo7_test_data(db):
    """Monta um ambiente completo de testes para o portal público."""
    evento = models.Evento(even_nome="Copa Cidade 2026", descricao="Copa Municipal Esportiva")
    mod_futsal = models.Modalidade(nome="Futsal", duracao_minutos=40)
    mod_natacao = models.Modalidade(nome="Natação", duracao_minutos=30)
    local1 = models.Local(loca_nome="Ginásio Central", loca_descricao="Quadra Poliesportiva", ativo=True)
    local2 = models.Local(loca_nome="Parque Aquático", loca_descricao="Piscina Olímpica", ativo=True)
    arbitro = models.Arbitro(apito_nome="Carlos Juiz", apito_doc="12345678900", apito_tel="11988887777")
    db.add_all([evento, mod_futsal, mod_natacao, local1, local2, arbitro])
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

    # Competição Equipe - Pontos Corridos (PUBLICADA)
    comp_equipe_pc = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_futsal.id_modalidade,
        nome="Futsal Principal",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 9, 5),
        data_fim=date(2026, 9, 25),
        status="PUBLICADA",
        regras="Regras oficiais do futsal",
    )

    # Competição Equipe - Grupos (EM_ANDAMENTO)
    comp_equipe_grupos = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_futsal.id_modalidade,
        nome="Futsal Grupos",
        categoria="Sub-20",
        modo_inscricao="EQUIPE",
        formato="GRUPOS",
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 9, 6),
        data_fim=date(2026, 9, 26),
        status="EM_ANDAMENTO",
    )

    # Competição Equipe - Mata-Mata (EM_ANDAMENTO)
    comp_equipe_mata = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_futsal.id_modalidade,
        nome="Futsal Mata-Mata",
        categoria="Veteranos",
        modo_inscricao="EQUIPE",
        formato="MATA_MATA",
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 9, 7),
        data_fim=date(2026, 9, 27),
        status="EM_ANDAMENTO",
    )

    # Competição em Rascunho (deve ser ocultada do público)
    comp_rascunho = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_futsal.id_modalidade,
        nome="Futsal Rascunho",
        categoria="Iniciante",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        data_inicio=date(2026, 9, 8),
        data_fim=date(2026, 9, 28),
        status="RASCUNHO",
    )

    # Competição Individual - Provas (EM_ANDAMENTO)
    comp_ind = models.Competicao(
        id_edicao=edicao.id_edicao,
        id_modalidade=mod_natacao.id_modalidade,
        nome="Torneio de Natação",
        categoria="Adulto",
        modo_inscricao="INDIVIDUAL",
        formato="PROVAS",
        criterio_resultado="TEMPO",
        data_inicio=date(2026, 9, 10),
        data_fim=date(2026, 9, 20),
        status="EM_ANDAMENTO",
    )

    db.add_all([comp_equipe_pc, comp_equipe_grupos, comp_equipe_mata, comp_rascunho, comp_ind])
    db.flush()

    # Participantes para teste de equipes (1 Aluno e 1 Atleta com dados sensíveis de teste)
    part_aluno = models.Participante(tipo="aluno")
    part_atleta = models.Participante(tipo="atleta")
    part_ind = models.Participante(tipo="atleta")
    db.add_all([part_aluno, part_atleta, part_ind])
    db.flush()

    aluno = models.Aluno(
        id_participante=part_aluno.id_participante,
        nome_completo="Joãozinho Aluno",
        data_nascimento=date(2010, 3, 15),
        escola="Escola Estadual Secreta",
        serie_ano="9º Ano",
        nome_mae="Maria Mãe",
        nome_pai="José Pai",
        telefone_1="11999990001",
        telefone_2="11999990002",
        endereco="Rua Confidencial, 123",
        recomendacoes_medicas="Alergia a pólen",
        documento_pessoal="11122233344",
    )
    atleta = models.Atleta(
        id_participante=part_atleta.id_participante,
        nome_completo="Pedro Atleta",
        data_nascimento=date(2000, 1, 10),
        documento_pessoal="99988877766",
        contato="11988880000",
        endereco="Avenida Oculta, 456",
    )
    atleta_ind = models.Atleta(
        id_participante=part_ind.id_participante,
        nome_completo="Marina Nadadora",
        data_nascimento=date(1998, 5, 20),
        documento_pessoal="55544433322",
        contato="11977770000",
        endereco="Rua da Natação, 789",
    )
    db.add_all([aluno, atleta, atleta_ind])
    db.flush()

    # Equipes para a competição de Pontos Corridos
    eq1 = models.Equipe(
        nome="Estrela Vermelha",
        id_edicao=edicao.id_edicao,
        id_competicao=comp_equipe_pc.id_competicao,
        grupo=None,
    )
    eq2 = models.Equipe(
        nome="Cometa Azul",
        id_edicao=edicao.id_edicao,
        id_competicao=comp_equipe_pc.id_competicao,
        grupo=None,
    )
    eq1.participantes.extend([part_aluno, part_atleta])
    db.add_all([eq1, eq2])
    db.flush()

    # Equipes para a competição de Grupos
    eq_g1 = models.Equipe(
        nome="Tigres A",
        id_edicao=edicao.id_edicao,
        id_competicao=comp_equipe_grupos.id_competicao,
        grupo="Grupo A",
    )
    eq_g2 = models.Equipe(
        nome="Leões A",
        id_edicao=edicao.id_edicao,
        id_competicao=comp_equipe_grupos.id_competicao,
        grupo="Grupo A",
    )
    eq_g3 = models.Equipe(
        nome="Falcões B",
        id_edicao=edicao.id_edicao,
        id_competicao=comp_equipe_grupos.id_competicao,
        grupo="Grupo B",
    )
    eq_g4 = models.Equipe(
        nome="Águias B",
        id_edicao=edicao.id_edicao,
        id_competicao=comp_equipe_grupos.id_competicao,
        grupo="Grupo B",
    )
    db.add_all([eq_g1, eq_g2, eq_g3, eq_g4])
    db.flush()

    # Equipes para Mata-Mata
    eq_m1 = models.Equipe(
        nome="Alpha MM",
        id_edicao=edicao.id_edicao,
        id_competicao=comp_equipe_mata.id_competicao,
    )
    eq_m2 = models.Equipe(
        nome="Beta MM",
        id_edicao=edicao.id_edicao,
        id_competicao=comp_equipe_mata.id_competicao,
    )
    db.add_all([eq_m1, eq_m2])
    db.flush()

    # Confrontos para Pontos Corridos
    conf_pc1 = models.Confronto(
        id_competicao=comp_equipe_pc.id_competicao,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        fase="Fase Única",
        rodada=1,
        grupo=None,
        data=date(2026, 9, 10),
        hora=time(15, 0),
        id_local=local1.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=3,
        placar_visitante=1,
        id_equipe_vencedora=eq1.id_equipe,
        status="Finalizado",
        sumula_arquivo="/uploads/sumulas/sumula1.pdf",
        observacoes="Partida de abertura sem incidentes",
    )
    conf_pc2 = models.Confronto(
        id_competicao=comp_equipe_pc.id_competicao,
        id_equipe_mandante=eq2.id_equipe,
        id_equipe_visitante=eq1.id_equipe,
        fase="Fase Única",
        rodada=2,
        grupo=None,
        data=date(2026, 9, 17),
        hora=time(16, 0),
        id_local=local1.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=0,
        placar_visitante=0,
        status="Agendado",
        observacoes="Rodada de volta",
    )
    db.add_all([conf_pc1, conf_pc2])

    # Confrontos para Grupos
    conf_g1 = models.Confronto(
        id_competicao=comp_equipe_grupos.id_competicao,
        id_equipe_mandante=eq_g1.id_equipe,
        id_equipe_visitante=eq_g2.id_equipe,
        fase="Classificatória",
        rodada=1,
        grupo="Grupo A",
        data=date(2026, 9, 11),
        hora=time(14, 0),
        id_local=local1.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=2,
        placar_visitante=0,
        id_equipe_vencedora=eq_g1.id_equipe,
        status="Finalizado",
    )
    conf_g2 = models.Confronto(
        id_competicao=comp_equipe_grupos.id_competicao,
        id_equipe_mandante=eq_g3.id_equipe,
        id_equipe_visitante=eq_g4.id_equipe,
        fase="Classificatória",
        rodada=1,
        grupo="Grupo B",
        data=date(2026, 9, 11),
        hora=time(16, 0),
        id_local=local1.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=1,
        placar_visitante=1,
        status="Finalizado",
    )
    db.add_all([conf_g1, conf_g2])

    # Confronto Mata-Mata
    conf_mm = models.Confronto(
        id_competicao=comp_equipe_mata.id_competicao,
        id_equipe_mandante=eq_m1.id_equipe,
        id_equipe_visitante=eq_m2.id_equipe,
        fase="Final",
        rodada=1,
        data=date(2026, 9, 20),
        hora=time(18, 0),
        id_local=local1.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=4,
        placar_visitante=2,
        id_equipe_vencedora=eq_m1.id_equipe,
        status="Finalizado",
    )
    db.add(conf_mm)

    # Inscrição, prova e resultado individual
    insc_ind = models.InscricaoIndividual(
        id_competicao=comp_ind.id_competicao,
        id_participante=part_ind.id_participante,
        numero_peito=42,
    )
    prova_ind = models.Prova(
        id_competicao=comp_ind.id_competicao,
        nome="100m Borboleta",
        data=date(2026, 9, 15),
        hora=time(9, 30),
        id_local=local2.id_local,
        status="Finalizada",
    )
    db.add_all([insc_ind, prova_ind])
    db.flush()

    res_ind = models.ResultadoProva(
        id_prova=prova_ind.id_prova,
        id_participante=part_ind.id_participante,
        tempo_ms=58210,
        posicao=1,
        desqualificado=False,
    )
    db.add(res_ind)
    db.commit()

    return {
        "edicao": edicao,
        "comp_equipe_pc": comp_equipe_pc,
        "comp_equipe_grupos": comp_equipe_grupos,
        "comp_equipe_mata": comp_equipe_mata,
        "comp_rascunho": comp_rascunho,
        "comp_ind": comp_ind,
        "eq1": eq1,
        "eq2": eq2,
        "part_aluno": part_aluno,
        "part_atleta": part_atleta,
        "conf_pc1": conf_pc1,
        "conf_pc2": conf_pc2,
    }


def _assert_no_sensitive_keys(data, sensitive_keys=None):
    """Verifica recursivamente que nenhuma chave sensível consta em dados JSON."""
    if sensitive_keys is None:
        sensitive_keys = {
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
            "escola",
            "nome_mae",
            "nome_pai",
            "recomendacoes_medicas",
            "apito_doc",
            "apito_tel",
        }

    if isinstance(data, dict):
        for key, val in data.items():
            assert key.lower() not in sensitive_keys, f"Chave sensível encontrada no payload público: {key}"
            _assert_no_sensitive_keys(val, sensitive_keys)
    elif isinstance(data, list):
        for item in data:
            _assert_no_sensitive_keys(item, sensitive_keys)


# ============================================================================
# 1. Testes de Hierarquia de Competições (/edicoes/{id}/competicoes)
# ============================================================================

def test_listar_competicoes_edicao_filtra_rascunho_e_retorna_publicas(client, db):
    """GET /publico/edicoes/{id_edicao}/competicoes oculta RASCUNHO e exibe públicas."""
    data = _setup_passo7_test_data(db)
    edicao_id = data["edicao"].id_edicao

    resp = client.get(f"/publico/edicoes/{edicao_id}/competicoes")
    assert resp.status_code == 200
    competicoes = resp.json()
    assert isinstance(competicoes, list)

    nomes = [c["nome"] for c in competicoes]
    assert "Futsal Principal" in nomes
    assert "Futsal Grupos" in nomes
    assert "Futsal Mata-Mata" in nomes
    assert "Torneio de Natação" in nomes
    # Competição em RASCUNHO não deve estar visível
    assert "Futsal Rascunho" not in nomes

    # Validar campos de uma competição
    c_futsal = next(c for c in competicoes if c["nome"] == "Futsal Principal")
    assert c_futsal["id_edicao"] == edicao_id
    assert c_futsal["modo_inscricao"] == "EQUIPE"
    assert c_futsal["formato"] == "PONTOS_CORRIDOS"
    assert c_futsal["criterio_resultado"] == "PLACAR"
    assert c_futsal["status"] == "PUBLICADA"
    assert "modalidade" in c_futsal
    assert c_futsal["modalidade"]["nome"] == "Futsal"

    _assert_no_sensitive_keys(competicoes)


def test_listar_competicoes_edicao_inexistente_404(client, db):
    """GET /publico/edicoes/{id_edicao}/competicoes retorna 404 para edição inexistente."""
    _setup_passo7_test_data(db)
    resp = client.get("/publico/edicoes/99999/competicoes")
    assert resp.status_code == 404
    assert "não encontrada" in resp.json()["detail"].lower()


# ============================================================================
# 2. Testes de Detalhe de Competição (/competicoes/{id})
# ============================================================================

def test_obter_competicao_publica_sucesso(client, db):
    """GET /publico/competicoes/{id_competicao} retorna dados da competição pública."""
    data = _setup_passo7_test_data(db)
    comp_id = data["comp_equipe_pc"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id_competicao"] == comp_id
    assert body["nome"] == "Futsal Principal"
    assert body["categoria"] == "Livre"
    assert body["modo_inscricao"] == "EQUIPE"
    assert body["formato"] == "PONTOS_CORRIDOS"
    assert body["status"] == "PUBLICADA"
    assert body["modalidade"]["nome"] == "Futsal"
    _assert_no_sensitive_keys(body)


def test_obter_competicao_publica_rascunho_404(client, db):
    """GET /publico/competicoes/{id_competicao} retorna 404 para competição em RASCUNHO."""
    data = _setup_passo7_test_data(db)
    rascunho_id = data["comp_rascunho"].id_competicao

    resp = client.get(f"/publico/competicoes/{rascunho_id}")
    assert resp.status_code == 404
    assert "não encontrada" in resp.json()["detail"].lower()


def test_obter_competicao_publica_inexistente_404(client, db):
    """GET /publico/competicoes/{id_competicao} retorna 404 se não existir."""
    _setup_passo7_test_data(db)
    resp = client.get("/publico/competicoes/99999")
    assert resp.status_code == 404


# ============================================================================
# 3. Testes de Equipes da Competição (/competicoes/{id}/equipes)
# ============================================================================

def test_listar_equipes_competicao_publica_sucesso_e_jogadores(client, db):
    """GET /publico/competicoes/{id_competicao}/equipes lista equipes e jogadores sem dados sensíveis."""
    data = _setup_passo7_test_data(db)
    comp_id = data["comp_equipe_pc"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/equipes")
    assert resp.status_code == 200
    equipes = resp.json()
    assert len(equipes) == 2

    eq1_data = next(e for e in equipes if e["nome"] == "Estrela Vermelha")
    assert eq1_data["id_competicao"] == comp_id
    assert len(eq1_data["jogadores"]) == 2

    nomes_jogadores = [j["nome_completo"] for j in eq1_data["jogadores"]]
    assert "Joãozinho Aluno" in nomes_jogadores
    assert "Pedro Atleta" in nomes_jogadores

    # Validação estrita do schema do jogador: apenas id_participante e nome_completo
    for j in eq1_data["jogadores"]:
        assert set(j.keys()) == {"id_participante", "nome_completo"}

    # Auditoria de privacidade completa
    _assert_no_sensitive_keys(equipes)


def test_listar_equipes_competicao_individual_422(client, db):
    """GET /publico/competicoes/{id_competicao}/equipes retorna 422 para INDIVIDUAL."""
    data = _setup_passo7_test_data(db)
    comp_ind_id = data["comp_ind"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_ind_id}/equipes")
    assert resp.status_code == 422
    assert "equipe" in resp.json()["detail"].lower()


def test_listar_equipes_competicao_rascunho_404(client, db):
    """GET /publico/competicoes/{id_competicao}/equipes retorna 404 se competição em rascunho."""
    data = _setup_passo7_test_data(db)
    rascunho_id = data["comp_rascunho"].id_competicao

    resp = client.get(f"/publico/competicoes/{rascunho_id}/equipes")
    assert resp.status_code == 404


def test_listar_equipes_competicao_inexistente_404(client, db):
    """GET /publico/competicoes/{id_competicao}/equipes retorna 404 se não existir."""
    _setup_passo7_test_data(db)
    resp = client.get("/publico/competicoes/99999/equipes")
    assert resp.status_code == 404


# ============================================================================
# 4. Testes de Confrontos da Competição (/competicoes/{id}/confrontos)
# ============================================================================

def test_listar_confrontos_competicao_publica_sucesso_e_filtros(client, db):
    """GET /publico/competicoes/{id_competicao}/confrontos lista confrontos com filtros e sem dados sensíveis."""
    data = _setup_passo7_test_data(db)
    comp_id = data["comp_equipe_pc"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/confrontos")
    assert resp.status_code == 200
    confrontos = resp.json()
    assert len(confrontos) == 2

    c1 = confrontos[0]
    assert c1["id_competicao"] == comp_id
    assert c1["fase"] == "Fase Única"
    assert c1["rodada"] == 1
    assert c1["placar_mandante"] == 3
    assert c1["placar_visitante"] == 1
    assert c1["status"] == "Finalizado"
    assert c1["sumula_arquivo"] == "/uploads/sumulas/sumula1.pdf"
    assert c1["observacoes"] == "Partida de abertura sem incidentes"
    assert c1["local"]["loca_nome"] == "Ginásio Central"
    assert c1["arbitro"]["apito_nome"] == "Carlos Juiz"
    assert c1["equipe_mandante"]["nome"] == "Estrela Vermelha"
    assert c1["equipe_visitante"]["nome"] == "Cometa Azul"

    # Testar filtro por rodada
    resp_r1 = client.get(f"/publico/competicoes/{comp_id}/confrontos?rodada=1")
    assert resp_r1.status_code == 200
    assert len(resp_r1.json()) == 1
    assert resp_r1.json()[0]["rodada"] == 1

    resp_r2 = client.get(f"/publico/competicoes/{comp_id}/confrontos?rodada=2")
    assert resp_r2.status_code == 200
    assert len(resp_r2.json()) == 1
    assert resp_r2.json()[0]["rodada"] == 2

    # Auditoria de privacidade no confronto (sem apito_doc nem apito_tel)
    _assert_no_sensitive_keys(confrontos)


def test_listar_confrontos_competicao_filtro_grupo(client, db):
    """GET /publico/competicoes/{id_competicao}/confrontos filtra por grupo."""
    data = _setup_passo7_test_data(db)
    comp_grupos_id = data["comp_equipe_grupos"].id_competicao

    resp_ga = client.get(f"/publico/competicoes/{comp_grupos_id}/confrontos?grupo=Grupo%20A")
    assert resp_ga.status_code == 200
    confs_a = resp_ga.json()
    assert len(confs_a) == 1
    assert confs_a[0]["grupo"] == "Grupo A"

    resp_gb = client.get(f"/publico/competicoes/{comp_grupos_id}/confrontos?grupo=Grupo%20B")
    assert resp_gb.status_code == 200
    confs_b = resp_gb.json()
    assert len(confs_b) == 1
    assert confs_b[0]["grupo"] == "Grupo B"


def test_listar_confrontos_competicao_individual_422(client, db):
    """GET /publico/competicoes/{id_competicao}/confrontos retorna 422 para INDIVIDUAL."""
    data = _setup_passo7_test_data(db)
    comp_ind_id = data["comp_ind"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_ind_id}/confrontos")
    assert resp.status_code == 422
    assert "equipe" in resp.json()["detail"].lower()


def test_listar_confrontos_competicao_rascunho_404(client, db):
    """GET /publico/competicoes/{id_competicao}/confrontos retorna 404 para RASCUNHO."""
    data = _setup_passo7_test_data(db)
    rascunho_id = data["comp_rascunho"].id_competicao

    resp = client.get(f"/publico/competicoes/{rascunho_id}/confrontos")
    assert resp.status_code == 404


def test_listar_confrontos_competicao_inexistente_404(client, db):
    """GET /publico/competicoes/{id_competicao}/confrontos retorna 404 para inexistente."""
    _setup_passo7_test_data(db)
    resp = client.get("/publico/competicoes/99999/confrontos")
    assert resp.status_code == 404


# ============================================================================
# 5. Testes de Classificação (/competicoes/{id}/classificacao)
# ============================================================================

def test_classificacao_publica_despacho_inteligente_equipe_pontos_corridos(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao despacha para equipes (pontos corridos)."""
    data = _setup_passo7_test_data(db)
    comp_id = data["comp_equipe_pc"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/classificacao")
    assert resp.status_code == 200
    body = resp.json()
    assert body["formato"] == "PONTOS_CORRIDOS"
    assert len(body["classificacao"]) == 2
    assert body["classificacao"][0]["nome_equipe"] == "Estrela Vermelha"
    assert body["classificacao"][0]["pontos"] == 3
    assert body["classificacao"][1]["nome_equipe"] == "Cometa Azul"
    assert body["classificacao"][1]["pontos"] == 0
    _assert_no_sensitive_keys(body)


def test_classificacao_publica_despacho_inteligente_equipe_grupos(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao despacha para equipes (grupos)."""
    data = _setup_passo7_test_data(db)
    comp_id = data["comp_equipe_grupos"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/classificacao")
    assert resp.status_code == 200
    body = resp.json()
    assert body["formato"] == "GRUPOS"
    assert "grupos" in body
    assert "Grupo A" in body["grupos"]
    assert "Grupo B" in body["grupos"]
    _assert_no_sensitive_keys(body)


def test_classificacao_publica_despacho_inteligente_equipe_mata_mata(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao despacha para equipes (mata-mata)."""
    data = _setup_passo7_test_data(db)
    comp_id = data["comp_equipe_mata"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/classificacao")
    assert resp.status_code == 200
    body = resp.json()
    assert body["formato"] == "MATA_MATA"
    assert "arvore" in body
    assert "classificacao" in body
    assert body["campeao"]["nome_equipe"] == "Alpha MM"
    assert body["vice_campeao"]["nome_equipe"] == "Beta MM"
    _assert_no_sensitive_keys(body)


def test_classificacao_publica_despacho_inteligente_individual(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao despacha para individual."""
    data = _setup_passo7_test_data(db)
    comp_id = data["comp_ind"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/classificacao")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id_competicao"] == comp_id
    assert "provas" in body
    assert "quadro_medalhas" in body
    assert body["quadro_medalhas"][0]["nome_participante"] == "Marina Nadadora"
    assert body["quadro_medalhas"][0]["ouros"] == 1
    _assert_no_sensitive_keys(body)


def test_classificacao_publica_rascunho_404(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao retorna 404 para RASCUNHO."""
    data = _setup_passo7_test_data(db)
    rascunho_id = data["comp_rascunho"].id_competicao

    resp = client.get(f"/publico/competicoes/{rascunho_id}/classificacao")
    assert resp.status_code == 404


def test_classificacao_publica_inexistente_404(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao retorna 404 para inexistente."""
    _setup_passo7_test_data(db)
    resp = client.get("/publico/competicoes/99999/classificacao")
    assert resp.status_code == 404


# ============================================================================
# 6. Testes de Classificação Específica de Equipes (/classificacao-equipes)
# ============================================================================

def test_classificacao_equipes_especifica_sucesso(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao-equipes retorna tabela de equipes."""
    data = _setup_passo7_test_data(db)
    comp_id = data["comp_equipe_pc"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/classificacao-equipes")
    assert resp.status_code == 200
    body = resp.json()
    assert body["formato"] == "PONTOS_CORRIDOS"
    assert len(body["classificacao"]) == 2
    _assert_no_sensitive_keys(body)


def test_classificacao_equipes_especifica_rejeita_individual_422(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao-equipes rejeita individual com 422."""
    data = _setup_passo7_test_data(db)
    comp_id = data["comp_ind"].id_competicao

    resp = client.get(f"/publico/competicoes/{comp_id}/classificacao-equipes")
    assert resp.status_code == 422
    assert "equipe" in resp.json()["detail"].lower()


def test_classificacao_equipes_especifica_rascunho_404(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao-equipes retorna 404 para rascunho."""
    data = _setup_passo7_test_data(db)
    rascunho_id = data["comp_rascunho"].id_competicao

    resp = client.get(f"/publico/competicoes/{rascunho_id}/classificacao-equipes")
    assert resp.status_code == 404


def test_classificacao_equipes_especifica_inexistente_404(client, db):
    """GET /publico/competicoes/{id_competicao}/classificacao-equipes retorna 404 para inexistente."""
    _setup_passo7_test_data(db)
    resp = client.get("/publico/competicoes/99999/classificacao-equipes")
    assert resp.status_code == 404
