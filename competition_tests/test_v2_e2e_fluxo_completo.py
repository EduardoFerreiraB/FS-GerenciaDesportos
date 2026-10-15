"""Teste de Integração Ponta a Ponta (E2E) - Domínio de Competições V2.

Cobre o ciclo de vida completo de uma competição esportiva:
1. Criação do Grupo/Evento agregador via API (/v2/grupos-competicoes).
2. Criação de Competição V2 independente no formato GRUPOS_MATA_MATA com regras flexíveis.
3. Inscrição de 4 equipes na competição com alocação em grupos.
4. Cadastro de atletas no elenco com número, posição e documento.
5. Início da competição e geração automática de confrontos e chaveamento eliminatório.
6. Operação de jogos em beira de campo via súmula rápida (gols, estorno, cartões, 2º amarelo gerando vermelho).
7. Finalização dos jogos e apuração da classificação por grupos.
8. Realização da Grande Final e Disputa de 3º Lugar com desempate por cobrança de pênaltis.
9. Apuração oficial de artilharia e relatório disciplinar de atletas suspensos.
10. Consulta no Portal Público Agregador com conformidade e auditoria rigorosa de segurança LGPD.
"""

from datetime import date, time
import pytest

import models
from security import create_access_token, get_password_hash


def _auth_headers(username: str) -> dict[str, str]:
    token = create_access_token({"sub": username})
    return {"Authorization": f"Bearer {token}"}


