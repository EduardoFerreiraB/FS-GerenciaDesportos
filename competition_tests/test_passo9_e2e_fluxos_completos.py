"""Suíte de Testes de Integração Ponta a Ponta (E2E) - Passo 9.

Cobre os seguintes fluxos de negócio completos:
1. Fluxo Completo de Esporte Coletivo (Futebol/Futsal - Pontos Corridos):
   - Criação de Evento e Edição via API.
   - Criação de Competição em modo EQUIPE (status inicial RASCUNHO, formato PONTOS_CORRIDOS).
   - Tentativa de gerar confrontos em rascunho (rejeitada com HTTP 422).
   - Transição de status para iniciada (POST /competicoes/{id}/iniciar).
   - Cadastro de múltiplas equipes participantes e vinculação de atletas com validação de exclusividade de elenco (HTTP 422 ao tentar duplicar).
   - Geração automática e agendamento de confrontos.
   - Lançamento de placares com finalização dos confrontos.
   - Consulta da tabela de classificação calculada (GET /competicoes/{id}/classificacao-equipes).
   - Consulta dos endpoints públicos (/publico/competicoes/{id}/...) garantindo acesso a dados públicos e ausência total de documentos pessoais.

2. Fluxo Completo de Torneio Mata-Mata Eliminatório:
   - Competição em formato MATA_MATA.
   - Chaveamento com semifinal e final vinculadas (id_proximo_confronto).
   - Proibição estrita de empates em confrontos finalizados de mata-mata (HTTP 422).
   - Finalização de semifinais com promoção automática dos vencedores para a grande final.
   - Bloqueio retroativo: tentativa de alterar resultado ou reabrir semifinal após início da final (HTTP 422).
   - Finalização da grande final e identificação de campeão e vice-campeão na árvore e na tabela de classificação.
   - Consulta pública confirmando pódio de mata-mata.

3. Fluxo Completo de Modalidade Individual (Natação / Atletismo):
   - Criação de Competição em modo INDIVIDUAL (formato TABELA_UNICA, critério TEMPO).
   - Iniciação da competição (POST /competicoes/{id}/iniciar).
   - Inscrição individual de múltiplos atletas com número de peito (prevenção de duplicidade com HTTP 422).
   - Criação de provas individuais vinculadas (50m Livre e 100m Costas).
   - Rejeição de tempos inválidos (<= 0 ms) com HTTP 422.
   - Lançamento de resultados oficiais válidos com atleta desqualificado (DSQ).
   - Consulta da classificação da prova com menor tempo em 1º lugar, pódio destacado (ouro, prata, bronze) e atleta DSQ no final sem colocação.
   - Consulta do quadro geral consolidado de medalhas (GET /competicoes/{id}/classificacao-individual).
   - Consulta pública correspondente com estrita proteção de privacidade.

4. Isolamento de Modos Cruzados:
   - Chamadas a endpoints de equipes para competição individual retornam HTTP 422.
   - Chamadas a endpoints individuais para competição de equipes retornam HTTP 422.
"""

from datetime import date, time
import pytest

import models
from security import create_access_token, get_password_hash


