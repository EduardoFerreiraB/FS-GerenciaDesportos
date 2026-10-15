"""Testes de consolidação da Task 5: Serviços e API de Partidas, Agendamento e Placar Simples.

Cobre:
- Listagem filtrada de partidas com cálculo de placar por agregação de ocorrências de gol.
- RULING R28: Nenhuma coluna de placar na tabela partidas.
- Agendamento de data/hora/local/campo e limpeza com auditoria.
- Registro de resultado simples com geração de ocorrências GOL e atualização para FINALIZADA.
- RULING R29: Idempotência via RequisicaoPartida (mesmo hash retorna, hash divergente lança ConflitoEstado).
- Validação de estado da edição (deve estar EM_ANDAMENTO).
- Validação de mandante e visitante definidos.
- Avanço esportivo em duelos de mata-mata com propagação de vencedor para vagas e partidas subsequentes.
- Endpoints REST em app/competicoes/api/partidas.py com autorização e validação de contratos.
"""

from __future__ import annotations

from datetime import date, datetime, time
import pytest
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from competicoes.contratos.partidas import (
    PartidaAgendar,
    PartidaDetalhe,
    PlacarPartida,
    ResultadoSimples,
)
from competicoes.erros import ConflitoEstado, NaoEncontrado
from competicoes.modelos.disputa import DueloEliminatorio, GrupoCompeticao, VagaDuelo
from competicoes.modelos.operacao import AuditoriaCompeticao, RequisicaoPartida
from competicoes.modelos.partidas import OcorrenciaPartida, Partida
from competicoes.servicos.partidas import (
    agendar_partida,
    listar_partidas,
    registrar_resultado_simples,
)
from .factories import criar_competicao, criar_edicao_competicao, criar_equipe


# ==============================================================================
# FIXTURES LOCAIS (sem alterar conftest.py)
# ==============================================================================

@pytest.fixture()
def edicao_em_andamento(db: Session):
    edicao = criar_edicao_competicao(db, estado="EM_ANDAMENTO")
    db.commit()
    return edicao


@pytest.fixture()
def edicao_rascunho(db: Session):
    edicao = criar_edicao_competicao(db, estado="RASCUNHO")
    db.commit()
    return edicao


@pytest.fixture()
def grupo_teste(db: Session, edicao_em_andamento):
    grupo = GrupoCompeticao(
        id_edicao_competicao=edicao_em_andamento.id_edicao_competicao,
        nome="Grupo A",
        ordem=1,
    )
    db.add(grupo)
    db.commit()
    db.refresh(grupo)
    return grupo


@pytest.fixture()
def duas_equipes(db: Session, edicao_em_andamento, grupo_teste):
    eq1 = criar_equipe(db, edicao=edicao_em_andamento, nome="Time Alpha", id_grupo=grupo_teste.id_grupo)
    eq2 = criar_equipe(db, edicao=edicao_em_andamento, nome="Time Beta", id_grupo=grupo_teste.id_grupo)
    db.commit()
    return eq1, eq2


@pytest.fixture()
def partida_grupo(db: Session, edicao_em_andamento, grupo_teste, duas_equipes):
    eq1, eq2 = duas_equipes
    partida = Partida(
        id_edicao_competicao=edicao_em_andamento.id_edicao_competicao,
        id_grupo=grupo_teste.id_grupo,
        rodada=1,
        ordem_jogo=1,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="AGENDADA",
    )
    db.add(partida)
    db.commit()
    db.refresh(partida)
    return partida


# ==============================================================================
# TESTES DE SERVIÇO: LISTAGEM E PLACAR
# ==============================================================================

def test_ruling_r28_nenhuma_coluna_de_placar_em_partidas(db: Session):
    """RULING R28: O placar é agregação de ocorrências_partida, nunca colunas em partidas."""
    insp = inspect(db.get_bind())
    colunas = {c["name"] for c in insp.get_columns("partidas")}
    assert "gols_mandante" not in colunas
    assert "gols_visitante" not in colunas
    assert "placar_mandante" not in colunas
    assert "placar_visitante" not in colunas
    assert "placar" not in colunas


