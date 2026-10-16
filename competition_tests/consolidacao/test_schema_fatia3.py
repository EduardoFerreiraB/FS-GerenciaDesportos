"""Testes de schema, modelos e integridade referencial da Fatia 3.

Cobre a expansao de TIPOS_OCORRENCIA em ocorrencias_partida e as tabelas
suspensoes_competicao, cumprimentos_suspensao e decisoes_classificacao.
"""

from __future__ import annotations

import pytest
from alembic import command
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import configure_mappers

from . import factories as f
from .conftest import ROOT, config_alembic


TABELAS_FATIA3 = {
    "suspensoes_competicao",
    "cumprimentos_suspensao",
    "decisoes_classificacao",
}


def test_tabelas_fatia3_registradas_no_metadata(schema_migrado):
    tabelas = set(schema_migrado.get_table_names())
    assert TABELAS_FATIA3 <= tabelas


def test_migracao_fatia3_nao_importa_modelos():
    fonte = next((ROOT / "alembic" / "versions").glob("20261015_0400_*.py")).read_text()
    assert "import models" not in fonte
    assert "competicoes.modelos" not in fonte
    assert "from database" not in fonte


def test_modelos_fatia3_reexportados():
    import models  # noqa: F401 - registra Usuario e demais modelos base
    import competicoes.modelos as modelos
    from database import Base

    configure_mappers()
    nomes_modelos = {
        "SuspensaoCompeticao",
        "CumprimentoSuspensao",
        "DecisaoClassificacao",
    }
    assert nomes_modelos <= set(vars(modelos))
    assert all(issubclass(getattr(modelos, nome), Base) for nome in nomes_modelos)
    assert modelos.ORIGENS_SUSPENSAO == (
        "ACUMULO_AMARELOS",
        "VERMELHO_DIRETO",
        "SEGUNDO_AMARELO",
        "MANUAL",
    )
    assert modelos.SITUACOES_SUSPENSAO == (
        "ATIVA",
        "CUMPRIDA",
        "EM_REVISAO",
        "CANCELADA",
    )
    assert modelos.TIPOS_OCORRENCIA == (
        "GOL",
        "GOL_CONTRA",
        "CARTAO_AMARELO",
        "CARTAO_VERMELHO_DIRETO",
        "EXPULSAO_SEGUNDO_AMARELO",
    )
    assert "ck_suspensoes_jogos_positivo" in modelos.CHECKS_PARA_SERVICO


def test_colunas_obrigatorias_fatia3(schema_migrado):
    colunas_suspensoes = {
        c["name"] for c in schema_migrado.get_columns("suspensoes_competicao")
    }
    assert {
        "id_suspensao",
        "id_edicao_competicao",
        "id_integrante",
        "id_partida_origem",
        "id_ocorrencia_origem",
        "motivo",
        "origem",
        "chave_origem",
        "jogos",
        "situacao",
        "id_usuario_responsavel",
        "criado_em",
        "atualizado_em",
    } <= colunas_suspensoes

    colunas_cumprimentos = {
        c["name"] for c in schema_migrado.get_columns("cumprimentos_suspensao")
    }
    assert {
        "id_cumprimento",
        "id_suspensao",
        "id_integrante",
        "id_partida",
        "id_usuario_responsavel",
        "criado_em",
    } <= colunas_cumprimentos

    colunas_decisoes = {
        c["name"] for c in schema_migrado.get_columns("decisoes_classificacao")
    }
    assert {
        "id_decisao",
        "id_edicao_competicao",
        "id_grupo",
        "conjunto_equipes",
        "ordem_escolhida",
        "motivo",
        "revisao_resultados",
        "id_usuario_responsavel",
        "criado_em",
    } <= colunas_decisoes


