"""Endpoints HTTP para consulta de classificação esportiva e decisões de desempate."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
import models
from security import check_coordenador_role, get_current_active_user
from competicoes.contratos.classificacao import TabelaClassificacaoDetalhe
from competicoes.contratos.disciplina import (
    DecisaoClassificacaoCriar,
    DecisaoClassificacaoDetalhe,
)
from competicoes.servicos import classificacao as servico_classificacao

router = APIRouter()


@router.get(
    "/edicoes/{id_edicao_competicao}/classificacao",
    response_model=TabelaClassificacaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Obter classificação esportiva de uma edição",
)
def obter_classificacao_edicao(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(get_current_active_user),
) -> TabelaClassificacaoDetalhe:
    return servico_classificacao.obter_classificacao_edicao(
        db=db, id_edicao=id_edicao_competicao
    )


@router.get(
    "/edicoes/{id_edicao_competicao}/decisoes-classificacao",
    response_model=list[DecisaoClassificacaoDetalhe],
    status_code=status.HTTP_200_OK,
    summary="Listar decisões manuais de classificação da edição",
)
def listar_decisoes_classificacao(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    _usuario: models.Usuario = Depends(get_current_active_user),
) -> list[DecisaoClassificacaoDetalhe]:
    return servico_classificacao.listar_decisoes_classificacao(
        db=db, id_edicao=id_edicao_competicao
    )


@router.post(
    "/edicoes/{id_edicao_competicao}/decisoes-classificacao",
    response_model=DecisaoClassificacaoDetalhe,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar decisão manual de desempate de classificação",
)
def registrar_decisao_classificacao(
    id_edicao_competicao: int,
    dados: DecisaoClassificacaoCriar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> DecisaoClassificacaoDetalhe:
    return servico_classificacao.registrar_decisao_classificacao(
        db=db, id_edicao=id_edicao_competicao, dados=dados, responsavel=autor
    )