def test_listar_partidas_com_filtros_e_placar_agregado(
    db: Session, edicao_em_andamento, grupo_teste, duas_equipes
):
    """Testa listagem de partidas filtrada por grupo/rodada e agregação de gols por ocorrências."""
    eq1, eq2 = duas_equipes

    # Partida 1: rodada 1, terá 2 gols do mandante e 1 do visitante
    p1 = Partida(
        id_edicao_competicao=edicao_em_andamento.id_edicao_competicao,
        id_grupo=grupo_teste.id_grupo,
        rodada=1,
        ordem_jogo=1,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="FINALIZADA",
    )
    # Partida 2: rodada 2, sem gols (0x0)
    p2 = Partida(
        id_edicao_competicao=edicao_em_andamento.id_edicao_competicao,
        id_grupo=grupo_teste.id_grupo,
        rodada=2,
        ordem_jogo=1,
        id_equipe_mandante=eq2.id_equipe,
        id_equipe_visitante=eq1.id_equipe,
        estado="AGENDADA",
    )
    db.add_all([p1, p2])
    db.commit()

    # Ocorrências de gol para p1
    db.add_all([
        OcorrenciaPartida(id_partida=p1.id_partida, tipo="GOL", id_equipe_beneficiada=eq1.id_equipe),
        OcorrenciaPartida(id_partida=p1.id_partida, tipo="GOL", id_equipe_beneficiada=eq1.id_equipe),
        OcorrenciaPartida(id_partida=p1.id_partida, tipo="GOL", id_equipe_beneficiada=eq2.id_equipe),
    ])
    db.commit()

    # Listar todas da edição
    lista = listar_partidas(db, id_edicao=edicao_em_andamento.id_edicao_competicao)
    assert len(lista) == 2

    # Verifica p1 com placar 2x1
    detalhe_p1 = next(p for p in lista if p.id_partida == p1.id_partida)
    assert detalhe_p1.placar.gols_mandante == 2
    assert detalhe_p1.placar.gols_visitante == 1
    assert detalhe_p1.nome_mandante == eq1.nome
    assert detalhe_p1.nome_visitante == eq2.nome

    # Verifica p2 com placar 0x0
    detalhe_p2 = next(p for p in lista if p.id_partida == p2.id_partida)
    assert detalhe_p2.placar.gols_mandante == 0
    assert detalhe_p2.placar.gols_visitante == 0

    # Filtro por rodada 1
    r1 = listar_partidas(db, id_edicao=edicao_em_andamento.id_edicao_competicao, rodada=1)
    assert len(r1) == 1
    assert r1[0].id_partida == p1.id_partida

    # Filtro por rodada 2
    r2 = listar_partidas(db, id_edicao=edicao_em_andamento.id_edicao_competicao, rodada=2)
    assert len(r2) == 1
    assert r2[0].id_partida == p2.id_partida

    # Filtro por grupo
    rg = listar_partidas(db, id_edicao=edicao_em_andamento.id_edicao_competicao, id_grupo=grupo_teste.id_grupo)
    assert len(rg) == 2


# ==============================================================================
# TESTES DE SERVIÇO: AGENDAMENTO
# ==============================================================================

def test_agendar_partida_data_hora_local_e_limpeza(db: Session, partida_grupo, usuario):
    """Testa agendamento de data/hora/local e posterior limpeza para None, com auditoria."""
    dados_agendamento = PartidaAgendar(
        data_hora=datetime(2026, 11, 10, 15, 30),
        local="Arena Central",
        campo="Campo Principal",
    )

    detalhe = agendar_partida(db, partida_grupo.id_partida, dados_agendamento, usuario)

    assert detalhe.data == date(2026, 11, 10)
    assert detalhe.hora == time(15, 30)
    assert detalhe.local == "Arena Central"
    assert detalhe.campo == "Campo Principal"

    # Confere persistência no banco
    db.refresh(partida_grupo)
    assert partida_grupo.data == date(2026, 11, 10)
    assert partida_grupo.hora == time(15, 30)
    assert partida_grupo.id_local is not None

    # Confere auditoria
    auditoria = db.execute(
        select(AuditoriaCompeticao).where(
            AuditoriaCompeticao.entidade == "partida",
            AuditoriaCompeticao.id_entidade == partida_grupo.id_partida,
            AuditoriaCompeticao.acao == "AGENDAR_PARTIDA",
        )
    ).scalar_one_or_none()
    assert auditoria is not None
    assert auditoria.responsavel_nome == usuario.username

    # Teste de limpeza: passando None
    limpeza = PartidaAgendar(data_hora=None, local=None, campo=None)
    detalhe_limpo = agendar_partida(db, partida_grupo.id_partida, limpeza, usuario)

    assert detalhe_limpo.data is None
    assert detalhe_limpo.hora is None
    assert detalhe_limpo.id_local is None
    assert detalhe_limpo.local is None


