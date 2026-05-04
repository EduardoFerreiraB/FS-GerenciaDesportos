from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
import models
from services import equipes as service_equipes

router = APIRouter(
    prefix="/equipes",
    tags=["Equipes"]
)

@router.post("/", summary="Criar uma nova equipe", response_model=schemas.Equipe, status_code=status.HTTP_201_CREATED)
def criar_equipe(equipe: schemas.EquipeCreate, db: Session = Depends(get_db)):
    return service_equipes.criar_equipe(db=db, equipe=equipe)

@router.get("/", summary="Listar todas as equipes", response_model=List[schemas.Equipe])
def listar_equipes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Equipe).offset(skip).limit(limit).all()

@router.get("/{id_equipe}", summary="Obter uma equipe por ID", response_model=schemas.Equipe)
def obter_equipe(id_equipe: int, db: Session = Depends(get_db)):
    equipe = service_equipes.listar_equipe(db=db, id_equipe=id_equipe)
    if not equipe:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    return equipe

@router.get("/edicao/{id_edicao}", summary="Listar equipes de uma edição", response_model=List[schemas.Equipe])
def listar_equipes_edicao(id_edicao: int, db: Session = Depends(get_db)):
    return service_equipes.listar_equipes_edicao(db=db, id_edicao=id_edicao)

@router.post("/{id_equipe}/participantes/{id_participante}", summary="Adicionar participante à equipe")
def adicionar_participante(id_equipe: int, id_participante: int, db: Session = Depends(get_db)):
    sucesso = service_equipes.adicionar_participante_equipe(db=db, id_equipe=id_equipe, id_participante=id_participante)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Equipe ou Participante não encontrado.")
    return {"message": "Participante adicionado com sucesso."}

@router.delete("/{id_equipe}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_equipe(id_equipe: int, db: Session = Depends(get_db)) :
    sucesso = service_equipes.excluir_equipe(db=db, id_equipe=id_equipe)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    return None
