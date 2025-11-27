from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
from services import locais as service_locais

router = APIRouter(
    prefix="/locais",
    tags=["Locais"]
)

@router.post("/", summary="Criar um novo local", response_model=schemas.Local, status_code=status.HTTP_201_CREATED)
def criar_local(local: schemas.LocalCreate, db: Session = Depends(get_db)):
    return service_locais.criar_local(db=db, local=local)

@router.get("/", summary="Listar todos os locais", response_model=List[schemas.Local], status_code=status.HTTP_200_OK)
def listar_locais(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return service_locais.listar_locais(db=db, skip=skip, limit=limit)

@router.get("/{id_local}", summary="Obter um local por ID", response_model=schemas.Local, status_code=status.HTTP_200_OK)
def listar_local(id_local: int, db: Session = Depends(get_db)):
    db_local = service_locais.listar_local_id(db=db, id_local=id_local)

    if not db_local:
        raise HTTPException(status_code=404, detail="Local não encontrado.")
    return db_local

@router.put("/{id_local}", summary="Atualizar um local existente", response_model=schemas.Local, status_code=status.HTTP_200_OK)
def atualizar_local(id_local: int, local_atualizado: schemas.LocalCreate, db: Session = Depends(get_db)):
    db_local = service_locais.atualizar_local(db=db, id_local=id_local, local_atualizado=local_atualizado)

    if not db_local:
        raise HTTPException(status_code=404, detail="Local não encontrado.")
    return db_local

@router.delete("/{id_local}", summary="Excluir um local", status_code=status.HTTP_204_NO_CONTENT)
def excluir_local(id_local: int, db: Session = Depends(get_db)):
    sucesso = service_locais.excluir_local(db=db, id_local=id_local)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Local não encontrado.")
    return None