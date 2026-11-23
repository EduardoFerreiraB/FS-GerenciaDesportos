"""Teste de integração ponta a ponta (E2E) da Fatia 2 — Disputa, Partidas e Classificação."""

import uuid
from datetime import date, datetime
import pytest
from models import Modalidade


def _obter_ou_criar_modalidade(db):
    mod = db.query(Modalidade).first()
    if not mod:
        mod = Modalidade(nome="Futebol E2E")
        db.add(mod)
        db.commit()
        db.refresh(mod)
    return mod.id_modalidade


def test_fluxo_completo_pontos_corridos(client, cabecalhos_por_papel, db):
    headers_coord = cabecalhos_por_papel("coordenador")
    headers_prof = cabecalhos_por_papel("professor")
    id_modalidade = _obter_ou_criar_modalidade(db)

    # 1. Cria competição em pontos corridos (4 equipes)
    res_comp = client.post(
        "/competicoes/competicoes",
        headers=headers_coord,
        json={
            "nome": "Campeonato Pontos Corridos E2E",
            "id_modalidade": id_modalidade,
            "edicao": {
                "identificacao": "2026",
                "data_inicio": "2026-06-01",
                "data_fim": "2026-06-30",
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

    # 2. Cadastra 4 equipes e seus respectivos atletas
    ids_equipes = []
    for i in range(1, 5):
        res_eq = client.post(
            f"/competicoes/edicoes/{id_edicao}/equipes",
            headers=headers_coord,
            json={"nome": f"Equipe {i}", "sigla": f"EQ{i}"},
        )
        assert res_eq.status_code == 201
        id_eq = res_eq.json()["id_equipe"]
        ids_equipes.append(id_eq)

        res_comp_ind = client.post(
            "/competicoes/competidores",
            headers=headers_coord,
            json={"nome": f"Jogador {i}"},
        )
        assert res_comp_ind.status_code == 201
        id_competidor = res_comp_ind.json()["id_competidor"]

        res_ins = client.post(
            f"/competicoes/equipes/{id_eq}/integrantes",
            headers=headers_coord,
            json={
                "id_competidor": id_competidor,
                "nome_esportivo": f"Atleta {i}",
                "numero_camisa": 10,
            },
        )
        assert res_ins.status_code == 201

    # 3. Gerar tabela / calendário
    res_gerar = client.post(
        f"/competicoes/edicoes/{id_edicao}/gerar-tabela",
        headers=headers_coord,
        json={},
    )
    assert res_gerar.status_code == 201
    dados_disputa = res_gerar.json()
    assert dados_disputa["total_partidas"] == 6  # 4 equipes em turno unico = 6 jogos

    # 4. Listar partidas geradas
    res_partidas = client.get(
        f"/competicoes/edicoes/{id_edicao}/partidas",
        headers=headers_prof,
    )
    assert res_partidas.status_code == 200
    partidas = res_partidas.json()
    assert len(partidas) == 6

    # 5. Agendar a primeira partida
    primeira_partida = partidas[0]
    id_p1 = primeira_partida["id_partida"]

    res_ag = client.patch(
        f"/competicoes/partidas/{id_p1}/agendamento",
        headers=headers_coord,
        json={
            "data_hora": "2026-06-05T14:00:00",
            "local": "Estádio Municipal",
            "campo": "Campo 1",
        },
    )
    assert res_ag.status_code == 200
    assert res_ag.json()["local"] == "Estádio Municipal"

    # 6. Registrar resultado simples da primeira partida (3 x 1)
    chave_idempotencia = str(uuid.uuid4())
    payload_resultado = {
        "gols_mandante": 3,
        "gols_visitante": 1,
        "wo": False,
    }
    res_placar = client.post(
        f"/competicoes/partidas/{id_p1}/resultado-simples",
        headers={**headers_coord, "Idempotency-Key": chave_idempotencia},
        json=payload_resultado,
    )
    assert res_placar.status_code == 200
    dados_p1 = res_placar.json()
    assert dados_p1["status"] == "FINALIZADA"
    assert dados_p1["placar"]["gols_mandante"] == 3
    assert dados_p1["placar"]["gols_visitante"] == 1

    # 7. Testar idempotência pura (mesma chave, mesmo payload)
    res_placar_rep = client.post(
        f"/competicoes/partidas/{id_p1}/resultado-simples",
        headers={**headers_coord, "Idempotency-Key": chave_idempotencia},
        json=payload_resultado,
    )
    assert res_placar_rep.status_code == 200
    assert res_placar_rep.json()["placar"]["gols_mandante"] == 3

    # 8. Consultar classificação pontuada
    res_class = client.get(
        f"/competicoes/edicoes/{id_edicao}/classificacao",
        headers=headers_prof,
    )
    assert res_class.status_code == 200
    classificacao = res_class.json()
    assert classificacao["linhas"] is not None
    assert len(classificacao["linhas"]) == 4

    lider = classificacao["linhas"][0]
    assert lider["pontos"] == 3
    assert lider["vitorias"] == 1
    assert lider["saldo_gols"] == 2
    assert lider["gols_pro"] == 3


def test_fluxo_completo_grupos_mata_mata_com_avanco(client, cabecalhos_por_papel, db):
    headers_coord = cabecalhos_por_papel("coordenador")
    headers_prof = cabecalhos_por_papel("professor")
    id_modalidade = _obter_ou_criar_modalidade(db)

    # 1. Cria competição grupos + mata-mata (4 equipes, 2 grupos de 2, classificados por grupo = 1)
    res_comp = client.post(
        "/competicoes/competicoes",
        headers=headers_coord,
        json={
            "nome": "Copa Mista Grupos Mata-Mata E2E",
            "id_modalidade": id_modalidade,
            "edicao": {
                "identificacao": "2026",
                "data_inicio": "2026-07-01",
                "data_fim": "2026-07-31",
                "formato": "GRUPOS_MATA_MATA",
                "configuracao": {
                    "formato": "GRUPOS_MATA_MATA",
                    "quantidade_grupos": 2,
                    "classificados_por_grupo": 1,
                    "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                    "desempates": ["SALDO_GOLS", "VITORIAS"],
                    "turno_e_returno_grupos": False,
                    "ida_volta_eliminatoria": False,
                    "final_unica": True,
                    "terceiro_lugar": False,
                },
            },
        },
    )
    assert res_comp.status_code == 201
    id_edicao = res_comp.json()["edicoes"][0]["id_edicao_competicao"]

    # 2. Cadastra 4 equipes
    ids_equipes = []
    for i in range(1, 5):
        res_eq = client.post(
            f"/competicoes/edicoes/{id_edicao}/equipes",
            headers=headers_coord,
            json={"nome": f"Time Grupo {i}", "sigla": f"TG{i}"},
        )
        assert res_eq.status_code == 201
        id_eq = res_eq.json()["id_equipe"]
        ids_equipes.append(id_eq)

        res_comp_ind = client.post(
            "/competicoes/competidores",
            headers=headers_coord,
            json={"nome": f"Jogador Grupo {i}"},
        )
        assert res_comp_ind.status_code == 201
        id_competidor = res_comp_ind.json()["id_competidor"]

        client.post(
            f"/competicoes/equipes/{id_eq}/integrantes",
            headers=headers_coord,
            json={"id_competidor": id_competidor, "nome_esportivo": f"Atleta G{i}"},
        )

    # 3. Gerar tabela
    res_gerar = client.post(
        f"/competicoes/edicoes/{id_edicao}/gerar-tabela",
        headers=headers_coord,
        json={},
    )
    assert res_gerar.status_code == 201
    dados_disputa = res_gerar.json()
    assert len(dados_disputa["grupos"]) == 2
    assert len(dados_disputa["duelos"]) == 1  # Apenas a Final entre o 1º de cada grupo

    # 4. Finaliza as partidas dos grupos
    res_partidas = client.get(
        f"/competicoes/edicoes/{id_edicao}/partidas",
        headers=headers_prof,
    )
    partidas = res_partidas.json()
    partidas_grupos = [p for p in partidas if p["id_grupo"] is not None]
    assert len(partidas_grupos) == 2

    # Lança vitória na partida do Grupo 1 (2x0)
    client.post(
        f"/competicoes/partidas/{partidas_grupos[0]['id_partida']}/resultado-simples",
        headers={**headers_coord, "Idempotency-Key": str(uuid.uuid4())},
        json={"gols_mandante": 2, "gols_visitante": 0},
    )

    # Lança vitória na partida do Grupo 2 (3x1)
    client.post(
        f"/competicoes/partidas/{partidas_grupos[1]['id_partida']}/resultado-simples",
        headers={**headers_coord, "Idempotency-Key": str(uuid.uuid4())},
        json={"gols_mandante": 3, "gols_visitante": 1},
    )

    # 5. Encerrar fase de grupos e avançar os vencedores para a final
    res_encerrar = client.post(
        f"/competicoes/edicoes/{id_edicao}/encerrar-grupos",
        headers=headers_coord,
    )
    assert res_encerrar.status_code == 200

    # 6. Verifica se o duelo da final agora possui os participantes definidos
    res_disputa = client.get(
        f"/competicoes/edicoes/{id_edicao}/disputa",
        headers=headers_prof,
    )
    assert res_disputa.status_code == 200
    duelo_final = res_disputa.json()["duelos"][0]
    vagas_preenchidas = [
        v for v in duelo_final["vagas"]
        if (v.get("id_equipe_resolvida") or v.get("id_equipe")) is not None
    ]
    assert len(vagas_preenchidas) == 2

    # Verifica se a partida da grande final foi criada com as equipes classificadas
    partidas_finais = [
        p for p in res_disputa.json()["partidas"]
        if p.get("id_duelo") == duelo_final["id_duelo"]
    ]
    assert len(partidas_finais) >= 1
    p_final = partidas_finais[0]
    assert p_final["id_equipe_mandante"] is not None
    assert p_final["id_equipe_visitante"] is not None


def test_desfazer_tabela_e_guardas(client, cabecalhos_por_papel, db):
    headers_coord = cabecalhos_por_papel("coordenador")
    id_modalidade = _obter_ou_criar_modalidade(db)

    # 1. Cria edição
    res_comp = client.post(
        "/competicoes/competicoes",
        headers=headers_coord,
        json={
            "nome": "Torneio Teste Desfazer",
            "id_modalidade": id_modalidade,
            "edicao": {
                "identificacao": "2026",
                "data_inicio": "2026-08-01",
                "data_fim": "2026-08-31",
                "formato": "PONTOS_CORRIDOS",
                "configuracao": {
                    "formato": "PONTOS_CORRIDOS",
                    "pontuacao": {"vitoria": 3, "empate": 1, "derrota": 0},
                    "desempates": ["SALDO_GOLS"],
                },
            },
        },
    )
    assert res_comp.status_code == 201
    id_edicao = res_comp.json()["edicoes"][0]["id_edicao_competicao"]

    # Cadastra 2 equipes com integrantes
    for i in (1, 2):
        r_eq = client.post(f"/competicoes/edicoes/{id_edicao}/equipes", headers=headers_coord, json={"nome": f"Eq {i}"})
        id_eq = r_eq.json()["id_equipe"]
        r_comp = client.post("/competicoes/competidores", headers=headers_coord, json={"nome": f"Comp {i}"})
        client.post(f"/competicoes/equipes/{id_eq}/integrantes", headers=headers_coord, json={"id_competidor": r_comp.json()["id_competidor"], "nome_esportivo": f"At {i}"})

    # Gera tabela -> EM_ANDAMENTO
    res_gerar = client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=headers_coord)
    assert res_gerar.status_code == 201

    # Desfaz tabela imediatamente (sem partidas jogadas) -> Sucesso 204
    res_del = client.delete(f"/competicoes/edicoes/{id_edicao}/tabela", headers=headers_coord)
    assert res_del.status_code == 204

    # Verifica que voltou para RASCUNHO e sem partidas
    res_ed = client.get(f"/competicoes/edicoes/{id_edicao}", headers=headers_coord)
    assert res_ed.json()["estado"] == "RASCUNHO"

    res_parts = client.get(f"/competicoes/edicoes/{id_edicao}/partidas", headers=headers_coord)
    assert len(res_parts.json()) == 0

    # Gera tabela novamente e lança resultado de jogo
    client.post(f"/competicoes/edicoes/{id_edicao}/gerar-tabela", headers=headers_coord)
    partidas = client.get(f"/competicoes/edicoes/{id_edicao}/partidas", headers=headers_coord).json()
    id_p = partidas[0]["id_partida"]

    client.post(
        f"/competicoes/partidas/{id_p}/resultado-simples",
        headers={**headers_coord, "Idempotency-Key": str(uuid.uuid4())},
        json={"gols_mandante": 1, "gols_visitante": 0},
    )

    # Tenta desfazer tabela com jogo já finalizado -> 409 ConflitoEstado
    res_del_bloqueado = client.delete(f"/competicoes/edicoes/{id_edicao}/tabela", headers=headers_coord)
    assert res_del_bloqueado.status_code == 409
