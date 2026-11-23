"""Testes de schema, modelos e integridade referencial da Fatia 2.

Cobre grupos_competicao, duelos_eliminatorios, vagas_duelo, partidas e ocorrencias_partida.
Garante o isolamento por edicao via chaves estrangeiras compostas e restricoes CHECK.
"""

from __future__ import annotations

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from . import factories as f


TABELAS_FATIA2 = {
    "grupos_competicao",
    "duelos_eliminatorios",
    "vagas_duelo",
    "partidas",
    "ocorrencias_partida",
}


def test_tabelas_fatia2_registradas_no_metadata(schema_migrado):
    tabelas = set(schema_migrado.get_table_names())
    assert TABELAS_FATIA2 <= tabelas


def test_colunas_obrigatorias_fatia2(schema_migrado):
    colunas_grupos = {c["name"] for c in schema_migrado.get_columns("grupos_competicao")}
    assert {"id_grupo", "id_edicao_competicao", "nome", "ordem"} <= colunas_grupos

    colunas_duelos = {c["name"] for c in schema_migrado.get_columns("duelos_eliminatorios")}
    assert {
        "id_duelo",
        "id_edicao_competicao",
        "fase",
        "posicao_chave",
        "estado",
        "id_equipe_vencedora",
        "ida_volta",
    } <= colunas_duelos

    colunas_vagas = {c["name"] for c in schema_migrado.get_columns("vagas_duelo")}
    assert {
        "id_vaga",
        "id_duelo",
        "posicao",
        "origem",
        "id_equipe",
        "id_grupo",
        "posicao_grupo",
        "id_duelo_origem",
        "id_equipe_resolvida",
    } <= colunas_vagas

    colunas_partidas = {c["name"] for c in schema_migrado.get_columns("partidas")}
    assert {
        "id_partida",
        "id_edicao_competicao",
        "id_grupo",
        "id_duelo",
        "rodada",
        "ordem_jogo",
        "id_equipe_mandante",
        "id_equipe_visitante",
        "data",
        "hora",
        "id_local",
        "id_arbitro",
        "estado",
        "penaltis_mandante",
        "penaltis_visitante",
        "revisao",
        "criado_em",
        "atualizado_em",
    } <= colunas_partidas

    # RULING R28: placar nao e coluna em partidas
    assert "gols_mandante" not in colunas_partidas
    assert "gols_visitante" not in colunas_partidas
    assert "placar" not in colunas_partidas

    colunas_ocorrencias = {c["name"] for c in schema_migrado.get_columns("ocorrencias_partida")}
    assert {
        "id_ocorrencia",
        "id_partida",
        "tipo",
        "id_equipe_beneficiada",
        "id_integrante",
        "minuto",
        "periodo",
        "observacao",
        "id_usuario_autor",
        "id_ocorrencia_origem",
        "criado_em",
    } <= colunas_ocorrencias


def test_coluna_id_grupo_em_equipes(schema_migrado):
    colunas_equipes = {c["name"] for c in schema_migrado.get_columns("equipes")}
    assert "id_grupo" in colunas_equipes


def test_fk_requisicao_partida(db):
    """RequisicaoPartida.id_partida referencia partidas.id_partida com CASCADE."""
    from competicoes.modelos.disputa import GrupoCompeticao
    from competicoes.modelos.operacao import RequisicaoPartida
    from competicoes.modelos.partidas import Partida

    edicao = f.criar_edicao_competicao(db)
    equipe_m = f.criar_equipe(db, edicao, nome="Mandante")
    equipe_v = f.criar_equipe(db, edicao, nome="Visitante")

    partida = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=equipe_m.id_equipe,
        id_equipe_visitante=equipe_v.id_equipe,
    )
    db.add(partida)
    db.flush()

    req = RequisicaoPartida(
        id_partida=partida.id_partida,
        chave_idempotencia="key-123",
        hash_payload="hash-abc",
    )
    db.add(req)
    db.flush()

    # Requisicao com partida inexistente falha por FK
    req_invalida = RequisicaoPartida(
        id_partida=999999,
        chave_idempotencia="key-invalida",
        hash_payload="hash-xyz",
    )
    db.add(req_invalida)
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        db.flush()
    db.rollback()


def test_fk_composta_equipe_grupo_mesma_edicao(db):
    """Equipe associada a grupo de OUTRA edicao e rejeitada no flush."""
    from competicoes.modelos.disputa import GrupoCompeticao

    competicao = f.criar_competicao(db)
    edicao_a = f.criar_edicao_competicao(db, competicao, identificacao="2026")
    edicao_b = f.criar_edicao_competicao(db, competicao, identificacao="2027")

    grupo_a = GrupoCompeticao(
        id_edicao_competicao=edicao_a.id_edicao_competicao,
        nome="Grupo A",
        ordem=1,
    )
    db.add(grupo_a)
    db.flush()

    # Equipe da edicao B tentando apontar para grupo da edicao A
    equipe_b = f.criar_equipe(db, edicao_b, nome="Time B")
    equipe_b.id_grupo = grupo_a.id_grupo
    db.add(equipe_b)

    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        db.flush()
    db.rollback()


