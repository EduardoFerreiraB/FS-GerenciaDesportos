"""Regressoes encontradas na revisao de estabilidade das fatias 0 a 3.

Cada teste reproduz um defeito concreto: chave eliminatoria travada por folga,
final unica ignorada em ida e volta, resultado simples contornando as travas de
reabertura, erros 500 em combinacoes invalidas e publicacao presa ao estado.
"""

from __future__ import annotations

import uuid

import pytest

from competicoes.contratos.configuracao import validar_configuracao
from competicoes.erros import ConfiguracaoInvalida, ConflitoEstado
from competicoes.modelos import DueloEliminatorio, Partida

from .factories import criar_competidor, criar_edicao_competicao, criar_equipe, criar_integrante


def _edicao_com_equipes(db, formato: str, configuracao: dict, quantidade: int):
    config = validar_configuracao(formato, configuracao).model_dump(mode="json")
    edicao = criar_edicao_competicao(db, formato=formato, configuracao=config)
    equipes = []
    for _ in range(quantidade):
        equipe = criar_equipe(db, edicao)
        criar_integrante(db, equipe, criar_competidor(db))
        equipes.append(equipe)
    db.commit()
    return edicao, equipes


def _partidas_do_duelo(db, duelo: DueloEliminatorio) -> list[Partida]:
    return (
        db.query(Partida)
        .filter(Partida.id_duelo == duelo.id_duelo)
        .order_by(Partida.ordem_jogo)
        .all()
    )


def _duelos(db, edicao) -> dict[tuple[str, int], DueloEliminatorio]:
    db.expire_all()
    return {
        (d.fase, d.posicao_chave): d
        for d in db.query(DueloEliminatorio)
        .filter(DueloEliminatorio.id_edicao_competicao == edicao.id_edicao_competicao)
        .all()
    }


def _resultado(db, partida: Partida, gm: int, gv: int, usuario, **penaltis):
    from competicoes.contratos.partidas import ResultadoSimples
    from competicoes.servicos.partidas import registrar_resultado_simples

    return registrar_resultado_simples(
        db,
        id_partida=partida.id_partida,
        dados=ResultadoSimples(gols_mandante=gm, gols_visitante=gv, **penaltis),
        idempotency_key=str(uuid.uuid4()),
        responsavel=usuario,
    )


class TestChaveComFolgas:
    def test_duelo_com_dois_vencedores_por_folga_recebe_partida(self, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, _ = _edicao_com_equipes(db, "MATA_MATA", {"formato": "MATA_MATA"}, 5)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)

        duelos = _duelos(db, edicao)
        semi_1 = duelos[("SEMIFINAL", 1)]
        assert semi_1.estado == "DEFINIDO"
        partidas = _partidas_do_duelo(db, semi_1)
        assert len(partidas) == 1
        assert partidas[0].id_equipe_mandante != partidas[0].id_equipe_visitante


class TestFinalUnica:
    def test_final_unica_tem_um_jogo_em_chave_de_ida_e_volta(self, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, _ = _edicao_com_equipes(
            db, "MATA_MATA",
            {"formato": "MATA_MATA", "ida_volta": True, "final_unica": True}, 4,
        )
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)

        for posicao in (1, 2):
            semi = _duelos(db, edicao)[("SEMIFINAL", posicao)]
            ida, volta = _partidas_do_duelo(db, semi)
            _resultado(db, ida, 1, 0, usuario)
            _resultado(db, volta, 0, 0, usuario)

        final = _duelos(db, edicao)[("FINAL", 1)]
        assert final.ida_volta is False
        partidas_final = _partidas_do_duelo(db, final)
        assert len(partidas_final) == 1

        _resultado(db, partidas_final[0], 1, 1, usuario, penaltis_mandante=4, penaltis_visitante=2)
        final = _duelos(db, edicao)[("FINAL", 1)]
        assert final.estado == "RESOLVIDO"


