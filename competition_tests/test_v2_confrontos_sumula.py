"""Testes para o Motor de Geração de Confrontos e Súmula Rápida (V2).

Cobre:
1. Geração de confrontos:
   - Pontos Corridos: Turno único e Turno e Returno (Ida e Volta).
   - Grupos + Mata-Mata: Distribuição em grupos, jogos de grupos (turno único e ida/volta),
     cruzamento eliminatório (1ºA x 2ºB, 1ºB x 2ºA), jogos de ida/volta no mata-mata e 3º lugar.
   - Mata-Mata Direto: Chaveamento inicial, ida e volta, disputa de 3º lugar.
2. Agregação de placares em confrontos de ida e volta e desempate por pênaltis.
3. Promoção automática de vencedores e perdedores (3º lugar).
4. Trava de segurança retroativa contra alterações de fases já iniciadas/finalizadas.
5. Súmula rápida de beira de campo:
   - Adicionar gol normal e gol contra (com atualização instantânea de placar).
   - Remover gol (decremento de placar).
   - Cartões amarelos e regra de expulsão automática no 2º amarelo.
   - Finalização de confronto e definição de classificado.
"""

from datetime import date, time
import pytest

import models
from services import confrontos_v2, sumula_v2


def _criar_ambiente_base(db):
    """Cria modalidade, local e árbitro para os testes."""
    mod = models.Modalidade(nome="Futebol V2 Confrontos", duracao_minutos=90)
    loc = models.Local(loca_nome="Arena Principal V2", loca_descricao="Campo Oficial")
    arb = models.Arbitro(apito_nome="Árbitro V2 Oficial", apito_doc="ARB-V2-CONFR", apito_tel="11988887777")
    db.add_all([mod, loc, arb])
    db.commit()
    db.refresh(mod)
    db.refresh(loc)
    db.refresh(arb)
    return mod, loc, arb


def _criar_equipes(db, competicao, nomes):
    """Cria e retorna uma lista de equipes vinculadas à competição."""
    equipes = []
    for nome in nomes:
        eq = models.Equipe(nome=nome, id_competicao=competicao.id_competicao)
        db.add(eq)
        equipes.append(eq)
    db.commit()
    for eq in equipes:
        db.refresh(eq)
    return equipes


def _criar_jogadores(db, equipe, qtd=3):
    """Cria jogadores para uma equipe."""
    jogadores = []
    for i in range(1, qtd + 1):
        j = models.Jogador(
            id_equipe=equipe.id_equipe,
            nome=f"Atleta {equipe.nome} {i}",
            numero_camisa=i,
            posicao="Meia" if i % 2 == 0 else "Atacante",
        )
        db.add(j)
        jogadores.append(j)
    db.commit()
    for j in jogadores:
        db.refresh(j)
    return jogadores


# ==============================================================================
# 1. TESTES DE GERAÇÃO: PONTOS CORRIDOS
# ==============================================================================

