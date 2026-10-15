"""Router for Confronto domain operations."""

import os
from pathlib import Path
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from security import check_coordenador_role, get_current_active_user
from services import competicoes as competicao_service
from services import confrontos as confronto_service


router = APIRouter(tags=["Confrontos"])


@router.post(
    "/competicoes/{id_competicao}/confrontos",
    response_model=schemas.Confronto,
    status_code=status.HTTP_201_CREATED,
    summary="Criar confronto em uma competição",
)
def criar_confronto(
    id_competicao: int,
    confronto: schemas.ConfrontoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    comp = competicao_service.listar_competicao(db, id_competicao)
    if not comp:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    if comp.modo_inscricao == "INDIVIDUAL":
        raise HTTPException(status_code=422, detail="Operações de confronto só são permitidas para competições em modo EQUIPE.")

    try:
        return confronto_service.criar_confronto(db, id_competicao, confronto)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get(
    "/competicoes/{id_competicao}/confrontos",
    response_model=List[schemas.Confronto],
    summary="Listar confrontos de uma competição",
)
def listar_confrontos_competicao(
    id_competicao: int,
    fase: Optional[str] = None,
    rodada: Optional[int] = None,
    grupo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    comp = competicao_service.listar_competicao(db, id_competicao)
    if not comp:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    if comp.modo_inscricao == "INDIVIDUAL":
        raise HTTPException(status_code=422, detail="Operações de confronto só são permitidas para competições em modo EQUIPE.")

    return confronto_service.listar_confrontos_competicao(db, id_competicao, fase, rodada, grupo)


@router.get(
    "/confrontos/{id_confronto}",
    response_model=schemas.Confronto,
    summary="Obter detalhes de um confronto",
)
def obter_confronto(
    id_confronto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    confronto = confronto_service.obter_confronto(db, id_confronto)
    if not confronto:
        raise HTTPException(status_code=404, detail="Confronto não encontrado.")
    return confronto


@router.put(
    "/confrontos/{id_confronto}",
    response_model=schemas.Confronto,
    summary="Atualizar confronto",
)
def atualizar_confronto(
    id_confronto: int,
    confronto_atualizado: schemas.ConfrontoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    confronto = confronto_service.obter_confronto(db, id_confronto)
    if not confronto:
        raise HTTPException(status_code=404, detail="Confronto não encontrado.")

    try:
        return confronto_service.atualizar_confronto(db, id_confronto, confronto_atualizado)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.delete(
    "/confrontos/{id_confronto}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir confronto não iniciado",
)
def excluir_confronto(
    id_confronto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    confronto = confronto_service.obter_confronto(db, id_confronto)
    if not confronto:
        raise HTTPException(status_code=404, detail="Confronto não encontrado.")

    try:
        confronto_service.excluir_confronto(db, id_confronto)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return None


@router.post(
    "/confrontos/{id_confronto}/sumula",
    summary="Fazer upload da súmula do confronto",
)
async def upload_sumula_confronto(
    id_confronto: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    confronto = confronto_service.obter_confronto(db, id_confronto)
    if not confronto:
        raise HTTPException(status_code=404, detail="Confronto não encontrado.")

    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".pdf"]:
        raise HTTPException(status_code=400, detail="Apenas arquivos .jpg, .jpeg, .png ou .pdf são permitidos.")

    allowed_content_types = ["image/jpeg", "image/png", "application/pdf"]
    if file.content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail="MIME-type inválido. Apenas imagens (JPEG, PNG) ou PDF são permitidos.")

    base_dir = Path(__file__).resolve().parent.parent.parent
    upload_dir = base_dir / "uploads" / "sumulas"
    upload_dir.mkdir(parents=True, exist_ok=True)

    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = upload_dir / unique_filename

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {str(exc)}")

    confronto.sumula_arquivo = f"/uploads/sumulas/{unique_filename}"
    db.commit()
    db.refresh(confronto)
    return {"sumula_arquivo": confronto.sumula_arquivo}


@router.post(
    "/competicoes/{id_competicao}/gerar-confrontos",
    response_model=List[schemas.Confronto],
    summary="Gerar confrontos automaticamente para a competição",
)
def gerar_confrontos(
    id_competicao: int,
    params: Optional[schemas.GerarConfrontosCompeticaoRequest] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    comp = competicao_service.listar_competicao(db, id_competicao)
    if not comp:
        raise HTTPException(status_code=404, detail="Competição não encontrada.")
    if comp.modo_inscricao == "INDIVIDUAL":
        raise HTTPException(status_code=422, detail="Não é possível gerar confrontos para competição em modo INDIVIDUAL.")

    try:
        return confronto_service.gerar_confrontos(db, id_competicao, params)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
