"""Roteador para endpoints públicos de competições individuais, provas e classificações (Passo 7).

Garante total isolamento de privacidade:
- Nenhum documento pessoal (CPF, RG), contato, telefone ou endereço é exposto.
- Competições ou provas em status 'RASCUNHO' não são expostas (HTTP 404).
- Endpoints individuais rejeitam competições em modo 'EQUIPE' com HTTP 422.
"""

from datetime import date, time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session, selectinload

from database import get_db
import models
from services.classificacao_individuais import (
    calcular_classificacao_prova,
    calcular_classificacao_individual_competicao,
    obter_nome_participante,
)


router = APIRouter(
    prefix="/publico",
    tags=["Público - Individuais"]
)


# ============================================================================
# Schemas Públicos (Strict Privacy)
# ============================================================================

class InscricaoPublicaResponse(BaseModel):
    id_inscricao: int
    id_participante: int
    nome_completo: str
    numero_peito: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ProvaPublicaResponse(BaseModel):
    id_prova: int
    id_competicao: int
    nome: str
    data: Optional[date] = None
    hora: Optional[time] = None
    id_local: Optional[int] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class ResultadoProvaPublico(BaseModel):
    id_resultado: int
    id_participante: int
    nome_participante: str
    numero_peito: Optional[int] = None
    tempo_ms: int
    tempo_formatado: str
    posicao: Optional[int] = None
    podio: Optional[str] = None
    desqualificado: bool = False
    motivo_desqualificacao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PodioPublico(BaseModel):
    ouro: Optional[ResultadoProvaPublico] = None
    prata: Optional[ResultadoProvaPublico] = None
    bronze: Optional[ResultadoProvaPublico] = None

    model_config = ConfigDict(from_attributes=True)


class ClassificacaoProvaPublicaResponse(BaseModel):
    id_prova: int
    nome: str
    nome_prova: Optional[str] = None
    id_competicao: Optional[int] = None
    status: str
    resultados: List[ResultadoProvaPublico] = []
    classificacao: Optional[List[ResultadoProvaPublico]] = None
    podio: Optional[PodioPublico] = None
    podio_lista: Optional[List[ResultadoProvaPublico]] = None

    model_config = ConfigDict(from_attributes=True)


class RankingAtletaPublico(BaseModel):
    id_participante: int
    nome_participante: str
    numero_peito: Optional[int] = None
    ouros: int = 0
    pratas: int = 0
    bronzes: int = 0
    total_medalhas: int = 0
    provas_disputadas: int = 0
    melhor_posicao: Optional[int] = None
    posicao: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ClassificacaoIndividualCompeticaoPublicaResponse(BaseModel):
    id_competicao: int
    nome: str
    nome_competicao: Optional[str] = None
    modo_inscricao: str
    total_provas: int
    provas: List[ClassificacaoProvaPublicaResponse] = []
    quadro_medalhas: List[RankingAtletaPublico] = []
    ranking_geral: List[RankingAtletaPublico] = []

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Helpers
# ============================================================================

def _sanitizar_resultado_prova(res_item: Optional[dict]) -> Optional[ResultadoProvaPublico]:
    if not res_item:
        return None
    pos = res_item.get("posicao")
    podio_val = res_item.get("podio")
    if podio_val is None:
        if pos == 1:
            podio_val = "ouro"
        elif pos == 2:
            podio_val = "prata"
        elif pos == 3:
            podio_val = "bronze"

    return ResultadoProvaPublico(
        id_resultado=res_item["id_resultado"],
        id_participante=res_item["id_participante"],
        nome_participante=res_item.get("nome_participante", ""),
        numero_peito=res_item.get("numero_peito"),
        tempo_ms=res_item.get("tempo_ms", 0),
        tempo_formatado=res_item.get("tempo_formatado", ""),
        posicao=pos,
        podio=podio_val,
        desqualificado=res_item.get("desqualificado", False),
        motivo_desqualificacao=res_item.get("motivo_desqualificacao"),
    )


# ============================================================================
# Endpoints
# ============================================================================

@router.get(
    "/competicoes/{id_competicao}/inscricoes",
    response_model=List[InscricaoPublicaResponse],
    summary="Listar atletas inscritos na competição (público)",
)
@router.get(
    "/competicoes/{id_competicao}/atletas",
    response_model=List[InscricaoPublicaResponse],
    include_in_schema=False,
)
def listar_inscricoes_publicas(id_competicao: int, db: Session = Depends(get_db)):
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp or comp.status == "RASCUNHO":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    if comp.modo_inscricao != "INDIVIDUAL":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Inscrições individuais disponíveis apenas para competições em modo INDIVIDUAL.",
        )

    inscricoes = (
        db.query(models.InscricaoIndividual)
        .filter(models.InscricaoIndividual.id_competicao == id_competicao)
        .options(
            selectinload(models.InscricaoIndividual.participante).selectinload(models.Participante.aluno),
            selectinload(models.InscricaoIndividual.participante).selectinload(models.Participante.atleta),
        )
        .order_by(models.InscricaoIndividual.id_inscricao.asc())
        .all()
    )

    resultado = []
    for insc in inscricoes:
        nome = obter_nome_participante(insc.participante)
        resultado.append(
            InscricaoPublicaResponse(
                id_inscricao=insc.id_inscricao,
                id_participante=insc.id_participante,
                nome_completo=nome,
                numero_peito=insc.numero_peito,
            )
        )
    return resultado