def test_pontos_corridos_turno_unico(db):
    """Valida a geração de pontos corridos com turno único para 4 equipes."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Brasileirão Turno Único",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="PONTOS_CORRIDOS",
        regras_formato={
            "turno_e_returno": False,
            "vitoria_pontos": 3,
            "empate_pontos": 1,
            "derrota_pontos": 0,
        },
        status="CONFIGURADA",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    equipes = _criar_equipes(db, comp, ["Time 1", "Time 2", "Time 3", "Time 4"])

    confrontos = confrontos_v2.gerar_tabela_confrontos_v2(
        db=db,
        competicao=comp,
        id_local_padrao=loc.id_local,
        id_arbitro_padrao=arb.id_arbitro,
        data_inicio=date(2026, 10, 1),
        hora_padrao=time(15, 0),
    )

    # 4 equipes em turno único: 3 rodadas, 2 jogos por rodada = 6 jogos
    assert len(confrontos) == 6

    rodadas = {c.rodada for c in confrontos}
    assert rodadas == {1, 2, 3}

    # Cada time deve jogar 3 vezes
    contagem_jogos = {eq.id_equipe: 0 for eq in equipes}
    for c in confrontos:
        assert c.ordem_jogo == 1
        contagem_jogos[c.id_equipe_mandante] += 1
        contagem_jogos[c.id_equipe_visitante] += 1

    for eq_id, qtd in contagem_jogos.items():
        assert qtd == 3


def test_pontos_corridos_turno_e_returno(db):
    """Valida a geração de pontos corridos com turno e returno (ida e volta) para 4 equipes."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Brasileirão Turno e Returno",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="PONTOS_CORRIDOS",
        regras_formato={
            "turno_e_returno": True,
            "vitoria_pontos": 3,
            "empate_pontos": 1,
            "derrota_pontos": 0,
        },
        status="CONFIGURADA",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    equipes = _criar_equipes(db, comp, ["Alpha", "Beta", "Gamma", "Delta"])

    confrontos = confrontos_v2.gerar_tabela_confrontos_v2(
        db=db,
        competicao=comp,
        id_local_padrao=loc.id_local,
        id_arbitro_padrao=arb.id_arbitro,
        data_inicio=date(2026, 10, 1),
    )

    # 4 equipes em turno e returno: 6 rodadas, 2 jogos por rodada = 12 jogos
    assert len(confrontos) == 12
    rodadas = {c.rodada for c in confrontos}
    assert rodadas == {1, 2, 3, 4, 5, 6}

    # Verifica se cada confronto do turno tem sua contraparte com mando invertido no returno
    jogos_turno = {(c.id_equipe_mandante, c.id_equipe_visitante) for c in confrontos if c.rodada <= 3}
    jogos_returno = {(c.id_equipe_mandante, c.id_equipe_visitante) for c in confrontos if c.rodada > 3}

    assert len(jogos_turno) == 6
    assert len(jogos_returno) == 6

    for mandante, visitante in jogos_turno:
        assert (visitante, mandante) in jogos_returno


# ==============================================================================
# 2. TESTES DE GERAÇÃO: GRUPOS + MATA-MATA
# ==============================================================================

