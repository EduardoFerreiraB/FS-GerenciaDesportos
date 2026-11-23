"""Textos e placar do chaveamento, iguais no painel administrativo e no portal.

- ``rotulo_fase``: nome legível da fase ("Semifinal", "Quartas de final").
- ``descrever_origem``: de onde vem a vaga ("1º do Grupo A", "Vencedor da Semifinal 1").
- ``placar_duelo``: soma dos jogos do duelo (ida e volta) na ordem das vagas.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from competicoes.modelos import DueloEliminatorio, OcorrenciaPartida, Partida, VagaDuelo

_FASES: dict[str, tuple[str, str]] = {
    # fase: (rótulo, contração "de + artigo")
    "FINAL": ("Final", "da"),
    "TERCEIRO_LUGAR": ("Disputa de 3º lugar", "da"),
    "SEMIFINAL": ("Semifinal", "da"),
    "QUARTAS": ("Quartas de final", "das"),
    "OITAVAS": ("Oitavas de final", "das"),
    "DEZESSEIS_AVOS": ("16 avos de final", "dos"),
    "TRINTA_E_DOIS_AVOS": ("32 avos de final", "dos"),
    "SESSENTA_E_QUATRO_AVOS": ("64 avos de final", "dos"),
}

_ESTADOS_COM_PLACAR = ("EM_ANDAMENTO", "FINALIZADA")


def rotulo_fase(fase: str) -> str:
    if fase in _FASES:
        return _FASES[fase][0]
    if fase.startswith("FASE_") and fase.removeprefix("FASE_").isdigit():
        return f"Fase de {fase.removeprefix('FASE_')}"
    return fase.replace("_", " ").capitalize()


def _da_fase(fase: str) -> str:
    rotulo = rotulo_fase(fase)
    artigo = _FASES.get(fase, ("", "da"))[1]
    return f"{artigo} {rotulo}"


def descrever_origem(
    vaga: VagaDuelo,
    grupos: Mapping[int, str],
    duelos: Mapping[int, DueloEliminatorio],
) -> str | None:
    """Texto da origem da vaga, sem enum nem id interno (DF-RT12-03, DF-RT16-06)."""
    if vaga.origem == "POSICAO_GRUPO":
        return f"{vaga.posicao_grupo}º do {grupos.get(vaga.id_grupo, 'grupo')}"
    if vaga.origem in ("VENCEDOR_DUELO", "PERDEDOR_DUELO"):
        papel = "Vencedor" if vaga.origem == "VENCEDOR_DUELO" else "Perdedor"
        origem = duelos.get(vaga.id_duelo_origem)
        if origem is None:
            return papel
        return f"{papel} {_da_fase(origem.fase)} {origem.posicao_chave}"
    if vaga.origem == "FOLGA":
        return "Folga"
    return None


def equipe_da_vaga(vaga: VagaDuelo) -> int | None:
    if vaga.origem == "FOLGA":
        return vaga.id_equipe_resolvida
    return vaga.id_equipe_resolvida or vaga.id_equipe


def placares_dos_duelos(
    db: Session, duelos: Iterable[DueloEliminatorio]
) -> dict[int, dict[str, list[int | None]] | None]:
    """``{id_duelo: {"gols": [a, b], "penaltis": [a, b]} | None}`` na ordem das vagas.

    Soma os jogos já iniciados do duelo (ida e volta agregadas). Pênaltis vêm do jogo
    que os teve (o decisivo). ``None`` quando nenhum jogo do duelo começou.
    """
    duelos = list(duelos)
    ids = [d.id_duelo for d in duelos]
    if not ids:
        return {}
    partidas = db.execute(
        select(Partida).where(Partida.id_duelo.in_(ids), Partida.estado.in_(_ESTADOS_COM_PLACAR))
    ).scalars().all()
    gols = db.execute(
        select(OcorrenciaPartida.id_partida, OcorrenciaPartida.id_equipe_beneficiada).where(
            OcorrenciaPartida.id_partida.in_([p.id_partida for p in partidas] or [-1]),
            OcorrenciaPartida.tipo.in_(("GOL", "GOL_CONTRA")),
        )
    ).all()

    resultado: dict[int, dict[str, list[int | None]] | None] = {}
    for duelo in duelos:
        do_duelo = [p for p in partidas if p.id_duelo == duelo.id_duelo]
        if not do_duelo:
            resultado[duelo.id_duelo] = None
            continue
        equipes = [equipe_da_vaga(v) for v in sorted(duelo.vagas, key=lambda v: v.posicao)][:2]
        while len(equipes) < 2:
            equipes.append(None)
        ids_partidas = {p.id_partida for p in do_duelo}
        placar_gols = [
            sum(1 for id_p, beneficiada in gols if id_p in ids_partidas and beneficiada == equipe)
            if equipe is not None else None
            for equipe in equipes
        ]
        penaltis: list[int | None] = [None, None]
        for p in do_duelo:
            if p.penaltis_mandante is None and p.penaltis_visitante is None:
                continue
            por_equipe = {p.id_equipe_mandante: p.penaltis_mandante,
                          p.id_equipe_visitante: p.penaltis_visitante}
            penaltis = [por_equipe.get(equipe) for equipe in equipes]
        resultado[duelo.id_duelo] = {"gols": placar_gols, "penaltis": penaltis}
    return resultado
