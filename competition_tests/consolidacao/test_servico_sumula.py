"""Testes de consolidação da Task 4 (Fatia 3): Serviços e API de Súmula Detalhada, Artilharia e Reabertura de Partidas.

Cobre:
- Registro de ocorrências (GOL, GOL_CONTRA beneficiando adversário, CARTAO_AMARELO, CARTAO_VERMELHO_DIRETO) com idempotência por Idempotency-Key.
- 1ª ocorrência inicia automaticamente partida AGENDADA -> EM_ANDAMENTO.
- Ruling R31: 2º CARTAO_AMARELO do mesmo integrante gera EXPULSAO_SEGUNDO_AMARELO derivada; remover o amarelo remove a expulsão derivada; tentar remover diretamente a expulsão derivada é rejeitado (422).
- Ruling R33: Integrante suspenso gera alerta em alertas_suspensos da súmula, mas não bloqueia lançamento de ocorrência.
- Atribuir autor (PUT /ocorrencias/{id}/autor) não altera o placar; quando a partida está FINALIZADA, exige motivo e mantém o chaveamento intacto.
- registrar_resultado_simples preserva gols com autoria, gols contra e cartões, e retorna 422 se tentar reduzir o placar abaixo dos gols já identificados.
- Ciclo de vida da partida: iniciar, finalizar (com validação de pênaltis em mata-mata e reconciliação de sanções), cancelar e reabrir.
- Reabertura de partida (POST /partidas/{id}/reabrir com motivo): em mata-mata, invalida vagas e remove partidas descendentes não iniciadas; mas se qualquer duelo descendente (ex: final ou 3º lugar) ou jogo de volta já tiver iniciado, bloqueia com 409 (ConflitoEstado).
- Artilharia (GET /edicoes/{id}/artilharia): soma apenas GOL normal com autor em partidas não canceladas, sinalizando gols em andamento.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from competicoes.contratos.partidas import ResultadoSimples
from competicoes.contratos.sumula import (
    OcorrenciaAutorAtualizar,
    OcorrenciaCriar,
    PartidaFinalizar,
)
from competicoes.erros import ConfiguracaoInvalida, ConflitoEstado, NaoEncontrado
from competicoes.modelos.disciplina import SuspensaoCompeticao
from competicoes.modelos.disputa import DueloEliminatorio, GrupoCompeticao, VagaDuelo
from competicoes.modelos.partidas import OcorrenciaPartida, Partida
from competicoes.servicos.partidas import registrar_resultado_simples
from competicoes.servicos.sumula import (
    atribuir_autor_ocorrencia,
    cancelar_partida,
    finalizar_partida,
    iniciar_partida,
    obter_artilharia_edicao,
    obter_sumula,
    reabrir_partida,
    registrar_ocorrencia,
    remover_ocorrencia,
)
from .factories import (
    criar_competidor,
    criar_edicao_competicao,
    criar_equipe,
    criar_integrante,
)


# ==============================================================================
# FIXTURES LOCAIS (sem alterar conftest.py)
# ==============================================================================


@pytest.fixture()
def edicao_andamento(db: Session):
    edicao = criar_edicao_competicao(
        db,
        estado="EM_ANDAMENTO",
        configuracao={
            "disciplina": {
                "limite_amarelos": 2,
                "jogos_por_acumulo": 1,
                "jogos_por_vermelho": 1,
                "jogos_por_segundo_amarelo": 1,
            }
        },
    )
    db.commit()
    return edicao


@pytest.fixture()
def grupo_a(db: Session, edicao_andamento):
    grupo = GrupoCompeticao(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        nome="Grupo A",
        ordem=1,
    )
    db.add(grupo)
    db.commit()
    db.refresh(grupo)
    return grupo


@pytest.fixture()
def equipes_e_elenco(db: Session, edicao_andamento, grupo_a):
    eq_m = criar_equipe(db, edicao=edicao_andamento, nome="Mandante FC", id_grupo=grupo_a.id_grupo)
    eq_v = criar_equipe(db, edicao=edicao_andamento, nome="Visitante EC", id_grupo=grupo_a.id_grupo)

    c_m1 = criar_competidor(db, nome="Atacante M1")
    c_m2 = criar_competidor(db, nome="Zagueiro M2")
    c_v1 = criar_competidor(db, nome="Meia V1")
    c_v2 = criar_competidor(db, nome="Goleiro V2")

    int_m1 = criar_integrante(db, equipe=eq_m, competidor=c_m1, nome_esportivo="M1", numero_camisa=9)
    int_m2 = criar_integrante(db, equipe=eq_m, competidor=c_m2, nome_esportivo="M2", numero_camisa=4)
    int_v1 = criar_integrante(db, equipe=eq_v, competidor=c_v1, nome_esportivo="V1", numero_camisa=10)
    int_v2 = criar_integrante(db, equipe=eq_v, competidor=c_v2, nome_esportivo="V2", numero_camisa=1)

    db.commit()
    return {
        "eq_m": eq_m,
        "eq_v": eq_v,
        "int_m1": int_m1,
        "int_m2": int_m2,
        "int_v1": int_v1,
        "int_v2": int_v2,
    }


@pytest.fixture()
def partida_agendada(db: Session, edicao_andamento, grupo_a, equipes_e_elenco):
    p = Partida(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        id_grupo=grupo_a.id_grupo,
        rodada=1,
        ordem_jogo=1,
        id_equipe_mandante=equipes_e_elenco["eq_m"].id_equipe,
        id_equipe_visitante=equipes_e_elenco["eq_v"].id_equipe,
        estado="AGENDADA",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# ==============================================================================
# 1. REGISTRO DE OCORRÊNCIAS, 1ª OCORRÊNCIA INICIA PARTIDA E IDEMPOTÊNCIA
# ==============================================================================


def test_primeira_ocorrencia_inicia_partida_e_calcula_placar_com_gol_contra(
    db: Session, partida_agendada, equipes_e_elenco, usuario
):
    """1ª ocorrência muda partida AGENDADA -> EM_ANDAMENTO; GOL_CONTRA beneficia adversário."""
    eq_m = equipes_e_elenco["eq_m"]
    eq_v = equipes_e_elenco["eq_v"]
    int_m1 = equipes_e_elenco["int_m1"]
    int_m2 = equipes_e_elenco["int_m2"]

    assert partida_agendada.estado == "AGENDADA"

    # 1. GOL normal do mandante com autor
    sumula = registrar_ocorrencia(
        db,
        id_partida=partida_agendada.id_partida,
        dados=OcorrenciaCriar(
            tipo="GOL",
            id_equipe=eq_m.id_equipe,
            id_integrante=int_m1.id_integrante,
            minuto=12,
            periodo="1T",
        ),
        idempotency_key="oc-1",
        responsavel=usuario,
    )
    assert sumula.partida.estado == "EM_ANDAMENTO"
    assert sumula.partida.placar.gols_mandante == 1
    assert sumula.partida.placar.gols_visitante == 0
    assert len(sumula.ocorrencias) == 1
    assert sumula.ocorrencias[0].nome_integrante == "M1"
    assert sumula.ocorrencias[0].numero_camisa == 9

    # 2. GOL_CONTRA feito por jogador do mandante (int_m2) -> deve somar para o visitante (eq_v)!
    sumula = registrar_ocorrencia(
        db,
        id_partida=partida_agendada.id_partida,
        dados=OcorrenciaCriar(
            tipo="GOL_CONTRA",
            id_equipe=eq_m.id_equipe,
            id_integrante=int_m2.id_integrante,
            minuto=35,
            periodo="1T",
        ),
        idempotency_key="oc-2",
        responsavel=usuario,
    )
    assert sumula.partida.placar.gols_mandante == 1
    assert sumula.partida.placar.gols_visitante == 1
    oc_contra = next(o for o in sumula.ocorrencias if o.tipo == "GOL_CONTRA")
    assert oc_contra.id_equipe_beneficiada == eq_v.id_equipe
    assert oc_contra.id_integrante == int_m2.id_integrante


def test_idempotencia_ocorrencia_mesma_chave_e_conflito_payload_divergente(
    db: Session, partida_agendada, equipes_e_elenco, usuario
):
    """Idempotency-Key igual com mesmo payload não duplica; payload diferente levanta ConflitoEstado."""
    eq_m = equipes_e_elenco["eq_m"]
    int_m1 = equipes_e_elenco["int_m1"]

    dados = OcorrenciaCriar(
        tipo="GOL",
        id_equipe=eq_m.id_equipe,
        id_integrante=int_m1.id_integrante,
        minuto=10,
    )
    s1 = registrar_ocorrencia(db, partida_agendada.id_partida, dados, "idemp-oc-1", usuario)
    s2 = registrar_ocorrencia(db, partida_agendada.id_partida, dados, "idemp-oc-1", usuario)

    assert len(s1.ocorrencias) == 1
    assert len(s2.ocorrencias) == 1
    assert s2.partida.placar.gols_mandante == 1

    # Mesma chave com minuto diferente -> 409 ConflitoEstado
    dados_div = OcorrenciaCriar(
        tipo="GOL",
        id_equipe=eq_m.id_equipe,
        id_integrante=int_m1.id_integrante,
        minuto=11,
    )
    with pytest.raises(ConflitoEstado):
        registrar_ocorrencia(db, partida_agendada.id_partida, dados_div, "idemp-oc-1", usuario)


# ==============================================================================
# 2. DERIVAÇÃO DE 2º AMARELO E REMOÇÃO DE OCORRÊNCIAS (RULING R31)
# ==============================================================================


def test_segundo_amarelo_gera_expulsao_derivada_e_remocao_em_cascata(
    db: Session, partida_agendada, equipes_e_elenco, usuario
):
    """2º amarelo gera EXPULSAO_SEGUNDO_AMARELO; remover amarelo remove expulsão; remover expulsão direto dá 422."""
    eq_m = equipes_e_elenco["eq_m"]
    int_m1 = equipes_e_elenco["int_m1"]

    # 1º Amarelo
    s1 = registrar_ocorrencia(
        db,
        partida_agendada.id_partida,
        OcorrenciaCriar(
            tipo="CARTAO_AMARELO",
            id_equipe=eq_m.id_equipe,
            id_integrante=int_m1.id_integrante,
            minuto=20,
        ),
        None,
        usuario,
    )
    assert len(s1.ocorrencias) == 1
    assert s1.ocorrencias[0].tipo == "CARTAO_AMARELO"

    # 2º Amarelo -> deve criar CARTAO_AMARELO e EXPULSAO_SEGUNDO_AMARELO derivada
    s2 = registrar_ocorrencia(
        db,
        partida_agendada.id_partida,
        OcorrenciaCriar(
            tipo="CARTAO_AMARELO",
            id_equipe=eq_m.id_equipe,
            id_integrante=int_m1.id_integrante,
            minuto=55,
        ),
        None,
        usuario,
    )
    tipos = [o.tipo for o in s2.ocorrencias]
    assert tipos.count("CARTAO_AMARELO") == 2
    assert tipos.count("EXPULSAO_SEGUNDO_AMARELO") == 1

    expulsao = next(o for o in s2.ocorrencias if o.tipo == "EXPULSAO_SEGUNDO_AMARELO")
    amarelos = [o for o in s2.ocorrencias if o.tipo == "CARTAO_AMARELO"]
    segundo_amarelo = amarelos[1]
    assert expulsao.id_ocorrencia_origem == segundo_amarelo.id_ocorrencia

    # 3º Amarelo para o mesmo integrante deve ser rejeitado (422)
    with pytest.raises(ConfiguracaoInvalida):
        registrar_ocorrencia(
            db,
            partida_agendada.id_partida,
            OcorrenciaCriar(
                tipo="CARTAO_AMARELO",
                id_equipe=eq_m.id_equipe,
                id_integrante=int_m1.id_integrante,
                minuto=70,
            ),
            None,
            usuario,
        )

    # Tentar remover diretamente a EXPULSAO_SEGUNDO_AMARELO deve ser rejeitado (422)
    with pytest.raises(ConfiguracaoInvalida):
        remover_ocorrencia(db, expulsao.id_ocorrencia, "Tentativa direta", usuario)

    # Remover o 2º amarelo deve remover também a EXPULSAO_SEGUNDO_AMARELO derivada
    s3 = remover_ocorrencia(db, segundo_amarelo.id_ocorrencia, "Erro de anotação", usuario)
    assert len(s3.ocorrencias) == 1
    assert s3.ocorrencias[0].tipo == "CARTAO_AMARELO"


# ==============================================================================
# 3. ALERTA DE SUSPENSO NÃO BLOQUEIA LANÇAMENTO (RULING R33)
# ==============================================================================


def test_integrante_suspenso_aparece_em_alertas_mas_nao_bloqueia_ocorrencia(
    db: Session, edicao_andamento, partida_agendada, equipes_e_elenco, usuario
):
    """Ruling R33: integrante com suspensão ATIVA aparece em alertas_suspensos, mas pode receber ocorrência."""
    int_m1 = equipes_e_elenco["int_m1"]
    eq_m = equipes_e_elenco["eq_m"]

    susp = SuspensaoCompeticao(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        id_integrante=int_m1.id_integrante,
        motivo="Vermelho anterior",
        origem="VERMELHO_DIRETO",
        chave_origem="ED1:INT1:VERM",
        jogos=1,
        situacao="ATIVA",
    )
    db.add(susp)
    db.commit()

    sumula_inicial = obter_sumula(db, partida_agendada.id_partida)
    assert len(sumula_inicial.alertas_suspensos) == 1
    assert sumula_inicial.alertas_suspensos[0].id_integrante == int_m1.id_integrante
    assert sumula_inicial.alertas_suspensos[0].jogos_pendentes == 1

    # Lançar gol para o suspenso não é bloqueado
    sumula_apos = registrar_ocorrencia(
        db,
        partida_agendada.id_partida,
        OcorrenciaCriar(
            tipo="GOL",
            id_equipe=eq_m.id_equipe,
            id_integrante=int_m1.id_integrante,
            minuto=15,
        ),
        None,
        usuario,
    )
    assert len(sumula_apos.ocorrencias) == 1
    assert sumula_apos.ocorrencias[0].id_integrante == int_m1.id_integrante


# ==============================================================================
# 4. ATRIBUIÇÃO DE AUTOR DE GOL (PARTIDA EM ANDAMENTO E PARTIDA FINALIZADA)
# ==============================================================================


def test_atribuir_autor_ocorrencia_em_partida_finalizada_exige_motivo_e_preserva_chaveamento(
    db: Session, edicao_andamento, usuario
):
    """Atribuir autor em partida FINALIZADA exige motivo, não altera placar e não desfaz avanço de mata-mata."""
    eq_a = criar_equipe(db, edicao=edicao_andamento, nome="Time A")
    eq_b = criar_equipe(db, edicao=edicao_andamento, nome="Time B")
    eq_c = criar_equipe(db, edicao=edicao_andamento, nome="Time C")
    comp_a = criar_competidor(db, nome="Craque A")
    int_a = criar_integrante(db, equipe=eq_a, competidor=comp_a, nome_esportivo="Craque A", numero_camisa=10)
    db.commit()

    d_semi = DueloEliminatorio(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        fase="SEMIFINAL",
        posicao_chave=1,
        estado="DEFINIDO",
        ida_volta=False,
    )
    d_final = DueloEliminatorio(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
        estado="PENDENTE",
        ida_volta=False,
    )
    db.add_all([d_semi, d_final])
    db.commit()

    db.add_all([
        VagaDuelo(id_duelo=d_semi.id_duelo, posicao=1, origem="EQUIPE_INICIAL", id_equipe=eq_a.id_equipe),
        VagaDuelo(id_duelo=d_semi.id_duelo, posicao=2, origem="EQUIPE_INICIAL", id_equipe=eq_b.id_equipe),
        VagaDuelo(id_duelo=d_final.id_duelo, posicao=1, origem="VENCEDOR_DUELO", id_duelo_origem=d_semi.id_duelo),
        VagaDuelo(id_duelo=d_final.id_duelo, posicao=2, origem="EQUIPE_INICIAL", id_equipe=eq_c.id_equipe),
    ])
    p_semi = Partida(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        id_duelo=d_semi.id_duelo,
        ordem_jogo=1,
        id_equipe_mandante=eq_a.id_equipe,
        id_equipe_visitante=eq_b.id_equipe,
        estado="AGENDADA",
    )
    db.add(p_semi)
    db.commit()

    # Registra resultado simples 1x0 (gol sem autor) -> avança Time A para a Final
    registrar_resultado_simples(
        db,
        id_partida=p_semi.id_partida,
        dados=ResultadoSimples(gols_mandante=1, gols_visitante=0),
        idempotency_key="semi-simples-1",
        responsavel=usuario,
    )

    sumula = obter_sumula(db, p_semi.id_partida)
    assert len(sumula.ocorrencias) == 1
    oc_gol = sumula.ocorrencias[0]
    assert oc_gol.id_integrante is None

    # Sem motivo em partida FINALIZADA -> deve recusar com 422 ConfiguracaoInvalida
    with pytest.raises(ConfiguracaoInvalida):
        atribuir_autor_ocorrencia(
            db,
            oc_gol.id_ocorrencia,
            OcorrenciaAutorAtualizar(id_integrante=int_a.id_integrante, motivo=None),
            usuario,
        )

    # Com motivo válido -> atualiza autor, mantém placar 1x0 e mantém d_final DEFINIDO
    sumula_atualizada = atribuir_autor_ocorrencia(
        db,
        oc_gol.id_ocorrencia,
        OcorrenciaAutorAtualizar(
            id_integrante=int_a.id_integrante,
            motivo="Identificado camisa 10 na súmula em papel",
        ),
        usuario,
    )
    assert sumula_atualizada.partida.placar.gols_mandante == 1
    assert sumula_atualizada.partida.placar.gols_visitante == 0
    assert sumula_atualizada.ocorrencias[0].id_integrante == int_a.id_integrante

    db.refresh(d_final)
    assert d_final.estado == "DEFINIDO"


# ==============================================================================
# 5. RESULTADO SIMPLES PRESERVA GOLS IDENTIFICADOS E BLOQUEIA REDUÇÃO INVÁLIDA
# ==============================================================================


def test_registrar_resultado_simples_preserva_gols_identificados_e_recusa_reducao_abaixo(
    db: Session, partida_agendada, equipes_e_elenco, usuario
):
    """registrar_resultado_simples preserva gols com autor, GOL_CONTRA e cartões; 422 se menor."""
    eq_m = equipes_e_elenco["eq_m"]
    int_m1 = equipes_e_elenco["int_m1"]
    int_m2 = equipes_e_elenco["int_m2"]

    # Lança 1 gol com autor para mandante, 1 gol contra de m2 (beneficia visitante) e 1 amarelo
    registrar_ocorrencia(
        db,
        partida_agendada.id_partida,
        OcorrenciaCriar(tipo="GOL", id_equipe=eq_m.id_equipe, id_integrante=int_m1.id_integrante, minuto=10),
        None,
        usuario,
    )
    registrar_ocorrencia(
        db,
        partida_agendada.id_partida,
        OcorrenciaCriar(tipo="GOL_CONTRA", id_equipe=eq_m.id_equipe, id_integrante=int_m2.id_integrante, minuto=20),
        None,
        usuario,
    )
    registrar_ocorrencia(
        db,
        partida_agendada.id_partida,
        OcorrenciaCriar(tipo="CARTAO_AMARELO", id_equipe=eq_m.id_equipe, id_integrante=int_m1.id_integrante, minuto=25),
        None,
        usuario,
    )

    # Tentar registrar 0x1 (menor que 1 gol identificado do mandante) -> 422 ConfiguracaoInvalida
    with pytest.raises(ConfiguracaoInvalida):
        registrar_resultado_simples(
            db,
            id_partida=partida_agendada.id_partida,
            dados=ResultadoSimples(gols_mandante=0, gols_visitante=1),
            idempotency_key="res-invalido",
            responsavel=usuario,
        )

    # Registrar 3x1 -> preserva o gol de int_m1, o GOL_CONTRA e o cartão, e cria +2 gols sem autoria para mandante
    detalhe = registrar_resultado_simples(
        db,
        id_partida=partida_agendada.id_partida,
        dados=ResultadoSimples(gols_mandante=3, gols_visitante=1),
        idempotency_key="res-valido-3x1",
        responsavel=usuario,
    )
    assert detalhe.placar.gols_mandante == 3
    assert detalhe.placar.gols_visitante == 1

    sumula = obter_sumula(db, partida_agendada.id_partida)
    gols_com_autor = [o for o in sumula.ocorrencias if o.tipo == "GOL" and o.id_integrante is not None]
    gols_sem_autor = [o for o in sumula.ocorrencias if o.tipo == "GOL" and o.id_integrante is None]
    gols_contra = [o for o in sumula.ocorrencias if o.tipo == "GOL_CONTRA"]
    cartoes = [o for o in sumula.ocorrencias if o.tipo == "CARTAO_AMARELO"]

    assert len(gols_com_autor) == 1
    assert gols_com_autor[0].id_integrante == int_m1.id_integrante
    assert len(gols_sem_autor) == 2
    assert len(gols_contra) == 1
    assert len(cartoes) == 1


# ==============================================================================
# 6. REABERTURA DE PARTIDA E TRAVAS NO GRAFO DE MATA-MATA
# ==============================================================================


def test_reabrir_partida_mata_mata_invalida_vagas_e_bloqueia_se_descendente_iniciou(
    db: Session, edicao_andamento, usuario
):
    """Reabrir semifinal desfaz vagas da final e 3º lugar e remove partidas não iniciadas; se iniciada, bloqueia 409."""
    eq1 = criar_equipe(db, edicao=edicao_andamento, nome="Semi Time 1")
    eq2 = criar_equipe(db, edicao=edicao_andamento, nome="Semi Time 2")
    eq3 = criar_equipe(db, edicao=edicao_andamento, nome="Semi Time 3")
    eq4 = criar_equipe(db, edicao=edicao_andamento, nome="Semi Time 4")
    db.commit()

    d_semi1 = DueloEliminatorio(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        fase="SEMIFINAL",
        posicao_chave=1,
        estado="DEFINIDO",
        ida_volta=False,
    )
    d_semi2 = DueloEliminatorio(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        fase="SEMIFINAL",
        posicao_chave=2,
        estado="DEFINIDO",
        ida_volta=False,
    )
    d_final = DueloEliminatorio(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
        estado="PENDENTE",
        ida_volta=False,
    )
    d_terceiro = DueloEliminatorio(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        fase="TERCEIRO_LUGAR",
        posicao_chave=1,
        estado="PENDENTE",
        ida_volta=False,
    )
    db.add_all([d_semi1, d_semi2, d_final, d_terceiro])
    db.commit()

    v_f1 = VagaDuelo(id_duelo=d_final.id_duelo, posicao=1, origem="VENCEDOR_DUELO", id_duelo_origem=d_semi1.id_duelo)
    v_f2 = VagaDuelo(id_duelo=d_final.id_duelo, posicao=2, origem="VENCEDOR_DUELO", id_duelo_origem=d_semi2.id_duelo)
    v_t1 = VagaDuelo(id_duelo=d_terceiro.id_duelo, posicao=1, origem="PERDEDOR_DUELO", id_duelo_origem=d_semi1.id_duelo)
    v_t2 = VagaDuelo(id_duelo=d_terceiro.id_duelo, posicao=2, origem="PERDEDOR_DUELO", id_duelo_origem=d_semi2.id_duelo)

    db.add_all([
        VagaDuelo(id_duelo=d_semi1.id_duelo, posicao=1, origem="EQUIPE_INICIAL", id_equipe=eq1.id_equipe),
        VagaDuelo(id_duelo=d_semi1.id_duelo, posicao=2, origem="EQUIPE_INICIAL", id_equipe=eq2.id_equipe),
        VagaDuelo(id_duelo=d_semi2.id_duelo, posicao=1, origem="EQUIPE_INICIAL", id_equipe=eq3.id_equipe),
        VagaDuelo(id_duelo=d_semi2.id_duelo, posicao=2, origem="EQUIPE_INICIAL", id_equipe=eq4.id_equipe),
        v_f1,
        v_f2,
        v_t1,
        v_t2,
    ])
    p_s1 = Partida(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        id_duelo=d_semi1.id_duelo,
        ordem_jogo=1,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="AGENDADA",
    )
    p_s2 = Partida(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        id_duelo=d_semi2.id_duelo,
        ordem_jogo=1,
        id_equipe_mandante=eq3.id_equipe,
        id_equipe_visitante=eq4.id_equipe,
        estado="AGENDADA",
    )
    db.add_all([p_s1, p_s2])
    db.commit()

    # Finaliza as duas semifinais -> cria partidas da Final e do 3º lugar
    registrar_resultado_simples(db, p_s1.id_partida, ResultadoSimples(gols_mandante=2, gols_visitante=0), "s1-k1", usuario)
    registrar_resultado_simples(db, p_s2.id_partida, ResultadoSimples(gols_mandante=1, gols_visitante=0), "s2-k1", usuario)

    partidas_final = db.execute(select(Partida).where(Partida.id_duelo == d_final.id_duelo)).scalars().all()
    partidas_terceiro = db.execute(select(Partida).where(Partida.id_duelo == d_terceiro.id_duelo)).scalars().all()
    assert len(partidas_final) == 1
    assert len(partidas_terceiro) == 1

    # Reabrir p_s1 quando Final e 3º lugar ainda estão AGENDADAS -> deve remover as partidas descendentes e limpar vagas
    detalhe_reaberta = reabrir_partida(db, p_s1.id_partida, "Erro no placar da semi 1", usuario)
    assert detalhe_reaberta.estado == "EM_ANDAMENTO"

    db.refresh(d_semi1)
    db.refresh(d_final)
    db.refresh(d_terceiro)
    db.refresh(v_f1)
    db.refresh(v_t1)
    assert d_semi1.estado == "DEFINIDO"
    assert d_semi1.id_equipe_vencedora is None
    assert d_final.estado == "PENDENTE"
    assert d_terceiro.estado == "PENDENTE"
    assert v_f1.id_equipe_resolvida is None
    assert v_t1.id_equipe_resolvida is None

    # Partidas da final e do 3º lugar foram removidas
    assert db.execute(select(Partida).where(Partida.id_duelo == d_final.id_duelo)).scalars().all() == []
    assert db.execute(select(Partida).where(Partida.id_duelo == d_terceiro.id_duelo)).scalars().all() == []

    # Finaliza novamente p_s1 -> recria Final e 3º lugar
    finalizar_partida(db, p_s1.id_partida, None, usuario)
    p_terceiro_nova = db.execute(select(Partida).where(Partida.id_duelo == d_terceiro.id_duelo)).scalar_one()

    # Inicia a disputa de 3º lugar -> agora reabrir p_s1 deve ser bloqueado com 409 ConflitoEstado!
    iniciar_partida(db, p_terceiro_nova.id_partida, usuario)

    with pytest.raises(ConflitoEstado):
        reabrir_partida(db, p_s1.id_partida, "Tentativa após 3º lugar iniciar", usuario)


def test_reabrir_jogo_ida_bloqueado_se_jogo_volta_iniciou(
    db: Session, edicao_andamento, usuario
):
    """Em confronto ida e volta, reabrir jogo 1 é bloqueado com 409 se o jogo 2 já iniciou."""
    eq1 = criar_equipe(db, edicao=edicao_andamento, nome="IdaVolta 1")
    eq2 = criar_equipe(db, edicao=edicao_andamento, nome="IdaVolta 2")
    db.commit()

    duelo = DueloEliminatorio(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
        estado="DEFINIDO",
        ida_volta=True,
    )
    db.add(duelo)
    db.commit()

    p_ida = Partida(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        id_duelo=duelo.id_duelo,
        ordem_jogo=1,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="FINALIZADA",
    )
    p_volta = Partida(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        id_duelo=duelo.id_duelo,
        ordem_jogo=2,
        id_equipe_mandante=eq2.id_equipe,
        id_equipe_visitante=eq1.id_equipe,
        estado="EM_ANDAMENTO",
    )
    db.add_all([p_ida, p_volta])
    db.commit()

    with pytest.raises(ConflitoEstado):
        reabrir_partida(db, p_ida.id_partida, "Tentativa com volta em andamento", usuario)


# ==============================================================================
# 7. ARTILHARIA E TESTES DE ENDPOINTS REST (API)
# ==============================================================================


def test_artilharia_edicao_e_endpoints_rest(
    client, cabecalhos_por_papel, db: Session, edicao_andamento, partida_agendada, equipes_e_elenco
):
    """Testa fluxo completo via API REST: ocorrências, autor, artilharia com jogo em andamento e finalização."""
    headers = cabecalhos_por_papel("coordenador")
    eq_m = equipes_e_elenco["eq_m"]
    int_m1 = equipes_e_elenco["int_m1"]
    int_m2 = equipes_e_elenco["int_m2"]

    # 1. POST /partidas/{id}/ocorrencias -> GOL sem autor inicialmente
    resp_oc1 = client.post(
        f"/competicoes/partidas/{partida_agendada.id_partida}/ocorrencias",
        headers={**headers, "Idempotency-Key": "api-oc-1"},
        json={"tipo": "GOL", "id_equipe": eq_m.id_equipe, "minuto": 10},
    )
    assert resp_oc1.status_code == 201
    dados_s1 = resp_oc1.json()
    assert dados_s1["partida"]["estado"] == "EM_ANDAMENTO"
    id_oc_gol = dados_s1["ocorrencias"][0]["id_ocorrencia"]

    # 2. PUT /ocorrencias/{id}/autor -> atribui int_m1 ao gol
    resp_autor = client.put(
        f"/competicoes/ocorrencias/{id_oc_gol}/autor",
        headers=headers,
        json={"id_integrante": int_m1.id_integrante},
    )
    assert resp_autor.status_code == 200
    assert resp_autor.json()["ocorrencias"][0]["id_integrante"] == int_m1.id_integrante

    # 3. POST /partidas/{id}/ocorrencias -> GOL_CONTRA de int_m2 (não deve entrar na artilharia)
    resp_oc2 = client.post(
        f"/competicoes/partidas/{partida_agendada.id_partida}/ocorrencias",
        headers=headers,
        json={"tipo": "GOL_CONTRA", "id_equipe": eq_m.id_equipe, "id_integrante": int_m2.id_integrante, "minuto": 30},
    )
    assert resp_oc2.status_code == 201

    # 4. GET /edicoes/{id}/artilharia com partida EM_ANDAMENTO
    resp_art1 = client.get(
        f"/competicoes/edicoes/{edicao_andamento.id_edicao_competicao}/artilharia",
        headers=headers,
    )
    assert resp_art1.status_code == 200
    art1 = resp_art1.json()
    assert art1["possui_jogos_em_andamento"] is True
    assert len(art1["artilheiros"]) == 1
    assert art1["artilheiros"][0]["id_integrante"] == int_m1.id_integrante
    assert art1["artilheiros"][0]["gols"] == 1
    assert art1["artilheiros"][0]["gols_em_andamento"] == 1

    # 5. POST /partidas/{id}/finalizar -> finaliza a partida
    resp_fin = client.post(
        f"/competicoes/partidas/{partida_agendada.id_partida}/finalizar",
        headers=headers,
    )
    assert resp_fin.status_code == 200
    assert resp_fin.json()["estado"] == "FINALIZADA"

    # 6. GET /edicoes/{id}/artilharia após finalizar -> gols_em_andamento = 0
    art2 = obter_artilharia_edicao(db, edicao_andamento.id_edicao_competicao)
    assert art2.possui_jogos_em_andamento is False
    assert len(art2.artilheiros) == 1
    assert art2.artilheiros[0].gols == 1
    assert art2.artilheiros[0].gols_em_andamento == 0


def test_cancelar_partida_sem_ocorrencias_e_reabrir_para_agendada(
    client, cabecalhos_por_papel, partida_agendada
):
    """POST /partidas/{id}/cancelar muda AGENDADA -> CANCELADA; reabrir volta para AGENDADA."""
    headers = cabecalhos_por_papel("coordenador")

    resp_canc = client.post(
        f"/competicoes/partidas/{partida_agendada.id_partida}/cancelar",
        headers=headers,
        json={"motivo": "Chuva forte no campo"},
    )
    assert resp_canc.status_code == 200
    assert resp_canc.json()["estado"] == "CANCELADA"

    resp_reab = client.post(
        f"/competicoes/partidas/{partida_agendada.id_partida}/reabrir",
        headers=headers,
        json={"motivo": "Jogo remarcado pela coordenação"},
    )
    assert resp_reab.status_code == 200
    assert resp_reab.json()["estado"] == "AGENDADA"


def test_finalizar_mata_mata_empatado_exige_penaltis_e_reconcilia_sancoes(
    client, cabecalhos_por_papel, db: Session, edicao_andamento, equipes_e_elenco
):
    """Finalizar mata-mata empatado sem pênaltis retorna 422; com pênaltis resolve duelo e cria suspensão."""
    headers = cabecalhos_por_papel("coordenador")
    eq_m = equipes_e_elenco["eq_m"]
    eq_v = equipes_e_elenco["eq_v"]
    int_m1 = equipes_e_elenco["int_m1"]

    duelo = DueloEliminatorio(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
        estado="DEFINIDO",
        ida_volta=False,
    )
    db.add(duelo)
    db.commit()

    db.add_all([
        VagaDuelo(id_duelo=duelo.id_duelo, posicao=1, origem="EQUIPE_INICIAL", id_equipe=eq_m.id_equipe),
        VagaDuelo(id_duelo=duelo.id_duelo, posicao=2, origem="EQUIPE_INICIAL", id_equipe=eq_v.id_equipe),
    ])
    p = Partida(
        id_edicao_competicao=edicao_andamento.id_edicao_competicao,
        id_duelo=duelo.id_duelo,
        ordem_jogo=1,
        id_equipe_mandante=eq_m.id_equipe,
        id_equipe_visitante=eq_v.id_equipe,
        estado="AGENDADA",
    )
    db.add(p)
    db.commit()

    # Inicia a partida via endpoint
    resp_ini = client.post(f"/competicoes/partidas/{p.id_partida}/iniciar", headers=headers)
    assert resp_ini.status_code == 200
    assert resp_ini.json()["estado"] == "EM_ANDAMENTO"

    # Lança cartão vermelho direto para int_m1
    resp_verm = client.post(
        f"/competicoes/partidas/{p.id_partida}/ocorrencias",
        headers=headers,
        json={
            "tipo": "CARTAO_VERMELHO_DIRETO",
            "id_equipe": eq_m.id_equipe,
            "id_integrante": int_m1.id_integrante,
            "minuto": 40,
        },
    )
    assert resp_verm.status_code == 201
    id_oc_verm = resp_verm.json()["ocorrencias"][0]["id_ocorrencia"]

    # Tentar finalizar 0x0 sem pênaltis em mata-mata -> 422
    resp_fin_erro = client.post(
        f"/competicoes/partidas/{p.id_partida}/finalizar",
        headers=headers,
    )
    assert resp_fin_erro.status_code == 422

    # Finalizar 0x0 com pênaltis 5x4 -> 200, resolve duelo e cria suspensão automática pelo vermelho
    resp_fin_ok = client.post(
        f"/competicoes/partidas/{p.id_partida}/finalizar",
        headers=headers,
        json={"penaltis_mandante": 5, "penaltis_visitante": 4},
    )
    assert resp_fin_ok.status_code == 200
    assert resp_fin_ok.json()["estado"] == "FINALIZADA"

    suspensoes = db.execute(
        select(SuspensaoCompeticao).where(
            SuspensaoCompeticao.id_edicao_competicao == edicao_andamento.id_edicao_competicao,
            SuspensaoCompeticao.id_integrante == int_m1.id_integrante,
            SuspensaoCompeticao.situacao == "ATIVA",
        )
    ).scalars().all()
    assert len(suspensoes) == 1
    assert suspensoes[0].origem == "VERMELHO_DIRETO"

    # Reabre partida e remove o cartão vermelho via DELETE /ocorrencias/{id} -> suspensão é cancelada
    client.post(
        f"/competicoes/partidas/{p.id_partida}/reabrir",
        headers=headers,
        json={"motivo": "Revisão de súmula do cartão"},
    )
    resp_del = client.delete(
        f"/competicoes/ocorrencias/{id_oc_verm}",
        headers=headers,
        params={"motivo": "Cartão aplicado ao atleta errado"},
    )
    assert resp_del.status_code == 200
    assert resp_del.json()["ocorrencias"] == []

    db.expire_all()
    susp_apos = db.execute(
        select(SuspensaoCompeticao).where(
            SuspensaoCompeticao.id_edicao_competicao == edicao_andamento.id_edicao_competicao,
            SuspensaoCompeticao.id_integrante == int_m1.id_integrante,
        )
    ).scalar_one()
    assert susp_apos.situacao == "CANCELADA"

