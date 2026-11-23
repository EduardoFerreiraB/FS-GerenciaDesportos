"""Testes de consolidação para a Task 6 da Fatia 3:
- Ciclo de vida da edição (iniciar, finalizar, reabrir, cancelar) e travas estruturais/exclusão.
- Decisões manuais de desempate (DecisaoClassificacao) com invalidação automática por hash de resultados.
- Critérios disciplinares (MENOS_CARTOES_VERMELHOS, MENOS_CARTOES_AMARELOS) e GOL_CONTRA na classificação.
- Reabertura de fase de grupos e integração de decisões de desempate com encerramento de grupos.
"""

from __future__ import annotations

from datetime import date
import pytest
from sqlalchemy import select

import models
from competicoes.contratos.disciplina import DecisaoClassificacaoCriar
from competicoes.contratos.disputa import TabelaGerar
from competicoes.contratos.organizacao import EdicaoCompeticaoAtualizar
from competicoes.erros import ConfiguracaoInvalida, ConflitoEstado
from competicoes.modelos import (
    AuditoriaCompeticao,
    DueloEliminatorio,
    EdicaoCompeticao,
    Equipe,
    OcorrenciaPartida,
    Partida,
    VagaDuelo,
)
from competicoes.servicos.classificacao import (
    listar_decisoes_classificacao,
    obter_classificacao_edicao,
    registrar_decisao_classificacao,
)
from competicoes.servicos.disputa import (
    encerrar_fase_grupos,
    gerar_tabela_edicao,
    reabrir_fase_grupos,
)
from competicoes.servicos.organizacao import (
    atualizar_edicao_competicao,
    cancelar_edicao_competicao,
    excluir_edicao_competicao,
    finalizar_edicao_competicao,
    iniciar_edicao_competicao,
    reabrir_edicao_competicao,
)
from .factories import (
    criar_competidor,
    criar_edicao_competicao,
    criar_equipe,
    criar_integrante,
)


def _montar_equipes_com_elenco(
    db, edicao: EdicaoCompeticao, quantidade: int
) -> list[Equipe]:
    equipes = []
    for i in range(1, quantidade + 1):
        eq = criar_equipe(db, edicao=edicao, nome=f"Equipe {i:02d}", sigla=f"E{i:02d}")
        comp = criar_competidor(db, nome=f"Atleta {i:02d}")
        criar_integrante(db, equipe=eq, competidor=comp, situacao="ATIVO")
        equipes.append(eq)
    return equipes


# =============================================================================
# 1. Ciclo de Vida da Edição e Travas Estruturais
# =============================================================================


