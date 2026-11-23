"""Teste de integracao ponta a ponta e regressao da fatia 1."""

from datetime import date
import pytest
from models import Modalidade
from . import factories


def test_ciclo_completo_da_fatia_1(client, cabecalhos_por_papel, usuario, db):
    headers_coord = cabecalhos_por_papel("coordenador")
    headers_leitura = cabecalhos_por_papel("professor")

    # 1. Cria modalidade base se necessario
    mod = db.query(Modalidade).first()
    if not mod:
        mod = Modalidade(nome="Futebol de Campo")
        db.add(mod)
        db.commit()
        db.refresh(mod)
    id_modalidade = mod.id_modalidade

    # 2. Criar Evento com Edicao
    res_evento = client.post(
        "/competicoes/eventos",
        headers=headers_coord,
        json={
            "nome": "Jogos Universitarios 2026",
            "descricao": "Edicao anual",
            "edicao": {
                "identificacao": "2026",
                "data_inicio": "2026-06-01",
                "data_fim": "2026-06-30",
            },
        },
    )
    assert res_evento.status_code == 201
    dados_evento = res_evento.json()
    id_evento = dados_evento["id_evento"]
    id_edicao_evento = dados_evento["edicoes"][0]["id_edicao_evento"]

    # 3. Criar Competicao com Edicao vinculada ao Evento
    res_comp = client.post(
        "/competicoes/competicoes",
        headers=headers_coord,
        json={
            "nome": "Torneio Interclasses Futebol",
            "id_modalidade": id_modalidade,
            "edicao": {
                "identificacao": "2026",
                "id_edicao_evento": id_edicao_evento,
                "data_inicio": "2026-06-05",
                "data_fim": "2026-06-25",
                "formato": "PONTOS_CORRIDOS",
                "configuracao": {
                    "formato": "PONTOS_CORRIDOS",
                    "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                    "desempates": ["SALDO_GOLS", "VITORIAS"],
                    "turno_e_returno": False,
                },
            },
        },
    )
    assert res_comp.status_code == 201
    dados_comp = res_comp.json()
    id_comp = dados_comp["id_competicao"]
    edicao_2026 = dados_comp["edicoes"][0]
    id_edicao_2026 = edicao_2026["id_edicao_competicao"]

    # 4. Criar Equipes na Edicao 2026
    res_eq_a = client.post(
        f"/competicoes/edicoes/{id_edicao_2026}/equipes",
        headers=headers_coord,
        json={"nome": "Engenharia FC", "sigla": "ENG"},
    )
    assert res_eq_a.status_code == 201
    id_eq_a = res_eq_a.json()["id_equipe"]

    res_eq_b = client.post(
        f"/competicoes/edicoes/{id_edicao_2026}/equipes",
        headers=headers_coord,
        json={"nome": "Medicina FC", "sigla": "MED"},
    )
    assert res_eq_b.status_code == 201
    id_eq_b = res_eq_b.json()["id_equipe"]

    # 5. Criar Competidor Terceiro Avulso
    res_terceiro = client.post(
        "/competicoes/competidores",
        headers=headers_coord,
        json={"nome": "Carlos Silva", "documento": "123456789"},
    )
    assert res_terceiro.status_code == 201
    id_comp_terceiro = res_terceiro.json()["id_competidor"]

    # 6. Importar Aluno Escolar
    aluno = factories.criar_aluno(db, nome="Aluno Gabriel")
    db.commit()

    res_imp = client.post(
        "/competicoes/competidores/importar-aluno",
        headers=headers_coord,
        json={"id_aluno": aluno.id_aluno},
    )
    assert res_imp.status_code in (200, 201)
    id_comp_aluno = res_imp.json()["id_competidor"]

    # 7. Inscrever Integrantes nas Equipes
    res_int1 = client.post(
        f"/competicoes/equipes/{id_eq_a}/integrantes",
        headers=headers_coord,
        json={
            "id_competidor": id_comp_terceiro,
            "nome_esportivo": "Carlinhos",
            "numero_camisa": 10,
            "posicao": "Atacante",
        },
    )
    assert res_int1.status_code == 201
    id_integrante_a = res_int1.json()["id_integrante"]

    res_int2 = client.post(
        f"/competicoes/equipes/{id_eq_b}/integrantes",
        headers=headers_coord,
        json={
            "id_competidor": id_comp_aluno,
            "nome_esportivo": "Gabriel",
            "numero_camisa": 1,
            "posicao": "Goleiro",
        },
    )
    assert res_int2.status_code == 201
    id_integrante_b = res_int2.json()["id_integrante"]

    # 8. Criar Edicao 2027 (RASCUNHO) e Copiar Equipes
    res_ed_2027 = client.post(
        f"/competicoes/competicoes/{id_comp}/edicoes",
        headers=headers_coord,
        json={
            "identificacao": "2027",
            "data_inicio": "2027-06-01",
            "data_fim": "2027-06-30",
            "formato": "PONTOS_CORRIDOS",
            "configuracao": {
                "formato": "PONTOS_CORRIDOS",
                "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                "desempates": ["SALDO_GOLS", "VITORIAS"],
                "turno_e_returno": False,
            },
        },
    )
    assert res_ed_2027.status_code == 201
    id_edicao_2027 = res_ed_2027.json()["id_edicao_competicao"]

    res_copia = client.post(
        f"/competicoes/edicoes/{id_edicao_2027}/copiar-equipes",
        headers=headers_coord,
        json={"id_edicao_origem": id_edicao_2026},
    )
    assert res_copia.status_code == 201
    equipes_2027 = res_copia.json()
    assert len(equipes_2027) == 2
    nomes_2027 = {eq["nome"] for eq in equipes_2027}
    assert nomes_2027 == {"Engenharia FC", "Medicina FC"}

    # Verifica que competidores foram reusados com novos ids de integrante
    ids_integrantes_2027 = set()
    competidores_2027 = set()
    for eq in equipes_2027:
        for it in eq["integrantes"]:
            ids_integrantes_2027.add(it["id_integrante"])
            competidores_2027.add(it["id_competidor"])

    assert {id_integrante_a, id_integrante_b}.isdisjoint(ids_integrantes_2027)
    assert competidores_2027 == {id_comp_terceiro, id_comp_aluno}

    # 9. Publicar Edicao 2026
    res_pub = client.post(
        f"/competicoes/edicoes/{id_edicao_2026}/publicar",
        headers=headers_coord,
        json={"publicada": True},
    )
    assert res_pub.status_code == 200
    assert res_pub.json()["publicada"] is True


