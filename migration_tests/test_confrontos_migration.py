"""Passo 4 data migration tests: historical Partida to Confronto reconciliation."""

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


def preparar_dados_historicos(database_url: str, *, ambigua=False):
    command.upgrade(alembic_config(database_url), "20260824_0003")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO eventos (id_evento, even_nome) VALUES (1, 'Jogos Históricos')"))
        connection.execute(text("INSERT INTO modalidades (id_modalidade, nome, duracao_minutos) VALUES (1, 'Futebol', 90), (2, 'Basquete', 40)"))
        connection.execute(text("INSERT INTO edicoes (id_edicao, id_evento, edic_ano, tipo_competicao, data_inicio, data_fim) VALUES (1, 1, 2026, 'Mata-Mata', '2026-08-01', '2026-08-31')"))
        connection.execute(text(
            "INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, status) "
            "VALUES (10, 1, 1, 'Futebol Principal', 'Livre', 'EQUIPE', 'MATA_MATA', 'PLACAR', '2026-08-01', '2026-08-31', 'EM_ANDAMENTO')"
        ))
        if ambigua:
            # Add a second EQUIPE competition for the same edicao & modalidade
            connection.execute(text(
                "INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, status) "
                "VALUES (11, 1, 1, 'Futebol Secundário', 'Sub-20', 'EQUIPE', 'MATA_MATA', 'PLACAR', '2026-08-01', '2026-08-31', 'EM_ANDAMENTO')"
            ))

        connection.execute(text("INSERT INTO locais (id_local, loca_nome, ativo) VALUES (1, 'Campo 1', 1)"))
        connection.execute(text("INSERT INTO arbitros (id_arbitro, apito_nome, apito_doc, apito_tel) VALUES (1, 'Juiz', '123', '456')"))

        # Teams
        # If ambigua=True, teams have id_competicao=NULL to trigger inference ambiguity
        comp_team = None if ambigua else 10
        connection.execute(text(f"INSERT INTO equipes (id_equipe, nome, id_edicao, id_competicao) VALUES (21, 'Time 1', 1, :comp), (22, 'Time 2', 1, :comp), (23, 'Time 3', 1, :comp), (24, 'Time 4', 1, :comp)"), {"comp": comp_team})

        # Match 3: Final
        connection.execute(text(
            "INSERT INTO partidas (id_partida, id_edicao, id_local, id_arbitro, id_modalidade, id_equipe_casa, id_equipe_visitante, id_proxima_partida, fase, part_data, part_hora, placar_casa, placar_visitante, status, observacoes) "
            "VALUES (300, 1, 1, 1, 1, NULL, NULL, NULL, 'Final', '2026-08-20', '16:00:00', 0, 0, 'Agendada', 'Grande final')"
        ))

        # Match 1: Semi 1 -> Points to 300
        connection.execute(text(
            "INSERT INTO partidas (id_partida, id_edicao, id_local, id_arbitro, id_modalidade, id_equipe_casa, id_equipe_visitante, id_proxima_partida, fase, part_data, part_hora, placar_casa, placar_visitante, status, observacoes) "
            "VALUES (100, 1, 1, 1, 1, 21, 22, 300, 'Semifinal 1', '2026-08-15', '14:00:00', 0, 0, 'Agendada', 'Semi 1')"
        ))

        # Match 2: Semi 2 -> Points to 300 (Finalizada 2x1, winner 23)
        connection.execute(text(
            "INSERT INTO partidas (id_partida, id_edicao, id_local, id_arbitro, id_modalidade, id_equipe_casa, id_equipe_visitante, id_proxima_partida, fase, part_data, part_hora, placar_casa, placar_visitante, status, sumula_arquivo, observacoes) "
            "VALUES (200, 1, 1, 1, 1, 23, 24, 300, 'Semifinal 2', '2026-08-15', '16:00:00', 2, 1, 'Finalizada', '/uploads/sumulas/semi2.pdf', 'Semi 2 finalizada')"
        ))

    return engine


