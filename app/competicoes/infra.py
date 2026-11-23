"""Transacao controlada pelos servicos e auxiliares sem commit parcial."""

from collections.abc import Iterator
from contextlib import contextmanager
from copy import deepcopy
from typing import Protocol

from pydantic import JsonValue
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Usuario
from competicoes.erros import ConflitoRevisao, NaoEncontrado
from competicoes.modelos import AuditoriaCompeticao, EdicaoCompeticao


class EntidadeComRevisao(Protocol):
    revisao: int


@contextmanager
def transacao(db: Session) -> Iterator[None]:
    """Abra uma vez por operacao de servico, incluindo leituras autobegin."""
    try:
        yield
        db.commit()
    except BaseException:
        db.rollback()
        raise


def bloquear_edicao(db: Session, id_edicao_competicao: int) -> EdicaoCompeticao:
    consulta = select(EdicaoCompeticao).where(
        EdicaoCompeticao.id_edicao_competicao == id_edicao_competicao
    ).execution_options(populate_existing=True)
    if db.get_bind().dialect.name == "mysql":
        consulta = consulta.with_for_update()
    edicao = db.execute(consulta).scalar_one_or_none()
    if edicao is None:
        raise NaoEncontrado("Edição de competição não encontrada.", campos=["id_edicao_competicao"])
    return edicao


def conferir_revisao(entidade: EntidadeComRevisao, revisao_cliente: int) -> None:
    if entidade.revisao != revisao_cliente:
        raise ConflitoRevisao("O registro foi alterado. Atualize os dados antes de salvar.", campos=["revisao"])


def incrementar_revisao(entidade: EntidadeComRevisao) -> None:
    entidade.revisao += 1


def registrar_auditoria(
    db: Session, *, entidade: str, id_entidade: int, acao: str,
    antes: dict[str, JsonValue] | None, depois: dict[str, JsonValue] | None,
    id_edicao_competicao: int | None, responsavel: Usuario, motivo: str | None = None,
) -> AuditoriaCompeticao:
    registro = AuditoriaCompeticao(
        entidade=entidade, id_entidade=id_entidade, acao=acao,
        antes=deepcopy(antes), depois=deepcopy(depois),
        id_edicao_competicao=id_edicao_competicao,
        id_usuario_responsavel=responsavel.id_usuario,
        responsavel_nome=responsavel.username, motivo=motivo,
    )
    db.add(registro)
    db.flush()
    return registro
