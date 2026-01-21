from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
import models
from services import modalidades as servico_modalidades
from security import check_coordenador_role, get_current_active_user

router = APIRouter(
    prefix="/modalidades",
    tags=["Modalidades"],
)

@router.post("/", summary="Criar uma nova modalidade", response_model=schemas.Modalidade, status_code=status.HTTP_201_CREATED)
def criar_modalidade(
    modalidade: schemas.ModalidadeCreate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    modalidade_existente = servico_modalidades.listar_modalidade_nome(db, nome=modalidade.nome)
    if modalidade_existente:
        raise HTTPException(status_code=400, detail="Modalidade com este nome já existe.")
    
    return servico_modalidades.criar_modalidade(db=db, modalidade=modalidade)

@router.get("/", summary="Listar todas as modalidades", response_model=List[schemas.Modalidade], status_code=status.HTTP_200_OK)
def listar_modalidades(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    return servico_modalidades.listar_modalidades(db=db, skip=skip, limit=limit)

@router.get("/{id_modalidade}", summary="Obter uma modalidade por ID", response_model=schemas.Modalidade, status_code=status.HTTP_200_OK)
def listar_modalidade(
    id_modalidade: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_modalidade = servico_modalidades.listar_modalidade(db=db, id_modalidade=id_modalidade)
    if not db_modalidade:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada.")
    return db_modalidade

@router.put("/{id_modalidade}", summary="Atualizar uma modalidade existente", response_model=schemas.Modalidade, status_code=status.HTTP_200_OK)
def atualizar_modalidade(
    id_modalidade: int, 
    modalidade: schemas.ModalidadeUpdate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_modalidade = servico_modalidades.atualizar_modalidade(db=db, id_modalidade=id_modalidade, modalidade_atualizada=modalidade)
    if not db_modalidade:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada.")
    return db_modalidade

@router.delete("/{id_modalidade}", summary="Excluir uma modalidade", status_code=status.HTTP_204_NO_CONTENT)
def excluir_modalidade(
    id_modalidade: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    from sqlalchemy.exc import IntegrityError
    try:
        sucesso = servico_modalidades.excluir_modalidade(db=db, id_modalidade=id_modalidade)
        if not sucesso:
            raise HTTPException(status_code=404, detail="Modalidade não encontrada.")
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Não é possível excluir a modalidade, verifique se há turmas vinculadas.")
    return None
