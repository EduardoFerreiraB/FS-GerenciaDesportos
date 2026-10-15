"""Súmula Rápida de Beira de Campo e Gestão de Partidas V2.

Permite:
1. Registro instantâneo de gols normais e contra, atualizando imediatamente o placar do confronto.
2. Remoção de gols com decremento do placar.
3. Registro de advertências disciplinares (cartões amarelos e vermelhos), com conversão automática
   do 2º cartão amarelo em cartão vermelho correspondente.
4. Encerramento de confrontos com resolução de empates via agregação de placares em ida e volta,
   desempate por cobranças de pênaltis e promoção automática na árvore eliminatória (Final e 3º Lugar).
5. Trava retroativa rigorosa impedindo alteração de fases cujos jogos subsequentes já começaram.
"""

from __future__ import annotations

from typing import Optional
from sqlalchemy.orm import Session

import models
from services import confrontos_v2


def _obter_confronto(db: Session, id_confronto: int) -> models.Confronto:
    """Busca o confronto ou levanta erro de validação."""
    confronto = db.query(models.Confronto).filter(models.Confronto.id_confronto == id_confronto).first()
    if not confronto:
        raise ValueError("Confronto não encontrado.")
    return confronto


def adicionar_gol(
    db: Session,
    id_confronto: int,
    id_equipe: int,
    id_jogador: Optional[int] = None,
    minuto: Optional[int] = None,
    contra: bool = False,
    tempo_jogo: Optional[str] = "1T",
    observacao: Optional[str] = None,
) -> models.OcorrenciaPartida:
    """Registra uma ocorrência de gol e incrementa o placar do confronto em tempo real."""
    confronto = _obter_confronto(db, id_confronto)

    if confronto.status == "Finalizado":
        raise ValueError("Não é possível adicionar gol a um confronto já finalizado.")
    if confronto.status == "Cancelado":
        raise ValueError("Não é possível adicionar gol a um confronto cancelado.")

    if id_equipe not in (confronto.id_equipe_mandante, confronto.id_equipe_visitante):
        raise ValueError("A equipe informada não participa deste confronto.")

    if id_jogador is not None:
        jogador = db.query(models.Jogador).filter(models.Jogador.id_jogador == id_jogador).first()
        if not jogador or jogador.id_equipe != id_equipe:
            raise ValueError("O jogador informado não pertence à equipe indicada.")

    # Se o confronto ainda estava apenas agendado, muda para em andamento
    if confronto.status == "Agendado":
        confronto.status = "Em Andamento"

    tipo_ocorrencia = "GOL_CONTRA" if contra else "GOL"

    # Atualiza o placar do confronto
    if not contra:
        if id_equipe == confronto.id_equipe_mandante:
            confronto.placar_mandante += 1
        else:
            confronto.placar_visitante += 1
    else:
        # Gol contra beneficia o adversário
        if id_equipe == confronto.id_equipe_mandante:
            confronto.placar_visitante += 1
        else:
            confronto.placar_mandante += 1

    ocorrencia = models.OcorrenciaPartida(
        id_confronto=id_confronto,
        id_equipe=id_equipe,
        id_jogador=id_jogador,
        tipo=tipo_ocorrencia,
        minuto=minuto,
        tempo_jogo=tempo_jogo,
        observacao=observacao or ("Gol contra" if contra else None),
    )
    db.add(ocorrencia)
    db.commit()
    db.refresh(ocorrencia)
    db.refresh(confronto)
    return ocorrencia


def remover_gol(db: Session, id_ocorrencia: int) -> bool:
    """Remove uma ocorrência de gol e decrementa o placar correspondente."""
    ocorrencia = db.query(models.OcorrenciaPartida).filter(
        models.OcorrenciaPartida.id_ocorrencia == id_ocorrencia
    ).first()
    if not ocorrencia:
        raise ValueError("Ocorrência não encontrada.")

    if ocorrencia.tipo not in ("GOL", "GOL_CONTRA"):
        raise ValueError("A ocorrência informada não é um gol.")

    confronto = ocorrencia.confronto
    if confronto.status == "Finalizado":
        raise ValueError("Não é possível remover gol de um confronto já finalizado.")

    # Decrementa o placar de acordo com quem foi beneficiado
    if ocorrencia.tipo == "GOL":
        if ocorrencia.id_equipe == confronto.id_equipe_mandante:
            confronto.placar_mandante = max(0, confronto.placar_mandante - 1)
        else:
            confronto.placar_visitante = max(0, confronto.placar_visitante - 1)
    else:
        # Gol contra havia beneficiado o adversário
        if ocorrencia.id_equipe == confronto.id_equipe_mandante:
            confronto.placar_visitante = max(0, confronto.placar_visitante - 1)
        else:
            confronto.placar_mandante = max(0, confronto.placar_mandante - 1)

    db.delete(ocorrencia)
    db.commit()
    db.refresh(confronto)
    return True