def test_insercao_novos_tipos_ocorrencia(db):
    """Permite inserir GOL_CONTRA, CARTAO_AMARELO, CARTAO_VERMELHO_DIRETO e EXPULSAO_SEGUNDO_AMARELO."""
    from competicoes.modelos.partidas import OcorrenciaPartida, Partida, TIPOS_OCORRENCIA

    assert tuple(OcorrenciaPartida.__table__.c.tipo.type.enums) == TIPOS_OCORRENCIA

    edicao = f.criar_edicao_competicao(db)
    equipe_m = f.criar_equipe(db, edicao, nome="Mandante")
    equipe_v = f.criar_equipe(db, edicao, nome="Visitante")
    atleta_m = f.criar_integrante(db, equipe_m)
    atleta_v = f.criar_integrante(db, equipe_v)

    partida = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=equipe_m.id_equipe,
        id_equipe_visitante=equipe_v.id_equipe,
    )
    db.add(partida)
    db.flush()

    gol_contra = OcorrenciaPartida(
        id_partida=partida.id_partida,
        tipo="GOL_CONTRA",
        id_equipe_beneficiada=equipe_m.id_equipe,
        id_integrante=atleta_v.id_integrante,
        minuto=15,
    )
    amarelo_1 = OcorrenciaPartida(
        id_partida=partida.id_partida,
        tipo="CARTAO_AMARELO",
        id_equipe_beneficiada=equipe_m.id_equipe,
        id_integrante=atleta_m.id_integrante,
        minuto=20,
    )
    amarelo_2 = OcorrenciaPartida(
        id_partida=partida.id_partida,
        tipo="CARTAO_AMARELO",
        id_equipe_beneficiada=equipe_m.id_equipe,
        id_integrante=atleta_m.id_integrante,
        minuto=65,
    )
    vermelho_direto = OcorrenciaPartida(
        id_partida=partida.id_partida,
        tipo="CARTAO_VERMELHO_DIRETO",
        id_equipe_beneficiada=equipe_v.id_equipe,
        id_integrante=atleta_v.id_integrante,
        minuto=80,
    )
    db.add_all([gol_contra, amarelo_1, amarelo_2, vermelho_direto])
    db.flush()

    expulsao_2a = OcorrenciaPartida(
        id_partida=partida.id_partida,
        tipo="EXPULSAO_SEGUNDO_AMARELO",
        id_equipe_beneficiada=equipe_m.id_equipe,
        id_integrante=atleta_m.id_integrante,
        minuto=65,
        id_ocorrencia_origem=amarelo_2.id_ocorrencia,
    )
    db.add(expulsao_2a)
    db.flush()

    assert expulsao_2a.id_ocorrencia is not None
    assert expulsao_2a.ocorrencia_origem.id_ocorrencia == amarelo_2.id_ocorrencia


def test_uq_suspensoes_chave_origem_e_check_jogos(db):
    """uq_suspensoes_chave_origem rejeita chave duplicada, aceita multiplos NULLs e valida jogos >= 1."""
    from competicoes.modelos.disciplina import SuspensaoCompeticao

    edicao = f.criar_edicao_competicao(db)
    equipe = f.criar_equipe(db, edicao, nome="Time A")
    integrante = f.criar_integrante(db, equipe)

    s1 = SuspensaoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_integrante=integrante.id_integrante,
        motivo="Cartao vermelho direto",
        origem="VERMELHO_DIRETO",
        chave_origem=f"OCC:{edicao.id_edicao_competicao}:10",
        jogos=1,
    )
    db.add(s1)
    db.flush()
    assert s1.situacao == "ATIVA"

    # Duplicar a mesma chave_origem falha na constraint UNIQUE
    s_dup = SuspensaoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_integrante=integrante.id_integrante,
        motivo="Duplicada",
        origem="VERMELHO_DIRETO",
        chave_origem=f"OCC:{edicao.id_edicao_competicao}:10",
        jogos=1,
    )
    db.add(s_dup)
    with pytest.raises(IntegrityError, match="UNIQUE"):
        db.flush()
    db.rollback()

    # Duas suspensoes manuais com chave_origem=None sao aceitas
    edicao = f.criar_edicao_competicao(db)
    equipe = f.criar_equipe(db, edicao, nome="Time B")
    integrante = f.criar_integrante(db, equipe)
    m1 = SuspensaoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_integrante=integrante.id_integrante,
        motivo="Suspensao manual 1",
        origem="MANUAL",
        chave_origem=None,
        jogos=2,
    )
    m2 = SuspensaoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_integrante=integrante.id_integrante,
        motivo="Suspensao manual 2",
        origem="MANUAL",
        chave_origem=None,
        jogos=1,
    )
    db.add_all([m1, m2])
    db.flush()

    # CheckConstraint jogos >= 1 rejeita jogos <= 0
    s_invalida = SuspensaoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_integrante=integrante.id_integrante,
        motivo="Jogos zero",
        origem="MANUAL",
        jogos=0,
    )
    db.add(s_invalida)
    with pytest.raises(IntegrityError, match="CHECK"):
        db.flush()
    db.rollback()


