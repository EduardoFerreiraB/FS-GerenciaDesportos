"""Contratos Pydantic para estrutura de disputa (grupos, duelos, vagas e partidas simples)."""

from typing import Annotated

from pydantic import Field, StringConstraints

from .comuns import Contrato

Nome = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class GrupoCriar(Contrato):
    nome: Nome
    ordem: int = 1


class GrupoDetalhe(Contrato):
    id_grupo: int
    id_edicao_competicao: int
    nome: Nome
    ordem: int
    equipes: list[int] = Field(default_factory=list)


class DistribuicaoGruposEntrada(Contrato):
    distribuicao: dict[str, list[int]]


class VagaDueloDetalhe(Contrato):
    id_vaga: int | None = None
    id_duelo: int | None = None
    posicao: int
    origem: str
    id_equipe: int | None = None
    id_grupo: int | None = None
    nome_grupo: str | None = None
    posicao_grupo: int | None = None
    id_duelo_origem: int | None = None
    posicao_duelo_origem: int | None = None
    fase_origem: str | None = None
    id_equipe_resolvida: int | None = None


class DueloDetalhe(Contrato):
    id_duelo: int | None = None
    id_edicao_competicao: int | None = None
    fase: str
    posicao_chave: int
    estado: str = "PENDENTE"
    id_equipe_vencedora: int | None = None
    ida_volta: bool = False
    vagas: list[VagaDueloDetalhe] = Field(default_factory=list)


class PartidaSimples(Contrato):
    id_partida: int | None = None
    id_equipe_mandante: int
    id_equipe_visitante: int
    rodada: int | None = None
    ordem_jogo: int = 1
    id_grupo: int | None = None
    nome_grupo: str | None = None
    id_duelo: int | None = None
    estado: str = "AGENDADA"


class RodadaGerada(Contrato):
    rodada: int
    partidas: list[PartidaSimples] = Field(default_factory=list)


class TabelaGeradaResultado(Contrato):
    rodadas: list[RodadaGerada] = Field(default_factory=list)
    duelos: list[DueloDetalhe] = Field(default_factory=list)


class TabelaGerar(Contrato):
    distribuicao_grupos: dict[str, list[int]] | None = None


class EstruturaDisputaDetalhe(Contrato):
    id_edicao_competicao: int
    formato: str
    estado: str
    grupos: list[GrupoDetalhe] = Field(default_factory=list)
    duelos: list[DueloDetalhe] = Field(default_factory=list)
    rodadas: list[RodadaGerada] = Field(default_factory=list)
    partidas: list[PartidaSimples] = Field(default_factory=list)
    total_partidas: int = 0