class TestCicloVidaEdicao:
    """Cobre iniciar, finalizar, reabrir, cancelar e travas de configuração/exclusão."""

    def test_iniciar_edicao_sem_tabela_bloqueia_com_conflito(self, db, usuario):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "desempates": ["VITORIAS", "SALDO_GOLS"],
            },
            estado="RASCUNHO",
        )
        _montar_equipes_com_elenco(db, edicao, 2)
        db.commit()

        with pytest.raises(ConflitoEstado) as exc_info:
            iniciar_edicao_competicao(db, edicao.id_edicao_competicao, usuario)
        assert "tabela de jogos" in exc_info.value.mensagem.lower()

    def test_iniciar_edicao_com_tabela_e_idempotencia(self, db, usuario):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "desempates": ["VITORIAS", "SALDO_GOLS"],
            },
            estado="RASCUNHO",
        )
        eqs = _montar_equipes_com_elenco(db, edicao, 2)
        p = Partida(
            id_edicao_competicao=edicao.id_edicao_competicao,
            id_equipe_mandante=eqs[0].id_equipe,
            id_equipe_visitante=eqs[1].id_equipe,
            rodada=1,
            ordem_jogo=1,
            estado="AGENDADA",
        )
        db.add(p)
        db.commit()

        iniciada = iniciar_edicao_competicao(db, edicao.id_edicao_competicao, usuario)
        assert iniciada.estado == "EM_ANDAMENTO"
        assert iniciada.revisao == 2

        # Chamada repetida em EM_ANDAMENTO é idempotente
        idempotente = iniciar_edicao_competicao(db, edicao.id_edicao_competicao, usuario)
        assert idempotente.estado == "EM_ANDAMENTO"
        assert idempotente.revisao == 2

    def test_bloqueio_alteracao_estrutural_com_tabela_gerada(self, db, usuario):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "turno_e_returno": False,
                "desempates": ["VITORIAS", "SALDO_GOLS"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 4)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario)
        db.refresh(edicao)

        # 1. Tentativa de alterar configuração estrutural (turno_e_returno=True) -> ConflitoEstado
        dados_estrutural = EdicaoCompeticaoAtualizar(
            identificacao=edicao.identificacao,
            categoria="Adulto",
            data_inicio=edicao.data_inicio,
            data_fim=edicao.data_fim,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "turno_e_returno": True,
                "desempates": ["VITORIAS", "SALDO_GOLS"],
            },
            revisao=edicao.revisao,
        )
        with pytest.raises(ConflitoEstado) as exc_info:
            atualizar_edicao_competicao(
                db, edicao.id_edicao_competicao, dados_estrutural, usuario
            )
        assert "configuração estrutural" in exc_info.value.mensagem.lower()

        # 2. Ajuste apenas de identificacao/categoria mantendo formato e configuracao -> Permitido
        db.refresh(edicao)
        dados_metadados = EdicaoCompeticaoAtualizar(
            identificacao="2026 - Série Ouro",
            categoria="Adulto",
            data_inicio=edicao.data_inicio,
            data_fim=edicao.data_fim,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "turno_e_returno": False,
                "desempates": ["VITORIAS", "SALDO_GOLS"],
            },
            revisao=edicao.revisao,
        )
        atualizada = atualizar_edicao_competicao(
            db, edicao.id_edicao_competicao, dados_metadados, usuario
        )
        assert atualizada.identificacao == "2026 - Série Ouro"
        assert atualizada.categoria == "Adulto"

    def test_excluir_edicao_com_partidas_apaga_em_cascata(self, db, usuario):
        edicao = criar_edicao_competicao(db, estado="RASCUNHO")
        eqs = _montar_equipes_com_elenco(db, edicao, 2)
        db.add(
            Partida(
                id_edicao_competicao=edicao.id_edicao_competicao,
                id_equipe_mandante=eqs[0].id_equipe,
                id_equipe_visitante=eqs[1].id_equipe,
                estado="AGENDADA",
            )
        )
        db.commit()
        id_edicao = edicao.id_edicao_competicao

        excluir_edicao_competicao(db, id_edicao, usuario)
        assert db.query(Partida).filter(Partida.id_edicao_competicao == id_edicao).count() == 0

    def test_finalizar_reabrir_e_cancelar_edicao_http(
        self, client, cabecalhos_por_papel, db, usuario
    ):
        headers_coord = cabecalhos_por_papel("coordenador")
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "turno_e_returno": False,
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO"],
            },
        )
        eqs = _montar_equipes_com_elenco(db, edicao, 2)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario)
        id_ed = edicao.id_edicao_competicao

        # 1. POST /iniciar (idempotente pois gerar_tabela já pôs EM_ANDAMENTO)
        resp = client.post(
            f"/competicoes/edicoes/{id_ed}/iniciar", headers=headers_coord
        )
        assert resp.status_code == 200
        assert resp.json()["estado"] == "EM_ANDAMENTO"

        # 2. POST /finalizar com partida AGENDADA -> 409
        resp = client.post(
            f"/competicoes/edicoes/{id_ed}/finalizar", headers=headers_coord
        )
        assert resp.status_code == 409

        # 3. Se partida estiver CANCELADA -> 409 ao finalizar
        partida = (
            db.execute(select(Partida).where(Partida.id_edicao_competicao == id_ed))
            .scalars()
            .first()
        )
        partida.estado = "CANCELADA"
        db.commit()

        resp = client.post(
            f"/competicoes/edicoes/{id_ed}/finalizar", headers=headers_coord
        )
        assert resp.status_code == 409
        assert "canceladas ou pendentes" in resp.json()["mensagem"].lower()

        # 4. Partida FINALIZADA em 0x0 -> empate persistente no título -> 409
        partida.estado = "FINALIZADA"
        db.commit()

        resp = client.post(
            f"/competicoes/edicoes/{id_ed}/finalizar", headers=headers_coord
        )
        assert resp.status_code == 409
        assert "empate não resolvido pelo título" in resp.json()["mensagem"].lower()

        # 5. Adiciona um gol definindo campeão -> POST /finalizar -> 200 FINALIZADA
        db.add(
            OcorrenciaPartida(
                id_partida=partida.id_partida,
                tipo="GOL",
                id_equipe_beneficiada=eqs[0].id_equipe,
                minuto=10,
            )
        )
        db.commit()

        resp = client.post(
            f"/competicoes/edicoes/{id_ed}/finalizar", headers=headers_coord
        )
        assert resp.status_code == 200
        assert resp.json()["estado"] == "FINALIZADA"

        # 6. POST /reabrir exige motivo e volta para EM_ANDAMENTO
        resp = client.post(
            f"/competicoes/edicoes/{id_ed}/reabrir",
            json={"motivo": "Correção de súmula da rodada final"},
            headers=headers_coord,
        )
        assert resp.status_code == 200
        assert resp.json()["estado"] == "EM_ANDAMENTO"

        # 7. POST /cancelar exige motivo e muda para CANCELADA
        resp = client.post(
            f"/competicoes/edicoes/{id_ed}/cancelar",
            json={"motivo": "Cancelamento administrativo por força maior"},
            headers=headers_coord,
        )
        assert resp.status_code == 200
        assert resp.json()["estado"] == "CANCELADA"

        # 8. Edição CANCELADA não pode ser reaberta nem editada
        resp_reabrir = client.post(
            f"/competicoes/edicoes/{id_ed}/reabrir",
            json={"motivo": "Tentativa de reabrir edição cancelada"},
            headers=headers_coord,
        )
        assert resp_reabrir.status_code == 409

        db.refresh(edicao)
        resp_put = client.put(
            f"/competicoes/edicoes/{id_ed}",
            json={
                "identificacao": "Tentativa",
                "data_inicio": str(edicao.data_inicio),
                "data_fim": str(edicao.data_fim),
                "formato": "PONTOS_CORRIDOS",
                "configuracao": {
                    "formato": "PONTOS_CORRIDOS",
                    "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO"],
                },
                "revisao": edicao.revisao,
            },
            headers=headers_coord,
        )
        assert resp_put.status_code == 409