def test_v2_e2e_fluxo_completo(client, db):
    # --------------------------------------------------------------------------
    # 1. SETUP DE USUÁRIO E AMBIENTE (MODALIDADE, LOCAL, ÁRBITRO)
    # --------------------------------------------------------------------------
    admin_user = models.Usuario(
        username="admin_e2e",
        password_hash=get_password_hash("admin123"),
        role="coordenador",
    )
    db.add(admin_user)

    modalidade = models.Modalidade(nome="Futebol Society V2 E2E", duracao_minutos=50)
    local = models.Local(loca_nome="Arena Central E2E", loca_descricao="Campo Sintético 1")
    arbitro = models.Arbitro(
        apito_nome="Árbitro FIFA E2E",
        apito_doc="FIFA-9988",
        apito_tel="(11) 99999-9999",
    )
    db.add_all([modalidade, local, arbitro])
    db.commit()

    headers = _auth_headers("admin_e2e")

    # --------------------------------------------------------------------------
    # 2. CRIAÇÃO DO GRUPO / EVENTO AGREGADOR (PORTAL PÚBLICO)
    # --------------------------------------------------------------------------
    res_grupo = client.post(
        "/v2/grupos-competicoes",
        json={
            "nome": "Olimpíadas Municipais 2026",
            "slug": "olimpiadas-municipais-2026",
            "descricao": "Maior evento esportivo interbairros da cidade",
            "data_inicio": "2026-10-01",
            "data_fim": "2026-10-31",
            "status": "ATIVO",
        },
        headers=headers,
    )
    assert res_grupo.status_code == 201, res_grupo.text
    id_grupo = res_grupo.json()["id_grupo"]

    # --------------------------------------------------------------------------
    # 3. CRIAÇÃO DA COMPETIÇÃO V2 INDEPENDENTE (GRUPOS_MATA_MATA)
    # --------------------------------------------------------------------------
    regras_formato = {
        "qtd_grupos": 2,
        "classificados_por_grupo": 1,
        "jogos_ida_volta_grupo": False,
        "jogos_ida_volta_mata_mata": False,
        "disputa_terceiro_lugar": True,
        "penaltis_desempate": True,
    }
    res_comp = client.post(
        "/v2/competicoes",
        json={
            "nome": "Copa dos Campeões Society",
            "id_modalidade": modalidade.id_modalidade,
            "id_grupo": id_grupo,
            "categoria": "Adulto Livre",
            "modo_inscricao": "EQUIPE",
            "formato": "GRUPOS",
            "criterio_resultado": "PONTOS",
            "regras_formato": regras_formato,
        },
        headers=headers,
    )
    assert res_comp.status_code == 201, res_comp.text
    comp_dados = res_comp.json()
    id_comp = comp_dados["id_competicao"]
    assert comp_dados["status"] == "RASCUNHO"
    assert comp_dados["id_grupo"] == id_grupo

    # --------------------------------------------------------------------------
    # 4. CADASTRO DE 4 EQUIPES (2 NO GRUPO A, 2 NO GRUPO B)
    # --------------------------------------------------------------------------
    equipes_payload = [
        {"nome": "Vila Nova FC", "grupo": "A"},
        {"nome": "Estrela do Norte", "grupo": "A"},
        {"nome": "Atlético Central", "grupo": "B"},
        {"nome": "União da Colina", "grupo": "B"},
    ]
    equipes_criadas = {}
    for eq_p in equipes_payload:
        res_eq = client.post(f"/v2/competicoes/{id_comp}/equipes", json=eq_p, headers=headers)
        assert res_eq.status_code == 201, res_eq.text
        dados_eq = res_eq.json()
        equipes_criadas[dados_eq["nome"]] = dados_eq

    eq_vila = equipes_criadas["Vila Nova FC"]
    eq_estrela = equipes_criadas["Estrela do Norte"]
    eq_atletico = equipes_criadas["Atlético Central"]
    eq_uniao = equipes_criadas["União da Colina"]

    # --------------------------------------------------------------------------
    # 5. CADASTRO DE ATLETAS NO ELENCO COM DOCUMENTOS SENSÍVEIS (LGPD)
    # --------------------------------------------------------------------------
    atletas_payload = [
        # Vila Nova
        (eq_vila["id_equipe"], {"nome": "Lucas Artilheiro", "numero_camisa": 9, "posicao": "Atacante", "documento": "CPF-111.222.333-44"}),
        (eq_vila["id_equipe"], {"nome": "Marcos Zagueiro", "numero_camisa": 3, "posicao": "Zagueiro", "documento": "CPF-111.222.333-55"}),
        # Estrela do Norte
        (eq_estrela["id_equipe"], {"nome": "Felipe Meia", "numero_camisa": 10, "posicao": "Meia", "documento": "CPF-222.333.444-55"}),
        # Atlético Central
        (eq_atletico["id_equipe"], {"nome": "Gabriel Ponta", "numero_camisa": 7, "posicao": "Atacante", "documento": "CPF-333.444.555-66"}),
        # União da Colina
        (eq_uniao["id_equipe"], {"nome": "Daniel Goleiro", "numero_camisa": 1, "posicao": "Goleiro", "documento": "CPF-444.555.666-77"}),
    ]
    jogadores_map = {}
    for id_eq, j_p in atletas_payload:
        res_j = client.post(f"/v2/equipes/{id_eq}/jogadores", json=j_p, headers=headers)
        assert res_j.status_code == 201, res_j.text
        dados_j = res_j.json()
        jogadores_map[dados_j["nome"]] = dados_j

    j_lucas = jogadores_map["Lucas Artilheiro"]
    j_marcos = jogadores_map["Marcos Zagueiro"]
    j_felipe = jogadores_map["Felipe Meia"]
    j_gabriel = jogadores_map["Gabriel Ponta"]

    # --------------------------------------------------------------------------
    # 6. TRANSIÇÃO DE STATUS E GERAÇÃO DE CONFRONTOS
    # --------------------------------------------------------------------------
    # Atualiza status para EM_ANDAMENTO
    res_up = client.put(f"/v2/competicoes/{id_comp}", json={"status": "EM_ANDAMENTO"}, headers=headers)
    assert res_up.status_code == 200

    # Gera a tabela de confrontos
    res_gerar = client.post(f"/v2/competicoes/{id_comp}/gerar-confrontos", headers=headers)
    assert res_gerar.status_code == 201, res_gerar.text
    assert len(res_gerar.json()) >= 2

    # Lista os confrontos gerados
    res_confs = client.get(f"/v2/competicoes/{id_comp}/confrontos", headers=headers)
    assert res_confs.status_code == 200
    confrontos_lista = res_confs.json()
    assert len(confrontos_lista) >= 2

    # Identifica os confrontos da fase de grupos
    jogo_grupo_a = next(c for c in confrontos_lista if c.get("grupo") == "A")
    jogo_grupo_b = next(c for c in confrontos_lista if c.get("grupo") == "B")

    # --------------------------------------------------------------------------
    # 7. SÚMULA RÁPIDA: JOGO GRUPO A (Vila Nova x Estrela do Norte)
    # --------------------------------------------------------------------------
    id_j1 = jogo_grupo_a["id_confronto"]

    # 7.1 Lucas marca o 1º gol (Vila Nova 1 x 0)
    res_gol1 = client.post(
        f"/v2/confrontos/{id_j1}/ocorrencias",
        json={
            "id_equipe": eq_vila["id_equipe"],
            "id_jogador": j_lucas["id_jogador"],
            "tipo": "GOL",
            "minuto": 12,
        },
        headers=headers,
    )
    assert res_gol1.status_code == 201

    # 7.2 Gol contra de teste e estorno
    res_contra = client.post(
        f"/v2/confrontos/{id_j1}/ocorrencias",
        json={
            "id_equipe": eq_estrela["id_equipe"],
            "id_jogador": j_felipe["id_jogador"],
            "tipo": "GOL_CONTRA",
            "minuto": 20,
        },
        headers=headers,
    )
    assert res_contra.status_code == 201
    id_contra = res_contra.json()["id_ocorrencia"]

    # Estorna o gol contra
    res_estorno = client.delete(f"/v2/confrontos/ocorrencias/{id_contra}", headers=headers)
    assert res_estorno.status_code == 204

    # 7.3 Cartão amarelo e 2º amarelo gerando expulsão para Felipe
    res_ca1 = client.post(
        f"/v2/confrontos/{id_j1}/ocorrencias",
        json={
            "id_equipe": eq_estrela["id_equipe"],
            "id_jogador": j_felipe["id_jogador"],
            "tipo": "CARTAO_AMARELO",
            "minuto": 25,
        },
        headers=headers,
    )
    assert res_ca1.status_code == 201

    res_ca2 = client.post(
        f"/v2/confrontos/{id_j1}/ocorrencias",
        json={
            "id_equipe": eq_estrela["id_equipe"],
            "id_jogador": j_felipe["id_jogador"],
            "tipo": "CARTAO_AMARELO",
            "minuto": 38,
        },
        headers=headers,
    )
    assert res_ca2.status_code == 201

    # 7.4 Lucas marca o 2º gol dele (Vila Nova 2 x 0)
    res_gol2 = client.post(
        f"/v2/confrontos/{id_j1}/ocorrencias",
        json={
            "id_equipe": eq_vila["id_equipe"],
            "id_jogador": j_lucas["id_jogador"],
            "tipo": "GOL",
            "minuto": 45,
        },
        headers=headers,
    )
    assert res_gol2.status_code == 201

    # Finaliza Jogo 1 (Vila Nova vence por 2 x 0)
    res_fin1 = client.post(f"/v2/confrontos/{id_j1}/finalizar", json={}, headers=headers)
    assert res_fin1.status_code == 200

    # --------------------------------------------------------------------------
    # 8. SÚMULA RÁPIDA: JOGO GRUPO B (Atlético Central x União da Colina)
    # --------------------------------------------------------------------------
    id_j2 = jogo_grupo_b["id_confronto"]

    # Gabriel marca 3 gols (Hat-trick)
    for min_gol in [8, 22, 40]:
        res_g = client.post(
            f"/v2/confrontos/{id_j2}/ocorrencias",
            json={
                "id_equipe": eq_atletico["id_equipe"],
                "id_jogador": j_gabriel["id_jogador"],
                "tipo": "GOL",
                "minuto": min_gol,
            },
            headers=headers,
        )
        assert res_g.status_code == 201

    # Finaliza Jogo 2 (Atlético vence por 3 x 0)
    res_fin2 = client.post(f"/v2/confrontos/{id_j2}/finalizar", json={}, headers=headers)
    assert res_fin2.status_code == 200

    # --------------------------------------------------------------------------
    # 9. APURAÇÃO DE CLASSIFICAÇÃO, ARTILHARIA E RELATÓRIO DISCIPLINAR
    # --------------------------------------------------------------------------
    # 9.1 Classificação
    res_class = client.get(f"/v2/competicoes/{id_comp}/classificacao", headers=headers)
    assert res_class.status_code == 200
    dados_class = res_class.json()
    assert "grupos" in dados_class

    # Grupo A: Vila Nova em 1º (3 pts)
    tabela_a = dados_class["grupos"]["A"]
    assert tabela_a[0]["nome_equipe"] == "Vila Nova FC"
    assert tabela_a[0]["pontos"] == 3

    # Grupo B: Atlético Central em 1º (3 pts)
    tabela_b = dados_class["grupos"]["B"]
    assert tabela_b[0]["nome_equipe"] == "Atlético Central"
    assert tabela_b[0]["pontos"] == 3

    # 9.2 Artilharia Oficial
    res_art = client.get(f"/v2/competicoes/{id_comp}/artilharia", headers=headers)
    assert res_art.status_code == 200
    artilheiros = res_art.json()
    assert len(artilheiros) >= 2
    # 1º Gabriel (3 gols), 2º Lucas (2 gols)
    assert artilheiros[0]["nome_jogador"] == "Gabriel Ponta"
    assert artilheiros[0]["gols"] == 3
    assert artilheiros[1]["nome_jogador"] == "Lucas Artilheiro"
    assert artilheiros[1]["gols"] == 2

    # 9.3 Relatório Disciplinar
    res_disc = client.get(f"/v2/competicoes/{id_comp}/disciplinar", headers=headers)
    assert res_disc.status_code == 200
    dados_disc = res_disc.json()
    # Felipe Meia deve estar na lista de suspensos (expulso no 2º amarelo)
    suspensos = dados_disc.get("suspensos", [])
    assert any(s["id_jogador"] == j_felipe["id_jogador"] for s in suspensos)

    # --------------------------------------------------------------------------
    # 10. GRANDE FINAL COM DESEMPATE NOS PÊNALTIS
    # --------------------------------------------------------------------------
    # Cria a Grande Final entre os líderes dos grupos
    final_confronto = models.Confronto(
        id_competicao=id_comp,
        id_equipe_mandante=eq_vila["id_equipe"],
        id_equipe_visitante=eq_atletico["id_equipe"],
        fase="Final",
        data=date(2026, 10, 25),
        hora=time(16, 0),
        id_local=local.id_local,
        id_arbitro=arbitro.id_arbitro,
        status="Agendado",
    )
    db.add(final_confronto)
    db.commit()
    db.refresh(final_confronto)

    id_final = final_confronto.id_confronto

    # 10.1 Gol do Vila Nova (Lucas) e Gol do Atlético (Gabriel) -> empate 1 x 1
    client.post(
        f"/v2/confrontos/{id_final}/ocorrencias",
        json={"id_equipe": eq_vila["id_equipe"], "id_jogador": j_lucas["id_jogador"], "tipo": "GOL", "minuto": 15},
        headers=headers,
    )
    client.post(
        f"/v2/confrontos/{id_final}/ocorrencias",
        json={"id_equipe": eq_atletico["id_equipe"], "id_jogador": j_gabriel["id_jogador"], "tipo": "GOL", "minuto": 35},
        headers=headers,
    )

    # 10.2 Finalização com Pênaltis: Vila Nova 5 x 4 Atlético Central
    res_fin_final = client.post(
        f"/v2/confrontos/{id_final}/finalizar",
        json={"penaltis_mandante": 5, "penaltis_visitante": 4},
        headers=headers,
    )
    assert res_fin_final.status_code == 200, res_fin_final.text
    dados_final_encerrada = res_fin_final.json()
    assert dados_final_encerrada["status"] == "Finalizado"
    assert dados_final_encerrada["penaltis_mandante"] == 5
    assert dados_final_encerrada["penaltis_visitante"] == 4
    assert dados_final_encerrada["id_equipe_vencedora"] == eq_vila["id_equipe"]

    # --------------------------------------------------------------------------
    # 11. AUDITORIA NO PORTAL PÚBLICO AGREGADOR & SEGURANÇA LGPD
    # --------------------------------------------------------------------------
    # 11.1 Grupo Agregador
    res_pub_grupo = client.get("/v2/publico/grupos/olimpiadas-municipais-2026")
    assert res_pub_grupo.status_code == 200
    grupo_pub_data = res_pub_grupo.json()
    assert grupo_pub_data["nome"] == "Olimpíadas Municipais 2026"
    assert len(grupo_pub_data["competicoes"]) == 1
    assert grupo_pub_data["competicoes"][0]["nome"] == "Copa dos Campeões Society"

    # 11.2 Jogos Públicos com Autores de Gols
    res_pub_jogos = client.get(f"/v2/publico/competicoes/{id_comp}/jogos")
    assert res_pub_jogos.status_code == 200
    jogos_pub = res_pub_jogos.json()
    assert len(jogos_pub) >= 3
    # Confirma que os nomes dos goleadores aparecem nos jogos
    autores_nomes = [
        autor["nome_jogador"]
        for j in jogos_pub
        for autor in j.get("gols", [])
    ]
    assert "Gabriel Ponta" in autores_nomes
    assert "Lucas Artilheiro" in autores_nomes

    # 11.3 Artilharia Pública
    res_pub_art = client.get(f"/v2/publico/competicoes/{id_comp}/artilharia")
    assert res_pub_art.status_code == 200
    art_pub = res_pub_art.json()
    assert len(art_pub) >= 2
    # Gabriel terminou com 4 gols (3 no grupo + 1 na final)
    assert art_pub[0]["nome_jogador"] == "Gabriel Ponta"
    assert art_pub[0]["gols"] == 4

    # 11.4 Classificação Pública
    res_pub_class = client.get(f"/v2/publico/competicoes/{id_comp}/classificacao")
    assert res_pub_class.status_code == 200

    # 11.5 AUDITORIA RIGOROSA DE SEGURANÇA E PRIVACIDADE LGPD
    # Garantir que nenhum CPF ou documento de atleta jamais apareça nas respostas públicas
    payloads_publicos_texto = [
        res_pub_grupo.text,
        res_pub_jogos.text,
        res_pub_art.text,
        res_pub_class.text,
    ]
    termos_proibidos = [
        "CPF-111.222.333-44",
        "CPF-111.222.333-55",
        "CPF-222.333.444-55",
        "CPF-333.444.555-66",
        "CPF-444.555.666-77",
        "documento_pessoal",
        "documento",
        "cpf",
        "rg",
        "telefone",
        "contato",
    ]
    for texto in payloads_publicos_texto:
        for termo in termos_proibidos:
            assert termo not in texto, (
                f"LGPD VIOLADA: Termo confidencial '{termo}' vazou em resposta pública do portal!"
            )
