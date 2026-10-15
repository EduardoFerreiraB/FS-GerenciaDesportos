"""Roteador para endpoints públicos de competições, equipes, confrontos e classificação (Passo 7)."""

from datetime import date, time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session, selectinload

from database import get_db
import models
from services.classificacao_equipes import (
    calcular_classificacao_equipes,
    CompeticaoNaoEncontradaError,
    ModoCompeticaoInvalidoError,
)
from services.classificacao_individuais import (
    calcular_classificacao_individual_competicao,
)
from services.confrontos import listar_confrontos_competicao

router = APIRouter(
    prefix="/publico",
    tags=["Público - Competições e Equipes"],
)


# ============================================================================
# Schemas Públicos (Segurança e Omissão de Dados Pessoais)
# ============================================================================

class ModalidadePublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_modalidade: int
    nome: str
    descricao: Optional[str] = None
    duracao_minutos: Optional[int] = None


class CompeticaoPublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_competicao: int
    id_edicao: int
    id_modalidade: int
    nome: str
    categoria: str
    modo_inscricao: Optional[str] = None
    formato: Optional[str] = None
    criterio_resultado: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    status: str
    regras: Optional[str] = None
    modalidade: Optional[ModalidadePublica] = None


class JogadorPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_participante: int
    nome_completo: str


class EquipePublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_equipe: int
    nome: str
    id_competicao: Optional[int] = None
    grupo: Optional[str] = None
    jogadores: List[JogadorPublico] = []


class LocalPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_local: int
    loca_nome: str
    loca_descricao: Optional[str] = None


class ArbitroPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_arbitro: int
    apito_nome: str


class EquipeSimplesPublica(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_equipe: int
    nome: str


class ConfrontoPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_confronto: int
    id_competicao: int
    fase: Optional[str] = None
    rodada: Optional[int] = None
    grupo: Optional[str] = None
    data: date
    hora: time
    id_local: int
    local: Optional[LocalPublico] = None
    id_arbitro: int
    arbitro: Optional[ArbitroPublico] = None
    id_equipe_mandante: Optional[int] = None
    equipe_mandante: Optional[EquipeSimplesPublica] = None
    id_equipe_visitante: Optional[int] = None
    equipe_visitante: Optional[EquipeSimplesPublica] = None
    placar_mandante: int = 0
    placar_visitante: int = 0
    status: str
    sumula_arquivo: Optional[str] = None
    observacoes: Optional[str] = None


# ============================================================================
# Endpoints Públicos de Hierarquia e Competições
# ============================================================================

@router.get(
    "/edicoes/{id_edicao}/competicoes",
    response_model=List[CompeticaoPublica],
    summary="Listar competições públicas de uma edição",
)
def listar_competicoes_publicas_edicao(
    id_edicao: int,
    db: Session = Depends(get_db),
):
    edicao = db.query(models.Edicao).filter(models.Edicao.id_edicao == id_edicao).first()
    if not edicao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Edição não encontrada.",
        )

    competicoes = (
        db.query(models.Competicao)
        .options(selectinload(models.Competicao.modalidade))
        .filter(
            models.Competicao.id_edicao == id_edicao,
            models.Competicao.status != "RASCUNHO",
        )
        .order_by(models.Competicao.id_competicao)
        .all()
    )
    return competicoes


@router.get(
    "/competicoes/{id_competicao}",
    response_model=CompeticaoPublica,
    summary="Obter detalhes públicos de uma competição",
)
def obter_competicao_publica(
    id_competicao: int,
    db: Session = Depends(get_db),
):
    comp = (
        db.query(models.Competicao)
        .options(selectinload(models.Competicao.modalidade))
        .filter(
            models.Competicao.id_competicao == id_competicao,
            models.Competicao.status != "RASCUNHO",
        )
        .first()
    )
    if not comp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competição não encontrada.",
        )
    return comp


# ============================================================================
# Endpoints Públicos de Equipes e Jogadores
# ============================================================================

