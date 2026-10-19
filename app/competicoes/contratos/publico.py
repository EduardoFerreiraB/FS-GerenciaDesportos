"""Schemas do portal publico: allowlist explicita, nunca dump de ORM.

Cada campo exposto aqui foi decidido. ``ALLOWLIST_PUBLICA`` repete a decisao
campo a campo; o teste de allowlist falha se um schema ganhar campo sem que
ela seja atualizada. Ficam fora: documento, data de nascimento, foto, contato,
vinculo escolar, motivo de sancao, configuracao e auditoria.
"""

from datetime import date, time

from pydantic import Field

from .comuns import Contrato


class IntegrantePublico(Contrato):
    nome_esportivo: str
    numero_camisa: int | None = None
    posicao: str | None = None


class EquipePublica(Contrato):
    id_equipe: int
    nome: str
    sigla: str | None = None
    id_grupo: int | None = None
    integrantes: list[IntegrantePublico] = Field(default_factory=list)


class GrupoPublico(Contrato):
    id_grupo: int
    nome: str
    ordem: int


class CompeticaoRef(Contrato):
    slug: str
    nome: str


class EventoRef(Contrato):
    slug: str
    nome: str


class EdicaoEventoRef(Contrato):
    identificacao: str
    evento: EventoRef


class EdicaoPublicaResumo(Contrato):
    id_edicao_competicao: int
    identificacao: str
    categoria: str | None = None
    data_inicio: date
    data_fim: date
    formato: str
    estado: str


class EdicaoPublicaDetalhe(EdicaoPublicaResumo):
    competicao: CompeticaoRef
    edicao_evento: EdicaoEventoRef | None = None
    grupos: list[GrupoPublico] = Field(default_factory=list)
    equipes: list[EquipePublica] = Field(default_factory=list)


class CompeticaoPublica(Contrato):
    slug: str
    nome: str
    descricao: str | None = None
    modalidade: str
    edicoes: list[EdicaoPublicaResumo] = Field(default_factory=list)


class EdicaoCompeticaoNoEvento(EdicaoPublicaResumo):
    competicao: CompeticaoRef


class EdicaoEventoPublica(Contrato):
    id_edicao_evento: int
    identificacao: str
    data_inicio: date
    data_fim: date
    competicoes: list[EdicaoCompeticaoNoEvento] = Field(default_factory=list)


class EventoPublico(Contrato):
    slug: str
    nome: str
    descricao: str | None = None
    edicoes: list[EdicaoEventoPublica] = Field(default_factory=list)


class PartidaPublica(Contrato):
    id_partida: int
    id_grupo: int | None = None
    nome_grupo: str | None = None
    fase: str | None = None
    rodada: int | None = None
    ordem_jogo: int
    id_equipe_mandante: int
    nome_mandante: str
    id_equipe_visitante: int
    nome_visitante: str
    data: date | None = None
    hora: time | None = None
    local: str | None = None
    estado: str
    # None enquanto o jogo nao comecou: agendado nao e "0 x 0".
    gols_mandante: int | None = None
    gols_visitante: int | None = None
    penaltis_mandante: int | None = None
    penaltis_visitante: int | None = None


class LinhaClassificacaoPublica(Contrato):
    posicao: int
    id_equipe: int
    nome_equipe: str
    jogos: int
    vitorias: int
    empates: int
    derrotas: int
    gols_pro: int
    gols_contra: int
    saldo_gols: int
    pontos: int
    aproveitamento: float
    empate_persistente: bool


class GrupoClassificacaoPublico(Contrato):
    id_grupo: int
    nome: str
    linhas: list[LinhaClassificacaoPublica] = Field(default_factory=list)


class ClassificacaoPublica(Contrato):
    linhas: list[LinhaClassificacaoPublica] | None = None
    grupos: list[GrupoClassificacaoPublico] | None = None
    possui_empate_persistente: bool = False


