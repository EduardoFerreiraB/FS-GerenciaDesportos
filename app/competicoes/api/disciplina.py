"""Rotas da API de disciplina, suspensões e cumprimentos."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

import models
from database import get_db
from security import check_coordenador_role, get_current_active_user
from competicoes.contratos.disciplina import (
    CumprimentoCriar,
    PainelDisciplinarDetalhe,
    SuspensaoAjustar,
    SuspensaoDetalhe,
    SuspensaoManualCriar,
)
from competicoes.servicos import disciplina as servico_disciplina

router = APIRouter()


@router.get("/edicoes/{id_edicao}/disciplinar", response_model=PainelDisciplinarDetalhe)
def obter_painel_disciplinar(
    id_edicao: int,
    db: Session = Depends(get_db),
    _current_user: models.Usuario = Depends(get_current_active_user),
) -> PainelDisciplinarDetalhe:
    """Retorna suspensões e resumo de cartões da edição."""
    return servico_disciplina.obter_painel_disciplinar(db, id_edicao=id_edicao)


@router.post(
    "/edicoes/{id_edicao}/disciplinar/reconciliar",
    response_model=PainelDisciplinarDetalhe,
)
def reconciliar_disciplinar(
    id_edicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> PainelDisciplinarDetalhe:
    """Força a reconciliação das sanções automáticas e devolve o painel."""
    servico_disciplina.reconciliar_sancoes_edicao(
        db, id_edicao=id_edicao, responsavel=current_user
    )
    return servico_disciplina.obter_painel_disciplinar(
        db, id_edicao=id_edicao, responsavel=current_user
    )


@router.post(
    "/edicoes/{id_edicao}/suspensoes",
    response_model=SuspensaoDetalhe,
    status_code=status.HTTP_201_CREATED,
)
def criar_suspensao_manual(
    id_edicao: int,
    dados: SuspensaoManualCriar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> SuspensaoDetalhe:
    """Cria suspensão manual com justificativa obrigatória."""
    return servico_disciplina.criar_suspensao_manual(
        db, id_edicao=id_edicao, dados=dados, responsavel=current_user
    )


@router.post(
    "/suspensoes/{id_suspensao}/cumprimentos",
    response_model=SuspensaoDetalhe,
    status_code=status.HTTP_201_CREATED,
)
def cumprir_suspensao(
    id_suspensao: int,
    dados: CumprimentoCriar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> SuspensaoDetalhe:
    """Registra cumprimento explícito de suspensão em partida finalizada posterior."""
    return servico_disciplina.cumprir_suspensao(
        db, id_suspensao=id_suspensao, dados=dados, responsavel=current_user
    )


@router.put("/suspensoes/{id_suspensao}", response_model=SuspensaoDetalhe)
def ajustar_suspensao(
    id_suspensao: int,
    dados: SuspensaoAjustar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> SuspensaoDetalhe:
    """Ajusta jogos e/ou situação de uma suspensão com justificativa."""
    return servico_disciplina.ajustar_suspensao(
        db, id_suspensao=id_suspensao, dados=dados, responsavel=current_user
    )
