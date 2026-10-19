"""Exclusao fisica em cascata, na ordem das chaves estrangeiras.

Explicita no servico em vez de depender de ``ON DELETE CASCADE``: o
comportamento e o mesmo em MySQL, TiDB e SQLite, e cada exclusao fica num
unico lugar. Nao abre transacao; quem chama controla commit e rollback.

Os IDs sao lidos antes e cada DELETE recebe uma lista literal, nunca uma
subconsulta: o MySQL recusa ``DELETE FROM t WHERE id IN (SELECT ... FROM t)``
(erro 1093), coisa que o SQLite dos testes aceita.
"""

from collections.abc import Iterable

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from competicoes.modelos import (
    AuditoriaCompeticao,
    Competicao,
    CumprimentoSuspensao,
    DecisaoClassificacao,
    DueloEliminatorio,
    EdicaoCompeticao,
    Equipe,
    GrupoCompeticao,
    IntegranteEquipe,
    OcorrenciaPartida,
    Partida,
    RequisicaoPartida,
    SuspensaoCompeticao,
    VagaDuelo,
)


def _ids(db: Session, coluna, *condicoes) -> list[int]:
    return list(db.scalars(select(coluna).where(*condicoes)))


def _apagar(db: Session, modelo, *condicoes) -> None:
    db.execute(delete(modelo).where(*condicoes).execution_options(synchronize_session=False))


def _apagar_ids(db: Session, modelo, coluna, ids: list[int], *condicoes) -> None:
    """DELETE por lista literal; lista vazia nao emite comando."""
    if ids:
        _apagar(db, modelo, coluna.in_(ids), *condicoes)


def _apagar_disciplina(db: Session, ids_suspensoes: list[int], ids_partidas: Iterable[int] = ()) -> None:
    ids_partidas = list(ids_partidas)
    condicoes = []
    if ids_suspensoes:
        condicoes.append(CumprimentoSuspensao.id_suspensao.in_(ids_suspensoes))
    if ids_partidas:
        condicoes.append(CumprimentoSuspensao.id_partida.in_(ids_partidas))
    if condicoes:
        _apagar(db, CumprimentoSuspensao, or_(*condicoes))
    _apagar_ids(db, SuspensaoCompeticao, SuspensaoCompeticao.id_suspensao, ids_suspensoes)


def apagar_integrantes_de_equipes(db: Session, ids_equipes: list[int]) -> None:
    """Apaga as inscricoes (atletas) das equipes; competidores permanecem."""
    ids_integrantes = _ids(db, IntegranteEquipe.id_integrante, IntegranteEquipe.id_equipe.in_(ids_equipes))
    _apagar_disciplina(
        db, _ids(db, SuspensaoCompeticao.id_suspensao, SuspensaoCompeticao.id_integrante.in_(ids_integrantes))
    )
    _apagar_ids(db, IntegranteEquipe, IntegranteEquipe.id_integrante, ids_integrantes)


def apagar_conteudo_edicao(db: Session, id_edicao: int) -> None:
    """Apaga tudo o que pertence a edicao, deixando apenas a linha da edicao."""
    ids_partidas = _ids(db, Partida.id_partida, Partida.id_edicao_competicao == id_edicao)
    ids_duelos = _ids(db, DueloEliminatorio.id_duelo, DueloEliminatorio.id_edicao_competicao == id_edicao)
    ids_equipes = _ids(db, Equipe.id_equipe, Equipe.id_edicao_competicao == id_edicao)

    _apagar_disciplina(
        db,
        _ids(db, SuspensaoCompeticao.id_suspensao, SuspensaoCompeticao.id_edicao_competicao == id_edicao),
        ids_partidas,
    )
    _apagar(db, DecisaoClassificacao, DecisaoClassificacao.id_edicao_competicao == id_edicao)
    _apagar_ids(db, RequisicaoPartida, RequisicaoPartida.id_partida, ids_partidas)
    # Derivadas (expulsao por 2o amarelo) antes das ocorrencias de origem.
    _apagar_ids(db, OcorrenciaPartida, OcorrenciaPartida.id_partida, ids_partidas,
                OcorrenciaPartida.id_ocorrencia_origem.is_not(None))
    _apagar_ids(db, OcorrenciaPartida, OcorrenciaPartida.id_partida, ids_partidas)
    _apagar(db, Partida, Partida.id_edicao_competicao == id_edicao)
    _apagar_ids(db, VagaDuelo, VagaDuelo.id_duelo, ids_duelos)
    _apagar(db, DueloEliminatorio, DueloEliminatorio.id_edicao_competicao == id_edicao)
    apagar_integrantes_de_equipes(db, ids_equipes)
    _apagar(db, Equipe, Equipe.id_edicao_competicao == id_edicao)
    _apagar(db, GrupoCompeticao, GrupoCompeticao.id_edicao_competicao == id_edicao)


def apagar_edicao(db: Session, id_edicao: int) -> None:
    """Apaga a edicao e todo o seu conteudo; a auditoria permanece, desvinculada."""
    apagar_conteudo_edicao(db, id_edicao)
    # Equivalente ao ON DELETE SET NULL, explicito para nao depender do banco.
    db.execute(
        update(AuditoriaCompeticao)
        .where(AuditoriaCompeticao.id_edicao_competicao == id_edicao)
        .values(id_edicao_competicao=None)
        .execution_options(synchronize_session=False)
    )
    _apagar(db, EdicaoCompeticao, EdicaoCompeticao.id_edicao_competicao == id_edicao)


def apagar_competicao(db: Session, id_competicao: int) -> None:
    """Apaga a competicao e, antes, todas as suas edicoes."""
    for id_edicao in _ids(db, EdicaoCompeticao.id_edicao_competicao, EdicaoCompeticao.id_competicao == id_competicao):
        apagar_edicao(db, id_edicao)
    _apagar(db, Competicao, Competicao.id_competicao == id_competicao)