@router.get(
    "/competicoes/{id_competicao}/provas",
    response_model=List[ProvaPublicaResponse],
    summary="Listar provas da competição individual (público)",
)
def listar_provas_publicas(id_competicao: int, db: Session = Depends(get_db)):
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp or comp.status == "RASCUNHO":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    if comp.modo_inscricao != "INDIVIDUAL":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Listagem de provas disponível apenas para competições em modo INDIVIDUAL.",
        )

    provas = (
        db.query(models.Prova)
        .filter(models.Prova.id_competicao == id_competicao)
        .order_by(models.Prova.id_prova.asc())
        .all()
    )

    return provas


@router.get(
    "/provas/{id_prova}/classificacao",
    response_model=ClassificacaoProvaPublicaResponse,
    summary="Consultar classificação e pódio de prova individual (público)",
)
def obter_classificacao_prova_publica(id_prova: int, db: Session = Depends(get_db)):
    prova = db.query(models.Prova).filter(models.Prova.id_prova == id_prova).first()
    if not prova:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prova não encontrada.")

    if prova.competicao and prova.competicao.status == "RASCUNHO":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prova não encontrada.")

    if prova.competicao and prova.competicao.modo_inscricao != "INDIVIDUAL":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Classificação individual requer competição em modo INDIVIDUAL.",
        )

    try:
        dados_classificacao = calcular_classificacao_prova(db, id_prova)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    resultados_raw = dados_classificacao.get("resultados", [])
    resultados_limpos = [_sanitizar_resultado_prova(r) for r in resultados_raw]

    podio_raw = dados_classificacao.get("podio", {})
    podio_limpo = PodioPublico(
        ouro=_sanitizar_resultado_prova(podio_raw.get("ouro")),
        prata=_sanitizar_resultado_prova(podio_raw.get("prata")),
        bronze=_sanitizar_resultado_prova(podio_raw.get("bronze")),
    )
    podio_lista = [p for p in [podio_limpo.ouro, podio_limpo.prata, podio_limpo.bronze] if p is not None]

    return ClassificacaoProvaPublicaResponse(
        id_prova=dados_classificacao.get("id_prova", prova.id_prova),
        nome=dados_classificacao.get("nome", prova.nome),
        nome_prova=dados_classificacao.get("nome_prova", prova.nome),
        id_competicao=dados_classificacao.get("id_competicao", prova.id_competicao),
        status=dados_classificacao.get("status", prova.status),
        resultados=resultados_limpos,
        classificacao=resultados_limpos,
        podio=podio_limpo,
        podio_lista=podio_lista,
    )


@router.get(
    "/competicoes/{id_competicao}/classificacao-individual",
    response_model=ClassificacaoIndividualCompeticaoPublicaResponse,
    summary="Consultar quadro de medalhas e classificação consolidada individual (público)",
)
def obter_classificacao_individual_competicao_publica(id_competicao: int, db: Session = Depends(get_db)):
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp or comp.status == "RASCUNHO":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    if comp.modo_inscricao != "INDIVIDUAL":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Classificação individual disponível apenas para competições em modo INDIVIDUAL.",
        )

    try:
        dados = calcular_classificacao_individual_competicao(db, id_competicao)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    provas_formatadas = []
    for pr in dados.get("provas", []):
        res_limpos = [_sanitizar_resultado_prova(r) for r in pr.get("resultados", [])]
        podio_raw = pr.get("podio", {})
        podio_limpo = PodioPublico(
            ouro=_sanitizar_resultado_prova(podio_raw.get("ouro")),
            prata=_sanitizar_resultado_prova(podio_raw.get("prata")),
            bronze=_sanitizar_resultado_prova(podio_raw.get("bronze")),
        )
        podio_lista = [p for p in [podio_limpo.ouro, podio_limpo.prata, podio_limpo.bronze] if p is not None]

        provas_formatadas.append(
            ClassificacaoProvaPublicaResponse(
                id_prova=pr["id_prova"],
                nome=pr["nome"],
                nome_prova=pr.get("nome_prova", pr["nome"]),
                id_competicao=pr.get("id_competicao", id_competicao),
                status=pr.get("status", "Finalizada"),
                resultados=res_limpos,
                classificacao=res_limpos,
                podio=podio_limpo,
                podio_lista=podio_lista,
            )
        )

    ranking_limpo = []
    for item in dados.get("ranking_geral", []):
        ranking_limpo.append(
            RankingAtletaPublico(
                id_participante=item["id_participante"],
                nome_participante=item.get("nome_participante", ""),
                numero_peito=item.get("numero_peito"),
                ouros=item.get("ouros", 0),
                pratas=item.get("pratas", 0),
                bronzes=item.get("bronzes", 0),
                total_medalhas=item.get("total_medalhas", 0),
                provas_disputadas=item.get("provas_disputadas", 0),
                melhor_posicao=item.get("melhor_posicao"),
                posicao=item.get("posicao"),
            )
        )

    return ClassificacaoIndividualCompeticaoPublicaResponse(
        id_competicao=dados["id_competicao"],
        nome=dados["nome"],
        nome_competicao=dados.get("nome_competicao", dados["nome"]),
        modo_inscricao=dados["modo_inscricao"],
        total_provas=dados["total_provas"],
        provas=provas_formatadas,
        quadro_medalhas=ranking_limpo,
        ranking_geral=ranking_limpo,
    )
