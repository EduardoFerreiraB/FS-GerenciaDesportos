"""Contratos da fundacao e atomicidade das operacoes de competicoes."""

from datetime import date

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from competicoes.contratos.configuracao import validar_configuracao
from competicoes.contratos.elencos import (
    CompetidorCriar, CompetidorDetalhe, EquipeCriar, IntegranteCriar,
    PaginaCompetidores,
)
from competicoes.contratos.organizacao import (
    CompeticaoComEdicaoCriar, EdicaoCompeticaoAtualizar,
    EdicaoCompeticaoCriar, EdicaoEventoAtualizar, EdicaoEventoCriar, EventoComEdicaoCriar,
)
from competicoes.erros import (
    ConfiguracaoInvalida, ConflitoEstado, ConflitoRevisao, Duplicidade,
    NaoEncontrado, registrar_tratadores,
)
from competicoes.infra import (
    bloquear_edicao, conferir_revisao, incrementar_revisao,
    registrar_auditoria, transacao,
)
from competicoes.modelos import AuditoriaCompeticao, Evento
from .factories import criar_edicao_competicao, criar_evento


def test_configuracao_aplica_defaults_de_pontuacao_e_disciplina():
    config = validar_configuracao("PONTOS_CORRIDOS", {"desempates": ["SALDO_GOLS"]})
    assert config.model_dump(mode="json") == {
        "formato": "PONTOS_CORRIDOS",
        "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
        "desempates": ["SALDO_GOLS"], "turno_e_returno": False,
        "disciplina": {"limite_amarelos": 3, "jogos_por_acumulo": 1,
                       "jogos_por_vermelho": 1, "jogos_por_segundo_amarelo": 1,
                       "zerar_amarelos_ao_encerrar_grupos": False},
    }


def test_configuracao_grupos_e_eliminatoria_aplicam_defaults():
    grupos = validar_configuracao("GRUPOS_MATA_MATA", {
        "desempates": ["VITORIAS", "CONFRONTO_DIRETO"],
        "quantidade_grupos": 2, "classificados_por_grupo": 2,
    })
    assert grupos.final_unica is True
    assert grupos.turno_e_returno_grupos is False
    assert grupos.ida_volta_eliminatoria is False
    mata_mata = validar_configuracao("MATA_MATA", {"disciplina": {"limite_amarelos": None}})
    assert mata_mata.disciplina.limite_amarelos is None
    assert mata_mata.ida_volta is False and mata_mata.terceiro_lugar is False


@pytest.mark.parametrize("formato,dados,campo", [
    ("MATA_MATA", {"gol_fora_de_casa": True}, "gol_fora_de_casa"),
    ("MATA_MATA", {"disciplina": {"desconhecido": 1}}, "disciplina.desconhecido"),
    ("MATA_MATA", {"formato": "PONTOS_CORRIDOS"}, "formato"),
    ("GRUPOS", {}, "formato"),
    ("PONTOS_CORRIDOS", {"quantidade_grupos": 4}, "quantidade_grupos"),
    ("PONTOS_CORRIDOS", {"desempates": []}, "desempates"),
    ("PONTOS_CORRIDOS", {"desempates": ["SALDO_GOLS", "SALDO_GOLS"]}, "desempates"),
    ("PONTOS_CORRIDOS", {"desempates": ["ID"]}, "desempates.0"),
    ("PONTOS_CORRIDOS", {"desempates": ["VITORIAS"], "pontuacao": {"vitoria": -1}}, "pontuacao.vitoria"),
    ("PONTOS_CORRIDOS", {"desempates": ["VITORIAS"], "pontuacao": {"empate": True}}, "pontuacao.empate"),
    ("PONTOS_CORRIDOS", {"desempates": ["VITORIAS"], "pontuacao": {"derrota": "1"}}, "pontuacao.derrota"),
    ("MATA_MATA", {"disciplina": {"limite_amarelos": 0}}, "disciplina.limite_amarelos"),
    ("MATA_MATA", {"disciplina": {"jogos_por_acumulo": 0}}, "disciplina.jogos_por_acumulo"),
    ("MATA_MATA", {"disciplina": {"jogos_por_vermelho": -1}}, "disciplina.jogos_por_vermelho"),
    ("MATA_MATA", {"disciplina": {"jogos_por_segundo_amarelo": 0}}, "disciplina.jogos_por_segundo_amarelo"),
    ("GRUPOS_MATA_MATA", {"desempates": ["VITORIAS"], "quantidade_grupos": 0,
                           "classificados_por_grupo": 1}, "quantidade_grupos"),
])
def test_configuracao_recusa_dados_invalidos_com_campos(formato, dados, campo):
    with pytest.raises(ConfiguracaoInvalida) as erro:
        validar_configuracao(formato, dados)
    assert campo in erro.value.campos