def test_duas_edicoes_nao_misturam_inscricoes(client, cabecalhos_por_papel, usuario, db):
    headers_coord = cabecalhos_por_papel("coordenador")
    mod = db.query(Modalidade).first()
    if not mod:
        mod = Modalidade(nome="Futsal")
        db.add(mod)
        db.commit()

    # Cria duas edições independentes
    res_comp = client.post(
        "/competicoes/competicoes",
        headers=headers_coord,
        json={
            "nome": "Copa Mista",
            "id_modalidade": mod.id_modalidade,
            "edicao": {
                "identificacao": "E1",
                "data_inicio": "2026-01-01",
                "data_fim": "2026-01-31",
                "formato": "MATA_MATA",
                "configuracao": {"formato": "MATA_MATA"},
            },
        },
    )
    id_comp = res_comp.json()["id_competicao"]
    id_ed1 = res_comp.json()["edicoes"][0]["id_edicao_competicao"]

    res_ed2 = client.post(
        f"/competicoes/competicoes/{id_comp}/edicoes",
        headers=headers_coord,
        json={
            "identificacao": "E2",
            "data_inicio": "2026-02-01",
            "data_fim": "2026-02-28",
            "formato": "MATA_MATA",
            "configuracao": {"formato": "MATA_MATA"},
        },
    )
    id_ed2 = res_ed2.json()["id_edicao_competicao"]

    # Cria equipes em cada edição
    eq1 = client.post(f"/competicoes/edicoes/{id_ed1}/equipes", headers=headers_coord, json={"nome": "Time 1"}).json()
    eq2 = client.post(f"/competicoes/edicoes/{id_ed2}/equipes", headers=headers_coord, json={"nome": "Time 2"}).json()

    # Cria competidor
    comp = client.post("/competicoes/competidores", headers=headers_coord, json={"nome": "Atleta Versatil"}).json()
    id_c = comp["id_competidor"]

    # Inscreve o mesmo competidor em edições distintas
    int1 = client.post(f"/competicoes/equipes/{eq1['id_equipe']}/integrantes", headers=headers_coord, json={
        "id_competidor": id_c, "nome_esportivo": "Atleta E1"
    }).json()

    int2 = client.post(f"/competicoes/equipes/{eq2['id_equipe']}/integrantes", headers=headers_coord, json={
        "id_competidor": id_c, "nome_esportivo": "Atleta E2"
    }).json()

    assert int1["id_integrante"] != int2["id_integrante"]
    assert int1["id_edicao_competicao"] == id_ed1
    assert int2["id_edicao_competicao"] == id_ed2


