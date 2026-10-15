"""Motor de Geração de Confrontos e Chaveamento V2.

Suporta:
1. PONTOS_CORRIDOS: Turno único e Turno e Returno (Ida e Volta) via algoritmo round-robin.
2. GRUPOS / GRUPOS_MATA_MATA: Distribuição em grupos, jogos de grupos (turno único ou ida/volta),
   chaveamento eliminatório cruzado (ex: 1ºA x 2ºB, 1ºB x 2ºA), ida e volta no mata-mata e 3º lugar.
3. MATA_MATA / MATA_MATA_DIRETO: Chaveamento eliminatório flexível (Oitavas, Quartas, Semifinal, Final),
   suporte a ida e volta, final em jogo único e disputa de 3º lugar.
4. Trava de segurança retroativa contra alterações indevidas de fases já iniciadas/finalizadas.
5. Agregação de placares para duelos de ida e volta.
"""

from __future__ import annotations

from datetime import date, time, timedelta
from typing import List, Optional, Union
from sqlalchemy.orm import Session

import models
import schemas


def _obter_competicao(db: Session, competicao_ou_id: Union[models.Competicao, int]) -> models.Competicao:
    """Carrega a entidade de competição a partir do id ou instância existente."""
    if isinstance(competicao_ou_id, models.Competicao):
        comp = competicao_ou_id
    else:
        comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == competicao_ou_id).first()

    if not comp:
        raise ValueError("Competição não encontrada.")
    if comp.modo_inscricao == "INDIVIDUAL":
        raise ValueError("Operações de confronto só são permitidas para competições em modo EQUIPE.")
    if comp.status == "RASCUNHO":
        raise ValueError("Não é possível gerar confrontos para competição em status RASCUNHO.")
    return comp


def _obter_local_e_arbitro(
    db: Session,
    id_local_padrao: Optional[int] = None,
    id_arbitro_padrao: Optional[int] = None,
) -> tuple[models.Local, models.Arbitro]:
    """Obtém local e árbitro padrão ativos para agendamento dos jogos."""
    local = None
    if id_local_padrao:
        local = db.query(models.Local).filter(models.Local.id_local == id_local_padrao, models.Local.ativo == True).first()
    if not local:
        local = db.query(models.Local).filter(models.Local.ativo == True).first()
    if not local:
        raise ValueError("Nenhum local ativo cadastrado.")

    arbitro = None
    if id_arbitro_padrao:
        arbitro = db.query(models.Arbitro).filter(models.Arbitro.id_arbitro == id_arbitro_padrao).first()
    if not arbitro:
        arbitro = db.query(models.Arbitro).first()
    if not arbitro:
        raise ValueError("Nenhum árbitro cadastrado.")

    return local, arbitro


def verificar_bloqueio_retroativo(db: Session, confronto: models.Confronto) -> None:
    """Verifica se uma alteração no confronto é permitida ou se a fase posterior já começou.

    Trava de segurança: se o próximo confronto (ou o jogo de volta, ou a disputa de 3º lugar)
    já estiver 'Em Andamento' ou 'Finalizado', lança ValueError.
    """
    # 1. Trava pelo próximo confronto da árvore eliminatória
    if confronto.id_proximo_confronto:
        proximo = db.query(models.Confronto).filter(
            models.Confronto.id_confronto == confronto.id_proximo_confronto
        ).first()
        if proximo and proximo.status in ("Em Andamento", "Finalizado"):
            raise ValueError("Não é possível alterar ou finalizar o confronto pois a próxima fase já foi iniciada ou finalizada.")

    # 2. Trava pelo jogo de volta (se este for jogo de ida)
    jogo_volta = db.query(models.Confronto).filter(
        models.Confronto.id_confronto_ida == confronto.id_confronto
    ).first()
    if jogo_volta and jogo_volta.status in ("Em Andamento", "Finalizado"):
        raise ValueError("Não é possível alterar o confronto de ida pois o confronto de volta já foi iniciado ou finalizado.")

    # 3. Trava pela disputa de 3º lugar (se este confronto for uma semifinal)
    if confronto.fase and "semi" in confronto.fase.lower():
        jogo_3lugar = db.query(models.Confronto).filter(
            models.Confronto.id_competicao == confronto.id_competicao,
            models.Confronto.fase.ilike("%3º%"),
        ).first()
        if not jogo_3lugar:
            jogo_3lugar = db.query(models.Confronto).filter(
                models.Confronto.id_competicao == confronto.id_competicao,
                models.Confronto.fase.ilike("%terceiro%"),
            ).first()

        if jogo_3lugar and jogo_3lugar.status in ("Em Andamento", "Finalizado"):
            raise ValueError("Não é possível alterar o resultado da semifinal pois a disputa de 3º lugar já foi iniciada ou finalizada.")


