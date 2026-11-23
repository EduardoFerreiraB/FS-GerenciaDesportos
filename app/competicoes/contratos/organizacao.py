"""Entradas e saidas para identidades permanentes e suas edicoes."""

from datetime import date, datetime
from typing import Annotated, Literal
from typing_extensions import Self

from pydantic import AliasChoices, AliasPath, Field, StrictBool, ValidationInfo, field_validator, model_validator

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

    @field_validator("data_fim")
    @classmethod
    def periodo_ordenado(cls, data_fim: date | None, info: ValidationInfo) -> date | None:
        # Validador de campo (e não de modelo) para o erro 422 apontar "data_fim".
        data_inicio = info.data.get("data_inicio")
        if data_inicio is not None and data_fim is not None and data_inicio > data_fim:
            raise ValueError("A data de término deve ser igual ou posterior à data de início.")
        return data_fim


class EdicaoEventoCriar(_PeriodoEdicao):
    identificacao: Identificacao
    data_inicio: date
    data_fim: date


class EdicaoEventoAtualizar(_PeriodoEdicao):
    identificacao: Identificacao | None = None


class CompeticaoVinculada(Contrato):
    """Edição de competição ligada a uma edição de evento (DF-RT15-01)."""

    id_competicao: Id
    nome: str = Field(validation_alias=AliasChoices("nome", AliasPath("competicao", "nome")))
    id_edicao_competicao: Id
    identificacao: str
    estado: EstadoEdicao
    publicada: bool


class EdicaoEventoDetalhe(EdicaoEventoCriar):
    id_edicao_evento: Id
    id_evento: Id
    criado_em: datetime
    competicoes: list[CompeticaoVinculada] = Field(
        default_factory=list,
        validation_alias=AliasChoices("competicoes", "edicoes_competicao"),
    )

    @field_validator("competicoes")
    @classmethod
    def ordenar_competicoes(cls, competicoes: list[CompeticaoVinculada]) -> list[CompeticaoVinculada]:
        return sorted(competicoes, key=lambda c: (c.nome.casefold(), c.identificacao))


class EventoExcluir(Contrato):
    """Confirmação reforçada: o nome do evento exatamente como cadastrado."""

    confirmacao_nome: str


class EdicaoEventoExcluir(Contrato):
    confirmacao_identificacao: str


class PreviaExclusaoEvento(Contrato):
    """Impacto da exclusão, para o diálogo de confirmação."""

    edicoes_evento: int
    edicoes_competicao: int
    partidas: int
    equipes: int
    publicadas: int


class VinculoEdicaoCriar(Contrato):
    id_edicao_competicao: Id


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
            raise ValueError("O formato deve corresponder ao da configuração.")
        return self


class EdicaoCompeticaoAtualizar(EdicaoCompeticaoCriar):
    revisao: InteiroPositivo


class EventoResumo(Contrato):
    """Evento ao qual a edição está vinculada (selo no cabeçalho, DF-RT15-03)."""

    id_evento: Id
    nome: str
    identificacao_edicao: str


class EdicaoCompeticaoDetalhe(EdicaoCompeticaoCriar):
    id_edicao_competicao: Id
    id_competicao: Id
    estado: EstadoEdicao
    publicada: bool
    revisao: InteiroPositivo
    criado_em: datetime
    evento: EventoResumo | None = None


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