def test_grupos_mata_mata_chaveamento_completo(db):
    """Valida distribuição em grupos, confrontos de grupos e chaveamento eliminatório (com 3º lugar)."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Copa do Mundo Regional",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="GRUPOS",
        regras_formato={
            "qtd_grupos": 2,
            "times_por_grupo": 2,
            "classificados_por_grupo": 2,
            "jogos_ida_volta_grupo": False,
            "fase_inicial_mata_mata": "Semifinal",
            "jogos_ida_volta_mata_mata": False,
            "disputa_terceiro_lugar": True,
            "penaltis_desempate": True,
        },
        status="CONFIGURADA",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    # 4 equipes: A1, A2, B1, B2
    equipes = _criar_equipes(db, comp, ["Time A1", "Time A2", "Time B1", "Time B2"])

    confrontos = confrontos_v2.gerar_tabela_confrontos_v2(
        db=db,
        competicao=comp,
        id_local_padrao=loc.id_local,
        id_arbitro_padrao=arb.id_arbitro,
    )

    # Verifica distribuição nos grupos A e B
    for eq in equipes:
        db.refresh(eq)
    grupos_distribuidos = {eq.grupo for eq in equipes}
    assert grupos_distribuidos == {"A", "B"}
    assert len([eq for eq in equipes if eq.grupo == "A"]) == 2
    assert len([eq for eq in equipes if eq.grupo == "B"]) == 2

    # Jogos da fase de grupos: 1 jogo no grupo A + 1 jogo no grupo B = 2 jogos
    jogos_grupos = [c for c in confrontos if c.grupo is not None]
    assert len(jogos_grupos) == 2

    # Mata-mata gerado: Semifinal 1, Semifinal 2, Final, Disputa 3º Lugar = 4 jogos
    jogos_mata = [c for c in confrontos if c.grupo is None]
    assert len(jogos_mata) == 4

    fases_mata = {c.fase for c in jogos_mata}
    assert any("Semifinal 1" in f for f in fases_mata)
    assert any("Semifinal 2" in f for f in fases_mata)
    assert any("Final" in f and "Semi" not in f for f in fases_mata)
    assert any("3º" in f for f in fases_mata)

    # Semifinais devem apontar id_proximo_confronto para a Final
    final = next(c for c in jogos_mata if c.fase == "Final")
    semis = [c for c in jogos_mata if "Semifinal" in c.fase]
    for semi in semis:
        assert semi.id_proximo_confronto == final.id_confronto


def test_grupos_mata_mata_com_ida_e_volta_grupos_e_mata(db):
    """Valida jogos de ida e volta nos grupos e jogos de ida e volta no mata-mata."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Champions Regional",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="GRUPOS",
        regras_formato={
            "qtd_grupos": 2,
            "classificados_por_grupo": 2,
            "jogos_ida_volta_grupo": True,
            "jogos_ida_volta_mata_mata": True,
            "final_jogo_unico": True,  # Final é jogo único, semis são ida e volta
            "disputa_terceiro_lugar": True,
        },
        status="CONFIGURADA",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    _criar_equipes(db, comp, ["Equipe 1", "Equipe 2", "Equipe 3", "Equipe 4"])

    confrontos = confrontos_v2.gerar_tabela_confrontos_v2(
        db=db,
        competicao=comp,
        id_local_padrao=loc.id_local,
        id_arbitro_padrao=arb.id_arbitro,
    )

    # Nos grupos: 2 grupos com 2 times em ida e volta = 2 jogos por grupo = 4 jogos
    jogos_grupos = [c for c in confrontos if c.grupo is not None]
    assert len(jogos_grupos) == 4

    # Mata-mata:
    # Semifinal 1: Ida e Volta (2 jogos)
    # Semifinal 2: Ida e Volta (2 jogos)
    # Final: Jogo Único (1 jogo)
    # Disputa 3º Lugar: Jogo Único (1 jogo)
    # Total mata-mata = 6 jogos
    jogos_mata = [c for c in confrontos if c.grupo is None]
    assert len(jogos_mata) == 6

    # Verifica vínculo de ida e volta nas semifinais
    semis_volta = [c for c in jogos_mata if "Semifinal" in c.fase and c.ordem_jogo == 2]
    assert len(semis_volta) == 2
    for s_volta in semis_volta:
        assert s_volta.id_confronto_ida is not None
        # O jogo de volta é quem aponta para a final
        final = next(c for c in jogos_mata if c.fase == "Final")
        assert s_volta.id_proximo_confronto == final.id_confronto


# ==============================================================================
# 3. TESTES DE GERAÇÃO: MATA-MATA DIRETO
# ==============================================================================