# =============================================================================
# 2. Critérios Disciplinares e GOL_CONTRA na Classificação
# =============================================================================


class TestCriteriosDisciplinaresEGolContra:
    """Cobre GOL_CONTRA, MENOS_CARTOES_VERMELHOS e MENOS_CARTOES_AMARELOS em obter_classificacao_edicao."""

    def test_gol_contra_e_cartoes_desempatam_classificacao(self, db):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "desempates": [
                    "VITORIAS",
                    "SALDO_GOLS",
                    "GOLS_PRO",
                    "MENOS_CARTOES_VERMELHOS",
                    "MENOS_CARTOES_AMARELOS",
                ],
            },
        )
        t1 = criar_equipe(db, edicao, nome="Time Limpo")
        t2 = criar_equipe(db, edicao, nome="Time Indisciplinado")
        c1 = criar_competidor(db, nome="Jogador 1")
        c2 = criar_competidor(db, nome="Jogador 2")
        i1 = criar_integrante(db, equipe=t1, competidor=c1)
        i2 = criar_integrante(db, equipe=t2, competidor=c2)

        # Jogo terminou 1x1 com 1 GOL normal para t2 e 1 GOL_CONTRA beneficiando t1
        p = Partida(
            id_edicao_competicao=edicao.id_edicao_competicao,
            id_equipe_mandante=t1.id_equipe,
            id_equipe_visitante=t2.id_equipe,
            estado="FINALIZADA",
        )
        db.add(p)
        db.flush()

        db.add_all(
            [
                OcorrenciaPartida(
                    id_partida=p.id_partida,
                    tipo="GOL_CONTRA",
                    id_equipe_beneficiada=t1.id_equipe,
                    id_integrante=i2.id_integrante,
                    minuto=15,
                ),
                OcorrenciaPartida(
                    id_partida=p.id_partida,
                    tipo="GOL",
                    id_equipe_beneficiada=t2.id_equipe,
                    id_integrante=i2.id_integrante,
                    minuto=30,
                ),
                # t2 recebe um cartão amarelo -> t1 fica em 1º por MENOS_CARTOES_AMARELOS
                OcorrenciaPartida(
                    id_partida=p.id_partida,
                    tipo="CARTAO_AMARELO",
                    id_equipe_beneficiada=t2.id_equipe,
                    id_integrante=i2.id_integrante,
                    minuto=40,
                ),
            ]
        )
        db.commit()

        tabela = obter_classificacao_edicao(db, edicao.id_edicao_competicao)
        assert tabela.possui_empate_persistente is False
        assert len(tabela.linhas) == 2
        assert tabela.linhas[0].id_equipe == t1.id_equipe
        assert tabela.linhas[0].gols_pro == 1
        assert tabela.linhas[0].posicao == 1
        assert tabela.linhas[1].id_equipe == t2.id_equipe
        assert tabela.linhas[1].gols_pro == 1
        assert tabela.linhas[1].posicao == 2