def test_uq_cumprimentos_partida_integrante(db):
    """Um integrante nao pode cumprir duas suspensoes na mesma partida."""
    from competicoes.modelos.disciplina import CumprimentoSuspensao, SuspensaoCompeticao
    from competicoes.modelos.partidas import Partida

    edicao = f.criar_edicao_competicao(db)
    equipe_m = f.criar_equipe(db, edicao, nome="Mandante")
    equipe_v = f.criar_equipe(db, edicao, nome="Visitante")
    integrante = f.criar_integrante(db, equipe_m)

    partida = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=equipe_m.id_equipe,
        id_equipe_visitante=equipe_v.id_equipe,
    )
    s1 = SuspensaoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_integrante=integrante.id_integrante,
        motivo="Suspensao 1",
        origem="MANUAL",
        jogos=1,
    )
    s2 = SuspensaoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_integrante=integrante.id_integrante,
        motivo="Suspensao 2",
        origem="MANUAL",
        jogos=1,
    )
    db.add_all([partida, s1, s2])
    db.flush()

    c1 = CumprimentoSuspensao(
        id_suspensao=s1.id_suspensao,
        id_integrante=integrante.id_integrante,
        id_partida=partida.id_partida,
    )
    db.add(c1)
    db.flush()

    # Segundo cumprimento do mesmo integrante na mesma partida (mesmo em outra suspensao) deve falhar
    c2 = CumprimentoSuspensao(
        id_suspensao=s2.id_suspensao,
        id_integrante=integrante.id_integrante,
        id_partida=partida.id_partida,
    )
    db.add(c2)
    with pytest.raises(IntegrityError, match="UNIQUE"):
        db.flush()
    db.rollback()


def test_fk_composta_decisoes_grupo_edicao(db):
    """DecisaoClassificacao aceita grupo da mesma edicao ou NULL, mas rejeita grupo de outra edicao."""
    from competicoes.modelos.disciplina import DecisaoClassificacao
    from competicoes.modelos.disputa import GrupoCompeticao

    competicao = f.criar_competicao(db)
    edicao_a = f.criar_edicao_competicao(db, competicao, identificacao="2026")
    edicao_b = f.criar_edicao_competicao(db, competicao, identificacao="2027")

    grupo_a = GrupoCompeticao(
        id_edicao_competicao=edicao_a.id_edicao_competicao,
        nome="Grupo A",
        ordem=1,
    )
    grupo_b = GrupoCompeticao(
        id_edicao_competicao=edicao_b.id_edicao_competicao,
        nome="Grupo B",
        ordem=1,
    )
    db.add_all([grupo_a, grupo_b])
    db.flush()

    # Decisao na mesma edicao do grupo (valida)
    decisao_valida = DecisaoClassificacao(
        id_edicao_competicao=edicao_a.id_edicao_competicao,
        id_grupo=grupo_a.id_grupo,
        conjunto_equipes=[1, 2],
        ordem_escolhida=[2, 1],
        motivo="Sorteio",
        revisao_resultados="hash123",
    )
    # Decisao sem grupo (pontos corridos, id_grupo=None)
    decisao_sem_grupo = DecisaoClassificacao(
        id_edicao_competicao=edicao_a.id_edicao_competicao,
        id_grupo=None,
        conjunto_equipes=[1, 2],
        ordem_escolhida=[1, 2],
        motivo="Sorteio geral",
        revisao_resultados="hash456",
    )
    db.add_all([decisao_valida, decisao_sem_grupo])
    db.flush()

    # Decisao apontando para grupo de outra edicao falha por FK composta
    decisao_invalida = DecisaoClassificacao(
        id_edicao_competicao=edicao_a.id_edicao_competicao,
        id_grupo=grupo_b.id_grupo,
        conjunto_equipes=[1, 2],
        ordem_escolhida=[1, 2],
        motivo="Grupo cruzado",
        revisao_resultados="hash789",
    )
    db.add(decisao_invalida)
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        db.flush()
    db.rollback()