def _auth_headers(username: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': username})}"}


def _seed_base_users_and_resources(db):
    """Cria usuários autenticados com papéis distintos, locais e árbitros com dados confidenciais."""
    admin = models.Usuario(
        username="admin-e2e@desportos.com",
        password_hash=get_password_hash("admin-pass-123"),
        role="admin",
        must_change_password=False,
    )
    coord = models.Usuario(
        username="coord-e2e@desportos.com",
        password_hash=get_password_hash("coord-pass-123"),
        role="coordenador",
        must_change_password=False,
    )
    prof = models.Usuario(
        username="prof-e2e@desportos.com",
        password_hash=get_password_hash("prof-pass-123"),
        role="professor",
        must_change_password=False,
    )
    db.add_all([admin, coord, prof])

    local_ginasio = models.Local(
        loca_nome="Ginásio Poliesportivo Central",
        loca_descricao="Quadra oficial com piso modular",
        ativo=True,
    )
    local_piscina = models.Local(
        loca_nome="Centro Aquático Municipal",
        loca_descricao="Piscina olímpica 50m 8 raias",
        ativo=True,
    )
    arbitro_futsal = models.Arbitro(
        apito_nome="Carlos Silva Árbitro",
        apito_doc="111.222.333-44",
        apito_tel="(11) 98765-4321",
    )
    arbitro_natacao = models.Arbitro(
        apito_nome="Mariana Souza Juíza",
        apito_doc="555.666.777-88",
        apito_tel="(11) 91234-5678",
    )
    db.add_all([local_ginasio, local_piscina, arbitro_futsal, arbitro_natacao])
    db.flush()

    mod_futsal = models.Modalidade(nome="Futsal E2E", duracao_minutos=40)
    mod_natacao = models.Modalidade(nome="Natação E2E", duracao_minutos=30)
    db.add_all([mod_futsal, mod_natacao])
    db.flush()

    db.commit()

    return {
        "admin": admin,
        "coord": coord,
        "prof": prof,
        "local_ginasio": local_ginasio,
        "local_piscina": local_piscina,
        "arbitro_futsal": arbitro_futsal,
        "arbitro_natacao": arbitro_natacao,
        "mod_futsal": mod_futsal,
        "mod_natacao": mod_natacao,
    }


# ============================================================================
# FLUXO A: Esporte Coletivo (Futsal / Pontos Corridos)
# ============================================================================

def test_e2e_fluxo_completo_esporte_coletivo_pontos_corridos(client, db):
    """Fluxo completo de esporte coletivo:

    Criação -> Rascunho -> Bloqueio de confrontos em rascunho -> Início ->
    Cadastro de equipes e atletas com exclusividade de elenco ->
    Geração e agendamento de confrontos -> Placares e finalizações ->
    Tabela de classificação calculada -> Consulta pública sem vazamento de dados.
    """
    ctx = _seed_base_users_and_resources(db)
    coord_hdr = _auth_headers(ctx["coord"].username)
    prof_hdr = _auth_headers(ctx["prof"].username)

    # 1. Criação de Evento
    resp_ev = client.post(
        "/eventos/",
        json={"even_nome": "Jogos Escolares Interclasses 2026", "descricao": "Torneio anual de esportes"},
        headers=coord_hdr,
    )
    assert resp_ev.status_code == 201, resp_ev.text
    id_evento = resp_ev.json()["id_evento"]

    # 2. Criação de Edição
    resp_ed = client.post(
        "/edicoes/",
        json={
            "id_evento": id_evento,
            "edic_ano": 2026,
            "tipo_competicao": "Pontos Corridos",
            "data_inicio": "2026-09-01",
            "data_fim": "2026-09-30",
        },
        headers=coord_hdr,
    )
    assert resp_ed.status_code == 201, resp_ed.text
    id_edicao = resp_ed.json()["id_edicao"]

    # 3. Criação de Competição em modo EQUIPE (status inicial RASCUNHO)
    resp_comp = client.post(
        f"/edicoes/{id_edicao}/competicoes",
        json={
            "id_modalidade": ctx["mod_futsal"].id_modalidade,
            "nome": "Copa de Futsal Colegial",
            "categoria": "Sub-17",
            "modo_inscricao": "EQUIPE",
            "formato": "PONTOS_CORRIDOS",
            "criterio_resultado": "PLACAR",
            "data_inicio": "2026-09-01",
            "data_fim": "2026-09-20",
        },
        headers=coord_hdr,
    )
    assert resp_comp.status_code == 201, resp_comp.text
    comp = resp_comp.json()
    id_comp = comp["id_competicao"]
    assert comp["status"] == "RASCUNHO"
    assert comp["modo_inscricao"] == "EQUIPE"
    assert comp["formato"] == "PONTOS_CORRIDOS"

    # 4. Tentativa de gerar confrontos em rascunho -> DEVE SER BLOQUEADA (HTTP 422)
    resp_gerar_rascunho = client.post(
        f"/competicoes/{id_comp}/gerar-confrontos",
        json={"data_inicio": "2026-09-05"},
        headers=coord_hdr,
    )
    assert resp_gerar_rascunho.status_code == 422
    assert "rascunho" in resp_gerar_rascunho.text.lower()

    # 5. Transição de status para iniciada (POST /competicoes/{id}/iniciar)
    resp_iniciar = client.post(
        f"/competicoes/{id_comp}/iniciar",
        headers=coord_hdr,
    )
    assert resp_iniciar.status_code == 200, resp_iniciar.text
    assert resp_iniciar.json()["status"] == "EM_ANDAMENTO"

    # 6. Cadastro de múltiplas equipes participantes
    resp_t1 = client.post(f"/competicoes/{id_comp}/equipes", json={"nome": "Leões Dourados FC"}, headers=coord_hdr)
    resp_t2 = client.post(f"/competicoes/{id_comp}/equipes", json={"nome": "Falcões Negros FC"}, headers=coord_hdr)
    resp_t3 = client.post(f"/competicoes/{id_comp}/equipes", json={"nome": "Tubarões Azuis FC"}, headers=coord_hdr)
    assert resp_t1.status_code == 201
    assert resp_t2.status_code == 201
    assert resp_t3.status_code == 201
    id_t1 = resp_t1.json()["id_equipe"]
    id_t2 = resp_t2.json()["id_equipe"]
    id_t3 = resp_t3.json()["id_equipe"]

    # 7. Criação de atletas e verificação da restrição de exclusividade de elenco
    # Atleta 1 (Lucas Silva - CPF confidencial)
    p1 = models.Participante(tipo="atleta")
    db.add(p1)
    db.flush()
    atleta1 = models.Atleta(
        id_participante=p1.id_participante,
        nome_completo="Lucas Silva Atleta",
        data_nascimento=date(2009, 3, 15),
        documento_pessoal="444.555.666-77",
        contato="(11) 98888-0001",
        endereco="Rua dos Campeões, 100",
    )
    # Atleta 2 (Matheus Souza)
    p2 = models.Participante(tipo="atleta")
    db.add(p2)
    db.flush()
    atleta2 = models.Atleta(
        id_participante=p2.id_participante,
        nome_completo="Matheus Souza Atleta",
        data_nascimento=date(2009, 7, 20),
        documento_pessoal="111.222.333-99",
        contato="(11) 98888-0002",
        endereco="Av. das Vitórias, 200",
    )
    # Atleta 3 (Gabriel Lima)
    p3 = models.Participante(tipo="atleta")
    db.add(p3)
    db.flush()
    atleta3 = models.Atleta(
        id_participante=p3.id_participante,
        nome_completo="Gabriel Lima Atleta",
        data_nascimento=date(2009, 11, 5),
        documento_pessoal="999.888.777-66",
        contato="(11) 98888-0003",
        endereco="Praça do Esporte, 300",
    )
    db.add_all([atleta1, atleta2, atleta3])
    db.commit()

    # Vincula Atleta 1 ao Time 1 -> Sucesso (200)
    resp_vinc1 = client.post(f"/equipes/{id_t1}/participantes/{p1.id_participante}", headers=coord_hdr)
    assert resp_vinc1.status_code == 200

    # Tentativa de vincular Atleta 1 ao Time 2 na mesma competição -> BLOQUEADA (422)
    resp_vinc_dupl = client.post(f"/equipes/{id_t2}/participantes/{p1.id_participante}", headers=coord_hdr)
    assert resp_vinc_dupl.status_code == 422
    assert "outra equipe" in resp_vinc_dupl.text.lower()

    # Vincula Atleta 2 ao Time 2 e Atleta 3 ao Time 3 -> Sucesso
    assert client.post(f"/equipes/{id_t2}/participantes/{p2.id_participante}", headers=coord_hdr).status_code == 200
    assert client.post(f"/equipes/{id_t3}/participantes/{p3.id_participante}", headers=coord_hdr).status_code == 200

    # 8. Geração automática e agendamento de confrontos
    resp_gerar = client.post(
        f"/competicoes/{id_comp}/gerar-confrontos",
        json={
            "data_inicio": "2026-09-05",
            "hora_padrao": "15:00:00",
            "id_local_padrao": ctx["local_ginasio"].id_local,
            "id_arbitro_padrao": ctx["arbitro_futsal"].id_arbitro,
        },
        headers=coord_hdr,
    )
    assert resp_gerar.status_code in (200, 201), resp_gerar.text
    confrontos = resp_gerar.json()
    # 3 equipes em pontos corridos (turnos com bye) geram 3 confrontos
    assert len(confrontos) == 3
    assert all(c["id_competicao"] == id_comp for c in confrontos)
    assert all(c["status"] == "Agendado" for c in confrontos)

    # 9. Lançamento de placares com finalização dos confrontos
    # Lança placares deterministicamente conforme as equipes participantes de cada jogo:
    # Jogo Time 1 vs Time 2 -> Time 1 vence por 3 a 1
    # Jogo Time 1 vs Time 3 -> Empate em 2 a 2
    # Jogo Time 2 vs Time 3 -> Time 3 vence por 4 a 0
    for c in confrontos:
        m = c["id_equipe_mandante"]
        v = c["id_equipe_visitante"]
        if {m, v} == {id_t1, id_t2}:
            pm = 3 if m == id_t1 else 1
            pv = 1 if m == id_t1 else 3
            resp = client.put(f"/confrontos/{c['id_confronto']}", json={"placar_mandante": pm, "placar_visitante": pv, "status": "Finalizado"}, headers=coord_hdr)
            assert resp.status_code == 200
            assert resp.json()["id_equipe_vencedora"] == id_t1
        elif {m, v} == {id_t1, id_t3}:
            resp = client.put(f"/confrontos/{c['id_confronto']}", json={"placar_mandante": 2, "placar_visitante": 2, "status": "Finalizado"}, headers=coord_hdr)
            assert resp.status_code == 200
            assert resp.json()["id_equipe_vencedora"] is None
        elif {m, v} == {id_t2, id_t3}:
            pm = 4 if m == id_t3 else 0
            pv = 0 if m == id_t3 else 4
            resp = client.put(f"/confrontos/{c['id_confronto']}", json={"placar_mandante": pm, "placar_visitante": pv, "status": "Finalizado"}, headers=coord_hdr)
            assert resp.status_code == 200
            assert resp.json()["id_equipe_vencedora"] == id_t3

    # 10. Consulta da tabela de classificação calculada
    resp_classif = client.get(f"/competicoes/{id_comp}/classificacao-equipes", headers=prof_hdr)
    assert resp_classif.status_code == 200, resp_classif.text
    tabela = resp_classif.json()["classificacao"]
    assert len(tabela) == 3

    # Mapa de desempenho por id
    stats_por_id = {item["id_equipe"]: item for item in tabela}
    # Time 3: 4 pts, SG +4 -> 1º lugar
    # Time 1: 4 pts, SG +2 -> 2º lugar
    # Time 2: 0 pts, SG -6 -> 3º lugar
    assert stats_por_id[id_t3]["pontos"] == 4
    assert stats_por_id[id_t3]["vitorias"] == 1
    assert stats_por_id[id_t3]["empates"] == 1
    assert stats_por_id[id_t3]["saldo_gols"] == 4

    assert stats_por_id[id_t1]["pontos"] == 4
    assert stats_por_id[id_t1]["vitorias"] == 1
    assert stats_por_id[id_t1]["empates"] == 1
    assert stats_por_id[id_t1]["saldo_gols"] == 2

    assert stats_por_id[id_t2]["pontos"] == 0
    assert stats_por_id[id_t2]["derrotas"] == 2
    assert stats_por_id[id_t2]["saldo_gols"] == -6

    assert tabela[0]["id_equipe"] == id_t3 and tabela[0]["posicao"] == 1
    assert tabela[1]["id_equipe"] == id_t1 and tabela[1]["posicao"] == 2
    assert tabela[2]["id_equipe"] == id_t2 and tabela[2]["posicao"] == 3

    # 11. Consulta dos endpoints públicos correspondentes (sem token)
    # 11a. Competição pública
    resp_pub_comp = client.get(f"/publico/competicoes/{id_comp}")
    assert resp_pub_comp.status_code == 200
    dados_pub_comp = resp_pub_comp.json()
    assert dados_pub_comp["nome"] == "Copa de Futsal Colegial"
    assert dados_pub_comp["status"] == "EM_ANDAMENTO"

    # 11b. Equipes públicas e proteção de dados de atletas
    resp_pub_eq = client.get(f"/publico/competicoes/{id_comp}/equipes")
    assert resp_pub_eq.status_code == 200
    equipes_pub = resp_pub_eq.json()
    assert len(equipes_pub) == 3

    # Verificação estrita de ausência de dados pessoais (CPF, doc, tel, endereco)
    texto_pub_eq = resp_pub_eq.text
    assert "444.555.666-77" not in texto_pub_eq
    assert "111.222.333-99" not in texto_pub_eq
    assert "999.888.777-66" not in texto_pub_eq
    assert "Rua dos Campeões" not in texto_pub_eq
    assert "98888-0001" not in texto_pub_eq
    assert "documento_pessoal" not in texto_pub_eq

    # 11c. Confrontos públicos e proteção de dados de árbitros
    resp_pub_conf = client.get(f"/publico/competicoes/{id_comp}/confrontos")
    assert resp_pub_conf.status_code == 200
    confrontos_pub = resp_pub_conf.json()
    assert len(confrontos_pub) == 3
    texto_pub_conf = resp_pub_conf.text
    assert "111.222.333-44" not in texto_pub_conf
    assert "98765-4321" not in texto_pub_conf
    assert "apito_doc" not in texto_pub_conf
    assert "apito_tel" not in texto_pub_conf

    # 11d. Classificação pública
    resp_pub_classif = client.get(f"/publico/competicoes/{id_comp}/classificacao-equipes")
    assert resp_pub_classif.status_code == 200
    assert len(resp_pub_classif.json()["classificacao"]) == 3
    assert resp_pub_classif.json()["classificacao"][0]["id_equipe"] == id_t3


# ============================================================================
# FLUXO B: Torneio Mata-Mata Eliminatório
# ============================================================================

def test_e2e_fluxo_completo_torneio_mata_mata_eliminatorio(client, db):
    """Fluxo completo de torneio mata-mata eliminatório:

    Criação em MATA_MATA -> Chaveamento de Semifinal e Final ->
    Finalização de Semifinal com vitória e promoção automática para a Final ->
    Proibição estrita de empates em mata-mata finalizado (422) ->
    Bloqueio retroativo contra alteração da semifinal após final em andamento (422) ->
    Conclusão da final e identificação do campeão e vice-campeão.
    """
    ctx = _seed_base_users_and_resources(db)
    coord_hdr = _auth_headers(ctx["coord"].username)
    prof_hdr = _auth_headers(ctx["prof"].username)

    # Evento e Edição
    ev = client.post("/eventos/", json={"even_nome": "Torneio Eliminatório 2026"}, headers=coord_hdr).json()
    ed = client.post(
        "/edicoes/",
        json={
            "id_evento": ev["id_evento"],
            "edic_ano": 2026,
            "tipo_competicao": "Mata-Mata",
            "data_inicio": "2026-10-01",
            "data_fim": "2026-10-31",
        },
        headers=coord_hdr,
    ).json()

    # Competição Mata-Mata
    resp_comp = client.post(
        f"/edicoes/{ed['id_edicao']}/competicoes",
        json={
            "id_modalidade": ctx["mod_futsal"].id_modalidade,
            "nome": "Copa dos Campeões Mata-Mata",
            "categoria": "Principal",
            "modo_inscricao": "EQUIPE",
            "formato": "MATA_MATA",
            "criterio_resultado": "PLACAR",
            "data_inicio": "2026-10-01",
            "data_fim": "2026-10-31",
        },
        headers=coord_hdr,
    )
    assert resp_comp.status_code == 201
    id_comp = resp_comp.json()["id_competicao"]

    # Iniciar competição
    assert client.post(f"/competicoes/{id_comp}/iniciar", headers=coord_hdr).status_code == 200

    # Cadastrar 4 equipes
    t_tigres = client.post(f"/competicoes/{id_comp}/equipes", json={"nome": "Tigres FC"}, headers=coord_hdr).json()["id_equipe"]
    t_leoes = client.post(f"/competicoes/{id_comp}/equipes", json={"nome": "Leões FC"}, headers=coord_hdr).json()["id_equipe"]
    t_falcoes = client.post(f"/competicoes/{id_comp}/equipes", json={"nome": "Falcões FC"}, headers=coord_hdr).json()["id_equipe"]
    t_aguias = client.post(f"/competicoes/{id_comp}/equipes", json={"nome": "Águias FC"}, headers=coord_hdr).json()["id_equipe"]

    # Geração automática da árvore mata-mata (4 equipes -> 2 semifinais e 1 final)
    resp_gerar = client.post(
        f"/competicoes/{id_comp}/gerar-confrontos",
        json={
            "data_inicio": "2026-10-10",
            "fase_inicial": "Semifinal",
            "id_local_padrao": ctx["local_ginasio"].id_local,
            "id_arbitro_padrao": ctx["arbitro_futsal"].id_arbitro,
        },
        headers=coord_hdr,
    )
    assert resp_gerar.status_code in (200, 201), resp_gerar.text
    confrontos = resp_gerar.json()
    assert len(confrontos) == 3

    final_match = next(c for c in confrontos if c["fase"] == "Final")
    semis = [c for c in confrontos if c["fase"] != "Final"]
    assert len(semis) == 2
    semi1 = semis[0]
    semi2 = semis[1]

    # Verifica que as duas semifinais apontam para a final
    assert semi1["id_proximo_confronto"] == final_match["id_confronto"]
    assert semi2["id_proximo_confronto"] == final_match["id_confronto"]
    assert final_match["id_equipe_mandante"] is None
    assert final_match["id_equipe_visitante"] is None

    # Proibição de empates em mata-mata finalizado (HTTP 422)
    resp_empate = client.put(
        f"/confrontos/{semi1['id_confronto']}",
        json={"placar_mandante": 2, "placar_visitante": 2, "status": "Finalizado"},
        headers=coord_hdr,
    )
    assert resp_empate.status_code == 422
    assert "empat" in resp_empate.text.lower()

    # Finalização da Semifinal 1 com vitória da equipe mandante
    mandante_s1 = semi1["id_equipe_mandante"]
    visitante_s1 = semi1["id_equipe_visitante"]
    resp_win_s1 = client.put(
        f"/confrontos/{semi1['id_confronto']}",
        json={"placar_mandante": 3, "placar_visitante": 1, "status": "Finalizado"},
        headers=coord_hdr,
    )
    assert resp_win_s1.status_code == 200
    assert resp_win_s1.json()["id_equipe_vencedora"] == mandante_s1

    # Verificação da promoção automática: Final agora tem o vencedor da semi1
    final_apos_s1 = client.get(f"/confrontos/{final_match['id_confronto']}", headers=prof_hdr).json()
    assert final_apos_s1["id_equipe_mandante"] == mandante_s1
    assert final_apos_s1["id_equipe_visitante"] is None

    # Finalização da Semifinal 2 com vitória da equipe visitante
    visitante_s2 = semi2["id_equipe_visitante"]
    resp_win_s2 = client.put(
        f"/confrontos/{semi2['id_confronto']}",
        json={"placar_mandante": 0, "placar_visitante": 2, "status": "Finalizado"},
        headers=coord_hdr,
    )
    assert resp_win_s2.status_code == 200
    assert resp_win_s2.json()["id_equipe_vencedora"] == visitante_s2

    # Final agora tem os dois finalistas definidos
    final_pronta = client.get(f"/confrontos/{final_match['id_confronto']}", headers=prof_hdr).json()
    assert final_pronta["id_equipe_mandante"] == mandante_s1
    assert final_pronta["id_equipe_visitante"] == visitante_s2

    # Inicia a Grande Final (status = "Em Andamento")
    resp_inicio_final = client.put(
        f"/confrontos/{final_match['id_confronto']}",
        json={"status": "Em Andamento"},
        headers=coord_hdr,
    )
    assert resp_inicio_final.status_code == 200

    # TENTATIVA DE BLOQUEIO RETROATIVO:
    # Tentar alterar placar/vencedor da semifinal enquanto a final está em andamento -> DEVE RETORNAR 422
    resp_reversao = client.put(
        f"/confrontos/{semi1['id_confronto']}",
        json={"placar_mandante": 1, "placar_visitante": 4},
        headers=coord_hdr,
    )
    assert resp_reversao.status_code == 422
    assert "próximo confronto" in resp_reversao.text.lower() or "proximo confronto" in resp_reversao.text.lower()

    # Tentar reabrir a semifinal para status Agendado -> DEVE RETORNAR 422
    resp_reabrir = client.put(
        f"/confrontos/{semi1['id_confronto']}",
        json={"status": "Agendado"},
        headers=coord_hdr,
    )
    assert resp_reabrir.status_code == 422

    # Finalizar a Grande Final: mandante_s1 vence visitante_s2 por 2 x 0
    resp_fim_final = client.put(
        f"/confrontos/{final_match['id_confronto']}",
        json={"placar_mandante": 2, "placar_visitante": 0, "status": "Finalizado"},
        headers=coord_hdr,
    )
    assert resp_fim_final.status_code == 200
    assert resp_fim_final.json()["id_equipe_vencedora"] == mandante_s1

    # Consulta da classificação de mata-mata
    resp_classif = client.get(f"/competicoes/{id_comp}/classificacao-equipes", headers=prof_hdr)
    assert resp_classif.status_code == 200
    dados_classif = resp_classif.json()
    assert dados_classif["campeao"] is not None
    assert dados_classif["campeao"]["id_equipe"] == mandante_s1
    assert dados_classif["vice_campeao"] is not None
    assert dados_classif["vice_campeao"]["id_equipe"] == visitante_s2
    assert len(dados_classif["arvore"]) == 3

    # Tabela consolidada coloca campeão em 1º e vice em 2º
    tabela = dados_classif["classificacao"]
    assert tabela[0]["id_equipe"] == mandante_s1 and tabela[0]["posicao"] == 1
    assert tabela[1]["id_equipe"] == visitante_s2 and tabela[1]["posicao"] == 2

    # Consulta pública de mata-mata
    resp_pub_mm = client.get(f"/publico/competicoes/{id_comp}/classificacao-equipes")
    assert resp_pub_mm.status_code == 200
    pub_data = resp_pub_mm.json()
    assert pub_data["campeao"]["id_equipe"] == mandante_s1
    assert pub_data["vice_campeao"]["id_equipe"] == visitante_s2


# ============================================================================
# FLUXO C: Modalidade Individual (Natação / Atletismo)
# ============================================================================

def test_e2e_fluxo_completo_modalidade_individual(client, db):
    """Fluxo completo de esporte individual:

    Criação em INDIVIDUAL (formato TABELA_UNICA, critério TEMPO) -> Iniciação ->
    Inscrição de atletas com número de peito (prevenção de duplicidade) ->
    Criação de provas (50m Livre e 100m Costas) ->
    Validação de tempo_ms > 0 e lançamento com atleta DSQ ->
    Classificação da prova por menor tempo, pódio e DSQ sem colocação ->
    Quadro geral consolidado de medalhas -> Consulta pública com estrita privacidade.
    """
    ctx = _seed_base_users_and_resources(db)
    coord_hdr = _auth_headers(ctx["coord"].username)
    prof_hdr = _auth_headers(ctx["prof"].username)

    # Evento e Edição
    ev = client.post("/eventos/", json={"even_nome": "Jogos Aquáticos de Primavera"}, headers=coord_hdr).json()
    ed = client.post(
        "/edicoes/",
        json={
            "id_evento": ev["id_evento"],
            "edic_ano": 2026,
            "tipo_competicao": "Pontos Corridos",
            "data_inicio": "2026-11-01",
            "data_fim": "2026-11-30",
        },
        headers=coord_hdr,
    ).json()

    # 1. Criação de Competição em modo INDIVIDUAL (formato TABELA_UNICA, critério TEMPO)
    resp_comp = client.post(
        f"/edicoes/{ed['id_edicao']}/competicoes",
        json={
            "id_modalidade": ctx["mod_natacao"].id_modalidade,
            "nome": "Torneio Estadual de Natação",
            "categoria": "Juvenil",
            "modo_inscricao": "INDIVIDUAL",
            "formato": "TABELA_UNICA",
            "criterio_resultado": "TEMPO",
            "data_inicio": "2026-11-05",
            "data_fim": "2026-11-25",
        },
        headers=coord_hdr,
    )
    assert resp_comp.status_code == 201, resp_comp.text
    id_comp = resp_comp.json()["id_competicao"]
    assert resp_comp.json()["status"] == "RASCUNHO"

    # 2. Iniciar a competição
    resp_iniciar = client.post(f"/competicoes/{id_comp}/iniciar", headers=coord_hdr)
    assert resp_iniciar.status_code == 200
    assert resp_iniciar.json()["status"] == "EM_ANDAMENTO"

    # 3. Criação de 4 participantes/atletas com documentos confidenciais
    part_ids = []
    nomes = ["Alice Nadadora", "Bruno Nadador", "Clara Nadadora", "Diego Desqualificado"]
    docs = ["000.111.222-33", "111.222.333-44", "222.333.444-55", "333.444.555-66"]
    tels = ["(11) 97777-0001", "(11) 97777-0002", "(11) 97777-0003", "(11) 97777-0004"]

    for i in range(4):
        p = models.Participante(tipo="atleta")
        db.add(p)
        db.flush()
        atleta = models.Atleta(
            id_participante=p.id_participante,
            nome_completo=nomes[i],
            data_nascimento=date(2008, i + 1, 10),
            documento_pessoal=docs[i],
            contato=tels[i],
            endereco=f"Rua das Piscinas, {i * 50 + 10}",
        )
        db.add(atleta)
        part_ids.append(p.id_participante)
    db.commit()

    p_alice, p_bruno, p_clara, p_diego = part_ids

    # 4. Inscrição individual com número de peito
    r_ins1 = client.post(f"/competicoes/{id_comp}/inscricoes", json={"id_participante": p_alice, "numero_peito": 101}, headers=coord_hdr)
    r_ins2 = client.post(f"/competicoes/{id_comp}/inscricoes", json={"id_participante": p_bruno, "numero_peito": 102}, headers=coord_hdr)
    r_ins3 = client.post(f"/competicoes/{id_comp}/inscricoes", json={"id_participante": p_clara, "numero_peito": 103}, headers=coord_hdr)
    r_ins4 = client.post(f"/competicoes/{id_comp}/inscricoes", json={"id_participante": p_diego, "numero_peito": 104}, headers=coord_hdr)
    assert r_ins1.status_code == 201
    assert r_ins2.status_code == 201
    assert r_ins3.status_code == 201
    assert r_ins4.status_code == 201

    # Verificação de prevenção de duplicatas (HTTP 422)
    r_ins_dupl = client.post(f"/competicoes/{id_comp}/inscricoes", json={"id_participante": p_alice, "numero_peito": 999}, headers=coord_hdr)
    assert r_ins_dupl.status_code == 422

    # 5. Criação de provas individuais vinculadas
    r_prv1 = client.post(
        f"/competicoes/{id_comp}/provas",
        json={
            "nome": "50m Livre Masculino e Feminino",
            "data": "2026-11-10",
            "hora": "09:00:00",
            "id_local": ctx["local_piscina"].id_local,
            "status": "Agendada",
        },
        headers=coord_hdr,
    )
    assert r_prv1.status_code == 201
    id_prova1 = r_prv1.json()["id_prova"]

    r_prv2 = client.post(
        f"/competicoes/{id_comp}/provas",
        json={
            "nome": "100m Costas",
            "data": "2026-11-11",
            "hora": "10:30:00",
            "id_local": ctx["local_piscina"].id_local,
            "status": "Agendada",
        },
        headers=coord_hdr,
    )
    assert r_prv2.status_code == 201
    id_prova2 = r_prv2.json()["id_prova"]

    # 6. Validação de tempo positivo (<= 0 deve falhar com 422)
    assert client.post(
        f"/provas/{id_prova1}/resultados",
        json={"id_participante": p_alice, "tempo_ms": 0},
        headers=coord_hdr,
    ).status_code == 422

    assert client.post(
        f"/provas/{id_prova1}/resultados",
        json={"id_participante": p_alice, "tempo_ms": -100},
        headers=coord_hdr,
    ).status_code == 422

    # 7. Lançamento de resultados oficiais na Prova 1 (50m Livre)
    # Bruno: 24.100s (Ouro)
    # Alice: 25.500s (Prata)
    # Clara: 26.800s (Bronze)
    # Diego: 23.900s com Desqualificação (DSQ - Queimou a largada)
    assert client.post(f"/provas/{id_prova1}/resultados", json={"id_participante": p_bruno, "tempo_ms": 24100}, headers=coord_hdr).status_code == 201
    assert client.post(f"/provas/{id_prova1}/resultados", json={"id_participante": p_alice, "tempo_ms": 25500}, headers=coord_hdr).status_code == 201
    assert client.post(f"/provas/{id_prova1}/resultados", json={"id_participante": p_clara, "tempo_ms": 26800}, headers=coord_hdr).status_code == 201
    assert client.post(
        f"/provas/{id_prova1}/resultados",
        json={
            "id_participante": p_diego,
            "tempo_ms": 23900,
            "desqualificado": True,
            "motivo_desqualificacao": "Queima de largada (falsa largada)",
        },
        headers=coord_hdr,
    ).status_code == 201

    # Finalizar Prova 1
    client.put(f"/provas/{id_prova1}", json={"status": "Finalizada"}, headers=coord_hdr)

    # 8. Lançamento de resultados oficiais na Prova 2 (100m Costas)
    # Alice: 58.200s (Ouro)
    # Clara: 59.100s (Prata)
    # Bruno: 61.000s (Bronze)
    assert client.post(f"/provas/{id_prova2}/resultados", json={"id_participante": p_alice, "tempo_ms": 58200}, headers=coord_hdr).status_code == 201
    assert client.post(f"/provas/{id_prova2}/resultados", json={"id_participante": p_clara, "tempo_ms": 59100}, headers=coord_hdr).status_code == 201
    assert client.post(f"/provas/{id_prova2}/resultados", json={"id_participante": p_bruno, "tempo_ms": 61000}, headers=coord_hdr).status_code == 201
    client.put(f"/provas/{id_prova2}", json={"status": "Finalizada"}, headers=coord_hdr)

    # 9. Consulta da classificação da Prova 1:
    # Menor tempo em 1º lugar, pódio destacado e DSQ no final sem posição
    resp_classif_p1 = client.get(f"/provas/{id_prova1}/classificacao", headers=prof_hdr)
    assert resp_classif_p1.status_code == 200
    dados_p1 = resp_classif_p1.json()
    assert dados_p1["podio"]["ouro"]["id_participante"] == p_bruno
    assert dados_p1["podio"]["prata"]["id_participante"] == p_alice
    assert dados_p1["podio"]["bronze"]["id_participante"] == p_clara

    lista_p1 = dados_p1["classificacao"]
    assert len(lista_p1) == 4
    # Posições 1, 2, 3 ordenadas pelo tempo
    assert lista_p1[0]["id_participante"] == p_bruno and lista_p1[0]["posicao"] == 1
    assert lista_p1[1]["id_participante"] == p_alice and lista_p1[1]["posicao"] == 2
    assert lista_p1[2]["id_participante"] == p_clara and lista_p1[2]["posicao"] == 3
    # Atleta DSQ fica ao final e sem posição numérica regular
    assert lista_p1[3]["id_participante"] == p_diego
    assert lista_p1[3]["desqualificado"] is True
    assert lista_p1[3]["posicao"] is None
    assert lista_p1[3]["motivo_desqualificacao"] == "Queima de largada (falsa largada)"

    # 10. Consulta do quadro geral consolidado de medalhas da competição
    resp_medalhas = client.get(f"/competicoes/{id_comp}/classificacao-individual", headers=prof_hdr)
    assert resp_medalhas.status_code == 200, resp_medalhas.text
    dados_med = resp_medalhas.json()
    quadro = dados_med["quadro_medalhas"]
    assert len(quadro) == 4

    # Alice tem 1 Ouro (100m Costas) e 1 Prata (50m Livre) -> total 2 medalhas
    # Bruno tem 1 Ouro (50m Livre) e 1 Bronze (100m Costas) -> total 2 medalhas
    # Clara tem 1 Prata e 1 Bronze -> total 2 medalhas
    # Diego tem 0 medalhas
    med_por_id = {item["id_participante"]: item for item in quadro}
    assert med_por_id[p_alice]["ouros"] == 1
    assert med_por_id[p_alice]["pratas"] == 1
    assert med_por_id[p_bruno]["ouros"] == 1
    assert med_por_id[p_bruno]["bronzes"] == 1
    assert med_por_id[p_clara]["ouros"] == 0
    assert med_por_id[p_clara]["pratas"] == 1
    assert med_por_id[p_clara]["bronzes"] == 1
    assert med_por_id[p_diego]["total_medalhas"] == 0

    # 11. Consulta pública correspondente (estrita segurança e privacidade)
    # 11a. Inscrições públicas
    resp_pub_insc = client.get(f"/publico/competicoes/{id_comp}/inscricoes")
    assert resp_pub_insc.status_code == 200
    inscricoes_pub = resp_pub_insc.json()
    assert len(inscricoes_pub) == 4
    texto_pub_insc = resp_pub_insc.text
    # Ausência de CPF, telefone e endereço
    for doc in docs:
        assert doc not in texto_pub_insc
    for tel in tels:
        assert tel not in texto_pub_insc
    assert "Rua das Piscinas" not in texto_pub_insc
    assert "documento_pessoal" not in texto_pub_insc

    # 11b. Classificação de prova pública
    resp_pub_p1 = client.get(f"/publico/provas/{id_prova1}/classificacao")
    assert resp_pub_p1.status_code == 200
    pub_p1_data = resp_pub_p1.json()
    assert pub_p1_data["podio"]["ouro"]["nome_participante"] == "Bruno Nadador"
    assert pub_p1_data["podio"]["prata"]["nome_participante"] == "Alice Nadadora"
    assert pub_p1_data["podio"]["bronze"]["nome_participante"] == "Clara Nadadora"
    # DSQ está sem posição e no fim
    assert pub_p1_data["classificacao"][-1]["desqualificado"] is True
    assert pub_p1_data["classificacao"][-1]["posicao"] is None
    assert "Queima de largada" in pub_p1_data["classificacao"][-1]["motivo_desqualificacao"]

    # 11c. Quadro de medalhas público
    resp_pub_med = client.get(f"/publico/competicoes/{id_comp}/classificacao-individual")
    assert resp_pub_med.status_code == 200
    assert len(resp_pub_med.json()["quadro_medalhas"]) == 4


# ============================================================================
# FLUXO D: Isolamento de Modos Cruzados
# ============================================================================

def test_e2e_isolamento_modos_cruzados(client, db):
    """Garante isolamento hermético entre modos EQUIPE e INDIVIDUAL.

    - Endpoints de equipes chamados para competição INDIVIDUAL devem retornar HTTP 422.
    - Endpoints de individuais chamados para competição de EQUIPES devem retornar HTTP 422.
    """
    ctx = _seed_base_users_and_resources(db)
    admin_hdr = _auth_headers(ctx["admin"].username)
    prof_hdr = _auth_headers(ctx["prof"].username)

    # Evento e Edição
    ev = client.post("/eventos/", json={"even_nome": "Jogos de Isolamento"}, headers=admin_hdr).json()
    ed = client.post(
        "/edicoes/",
        json={
            "id_evento": ev["id_evento"],
            "edic_ano": 2026,
            "tipo_competicao": "Pontos Corridos",
            "data_inicio": "2026-12-01",
            "data_fim": "2026-12-31",
        },
        headers=admin_hdr,
    ).json()

    # Competição EQUIPE
    comp_eq = client.post(
        f"/edicoes/{ed['id_edicao']}/competicoes",
        json={
            "id_modalidade": ctx["mod_futsal"].id_modalidade,
            "nome": "Futsal Puro",
            "categoria": "Livre",
            "modo_inscricao": "EQUIPE",
            "formato": "PONTOS_CORRIDOS",
            "criterio_resultado": "PLACAR",
            "data_inicio": "2026-12-01",
            "data_fim": "2026-12-31",
        },
        headers=admin_hdr,
    ).json()
    id_eq = comp_eq["id_competicao"]
    client.post(f"/competicoes/{id_eq}/iniciar", headers=admin_hdr)

    # Competição INDIVIDUAL
    comp_ind = client.post(
        f"/edicoes/{ed['id_edicao']}/competicoes",
        json={
            "id_modalidade": ctx["mod_natacao"].id_modalidade,
            "nome": "Natação Pura",
            "categoria": "Livre",
            "modo_inscricao": "INDIVIDUAL",
            "formato": "PROVAS",
            "criterio_resultado": "TEMPO",
            "data_inicio": "2026-12-01",
            "data_fim": "2026-12-31",
        },
        headers=admin_hdr,
    ).json()
    id_ind = comp_ind["id_competicao"]
    client.post(f"/competicoes/{id_ind}/iniciar", headers=admin_hdr)

    # Participante para testes de mutação
    p = models.Participante(tipo="atleta")
    db.add(p)
    db.commit()

    # ------------------------------------------------------------------------
    # 1. Chamadas de EQUIPES para a competição INDIVIDUAL -> DEVE RETORNAR 422
    # ------------------------------------------------------------------------
    # 1a. POST /competicoes/{id}/equipes
    assert client.post(f"/competicoes/{id_ind}/equipes", json={"nome": "Time Invalido"}, headers=admin_hdr).status_code == 422

    # 1b. GET /competicoes/{id}/equipes
    assert client.get(f"/competicoes/{id_ind}/equipes", headers=prof_hdr).status_code == 422

    # 1c. POST /competicoes/{id}/confrontos
    assert client.post(
        f"/competicoes/{id_ind}/confrontos",
        json={"data": "2026-12-10", "hora": "14:00:00", "id_local": ctx["local_ginasio"].id_local, "id_arbitro": ctx["arbitro_futsal"].id_arbitro},
        headers=admin_hdr,
    ).status_code == 422

    # 1d. GET /competicoes/{id}/confrontos
    assert client.get(f"/competicoes/{id_ind}/confrontos", headers=prof_hdr).status_code == 422

    # 1e. POST /competicoes/{id}/gerar-confrontos
    assert client.post(f"/competicoes/{id_ind}/gerar-confrontos", headers=admin_hdr).status_code == 422

    # 1f. GET /competicoes/{id}/classificacao-equipes
    assert client.get(f"/competicoes/{id_ind}/classificacao-equipes", headers=prof_hdr).status_code == 422

    # 1g. GET /publico/competicoes/{id}/equipes
    assert client.get(f"/publico/competicoes/{id_ind}/equipes").status_code == 422

    # 1h. GET /publico/competicoes/{id}/confrontos
    assert client.get(f"/publico/competicoes/{id_ind}/confrontos").status_code == 422

    # 1i. GET /publico/competicoes/{id}/classificacao-equipes
    assert client.get(f"/publico/competicoes/{id_ind}/classificacao-equipes").status_code == 422

    # ------------------------------------------------------------------------
    # 2. Chamadas INDIVIDUAIS para a competição de EQUIPES -> DEVE RETORNAR 422
    # ------------------------------------------------------------------------
    # 2a. POST /competicoes/{id}/inscricoes
    assert client.post(
        f"/competicoes/{id_eq}/inscricoes",
        json={"id_participante": p.id_participante, "numero_peito": 10},
        headers=admin_hdr,
    ).status_code == 422

    # 2b. GET /competicoes/{id}/inscricoes
    assert client.get(f"/competicoes/{id_eq}/inscricoes", headers=prof_hdr).status_code == 422

    # 2c. POST /competicoes/{id}/provas
    assert client.post(
        f"/competicoes/{id_eq}/provas",
        json={"nome": "Prova Impossivel"},
        headers=admin_hdr,
    ).status_code == 422

    # 2d. GET /competicoes/{id}/provas
    assert client.get(f"/competicoes/{id_eq}/provas", headers=prof_hdr).status_code == 422

    # 2e. GET /competicoes/{id}/classificacao-individual
    assert client.get(f"/competicoes/{id_eq}/classificacao-individual", headers=prof_hdr).status_code == 422

    # 2f. GET /publico/competicoes/{id}/inscricoes
    assert client.get(f"/publico/competicoes/{id_eq}/inscricoes").status_code == 422

    # 2g. GET /publico/competicoes/{id}/provas
    assert client.get(f"/publico/competicoes/{id_eq}/provas").status_code == 422

    # 2h. GET /publico/competicoes/{id}/classificacao-individual
    assert client.get(f"/publico/competicoes/{id_eq}/classificacao-individual").status_code == 422