def test_agendar_partida_inexistente_lanca_nao_encontrado(db: Session, usuario):
    """Agendar partida inexistente deve levantar NaoEncontrado."""
    with pytest.raises(NaoEncontrado):
        agendar_partida(db, 999999, PartidaAgendar(), usuario)


# ==============================================================================
# TESTES DE SERVIÇO: REGISTRO DE RESULTADO SIMPLES E IDEMPOTÊNCIA
# ==============================================================================

def test_registrar_resultado_simples_com_ocorrencias_gol(
    db: Session, partida_grupo, duas_equipes, usuario
):
    """Testa registro de resultado simples: gera ocorrências de gol e marca FINALIZADA."""
    eq1, eq2 = duas_equipes
    dados = ResultadoSimples(gols_mandante=3, gols_visitante=1)

    detalhe = registrar_resultado_simples(
        db,
        id_partida=partida_grupo.id_partida,
        dados=dados,
        idempotency_key="key-reg-1",
        responsavel=usuario,
    )

    assert detalhe.status == "FINALIZADA"
    assert detalhe.estado == "FINALIZADA"
    assert detalhe.placar.gols_mandante == 3
    assert detalhe.placar.gols_visitante == 1

    # Confere ocorrências de gol no banco
    ocorrencias = db.execute(
        select(OcorrenciaPartida).where(OcorrenciaPartida.id_partida == partida_grupo.id_partida)
    ).scalars().all()
    assert len(ocorrencias) == 4

    gols_eq1 = [oc for oc in ocorrencias if oc.id_equipe_beneficiada == eq1.id_equipe]
    gols_eq2 = [oc for oc in ocorrencias if oc.id_equipe_beneficiada == eq2.id_equipe]
    assert len(gols_eq1) == 3
    assert len(gols_eq2) == 1

    # Confere registro em RequisicaoPartida
    req = db.execute(
        select(RequisicaoPartida).where(
            RequisicaoPartida.id_partida == partida_grupo.id_partida,
            RequisicaoPartida.chave_idempotencia == "key-reg-1",
        )
    ).scalar_one_or_none()
    assert req is not None


def test_idempotencia_mesma_chave_mesmo_payload_retorna_resultado(
    db: Session, partida_grupo, usuario
):
    """RULING R29: Mesma chave com mesmo payload devolve resultado processado sem duplicar gols."""
    dados = ResultadoSimples(gols_mandante=2, gols_visitante=0)

    res1 = registrar_resultado_simples(
        db,
        id_partida=partida_grupo.id_partida,
        dados=dados,
        idempotency_key="key-idemp-1",
        responsavel=usuario,
    )

    # Segunda chamada com mesmo payload
    res2 = registrar_resultado_simples(
        db,
        id_partida=partida_grupo.id_partida,
        dados=dados,
        idempotency_key="key-idemp-1",
        responsavel=usuario,
    )

    assert res1.id_partida == res2.id_partida
    assert res2.placar.gols_mandante == 2
    assert res2.placar.gols_visitante == 0

    # Total de ocorrências não pode ter dobrado
    total_gols = db.execute(
        select(OcorrenciaPartida).where(OcorrenciaPartida.id_partida == partida_grupo.id_partida)
    ).scalars().all()
    assert len(total_gols) == 2


