"""confrontos por competicao e migracao historica de partidas

Revision ID: 20260824_0004
Revises: 20260824_0003
Create Date: 2026-08-24
"""

from alembic import context, op
import sqlalchemy as sa


revision = "20260824_0004"
down_revision = "20260824_0003"
branch_labels = None
depends_on = None


STATUS_MAP = {
    "Agendada": "Agendado",
    "Em Andamento": "Em Andamento",
    "Finalizada": "Finalizado",
    "Cancelada": "Cancelado",
}


def _plan(connection):
    """Inspect all existing partidas and resolve their destination competition.
    Fails before any DDL/DML if any ambiguity or missing competition is found.
    """
    plans = []
    partidas = connection.execute(
        sa.text(
            "SELECT id_partida, id_edicao, id_local, id_arbitro, id_modalidade, "
            "id_equipe_casa, id_equipe_visitante, id_proxima_partida, fase, "
            "part_data, part_hora, placar_casa, placar_visitante, status, "
            "sumula_arquivo, observacoes FROM partidas ORDER BY id_partida"
        )
    ).mappings().all()

    for p in partidas:
        comp_casa = None
        if p["id_equipe_casa"]:
            comp_casa = connection.execute(
                sa.text("SELECT id_competicao FROM equipes WHERE id_equipe = :id"),
                {"id": p["id_equipe_casa"]},
            ).scalar()

        comp_visitante = None
        if p["id_equipe_visitante"]:
            comp_visitante = connection.execute(
                sa.text("SELECT id_competicao FROM equipes WHERE id_equipe = :id"),
                {"id": p["id_equipe_visitante"]},
            ).scalar()

        if comp_casa and comp_visitante and comp_casa != comp_visitante:
            raise RuntimeError(
                f"não foi possível identificar competição para partida {p['id_partida']}: "
                f"equipes possuem competições divergentes ({comp_casa} != {comp_visitante})."
            )

        target = comp_casa or comp_visitante
        if target is None:
            candidates = connection.execute(
                sa.text(
                    "SELECT id_competicao FROM competicoes "
                    "WHERE id_edicao = :id_edicao AND id_modalidade = :id_modalidade "
                    "AND modo_inscricao = 'EQUIPE' ORDER BY id_competicao"
                ),
                {"id_edicao": p["id_edicao"], "id_modalidade": p["id_modalidade"]},
            ).scalars().all()
            if len(candidates) != 1:
                raise RuntimeError(
                    f"não foi possível identificar competição para partida {p['id_partida']}: "
                    f"encontradas {len(candidates)} competições EQUIPE para edição {p['id_edicao']} e modalidade {p['id_modalidade']}."
                )
            target = candidates[0]
        else:
            comp_row = connection.execute(
                sa.text("SELECT id_edicao, id_modalidade FROM competicoes WHERE id_competicao = :id"),
                {"id": target},
            ).mappings().first()
            if not comp_row:
                raise RuntimeError(
                    f"não foi possível identificar competição para partida {p['id_partida']}: competição {target} não existe."
                )
            if comp_row["id_edicao"] != p["id_edicao"] or comp_row["id_modalidade"] != p["id_modalidade"]:
                raise RuntimeError(
                    f"não foi possível identificar competição para partida {p['id_partida']}: "
                    f"competição {target} não corresponde à edição ou modalidade da partida."
                )

        status_norm = STATUS_MAP.get(p["status"], "Agendado")
        placar_m = p["placar_casa"] if p["placar_casa"] is not None else 0
        placar_v = p["placar_visitante"] if p["placar_visitante"] is not None else 0

        vencedor = None
        if status_norm == "Finalizado":
            if placar_m > placar_v:
                vencedor = p["id_equipe_casa"]
            elif placar_v > placar_m:
                vencedor = p["id_equipe_visitante"]

        plans.append((p, target, status_norm, vencedor, placar_m, placar_v))

    return plans


def _create_confrontos_table():
    op.create_table(
        "confrontos",
        sa.Column("id_confronto", sa.Integer(), nullable=False),
        sa.Column("id_competicao", sa.Integer(), nullable=False),
        sa.Column("id_equipe_mandante", sa.Integer(), nullable=True),
        sa.Column("id_equipe_visitante", sa.Integer(), nullable=True),
        sa.Column("id_proximo_confronto", sa.Integer(), nullable=True),
        sa.Column("fase", sa.String(length=100), nullable=True),
        sa.Column("rodada", sa.Integer(), nullable=True),
        sa.Column("grupo", sa.String(length=50), nullable=True),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("hora", sa.Time(), nullable=False),
        sa.Column("id_local", sa.Integer(), nullable=False),
        sa.Column("id_arbitro", sa.Integer(), nullable=False),
        sa.Column("placar_mandante", sa.Integer(), nullable=False),
        sa.Column("placar_visitante", sa.Integer(), nullable=False),
        sa.Column("id_equipe_vencedora", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("Agendado", "Em Andamento", "Finalizado", "Cancelado"),
            nullable=False,
        ),
        sa.Column("sumula_arquivo", sa.String(length=500), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["id_arbitro"], ["arbitros.id_arbitro"]),
        sa.ForeignKeyConstraint(["id_competicao"], ["competicoes.id_competicao"]),
        sa.ForeignKeyConstraint(["id_equipe_mandante"], ["equipes.id_equipe"]),
        sa.ForeignKeyConstraint(["id_equipe_vencedora"], ["equipes.id_equipe"]),
        sa.ForeignKeyConstraint(["id_equipe_visitante"], ["equipes.id_equipe"]),
        sa.ForeignKeyConstraint(["id_local"], ["locais.id_local"]),
        sa.ForeignKeyConstraint(["id_proximo_confronto"], ["confrontos.id_confronto"]),
        sa.PrimaryKeyConstraint("id_confronto"),
    )
    op.create_index("ix_confrontos_id_confronto", "confrontos", ["id_confronto"])


