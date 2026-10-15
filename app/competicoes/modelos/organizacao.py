"""Identidade permanente (evento, competicao) e recorrencia (edicoes)."""

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from database import Base

FORMATOS_EDICAO = ("PONTOS_CORRIDOS", "GRUPOS_MATA_MATA", "MATA_MATA")
ESTADOS_EDICAO = ("RASCUNHO", "EM_ANDAMENTO", "FINALIZADA", "CANCELADA")

AGORA = text("CURRENT_TIMESTAMP")
FALSO = text("0")


class Evento(Base):
    __tablename__ = "eventos"

    id_evento = Column(Integer, primary_key=True)
    nome = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=True)
    slug = Column(String(120), nullable=False, unique=True)
    arquivado = Column(Boolean, nullable=False, server_default=FALSO)
    criado_em = Column(DateTime, nullable=False, server_default=AGORA)

    edicoes = relationship("EdicaoEvento", back_populates="evento")


class Competicao(Base):
    __tablename__ = "competicoes"

    id_competicao = Column(Integer, primary_key=True)
    nome = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=True)
    slug = Column(String(120), nullable=False, unique=True)
    id_modalidade = Column(Integer, ForeignKey("modalidades.id_modalidade"), nullable=False)
    arquivado = Column(Boolean, nullable=False, server_default=FALSO)
    criado_em = Column(DateTime, nullable=False, server_default=AGORA)

    modalidade = relationship("Modalidade", back_populates="competicoes")
    edicoes = relationship("EdicaoCompeticao", back_populates="competicao")


class EdicaoEvento(Base):
    __tablename__ = "edicoes_evento"
    __table_args__ = (
        UniqueConstraint("id_evento", "identificacao", name="uq_edicoes_evento_identificacao"),
        CheckConstraint("data_inicio <= data_fim", name="ck_edicoes_evento_periodo"),
    )

    id_edicao_evento = Column(Integer, primary_key=True)
    id_evento = Column(Integer, ForeignKey("eventos.id_evento"), nullable=False)
    identificacao = Column(String(100), nullable=False)
    data_inicio = Column(Date, nullable=False)
    data_fim = Column(Date, nullable=False)
    criado_em = Column(DateTime, nullable=False, server_default=AGORA)

    evento = relationship("Evento", back_populates="edicoes")
    edicoes_competicao = relationship("EdicaoCompeticao", back_populates="edicao_evento")


class EdicaoCompeticao(Base):
    __tablename__ = "edicoes_competicao"
    __table_args__ = (
        UniqueConstraint(
            "id_competicao", "identificacao", name="uq_edicoes_competicao_identificacao"
        ),
        CheckConstraint("data_inicio <= data_fim", name="ck_edicoes_competicao_periodo"),
        CheckConstraint("revisao >= 1", name="ck_edicoes_competicao_revisao"),
    )

    id_edicao_competicao = Column(Integer, primary_key=True)
    id_competicao = Column(Integer, ForeignKey("competicoes.id_competicao"), nullable=False)
    id_edicao_evento = Column(
        Integer, ForeignKey("edicoes_evento.id_edicao_evento"), nullable=True
    )
    identificacao = Column(String(100), nullable=False)
    categoria = Column(String(100), nullable=True)
    data_inicio = Column(Date, nullable=False)
    data_fim = Column(Date, nullable=False)
    formato = Column(Enum(*FORMATOS_EDICAO, name="formato_edicao"), nullable=False)
    configuracao = Column(JSON, nullable=False)
    estado = Column(
        Enum(*ESTADOS_EDICAO, name="estado_edicao"),
        nullable=False,
        server_default=text("'RASCUNHO'"),
    )
    publicada = Column(Boolean, nullable=False, server_default=FALSO)
    revisao = Column(Integer, nullable=False, server_default=text("1"))
    criado_em = Column(DateTime, nullable=False, server_default=AGORA)

    competicao = relationship("Competicao", back_populates="edicoes")
    edicao_evento = relationship("EdicaoEvento", back_populates="edicoes_competicao")
    equipes = relationship("Equipe", back_populates="edicao_competicao")