def test_idempotencia_mesma_chave_payload_divergente_lanca_conflito(
    db: Session, partida_grupo, usuario
):
    """RULING R29: Mesma chave com payload divergente deve levantar ConflitoEstado."""
    dados1 = ResultadoSimples(gols_mandante=2, gols_visitante=0)
    dados2 = ResultadoSimples(gols_mandante=2, gols_visitante=1)

    registrar_resultado_simples(
        db,
        id_partida=partida_grupo.id_partida,
        dados=dados1,
        idempotency_key="key-conflito-1",
        responsavel=usuario,
    )

    with pytest.raises(ConflitoEstado) as exc_info:
        registrar_resultado_simples(
            db,
            id_partida=partida_grupo.id_partida,
            dados=dados2,
            idempotency_key="key-conflito-1",
            responsavel=usuario,
        )
    assert "divergente" in exc_info.value.mensagem.lower()


def test_registrar_resultado_edicao_rascunho_lanca_conflito(
    db: Session, edicao_rascunho, usuario
):
    """Edição em RASCUNHO não permite registrar resultado (exige EM_ANDAMENTO)."""
    eq1 = criar_equipe(db, edicao=edicao_rascunho, nome="Equipe Rascunho 1")
    eq2 = criar_equipe(db, edicao=edicao_rascunho, nome="Equipe Rascunho 2")
    p = Partida(
        id_edicao_competicao=edicao_rascunho.id_edicao_competicao,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        estado="AGENDADA",
    )
    db.add(p)
    db.commit()

    dados = ResultadoSimples(gols_mandante=1, gols_visitante=0)
    with pytest.raises(ConflitoEstado) as exc_info:
        registrar_resultado_simples(
            db,
            id_partida=p.id_partida,
            dados=dados,
            idempotency_key="key-rascunho",
            responsavel=usuario,
        )
    assert "em_andamento" in exc_info.value.mensagem.lower() or "em andamento" in exc_info.value.mensagem.lower()


def test_re_registrar_resultado_com_nova_chave_substitui_ocorrencias(
    db: Session, partida_grupo, usuario
):
    """Re-registrar resultado de uma partida deve limpar ocorrências anteriores e gravar o novo placar."""
    # 1. Primeiro resultado: 2x0
    registrar_resultado_simples(
        db,
        id_partida=partida_grupo.id_partida,
        dados=ResultadoSimples(gols_mandante=2, gols_visitante=0),
        idempotency_key="key-v1",
        responsavel=usuario,
    )

    # 2. Correção de súmula com nova chave: 1x1
    detalhe_v2 = registrar_resultado_simples(
        db,
        id_partida=partida_grupo.id_partida,
        dados=ResultadoSimples(gols_mandante=1, gols_visitante=1),
        idempotency_key="key-v2",
        responsavel=usuario,
    )

    assert detalhe_v2.placar.gols_mandante == 1
    assert detalhe_v2.placar.gols_visitante == 1

    total_gols = db.execute(
        select(OcorrenciaPartida).where(OcorrenciaPartida.id_partida == partida_grupo.id_partida)
    ).scalars().all()
    assert len(total_gols) == 2


# ==============================================================================
# TESTES DE SERVIÇO: AVANÇO AUTOMÁTICO EM MATA-MATA
# ==============================================================================