# =============================================================================
# 3. Decisões Manuais de Classificação e Invalidação Automática
# =============================================================================


class TestDecisoesClassificacao:
    """Cobre POST/GET decisoes-classificacao, resolução de empate e invalidação por mudança de placar."""

    def test_decisao_manual_resolve_empate_e_invalida_se_placar_mudar(
        self, client, cabecalhos_por_papel, db, usuario
    ):
        headers_coord = cabecalhos_por_papel("coordenador")
        headers_prof = cabecalhos_por_papel("professor")

        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO"],
            },
        )
        eqs = _montar_equipes_com_elenco(db, edicao, 2)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario)
        id_ed = edicao.id_edicao_competicao

        partida = (
            db.execute(select(Partida).where(Partida.id_edicao_competicao == id_ed))
            .scalars()
            .first()
        )
        partida.estado = "FINALIZADA"
        db.commit()

        # Antes da decisão: empate persistente = True
        tabela_antes = obter_classificacao_edicao(db, id_ed)
        assert tabela_antes.possui_empate_persistente is True

        # Permutação inválida -> 422 ConfiguracaoInvalida
        resp_inv = client.post(
            f"/competicoes/edicoes/{id_ed}/decisoes-classificacao",
            json={
                "conjunto_equipes": [eqs[0].id_equipe, eqs[1].id_equipe],
                "ordem_escolhida": [eqs[0].id_equipe, eqs[0].id_equipe],
                "motivo": "Sorteio oficial",
            },
            headers=headers_coord,
        )
        assert resp_inv.status_code == 422

        # Registra decisão manual colocando eqs[1] na frente de eqs[0] -> 201
        resp_ok = client.post(
            f"/competicoes/edicoes/{id_ed}/decisoes-classificacao",
            json={
                "conjunto_equipes": [eqs[0].id_equipe, eqs[1].id_equipe],
                "ordem_escolhida": [eqs[1].id_equipe, eqs[0].id_equipe],
                "motivo": "Sorteio oficial na sede da organização",
            },
            headers=headers_coord,
        )
        assert resp_ok.status_code == 201
        decisao_json = resp_ok.json()
        assert decisao_json["valida"] is True
        assert decisao_json["ordem_escolhida"] == [eqs[1].id_equipe, eqs[0].id_equipe]

        # Agora a classificação reflete a decisão e não há mais empate persistente
        tabela_depois = obter_classificacao_edicao(db, id_ed)
        assert tabela_depois.possui_empate_persistente is False
        assert tabela_depois.linhas[0].id_equipe == eqs[1].id_equipe
        assert tabela_depois.linhas[0].posicao == 1
        assert tabela_depois.linhas[1].id_equipe == eqs[0].id_equipe
        assert tabela_depois.linhas[1].posicao == 2

        # Permite finalizar a edição!
        resp_fin = client.post(
            f"/competicoes/edicoes/{id_ed}/finalizar", headers=headers_coord
        )
        assert resp_fin.status_code == 200
        assert resp_fin.json()["estado"] == "FINALIZADA"

        # Reabre a edição e altera o resultado (por ex., jogo 1x1 com 1 gol pra cada)
        client.post(
            f"/competicoes/edicoes/{id_ed}/reabrir",
            json={"motivo": "Lançamento de gols omitidos"},
            headers=headers_coord,
        )
        db.add_all(
            [
                OcorrenciaPartida(
                    id_partida=partida.id_partida,
                    tipo="GOL",
                    id_equipe_beneficiada=eqs[0].id_equipe,
                    minuto=10,
                ),
                OcorrenciaPartida(
                    id_partida=partida.id_partida,
                    tipo="GOL",
                    id_equipe_beneficiada=eqs[1].id_equipe,
                    minuto=20,
                ),
            ]
        )
        db.commit()

        # GET /decisoes-classificacao deve mostrar valida=False automaticamente!
        resp_list = client.get(
            f"/competicoes/edicoes/{id_ed}/decisoes-classificacao",
            headers=headers_prof,
        )
        assert resp_list.status_code == 200
        lista = resp_list.json()
        assert len(lista) == 1
        assert lista[0]["valida"] is False

        # E o empate persistente volta a aparecer na tabela
        tabela_invalidada = obter_classificacao_edicao(db, id_ed)
        assert tabela_invalidada.possui_empate_persistente is True


