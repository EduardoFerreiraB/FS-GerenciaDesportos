"""Rotas do portal publico: leitura sem autenticacao.

Nada aqui depende de usuario logado. Edicao nao publicada responde 404.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from competicoes.contratos.publico import (
    ArtilhariaPublica,
    ChaveamentoPublico,
    ClassificacaoPublica,
    CompeticaoPublica,
    EdicaoPublicaDetalhe,
    EventoPublico,
    PartidaPublica,
)
from competicoes.servicos import publico as servico_publico

router = APIRouter(prefix="/publico")


@router.get("/competicoes", response_model=list[CompeticaoPublica])
def listar_competicoes(db: Session = Depends(get_db)) -> list[CompeticaoPublica]:
    return servico_publico.listar_competicoes_publicas(db)


@router.get("/competicoes/{slug}", response_model=CompeticaoPublica)
def obter_competicao(slug: str, db: Session = Depends(get_db)) -> CompeticaoPublica:
    return servico_publico.obter_competicao_publica(db, slug)


@router.get("/eventos", response_model=list[EventoPublico])
def listar_eventos(db: Session = Depends(get_db)) -> list[EventoPublico]:
    return servico_publico.listar_eventos_publicos(db)


@router.get("/eventos/{slug}", response_model=EventoPublico)
def obter_evento(slug: str, db: Session = Depends(get_db)) -> EventoPublico:
    return servico_publico.obter_evento_publico(db, slug)


@router.get("/edicoes/{id_edicao_competicao}", response_model=EdicaoPublicaDetalhe)
def obter_edicao(id_edicao_competicao: int, db: Session = Depends(get_db)) -> EdicaoPublicaDetalhe:
    return servico_publico.obter_edicao_publica(db, id_edicao_competicao)


@router.get("/edicoes/{id_edicao_competicao}/partidas", response_model=list[PartidaPublica])
def listar_partidas(id_edicao_competicao: int, db: Session = Depends(get_db)) -> list[PartidaPublica]:
    return servico_publico.listar_partidas_publicas(db, id_edicao_competicao)


@router.get("/edicoes/{id_edicao_competicao}/classificacao", response_model=ClassificacaoPublica)
def obter_classificacao(id_edicao_competicao: int, db: Session = Depends(get_db)) -> ClassificacaoPublica:
    return servico_publico.obter_classificacao_publica(db, id_edicao_competicao)


@router.get("/edicoes/{id_edicao_competicao}/chaveamento", response_model=ChaveamentoPublico)
def obter_chaveamento(id_edicao_competicao: int, db: Session = Depends(get_db)) -> ChaveamentoPublico:
    return servico_publico.obter_chaveamento_publico(db, id_edicao_competicao)


@router.get("/edicoes/{id_edicao_competicao}/artilharia", response_model=ArtilhariaPublica)
def obter_artilharia(id_edicao_competicao: int, db: Session = Depends(get_db)) -> ArtilhariaPublica:
    return servico_publico.obter_artilharia_publica(db, id_edicao_competicao)
