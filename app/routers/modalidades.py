from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
from services import modalidades as servico_modalidades

router = APIRouter(
    prefix="/modalidades",
    tags=["Modalidades"],
)

@router.post("/", summary="Criar uma nova modalidade", response_model=schemas.Modalidade, status_code=status.HTTP_201_CREATED) 
async def criar_modalidade(modalidade: schemas.ModalidadeCreate, db: Session = Depends(get_db)):

    if modalidade.nome:
        modalidade_existente = servico_modalidades.listar_modalidade(db, id_modalidade=modalidade.nome)
        if modalidade_existente:
            raise HTTPException(status_code=400, detail="Modalidade já existe.")
        
    return servico_modalidades.criar_modalidade(db=db, modalidade=modalidade)

@router.get("/", summary="Listar todas as modalidades", response_model=List[schemas.Modalidade], status_code=status.HTTP_200_OK)
async def listar_modalidades(db: Session = Depends(get_db)):
    return servico_modalidades.listar_modalidades(db=db)

@router.get("/{id_modalidade}", summary="Obter uma modalidade por ID", response_model=schemas.Modalidade, status_code=status.HTTP_200_OK)
async def listar_modalidade(id_modalidade: int, db: Session = Depends(get_db)):
    db_modalidade = servico_modalidades.listar_modalidade(db=db, id_modalidade=id_modalidade)
    if not db_modalidade:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada.")
    return db_modalidade

@router.put("/{id_modalidade}", summary="Atualizar uma modalidade existente", response_model=schemas.Modalidade, status_code=status.HTTP_200_OK)
async def atualizar_modalidade(id_modalidade: int, modalidade: schemas.ModalidadeCreate, db: Session = Depends(get_db)):
    db_modalidade = servico_modalidades.atualizar_modalidade(db=db, id_modalidade=id_modalidade, modalidade_atualizada=modalidade)
    if not db_modalidade:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada.")
    return db_modalidade

@router.delete("/{id_modalidade}", summary="Excluir uma modalidade", response_model=schemas.Modalidade, status_code=status.HTTP_200_OK)
async def excluir_modalidade(id_modalidade: int, db: Session = Depends(get_db)):
    db_modalidade = servico_modalidades.excluir_modalidade(db=db, id_modalidade=id_modalidade)
    if not db_modalidade:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada.")
    return db_modalidade
