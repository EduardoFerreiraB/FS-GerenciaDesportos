"""Schema da consolidacao: tabelas, FKs e unicidades que fazem o trabalho."""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from . import factories as f

TABELAS_NOVAS = {
    "eventos", "edicoes_evento", "competicoes", "edicoes_competicao",
    "competidores", "equipes", "integrantes_equipe",
    "auditoria_competicao", "requisicoes_partida",
}


def test_tabelas_novas_existem(schema_migrado):
    assert TABELAS_NOVAS <= set(schema_migrado.get_table_names())


def test_tabelas_antigas_removidas(schema_migrado):
    assert not {
        "equipes_participantes", "estatisticas_partida", "confrontos",
        "jogadores", "grupos_competicoes", "edicoes", "modalidades_evento",
        "inscricoes_individuais", "provas", "resultados_prova",
        "migracao_equipes_origem", "migracao_partidas_origem",
    } & set(schema_migrado.get_table_names())


def test_tabelas_homonimas_tem_schema_novo(schema_migrado):
    colunas = {c["name"] for c in schema_migrado.get_columns("eventos")}
    assert {"nome", "slug", "arquivado"} <= colunas and "even_nome" not in colunas
    colunas = {c["name"] for c in schema_migrado.get_columns("equipes")}
    assert "id_edicao_competicao" in colunas and "id_edicao" not in colunas
    colunas = {c["name"] for c in schema_migrado.get_columns("competicoes")}
    assert "slug" in colunas and "id_edicao" not in colunas


def test_tabelas_de_escolinhas_preservadas(schema_migrado):
    assert {
        "usuarios", "refresh_tokens", "professores", "modalidades", "turmas",
        "turmas_dias", "alunos", "matriculas", "presencas", "participantes",
        "atletas", "locais", "arbitros",
    } <= set(schema_migrado.get_table_names())


def test_fk_do_sqlite_esta_ligada(db):
    assert db.execute(text("PRAGMA foreign_keys")).scalar() == 1


def test_fk_impede_integrante_de_equipe_de_outra_edicao(db):
    competicao = f.criar_competicao(db)
    edicao_a = f.criar_edicao_competicao(db, competicao, identificacao="2026")
    edicao_b = f.criar_edicao_competicao(db, competicao, identificacao="2027")
    equipe_a = f.criar_equipe(db, edicao_a)
    competidor = f.criar_competidor(db)
    # Controle: o mesmo integrante na edicao certa e aceito.
    f.criar_integrante(db, equipe_a, f.criar_competidor(db))

    # equipe pertence a edicao A; integrante declara edicao B
    db.add(f.novo_integrante(
        equipe_a, competidor, id_edicao_competicao=edicao_b.id_edicao_competicao,
    ))
    with pytest.raises(IntegrityError, match="FOREIGN KEY"):
        db.flush()


def test_competidor_em_duas_equipes_da_mesma_edicao_e_rejeitado(db):
    edicao = f.criar_edicao_competicao(db)
    competidor = f.criar_competidor(db)
    f.criar_integrante(db, f.criar_equipe(db, edicao), competidor)

    db.add(f.novo_integrante(f.criar_equipe(db, edicao), competidor))
    with pytest.raises(IntegrityError, match="UNIQUE"):
        db.flush()


def test_competidor_em_edicoes_diferentes_e_permitido(db):
    competicao = f.criar_competicao(db)
    competidor = f.criar_competidor(db)
    for identificacao in ("2026", "2027"):
        edicao = f.criar_edicao_competicao(db, competicao, identificacao=identificacao)
        f.criar_integrante(db, f.criar_equipe(db, edicao), competidor)


def test_camisa_repetida_na_mesma_equipe_e_permitida(db):
    equipe = f.criar_equipe(db)
    f.criar_integrante(db, equipe, numero_camisa=10)
    db.add(f.novo_integrante(equipe, f.criar_competidor(db), numero_camisa=10))
    db.flush()  # não levanta: camisa não tem unicidade


def test_excluir_aluno_anula_origem_e_preserva_competidor(db):
    from competicoes.modelos import Competidor, IntegranteEquipe

    aluno = f.criar_aluno(db)
    competidor = f.criar_competidor(db, nome="Ana Souza", id_aluno_origem=aluno.id_aluno)
    integrante = f.criar_integrante(db, competidor=competidor, nome_esportivo="Aninha")
    ids = (competidor.id_competidor, integrante.id_integrante)
    db.commit()

    db.delete(aluno)
    db.commit()
    db.expire_all()

    competidor = db.get(Competidor, ids[0])
    assert competidor is not None
    assert competidor.id_aluno_origem is None
    assert competidor.nome == "Ana Souza"
    integrante = db.get(IntegranteEquipe, ids[1])
    assert integrante.nome_esportivo == "Aninha"
    assert integrante.id_competidor == ids[0]