def test_mata_mata_direto_simples(db):
    """Valida geração de mata-mata direto a partir das semifinais."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Copa Eliminatória Direta",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="MATA_MATA",
        regras_formato={
            "fase_inicial": "Semifinal",
            "jogos_ida_volta": False,
            "disputa_terceiro_lugar": True,
            "penaltis_desempate": True,
        },
        status="CONFIGURADA",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    equipes = _criar_equipes(db, comp, ["Tigres", "Leões", "Águias", "Lobos"])

    confrontos = confrontos_v2.gerar_tabela_confrontos_v2(
        db=db,
        competicao=comp,
        id_local_padrao=loc.id_local,
        id_arbitro_padrao=arb.id_arbitro,
    )

    # 4 equipes: 2 semifinais, 1 final, 1 terceiro lugar = 4 confrontos
    assert len(confrontos) == 4

    semis = [c for c in confrontos if "Semifinal" in c.fase]
    assert len(semis) == 2

    # As 4 equipes devem estar alocadas nas semifinais
    times_alocados = set()
    for s in semis:
        assert s.id_equipe_mandante is not None
        assert s.id_equipe_visitante is not None
        times_alocados.add(s.id_equipe_mandante)
        times_alocados.add(s.id_equipe_visitante)

    assert times_alocados == {e.id_equipe for e in equipes}


# ==============================================================================
# 4. TESTES DA SÚMULA RÁPIDA (GOLS, CARTÕES, REVERSÃO)
# ==============================================================================

def test_sumula_adicionar_e_remover_gol(db):
    """Valida registro e remoção de gols com atualização imediata do placar."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Copa Súmula",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="PONTOS_CORRIDOS",
        status="EM_ANDAMENTO",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    eq_mandante = models.Equipe(nome="Flamengo V2", id_competicao=comp.id_competicao)
    eq_visitante = models.Equipe(nome="Vasco V2", id_competicao=comp.id_competicao)
    db.add_all([eq_mandante, eq_visitante])
    db.commit()

    jogadores_fla = _criar_jogadores(db, eq_mandante, 2)
    jogadores_vas = _criar_jogadores(db, eq_visitante, 2)

    confronto = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_mandante.id_equipe,
        id_equipe_visitante=eq_visitante.id_equipe,
        data=date(2026, 10, 5),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        status="Agendado",
    )
    db.add(confronto)
    db.commit()
    db.refresh(confronto)

    # 1. Adicionar gol normal para o mandante
    gol1 = sumula_v2.adicionar_gol(
        db=db,
        id_confronto=confronto.id_confronto,
        id_equipe=eq_mandante.id_equipe,
        id_jogador=jogadores_fla[0].id_jogador,
        minuto=10,
        contra=False,
    )
    db.refresh(confronto)
    assert confronto.placar_mandante == 1
    assert confronto.placar_visitante == 0
    assert confronto.status == "Em Andamento"
    assert gol1.tipo == "GOL"

    # 2. Adicionar gol contra pelo visitante (favorece o mandante)
    gol2 = sumula_v2.adicionar_gol(
        db=db,
        id_confronto=confronto.id_confronto,
        id_equipe=eq_visitante.id_equipe,
        id_jogador=jogadores_vas[0].id_jogador,
        minuto=25,
        contra=True,
    )
    db.refresh(confronto)
    # Gol contra do visitante aumenta placar do mandante!
    assert confronto.placar_mandante == 2
    assert confronto.placar_visitante == 0
    assert gol2.tipo == "GOL_CONTRA"

    # 3. Adicionar gol normal para o visitante
    gol3 = sumula_v2.adicionar_gol(
        db=db,
        id_confronto=confronto.id_confronto,
        id_equipe=eq_visitante.id_equipe,
        id_jogador=jogadores_vas[1].id_jogador,
        minuto=30,
        contra=False,
    )
    db.refresh(confronto)
    assert confronto.placar_mandante == 2
    assert confronto.placar_visitante == 1

    # 4. Remover o gol contra
    removido = sumula_v2.remover_gol(db=db, id_ocorrencia=gol2.id_ocorrencia)
    assert removido is True
    db.refresh(confronto)
    assert confronto.placar_mandante == 1
    assert confronto.placar_visitante == 1


