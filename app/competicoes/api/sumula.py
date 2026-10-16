"""Rotas da API de súmula, ocorrências, ciclo de vida de partida e artilharia."""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Header, Query, status
from sqlalchemy.orm import Session

import models
from database import get_db
from security import check_coordenador_role, get_current_active_user
from competicoes.contratos.partidas import PartidaDetalhe
from competicoes.contratos.sumula import (
    MotivoOperacao,
    OcorrenciaAutorAtualizar,
    OcorrenciaCriar,
    OcorrenciaRemover,
    PartidaFinalizar,
    SumulaDetalhe,
    TabelaArtilhariaDetalhe,
)
from competicoes.servicos import sumula as servico_sumula

router = APIRouter()


@router.get("/partidas/{id_partida}/sumula", response_model=SumulaDetalhe)
def obter_sumula(
    id_partida: int,
    db: Session = Depends(get_db),
    _current_user: models.Usuario = Depends(get_current_active_user),
) -> SumulaDetalhe:
    """Retorna a súmula detalhada da partida com ocorrências e alertas de suspensos."""
    return servico_sumula.obter_sumula(db, id_partida=id_partida)


@router.post("/partidas/{id_partida}/iniciar", response_model=PartidaDetalhe)
def iniciar_partida(
    id_partida: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> PartidaDetalhe:
    """Inicia uma partida agendada (AGENDADA -> EM_ANDAMENTO)."""
    return servico_sumula.iniciar_partida(
        db, id_partida=id_partida, responsavel=current_user
    )


@router.post("/partidas/{id_partida}/finalizar", response_model=PartidaDetalhe)
def finalizar_partida(
    id_partida: int,
    dados: PartidaFinalizar | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> PartidaDetalhe:
    """Finaliza a partida consolidando placar, avanço de mata-mata e sanções."""
    return servico_sumula.finalizar_partida(
        db, id_partida=id_partida, dados=dados, responsavel=current_user
    )


@router.post("/partidas/{id_partida}/reabrir", response_model=PartidaDetalhe)
def reabrir_partida(
    id_partida: int,
    dados: MotivoOperacao,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> PartidaDetalhe:
    """Reabre uma partida finalizada ou cancelada exigindo motivo."""
    return servico_sumula.reabrir_partida(
        db,
        id_partida=id_partida,
        motivo=dados.motivo,
        responsavel=current_user,
    )


@router.post("/partidas/{id_partida}/cancelar", response_model=PartidaDetalhe)
def cancelar_partida(
    id_partida: int,
    dados: MotivoOperacao,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> PartidaDetalhe:
    """Cancela uma partida agendada sem ocorrências exigindo motivo."""
    return servico_sumula.cancelar_partida(
        db,
        id_partida=id_partida,
        motivo=dados.motivo,
        responsavel=current_user,
    )


@router.post(
    "/partidas/{id_partida}/ocorrencias",
    response_model=SumulaDetalhe,
    status_code=status.HTTP_201_CREATED,
)
def registrar_ocorrencia(
    id_partida: int,
    dados: OcorrenciaCriar,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> SumulaDetalhe:
    """Registra ocorrência na súmula da partida."""
    return servico_sumula.registrar_ocorrencia(
        db,
        id_partida=id_partida,
        dados=dados,
        idempotency_key=idempotency_key,
        responsavel=current_user,
    )


@router.put("/ocorrencias/{id_ocorrencia}/autor", response_model=SumulaDetalhe)
def atribuir_autor_ocorrencia(
    id_ocorrencia: int,
    dados: OcorrenciaAutorAtualizar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> SumulaDetalhe:
    """Atribui ou corrige o autor de uma ocorrência sem alterar o placar."""
    return servico_sumula.atribuir_autor_ocorrencia(
        db,
        id_ocorrencia=id_ocorrencia,
        dados=dados,
        responsavel=current_user,
    )


@router.delete("/ocorrencias/{id_ocorrencia}", response_model=SumulaDetalhe)
def remover_ocorrencia(
    id_ocorrencia: int,
    motivo: str | None = Query(default=None),
    dados: OcorrenciaRemover | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> SumulaDetalhe:
    """Remove uma ocorrência de partida em andamento."""
    motivo_final = motivo if motivo is not None else (dados.motivo if dados else None)
    return servico_sumula.remover_ocorrencia(
        db,
        id_ocorrencia=id_ocorrencia,
        motivo=motivo_final,
        responsavel=current_user,
    )


@router.get("/edicoes/{id_edicao}/artilharia", response_model=TabelaArtilhariaDetalhe)
def obter_artilharia_edicao(
    id_edicao: int,
    db: Session = Depends(get_db),
    _current_user: models.Usuario = Depends(get_current_active_user),
) -> TabelaArtilhariaDetalhe:
    """Retorna a tabela de artilharia da edição."""
    return servico_sumula.obter_artilharia_edicao(db, id_edicao=id_edicao)
