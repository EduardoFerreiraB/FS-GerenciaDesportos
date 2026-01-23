from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from database import get_db
import schemas
import models
from services import presencas as servico_presencas
from security import get_current_active_user

router = APIRouter(
    prefix="/presencas",
    tags=["Presenças"],
)

@router.post("/lote", summary="Registrar presenças em lote", response_model=List[schemas.Presenca], status_code=status.HTTP_201_CREATED)
def registrar_presenca_lote(
    dados: schemas.ListaPresenca, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    return servico_presencas.registrar_presenca_lote(db=db, lista_presenca=dados)

@router.get("/turma/{id_turma}/data/{data_aula}", summary="Listar presenças de uma turma em uma data", response_model=List[schemas.Presenca])
def listar_presencas_turma_data(
    id_turma: int,
    data_aula: date,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    return servico_presencas.listar_presencas_turma_data(db=db, id_turma=id_turma, data_aula=data_aula)