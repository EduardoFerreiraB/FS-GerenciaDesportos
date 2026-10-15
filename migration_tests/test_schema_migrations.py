"""Integration tests for the versioned database schema.

This suite deliberately lives outside ``tests/``: that directory's conftest
creates and drops the developer ``test.db`` database as an import side effect.
"""

from __future__ import annotations

from io import StringIO
from pathlib import Path
import os
import subprocess
import sys

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect, text


ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "app"
sys.path.insert(0, str(APP_DIR))


def alembic_config(database_url: str, output_buffer=None) -> Config:
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output_buffer)
    config.set_main_option("sqlalchemy.url", database_url)
    config.attributes["database_url"] = database_url
    return config


def upgrade(database_url: str) -> None:
    command.upgrade(alembic_config(database_url), "head")


def _model_schema():
    # Imported only by the assertion.  The migration itself must remain a
    # frozen schema artifact and cannot obtain its DDL from these models.
    import models

    return models.Base.metadata


def test_upgrade_empty_sqlite_matches_current_schema_and_constraints(tmp_path):
    """A fresh database gets all tables, FKs, unique constraints and defaults."""
    database_url = f"sqlite:///{tmp_path / 'fresh.sqlite'}"

    upgrade(database_url)

    expected = _model_schema()
    engine = create_engine(database_url)
    actual = inspect(engine)
    assert set(actual.get_table_names()) - {"alembic_version"} == set(expected.tables)

    for name, table in expected.tables.items():
        actual_columns = {column["name"]: column for column in actual.get_columns(name)}
        assert set(actual_columns) == {column.name for column in table.columns}
        assert {
            column["name"]
            for column in actual_columns.values()
            if column["primary_key"]
        } == {column.name for column in table.primary_key.columns}
        assert {
            column["name"]: column["nullable"] for column in actual_columns.values()
        } == {column.name: column.nullable for column in table.columns}
        assert {
            column["name"]: column["type"].compile(dialect=engine.dialect)
            for column in actual_columns.values()
        } == {
            column.name: column.type.compile(dialect=engine.dialect)
            for column in table.columns
        }
        assert {
            tuple(foreign_key["constrained_columns"]): (
                foreign_key["referred_table"],
                tuple(foreign_key["referred_columns"]),
            )
            for foreign_key in actual.get_foreign_keys(name)
        } == {
            tuple(foreign_key.parent.name for foreign_key in constraint.elements): (
                constraint.elements[0].column.table.name,
                tuple(foreign_key.column.name for foreign_key in constraint.elements),
            )
            for constraint in table.foreign_key_constraints
        }
        assert {
            tuple(constraint["column_names"])
            for constraint in actual.get_unique_constraints(name)
        } == {
            tuple(column.name for column in constraint.columns)
            for constraint in table.constraints
            if constraint.__class__.__name__ == "UniqueConstraint"
        }
        assert {
            column["name"]: column["default"] for column in actual_columns.values()
        } == {
            column.name: str(column.server_default.arg) if column.server_default else None
            for column in table.columns
        }
        assert {
            index["name"]: (tuple(index["column_names"]), index["unique"])
            for index in actual.get_indexes(name)
        } == {
            index.name: (tuple(column.name for column in index.columns), index.unique)
            for index in table.indexes
        }


def test_repeated_upgrade_preserves_existing_data(tmp_path):
    """Running the deploy command twice is a no-op for schema and stored data."""
    database_url = f"sqlite:///{tmp_path / 'idempotent.sqlite'}"
    upgrade(database_url)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO modalidades (nome, duracao_minutos) VALUES ('Futebol', 90)"))

    upgrade(database_url)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT nome FROM modalidades")).scalars().all() == ["Futebol"]