def test_registrar_resultado_mata_mata_avanca_vencedor_e_atualiza_proxima_partida(
    db: Session, edicao_em_andamento, usuario
):
    """Testa se finalizar a partida de um duelo resolve o duelo e propaga o vencedor para a final."""
    eq_a = criar_equipe(db, edicao=edicao_em_andamento, nome="Equipe A")
    eq_b = criar_equipe(db, edicao=edicao_em_andamento, nome="Equipe B")
    eq_c = criar_equipe(db, edicao=edicao_em_andamento, nome="Equipe C")
    db.commit()

    # Duelo 1 (Semi 1): Equipe A vs Equipe B
    d1 = DueloEliminatorio(
        id_edicao_competicao=edicao_em_andamento.id_edicao_competicao,
        fase="SEMIFINAL",
        posicao_chave=1,
        estado="DEFINIDO",
        ida_volta=False,
    )
    # Duelo 2 (Final): Vencedor D1 vs Equipe C
    d2 = DueloEliminatorio(
        id_edicao_competicao=edicao_em_andamento.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
        estado="PENDENTE",
        ida_volta=False,
    )
    db.add_all([d1, d2])
    db.commit()

    # Vagas do Duelo 1
    v1_d1 = VagaDuelo(id_duelo=d1.id_duelo, posicao=1, origem="EQUIPE_INICIAL", id_equipe=eq_a.id_equipe)
    v2_d1 = VagaDuelo(id_duelo=d1.id_duelo, posicao=2, origem="EQUIPE_INICIAL", id_equipe=eq_b.id_equipe)

    # Vagas do Duelo 2 (Final)
    v1_d2 = VagaDuelo(
        id_duelo=d2.id_duelo,
        posicao=1,
        origem="VENCEDOR_DUELO",
        id_duelo_origem=d1.id_duelo,
    )
    v2_d2 = VagaDuelo(id_duelo=d2.id_duelo, posicao=2, origem="EQUIPE_INICIAL", id_equipe=eq_c.id_equipe)
    db.add_all([v1_d1, v2_d1, v1_d2, v2_d2])
    db.commit()

    # Partida do Duelo 1
    p1 = Partida(
        id_edicao_competicao=edicao_em_andamento.id_edicao_competicao,
        id_duelo=d1.id_duelo,
        ordem_jogo=1,
        id_equipe_mandante=eq_a.id_equipe,
        id_equipe_visitante=eq_b.id_equipe,
        estado="AGENDADA",
    )
    db.add(p1)
    db.commit()

    # Registrar vitória da Equipe A por 2x1
    dados = ResultadoSimples(gols_mandante=2, gols_visitante=1)
    registrar_resultado_simples(
        db,
        id_partida=p1.id_partida,
        dados=dados,
        idempotency_key="key-semi-1",
        responsavel=usuario,
    )

    # Confere que o Duelo 1 foi RESOLVIDO com vencedor Equipe A
    db.refresh(d1)
    assert d1.estado == "RESOLVIDO"
    assert d1.id_equipe_vencedora == eq_a.id_equipe

    # Confere que a Vaga 1 do Duelo 2 foi resolvida com Equipe A
    db.refresh(v1_d2)
    assert v1_d2.id_equipe_resolvida == eq_a.id_equipe

    # Confere que o Duelo 2 passou a ser DEFINIDO
    db.refresh(d2)
    assert d2.estado == "DEFINIDO"

    # Confere que a partida da Final foi criada/atualizada com Equipe A e Equipe C
    partidas_final = db.execute(
        select(Partida).where(Partida.id_duelo == d2.id_duelo)
    ).scalars().all()
    assert len(partidas_final) == 1
    assert partidas_final[0].id_equipe_mandante == eq_a.id_equipe
    assert partidas_final[0].id_equipe_visitante == eq_c.id_equipe


def test_registrar_resultado_com_penaltis_em_empate_mata_mata(
    db: Session, edicao_em_andamento, usuario
):
    """Testa desempate por pênaltis em partida eliminatória."""
    eq_a = criar_equipe(db, edicao=edicao_em_andamento, nome="Time Penalti A")
    eq_b = criar_equipe(db, edicao=edicao_em_andamento, nome="Time Penalti B")
    db.commit()

    duelo = DueloEliminatorio(
        id_edicao_competicao=edicao_em_andamento.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
        estado="DEFINIDO",
        ida_volta=False,
    )
    db.add(duelo)
    db.commit()

    db.add_all([
        VagaDuelo(id_duelo=duelo.id_duelo, posicao=1, origem="EQUIPE_INICIAL", id_equipe=eq_a.id_equipe),
        VagaDuelo(id_duelo=duelo.id_duelo, posicao=2, origem="EQUIPE_INICIAL", id_equipe=eq_b.id_equipe),
    ])
    partida = Partida(
        id_edicao_competicao=edicao_em_andamento.id_edicao_competicao,
        id_duelo=duelo.id_duelo,
        ordem_jogo=1,
        id_equipe_mandante=eq_a.id_equipe,
        id_equipe_visitante=eq_b.id_equipe,
        estado="AGENDADA",
    )
    db.add(partida)
    db.commit()

    # 1x1 no tempo normal, 5x4 nos pênaltis para o visitante (eq_b)
    dados = ResultadoSimples(
        gols_mandante=1,
        gols_visitante=1,
        penaltis_mandante=4,
        penaltis_visitante=5,
    )
    detalhe = registrar_resultado_simples(
        db,
        id_partida=partida.id_partida,
        dados=dados,
        idempotency_key="key-penaltis-final",
        responsavel=usuario,
    )

    assert detalhe.placar.gols_mandante == 1
    assert detalhe.placar.gols_visitante == 1
    assert detalhe.placar.penaltis_mandante == 4
    assert detalhe.placar.penaltis_visitante == 5

    db.refresh(duelo)
    assert duelo.estado == "RESOLVIDO"
    assert duelo.id_equipe_vencedora == eq_b.id_equipe