def test_fk_composta_partida_equipes_mesma_edicao(db):
    """Partida com equipe mandante ou visitante de OUTRA edicao e rejeitada no flush."""
    from competicoes.modelos.partidas import Partida

    competicao = f.criar_competicao(db)
    edicao_a = f.criar_edicao_competicao(db, competicao, identificacao="2026")
    edicao_b = f.criar_edicao_competicao(db, competicao, identificacao="2027")

    equipe_a1 = f.criar_equipe(db, edicao_a, nome="Time A1")
    equipe_a2 = f.criar_equipe(db, edicao_a, nome="Time A2")
    equipe_b1 = f.criar_equipe(db, edicao_b, nome="Time B1")

    # Mandante de outra edicao
    partida_invalida_mandante = Partida(
        id_edicao_competicao=edicao_a.id_edicao_competicao,
        id_equipe_mandante=equipe_b1.id_equipe,
        id_equipe_visitante=equipe_a2.id_equipe,
    )
    db.add(partida_invalida_mandante)
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        db.flush()
    db.rollback()

    # Visitante de outra edicao
    partida_invalida_visitante = Partida(
        id_edicao_competicao=edicao_a.id_edicao_competicao,
        id_equipe_mandante=equipe_a1.id_equipe,
        id_equipe_visitante=equipe_b1.id_equipe,
    )
    db.add(partida_invalida_visitante)
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        db.flush()
    db.rollback()


def test_fk_composta_partida_grupo_mesma_edicao(db):
    """Partida associada a grupo de outra edicao e rejeitada no flush."""
    from competicoes.modelos.disputa import GrupoCompeticao
    from competicoes.modelos.partidas import Partida

    competicao = f.criar_competicao(db)
    edicao_a = f.criar_edicao_competicao(db, competicao, identificacao="2026")
    edicao_b = f.criar_edicao_competicao(db, competicao, identificacao="2027")

    grupo_b = GrupoCompeticao(
        id_edicao_competicao=edicao_b.id_edicao_competicao,
        nome="Grupo B",
        ordem=1,
    )
    db.add(grupo_b)
    db.flush()

    equipe_a1 = f.criar_equipe(db, edicao_a, nome="Time A1")
    equipe_a2 = f.criar_equipe(db, edicao_a, nome="Time A2")

    partida = Partida(
        id_edicao_competicao=edicao_a.id_edicao_competicao,
        id_grupo=grupo_b.id_grupo,
        id_equipe_mandante=equipe_a1.id_equipe,
        id_equipe_visitante=equipe_a2.id_equipe,
    )
    db.add(partida)
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        db.flush()
    db.rollback()


def test_fk_composta_partida_duelo_mesma_edicao(db):
    """Partida associada a duelo de outra edicao e rejeitada no flush."""
    from competicoes.modelos.disputa import DueloEliminatorio
    from competicoes.modelos.partidas import Partida

    competicao = f.criar_competicao(db)
    edicao_a = f.criar_edicao_competicao(db, competicao, identificacao="2026")
    edicao_b = f.criar_edicao_competicao(db, competicao, identificacao="2027")

    duelo_b = DueloEliminatorio(
        id_edicao_competicao=edicao_b.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
    )
    db.add(duelo_b)
    db.flush()

    equipe_a1 = f.criar_equipe(db, edicao_a, nome="Time A1")
    equipe_a2 = f.criar_equipe(db, edicao_a, nome="Time A2")

    partida = Partida(
        id_edicao_competicao=edicao_a.id_edicao_competicao,
        id_duelo=duelo_b.id_duelo,
        id_equipe_mandante=equipe_a1.id_equipe,
        id_equipe_visitante=equipe_a2.id_equipe,
    )
    db.add(partida)
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        db.flush()
    db.rollback()


def test_check_partida_mandante_diferente_de_visitante(db):
    """CheckConstraint ck_partidas_equipes_distintas rejeita mandante == visitante."""
    from competicoes.modelos.partidas import Partida

    edicao = f.criar_edicao_competicao(db)
    equipe = f.criar_equipe(db, edicao, nome="Time Unico")

    partida_invalida = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=equipe.id_equipe,
        id_equipe_visitante=equipe.id_equipe,
    )
    db.add(partida_invalida)
    with pytest.raises(IntegrityError, match="CHECK"):
        db.flush()
    db.rollback()


def test_unicidade_grupos(db):
    """Nome de grupo e unico por edicao."""
    from competicoes.modelos.disputa import GrupoCompeticao

    edicao = f.criar_edicao_competicao(db)
    g1 = GrupoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        nome="Grupo A",
        ordem=1,
    )
    db.add(g1)
    db.flush()

    g2 = GrupoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        nome="Grupo A",
        ordem=2,
    )
    db.add(g2)
    with pytest.raises(IntegrityError, match="UNIQUE"):
        db.flush()
    db.rollback()


