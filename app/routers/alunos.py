from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from database import get_db
import schemas
import models
from services import alunos as servico_alunos
from services import turmas as servico_turmas
from security import check_coordenador_role, get_current_active_user
import os
import shutil
import uuid
from pathlib import Path

router = APIRouter(
    prefix="/alunos",
    tags=["Alunos"],
)

# Define o diretório base como a raiz do projeto
# Arquivo está em: app/routers/alunos.py
# .parent -> app/routers
# .parent.parent -> app
# .parent.parent.parent -> raiz
BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"

def salvar_arquivo(file: UploadFile, subpasta: str) -> str:
    if not file:
        return None
    

    diretorio = UPLOAD_DIR / subpasta
    diretorio.mkdir(parents=True, exist_ok=True)

    extensao = file.filename.split(".")[-1]
    nome_arquivo = f"{uuid.uuid4()}.{extensao}"
    caminho_arquivo = diretorio / nome_arquivo

    with open(caminho_arquivo, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return str(Path("uploads") / subpasta / nome_arquivo)

@router.post("/", summary="Cadastrar um novo aluno", response_model=schemas.Aluno, status_code=status.HTTP_201_CREATED)
def criar_aluno(
    nome_completo: str = Form(..., max_length=500),
    data_nascimento: date = Form(...),
    escola: Optional[str] = Form(None, max_length=100),
    serie_ano: Optional[str] = Form(None),
    nome_mae: Optional[str] = Form(None, max_length=500),
    nome_pai: Optional[str] = Form(None, max_length=500),
    telefone_1: Optional[str] = Form(None, max_length=20),
    telefone_2: Optional[str] = Form(None, max_length=20),
    endereco: Optional[str] = Form(None),
    recomendacoes_medicas: Optional[str] = Form(None),
    ids_turmas: str = Form(..., description="IDs das turmas separados por vírgula (ex: 1,2,5)"),
    foto: UploadFile = File(None),
    documento: UploadFile = File(None),
    atestado: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    # Processa a string de IDs vinda do Form (ex: "1,2,3")
    try:
        lista_ids_turmas = [int(id.strip()) for id in ids_turmas.split(",") if id.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato inválido para ids_turmas. Use números separados por vírgula.")

    if not lista_ids_turmas:
        raise HTTPException(status_code=400, detail="Pelo menos uma turma deve ser selecionada.")

    # Validar se as turmas existem
    for id_turma in lista_ids_turmas:
        turma = servico_turmas.listar_turma_id(db=db, id_turma=id_turma)
        if not turma:
            raise HTTPException(status_code=404, detail=f"Turma com ID {id_turma} não encontrada.")

    # Salva os arquivos e pega os caminhos de onde foram salvos
    foto_path = salvar_arquivo(foto, "fotos")
    doc_path = salvar_arquivo(documento, "documentos")
    atestado_path = salvar_arquivo(atestado, "atestados")

    # DTO dos dados que vieram do Form
    aluno_schema = schemas.AlunoCreate(
        nome_completo=nome_completo,
        data_nascimento=data_nascimento,
        escola=escola,
        serie_ano=serie_ano,
        nome_mae=nome_mae,
        nome_pai=nome_pai,
        telefone_1=telefone_1,
        telefone_2=telefone_2,
        endereco=endereco,
        recomendacoes_medicas=recomendacoes_medicas,
        ids_turmas=lista_ids_turmas
    )

    return servico_alunos.cadastrar_aluno(
        db=db, 
        aluno=aluno_schema, 
        foto=foto_path, 
        documento=doc_path, 
        atestado=atestado_path
    )

@router.get("/", summary="Listar todos os alunos", response_model=List[schemas.Aluno], status_code=status.HTTP_200_OK)
def listar_alunos(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    
    if current_user.role == "professor":
        if not current_user.professores:
            return []
        
        turmas_professor = servico_turmas.listar_turmas_professor(db=db, id_professor=current_user.professores.id_professor)
        
        alunos_filtrados = []
        ids_alunos = set()
        
        for turma in turmas_professor:
            alunos_turma = servico_alunos.listar_alunos_por_turma(db=db, id_turma=turma.id_turma)
            for aluno in alunos_turma:
                if aluno.id_aluno not in ids_alunos:
                    alunos_filtrados.append(aluno)
                    ids_alunos.add(aluno.id_aluno)
        
        return alunos_filtrados

    return servico_alunos.listar_alunos(db=db, skip=skip, limit=limit)

@router.get("/{id_aluno}", summary="Obter um aluno por ID", response_model=schemas.Aluno, status_code=status.HTTP_200_OK)
def listar_aluno(
    id_aluno: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_aluno = servico_alunos.listar_aluno(db=db, id_aluno=id_aluno)
    if not db_aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")

    if current_user.role == "professor":
        tem_permissao = False
        if current_user.professores:
             for matricula in db_aluno.matriculas:
                 if matricula.turma.id_professor == current_user.professores.id_professor:
                     tem_permissao = True
                     break
        
        if not tem_permissao:
            raise HTTPException(status_code=403, detail="Acesso negado: Aluno não pertence a nenhuma de suas turmas.")

    return db_aluno

@router.get("/buscar/nome/{nome}", summary="Buscar alunos por nome", response_model=List[schemas.Aluno], status_code=status.HTTP_200_OK)
def buscar_alunos_por_nome(
    nome: str,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    alunos = servico_alunos.listar_alunos_nome(db=db, nome=nome)
    
    if current_user.role == "professor":
         if not current_user.professores:
            return []
         
         ids_turmas_prof = [t.id_turma for t in servico_turmas.listar_turmas_professor(db=db, id_professor=current_user.professores.id_professor)]
         
         alunos_filtrados = []
         for aluno in alunos:
             for matricula in aluno.matriculas:
                 if matricula.id_turma in ids_turmas_prof:
                     alunos_filtrados.append(aluno)
                     break
         return alunos_filtrados

    return alunos

@router.get("/buscar/escola/{escola}", summary="Buscar alunos por escola", response_model=List[schemas.Aluno], status_code=status.HTTP_200_OK)
def buscar_alunos_por_escola(
    escola: str,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    alunos = servico_alunos.listar_alunos_escola(db=db, escola=escola)
    
    if current_user.role == "professor":
         if not current_user.professores:
            return []
         ids_turmas_prof = [t.id_turma for t in servico_turmas.listar_turmas_professor(db=db, id_professor=current_user.professores.id_professor)]
         alunos_filtrados = [aluno for aluno in alunos if any(m.id_turma in ids_turmas_prof for m in aluno.matriculas)]
         return alunos_filtrados

    return alunos

@router.get("/buscar/serie/{serie_ano}", summary="Buscar alunos por série/ano", response_model=List[schemas.Aluno], status_code=status.HTTP_200_OK)
def buscar_alunos_por_serie(
    serie_ano: str,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    alunos = servico_alunos.listar_alunos_serie(db=db, serie_ano=serie_ano)
    
    if current_user.role == "professor":
         if not current_user.professores:
            return []
         ids_turmas_prof = [t.id_turma for t in servico_turmas.listar_turmas_professor(db=db, id_professor=current_user.professores.id_professor)]
         alunos_filtrados = [aluno for aluno in alunos if any(m.id_turma in ids_turmas_prof for m in aluno.matriculas)]
         return alunos_filtrados

    return alunos

@router.put("/{id_aluno}", summary="Atualizar um aluno existente", response_model=schemas.Aluno, status_code=status.HTTP_200_OK)
def atualizar_aluno(
    id_aluno: int, 
    aluno: schemas.AlunoUpdate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_aluno = servico_alunos.atualizar_aluno(db=db, id_aluno=id_aluno, aluno_atualizado=aluno)
    if not db_aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    return db_aluno

@router.delete("/{id_aluno}", summary="Excluir um aluno", status_code=status.HTTP_204_NO_CONTENT)
def excluir_aluno(
    id_aluno: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    from sqlalchemy.exc import IntegrityError
    try:
        sucesso = servico_alunos.excluir_aluno(db=db, id_aluno=id_aluno)
        if not sucesso:
            raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    except IntegrityError:
         raise HTTPException(
            status_code=400,
            detail="Não é possível excluir este aluno pois ele possui registros vinculados (matrículas, presenças, etc)."
        )
    return None