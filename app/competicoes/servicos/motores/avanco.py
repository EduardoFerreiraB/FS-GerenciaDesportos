"""Motor puro de resolução de duelos eliminatórios e propagação no grafo de vagas."""

from typing import Any

from competicoes.contratos.classificacao import (
    AtualizacaoVaga,
    ResultadoDueloResolvido,
)
from competicoes.servicos.motores.classificacao import _extrair_gols


def resolver_duelo(
    duelo: dict | Any,
    partidas: list[dict | Any],
) -> ResultadoDueloResolvido:
    """Resolve o resultado esportivo de um duelo eliminatório.

    - Folga: Se uma vaga do duelo possui origem == 'FOLGA', o duelo é imediatamente
      RESOLVIDO com a equipe da outra vaga como vencedora (sem gols, partidas ou pênaltis).
    - Jogo único:
      - Se a partida estiver FINALIZADA:
        - Gols normais decidem.
        - Se empate: confere penaltis_mandante vs penaltis_visitante.
        - Se ainda empatado ou sem pênaltis: estado = 'DEFINIDO', vencedor = None.
    - Ida e Volta:
      - Exige que as 2 partidas estejam FINALIZADAS.
      - Placar agregado: soma dos gols de cada equipe nos 2 jogos.
      - Se agregado empatado: pênaltis registrados na segunda partida decidem.
    """
    d_dict = duelo if isinstance(duelo, dict) else duelo.__dict__
    id_duelo = d_dict["id_duelo"]
    is_ida_volta = bool(d_dict.get("ida_volta", False))
    vagas = d_dict.get("vagas", [])

    # 1. Checagem de FOLGA automática
    vagas_list = [v if isinstance(v, dict) else v.__dict__ for v in vagas]
    for idx, v in enumerate(vagas_list):
        if v.get("origem") == "FOLGA":
            # A outra vaga é a vencedora
            outra_vaga = vagas_list[1 - idx] if len(vagas_list) == 2 else {}
            vencedora = outra_vaga.get("id_equipe_resolvida") or outra_vaga.get("id_equipe")
            return ResultadoDueloResolvido(
                id_duelo=id_duelo,
                id_equipe_vencedora=vencedora,
                id_equipe_perdedora=None,
                estado="RESOLVIDO",
                placar_agregado_mandante=0,
                placar_agregado_visitante=0,
                foi_penaltis=False,
            )

    # 2. Filtrar partidas pertencentes ao duelo
    partidas_list = [p if isinstance(p, dict) else p.__dict__ for p in partidas]
    duelo_partidas = [p for p in partidas_list if p.get("id_duelo") == id_duelo]
    if not duelo_partidas and partidas_list:
        duelo_partidas = partidas_list

    duelo_partidas.sort(key=lambda p: p.get("ordem_jogo", 1))

    # 3. Resolução para Jogo Único
    if not is_ida_volta:
        if not duelo_partidas:
            return ResultadoDueloResolvido(
                id_duelo=id_duelo,
                id_equipe_vencedora=None,
                id_equipe_perdedora=None,
                estado="DEFINIDO",
            )

        p = duelo_partidas[0]
        estado = str(p.get("estado", "")).upper()
        if estado != "FINALIZADA":
            return ResultadoDueloResolvido(
                id_duelo=id_duelo,
                id_equipe_vencedora=None,
                id_equipe_perdedora=None,
                estado="DEFINIDO",
            )

        m = p.get("id_equipe_mandante")
        v = p.get("id_equipe_visitante")
        gm, gv = _extrair_gols(p)

        if gm > gv:
            return ResultadoDueloResolvido(
                id_duelo=id_duelo,
                id_equipe_vencedora=m,
                id_equipe_perdedora=v,
                estado="RESOLVIDO",
                placar_agregado_mandante=gm,
                placar_agregado_visitante=gv,
                foi_penaltis=False,
            )
        elif gv > gm:
            return ResultadoDueloResolvido(
                id_duelo=id_duelo,
                id_equipe_vencedora=v,
                id_equipe_perdedora=m,
                estado="RESOLVIDO",
                placar_agregado_mandante=gm,
                placar_agregado_visitante=gv,
                foi_penaltis=False,
            )
        else:
            # Empate no tempo normal -> verificar pênaltis
            pm = p.get("penaltis_mandante")
            pv = p.get("penaltis_visitante")
            if pm is not None and pv is not None and pm != pv:
                vencedor = m if pm > pv else v
                perdedor = v if pm > pv else m
                return ResultadoDueloResolvido(
                    id_duelo=id_duelo,
                    id_equipe_vencedora=vencedor,
                    id_equipe_perdedora=perdedor,
                    estado="RESOLVIDO",
                    placar_agregado_mandante=gm,
                    placar_agregado_visitante=gv,
                    foi_penaltis=True,
                )
            else:
                return ResultadoDueloResolvido(
                    id_duelo=id_duelo,
                    id_equipe_vencedora=None,
                    id_equipe_perdedora=None,
                    estado="DEFINIDO",
                    placar_agregado_mandante=gm,
                    placar_agregado_visitante=gv,
                    foi_penaltis=False,
                )

    # 4. Resolução para Ida e Volta
    finalizadas = [p for p in duelo_partidas if str(p.get("estado", "")).upper() == "FINALIZADA"]
    if len(finalizadas) < 2:
        return ResultadoDueloResolvido(
            id_duelo=id_duelo,
            id_equipe_vencedora=None,
            id_equipe_perdedora=None,
            estado="DEFINIDO",
        )

    p1 = finalizadas[0]
    p2 = finalizadas[1]

    eq_mandante_ida = p1.get("id_equipe_mandante")
    eq_visitante_ida = p1.get("id_equipe_visitante")

    gm1, gv1 = _extrair_gols(p1)
    gm2, gv2 = _extrair_gols(p2)

    # Agregação de gols por time
    m2 = p2.get("id_equipe_mandante")
    v2 = p2.get("id_equipe_visitante")

    gols_mandante_ida = gm1 + (gm2 if m2 == eq_mandante_ida else (gv2 if v2 == eq_mandante_ida else 0))
    gols_visitante_ida = gv1 + (gm2 if m2 == eq_visitante_ida else (gv2 if v2 == eq_visitante_ida else 0))

    if gols_mandante_ida > gols_visitante_ida:
        return ResultadoDueloResolvido(
            id_duelo=id_duelo,
            id_equipe_vencedora=eq_mandante_ida,
            id_equipe_perdedora=eq_visitante_ida,
            estado="RESOLVIDO",
            placar_agregado_mandante=gols_mandante_ida,
            placar_agregado_visitante=gols_visitante_ida,
            foi_penaltis=False,
        )
    elif gols_visitante_ida > gols_mandante_ida:
        return ResultadoDueloResolvido(
            id_duelo=id_duelo,
            id_equipe_vencedora=eq_visitante_ida,
            id_equipe_perdedora=eq_mandante_ida,
            estado="RESOLVIDO",
            placar_agregado_mandante=gols_mandante_ida,
            placar_agregado_visitante=gols_visitante_ida,
            foi_penaltis=False,
        )
    else:
        # Empate no agregado -> pênaltis no jogo 2 (jogo de volta)
        pm = p2.get("penaltis_mandante")
        pv = p2.get("penaltis_visitante")
        if pm is not None and pv is not None and pm != pv:
            vencedor = m2 if pm > pv else v2
            perdedor = v2 if pm > pv else m2
            return ResultadoDueloResolvido(
                id_duelo=id_duelo,
                id_equipe_vencedora=vencedor,
                id_equipe_perdedora=perdedor,
                estado="RESOLVIDO",
                placar_agregado_mandante=gols_mandante_ida,
                placar_agregado_visitante=gols_visitante_ida,
                foi_penaltis=True,
            )
        else:
            return ResultadoDueloResolvido(
                id_duelo=id_duelo,
                id_equipe_vencedora=None,
                id_equipe_perdedora=None,
                estado="DEFINIDO",
                placar_agregado_mandante=gols_mandante_ida,
                placar_agregado_visitante=gols_visitante_ida,
                foi_penaltis=False,
            )