# ==============================================================================
# TESTES DE API HTTP (FastAPI TestClient)
# ==============================================================================

def test_api_listar_partidas(client, cabecalhos_por_papel, partida_grupo):
    """GET /competicoes/edicoes/{id}/partidas deve retornar 200 com lista de partidas."""
    headers = cabecalhos_por_papel("professor")
    resp = client.get(
        f"/competicoes/edicoes/{partida_grupo.id_edicao_competicao}/partidas",
        headers=headers,
    )
    assert resp.status_code == 200
    dados = resp.json()
    assert isinstance(dados, list)
    assert len(dados) >= 1
    assert dados[0]["id_partida"] == partida_grupo.id_partida
    assert "placar" in dados[0]


def test_api_agendar_partida_como_coordenador(client, cabecalhos_por_papel, partida_grupo):
    """PATCH /competicoes/partidas/{id}/agendamento deve atualizar dados com 200."""
    headers = cabecalhos_por_papel("coordenador")
    payload = {
        "data_hora": "2026-10-25T14:00:00",
        "local": "Campo Sul",
        "campo": "Campo 1",
    }
    resp = client.patch(
        f"/competicoes/partidas/{partida_grupo.id_partida}/agendamento",
        headers=headers,
        json=payload,
    )
    assert resp.status_code == 200
    res = resp.json()
    assert res["data"] == "2026-10-25"
    assert res["hora"] == "14:00:00"
    assert res["local"] == "Campo Sul"


def test_api_agendar_partida_permissao_negada_para_assistente(client, cabecalhos_por_papel, partida_grupo):
    """PATCH /competicoes/partidas/{id}/agendamento deve recusar com 403 se não for coordenador/admin."""
    headers = cabecalhos_por_papel("assistente")
    resp = client.patch(
        f"/competicoes/partidas/{partida_grupo.id_partida}/agendamento",
        headers=headers,
        json={"local": "Tentativa Invalida"},
    )
    assert resp.status_code == 403


def test_api_registrar_resultado_simples(client, cabecalhos_por_papel, partida_grupo):
    """POST /competicoes/partidas/{id}/resultado-simples registra placar com header Idempotency-Key."""
    headers = cabecalhos_por_papel("coordenador")
    headers["Idempotency-Key"] = "http-idemp-key-1"

    payload = {
        "gols_mandante": 2,
        "gols_visitante": 1,
    }
    resp = client.post(
        f"/competicoes/partidas/{partida_grupo.id_partida}/resultado-simples",
        headers=headers,
        json=payload,
    )
    assert resp.status_code == 200
    res = resp.json()
    assert res["placar"]["gols_mandante"] == 2
    assert res["placar"]["gols_visitante"] == 1
    assert res["status"] == "FINALIZADA"


def test_api_registrar_resultado_sem_idempotency_key_recusa(client, cabecalhos_por_papel, partida_grupo):
    """POST /competicoes/partidas/{id}/resultado-simples sem Header Idempotency-Key deve retornar 422."""
    headers = cabecalhos_por_papel("coordenador")
    resp = client.post(
        f"/competicoes/partidas/{partida_grupo.id_partida}/resultado-simples",
        headers=headers,
        json={"gols_mandante": 1, "gols_visitante": 0},
    )
    assert resp.status_code == 422


def test_api_registrar_resultado_com_gols_negativos_recusa_422(client, cabecalhos_por_papel, partida_grupo):
    """Validação de payload com gols negativos deve retornar 422."""
    headers = cabecalhos_por_papel("coordenador")
    headers["Idempotency-Key"] = "key-negativo"
    resp = client.post(
        f"/competicoes/partidas/{partida_grupo.id_partida}/resultado-simples",
        headers=headers,
        json={"gols_mandante": -1, "gols_visitante": 0},
    )
    assert resp.status_code == 422