def test_unicidade_duelos(db):
    """(fase, posicao_chave) e unico por edicao."""
    from competicoes.modelos.disputa import DueloEliminatorio

    edicao = f.criar_edicao_competicao(db)
    d1 = DueloEliminatorio(
        id_edicao_competicao=edicao.id_edicao_competicao,
        fase="SEMIFINAL",
        posicao_chave=1,
    )
    db.add(d1)
    db.flush()

    d2 = DueloEliminatorio(
        id_edicao_competicao=edicao.id_edicao_competicao,
        fase="SEMIFINAL",
        posicao_chave=1,
    )
    db.add(d2)
    with pytest.raises(IntegrityError, match="UNIQUE"):
        db.flush()
    db.rollback()


def test_unicidade_vagas_duelo(db):
    """posicao (1 ou 2) e unica por duelo."""
    from competicoes.modelos.disputa import DueloEliminatorio, VagaDuelo

    edicao = f.criar_edicao_competicao(db)
    duelo = DueloEliminatorio(
        id_edicao_competicao=edicao.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
    )
    db.add(duelo)
    db.flush()

    v1 = VagaDuelo(
        id_duelo=duelo.id_duelo,
        posicao=1,
        origem="FOLGA",
    )
    db.add(v1)
    db.flush()

    v2 = VagaDuelo(
        id_duelo=duelo.id_duelo,
        posicao=1,
        origem="FOLGA",
    )
    db.add(v2)
    with pytest.raises(IntegrityError, match="UNIQUE"):
        db.flush()
    db.rollback()


def test_cascade_delete_edicao_remove_grupos_e_duelos(db):
    """Excluir edicao_competicao remove em cascata grupos e duelos eliminatorios."""
    from competicoes.modelos.disputa import DueloEliminatorio, GrupoCompeticao
    from competicoes.modelos.organizacao import EdicaoCompeticao

    edicao = f.criar_edicao_competicao(db)
    grupo = GrupoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        nome="Grupo A",
        ordem=1,
    )
    duelo = DueloEliminatorio(
        id_edicao_competicao=edicao.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
    )
    db.add_all([grupo, duelo])
    db.commit()

    id_edicao = edicao.id_edicao_competicao
    id_grupo = grupo.id_grupo
    id_duelo = duelo.id_duelo

    db.delete(edicao)
    db.commit()
    db.expire_all()

    assert db.get(EdicaoCompeticao, id_edicao) is None
    assert db.get(GrupoCompeticao, id_grupo) is None
    assert db.get(DueloEliminatorio, id_duelo) is None


def test_cascade_delete_duelo_remove_vagas(db):
    """Excluir duelo_eliminatorio remove em cascata suas vagas_duelo."""
    from competicoes.modelos.disputa import DueloEliminatorio, VagaDuelo

    edicao = f.criar_edicao_competicao(db)
    duelo = DueloEliminatorio(
        id_edicao_competicao=edicao.id_edicao_competicao,
        fase="FINAL",
        posicao_chave=1,
    )
    db.add(duelo)
    db.flush()

    vaga = VagaDuelo(id_duelo=duelo.id_duelo, posicao=1, origem="FOLGA")
    db.add(vaga)
    db.commit()

    id_duelo = duelo.id_duelo
    id_vaga = vaga.id_vaga

    db.delete(duelo)
    db.commit()
    db.expire_all()

    assert db.get(DueloEliminatorio, id_duelo) is None
    assert db.get(VagaDuelo, id_vaga) is None


def test_cascade_delete_partida_remove_ocorrencias_e_requisicoes(db):
    """Excluir partida remove em cascata suas ocorrencias e requisicoes_partida."""
    from competicoes.modelos.operacao import RequisicaoPartida
    from competicoes.modelos.partidas import OcorrenciaPartida, Partida

    edicao = f.criar_edicao_competicao(db)
    equipe_m = f.criar_equipe(db, edicao, nome="Time M")
    equipe_v = f.criar_equipe(db, edicao, nome="Time V")

    partida = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=equipe_m.id_equipe,
        id_equipe_visitante=equipe_v.id_equipe,
    )
    db.add(partida)
    db.flush()

    ocorrencia = OcorrenciaPartida(
        id_partida=partida.id_partida,
        tipo="GOL",
        id_equipe_beneficiada=equipe_m.id_equipe,
    )
    requisicao = RequisicaoPartida(
        id_partida=partida.id_partida,
        chave_idempotencia="key-cascade",
        hash_payload="hash-cascade",
    )
    db.add_all([ocorrencia, requisicao])
    db.commit()

    id_partida = partida.id_partida
    id_ocorrencia = ocorrencia.id_ocorrencia
    id_requisicao = requisicao.id_requisicao

    db.delete(partida)
    db.commit()
    db.expire_all()

    assert db.get(Partida, id_partida) is None
    assert db.get(OcorrenciaPartida, id_ocorrencia) is None
    assert db.get(RequisicaoPartida, id_requisicao) is None
