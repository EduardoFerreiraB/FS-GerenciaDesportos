"""sumula, disciplina e decisoes de classificacao (fatia 3)

Expande o enum tipo_ocorrencia_enum em ocorrencias_partida e cria as tabelas
suspensoes_competicao, cumprimentos_suspensao e decisoes_classificacao.

Revision ID: 20261015_0400
Revises: 20261015_0300
Create Date: 2026-10-15 23:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261015_0400"
down_revision: Union[str, Sequence[str], None] = "20261015_0300"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

AGORA = sa.text("CURRENT_TIMESTAMP")


def upgrade() -> None:
    # 1. Expandir enum tipo em ocorrencias_partida
    with op.batch_alter_table("ocorrencias_partida") as batch_op:
        batch_op.alter_column(
            "tipo",
            existing_type=sa.Enum("GOL", name="tipo_ocorrencia_enum"),
            type_=sa.Enum(
                "GOL",
                "GOL_CONTRA",
                "CARTAO_AMARELO",
                "CARTAO_VERMELHO_DIRETO",
                "EXPULSAO_SEGUNDO_AMARELO",
                name="tipo_ocorrencia_enum",
            ),
            existing_nullable=False,
            existing_server_default=sa.text("'GOL'"),
            nullable=False,
            server_default=sa.text("'GOL'"),
        )

    # 2. suspensoes_competicao
    op.create_table(
        "suspensoes_competicao",
        sa.Column("id_suspensao", sa.Integer(), nullable=False),
        sa.Column("id_edicao_competicao", sa.Integer(), nullable=False),
        sa.Column("id_integrante", sa.Integer(), nullable=False),
        sa.Column("id_partida_origem", sa.Integer(), nullable=True),
        sa.Column("id_ocorrencia_origem", sa.Integer(), nullable=True),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column(
            "origem",
            sa.Enum(
                "ACUMULO_AMARELOS",
                "VERMELHO_DIRETO",
                "SEGUNDO_AMARELO",
                "MANUAL",
                name="origem_suspensao_enum",
            ),
            nullable=False,
        ),
        sa.Column("chave_origem", sa.String(length=120), nullable=True),
        sa.Column("jogos", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column(
            "situacao",
            sa.Enum(
                "ATIVA",
                "CUMPRIDA",
                "EM_REVISAO",
                "CANCELADA",
                name="situacao_suspensao_enum",
            ),
            server_default=sa.text("'ATIVA'"),
            nullable=False,
        ),
        sa.Column("id_usuario_responsavel", sa.Integer(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.Column("atualizado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao"],
            ["edicoes_competicao.id_edicao_competicao"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_integrante"],
            ["integrantes_equipe.id_integrante"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_partida_origem"],
            ["partidas.id_partida"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["id_ocorrencia_origem"],
            ["ocorrencias_partida.id_ocorrencia"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["id_usuario_responsavel"],
            ["usuarios.id_usuario"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("chave_origem", name="uq_suspensoes_chave_origem"),
        sa.CheckConstraint("jogos >= 1", name="ck_suspensoes_jogos_positivo"),
        sa.PrimaryKeyConstraint("id_suspensao"),
    )
    op.create_index(
        "ix_suspensoes_edicao_integrante",
        "suspensoes_competicao",
        ["id_edicao_competicao", "id_integrante"],
        unique=False,
    )

    # 3. cumprimentos_suspensao
    op.create_table(
        "cumprimentos_suspensao",
        sa.Column("id_cumprimento", sa.Integer(), nullable=False),
        sa.Column("id_suspensao", sa.Integer(), nullable=False),
        sa.Column("id_integrante", sa.Integer(), nullable=False),
        sa.Column("id_partida", sa.Integer(), nullable=False),
        sa.Column("id_usuario_responsavel", sa.Integer(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.ForeignKeyConstraint(
            ["id_suspensao"],
            ["suspensoes_competicao.id_suspensao"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_integrante"],
            ["integrantes_equipe.id_integrante"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_partida"],
            ["partidas.id_partida"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_usuario_responsavel"],
            ["usuarios.id_usuario"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "id_partida",
            "id_integrante",
            name="uq_cumprimentos_partida_integrante",
        ),
        sa.PrimaryKeyConstraint("id_cumprimento"),
    )
    op.create_index(
        "ix_cumprimentos_suspensao",
        "cumprimentos_suspensao",
        ["id_suspensao"],
        unique=False,
    )

    # 4. decisoes_classificacao
    op.create_table(
        "decisoes_classificacao",
        sa.Column("id_decisao", sa.Integer(), nullable=False),
        sa.Column("id_edicao_competicao", sa.Integer(), nullable=False),
        sa.Column("id_grupo", sa.Integer(), nullable=True),
        sa.Column("conjunto_equipes", sa.JSON(), nullable=False),
        sa.Column("ordem_escolhida", sa.JSON(), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("revisao_resultados", sa.String(length=64), nullable=False),
        sa.Column("id_usuario_responsavel", sa.Integer(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao"],
            ["edicoes_competicao.id_edicao_competicao"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao", "id_grupo"],
            ["grupos_competicao.id_edicao_competicao", "grupos_competicao.id_grupo"],
            name="fk_decisoes_grupo_edicao",
        ),
        sa.ForeignKeyConstraint(
            ["id_usuario_responsavel"],
            ["usuarios.id_usuario"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id_decisao"),
    )
    op.create_index(
        "ix_decisoes_edicao_grupo",
        "decisoes_classificacao",
        ["id_edicao_competicao", "id_grupo"],
        unique=False,
    )


def downgrade() -> None:
    # 4. decisoes_classificacao
    op.drop_index("ix_decisoes_edicao_grupo", table_name="decisoes_classificacao")
    op.drop_table("decisoes_classificacao")

    # 3. cumprimentos_suspensao
    op.drop_index("ix_cumprimentos_suspensao", table_name="cumprimentos_suspensao")
    op.drop_table("cumprimentos_suspensao")

    # 2. suspensoes_competicao
    op.drop_index("ix_suspensoes_edicao_integrante", table_name="suspensoes_competicao")
    op.drop_table("suspensoes_competicao")

    # 1. Reverter enum tipo em ocorrencias_partida
    with op.batch_alter_table("ocorrencias_partida") as batch_op:
        batch_op.alter_column(
            "tipo",
            existing_type=sa.Enum(
                "GOL",
                "GOL_CONTRA",
                "CARTAO_AMARELO",
                "CARTAO_VERMELHO_DIRETO",
                "EXPULSAO_SEGUNDO_AMARELO",
                name="tipo_ocorrencia_enum",
            ),
            type_=sa.Enum("GOL", name="tipo_ocorrencia_enum"),
            existing_nullable=False,
            existing_server_default=sa.text("'GOL'"),
            nullable=False,
            server_default=sa.text("'GOL'"),
        )