class TestResultadoSimplesRespeitaTravas:
    def _chave_quatro(self, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, _ = _edicao_com_equipes(db, "MATA_MATA", {"formato": "MATA_MATA"}, 4)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
        return edicao

    def test_partida_finalizada_nao_aceita_novo_resultado_simples(self, db, usuario):
        edicao = self._chave_quatro(db, usuario)
        semi = _duelos(db, edicao)[("SEMIFINAL", 1)]
        partida = _partidas_do_duelo(db, semi)[0]
        _resultado(db, partida, 2, 0, usuario)

        with pytest.raises(ConflitoEstado):
            _resultado(db, partida, 0, 2, usuario)

    def test_partida_cancelada_nao_aceita_resultado_simples(self, db, usuario):
        from competicoes.servicos.sumula import cancelar_partida

        edicao = self._chave_quatro(db, usuario)
        partida = _partidas_do_duelo(db, _duelos(db, edicao)[("SEMIFINAL", 1)])[0]
        cancelar_partida(db, partida.id_partida, "Chuva forte", usuario)

        with pytest.raises(ConflitoEstado):
            _resultado(db, partida, 1, 0, usuario)

    def test_empate_eliminatorio_sem_penaltis_e_recusado(self, db, usuario):
        edicao = self._chave_quatro(db, usuario)
        partida = _partidas_do_duelo(db, _duelos(db, edicao)[("SEMIFINAL", 1)])[0]

        with pytest.raises(ConfiguracaoInvalida):
            _resultado(db, partida, 1, 1, usuario)
        db.expire_all()
        assert db.get(Partida, partida.id_partida).estado == "AGENDADA"

    def test_penaltis_em_jogo_de_liga_sao_recusados(self, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, _ = _edicao_com_equipes(
            db, "PONTOS_CORRIDOS", {"formato": "PONTOS_CORRIDOS", "desempates": ["SALDO_GOLS"]}, 2,
        )
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
        partida = db.query(Partida).filter(
            Partida.id_edicao_competicao == edicao.id_edicao_competicao
        ).first()

        with pytest.raises(ConfiguracaoInvalida):
            _resultado(db, partida, 1, 1, usuario, penaltis_mandante=3, penaltis_visitante=1)


class TestGeracaoValidaCombinacoes:
    def test_cruzamento_nao_suportado_vira_422(self, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, _ = _edicao_com_equipes(
            db, "GRUPOS_MATA_MATA",
            {"formato": "GRUPOS_MATA_MATA", "desempates": ["SALDO_GOLS"],
             "quantidade_grupos": 3, "classificados_por_grupo": 2}, 9,
        )
        with pytest.raises(ConfiguracaoInvalida):
            gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)

    def test_classificados_maior_que_o_grupo_vira_422(self, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, _ = _edicao_com_equipes(
            db, "GRUPOS_MATA_MATA",
            {"formato": "GRUPOS_MATA_MATA", "desempates": ["SALDO_GOLS"],
             "quantidade_grupos": 2, "classificados_por_grupo": 4}, 6,
        )
        with pytest.raises(ConfiguracaoInvalida):
            gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)

    def test_distribuicao_manual_com_equipe_estranha_vira_422(self, db, usuario):
        from competicoes.contratos.disputa import TabelaGerar
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, equipes = _edicao_com_equipes(
            db, "GRUPOS_MATA_MATA",
            {"formato": "GRUPOS_MATA_MATA", "desempates": ["SALDO_GOLS"],
             "quantidade_grupos": 2, "classificados_por_grupo": 1}, 4,
        )
        estranha = criar_equipe(db)
        db.commit()
        ids = [e.id_equipe for e in equipes]
        dados = TabelaGerar(distribuicao_grupos={
            "Grupo A": [ids[0], ids[1]],
            "Grupo B": [ids[2], estranha.id_equipe],
        })
        with pytest.raises(ConfiguracaoInvalida):
            gerar_tabela_edicao(db, edicao.id_edicao_competicao, dados, usuario)


class TestOrganizacao:
    def test_excluir_rascunho_com_equipes_apaga_equipes(self, db, usuario):
        from competicoes.modelos import Equipe
        from competicoes.servicos.organizacao import excluir_edicao_competicao

        edicao, _ = _edicao_com_equipes(
            db, "PONTOS_CORRIDOS", {"formato": "PONTOS_CORRIDOS", "desempates": ["SALDO_GOLS"]}, 2,
        )
        id_edicao = edicao.id_edicao_competicao
        excluir_edicao_competicao(db, id_edicao, usuario)
        assert db.query(Equipe).filter(Equipe.id_edicao_competicao == id_edicao).count() == 0

    def test_edicao_cancelada_pode_ser_despublicada(self, db, usuario):
        from competicoes.servicos.organizacao import cancelar_edicao_competicao, publicar_edicao

        edicao, _ = _edicao_com_equipes(
            db, "PONTOS_CORRIDOS", {"formato": "PONTOS_CORRIDOS", "desempates": ["SALDO_GOLS"]}, 2,
        )
        publicar_edicao(db, edicao.id_edicao_competicao, True, usuario)
        cancelar_edicao_competicao(db, edicao.id_edicao_competicao, "Sem quorum", usuario)

        detalhe = publicar_edicao(db, edicao.id_edicao_competicao, False, usuario)
        assert detalhe.publicada is False


class TestRevisaoDisciplinarPersiste:
    def test_revisao_resolvida_nao_volta_a_em_revisao_ao_finalizar_outro_jogo(self, db, usuario):
        from competicoes.contratos.disciplina import CumprimentoCriar, SuspensaoAjustar
        from competicoes.contratos.sumula import OcorrenciaCriar
        from competicoes.modelos import IntegranteEquipe, SuspensaoCompeticao
        from competicoes.servicos.disciplina import ajustar_suspensao, cumprir_suspensao
        from competicoes.servicos.disputa import gerar_tabela_edicao
        from competicoes.servicos.sumula import (
            finalizar_partida, iniciar_partida, reabrir_partida, registrar_ocorrencia, remover_ocorrencia,
        )

        edicao, equipes = _edicao_com_equipes(
            db, "PONTOS_CORRIDOS", {"formato": "PONTOS_CORRIDOS", "desempates": ["SALDO_GOLS"]}, 4,
        )
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
        alvo = equipes[0].id_equipe
        partidas = db.query(Partida).filter(
            Partida.id_edicao_competicao == edicao.id_edicao_competicao
        ).order_by(Partida.rodada, Partida.ordem_jogo).all()
        do_alvo = [p for p in partidas if alvo in (p.id_equipe_mandante, p.id_equipe_visitante)]
        p1, p2 = do_alvo[0], do_alvo[1]
        outra = next(p for p in partidas if p.id_partida not in (p1.id_partida, p2.id_partida))
        jogador = db.query(IntegranteEquipe).filter(IntegranteEquipe.id_equipe == alvo).first()

        iniciar_partida(db, p1.id_partida, usuario)
        sumula = registrar_ocorrencia(db, p1.id_partida, OcorrenciaCriar(
            tipo="CARTAO_VERMELHO_DIRETO", id_equipe=alvo, id_integrante=jogador.id_integrante,
        ), None, usuario)
        id_vermelho = sumula.ocorrencias[0].id_ocorrencia
        finalizar_partida(db, p1.id_partida, None, usuario)
        _resultado(db, p2, 0, 0, usuario)

        suspensao = db.query(SuspensaoCompeticao).filter(
            SuspensaoCompeticao.id_integrante == jogador.id_integrante
        ).one()
        cumprir_suspensao(db, suspensao.id_suspensao, CumprimentoCriar(id_partida=p2.id_partida), usuario)

        reabrir_partida(db, p1.id_partida, "Cartão lançado no atleta errado", usuario)
        remover_ocorrencia(db, id_vermelho, "Cartão lançado no atleta errado", usuario)
        finalizar_partida(db, p1.id_partida, None, usuario)
        db.expire_all()
        assert db.get(SuspensaoCompeticao, suspensao.id_suspensao).situacao == "EM_REVISAO"

        ajustar_suspensao(db, suspensao.id_suspensao, SuspensaoAjustar(
            situacao="CUMPRIDA", motivo="Revisado: suspensão já cumprida fica no histórico",
        ), usuario)
        _resultado(db, outra, 1, 0, usuario)

        db.expire_all()
        assert db.get(SuspensaoCompeticao, suspensao.id_suspensao).situacao == "CUMPRIDA"