def calcular_agregado_ida_volta(db: Session, confronto_volta: models.Confronto) -> dict:
    """Calcula o placar agregado para duelos de ida e volta.

    Retorna dicionário com:
    - id_equipe_mandante: id da equipe mandante na volta
    - id_equipe_visitante: id da equipe visitante na volta
    - gols_total_mandante: soma dos gols da equipe mandante na volta (ida + volta)
    - gols_total_visitante: soma dos gols da equipe visitante na volta (ida + volta)
    - empate: bool se agregado empatado
    - confronto_ida: entidade do jogo de ida
    """
    if not confronto_volta.id_confronto_ida:
        raise ValueError("O confronto informado não possui jogo de ida vinculado.")

    confronto_ida = db.query(models.Confronto).filter(
        models.Confronto.id_confronto == confronto_volta.id_confronto_ida
    ).first()
    if not confronto_ida:
        raise ValueError("Confronto de ida não encontrado no banco de dados.")

    # Equipes na volta:
    mandante_volta = confronto_volta.id_equipe_mandante
    visitante_volta = confronto_volta.id_equipe_visitante

    # Gols na volta:
    gols_mandante_volta = confronto_volta.placar_mandante or 0
    gols_visitante_volta = confronto_volta.placar_visitante or 0

    # Gols na ida:
    if confronto_ida.id_equipe_mandante == mandante_volta:
        gols_mandante_ida = confronto_ida.placar_mandante or 0
        gols_visitante_ida = confronto_ida.placar_visitante or 0
    else:
        # Padrão: mandante na volta foi visitante na ida
        gols_mandante_ida = confronto_ida.placar_visitante or 0
        gols_visitante_ida = confronto_ida.placar_mandante or 0

    total_mandante = gols_mandante_ida + gols_mandante_volta
    total_visitante = gols_visitante_ida + gols_visitante_volta

    return {
        "id_equipe_mandante": mandante_volta,
        "id_equipe_visitante": visitante_volta,
        "gols_total_mandante": total_mandante,
        "gols_total_visitante": total_visitante,
        "empate": total_mandante == total_visitante,
        "confronto_ida": confronto_ida,
        "confronto_volta": confronto_volta,
    }


def _limpar_confrontos_existentes(db: Session, id_competicao: int) -> None:
    """Exclui confrontos agendados existentes para recriação limpa."""
    existentes = db.query(models.Confronto).filter(models.Confronto.id_competicao == id_competicao).all()
    if any(c.status in ["Em Andamento", "Finalizado"] for c in existentes):
        raise ValueError("Não é possível gerar novos confrontos porque já existem confrontos em andamento ou finalizados.")

    # Desvincula foreign keys reflexivas antes de deletar
    for c in existentes:
        c.id_proximo_confronto = None
        c.id_confronto_ida = None
    db.flush()

    for c in existentes:
        db.delete(c)
    db.flush()


# ==============================================================================
# GERADORES POR FORMATO
# ==============================================================================

