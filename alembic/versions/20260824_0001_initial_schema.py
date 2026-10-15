"""Frozen initial schema for the application as of the competition baseline.

This revision intentionally contains explicit DDL.  It must not import
``app.models`` or use metadata.create_all(), because later model changes must
not rewrite the historical schema represented by this migration.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260824_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "modalidades",
        sa.Column("id_modalidade", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=500), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("duracao_minutos", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id_modalidade"),
        sa.UniqueConstraint("nome"),
    )
    op.create_index("ix_modalidades_id_modalidade", "modalidades", ["id_modalidade"])
    op.create_table(
        "usuarios",
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=150), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.Enum("admin", "coordenador", "professor", "assistente"), nullable=False),
        sa.Column("must_change_password", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id_usuario"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_usuarios_id_usuario", "usuarios", ["id_usuario"])
    op.create_table(
        "participantes",
        sa.Column("id_participante", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.Enum("aluno", "atleta"), nullable=False),
        sa.PrimaryKeyConstraint("id_participante"),
    )
    op.create_index("ix_participantes_id_participante", "participantes", ["id_participante"])
    op.create_table(
        "locais",
        sa.Column("id_local", sa.Integer(), nullable=False),
        sa.Column("loca_nome", sa.String(length=200), nullable=False),
        sa.Column("loca_descricao", sa.Text(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id_local"),
        sa.UniqueConstraint("loca_nome"),
    )
    op.create_index("ix_locais_id_local", "locais", ["id_local"])
    op.create_table(
        "arbitros",
        sa.Column("id_arbitro", sa.Integer(), nullable=False),
        sa.Column("apito_nome", sa.String(length=200), nullable=False),
        sa.Column("apito_doc", sa.String(length=100), nullable=False),
        sa.Column("apito_tel", sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint("id_arbitro"),
        sa.UniqueConstraint("apito_doc"),
    )
    op.create_index("ix_arbitros_id_arbitro", "arbitros", ["id_arbitro"])
    op.create_table(
        "eventos",
        sa.Column("id_evento", sa.Integer(), nullable=False),
        sa.Column("even_nome", sa.String(length=150), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id_evento"),
    )
    op.create_index("ix_eventos_id_evento", "eventos", ["id_evento"])
    op.create_table(
        "refresh_tokens",
        sa.Column("id_token", sa.Integer(), nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.id_usuario"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_token"),
    )
    op.create_index("ix_refresh_tokens_id_token", "refresh_tokens", ["id_token"])
    op.create_index("ix_refresh_tokens_token", "refresh_tokens", ["token"], unique=True)
    op.create_table(
        "professores",
        sa.Column("id_professor", sa.Integer(), nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=500), nullable=False),
        sa.Column("cpf", sa.String(length=14), nullable=False),
        sa.Column("contato", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.id_usuario"]),
        sa.PrimaryKeyConstraint("id_professor"),
        sa.UniqueConstraint("cpf"),
        sa.UniqueConstraint("id_usuario"),
    )
    op.create_index("ix_professores_id_professor", "professores", ["id_professor"])
    op.create_table(
        "atletas",
        sa.Column("id_atleta", sa.Integer(), nullable=False),
        sa.Column("id_participante", sa.Integer(), nullable=False),
        sa.Column("nome_completo", sa.String(length=500), nullable=False),
        sa.Column("data_nascimento", sa.Date(), nullable=False),
        sa.Column("documento_pessoal", sa.String(length=50), nullable=False),
        sa.Column("contato", sa.String(length=20), nullable=True),
        sa.Column("endereco", sa.Text(), nullable=True),
        sa.Column("foto", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["id_participante"], ["participantes.id_participante"]),
        sa.PrimaryKeyConstraint("id_atleta"),
        sa.UniqueConstraint("id_participante"),
    )
    op.create_index("ix_atletas_id_atleta", "atletas", ["id_atleta"])
    op.create_table(
        "alunos",
        sa.Column("id_aluno", sa.Integer(), nullable=False),
        sa.Column("id_participante", sa.Integer(), nullable=False),
        sa.Column("nome_completo", sa.String(length=500), nullable=False),
        sa.Column("data_nascimento", sa.Date(), nullable=False),
        sa.Column("escola", sa.String(length=100), nullable=False),
        sa.Column("serie_ano", sa.String(length=50), nullable=False),
        sa.Column("nome_mae", sa.String(length=500), nullable=True),
        sa.Column("nome_pai", sa.String(length=500), nullable=True),
        sa.Column("telefone_1", sa.String(length=20), nullable=False),
        sa.Column("telefone_2", sa.String(length=20), nullable=True),
        sa.Column("endereco", sa.Text(), nullable=False),
        sa.Column("recomendacoes_medicas", sa.Text(), nullable=True),
        sa.Column("foto", sa.String(length=500), nullable=True),
        sa.Column("documento_pessoal", sa.String(length=500), nullable=True),
        sa.Column("atestado_medico", sa.String(length=500), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["id_participante"], ["participantes.id_participante"]),
        sa.PrimaryKeyConstraint("id_aluno"),
        sa.UniqueConstraint("id_participante"),
    )
    op.create_index("ix_alunos_id_aluno", "alunos", ["id_aluno"])
    op.create_table(
        "turmas",
        sa.Column("id_turma", sa.Integer(), nullable=False),
        sa.Column("id_modalidade", sa.Integer(), nullable=False),
        sa.Column("id_professor", sa.Integer(), nullable=False),
        sa.Column("descricao", sa.String(length=100), nullable=True),
        sa.Column("categoria_idade", sa.String(length=50), nullable=False),
        sa.Column("horario_inicio", sa.Time(), nullable=False),
        sa.Column("horario_fim", sa.Time(), nullable=False),
        sa.ForeignKeyConstraint(["id_modalidade"], ["modalidades.id_modalidade"]),
        sa.ForeignKeyConstraint(["id_professor"], ["professores.id_professor"]),
        sa.PrimaryKeyConstraint("id_turma"),
    )
    op.create_index("ix_turmas_id_turma", "turmas", ["id_turma"])
    op.create_table(
        "turmas_dias",
        sa.Column("id_turma", sa.Integer(), nullable=False),
        sa.Column("dia_semana", sa.Enum("SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"), nullable=False),
        sa.ForeignKeyConstraint(["id_turma"], ["turmas.id_turma"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_turma", "dia_semana"),
    )
    op.create_table(
        "matriculas",
        sa.Column("id_matricula", sa.Integer(), nullable=False),
        sa.Column("id_aluno", sa.Integer(), nullable=False),
        sa.Column("id_turma", sa.Integer(), nullable=False),
        sa.Column("data_matricula", sa.Date(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["id_aluno"], ["alunos.id_aluno"]),
        sa.ForeignKeyConstraint(["id_turma"], ["turmas.id_turma"]),
        sa.PrimaryKeyConstraint("id_matricula"),
    )
    op.create_index("ix_matriculas_id_matricula", "matriculas", ["id_matricula"])
    op.create_table(
        "presencas",
        sa.Column("id_presenca", sa.Integer(), nullable=False),
        sa.Column("id_matricula", sa.Integer(), nullable=False),
        sa.Column("data_aula", sa.Date(), nullable=False),
        sa.Column("status", sa.Enum("Presente", "Ausente", "Justificado"), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["id_matricula"], ["matriculas.id_matricula"]),
        sa.PrimaryKeyConstraint("id_presenca"),
    )
    op.create_index("ix_presencas_id_presenca", "presencas", ["id_presenca"])
    op.create_table(
        "modalidades_evento",
        sa.Column("id_evento", sa.Integer(), nullable=False),
        sa.Column("id_modalidade", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_evento"], ["eventos.id_evento"]),
        sa.ForeignKeyConstraint(["id_modalidade"], ["modalidades.id_modalidade"]),
        sa.PrimaryKeyConstraint("id_evento", "id_modalidade"),
    )
    op.create_table(
        "edicoes",
        sa.Column("id_edicao", sa.Integer(), nullable=False),
        sa.Column("id_evento", sa.Integer(), nullable=False),
        sa.Column("edic_ano", sa.Integer(), nullable=False),
        sa.Column("tipo_competicao", sa.Enum("Pontos Corridos", "Mata-Mata", "Grupos"), nullable=False),
        sa.Column("fase_inicial", sa.Enum("Oitavas", "Quartas", "Semifinal", "Final"), nullable=True),
        sa.Column("data_inicio", sa.Date(), nullable=False),
        sa.Column("data_fim", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["id_evento"], ["eventos.id_evento"]),
        sa.PrimaryKeyConstraint("id_edicao"),
    )
    op.create_index("ix_edicoes_id_edicao", "edicoes", ["id_edicao"])
    op.create_table(
        "competicoes",
        sa.Column("id_competicao", sa.Integer(), nullable=False),
        sa.Column("id_edicao", sa.Integer(), nullable=False),
        sa.Column("id_modalidade", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("categoria", sa.String(length=100), nullable=False),
        sa.Column("modo_inscricao", sa.Enum("EQUIPE", "INDIVIDUAL"), nullable=False),
        sa.Column("formato", sa.Enum("PONTOS_CORRIDOS", "GRUPOS", "MATA_MATA", "PROVAS"), nullable=False),
        sa.Column("criterio_resultado", sa.Enum("PLACAR", "TEMPO", "PONTOS", "POSICAO"), nullable=False),
        sa.Column("data_inicio", sa.Date(), nullable=False),
        sa.Column("data_fim", sa.Date(), nullable=False),
        sa.Column("regras", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["id_edicao"], ["edicoes.id_edicao"]),
        sa.ForeignKeyConstraint(["id_modalidade"], ["modalidades.id_modalidade"]),
        sa.PrimaryKeyConstraint("id_competicao"),
    )
    op.create_index("ix_competicoes_id_competicao", "competicoes", ["id_competicao"])
    op.create_table(
        "equipes",
        sa.Column("id_equipe", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("id_edicao", sa.Integer(), nullable=False),
        sa.Column("id_competicao", sa.Integer(), nullable=True),
        sa.Column("grupo", sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(["id_competicao"], ["competicoes.id_competicao"]),
        sa.ForeignKeyConstraint(["id_edicao"], ["edicoes.id_edicao"]),
        sa.PrimaryKeyConstraint("id_equipe"),
    )
    op.create_index("ix_equipes_id_equipe", "equipes", ["id_equipe"])
    op.create_table(
        "equipes_participantes",
        sa.Column("id_equipe", sa.Integer(), nullable=False),
        sa.Column("id_participante", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_equipe"], ["equipes.id_equipe"]),
        sa.ForeignKeyConstraint(["id_participante"], ["participantes.id_participante"]),
        sa.PrimaryKeyConstraint("id_equipe", "id_participante"),
    )
    op.create_table(
        "partidas",
        sa.Column("id_partida", sa.Integer(), nullable=False),
        sa.Column("id_edicao", sa.Integer(), nullable=False),
        sa.Column("id_local", sa.Integer(), nullable=False),
        sa.Column("id_arbitro", sa.Integer(), nullable=False),
        sa.Column("id_modalidade", sa.Integer(), nullable=False),
        sa.Column("id_equipe_casa", sa.Integer(), nullable=True),
        sa.Column("id_equipe_visitante", sa.Integer(), nullable=True),
        sa.Column("id_proxima_partida", sa.Integer(), nullable=True),
        sa.Column("fase", sa.String(length=100), nullable=True),
        sa.Column("part_data", sa.Date(), nullable=False),
        sa.Column("part_hora", sa.Time(), nullable=False),
        sa.Column("placar_casa", sa.Integer(), nullable=True),
        sa.Column("placar_visitante", sa.Integer(), nullable=True),
        sa.Column("status", sa.Enum("Agendada", "Em Andamento", "Finalizada", "Cancelada"), nullable=True),
        sa.Column("sumula_arquivo", sa.String(length=500), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["id_arbitro"], ["arbitros.id_arbitro"]),
        sa.ForeignKeyConstraint(["id_edicao"], ["edicoes.id_edicao"]),
        sa.ForeignKeyConstraint(["id_equipe_casa"], ["equipes.id_equipe"]),
        sa.ForeignKeyConstraint(["id_equipe_visitante"], ["equipes.id_equipe"]),
        sa.ForeignKeyConstraint(["id_local"], ["locais.id_local"]),
        sa.ForeignKeyConstraint(["id_modalidade"], ["modalidades.id_modalidade"]),
        sa.ForeignKeyConstraint(["id_proxima_partida"], ["partidas.id_partida"]),
        sa.PrimaryKeyConstraint("id_partida"),
    )
    op.create_index("ix_partidas_id_partida", "partidas", ["id_partida"])
    op.create_table(
        "estatisticas_partida",
        sa.Column("id_estatistica", sa.Integer(), nullable=False),
        sa.Column("id_partida", sa.Integer(), nullable=False),
        sa.Column("id_participante", sa.Integer(), nullable=False),
        sa.Column("gols", sa.Integer(), nullable=False),
        sa.Column("cartoes_amarelos", sa.Integer(), nullable=False),
        sa.Column("cartoes_vermelhos", sa.Integer(), nullable=False),
        sa.Column("assistencias", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_participante"], ["participantes.id_participante"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_partida"], ["partidas.id_partida"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_estatistica"),
    )
    op.create_index("ix_estatisticas_partida_id_estatistica", "estatisticas_partida", ["id_estatistica"])


def downgrade():
    op.drop_index("ix_estatisticas_partida_id_estatistica", table_name="estatisticas_partida")
    op.drop_table("estatisticas_partida")
    op.drop_index("ix_partidas_id_partida", table_name="partidas")
    op.drop_table("partidas")
    op.drop_table("equipes_participantes")
    op.drop_index("ix_equipes_id_equipe", table_name="equipes")
    op.drop_table("equipes")
    op.drop_index("ix_competicoes_id_competicao", table_name="competicoes")
    op.drop_table("competicoes")
    op.drop_index("ix_edicoes_id_edicao", table_name="edicoes")
    op.drop_table("edicoes")
    op.drop_table("modalidades_evento")
    op.drop_index("ix_presencas_id_presenca", table_name="presencas")
    op.drop_table("presencas")
    op.drop_index("ix_matriculas_id_matricula", table_name="matriculas")
    op.drop_table("matriculas")
    op.drop_table("turmas_dias")
    op.drop_index("ix_turmas_id_turma", table_name="turmas")
    op.drop_table("turmas")
    op.drop_index("ix_alunos_id_aluno", table_name="alunos")
    op.drop_table("alunos")
    op.drop_index("ix_atletas_id_atleta", table_name="atletas")
    op.drop_table("atletas")
    op.drop_index("ix_professores_id_professor", table_name="professores")
    op.drop_table("professores")
    op.drop_index("ix_refresh_tokens_token", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_id_token", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_eventos_id_evento", table_name="eventos")
    op.drop_table("eventos")
    op.drop_index("ix_arbitros_id_arbitro", table_name="arbitros")
    op.drop_table("arbitros")
    op.drop_index("ix_locais_id_local", table_name="locais")
    op.drop_table("locais")
    op.drop_index("ix_participantes_id_participante", table_name="participantes")
    op.drop_table("participantes")
    op.drop_index("ix_usuarios_id_usuario", table_name="usuarios")
    op.drop_table("usuarios")
    op.drop_index("ix_modalidades_id_modalidade", table_name="modalidades")
    op.drop_table("modalidades")