def test_sumula_cartoes_e_segundo_amarelo_gera_vermelho(db):
    """Valida o registro de cartões e a expulsão automática por segundo cartão amarelo."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Copa Disciplinar",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="PONTOS_CORRIDOS",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    eq = models.Equipe(nome="Time Faltoso", id_competicao=comp.id_competicao)
    eq_adv = models.Equipe(nome="Time Vítima", id_competicao=comp.id_competicao)
    db.add_all([eq, eq_adv])
    db.commit()

    jogadores = _criar_jogadores(db, eq, 2)
    jogador_infrator = jogadores[0]

    confronto = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq.id_equipe,
        id_equipe_visitante=eq_adv.id_equipe,
        data=date(2026, 10, 5),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        status="Em Andamento",
    )
    db.add(confronto)
    db.commit()
    db.refresh(confronto)

    # 1º Cartão Amarelo
    c1 = sumula_v2.adicionar_cartao(
        db=db,
        id_confronto=confronto.id_confronto,
        id_equipe=eq.id_equipe,
        id_jogador=jogador_infrator.id_jogador,
        tipo="CARTAO_AMARELO",
        minuto=20,
    )
    assert c1.tipo == "CARTAO_AMARELO"

    ocorrencias = db.query(models.OcorrenciaPartida).filter(
        models.OcorrenciaPartida.id_confronto == confronto.id_confronto
    ).all()
    assert len(ocorrencias) == 1

    # 2º Cartão Amarelo no mesmo jogo -> deve criar o 2º amarelo E gerar o CARTAO_VERMELHO
    c2 = sumula_v2.adicionar_cartao(
        db=db,
        id_confronto=confronto.id_confronto,
        id_equipe=eq.id_equipe,
        id_jogador=jogador_infrator.id_jogador,
        tipo="CARTAO_AMARELO",
        minuto=75,
    )
    assert c2.tipo == "CARTAO_AMARELO"

    ocorrencias_apos = db.query(models.OcorrenciaPartida).filter(
        models.OcorrenciaPartida.id_confronto == confronto.id_confronto
    ).all()

    # Total de 3 ocorrências: 1º amarelo, 2º amarelo e 1 vermelho automático
    assert len(ocorrencias_apos) == 3
    tipos = [o.tipo for o in ocorrencias_apos]
    assert tipos.count("CARTAO_AMARELO") == 2
    assert tipos.count("CARTAO_VERMELHO") == 1


# ==============================================================================
# 5. TESTES DE PROMOÇÃO DE VENCEDOR E DESEMPATES (MATA-MATA)
# ==============================================================================

def test_finalizar_confronto_mata_mata_com_penaltis_e_promocao(db):
    """Valida empate no tempo normal, desempate por pênaltis e promoção à Final e 3º Lugar."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Copa Eliminatória com Pênaltis",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="MATA_MATA",
        regras_formato={"fase_inicial": "Semifinal", "disputa_terceiro_lugar": True},
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    eq_a = models.Equipe(nome="Time A", id_competicao=comp.id_competicao)
    eq_b = models.Equipe(nome="Time B", id_competicao=comp.id_competicao)
    db.add_all([eq_a, eq_b])
    db.commit()

    final = models.Confronto(
        id_competicao=comp.id_competicao,
        fase="Final",
        data=date(2026, 11, 1),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        status="Agendado",
    )
    terceiro = models.Confronto(
        id_competicao=comp.id_competicao,
        fase="Disputa 3º Lugar",
        data=date(2026, 10, 31),
        hora=time(14, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        status="Agendado",
    )
    db.add_all([final, terceiro])
    db.commit()

    semi = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_a.id_equipe,
        id_equipe_visitante=eq_b.id_equipe,
        id_proximo_confronto=final.id_confronto,
        fase="Semifinal 1",
        data=date(2026, 10, 24),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        placar_mandante=1,
        placar_visitante=1,
        status="Em Andamento",
    )
    db.add(semi)
    db.commit()
    db.refresh(semi)

    # Tentar finalizar empatado sem pênaltis em mata-mata deve falhar
    with pytest.raises(ValueError, match="pênaltis"):
        sumula_v2.finalizar_confronto(db=db, id_confronto=semi.id_confronto)

    # Finalizar com pênaltis: Time A 5 x 4 Time B
    encerrado = sumula_v2.finalizar_confronto(
        db=db,
        id_confronto=semi.id_confronto,
        penaltis_mandante=5,
        penaltis_visitante=4,
        observacoes="Decidido nas penalidades máximas",
    )

    assert encerrado.status == "Finalizado"
    assert encerrado.id_equipe_vencedora == eq_a.id_equipe

    # Verifica promoção do vencedor para a Final
    db.refresh(final)
    assert final.id_equipe_mandante == eq_a.id_equipe

    # Verifica promoção do perdedor para a Disputa de 3º Lugar
    db.refresh(terceiro)
    assert terceiro.id_equipe_mandante == eq_b.id_equipe