def _gerar_pontos_corridos(
    db: Session,
    comp: models.Competicao,
    equipes: List[models.Equipe],
    local: models.Local,
    arbitro: models.Arbitro,
    data_inicio: date,
    hora_padrao: time,
    regras: dict,
) -> List[models.Confronto]:
    """Gera tabela de pontos corridos com suporte a Turno Único ou Turno e Returno."""
    if len(equipes) < 2:
        raise ValueError("É necessário ter pelo menos 2 equipes registradas para gerar confrontos de pontos corridos.")

    turno_e_returno = bool(
        regras.get("turno_e_returno", False)
        or regras.get("turno_returno", False)
        or regras.get("ida_e_volta", False)
    )

    lista_equipes = list(equipes)
    if len(lista_equipes) % 2 != 0:
        lista_equipes.append(None)  # Folga (bye)

    n = len(lista_equipes)
    rodadas_turno = n - 1
    jogos_por_rodada = n // 2

    confrontos_gerados = []
    jogos_turno_pares = []

    # 1º Turno (Round-Robin com rotação de Berger)
    for r in range(rodadas_turno):
        data_rodada = data_inicio + timedelta(weeks=r)
        for j in range(jogos_por_rodada):
            # Alterna mandos para equilibrar casa e fora
            if (r + j) % 2 == 1:
                mandante = lista_equipes[n - 1 - j]
                visitante = lista_equipes[j]
            else:
                mandante = lista_equipes[j]
                visitante = lista_equipes[n - 1 - j]

            if mandante is not None and visitante is not None:
                confronto = models.Confronto(
                    id_competicao=comp.id_competicao,
                    id_equipe_mandante=mandante.id_equipe,
                    id_equipe_visitante=visitante.id_equipe,
                    fase=f"Rodada {r + 1}",
                    rodada=r + 1,
                    ordem_jogo=1,
                    data=data_rodada,
                    hora=hora_padrao,
                    id_local=local.id_local,
                    id_arbitro=arbitro.id_arbitro,
                    status="Agendado",
                )
                db.add(confronto)
                confrontos_gerados.append(confronto)
                jogos_turno_pares.append((r + 1, mandante, visitante))

        # Rotação do polígono de Berger: mantém o primeiro elemento fixo
        lista_equipes = [lista_equipes[0]] + [lista_equipes[-1]] + lista_equipes[1:-1]

    # 2º Turno (Returno com mandos rigorosamente invertidos)
    if turno_e_returno:
        for rodada_turno, mandante_orig, visitante_orig in jogos_turno_pares:
            rodada_returno = rodadas_turno + rodada_turno
            data_rodada_returno = data_inicio + timedelta(weeks=rodada_returno - 1)

            confronto_ret = models.Confronto(
                id_competicao=comp.id_competicao,
                id_equipe_mandante=visitante_orig.id_equipe,  # Mando invertido
                id_equipe_visitante=mandante_orig.id_equipe,
                fase=f"Rodada {rodada_returno}",
                rodada=rodada_returno,
                ordem_jogo=2,
                data=data_rodada_returno,
                hora=hora_padrao,
                id_local=local.id_local,
                id_arbitro=arbitro.id_arbitro,
                status="Agendado",
            )
            db.add(confronto_ret)
            confrontos_gerados.append(confronto_ret)

    db.flush()
    return confrontos_gerados


