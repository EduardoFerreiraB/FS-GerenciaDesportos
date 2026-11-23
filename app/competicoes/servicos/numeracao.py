"""Numeração de jogos exibida ao usuário ("Jogo 7").

O número é derivado (não fica gravado): 1..N por edição, primeiro a fase de grupos ou
pontos corridos e depois o mata-mata, fase a fase. Como depende só da posição estrutural
da partida (rodada, grupo, ordem, fase, posição na chave), reabrir ou refinalizar um jogo
não muda a numeração dos demais.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from competicoes.modelos.disputa import DueloEliminatorio
from competicoes.modelos.partidas import Partida

# Fases do mata-mata na ordem em que acontecem; a disputa de 3º lugar vem antes da final.
ORDEM_FASES: tuple[str, ...] = (
    "SESSENTA_E_QUATRO_AVOS",
    "TRINTA_E_DOIS_AVOS",
    "DEZESSEIS_AVOS",
    "OITAVAS",
    "QUARTAS",
    "SEMIFINAL",
    "TERCEIRO_LUGAR",
    "FINAL",
)
_POSICAO_FASE = {fase: indice for indice, fase in enumerate(ORDEM_FASES)}


def numerar_jogos(
    partidas: Iterable[Partida],
    duelos: Mapping[int, tuple[str, int]],
) -> dict[int, int]:
    """Devolve ``{id_partida: numero_jogo}`` para as partidas de uma edição.

    ``duelos`` mapeia ``id_duelo`` → ``(fase, posicao_chave)``.
    """

    def chave(partida: Partida) -> tuple:
        if partida.id_duelo is None:
            return (
                0, 0, partida.rodada or 0, partida.id_grupo or 0,
                partida.ordem_jogo or 0, partida.id_partida,
            )
        fase, posicao_chave = duelos.get(partida.id_duelo, ("", 0))
        return (
            1, _POSICAO_FASE.get(fase, len(ORDEM_FASES)), posicao_chave or 0, 0,
            partida.ordem_jogo or 0, partida.id_partida,
        )

    ordenadas = sorted(partidas, key=chave)
    return {p.id_partida: indice for indice, p in enumerate(ordenadas, start=1)}


def mapa_numeros_jogos(db: Session, id_edicao: int) -> dict[int, int]:
    """Numeração de todas as partidas da edição (uma consulta por tabela)."""
    partidas = db.execute(
        select(Partida).where(Partida.id_edicao_competicao == id_edicao)
    ).scalars().all()
    duelos = {
        d.id_duelo: (d.fase, d.posicao_chave)
        for d in db.execute(
            select(DueloEliminatorio).where(DueloEliminatorio.id_edicao_competicao == id_edicao)
        ).scalars()
    }
    return numerar_jogos(partidas, duelos)
