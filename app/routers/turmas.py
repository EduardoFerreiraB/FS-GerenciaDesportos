from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
from services import turmas as servico_turmas
from services import professores as servico_professores
from services import modalidades as servico_modalidades

router = APIRouter(
    prefix="/turmas",
    tags=["Turmas"],
)

@router.post("/", summary="Criar uma nova turma", response_model=schemas.Turma, status_code=status.HTTP_201_CREATED)
def criar_turma(turma: schemas.TurmaCreate, db: Session = Depends(get_db)):

    modalidade = servico_modalidades.listar_modalidade(db=db, id_modalidade=turma.id_modalidade)

    if not modalidade:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada.")
    
    professor = servico_professores.listar_professor(db=db, id_professor=turma.id_professor)

    if not professor:
        raise HTTPException(status_code=404, detail="Professor não encontrado.")
    
    return servico_turmas.criar_turma(db=db, turma=turma)

@router.get("/", summary="Listar todas as turmas", response_model=List[schemas.Turma], status_code=status.HTTP_200_OK)
def listar_turmas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return servico_turmas.listar_turmas(db=db, skip=skip, limit=limit)

@router.get("/{id_turma}", summary="Obter uma turma por ID", response_model=schemas.Turma, status_code=status.HTTP_200_OK)
def listar_turma(id_turma: int, db: Session = Depends(get_db)):
    db_turma = servico_turmas.listar_turma_id(db=db, id_turma=id_turma)
    if not db_turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")
    return db_turma

@router.get("/professor/{id_professor}", summary="Listar todas as turmas de um professor pelo seu ID", response_model=List[schemas.Turma], status_code=status.HTTP_200_OK)
def listar_turmas_professor(skip: int = 0, limit: int = 100, id_professor: int = None, db: Session = Depends(get_db)):
    
    professor = servico_professores.listar_professor(db=db, id_professor=id_professor)

    if not professor:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    
    return servico_turmas.listar_turmas_professor(db=db, id_professor=id_professor)

@router.get("/modalidade/{id_modalidade}", summary="Listar todas as turmas de uma modalidade", response_model=List[schemas.Turma], status_code=status.HTTP_200_OK)
def listar_turmas_modalidade(skip: int = 0, limit: int = 100, id_modalidade: int = None, db: Session = Depends(get_db)):
    
    modalidade = servico_modalidades.listar_modalidade(db=db, id_modalidade=id_modalidade)

    if not modalidade:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada")
    
    return servico_turmas.listar_turmas_modalidade(db=db, id_modalidade=id_modalidade)

@router.put("/{id_turma}", summary="Atualizar uma turma existente", response_model=schemas.Turma, status_code=status.HTTP_200_OK)
def atualizar_turma(id_turma: int, turma: schemas.TurmaCreate, db: Session = Depends(get_db)):
    db_turma = servico_turmas.atualizar_turma(db=db, id_turma=id_turma, turma_atualizada=turma)
    if not db_turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")
    return db_turma

@router.delete("/{id_turma}", summary="Excluir uma turma", status_code=status.HTTP_204_NO_CONTENT)
def excluir_turma(id_turma: int, db: Session = Depends(get_db)):

    try:
        sucesso = servico_turmas.excluir_turma(db=db, id_turma=id_turma)
        if not sucesso:
            raise HTTPException(status_code=404, detail="Turma não encontrada.")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Não é possivel excluir a turma, verifique se há dependências ativas.")
    return None