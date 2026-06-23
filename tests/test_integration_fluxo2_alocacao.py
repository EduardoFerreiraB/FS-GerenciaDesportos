import pytest
import models
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

_cpf_counter = 300000001
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

def test_integration_flow_allocation(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    # 1. Create a professor
    prof_cpf = get_unique_cpf()
    u_prof = get_unique_name("prof")
    prof_data = {
        "nome": "Professor Alocacao",
        "cpf": prof_cpf,
        "contato": "99999-9999",
        "username": u_prof,
        "password": "password123"
    }
    res = client.post("/professores/", json=prof_data, headers=coord_headers)
    assert res.status_code == 201
    id_prof = res.json()["id_professor"]

    # 2. Create a modality
    res = client.post("/modalidades/", json={"nome": get_unique_name("mod"), "descricao": "Futsal Desc"}, headers=coord_headers)
    assert res.status_code == 201
    id_mod = res.json()["id_modalidade"]

    # 3. Create a class (turma) associated with professor, SEG (Monday) 14:00 - 15:30
    turma1_data = {
        "id_modalidade": id_mod,
        "id_professor": id_prof,
        "dias_semana": ["SEG"],
        "horario_inicio": "14:00:00",
        "horario_fim": "15:30:00",
        "categoria_idade": "Sub 17"
    }
    res = client.post("/turmas/", json=turma1_data, headers=coord_headers)
    assert res.status_code == 201
    id_turma1 = res.json()["id_turma"]

    # 4. Attempt to create another class overlapping for the same professor: SEG 15:00 - 16:30
    turma2_data = {
        "id_modalidade": id_mod,
        "id_professor": id_prof,
        "dias_semana": ["SEG"],
        "horario_inicio": "15:00:00",
        "horario_fim": "16:30:00",
        "categoria_idade": "Sub 17"
    }
    res = client.post("/turmas/", json=turma2_data, headers=coord_headers)
    assert res.status_code == 400
    assert "conflito" in res.json()["detail"].lower()

    # 5. Attempt to delete the professor while allocated in the active class
    res = client.delete(f"/professores/{id_prof}", headers=coord_headers)
    assert res.status_code == 400
    assert "excluir" in res.json()["detail"].lower() or "turma" in res.json()["detail"].lower()

    # 6. Delete the class first to remove allocation
    res = client.delete(f"/turmas/{id_turma1}", headers=coord_headers)
    assert res.status_code == 204

    # 7. Delete the professor again (should succeed)
    res = client.delete(f"/professores/{id_prof}", headers=coord_headers)
    assert res.status_code == 204
