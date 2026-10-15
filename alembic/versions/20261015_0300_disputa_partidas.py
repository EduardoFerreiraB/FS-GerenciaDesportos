"""estrutura de disputa, duelos e partidas (fatia 2)

Cria grupos_competicao, duelos_eliminatorios, vagas_duelo, partidas e ocorrencias_partida.
Adiciona id_grupo em equipes com FK composta e adiciona FK em requisicoes_partida.

Revision ID: 20261015_0300
Revises: 20261015_0200
Create Date: 2026-10-15 22:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261015_0300"
down_revision: Union[str, Sequence[str], None] = "20261015_0200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

AGORA = sa.text("CURRENT_TIMESTAMP")
FALSO = sa.text("0")


def upgrade() -> None:
    # 1. grupos_competicao
    op.create_table(
        "grupos_competicao",
        sa.Column("id_grupo", sa.Integer(), nullable=False),
        sa.Column("id_edicao_competicao", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=50), nullable=False),
        sa.Column("ordem", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao"],
            ["edicoes_competicao.id_edicao_competicao"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_grupo"),
        sa.UniqueConstraint(
            "id_edicao_competicao", "nome", name="uq_grupos_competicao_edicao_nome"
        ),
        sa.UniqueConstraint(
            "id_edicao_competicao", "id_grupo", name="uq_grupos_competicao_edicao_id"
        ),
    )

    # 2. duelos_eliminatorios
    op.create_table(
        "duelos_eliminatorios",
        sa.Column("id_duelo", sa.Integer(), nullable=False),
        sa.Column("id_edicao_competicao", sa.Integer(), nullable=False),
        sa.Column("fase", sa.String(length=50), nullable=False),
        sa.Column("posicao_chave", sa.Integer(), nullable=False),
        sa.Column(
            "estado",
            sa.Enum("PENDENTE", "DEFINIDO", "RESOLVIDO", name="estado_duelo_enum"),
            server_default=sa.text("'PENDENTE'"),
            nullable=False,
        ),
        sa.Column("id_equipe_vencedora", sa.Integer(), nullable=True),
        sa.Column("ida_volta", sa.Boolean(), server_default=FALSO, nullable=False),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao"],
            ["edicoes_competicao.id_edicao_competicao"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_equipe_vencedora"],
            ["equipes.id_equipe"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id_duelo"),
        sa.UniqueConstraint(
            "id_edicao_competicao",
            "fase",
            "posicao_chave",
            name="uq_duelos_edicao_fase_posicao",
        ),
        sa.UniqueConstraint(
            "id_edicao_competicao", "id_duelo", name="uq_duelos_edicao_id"
        ),
    )

    # 3. vagas_duelo
    op.create_table(
        "vagas_duelo",
        sa.Column("id_vaga", sa.Integer(), nullable=False),
        sa.Column("id_duelo", sa.Integer(), nullable=False),
        sa.Column("posicao", sa.Integer(), nullable=False),
        sa.Column(
            "origem",
            sa.Enum(
                "EQUIPE_INICIAL",
                "POSICAO_GRUPO",
                "VENCEDOR_DUELO",
                "PERDEDOR_DUELO",
                "FOLGA",
                name="origem_vaga_enum",
            ),
            nullable=False,
        ),
        sa.Column("id_equipe", sa.Integer(), nullable=True),
        sa.Column("id_grupo", sa.Integer(), nullable=True),
        sa.Column("posicao_grupo", sa.Integer(), nullable=True),
        sa.Column("id_duelo_origem", sa.Integer(), nullable=True),
        sa.Column("id_equipe_resolvida", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["id_duelo"],
            ["duelos_eliminatorios.id_duelo"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_equipe"],
            ["equipes.id_equipe"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["id_grupo"],
            ["grupos_competicao.id_grupo"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["id_duelo_origem"],
            ["duelos_eliminatorios.id_duelo"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["id_equipe_resolvida"],
            ["equipes.id_equipe"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id_vaga"),
        sa.UniqueConstraint("id_duelo", "posicao", name="uq_vagas_duelo_posicao"),
    )

    # 4. equipes: adicionar id_grupo, FK composta e indice
    with op.batch_alter_table("equipes") as batch_op:
        batch_op.add_column(sa.Column("id_grupo", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_equipes_grupo_edicao",
            "grupos_competicao",
            ["id_edicao_competicao", "id_grupo"],
            ["id_edicao_competicao", "id_grupo"],
        )
        batch_op.create_index(
            "ix_equipes_edicao_grupo",
            ["id_edicao_competicao", "id_grupo"],
            unique=False,
        )

    # 5. partidas
    op.create_table(
        "partidas",
        sa.Column("id_partida", sa.Integer(), nullable=False),
        sa.Column("id_edicao_competicao", sa.Integer(), nullable=False),
        sa.Column("id_grupo", sa.Integer(), nullable=True),
        sa.Column("id_duelo", sa.Integer(), nullable=True),
        sa.Column("rodada", sa.Integer(), nullable=True),
        sa.Column("ordem_jogo", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("id_equipe_mandante", sa.Integer(), nullable=False),
        sa.Column("id_equipe_visitante", sa.Integer(), nullable=False),
        sa.Column("data", sa.Date(), nullable=True),
        sa.Column("hora", sa.Time(), nullable=True),
        sa.Column("id_local", sa.Integer(), nullable=True),
        sa.Column("id_arbitro", sa.Integer(), nullable=True),
        sa.Column(
            "estado",
            sa.Enum(
                "AGENDADA",
                "EM_ANDAMENTO",
                "FINALIZADA",
                "CANCELADA",
                name="estado_partida_enum",
            ),
            server_default=sa.text("'AGENDADA'"),
            nullable=False,
        ),
        sa.Column("penaltis_mandante", sa.Integer(), nullable=True),
        sa.Column("penaltis_visitante", sa.Integer(), nullable=True),
        sa.Column("revisao", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.Column("atualizado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao"],
            ["edicoes_competicao.id_edicao_competicao"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao", "id_grupo"],
            ["grupos_competicao.id_edicao_competicao", "grupos_competicao.id_grupo"],
            name="fk_partidas_grupo_edicao",
        ),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao", "id_duelo"],
            ["duelos_eliminatorios.id_edicao_competicao", "duelos_eliminatorios.id_duelo"],
            name="fk_partidas_duelo_edicao",
        ),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao", "id_equipe_mandante"],
            ["equipes.id_edicao_competicao", "equipes.id_equipe"],
            name="fk_partidas_mandante_edicao",
        ),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao", "id_equipe_visitante"],
            ["equipes.id_edicao_competicao", "equipes.id_equipe"],
            name="fk_partidas_visitante_edicao",
        ),
        sa.ForeignKeyConstraint(
            ["id_local"],
            ["locais.id_local"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["id_arbitro"],
            ["arbitros.id_arbitro"],
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "id_equipe_mandante <> id_equipe_visitante",
            name="ck_partidas_equipes_distintas",
        ),
        sa.PrimaryKeyConstraint("id_partida"),
    )
    op.create_index(
        "ix_partidas_edicao_grupo",
        "partidas",
        ["id_edicao_competicao", "id_grupo"],
        unique=False,
    )
    op.create_index(
        "ix_partidas_edicao_duelo",
        "partidas",
        ["id_edicao_competicao", "id_duelo"],
        unique=False,
    )
    op.create_index(
        "ix_partidas_edicao_mandante",
        "partidas",
        ["id_edicao_competicao", "id_equipe_mandante"],
        unique=False,
    )
    op.create_index(
        "ix_partidas_edicao_visitante",
        "partidas",
        ["id_edicao_competicao", "id_equipe_visitante"],
        unique=False,
    )

    # 6. ocorrencias_partida
    op.create_table(
        "ocorrencias_partida",
        sa.Column("id_ocorrencia", sa.Integer(), nullable=False),
        sa.Column("id_partida", sa.Integer(), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum("GOL", name="tipo_ocorrencia_enum"),
            server_default=sa.text("'GOL'"),
            nullable=False,
        ),
        sa.Column("id_equipe_beneficiada", sa.Integer(), nullable=False),
        sa.Column("id_integrante", sa.Integer(), nullable=True),
        sa.Column("minuto", sa.Integer(), nullable=True),
        sa.Column("periodo", sa.String(length=20), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column("id_usuario_autor", sa.Integer(), nullable=True),
        sa.Column("id_ocorrencia_origem", sa.Integer(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.ForeignKeyConstraint(
            ["id_partida"],
            ["partidas.id_partida"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_equipe_beneficiada"],
            ["equipes.id_equipe"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_integrante"],
            ["integrantes_equipe.id_integrante"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["id_usuario_autor"],
            ["usuarios.id_usuario"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["id_ocorrencia_origem"],
            ["ocorrencias_partida.id_ocorrencia"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_ocorrencia"),
    )

    # 7. requisicoes_partida: adicionar FK para partidas.id_partida
    with op.batch_alter_table("requisicoes_partida") as batch_op:
        batch_op.create_foreign_key(
            "fk_requisicoes_partida_partida",
            "partidas",
            ["id_partida"],
            ["id_partida"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    # 7. RequisicoesPartida FK
    with op.batch_alter_table("requisicoes_partida") as batch_op:
        batch_op.drop_constraint("fk_requisicoes_partida_partida", type_="foreignkey")

    # 6. OcorrenciasPartida
    op.drop_table("ocorrencias_partida")

    # 5. Partidas
    op.drop_index("ix_partidas_edicao_visitante", table_name="partidas")
    op.drop_index("ix_partidas_edicao_mandante", table_name="partidas")
    op.drop_index("ix_partidas_edicao_duelo", table_name="partidas")
    op.drop_index("ix_partidas_edicao_grupo", table_name="partidas")
    op.drop_table("partidas")

    # 4. Equipes
    with op.batch_alter_table("equipes") as batch_op:
        batch_op.drop_index("ix_equipes_edicao_grupo")
        batch_op.drop_constraint("fk_equipes_grupo_edicao", type_="foreignkey")
        batch_op.drop_column("id_grupo")

    # 3. VagasDuelo
    op.drop_table("vagas_duelo")

    # 2. DuelosEliminatorios
    op.drop_table("duelos_eliminatorios")

    # 1. GruposCompeticao
    op.drop_table("grupos_competicao")
