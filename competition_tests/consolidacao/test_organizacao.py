"""Testes de organizacao: eventos, competicoes e edicoes.

Cobre regras de negocio de servico e endpoints HTTP da organizacao esportiva.
"""

from datetime import date
import pytest

from competicoes.contratos.organizacao import (
    CompeticaoAtualizar,
    CompeticaoComEdicaoCriar,
    CompeticaoCriar,
    EdicaoCompeticaoAtualizar,
    EdicaoCompeticaoCriar,
    EdicaoEventoAtualizar,
    EdicaoEventoCriar,
    EventoAtualizar,
    EventoComEdicaoCriar,
    EventoCriar,
    PublicacaoAtualizar,
)
from competicoes.erros import (
    ConfiguracaoInvalida,
    ConflitoEstado,
    ConflitoRevisao,
    Duplicidade,
    NaoEncontrado,
)
from competicoes.modelos import (
    AuditoriaCompeticao,
    Competicao,
    EdicaoCompeticao,
    EdicaoEvento,
    Evento,
)
from competicoes.servicos.organizacao import (
    arquivar_competicao,
    arquivar_evento,
    atualizar_competicao,
    atualizar_edicao_competicao,
    atualizar_edicao_evento,
    atualizar_evento,
    criar_competicao_com_edicao,
    criar_edicao_competicao,
    criar_edicao_evento,
    criar_evento_com_edicao,
    excluir_edicao_competicao,
    excluir_evento,
    listar_competicoes,
    listar_eventos,
    obter_competicao,
    obter_edicao_competicao,
    obter_evento,
    publicar_edicao,
)
from .factories import (
    criar_competicao as factory_criar_competicao,
    criar_edicao_competicao as factory_criar_edicao_competicao,
    criar_edicao_evento as factory_criar_edicao_evento,
    criar_evento as factory_criar_evento,
    criar_modalidade,
)


@pytest.fixture()
def modalidade_padrao(db):
    return criar_modalidade(db, nome="Futebol de Campo")


@pytest.fixture()
def dados_evento_com_edicao():
    return EventoComEdicaoCriar(
        nome="Jogos Universitários 2026",
        descricao="Edição anual dos jogos",
        edicao=EdicaoEventoCriar(
            identificacao="2026",
            data_inicio=date(2026, 5, 1),
            data_fim=date(2026, 5, 30),
        ),
    )


@pytest.fixture()
def dados_competicao_com_edicao(modalidade_padrao):
    return CompeticaoComEdicaoCriar(
        nome="Copa Primavera de Futebol",
        descricao="Copa anual",
        id_modalidade=modalidade_padrao.id_modalidade,
        edicao=EdicaoCompeticaoCriar(
            identificacao="2026",
            categoria="Livre",
            data_inicio=date(2026, 5, 10),
            data_fim=date(2026, 5, 20),
            formato="MATA_MATA",
            configuracao={"formato": "MATA_MATA"},
        ),
    )


# -------------------------------------------------------------------------
# Testes de Serviços: Evento e Edição de Evento
# -------------------------------------------------------------------------

def test_criar_evento_cria_identidade_e_primeira_edicao(db, usuario, dados_evento_com_edicao):
    detalhe = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    assert detalhe.id_evento is not None
    assert detalhe.slug == "jogos-universitarios-2026"
    assert len(detalhe.edicoes) == 1
    assert detalhe.edicoes[0].identificacao == "2026"
    assert detalhe.edicoes[0].id_evento == detalhe.id_evento

    # Verifica auditoria
    audit = db.query(AuditoriaCompeticao).filter_by(acao="CRIAR", entidade="eventos").first()
    assert audit is not None
    assert audit.id_entidade == detalhe.id_evento
    assert audit.responsavel_nome == usuario.username


def test_slug_unico_gera_sufixo_se_necessario(db, usuario, dados_evento_com_edicao):
    detalhe1 = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    detalhe2 = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    assert detalhe1.slug == "jogos-universitarios-2026"
    assert detalhe2.slug == "jogos-universitarios-2026-2"


