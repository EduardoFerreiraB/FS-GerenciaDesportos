"""Testes para Modelos ORM, Schemas Pydantic e Regras de Formato da V2 do Domínio de Competições.
"""

from datetime import date, time, datetime
import pytest
from pydantic import ValidationError

import models
import schemas


def _criar_cenario_base(db):
    modalidade = models.Modalidade(nome="Futebol V2", duracao_minutos=90)
    local = models.Local(loca_nome="Campo Central", loca_descricao="Campo principal")
    arbitro = models.Arbitro(apito_nome="Árbitro V2", apito_doc="ARB-V2-01", apito_tel="11999998888")
    db.add_all([modalidade, local, arbitro])
    db.commit()
    db.refresh(modalidade)
    db.refresh(local)
    db.refresh(arbitro)
    return modalidade, local, arbitro


# ==============================================================================
# 1. TESTES DOS MODELOS ORM
# ==============================================================================

def test_modelo_grupo_competicoes(db):
    """Valida a criação do GrupoCompeticoes e relacionamento com Competicao."""
    modalidade, _, _ = _criar_cenario_base(db)

    grupo = models.GrupoCompeticoes(
        nome="Copa Municipal de Inverno 2026",
        descricao="Evento agregador de múltiplos torneios municipais",
        slug="copa-inverno-2026",
        data_inicio=date(2026, 7, 1),
        data_fim=date(2026, 7, 31),
        status="ATIVO",
    )
    db.add(grupo)
    db.commit()
    db.refresh(grupo)

    assert grupo.id_grupo is not None
    assert grupo.slug == "copa-inverno-2026"
    assert grupo.criado_em is not None

    # Vincula competições ao grupo
    comp1 = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        id_grupo=grupo.id_grupo,
        id_edicao=None,  # Competição independente sem vínculo com Edição
        nome="Futebol Sub-15",
        categoria="Sub-15",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        status="PUBLICADA",
    )
    comp2 = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        id_grupo=grupo.id_grupo,
        id_edicao=None,
        nome="Futebol Sub-17",
        categoria="Sub-17",
        modo_inscricao="EQUIPE",
        formato="MATA_MATA",
        criterio_resultado="PLACAR",
        status="PUBLICADA",
    )
    db.add_all([comp1, comp2])
    db.commit()
    db.refresh(grupo)

    assert len(grupo.competicoes) == 2
    assert comp1.grupo == grupo
    assert comp2.grupo == grupo
    assert comp1.id_grupo == grupo.id_grupo


def test_modelo_competicao_v2_independente_e_regras_formato(db):
    """Valida que Competicao suporta id_edicao nulo e armazena regras_formato JSON."""
    modalidade, _, _ = _criar_cenario_base(db)

    regras_pontos = {
        "turno_e_returno": True,
        "vitoria_pontos": 3,
        "empate_pontos": 1,
        "derrota_pontos": 0,
        "criterios_desempate": ["pontos", "saldo_gols", "gols_pro"],
    }

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        id_edicao=None,
        nome="Torneio Aberto de Verão",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        regras_formato=regras_pontos,
        status="RASCUNHO",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    assert comp.id_competicao is not None
    assert comp.id_edicao is None
    assert comp.regras_formato == regras_pontos
    assert comp.regras_formato["turno_e_returno"] is True


def test_modelo_jogador_e_relacionamento_equipe(db):
    """Valida a criação de Jogador e o relacionamento com Equipe (com cascade delete)."""
    modalidade, _, _ = _criar_cenario_base(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Torneio com Elencos",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    equipe = models.Equipe(
        nome="Santos V2 FC",
        id_competicao=comp.id_competicao,
        id_edicao=None,
    )
    db.add(equipe)
    db.commit()
    db.refresh(equipe)

    j1 = models.Jogador(
        id_equipe=equipe.id_equipe,
        nome="Carlos Silva",
        numero_camisa=10,
        posicao="Meia",
        documento="12345678900",
        data_nascimento=date(2000, 1, 15),
        foto_url="https://exemplo.com/fotos/carlos.jpg",
        ativo=True,
    )
    j2 = models.Jogador(
        id_equipe=equipe.id_equipe,
        nome="Marcos Goleiro",
        numero_camisa=1,
        posicao="Goleiro",
        documento="98765432100",
        ativo=True,
    )
    db.add_all([j1, j2])
    db.commit()
    db.refresh(equipe)

    assert len(equipe.jogadores) == 2
    assert j1.equipe == equipe
    assert j1.id_jogador is not None
    assert j1.criado_em is not None

    # Teste cascade delete na equipe
    db.delete(equipe)
    db.commit()
    jogadores_restantes = db.query(models.Jogador).filter(models.Jogador.id_equipe == equipe.id_equipe).all()
    assert len(jogadores_restantes) == 0


