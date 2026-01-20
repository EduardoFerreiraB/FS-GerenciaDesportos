from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
from services import edicoes as edicao_service
from services import eventos as evento_service

router = APIRouter(
    prefix="/edicoes",
    tags=["Edições"]
)

@router.post("/", summary="Criar uma nova edição", response_model=schemas.Edicao, status_code=status.HTTP_201_CREATED)
def criar_edicao(edicao: schemas.EdicaoCreate, db: Session = Depends(get_db)):
    evento = evento_service.listar_evento(db=db, id_evento=edicao.id_evento)
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado para associar à edição.")
    return edicao_service.criar_edicao(db=db, edicao=edicao)

@router.get("/", summary="Listar todas as edições", response_model=List[schemas.Edicao], status_code=status.HTTP_200_OK)
def listar_edicoes(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return edicao_service.listar_edicoes(db=db, skip=skip, limit=limit)

@router.get("/{edicao_id}", summary="Obter uma edição por ID", response_model=schemas.Edicao, status_code=status.HTTP_200_OK)
def listar_edicao(edicao_id: int, db: Session = Depends(get_db)):
    db_edicao = edicao_service.listar_evento(db=db, edicao_id=edicao_id)

    if not db_edicao:
        raise HTTPException(status_code=404, detail="Edição não encontrada.")
    return db_edicao

@router.put("/{edicao_id}", summary="Atualizar uma edição existente", response_model=schemas.Edicao, status_code=status.HTTP_200_OK)
def atualizar_edicao(edicao_id: int, edicao_atualizada: schemas.EdicaoCreate, db: Session = Depends(get_db)):
    db_edicao = edicao_service.atualizar_edicao(db=db, edicao_id=edicao_id, edicao_atualizada=edicao_atualizada)

    if not db_edicao:
        raise HTTPException(status_code=404, detail="Edição não encontrada.")
    return db_edicao

@router.delete("/{edicao_id}", summary="Excluir uma edição", status_code=status.HTTP_204_NO_CONTENT)
def excluir_edicao(edicao_id: int, db: Session = Depends(get_db)):
    sucesso = edicao_service.excluir_edicao(db=db, edicao_id=edicao_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Edição não encontrada.")
    return None