def test_obter_evento_e_nao_encontrado(db, usuario, dados_evento_com_edicao):
    detalhe = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    encontrado = obter_evento(db, detalhe.id_evento)
    assert encontrado.id_evento == detalhe.id_evento

    with pytest.raises(NaoEncontrado):
        obter_evento(db, 999999)


def test_listar_eventos_com_filtros_e_paginacao(db, usuario):
    ev1 = factory_criar_evento(db, nome="Torneio de Inverno", arquivado=False)
    ev2 = factory_criar_evento(db, nome="Torneio de Verão", arquivado=True)
    db.commit()

    pagina_ativos = listar_eventos(db, busca="Torneio", arquivado=False)
    assert any(e.id_evento == ev1.id_evento for e in pagina_ativos.itens)
    assert not any(e.id_evento == ev2.id_evento for e in pagina_ativos.itens)

    pagina_arquivados = listar_eventos(db, busca="Torneio", arquivado=True)
    assert any(e.id_evento == ev2.id_evento for e in pagina_arquivados.itens)


def test_atualizar_evento_e_arquivar(db, usuario, dados_evento_com_edicao):
    detalhe = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    atualizado = atualizar_evento(
        db, detalhe.id_evento, EventoAtualizar(descricao="Nova descricao"), usuario
    )
    assert atualizado.descricao == "Nova descricao"

    arquivado = arquivar_evento(db, detalhe.id_evento, usuario)
    assert arquivado.arquivado is True


def test_criar_edicao_evento_sucesso(db, usuario, dados_evento_com_edicao):
    evento = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    nova_edicao = criar_edicao_evento(
        db,
        evento.id_evento,
        EdicaoEventoCriar(
            identificacao="2027",
            data_inicio=date(2027, 5, 1),
            data_fim=date(2027, 5, 30),
        ),
        usuario,
    )
    assert nova_edicao.identificacao == "2027"
    assert nova_edicao.id_evento == evento.id_evento


def test_identificacao_repetida_no_mesmo_evento_e_duplicidade(db, usuario, dados_evento_com_edicao):
    evento = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    with pytest.raises(Duplicidade):
        criar_edicao_evento(
            db,
            evento.id_evento,
            EdicaoEventoCriar(
                identificacao="2026",
                data_inicio=date(2026, 6, 1),
                data_fim=date(2026, 6, 30),
            ),
            usuario,
        )


def test_identificacao_igual_em_eventos_diferentes_e_permitida(db, usuario, dados_evento_com_edicao):
    ev1 = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    ev2 = criar_evento_com_edicao(
        db,
        EventoComEdicaoCriar(
            nome="Outros Jogos",
            edicao=EdicaoEventoCriar(
                identificacao="2026",
                data_inicio=date(2026, 5, 1),
                data_fim=date(2026, 5, 30),
            ),
        ),
        usuario,
    )
    assert ev1.edicoes[0].identificacao == "2026"
    assert ev2.edicoes[0].identificacao == "2026"


# Review Focus 2
def test_encurtar_periodo_do_evento_que_nao_cabe_nos_filhos_falha_sem_alterar(
    db, usuario, modalidade_padrao
):
    # Evento de 01/01 a 31/12/2026
    ev = factory_criar_evento(db, nome="Jogos Regionais")
    ed_ev = factory_criar_edicao_evento(
        db,
        evento=ev,
        identificacao="2026",
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 12, 31),
    )
    # Competição com edição filha de 01/03 a 30/06/2026
    comp = factory_criar_competicao(db, modalidade=modalidade_padrao)
    ed_comp = factory_criar_edicao_competicao(
        db,
        competicao=comp,
        id_edicao_evento=ed_ev.id_edicao_evento,
        identificacao="2026",
        data_inicio=date(2026, 3, 1),
        data_fim=date(2026, 6, 30),
    )
    db.commit()

    # Tentativa de encurtar o evento para terminar em 31/05/2026 (antes de 30/06)
    periodo_curto = EdicaoEventoAtualizar(data_fim=date(2026, 5, 31))
    with pytest.raises(ConflitoEstado):
        atualizar_edicao_evento(db, ed_ev.id_edicao_evento, periodo_curto, usuario)

    db.refresh(ed_ev)
    db.refresh(ed_comp)
    assert ed_ev.data_fim == date(2026, 12, 31)
    assert ed_comp.data_fim == date(2026, 6, 30)


