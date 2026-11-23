"""Tests for scripts/validar_migracao_confrontos.py."""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import sys

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, text

try:
    from migration_tests.test_confrontos_migration import preparar_dados_historicos
except ImportError:
    from test_confrontos_migration import preparar_dados_historicos


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "validar_migracao_confrontos.py"


def alembic_config(database_url: str) -> Config:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url)
    config.attributes["database_url"] = database_url
    return config


def test_validador_sucesso_com_amostra(tmp_path):
    """Validator succeeds and outputs a sample comparing matches before and confrontations after."""
    antes_path = tmp_path / "antes.sqlite"
    depois_path = tmp_path / "depois.sqlite"

    preparar_dados_historicos(f"sqlite:///{antes_path}")
    shutil.copy(antes_path, depois_path)
    command.upgrade(alembic_config(f"sqlite:///{depois_path}"), "head")

    result = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--antes", str(antes_path), "--depois", str(depois_path), "--amostra", "2"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Validator failed: {result.stderr}\n{result.stdout}"
    data = json.loads(result.stdout)
    assert data["total_partidas_antes"] == 3
    assert data["total_confrontos_depois"] == 3
    assert data["total_migrados"] == 3
    assert data["valido"] is True
    assert len(data["amostra"]) == 2
    assert len(data["discrepancias"]) == 0


def test_validador_detecta_divergencia_placar(tmp_path):
    """Validator detects when score or status in confrontos does not match original partida."""
    antes_path = tmp_path / "antes.sqlite"
    depois_path = tmp_path / "depois.sqlite"

    preparar_dados_historicos(f"sqlite:///{antes_path}")
    shutil.copy(antes_path, depois_path)
    command.upgrade(alembic_config(f"sqlite:///{depois_path}"), "head")

    # Tamper with confrontation score in depois
    engine = create_engine(f"sqlite:///{depois_path}")
    with engine.begin() as conn:
        conn.execute(text("UPDATE confrontos SET placar_mandante = 99 WHERE id_confronto = (SELECT id_confronto_resultante FROM migracao_partidas_origem WHERE id_partida_origem = 200)"))

    result = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--antes", str(antes_path), "--depois", str(depois_path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    data = json.loads(result.stdout)
    assert data["valido"] is False
    assert len(data["discrepancias"]) > 0
    assert any("placar" in d.lower() for d in data["discrepancias"])


def test_validador_detecta_divergencia_chaveamento(tmp_path):
    """Validator detects when next-match bracket link does not match original."""
    antes_path = tmp_path / "antes.sqlite"
    depois_path = tmp_path / "depois.sqlite"

    preparar_dados_historicos(f"sqlite:///{antes_path}")
    shutil.copy(antes_path, depois_path)
    command.upgrade(alembic_config(f"sqlite:///{depois_path}"), "head")

    # Break id_proximo_confronto
    engine = create_engine(f"sqlite:///{depois_path}")
    with engine.begin() as conn:
        conn.execute(text("UPDATE confrontos SET id_proximo_confronto = NULL WHERE id_confronto = (SELECT id_confronto_resultante FROM migracao_partidas_origem WHERE id_partida_origem = 100)"))

    result = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--antes", str(antes_path), "--depois", str(depois_path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    data = json.loads(result.stdout)
    assert data["valido"] is False
    assert any("próximo" in d.lower() or "proximo" in d.lower() for d in data["discrepancias"])
