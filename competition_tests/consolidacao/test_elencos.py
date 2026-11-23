"""Testes da consolidacao da Task 7: Elencos — competidores, inscricoes, importacao e copia."""

from __future__ import annotations

import concurrent.futures
from datetime import date
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

import models
from competicoes.contratos.elencos import (
    AlunoImportar,
    CompetidorAtualizar,
    CompetidorCriar,
    CompetidorDetalhe,
    EquipeCriar,
    EquipeDetalhe,
    EquipesCopiar,
    IntegranteAtualizar,
    IntegranteCriar,
    IntegranteDetalhe,
    PaginaCompetidores,
)
from competicoes.erros import ConflitoEstado, Duplicidade, NaoEncontrado
from competicoes.modelos import (
    AuditoriaCompeticao,
    Competidor,
    EdicaoCompeticao,
    Equipe,
    IntegranteEquipe,
)
from competicoes.servicos.elencos import (
    atualizar_competidor,
    copiar_equipes,
    criar_competidor,
    criar_equipe,
    importar_aluno,
    inativar_integrante,
    inscrever_integrante,
    listar_competidores,
    listar_equipes,
    renomear_competidor,
)
from services.alunos import excluir_aluno
from .factories import criar_aluno, criar_competicao, criar_edicao_competicao, criar_equipe as criar_equipe_db


@pytest.fixture()
def edicao_rascunho(db):
    edicao = criar_edicao_competicao(db, estado="RASCUNHO")
    db.commit()
    return edicao


@pytest.fixture()
def equipe_rascunho(db, edicao_rascunho):
    equipe = criar_equipe_db(db, edicao=edicao_rascunho, nome="Equipe Alfa")
    db.commit()
    return equipe


def test_terceiro_sem_aluno_e_cadastrado(db, usuario):
    detalhe = criar_competidor(db, CompetidorCriar(nome="Fulano"), usuario)
    assert isinstance(detalhe, CompetidorDetalhe)
    assert detalhe.id_aluno_origem is None
    assert detalhe.nome == "Fulano"
    assert db.get(Competidor, detalhe.id_competidor) is not None


def test_importar_aluno_duas_vezes_devolve_o_mesmo_competidor(db, usuario):
    aluno = criar_aluno(db, nome="Aluno Teste")
    db.commit()
    id_aluno = aluno.id_aluno

    primeiro = importar_aluno(db, id_aluno, usuario)
    segundo = importar_aluno(db, id_aluno, usuario)

    assert primeiro.id_competidor == segundo.id_competidor
    assert db.query(Competidor).filter_by(id_aluno_origem=id_aluno).count() == 1


def test_importacoes_concorrentes_do_mesmo_aluno_nao_duplicam(sqlite_na_head, usuario):
    """Duas sessões importam o mesmo aluno; a segunda vê o existente ou recebe conflito."""
    SessionFactory = sessionmaker(autoflush=False, bind=sqlite_na_head.engine)
    db_setup = SessionFactory()
    aluno = criar_aluno(db_setup, nome="Aluno Concorrente")
    id_aluno = aluno.id_aluno
    db_setup.commit()
    db_setup.close()

    db1 = SessionFactory()
    res1 = importar_aluno(db1, id_aluno, usuario)
    db1.close()

    db2 = SessionFactory()
    res2 = importar_aluno(db2, id_aluno, usuario)
    db2.close()

    db_check = SessionFactory()
    total = db_check.query(Competidor).filter_by(id_aluno_origem=id_aluno).count()
    assert total == 1
    assert res1.id_competidor == res2.id_competidor
    db_check.close()