def test_excluir_evento_com_edicoes_e_conflito(db, usuario, dados_evento_com_edicao):
    evento = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    with pytest.raises(ConflitoEstado):
        excluir_evento(db, evento.id_evento, usuario)


# -------------------------------------------------------------------------
# Testes de Serviços: Competição e Edição de Competição
# -------------------------------------------------------------------------

def test_competicao_pode_existir_sem_evento(db, usuario, dados_competicao_com_edicao):
    detalhe = criar_competicao_com_edicao(db, dados_competicao_com_edicao, usuario)
    assert detalhe.id_competicao is not None
    assert detalhe.edicoes[0].id_edicao_evento is None
    assert detalhe.slug == "copa-primavera-de-futebol"


def test_identificacao_repetida_na_mesma_competicao_e_conflito(
    db, usuario, dados_competicao_com_edicao
):
    comp = criar_competicao_com_edicao(db, dados_competicao_com_edicao, usuario)
    with pytest.raises(Duplicidade):
        criar_edicao_competicao(
            db,
            comp.id_competicao,
            EdicaoCompeticaoCriar(
                identificacao="2026",
                data_inicio=date(2026, 7, 1),
                data_fim=date(2026, 7, 30),
                formato="MATA_MATA",
                configuracao={"formato": "MATA_MATA"},
            ),
            usuario,
        )


def test_identificacao_igual_em_competicoes_diferentes_e_permitida(
    db, usuario, modalidade_padrao
):
    c1 = factory_criar_competicao(db, modalidade=modalidade_padrao, nome="Copa A")
    c2 = factory_criar_competicao(db, modalidade=modalidade_padrao, nome="Copa B")
    db.commit()

    ed1 = criar_edicao_competicao(
        db,
        c1.id_competicao,
        EdicaoCompeticaoCriar(
            identificacao="2026",
            data_inicio=date(2026, 1, 1),
            data_fim=date(2026, 6, 30),
            formato="MATA_MATA",
            configuracao={"formato": "MATA_MATA"},
        ),
        usuario,
    )
    ed2 = criar_edicao_competicao(
        db,
        c2.id_competicao,
        EdicaoCompeticaoCriar(
            identificacao="2026",
            data_inicio=date(2026, 1, 1),
            data_fim=date(2026, 6, 30),
            formato="MATA_MATA",
            configuracao={"formato": "MATA_MATA"},
        ),
        usuario,
    )
    assert ed1.identificacao == "2026"
    assert ed2.identificacao == "2026"


from competicoes.contratos.configuracao import validar_configuracao


def test_datas_invertidas_sao_rejeitadas(db, usuario, modalidade_padrao):
    comp = factory_criar_competicao(db, modalidade=modalidade_padrao)
    db.commit()

    dados_invalidos = EdicaoCompeticaoCriar.model_construct(
        identificacao="2026",
        data_inicio=date(2026, 12, 31),
        data_fim=date(2026, 1, 1),
        formato="MATA_MATA",
        configuracao=validar_configuracao("MATA_MATA", {}),
    )
    with pytest.raises(ConfiguracaoInvalida):
        criar_edicao_competicao(db, comp.id_competicao, dados_invalidos, usuario)


