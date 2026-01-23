from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
from services import eventos as service_eventos

router = APIRouter(
    prefix="/eventos",
    tags=["Eventos"]
)

@router.post("/", summary="Criar um novo evento", response_model=schemas.Evento, status_code=status.HTTP_201_CREATED)
def criar_evento(evento: schemas.EventoCreate, db: Session = Depends(get_db)):
    return service_eventos.criar_evento(db=db, evento=evento)

@router.get("/", summary="Listar todos os eventos", response_model=List[schemas.Evento], status_code=status.HTTP_200_OK)
def listar_eventos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return service_eventos.listar_eventos(db=db, skip=skip, limit=limit)

@router.get("/{id_evento}", summary="Obter um evento por ID", response_model=schemas.Evento, status_code=status.HTTP_200_OK)
def listar_evento(id_evento: int, db: Session = Depends(get_db)):
    db_evento = service_eventos.listar_evento(db=db, id_evento=id_evento)
    if not db_evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return db_evento

@router.put("/{id_evento}", summary="Atualizar um evento existente", response_model=schemas.Evento, status_code=status.HTTP_200_OK)
def atualizar_evento(id_evento: int, evento_atualizado: schemas.EventoCreate, db: Session = Depends(get_db)):
    db_evento = service_eventos.atualizar_evento(db=db, id_evento=id_evento, evento_atualizado=evento_atualizado)
    if not db_evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return db_evento

@router.delete("/{id_evento}", summary="Excluir um evento", status_code=status.HTTP_204_NO_CONTENT)
def excluir_evento(id_evento: int, db: Session = Depends(get_db)):
    sucesso = service_eventos.excluir_evento(db=db, id_evento=id_evento)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return None