def test_importacoes_concorrentes_threads(sqlite_na_head, usuario):
    """Múltiplas threads disputando importar o mesmo aluno."""
    SessionFactory = sessionmaker(autoflush=False, bind=sqlite_na_head.engine)
    db_setup = SessionFactory()
    aluno = criar_aluno(db_setup, nome="Aluno Thread")
    id_aluno = aluno.id_aluno
    db_setup.commit()
    db_setup.close()

    def worker():
        s = SessionFactory()
        try:
            return importar_aluno(s, id_aluno, usuario)
        finally:
            s.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(worker) for _ in range(4)]
        results = [f.result() for f in futures]

    db_check = SessionFactory()
    assert db_check.query(Competidor).filter_by(id_aluno_origem=id_aluno).count() == 1
    ids = {r.id_competidor for r in results}
    assert len(ids) == 1
    db_check.close()


def test_excluir_aluno_preserva_competidor_e_elenco_historico(db, usuario):
    aluno = criar_aluno(db, nome="Aluno Historico")
    db.commit()
    id_aluno = aluno.id_aluno

    competidor_dto = importar_aluno(db, id_aluno, usuario)
    edicao = criar_edicao_competicao(db, estado="RASCUNHO")
    equipe = criar_equipe_db(db, edicao=edicao, nome="Time Historico")
    db.commit()

    integrante = inscrever_integrante(
        db,
        equipe.id_equipe,
        IntegranteCriar(id_competidor=competidor_dto.id_competidor, nome_esportivo="Zico"),
        usuario,
    )

    excluir_aluno(db, id_aluno)

    competidor = db.get(Competidor, competidor_dto.id_competidor)
    assert competidor is not None
    assert competidor.id_aluno_origem is None
    integrante_db = db.get(IntegranteEquipe, integrante.id_integrante)
    assert integrante_db is not None
    assert integrante_db.nome_esportivo == "Zico"


def test_importar_nao_traz_dados_escolares(db, usuario):
    aluno = criar_aluno(db, nome="Aluno Sem Escolares")
    aluno.documento_pessoal = "RG-123456"
    aluno.foto = "https://example.com/foto.jpg"
    db.commit()

    detalhe = importar_aluno(db, aluno.id_aluno, usuario)
    assert not hasattr(detalhe, "id_turma")
    assert not hasattr(detalhe, "responsavel")
    assert not hasattr(detalhe, "escola")
    assert not hasattr(detalhe, "serie_ano")
    # R26: documento_pessoal é anexo escolar e NÃO vira documento do competidor
    assert detalhe.documento is None
    assert detalhe.foto_url == "https://example.com/foto.jpg"
    assert detalhe.nome == "Aluno Sem Escolares"


def test_importar_aluno_inexistente_levanta_nao_encontrado(db, usuario):
    with pytest.raises(NaoEncontrado) as exc_info:
        importar_aluno(db, 999999, usuario)
    assert "id_aluno" in exc_info.value.campos


def test_competidor_em_duas_equipes_da_mesma_edicao_e_conflito(db, usuario, edicao_rascunho):
    competidor = criar_competidor(db, CompetidorCriar(nome="Craque"), usuario)
    equipe_a = criar_equipe(db, edicao_rascunho.id_edicao_competicao, EquipeCriar(nome="Time A"), usuario)
    equipe_b = criar_equipe(db, edicao_rascunho.id_edicao_competicao, EquipeCriar(nome="Time B"), usuario)

    dados = IntegranteCriar(id_competidor=competidor.id_competidor, nome_esportivo="Craque")
    inscrever_integrante(db, equipe_a.id_equipe, dados, usuario)

    with pytest.raises(Duplicidade):
        inscrever_integrante(db, equipe_b.id_equipe, dados, usuario)


