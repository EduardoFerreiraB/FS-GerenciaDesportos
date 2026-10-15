"""Contratos Pydantic para partidas, agendamento e resultado simples."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Annotated

from pydantic import Field

from .comuns import Contrato, InteiroNaoNegativo


class PartidaAgendar(Contrato):
    data_hora: datetime | None = None
    data: date | None = None
    hora: time | None = None
    local: str | None = None
    campo: str | None = None
    id_local: int | None = None


class ResultadoSimples(Contrato):
    gols_mandante: InteiroNaoNegativo
    gols_visitante: InteiroNaoNegativo
    penaltis_mandante: InteiroNaoNegativo | None = None
    penaltis_visitante: InteiroNaoNegativo | None = None
    wo: bool = False
    equipe_wo_id: int | None = None


class PlacarPartida(Contrato):
    gols_mandante: InteiroNaoNegativo = 0
    gols_visitante: InteiroNaoNegativo = 0
    penaltis_mandante: InteiroNaoNegativo | None = None
    penaltis_visitante: InteiroNaoNegativo | None = None


class PartidaDetalhe(Contrato):
    id_partida: int
    id_edicao_competicao: int
    id_grupo: int | None = None
    id_duelo: int | None = None
    rodada: int | None = None
    ordem_jogo: int = 1
    id_equipe_mandante: int | None = None
    nome_mandante: str | None = None
    id_equipe_visitante: int | None = None
    nome_visitante: str | None = None
    data: date | None = None
    hora: time | None = None
    data_hora: datetime | None = None
    id_local: int | None = None
    local: str | None = None
    campo: str | None = None
    id_arbitro: int | None = None
    estado: str = "AGENDADA"
    status: str = "AGENDADA"
    placar: PlacarPartida = Field(default_factory=PlacarPartida)
    revisao: int = 1
