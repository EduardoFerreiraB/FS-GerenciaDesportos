"""Teste de integração ponta a ponta (E2E) da Fatia 3.

Cobre os requisitos de negócio consolidados:
1. Súmula detalhada (Gol com autor, Gol Contra somando para adversário, 2º amarelo derivando expulsão sem acumular).
2. Artilharia oficial (exclui gol contra, contabiliza gols válidos).
3. Painel disciplinar e cumprimento de suspensões em partida posterior.
4. Mata-mata com pênaltis e travas de reabertura transitiva no grafo (409 quando jogo descendente iniciou).
5. Desempate manual auditado na fase de grupos com hash de integridade e avanço para mata-mata.
6. Ciclo de vida da edição (finalizar, reabrir e reabrir grupos com justificativa).
"""

import uuid
from datetime import date, datetime
import pytest
from models import Modalidade


def _obter_ou_criar_modalidade(db):
    mod = db.query(Modalidade).first()
    if not mod:
        mod = Modalidade(nome="Futebol E2E Fatia 3")
        db.add(mod)
        db.commit()
        db.refresh(mod)
    return mod.id_modalidade


def test_fluxo_completo_fatia3_sumula_disciplina_artilharia(client, cabecalhos_por_papel, db):
    """Fluxo ponta a ponta de súmula detalhada, artilharia, suspensões e cumprimento."""
    headers_coord = cabecalhos_por_papel("coordenador")
    headers_prof = cabecalhos_por_papel("professor")
    id_modalidade = _obter_ou_criar_modalidade(db)

    # 1. Cria competição em pontos corridos (4 equipes)
    res_comp = client.post(
        "/competicoes/competicoes",
        headers=headers_coord,
        json={
            "nome": "Campeonato Súmula e Disciplina E2E",
            "id_modalidade": id_modalidade,
            "edicao": {
                "identificacao": "2026-F3",
                "data_inicio": "2026-08-01",
                "data_fim": "2026-08-31",
                "formato": "PONTOS_CORRIDOS",
                "configuracao": {
                    "formato": "PONTOS_CORRIDOS",
                    "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                    "desempates": ["SALDO_GOLS", "VITORIAS"],
                    "turno_e_returno": False,
                },
            },
        },
    )
    assert res_comp.status_code == 201
    id_edicao = res_comp.json()["edicoes"][0]["id_edicao_competicao"]

    # 2. Cadastra 4 equipes e atletas
    ids_equipes = []
    ids_integrantes = {}
    for i in range(1, 5):
        res_eq = client.post(
            f"/competicoes/edicoes/{id_edicao}/equipes",
            headers=headers_coord,
            json={"nome": f"Equipe {i}", "sigla": f"EQ{i}"},
        )
        assert res_eq.status_code == 201
        id_eq = res_eq.json()["id_equipe"]
        ids_equipes.append(id_eq)

        # Cadastra 2 atletas por equipe
        ids_integrantes[id_eq] = []
        for j in range(1, 3):
            res_comp_ind = client.post(
                "/competicoes/competidores",
                headers=headers_coord,
                json={"nome": f"Jogador {i}-{j}"},
            )
            assert res_comp_ind.status_code == 201
            id_competidor = res_comp_ind.json()["id_competidor"]

            res_ins = client.post(
                f"/competicoes/equipes/{id_eq}/integrantes",
                headers=headers_coord,
                json={
                    "id_competidor": id_competidor,
                    "nome_esportivo": f"Atleta {i}-{j}",
                    "numero_camisa": 10 * j,
                },
            )
            assert res_ins.status_code == 201
            ids_integrantes[id_eq].append(res_ins.json()["id_integrante"])

    # 3. Gerar tabela
    res_gerar = client.post(
        f"/competicoes/edicoes/{id_edicao}/gerar-tabela",
        headers=headers_coord,
        json={},
    )
    assert res_gerar.status_code == 201

    # Obter partidas
    res_partidas = client.get(
        f"/competicoes/edicoes/{id_edicao}/partidas",
        headers=headers_prof,
    )
    assert res_partidas.status_code == 200
    partidas = res_partidas.json()
    assert len(partidas) == 6

    # Partidas da Equipe 2 ordenadas estritamente por rodada e id_partida
    partidas_eq2 = [
        p for p in partidas
        if p["id_equipe_mandante"] == ids_equipes[1] or p["id_equipe_visitante"] == ids_equipes[1]
    ]
    partidas_eq2.sort(key=lambda p: (p.get("rodada") or 1, p["id_partida"]))
    p1 = partidas_eq2[0]
    id_p1 = p1["id_partida"]
    eq_mandante_p1 = p1["id_equipe_mandante"]
    eq_visitante_p1 = p1["id_equipe_visitante"]
    atleta_mandante = ids_integrantes[eq_mandante_p1][0]
    atleta_visitante = ids_integrantes[eq_visitante_p1][0]

    # Iniciar partida
    res_ini = client.post(f"/competicoes/partidas/{id_p1}/iniciar", headers=headers_coord)
    assert res_ini.status_code in (200, 201)

    # 4. Registrar Ocorrências na Súmula da Partida 1:
    # A) GOL normal com autor para a equipe mandante
    res_gol = client.post(
        f"/competicoes/partidas/{id_p1}/ocorrencias",
        headers=headers_coord,
        json={
            "tipo": "GOL",
            "id_equipe": eq_mandante_p1,
            "id_integrante": atleta_mandante,
            "minuto": 15,
            "periodo": "1º Tempo",
        },
    )
    assert res_gol.status_code == 201

    # B) GOL_CONTRA pelo atleta mandante (beneficia a equipe visitante!)
    res_gc = client.post(
        f"/competicoes/partidas/{id_p1}/ocorrencias",
        headers=headers_coord,
        json={
            "tipo": "GOL_CONTRA",
            "id_equipe": eq_mandante_p1,
            "id_integrante": atleta_mandante,
            "minuto": 30,
            "periodo": "1º Tempo",
        },
    )
    assert res_gc.status_code == 201
    ocorrencias_sumula = res_gc.json()["ocorrencias"]
    assert ocorrencias_sumula[-1]["id_equipe_beneficiada"] == eq_visitante_p1

    # C) 1º Cartão Amarelo para atleta_visitante
    res_am1 = client.post(
        f"/competicoes/partidas/{id_p1}/ocorrencias",
        headers=headers_coord,
        json={
            "tipo": "CARTAO_AMARELO",
            "id_equipe": eq_visitante_p1,
            "id_integrante": atleta_visitante,
            "minuto": 40,
        },
    )
    assert res_am1.status_code == 201

    # D) 2º Cartão Amarelo para atleta_visitante (dispara expulsão automática!)
    res_am2 = client.post(
        f"/competicoes/partidas/{id_p1}/ocorrencias",
        headers=headers_coord,
        json={
            "tipo": "CARTAO_AMARELO",
            "id_equipe": eq_visitante_p1,
            "id_integrante": atleta_visitante,
            "minuto": 70,
        },
    )
    assert res_am2.status_code == 201

    # Obter súmula da Partida 1
    res_sumula = client.get(f"/competicoes/partidas/{id_p1}/sumula", headers=headers_prof)
    assert res_sumula.status_code == 200
    dados_sumula = res_sumula.json()
    assert dados_sumula["partida"]["placar"]["gols_mandante"] == 1
    assert dados_sumula["partida"]["placar"]["gols_visitante"] == 1

    # Confere que existe ocorrência de EXPULSAO_SEGUNDO_AMARELO derivada
    expulsoes = [oc for oc in dados_sumula["ocorrencias"] if oc["tipo"] == "EXPULSAO_SEGUNDO_AMARELO"]
    assert len(expulsoes) == 1
    assert expulsoes[0]["id_integrante"] == atleta_visitante

    # Finalizar Partida 1
    res_fin1 = client.post(f"/competicoes/partidas/{id_p1}/finalizar", headers=headers_coord)
    assert res_fin1.status_code == 200
    assert res_fin1.json()["status"] == "FINALIZADA"

    # 5. Artilharia: confere que apenas GOL normal com autor entra na contagem
    res_art = client.get(f"/competicoes/edicoes/{id_edicao}/artilharia", headers=headers_prof)
    assert res_art.status_code == 200
    artilheiros = res_art.json()["artilheiros"]
    assert len(artilheiros) == 1
    assert artilheiros[0]["id_integrante"] == atleta_mandante
    assert artilheiros[0]["gols"] == 1

    # 6. Painel Disciplinar: confere suspensão gerada por 2º amarelo
    res_disc = client.get(f"/competicoes/edicoes/{id_edicao}/disciplinar", headers=headers_coord)
    assert res_disc.status_code == 200
    disc = res_disc.json()
    assert len(disc["suspensoes"]) >= 1
    susp = next(s for s in disc["suspensoes"] if s["id_integrante"] == atleta_visitante)
    assert susp["origem"] == "SEGUNDO_AMARELO"
    assert susp["jogos_pendentes"] == 1
    assert susp["situacao"] == "ATIVA"

    # Confere que os 2 amarelos da mesma partida NÃO somaram no saldo de acúmulo
    resumo_atleta = next(r for r in disc["resumo_cartoes"] if r["id_integrante"] == atleta_visitante)
    assert resumo_atleta["amarelos_acumulo_atual"] == 0
    assert resumo_atleta["expulsoes_segundo_amarelo"] == 1

    # 7. Cumprimento da Suspensão em partida posterior da mesma equipe do atleta suspenso (eq_visitante_p1)
    partidas_eq_suspensa = [
        p for p in partidas
        if p["id_equipe_mandante"] == eq_visitante_p1 or p["id_equipe_visitante"] == eq_visitante_p1
    ]
    partidas_eq_suspensa.sort(key=lambda p: (p.get("rodada") or 1, p["id_partida"]))
    p2 = [p for p in partidas_eq_suspensa if p["id_partida"] != id_p1][0]
    id_p2 = p2["id_partida"]

    # Inicia e finaliza Partida 2
    client.post(f"/competicoes/partidas/{id_p2}/iniciar", headers=headers_coord)
    client.post(f"/competicoes/partidas/{id_p2}/finalizar", headers=headers_coord)

    # Registra cumprimento
    res_cump = client.post(
        f"/competicoes/suspensoes/{susp['id_suspensao']}/cumprimentos",
        headers=headers_coord,
        json={"id_partida": id_p2},
    )
    assert res_cump.status_code == 201

    # Confere que a suspensão foi marcada como CUMPRIDA
    res_disc_depois = client.get(f"/competicoes/edicoes/{id_edicao}/disciplinar", headers=headers_coord)
    susp_depois = next(s for s in res_disc_depois.json()["suspensoes"] if s["id_suspensao"] == susp["id_suspensao"])
    assert susp_depois["situacao"] == "CUMPRIDA"
    assert susp_depois["jogos_pendentes"] == 0


