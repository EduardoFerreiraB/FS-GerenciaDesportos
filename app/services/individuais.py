"""Business logic and services for individual competitions, provas, and results."""

from typing import List, Optional
from sqlalchemy.orm import Session

import models
import schemas


# ============================================================================
# Helpers
# ============================================================================

def validar_modo_individual(competicao: models.Competicao) -> None:
    if competicao.modo_inscricao != "INDIVIDUAL":
        raise ValueError("Operações individuais só são permitidas para competições em modo INDIVIDUAL.")


def recalcular_posicoes(db: Session, id_prova: int) -> None:
    """Recalcula as posições de todos os resultados da prova baseando-se no tempo_ms asc.
    Participantes desqualificados ficam sem colocação regular (posicao=None).
    """
    resultados = (
        db.query(models.ResultadoProva)
        .filter_by(id_prova=id_prova)
        .order_by(models.ResultadoProva.desqualificado.asc(), models.ResultadoProva.tempo_ms.asc())
        .all()
    )

    qualificados = [r for r in resultados if not r.desqualificado]
    desqualificados = [r for r in resultados if r.desqualificado]

    for idx, r in enumerate(qualificados, start=1):
        r.posicao = idx

    for r in desqualificados:
        r.posicao = None

    db.flush()


# ============================================================================
# Inscrições Individuais
# ============================================================================

def inscrever_participante(
    db: Session,
    id_competicao: int,
    payload: schemas.InscricaoIndividualCreate,
) -> models.InscricaoIndividual:
    competicao = db.query(models.Competicao).filter_by(id_competicao=id_competicao).first()
    if not competicao:
        raise LookupError("Competição não encontrada.")
    validar_modo_individual(competicao)

    participante = db.query(models.Participante).filter_by(id_participante=payload.id_participante).first()
    if not participante:
        raise LookupError("Participante não encontrado.")

    existente = (
        db.query(models.InscricaoIndividual)
        .filter_by(id_competicao=id_competicao, id_participante=payload.id_participante)
        .first()
    )
    if existente:
        raise ValueError("Participante já está inscrito nesta competição.")

    inscricao = models.InscricaoIndividual(
        id_competicao=id_competicao,
        id_participante=payload.id_participante,
        numero_peito=payload.numero_peito,
    )
    db.add(inscricao)
    db.commit()
    db.refresh(inscricao)
    return inscricao


def listar_inscricoes_competicao(
    db: Session,
    id_competicao: int,
) -> List[models.InscricaoIndividual]:
    competicao = db.query(models.Competicao).filter_by(id_competicao=id_competicao).first()
    if not competicao:
        raise LookupError("Competição não encontrada.")
    validar_modo_individual(competicao)

    return (
        db.query(models.InscricaoIndividual)
        .filter_by(id_competicao=id_competicao)
        .order_by(models.InscricaoIndividual.id_inscricao.asc())
        .all()
    )


def remover_inscricao(
    db: Session,
    id_competicao: int,
    id_participante: int,
) -> bool:
    competicao = db.query(models.Competicao).filter_by(id_competicao=id_competicao).first()
    if not competicao:
        raise LookupError("Competição não encontrada.")
    validar_modo_individual(competicao)

    inscricao = (
        db.query(models.InscricaoIndividual)
        .filter_by(id_competicao=id_competicao, id_participante=id_participante)
        .first()
    )
    if not inscricao:
        return False

    # Bloquear se o participante tiver resultados vinculados a provas desta competição
    tem_resultados = (
        db.query(models.ResultadoProva)
        .join(models.Prova, models.ResultadoProva.id_prova == models.Prova.id_prova)
        .filter(
            models.Prova.id_competicao == id_competicao,
            models.ResultadoProva.id_participante == id_participante,
        )
        .first()
    )
    if tem_resultados:
        raise ValueError("Não é possível remover a inscrição: o participante possui resultados vinculados nesta competição.")

    db.delete(inscricao)
    db.commit()
    return True


# ============================================================================
# Provas Internas
# ============================================================================

def criar_prova(
    db: Session,
    id_competicao: int,
    payload: schemas.ProvaCreate,
) -> models.Prova:
    competicao = db.query(models.Competicao).filter_by(id_competicao=id_competicao).first()
    if not competicao:
        raise LookupError("Competição não encontrada.")
    validar_modo_individual(competicao)

    status_str = payload.status.value if hasattr(payload.status, "value") else payload.status

    prova = models.Prova(
        id_competicao=id_competicao,
        nome=payload.nome,
        data=payload.data,
        hora=payload.hora,
        id_local=payload.id_local,
        status=status_str,
        observacoes=payload.observacoes,
    )
    db.add(prova)
    db.commit()
    db.refresh(prova)
    return prova


def listar_provas_competicao(
    db: Session,
    id_competicao: int,
) -> List[models.Prova]:
    competicao = db.query(models.Competicao).filter_by(id_competicao=id_competicao).first()
    if not competicao:
        raise LookupError("Competição não encontrada.")
    validar_modo_individual(competicao)

    provas = (
        db.query(models.Prova)
        .filter_by(id_competicao=id_competicao)
        .order_by(models.Prova.id_prova.asc())
        .all()
    )
    for p in provas:
        p.resultados.sort(key=lambda r: (r.desqualificado, r.tempo_ms))
    return provas


