"""Passo 3 data-migration contract, isolated from developer databases."""

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


def preparar_dados_historicos(database_url: str, *, modalidade_sem_competicao=False):
    command.upgrade(alembic_config(database_url), "20260824_0002")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO eventos (id_evento, even_nome) VALUES (1, 'Jogos anonimizados')"))
        connection.execute(text("INSERT INTO modalidades (id_modalidade, nome, duracao_minutos) VALUES (1, 'Futebol', 90), (2, 'Volei', 60), (3, 'Sem competição', 45)"))
        connection.execute(text("INSERT INTO edicoes (id_edicao, id_evento, edic_ano, tipo_competicao, data_inicio, data_fim) VALUES (1, 1, 2026, 'Pontos Corridos', '2026-08-01', '2026-08-31')"))
        connection.execute(text("INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, status) VALUES (10, 1, 1, 'Futebol', 'Livre', 'EQUIPE', 'PONTOS_CORRIDOS', 'PLACAR', '2026-08-01', '2026-08-31', 'RASCUNHO'), (11, 1, 2, 'Volei', 'Livre', 'EQUIPE', 'GRUPOS', 'PLACAR', '2026-08-01', '2026-08-31', 'RASCUNHO')"))
        connection.execute(text("INSERT INTO participantes (id_participante, tipo) VALUES (1, 'aluno'), (2, 'atleta')"))
        connection.execute(text("INSERT INTO equipes (id_equipe, nome, id_edicao, id_competicao, grupo) VALUES (20, 'Equipe histórica', 1, NULL, 'A')"))
        connection.execute(text("INSERT INTO equipes_participantes (id_equipe, id_participante) VALUES (20, 1), (20, 2)"))
        connection.execute(text("INSERT INTO locais (id_local, loca_nome, ativo) VALUES (1, 'Local', 1)"))
        connection.execute(text("INSERT INTO arbitros (id_arbitro, apito_nome, apito_doc, apito_tel) VALUES (1, 'Arbitro', 'doc', 'tel')"))
        modalidade_extra = 3 if modalidade_sem_competicao else 2
        connection.execute(text("INSERT INTO partidas (id_partida, id_edicao, id_local, id_arbitro, id_modalidade, id_equipe_casa, id_equipe_visitante, part_data, part_hora, placar_casa, placar_visitante, status) VALUES (100, 1, 1, 1, 1, 20, NULL, '2026-08-02', '10:00:00', 1, 0, 'Agendada'), (101, 1, 1, 1, :modalidade, 20, NULL, '2026-08-03', '10:00:00', 1, 0, 'Agendada')"), {"modalidade": modalidade_extra})
    return engine


def test_migration_splits_multimodality_team_preserving_roster_and_matches(tmp_path):
    """Removing clone/remap logic would lose a modality's roster or match link."""
    database_url = f"sqlite:///{tmp_path / 'historico.sqlite'}"
    engine = preparar_dados_historicos(database_url)

    command.upgrade(alembic_config(database_url), "head")
    command.upgrade(alembic_config(database_url), "head")

    with engine.connect() as connection:
        equipes = connection.execute(text("SELECT id_equipe, id_competicao FROM equipes ORDER BY id_equipe")).all()
        assert len(equipes) == 2
        assert {competicao for _, competicao in equipes} == {10, 11}
        for id_equipe, _ in equipes:
            assert connection.execute(text("SELECT id_participante FROM equipes_participantes WHERE id_equipe = :id ORDER BY id_participante"), {"id": id_equipe}).scalars().all() == [1, 2]
        partidas = connection.execute(text("SELECT id_modalidade, id_equipe_casa FROM partidas ORDER BY id_partida")).all()
        equipe_por_id = dict(equipes)
        assert {equipe_por_id[id_equipe] for _, id_equipe in partidas} == {10, 11}
        auditoria = connection.execute(text("SELECT id_equipe_origem, id_equipe_resultante, id_competicao, status FROM migracao_equipes_origem ORDER BY id_competicao")).all()
        assert [(origem, competicao, status) for origem, _, competicao, status in auditoria] == [(20, 10, "MIGRADA"), (20, 11, "MIGRADA")]
        assert inspect(engine).has_table("migracao_equipes_origem")


def test_migration_rejects_unmatched_modality_with_matches_before_data_changes(tmp_path):
    """Removing the preflight rejection would silently leave a played team unmapped."""
    database_url = f"sqlite:///{tmp_path / 'inferencia-invalida.sqlite'}"
    engine = preparar_dados_historicos(database_url, modalidade_sem_competicao=True)

    with pytest.raises(RuntimeError, match="não foi possível inferir"):
        command.upgrade(alembic_config(database_url), "head")

    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20260824_0002"
        assert connection.execute(text("SELECT id_competicao FROM equipes WHERE id_equipe = 20")).scalar_one() is None
        assert connection.execute(text("SELECT id_equipe_casa FROM partidas WHERE id_partida = 101")).scalar_one() == 20
        assert not inspect(engine).has_table("migracao_equipes_origem")


def test_migration_keeps_team_without_matches_and_records_manual_review(tmp_path):
    """Assigning an arbitrary competition would hide a team whose modality cannot be inferred."""
    database_url = f"sqlite:///{tmp_path / 'pendente.sqlite'}"
    engine = preparar_dados_historicos(database_url)
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM partidas"))
        connection.execute(text("INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, nome, categoria, modo_inscricao, formato, criterio_resultado, data_inicio, data_fim, status) VALUES (12, 1, 1, 'Outra', 'Livre', 'EQUIPE', 'GRUPOS', 'PLACAR', '2026-08-01', '2026-08-31', 'RASCUNHO')"))

    command.upgrade(alembic_config(database_url), "head")

    with engine.connect() as connection:
        assert connection.execute(text("SELECT id_competicao FROM equipes WHERE id_equipe = 20")).scalar_one() is None
        assert connection.execute(text("SELECT id_participante FROM equipes_participantes WHERE id_equipe = 20 ORDER BY id_participante")).scalars().all() == [1, 2]
        assert connection.execute(text("SELECT status FROM migracao_equipes_origem")).scalar_one() == "PENDENTE"


def test_migration_rejects_cross_edition_match_before_data_changes(tmp_path):
    """Ignoring partida.id_edicao would remap a foreign-edition match using the wrong competition."""
    database_url = f"sqlite:///{tmp_path / 'edicao-cruzada.sqlite'}"
    engine = preparar_dados_historicos(database_url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO edicoes (id_edicao, id_evento, edic_ano, tipo_competicao, data_inicio, data_fim) VALUES (2, 1, 2027, 'Pontos Corridos', '2027-08-01', '2027-08-31')"))
        connection.execute(text("UPDATE partidas SET id_edicao = 2 WHERE id_partida = 101"))

    with pytest.raises(RuntimeError, match="edição diferente"):
        command.upgrade(alembic_config(database_url), "head")

    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20260824_0002"
        assert connection.execute(text("SELECT id_competicao FROM equipes WHERE id_equipe = 20")).scalar_one() is None
        assert not inspect(engine).has_table("migracao_equipes_origem")


def test_migration_compiles_for_mysql_offline_without_connecting():
    """Removing offline handling would make deployment-plan SQL generation query production data."""
    output = StringIO()
    config = alembic_config("mysql+pymysql://user:password@localhost/gerencia", output)

    command.upgrade(config, "head", sql=True)

    assert "migracao_equipes_origem" in output.getvalue().lower()
