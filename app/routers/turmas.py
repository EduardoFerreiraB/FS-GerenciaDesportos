from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
import models
from services import turmas as servico_turmas
from services import professores as servico_professores
from services import modalidades as servico_modalidades
from security import check_coordenador_role, get_current_active_user

router = APIRouter(
    prefix="/turmas",
    tags=["Turmas"],
)

@router.post("/", summary="Criar uma nova turma", response_model=schemas.Turma, status_code=status.HTTP_201_CREATED)
def criar_turma(
    turma: schemas.TurmaCreate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):

    modalidade = servico_modalidades.listar_modalidade(db=db, id_modalidade=turma.id_modalidade)

    if not modalidade:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada.")
    
    professor = servico_professores.listar_professor(db=db, id_professor=turma.id_professor)

    if not professor:
        raise HTTPException(status_code=404, detail="Professor não encontrado.")
    
    return servico_turmas.criar_turma(db=db, turma=turma)

@router.get("/", summary="Listar todas as turmas", response_model=List[schemas.Turma], status_code=status.HTTP_200_OK)
def listar_turmas(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    # Se for professor, força o filtro pelo ID dele
    if current_user.role == "professor":
        if not current_user.professores:
            return [] # Professor sem cadastro vinculado não vê turmas
        return servico_turmas.listar_turmas_professor(db=db, id_professor=current_user.professores.id_professor)
    
    # Admin/Coordenador vê tudo
    return servico_turmas.listar_turmas(db=db, skip=skip, limit=limit)

@router.get("/{id_turma}", summary="Obter uma turma por ID", response_model=schemas.Turma, status_code=status.HTTP_200_OK)
def listar_turma(
    id_turma: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_turma = servico_turmas.listar_turma_id(db=db, id_turma=id_turma)
    if not db_turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    # Se for professor, valida se a turma é dele
    if current_user.role == "professor":
        if not current_user.professores or db_turma.id_professor != current_user.professores.id_professor:
            raise HTTPException(status_code=403, detail="Acesso negado: Essa turma não pertence a você.")

    return db_turma

@router.get("/professor/{id_professor}", summary="Listar todas as turmas de um professor pelo seu ID", response_model=List[schemas.Turma], status_code=status.HTTP_200_OK)
def listar_turmas_professor(
    skip: int = 0, 
    limit: int = 100, 
    id_professor: int = None, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    # Proteção: Professor só pode consultar seu próprio ID
    if current_user.role == "professor":
        if not current_user.professores or current_user.professores.id_professor != id_professor:
             raise HTTPException(status_code=403, detail="Acesso negado: Você só pode ver suas próprias turmas.")

    professor = servico_professores.listar_professor(db=db, id_professor=id_professor)

    if not professor:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    
    return servico_turmas.listar_turmas_professor(db=db, id_professor=id_professor)

@router.get("/modalidade/{id_modalidade}", summary="Listar todas as turmas de uma modalidade", response_model=List[schemas.Turma], status_code=status.HTTP_200_OK)
def listar_turmas_modalidade(
    skip: int = 0, 
    limit: int = 100, 
    id_modalidade: int = None, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    # Nota: Aqui deixamos aberto para professores consultarem modalidades, 
    # mas poderíamos filtrar também para retornar apenas turmas DELE naquela modalidade.
    # Por enquanto, vou manter o comportamento padrão de filtrar apenas pela modalidade,
    # mas se for crítico, podemos iterar sobre o resultado e filtrar.
    
    modalidade = servico_modalidades.listar_modalidade(db=db, id_modalidade=id_modalidade)

    if not modalidade:
        raise HTTPException(status_code=404, detail="Modalidade não encontrada")
    
    turmas = servico_turmas.listar_turmas_modalidade(db=db, id_modalidade=id_modalidade)

    # Filtro adicional para professor
    if current_user.role == "professor" and current_user.professores:
        turmas = [t for t in turmas if t.id_professor == current_user.professores.id_professor]

    return turmas

@router.put("/{id_turma}", summary="Atualizar uma turma existente", response_model=schemas.Turma, status_code=status.HTTP_200_OK)
def atualizar_turma(
    id_turma: int, 
    turma: schemas.TurmaUpdate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_turma = servico_turmas.listar_turma_id(db=db, id_turma=id_turma)
    if not db_turma:
        raise HTTPException(status_code=404, detail="Turma não encontrada.")

    # Se for professor, valida se a turma é dele
    if current_user.role == "professor":
        if not current_user.professores or db_turma.id_professor != current_user.professores.id_professor:
            raise HTTPException(status_code=403, detail="Acesso negado: Você não pode alterar turmas que não são suas.")

    return servico_turmas.atualizar_turma(db=db, id_turma=id_turma, turma_atualizada=turma)

@router.delete("/{id_turma}", summary="Excluir uma turma", status_code=status.HTTP_204_NO_CONTENT)
def excluir_turma(
    id_turma: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    from sqlalchemy.exc import IntegrityError
    try:
        sucesso = servico_turmas.excluir_turma(db=db, id_turma=id_turma)
        if not sucesso:
            raise HTTPException(status_code=404, detail="Turma não encontrada.")
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Não é possível excluir a turma, verifique se há dependências ativas (matrículas).")
    return None