def test_draft_migration_converts_only_planned_records_and_preserves_teams(tmp_path):
    """The child revision retains IDs/data while changing only PLANEJADA."""
    database_url = f"sqlite:///{tmp_path / 'draft-data.sqlite'}"
    command.upgrade(alembic_config(database_url), "20260824_0001")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO eventos (id_evento, even_nome) VALUES (1, 'Jogos')"))
        connection.execute(text("INSERT INTO modalidades (id_modalidade, nome, duracao_minutos) VALUES (1, 'Futebol', 90)"))
        connection.execute(text("INSERT INTO edicoes (id_edicao, id_evento, edic_ano, tipo_competicao, data_inicio, data_fim) VALUES (1, 1, 2026, 'Pontos Corridos', '2026-08-01', '2026-08-31')"))
        connection.execute(text("INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, regras, status) VALUES (10, 1, 1, 'Planejada', 'Sub-15', 'EQUIPE', 'PONTOS_CORRIDOS', 'PLACAR', '2026-08-01', '2026-08-31', 'Regulamento preservado', 'PLANEJADA')"))
        connection.execute(text("INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, status) VALUES (11, 1, 1, 'Ativa', 'Sub-17', 'EQUIPE', 'GRUPOS', 'PLACAR', '2026-08-01', '2026-08-31', 'EM_ANDAMENTO')"))
        connection.execute(text("INSERT INTO equipes (id_equipe, nome, id_edicao, id_competicao) VALUES (20, 'Tigres', 1, 10)"))
    with engine.connect() as connection:
        before = connection.execute(text("SELECT id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, regras FROM competicoes WHERE id_competicao = 10")).one()

    upgrade(database_url)
    upgrade(database_url)

    with engine.connect() as connection:
        migrated = connection.execute(text("SELECT id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, regras FROM competicoes WHERE id_competicao = 10")).one()
        statuses = connection.execute(text("SELECT id_competicao, status FROM competicoes ORDER BY id_competicao")).all()
        assert migrated == before
        assert statuses == [(10, "RASCUNHO"), (11, "EM_ANDAMENTO")]
        assert connection.execute(text("SELECT id_competicao FROM equipes WHERE id_equipe = 20")).scalar_one() == 10


def test_downgrade_refuses_incomplete_draft_before_restoring_not_null(tmp_path):
    """Rollback must not silently destroy the partial draft configuration."""
    database_url = f"sqlite:///{tmp_path / 'draft-rollback.sqlite'}"
    upgrade(database_url)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO eventos (id_evento, even_nome) VALUES (1, 'Jogos')"))
        connection.execute(text("INSERT INTO modalidades (id_modalidade, nome, duracao_minutos) VALUES (1, 'Futebol', 90)"))
        connection.execute(text("INSERT INTO edicoes (id_edicao, id_evento, edic_ano, tipo_competicao, data_inicio, data_fim) VALUES (1, 1, 2026, 'Pontos Corridos', '2026-08-01', '2026-08-31')"))
        connection.execute(text("INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, nome, categoria, status) VALUES (10, 1, 1, 'Rascunho', 'Sub-15', 'RASCUNHO')"))

    with pytest.raises(RuntimeError, match="rascunhos incompletos"):
        command.downgrade(alembic_config(database_url), "20260824_0001")

    with engine.connect() as connection:
        assert connection.execute(text("SELECT status, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim FROM competicoes WHERE id_competicao = 10")).one() == ("RASCUNHO", None, None, None, None, None)
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20260824_0002"
    columns = {column["name"]: column for column in inspect(engine).get_columns("competicoes")}
    assert columns["modo_inscricao"]["nullable"] is True


