"""Testes de consolidação para os serviços e API de disputa e geração de calendário."""

from datetime import date
import pytest
from sqlalchemy import select

import models
from competicoes.contratos.disputa import (
    EstruturaDisputaDetalhe,
    TabelaGerar,
)
from competicoes.erros import (
    ConfiguracaoInvalida,
    ConflitoEstado,
    NaoEncontrado,
)
from competicoes.modelos import (
    AuditoriaCompeticao,
    DueloEliminatorio,
    EdicaoCompeticao,
    Equipe,
    GrupoCompeticao,
    IntegranteEquipe,
    OcorrenciaPartida,
    Partida,
    VagaDuelo,
)
from competicoes.servicos.disputa import (
    desfazer_tabela_edicao,
    encerrar_fase_grupos,
    gerar_tabela_edicao,
    obter_estrutura_disputa,
)
from .factories import (
    criar_competicao,
    criar_competidor,
    criar_edicao_competicao,
    criar_equipe,
    criar_integrante,
)


@pytest.fixture()
def usuario_coord(db):
    coord = models.Usuario(
        username="coord_disputa",
        password_hash="hash",
        role="coordenador",
        must_change_password=False,
    )
    db.add(coord)
    db.flush()
    return coord


@pytest.fixture()
def usuario_prof(db):
    prof = models.Usuario(
        username="prof_disputa",
        password_hash="hash",
        role="professor",
        must_change_password=False,
    )
    db.add(prof)
    db.flush()
    return prof


def _montar_equipes_com_elenco(db, edicao: EdicaoCompeticao, quantidade: int) -> list[Equipe]:
    equipes = []
    for i in range(1, quantidade + 1):
        eq = criar_equipe(db, edicao=edicao, nome=f"Time {i:02d}", sigla=f"T{i:02d}")
        comp = criar_competidor(db, nome=f"Atleta {i:02d}")
        criar_integrante(db, equipe=eq, competidor=comp, situacao="ATIVO")
        equipes.append(eq)
    return equipes