def test_mesmo_competidor_em_edicoes_diferentes_e_permitido(db, usuario):
    competidor = criar_competidor(db, CompetidorCriar(nome="Craque Multiedicoes"), usuario)
    edicao_1 = criar_edicao_competicao(db, identificacao="2026-1", estado="RASCUNHO")
    edicao_2 = criar_edicao_competicao(db, identificacao="2026-2", estado="RASCUNHO")
    db.commit()

    equipe_1 = criar_equipe(db, edicao_1.id_edicao_competicao, EquipeCriar(nome="Time 1"), usuario)
    equipe_2 = criar_equipe(db, edicao_2.id_edicao_competicao, EquipeCriar(nome="Time 2"), usuario)

    dados = IntegranteCriar(id_competidor=competidor.id_competidor, nome_esportivo="Craque")
    int_1 = inscrever_integrante(db, equipe_1.id_equipe, dados, usuario)
    int_2 = inscrever_integrante(db, equipe_2.id_equipe, dados, usuario)

    assert int_1.id_integrante != int_2.id_integrante
    assert int_1.id_edicao_competicao == edicao_1.id_edicao_competicao
    assert int_2.id_edicao_competicao == edicao_2.id_edicao_competicao


def test_camisa_repetida_e_aceita(db, usuario, equipe_rascunho):
    c1 = criar_competidor(db, CompetidorCriar(nome="Jogador 1"), usuario)
    c2 = criar_competidor(db, CompetidorCriar(nome="Jogador 2"), usuario)

    int_1 = inscrever_integrante(
        db, equipe_rascunho.id_equipe,
        IntegranteCriar(id_competidor=c1.id_competidor, nome_esportivo="J1", numero_camisa=10),
        usuario,
    )
    int_2 = inscrever_integrante(
        db, equipe_rascunho.id_equipe,
        IntegranteCriar(id_competidor=c2.id_competidor, nome_esportivo="J2", numero_camisa=10),
        usuario,
    )

    assert int_1.numero_camisa == 10
    assert int_2.numero_camisa == 10


def test_alterar_nome_do_competidor_nao_reescreve_nome_esportivo(db, usuario, equipe_rascunho):
    competidor = criar_competidor(db, CompetidorCriar(nome="Arthur Antunes Coimbra"), usuario)
    integrante = inscrever_integrante(
        db, equipe_rascunho.id_equipe,
        IntegranteCriar(id_competidor=competidor.id_competidor, nome_esportivo="Zico"),
        usuario,
    )

    renomear_competidor(db, competidor.id_competidor, "Arthur Antunes", usuario)

    db_competidor = db.get(Competidor, competidor.id_competidor)
    assert db_competidor.nome == "Arthur Antunes"
    db_integrante = db.get(IntegranteEquipe, integrante.id_integrante)
    assert db_integrante.nome_esportivo == "Zico"


def test_inscrever_em_equipe_de_outra_edicao_e_rejeitado(db, usuario):
    competidor = criar_competidor(db, CompetidorCriar(nome="Atleta"), usuario)
    edicao_andamento = criar_edicao_competicao(db, identificacao="2026-A", estado="EM_ANDAMENTO")
    equipe_andamento = criar_equipe_db(db, edicao=edicao_andamento, nome="Time Andamento")
    db.commit()

    dados = IntegranteCriar(id_competidor=competidor.id_competidor, nome_esportivo="Atleta")
    with pytest.raises(ConflitoEstado):
        inscrever_integrante(db, equipe_andamento.id_equipe, dados, usuario)