def test_edicao_esportiva_deve_caber_no_periodo_do_evento(
    db, usuario, modalidade_padrao
):
    ev = factory_criar_evento(db)
    ed_ev = factory_criar_edicao_evento(
        db,
        evento=ev,
        data_inicio=date(2026, 5, 1),
        data_fim=date(2026, 5, 31),
    )
    comp = factory_criar_competicao(db, modalidade=modalidade_padrao)
    db.commit()

    # Fora do período (termina em junho)
    dados = EdicaoCompeticaoCriar(
        id_edicao_evento=ed_ev.id_edicao_evento,
        identificacao="2026",
        data_inicio=date(2026, 5, 1),
        data_fim=date(2026, 6, 1),
        formato="MATA_MATA",
        configuracao={"formato": "MATA_MATA"},
    )
    with pytest.raises(ConfiguracaoInvalida):
        criar_edicao_competicao(db, comp.id_competicao, dados, usuario)


# Review Focus 5
def test_revisao_desatualizada_retorna_conflito_mesmo_com_payload_identico(
    db, usuario, modalidade_padrao
):
    comp = factory_criar_competicao(db, modalidade=modalidade_padrao)
    ed = factory_criar_edicao_competicao(
        db,
        competicao=comp,
        identificacao="2026",
        formato="MATA_MATA",
        configuracao={"formato": "MATA_MATA"},
        revisao=5,
    )
    db.commit()

    dados_revisao_4 = EdicaoCompeticaoAtualizar(
        identificacao="2026",
        data_inicio=ed.data_inicio,
        data_fim=ed.data_fim,
        formato="MATA_MATA",
        configuracao={"formato": "MATA_MATA"},
        revisao=4,
    )
    with pytest.raises(ConflitoRevisao):
        atualizar_edicao_competicao(db, ed.id_edicao_competicao, dados_revisao_4, usuario)


def test_atualizacao_bem_sucedida_incrementa_revisao(
    db, usuario, modalidade_padrao
):
    comp = factory_criar_competicao(db, modalidade=modalidade_padrao)
    ed = factory_criar_edicao_competicao(
        db,
        competicao=comp,
        identificacao="2026",
        formato="MATA_MATA",
        configuracao={"formato": "MATA_MATA"},
        revisao=1,
    )
    db.commit()

    dados = EdicaoCompeticaoAtualizar(
        identificacao="2026-B",
        categoria="Sub-20",
        data_inicio=ed.data_inicio,
        data_fim=ed.data_fim,
        formato="MATA_MATA",
        configuracao={"formato": "MATA_MATA"},
        revisao=1,
    )
    atualizada = atualizar_edicao_competicao(db, ed.id_edicao_competicao, dados, usuario)
    assert atualizada.revisao == 2
    assert atualizada.categoria == "Sub-20"
    assert atualizada.identificacao == "2026-B"


def test_trocar_modalidade_de_competicao_com_edicoes_e_conflito(
    db, usuario, modalidade_padrao
):
    mod2 = criar_modalidade(db, nome="Futsal")
    comp = factory_criar_competicao(db, modalidade=modalidade_padrao)
    factory_criar_edicao_competicao(db, competicao=comp)
    db.commit()

    with pytest.raises(ConflitoEstado):
        atualizar_competicao(
            db,
            comp.id_competicao,
            CompeticaoAtualizar(id_modalidade=mod2.id_modalidade),
            usuario,
        )

    # Sem edições, alterar modalidade deve ser permitido
    comp_sem_edicoes = factory_criar_competicao(db, modalidade=modalidade_padrao)
    db.commit()
    atualizada = atualizar_competicao(
        db,
        comp_sem_edicoes.id_competicao,
        CompeticaoAtualizar(id_modalidade=mod2.id_modalidade),
        usuario,
    )
    assert atualizada.id_modalidade == mod2.id_modalidade


def test_publicar_rascunho_e_despublicar_finalizada(
    db, usuario, modalidade_padrao
):
    comp = factory_criar_competicao(db, modalidade=modalidade_padrao)
    ed_rascunho = factory_criar_edicao_competicao(
        db, competicao=comp, estado="RASCUNHO", publicada=False
    )
    ed_finalizada = factory_criar_edicao_competicao(
        db, competicao=comp, identificacao="2025", estado="FINALIZADA", publicada=True
    )
    db.commit()

    pub = publicar_edicao(db, ed_rascunho.id_edicao_competicao, True, usuario)
    assert pub.publicada is True

    despub = publicar_edicao(db, ed_finalizada.id_edicao_competicao, False, usuario)
    assert despub.publicada is False


