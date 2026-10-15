"""Modelos da estrutura de disputa: grupos, duelos eliminatorios e vagas de duelo."""

from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from database import Base
from competicoes.modelos.organizacao import EdicaoCompeticao

ESTADOS_DUELO = ("PENDENTE", "DEFINIDO", "RESOLVIDO")
ORIGENS_VAGA = (
    "EQUIPE_INICIAL",
    "POSICAO_GRUPO",
    "VENCEDOR_DUELO",
    "PERDEDOR_DUELO",
    "FOLGA",
)


class GrupoCompeticao(Base):
    __tablename__ = "grupos_competicao"
    __table_args__ = (
        UniqueConstraint(
            "id_edicao_competicao", "nome", name="uq_grupos_competicao_edicao_nome"
        ),
        UniqueConstraint(
            "id_edicao_competicao", "id_grupo", name="uq_grupos_competicao_edicao_id"
        ),
    )

    id_grupo = Column(Integer, primary_key=True)
    id_edicao_competicao = Column(
        Integer,
        ForeignKey("edicoes_competicao.id_edicao_competicao", ondelete="CASCADE"),
        nullable=False,
    )
    nome = Column(String(50), nullable=False)
    ordem = Column(Integer, nullable=False, default=1, server_default=text("1"))

    edicao_competicao = relationship(
        "EdicaoCompeticao", back_populates="grupos", passive_deletes=True
    )
    equipes = relationship(
        "Equipe",
        back_populates="grupo",
        foreign_keys="[Equipe.id_edicao_competicao, Equipe.id_grupo]",
        overlaps="edicao_competicao,equipes",
    )


class DueloEliminatorio(Base):
    __tablename__ = "duelos_eliminatorios"
    __table_args__ = (
        UniqueConstraint(
            "id_edicao_competicao",
            "fase",
            "posicao_chave",
            name="uq_duelos_edicao_fase_posicao",
        ),
        UniqueConstraint(
            "id_edicao_competicao", "id_duelo", name="uq_duelos_edicao_id"
        ),
    )

    id_duelo = Column(Integer, primary_key=True)
    id_edicao_competicao = Column(
        Integer,
        ForeignKey("edicoes_competicao.id_edicao_competicao", ondelete="CASCADE"),
        nullable=False,
    )
    fase = Column(String(50), nullable=False)
    posicao_chave = Column(Integer, nullable=False)
    estado = Column(
        Enum(*ESTADOS_DUELO, name="estado_duelo_enum"),
        default="PENDENTE",
        server_default=text("'PENDENTE'"),
        nullable=False,
    )
    id_equipe_vencedora = Column(
        Integer, ForeignKey("equipes.id_equipe", ondelete="SET NULL"), nullable=True
    )
    ida_volta = Column(
        Boolean, default=False, server_default=text("0"), nullable=False
    )

    edicao_competicao = relationship("EdicaoCompeticao", passive_deletes=True)
    vagas = relationship(
        "VagaDuelo",
        back_populates="duelo",
        cascade="all, delete-orphan",
        passive_deletes=True,
        foreign_keys="[VagaDuelo.id_duelo]",
    )
    equipe_vencedora = relationship("Equipe", foreign_keys=[id_equipe_vencedora])
    partidas = relationship(
        "Partida",
        back_populates="duelo",
        cascade="all, delete-orphan",
        passive_deletes=True,
        foreign_keys="[Partida.id_edicao_competicao, Partida.id_duelo]",
        overlaps="edicao_competicao,equipe_mandante,equipe_visitante,grupo,partidas",
    )


class VagaDuelo(Base):
    __tablename__ = "vagas_duelo"
    __table_args__ = (
        UniqueConstraint("id_duelo", "posicao", name="uq_vagas_duelo_posicao"),
    )

    id_vaga = Column(Integer, primary_key=True)
    id_duelo = Column(
        Integer,
        ForeignKey("duelos_eliminatorios.id_duelo", ondelete="CASCADE"),
        nullable=False,
    )
    posicao = Column(Integer, nullable=False)
    origem = Column(
        Enum(*ORIGENS_VAGA, name="origem_vaga_enum"),
        nullable=False,
    )
    id_equipe = Column(
        Integer, ForeignKey("equipes.id_equipe", ondelete="SET NULL"), nullable=True
    )
    id_grupo = Column(
        Integer,
        ForeignKey("grupos_competicao.id_grupo", ondelete="SET NULL"),
        nullable=True,
    )
    posicao_grupo = Column(Integer, nullable=True)
    id_duelo_origem = Column(
        Integer,
        ForeignKey("duelos_eliminatorios.id_duelo", ondelete="SET NULL"),
        nullable=True,
    )
    id_equipe_resolvida = Column(
        Integer, ForeignKey("equipes.id_equipe", ondelete="SET NULL"), nullable=True
    )

    duelo = relationship(
        "DueloEliminatorio",
        back_populates="vagas",
        foreign_keys=[id_duelo],
    )
    equipe = relationship("Equipe", foreign_keys=[id_equipe])
    grupo = relationship("GrupoCompeticao", foreign_keys=[id_grupo])
    duelo_origem = relationship("DueloEliminatorio", foreign_keys=[id_duelo_origem])
    equipe_resolvida = relationship("Equipe", foreign_keys=[id_equipe_resolvida])


# Anexa o backref em EdicaoCompeticao sem alterar diretamente organizacao.py
EdicaoCompeticao.grupos = relationship(
    "GrupoCompeticao",
    back_populates="edicao_competicao",
    cascade="all, delete-orphan",
    passive_deletes=True,
)