class TestGerarTabelaEdicao:
    """Testa geração de calendário esportivo."""

    def test_gerar_tabela_pontos_corridos_sucesso(self, db, usuario_coord):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "turno_e_returno": False,
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 4)

        estrutura = gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)

        assert estrutura.id_edicao_competicao == edicao.id_edicao_competicao
        assert estrutura.formato == "PONTOS_CORRIDOS"
        assert estrutura.estado == "EM_ANDAMENTO"
        assert len(estrutura.rodadas) == 3
        assert len(estrutura.partidas) == 6
        assert len(estrutura.grupos) == 0
        assert len(estrutura.duelos) == 0

        # Verifica banco de dados
        partidas_db = db.execute(
            select(Partida).where(Partida.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().all()
        assert len(partidas_db) == 6
        for p in partidas_db:
            assert p.estado == "AGENDADA"
            assert p.id_grupo is None
            assert p.id_duelo is None

        # Verifica auditoria
        audit = db.execute(
            select(AuditoriaCompeticao).where(
                AuditoriaCompeticao.id_edicao_competicao == edicao.id_edicao_competicao,
                AuditoriaCompeticao.acao == "GERAR_TABELA",
            )
        ).scalar_one_or_none()
        assert audit is not None
        assert audit.responsavel_nome == usuario_coord.username

    def test_gerar_tabela_recusa_se_nao_estiver_em_rascunho(self, db, usuario_coord):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
            estado="EM_ANDAMENTO",
        )
        _montar_equipes_com_elenco(db, edicao, 4)

        with pytest.raises(ConflitoEstado) as exc_info:
            gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)
        assert "RASCUNHO" in exc_info.value.mensagem

    def test_gerar_tabela_recusa_menos_de_2_equipes(self, db, usuario_coord):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 1)

        with pytest.raises(ConfiguracaoInvalida) as exc_info:
            gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)
        assert "mínimo de 2 equipes" in exc_info.value.mensagem.lower()

    def test_gerar_tabela_recusa_equipe_sem_integrantes_ativos(self, db, usuario_coord):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        # 3 equipes com integrantes e 1 equipe sem integrantes ativos
        eqs = _montar_equipes_com_elenco(db, edicao, 3)
        eq_invalida = criar_equipe(db, edicao=edicao, nome="Time Sem Elenco")

        with pytest.raises(ConfiguracaoInvalida) as exc_info:
            gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)
        assert "Time Sem Elenco" in exc_info.value.mensagem

    def test_gerar_tabela_mata_mata_com_folgas(self, db, usuario_coord):
        # 6 equipes geram 2 folgas em chave de 8 (4 duelos nas quartas)
        edicao = criar_edicao_competicao(
            db,
            formato="MATA_MATA",
            configuracao={
                "formato": "MATA_MATA",
                "ida_volta": False,
                "final_unica": True,
                "terceiro_lugar": False,
            },
        )
        _montar_equipes_com_elenco(db, edicao, 6)

        estrutura = gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)

        assert estrutura.formato == "MATA_MATA"
        assert len(estrutura.duelos) == 7  # 4 quartas, 2 semis, 1 final

        # 2 duelos com folga são RESOLVIDOS e não geram partidas na primeira fase
        # 2 duelos normais geram 2 partidas
        partidas_db = db.execute(
            select(Partida).where(Partida.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().all()
        assert len(partidas_db) == 2
        for p in partidas_db:
            assert p.id_duelo is not None

    def test_gerar_tabela_grupos_mata_mata_sucesso(self, db, usuario_coord):
        # 8 equipes em 2 grupos de 4, 2 classificados por grupo -> semifinais e final
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
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 8)

        estrutura = gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)

        assert estrutura.formato == "GRUPOS_MATA_MATA"
        assert len(estrutura.grupos) == 2
        assert len(estrutura.duelos) == 3  # 2 semis, 1 final

        # Partidas de grupos: cada grupo com 4 times tem 6 jogos => 12 jogos no total
        partidas_db = db.execute(
            select(Partida).where(Partida.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().all()
        assert len(partidas_db) == 12
        for p in partidas_db:
            assert p.id_grupo is not None
            assert p.id_duelo is None
            assert p.estado == "AGENDADA"

        # Confere que equipes foram atribuídas a grupos
        equipes_db = db.execute(
            select(Equipe).where(Equipe.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().all()
        for eq in equipes_db:
            assert eq.id_grupo is not None


class TestDesfazerTabelaEdicao:
    """Testa reversão de tabela (desfazer)."""

    def test_desfazer_tabela_sucesso(self, db, usuario_coord):
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
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 8)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)

        # Reverte
        desfazer_tabela_edicao(db, edicao.id_edicao_competicao, usuario_coord)

        db.refresh(edicao)
        assert edicao.estado == "RASCUNHO"

        # Verifica limpeza
        partidas_db = db.execute(
            select(Partida).where(Partida.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().all()
        assert len(partidas_db) == 0

        duelos_db = db.execute(
            select(DueloEliminatorio).where(DueloEliminatorio.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().all()
        assert len(duelos_db) == 0

        grupos_db = db.execute(
            select(GrupoCompeticao).where(GrupoCompeticao.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().all()
        assert len(grupos_db) == 0

        equipes_db = db.execute(
            select(Equipe).where(Equipe.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().all()
        for eq in equipes_db:
            assert eq.id_grupo is None

    def test_desfazer_tabela_bloqueada_partida_em_andamento_ou_finalizada(self, db, usuario_coord):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 4)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)

        # Simula partida iniciada
        partida = db.execute(
            select(Partida).where(Partida.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().first()
        partida.estado = "EM_ANDAMENTO"
        db.flush()

        with pytest.raises(ConflitoEstado) as exc_info:
            desfazer_tabela_edicao(db, edicao.id_edicao_competicao, usuario_coord)
        assert "Não é possível desfazer tabela com partidas em andamento ou finalizadas" in exc_info.value.mensagem

    def test_desfazer_tabela_bloqueada_se_partida_com_ocorrencias(self, db, usuario_coord):
        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 4)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)

        partida = db.execute(
            select(Partida).where(Partida.id_edicao_competicao == edicao.id_edicao_competicao)
        ).scalars().first()
        ocorrencia = OcorrenciaPartida(
            id_partida=partida.id_partida,
            tipo="GOL",
            id_equipe_beneficiada=partida.id_equipe_mandante,
            minuto=15,
        )
        db.add(ocorrencia)
        db.flush()

        with pytest.raises(ConflitoEstado) as exc_info:
            desfazer_tabela_edicao(db, edicao.id_edicao_competicao, usuario_coord)
        assert "Não é possível desfazer tabela com partidas" in exc_info.value.mensagem


class TestEncerrarFaseGrupos:
    """Testa encerramento de fase de grupos e avanço para o mata-mata."""

    def test_encerrar_fase_grupos_sucesso(self, db, usuario_coord):
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
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        eqs = _montar_equipes_com_elenco(db, edicao, 8)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)

        # Simula finalização de todas as partidas de grupos sem empates persistentes
        partidas_grupos = db.execute(
            select(Partida).where(
                Partida.id_edicao_competicao == edicao.id_edicao_competicao,
                Partida.id_grupo.isnot(None),
            )
        ).scalars().all()

        for idx, p in enumerate(partidas_grupos):
            p.estado = "FINALIZADA"
            # Cria gols para evitar empates
            oc = OcorrenciaPartida(
                id_partida=p.id_partida,
                tipo="GOL",
                id_equipe_beneficiada=p.id_equipe_mandante if idx % 2 == 0 else p.id_equipe_visitante,
                minuto=10,
            )
            db.add(oc)
        db.flush()

        estrutura = encerrar_fase_grupos(db, edicao.id_edicao_competicao, usuario_coord)

        # Vagas de grupos devem estar resolvidas
        vagas_resolvidas = db.execute(
            select(VagaDuelo).where(
                VagaDuelo.origem == "POSICAO_GRUPO",
                VagaDuelo.id_duelo.in_(
                    select(DueloEliminatorio.id_duelo).where(
                        DueloEliminatorio.id_edicao_competicao == edicao.id_edicao_competicao
                    )
                ),
            )
        ).scalars().all()

        assert len(vagas_resolvidas) == 4
        for v in vagas_resolvidas:
            assert v.id_equipe_resolvida is not None

        # Semifinais agora têm duas equipes definidas e geraram partidas
        partidas_semis = db.execute(
            select(Partida)
            .join(
                DueloEliminatorio,
                Partida.id_duelo == DueloEliminatorio.id_duelo,
            )
            .where(
                Partida.id_edicao_competicao == edicao.id_edicao_competicao,
                DueloEliminatorio.fase == "SEMIFINAL",
            )
        ).scalars().all()
        assert len(partidas_semis) == 2

    def test_encerrar_fase_grupos_bloqueado_se_partidas_pendentes(self, db, usuario_coord):
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
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 8)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)

        with pytest.raises(ConflitoEstado) as exc_info:
            encerrar_fase_grupos(db, edicao.id_edicao_competicao, usuario_coord)
        assert "finalizadas" in exc_info.value.mensagem.lower()

    def test_encerrar_fase_grupos_bloqueado_se_empate_persistente(self, db, usuario_coord):
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
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 8)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, TabelaGerar(), usuario_coord)

        # Finaliza todos os jogos com 0x0 (sem gols) -> todo mundo empatado no grupo
        partidas_grupos = db.execute(
            select(Partida).where(
                Partida.id_edicao_competicao == edicao.id_edicao_competicao,
                Partida.id_grupo.isnot(None),
            )
        ).scalars().all()
        for p in partidas_grupos:
            p.estado = "FINALIZADA"
        db.flush()

        with pytest.raises(ConflitoEstado) as exc_info:
            encerrar_fase_grupos(db, edicao.id_edicao_competicao, usuario_coord)
        assert "empate persistente" in exc_info.value.mensagem.lower()


class TestEndpointsDisputaHTTP:
    """Testa endpoints REST de disputa e geração de calendário."""

    def test_endpoints_fluxo_completo(self, client, cabecalhos_por_papel, db):
        headers_coord = cabecalhos_por_papel("coordenador")
        headers_prof = cabecalhos_por_papel("professor")

        edicao = criar_edicao_competicao(
            db,
            formato="PONTOS_CORRIDOS",
            configuracao={
                "formato": "PONTOS_CORRIDOS",
                "turno_e_returno": False,
                "desempates": ["VITORIAS", "SALDO_GOLS", "GOLS_PRO", "CONFRONTO_DIRETO"],
            },
        )
        _montar_equipes_com_elenco(db, edicao, 4)
        id_edicao = edicao.id_edicao_competicao

        # 1. POST gerar-tabela por coordenador -> 201
        resp = client.post(
            f"/competicoes/edicoes/{id_edicao}/gerar-tabela",
            json={},
            headers=headers_coord,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["estado"] == "EM_ANDAMENTO"
        assert len(data["partidas"]) == 6

        # 2. GET disputa por professor (leitura) -> 200
        resp = client.get(
            f"/competicoes/edicoes/{id_edicao}/disputa",
            headers=headers_prof,
        )
        assert resp.status_code == 200
        assert resp.json()["id_edicao_competicao"] == id_edicao

        # 3. DELETE tabela por professor -> 403
        resp = client.delete(
            f"/competicoes/edicoes/{id_edicao}/tabela",
            headers=headers_prof,
        )
        assert resp.status_code == 403

        # 4. DELETE tabela por coordenador -> 204
        resp = client.delete(
            f"/competicoes/edicoes/{id_edicao}/tabela",
            headers=headers_coord,
        )
        assert resp.status_code == 204

        # 5. GET disputa confirma estado RASCUNHO e 0 partidas
        resp = client.get(
            f"/competicoes/edicoes/{id_edicao}/disputa",
            headers=headers_coord,
        )
        assert resp.status_code == 200
        assert resp.json()["estado"] == "RASCUNHO"
        assert len(resp.json()["partidas"]) == 0
