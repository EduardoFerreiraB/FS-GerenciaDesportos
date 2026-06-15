from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from database import get_db
import schemas
import models
from services import atletas as service_atletas
from services import equipes as service_equipes
from security import check_coordenador_role
import shutil
import uuid
from pathlib import Path

router = APIRouter(
    prefix="/atletas",
    tags=["Atletas Externos"],
)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"

def salvar_foto_atleta(file: UploadFile) -> Optional[str]:
    if not file or not file.filename:
        return None
    
    extensao = file.filename.split(".")[-1].lower()
    if extensao not in {"jpg", "jpeg", "png"}:
        raise HTTPException(status_code=400, detail=f"Extensão de arquivo '.{extensao}' não é permitida. Use apenas JPG, JPEG ou PNG para fotos.")
        
    if file.content_type not in {"image/jpeg", "image/png", "image/jpg"}:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não permitido. Use apenas imagens (JPG/PNG) para fotos.")

    diretorio = UPLOAD_DIR / "atletas"
    diretorio.mkdir(parents=True, exist_ok=True)

    nome_arquivo = f"{uuid.uuid4()}.{extensao}"
    caminho_arquivo = diretorio / nome_arquivo

    with open(caminho_arquivo, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return str(Path("uploads") / "atletas" / nome_arquivo)

@router.post("/equipe/{id_equipe}", summary="Cadastrar atleta e vincular a uma equipe", response_model=schemas.Atleta)
def cadastrar_atleta_na_equipe(
    id_equipe: int,
    nome_completo: str = Form(...),
    data_nascimento: date = Form(...),
    documento_pessoal: str = Form(...),
    contato: Optional[str] = Form(None),
    endereco: Optional[str] = Form(None),
    foto: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    equipe = service_equipes.listar_equipe(db, id_equipe)
    if not equipe:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")

    foto_path = salvar_foto_atleta(foto)

    atleta_schema = schemas.AtletaCreate(
        nome_completo=nome_completo,
        data_nascimento=data_nascimento,
        documento_pessoal=documento_pessoal,
        contato=contato,
        endereco=endereco
    )

    try:
        return service_atletas.criar_atleta_equipe(
            db=db, 
            atleta=atleta_schema, 
            id_equipe=id_equipe, 
            foto=foto_path
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[schemas.Atleta])
def listar_atletas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return service_atletas.listar_atletas(db, skip=skip, limit=limit)

@router.get("/{id_atleta}", response_model=schemas.Atleta)
def obter_atleta(id_atleta: int, db: Session = Depends(get_db)):
    atleta = service_atletas.listar_atleta(db, id_atleta)
    if not atleta:
        raise HTTPException(status_code=404, detail="Atleta não encontrado.")
    return atleta

@router.delete("/{id_atleta}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_atleta(id_atleta: int, db: Session = Depends(get_db), current_user: models.Usuario = Depends(check_coordenador_role)):
    sucesso = service_atletas.excluir_atleta(db, id_atleta)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Atleta não encontrado.")
    return None
