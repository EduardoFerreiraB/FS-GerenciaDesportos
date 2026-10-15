"""Testes de integração para Roteadores REST e Endpoints V2 (Task 4).

Cobre:
1. Endpoints Administrativos (/v2/...):
   - Grupos de competições (criação, listagem, detalhes com competições)
   - Competições V2 independentes (criação com regras_formato flexíveis, listagem com filtros, detalhes, atualização, exclusão validada)
   - Equipes e Jogadores (cadastro de equipe, cadastro de atleta no elenco, remoção de atleta)
   - Confrontos e Súmula Rápida (geração de jogos, filtros, lançamento rápido de gols e cartões, estorno de ocorrências com ajuste de placar, finalização com pênaltis)
   - Relatórios apurados (classificação V2, artilharia V2, disciplinar V2)
   - RBAC: Requer coordenador ou admin para escrita; bloqueia usuários anônimos ou sem permissão.
2. Endpoints Públicos Agregadores (/v2/publico/...):
   - Grupos agregadores por slug
   - Detalhes de competição pública
   - Jogos públicos com autores dos gols
   - Classificação e Artilharia públicas
   - Ocultação de competições em status RASCUNHO
   - Conformidade LGPD: Nenhum dado sensível (CPF, RG, telefone, documento, etc.) exposto.
"""

from datetime import date, time
import pytest

import models
from security import create_access_token, get_password_hash


def _auth_headers(username: str) -> dict[str, str]:
    token = create_access_token({"sub": username})
    return {"Authorization": f"Bearer {token}"}


