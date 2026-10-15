"""Router for individual competition domain operations (inscricoes, provas, resultados)."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from security import check_coordenador_role, get_current_active_user
from services import individuais as individual_service


router = APIRouter(tags=["Competições Individuais"])


# ============================================================================
# Inscrições Individuais
# ============================================================================

@router.post(
    "/competicoes/{id_competicao}/inscricoes",
    response_model=schemas.InscricaoIndividual,
    status_code=status.HTTP_201_CREATED,
    summary="Inscrever participante em uma competição individual",
)
def inscrever_participante(
    id_competicao: int,
    payload: schemas.InscricaoIndividualCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    try:
        return individual_service.inscrever_participante(db, id_competicao, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get(
    "/competicoes/{id_competicao}/inscricoes",
    response_model=List[schemas.InscricaoIndividual],
    summary="Listar inscrições individuais de uma competição",
)
def listar_inscricoes(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    try:
        return individual_service.listar_inscricoes_competicao(db, id_competicao)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete(
    "/competicoes/{id_competicao}/inscricoes/{id_participante}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover inscrição individual de uma competição",
)
def remover_inscricao(
    id_competicao: int,
    id_participante: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    try:
        removido = individual_service.remover_inscricao(db, id_competicao, id_participante)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    if not removido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inscrição não encontrada.")


# ============================================================================
# Provas Internas
# ============================================================================

@router.post(
    "/competicoes/{id_competicao}/provas",
    response_model=schemas.Prova,
    status_code=status.HTTP_201_CREATED,
    summary="Criar prova em uma competição individual",
)
def criar_prova(
    id_competicao: int,
    payload: schemas.ProvaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    try:
        return individual_service.criar_prova(db, id_competicao, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get(
    "/competicoes/{id_competicao}/provas",
    response_model=List[schemas.Prova],
    summary="Listar provas de uma competição individual",
)
def listar_provas(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    try:
        return individual_service.listar_provas_competicao(db, id_competicao)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get(
    "/provas/{id_prova}",
    response_model=schemas.Prova,
    summary="Obter detalhes de uma prova com resultados classificados",
)
def obter_prova(
    id_prova: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    prova = individual_service.obter_prova(db, id_prova)
    if not prova:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prova não encontrada.")
    return prova


@router.put(
    "/provas/{id_prova}",
    response_model=schemas.Prova,
    summary="Atualizar dados de uma prova",
)
def atualizar_prova(
    id_prova: int,
    payload: schemas.ProvaUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    try:
        return individual_service.atualizar_prova(db, id_prova, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete(
    "/provas/{id_prova}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover prova",
)
def remover_prova(
    id_prova: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    try:
        removido = individual_service.remover_prova(db, id_prova)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    if not removido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prova não encontrada.")


# ============================================================================
# Resultados de Provas
# ============================================================================

@router.post(
    "/provas/{id_prova}/resultados",
    response_model=schemas.ResultadoProva,
    status_code=status.HTTP_201_CREATED,
    summary="Lançar resultado de participante em uma prova",
)
def lancar_resultado(
    id_prova: int,
    payload: schemas.ResultadoProvaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    try:
        return individual_service.lancar_resultado(db, id_prova, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get(
    "/provas/{id_prova}/resultados",
    response_model=List[schemas.ResultadoProva],
    summary="Listar resultados de uma prova ordenados por menor tempo",
)
def listar_resultados(
    id_prova: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    try:
        return individual_service.listar_resultados_prova(db, id_prova)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.put(
    "/provas/{id_prova}/resultados/{id_resultado}",
    response_model=schemas.ResultadoProva,
    summary="Atualizar resultado de prova",
)
def atualizar_resultado(
    id_prova: int,
    id_resultado: int,
    payload: schemas.ResultadoProvaUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    # Validar que o resultado pertence à prova especificada
    resultado = individual_service.obter_resultado(db, id_resultado)
    if not resultado or resultado.id_prova != id_prova:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resultado não encontrado nesta prova.")

    try:
        return individual_service.atualizar_resultado(db, id_resultado, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete(
    "/provas/{id_prova}/resultados/{id_resultado}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover resultado de prova",
)
def remover_resultado(
    id_prova: int,
    id_resultado: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    resultado = individual_service.obter_resultado(db, id_resultado)
    if not resultado or resultado.id_prova != id_prova:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resultado não encontrado nesta prova.")

    removido = individual_service.remover_resultado(db, id_resultado)
    if not removido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resultado não encontrado.")
