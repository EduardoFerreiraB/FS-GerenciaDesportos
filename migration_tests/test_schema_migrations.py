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


def test_baseline_roundtrip_em_banco_vazio(tmp_path):
    """Banco vazio: upgrade, downgrade ao base e novo upgrade."""
    database_url = f"sqlite:///{tmp_path / 'roundtrip.sqlite'}"
    cfg = alembic_config(database_url)
    command.upgrade(cfg, "head")
    engine = create_engine(database_url)
    assert inspect(engine).has_table("competicoes")
    command.downgrade(cfg, "base")
    assert set(inspect(engine).get_table_names()) <= {"alembic_version"}
    command.upgrade(cfg, "head")
    assert inspect(engine).has_table("resultados_prova")


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


def test_baseline_e_unica_head(tmp_path):
    from alembic.script import ScriptDirectory
    script = ScriptDirectory.from_config(alembic_config(f"sqlite:///{tmp_path / 'x.sqlite'}"))
    assert [revision.revision for revision in script.get_revisions("heads")] == ["20261015_0100"]
    assert script.get_revision("20261015_0100").down_revision is None


def test_env_sem_metadata_por_padrao():
    fonte = (ROOT / "alembic" / "env.py").read_text()
    assert 'config.attributes.get("target_metadata")' in fonte
    assert "import models" not in fonte
