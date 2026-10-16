"""Rotas da API de organização: eventos, competições e edições."""

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from database import get_db
import models
from security import check_coordenador_role, get_current_active_user
from competicoes.contratos.organizacao import (
    CompeticaoAtualizar,
    CompeticaoComEdicaoCriar,
    CompeticaoDetalhe,
    EdicaoCompeticaoAtualizar,
    EdicaoCompeticaoCriar,
    EdicaoCompeticaoDetalhe,
    EdicaoEventoAtualizar,
    EdicaoEventoCriar,
    EdicaoEventoDetalhe,
    EventoAtualizar,
    EventoComEdicaoCriar,
    EventoDetalhe,
    PaginaCompeticoes,
    PaginaEventos,
    PublicacaoAtualizar,
)
from competicoes.contratos.sumula import MotivoOperacao
from competicoes.servicos import organizacao as servico_organizacao

router = APIRouter()


# =========================================================================
# Eventos
# =========================================================================

@router.post(
    "/eventos",
    response_model=EventoDetalhe,
    status_code=status.HTTP_201_CREATED,
    summary="Criar evento com sua primeira edição",
)
def criar_evento(
    dados: EventoComEdicaoCriar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EventoDetalhe:
    return servico_organizacao.criar_evento_com_edicao(db, dados, autor)


@router.get(
    "/eventos",
    response_model=PaginaEventos,
    status_code=status.HTTP_200_OK,
    summary="Listar eventos cadastrados",
)
def listar_eventos(
    busca: str | None = Query(default=None, description="Busca por nome"),
    arquivado: bool = Query(default=False, description="Filtrar arquivados"),
    pagina: int = Query(default=1, ge=1, description="Número da página"),
    tamanho: int = Query(default=50, ge=1, le=100, description="Tamanho da página"),
    db: Session = Depends(get_db),
    _autor: models.Usuario = Depends(get_current_active_user),
) -> PaginaEventos:
    return servico_organizacao.listar_eventos(
        db, busca=busca, arquivado=arquivado, pagina=pagina, tamanho=tamanho
    )


@router.get(
    "/eventos/{id_evento}",
    response_model=EventoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Obter detalhes de um evento",
)
def obter_evento(
    id_evento: int,
    db: Session = Depends(get_db),
    _autor: models.Usuario = Depends(get_current_active_user),
) -> EventoDetalhe:
    return servico_organizacao.obter_evento(db, id_evento)


@router.patch(
    "/eventos/{id_evento}",
    response_model=EventoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados de um evento",
)
def atualizar_evento(
    id_evento: int,
    dados: EventoAtualizar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EventoDetalhe:
    return servico_organizacao.atualizar_evento(db, id_evento, dados, autor)


@router.post(
    "/eventos/{id_evento}/edicoes",
    response_model=EdicaoEventoDetalhe,
    status_code=status.HTTP_201_CREATED,
    summary="Adicionar edição a um evento existente",
)
def criar_edicao_evento(
    id_evento: int,
    dados: EdicaoEventoCriar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EdicaoEventoDetalhe:
    return servico_organizacao.criar_edicao_evento(db, id_evento, dados, autor)


@router.patch(
    "/edicoes-evento/{id_edicao_evento}",
    response_model=EdicaoEventoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados de uma edição de evento",
)
def atualizar_edicao_evento(
    id_edicao_evento: int,
    dados: EdicaoEventoAtualizar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EdicaoEventoDetalhe:
    return servico_organizacao.atualizar_edicao_evento(
        db, id_edicao_evento, dados, autor
    )


# =========================================================================
# Competições
# =========================================================================

@router.post(
    "/competicoes",
    response_model=CompeticaoDetalhe,
    status_code=status.HTTP_201_CREATED,
    summary="Criar competição com sua primeira edição",
)
def criar_competicao(
    dados: CompeticaoComEdicaoCriar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> CompeticaoDetalhe:
    return servico_organizacao.criar_competicao_com_edicao(db, dados, autor)


@router.get(
    "/competicoes",
    response_model=PaginaCompeticoes,
    status_code=status.HTTP_200_OK,
    summary="Listar competições cadastradas",
)
def listar_competicoes(
    busca: str | None = Query(default=None, description="Busca por nome"),
    id_modalidade: int | None = Query(
        default=None, description="Filtrar por modalidade"
    ),
    arquivado: bool = Query(default=False, description="Filtrar arquivadas"),
    pagina: int = Query(default=1, ge=1, description="Número da página"),
    tamanho: int = Query(default=50, ge=1, le=100, description="Tamanho da página"),
    db: Session = Depends(get_db),
    _autor: models.Usuario = Depends(get_current_active_user),
) -> PaginaCompeticoes:
    return servico_organizacao.listar_competicoes(
        db,
        busca=busca,
        id_modalidade=id_modalidade,
        arquivado=arquivado,
        pagina=pagina,
        tamanho=tamanho,
    )


@router.get(
    "/competicoes/{id_competicao}",
    response_model=CompeticaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Obter detalhes de uma competição",
)
def obter_competicao(
    id_competicao: int,
    db: Session = Depends(get_db),
    _autor: models.Usuario = Depends(get_current_active_user),
) -> CompeticaoDetalhe:
    return servico_organizacao.obter_competicao(db, id_competicao)


@router.patch(
    "/competicoes/{id_competicao}",
    response_model=CompeticaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Atualizar dados de uma competição",
)
def atualizar_competicao(
    id_competicao: int,
    dados: CompeticaoAtualizar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> CompeticaoDetalhe:
    return servico_organizacao.atualizar_competicao(
        db, id_competicao, dados, autor
    )


@router.post(
    "/competicoes/{id_competicao}/edicoes",
    response_model=EdicaoCompeticaoDetalhe,
    status_code=status.HTTP_201_CREATED,
    summary="Adicionar edição a uma competição existente",
)
def criar_edicao_competicao(
    id_competicao: int,
    dados: EdicaoCompeticaoCriar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EdicaoCompeticaoDetalhe:
    return servico_organizacao.criar_edicao_competicao(
        db, id_competicao, dados, autor
    )


# =========================================================================
# Edições de Competição
# =========================================================================

@router.get(
    "/edicoes/{id_edicao_competicao}",
    response_model=EdicaoCompeticaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Obter detalhes de uma edição de competição",
)
def obter_edicao_competicao(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    _autor: models.Usuario = Depends(get_current_active_user),
) -> EdicaoCompeticaoDetalhe:
    return servico_organizacao.obter_edicao_competicao(
        db, id_edicao_competicao
    )


@router.put(
    "/edicoes/{id_edicao_competicao}",
    response_model=EdicaoCompeticaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Atualizar edição de competição com controle de revisão",
)
def atualizar_edicao_competicao(
    id_edicao_competicao: int,
    dados: EdicaoCompeticaoAtualizar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EdicaoCompeticaoDetalhe:
    return servico_organizacao.atualizar_edicao_competicao(
        db, id_edicao_competicao, dados, autor
    )


@router.delete(
    "/edicoes/{id_edicao_competicao}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir edição de competição em rascunho",
)
def excluir_edicao_competicao(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> Response:
    servico_organizacao.excluir_edicao_competicao(
        db, id_edicao_competicao, autor
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/edicoes/{id_edicao_competicao}/publicar",
    response_model=EdicaoCompeticaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Publicar ou despublicar edição de competição",
)
def publicar_edicao(
    id_edicao_competicao: int,
    dados: PublicacaoAtualizar,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EdicaoCompeticaoDetalhe:
    return servico_organizacao.publicar_edicao(
        db, id_edicao_competicao, dados.publicada, autor
    )


@router.post(
    "/edicoes/{id_edicao_competicao}/iniciar",
    response_model=EdicaoCompeticaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Iniciar edição de competição",
)
def iniciar_edicao(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EdicaoCompeticaoDetalhe:
    return servico_organizacao.iniciar_edicao_competicao(
        db, id_edicao_competicao, autor
    )


@router.post(
    "/edicoes/{id_edicao_competicao}/finalizar",
    response_model=EdicaoCompeticaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Finalizar edição de competição",
)
def finalizar_edicao(
    id_edicao_competicao: int,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EdicaoCompeticaoDetalhe:
    return servico_organizacao.finalizar_edicao_competicao(
        db, id_edicao_competicao, autor
    )


@router.post(
    "/edicoes/{id_edicao_competicao}/reabrir",
    response_model=EdicaoCompeticaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Reabrir edição de competição finalizada",
)
def reabrir_edicao(
    id_edicao_competicao: int,
    dados: MotivoOperacao,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EdicaoCompeticaoDetalhe:
    return servico_organizacao.reabrir_edicao_competicao(
        db, id_edicao_competicao, dados.motivo, autor
    )


@router.post(
    "/edicoes/{id_edicao_competicao}/cancelar",
    response_model=EdicaoCompeticaoDetalhe,
    status_code=status.HTTP_200_OK,
    summary="Cancelar administrativamente edição de competição",
)
def cancelar_edicao(
    id_edicao_competicao: int,
    dados: MotivoOperacao,
    db: Session = Depends(get_db),
    autor: models.Usuario = Depends(check_coordenador_role),
) -> EdicaoCompeticaoDetalhe:
    return servico_organizacao.cancelar_edicao_competicao(
        db, id_edicao_competicao, dados.motivo, autor
    )

