"""Behavior tests for the read-only Passo 3 migration validator."""

from __future__ import annotations

import hashlib
from pathlib import Path
import shutil
import subprocess
import sys

from alembic import command
from sqlalchemy import create_engine, text

from test_equipes_historicas_migration import alembic_config, preparar_dados_historicos


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "scripts" / "validar_migracao_equipes.py"


def _hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_validator_reports_each_clone_and_preserved_roster_and_matches(tmp_path):
    """Removing a comparison would let a clone lose a roster or partida without a failing report."""
    before = tmp_path / "anonimizado-antes.sqlite"
    after = tmp_path / "anonimizado-depois.sqlite"
    preparar_dados_historicos(f"sqlite:///{before}")
    shutil.copy2(before, after)
    command.upgrade(alembic_config(f"sqlite:///{after}"), "head")
    before_hash, after_hash = _hash(before), _hash(after)
    report = tmp_path / "relatorio.json"

    result = subprocess.run(
        [sys.executable, str(VALIDATOR), "--antes", str(before), "--depois", str(after), "--relatorio", str(report)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    contents = report.read_text(encoding="utf-8")
    assert '"id_equipe_origem": 20' in contents
    assert '"id_competicao": 10' in contents
    assert '"id_competicao": 11' in contents
    assert '"partidas_antes": 1' in contents
    assert '"partidas_depois": 2' in contents
    assert '"participantes_preservados": true' in contents
    assert _hash(before) == before_hash
    assert _hash(after) == after_hash


def test_validator_rejects_dump_with_played_uninferable_team_without_writing(tmp_path):
    """Removing the safety check would approve a dump whose played team has no target competition."""
    before = tmp_path / "invalido-antes.sqlite"
    after = tmp_path / "invalido-depois.sqlite"
    preparar_dados_historicos(f"sqlite:///{before}", modalidade_sem_competicao=True)
    shutil.copy2(before, after)
    before_hash, after_hash = _hash(before), _hash(after)
    report = tmp_path / "relatorio-invalido.json"

    result = subprocess.run(
        [sys.executable, str(VALIDATOR), "--antes", str(before), "--depois", str(after), "--relatorio", str(report)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "não inferível com partidas" in result.stderr
    assert report.exists()
    assert _hash(before) == before_hash
    assert _hash(after) == after_hash


def test_validator_rejects_audited_team_assigned_to_another_competition(tmp_path):
    """Trusting only the audit would approve a clone whose actual team scope was changed."""
    before = tmp_path / "escopo-antes.sqlite"
    after = tmp_path / "escopo-depois.sqlite"
    preparar_dados_historicos(f"sqlite:///{before}")
    shutil.copy2(before, after)
    command.upgrade(alembic_config(f"sqlite:///{after}"), "head")
    with create_engine(f"sqlite:///{after}").begin() as connection:
        connection.execute(text("UPDATE equipes SET id_competicao = 11 WHERE id_equipe = 20"))

    result = subprocess.run(
        [sys.executable, str(VALIDATOR), "--antes", str(before), "--depois", str(after)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "competição divergente" in result.stdout


def test_validator_rejects_extra_audit_and_silent_assignment_of_manual_team(tmp_path):
    """Extra lineage or assigning a PENDENTE team would hide an unreviewed historical decision."""
    before = tmp_path / "manual-antes.sqlite"
    after = tmp_path / "manual-depois.sqlite"
    engine = preparar_dados_historicos(f"sqlite:///{before}")
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM partidas"))
        connection.execute(text("INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, status) VALUES (12, 1, 1, 'Outra', 'Livre', 'EQUIPE', 'GRUPOS', 'PLACAR', '2026-08-01', '2026-08-31', 'RASCUNHO')"))
    shutil.copy2(before, after)
    command.upgrade(alembic_config(f"sqlite:///{after}"), "head")
    with create_engine(f"sqlite:///{after}").begin() as connection:
        connection.execute(text("UPDATE equipes SET id_competicao = 10 WHERE id_equipe = 20"))
        connection.execute(text("INSERT INTO migracao_equipes_origem (id_equipe_origem, id_equipe_resultante, id_competicao, status) VALUES (20, 20, 10, 'MIGRADA')"))

    result = subprocess.run(
        [sys.executable, str(VALIDATOR), "--antes", str(before), "--depois", str(after)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "PENDENTE" in result.stdout
    assert "auditoria inesperada" in result.stdout


def test_validator_rejects_foreign_edition_partida_before_accepting_audit(tmp_path):
    """Ignoring a cross-edition match would approve a dump the migration itself must reject."""
    before = tmp_path / "cruzada-antes.sqlite"
    after = tmp_path / "cruzada-depois.sqlite"
    engine = preparar_dados_historicos(f"sqlite:///{before}")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO edicoes (id_edicao, id_evento, edic_ano, tipo_competicao, data_inicio, data_fim) VALUES (2, 1, 2027, 'Pontos Corridos', '2027-08-01', '2027-08-31')"))
        connection.execute(text("UPDATE partidas SET id_edicao = 2 WHERE id_partida = 101"))
    shutil.copy2(before, after)

    result = subprocess.run(
        [sys.executable, str(VALIDATOR), "--antes", str(before), "--depois", str(after)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "edição diferente" in result.stdout
