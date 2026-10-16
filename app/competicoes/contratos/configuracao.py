"""Configuracao de futebol com discriminador unico e defaults explicitos."""

from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import Field, JsonValue, StrictBool, TypeAdapter, ValidationError, field_validator

from competicoes.erros import ConfiguracaoInvalida
from .comuns import Contrato, InteiroNaoNegativo, InteiroPositivo

FormatoCompeticao = Literal["PONTOS_CORRIDOS", "GRUPOS_MATA_MATA", "MATA_MATA"]


class CriterioDesempate(str, Enum):
    VITORIAS = "VITORIAS"
    SALDO_GOLS = "SALDO_GOLS"
    GOLS_PRO = "GOLS_PRO"
    CONFRONTO_DIRETO = "CONFRONTO_DIRETO"
    MENOS_CARTOES_VERMELHOS = "MENOS_CARTOES_VERMELHOS"
    MENOS_CARTOES_AMARELOS = "MENOS_CARTOES_AMARELOS"


class PontuacaoSchema(Contrato):
    vitoria: InteiroNaoNegativo = 3
    empate: InteiroNaoNegativo = 1
    derrota: InteiroNaoNegativo = 0


class DisciplinaSchema(Contrato):
    limite_amarelos: InteiroPositivo | None = 3
    jogos_por_acumulo: InteiroPositivo = 1
    jogos_por_vermelho: InteiroPositivo = 1
    jogos_por_segundo_amarelo: InteiroPositivo = 1
    zerar_amarelos_ao_encerrar_grupos: StrictBool = False


class _ConfiguracaoPontuada(Contrato):
    pontuacao: PontuacaoSchema = Field(default_factory=PontuacaoSchema)
    desempates: list[CriterioDesempate] = Field(min_length=1)
    disciplina: DisciplinaSchema = Field(default_factory=DisciplinaSchema)

    @field_validator("desempates")
    @classmethod
    def sem_repeticao(cls, criterios: list[CriterioDesempate]) -> list[CriterioDesempate]:
        if len(criterios) != len(set(criterios)):
            raise ValueError("Os criterios de desempate nao podem se repetir.")
        return criterios


class ConfiguracaoPontosCorridos(_ConfiguracaoPontuada):
    formato: Literal["PONTOS_CORRIDOS"]
    turno_e_returno: StrictBool = False


class ConfiguracaoGruposMataMata(_ConfiguracaoPontuada):
    formato: Literal["GRUPOS_MATA_MATA"]
    quantidade_grupos: InteiroPositivo
    classificados_por_grupo: InteiroPositivo
    turno_e_returno_grupos: StrictBool = False
    ida_volta_eliminatoria: StrictBool = False
    final_unica: StrictBool = True
    terceiro_lugar: StrictBool = False


class ConfiguracaoMataMata(Contrato):
    formato: Literal["MATA_MATA"]
    ida_volta: StrictBool = False
    final_unica: StrictBool = True
    terceiro_lugar: StrictBool = False
    disciplina: DisciplinaSchema = Field(default_factory=DisciplinaSchema)


Configuracao = Annotated[
    Union[ConfiguracaoPontosCorridos, ConfiguracaoGruposMataMata, ConfiguracaoMataMata],
    Field(discriminator="formato"),
]

_ADAPTADOR = TypeAdapter(Configuracao)
_FORMATOS = {"PONTOS_CORRIDOS", "GRUPOS_MATA_MATA", "MATA_MATA"}


def validar_configuracao(formato: str, dados: dict[str, JsonValue]) -> Configuracao:
    if formato not in _FORMATOS or ("formato" in dados and dados["formato"] != formato):
        raise ConfiguracaoInvalida("Formato de competicao invalido ou divergente.", campos=["formato"])
    try:
        return _ADAPTADOR.validate_python(dados | {"formato": formato})
    except ValidationError as erro:
        # A uniao inclui o nome do ramo no loc; ele nao faz parte do campo da API.
        campos = list(dict.fromkeys(
            ".".join(str(parte) for parte in item["loc"][1:]) or "configuracao"
            for item in erro.errors()
        ))
        raise ConfiguracaoInvalida("Configuracao de competicao invalida.", campos=campos) from None
