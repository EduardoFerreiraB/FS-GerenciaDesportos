"""assign historical teams to competitions without dropping legacy links

Revision ID: 20260824_0003
Revises: 20260824_0002
Create Date: 2026-08-24
"""

from alembic import context, op
import sqlalchemy as sa


revision = "20260824_0003"
down_revision = "20260824_0002"
branch_labels = None
depends_on = None


def _matches_by_modality(connection, id_equipe, id_edicao):
    rows = connection.execute(
        sa.text(
            "SELECT DISTINCT id_modalidade FROM partidas "
            "WHERE id_edicao = :id_edicao AND (id_equipe_casa = :id_equipe OR id_equipe_visitante = :id_equipe) "
            "ORDER BY id_modalidade"
        ),
        {"id_equipe": id_equipe, "id_edicao": id_edicao},
    ).scalars()
    return list(rows)


def _competition_for_modality(connection, id_edicao, id_modalidade):
    return connection.execute(
        sa.text(
            "SELECT id_competicao FROM competicoes "
            "WHERE id_edicao = :id_edicao AND id_modalidade = :id_modalidade "
            "AND modo_inscricao = 'EQUIPE' ORDER BY id_competicao"
        ),
        {"id_edicao": id_edicao, "id_modalidade": id_modalidade},
    ).scalars().all()


def _plan(connection):
    """Calculate every mutation first, so ambiguous played teams stop cleanly."""
    plans = []
    teams = connection.execute(
        sa.text(
            "SELECT id_equipe, nome, id_edicao, grupo FROM equipes "
            "WHERE id_competicao IS NULL ORDER BY id_equipe"
        )
    ).mappings().all()
    for team in teams:
        foreign_edition_match = connection.execute(
            sa.text(
                "SELECT id_partida FROM partidas WHERE id_edicao != :id_edicao "
                "AND (id_equipe_casa = :id_equipe OR id_equipe_visitante = :id_equipe) LIMIT 1"
            ),
            {"id_edicao": team["id_edicao"], "id_equipe": team["id_equipe"]},
        ).scalar()
        if foreign_edition_match is not None:
            raise RuntimeError(
                "não foi possível inferir equipe histórica "
                f"{team['id_equipe']}: partida {foreign_edition_match} pertence a edição diferente."
            )
        modalities = _matches_by_modality(connection, team["id_equipe"], team["id_edicao"])
        targets = []
        if modalities:
            for modality in modalities:
                competitions = _competition_for_modality(connection, team["id_edicao"], modality)
                if len(competitions) != 1:
                    raise RuntimeError(
                        "não foi possível inferir competição para equipe histórica "
                        f"{team['id_equipe']} com partidas na modalidade {modality}."
                    )
                targets.append((modality, competitions[0]))
        else:
            competitions = connection.execute(
                sa.text(
                    "SELECT id_competicao FROM competicoes "
                    "WHERE id_edicao = :id_edicao AND modo_inscricao = 'EQUIPE' "
                    "ORDER BY id_competicao"
                ),
                {"id_edicao": team["id_edicao"]},
            ).scalars().all()
            if len(competitions) == 1:
                targets.append((None, competitions[0]))
            else:
                reason = (
                    "sem partidas e sem competição EQUIPE inferível"
                    if not competitions
                    else "sem partidas e com mais de uma competição EQUIPE possível"
                )
                plans.append((team, [], reason))
                continue
        plans.append((team, targets, None))
    return plans


def _audit(connection, original, resulting, competition, status, reason=None):
    connection.execute(
        sa.text(
            "INSERT INTO migracao_equipes_origem "
            "(id_equipe_origem, id_equipe_resultante, id_competicao, status, motivo) "
            "VALUES (:original, :resulting, :competition, :status, :reason)"
        ),
        {
            "original": original,
            "resulting": resulting,
            "competition": competition,
            "status": status,
            "reason": reason,
        },
    )


