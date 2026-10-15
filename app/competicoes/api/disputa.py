"""Rotas da API de disputa: geração de calendário, reversão e avanço de fase."""

from fastapi import APIRouter, Body, Depends, Response, status
from sqlalchemy.orm import Session

from database import get_db
import models
from security import check_coordenador_role, get_current_active_user
from competicoes.contratos.disputa import (
    EstruturaDisputaDetalhe,
    TabelaGerar,
)
from competicoes.servicos import disputa as servico_disputa

router = APIRouter()


@router.post(
    "/edicoes/{id_edicao_competicao}/gerar-tabela",
    response_model=EstruturaDisputaDetalhe,
    status_code=status.HTTP_201_CREATED,
    summary="Gerar calendário e confrontos da edição",
)
def gerar_tabela(
    id_edicao_competicao: int,
    dados: TabelaGerar | None = Body(default=None),
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(check_coordenador_role),
) -> EstruturaDisputaDetalhe:
    return servico_disputa.gerar_tabela_edicao(
        db,
        id_edicao_competicao,
        dados or TabelaGerar(),
        usuario,
    )


@router.delete(
    "/edicoes/{id_edicao_competicao}/tabela",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desfazer tabela de jogos e voltar edição para rascunho",
)
def desfazer_tabela(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(check_coordenador_role),
) -> Response:
    servico_disputa.desfazer_tabela_edicao(db, id_edicao_competicao, usuario)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/edicoes/{id_edicao_competicao}/disputa",
    response_model=EstruturaDisputaDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Consultar estrutura completa de disputa da edição",
)
def obter_disputa(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    _usuario: models.Usuario = Depends(get_current_active_user),
) -> EstruturaDisputaDetalhe:
    return servico_disputa.obter_estrutura_disputa(db, id_edicao_competicao)


@router.post(
    "/edicoes/{id_edicao_competicao}/encerrar-grupos",
    response_model=EstruturaDisputaDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Encerrar fase de grupos e classificar para o mata-mata",
)
def encerrar_grupos(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(check_coordenador_role),
) -> EstruturaDisputaDetalhe:
    return servico_disputa.encerrar_fase_grupos(db, id_edicao_competicao, usuario)
