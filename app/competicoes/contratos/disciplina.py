"""Contratos Pydantic para controle disciplinar, suspensões, cumprimentos e decisões de desempate."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from .comuns import Contrato, InteiroPositivo

OrigemSuspensao = Literal[
    "ACUMULO_AMARELOS",
    "VERMELHO_DIRETO",
    "SEGUNDO_AMARELO",
    "MANUAL",
]
SituacaoSuspensao = Literal[
    "ATIVA",
    "CUMPRIDA",
    "EM_REVISAO",
    "CANCELADA",
]


class CumprimentoDetalhe(Contrato):
    id_cumprimento: int
    id_suspensao: int
    id_integrante: int
    id_partida: int
    criado_em: datetime | None = None
    responsavel_nome: str | None = None


class HistoricoSuspensao(Contrato):
    """Linha do histórico de uma suspensão, lida da auditoria (DF-RT14-05)."""

    em: datetime | None = None
    responsavel_nome: str | None = None
    acao: str
    situacao_anterior: str | None = None
    situacao_nova: str | None = None
    justificativa: str | None = None


class PartidaElegivelCumprimento(Contrato):
    """Jogo em que a suspensão pode ser cumprida (DF-RT14-02)."""

    id_partida: int
    numero_jogo: int
    rotulo: str


class SuspensaoDetalhe(Contrato):
    id_suspensao: int
    id_edicao_competicao: int
    id_integrante: int
    nome_esportivo: str | None = None
    id_equipe: int | None = None
    nome_equipe: str | None = None
    id_partida_origem: int | None = None
    id_ocorrencia_origem: int | None = None
    motivo: str
    origem: str
    chave_origem: str | None = None
    jogos: int
    jogos_cumpridos: int = 0
    jogos_pendentes: int = 1
    situacao: str
    cumprimentos: list[CumprimentoDetalhe] = Field(default_factory=list)
    criado_em: datetime | None = None
    responsavel_nome: str | None = None
    historico: list[HistoricoSuspensao] = Field(default_factory=list)


class SuspensaoManualCriar(Contrato):
    id_integrante: int
    jogos: InteiroPositivo = 1
    motivo: str = Field(min_length=3)


class SuspensaoAjustar(Contrato):
    jogos: InteiroPositivo | None = None
    situacao: SituacaoSuspensao | None = None
    motivo: str = Field(min_length=3)


class CumprimentoCriar(Contrato):
    id_partida: int


class ResumoCartoesIntegrante(Contrato):
    id_integrante: int
    nome_esportivo: str
    id_equipe: int
    nome_equipe: str
    amarelos_estatisticos: int = 0
    amarelos_acumulo_atual: int = 0
    vermelhos_diretos: int = 0
    expulsoes_segundo_amarelo: int = 0
    suspenso_atualmente: bool = False


class PainelDisciplinarDetalhe(Contrato):
    id_edicao_competicao: int
    suspensoes: list[SuspensaoDetalhe] = Field(default_factory=list)
    resumo_cartoes: list[ResumoCartoesIntegrante] = Field(default_factory=list)


class DecisaoClassificacaoCriar(Contrato):
    id_grupo: int | None = None
    conjunto_equipes: list[int] = Field(min_length=2)
    ordem_escolhida: list[int] = Field(min_length=2)
    motivo: str = Field(min_length=3)


class DecisaoClassificacaoDetalhe(Contrato):
    id_decisao: int
    id_edicao_competicao: int
    id_grupo: int | None = None
    conjunto_equipes: list[int]
    ordem_escolhida: list[int]
    motivo: str
    revisao_resultados: str
    valida: bool = True
    criado_em: datetime | None = None
    responsavel_nome: str | None = None