def adicionar_cartao(
    db: Session,
    id_confronto: int,
    id_equipe: int,
    id_jogador: int,
    tipo: str = "CARTAO_AMARELO",
    minuto: Optional[int] = None,
    tempo_jogo: Optional[str] = "1T",
    observacao: Optional[str] = None,
) -> models.OcorrenciaPartida:
    """Registra cartão. Se for o 2º amarelo do atleta, gera automaticamente o cartão vermelho."""
    confronto = _obter_confronto(db, id_confronto)

    if confronto.status == "Finalizado":
        raise ValueError("Não é possível adicionar cartão a um confronto já finalizado.")
    if confronto.status == "Cancelado":
        raise ValueError("Não é possível adicionar cartão a um confronto cancelado.")

    if id_equipe not in (confronto.id_equipe_mandante, confronto.id_equipe_visitante):
        raise ValueError("A equipe informada não participa deste confronto.")

    jogador = db.query(models.Jogador).filter(models.Jogador.id_jogador == id_jogador).first()
    if not jogador or jogador.id_equipe != id_equipe:
        raise ValueError("O jogador informado não pertence à equipe indicada.")

    tipo_norm = tipo.strip().upper()
    if tipo_norm not in ("CARTAO_AMARELO", "CARTAO_VERMELHO"):
        raise ValueError("Tipo de cartão inválido. Use 'CARTAO_AMARELO' ou 'CARTAO_VERMELHO'.")

    if confronto.status == "Agendado":
        confronto.status = "Em Andamento"

    if tipo_norm == "CARTAO_AMARELO":
        # Verifica amarelos anteriores do atleta no mesmo confronto
        qtd_amarelos = db.query(models.OcorrenciaPartida).filter(
            models.OcorrenciaPartida.id_confronto == id_confronto,
            models.OcorrenciaPartida.id_jogador == id_jogador,
            models.OcorrenciaPartida.tipo == "CARTAO_AMARELO",
        ).count()

        cartao_amarelo = models.OcorrenciaPartida(
            id_confronto=id_confronto,
            id_equipe=id_equipe,
            id_jogador=id_jogador,
            tipo="CARTAO_AMARELO",
            minuto=minuto,
            tempo_jogo=tempo_jogo,
            observacao=observacao or ("2º Cartão Amarelo" if qtd_amarelos >= 1 else "1º Cartão Amarelo"),
        )
        db.add(cartao_amarelo)

        if qtd_amarelos >= 1:
            # 2º Cartão Amarelo acarreta Cartão Vermelho automático
            cartao_vermelho = models.OcorrenciaPartida(
                id_confronto=id_confronto,
                id_equipe=id_equipe,
                id_jogador=id_jogador,
                tipo="CARTAO_VERMELHO",
                minuto=minuto,
                tempo_jogo=tempo_jogo,
                observacao="Expulsão por 2º cartão amarelo",
            )
            db.add(cartao_vermelho)
            db.commit()
            db.refresh(cartao_amarelo)
            db.refresh(cartao_vermelho)
            setattr(cartao_amarelo, "cartao_vermelho_gerado", cartao_vermelho)
            return cartao_amarelo

        db.commit()
        db.refresh(cartao_amarelo)
        return cartao_amarelo

    else:
        # Cartão Vermelho direto
        cartao_vermelho = models.OcorrenciaPartida(
            id_confronto=id_confronto,
            id_equipe=id_equipe,
            id_jogador=id_jogador,
            tipo="CARTAO_VERMELHO",
            minuto=minuto,
            tempo_jogo=tempo_jogo,
            observacao=observacao or "Cartão Vermelho Direto",
        )
        db.add(cartao_vermelho)
        db.commit()
        db.refresh(cartao_vermelho)
        return cartao_vermelho


