"""Infraestrutura compartilhada: auditoria e idempotencia de partida."""

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)

from database import Base


class AuditoriaCompeticao(Base):
    """Trilha de alteracoes. Nao exposta no portal publico.

    ``responsavel_nome`` preserva a referencia legivel ao autor quando a conta
    deixa de existir (a FK vira NULL).
    """

    __tablename__ = "auditoria_competicao"
    __table_args__ = (
        Index("ix_auditoria_competicao_entidade", "entidade", "id_entidade"),
    )

    id_auditoria = Column(Integer, primary_key=True)
    entidade = Column(String(60), nullable=False)
    id_entidade = Column(Integer, nullable=False)
    acao = Column(String(60), nullable=False)
    antes = Column(JSON, nullable=True)
    depois = Column(JSON, nullable=True)
    id_usuario_responsavel = Column(
        Integer, ForeignKey("usuarios.id_usuario", ondelete="SET NULL"), nullable=True
    )
    responsavel_nome = Column(String(150), nullable=False)
    instante = Column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    motivo = Column(Text, nullable=True)
    id_edicao_competicao = Column(
        Integer,
        ForeignKey("edicoes_competicao.id_edicao_competicao", ondelete="SET NULL"),
        nullable=True,
    )


class RequisicaoPartida(Base):
    """Chave de idempotencia por partida.

    Mesma chave e mesmo ``hash_payload`` devolvem ``resultado``; mesma chave com
    payload diferente e conflito. ``id_partida`` ainda nao tem FK: a tabela de
    partidas nasce na fatia 2, que acrescenta a chave estrangeira.
    """

    __tablename__ = "requisicoes_partida"
    __table_args__ = (
        UniqueConstraint(
            "id_partida", "chave_idempotencia", name="uq_requisicoes_partida_chave"
        ),
    )

    id_requisicao = Column(Integer, primary_key=True)
    id_partida = Column(Integer, nullable=False)
    chave_idempotencia = Column(String(64), nullable=False)
    hash_payload = Column(String(64), nullable=False)
    resultado = Column(JSON, nullable=True)
    criado_em = Column(DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP"))
