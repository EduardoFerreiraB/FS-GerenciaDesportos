"""Modelos de partidas e ocorrencias (gols e eventos disciplinares futuros)."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    Time,
    text,
)
from sqlalchemy.orm import relationship

from database import Base

ESTADOS_PARTIDA = ("AGENDADA", "EM_ANDAMENTO", "FINALIZADA", "CANCELADA")
TIPOS_OCORRENCIA = (
    "GOL",
    "GOL_CONTRA",
    "CARTAO_AMARELO",
    "CARTAO_VERMELHO_DIRETO",
    "EXPULSAO_SEGUNDO_AMARELO",
)


class Partida(Base):
    __tablename__ = "partidas"
    __table_args__ = (
        ForeignKeyConstraint(
            ["id_edicao_competicao", "id_grupo"],
            ["grupos_competicao.id_edicao_competicao", "grupos_competicao.id_grupo"],
            name="fk_partidas_grupo_edicao",
        ),
        ForeignKeyConstraint(
            ["id_edicao_competicao", "id_duelo"],
            ["duelos_eliminatorios.id_edicao_competicao", "duelos_eliminatorios.id_duelo"],
            name="fk_partidas_duelo_edicao",
        ),
        ForeignKeyConstraint(
            ["id_edicao_competicao", "id_equipe_mandante"],
            ["equipes.id_edicao_competicao", "equipes.id_equipe"],
            name="fk_partidas_mandante_edicao",
        ),
        ForeignKeyConstraint(
            ["id_edicao_competicao", "id_equipe_visitante"],
            ["equipes.id_edicao_competicao", "equipes.id_equipe"],
            name="fk_partidas_visitante_edicao",
        ),
        CheckConstraint(
            "id_equipe_mandante <> id_equipe_visitante",
            name="ck_partidas_equipes_distintas",
        ),
        Index("ix_partidas_edicao_grupo", "id_edicao_competicao", "id_grupo"),
        Index("ix_partidas_edicao_duelo", "id_edicao_competicao", "id_duelo"),
        Index("ix_partidas_edicao_mandante", "id_edicao_competicao", "id_equipe_mandante"),
        Index("ix_partidas_edicao_visitante", "id_edicao_competicao", "id_equipe_visitante"),
    )

    id_partida = Column(Integer, primary_key=True)
    id_edicao_competicao = Column(
        Integer,
        ForeignKey("edicoes_competicao.id_edicao_competicao", ondelete="CASCADE"),
        nullable=False,
    )
    id_grupo = Column(Integer, nullable=True)
    id_duelo = Column(Integer, nullable=True)
    rodada = Column(Integer, nullable=True)
    ordem_jogo = Column(Integer, nullable=False, default=1, server_default=text("1"))
    id_equipe_mandante = Column(Integer, nullable=False)
    id_equipe_visitante = Column(Integer, nullable=False)
    data = Column(Date, nullable=True)
    hora = Column(Time, nullable=True)
    id_local = Column(
        Integer, ForeignKey("locais.id_local", ondelete="SET NULL"), nullable=True
    )
    id_arbitro = Column(
        Integer, ForeignKey("arbitros.id_arbitro", ondelete="SET NULL"), nullable=True
    )
    estado = Column(
        Enum(*ESTADOS_PARTIDA, name="estado_partida_enum"),
        default="AGENDADA",
        server_default=text("'AGENDADA'"),
        nullable=False,
    )
    penaltis_mandante = Column(Integer, nullable=True)
    penaltis_visitante = Column(Integer, nullable=True)
    revisao = Column(Integer, nullable=False, default=1, server_default=text("1"))
    criado_em = Column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    atualizado_em = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
    )

    edicao_competicao = relationship("EdicaoCompeticao", passive_deletes=True)
    equipe_mandante = relationship(
        "Equipe",
        foreign_keys="[Partida.id_edicao_competicao, Partida.id_equipe_mandante]",
        overlaps="edicao_competicao,equipe_visitante,grupo,duelo,partidas",
    )
    equipe_visitante = relationship(
        "Equipe",
        foreign_keys="[Partida.id_edicao_competicao, Partida.id_equipe_visitante]",
        overlaps="edicao_competicao,equipe_mandante,grupo,duelo,partidas",
    )
    local = relationship("Local")
    arbitro = relationship("Arbitro")
    grupo = relationship(
        "GrupoCompeticao",
        foreign_keys="[Partida.id_edicao_competicao, Partida.id_grupo]",
        passive_deletes=True,
        overlaps="edicao_competicao,equipe_mandante,equipe_visitante,duelo,partidas",
    )
    duelo = relationship(
        "DueloEliminatorio",
        back_populates="partidas",
        foreign_keys="[Partida.id_edicao_competicao, Partida.id_duelo]",
        passive_deletes=True,
        overlaps="edicao_competicao,equipe_mandante,equipe_visitante,grupo,partidas",
    )
    ocorrencias = relationship(
        "OcorrenciaPartida",
        back_populates="partida",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class OcorrenciaPartida(Base):
    __tablename__ = "ocorrencias_partida"

    id_ocorrencia = Column(Integer, primary_key=True)
    id_partida = Column(
        Integer,
        ForeignKey("partidas.id_partida", ondelete="CASCADE"),
        nullable=False,
    )
    tipo = Column(
        Enum(*TIPOS_OCORRENCIA, name="tipo_ocorrencia_enum"),
        default="GOL",
        server_default=text("'GOL'"),
        nullable=False,
    )
    id_equipe_beneficiada = Column(
        Integer,
        ForeignKey("equipes.id_equipe", ondelete="CASCADE"),
        nullable=False,
    )
    id_integrante = Column(
        Integer,
        ForeignKey("integrantes_equipe.id_integrante", ondelete="SET NULL"),
        nullable=True,
    )
    minuto = Column(Integer, nullable=True)
    periodo = Column(String(20), nullable=True)
    observacao = Column(Text, nullable=True)
    id_usuario_autor = Column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    id_ocorrencia_origem = Column(
        Integer,
        ForeignKey("ocorrencias_partida.id_ocorrencia", ondelete="CASCADE"),
        nullable=True,
    )
    criado_em = Column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    partida = relationship("Partida", back_populates="ocorrencias", passive_deletes=True)
    equipe_beneficiada = relationship("Equipe", foreign_keys=[id_equipe_beneficiada])
    integrante = relationship("IntegranteEquipe", foreign_keys=[id_integrante])
    usuario_autor = relationship("Usuario", foreign_keys=[id_usuario_autor])
    ocorrencia_origem = relationship(
        "OcorrenciaPartida",
        remote_side=[id_ocorrencia],
        foreign_keys=[id_ocorrencia_origem],
    )