def _promover_vencedor_para_proximo(db: Session, confronto: models.Confronto, id_vencedor: int) -> None:
    """Promove o vencedor para o próximo confronto da árvore eliminatória."""
    if not confronto.id_proximo_confronto:
        return

    proximo = db.query(models.Confronto).filter(
        models.Confronto.id_confronto == confronto.id_proximo_confronto
    ).first()
    if not proximo:
        return

    if proximo.status in ("Em Andamento", "Finalizado"):
        raise ValueError("Não é possível alterar ou finalizar o confronto pois a próxima fase já foi iniciada ou finalizada.")

    if proximo.id_equipe_mandante == id_vencedor or proximo.id_equipe_visitante == id_vencedor:
        return

    if proximo.id_equipe_mandante is None:
        proximo.id_equipe_mandante = id_vencedor
    elif proximo.id_equipe_visitante is None:
        proximo.id_equipe_visitante = id_vencedor

    # Se o próximo duelo tiver jogo de volta correspondente, replica com mando invertido
    proximo_volta = db.query(models.Confronto).filter(
        models.Confronto.id_confronto_ida == proximo.id_confronto
    ).first()
    if proximo_volta:
        proximo_volta.id_equipe_mandante = proximo.id_equipe_visitante
        proximo_volta.id_equipe_visitante = proximo.id_equipe_mandante


def _promover_perdedor_para_terceiro_lugar(db: Session, confronto: models.Confronto, id_perdedor: int) -> None:
    """Promove o perdedor de uma semifinal para a disputa de 3º lugar, se ela existir."""
    if not id_perdedor:
        return

    terceiro = db.query(models.Confronto).filter(
        models.Confronto.id_competicao == confronto.id_competicao,
        models.Confronto.fase.ilike("%3º%"),
    ).first()
    if not terceiro:
        terceiro = db.query(models.Confronto).filter(
            models.Confronto.id_competicao == confronto.id_competicao,
            models.Confronto.fase.ilike("%terceiro%"),
        ).first()

    if not terceiro:
        return

    if terceiro.status in ("Em Andamento", "Finalizado"):
        raise ValueError("Não é possível alterar o resultado pois a disputa de 3º lugar já foi iniciada ou finalizada.")

    if terceiro.id_equipe_mandante == id_perdedor or terceiro.id_equipe_visitante == id_perdedor:
        return

    if terceiro.id_equipe_mandante is None:
        terceiro.id_equipe_mandante = id_perdedor
    elif terceiro.id_equipe_visitante is None:
        terceiro.id_equipe_visitante = id_perdedor

    terceiro_volta = db.query(models.Confronto).filter(
        models.Confronto.id_confronto_ida == terceiro.id_confronto
    ).first()
    if terceiro_volta:
        terceiro_volta.id_equipe_mandante = terceiro.id_equipe_visitante
        terceiro_volta.id_equipe_visitante = terceiro.id_equipe_mandante