def test_excluir_edicao_em_andamento_e_conflito(db, usuario, modalidade_padrao):
    comp = factory_criar_competicao(db, modalidade=modalidade_padrao)
    ed_andamento = factory_criar_edicao_competicao(
        db, competicao=comp, estado="EM_ANDAMENTO"
    )
    ed_rascunho = factory_criar_edicao_competicao(
        db, competicao=comp, identificacao="2027", estado="RASCUNHO"
    )
    db.commit()

    with pytest.raises(ConflitoEstado):
        excluir_edicao_competicao(db, ed_andamento.id_edicao_competicao, usuario)

    # Rascunho exclui com sucesso
    excluir_edicao_competicao(db, ed_rascunho.id_edicao_competicao, usuario)
    with pytest.raises(NaoEncontrado):
        obter_edicao_competicao(db, ed_rascunho.id_edicao_competicao)


def test_operacoes_de_escrita_sao_auditadas(db, usuario, dados_evento_com_edicao):
    evento = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    assert (
        db.query(AuditoriaCompeticao)
        .filter_by(acao="CRIAR", entidade="eventos", id_entidade=evento.id_evento)
        .count()
        == 1
    )


# -------------------------------------------------------------------------
# Testes de Endpoints HTTP e Permissões
# -------------------------------------------------------------------------

@pytest.mark.parametrize(
    "papel,esperado", [(None, 401), ("professor", 403), ("coordenador", 201)]
)
def test_permissao_de_escrita_por_papel(
    client, cabecalhos_por_papel, papel, esperado, modalidade_padrao
):
    payload = {
        "nome": f"Copa Auth {papel}",
        "id_modalidade": modalidade_padrao.id_modalidade,
        "edicao": {
            "identificacao": "2026",
            "data_inicio": "2026-05-01",
            "data_fim": "2026-05-30",
            "formato": "MATA_MATA",
            "configuracao": {"formato": "MATA_MATA"},
        },
    }
    resp = client.post(
        "/competicoes/competicoes",
        json=payload,
        headers=cabecalhos_por_papel(papel),
    )
    assert resp.status_code == esperado


def test_fluxo_http_completo_evento_e_edicao(
    client, cabecalhos_por_papel, usuario
):
    headers_coord = cabecalhos_por_papel("coordenador")
    headers_prof = cabecalhos_por_papel("professor")

    # 1. POST /competicoes/eventos (201)
    payload_evento = {
        "nome": "Olimpíadas da Primavera",
        "descricao": "Jogos primaveris",
        "edicao": {
            "identificacao": "2026",
            "data_inicio": "2026-09-01",
            "data_fim": "2026-09-30",
        },
    }
    resp = client.post(
        "/competicoes/eventos", json=payload_evento, headers=headers_coord
    )
    assert resp.status_code == 201
    ev_data = resp.json()
    id_evento = ev_data["id_evento"]
    id_edicao_ev = ev_data["edicoes"][0]["id_edicao_evento"]

    # 2. GET /competicoes/eventos (leitura por professor: 200)
    resp = client.get("/competicoes/eventos", headers=headers_prof)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # 3. GET /competicoes/eventos/{id_evento} (200)
    resp = client.get(f"/competicoes/eventos/{id_evento}", headers=headers_prof)
    assert resp.status_code == 200
    assert resp.json()["nome"] == "Olimpíadas da Primavera"

    # 4. PATCH /competicoes/eventos/{id_evento} (200)
    resp = client.patch(
        f"/competicoes/eventos/{id_evento}",
        json={"nome": "Olimpíadas da Primavera Atualizadas"},
        headers=headers_coord,
    )
    assert resp.status_code == 200
    assert resp.json()["nome"] == "Olimpíadas da Primavera Atualizadas"

    # 5. POST /competicoes/eventos/{id_evento}/edicoes (201)
    payload_nova_ed = {
        "identificacao": "2027",
        "data_inicio": "2027-09-01",
        "data_fim": "2027-09-30",
    }
    resp = client.post(
        f"/competicoes/eventos/{id_evento}/edicoes",
        json=payload_nova_ed,
        headers=headers_coord,
    )
    assert resp.status_code == 201
    assert resp.json()["identificacao"] == "2027"

    # 6. PATCH /competicoes/edicoes-evento/{id_edicao_evento} (200)
    resp = client.patch(
        f"/competicoes/edicoes-evento/{id_edicao_ev}",
        json={"identificacao": "2026-Edição Especial"},
        headers=headers_coord,
    )
    assert resp.status_code == 200
    assert resp.json()["identificacao"] == "2026-Edição Especial"