def test_defaults_nao_compartilham_estado_e_entrada_nao_e_mutada():
    dados = {"desempates": ["VITORIAS"]}
    primeiro = validar_configuracao("PONTOS_CORRIDOS", dados)
    primeiro.pontuacao.vitoria = 10
    assert validar_configuracao("PONTOS_CORRIDOS", dados).pontuacao.vitoria == 3
    assert dados == {"desempates": ["VITORIAS"]}


def test_contratos_criacao_aceitam_dados_tipados_e_exigem_revisao():
    edicao = EdicaoCompeticaoCriar(
        identificacao="2026", data_inicio=date(2026, 1, 1), data_fim=date(2026, 12, 31),
        formato="MATA_MATA", configuracao={"formato": "MATA_MATA"},
    )
    dados = CompeticaoComEdicaoCriar(nome="Copa", id_modalidade=1, edicao=edicao)
    assert dados.edicao.id_edicao_evento is None
    assert dados.edicao.configuracao.final_unica is True
    evento = EventoComEdicaoCriar(nome="Jogos", edicao={
        "identificacao": "2026", "data_inicio": "2026-01-01", "data_fim": "2026-12-31",
    })
    assert evento.edicao.data_inicio == date(2026, 1, 1)
    with pytest.raises(ValidationError):
        EdicaoCompeticaoAtualizar(**edicao.model_dump())
    with pytest.raises(ValidationError):
        EdicaoCompeticaoCriar(**(edicao.model_dump() | {"formato": "PONTOS_CORRIDOS"}))


def test_contratos_elenco_recusam_campos_escolares_e_nao_exigem_camisa():
    assert CompetidorCriar(nome="Ana").data_nascimento is None
    assert EquipeCriar(nome="Azul").sigla is None
    assert IntegranteCriar(id_competidor=1, nome_esportivo="Ana").numero_camisa is None
    with pytest.raises(ValidationError):
        CompetidorCriar(nome="Ana", escola="Privado")
    with pytest.raises(ValidationError):
        CompetidorCriar(nome="   ")
    with pytest.raises(ValidationError):
        IntegranteCriar(id_competidor=0, nome_esportivo="Ana")
    with pytest.raises(ValidationError):
        PaginaCompetidores(itens=[], total=0, pagina=0, tamanho=20)
    assert PaginaCompetidores(itens=[], total=0, pagina=1, tamanho=20).itens == []
    assert "escola" not in CompetidorDetalhe.model_fields


def test_revisao_rejeita_desatualizada_e_incrementa(db):
    edicao = criar_edicao_competicao(db, revisao=3)
    with pytest.raises(ConflitoRevisao) as erro:
        conferir_revisao(edicao, 2)
    assert erro.value.campos == ["revisao"] and edicao.revisao == 3
    conferir_revisao(edicao, 3)
    incrementar_revisao(edicao)
    assert edicao.revisao == 4


def test_bloquear_edicao_sqlite_retorna_registro_e_recusa_inexistente(db):
    edicao = criar_edicao_competicao(db)
    assert bloquear_edicao(db, edicao.id_edicao_competicao).id_edicao_competicao == edicao.id_edicao_competicao
    with pytest.raises(NaoEncontrado):
        bloquear_edicao(db, 999999)


def test_bloqueio_mysql_emite_for_update_e_refresca_entidade(db):
    from sqlalchemy.dialects import mysql

    edicao = criar_edicao_competicao(db)
    db.commit()
    instrucoes = []

    # Captura o SQL produzido para MySQL sem executar SQL MySQL no SQLite.
    def capturar(estado):
        instrucoes.append((str(estado.statement.compile(dialect=mysql.dialect())),
                           estado.execution_options.get("populate_existing")))

    dialeto = db.get_bind().dialect
    nome_original = dialeto.name
    event.listen(db, "do_orm_execute", capturar)
    try:
        dialeto.name = "mysql"
        bloquear_edicao(db, edicao.id_edicao_competicao)
    finally:
        dialeto.name = nome_original
        event.remove(db, "do_orm_execute", capturar)
    assert any("FOR UPDATE" in sql and atualizar for sql, atualizar in instrucoes)


def test_transacao_faz_commit_ao_sair(db):
    with transacao(db):
        evento = criar_evento(db)
    with Session(db.get_bind()) as outra:
        assert outra.get(Evento, evento.id_evento).nome == evento.nome


