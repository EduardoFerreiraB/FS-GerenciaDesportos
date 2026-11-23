"""Contratos Pydantic para súmula detalhada, ocorrências, artilharia e ciclo de vida de partida."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from .comuns import Contrato, InteiroNaoNegativo, InteiroPositivo
from .partidas import PartidaDetalhe

TipoOcorrencia = Literal[
    "GOL",
    "GOL_CONTRA",
    "CARTAO_AMARELO",
    "CARTAO_VERMELHO_DIRETO",
    "EXPULSAO_SEGUNDO_AMARELO",
]

TipoOcorrenciaLancamento = Literal[
    "GOL",
    "GOL_CONTRA",
    "CARTAO_AMARELO",
    "CARTAO_VERMELHO_DIRETO",
]


class OcorrenciaCriar(Contrato):
    tipo: TipoOcorrenciaLancamento
    id_equipe: int
    id_integrante: int | None = None
    minuto: InteiroNaoNegativo | None = None
    periodo: str | None = None
    observacao: str | None = None
    motivo: str | None = None


class OcorrenciaAutorAtualizar(Contrato):
    id_integrante: int | None
    motivo: str | None = None


class OcorrenciaRemover(Contrato):
    motivo: str | None = None


class OcorrenciaDetalhe(Contrato):
    id_ocorrencia: int
    id_partida: int
    tipo: str
    id_equipe_beneficiada: int
    id_integrante: int | None = None
    nome_integrante: str | None = None
    numero_camisa: int | None = None
    minuto: int | None = None
    periodo: str | None = None
    observacao: str | None = None
    id_ocorrencia_origem: int | None = None
    criado_em: datetime | None = None


class AlertaSuspensoPartida(Contrato):
    id_integrante: int
    nome_esportivo: str
    id_equipe: int
    id_suspensao: int
    jogos_pendentes: int
    motivo: str


class SumulaDetalhe(Contrato):
    partida: PartidaDetalhe
    ocorrencias: list[OcorrenciaDetalhe] = Field(default_factory=list)
    alertas_suspensos: list[AlertaSuspensoPartida] = Field(default_factory=list)


class PartidaFinalizar(Contrato):
    penaltis_mandante: InteiroNaoNegativo | None = None
    penaltis_visitante: InteiroNaoNegativo | None = None


class MotivoOperacao(Contrato):
    motivo: str = Field(min_length=3)


class ArtilheiroDetalhe(Contrato):
    posicao: int
    id_integrante: int
    id_competidor: int
    nome_esportivo: str
    numero_camisa: int | None = None
    id_equipe: int
    nome_equipe: str
    gols: int
    gols_em_andamento: int = 0


class TabelaArtilhariaDetalhe(Contrato):
    id_edicao_competicao: int
    possui_jogos_em_andamento: bool = False
    artilheiros: list[ArtilheiroDetalhe] = Field(default_factory=list)