def test_migration_converts_partidas_to_confrontos_preserving_data_and_tree(tmp_path):
    """Historical matches are migrated 1:1 to confrontos preserving fields and bracket linkage."""
    database_url = f"sqlite:///{tmp_path / 'confrontos_migrados.sqlite'}"
    engine = preparar_dados_historicos(database_url)

    command.upgrade(alembic_config(database_url), "head")

    with engine.connect() as conn:
        inspector = inspect(engine)
        assert inspector.has_table("confrontos")
        assert inspector.has_table("migracao_partidas_origem")

        # Check total count
        partidas_count = conn.execute(text("SELECT COUNT(*) FROM partidas")).scalar_one()
        confrontos_count = conn.execute(text("SELECT COUNT(*) FROM confrontos")).scalar_one()
        audit_count = conn.execute(text("SELECT COUNT(*) FROM migracao_partidas_origem WHERE status = 'MIGRADA'")).scalar_one()

        assert partidas_count == 3
        assert confrontos_count == 3
        assert audit_count == 3

        # Check Semi 2 details
        c_semi2 = conn.execute(text(
            "SELECT c.id_confronto, c.id_competicao, c.id_equipe_mandante, c.id_equipe_visitante, "
            "c.placar_mandante, c.placar_visitante, c.id_equipe_vencedora, c.status, c.sumula_arquivo, c.id_proximo_confronto "
            "FROM confrontos c JOIN migracao_partidas_origem m ON c.id_confronto = m.id_confronto_resultante "
            "WHERE m.id_partida_origem = 200"
        )).mappings().one()

        assert c_semi2["id_competicao"] == 10
        assert c_semi2["id_equipe_mandante"] == 23
        assert c_semi2["id_equipe_visitante"] == 24
        assert c_semi2["placar_mandante"] == 2
        assert c_semi2["placar_visitante"] == 1
        assert c_semi2["id_equipe_vencedora"] == 23
        assert c_semi2["status"] == "Finalizado"
        assert c_semi2["sumula_arquivo"] == "/uploads/sumulas/semi2.pdf"

        # Check Final details
        c_final = conn.execute(text(
            "SELECT c.id_confronto FROM confrontos c "
            "JOIN migracao_partidas_origem m ON c.id_confronto = m.id_confronto_resultante "
            "WHERE m.id_partida_origem = 300"
        )).mappings().one()

        # Semi 2 must point to Final
        assert c_semi2["id_proximo_confronto"] == c_final["id_confronto"]

        # Semi 1 must also point to Final
        c_semi1 = conn.execute(text(
            "SELECT c.id_confronto, c.id_proximo_confronto, c.status FROM confrontos c "
            "JOIN migracao_partidas_origem m ON c.id_confronto = m.id_confronto_resultante "
            "WHERE m.id_partida_origem = 100"
        )).mappings().one()
        assert c_semi1["id_proximo_confronto"] == c_final["id_confronto"]
        assert c_semi1["status"] == "Agendado"


def test_migration_fails_before_ddl_if_ambiguous_competition(tmp_path):
    """If a partida cannot be unambiguously mapped to a single competition, fail before DDL."""
    database_url = f"sqlite:///{tmp_path / 'ambigua.sqlite'}"
    engine = preparar_dados_historicos(database_url, ambigua=True)

    with pytest.raises(RuntimeError, match="não foi possível identificar competição"):
        command.upgrade(alembic_config(database_url), "head")

    with engine.connect() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20260824_0003"
        inspector = inspect(engine)
        assert not inspector.has_table("confrontos")
        assert not inspector.has_table("migracao_partidas_origem")


def test_migration_downgrade_blocked_if_migrated_confrontos(tmp_path):
    """Downgrade must be refused if migrated confrontations exist."""
    database_url = f"sqlite:///{tmp_path / 'downgrade.sqlite'}"
    engine = preparar_dados_historicos(database_url)
    command.upgrade(alembic_config(database_url), "head")

    with pytest.raises(RuntimeError, match="bloqueado"):
        command.downgrade(alembic_config(database_url), "20260824_0003")


def test_migration_compiles_for_mysql_offline_without_connecting():
    """Compiling offline migration for MySQL produces DDL for confrontos and audit."""
    output = StringIO()
    config = alembic_config("mysql+pymysql://user:password@localhost/gerencia", output)

    command.upgrade(config, "head", sql=True)

    ddl = output.getvalue().lower()
    assert "create table confrontos" in ddl
    assert "create table migracao_partidas_origem" in ddl
