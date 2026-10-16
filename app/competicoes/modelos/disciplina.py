"""Modelos de disciplina (suspensoes e cumprimentos) e decisoes de classificacao."""

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from database import Base

ORIGENS_SUSPENSAO = (
    "ACUMULO_AMARELOS",
    "VERMELHO_DIRETO",
    "SEGUNDO_AMARELO",
    "MANUAL",
)
SITUACOES_SUSPENSAO = ("ATIVA", "CUMPRIDA", "EM_REVISAO", "CANCELADA")


class SuspensaoCompeticao(Base):
    __tablename__ = "suspensoes_competicao"
    __table_args__ = (
        UniqueConstraint("chave_origem", name="uq_suspensoes_chave_origem"),
        CheckConstraint("jogos >= 1", name="ck_suspensoes_jogos_positivo"),
        Index(
            "ix_suspensoes_edicao_integrante",
            "id_edicao_competicao",
            "id_integrante",
        ),
    )

    id_suspensao = Column(Integer, primary_key=True)
    id_edicao_competicao = Column(
        Integer,
        ForeignKey("edicoes_competicao.id_edicao_competicao", ondelete="CASCADE"),
        nullable=False,
    )
    id_integrante = Column(
        Integer,
        ForeignKey("integrantes_equipe.id_integrante", ondelete="CASCADE"),
        nullable=False,
    )
    id_partida_origem = Column(
        Integer,
        ForeignKey("partidas.id_partida", ondelete="SET NULL"),
        nullable=True,
    )
    id_ocorrencia_origem = Column(
        Integer,
        ForeignKey("ocorrencias_partida.id_ocorrencia", ondelete="SET NULL"),
        nullable=True,
    )
    motivo = Column(Text, nullable=False)
    origem = Column(
        Enum(*ORIGENS_SUSPENSAO, name="origem_suspensao_enum"),
        nullable=False,
    )
    chave_origem = Column(String(120), nullable=True)
    jogos = Column(
        Integer,
        nullable=False,
        default=1,
        server_default=text("1"),
    )
    situacao = Column(
        Enum(*SITUACOES_SUSPENSAO, name="situacao_suspensao_enum"),
        default="ATIVA",
        server_default=text("'ATIVA'"),
        nullable=False,
    )
    id_usuario_responsavel = Column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    criado_em = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    atualizado_em = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
    )

    edicao_competicao = relationship("EdicaoCompeticao", passive_deletes=True)
    integrante = relationship("IntegranteEquipe", foreign_keys=[id_integrante])
    partida_origem = relationship("Partida", foreign_keys=[id_partida_origem])
    ocorrencia_origem = relationship(
        "OcorrenciaPartida", foreign_keys=[id_ocorrencia_origem]
    )
    usuario_responsavel = relationship("Usuario", foreign_keys=[id_usuario_responsavel])
    cumprimentos = relationship(
        "CumprimentoSuspensao",
        back_populates="suspensao",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class CumprimentoSuspensao(Base):
    __tablename__ = "cumprimentos_suspensao"
    __table_args__ = (
        UniqueConstraint(
            "id_partida",
            "id_integrante",
            name="uq_cumprimentos_partida_integrante",
        ),
        Index("ix_cumprimentos_suspensao", "id_suspensao"),
    )

    id_cumprimento = Column(Integer, primary_key=True)
    id_suspensao = Column(
        Integer,
        ForeignKey("suspensoes_competicao.id_suspensao", ondelete="CASCADE"),
        nullable=False,
    )
    id_integrante = Column(
        Integer,
        ForeignKey("integrantes_equipe.id_integrante", ondelete="CASCADE"),
        nullable=False,
    )
    id_partida = Column(
        Integer,
        ForeignKey("partidas.id_partida", ondelete="CASCADE"),
        nullable=False,
    )
    id_usuario_responsavel = Column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    criado_em = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    suspensao = relationship(
        "SuspensaoCompeticao",
        back_populates="cumprimentos",
        passive_deletes=True,
    )
    integrante = relationship("IntegranteEquipe", foreign_keys=[id_integrante])
    partida = relationship("Partida", foreign_keys=[id_partida])
    usuario_responsavel = relationship("Usuario", foreign_keys=[id_usuario_responsavel])


class DecisaoClassificacao(Base):
    __tablename__ = "decisoes_classificacao"
    __table_args__ = (
        ForeignKeyConstraint(
            ["id_edicao_competicao", "id_grupo"],
            ["grupos_competicao.id_edicao_competicao", "grupos_competicao.id_grupo"],
            name="fk_decisoes_grupo_edicao",
        ),
        Index("ix_decisoes_edicao_grupo", "id_edicao_competicao", "id_grupo"),
    )

    id_decisao = Column(Integer, primary_key=True)
    id_edicao_competicao = Column(
        Integer,
        ForeignKey("edicoes_competicao.id_edicao_competicao", ondelete="CASCADE"),
        nullable=False,
    )
    id_grupo = Column(Integer, nullable=True)
    conjunto_equipes = Column(JSON, nullable=False)
    ordem_escolhida = Column(JSON, nullable=False)
    motivo = Column(Text, nullable=False)
    revisao_resultados = Column(String(64), nullable=False)
    id_usuario_responsavel = Column(
        Integer,
        ForeignKey("usuarios.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    criado_em = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    edicao_competicao = relationship("EdicaoCompeticao", passive_deletes=True)
    grupo = relationship(
        "GrupoCompeticao",
        foreign_keys="[DecisaoClassificacao.id_edicao_competicao, DecisaoClassificacao.id_grupo]",
        passive_deletes=True,
        overlaps="edicao_competicao",
    )
    usuario_responsavel = relationship("Usuario", foreign_keys=[id_usuario_responsavel])