def _criar_usuario(db, username: str, role: str) -> models.Usuario:
    usuario = models.Usuario(
        username=username,
        password_hash=get_password_hash("senha123"),
        role=role,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def _criar_base_esportiva(db):
    modalidade = models.Modalidade(nome="Futsal V2 Test", duracao_minutos=40)
    local = models.Local(loca_nome="Ginásio Municipal V2", loca_descricao="Quadra 1")
    arbitro = models.Arbitro(apito_nome="Árbitro V2", apito_doc="123456", apito_tel="11999990000")
    db.add_all([modalidade, local, arbitro])
    db.commit()
    db.refresh(modalidade)
    db.refresh(local)
    db.refresh(arbitro)
    return modalidade, local, arbitro


# ==============================================================================
# 1. TESTES DE AUTENTICAÇÃO E RBAC (V2)
# ==============================================================================

@pytest.mark.parametrize("role, status_esperado", [
    ("admin", 201),
    ("coordenador", 201),
    ("professor", 403),
    ("assistente", 403),
])
def test_rbac_criacao_grupo_competicoes(client, db, role, status_esperado):
    """Garante que apenas coordenador e admin podem criar grupos de competições."""
    username = f"user-rbac-{role}"
    _criar_usuario(db, username, role)

    payload = {
        "nome": f"Copa Interbairros - {role}",
        "descricao": "Torneio municipal",
        "slug": f"copa-interbairros-{role}",
        "data_inicio": "2026-10-01",
        "data_fim": "2026-10-20",
        "status": "ATIVO",
    }
    response = client.post("/v2/grupos-competicoes", json=payload, headers=_auth_headers(username))
    assert response.status_code == status_esperado


def test_autenticacao_obrigatoria_endpoints_administrativos(client):
    """Garante que chamadas sem token em rotas administrativas recebem 401."""
    assert client.get("/v2/grupos-competicoes").status_code == 401
    assert client.post("/v2/grupos-competicoes", json={}).status_code == 401
    assert client.get("/v2/competicoes").status_code == 401
    assert client.post("/v2/competicoes", json={}).status_code == 401


# ==============================================================================
# 2. TESTES DE GRUPOS DE COMPETIÇÕES (/v2/grupos-competicoes)
# ==============================================================================

def test_crud_grupos_competicoes(client, db):
    """Testa criação, listagem e detalhes de grupos de competições."""
    _criar_usuario(db, "coord_grupos", "coordenador")
    headers = _auth_headers("coord_grupos")

    # 1. Criação com sucesso
    payload = {
        "nome": "Copa Primavera 2026",
        "descricao": "Evento multiesportivo",
        "slug": "copa-primavera-2026",
        "data_inicio": "2026-09-01",
        "data_fim": "2026-09-30",
        "status": "ATIVO",
    }
    res_post = client.post("/v2/grupos-competicoes", json=payload, headers=headers)
    assert res_post.status_code == 201
    dados_grupo = res_post.json()
    id_grupo = dados_grupo["id_grupo"]
    assert dados_grupo["slug"] == "copa-primavera-2026"

    # 2. Conflito por slug duplicado
    res_dup = client.post("/v2/grupos-competicoes", json=payload, headers=headers)
    assert res_dup.status_code in (400, 409)

    # 3. Listagem de grupos
    res_get = client.get("/v2/grupos-competicoes", headers=headers)
    assert res_get.status_code == 200
    grupos = res_get.json()
    assert any(g["id_grupo"] == id_grupo for g in grupos)

    # 4. Detalhes do grupo (com competições vinculadas)
    res_detalhes = client.get(f"/v2/grupos-competicoes/{id_grupo}", headers=headers)
    assert res_detalhes.status_code == 200
    detalhes = res_detalhes.json()
    assert detalhes["id_grupo"] == id_grupo
    assert "competicoes" in detalhes
    assert isinstance(detalhes["competicoes"], list)

    # 5. Grupo inexistente
    assert client.get("/v2/grupos-competicoes/99999", headers=headers).status_code == 404


# ==============================================================================
# 3. TESTES DE COMPETIÇÕES V2 (/v2/competicoes)
# ==============================================================================

def test_crud_competicoes_v2(client, db):
    """Testa criação independente, filtros, atualização e exclusão com validação."""
    _criar_usuario(db, "coord_comp", "coordenador")
    headers = _auth_headers("coord_comp")
    mod, _, _ = _criar_base_esportiva(db)

    # Cria um grupo agregador prévio
    grupo = models.GrupoCompeticoes(nome="Jogos da Cidade", slug="jogos-cidade")
    db.add(grupo)
    db.commit()
    db.refresh(grupo)

    # 1. Criação de competição independente vinculada ao grupo com regras_formato
    regras = {
        "turno_e_returno": False,
        "vitoria_pontos": 3,
        "empate_pontos": 1,
        "derrota_pontos": 0,
        "criterios_desempate": ["pontos", "saldo_gols"],
    }
    payload = {
        "nome": "Futsal Adulto V2",
        "id_modalidade": mod.id_modalidade,
        "id_grupo": grupo.id_grupo,
        "categoria": "Adulto",
        "modo_inscricao": "EQUIPE",
        "formato": "PONTOS_CORRIDOS",
        "criterio_resultado": "PLACAR",
        "regras_formato": regras,
    }
    res_post = client.post("/v2/competicoes", json=payload, headers=headers)
    assert res_post.status_code == 201
    comp_dados = res_post.json()
    id_comp = comp_dados["id_competicao"]
    assert comp_dados["nome"] == "Futsal Adulto V2"
    assert comp_dados["id_edicao"] is None
    assert comp_dados["status"] == "RASCUNHO"
    assert comp_dados["regras_formato"] == regras

    # 2. Listagem com filtros
    res_list_todos = client.get("/v2/competicoes", headers=headers)
    assert res_list_todos.status_code == 200
    assert len(res_list_todos.json()) >= 1

    res_list_filtro_mod = client.get(f"/v2/competicoes?id_modalidade={mod.id_modalidade}", headers=headers)
    assert res_list_filtro_mod.status_code == 200
    assert any(c["id_competicao"] == id_comp for c in res_list_filtro_mod.json())

    res_list_filtro_status = client.get("/v2/competicoes?status=RASCUNHO", headers=headers)
    assert res_list_filtro_status.status_code == 200
    assert any(c["id_competicao"] == id_comp for c in res_list_filtro_status.json())

    res_list_filtro_grupo = client.get(f"/v2/competicoes?id_grupo={grupo.id_grupo}", headers=headers)
    assert res_list_filtro_grupo.status_code == 200
    assert any(c["id_competicao"] == id_comp for c in res_list_filtro_grupo.json())

    # 3. Obtenção individual
    res_detalhes = client.get(f"/v2/competicoes/{id_comp}", headers=headers)
    assert res_detalhes.status_code == 200
    assert res_detalhes.json()["id_competicao"] == id_comp

    # 4. Atualização
    update_payload = {
        "nome": "Futsal Adulto Série Ouro V2",
        "status": "CONFIGURADA",
    }
    res_put = client.put(f"/v2/competicoes/{id_comp}", json=update_payload, headers=headers)
    assert res_put.status_code == 200
    assert res_put.json()["nome"] == "Futsal Adulto Série Ouro V2"
    assert res_put.json()["status"] == "CONFIGURADA"

    # 5. Exclusão de competição sem jogos em andamento/finalizados
    res_del = client.delete(f"/v2/competicoes/{id_comp}", headers=headers)
    assert res_del.status_code == 204

    # Confirma que foi excluída
    assert client.get(f"/v2/competicoes/{id_comp}", headers=headers).status_code == 404


# ==============================================================================
# 4. TESTES DE EQUIPES E JOGADORES V2
# ==============================================================================

def test_equipes_e_elenco_jogadores_v2(client, db):
    """Testa cadastro de equipes na competição e inclusão/remoção de atletas no elenco."""
    _criar_usuario(db, "coord_elenco", "coordenador")
    headers = _auth_headers("coord_elenco")
    mod, _, _ = _criar_base_esportiva(db)

    comp = models.Competicao(
        id_modalidade=mod.id_modalidade,
        nome="Copa com Elencos",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        status="CONFIGURADA",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    # 1. Cadastra equipe na competição
    res_eq = client.post(
        f"/v2/competicoes/{comp.id_competicao}/equipes",
        json={"nome": "Barcelona Futsal", "grupo": "Grupo A"},
        headers=headers,
    )
    assert res_eq.status_code == 201
    equipe_dados = res_eq.json()
    id_equipe = equipe_dados["id_equipe"]
    assert equipe_dados["nome"] == "Barcelona Futsal"

    # 2. Listagem de equipes da competição
    res_list_eq = client.get(f"/v2/competicoes/{comp.id_competicao}/equipes", headers=headers)
    assert res_list_eq.status_code == 200
    assert any(e["id_equipe"] == id_equipe for e in res_list_eq.json())

    # 3. Adiciona jogador ao elenco da equipe
    jog_payload = {
        "nome": "Lionel Messi",
        "numero_camisa": 10,
        "posicao": "Ala",
        "documento": "12345678900",
        "data_nascimento": "1987-06-24",
        "ativo": True,
    }
    res_jog = client.post(f"/v2/equipes/{id_equipe}/jogadores", json=jog_payload, headers=headers)
    assert res_jog.status_code == 201
    jog_dados = res_jog.json()
    id_jogador = jog_dados["id_jogador"]
    assert jog_dados["nome"] == "Lionel Messi"
    assert jog_dados["numero_camisa"] == 10
    assert jog_dados["id_equipe"] == id_equipe

    # 4. Lista jogadores da equipe
    res_list_jog = client.get(f"/v2/equipes/{id_equipe}/jogadores", headers=headers)
    assert res_list_jog.status_code == 200
    jogadores = res_list_jog.json()
    assert len(jogadores) == 1
    assert jogadores[0]["id_jogador"] == id_jogador

    # 5. Remove jogador do elenco
    res_del_jog = client.delete(f"/v2/jogadores/{id_jogador}", headers=headers)
    assert res_del_jog.status_code == 204

    # Confirma remoção
    res_list_jog_apos = client.get(f"/v2/equipes/{id_equipe}/jogadores", headers=headers)
    assert len(res_list_jog_apos.json()) == 0


# ==============================================================================
# 5. TESTES DE GERAÇÃO DE CONFRONTOS, SÚMULA RÁPIDA E FINALIZAÇÃO
# ==============================================================================

def test_geracao_confrontos_sumula_rapida_e_finalizacao(client, db):
    """Testa geração de jogos, lançamento de beira de campo, estorno e encerramento com pênaltis."""
    _criar_usuario(db, "coord_jogos", "coordenador")
    headers = _auth_headers("coord_jogos")
    mod, loc, arb = _criar_base_esportiva(db)

    # Cria competição em RASCUNHO para validar bloqueio
    comp = models.Competicao(
        id_modalidade=mod.id_modalidade,
        nome="Torneio de Mata-Mata V2",
        categoria="Livre",
        modo_inscricao="EQUIPE",
        formato="MATA_MATA",
        criterio_resultado="PLACAR",
        regras_formato={"fase_inicial": "FINAL", "jogos_ida_volta": False, "penaltis_desempate": True},
        status="RASCUNHO",
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)

    # Equipes
    eq1 = models.Equipe(nome="Time A", id_competicao=comp.id_competicao)
    eq2 = models.Equipe(nome="Time B", id_competicao=comp.id_competicao)
    db.add_all([eq1, eq2])
    db.commit()
    db.refresh(eq1)
    db.refresh(eq2)

    # Jogadores
    j1 = models.Jogador(id_equipe=eq1.id_equipe, nome="Atleta A1", numero_camisa=9)
    j2 = models.Jogador(id_equipe=eq2.id_equipe, nome="Atleta B1", numero_camisa=10)
    db.add_all([j1, j2])
    db.commit()
    db.refresh(j1)
    db.refresh(j2)

    # 1. Tentativa de gerar confrontos com status RASCUNHO deve retornar 400
    res_gerar_bloq = client.post(f"/v2/competicoes/{comp.id_competicao}/gerar-confrontos", headers=headers)
    assert res_gerar_bloq.status_code in (400, 422)

    # Atualiza status para CONFIGURADA
    comp.status = "CONFIGURADA"
    db.commit()

    # 2. Geração de confrontos bem-sucedida
    res_gerar = client.post(
        f"/v2/competicoes/{comp.id_competicao}/gerar-confrontos",
        json={"data_inicio": "2026-09-15", "hora_padrao": "19:00:00"},
        headers=headers,
    )
    assert res_gerar.status_code in (200, 201)
    confrontos_gerados = res_gerar.json()
    assert len(confrontos_gerados) >= 1
    id_confronto = confrontos_gerados[0]["id_confronto"]

    # 3. Consulta de confrontos com filtro
    res_confr = client.get(f"/v2/competicoes/{comp.id_competicao}/confrontos", headers=headers)
    assert res_confr.status_code == 200
    assert any(c["id_confronto"] == id_confronto for c in res_confr.json())

    # 4. Súmula Rápida: Adicionar GOL
    payload_gol = {
        "id_equipe": eq1.id_equipe,
        "id_jogador": j1.id_jogador,
        "tipo": "GOL",
        "minuto": 12,
        "tempo_jogo": "1T",
        "observacao": "Gol de falta",
    }
    res_gol = client.post(f"/v2/confrontos/{id_confronto}/ocorrencias", json=payload_gol, headers=headers)
    assert res_gol.status_code == 201
    ocorrencia_gol = res_gol.json()
    id_oco_gol = ocorrencia_gol["id_ocorrencia"]

    # Placar deve ter atualizado no confronto
    confronto_db = db.query(models.Confronto).filter(models.Confronto.id_confronto == id_confronto).first()
    db.refresh(confronto_db)
    assert confronto_db.placar_mandante == 1
    assert confronto_db.status == "Em Andamento"

    # 5. Súmula Rápida: Adicionar Cartão Amarelo
    payload_cartao = {
        "id_equipe": eq2.id_equipe,
        "id_jogador": j2.id_jogador,
        "tipo": "CARTAO_AMARELO",
        "minuto": 25,
        "tempo_jogo": "1T",
    }
    res_cartao = client.post(f"/v2/confrontos/{id_confronto}/ocorrencias", json=payload_cartao, headers=headers)
    assert res_cartao.status_code == 201

    # 6. Súmula Rápida: Estorno / Remoção de ocorrência (gol)
    res_del_oco = client.delete(f"/v2/confrontos/ocorrencias/{id_oco_gol}", headers=headers)
    assert res_del_oco.status_code == 204

    db.refresh(confronto_db)
    assert confronto_db.placar_mandante == 0  # Placar decrementado

    # 7. Finalização do confronto com pênaltis (jogo empatado 0x0 em mata-mata)
    payload_finalizar = {
        "penaltis_mandante": 5,
        "penaltis_visitante": 4,
        "observacoes": "Decidido nos pênaltis",
    }
    res_fin = client.post(f"/v2/confrontos/{id_confronto}/finalizar", json=payload_finalizar, headers=headers)
    assert res_fin.status_code == 200
    dados_fin = res_fin.json()
    assert dados_fin["status"] == "Finalizado"
    assert dados_fin["penaltis_mandante"] == 5
    assert dados_fin["penaltis_visitante"] == 4
    assert dados_fin["id_equipe_vencedora"] == eq1.id_equipe


# ==============================================================================
# 6. TESTES DE RELATÓRIOS: CLASSIFICAÇÃO, ARTILHARIA E DISCIPLINAR
# ==============================================================================

def test_endpoints_classificacao_artilharia_e_disciplinar_v2(client, db):
    """Testa os relatórios apurados consolidados da API administrativa."""
    _criar_usuario(db, "coord_relatorios", "coordenador")
    headers = _auth_headers("coord_relatorios")
    mod, loc, arb = _criar_base_esportiva(db)

    comp = models.Competicao(
        id_modalidade=mod.id_modalidade,
        nome="Brasileirão V2 Admin",
        categoria="Principal",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        regras_formato={
            "turno_e_returno": False,
            "vitoria_pontos": 3,
            "empate_pontos": 1,
            "derrota_pontos": 0,
            "criterios_desempate": ["pontos", "vitorias", "saldo_gols"],
        },
        status="EM_ANDAMENTO",
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
    infrator = models.Jogador(id_equipe=eq_b.id_equipe, nome="Zagueiro B", numero_camisa=3)
    db.add_all([artilheiro, infrator])
    db.commit()
    db.refresh(artilheiro)
    db.refresh(infrator)

    # Confronto finalizado 2x0
    c1 = models.Confronto(
        id_competicao=comp.id_competicao,
        id_equipe_mandante=eq_a.id_equipe,
        id_equipe_visitante=eq_b.id_equipe,
        data=date(2026, 9, 10),
        hora=time(16, 0),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        placar_mandante=2,
        placar_visitante=0,
        status="Finalizado",
    )
    db.add(c1)
    db.commit()
    db.refresh(c1)

    # Gols
    gol1 = models.OcorrenciaPartida(id_confronto=c1.id_confronto, id_equipe=eq_a.id_equipe, id_jogador=artilheiro.id_jogador, tipo="GOL", minuto=10)
    gol2 = models.OcorrenciaPartida(id_confronto=c1.id_confronto, id_equipe=eq_a.id_equipe, id_jogador=artilheiro.id_jogador, tipo="GOL", minuto=30)
    # Cartão Vermelho
    vermelho = models.OcorrenciaPartida(id_confronto=c1.id_confronto, id_equipe=eq_b.id_equipe, id_jogador=infrator.id_jogador, tipo="CARTAO_VERMELHO", minuto=80)
    db.add_all([gol1, gol2, vermelho])
    db.commit()

    # 1. Classificação
    res_class = client.get(f"/v2/competicoes/{comp.id_competicao}/classificacao", headers=headers)
    assert res_class.status_code == 200
    dados_class = res_class.json()
    assert "tabela" in dados_class
    assert dados_class["tabela"][0]["equipe"] == "Time A"
    assert dados_class["tabela"][0]["pontos"] == 3

    # 2. Artilharia
    res_art = client.get(f"/v2/competicoes/{comp.id_competicao}/artilharia", headers=headers)
    assert res_art.status_code == 200
    dados_art = res_art.json()
    assert len(dados_art) >= 1
    assert dados_art[0]["nome_jogador"] == "Artilheiro A"
    assert dados_art[0]["gols"] == 2

    # 3. Disciplinar
    res_disc = client.get(f"/v2/competicoes/{comp.id_competicao}/disciplinar", headers=headers)
    assert res_disc.status_code == 200
    dados_disc = res_disc.json()
    assert "suspensos" in dados_disc
    assert any(s["nome_jogador"] == "Zagueiro B" for s in dados_disc["suspensos"])


# ==============================================================================
# 7. TESTES DE ENDPOINTS PÚBLICOS E PROTEÇÃO LGPD (/v2/publico/...)
# ==============================================================================

def test_endpoints_publicos_e_seguranca_lgpd(client, db):
    """Garante funcionamento do portal público, ocultação de rascunhos e proteção estrita de dados."""
    mod, loc, arb = _criar_base_esportiva(db)

    # Cria Grupo
    grupo = models.GrupoCompeticoes(
        nome="Olimpíada Regional 2026",
        descricao="Evento público da região",
        slug="olimpiada-regional-2026",
        status="ATIVO",
    )
    db.add(grupo)
    db.commit()
    db.refresh(grupo)

    # Cria Competição PUBLICADA e Competição em RASCUNHO vinculadas ao mesmo grupo
    comp_publicada = models.Competicao(
        id_modalidade=mod.id_modalidade,
        id_grupo=grupo.id_grupo,
        nome="Futsal Sub-20 Público",
        categoria="Sub-20",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        status="PUBLICADA",
    )
    comp_rascunho = models.Competicao(
        id_modalidade=mod.id_modalidade,
        id_grupo=grupo.id_grupo,
        nome="Futsal Master Secreto",
        categoria="Master",
        modo_inscricao="EQUIPE",
        formato="PONTOS_CORRIDOS",
        criterio_resultado="PLACAR",
        status="RASCUNHO",
    )
    db.add_all([comp_publicada, comp_rascunho])
    db.commit()
    db.refresh(comp_publicada)
    db.refresh(comp_rascunho)

    # Equipes e jogadores com dados sensíveis
    eq_pub1 = models.Equipe(nome="Time Sol", id_competicao=comp_publicada.id_competicao)
    eq_pub2 = models.Equipe(nome="Time Lua", id_competicao=comp_publicada.id_competicao)
    db.add_all([eq_pub1, eq_pub2])
    db.commit()
    db.refresh(eq_pub1)
    db.refresh(eq_pub2)

    j_sensivel = models.Jogador(
        id_equipe=eq_pub1.id_equipe,
        nome="Craque Anônimo",
        numero_camisa=10,
        posicao="Pivô",
        documento="999.888.777-66",  # Dado sensível (LGPD)
        data_nascimento=date(1995, 5, 20),
    )
    db.add(j_sensivel)
    db.commit()
    db.refresh(j_sensivel)

    confronto_pub = models.Confronto(
        id_competicao=comp_publicada.id_competicao,
        id_equipe_mandante=eq_pub1.id_equipe,
        id_equipe_visitante=eq_pub2.id_equipe,
        data=date(2026, 9, 12),
        hora=time(18, 30),
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        placar_mandante=1,
        placar_visitante=0,
        status="Finalizado",
    )
    db.add(confronto_pub)
    db.commit()
    db.refresh(confronto_pub)

    gol_pub = models.OcorrenciaPartida(
        id_confronto=confronto_pub.id_confronto,
        id_equipe=eq_pub1.id_equipe,
        id_jogador=j_sensivel.id_jogador,
        tipo="GOL",
        minuto=18,
    )
    db.add(gol_pub)
    db.commit()

    # --------------------------------------------------------------------------
    # 7.1 GET /v2/publico/grupos/{slug}
    # --------------------------------------------------------------------------
    res_grupo = client.get("/v2/publico/grupos/olimpiada-regional-2026")
    assert res_grupo.status_code == 200
    dados_g = res_grupo.json()
    assert dados_g["slug"] == "olimpiada-regional-2026"
    # Deve listar a competição publicada
    ids_comps = [c["id_competicao"] for c in dados_g["competicoes"]]
    assert comp_publicada.id_competicao in ids_comps
    # NÃO deve listar a competição em RASCUNHO
    assert comp_rascunho.id_competicao not in ids_comps

    # 404 para slug inexistente
    assert client.get("/v2/publico/grupos/slug-que-nao-existe").status_code == 404

    # --------------------------------------------------------------------------
    # 7.2 GET /v2/publico/competicoes/{id}
    # --------------------------------------------------------------------------
    # Publicada -> 200
    res_comp_pub = client.get(f"/v2/publico/competicoes/{comp_publicada.id_competicao}")
    assert res_comp_pub.status_code == 200
    assert res_comp_pub.json()["id_competicao"] == comp_publicada.id_competicao

    # Rascunho -> 404 para o público
    res_comp_rasc = client.get(f"/v2/publico/competicoes/{comp_rascunho.id_competicao}")
    assert res_comp_rasc.status_code == 404

    # --------------------------------------------------------------------------
    # 7.3 GET /v2/publico/competicoes/{id}/jogos
    # --------------------------------------------------------------------------
    res_jogos = client.get(f"/v2/publico/competicoes/{comp_publicada.id_competicao}/jogos")
    assert res_jogos.status_code == 200
    jogos = res_jogos.json()
    assert len(jogos) >= 1
    jogo = jogos[0]
    assert "gols" in jogo
    assert len(jogo["gols"]) == 1
    assert jogo["gols"][0]["nome_jogador"] == "Craque Anônimo"

    # Rascunho -> 404
    assert client.get(f"/v2/publico/competicoes/{comp_rascunho.id_competicao}/jogos").status_code == 404

    # --------------------------------------------------------------------------
    # 7.4 GET /v2/publico/competicoes/{id}/classificacao
    # --------------------------------------------------------------------------
    res_class_pub = client.get(f"/v2/publico/competicoes/{comp_publicada.id_competicao}/classificacao")
    assert res_class_pub.status_code == 200
    assert "tabela" in res_class_pub.json()

    # Rascunho -> 404
    assert client.get(f"/v2/publico/competicoes/{comp_rascunho.id_competicao}/classificacao").status_code == 404

    # --------------------------------------------------------------------------
    # 7.5 GET /v2/publico/competicoes/{id}/artilharia
    # --------------------------------------------------------------------------
    res_art_pub = client.get(f"/v2/publico/competicoes/{comp_publicada.id_competicao}/artilharia")
    assert res_art_pub.status_code == 200
    artilheiros_pub = res_art_pub.json()
    assert len(artilheiros_pub) == 1
    assert artilheiros_pub[0]["nome_jogador"] == "Craque Anônimo"

    # Rascunho -> 404
    assert client.get(f"/v2/publico/competicoes/{comp_rascunho.id_competicao}/artilharia").status_code == 404

    # --------------------------------------------------------------------------
    # 7.6 VERIFICAÇÃO RIGOROSA LGPD
    # Nenhum campo sensível pode estar presente em qualquer resposta pública
    # --------------------------------------------------------------------------
    textos_publicos = [
        res_grupo.text,
        res_comp_pub.text,
        res_jogos.text,
        res_class_pub.text,
        res_art_pub.text,
    ]
    campos_sensiveis = ["999.888.777-66", "documento", "documento_pessoal", "cpf", "rg", "telefone", "contato"]

    for texto in textos_publicos:
        for campo in campos_sensiveis:
            assert campo not in texto, f"LGPD VIOLADA: Campo/valor sensível '{campo}' vazou no portal público!"