def test_modelo_ocorrencias_partida_e_confronto(db):
    """Valida o registro de ocorrências (gols e cartões) vinculados a Confronto, Equipe e Jogador."""
    modalidade, local, arbitro = _criar_cenario_base(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Torneio de Ocorrências",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    eq_a = models.Equipe(nome="Time A", id_competicao=comp.id_competicao)
    eq_b = models.Equipe(nome="Time B", id_competicao=comp.id_competicao)
    db.add_all([eq_a, eq_b])
    db.commit()
    db.refresh(eq_a)
    db.refresh(eq_b)

    artilheiro = models.Jogador(id_equipe=eq_a.id_equipe, nome="Artilheiro A", numero_camisa=9)
    zagueiro = models.Jogador(id_equipe=eq_b.id_equipe, nome="Zagueiro B", numero_camisa=3)
    db.add_all([artilheiro, zagueiro])
    db.commit()
    db.refresh(artilheiro)
    db.refresh(zagueiro)

    confronto = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_a.id_equipe,
        id_equipe_visitante=eq_b.id_equipe,
        data=date(2026, 9, 20),
        hora=time(16, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=1,
        placar_visitante=0,
        ordem_jogo=1,
        penaltis_mandante=None,
        penaltis_visitante=None,
    )
    db.add(confronto)
    db.commit()
    db.refresh(confronto)

    # Cria gol
    gol = models.OcorrenciaPartida(
        id_confronto=confronto.id_confronto,
        id_equipe=eq_a.id_equipe,
        id_jogador=artilheiro.id_jogador,
        tipo="GOL",
        minuto=15,
        tempo_jogo="1T",
        observacao="Chute no ângulo",
    )
    # Cria cartão
    cartao = models.OcorrenciaPartida(
        id_confronto=confronto.id_confronto,
        id_equipe=eq_b.id_equipe,
        id_jogador=zagueiro.id_jogador,
        tipo="CARTAO_AMARELO",
        minuto=32,
        tempo_jogo="1T",
        observacao="Falta tática",
    )
    db.add_all([gol, cartao])
    db.commit()
    db.refresh(confronto)
    db.refresh(artilheiro)

    assert len(confronto.ocorrencias) == 2
    assert len(artilheiro.ocorrencias) == 1
    assert artilheiro.ocorrencias[0].tipo == "GOL"
    assert gol.equipe == eq_a
    assert gol.jogador == artilheiro
    assert cartao.confronto == confronto


def test_modelo_confronto_v2_ida_volta_e_penaltis(db):
    """Valida os novos campos de confronto para ida/volta e pênaltis."""
    modalidade, local, arbitro = _criar_cenario_base(db)

    comp = models.Competicao(
        id_modalidade=modalidade.id_modalidade,
        nome="Copa Mata-Mata Ida e Volta",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="MATA_MATA",
        criterio_resultado="PLACAR",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    eq1 = models.Equipe(nome="Clube 1", id_competicao=comp.id_competicao)
    eq2 = models.Equipe(nome="Clube 2", id_competicao=comp.id_competicao)
    db.add_all([eq1, eq2])
    db.commit()
    db.refresh(eq1)
    db.refresh(eq2)

    jogo_ida = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        data=date(2026, 9, 21),
        hora=time(19, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=2,
        placar_visitante=1,
        ordem_jogo=1,
    )
    db.add(jogo_ida)
    db.commit()
    db.refresh(jogo_ida)

    jogo_volta = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq2.id_equipe,
        id_equipe_visitante=eq1.id_equipe,
        data=date(2026, 9, 28),
        hora=time(19, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        placar_mandante=2,
        placar_visitante=1,
        ordem_jogo=2,
        id_confronto_ida=jogo_ida.id_confronto,
        penaltis_mandante=4,
        penaltis_visitante=5,
        id_equipe_vencedora=eq1.id_equipe,
        status="Finalizado",
    )
    db.add(jogo_volta)
    db.commit()
    db.refresh(jogo_volta)

    assert jogo_volta.ordem_jogo == 2
    assert jogo_volta.id_confronto_ida == jogo_ida.id_confronto
    assert jogo_volta.penaltis_mandante == 4
    assert jogo_volta.penaltis_visitante == 5


# ==============================================================================
# 2. TESTES DOS SCHEMAS PYDANTIC V2
# ==============================================================================

def test_schema_regras_pontos_corridos():
    """Valida valores padrão e customizados de RegrasPontosCorridosSchema."""
    regras_padrao = schemas.RegrasPontosCorridosSchema()
    assert regras_padrao.turno_e_returno is False
    assert regras_padrao.vitoria_pontos == 3
    assert regras_padrao.empate_pontos == 1
    assert regras_padrao.derrota_pontos == 0
    assert "saldo_gols" in regras_padrao.criterios_desempate

    regras_custom = schemas.RegrasPontosCorridosSchema(
        turno_e_returno=True,
        vitoria_pontos=2,
        empate_pontos=1,
        derrota_pontos=0,
        criterios_desempate=["pontos", "vitorias"],
    )
    assert regras_custom.turno_e_returno is True
    assert regras_custom.vitoria_pontos == 2


def test_schema_regras_grupos_mata_mata():
    """Valida validações e defaults de RegrasGruposMataMataSchema."""
    regras = schemas.RegrasGruposMataMataSchema(
        qtd_grupos=4,
        times_por_grupo=4,
        classificados_por_grupo=2,
    )
    assert regras.qtd_grupos == 4
    assert regras.classificados_por_grupo == 2
    assert regras.jogos_ida_volta_grupo is False
    assert regras.jogos_ida_volta_mata_mata is False
    assert regras.disputa_terceiro_lugar is True
    assert regras.penaltis_desempate is True

    # Teste de validação: qtd_grupos < 1 deve falhar
    with pytest.raises(ValidationError):
        schemas.RegrasGruposMataMataSchema(qtd_grupos=0, classificados_por_grupo=2)

    # classificados_por_grupo < 1 deve falhar
    with pytest.raises(ValidationError):
        schemas.RegrasGruposMataMataSchema(qtd_grupos=2, classificados_por_grupo=0)


def test_schema_regras_mata_mata():
    """Valida defaults e opções de RegrasMataMataSchema."""
    regras = schemas.RegrasMataMataSchema()
    assert regras.fase_inicial == "FINAL"
    assert regras.jogos_ida_volta is False
    assert regras.disputa_terceiro_lugar is True
    assert regras.penaltis_desempate is True

    custom = schemas.RegrasMataMataSchema(
        fase_inicial="QUARTAS",
        jogos_ida_volta=True,
        disputa_terceiro_lugar=False,
    )
    assert custom.fase_inicial == "QUARTAS"
    assert custom.jogos_ida_volta is True
    assert custom.disputa_terceiro_lugar is False


def test_schemas_jogador():
    """Valida os schemas de Jogador (Create, Update, Response)."""
    payload = {
        "nome": "Neymar Jr",
        "numero_camisa": 11,
        "posicao": "Atacante",
        "documento": "11122233344",
        "data_nascimento": "1992-02-05",
        "foto_url": "https://img.com/njr.png",
        "ativo": True,
    }
    criacao = schemas.JogadorCreate(**payload)
    assert criacao.nome == "Neymar Jr"
    assert criacao.numero_camisa == 11

    atualizacao = schemas.JogadorUpdate(numero_camisa=10)
    assert atualizacao.numero_camisa == 10
    assert atualizacao.nome is None

    agora = datetime.utcnow()
    resposta = schemas.JogadorResponse(
        id_jogador=1,
        id_equipe=5,
        criado_em=agora,
        **payload,
    )
    assert resposta.id_jogador == 1
    assert resposta.id_equipe == 5


def test_schemas_ocorrencia_partida():
    """Valida os schemas de OcorrenciaPartida."""
    payload = {
        "id_equipe": 2,
        "id_jogador": 10,
        "tipo": "GOL",
        "minuto": 45,
        "tempo_jogo": "1T",
        "observacao": "Golaço",
    }
    criacao = schemas.OcorrenciaPartidaCreate(**payload)
    assert criacao.tipo == "GOL"
    assert criacao.minuto == 45

    resposta = schemas.OcorrenciaPartidaResponse(
        id_ocorrencia=100,
        id_confronto=50,
        criado_em=datetime.utcnow(),
        nome_jogador="Artilheiro",
        nome_equipe="Time Alfa",
        **payload,
    )
    assert resposta.id_ocorrencia == 100
    assert resposta.nome_jogador == "Artilheiro"


def test_schemas_grupo_competicoes():
    """Valida os schemas de GrupoCompeticoes."""
    payload = {
        "nome": "Olimpíada Universitária",
        "descricao": "Edição de 2026",
        "slug": "olimpiada-universitaria-2026",
        "data_inicio": "2026-10-01",
        "data_fim": "2026-10-15",
        "status": "ATIVO",
    }
    criacao = schemas.GrupoCompeticoesCreate(**payload)
    assert criacao.slug == "olimpiada-universitaria-2026"

    atualizacao = schemas.GrupoCompeticoesUpdate(nome="Olimpíada Geral")
    assert atualizacao.nome == "Olimpíada Geral"

    resposta = schemas.GrupoCompeticoesResponse(
        id_grupo=7,
        criado_em=datetime.utcnow(),
        **payload,
    )
    assert resposta.id_grupo == 7


def test_schemas_competicao_v2():
    """Valida CompeticaoV2Create e CompeticaoV2Response."""
    payload = {
        "nome": "Copa Livre de Futsal",
        "id_modalidade": 1,
        "id_grupo": 2,
        "id_edicao": None,
        "categoria": "Livre",
        "modo_inscricao": "EQUIPE",
        "formato": "GRUPOS",
        "criterio_resultado": "PLACAR",
        "regras_formato": {
            "qtd_grupos": 2,
            "times_por_grupo": 4,
            "classificados_por_grupo": 2,
        },
    }
    criacao = schemas.CompeticaoV2Create(**payload)
    assert criacao.nome == "Copa Livre de Futsal"
    assert criacao.id_edicao is None
    assert criacao.id_grupo == 2
    assert criacao.regras_formato["qtd_grupos"] == 2

    resposta = schemas.CompeticaoV2Response(
        id_competicao=10,
        status="PUBLICADA",
        **payload,
    )
    assert resposta.id_competicao == 10
    assert resposta.status == "PUBLICADA"