def _gerar_grupos_mata_mata(
    db: Session,
    comp: models.Competicao,
    equipes: List[models.Equipe],
    local: models.Local,
    arbitro: models.Arbitro,
    data_inicio: date,
    hora_padrao: time,
    regras: dict,
) -> List[models.Confronto]:
    """Gera fase de grupos e chaveamento eliminatório (cruzamento olímpico e mata-mata)."""
    qtd_grupos = int(regras.get("qtd_grupos", 2))
    classificados_por_grupo = int(regras.get("classificados_por_grupo", 2))
    jogos_ida_volta_grupo = bool(
        regras.get("jogos_ida_volta_grupo", False)
        or regras.get("fase_grupos_ida_e_volta", False)
    )
    jogos_ida_volta_mata = bool(
        regras.get("jogos_ida_volta_mata_mata", False)
        or regras.get("mata_mata_ida_e_volta", False)
    )
    final_jogo_unico = bool(regras.get("final_jogo_unico", True))
    disputa_3lugar = bool(regras.get("disputa_terceiro_lugar", True))

    if len(equipes) < qtd_grupos * 2:
        raise ValueError(f"É necessário ter pelo menos {qtd_grupos * 2} equipes para gerar {qtd_grupos} grupos.")

    # 1. Distribuição de equipes nos grupos (ex: 'A', 'B', 'C'...)
    letras_grupos = [chr(ord('A') + i) for i in range(qtd_grupos)]
    equipes_sem_grupo = [eq for eq in equipes if not eq.grupo or eq.grupo not in letras_grupos]
    if equipes_sem_grupo:
        for idx, eq in enumerate(equipes):
            eq.grupo = letras_grupos[idx % qtd_grupos]
        db.flush()

    grupos: dict[str, List[models.Equipe]] = {g: [] for g in letras_grupos}
    for eq in equipes:
        if eq.grupo in grupos:
            grupos[eq.grupo].append(eq)

    confrontos_gerados = []
    max_semanas_grupos = 1

    # 2. Gerar jogos da fase de grupos
    for g_letra, lista_eqs in grupos.items():
        if len(lista_eqs) < 2:
            continue

        rot = list(lista_eqs)
        if len(rot) % 2 != 0:
            rot.append(None)
        n = len(rot)
        rodadas_turno = n - 1
        jogos_por_rodada = n // 2
        semanas_g = rodadas_turno * (2 if jogos_ida_volta_grupo else 1)
        max_semanas_grupos = max(max_semanas_grupos, semanas_g)

        jogos_turno_grupo = []
        for r in range(rodadas_turno):
            data_rod = data_inicio + timedelta(weeks=r)
            for j in range(jogos_por_rodada):
                if (r + j) % 2 == 1:
                    m = rot[n - 1 - j]
                    v = rot[j]
                else:
                    m = rot[j]
                    v = rot[n - 1 - j]

                if m is not None and v is not None:
                    c = models.Confronto(
                        id_competicao=comp.id_competicao,
                        id_equipe_mandante=m.id_equipe,
                        id_equipe_visitante=v.id_equipe,
                        fase=f"Grupo {g_letra} - Rodada {r + 1}",
                        rodada=r + 1,
                        grupo=g_letra,
                        ordem_jogo=1,
                        data=data_rod,
                        hora=hora_padrao,
                        id_local=local.id_local,
                        id_arbitro=arbitro.id_arbitro,
                        status="Agendado",
                    )
                    db.add(c)
                    confrontos_gerados.append(c)
                    jogos_turno_grupo.append((r + 1, m, v))
            rot = [rot[0]] + [rot[-1]] + rot[1:-1]

        # Returno da fase de grupos se configurado
        if jogos_ida_volta_grupo:
            for rod_t, m_orig, v_orig in jogos_turno_grupo:
                rod_ret = rodadas_turno + rod_t
                data_rod_ret = data_inicio + timedelta(weeks=rod_ret - 1)
                c_ret = models.Confronto(
                    id_competicao=comp.id_competicao,
                    id_equipe_mandante=v_orig.id_equipe,
                    id_equipe_visitante=m_orig.id_equipe,
                    fase=f"Grupo {g_letra} - Rodada {rod_ret}",
                    rodada=rod_ret,
                    grupo=g_letra,
                    ordem_jogo=2,
                    data=data_rod_ret,
                    hora=hora_padrao,
                    id_local=local.id_local,
                    id_arbitro=arbitro.id_arbitro,
                    status="Agendado",
                )
                db.add(c_ret)
                confrontos_gerados.append(c_ret)

    # 3. Gerar árvore de Mata-Mata
    data_mata = data_inicio + timedelta(weeks=max_semanas_grupos + 1)
    data_final = data_mata + timedelta(weeks=2 if jogos_ida_volta_mata else 1)

    # Final
    if jogos_ida_volta_mata and not final_jogo_unico:
        final_ida = models.Confronto(
            id_competicao=comp.id_competicao,
            fase="Final - Ida",
            ordem_jogo=1,
            data=data_final,
            hora=hora_padrao,
            id_local=local.id_local,
            id_arbitro=arbitro.id_arbitro,
            status="Agendado",
        )
        db.add(final_ida)
        db.flush()
        confrontos_gerados.append(final_ida)

        final_volta = models.Confronto(
            id_competicao=comp.id_competicao,
            fase="Final - Volta",
            ordem_jogo=2,
            id_confronto_ida=final_ida.id_confronto,
            data=data_final + timedelta(weeks=1),
            hora=hora_padrao,
            id_local=local.id_local,
            id_arbitro=arbitro.id_arbitro,
            status="Agendado",
        )
        db.add(final_volta)
        db.flush()
        confrontos_gerados.append(final_volta)
        alvo_final = final_ida
    else:
        final = models.Confronto(
            id_competicao=comp.id_competicao,
            fase="Final",
            ordem_jogo=1,
            data=data_final,
            hora=hora_padrao,
            id_local=local.id_local,
            id_arbitro=arbitro.id_arbitro,
            status="Agendado",
            observacoes="Vencedor Semifinal 1 vs Vencedor Semifinal 2",
        )
        db.add(final)
        db.flush()
        confrontos_gerados.append(final)
        alvo_final = final

    # Disputa de 3º Lugar
    if disputa_3lugar:
        terceiro = models.Confronto(
            id_competicao=comp.id_competicao,
            fase="Disputa 3º Lugar",
            ordem_jogo=1,
            data=data_final - timedelta(days=1),
            hora=hora_padrao,
            id_local=local.id_local,
            id_arbitro=arbitro.id_arbitro,
            status="Agendado",
            observacoes="Perdedor Semifinal 1 vs Perdedor Semifinal 2",
        )
        db.add(terceiro)
        db.flush()
        confrontos_gerados.append(terceiro)

    # Semifinais (cruzamento clássico 1ºA x 2ºB e 1ºB x 2ºA)
    semis_def = [
        ("Semifinal 1", "1º Grupo A vs 2º Grupo B"),
        ("Semifinal 2", "1º Grupo B vs 2º Grupo A"),
    ]

    for fase_nome, obs in semis_def:
        if jogos_ida_volta_mata:
            semi_ida = models.Confronto(
                id_competicao=comp.id_competicao,
                fase=f"{fase_nome} - Ida",
                ordem_jogo=1,
                data=data_mata,
                hora=hora_padrao,
                id_local=local.id_local,
                id_arbitro=arbitro.id_arbitro,
                status="Agendado",
                observacoes=f"{obs} (Ida)",
            )
            db.add(semi_ida)
            db.flush()
            confrontos_gerados.append(semi_ida)

            semi_volta = models.Confronto(
                id_competicao=comp.id_competicao,
                id_proximo_confronto=alvo_final.id_confronto,
                id_confronto_ida=semi_ida.id_confronto,
                fase=f"{fase_nome} - Volta",
                ordem_jogo=2,
                data=data_mata + timedelta(weeks=1),
                hora=hora_padrao,
                id_local=local.id_local,
                id_arbitro=arbitro.id_arbitro,
                status="Agendado",
                observacoes=f"{obs} (Volta)",
            )
            db.add(semi_volta)
            db.flush()
            confrontos_gerados.append(semi_volta)
        else:
            semi = models.Confronto(
                id_competicao=comp.id_competicao,
                id_proximo_confronto=alvo_final.id_confronto,
                fase=fase_nome,
                ordem_jogo=1,
                data=data_mata,
                hora=hora_padrao,
                id_local=local.id_local,
                id_arbitro=arbitro.id_arbitro,
                status="Agendado",
                observacoes=obs,
            )
            db.add(semi)
            db.flush()
            confrontos_gerados.append(semi)

    return confrontos_gerados