def test_copiar_equipes_cria_inscricoes_novas_reusando_competidores(db, usuario):
    edicao_origem = criar_edicao_competicao(db, identificacao="2025", estado="FINALIZADA")
    edicao_destino = criar_edicao_competicao(db, identificacao="2026", estado="RASCUNHO")
    db.commit()

    c1 = criar_competidor(db, CompetidorCriar(nome="Competidor 1"), usuario)
    c2 = criar_competidor(db, CompetidorCriar(nome="Competidor 2"), usuario)

    eq_origem_1 = criar_equipe_db(db, edicao=edicao_origem, nome="Origem 1", sigla="O1")
    eq_origem_2 = criar_equipe_db(db, edicao=edicao_origem, nome="Origem 2", sigla="O2")
    db.commit()

    int_origem_1 = novo_integrante_local(eq_origem_1, c1, nome_esportivo="Apelido 1", numero_camisa=7)
    int_origem_2 = novo_integrante_local(eq_origem_2, c2, nome_esportivo="Apelido 2", numero_camisa=9)
    db.add_all([int_origem_1, int_origem_2])
    db.commit()

    equipes_copiadas = copiar_equipes(
        db, edicao_origem.id_edicao_competicao, edicao_destino.id_edicao_competicao, usuario
    )

    nomes_da_origem = {eq_origem_1.nome, eq_origem_2.nome}
    assert {e.nome for e in equipes_copiadas} == nomes_da_origem

    # Verifica integridade das cópias
    todas_inscricoes = [i for eq in equipes_copiadas for i in eq.integrantes]
    assert len(todas_inscricoes) == 2
    competidores_reusados = {i.id_competidor for i in todas_inscricoes} == {c1.id_competidor, c2.id_competidor}
    ids_de_integrante_distintos = {i.id_integrante for i in todas_inscricoes}.isdisjoint(
        {int_origem_1.id_integrante, int_origem_2.id_integrante}
    )
    assert competidores_reusados
    assert ids_de_integrante_distintos


def test_copiar_equipes_exige_destino_em_rascunho(db, usuario):
    edicao_origem = criar_edicao_competicao(db, identificacao="2025-O", estado="FINALIZADA")
    edicao_destino_em_andamento = criar_edicao_competicao(db, identificacao="2026-D", estado="EM_ANDAMENTO")
    db.commit()

    with pytest.raises(ConflitoEstado):
        copiar_equipes(
            db, edicao_origem.id_edicao_competicao, edicao_destino_em_andamento.id_edicao_competicao, usuario
        )


def test_copiar_equipes_e_atomico(db, usuario):
    """Falha no meio não deixa equipe parcial no destino."""
    edicao_origem = criar_edicao_competicao(db, identificacao="2025-A", estado="FINALIZADA")
    edicao_destino = criar_edicao_competicao(db, identificacao="2026-A", estado="RASCUNHO")
    db.commit()

    criar_equipe_db(db, edicao=edicao_origem, nome="Time 1")
    criar_equipe_db(db, edicao=edicao_origem, nome="Time 2")
    db.commit()

    contador = {"chamadas": 0}
    original_add = db.add

    def mock_add(instancia):
        if isinstance(instancia, Equipe) and instancia.nome == "Time 2":
            raise RuntimeError("Falha simulada na criacao da segunda equipe")
        return original_add(instancia)

    with patch.object(db, "add", side_effect=mock_add):
        with pytest.raises(RuntimeError):
            copiar_equipes(
                db, edicao_origem.id_edicao_competicao, edicao_destino.id_edicao_competicao, usuario
            )

    # Nenhuma equipe deve ter sido persistida no destino
    assert db.query(Equipe).filter_by(id_edicao_competicao=edicao_destino.id_edicao_competicao).count() == 0


def test_equipe_pode_ser_criada_vazia_em_rascunho(db, usuario, edicao_rascunho):
    detalhe = criar_equipe(db, edicao_rascunho.id_edicao_competicao, EquipeCriar(nome="Azul"), usuario)
    assert detalhe.integrantes == []
    assert detalhe.nome == "Azul"
    assert detalhe.situacao == "ATIVA"


def test_nome_equipe_duplicado_na_mesma_edicao_rejeitado(db, usuario, edicao_rascunho):
    criar_equipe(db, edicao_rascunho.id_edicao_competicao, EquipeCriar(nome="Amarelo"), usuario)
    with pytest.raises(Duplicidade) as exc_info:
        criar_equipe(db, edicao_rascunho.id_edicao_competicao, EquipeCriar(nome="Amarelo"), usuario)
    assert "nome" in exc_info.value.campos


