"""inscricoes individuais provas e resultados

Revision ID: 20260824_0005
Revises: 20260824_0004
Create Date: 2026-08-24
"""

from alembic import context, op
import sqlalchemy as sa


revision = "20260824_0005"
down_revision = "20260824_0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "inscricoes_individuais",
        sa.Column("id_inscricao", sa.Integer(), nullable=False),
        sa.Column("id_competicao", sa.Integer(), nullable=False),
        sa.Column("id_participante", sa.Integer(), nullable=False),
        sa.Column("numero_peito", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["id_competicao"], ["competicoes.id_competicao"]),
        sa.ForeignKeyConstraint(["id_participante"], ["participantes.id_participante"]),
        sa.PrimaryKeyConstraint("id_inscricao"),
        sa.UniqueConstraint("id_competicao", "id_participante", name="uq_inscricao_competicao_participante"),
    )
    op.create_index("ix_inscricoes_individuais_id_inscricao", "inscricoes_individuais", ["id_inscricao"])

    op.create_table(
        "provas",
        sa.Column("id_prova", sa.Integer(), nullable=False),
        sa.Column("id_competicao", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("data", sa.Date(), nullable=True),
        sa.Column("hora", sa.Time(), nullable=True),
        sa.Column("id_local", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("Agendada", "Em Andamento", "Finalizada", "Cancelada"),
            nullable=False,
        ),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["id_competicao"], ["competicoes.id_competicao"]),
        sa.ForeignKeyConstraint(["id_local"], ["locais.id_local"]),
        sa.PrimaryKeyConstraint("id_prova"),
    )
    op.create_index("ix_provas_id_prova", "provas", ["id_prova"])

    op.create_table(
        "resultados_prova",
        sa.Column("id_resultado", sa.Integer(), nullable=False),
        sa.Column("id_prova", sa.Integer(), nullable=False),
        sa.Column("id_participante", sa.Integer(), nullable=False),
        sa.Column("tempo_ms", sa.Integer(), nullable=False),
        sa.Column("posicao", sa.Integer(), nullable=True),
        sa.Column("desqualificado", sa.Boolean(), nullable=False),
        sa.Column("motivo_desqualificacao", sa.String(length=255), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["id_participante"], ["participantes.id_participante"]),
        sa.ForeignKeyConstraint(["id_prova"], ["provas.id_prova"]),
        sa.PrimaryKeyConstraint("id_resultado"),
        sa.UniqueConstraint("id_prova", "id_participante", name="uq_prova_participante"),
    )
    op.create_index("ix_resultados_prova_id_resultado", "resultados_prova", ["id_resultado"])


def downgrade():
    op.drop_index("ix_resultados_prova_id_resultado", table_name="resultados_prova")
    op.drop_table("resultados_prova")
    op.drop_index("ix_provas_id_prova", table_name="provas")
    op.drop_table("provas")
    op.drop_index("ix_inscricoes_individuais_id_inscricao", table_name="inscricoes_individuais")
    op.drop_table("inscricoes_individuais")