def test_transacao_faz_rollback_em_excecao(db):
    with pytest.raises(ValueError):
        with transacao(db):
            criar_evento(db)
            raise ValueError("Falha de negocio")
    assert db.query(Evento).count() == 0


def test_transacao_faz_rollback_se_commit_falhar(db):
    with pytest.raises(IntegrityError):
        with transacao(db):
            criar_evento(db, slug="duplicado")
            db.add(Evento(nome="Outro", slug="duplicado"))
    assert db.query(Evento).count() == 0


def test_auditoria_preserva_autor_e_snapshot_sem_commit_parcial(db):
    usuario = models.Usuario(username="gestor", password_hash="hash", role="coordenador")
    db.add(usuario)
    db.flush()
    depois = {"nome": "Jogos", "configuracao": {"publicada": False}}
    registro = registrar_auditoria(
        db, entidade="eventos", id_entidade=1, acao="CRIAR", antes=None,
        depois=depois, id_edicao_competicao=None, responsavel=usuario, motivo="Cadastro",
    )
    depois["configuracao"]["publicada"] = True
    db.flush()
    db.delete(usuario)
    db.flush()
    db.refresh(registro)
    assert registro.responsavel_nome == "gestor"
    assert registro.id_usuario_responsavel is None
    assert registro.depois["configuracao"]["publicada"] is False
    assert registro.motivo == "Cadastro"
    db.rollback()
    assert db.query(AuditoriaCompeticao).count() == 0


@pytest.mark.parametrize("erro,status,codigo", [
    (NaoEncontrado, 404, "NAO_ENCONTRADO"),
    (ConflitoEstado, 409, "CONFLITO_ESTADO"),
    (ConflitoRevisao, 409, "CONFLITO_REVISAO"),
    (Duplicidade, 409, "DUPLICIDADE"),
    (ConfiguracaoInvalida, 422, "CONFIGURACAO_INVALIDA"),
])
def test_tratadores_respondem_envelope(erro, status, codigo):
    app = FastAPI()
    registrar_tratadores(app)

    @app.get("/competicoes/recurso")
    def recurso():
        raise erro("Operacao recusada", campos=["revisao"])

    resposta = TestClient(app).get("/competicoes/recurso")
    assert resposta.status_code == status
    assert resposta.json() == {"codigo": codigo, "mensagem": "Operacao recusada", "campos": ["revisao"], "detalhes": []}


def test_main_registra_tratadores_e_router_central_inclui_subrouters():
    from competicoes.api import router
    from competicoes.api import organizacao, elencos
    from main import app

    assert router.prefix == "/competicoes"
    assert router.tags == ["Competições"]
    assert len(organizacao.router.routes) > 0 and len(elencos.router.routes) > 0
    assert NaoEncontrado in app.exception_handlers


@pytest.mark.parametrize("dados,campos", [
    ({"nome": "Ana", "escola": "dado privado"}, ["escola"]),
    ({"nome": ""}, ["nome"]),
])
def test_validacao_http_responde_envelope_sem_expor_entrada(dados, campos):
    app = FastAPI()
    registrar_tratadores(app)

    @app.post("/competicoes/competidores")
    def criar(dados: CompetidorCriar):
        return dados

    resposta = TestClient(app).post("/competicoes/competidores", json=dados)
    assert resposta.status_code == 422
    assert resposta.json() == {
        "codigo": "CONFIGURACAO_INVALIDA",
        "mensagem": "Dados inválidos. Verifique os campos destacados.",
        "campos": campos,
        "detalhes": resposta.json()["detalhes"],
    }
    assert [d["campo"] for d in resposta.json()["detalhes"]] == campos


@pytest.mark.parametrize("caminho,competicoes", [
    ("/competicoes", True), ("/competicoes/competidores", True),
    ("/alunos/", False), ("/competicoes-outro", False),
])
def test_envelope_de_validacao_limitado_ao_dominio_competicoes(caminho, competicoes):
    app = FastAPI()
    registrar_tratadores(app)

    @app.post(caminho)
    def criar(dados: CompetidorCriar):
        return dados

    resposta = TestClient(app).post(caminho, json={"nome": ""})
    assert resposta.status_code == 422
    if competicoes:
        assert resposta.json() == {
            "codigo": "CONFIGURACAO_INVALIDA",
            "mensagem": "Dados inválidos. Verifique os campos destacados.",
            "campos": ["nome"],
            "detalhes": [{"campo": "nome", "mensagem": "Texto muito curto."}],
        }
    else:
        assert set(resposta.json()) == {"detail"}
        assert resposta.json()["detail"][0]["loc"] == ["body", "nome"]