def test_relacionamentos_e_cascading_suspensao_cumprimento(db, usuario):
    """Testa relacionamentos ORM e ON DELETE CASCADE de suspensao para cumprimentos."""
    from competicoes.modelos.disciplina import CumprimentoSuspensao, SuspensaoCompeticao
    from competicoes.modelos.partidas import OcorrenciaPartida, Partida

    edicao = f.criar_edicao_competicao(db)
    equipe_m = f.criar_equipe(db, edicao, nome="Mandante")
    equipe_v = f.criar_equipe(db, edicao, nome="Visitante")
    integrante = f.criar_integrante(db, equipe_m)

    p1 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=equipe_m.id_equipe,
        id_equipe_visitante=equipe_v.id_equipe,
    )
    p2 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=equipe_v.id_equipe,
        id_equipe_visitante=equipe_m.id_equipe,
    )
    db.add_all([p1, p2])
    db.flush()

    occ = OcorrenciaPartida(
        id_partida=p1.id_partida,
        tipo="CARTAO_VERMELHO_DIRETO",
        id_equipe_beneficiada=equipe_m.id_equipe,
        id_integrante=integrante.id_integrante,
    )
    db.add(occ)
    db.flush()

    suspensao = SuspensaoCompeticao(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_integrante=integrante.id_integrante,
        id_partida_origem=p1.id_partida,
        id_ocorrencia_origem=occ.id_ocorrencia,
        motivo="Vermelho direto",
        origem="VERMELHO_DIRETO",
        chave_origem=f"OCC:{edicao.id_edicao_competicao}:{occ.id_ocorrencia}",
        jogos=1,
        id_usuario_responsavel=usuario.id_usuario,
    )
    db.add(suspensao)
    db.flush()

    cumprimento = CumprimentoSuspensao(
        id_suspensao=suspensao.id_suspensao,
        id_integrante=integrante.id_integrante,
        id_partida=p2.id_partida,
        id_usuario_responsavel=usuario.id_usuario,
    )
    db.add(cumprimento)
    db.commit()

    assert suspensao.edicao_competicao.id_edicao_competicao == edicao.id_edicao_competicao
    assert suspensao.integrante.id_integrante == integrante.id_integrante
    assert suspensao.partida_origem.id_partida == p1.id_partida
    assert suspensao.ocorrencia_origem.id_ocorrencia == occ.id_ocorrencia
    assert suspensao.usuario_responsavel.id_usuario == usuario.id_usuario
    assert len(suspensao.cumprimentos) == 1
    assert cumprimento.suspensao.id_suspensao == suspensao.id_suspensao

    id_cumprimento = cumprimento.id_cumprimento
    db.delete(suspensao)
    db.commit()
    db.expire_all()

    assert db.get(CumprimentoSuspensao, id_cumprimento) is None


def test_downgrade_e_upgrade_fatia3(sqlite_na_head):
    """Downgrade 20261015_0400 -> 20261015_0300 remove as tabelas da Fatia 3 e upgrade as recria."""
    cfg = config_alembic(sqlite_na_head.url, descartar=True)
    command.downgrade(cfg, "20261015_0300")
    tabelas_apos_downgrade = set(inspect(sqlite_na_head.engine).get_table_names())
    assert not (TABELAS_FATIA3 & tabelas_apos_downgrade)

    command.upgrade(cfg, "head")
    tabelas_apos_upgrade = set(inspect(sqlite_na_head.engine).get_table_names())
    assert TABELAS_FATIA3 <= tabelas_apos_upgrade