def _gerar_mata_mata_direto(
    db: Session,
    comp: models.Competicao,
    equipes: List[models.Equipe],
    local: models.Local,
    arbitro: models.Arbitro,
    data_inicio: date,
    hora_padrao: time,
    regras: dict,
) -> List[models.Confronto]:
    """Gera chaveamento de mata-mata direto (Semifinal/Quartas/etc.), com ida e volta opcional e 3º lugar."""
    if len(equipes) < 2:
        raise ValueError("É necessário ter pelo menos 2 equipes registradas para gerar o chaveamento de mata-mata.")

    fases_hierarquia = ["Final", "Semifinal", "Quartas", "Oitavas"]
    fase_inicial_str = regras.get("fase_inicial", "Semifinal")

    # Normaliza nome da fase (evita substring falso positivo de 'final' em 'semifinal')
    fase_str_clean = str(fase_inicial_str).strip().lower()
    if "semi" in fase_str_clean:
        fase_inicial = "Semifinal"
    elif "quarta" in fase_str_clean:
        fase_inicial = "Quartas"
    elif "oitava" in fase_str_clean:
        fase_inicial = "Oitavas"
    else:
        fase_inicial = "Final"

    idx_limite = fases_hierarquia.index(fase_inicial)
    max_equipes = 2 ** (idx_limite + 1)
    if len(equipes) > max_equipes:
        raise ValueError(f"Quantidade de equipes ({len(equipes)}) excede o limite permitido para {fase_inicial} ({max_equipes}).")

    jogos_ida_volta = bool(
        regras.get("jogos_ida_volta", False)
        or regras.get("ida_e_volta", False)
    )
    final_jogo_unico = bool(regras.get("final_jogo_unico", True if jogos_ida_volta else False))
    disputa_3lugar = bool(regras.get("disputa_terceiro_lugar", True))

    fases_a_gerar = fases_hierarquia[:idx_limite + 1]  # Ex: ["Final", "Semifinal"]
    confrontos_gerados = []
    jogos_por_fase: dict[str, List[models.Confronto]] = {}

    # Gera da Final para trás
    for idx_fase, fase_nome in enumerate(fases_a_gerar):
        num_duelos = 2 ** idx_fase
        semanas_distancia = (idx_limite - idx_fase) * (2 if jogos_ida_volta else 1)
        data_duelo = data_inicio + timedelta(weeks=semanas_distancia)

        duelos_da_fase = []
        for d in range(num_duelos):
            id_prox = None
            if fase_nome != "Final":
                fase_superior = fases_a_gerar[idx_fase - 1]
                prox_duelo = jogos_por_fase[fase_superior][d // 2]
                id_prox = prox_duelo.id_confronto

            nome_jogo = f"{fase_nome} {d + 1}" if num_duelos > 1 else fase_nome
            duelo_ida_volta = jogos_ida_volta and not (fase_nome == "Final" and final_jogo_unico)

            if duelo_ida_volta:
                ida = models.Confronto(
                    id_competicao=comp.id_competicao,
                    fase=f"{nome_jogo} - Ida",
                    ordem_jogo=1,
                    data=data_duelo,
                    hora=hora_padrao,
                    id_local=local.id_local,
                    id_arbitro=arbitro.id_arbitro,
                    status="Agendado",
                )
                db.add(ida)
                db.flush()
                confrontos_gerados.append(ida)

                volta = models.Confronto(
                    id_competicao=comp.id_competicao,
                    id_proximo_confronto=id_prox,
                    id_confronto_ida=ida.id_confronto,
                    fase=f"{nome_jogo} - Volta",
                    ordem_jogo=2,
                    data=data_duelo + timedelta(weeks=1),
                    hora=hora_padrao,
                    id_local=local.id_local,
                    id_arbitro=arbitro.id_arbitro,
                    status="Agendado",
                )
                db.add(volta)
                db.flush()
                confrontos_gerados.append(volta)
                duelos_da_fase.append(volta)
            else:
                jogo = models.Confronto(
                    id_competicao=comp.id_competicao,
                    id_proximo_confronto=id_prox,
                    fase=nome_jogo,
                    ordem_jogo=1,
                    data=data_duelo,
                    hora=hora_padrao,
                    id_local=local.id_local,
                    id_arbitro=arbitro.id_arbitro,
                    status="Agendado",
                )
                db.add(jogo)
                db.flush()
                confrontos_gerados.append(jogo)
                duelos_da_fase.append(jogo)

        jogos_por_fase[fase_nome] = duelos_da_fase

    # Disputa de 3º Lugar se configurada e existirem semifinais
    if disputa_3lugar and "Semifinal" in fases_a_gerar:
        semanas_final = idx_limite * (2 if jogos_ida_volta else 1)
        data_3lugar = data_inicio + timedelta(weeks=semanas_final) - timedelta(days=1)
        terceiro = models.Confronto(
            id_competicao=comp.id_competicao,
            fase="Disputa 3º Lugar",
            ordem_jogo=1,
            data=data_3lugar,
            hora=hora_padrao,
            id_local=local.id_local,
            id_arbitro=arbitro.id_arbitro,
            status="Agendado",
            observacoes="Perdedor Semifinal 1 vs Perdedor Semifinal 2",
        )
        db.add(terceiro)
        db.flush()
        confrontos_gerados.append(terceiro)

    # 4. Alocação das equipes registradas na fase inicial
    duelos_iniciais = jogos_por_fase[fase_inicial]
    for i, duelo in enumerate(duelos_iniciais):
        idx_m = 2 * i
        idx_v = 2 * i + 1
        mandante_id = equipes[idx_m].id_equipe if idx_m < len(equipes) else None
        visitante_id = equipes[idx_v].id_equipe if idx_v < len(equipes) else None

        if duelo.id_confronto_ida:
            # Ida e Volta na fase inicial:
            ida_jogo = db.query(models.Confronto).filter(
                models.Confronto.id_confronto == duelo.id_confronto_ida
            ).first()
            if ida_jogo:
                ida_jogo.id_equipe_mandante = mandante_id
                ida_jogo.id_equipe_visitante = visitante_id
            # Volta inverte mandos
            duelo.id_equipe_mandante = visitante_id
            duelo.id_equipe_visitante = mandante_id
        else:
            duelo.id_equipe_mandante = mandante_id
            duelo.id_equipe_visitante = visitante_id

    return confrontos_gerados


# ==============================================================================
# FUNÇÃO PRINCIPAL DE GERAÇÃO V2
# ==============================================================================

def gerar_tabela_confrontos_v2(
    db: Session,
    competicao: Union[models.Competicao, int],
    id_local_padrao: Optional[int] = None,
    id_arbitro_padrao: Optional[int] = None,
    data_inicio: Optional[date] = None,
    hora_padrao: Optional[time] = None,
) -> List[models.Confronto]:
    """Gera tabela completa de confrontos com base no formato e regras dinâmicas da competição."""
    comp = _obter_competicao(db, competicao)
    local, arbitro = _obter_local_e_arbitro(db, id_local_padrao, id_arbitro_padrao)

    data_in = data_inicio or comp.data_inicio or date.today()
    hora_in = hora_padrao or time(14, 0)
    regras = comp.regras_formato or {}

    _limpar_confrontos_existentes(db, comp.id_competicao)

    equipes = db.query(models.Equipe).filter(models.Equipe.id_competicao == comp.id_competicao).all()

    formato = (comp.formato or "").upper()

    if formato in ("PONTOS_CORRIDOS",):
        confrontos = _gerar_pontos_corridos(
            db, comp, equipes, local, arbitro, data_in, hora_in, regras
        )
    elif formato in ("GRUPOS", "GRUPOS_MATA_MATA"):
        confrontos = _gerar_grupos_mata_mata(
            db, comp, equipes, local, arbitro, data_in, hora_in, regras
        )
    elif formato in ("MATA_MATA", "MATA_MATA_DIRETO"):
        confrontos = _gerar_mata_mata_direto(
            db, comp, equipes, local, arbitro, data_in, hora_in, regras
        )
    else:
        raise ValueError(f"Formato de competição não suportado para geração de confrontos: {formato}")

    db.commit()
    for c in confrontos:
        db.refresh(c)
    return confrontos


# Alias para conformidade e conveniência
gerar_confrontos_v2 = gerar_tabela_confrontos_v2
