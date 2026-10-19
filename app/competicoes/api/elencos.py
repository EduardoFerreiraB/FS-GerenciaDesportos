"""Endpoints HTTP para competidores, equipes e elencos."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

import models
from database import get_db
from security import check_coordenador_role, get_current_active_user
from competicoes.contratos.elencos import (
    AlunoImportar,
    CompetidorAtualizar,
    CompetidorCriar,
    CompetidorDetalhe,
    EquipeCriar,
    EquipeDetalhe,
    EquipesCopiar,
    IntegranteAtualizar,
    IntegranteCriar,
    IntegranteDetalhe,
    PaginaCompetidores,
)
from competicoes.servicos import elencos as servico_elencos

router = APIRouter()


@router.get("/competidores", response_model=PaginaCompetidores)
def listar_competidores(
    busca: str | None = None,
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(50, ge=1),
    db: Session = Depends(get_db),
    _current_user: models.Usuario = Depends(get_current_active_user),
) -> PaginaCompetidores:
    """Lista competidores cadastrados com paginação e busca opcional."""
    return servico_elencos.listar_competidores(db, busca=busca, pagina=pagina, tamanho=tamanho)


@router.post("/competidores", response_model=CompetidorDetalhe, status_code=status.HTTP_201_CREATED)
def criar_competidor(
    dados: CompetidorCriar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> CompetidorDetalhe:
    """Cadastra um novo competidor (independente de aluno escolar)."""
    return servico_elencos.criar_competidor(db, dados, current_user)


@router.post(
    "/competidores/importar-aluno",
    response_model=CompetidorDetalhe,
    status_code=status.HTTP_201_CREATED,
)
def importar_aluno(
    dados: AlunoImportar,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> CompetidorDetalhe:
    """Importa aluno como competidor de forma idempotente (201 criado, 200 existente)."""
    detalhe, criado = servico_elencos._importar_aluno(db, dados.id_aluno, current_user)
    if not criado:
        response.status_code = status.HTTP_200_OK
    return detalhe


@router.patch("/competidores/{id_competidor}", response_model=CompetidorDetalhe)
def atualizar_competidor(
    id_competidor: int,
    dados: CompetidorAtualizar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> CompetidorDetalhe:
    """Atualiza dados cadastrais de um competidor sem alterar históricos de elenco."""
    return servico_elencos.atualizar_competidor(db, id_competidor, dados, current_user)


@router.get("/edicoes/{id_edicao_competicao}/equipes", response_model=list[EquipeDetalhe])
def listar_equipes(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    _current_user: models.Usuario = Depends(get_current_active_user),
) -> list[EquipeDetalhe]:
    """Lista todas as equipes de uma edição de competição com seus integrantes."""
    return servico_elencos.listar_equipes(db, id_edicao_competicao)


@router.post(
    "/edicoes/{id_edicao_competicao}/equipes",
    response_model=EquipeDetalhe,
    status_code=status.HTTP_201_CREATED,
)
def criar_equipe(
    id_edicao_competicao: int,
    dados: EquipeCriar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> EquipeDetalhe:
    """Cria uma nova equipe dentro de uma edição em rascunho."""
    return servico_elencos.criar_equipe(db, id_edicao_competicao, dados, current_user)


@router.post(
    "/equipes/{id_equipe}/integrantes",
    response_model=IntegranteDetalhe,
    status_code=status.HTTP_201_CREATED,
)
def inscrever_integrante(
    id_equipe: int,
    dados: IntegranteCriar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> IntegranteDetalhe:
    """Inscreve um competidor em uma equipe da edição."""
    return servico_elencos.inscrever_integrante(db, id_equipe, dados, current_user)


@router.delete("/equipes/{id_equipe}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_equipe(
    id_equipe: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> Response:
    """Exclui a equipe e seus atletas, com a edição em rascunho."""
    servico_elencos.excluir_equipe(db, id_equipe, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/integrantes/{id_integrante}", response_model=IntegranteDetalhe)
def atualizar_integrante(
    id_integrante: int,
    dados: IntegranteAtualizar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> IntegranteDetalhe:
    """Atualiza a situação do integrante na equipe."""
    return servico_elencos.atualizar_integrante(db, id_integrante, dados, current_user)


@router.post(
    "/edicoes/{id_edicao_competicao}/copiar-equipes",
    response_model=list[EquipeDetalhe],
    status_code=status.HTTP_201_CREATED,
)
def copiar_equipes(
    id_edicao_competicao: int,
    dados: EquipesCopiar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
) -> list[EquipeDetalhe]:
    """Copia todas as equipes e inscrições de uma edição para a edição atual (em rascunho)."""
    return servico_elencos.copiar_equipes(
        db,
        id_edicao_origem=dados.id_edicao_origem,
        id_edicao_destino=id_edicao_competicao,
        responsavel=current_user,
    )
