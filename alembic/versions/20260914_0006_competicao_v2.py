"""competicao v2 grupos jogadores e ocorrencias

Revision ID: 20260914_0006
Revises: 20260824_0005
Create Date: 2026-09-14
"""

from alembic import op
import sqlalchemy as sa


revision = "20260914_0006"
down_revision = "20260824_0005"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Tabela grupos_competicoes
    op.create_table(
        "grupos_competicoes",
        sa.Column("id_grupo", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=100), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("data_inicio", sa.Date(), nullable=True),
        sa.Column("data_fim", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="ATIVO", nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id_grupo"),
        sa.UniqueConstraint("slug", name="uq_grupos_competicoes_slug"),
    )
    op.create_index("ix_grupos_competicoes_id_grupo", "grupos_competicoes", ["id_grupo"])
    op.create_index("ix_grupos_competicoes_slug", "grupos_competicoes", ["slug"])

    # 2. Tabela jogadores
    op.create_table(
        "jogadores",
        sa.Column("id_jogador", sa.Integer(), nullable=False),
        sa.Column("id_equipe", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=100), nullable=False),
        sa.Column("numero_camisa", sa.Integer(), nullable=True),
        sa.Column("posicao", sa.String(length=50), nullable=True),
        sa.Column("documento", sa.String(length=30), nullable=True),
        sa.Column("data_nascimento", sa.Date(), nullable=True),
        sa.Column("foto_url", sa.String(length=255), nullable=True),
        sa.Column("ativo", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["id_equipe"], ["equipes.id_equipe"], name="fk_jogadores_equipe", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_jogador"),
    )
    op.create_index("ix_jogadores_id_jogador", "jogadores", ["id_jogador"])
    op.create_index("ix_jogadores_id_equipe", "jogadores", ["id_equipe"])

    # 3. Tabela ocorrencias_partida
    op.create_table(
        "ocorrencias_partida",
        sa.Column("id_ocorrencia", sa.Integer(), nullable=False),
        sa.Column("id_confronto", sa.Integer(), nullable=False),
        sa.Column("id_equipe", sa.Integer(), nullable=False),
        sa.Column("id_jogador", sa.Integer(), nullable=True),
        sa.Column("tipo", sa.String(length=30), nullable=False),
        sa.Column("minuto", sa.Integer(), nullable=True),
        sa.Column("tempo_jogo", sa.String(length=10), server_default="1T", nullable=True),
        sa.Column("observacao", sa.String(length=200), nullable=True),
        sa.Column("criado_em", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["id_confronto"], ["confrontos.id_confronto"], name="fk_ocorrencias_confronto", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_equipe"], ["equipes.id_equipe"], name="fk_ocorrencias_equipe", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_jogador"], ["jogadores.id_jogador"], name="fk_ocorrencias_jogador", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id_ocorrencia"),
    )
    op.create_index("ix_ocorrencias_partida_id_ocorrencia", "ocorrencias_partida", ["id_ocorrencia"])
    op.create_index("ix_ocorrencias_partida_id_confronto", "ocorrencias_partida", ["id_confronto"])
    op.create_index("ix_ocorrencias_partida_id_equipe", "ocorrencias_partida", ["id_equipe"])
    op.create_index("ix_ocorrencias_partida_id_jogador", "ocorrencias_partida", ["id_jogador"])

    # 4. Alterações em competicoes (id_grupo, regras_formato, id_edicao nullable)
    with op.batch_alter_table("competicoes") as batch:
        batch.add_column(sa.Column("id_grupo", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("regras_formato", sa.JSON(), nullable=True))
        batch.alter_column("id_edicao", existing_type=sa.Integer(), nullable=True)
        batch.create_foreign_key(
            "fk_competicoes_grupo",
            "grupos_competicoes",
            ["id_grupo"],
            ["id_grupo"],
            ondelete="SET NULL",
        )
        batch.create_index("ix_competicoes_id_grupo", ["id_grupo"])

    # 5. Alterações em confrontos (ordem_jogo, penaltis_mandante, penaltis_visitante, id_confronto_ida)
    with op.batch_alter_table("confrontos") as batch:
        batch.add_column(sa.Column("ordem_jogo", sa.Integer(), server_default="1", nullable=False))
        batch.add_column(sa.Column("penaltis_mandante", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("penaltis_visitante", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("id_confronto_ida", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_confrontos_ida",
            "confrontos",
            ["id_confronto_ida"],
            ["id_confronto"],
            ondelete="SET NULL",
        )


def downgrade():
    with op.batch_alter_table("confrontos") as batch:
        batch.drop_constraint("fk_confrontos_ida", type_="foreignkey")
        batch.drop_column("id_confronto_ida")
        batch.drop_column("penaltis_visitante")
        batch.drop_column("penaltis_mandante")
        batch.drop_column("ordem_jogo")

    with op.batch_alter_table("competicoes") as batch:
        batch.drop_index("ix_competicoes_id_grupo")
        batch.drop_constraint("fk_competicoes_grupo", type_="foreignkey")
        batch.drop_column("regras_formato")
        batch.drop_column("id_grupo")
        batch.alter_column("id_edicao", existing_type=sa.Integer(), nullable=False)

    op.drop_index("ix_ocorrencias_partida_id_jogador", table_name="ocorrencias_partida")
    op.drop_index("ix_ocorrencias_partida_id_equipe", table_name="ocorrencias_partida")
    op.drop_index("ix_ocorrencias_partida_id_confronto", table_name="ocorrencias_partida")
    op.drop_index("ix_ocorrencias_partida_id_ocorrencia", table_name="ocorrencias_partida")
    op.drop_table("ocorrencias_partida")

    op.drop_index("ix_jogadores_id_equipe", table_name="jogadores")
    op.drop_index("ix_jogadores_id_jogador", table_name="jogadores")
    op.drop_table("jogadores")

    op.drop_index("ix_grupos_competicoes_slug", table_name="grupos_competicoes")
    op.drop_index("ix_grupos_competicoes_id_grupo", table_name="grupos_competicoes")
    op.drop_table("grupos_competicoes")