def test_inativar_integrante_preserva_registro(db, usuario, equipe_rascunho):
    competidor = criar_competidor(db, CompetidorCriar(nome="Para Inativar"), usuario)
    integrante = inscrever_integrante(
        db, equipe_rascunho.id_equipe,
        IntegranteCriar(id_competidor=competidor.id_competidor, nome_esportivo="PI"),
        usuario,
    )

    detalhe = inativar_integrante(db, integrante.id_integrante, usuario)
    assert detalhe.situacao == "INATIVO"
    db_integrante = db.get(IntegranteEquipe, integrante.id_integrante)
    assert db_integrante is not None
    assert db_integrante.situacao == "INATIVO"


def test_listar_competidores_busca_e_paginacao(db, usuario):
    c1 = criar_competidor(db, CompetidorCriar(nome="Ana Maria"), usuario)
    c2 = criar_competidor(db, CompetidorCriar(nome="Ana Clara"), usuario)
    c3 = criar_competidor(db, CompetidorCriar(nome="Bruno Silva"), usuario)

    todas = listar_competidores(db, busca=None, pagina=1, tamanho=10)
    assert todas.total >= 3

    busca_ana = listar_competidores(db, busca="Ana", pagina=1, tamanho=10)
    assert busca_ana.total == 2
    assert {c.nome for c in busca_ana.itens} == {"Ana Maria", "Ana Clara"}

    paginada = listar_competidores(db, busca="Ana", pagina=1, tamanho=1)
    assert len(paginada.itens) == 1
    assert paginada.total == 2
    assert paginada.pagina == 1
    assert paginada.tamanho == 1


def test_listar_equipes(db, usuario, edicao_rascunho):
    criar_equipe(db, edicao_rascunho.id_edicao_competicao, EquipeCriar(nome="Beta"), usuario)
    criar_equipe(db, edicao_rascunho.id_edicao_competicao, EquipeCriar(nome="Gama"), usuario)

    equipes = listar_equipes(db, edicao_rascunho.id_edicao_competicao)
    assert len(equipes) >= 2
    nomes = [e.nome for e in equipes]
    assert "Beta" in nomes
    assert "Gama" in nomes


def test_operacoes_de_escrita_gravam_auditoria(db, usuario, edicao_rascunho):
    c = criar_competidor(db, CompetidorCriar(nome="Auditavel"), usuario)
    auditoria_c = db.query(AuditoriaCompeticao).filter_by(
        entidade="competidores", id_entidade=c.id_competidor, acao="CRIAR"
    ).first()
    assert auditoria_c is not None
    assert auditoria_c.id_usuario_responsavel == usuario.id_usuario

    eq = criar_equipe(db, edicao_rascunho.id_edicao_competicao, EquipeCriar(nome="Equipe Auditavel"), usuario)
    auditoria_eq = db.query(AuditoriaCompeticao).filter_by(
        entidade="equipes", id_entidade=eq.id_equipe, acao="CRIAR"
    ).first()
    assert auditoria_eq is not None
    assert auditoria_eq.id_edicao_competicao == edicao_rascunho.id_edicao_competicao

    integ = inscrever_integrante(
        db, eq.id_equipe,
        IntegranteCriar(id_competidor=c.id_competidor, nome_esportivo="Aud"),
        usuario,
    )
    auditoria_integ = db.query(AuditoriaCompeticao).filter_by(
        entidade="integrantes_equipe", id_entidade=integ.id_integrante, acao="CRIAR"
    ).first()
    assert auditoria_integ is not None


@pytest.mark.parametrize("papel,esperado", [(None, 401), ("professor", 403), ("coordenador", 201)])
def test_permissao_de_escrita_por_papel(client, cabecalhos_por_papel, papel, esperado):
    cabecalhos = cabecalhos_por_papel(papel)
    resp = client.post("/competicoes/competidores", json={"nome": "Competidor Permissao"}, headers=cabecalhos)
    assert resp.status_code == esperado


