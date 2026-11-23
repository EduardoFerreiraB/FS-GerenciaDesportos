from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
from datetime import date
from database import get_db
import schemas
import models
from services import alunos as servico_alunos
from services import turmas as servico_turmas
from security import check_coordenador_role, get_current_active_user
from utils import validar_arquivo_upload, remover_arquivo_upload
import uuid
from pathlib import Path

router = APIRouter(
    prefix="/alunos",
    tags=["Alunos"],
)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"

CAMPOS_OPCIONAIS_ALUNO = ("nome_mae", "nome_pai", "telefone_2", "recomendacoes_medicas")
CAMPOS_OBRIGATORIOS_ALUNO = ("nome_completo", "data_nascimento", "escola", "serie_ano", "telefone_1", "endereco")


def _normalizar_opcional(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    if isinstance(valor, str) and valor.strip().lower() in ("", "null"):
        return None
    return valor


def _gravar_arquivo_validado(validado: Optional[Tuple[str, bytes]], subpasta: str) -> Optional[str]:
    if not validado:
        return None
    extensao, conteudo = validado
    diretorio = UPLOAD_DIR / subpasta
    diretorio.mkdir(parents=True, exist_ok=True)
    nome_arquivo = f"{uuid.uuid4()}.{extensao}"
    caminho_arquivo = diretorio / nome_arquivo
    with open(caminho_arquivo, "wb") as buffer:
        buffer.write(conteudo)
    return f"uploads/{subpasta}/{nome_arquivo}"


def _limpar_arquivos(caminhos: List[str]) -> None:
    for caminho in caminhos:
        remover_arquivo_upload(caminho, UPLOAD_DIR)


def salvar_arquivo(file: UploadFile, subpasta: str) -> Optional[str]:
    validado = validar_arquivo_upload(file, subpasta)
    return _gravar_arquivo_validado(validado, subpasta)


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
    ids_turmas: str = Form(...),
    foto: UploadFile = File(None),
    documento: UploadFile = File(None),
    atestado: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    try:
        lista_ids_turmas = [int(id.strip()) for id in ids_turmas.split(",") if id.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato inválido para ids_turmas. Use números separados por vírgula.")

    if not lista_ids_turmas:
        raise HTTPException(status_code=400, detail="Pelo menos uma turma deve ser selecionada.")

    for id_turma in lista_ids_turmas:
        turma = servico_turmas.listar_turma_id(db=db, id_turma=id_turma)
        if not turma:
            raise HTTPException(status_code=404, detail=f"Turma com ID {id_turma} não encontrada.")

    campos_faltantes = []
    if not documento or not documento.filename:
        campos_faltantes.append(
            {"loc": ["body", "documento"], "msg": "Documento pessoal é obrigatório.", "type": "missing"}
        )
    if not atestado or not atestado.filename:
        campos_faltantes.append(
            {"loc": ["body", "atestado"], "msg": "Atestado médico é obrigatório.", "type": "missing"}
        )
    if campos_faltantes:
        raise HTTPException(status_code=422, detail=campos_faltantes)

    # Validar todos os arquivos e o schema antes de gravar qualquer arquivo em disco
    foto_validada = validar_arquivo_upload(foto, "fotos")
    doc_validado = validar_arquivo_upload(documento, "documentos")
    atestado_validado = validar_arquivo_upload(atestado, "atestados")

    aluno_schema = schemas.AlunoCreate(
        nome_completo=nome_completo,
        data_nascimento=data_nascimento,
        escola=escola,
        serie_ano=serie_ano,
        nome_mae=_normalizar_opcional(nome_mae),
        nome_pai=_normalizar_opcional(nome_pai),
        telefone_1=telefone_1,
        telefone_2=_normalizar_opcional(telefone_2),
        endereco=endereco,
        recomendacoes_medicas=_normalizar_opcional(recomendacoes_medicas),
        ids_turmas=lista_ids_turmas
    )

    arquivos_salvos: List[str] = []
    try:
        foto_path = _gravar_arquivo_validado(foto_validada, "fotos")
        if foto_path:
            arquivos_salvos.append(foto_path)
        doc_path = _gravar_arquivo_validado(doc_validado, "documentos")
        if doc_path:
            arquivos_salvos.append(doc_path)
        atestado_path = _gravar_arquivo_validado(atestado_validado, "atestados")
        if atestado_path:
            arquivos_salvos.append(atestado_path)

        return servico_alunos.cadastrar_aluno(
            db=db,
            aluno=aluno_schema,
            foto=foto_path,
            documento=doc_path,
            atestado=atestado_path
        )
    except ValueError as e:
        _limpar_arquivos(arquivos_salvos)
        raise HTTPException(status_code=400, detail=str(e))
    except IntegrityError:
        _limpar_arquivos(arquivos_salvos)
        raise HTTPException(status_code=409, detail="Não foi possível concluir o cadastro por conflito de dados.")
    except Exception:
        _limpar_arquivos(arquivos_salvos)
        raise

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
        
        alunos = db.query(models.Aluno).join(models.Matricula).join(models.Turma).filter(
            models.Turma.id_professor == current_user.professores.id_professor,
            models.Matricula.ativo == True
        ).distinct().offset(skip).limit(limit).all()
        
        return alunos

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

@router.get("/{id_aluno}/exclusao/previa", summary="Prévia de exclusão de um aluno", response_model=schemas.PreviaExclusao, status_code=status.HTTP_200_OK)
def previa_exclusao_aluno(
    id_aluno: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_aluno = servico_alunos.listar_aluno(db=db, id_aluno=id_aluno)
    if not db_aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")

    ids_matriculas = [
        m.id_matricula
        for m in db.query(models.Matricula.id_matricula)
        .filter(models.Matricula.id_aluno == id_aluno)
        .all()
    ]
    total_presencas = (
        db.query(models.Presenca)
        .filter(models.Presenca.id_matricula.in_(ids_matriculas))
        .count()
        if ids_matriculas
        else 0
    )
    return schemas.PreviaExclusao(matriculas=len(ids_matriculas), presencas=total_presencas)

@router.put("/{id_aluno}", summary="Atualizar um aluno existente", response_model=schemas.Aluno, status_code=status.HTTP_200_OK)
def atualizar_aluno(
    id_aluno: int,
    nome_completo: Optional[str] = Form(None, max_length=500),
    data_nascimento: Optional[date] = Form(None),
    escola: Optional[str] = Form(None, max_length=100),
    serie_ano: Optional[str] = Form(None),
    nome_mae: Optional[str] = Form(None, max_length=500),
    nome_pai: Optional[str] = Form(None, max_length=500),
    telefone_1: Optional[str] = Form(None, max_length=20),
    telefone_2: Optional[str] = Form(None, max_length=20),
    endereco: Optional[str] = Form(None),
    recomendacoes_medicas: Optional[str] = Form(None),
    remover_foto: bool = Form(False),
    foto: UploadFile = File(None),
    documento: UploadFile = File(None),
    atestado: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_aluno_existente = servico_alunos.listar_aluno(db=db, id_aluno=id_aluno)
    if not db_aluno_existente:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")

    foto_anterior = db_aluno_existente.foto
    documento_anterior = db_aluno_existente.documento_pessoal
    atestado_anterior = db_aluno_existente.atestado_medico
    update_data = {}

    remover_foto_flag = bool(remover_foto)
    campos_form = {
        "nome_completo": nome_completo,
        "data_nascimento": data_nascimento,
        "escola": escola,
        "serie_ano": serie_ano,
        "telefone_1": telefone_1,
        "endereco": endereco,
    }
    for campo, valor in campos_form.items():
        if valor is not None:
            update_data[campo] = valor

    campos_opc_form = {
        "nome_mae": nome_mae,
        "nome_pai": nome_pai,
        "telefone_2": telefone_2,
        "recomendacoes_medicas": recomendacoes_medicas,
    }
    for campo, valor in campos_opc_form.items():
        if valor is not None:
            update_data[campo] = _normalizar_opcional(valor)

    foto_validada = validar_arquivo_upload(foto, "fotos")
    doc_validado = validar_arquivo_upload(documento, "documentos")
    atestado_validado = validar_arquivo_upload(atestado, "atestados")

    if remover_foto_flag and not foto_validada:
        update_data["foto"] = None

    aluno_update = schemas.AlunoUpdate(**update_data)

    arquivos_salvos: List[str] = []
    try:
        foto_path = _gravar_arquivo_validado(foto_validada, "fotos")
        if foto_path:
            arquivos_salvos.append(foto_path)
        doc_path = _gravar_arquivo_validado(doc_validado, "documentos")
        if doc_path:
            arquivos_salvos.append(doc_path)
        atestado_path = _gravar_arquivo_validado(atestado_validado, "atestados")
        if atestado_path:
            arquivos_salvos.append(atestado_path)

        db_aluno = servico_alunos.atualizar_aluno(
            db=db,
            id_aluno=id_aluno,
            aluno_atualizado=aluno_update,
            foto=foto_path,
            documento=doc_path,
            atestado=atestado_path
        )
    except IntegrityError:
        _limpar_arquivos(arquivos_salvos)
        raise HTTPException(status_code=409, detail="Não foi possível atualizar o aluno por conflito de dados.")
    except Exception:
        _limpar_arquivos(arquivos_salvos)
        raise

    if not db_aluno:
        _limpar_arquivos(arquivos_salvos)
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")

    if foto_anterior and (remover_foto_flag or foto_path) and foto_anterior != db_aluno.foto:
        remover_arquivo_upload(foto_anterior, UPLOAD_DIR)
    if documento_anterior and doc_path and documento_anterior != db_aluno.documento_pessoal:
        remover_arquivo_upload(documento_anterior, UPLOAD_DIR)
    if atestado_anterior and atestado_path and atestado_anterior != db_aluno.atestado_medico:
        remover_arquivo_upload(atestado_anterior, UPLOAD_DIR)

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