def test_mata_mata_ida_e_volta_agregado_e_penaltis(db):
    """Valida chaveamento de ida e volta com empate no agregado e decisão por pênaltis na volta."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Copa Ida e Volta Agregado",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="MATA_MATA",
    )
    db.add(comp)
    db.commit()

    eq_gremio = models.Equipe(nome="Grêmio", id_competicao=comp.id_competicao)
    eq_inter = models.Equipe(nome="Internacional", id_competicao=comp.id_competicao)
    db.add_all([eq_gremio, eq_inter])
    db.commit()

    final = models.Confronto(
        id_competicao=comp.id_competicao,
        fase="Final",
        data=date(2026, 11, 10),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        status="Agendado",
    )
    db.add(final)
    db.commit()

    # Jogo 1 (Ida): Grêmio (mandante) 2 x 1 Internacional (visitante)
    jogo_ida = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_gremio.id_equipe,
        id_equipe_visitante=eq_inter.id_equipe,
        fase="Semifinal 1 - Ida",
        ordem_jogo=1,
        data=date(2026, 10, 10),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        placar_mandante=2,
        placar_visitante=1,
        status="Agendado",
    )
    db.add(jogo_ida)
    db.commit()
    db.refresh(jogo_ida)

    # Jogo de ida finalizado
    sumula_v2.finalizar_confronto(db=db, id_confronto=jogo_ida.id_confronto)
    db.refresh(jogo_ida)
    assert jogo_ida.status == "Finalizado"

    # Jogo 2 (Volta): Internacional (mandante) 1 x 0 Grêmio (visitante)
    # Agregado: Grêmio 2 x 2 Internacional (empate no agregado!)
    jogo_volta = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_inter.id_equipe,
        id_equipe_visitante=eq_gremio.id_equipe,
        id_confronto_ida=jogo_ida.id_confronto,
        id_proximo_confronto=final.id_confronto,
        fase="Semifinal 1 - Volta",
        ordem_jogo=2,
        data=date(2026, 10, 17),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        placar_mandante=1,
        placar_visitante=0,
        status="Agendado",
    )
    db.add(jogo_volta)
    db.commit()
    db.refresh(jogo_volta)

    # Finalizar a volta sem pênaltis quando há empate no agregado deve lançar erro
    with pytest.raises(ValueError, match="agregado|pênaltis"):
        sumula_v2.finalizar_confronto(db=db, id_confronto=jogo_volta.id_confronto)

    # Pênaltis na volta: Internacional 5 x 4 Grêmio
    encerrado_volta = sumula_v2.finalizar_confronto(
        db=db,
        id_confronto=jogo_volta.id_confronto,
        penaltis_mandante=5,
        penaltis_visitante=4,
    )

    assert encerrado_volta.status == "Finalizado"
    assert encerrado_volta.id_equipe_vencedora == eq_inter.id_equipe

    # Promoveu o Internacional para a final
    db.refresh(final)
    assert final.id_equipe_mandante == eq_inter.id_equipe


def test_trava_seguranca_retroativa(db):
    """Valida que a fase anterior não pode ter seu resultado alterado se a fase seguinte já começou."""
    mod, loc, arb = _criar_ambiente_base(db)

    comp = models.Competicao(
        nome="Copa Segurança Retroativa",
        id_modalidade=mod.id_modalidade,
        categoria="Livre",
        formato="MATA_MATA",
    )
    db.add(comp)
    db.commit()

    eq1 = models.Equipe(nome="Time Alfa", id_competicao=comp.id_competicao)
    eq2 = models.Equipe(nome="Time Beta", id_competicao=comp.id_competicao)
    db.add_all([eq1, eq2])
    db.commit()

    final = models.Confronto(
        id_competicao=comp.id_competicao,
        fase="Final",
        data=date(2026, 11, 20),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        status="Agendado",
    )
    db.add(final)
    db.commit()

    semi = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        id_proximo_confronto=final.id_confronto,
        fase="Semifinal",
        data=date(2026, 11, 10),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        placar_mandante=2,
        placar_visitante=0,
        status="Agendado",
    )
    db.add(semi)
    db.commit()

    # Finaliza a semifinal promovendo o Time Alfa
    sumula_v2.finalizar_confronto(db=db, id_confronto=semi.id_confronto)
    db.refresh(final)
    assert final.id_equipe_mandante == eq1.id_equipe

    # Inicia a Final
    final.status = "Em Andamento"
    db.commit()

    # Tentativa de reverter ou refinalizar a semifinal com novo vencedor deve ser BLOQUEADA
    semi.placar_mandante = 0
    semi.placar_visitante = 3
    db.commit()

    with pytest.raises(ValueError, match="próxima fase|iniciada ou finalizada"):
        sumula_v2.finalizar_confronto(db=db, id_confronto=semi.id_confronto)
