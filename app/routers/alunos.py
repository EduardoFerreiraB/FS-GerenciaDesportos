from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
from services import alunos as servico_alunos
from services import turmas as servico_turmas

router = APIRouter(
    prefix="/alunos",
    tags=["Alunos"],
)

@router.post("/", summary="Cadastrar um novo aluno", response_model=schemas.Aluno, status_code=status.HTTP_201_CREATED)
def criar_aluno(aluno: schemas.AlunoCreate, db: Session = Depends(get_db)):
    turma = servico_turmas.listar_turma_id(db=db, id_turma=aluno.id_turma)
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    return servico_alunos.cadastrar_aluno(db=db, aluno=aluno)

@router.get("/", summary="Listar todos os alunos", response_model=List[schemas.Aluno], status_code=status.HTTP_200_OK)
def listar_alunos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return servico_alunos.listar_alunos(db=db, skip=skip, limit=limit)

@router.get("/{id_aluno}", summary="Obter um aluno por ID", response_model=schemas.Aluno, status_code=status.HTTP_200_OK)
def listar_aluno(id_aluno: int, db: Session = Depends(get_db)):
    db_aluno = servico_alunos.listar_aluno(db=db, id_aluno=id_aluno)
    if not db_aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    return db_aluno

@router.get("/buscar/nome/{nome}", summary="Buscar alunos por nome", response_model=List[schemas.Aluno], status_code=status.HTTP_200_OK)
def buscar_alunos_por_nome(skip: int = 0, limit: int = 100, nome: str = None, db: Session = Depends(get_db)):
    return servico_alunos.listar_alunos_nome(db=db, nome=nome)

@router.get("/buscar/escola/{escola}", summary="Buscar alunos por escola", response_model=List[schemas.Aluno], status_code=status.HTTP_200_OK)
def buscar_alunos_por_escola(skip: int = 0, limit: int = 100, escola: str = None, db: Session = Depends(get_db)):
    return servico_alunos.listar_alunos_escola(db=db, escola=escola)

@router.get("/buscar/serie/{serie_ano}", summary="Buscar alunos por série/ano", response_model=List[schemas.Aluno], status_code=status.HTTP_200_OK)
def buscar_alunos_por_serie(skip: int = 0, limit: int = 100, serie_ano: str = None, db: Session = Depends(get_db)):
    return servico_alunos.listar_alunos_serie(db=db, serie_ano=serie_ano)

@router.put("/{id_aluno}", summary="Atualizar um aluno existente", response_model=schemas.Aluno, status_code=status.HTTP_200_OK)
def atualizar_aluno(id_aluno: int, aluno: schemas.AlunoCreate, db: Session = Depends(get_db)):
    db_aluno = servico_alunos.atualizar_aluno(db=db, id_aluno=id_aluno, aluno_atualizado=aluno)
    if not db_aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    return db_aluno

@router.delete("/{id_aluno}", summary="Excluir um aluno", status_code=status.HTTP_204_NO_CONTENT)
def excluir_aluno(id_aluno: int, db: Session = Depends(get_db)):
    try:
        sucesso = servico_alunos.excluir_aluno(db=db, id_aluno=id_aluno)
        if not sucesso:
            raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Não é possivel excluir este aluno. Verifique se ele está matriculado em alguma turma."
        )
    return None