# =============================================================================
# 4. Reabertura da Fase de Grupos e Integração com Decisões Manuais
# =============================================================================


class TestReaberturaFaseGrupos:
    """Cobre encerramento de grupos com decisão manual e reabertura de fase de grupos."""

    def test_encerrar_grupos_com_decisao_manual_e_reabrir_fase_grupos(
        self, client, cabecalhos_por_papel, db, usuario
    ):
        headers_coord = cabecalhos_por_papel("coordenador")

        edicao = criar_edicao_competicao(
            db,
            formato="GRUPOS_MATA_MATA",
            configuracao={
                "formato": "GRUPOS_MATA_MATA",
                "quantidade_grupos": 2,
                "classificados_por_grupo": 2,
                "turno_e_returno_grupos": False,
                "ida_volta_eliminatoria": False,
                "final_unica": True,
                "terceiro_lugar": False,
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 4)
        estrutura = gerar_tabela_edicao(
            db, edicao.id_edicao_competicao, TabelaGerar(), usuario
        )
        id_ed = edicao.id_edicao_competicao

        # Finaliza todas as partidas de grupos em 0x0 (empate persistente em ambos os grupos)
        partidas_grupos = (
            db.execute(
                select(Partida).where(
                    Partida.id_edicao_competicao == id_ed,
                    Partida.id_grupo.isnot(None),
                )
            )
            .scalars()
            .all()
        )
        for p in partidas_grupos:
            p.estado = "FINALIZADA"
        db.commit()

        # Sem decisão manual, encerrar_fase_grupos falha com ConflitoEstado
        with pytest.raises(ConflitoEstado):
            encerrar_fase_grupos(db, id_ed, usuario)

        # Registra decisões manuais para cada grupo
        for g in estrutura.grupos:
            registrar_decisao_classificacao(
                db,
                id_ed,
                DecisaoClassificacaoCriar(
                    id_grupo=g.id_grupo,
                    conjunto_equipes=g.equipes,
                    ordem_escolhida=list(reversed(g.equipes)),
                    motivo=f"Sorteio do grupo {g.nome}",
                ),
                usuario,
            )

        # Agora encerrar_fase_grupos funciona e avança as equipes na ordem decidida!
        estrutura_encerrada = encerrar_fase_grupos(db, id_ed, usuario)
        partidas_mata_mata = [
            p for p in estrutura_encerrada.partidas if p.id_duelo is not None
        ]
        assert len(partidas_mata_mata) > 0
        assert all(p.estado == "AGENDADA" for p in partidas_mata_mata)

        # Reabrir fase de grupos via HTTP enquanto mata-mata está AGENDADA -> 200
        resp_reabrir = client.post(
            f"/competicoes/edicoes/{id_ed}/reabrir-fase-grupos",
            json={"motivo": "Correção de resultado na fase de grupos"},
            headers=headers_coord,
        )
        assert resp_reabrir.status_code == 200
        dados_reabertos = resp_reabrir.json()
        partidas_mm_apos = [
            p for p in dados_reabertos["partidas"] if p["id_duelo"] is not None
        ]
        assert len(partidas_mm_apos) == 0
        for d in dados_reabertos["duelos"]:
            assert d["estado"] == "PENDENTE"
            for v in d["vagas"]:
                assert v["id_equipe_resolvida"] is None

        # Encerra novamente os grupos e inicia uma partida do mata-mata -> bloqueia reabertura com 409!
        encerrar_fase_grupos(db, id_ed, usuario)
        partida_mm = (
            db.execute(
                select(Partida).where(
                    Partida.id_edicao_competicao == id_ed,
                    Partida.id_duelo.isnot(None),
                )
            )
            .scalars()
            .first()
        )
        partida_mm.estado = "EM_ANDAMENTO"
        db.commit()

        resp_bloqueado = client.post(
            f"/competicoes/edicoes/{id_ed}/reabrir-fase-grupos",
            json={"motivo": "Tentativa tardia de reabrir grupos"},
            headers=headers_coord,
        )
        assert resp_bloqueado.status_code == 409