def test_complete_draft_downgrades_without_losing_identity_or_team(tmp_path):
    """A complete converted record can be rolled back to the baseline shape."""
    database_url = f"sqlite:///{tmp_path / 'complete-rollback.sqlite'}"
    command.upgrade(alembic_config(database_url), "20260824_0001")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO eventos (id_evento, even_nome) VALUES (1, 'Jogos')"))
        connection.execute(text("INSERT INTO modalidades (id_modalidade, nome, duracao_minutos) VALUES (1, 'Futebol', 90)"))
        connection.execute(text("INSERT INTO edicoes (id_edicao, id_evento, edic_ano, tipo_competicao, data_inicio, data_fim) VALUES (1, 1, 2026, 'Pontos Corridos', '2026-08-01', '2026-08-31')"))
        connection.execute(text("INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, status) VALUES (10, 1, 1, 'Planejada', 'Sub-15', 'EQUIPE', 'PONTOS_CORRIDOS', 'PLACAR', '2026-08-01', '2026-08-31', 'PLANEJADA')"))
        connection.execute(text("INSERT INTO equipes (id_equipe, nome, id_edicao, id_competicao) VALUES (20, 'Tigres', 1, 10)"))

    upgrade(database_url)
    command.downgrade(alembic_config(database_url), "20260824_0001")

    with engine.connect() as connection:
        assert connection.execute(text("SELECT id_competicao, status FROM competicoes")).one() == (10, "PLANEJADA")
        assert connection.execute(text("SELECT id_competicao FROM equipes WHERE id_equipe = 20")).scalar_one() == 10
        assert inspect(engine).get_columns("competicoes")[5]["nullable"] is False


def test_mysql_offline_upgrade_compiles_initial_schema():
    """The deployment migration emits MySQL DDL without opening a MySQL connection."""
    output = StringIO()
    config = alembic_config("mysql+pymysql://user:password@localhost/gerencia", output)

    command.upgrade(config, "head", sql=True)

    ddl = output.getvalue().lower()
    assert "create table competicoes" in ddl
    assert "id_competicao" in ddl
    assert "foreign key(id_competicao) references competicoes" in ddl
    assert "create table migracao_equipes_origem" in ddl
    assert "create table confrontos" in ddl
    assert "create table migracao_partidas_origem" in ddl
    assert "create table inscricoes_individuais" in ddl
    assert "create table provas" in ddl
    assert "create table resultados_prova" in ddl


def test_full_upgrade_and_downgrade_roundtrip_all_revisions(tmp_path):
    """Clean database can traverse the full upgrade and step-by-step downgrade chain."""
    database_url = f"sqlite:///{tmp_path / 'roundtrip.sqlite'}"
    cfg = alembic_config(database_url)

    # 1. Full upgrade to head (0005)
    command.upgrade(cfg, "head")
    engine = create_engine(database_url)
    insp = inspect(engine)
    assert insp.has_table("resultados_prova")
    assert insp.has_table("provas")
    assert insp.has_table("inscricoes_individuais")
    assert insp.has_table("confrontos")
    assert insp.has_table("migracao_partidas_origem")
    assert insp.has_table("migracao_equipes_origem")

    # 2. Step-by-step downgrade
    command.downgrade(cfg, "20260824_0004")
    insp = inspect(engine)
    assert not insp.has_table("resultados_prova")
    assert not insp.has_table("provas")
    assert not insp.has_table("inscricoes_individuais")
    assert insp.has_table("confrontos")

    command.downgrade(cfg, "20260824_0003")
    insp = inspect(engine)
    assert not insp.has_table("confrontos")
    assert not insp.has_table("migracao_partidas_origem")
    assert insp.has_table("migracao_equipes_origem")

    command.downgrade(cfg, "20260824_0002")
    insp = inspect(engine)
    assert not insp.has_table("migracao_equipes_origem")

    command.downgrade(cfg, "20260824_0001")
    insp = inspect(engine)
    cols = {c["name"]: c for c in insp.get_columns("competicoes")}
    assert cols["modo_inscricao"]["nullable"] is False

    # 3. Re-upgrade to head
    command.upgrade(cfg, "head")
    insp = inspect(engine)
    assert insp.has_table("resultados_prova")
    assert insp.has_table("confrontos")


def test_importing_api_does_not_create_database_schema(tmp_path):
    """Startup requires a prior migration instead of silently calling create_all."""
    database_path = tmp_path / "api-import.sqlite"
    environment = os.environ | {
        "DATABASE_URL": f"sqlite:///{database_path}",
        "PYTHONPATH": str(APP_DIR),
    }

    subprocess.run(
        [sys.executable, "-c", "import main"],
        cwd=ROOT,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )

    assert inspect(create_engine(f"sqlite:///{database_path}")).get_table_names() == []
