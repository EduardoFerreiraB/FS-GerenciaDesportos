from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
import models
from services import partidas as service_partidas
from security import check_coordenador_role, get_current_active_user

router = APIRouter(
    prefix="/partidas",
    tags=["Partidas"]
)

@router.post("/", summary="Criar (agendar) uma partida", response_model=schemas.Partida, status_code=status.HTTP_201_CREATED)
def criar_partida(
    partida: schemas.PartidaCreate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    try:
        return service_partidas.criar_partida(db=db, partida=partida)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/edicao/{id_edicao}", summary="Listar partidas de uma edição", response_model=List[schemas.Partida])
def listar_partidas_edicao(
    id_edicao: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    return service_partidas.listar_partidas_edicao(db=db, id_edicao=id_edicao)

@router.put("/{id_partida}", summary="Atualizar partida (resultado, status, etc)", response_model=schemas.Partida)
def atualizar_partida(
    id_partida: int, 
    partida_atualizada: schemas.PartidaUpdate, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    try:
        db_partida = service_partidas.atualizar_partida(db=db, id_partida=id_partida, partida_atualizada=partida_atualizada)
        if not db_partida:
            raise HTTPException(status_code=404, detail="Partida não encontrada.")
        return db_partida
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{id_partida}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_partida(
    id_partida: int, 
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    sucesso = service_partidas.excluir_partida(db=db, id_partida=id_partida)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")
    return None

import os
import uuid
from fastapi import UploadFile, File

@router.post("/{id_partida}/sumula", summary="Fazer upload da súmula da partida")
async def upload_sumula(
    id_partida: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_partida = service_partidas.listar_partida(db=db, id_partida=id_partida)
    if not db_partida:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")

    # 1. Validar extensão do arquivo
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".pdf"]:
        raise HTTPException(status_code=400, detail="Apenas arquivos .jpg, .jpeg, .png ou .pdf são permitidos.")

    # 2. Validar MIME-type
    allowed_content_types = ["image/jpeg", "image/png", "application/pdf"]
    if file.content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail="MIME-type inválido. Apenas imagens (JPEG, PNG) ou PDF são permitidos.")

    # 3. Salvar arquivo
    import pathlib
    base_dir = pathlib.Path(__file__).resolve().parent.parent.parent
    upload_dir = base_dir / "uploads" / "sumulas"
    upload_dir.mkdir(parents=True, exist_ok=True)

    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = upload_dir / unique_filename

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {str(e)}")

    # 4. Atualizar banco
    db_partida.sumula_arquivo = f"/uploads/sumulas/{unique_filename}"
    db.commit()
    db.refresh(db_partida)

    return {"sumula_arquivo": db_partida.sumula_arquivo}


@router.get("/{id_partida}/estatisticas", summary="Listar estatísticas da partida", response_model=List[schemas.EstatisticaPartidaResponse])
def listar_estatisticas_partida(
    id_partida: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    db_partida = service_partidas.listar_partida(db=db, id_partida=id_partida)
    if not db_partida:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")
    return db_partida.estatisticas


@router.post("/{id_partida}/estatisticas", summary="Registrar estatística de um jogador na partida", response_model=schemas.EstatisticaPartidaResponse, status_code=status.HTTP_201_CREATED)
def criar_estatistica_partida(
    id_partida: int,
    stat: schemas.EstatisticaPartidaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    # 1. Verificar se a partida existe
    db_partida = service_partidas.listar_partida(db=db, id_partida=id_partida)
    if not db_partida:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")

    # 2. Verificar se o participante existe
    participante = db.query(models.Participante).filter(models.Participante.id_participante == stat.id_participante).first()
    if not participante:
        raise HTTPException(status_code=404, detail="Participante não encontrado.")

    # 3. Validar se o participante está escalado em uma das duas equipes da partida
    equipes_ids = [db_partida.id_equipe_casa, db_partida.id_equipe_visitante]
    equipes_ids = [eid for eid in equipes_ids if eid is not None]
    
    esta_na_partida = False
    if equipes_ids:
        vinculo = db.execute(
            models.equipes_participantes.select().where(
                models.equipes_participantes.c.id_participante == stat.id_participante,
                models.equipes_participantes.c.id_equipe.in_(equipes_ids)
            )
        ).first()
        if vinculo:
            esta_na_partida = True

    if not esta_na_partida:
        raise HTTPException(
            status_code=400, 
            detail="O participante não pertence a nenhuma das equipes escaladas nesta partida."
        )

    # 4. Verificar se já existe estatística para este participante nesta partida
    estatistica_existente = db.query(models.EstatisticaPartida).filter(
        models.EstatisticaPartida.id_partida == id_partida,
        models.EstatisticaPartida.id_participante == stat.id_participante
    ).first()
    if estatistica_existente:
        raise HTTPException(
            status_code=400, 
            detail="Já existem estatísticas registradas para este participante nesta partida. Use a rota de atualização (PUT)."
        )

    # 5. Criar registro
    db_stat = models.EstatisticaPartida(
        id_partida=id_partida,
        **stat.model_dump()
    )
    db.add(db_stat)
    db.commit()
    db.refresh(db_stat)
    return db_stat


@router.put("/{id_partida}/estatisticas/{id_estatistica}", summary="Atualizar estatística de um jogador", response_model=schemas.EstatisticaPartidaResponse)
def atualizar_estatistica_partida(
    id_partida: int,
    id_estatistica: int,
    stat: schemas.EstatisticaPartidaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_stat = db.query(models.EstatisticaPartida).filter(
        models.EstatisticaPartida.id_estatistica == id_estatistica,
        models.EstatisticaPartida.id_partida == id_partida
    ).first()
    if not db_stat:
        raise HTTPException(status_code=404, detail="Estatística não encontrada para esta partida.")

    # Atualizar campos
    for key, val in stat.model_dump().items():
        setattr(db_stat, key, val)

    db.commit()
    db.refresh(db_stat)
    return db_stat


@router.delete("/{id_partida}/estatisticas/{id_estatistica}", summary="Remover estatística de um jogador", status_code=status.HTTP_204_NO_CONTENT)
def deletar_estatistica_partida(
    id_partida: int,
    id_estatistica: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_stat = db.query(models.EstatisticaPartida).filter(
        models.EstatisticaPartida.id_estatistica == id_estatistica,
        models.EstatisticaPartida.id_partida == id_partida
    ).first()
    if not db_stat:
        raise HTTPException(status_code=404, detail="Estatística não encontrada para esta partida.")

    db.delete(db_stat)
    db.commit()
    return None

