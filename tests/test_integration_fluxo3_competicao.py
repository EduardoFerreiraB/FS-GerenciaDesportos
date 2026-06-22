import pytest
import models
from datetime import date, time
import uuid

def get_unique_name(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def generate_valid_cpf(seed: int) -> str:
    base = f"{seed:09d}"
    soma = sum(int(base[i]) * (10 - i) for i in range(9))
    resto = soma % 11
    d1 = 0 if resto < 2 else 11 - resto
    
    base_d1 = base + str(d1)
    soma2 = sum(int(base_d1[i]) * (11 - i) for i in range(10))
    resto2 = soma2 % 11
    d2 = 0 if resto2 < 2 else 11 - resto2
    
    return base_d1 + str(d2)

_cpf_counter = 400000001
def get_unique_cpf() -> str:
    global _cpf_counter
    _cpf_counter += 1
    return generate_valid_cpf(_cpf_counter)

def get_auth_headers(client, db, role: str, username: str):
    from security import get_password_hash
    user = db.query(models.Usuario).filter(models.Usuario.username == username).first()
    if not user:
        user = models.Usuario(
            username=username,
            password_hash=get_password_hash("password123"),
            role=role,
            must_change_password=False
        )
        db.add(user)
        db.commit()
    
    response = client.post(
        "/token",
        data={"username": username, "password": "password123"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_integration_flow_competition(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)

    # 1. Create modality, event, and edition (Mata-Mata with Final phase, needing 2 teams)
    res = client.post("/modalidades/", json={"nome": get_unique_name("mod"), "descricao": "desc"}, headers=coord_headers)
    id_mod = res.json()["id_modalidade"]

    res = client.post("/eventos/", json={"even_nome": get_unique_name("evt"), "descricao": "Tournament"}, headers=coord_headers)
    id_evt = res.json()["id_evento"]

    res = client.post(
        "/edicoes/",
        json={
            "id_evento": id_evt,
            "edic_ano": 2026,
            "tipo_competicao": "Mata-Mata",
            "fase_inicial": "Final",
            "data_inicio": "2026-06-22",
            "data_fim": "2026-06-23"
        },
        headers=coord_headers
    )
    assert res.status_code == 201
    id_ed = res.json()["id_edicao"]

    # 2. Create 2 Teams
    res = client.post("/equipes/", json={"nome": get_unique_name("eq1"), "id_edicao": id_ed}, headers=coord_headers)
    id_eq1 = res.json()["id_equipe"]
    res = client.post("/equipes/", json={"nome": get_unique_name("eq2"), "id_edicao": id_ed}, headers=coord_headers)
    id_eq2 = res.json()["id_equipe"]

    # 3. Register participants (1 Aluno, 1 Atleta)
    # - Aluno setup: needs a class
    res = client.post("/professores/", json={"nome": "P", "cpf": get_unique_cpf(), "contato": "123", "username": get_unique_name("p"), "password": "password123"}, headers=coord_headers)
    id_prof = res.json()["id_professor"]
    res = client.post("/turmas/", json={"id_modalidade": id_mod, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"}, headers=coord_headers)
    id_turma = res.json()["id_turma"]

    res = client.post(
        "/alunos/",
        data={
            "nome_completo": "Student Player",
            "data_nascimento": "2010-01-01",
            "telefone_1": "123456",
            "endereco": "Street X",
            "escola": "School Y",
            "serie_ano": "9",
            "ids_turmas": str(id_turma)
        },
        headers=coord_headers
    )
    id_aluno_part = res.json()["id_participante"]

    # - Atleta setup
    res = client.post(
        f"/atletas/equipe/{id_eq2}",
        data={"nome_completo": "Atleta Player", "data_nascimento": "2005-01-01", "documento_pessoal": "Doc123"},
        headers=coord_headers
    )
    id_atleta_part = res.json()["id_participante"]

    # Associate Student to Team 1
    res = client.post(f"/equipes/{id_eq1}/participantes/{id_aluno_part}", headers=coord_headers)
    assert res.status_code == 200

    # 4. Create locations and referees to generate bracket confrontos
    res = client.post("/locais/", json={"loca_nome": "Stadium A", "loca_descricao": "Main"}, headers=coord_headers)
    id_loc = res.json()["id_local"]
    res = client.post("/arbitros/", json={"apito_nome": "Referee A", "apito_doc": "doc", "apito_tel": "tel"}, headers=coord_headers)
    id_arb = res.json()["id_arbitro"]

    # Generate confrontos
    res = client.post(
        f"/edicoes/{id_ed}/gerar-confrontos",
        json={"id_modalidade": id_mod, "part_hora": "15:00:00"},
        headers=coord_headers
    )
    assert res.status_code == 200

    # 5. Locate, update and finish the match
    res = client.get(f"/partidas/edicao/{id_ed}", headers=coord_headers)
    assert res.status_code == 200
    partidas = res.json()
    assert len(partidas) == 1
    id_partida = partidas[0]["id_partida"]

    # Set local/referee and finalize score
    res = client.put(
        f"/partidas/{id_partida}",
        json={
            "id_local": id_loc,
            "id_arbitro": id_arb,
            "placar_casa": 3,
            "placar_visitante": 2,
            "status": "Finalizada"
        },
        headers=coord_headers
    )
    assert res.status_code == 200

    # 6. Record stats
    # Student scores 3 goals
    res = client.post(
        f"/partidas/{id_partida}/estatisticas",
        json={
            "id_participante": id_aluno_part,
            "gols": 3,
            "cartoes_amarelos": 1,
            "cartoes_vermelhos": 0,
            "assistencias": 0
        },
        headers=coord_headers
    )
    assert res.status_code == 201

    # Athlete scores 2 goals
    res = client.post(
        f"/partidas/{id_partida}/estatisticas",
        json={
            "id_participante": id_atleta_part,
            "gols": 2,
            "cartoes_amarelos": 0,
            "cartoes_vermelhos": 1,
            "assistencias": 0
        },
        headers=coord_headers
    )
    assert res.status_code == 201

    # 7. Public endpoints validation (Unauthenticated)
    res = client.get(f"/publico/edicoes/{id_ed}/partidas")
    assert res.status_code == 200
    partidas_publicas = res.json()
    assert len(partidas_publicas) == 1
    assert partidas_publicas[0]["placar_casa"] == 3
    assert partidas_publicas[0]["placar_visitante"] == 2

    res = client.get(f"/publico/partidas/{id_partida}/estatisticas")
    assert res.status_code == 200
    stats = res.json()
    assert len(stats) == 2
    
    # Assert names are mapped correctly
    names = {s["nome_jogador"]: s["gols"] for s in stats}
    assert names["Student Player"] == 3
    assert names["Atleta Player"] == 2

    res = client.get(f"/publico/edicoes/{id_ed}/estatisticas")
    assert res.status_code == 200
    assert len(res.json()) == 2