def obter_prova(
    db: Session,
    id_prova: int,
) -> Optional[models.Prova]:
    prova = db.query(models.Prova).filter_by(id_prova=id_prova).first()
    if not prova:
        return None
    prova.resultados.sort(key=lambda r: (r.desqualificado, r.tempo_ms))
    return prova


def atualizar_prova(
    db: Session,
    id_prova: int,
    payload: schemas.ProvaUpdate,
) -> models.Prova:
    prova = db.query(models.Prova).filter_by(id_prova=id_prova).first()
    if not prova:
        raise LookupError("Prova não encontrada.")

    update_data = payload.model_dump(exclude_unset=True)
    if "status" in update_data and hasattr(update_data["status"], "value"):
        update_data["status"] = update_data["status"].value

    for key, value in update_data.items():
        setattr(prova, key, value)

    db.commit()
    db.refresh(prova)
    prova.resultados.sort(key=lambda r: (r.desqualificado, r.tempo_ms))
    return prova


def remover_prova(
    db: Session,
    id_prova: int,
) -> bool:
    prova = db.query(models.Prova).filter_by(id_prova=id_prova).first()
    if not prova:
        return False

    if prova.status == "Finalizada":
        raise ValueError("Não é possível excluir uma prova com status Finalizada.")

    if prova.resultados:
        raise ValueError("Não é possível excluir uma prova que já possui resultados registrados.")

    db.delete(prova)
    db.commit()
    return True


# ============================================================================
# Resultados de Provas
# ============================================================================

def lancar_resultado(
    db: Session,
    id_prova: int,
    payload: schemas.ResultadoProvaCreate,
) -> models.ResultadoProva:
    prova = db.query(models.Prova).filter_by(id_prova=id_prova).first()
    if not prova:
        raise LookupError("Prova não encontrada.")

    if payload.tempo_ms <= 0:
        raise ValueError("O tempo deve ser um número inteiro positivo (> 0).")

    participante = db.query(models.Participante).filter_by(id_participante=payload.id_participante).first()
    if not participante:
        raise LookupError("Participante não encontrado.")

    # Validar que o participante está inscrito na competição da prova
    inscricao = (
        db.query(models.InscricaoIndividual)
        .filter_by(id_competicao=prova.id_competicao, id_participante=payload.id_participante)
        .first()
    )
    if not inscricao:
        raise ValueError("Participante não está inscrito nesta competição.")

    # Validar unicidade de resultado para o participante na mesma prova
    existente = (
        db.query(models.ResultadoProva)
        .filter_by(id_prova=id_prova, id_participante=payload.id_participante)
        .first()
    )
    if existente:
        raise ValueError("Participante já possui resultado registrado nesta prova.")

    resultado = models.ResultadoProva(
        id_prova=id_prova,
        id_participante=payload.id_participante,
        tempo_ms=payload.tempo_ms,
        desqualificado=payload.desqualificado,
        motivo_desqualificacao=payload.motivo_desqualificacao,
        observacoes=payload.observacoes,
    )
    db.add(resultado)
    db.flush()

    # Recalcular posições
    recalcular_posicoes(db, id_prova)

    db.commit()
    db.refresh(resultado)
    return resultado


def listar_resultados_prova(
    db: Session,
    id_prova: int,
) -> List[models.ResultadoProva]:
    prova = db.query(models.Prova).filter_by(id_prova=id_prova).first()
    if not prova:
        raise LookupError("Prova não encontrada.")

    return (
        db.query(models.ResultadoProva)
        .filter_by(id_prova=id_prova)
        .order_by(models.ResultadoProva.desqualificado.asc(), models.ResultadoProva.tempo_ms.asc())
        .all()
    )


def obter_resultado(
    db: Session,
    id_resultado: int,
) -> Optional[models.ResultadoProva]:
    return db.query(models.ResultadoProva).filter_by(id_resultado=id_resultado).first()


def atualizar_resultado(
    db: Session,
    id_resultado: int,
    payload: schemas.ResultadoProvaUpdate,
) -> models.ResultadoProva:
    resultado = db.query(models.ResultadoProva).filter_by(id_resultado=id_resultado).first()
    if not resultado:
        raise LookupError("Resultado não encontrado.")

    update_data = payload.model_dump(exclude_unset=True)
    if "tempo_ms" in update_data:
        if update_data["tempo_ms"] is not None and update_data["tempo_ms"] <= 0:
            raise ValueError("O tempo deve ser um número inteiro positivo (> 0).")

    for key, value in update_data.items():
        setattr(resultado, key, value)

    db.flush()

    recalcular_posicoes(db, resultado.id_prova)

    db.commit()
    db.refresh(resultado)
    return resultado


def remover_resultado(
    db: Session,
    id_resultado: int,
) -> bool:
    resultado = db.query(models.ResultadoProva).filter_by(id_resultado=id_resultado).first()
    if not resultado:
        return False

    id_prova = resultado.id_prova
    db.delete(resultado)
    db.flush()

    recalcular_posicoes(db, id_prova)

    db.commit()
    return True