def test_aluno_importado_uma_unica_vez(db):
    aluno = f.criar_aluno(db)
    f.criar_competidor(db, id_aluno_origem=aluno.id_aluno)
    with pytest.raises(IntegrityError, match="UNIQUE"):
        f.criar_competidor(db, id_aluno_origem=aluno.id_aluno)


def test_identificacao_de_edicao_e_unica_por_competicao_nao_global(db):
    # "2026" em duas competições diferentes: permitido
    f.criar_edicao_competicao(db, f.criar_competicao(db), identificacao="2026")
    competicao = f.criar_competicao(db)
    f.criar_edicao_competicao(db, competicao, identificacao="2026")
    # "2026" duas vezes na mesma competição: IntegrityError
    with pytest.raises(IntegrityError, match="UNIQUE"):
        f.criar_edicao_competicao(db, competicao, identificacao="2026")


def test_identificacao_de_edicao_de_evento_e_unica_por_evento(db):
    f.criar_edicao_evento(db, f.criar_evento(db), identificacao="2026")
    evento = f.criar_evento(db)
    f.criar_edicao_evento(db, evento, identificacao="2026")
    with pytest.raises(IntegrityError, match="UNIQUE"):
        f.criar_edicao_evento(db, evento, identificacao="2026")


def test_nome_de_equipe_unico_por_edicao(db):
    edicao = f.criar_edicao_competicao(db)
    f.criar_equipe(db, edicao, nome="Tigres")
    f.criar_equipe(db, f.criar_edicao_competicao(db), nome="Tigres")
    with pytest.raises(IntegrityError, match="UNIQUE"):
        f.criar_equipe(db, edicao, nome="Tigres")


@pytest.mark.parametrize("fabrica", [f.criar_edicao_competicao, f.criar_edicao_evento])
def test_check_de_periodo_ordenado(db, fabrica):
    # CHECK no banco e defesa em profundidade: o TiDB o ignora, o servico repete.
    with pytest.raises(IntegrityError, match="CHECK"):
        fabrica(db, data_inicio=date(2026, 6, 1), data_fim=date(2026, 5, 31))


def test_defaults_do_banco(db):
    edicao = f.criar_edicao_competicao(db)
    equipe = f.criar_equipe(db, edicao)
    integrante = f.criar_integrante(db, equipe)
    db.commit()
    db.expire_all()
    assert edicao.estado == "RASCUNHO"
    assert edicao.publicada is False
    assert edicao.revisao == 1
    assert edicao.criado_em is not None
    assert equipe.situacao == "ATIVA"
    assert integrante.situacao == "ATIVO"
    assert integrante.competidor.ativo is True
    assert edicao.competicao.arquivado is False


def test_edicao_de_competicao_sem_evento_e_permitida(db):
    assert f.criar_edicao_competicao(db).id_edicao_evento is None


def test_modalidade_competicoes_aponta_para_identidade_nova(db):
    from competicoes.modelos import Competicao

    competicao = f.criar_competicao(db)
    assert isinstance(competicao.modalidade.competicoes[0], Competicao)
    assert not hasattr(competicao.modalidade, "eventos")


def test_auditoria_preserva_autor_legivel_se_conta_sumir(db):
    import models
    from competicoes.modelos import AuditoriaCompeticao

    usuario = models.Usuario(username="coord", password_hash="x", role="coordenador")
    db.add(usuario)
    db.flush()
    auditoria = AuditoriaCompeticao(
        entidade="edicao_competicao", id_entidade=1, acao="PUBLICAR",
        id_usuario_responsavel=usuario.id_usuario, responsavel_nome="coord",
        depois={"publicada": True},
    )
    db.add(auditoria)
    db.commit()
    db.delete(usuario)
    db.commit()
    db.expire_all()
    assert auditoria.id_usuario_responsavel is None
    assert auditoria.responsavel_nome == "coord"


def test_requisicao_partida_chave_unica_por_partida(db):
    from competicoes.modelos import RequisicaoPartida
    from competicoes.modelos.partidas import Partida

    edicao = f.criar_edicao_competicao(db)
    equipe_a = f.criar_equipe(db, edicao, nome="Equipe A")
    equipe_b = f.criar_equipe(db, edicao, nome="Equipe B")
    p1 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=equipe_a.id_equipe,
        id_equipe_visitante=equipe_b.id_equipe,
    )
    p2 = Partida(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_equipe_mandante=equipe_b.id_equipe,
        id_equipe_visitante=equipe_a.id_equipe,
    )
    db.add_all([p1, p2])
    db.flush()

    def nova(id_partida):
        return RequisicaoPartida(
            id_partida=id_partida, chave_idempotencia="k1", hash_payload="h" * 64,
        )

    db.add_all([nova(p1.id_partida), nova(p2.id_partida)])
    db.flush()
    db.add(nova(p1.id_partida))
    with pytest.raises(IntegrityError, match="UNIQUE"):
        db.flush()