def test_fluxo_completo_fatia3_mata_mata_e_reabertura_travada(client, cabecalhos_por_papel, db):
    """Fluxo de mata-mata com pênaltis e travas de integridade na reabertura de partidas."""
    headers_coord = cabecalhos_por_papel("coordenador")
    headers_prof = cabecalhos_por_papel("professor")
    id_modalidade = _obter_ou_criar_modalidade(db)

    # Cria competição mata-mata (4 equipes)
    res_comp = client.post(
        "/competicoes/competicoes",
        headers=headers_coord,
        json={
            "nome": "Copa Mata-Mata Travas E2E",
            "id_modalidade": id_modalidade,
            "edicao": {
                "identificacao": "2026-MM",
                "data_inicio": "2026-09-01",
                "data_fim": "2026-09-30",
                "formato": "MATA_MATA",
                "configuracao": {
                    "formato": "MATA_MATA",
                    "ida_volta": False,
                    "final_unica": True,
                    "terceiro_lugar": False,
                },
            },
        },
    )
    assert res_comp.status_code == 201
    id_edicao = res_comp.json()["edicoes"][0]["id_edicao_competicao"]

    # Cadastra 4 equipes
    ids_equipes = []
    for i in range(1, 5):
        res_eq = client.post(
            f"/competicoes/edicoes/{id_edicao}/equipes",
            headers=headers_coord,
            json={"nome": f"Clube MM {i}", "sigla": f"C{i}"},
        )
        assert res_eq.status_code == 201
        ids_equipes.append(res_eq.json()["id_equipe"])

        # Atleta mínimo
        res_c = client.post("/competicoes/competidores", headers=headers_coord, json={"nome": f"Atleta MM {i}"})
        client.post(
            f"/competicoes/equipes/{res_eq.json()['id_equipe']}/integrantes",
            headers=headers_coord,
            json={"id_competidor": res_c.json()["id_competidor"], "nome_esportivo": f"Atleta {i}"},
        )

    # Gera chaveamento
    res_gerar = client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=headers_coord, json={})
    assert res_gerar.status_code == 201

    # Obter duelos e partidas
    res_disputa = client.get(f"/competicoes/edicoes/{id_edicao}/disputa", headers=headers_prof).json()
    duelos_semi = [d for d in res_disputa["duelos"] if d["fase"] == "SEMIFINAL"]
    assert len(duelos_semi) == 2
    duelo_final = next(d for d in res_disputa["duelos"] if d["fase"] == "FINAL")

    semi1 = next(p for p in res_disputa["partidas"] if p.get("id_duelo") == duelos_semi[0]["id_duelo"])
    semi2 = next(p for p in res_disputa["partidas"] if p.get("id_duelo") == duelos_semi[1]["id_duelo"])
    id_s1 = semi1["id_partida"]
    id_s2 = semi2["id_partida"]

    # Finaliza Semi 1 com empate em campo e pênaltis 5x4
    client.post(f"/competicoes/partidas/{id_s1}/iniciar", headers=headers_coord)
    res_fin_s1 = client.post(
        f"/competicoes/partidas/{id_s1}/finalizar",
        headers=headers_coord,
        json={"penaltis_mandante": 5, "penaltis_visitante": 4},
    )
    assert res_fin_s1.status_code == 200

    # Finaliza Semi 2 com vitória simples
    client.post(f"/competicoes/partidas/{id_s2}/iniciar", headers=headers_coord)
    client.post(
        f"/competicoes/partidas/{id_s2}/ocorrencias",
        headers=headers_coord,
        json={"tipo": "GOL", "id_equipe": semi2["id_equipe_mandante"], "minuto": 10},
    )
    res_fin_s2 = client.post(f"/competicoes/partidas/{id_s2}/finalizar", headers=headers_coord)
    assert res_fin_s2.status_code == 200

    # A final foi preenchida com os dois classificados!
    res_disputa_apos = client.get(f"/competicoes/edicoes/{id_edicao}/disputa", headers=headers_prof).json()
    final = next(p for p in res_disputa_apos["partidas"] if p.get("id_duelo") == duelo_final["id_duelo"])
    assert final["id_equipe_mandante"] == semi1["id_equipe_mandante"]
    assert final["id_equipe_visitante"] == semi2["id_equipe_mandante"]

    # 1. Antes de iniciar a Final, a Semi 1 PODE ser reaberta com justificativa:
    res_reabrir_ok = client.post(
        f"/competicoes/partidas/{id_s1}/reabrir",
        headers=headers_coord,
        json={"motivo": "Retificação formal da súmula da semifinal antes da final"},
    )
    assert res_reabrir_ok.status_code == 200
    assert res_reabrir_ok.json()["status"] == "EM_ANDAMENTO"

    # Finaliza a Semi 1 novamente para recompor a final
    res_fin_s1_novo = client.post(
        f"/competicoes/partidas/{id_s1}/finalizar",
        headers=headers_coord,
        json={"penaltis_mandante": 5, "penaltis_visitante": 4},
    )
    assert res_fin_s1_novo.status_code == 200

    # Obtem a partida da final e agora a INICIA
    res_disputa_final2 = client.get(f"/competicoes/edicoes/{id_edicao}/disputa", headers=headers_prof).json()
    final2 = next(p for p in res_disputa_final2["partidas"] if p.get("id_duelo") == duelo_final["id_duelo"])
    client.post(f"/competicoes/partidas/{final2['id_partida']}/iniciar", headers=headers_coord)

    # 2. Agora com a Final INICIADA, tentar reabrir a Semi 1 DEVE BLOQUEAR com 409 (ConflitoEstado)!
    res_reabrir_bloqueado = client.post(
        f"/competicoes/partidas/{id_s1}/reabrir",
        headers=headers_coord,
        json={"motivo": "Tentativa indevida de reabertura com final já iniciada"},
    )
    assert res_reabrir_bloqueado.status_code == 409


