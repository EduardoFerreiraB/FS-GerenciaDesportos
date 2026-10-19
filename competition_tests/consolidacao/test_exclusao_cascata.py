"""Exclusao em cascata (decisao do usuario, 2026-10-19).

Excluir uma edicao apaga tudo o que pertence a ela: equipes, elencos, grupos,
chaveamento, partidas, ocorrencias, suspensoes, decisoes e requisicoes. Excluir
uma equipe apaga seus atletas (inscricoes). Competidores sobrevivem: a pessoa
nao pertence a edicao. A trilha de auditoria permanece.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import func, select

from competicoes.contratos.configuracao import validar_configuracao
from competicoes.erros import ConflitoEstado, NaoEncontrado
from competicoes.modelos import (
    AuditoriaCompeticao,
    Competidor,
    CumprimentoSuspensao,
    DecisaoClassificacao,
    DueloEliminatorio,
    EdicaoCompeticao,
    Equipe,
    GrupoCompeticao,
    IntegranteEquipe,
    OcorrenciaPartida,
    Partida,
    RequisicaoPartida,
    SuspensaoCompeticao,
    VagaDuelo,
)

from .factories import criar_competidor, criar_edicao_competicao, criar_equipe, criar_integrante

PONTOS = {"formato": "PONTOS_CORRIDOS", "desempates": ["SALDO_GOLS"]}


def _edicao(db, formato="PONTOS_CORRIDOS", configuracao=PONTOS, equipes=4, **campos):
    config = validar_configuracao(formato, configuracao).model_dump(mode="json")
    edicao = criar_edicao_competicao(db, formato=formato, configuracao=config, **campos)
    lista = []
    for _ in range(equipes):
        equipe = criar_equipe(db, edicao)
        criar_integrante(db, equipe, criar_competidor(db))
        lista.append(equipe)
    db.commit()
    return edicao, lista


def _contar(db, modelo, *condicoes) -> int:
    return db.scalar(select(func.count()).select_from(modelo).where(*condicoes))


def _disputar(db, edicao, usuario):
    """Tabela gerada, um jogo com cartão vermelho, suspensão cumprida no jogo seguinte."""
    from competicoes.contratos.disciplina import CumprimentoCriar
    from competicoes.contratos.partidas import ResultadoSimples
    from competicoes.contratos.sumula import OcorrenciaCriar
    from competicoes.servicos.disciplina import cumprir_suspensao
    from competicoes.servicos.disputa import gerar_tabela_edicao
    from competicoes.servicos.partidas import registrar_resultado_simples
    from competicoes.servicos.sumula import finalizar_partida, iniciar_partida, registrar_ocorrencia

    gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
    partidas = db.query(Partida).filter(
        Partida.id_edicao_competicao == edicao.id_edicao_competicao
    ).order_by(Partida.rodada, Partida.ordem_jogo).all()
    primeira = partidas[0]
    equipe = primeira.id_equipe_mandante
    seguinte = next(
        p for p in partidas[1:] if equipe in (p.id_equipe_mandante, p.id_equipe_visitante)
    )
    jogador = db.query(IntegranteEquipe).filter(IntegranteEquipe.id_equipe == equipe).first()

    iniciar_partida(db, primeira.id_partida, usuario)
    registrar_ocorrencia(db, primeira.id_partida, OcorrenciaCriar(
        tipo="CARTAO_VERMELHO_DIRETO", id_equipe=equipe, id_integrante=jogador.id_integrante,
    ), None, usuario)
    finalizar_partida(db, primeira.id_partida, None, usuario)
    registrar_resultado_simples(
        db, id_partida=seguinte.id_partida, dados=ResultadoSimples(gols_mandante=1, gols_visitante=0),
        idempotency_key=str(uuid.uuid4()), responsavel=usuario,
    )
    suspensao = db.query(SuspensaoCompeticao).filter(
        SuspensaoCompeticao.id_integrante == jogador.id_integrante
    ).one()
    cumprir_suspensao(db, suspensao.id_suspensao, CumprimentoCriar(id_partida=seguinte.id_partida), usuario)


class TestExcluirEdicao:
    def test_edicao_em_andamento_apaga_tudo_em_cascata(self, db, usuario):
        from competicoes.servicos.organizacao import excluir_edicao_competicao

        alvo, _ = _edicao(db)
        vizinha, _ = _edicao(db, competicao=alvo.competicao, identificacao="2027")
        _disputar(db, alvo, usuario)
        _disputar(db, vizinha, usuario)
        id_alvo = alvo.id_edicao_competicao
        competidores_antes = _contar(db, Competidor)
        partidas_vizinha = _contar(db, Partida, Partida.id_edicao_competicao == vizinha.id_edicao_competicao)

        excluir_edicao_competicao(db, id_alvo, usuario)
        db.expire_all()

        assert db.get(EdicaoCompeticao, id_alvo) is None
        for modelo, coluna in (
            (Equipe, Equipe.id_edicao_competicao),
            (IntegranteEquipe, IntegranteEquipe.id_edicao_competicao),
            (Partida, Partida.id_edicao_competicao),
            (SuspensaoCompeticao, SuspensaoCompeticao.id_edicao_competicao),
            (DecisaoClassificacao, DecisaoClassificacao.id_edicao_competicao),
            (GrupoCompeticao, GrupoCompeticao.id_edicao_competicao),
            (DueloEliminatorio, DueloEliminatorio.id_edicao_competicao),
        ):
            assert _contar(db, modelo, coluna == id_alvo) == 0, modelo.__name__
        ids_partidas_vizinha = select(Partida.id_partida).where(
            Partida.id_edicao_competicao == vizinha.id_edicao_competicao
        )
        assert _contar(db, OcorrenciaPartida) == _contar(
            db, OcorrenciaPartida, OcorrenciaPartida.id_partida.in_(ids_partidas_vizinha)
        )
        assert _contar(db, CumprimentoSuspensao) == 1
        assert _contar(db, RequisicaoPartida) == _contar(
            db, RequisicaoPartida, RequisicaoPartida.id_partida.in_(ids_partidas_vizinha)
        )

        # A vizinha da mesma competição fica intacta; pessoas e auditoria permanecem.
        assert _contar(db, Partida, Partida.id_edicao_competicao == vizinha.id_edicao_competicao) == partidas_vizinha
        assert _contar(db, Competidor) == competidores_antes
        assert _contar(db, AuditoriaCompeticao, AuditoriaCompeticao.acao == "EXCLUIR",
                       AuditoriaCompeticao.id_entidade == id_alvo) == 1

    def test_mata_mata_apaga_duelos_e_vagas(self, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao
        from competicoes.servicos.organizacao import excluir_edicao_competicao

        edicao, _ = _edicao(db, formato="MATA_MATA", configuracao={"formato": "MATA_MATA"}, equipes=5)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
        excluir_edicao_competicao(db, edicao.id_edicao_competicao, usuario)
        assert _contar(db, VagaDuelo) == 0
        assert _contar(db, DueloEliminatorio) == 0

    def test_edicao_inexistente_e_404(self, db, usuario):
        from competicoes.servicos.organizacao import excluir_edicao_competicao

        with pytest.raises(NaoEncontrado):
            excluir_edicao_competicao(db, 999999, usuario)

    def test_api_exclui_edicao_com_tabela(self, client, cabecalhos_por_papel, db, usuario):
        edicao, _ = _edicao(db)
        _disputar(db, edicao, usuario)
        url = f"/competicoes/edicoes/{edicao.id_edicao_competicao}"
        assert client.delete(url, headers=cabecalhos_por_papel("professor")).status_code == 403
        assert client.delete(url, headers=cabecalhos_por_papel("coordenador")).status_code == 204
        assert client.get(url, headers=cabecalhos_por_papel("coordenador")).status_code == 404


class TestExcluirEquipe:
    def test_equipe_apaga_seus_atletas_e_preserva_competidores(self, db, usuario):
        from competicoes.servicos.elencos import excluir_equipe

        edicao, equipes = _edicao(db, equipes=3)
        alvo = equipes[0]
        criar_integrante(db, alvo, criar_competidor(db))
        db.commit()
        competidores_antes = _contar(db, Competidor)
        id_alvo = alvo.id_equipe

        excluir_equipe(db, id_alvo, usuario)
        db.expire_all()

        assert db.get(Equipe, id_alvo) is None
        assert _contar(db, IntegranteEquipe, IntegranteEquipe.id_equipe == id_alvo) == 0
        assert _contar(db, Equipe, Equipe.id_edicao_competicao == edicao.id_edicao_competicao) == 2
        assert _contar(db, Competidor) == competidores_antes

    def test_equipe_com_tabela_gerada_e_conflito(self, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao
        from competicoes.servicos.elencos import excluir_equipe

        edicao, equipes = _edicao(db)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
        with pytest.raises(ConflitoEstado):
            excluir_equipe(db, equipes[0].id_equipe, usuario)

    def test_api_exclui_equipe(self, client, cabecalhos_por_papel, db):
        _, equipes = _edicao(db, equipes=2)
        url = f"/competicoes/equipes/{equipes[0].id_equipe}"
        assert client.delete(url, headers=cabecalhos_por_papel("professor")).status_code == 403
        assert client.delete(url, headers=cabecalhos_por_papel("coordenador")).status_code == 204
        assert client.delete(url, headers=cabecalhos_por_papel("coordenador")).status_code == 404


class TestCompatibilidadeMySQL:
    """O MySQL recusa DELETE com subconsulta na mesma tabela (erro 1093) e o SQLite aceita.

    Como a suite roda em SQLite, o teste captura o SQL emitido e exige que nenhum
    DELETE das exclusoes contenha subconsulta.
    """

    def _deletes_emitidos(self, db, acao) -> list[str]:
        from sqlalchemy import event

        emitidos: list[str] = []

        def capturar(_conn, _cursor, sql, *_args):
            if sql.lstrip().upper().startswith("DELETE"):
                emitidos.append(sql)

        motor = db.get_bind()
        event.listen(motor, "before_cursor_execute", capturar)
        try:
            acao()
        finally:
            event.remove(motor, "before_cursor_execute", capturar)
        return emitidos

    def test_excluir_edicao_e_equipe_sem_subconsulta_em_delete(self, db, usuario):
        from competicoes.servicos.elencos import excluir_equipe
        from competicoes.servicos.organizacao import excluir_edicao_competicao

        edicao, _ = _edicao(db)
        _disputar(db, edicao, usuario)
        rascunho, equipes = _edicao(db, competicao=edicao.competicao, identificacao="2027")

        deletes = self._deletes_emitidos(db, lambda: (
            excluir_edicao_competicao(db, edicao.id_edicao_competicao, usuario),
            excluir_equipe(db, equipes[0].id_equipe, usuario),
        ))
        assert deletes
        assert [sql for sql in deletes if "SELECT" in sql.upper()] == []


class TestExcluirCompeticao:
    def test_competicao_apaga_todas_as_edicoes_e_preserva_as_outras(self, db, usuario):
        from competicoes.modelos import Competicao
        from competicoes.servicos.organizacao import excluir_competicao

        e2026, _ = _edicao(db)
        competicao = e2026.competicao
        e2027, _ = _edicao(db, competicao=competicao, identificacao="2027")
        outra, _ = _edicao(db)
        _disputar(db, e2026, usuario)
        _disputar(db, outra, usuario)
        id_competicao = competicao.id_competicao
        ids_edicoes = [e2026.id_edicao_competicao, e2027.id_edicao_competicao]
        competidores_antes = _contar(db, Competidor)
        partidas_outra = _contar(db, Partida, Partida.id_edicao_competicao == outra.id_edicao_competicao)

        excluir_competicao(db, id_competicao, usuario)
        db.expire_all()

        assert db.get(Competicao, id_competicao) is None
        assert _contar(db, EdicaoCompeticao, EdicaoCompeticao.id_competicao == id_competicao) == 0
        assert _contar(db, Partida, Partida.id_edicao_competicao.in_(ids_edicoes)) == 0
        assert _contar(db, Equipe, Equipe.id_edicao_competicao.in_(ids_edicoes)) == 0
        assert _contar(db, Partida, Partida.id_edicao_competicao == outra.id_edicao_competicao) == partidas_outra
        assert _contar(db, Competidor) == competidores_antes
        assert _contar(db, AuditoriaCompeticao, AuditoriaCompeticao.entidade == "competicoes",
                       AuditoriaCompeticao.acao == "EXCLUIR",
                       AuditoriaCompeticao.id_entidade == id_competicao) == 1

    def test_competicao_inexistente_e_404(self, db, usuario):
        from competicoes.servicos.organizacao import excluir_competicao

        with pytest.raises(NaoEncontrado):
            excluir_competicao(db, 999999, usuario)

    def test_api_exclui_competicao(self, client, cabecalhos_por_papel, db, usuario):
        edicao, _ = _edicao(db)
        _disputar(db, edicao, usuario)
        url = f"/competicoes/competicoes/{edicao.id_competicao}"
        assert client.delete(url, headers=cabecalhos_por_papel("professor")).status_code == 403
        assert client.delete(url, headers=cabecalhos_por_papel("coordenador")).status_code == 204
        assert client.get(url, headers=cabecalhos_por_papel("coordenador")).status_code == 404

    def test_sem_subconsulta_em_delete(self, db, usuario):
        from competicoes.servicos.organizacao import excluir_competicao

        edicao, _ = _edicao(db)
        _disputar(db, edicao, usuario)
        deletes = TestCompatibilidadeMySQL()._deletes_emitidos(
            db, lambda: excluir_competicao(db, edicao.id_competicao, usuario)
        )
        assert deletes
        assert [sql for sql in deletes if "SELECT" in sql.upper()] == []
