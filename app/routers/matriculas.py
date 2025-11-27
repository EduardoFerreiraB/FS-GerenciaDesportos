from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import schemas
from services import alunos as servico_alunos
from services import turmas as servico_turmas
from services import matriculas as servico_matriculas

router = APIRouter(
    prefix="/matriculas",
    tags=["Matrículas"],
)

@router.post("/", summary="Criar uma nova matrícula", response_model=schemas.Matricula, status_code=status.HTTP_201_CREATED)
def realizar_matricula(matricula: schemas.MatriculaCreate, db: Session = Depends(get_db)):
    aluno = servico_alunos.listar_aluno(db=db, id_aluno=matricula.id_aluno)
    
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    
    turma = servico_turmas.listar_turma_id(db=db, id_turma=matricula.id_turma)
    if not turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")
    
    matricula_existente = servico_matriculas.verificar_matricula(db=db, id_aluno=matricula.id_aluno, id_turma=matricula.id_turma)
    if matricula_existente:
        raise HTTPException(status_code=400, detail="Matrícula já existe para este aluno e turma.")
    
    try:
        return servico_matriculas.criar_matricula(db=db, matricula=matricula)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@router.get("/", summary="Listar todas as matrículas", response_model=List[schemas.Matricula], status_code=status.HTTP_200_OK)
def listar_matriculas(skip: int = 0, limit: int = 100, turma_id: Optional[int] = None, aluno_id: Optional[int] = None, db: Session = Depends(get_db)):
    if turma_id:
        return servico_matriculas.listar_matriculas_turma(db=db, id_turma=turma_id)
    
    if aluno_id:
        return servico_matriculas.listar_matriculas_aluno(db=db, id_aluno=aluno_id)
    
    return servico_matriculas.listar_matriculas(db=db, skip=skip, limit=limit)

@router.delete("/{id_matricula}", summary="Cancelar uma matrícula", status_code=status.HTTP_204_NO_CONTENT)
def cancelar_matricula(id_matricula: int, db: Session = Depends(get_db)):
    sucesso = servico_matriculas.cancelar_matricula(db=db, id_matricula=id_matricula)

    if not sucesso:
        raise HTTPException(status_code=404, detail="Matrícula não encontrada.")
    return None
