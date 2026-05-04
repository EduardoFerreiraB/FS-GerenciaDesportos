from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
from services import partidas as service_partidas

router = APIRouter(
    prefix="/partidas",
    tags=["Partidas"]
)

@router.post("/", summary="Criar (agendar) uma partida", response_model=schemas.Partida, status_code=status.HTTP_201_CREATED)
def criar_partida(partida: schemas.PartidaCreate, db: Session = Depends(get_db)):
    try:
        return service_partidas.criar_partida(db=db, partida=partida)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/edicao/{id_edicao}", summary="Listar partidas de uma edição", response_model=List[schemas.Partida])
def listar_partidas_edicao(id_edicao: int, db: Session = Depends(get_db)):
    return service_partidas.listar_partidas_edicao(db=db, id_edicao=id_edicao)

@router.put("/{id_partida}", summary="Atualizar partida (resultado, status, etc)", response_model=schemas.Partida)
def atualizar_partida(id_partida: int, partida_atualizada: schemas.PartidaUpdate, db: Session = Depends(get_db)):
    try:
        db_partida = service_partidas.atualizar_partida(db=db, id_partida=id_partida, partida_atualizada=partida_atualizada)
        if not db_partida:
            raise HTTPException(status_code=404, detail="Partida não encontrada.")
        return db_partida
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{id_partida}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_partida(id_partida: int, db: Session = Depends(get_db)):
    sucesso = service_partidas.excluir_partida(db=db, id_partida=id_partida)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")
    return None