def _create_audit_table():
    op.create_table(
        "migracao_equipes_origem",
        sa.Column("id_migracao", sa.Integer(), nullable=False),
        sa.Column("id_equipe_origem", sa.Integer(), nullable=False),
        sa.Column("id_equipe_resultante", sa.Integer(), nullable=True),
        sa.Column("id_competicao", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["id_equipe_origem"], ["equipes.id_equipe"]),
        sa.ForeignKeyConstraint(["id_equipe_resultante"], ["equipes.id_equipe"]),
        sa.ForeignKeyConstraint(["id_competicao"], ["competicoes.id_competicao"]),
        sa.PrimaryKeyConstraint("id_migracao"),
    )


def upgrade():
    if context.is_offline_mode():
        _create_audit_table()
        op.execute("-- A reconciliação de equipes requer conexão e deve ser executada em cópia anonimizada.")
        return

    connection = op.get_bind()
    # SQLite DDL is not transactionally reversible.  Infer every played team
    # before the first DDL/DML so an ambiguous history leaves the database as
    # it was and Alembic remains at the prior revision.
    plans = _plan(connection)
    _create_audit_table()
    for team, targets, pending_reason in plans:
        original = team["id_equipe"]
        if pending_reason:
            _audit(connection, original, None, None, "PENDENTE", pending_reason)
            continue

        resulting_by_modality = {}
        for index, (modality, competition) in enumerate(targets):
            if index == 0:
                resulting = original
                connection.execute(
                    sa.text("UPDATE equipes SET id_competicao = :competition WHERE id_equipe = :team"),
                    {"competition": competition, "team": original},
                )
            else:
                insert = connection.execute(
                    sa.text(
                        "INSERT INTO equipes (nome, id_edicao, id_competicao, grupo) "
                        "VALUES (:nome, :id_edicao, :competition, :grupo)"
                    ),
                    {
                        "nome": team["nome"],
                        "id_edicao": team["id_edicao"],
                        "competition": competition,
                        "grupo": team["grupo"],
                    },
                )
                resulting = insert.lastrowid
                connection.execute(
                    sa.text(
                        "INSERT INTO equipes_participantes (id_equipe, id_participante) "
                        "SELECT :resulting, id_participante FROM equipes_participantes "
                        "WHERE id_equipe = :original"
                    ),
                    {"resulting": resulting, "original": original},
                )
            resulting_by_modality[modality] = resulting
            _audit(connection, original, resulting, competition, "MIGRADA")

        for modality, resulting in resulting_by_modality.items():
            if modality is None:
                continue
            connection.execute(
                sa.text(
                    "UPDATE partidas SET id_equipe_casa = :resulting "
                    "WHERE id_edicao = :id_edicao AND id_modalidade = :modality AND id_equipe_casa = :original"
                ),
                {"resulting": resulting, "id_edicao": team["id_edicao"], "modality": modality, "original": original},
            )
            connection.execute(
                sa.text(
                    "UPDATE partidas SET id_equipe_visitante = :resulting "
                    "WHERE id_edicao = :id_edicao AND id_modalidade = :modality AND id_equipe_visitante = :original"
                ),
                {"resulting": resulting, "id_edicao": team["id_edicao"], "modality": modality, "original": original},
            )


def downgrade():
    if context.is_offline_mode():
        raise RuntimeError("O downgrade de equipes por competição requer conexão para verificar a auditoria.")
    connection = op.get_bind()
    migrated = connection.execute(
        sa.text("SELECT 1 FROM migracao_equipes_origem LIMIT 1")
    ).first()
    if migrated:
        raise RuntimeError(
            "O downgrade de equipes por competição é bloqueado: clones e partidas exigem reconciliação manual."
        )
    # A fresh/rehearsal database with no historical rows can traverse this
    # revision so the prior draft migration keeps its own downgrade contract.
    op.drop_table("migracao_equipes_origem")