@router.get(
    "/competicoes/{id_competicao}/equipes",
    response_model=List[EquipePublica],
    summary="Listar equipes públicas e seus jogadores",
)
def listar_equipes_publicas_competicao(
    id_competicao: int,
    db: Session = Depends(get_db),
):
    comp = (
        db.query(models.Competicao)
        .filter(
            models.Competicao.id_competicao == id_competicao,
            models.Competicao.status != "RASCUNHO",
        )
        .first()
    )
    if not comp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competição não encontrada.",
        )

    if comp.modo_inscricao != "EQUIPE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Operação permitida apenas para competições em modo EQUIPE.",
        )

    equipes = (
        db.query(models.Equipe)
        .filter(models.Equipe.id_competicao == id_competicao)
        .options(
            selectinload(models.Equipe.participantes).selectinload(models.Participante.aluno),
            selectinload(models.Equipe.participantes).selectinload(models.Participante.atleta),
        )
        .order_by(models.Equipe.id_equipe)
        .all()
    )

    resultado: List[EquipePublica] = []
    for eq in equipes:
        jogadores: List[JogadorPublico] = []
        for part in eq.participantes:
            nome = "Jogador Desconhecido"
            if part.tipo == "aluno" and part.aluno:
                nome = part.aluno.nome_completo
            elif part.tipo == "atleta" and part.atleta:
                nome = part.atleta.nome_completo
            jogadores.append(JogadorPublico(id_participante=part.id_participante, nome_completo=nome))

        resultado.append(
            EquipePublica(
                id_equipe=eq.id_equipe,
                nome=eq.nome,
                id_competicao=eq.id_competicao,
                grupo=eq.grupo,
                jogadores=jogadores,
            )
        )

    return resultado


# ============================================================================
# Endpoints Públicos de Confrontos
# ============================================================================

@router.get(
    "/competicoes/{id_competicao}/confrontos",
    response_model=List[ConfrontoPublico],
    summary="Listar confrontos públicos de uma competição",
)
def listar_confrontos_publicos_competicao(
    id_competicao: int,
    fase: Optional[str] = Query(None, description="Fase da competição"),
    rodada: Optional[int] = Query(None, description="Número da rodada"),
    grupo: Optional[str] = Query(None, description="Nome do grupo"),
    db: Session = Depends(get_db),
):
    comp = (
        db.query(models.Competicao)
        .filter(
            models.Competicao.id_competicao == id_competicao,
            models.Competicao.status != "RASCUNHO",
        )
        .first()
    )
    if not comp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competição não encontrada.",
        )

    if comp.modo_inscricao != "EQUIPE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Operação permitida apenas para competições em modo EQUIPE.",
        )

    return listar_confrontos_competicao(db, id_competicao, fase=fase, rodada=rodada, grupo=grupo)


# ============================================================================
# Endpoints Públicos de Classificação
# ============================================================================

@router.get(
    "/competicoes/{id_competicao}/classificacao",
    summary="Consultar classificação pública da competição (inteligente por modo)",
)
def obter_classificacao_publica_competicao(
    id_competicao: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    comp = (
        db.query(models.Competicao)
        .filter(
            models.Competicao.id_competicao == id_competicao,
            models.Competicao.status != "RASCUNHO",
        )
        .first()
    )
    if not comp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competição não encontrada.",
        )

    if comp.modo_inscricao == "EQUIPE":
        try:
            return calcular_classificacao_equipes(db, id_competicao)
        except CompeticaoNaoEncontradaError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except (ModoCompeticaoInvalidoError, ValueError) as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    elif comp.modo_inscricao == "INDIVIDUAL":
        try:
            return calcular_classificacao_individual_competicao(db, id_competicao)
        except ValueError as e:
            if "não encontrada" in str(e).lower():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Competição não possui modo de inscrição definido para cálculo de classificação.",
        )


@router.get(
    "/competicoes/{id_competicao}/classificacao-equipes",
    summary="Consultar tabela de classificação pública de equipes",
)
def obter_classificacao_equipes_publica(
    id_competicao: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    comp = (
        db.query(models.Competicao)
        .filter(
            models.Competicao.id_competicao == id_competicao,
            models.Competicao.status != "RASCUNHO",
        )
        .first()
    )
    if not comp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competição não encontrada.",
        )

    if comp.modo_inscricao != "EQUIPE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Operação permitida apenas para competições em modo EQUIPE.",
        )

    try:
        return calcular_classificacao_equipes(db, id_competicao)
    except CompeticaoNaoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ModoCompeticaoInvalidoError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