def test_nenhum_consumidor_das_rotas_retiradas(client):
    rotas_retiradas = [
        "/competicoes/",
        "/confrontos/",
        "/individuais/",
        "/classificacao/",
        "/v2/competicoes",
        "/v2/publico/eventos",
        "/equipes/",
        "/partidas/",
        "/edicoes/",
    ]
    for rota in rotas_retiradas:
        res = client.get(rota)
        assert res.status_code in (404, 405), f"Rota {rota} deveria responder 404/405, respondeu {res.status_code}"

    # /atletas/equipe/{id} responde 410 Gone (método POST)
    res_atleta = client.post("/atletas/equipe/1")
    assert res_atleta.status_code == 410


def test_regressao_de_escolinhas_apos_consolidacao(client, cabecalhos_por_papel, db):
    headers_coord = cabecalhos_por_papel("coordenador")

    # 1. Criar modalidade
    res_mod = client.post("/modalidades/", headers=headers_coord, json={"nome": "Voleibol Escolar"})
    assert res_mod.status_code == 201
    id_modalidade = res_mod.json()["id_modalidade"]

    # 2. Criar professor
    res_prof = client.post(
        "/professores/",
        headers=headers_coord,
        json={
            "nome": "Prof. Roberto",
            "cpf": "12345678909",
            "contato": "11999998888",
            "username": "prof_roberto_e2e",
            "password": "password123",
        },
    )
    assert res_prof.status_code == 201
    id_prof = res_prof.json()["id_professor"]

    # 3. Criar turma
    res_turma = client.post(
        "/turmas/",
        headers=headers_coord,
        json={
            "id_modalidade": id_modalidade,
            "id_professor": id_prof,
            "descricao": "Turma Sub-15 Volei",
            "categoria_idade": "Sub 15",
            "horario_inicio": "15:00:00",
            "horario_fim": "16:00:00",
            "dias_semana": ["SEG", "QUA"],
        },
    )
    assert res_turma.status_code == 201
    id_turma = res_turma.json()["id_turma"]

    # 4. Criar aluno
    aluno = factories.criar_aluno(db, nome="Aluno Marcos E2E")
    db.commit()

    # 5. Matricular aluno na turma
    res_mat = client.post(
        "/matriculas/",
        headers=headers_coord,
        json={"id_aluno": aluno.id_aluno, "id_turma": id_turma},
    )
    assert res_mat.status_code == 201
    id_mat = res_mat.json()["id_matricula"]

    # 6. Registrar presenca em lote
    res_pres = client.post(
        "/presencas/lote",
        headers=headers_coord,
        json={
            "id_turma": id_turma,
            "data_aula": "2026-06-10",
            "presencas": [{"id_matricula": id_mat, "status": "Presente"}],
        },
    )
    assert res_pres.status_code == 201
