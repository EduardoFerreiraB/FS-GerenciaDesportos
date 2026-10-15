"""Competidores, equipes e elencos."""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from database import Base

SITUACOES_EQUIPE = ("ATIVA", "INATIVA")
SITUACOES_INTEGRANTE = ("ATIVO", "INATIVO")

AGORA = text("CURRENT_TIMESTAMP")


class Competidor(Base):
    """Pessoa que compete. Independente do aluno; a origem e opcional."""

    __tablename__ = "competidores"

    id_competidor = Column(Integer, primary_key=True)
    nome = Column(String(200), nullable=False)
    data_nascimento = Column(Date, nullable=True)
    documento = Column(String(50), nullable=True)
    foto_url = Column(String(500), nullable=True)
    ativo = Column(Boolean, nullable=False, server_default=text("1"))
    # Excluir o aluno anula a origem e preserva o competidor (SET NULL no banco).
    id_aluno_origem = Column(
        Integer,
        ForeignKey("alunos.id_aluno", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    criado_em = Column(DateTime, nullable=False, server_default=AGORA)

    # Sem backref e sem delete-orphan: o aluno nao e dono do competidor.
    aluno_origem = relationship("Aluno")
    inscricoes = relationship("IntegranteEquipe", back_populates="competidor")


class Equipe(Base):
    __tablename__ = "equipes"
    __table_args__ = (
        UniqueConstraint("id_edicao_competicao", "nome", name="uq_equipes_edicao_nome"),
        # Alvo da FK composta de integrantes_equipe; id_equipe ja e PK.
        UniqueConstraint("id_edicao_competicao", "id_equipe", name="uq_equipes_edicao_equipe"),
        ForeignKeyConstraint(
            ["id_edicao_competicao", "id_grupo"],
            ["grupos_competicao.id_edicao_competicao", "grupos_competicao.id_grupo"],
            name="fk_equipes_grupo_edicao",
        ),
        Index("ix_equipes_edicao_grupo", "id_edicao_competicao", "id_grupo"),
    )

    id_equipe = Column(Integer, primary_key=True)
    id_edicao_competicao = Column(
        Integer, ForeignKey("edicoes_competicao.id_edicao_competicao"), nullable=False
    )
    id_grupo = Column(Integer, nullable=True)
    nome = Column(String(200), nullable=False)
    sigla = Column(String(10), nullable=True)
    situacao = Column(
        Enum(*SITUACOES_EQUIPE, name="situacao_equipe"),
        nullable=False,
        server_default=text("'ATIVA'"),
    )
    criado_em = Column(DateTime, nullable=False, server_default=AGORA)

    edicao_competicao = relationship("EdicaoCompeticao", back_populates="equipes")
    integrantes = relationship("IntegranteEquipe", back_populates="equipe")
    grupo = relationship(
        "GrupoCompeticao",
        back_populates="equipes",
        foreign_keys="[Equipe.id_edicao_competicao, Equipe.id_grupo]",
        overlaps="edicao_competicao,equipes",
    )


class IntegranteEquipe(Base):
    __tablename__ = "integrantes_equipe"
    __table_args__ = (
        # Impossivel no banco: integrante cuja equipe pertence a outra edicao.
        ForeignKeyConstraint(
            ["id_edicao_competicao", "id_equipe"],
            ["equipes.id_edicao_competicao", "equipes.id_equipe"],
            name="fk_integrantes_equipe_edicao_equipe",
        ),
        # Um competidor em no maximo uma equipe por edicao.
        UniqueConstraint(
            "id_edicao_competicao", "id_competidor", name="uq_integrantes_edicao_competidor"
        ),
        # Indice explicito da FK composta (o MySQL criaria um implicito).
        Index("ix_integrantes_equipe_edicao_equipe", "id_edicao_competicao", "id_equipe"),
    )

    id_integrante = Column(Integer, primary_key=True)
    id_edicao_competicao = Column(Integer, nullable=False)
    id_equipe = Column(Integer, nullable=False)
    id_competidor = Column(Integer, ForeignKey("competidores.id_competidor"), nullable=False)
    # Congelado na inscricao: corrigir o cadastro nao reescreve o historico.
    nome_esportivo = Column(String(200), nullable=False)
    # Informativo, sem unicidade (decisao de 2026-10-15).
    numero_camisa = Column(Integer, nullable=True)
    posicao = Column(String(50), nullable=True)
    situacao = Column(
        Enum(*SITUACOES_INTEGRANTE, name="situacao_integrante"),
        nullable=False,
        server_default=text("'ATIVO'"),
    )
    criado_em = Column(DateTime, nullable=False, server_default=AGORA)

    equipe = relationship("Equipe", back_populates="integrantes")
    competidor = relationship("Competidor", back_populates="inscricoes")
