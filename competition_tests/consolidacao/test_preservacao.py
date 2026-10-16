"""Revisao de consolidacao: descarte explicito, preservacao e downgrade."""

from __future__ import annotations

import os
import subprocess
import sys

import pytest
from alembic import command
from sqlalchemy import create_engine, inspect

from .conftest import APP_DIR, REVISAO_ANTERIOR, REVISAO_CONSOLIDACAO, ROOT, config_alembic
from .factories import TABELAS_ESCOLINHAS, ler_tabelas


def _revisao_atual(engine):
    from alembic.runtime.migration import MigrationContext

    with engine.connect() as conexao:
        return MigrationContext.configure(conexao).get_current_revision()


def test_revisao_encadeada_no_baseline():
    from alembic.script import ScriptDirectory
    from .conftest import REVISAO_FATIA2, REVISAO_FATIA3

    script = ScriptDirectory.from_config(config_alembic("sqlite://", descartar=False))
    assert [r.revision for r in script.get_revisions("heads")] == [REVISAO_FATIA3]
    assert script.get_revision(REVISAO_FATIA3).down_revision == REVISAO_FATIA2
    assert script.get_revision(REVISAO_FATIA2).down_revision == REVISAO_CONSOLIDACAO
    assert script.get_revision(REVISAO_CONSOLIDACAO).down_revision == REVISAO_ANTERIOR


def test_revisao_nao_importa_modelos():
    fonte = next((ROOT / "alembic" / "versions").glob(f"{REVISAO_CONSOLIDACAO}_*.py")).read_text()
    assert "import models" not in fonte
    assert "competicoes.modelos" not in fonte
    assert "from database" not in fonte


def test_upgrade_exige_descarte_explicito(sqlite_na_revisao_anterior):
    """Sem a opção, recusa antes de qualquer DDL e o schema fica intacto."""
    engine = sqlite_na_revisao_anterior.engine
    antes = set(inspect(engine).get_table_names())
    config_sem_opcao = config_alembic(sqlite_na_revisao_anterior.url, descartar=False)
    with pytest.raises(RuntimeError, match="descartar_competicoes_teste"):
        command.upgrade(config_sem_opcao, "head")
    assert set(inspect(engine).get_table_names()) == antes
    assert _revisao_atual(engine) == REVISAO_ANTERIOR


def test_upgrade_recusa_opcao_com_valor_diferente_de_sim(sqlite_na_revisao_anterior):
    engine = sqlite_na_revisao_anterior.engine
    antes = set(inspect(engine).get_table_names())
    config = config_alembic(sqlite_na_revisao_anterior.url, descartar=False)
    config.cmd_opts = type("Opts", (), {"x": ["descartar_competicoes_teste=talvez"]})()
    with pytest.raises(RuntimeError, match="descartar_competicoes_teste"):
        command.upgrade(config, "head")
    assert set(inspect(engine).get_table_names()) == antes


def test_upgrade_aceita_opcao_por_x_argument(sqlite_na_revisao_anterior):
    config = config_alembic(sqlite_na_revisao_anterior.url, descartar=False)
    config.cmd_opts = type("Opts", (), {"x": ["descartar_competicoes_teste=sim"]})()
    command.upgrade(config, "head")
    assert "integrantes_equipe" in sqlite_na_revisao_anterior.tabelas()


def test_upgrade_preserva_dados_de_escolinhas(sqlite_com_dados_sinteticos):
    engine = sqlite_com_dados_sinteticos.engine
    antes = ler_tabelas(engine)
    assert all(antes[tabela] for tabela in TABELAS_ESCOLINHAS)

    command.upgrade(config_alembic(sqlite_com_dados_sinteticos.url, descartar=True), "head")

    depois = ler_tabelas(engine)
    for tabela in TABELAS_ESCOLINHAS:
        assert depois[tabela] == antes[tabela], tabela
    tabelas = sqlite_com_dados_sinteticos.tabelas()
    assert "equipes_participantes" not in tabelas and "confrontos" not in tabelas
    from .conftest import REVISAO_FATIA3
    assert _revisao_atual(engine) == REVISAO_FATIA3


