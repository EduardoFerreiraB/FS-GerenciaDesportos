from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
import models
from services import professores as servico_professores
from security import check_coordenador_role, get_current_active_user
from utils import validar_cpf

router = APIRouter(
    prefix="/professores",
    tags=["Professores"],
)

@router.post("/", summary="Criar um novo professor", response_model=schemas.ProfessorCreatedResponse, status_code=status.HTTP_201_CREATED)
def criar_professor(
    professor: schemas.ProfessorCreate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    # 1. Validar CPF estruturalmente
    if not validar_cpf(professor.cpf):
        raise HTTPException(status_code=400, detail="CPF inválido. Certifique-se de que o número está correto.")

    # 2. Verificar se CPF já está cadastrado
    professor_existente = servico_professores.listar_professor_cpf(db, cpf=professor.cpf)
    if professor_existente:
        raise HTTPException(status_code=400, detail="Este CPF já está cadastrado para outro professor.")
    
    # 3. Verificar se o username já está em uso
    usuario_existente = db.query(models.Usuario).filter(models.Usuario.username == professor.username).first()
    if usuario_existente:
        raise HTTPException(status_code=400, detail="Este nome de usuário já está sendo utilizado.")

    try:
        return servico_professores.criar_professor(db=db, professor=professor)
    except Exception as e:
        # Tratar outros erros genéricos ou específicos que possam ocorrer
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao cadastrar professor: {str(e)}")

@router.get("/", summary="Listar todos os professores", response_model=List[schemas.Professor], status_code=status.HTTP_200_OK)
def listar_professores(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    return servico_professores.listar_professores(db=db, skip=skip, limit=limit)

@router.get("/{id_professor}", summary="Obter um professor por ID", response_model=schemas.Professor, status_code=status.HTTP_200_OK)
def listar_professor(
    id_professor: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    if current_user.role == "professor":
        if not current_user.professores or current_user.professores.id_professor != id_professor:
            raise HTTPException(status_code=403, detail="Acesso negado: Você só pode visualizar seu próprio perfil")

    db_professor = servico_professores.listar_professor(db=db, id_professor=id_professor)

    if not db_professor:
        raise HTTPException(status_code=404, detail="Professor não encontrado.")
    return db_professor

@router.get("/buscar/cpf/{cpf}", summary="Obter professor por CPF", response_model=schemas.Professor, status_code=status.HTTP_200_OK)
def obter_professor_cpf(
    cpf: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_professor = servico_professores.listar_professor_cpf(db, cpf=cpf)
    if not db_professor:
        raise HTTPException(status_code=404, detail="Professor não encontrado com este CPF.")
    return db_professor

@router.put("/{id_professor}", summary="Atualizar um professor existente", response_model=schemas.Professor, status_code=status.HTTP_200_OK)
def atualizar_professor(
    id_professor: int, 
    professor_atualizado: schemas.ProfessorUpdate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    if current_user.role == "professor":
        if not current_user.professores or current_user.professores.id_professor != id_professor:
            raise HTTPException(status_code=403, detail="Acesso negado: Você só pode editar seu próprio perfil")

    # Se estiver tentando atualizar o CPF, validar
    if professor_atualizado.cpf:
        if not validar_cpf(professor_atualizado.cpf):
             raise HTTPException(status_code=400, detail="CPF inválido.")
        
        professor_existente = servico_professores.listar_professor_cpf(db, cpf=professor_atualizado.cpf)
        if professor_existente and professor_existente.id_professor != id_professor:
            raise HTTPException(status_code=400, detail="Este CPF já está cadastrado para outro professor.")

    db_professor = servico_professores.atualizar_professor(db=db, id_professor=id_professor, professor_atualizado=professor_atualizado)

    if not db_professor:
        raise HTTPException(status_code=404, detail="Professor não encontrado.")
    return db_professor

@router.delete("/{id_professor}", summary="Excluir um professor", status_code=status.HTTP_204_NO_CONTENT)
def excluir_professor(
    id_professor: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    from sqlalchemy.exc import IntegrityError
    try:
        sucesso = servico_professores.excluir_professor(db=db, id_professor=id_professor)
        if not sucesso:
            raise HTTPException(status_code=404, detail="Professor não encontrado.")
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Não é possível excluir o professor, verifique se ele tem turmas ativas.")
    
    return None