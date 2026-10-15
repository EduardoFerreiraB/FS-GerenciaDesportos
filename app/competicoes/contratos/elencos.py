"""Contratos administrativos de competidores e inscricoes por edicao."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import Field, StrictBool

from .comuns import Contrato, Id, Nome, Pagina

SituacaoEquipe = Literal["ATIVA", "INATIVA"]
SituacaoIntegrante = Literal["ATIVO", "INATIVO"]
Documento = Annotated[str, Field(max_length=50)]
FotoUrl = Annotated[str, Field(max_length=500)]
Sigla = Annotated[str, Field(max_length=10)]
Posicao = Annotated[str, Field(max_length=50)]
NumeroCamisa = Annotated[int, Field(strict=True)]


class CompetidorCriar(Contrato):
    nome: Nome
    data_nascimento: date | None = None
    documento: Documento | None = None
    foto_url: FotoUrl | None = None
    ativo: StrictBool = True


class CompetidorAtualizar(Contrato):
    nome: Nome | None = None
    data_nascimento: date | None = None
    documento: Documento | None = None
    foto_url: FotoUrl | None = None
    ativo: StrictBool | None = None


class CompetidorDetalhe(CompetidorCriar):
    id_competidor: Id
    id_aluno_origem: Id | None = None
    criado_em: datetime


class PaginaCompetidores(Pagina[CompetidorDetalhe]):
    pass


class AlunoImportar(Contrato):
    id_aluno: Id


class EquipeCriar(Contrato):
    nome: Nome
    sigla: Sigla | None = None


class IntegranteCriar(Contrato):
    id_competidor: Id
    nome_esportivo: Nome
    numero_camisa: NumeroCamisa | None = None
    posicao: Posicao | None = None


class IntegranteAtualizar(Contrato):
    situacao: SituacaoIntegrante


class IntegranteDetalhe(IntegranteCriar):
    id_integrante: Id
    id_edicao_competicao: Id
    id_equipe: Id
    situacao: SituacaoIntegrante
    criado_em: datetime


class EquipeDetalhe(EquipeCriar):
    id_equipe: Id
    id_edicao_competicao: Id
    situacao: SituacaoEquipe
    criado_em: datetime
    integrantes: list[IntegranteDetalhe] = Field(default_factory=list)


class EquipesCopiar(Contrato):
    id_edicao_origem: Id