class VagaPublica(Contrato):
    posicao: int
    origem: str
    id_equipe: int | None = None
    nome_equipe: str | None = None
    descricao_origem: str | None = None


class DueloPublico(Contrato):
    id_duelo: int
    fase: str
    posicao_chave: int
    estado: str
    ida_volta: bool
    id_equipe_vencedora: int | None = None
    vagas: list[VagaPublica] = Field(default_factory=list)


class ChaveamentoPublico(Contrato):
    duelos: list[DueloPublico] = Field(default_factory=list)


class ArtilheiroPublico(Contrato):
    posicao: int
    nome_esportivo: str
    numero_camisa: int | None = None
    id_equipe: int
    nome_equipe: str
    gols: int
    gols_em_andamento: int = 0


class ArtilhariaPublica(Contrato):
    possui_jogos_em_andamento: bool = False
    artilheiros: list[ArtilheiroPublico] = Field(default_factory=list)


_RESUMO_EDICAO = frozenset({
    "id_edicao_competicao", "identificacao", "categoria", "data_inicio", "data_fim",
    "formato", "estado",
})

ALLOWLIST_PUBLICA: dict[type[Contrato], frozenset[str]] = {
    IntegrantePublico: frozenset({"nome_esportivo", "numero_camisa", "posicao"}),
    EquipePublica: frozenset({"id_equipe", "nome", "sigla", "id_grupo", "integrantes"}),
    GrupoPublico: frozenset({"id_grupo", "nome", "ordem"}),
    CompeticaoRef: frozenset({"slug", "nome"}),
    EventoRef: frozenset({"slug", "nome"}),
    EdicaoEventoRef: frozenset({"identificacao", "evento"}),
    EdicaoPublicaResumo: _RESUMO_EDICAO,
    EdicaoPublicaDetalhe: _RESUMO_EDICAO | {"competicao", "edicao_evento", "grupos", "equipes"},
    CompeticaoPublica: frozenset({"slug", "nome", "descricao", "modalidade", "edicoes"}),
    EdicaoCompeticaoNoEvento: _RESUMO_EDICAO | {"competicao"},
    EdicaoEventoPublica: frozenset({
        "id_edicao_evento", "identificacao", "data_inicio", "data_fim", "competicoes",
    }),
    EventoPublico: frozenset({"slug", "nome", "descricao", "edicoes"}),
    PartidaPublica: frozenset({
        "id_partida", "id_grupo", "nome_grupo", "fase", "rodada", "ordem_jogo",
        "id_equipe_mandante", "nome_mandante", "id_equipe_visitante", "nome_visitante",
        "data", "hora", "local", "estado", "gols_mandante", "gols_visitante",
        "penaltis_mandante", "penaltis_visitante",
    }),
    LinhaClassificacaoPublica: frozenset({
        "posicao", "id_equipe", "nome_equipe", "jogos", "vitorias", "empates", "derrotas",
        "gols_pro", "gols_contra", "saldo_gols", "pontos", "aproveitamento",
        "empate_persistente",
    }),
    GrupoClassificacaoPublico: frozenset({"id_grupo", "nome", "linhas"}),
    ClassificacaoPublica: frozenset({"linhas", "grupos", "possui_empate_persistente"}),
    VagaPublica: frozenset({"posicao", "origem", "id_equipe", "nome_equipe", "descricao_origem"}),
    DueloPublico: frozenset({
        "id_duelo", "fase", "posicao_chave", "estado", "ida_volta", "id_equipe_vencedora",
        "vagas",
    }),
    ChaveamentoPublico: frozenset({"duelos"}),
    ArtilheiroPublico: frozenset({
        "posicao", "nome_esportivo", "numero_camisa", "id_equipe", "nome_equipe", "gols",
        "gols_em_andamento",
    }),
    ArtilhariaPublica: frozenset({"possui_jogos_em_andamento", "artilheiros"}),
}