def test_fluxo_http_completo_competicao_e_edicao(
    client, cabecalhos_por_papel, modalidade_padrao
):
    headers_coord = cabecalhos_por_papel("coordenador")
    headers_prof = cabecalhos_por_papel("professor")

    # 1. POST /competicoes/competicoes (201)
    payload = {
        "nome": "Campeonato Metropolitano",
        "id_modalidade": modalidade_padrao.id_modalidade,
        "edicao": {
            "identificacao": "2026",
            "categoria": "Profissional",
            "data_inicio": "2026-04-01",
            "data_fim": "2026-11-30",
            "formato": "PONTOS_CORRIDOS",
            "configuracao": {
                "formato": "PONTOS_CORRIDOS",
                "desempates": ["SALDO_GOLS", "VITORIAS"],
            },
        },
    }
    resp = client.post(
        "/competicoes/competicoes", json=payload, headers=headers_coord
    )
    assert resp.status_code == 201
    comp_data = resp.json()
    id_comp = comp_data["id_competicao"]
    id_ed = comp_data["edicoes"][0]["id_edicao_competicao"]
    revisao = comp_data["edicoes"][0]["revisao"]

    # 2. GET /competicoes/competicoes (200)
    resp = client.get("/competicoes/competicoes", headers=headers_prof)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # 3. GET /competicoes/competicoes/{id_competicao} (200)
    resp = client.get(f"/competicoes/competicoes/{id_comp}", headers=headers_prof)
    assert resp.status_code == 200
    assert resp.json()["nome"] == "Campeonato Metropolitano"

    # 4. PATCH /competicoes/competicoes/{id_competicao} (200)
    resp = client.patch(
        f"/competicoes/competicoes/{id_comp}",
        json={"descricao": "Campeonato atualizado"},
        headers=headers_coord,
    )
    assert resp.status_code == 200
    assert resp.json()["descricao"] == "Campeonato atualizado"

    # 5. POST /competicoes/competicoes/{id_competicao}/edicoes (201)
    payload_nova_ed = {
        "identificacao": "2027",
        "data_inicio": "2027-04-01",
        "data_fim": "2027-11-30",
        "formato": "PONTOS_CORRIDOS",
        "configuracao": {
            "formato": "PONTOS_CORRIDOS",
            "desempates": ["SALDO_GOLS"],
        },
    }
    resp = client.post(
        f"/competicoes/competicoes/{id_comp}/edicoes",
        json=payload_nova_ed,
        headers=headers_coord,
    )
    assert resp.status_code == 201
    id_ed_2027 = resp.json()["id_edicao_competicao"]

    # 6. GET /competicoes/edicoes/{id_edicao_competicao} (200)
    resp = client.get(f"/competicoes/edicoes/{id_ed}", headers=headers_prof)
    assert resp.status_code == 200
    assert resp.json()["identificacao"] == "2026"

    # 7. PUT /competicoes/edicoes/{id_edicao_competicao} (200)
    payload_put = {
        "identificacao": "2026",
        "categoria": "Profissional Série A",
        "data_inicio": "2026-04-01",
        "data_fim": "2026-11-30",
        "formato": "PONTOS_CORRIDOS",
        "configuracao": {
            "formato": "PONTOS_CORRIDOS",
            "desempates": ["SALDO_GOLS", "VITORIAS"],
        },
        "revisao": revisao,
    }
    resp = client.put(
        f"/competicoes/edicoes/{id_ed}", json=payload_put, headers=headers_coord
    )
    assert resp.status_code == 200
    assert resp.json()["categoria"] == "Profissional Série A"
    assert resp.json()["revisao"] == revisao + 1

    # 8. POST /competicoes/edicoes/{id_edicao_competicao}/publicar (200)
    resp = client.post(
        f"/competicoes/edicoes/{id_ed}/publicar",
        json={"publicada": True},
        headers=headers_coord,
    )
    assert resp.status_code == 200
    assert resp.json()["publicada"] is True

    # 9. DELETE /competicoes/edicoes/{id_edicao_competicao} (204)
    resp = client.delete(
        f"/competicoes/edicoes/{id_ed_2027}", headers=headers_coord
    )
    assert resp.status_code == 204

    # Confirma que foi excluída
    resp = client.get(f"/competicoes/edicoes/{id_ed_2027}", headers=headers_prof)
    assert resp.status_code == 404


