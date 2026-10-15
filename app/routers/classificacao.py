"""Roteador unificado para consultas de classificação e ranking do Passo 6."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, Dict

from database import get_db
import models
from security import get_current_active_user
from services.classificacao_equipes import (
    calcular_classificacao_equipes,
    CompeticaoNaoEncontradaError,
    ModoCompeticaoInvalidoError,
)
from services.classificacao_individuais import (
    calcular_classificacao_prova,
    calcular_classificacao_individual_competicao,
)

router = APIRouter(tags=["Classificação"])


@router.get("/competicoes/{id_competicao}/classificacao", summary="Consultar classificação da competição (inteligente por modo)")
def obter_classificacao_competicao(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
) -> Dict[str, Any]:
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    if comp.modo_inscricao == "EQUIPE":
        return calcular_classificacao_equipes(db, id_competicao)
    elif comp.modo_inscricao == "INDIVIDUAL":
        return calcular_classificacao_individual_competicao(db, id_competicao)
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Competição não possui modo de inscrição definido para cálculo de classificação.",
        )


@router.get("/competicoes/{id_competicao}/classificacao-equipes", summary="Consultar tabela de classificação de equipes")
def obter_classificacao_equipes(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        return calcular_classificacao_equipes(db, id_competicao)
    except CompeticaoNaoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ModoCompeticaoInvalidoError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/competicoes/{id_competicao}/classificacao-individual", summary="Consultar quadro geral e classificação individual")
def obter_classificacao_individual(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        return calcular_classificacao_individual_competicao(db, id_competicao)
    except ValueError as e:
        if "não encontrada" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/provas/{id_prova}/classificacao", summary="Consultar classificação de uma prova individual")
def obter_classificacao_prova(
    id_prova: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        return calcular_classificacao_prova(db, id_prova)
    except ValueError as e:
        if "não encontrada" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
