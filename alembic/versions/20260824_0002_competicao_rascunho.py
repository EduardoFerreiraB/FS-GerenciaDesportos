"""allow competition drafts and migrate the planned state

Revision ID: 20260824_0002
Revises: 20260824_0001
Create Date: 2026-08-24
"""

from alembic import context, op
import sqlalchemy as sa


revision = "20260824_0002"
down_revision = "20260824_0001"
branch_labels = None
depends_on = None


MODO = sa.Enum("EQUIPE", "INDIVIDUAL")
FORMATO = sa.Enum("PONTOS_CORRIDOS", "GRUPOS", "MATA_MATA", "PROVAS")
CRITERIO = sa.Enum("PLACAR", "TEMPO", "PONTOS", "POSICAO")


def upgrade():
    op.execute("UPDATE competicoes SET status = 'RASCUNHO' WHERE status = 'PLANEJADA'")
    with op.batch_alter_table("competicoes") as batch:
        batch.alter_column("modo_inscricao", existing_type=MODO, nullable=True)
        batch.alter_column("formato", existing_type=FORMATO, nullable=True)
        batch.alter_column("criterio_resultado", existing_type=CRITERIO, nullable=True)
        batch.alter_column("data_inicio", existing_type=sa.Date(), nullable=True)
        batch.alter_column("data_fim", existing_type=sa.Date(), nullable=True)


def downgrade():
    if context.is_offline_mode():
        raise RuntimeError("O downgrade requer conexão para verificar rascunhos incompletos.")
    connection = op.get_bind()
    incomplete = connection.execute(
        sa.text(
            "SELECT 1 FROM competicoes WHERE modo_inscricao IS NULL OR formato IS NULL "
            "OR criterio_resultado IS NULL OR data_inicio IS NULL OR data_fim IS NULL LIMIT 1"
        )
    ).first()
    if incomplete:
        raise RuntimeError("Não é possível reverter com rascunhos incompletos.")
    op.execute("UPDATE competicoes SET status = 'PLANEJADA' WHERE status = 'RASCUNHO'")
    with op.batch_alter_table("competicoes") as batch:
        batch.alter_column("modo_inscricao", existing_type=MODO, nullable=False)
        batch.alter_column("formato", existing_type=FORMATO, nullable=False)
        batch.alter_column("criterio_resultado", existing_type=CRITERIO, nullable=False)
        batch.alter_column("data_inicio", existing_type=sa.Date(), nullable=False)
        batch.alter_column("data_fim", existing_type=sa.Date(), nullable=False)