@pytest.mark.parametrize("caminho,competicoes", [
    ("/competicoes/recurso", True), ("/alunos/", False),
])
@pytest.mark.parametrize("papel,status,codigo", [
    (None, 401, "NAO_AUTENTICADO"),
    ("professor", 403, "ACESSO_NEGADO"),
    ("coordenador", 200, None),
])
def test_erros_de_seguranca_usam_envelope_apenas_em_competicoes(
    db, cabecalhos_por_papel, caminho, competicoes, papel, status, codigo,
):
    from database import get_db
    from security import check_coordenador_role

    app = FastAPI()
    registrar_tratadores(app)

    def obter_sessao():
        yield db

    app.dependency_overrides[get_db] = obter_sessao

    @app.get(caminho)
    def consultar(autor: models.Usuario = Depends(check_coordenador_role)):
        return {"role": autor.role}

    resposta = TestClient(app).get(caminho, headers=cabecalhos_por_papel(papel))
    assert resposta.status_code == status
    if status == 200:
        assert resposta.json() == {"role": "coordenador"}
    elif competicoes:
        assert set(resposta.json()) == {"codigo", "mensagem", "campos", "detalhes"}
        assert resposta.json()["codigo"] == codigo
        assert resposta.json()["campos"] == []
        assert resposta.json()["mensagem"]
    else:
        assert set(resposta.json()) == {"detail"}
    if status == 401:
        assert resposta.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("schema,extras", [
    (EdicaoEventoCriar, {"identificacao": "2026"}),
    (EdicaoCompeticaoCriar, {"identificacao": "2026", "formato": "MATA_MATA",
                            "configuracao": {"formato": "MATA_MATA"}}),
    (EdicaoCompeticaoAtualizar, {"identificacao": "2026", "formato": "MATA_MATA",
                               "configuracao": {"formato": "MATA_MATA"}, "revisao": 1}),
    (EdicaoEventoAtualizar, {}),
])
def test_contratos_rejeitam_periodo_invertido(schema, extras):
    with pytest.raises(ValidationError):
        schema(**extras, data_inicio="2026-12-31", data_fim="2026-01-01")


@pytest.mark.parametrize("dados", [
    {"data_inicio": "2026-01-01"},
    {"data_fim": "2026-12-31"},
    {"data_inicio": "2026-01-01", "data_fim": "2026-01-01"},
])
def test_patch_aceita_data_parcial_ou_periodo_de_um_dia(dados):
    assert EdicaoEventoAtualizar(**dados).model_dump(exclude_unset=True, mode="json") == dados


@pytest.fixture()
def rota_fixture_usuario():
    from database import get_db
    from main import app
    from security import get_current_active_user

    rotas_anteriores = list(app.router.routes)

    @app.get("/__teste_contratos__/usuario")
    def consultar(
        db: Session = Depends(get_db),
        autor: models.Usuario = Depends(get_current_active_user),
    ):
        return {"id_usuario": autor.id_usuario, "role": autor.role,
                "eventos": db.query(Evento).count()}

    try:
        yield "/__teste_contratos__/usuario"
    finally:
        app.router.routes[:] = rotas_anteriores


@pytest.mark.parametrize("papel,esperado", [
    (None, 401), ("admin", 200), ("coordenador", 200),
    ("professor", 200), ("assistente", 200),
])
def test_fixtures_autenticam_por_papel_na_mesma_sessao_sqlite(
    client, db, usuario, cabecalhos_por_papel, rota_fixture_usuario, papel, esperado,
):
    evento = criar_evento(db)
    headers = cabecalhos_por_papel(papel)
    resposta = client.get(rota_fixture_usuario, headers=headers)
    assert resposta.status_code == esperado
    if papel is not None:
        assert resposta.json()["role"] == papel
        assert resposta.json()["eventos"] == 1
        if papel == "coordenador":
            assert resposta.json()["id_usuario"] == usuario.id_usuario
        # A fábrica reaproveita a conta na mesma sessão em chamadas repetidas.
        assert client.get(rota_fixture_usuario, headers=cabecalhos_por_papel(papel)).json() == resposta.json()
    assert db.get(Evento, evento.id_evento) is evento


def test_fixture_usuario_persiste_apos_rollback_de_operacao(db, usuario):
    id_usuario = usuario.id_usuario
    db.rollback()
    db.expire_all()
    assert db.get(models.Usuario, id_usuario).role == "coordenador"
