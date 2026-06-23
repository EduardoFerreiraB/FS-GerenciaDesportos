from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
import models
from services import edicoes as edicao_service
from services import eventos as evento_service
from security import check_coordenador_role, get_current_active_user

router = APIRouter(
    prefix="/edicoes",
    tags=["Edições"]
)

@router.post("/", summary="Criar uma nova edição", response_model=schemas.Edicao, status_code=status.HTTP_201_CREATED)
def criar_edicao(
    edicao: schemas.EdicaoCreate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    evento = evento_service.listar_evento(db=db, id_evento=edicao.id_evento)
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado para associar à edição.")
    return edicao_service.criar_edicao(db=db, edicao=edicao)

@router.get("/", summary="Listar todas as edições", response_model=List[schemas.Edicao], status_code=status.HTTP_200_OK)
def listar_edicoes(
    skip: int = 0, 
    limit: int = 10, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    return edicao_service.listar_edicoes(db=db, skip=skip, limit=limit)

@router.get("/{edicao_id}", summary="Obter uma edição por ID", response_model=schemas.Edicao, status_code=status.HTTP_200_OK)
def listar_edicao(
    edicao_id: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_edicao = edicao_service.listar_edicao_id(db=db, edicao_id=edicao_id)

    if not db_edicao:
        raise HTTPException(status_code=404, detail="Edição não encontrada.")
    return db_edicao

@router.put("/{edicao_id}", summary="Atualizar uma edição existente", response_model=schemas.Edicao, status_code=status.HTTP_200_OK)
def atualizar_edicao(
    edicao_id: int, 
    edicao_atualizada: schemas.EdicaoCreate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_edicao = edicao_service.atualizar_edicao(db=db, edicao_id=edicao_id, edicao_atualizada=edicao_atualizada)

    if not db_edicao:
        raise HTTPException(status_code=404, detail="Edição não encontrada.")
    return db_edicao

@router.delete("/{edicao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_edicao(
    edicao_id: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    sucesso = edicao_service.excluir_edicao(db=db, id_edicao=edicao_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Edição não encontrada.")
    return None

@router.post("/{edicao_id}/clonar-equipes", summary="Clonar equipes de uma edição anterior")
def clonar_equipes(
    edicao_id: int, 
    edicao_origem_id: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    try:
        equipes = edicao_service.clonar_equipes(db, id_edicao_origem=edicao_origem_id, id_edicao_destino=edicao_id)
        return {"message": f"{len(equipes)} equipes clonadas com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{edicao_id}/gerar-confrontos", summary="Gerar confrontos automaticamente para a edição")
def gerar_confrontos(
    edicao_id: int,
    req: schemas.GerarConfrontosRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    try:
        partidas = edicao_service.gerar_confrontos_edicao(
            db=db,
            edicao_id=edicao_id,
            id_modalidade=req.id_modalidade,
            part_hora=req.part_hora
        )
        return {"message": f"{len(partidas)} partidas geradas com sucesso."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))