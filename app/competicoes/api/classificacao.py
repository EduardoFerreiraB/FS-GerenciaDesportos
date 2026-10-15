"""Endpoints HTTP para consulta de classificação esportiva."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
import models
from security import get_current_active_user
from competicoes.contratos.classificacao import TabelaClassificacaoDetalhe
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