def test_fluxo_completo_fatia3_grupos_desempate_manual_e_ciclo_vida(client, cabecalhos_por_papel, db):
    """Fluxo de grupos com empate persistente resolvido manualmente e ciclo de vida da edição."""
    headers_coord = cabecalhos_por_papel("coordenador")
    headers_prof = cabecalhos_por_papel("professor")
    id_modalidade = _obter_ou_criar_modalidade(db)

    # Competição Grupos + Mata-Mata (4 equipes, 2 grupos de 2)
    res_comp = client.post(
        "/competicoes/competicoes",
        headers=headers_coord,
        json={
            "nome": "Copa Grupos Desempate E2E",
            "id_modalidade": id_modalidade,
            "edicao": {
                "identificacao": "2026-GM",
                "data_inicio": "2026-10-01",
                "data_fim": "2026-10-31",
                "formato": "GRUPOS_MATA_MATA",
                "configuracao": {
                    "formato": "GRUPOS_MATA_MATA",
                    "quantidade_grupos": 2,
                    "classificados_por_grupo": 1,
                    "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                    "desempates": ["SALDO_GOLS", "VITORIAS"],
                },
            },
        },
    )
    assert res_comp.status_code == 201
    id_edicao = res_comp.json()["edicoes"][0]["id_edicao_competicao"]

    # 4 equipes
    ids_equipes = []
    for i in range(1, 5):
        res_eq = client.post(
            f"/competicoes/edicoes/{id_edicao}/equipes",
            headers=headers_coord,
            json={"nome": f"Time G{i}", "sigla": f"TG{i}"},
        )
        assert res_eq.status_code == 201
        ids_equipes.append(res_eq.json()["id_equipe"])

        res_c = client.post("/competicoes/competidores", headers=headers_coord, json={"nome": f"Jogador G{i}"})
        client.post(
            f"/competicoes/equipes/{res_eq.json()['id_equipe']}/integrantes",
            headers=headers_coord,
            json={"id_competidor": res_c.json()["id_competidor"], "nome_esportivo": f"JG {i}"},
        )

    # Gera tabela
    res_gerar = client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=headers_coord, json={})
    assert res_gerar.status_code == 201

    partidas = client.get(f"/competicoes/edicoes/{id_edicao}/partidas", headers=headers_prof).json()
    partidas_grupos = [p for p in partidas if p["id_grupo"] is not None]

    # Grupo 1 (primeiro id_grupo): empata 0x0 gerando empate persistente
    id_g1 = partidas_grupos[0]["id_grupo"]
    partidas_g1 = [p for p in partidas_grupos if p["id_grupo"] == id_g1]
    for pg in partidas_g1:
        client.post(f"/competicoes/partidas/{pg['id_partida']}/iniciar", headers=headers_coord)
        client.post(f"/competicoes/partidas/{pg['id_partida']}/finalizar", headers=headers_coord)

    # Grupo 2 (demais id_grupo): tem vencedor (Time mandante vence por 1x0) sem empate persistente
    partidas_g2 = [p for p in partidas_grupos if p["id_grupo"] != id_g1]
    for pg in partidas_g2:
        client.post(f"/competicoes/partidas/{pg['id_partida']}/iniciar", headers=headers_coord)
        client.post(
            f"/competicoes/partidas/{pg['id_partida']}/ocorrencias",
            headers=headers_coord,
            json={"tipo": "GOL", "id_equipe": pg["id_equipe_mandante"], "minuto": 15},
        )
        client.post(f"/competicoes/partidas/{pg['id_partida']}/finalizar", headers=headers_coord)

    # Classificação indica empate persistente no Grupo
    classif = client.get(f"/competicoes/edicoes/{id_edicao}/classificacao", headers=headers_prof).json()
    assert classif["possui_empate_persistente"] is True

    # Tentativa de encerrar fase de grupos bloqueada por empate persistente
    res_encerrar_bloqueado = client.post(f"/competicoes/edicoes/{id_edicao}/encerrar-grupos", headers=headers_coord)
    assert res_encerrar_bloqueado.status_code == 409

    # Resolve o empate manualmente via Decisão Administrativa / Sorteio
    grupo_empatado = next(g for g in classif["grupos"] if g["possui_empate_persistente"])
    equipes_grupo = [l["id_equipe"] for l in grupo_empatado["linhas"]]

    res_decisao = client.post(
        f"/competicoes/edicoes/{id_edicao}/decisoes-classificacao",
        headers=headers_coord,
        json={
            "id_grupo": grupo_empatado["id_grupo"],
            "conjunto_equipes": equipes_grupo,
            "ordem_escolhida": [equipes_grupo[0], equipes_grupo[1]],
            "motivo": "Resolução por sorteio oficial homologado em ata",
        },
    )
    assert res_decisao.status_code == 201
    assert res_decisao.json()["valida"] is True

    # Agora a fase de grupos pode ser encerrada com sucesso!
    res_encerrar_ok = client.post(f"/competicoes/edicoes/{id_edicao}/encerrar-grupos", headers=headers_coord)
    assert res_encerrar_ok.status_code == 200

    # Reabrir fase de grupos com justificativa válida (quando final ainda não iniciou)
    res_reabrir_grupos = client.post(
        f"/competicoes/edicoes/{id_edicao}/reabrir-fase-grupos",
        headers=headers_coord,
        json={"motivo": "Necessidade de revisão dos grupos antes da final"},
    )
    assert res_reabrir_grupos.status_code == 200

    # Encerrar novamente e jogar a final
    client.post(f"/competicoes/edicoes/{id_edicao}/encerrar-grupos", headers=headers_coord)
    res_disputa_final = client.get(f"/competicoes/edicoes/{id_edicao}/disputa", headers=headers_prof).json()
    duelo_final = next(d for d in res_disputa_final["duelos"] if d["fase"] == "FINAL")
    final = next(p for p in res_disputa_final["partidas"] if p.get("id_duelo") == duelo_final["id_duelo"])

    client.post(f"/competicoes/partidas/{final['id_partida']}/iniciar", headers=headers_coord)
    # Lança gol da vitória na final
    client.post(
        f"/competicoes/partidas/{final['id_partida']}/ocorrencias",
        headers=headers_coord,
        json={"tipo": "GOL", "id_equipe": final["id_equipe_mandante"], "minuto": 90},
    )
    client.post(f"/competicoes/partidas/{final['id_partida']}/finalizar", headers=headers_coord)

    # Finalizar a Edição da Competição
    res_fin_edicao = client.post(f"/competicoes/edicoes/{id_edicao}/finalizar", headers=headers_coord)
    assert res_fin_edicao.status_code == 200
    assert res_fin_edicao.json()["estado"] == "FINALIZADA"

    # Reabrir a Edição com justificativa
    res_reabrir_edicao = client.post(
        f"/competicoes/edicoes/{id_edicao}/reabrir",
        headers=headers_coord,
        json={"motivo": "Reabertura administrativa da edição para homologação de relatório"},
    )
    assert res_reabrir_edicao.status_code == 200
    assert res_reabrir_edicao.json()["estado"] == "EM_ANDAMENTO"
