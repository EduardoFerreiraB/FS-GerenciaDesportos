"""Entradas e saidas para identidades permanentes e suas edicoes."""

from datetime import date, datetime
from typing import Annotated, Literal, Self

from pydantic import Field, StrictBool, model_validator

from .comuns import Contrato, Id, Identificacao, InteiroPositivo, Nome, Pagina
from .configuracao import Configuracao, FormatoCompeticao

EstadoEdicao = Literal["RASCUNHO", "EM_ANDAMENTO", "FINALIZADA", "CANCELADA"]
Categoria = Annotated[str, Field(max_length=100)]


class EventoCriar(Contrato):
    nome: Nome
    descricao: str | None = None


class EventoAtualizar(Contrato):
    nome: Nome | None = None
    descricao: str | None = None
    arquivado: StrictBool | None = None


class _PeriodoEdicao(Contrato):
    data_inicio: date | None = None
    data_fim: date | None = None

    @model_validator(mode="after")
    def periodo_ordenado(self) -> Self:
        if self.data_inicio is not None and self.data_fim is not None:
            if self.data_inicio > self.data_fim:
                raise ValueError("A data de inicio deve ser anterior ou igual a data de fim.")
        return self


class EdicaoEventoCriar(_PeriodoEdicao):
    identificacao: Identificacao
    data_inicio: date
    data_fim: date


class EdicaoEventoAtualizar(_PeriodoEdicao):
    identificacao: Identificacao | None = None


class EdicaoEventoDetalhe(EdicaoEventoCriar):
    id_edicao_evento: Id
    id_evento: Id
    criado_em: datetime


class EventoComEdicaoCriar(EventoCriar):
    edicao: EdicaoEventoCriar


class EventoDetalhe(EventoCriar):
    id_evento: Id
    slug: str
    arquivado: bool
    criado_em: datetime
    edicoes: list[EdicaoEventoDetalhe] = Field(default_factory=list)


class CompeticaoCriar(Contrato):
    nome: Nome
    descricao: str | None = None
    id_modalidade: Id


class CompeticaoAtualizar(EventoAtualizar):
    id_modalidade: Id | None = None


class EdicaoCompeticaoCriar(EdicaoEventoCriar):
    id_edicao_evento: Id | None = None
    categoria: Categoria | None = None
    formato: FormatoCompeticao
    configuracao: Configuracao

    @model_validator(mode="after")
    def formato_compativel(self) -> Self:
        if self.formato != self.configuracao.formato:
            raise ValueError("O formato deve corresponder ao da configuracao.")
        return self


class EdicaoCompeticaoAtualizar(EdicaoCompeticaoCriar):
    revisao: InteiroPositivo


class EdicaoCompeticaoDetalhe(EdicaoCompeticaoCriar):
    id_edicao_competicao: Id
    id_competicao: Id
    estado: EstadoEdicao
    publicada: bool
    revisao: InteiroPositivo
    criado_em: datetime


class CompeticaoComEdicaoCriar(CompeticaoCriar):
    edicao: EdicaoCompeticaoCriar


class CompeticaoDetalhe(CompeticaoCriar):
    id_competicao: Id
    slug: str
    arquivado: bool
    criado_em: datetime
    edicoes: list[EdicaoCompeticaoDetalhe] = Field(default_factory=list)


class PublicacaoAtualizar(Contrato):
    publicada: StrictBool


class PaginaEventos(Pagina[EventoDetalhe]):
    pass


class PaginaCompeticoes(Pagina[CompeticaoDetalhe]):
    pass