def test_endpoints_api_completos(client, cabecalhos_por_papel, db, edicao_rascunho):
    headers_coord = cabecalhos_por_papel("coordenador")
    headers_prof = cabecalhos_por_papel("professor")

    # 1. POST /competidores
    resp = client.post("/competicoes/competidores", json={"nome": "Competidor API"}, headers=headers_coord)
    assert resp.status_code == 201
    id_c = resp.json()["id_competidor"]

    # 2. GET /competidores (leitura permitida a professor)
    resp = client.get("/competicoes/competidores?busca=API", headers=headers_prof)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # 3. PATCH /competidores/{id}
    resp = client.patch(f"/competicoes/competidores/{id_c}", json={"nome": "Competidor Renomeado"}, headers=headers_coord)
    assert resp.status_code == 200
    assert resp.json()["nome"] == "Competidor Renomeado"

    # 4. POST /competidores/importar-aluno
    aluno = criar_aluno(db, nome="Aluno API")
    db.commit()
    resp_imp1 = client.post("/competicoes/competidores/importar-aluno", json={"id_aluno": aluno.id_aluno}, headers=headers_coord)
    assert resp_imp1.status_code == 201
    # Idempotência: segunda importação retorna 200
    resp_imp2 = client.post("/competicoes/competidores/importar-aluno", json={"id_aluno": aluno.id_aluno}, headers=headers_coord)
    assert resp_imp2.status_code == 200
    assert resp_imp1.json()["id_competidor"] == resp_imp2.json()["id_competidor"]

    # 5. POST /edicoes/{id}/equipes
    resp_eq = client.post(
        f"/competicoes/edicoes/{edicao_rascunho.id_edicao_competicao}/equipes",
        json={"nome": "Equipe API", "sigla": "EAPI"},
        headers=headers_coord,
    )
    assert resp_eq.status_code == 201
    id_equipe = resp_eq.json()["id_equipe"]

    # 6. GET /edicoes/{id}/equipes
    resp_get_eq = client.get(f"/competicoes/edicoes/{edicao_rascunho.id_edicao_competicao}/equipes", headers=headers_prof)
    assert resp_get_eq.status_code == 200
    assert any(e["id_equipe"] == id_equipe for e in resp_get_eq.json())

    # 7. POST /equipes/{id}/integrantes
    resp_int = client.post(
        f"/competicoes/equipes/{id_equipe}/integrantes",
        json={"id_competidor": id_c, "nome_esportivo": "API Player", "numero_camisa": 11},
        headers=headers_coord,
    )
    assert resp_int.status_code == 201
    id_integrante = resp_int.json()["id_integrante"]

    # 8. PATCH /integrantes/{id}
    resp_inativar = client.patch(
        f"/competicoes/integrantes/{id_integrante}",
        json={"situacao": "INATIVO"},
        headers=headers_coord,
    )
    assert resp_inativar.status_code == 200
    assert resp_inativar.json()["situacao"] == "INATIVO"

    # 9. POST /edicoes/{id}/copiar-equipes
    edicao_dest = criar_edicao_competicao(db, identificacao="2027", estado="RASCUNHO")
    db.commit()
    resp_copia = client.post(
        f"/competicoes/edicoes/{edicao_dest.id_edicao_competicao}/copiar-equipes",
        json={"id_edicao_origem": edicao_rascunho.id_edicao_competicao},
        headers=headers_coord,
    )
    assert resp_copia.status_code == 201
    assert any(e["nome"] == "Equipe API" for e in resp_copia.json())


def novo_integrante_local(equipe, competidor, **campos):
    return IntegranteEquipe(
        **(
            {
                "id_edicao_competicao": equipe.id_edicao_competicao,
                "id_equipe": equipe.id_equipe,
                "id_competidor": competidor.id_competidor,
                "nome_esportivo": competidor.nome,
            }
            | campos
        )
    )