def finalizar_confronto(
    db: Session,
    id_confronto: int,
    penaltis_mandante: Optional[int] = None,
    penaltis_visitante: Optional[int] = None,
    observacoes: Optional[str] = None,
) -> models.Confronto:
    """Encerra o confronto, resolve desempates por agregado/pênaltis e promove classificados."""
    confronto = _obter_confronto(db, id_confronto)

    # Verifica trava retroativa de segurança
    confrontos_v2.verificar_bloqueio_retroativo(db, confronto)

    if penaltis_mandante is not None:
        confronto.penaltis_mandante = penaltis_mandante
    if penaltis_visitante is not None:
        confronto.penaltis_visitante = penaltis_visitante
    if observacoes:
        confronto.observacoes = observacoes

    # 1. JOGO DE IDA DE DUELO DE DOIS JOGOS
    # Verifica se existe um jogo de volta apontando para este
    jogo_volta = db.query(models.Confronto).filter(
        models.Confronto.id_confronto_ida == confronto.id_confronto
    ).first()

    if jogo_volta is not None:
        # É jogo de ida: apenas encerra o jogo individual
        # Vencedor da partida individual anotado, mas NÃO define classificação do mata-mata ainda
        if confronto.placar_mandante > confronto.placar_visitante:
            confronto.id_equipe_vencedora = confronto.id_equipe_mandante
        elif confronto.placar_visitante > confronto.placar_mandante:
            confronto.id_equipe_vencedora = confronto.id_equipe_visitante
        else:
            confronto.id_equipe_vencedora = None

        confronto.status = "Finalizado"
        db.commit()
        db.refresh(confronto)
        return confronto

    # 2. JOGO DE VOLTA DE DUELO DE DOIS JOGOS
    if confronto.id_confronto_ida is not None:
        agregado = confrontos_v2.calcular_agregado_ida_volta(db, confronto)
        total_m = agregado["gols_total_mandante"]
        total_v = agregado["gols_total_visitante"]

        if total_m > total_v:
            vencedor = confronto.id_equipe_mandante
            perdedor = confronto.id_equipe_visitante
        elif total_v > total_m:
            vencedor = confronto.id_equipe_visitante
            perdedor = confronto.id_equipe_mandante
        else:
            # Empate no placar agregado: desempate obrigatório por pênaltis
            if penaltis_mandante is None or penaltis_visitante is None:
                raise ValueError("Empate no placar agregado em confronto eliminatório requer cobrança de pênaltis.")
            if penaltis_mandante == penaltis_visitante:
                raise ValueError("Disputa de pênaltis não pode terminar empatada.")

            if penaltis_mandante > penaltis_visitante:
                vencedor = confronto.id_equipe_mandante
                perdedor = confronto.id_equipe_visitante
            else:
                vencedor = confronto.id_equipe_visitante
                perdedor = confronto.id_equipe_mandante

        confronto.id_equipe_vencedora = vencedor
        confronto.status = "Finalizado"

        _promover_vencedor_para_proximo(db, confronto, vencedor)
        if confronto.fase and "semi" in confronto.fase.lower():
            _promover_perdedor_para_terceiro_lugar(db, confronto, perdedor)

        db.commit()
        db.refresh(confronto)
        return confronto

    # 3. JOGO ÚNICO (PONTOS CORRIDOS, GRUPOS OU MATA-MATA JOGO ÚNICO)
    if confronto.placar_mandante > confronto.placar_visitante:
        vencedor = confronto.id_equipe_mandante
        perdedor = confronto.id_equipe_visitante
    elif confronto.placar_visitante > confronto.placar_mandante:
        vencedor = confronto.id_equipe_visitante
        perdedor = confronto.id_equipe_mandante
    else:
        # Empate no placar do jogo único
        comp_formato = (confronto.competicao.formato or "").upper()
        e_eliminatorio = (
            confronto.id_proximo_confronto is not None
            or comp_formato in ("MATA_MATA", "MATA_MATA_DIRETO")
            or any(termo in (confronto.fase or "").lower() for termo in ["final", "semi", "quarta", "oitava", "3º"])
        )

        if e_eliminatorio:
            if penaltis_mandante is None or penaltis_visitante is None:
                raise ValueError("Confrontos eliminatórios não podem terminar empatados sem pênaltis.")
            if penaltis_mandante == penaltis_visitante:
                raise ValueError("Disputa de pênaltis não pode terminar empatada.")

            if penaltis_mandante > penaltis_visitante:
                vencedor = confronto.id_equipe_mandante
                perdedor = confronto.id_equipe_visitante
            else:
                vencedor = confronto.id_equipe_visitante
                perdedor = confronto.id_equipe_mandante
        else:
            # Empate regular em pontos corridos ou fase de grupos
            vencedor = None
            perdedor = None

    confronto.id_equipe_vencedora = vencedor
    confronto.status = "Finalizado"

    if vencedor and confronto.id_proximo_confronto:
        _promover_vencedor_para_proximo(db, confronto, vencedor)

    if perdedor and confronto.fase and "semi" in confronto.fase.lower():
        _promover_perdedor_para_terceiro_lugar(db, confronto, perdedor)

    db.commit()
    db.refresh(confronto)
    return confronto


# Alias para conformidade e conveniência
finalizar_confronto_v2 = finalizar_confronto
