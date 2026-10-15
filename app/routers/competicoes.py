from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from security import check_coordenador_role, get_current_active_user
from services import competicoes as competicao_service
from services import edicoes as edicao_service
from services import equipes as equipe_service
from services import modalidades as modalidade_service


router = APIRouter(tags=["Competições"])


@router.post(
    "/edicoes/{id_edicao}/competicoes",
    response_model=schemas.Competicao,
    status_code=status.HTTP_201_CREATED,
)
def criar_competicao(
    id_edicao: int,
    competicao: schemas.CompeticaoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    if not edicao_service.listar_edicao_id(db, id_edicao):
        raise HTTPException(status_code=404, detail="Edição não encontrada.")
    if not modalidade_service.listar_modalidade(db, competicao.id_modalidade):
        raise HTTPException(status_code=404, detail="Modalidade não encontrada.")
    return competicao_service.criar_competicao(db, id_edicao, competicao)


@router.post(
    "/competicoes/{id_competicao}/equipes",
    response_model=schemas.Equipe,
    status_code=status.HTTP_201_CREATED,
)
def criar_equipe_competicao(
    id_competicao: int,
    equipe: schemas.EquipeCompeticaoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    competicao = competicao_service.listar_competicao(db, id_competicao)
    if not competicao:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    if competicao.modo_inscricao != "EQUIPE":
        raise HTTPException(status_code=422, detail="A competição não aceita equipes.")
    return equipe_service.criar_equipe_competicao(db, competicao, equipe)


@router.get("/competicoes/{id_competicao}/equipes", response_model=List[schemas.Equipe])
def listar_equipes_competicao(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    competicao = competicao_service.listar_competicao(db, id_competicao)
    if not competicao:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    if competicao.modo_inscricao != "EQUIPE":
        raise HTTPException(status_code=422, detail="A competição não aceita equipes.")
    return equipe_service.listar_equipes_competicao(db, id_competicao)


@router.get("/edicoes/{id_edicao}/competicoes", response_model=List[schemas.Competicao])
def listar_competicoes_edicao(
    id_edicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    if not edicao_service.listar_edicao_id(db, id_edicao):
        raise HTTPException(status_code=404, detail="Edição não encontrada.")
    return competicao_service.listar_competicoes_edicao(db, id_edicao)


@router.get("/competicoes/{id_competicao}", response_model=schemas.Competicao)
def obter_competicao(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    competicao = competicao_service.listar_competicao(db, id_competicao)
    if not competicao:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    return competicao


@router.put("/competicoes/{id_competicao}", response_model=schemas.Competicao)
def atualizar_competicao(
    id_competicao: int,
    competicao_atualizada: schemas.CompeticaoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    db_competicao = competicao_service.listar_competicao(db, id_competicao)
    if not db_competicao:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    if competicao_atualizada.id_modalidade is not None and not modalidade_service.listar_modalidade(db, competicao_atualizada.id_modalidade):
        raise HTTPException(status_code=404, detail="Modalidade não encontrada.")

    try:
        return competicao_service.atualizar_competicao(db, db_competicao, competicao_atualizada)
    except competicao_service.CompeticaoErroConfiguracao as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except competicao_service.CompeticaoErroConflito as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/competicoes/{id_competicao}/iniciar", response_model=schemas.Competicao)
def iniciar_competicao(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    db_competicao = competicao_service.listar_competicao(db, id_competicao)
    if not db_competicao:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    try:
        return competicao_service.iniciar_competicao(db, db_competicao)
    except competicao_service.CompeticaoErroConfiguracao as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except competicao_service.CompeticaoErroConflito as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.delete("/competicoes/{id_competicao}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_competicao(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    db_competicao = competicao_service.listar_competicao(db, id_competicao)
    if not db_competicao:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    try:
        competicao_service.excluir_competicao(db, db_competicao)
    except competicao_service.CompeticaoErroConflito as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return None
