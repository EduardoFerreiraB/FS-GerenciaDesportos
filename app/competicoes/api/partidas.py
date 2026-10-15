"""Endpoints HTTP para partidas, agendamento e resultado simples."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

import models
from database import get_db
from security import check_coordenador_role, get_current_active_user
from competicoes.contratos.partidas import (
    PartidaAgendar,
    PartidaDetalhe,
    ResultadoSimples,
)
from competicoes.servicos import partidas as servico_partidas

router = APIRouter()


@router.get("/edicoes/{id_edicao_competicao}/partidas", response_model=list[PartidaDetalhe])
def listar_partidas(
    id_edicao_competicao: int,
    id_grupo: int | None = None,
    fase: str | None = None,
    rodada: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
    _current_user: models.Usuario = Depends(get_current_active_user),
) -> list[PartidaDetalhe]:
    """Lista partidas de uma edição com filtros opcionais por grupo, fase ou rodada."""
    return servico_partidas.listar_partidas(
        db,
        id_edicao=id_edicao_competicao,
        id_grupo=id_grupo,
        fase=fase,
        rodada=rodada,
    )


@router.patch("/partidas/{id_partida}/agendamento", response_model=PartidaDetalhe)
def agendar_partida(
    id_partida: int,
    dados: PartidaAgendar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> PartidaDetalhe:
    """Atualiza data/hora/local de uma partida (apenas coordenador/admin)."""
    return servico_partidas.agendar_partida(db, id_partida, dados, current_user)


@router.post("/partidas/{id_partida}/resultado-simples", response_model=PartidaDetalhe)
def registrar_resultado_simples(
    id_partida: int,
    dados: ResultadoSimples,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> PartidaDetalhe:
    """Registra resultado simples de partida com cabeçalho obrigatório Idempotency-Key."""
    return servico_partidas.registrar_resultado_simples(
        db,
        id_partida=id_partida,
        dados=dados,
        idempotency_key=idempotency_key,
        responsavel=current_user,
    )
