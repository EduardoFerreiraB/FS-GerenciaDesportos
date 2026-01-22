from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from database import get_db
import schemas
import models
from services import presencas as servico_presencas
from services import turmas as servico_turmas
from security import get_current_active_user

router = APIRouter(
    prefix="/presencas",
    tags=["Presenças"],
)

@router.post("/", summary="Registrar ou atualizar presença individual", response_model=schemas.Presenca, status_code=status.HTTP_201_CREATED)
def registrar_presenca(
    presenca: schemas.PresencaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    return servico_presencas.registrar_presenca(db=db, presenca=presenca)

@router.post("/lote", summary="Registrar presenças em lote", response_model=List[schemas.Presenca], status_code=status.HTTP_201_CREATED)
def registrar_presenca_lote(
    presencas: List[schemas.PresencaCreate],
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    return servico_presencas.registrar_presenca_lote(db=db, presencas=presencas)

@router.get("/matricula/{id_matricula}", summary="Listar presenças de uma matrícula", response_model=List[schemas.Presenca], status_code=status.HTTP_200_OK)
def listar_presencas_matricula(
    id_matricula: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    return servico_presencas.listar_presencas_matricula(db=db, id_matricula=id_matricula)

@router.get("/turma/{id_turma}", summary="Listar presenças de uma turma em uma data", response_model=List[schemas.Presenca], status_code=status.HTTP_200_OK)
def listar_presencas_turma_data(
    id_turma: int,
    data_aula: date,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    if current_user.role == "professor":
         turma = servico_turmas.listar_turma_id(db, id_turma)
         if not turma or (current_user.professores and turma.id_professor != current_user.professores.id_professor):
             raise HTTPException(status_code=403, detail="Acesso negado: Você só pode ver presenças das suas turmas.")

    return servico_presencas.listar_presencas_turma_data(db=db, id_turma=id_turma, data_aula=data_aula)
