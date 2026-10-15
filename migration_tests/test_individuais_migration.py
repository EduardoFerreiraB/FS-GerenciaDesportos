"""Passo 5 migration tests for individual registrations, provas, and resultados."""

from __future__ import annotations

from io import StringIO
from pathlib import Path
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


def test_fresh_upgrade_to_0005(tmp_path):
    """Fresh database upgraded to 20260824_0005 creates individual registration, prova, and result tables."""
    database_url = f"sqlite:///{tmp_path / 'fresh_0005.sqlite'}"
    command.upgrade(alembic_config(database_url), "20260824_0005")

    engine = create_engine(database_url)
    inspector = inspect(engine)

    assert inspector.has_table("inscricoes_individuais")
    assert inspector.has_table("provas")
    assert inspector.has_table("resultados_prova")

    # Inspect columns
    cols_inscricoes = {c["name"] for c in inspector.get_columns("inscricoes_individuais")}
    assert {"id_inscricao", "id_competicao", "id_participante", "numero_peito"}.issubset(cols_inscricoes)

    cols_provas = {c["name"] for c in inspector.get_columns("provas")}
    assert {"id_prova", "id_competicao", "nome", "data", "hora", "id_local", "status", "observacoes"}.issubset(cols_provas)

    cols_resultados = {c["name"] for c in inspector.get_columns("resultados_prova")}
    assert {"id_resultado", "id_prova", "id_participante", "tempo_ms", "posicao", "desqualificado", "motivo_desqualificacao", "observacoes"}.issubset(cols_resultados)

    # Inspect unique constraints
    uqs_inscricoes = {tuple(u["column_names"]) for u in inspector.get_unique_constraints("inscricoes_individuais")}
    assert ("id_competicao", "id_participante") in uqs_inscricoes

    uqs_resultados = {tuple(u["column_names"]) for u in inspector.get_unique_constraints("resultados_prova")}
    assert ("id_prova", "id_participante") in uqs_resultados


def test_upgrade_from_0004_to_0005(tmp_path):
    """Upgrading from 20260824_0004 to 20260824_0005 creates the new tables incrementally."""
    database_url = f"sqlite:///{tmp_path / 'upgrade_0004_to_0005.sqlite'}"
    cfg = alembic_config(database_url)

    # 1. Upgrade to 0004
    command.upgrade(cfg, "20260824_0004")
    engine = create_engine(database_url)
    insp_before = inspect(engine)
    assert not insp_before.has_table("inscricoes_individuais")
    assert not insp_before.has_table("provas")
    assert not insp_before.has_table("resultados_prova")

    # 2. Upgrade to 0005
    command.upgrade(cfg, "20260824_0005")
    insp_after = inspect(engine)
    assert insp_after.has_table("inscricoes_individuais")
    assert insp_after.has_table("provas")
    assert insp_after.has_table("resultados_prova")


def test_downgrade_0005_to_0004_and_reupgrade(tmp_path):
    """Downgrading 0005 drops the newly created tables safely, and re-upgrading restores them."""
    database_url = f"sqlite:///{tmp_path / 'downgrade_0005.sqlite'}"
    cfg = alembic_config(database_url)

    command.upgrade(cfg, "20260824_0005")
    engine = create_engine(database_url)
    insp = inspect(engine)
    assert insp.has_table("inscricoes_individuais")
    assert insp.has_table("provas")
    assert insp.has_table("resultados_prova")

    # Downgrade to 0004
    command.downgrade(cfg, "20260824_0004")
    insp_down = inspect(engine)
    assert not insp_down.has_table("resultados_prova")
    assert not insp_down.has_table("provas")
    assert not insp_down.has_table("inscricoes_individuais")
    assert insp_down.has_table("confrontos")

    # Re-upgrade to 0005
    command.upgrade(cfg, "20260824_0005")
    insp_re = inspect(engine)
    assert insp_re.has_table("inscricoes_individuais")
    assert insp_re.has_table("provas")
    assert insp_re.has_table("resultados_prova")


def test_mysql_offline_compilation_0005():
    """Compiling offline migration for MySQL produces DDL for individual tables without connecting."""
    output = StringIO()
    config = alembic_config("mysql+pymysql://user:password@localhost/gerencia", output)

    command.upgrade(config, "20260824_0004:20260824_0005", sql=True)

    ddl = output.getvalue().lower()
    assert "create table inscricoes_individuais" in ddl
    assert "create table provas" in ddl
    assert "create table resultados_prova" in ddl
    assert "uq_inscricao_competicao_participante" in ddl
    assert "uq_prova_participante" in ddl
