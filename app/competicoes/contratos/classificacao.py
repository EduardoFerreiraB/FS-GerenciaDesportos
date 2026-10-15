"""Contratos Pydantic para cálculo de classificação esportiva e avanço eliminatório."""

from pydantic import Field

from .comuns import Contrato


class LinhaClassificacao(Contrato):
    posicao: int
    id_equipe: int
    nome_equipe: str
    jogos: int = 0
    vitorias: int = 0
    empates: int = 0
    derrotas: int = 0
    gols_pro: int = 0
    gols_contra: int = 0
    saldo_gols: int = 0
    pontos: int = 0
    aproveitamento: float = 0.0
    empate_persistente: bool = False


class TabelaClassificacao(Contrato):
    id_grupo: int | None = None
    nome_grupo: str | None = None
    linhas: list[LinhaClassificacao] = Field(default_factory=list)


class ClassificacaoEdicaoDetalhe(Contrato):
    geral: TabelaClassificacao | None = None
    grupos: list[TabelaClassificacao] = Field(default_factory=list)


class ResultadoDueloResolvido(Contrato):
    id_duelo: int
    id_equipe_vencedora: int | None = None
    id_equipe_perdedora: int | None = None
    estado: str  # "PENDENTE", "DEFINIDO", "RESOLVIDO"
    placar_agregado_mandante: int = 0
    placar_agregado_visitante: int = 0
    foi_penaltis: bool = False


class AtualizacaoVaga(Contrato):
    id_vaga: int
    id_equipe_resolvida: int