def test_upgrade_de_snapshot_e_de_banco_vazio_chegam_ao_mesmo_schema(
    sqlite_com_dados_sinteticos, sqlite_na_head
):
    command.upgrade(config_alembic(sqlite_com_dados_sinteticos.url, descartar=True), "head")

    def assinatura(engine):
        inspetor = inspect(engine)
        return {
            tabela: (
                [(c["name"], str(c["type"]), c["nullable"]) for c in inspetor.get_columns(tabela)],
                sorted(tuple(u["column_names"]) for u in inspetor.get_unique_constraints(tabela)),
                sorted(
                    (tuple(fk["constrained_columns"]), fk["referred_table"])
                    for fk in inspetor.get_foreign_keys(tabela)
                ),
                sorted(i["name"] for i in inspetor.get_indexes(tabela)),
            )
            for tabela in inspetor.get_table_names()
        }

    assert assinatura(sqlite_com_dados_sinteticos.engine) == assinatura(sqlite_na_head.engine)


def test_downgrade_da_consolidacao_falha_sem_mutar(sqlite_na_head):
    engine = sqlite_na_head.engine
    # Downgrade da fatia 2 (0300 -> 0200) e seguro e suportado:
    command.downgrade(config_alembic(sqlite_na_head.url, descartar=True), REVISAO_CONSOLIDACAO)
    assert _revisao_atual(engine) == REVISAO_CONSOLIDACAO
    # Downgrade da consolidacao (0200 -> 0100) e bloqueado com instrucao de restauracao por backup:
    antes = set(inspect(engine).get_table_names())
    with pytest.raises(RuntimeError, match="backup"):
        command.downgrade(config_alembic(sqlite_na_head.url, descartar=True), "-1")
    assert set(inspect(engine).get_table_names()) == antes
    assert _revisao_atual(engine) == REVISAO_CONSOLIDACAO


def test_importar_main_nao_cria_tabelas(tmp_path):
    """main não chama create_all; um banco vazio segue vazio após o import."""
    caminho = tmp_path / "vazio.sqlite"
    ambiente = os.environ | {
        "DATABASE_URL": f"sqlite:///{caminho}",
        "SECRET_KEY": "competition-test-secret",
        "PYTHONPATH": str(APP_DIR),
    }
    subprocess.run(
        [sys.executable, "-c", "import main"],
        cwd=ROOT, env=ambiente, check=True, capture_output=True, text=True,
    )
    assert inspect(create_engine(f"sqlite:///{caminho}")).get_table_names() == []


ROUTERS_REMOVIDOS = {
    "competicoes", "competicoes_v2", "confrontos", "individuais", "classificacao",
    "publico_competicoes", "publico_individuais", "publico_v2", "equipes", "partidas",
    "edicoes", "eventos", "publico",
}
SERVICOS_REMOVIDOS = {
    "competicoes", "confrontos", "confrontos_v2", "classificacao_equipes",
    "classificacao_individuais", "classificacao_v2", "individuais", "sumula_v2",
    "equipes", "partidas", "edicoes", "eventos",
}


def test_codigo_esportivo_antigo_removido():
    assert not [n for n in ROUTERS_REMOVIDOS if (APP_DIR / "routers" / f"{n}.py").exists()]
    assert not [n for n in SERVICOS_REMOVIDOS if (APP_DIR / "services" / f"{n}.py").exists()]


def test_main_nao_expoe_rotas_esportivas_antigas():
    from main import app

    modulos = {getattr(rota, "endpoint", None).__module__ for rota in app.routes if hasattr(rota, "endpoint")}
    assert not {f"routers.{n}" for n in ROUTERS_REMOVIDOS} & modulos
    caminhos = {rota.path for rota in app.routes}
    assert "/alunos/" in caminhos and "/atletas/" in caminhos


def test_rota_de_atleta_em_equipe_responde_410():
    from fastapi.testclient import TestClient
    from main import app

    resposta = TestClient(app).post("/atletas/equipe/1", data={"nome_completo": "x"})
    assert resposta.status_code == 410


def test_mappers_carregam():
    from sqlalchemy.orm import configure_mappers

    import models  # noqa: F401 - registra escolinhas e o dominio novo
    configure_mappers()


def test_modelos_reexportados():
    import competicoes.modelos as modelos
    from database import Base

    nomes = {
        "Evento", "EdicaoEvento", "Competicao", "EdicaoCompeticao", "Competidor",
        "Equipe", "IntegranteEquipe", "AuditoriaCompeticao", "RequisicaoPartida",
    }
    assert nomes <= set(vars(modelos))
    assert all(issubclass(getattr(modelos, nome), Base) for nome in nomes)
