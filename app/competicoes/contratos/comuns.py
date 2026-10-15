"""Schemas compartilhados; entradas desconhecidas sao recusadas."""

from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Id = Annotated[int, Field(strict=True, ge=1)]
InteiroPositivo = Annotated[int, Field(strict=True, ge=1)]
InteiroNaoNegativo = Annotated[int, Field(strict=True, ge=0)]
Nome = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Identificacao = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class Contrato(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class ErroResposta(Contrato):
    codigo: str
    mensagem: str
    campos: list[str] = Field(default_factory=list)


T = TypeVar("T")


class Pagina(Contrato, Generic[T]):
    itens: list[T]
    total: InteiroNaoNegativo
    pagina: InteiroPositivo
    tamanho: InteiroPositivo
