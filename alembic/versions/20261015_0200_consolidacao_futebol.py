"""consolidacao do dominio de competicoes (futebol)

Descarta as tabelas esportivas antigas (V1, individuais, V2 e linhagens de
migracao) e cria identidade, recorrencia, competidores, elencos, auditoria e
idempotencia de partida. Escolinhas, autenticacao e cadastros compartilhados
nao sao tocados.

DDL congelado: esta revisao nao importa modelos da aplicacao.

Exige opcao explicita de descarte, verificada antes do primeiro DDL:

    alembic -x descartar_competicoes_teste=sim upgrade head

ou, programaticamente, ``config.attributes["descartar_competicoes_teste"] = True``.
O downgrade nao existe: a restauracao se faz por backup.

Revision ID: 20261015_0200
Revises: 20261015_0100
Create Date: 2026-10-15 20:00:00
"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = "20261015_0200"
down_revision: Union[str, Sequence[str], None] = "20261015_0100"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OPCAO_DESCARTE = "descartar_competicoes_teste"

# Ordem das chaves estrangeiras: dependentes antes das referenciadas.
TABELAS_ANTIGAS = (
    "suspensoes_competicao",
    "duelos_eliminatorios",
    "ocorrencias_partida",
    "migracao_partidas_origem",
    "estatisticas_partida",
    "resultados_prova",
    "partidas",
    "migracao_equipes_origem",
    "jogadores",
    "equipes_participantes",
    "confrontos",
    "provas",
    "inscricoes_individuais",
    "integrantes_equipe",
    "equipes",
    "grupos_competicao",
    "edicoes_competicao",
    "regulamentos_competicao",
    "competicoes",
    "modalidades_evento",
    "edicoes",
    "grupos_competicoes",
    "eventos",
)

AGORA = sa.text("CURRENT_TIMESTAMP")
FALSO = sa.text("0")


def _descarte_autorizado() -> bool:
    config = context.config
    if config is not None and config.attributes.get(OPCAO_DESCARTE) is True:
        return True
    return context.get_x_argument(as_dictionary=True).get(OPCAO_DESCARTE) == "sim"


def upgrade() -> None:
    # Primeira instrucao, antes de qualquer DDL: o MySQL/TiDB nao tem DDL
    # transacional, entao recusar depois do primeiro DROP deixaria o banco pela
    # metade.
    if not _descarte_autorizado():
        raise RuntimeError(
            "A revisao 20261015_0200 descarta todos os dados das tabelas esportivas "
            "antigas. Para confirmar, rode com "
            f"'-x {OPCAO_DESCARTE}=sim' (ou config.attributes['{OPCAO_DESCARTE}'] = True)."
        )

    conn = op.get_bind()
    if context.is_offline_mode():
        tabelas_existentes = set(TABELAS_ANTIGAS)
    else:
        insp = sa.inspect(conn)
        tabelas_existentes = set(insp.get_table_names())

    is_mysql = conn.dialect.name in ("mysql", "mariadb")
    if is_mysql:
        op.execute(sa.text("SET FOREIGN_KEY_CHECKS = 0;"))

    try:
        for tabela in TABELAS_ANTIGAS:
            if tabela in tabelas_existentes:
                op.drop_table(tabela)
    finally:
        if is_mysql:
            op.execute(sa.text("SET FOREIGN_KEY_CHECKS = 1;"))

    op.create_table(
        "eventos",
        sa.Column("id_evento", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("arquivado", sa.Boolean(), server_default=FALSO, nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.PrimaryKeyConstraint("id_evento"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "competicoes",
        sa.Column("id_competicao", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("id_modalidade", sa.Integer(), nullable=False),
        sa.Column("arquivado", sa.Boolean(), server_default=FALSO, nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.ForeignKeyConstraint(["id_modalidade"], ["modalidades.id_modalidade"]),
        sa.PrimaryKeyConstraint("id_competicao"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "edicoes_evento",
        sa.Column("id_edicao_evento", sa.Integer(), nullable=False),
        sa.Column("id_evento", sa.Integer(), nullable=False),
        sa.Column("identificacao", sa.String(length=100), nullable=False),
        sa.Column("data_inicio", sa.Date(), nullable=False),
        sa.Column("data_fim", sa.Date(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.CheckConstraint("data_inicio <= data_fim", name="ck_edicoes_evento_periodo"),
        sa.ForeignKeyConstraint(["id_evento"], ["eventos.id_evento"]),
        sa.PrimaryKeyConstraint("id_edicao_evento"),
        sa.UniqueConstraint("id_evento", "identificacao", name="uq_edicoes_evento_identificacao"),
    )
    op.create_table(
        "edicoes_competicao",
        sa.Column("id_edicao_competicao", sa.Integer(), nullable=False),
        sa.Column("id_competicao", sa.Integer(), nullable=False),
        sa.Column("id_edicao_evento", sa.Integer(), nullable=True),
        sa.Column("identificacao", sa.String(length=100), nullable=False),
        sa.Column("categoria", sa.String(length=100), nullable=True),
        sa.Column("data_inicio", sa.Date(), nullable=False),
        sa.Column("data_fim", sa.Date(), nullable=False),
        sa.Column(
            "formato",
            sa.Enum("PONTOS_CORRIDOS", "GRUPOS_MATA_MATA", "MATA_MATA", name="formato_edicao"),
            nullable=False,
        ),
        sa.Column("configuracao", sa.JSON(), nullable=False),
        sa.Column(
            "estado",
            sa.Enum("RASCUNHO", "EM_ANDAMENTO", "FINALIZADA", "CANCELADA", name="estado_edicao"),
            server_default=sa.text("'RASCUNHO'"),
            nullable=False,
        ),
        sa.Column("publicada", sa.Boolean(), server_default=FALSO, nullable=False),
        sa.Column("revisao", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.CheckConstraint("data_inicio <= data_fim", name="ck_edicoes_competicao_periodo"),
        sa.CheckConstraint("revisao >= 1", name="ck_edicoes_competicao_revisao"),
        sa.ForeignKeyConstraint(["id_competicao"], ["competicoes.id_competicao"]),
        sa.ForeignKeyConstraint(["id_edicao_evento"], ["edicoes_evento.id_edicao_evento"]),
        sa.PrimaryKeyConstraint("id_edicao_competicao"),
        sa.UniqueConstraint(
            "id_competicao", "identificacao", name="uq_edicoes_competicao_identificacao"
        ),
    )
    op.create_table(
        "competidores",
        sa.Column("id_competidor", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("data_nascimento", sa.Date(), nullable=True),
        sa.Column("documento", sa.String(length=50), nullable=True),
        sa.Column("foto_url", sa.String(length=500), nullable=True),
        sa.Column("ativo", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("id_aluno_origem", sa.Integer(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.ForeignKeyConstraint(["id_aluno_origem"], ["alunos.id_aluno"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id_competidor"),
        sa.UniqueConstraint("id_aluno_origem"),
    )
    op.create_table(
        "equipes",
        sa.Column("id_equipe", sa.Integer(), nullable=False),
        sa.Column("id_edicao_competicao", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("sigla", sa.String(length=10), nullable=True),
        sa.Column(
            "situacao",
            sa.Enum("ATIVA", "INATIVA", name="situacao_equipe"),
            server_default=sa.text("'ATIVA'"),
            nullable=False,
        ),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao"], ["edicoes_competicao.id_edicao_competicao"]
        ),
        sa.PrimaryKeyConstraint("id_equipe"),
        sa.UniqueConstraint("id_edicao_competicao", "nome", name="uq_equipes_edicao_nome"),
        sa.UniqueConstraint(
            "id_edicao_competicao", "id_equipe", name="uq_equipes_edicao_equipe"
        ),
    )
    op.create_table(
        "integrantes_equipe",
        sa.Column("id_integrante", sa.Integer(), nullable=False),
        sa.Column("id_edicao_competicao", sa.Integer(), nullable=False),
        sa.Column("id_equipe", sa.Integer(), nullable=False),
        sa.Column("id_competidor", sa.Integer(), nullable=False),
        sa.Column("nome_esportivo", sa.String(length=200), nullable=False),
        sa.Column("numero_camisa", sa.Integer(), nullable=True),
        sa.Column("posicao", sa.String(length=50), nullable=True),
        sa.Column(
            "situacao",
            sa.Enum("ATIVO", "INATIVO", name="situacao_integrante"),
            server_default=sa.text("'ATIVO'"),
            nullable=False,
        ),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.ForeignKeyConstraint(["id_competidor"], ["competidores.id_competidor"]),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao", "id_equipe"],
            ["equipes.id_edicao_competicao", "equipes.id_equipe"],
            name="fk_integrantes_equipe_edicao_equipe",
        ),
        sa.PrimaryKeyConstraint("id_integrante"),
        sa.UniqueConstraint(
            "id_edicao_competicao", "id_competidor", name="uq_integrantes_edicao_competidor"
        ),
    )
    op.create_index(
        "ix_integrantes_equipe_edicao_equipe",
        "integrantes_equipe",
        ["id_edicao_competicao", "id_equipe"],
        unique=False,
    )
    op.create_table(
        "auditoria_competicao",
        sa.Column("id_auditoria", sa.Integer(), nullable=False),
        sa.Column("entidade", sa.String(length=60), nullable=False),
        sa.Column("id_entidade", sa.Integer(), nullable=False),
        sa.Column("acao", sa.String(length=60), nullable=False),
        sa.Column("antes", sa.JSON(), nullable=True),
        sa.Column("depois", sa.JSON(), nullable=True),
        sa.Column("id_usuario_responsavel", sa.Integer(), nullable=True),
        sa.Column("responsavel_nome", sa.String(length=150), nullable=False),
        sa.Column("instante", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("id_edicao_competicao", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["id_edicao_competicao"],
            ["edicoes_competicao.id_edicao_competicao"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["id_usuario_responsavel"], ["usuarios.id_usuario"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id_auditoria"),
    )
    op.create_index(
        "ix_auditoria_competicao_entidade",
        "auditoria_competicao",
        ["entidade", "id_entidade"],
        unique=False,
    )
    op.create_table(
        "requisicoes_partida",
        sa.Column("id_requisicao", sa.Integer(), nullable=False),
        sa.Column("id_partida", sa.Integer(), nullable=False),
        sa.Column("chave_idempotencia", sa.String(length=64), nullable=False),
        sa.Column("hash_payload", sa.String(length=64), nullable=False),
        sa.Column("resultado", sa.JSON(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), server_default=AGORA, nullable=False),
        sa.PrimaryKeyConstraint("id_requisicao"),
        sa.UniqueConstraint(
            "id_partida", "chave_idempotencia", name="uq_requisicoes_partida_chave"
        ),
    )


def downgrade() -> None:
    # Nenhuma mutacao antes desta linha: os dados esportivos antigos foram
    # descartados no upgrade e nao ha como reconstrui-los a partir do schema.
    raise RuntimeError(
        "A revisao 20261015_0200 nao tem downgrade: os dados esportivos antigos foram "
        "descartados. A restauracao se faz por backup do banco anterior ao upgrade."
    )
