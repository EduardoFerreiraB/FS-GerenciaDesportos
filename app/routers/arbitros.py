from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
from services import arbitros as service_arbitros

router = APIRouter(
    prefix="/arbitros",
    tags=["Árbitros"]
)

@router.post("/", summary="Criar um novo árbitro", response_model=schemas.Arbitro, status_code=status.HTTP_201_CREATED)
def criar_arbitro(arbitro: schemas.ArbitroCreate, db: Session = Depends(get_db)):
    return service_arbitros.criar_arbitro(db=db, arbitro=arbitro)

@router.get("/", summary="Listar todos os árbitros", response_model=List[schemas.Arbitro], status_code=status.HTTP_200_OK)
def listar_arbitros(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return service_arbitros.listar_arbitros(db=db, skip=skip, limit=limit)

@router.get("/{id_arbitro}", summary="Obter um árbitro por ID", response_model=schemas.Arbitro, status_code=status.HTTP_200_OK)
def listar_arbitro(id_arbitro: int, db: Session = Depends(get_db)):
    db_arbitro = service_arbitros.listar_arbitro_id(db=db, id_arbitro=id_arbitro)

    if not db_arbitro:
        raise HTTPException(status_code=404, detail="Árbitro não encontrado.")
    return db_arbitro

@router.put("/{id_arbitro}", summary="Atualizar um árbitro existente", response_model=schemas.Arbitro, status_code=status.HTTP_200_OK)
def atualizar_arbitro(id_arbitro: int, arbitro_atualizado: schemas.ArbitroCreate, db: Session = Depends(get_db)):
    db_arbitro = service_arbitros.atualizar_arbitro(db=db, id_arbitro=id_arbitro, arbitro_atualizado=arbitro_atualizado)

    if not db_arbitro:
        raise HTTPException(status_code=404, detail="Árbitro não encontrado.")
    return db_arbitro

@router.delete("/{id_arbitro}", summary="Excluir um árbitro", status_code=status.HTTP_204_NO_CONTENT)
def excluir_arbitro(id_arbitro: int, db: Session = Depends(get_db)):
    sucesso = service_arbitros.excluir_arbitro(db=db, id_arbitro=id_arbitro)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Árbitro não encontrado.")
    return None