def propagar_avanco_grafo(
    duelos: list[dict | Any],
    vagas: list[dict | Any],
    duelo_resolvido_id: int,
    equipe_vencedora_id: int,
    equipe_perdedora_id: int | None = None,
) -> list[AtualizacaoVaga]:
    """Propaga o avanço no grafo de vagas de duelos após a resolução de um duelo.

    - Identifica vagas com origem == 'VENCEDOR_DUELO' e id_duelo_origem == duelo_resolvido_id.
    - Identifica vagas com origem == 'PERDEDOR_DUELO' e id_duelo_origem == duelo_resolvido_id.
    """
    todas_vagas = list(vagas)
    for d in duelos:
        d_dict = d if isinstance(d, dict) else d.__dict__
        if "vagas" in d_dict and isinstance(d_dict["vagas"], list):
            for v in d_dict["vagas"]:
                if v not in todas_vagas:
                    todas_vagas.append(v)

    atualizacoes: list[AtualizacaoVaga] = []
    vagas_vistas: set[int] = set()

    for v in todas_vagas:
        v_dict = v if isinstance(v, dict) else v.__dict__
        id_vaga = v_dict.get("id_vaga")
        origem = v_dict.get("origem")
        duelo_origem = v_dict.get("id_duelo_origem")

        if duelo_origem == duelo_resolvido_id and id_vaga is not None:
            if origem == "VENCEDOR_DUELO" and equipe_vencedora_id is not None:
                if id_vaga not in vagas_vistas:
                    vagas_vistas.add(id_vaga)
                    if isinstance(v, dict):
                        v["id_equipe_resolvida"] = equipe_vencedora_id
                    elif hasattr(v, "id_equipe_resolvida"):
                        setattr(v, "id_equipe_resolvida", equipe_vencedora_id)
                    atualizacoes.append(
                        AtualizacaoVaga(
                            id_vaga=id_vaga,
                            id_equipe_resolvida=equipe_vencedora_id,
                        )
                    )
            elif origem == "PERDEDOR_DUELO" and equipe_perdedora_id is not None:
                if id_vaga not in vagas_vistas:
                    vagas_vistas.add(id_vaga)
                    if isinstance(v, dict):
                        v["id_equipe_resolvida"] = equipe_perdedora_id
                    elif hasattr(v, "id_equipe_resolvida"):
                        setattr(v, "id_equipe_resolvida", equipe_perdedora_id)
                    atualizacoes.append(
                        AtualizacaoVaga(
                            id_vaga=id_vaga,
                            id_equipe_resolvida=equipe_perdedora_id,
                        )
                    )

    return atualizacoes