def _create_audit_table():
    op.create_table(
        "migracao_partidas_origem",
        sa.Column("id_migracao", sa.Integer(), nullable=False),
        sa.Column("id_partida_origem", sa.Integer(), nullable=False),
        sa.Column("id_confronto_resultante", sa.Integer(), nullable=True),
        sa.Column("id_competicao", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["id_competicao"], ["competicoes.id_competicao"]),
        sa.ForeignKeyConstraint(["id_confronto_resultante"], ["confrontos.id_confronto"]),
        sa.ForeignKeyConstraint(["id_partida_origem"], ["partidas.id_partida"]),
        sa.PrimaryKeyConstraint("id_migracao"),
    )


def upgrade():
    if context.is_offline_mode():
        _create_confrontos_table()
        _create_audit_table()
        op.execute("-- A migração de partidas para confrontos requer conexão e deve ser executada em cópia anonimizada.")
        return

    connection = op.get_bind()
    plans = _plan(connection)

    _create_confrontos_table()
    _create_audit_table()

    partida_to_confronto = {}
    for p, target, status_norm, vencedor, placar_m, placar_v in plans:
        insert = connection.execute(
            sa.text(
                "INSERT INTO confrontos (id_competicao, id_equipe_mandante, id_equipe_visitante, id_proximo_confronto, "
                "fase, data, hora, id_local, id_arbitro, placar_mandante, placar_visitante, id_equipe_vencedora, "
                "status, sumula_arquivo, observacoes) VALUES ("
                ":id_competicao, :id_equipe_mandante, :id_equipe_visitante, NULL, "
                ":fase, :data, :hora, :id_local, :id_arbitro, :placar_mandante, :placar_visitante, :id_equipe_vencedora, "
                ":status, :sumula_arquivo, :observacoes)"
            ),
            {
                "id_competicao": target,
                "id_equipe_mandante": p["id_equipe_casa"],
                "id_equipe_visitante": p["id_equipe_visitante"],
                "fase": p["fase"],
                "data": p["part_data"],
                "hora": p["part_hora"],
                "id_local": p["id_local"],
                "id_arbitro": p["id_arbitro"],
                "placar_mandante": placar_m,
                "placar_visitante": placar_v,
                "id_equipe_vencedora": vencedor,
                "status": status_norm,
                "sumula_arquivo": p["sumula_arquivo"],
                "observacoes": p["observacoes"],
            },
        )
        c_id = insert.lastrowid
        partida_to_confronto[p["id_partida"]] = c_id

    # Second pass: link next matches
    for p, _, _, _, _, _ in plans:
        if p["id_proxima_partida"]:
            c_orig = partida_to_confronto[p["id_partida"]]
            c_dest = partida_to_confronto.get(p["id_proxima_partida"])
            if c_dest:
                connection.execute(
                    sa.text("UPDATE confrontos SET id_proximo_confronto = :dest WHERE id_confronto = :orig"),
                    {"dest": c_dest, "orig": c_orig},
                )

    # Third pass: insert audit records
    for p, target, _, _, _, _ in plans:
        c_id = partida_to_confronto[p["id_partida"]]
        connection.execute(
            sa.text(
                "INSERT INTO migracao_partidas_origem "
                "(id_partida_origem, id_confronto_resultante, id_competicao, status, motivo) "
                "VALUES (:origem, :resultante, :competicao, 'MIGRADA', NULL)"
            ),
            {"origem": p["id_partida"], "resultante": c_id, "competicao": target},
        )

    # Verification: total count must match exactly
    total_partidas = connection.execute(sa.text("SELECT COUNT(*) FROM partidas")).scalar_one()
    total_confrontos = connection.execute(sa.text("SELECT COUNT(*) FROM confrontos")).scalar_one()
    total_migradas = connection.execute(sa.text("SELECT COUNT(*) FROM migracao_partidas_origem WHERE status = 'MIGRADA'")).scalar_one()

    if total_partidas != total_confrontos or total_partidas != total_migradas:
        raise RuntimeError(
            f"Divergência na contagem de migração: {total_partidas} partidas, "
            f"{total_confrontos} confrontos e {total_migradas} auditorias registradas."
        )


def downgrade():
    if context.is_offline_mode():
        raise RuntimeError("O downgrade de confrontos por competição requer conexão para verificar a auditoria.")

    connection = op.get_bind()
    migrated = connection.execute(
        sa.text("SELECT 1 FROM migracao_partidas_origem LIMIT 1")
    ).first()
    if migrated:
        raise RuntimeError(
            "O downgrade de confrontos por competição é bloqueado: confrontos migrados exigem reconciliação manual."
        )

    op.drop_index("ix_confrontos_id_confronto", table_name="confrontos")
    op.drop_table("migracao_partidas_origem")
    op.drop_table("confrontos")
