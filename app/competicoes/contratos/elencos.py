"""Contratos administrativos de competidores e inscrições por edição."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import Field, StrictBool, field_validator

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


class EquipeAtualizar(Contrato):
    """Nome e sigla não são estruturais: editáveis em qualquer estado da edição."""

    nome: Nome | None = None
    sigla: Sigla | None = None

    @field_validator("nome")
    @classmethod
    def nome_nao_nulo(cls, nome: str | None) -> str | None:
        if nome is None:
            raise ValueError("Informe o nome da equipe.")
        return nome


class IntegranteCriar(Contrato):
    id_competidor: Id
    nome_esportivo: Nome
    numero_camisa: NumeroCamisa | None = None
    posicao: Posicao | None = None


class IntegranteAtualizar(Contrato):
    """Atualização parcial: só os campos enviados mudam; ``null`` limpa camisa e posição."""

    situacao: SituacaoIntegrante | None = None
    nome_esportivo: Nome | None = None
    numero_camisa: NumeroCamisa | None = None
    posicao: Posicao | None = None

    @field_validator("situacao", "nome_esportivo")
    @classmethod
    def obrigatorio_se_enviado(cls, valor: str | None) -> str | None:
        if valor is None:
            raise ValueError("Campo obrigatório.")
        return valor


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


class OrigemCopiaEquipes(Contrato):
    """Edição que pode servir de origem para copiar equipes (seletor sem ID interno)."""

    id_edicao_competicao: Id
    rotulo: str
    equipes: int