def test_obter_competicao_e_edicao_nao_encontrado(db):
    with pytest.raises(NaoEncontrado):
        obter_competicao(db, 999999)
    with pytest.raises(NaoEncontrado):
        obter_edicao_competicao(db, 999999)


def test_criar_competicao_com_modalidade_inexistente_falha(db, usuario):
    dados = CompeticaoComEdicaoCriar(
        nome="Copa Sem Modalidade",
        id_modalidade=999999,
        edicao=EdicaoCompeticaoCriar(
            identificacao="2026",
            data_inicio=date(2026, 1, 1),
            data_fim=date(2026, 6, 30),
            formato="MATA_MATA",
            configuracao={"formato": "MATA_MATA"},
        ),
    )
    with pytest.raises(NaoEncontrado):
        criar_competicao_com_edicao(db, dados, usuario)


def test_atualizar_edicao_evento_duplicidade(db, usuario, dados_evento_com_edicao):
    evento = criar_evento_com_edicao(db, dados_evento_com_edicao, usuario)
    ed2 = criar_edicao_evento(
        db,
        evento.id_evento,
        EdicaoEventoCriar(
            identificacao="2027",
            data_inicio=date(2027, 1, 1),
            data_fim=date(2027, 6, 30),
        ),
        usuario,
    )
    with pytest.raises(Duplicidade):
        atualizar_edicao_evento(
            db, ed2.id_edicao_evento, EdicaoEventoAtualizar(identificacao="2026"), usuario
        )


def test_atualizar_edicao_competicao_duplicidade(db, usuario, modalidade_padrao):
    comp = factory_criar_competicao(db, modalidade=modalidade_padrao)
    ed1 = factory_criar_edicao_competicao(
        db, competicao=comp, identificacao="2026", formato="MATA_MATA", configuracao={"formato": "MATA_MATA"}
    )
    ed2 = factory_criar_edicao_competicao(
        db, competicao=comp, identificacao="2027", formato="MATA_MATA", configuracao={"formato": "MATA_MATA"}
    )
    db.commit()

    dados_atualizar = EdicaoCompeticaoAtualizar(
        identificacao="2026",
        data_inicio=ed2.data_inicio,
        data_fim=ed2.data_fim,
        formato="MATA_MATA",
        configuracao={"formato": "MATA_MATA"},
        revisao=ed2.revisao,
    )
    with pytest.raises(Duplicidade):
        atualizar_edicao_competicao(db, ed2.id_edicao_competicao, dados_atualizar, usuario)


def test_excluir_evento_sem_edicoes_sucesso(db, usuario):
    ev = factory_criar_evento(db, nome="Evento Vazio")
    db.commit()
    excluir_evento(db, ev.id_evento, usuario)
    with pytest.raises(NaoEncontrado):
        obter_evento(db, ev.id_evento)

