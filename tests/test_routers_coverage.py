import pytest
from datetime import date, time, datetime, timezone, timedelta
import models
import schemas
from security import get_password_hash
import io
import uuid
from fastapi import UploadFile, HTTPException
from unittest.mock import MagicMock, patch
from sqlalchemy.exc import IntegrityError
from routers.alunos import salvar_arquivo
from routers.atletas import salvar_foto_atleta

# ==================== HELPERS ====================

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

_cpf_counter = 200000001
def get_unique_cpf() -> str:
    global _cpf_counter
    _cpf_counter += 1
    return generate_valid_cpf(_cpf_counter)

def get_unique_name(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def get_auth_headers(client, db, role: str, username: str):
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

# ==================== DIRECT FUNCTION TESTS ====================

def test_salvar_arquivo_direct():
    assert salvar_arquivo(None, "fotos") is None
    
    file_empty = MagicMock()
    file_empty.filename = ""
    assert salvar_arquivo(file_empty, "fotos") is None
    
    file_no_ext = MagicMock()
    file_no_ext.filename = "filename_without_extension"
    with pytest.raises(HTTPException) as exc:
        salvar_arquivo(file_no_ext, "fotos")
    assert exc.value.status_code == 400
    assert "extensão" in exc.value.detail.lower()

def test_salvar_foto_atleta_direct():
    assert salvar_foto_atleta(None) is None
    
    file_empty = MagicMock()
    file_empty.filename = ""
    assert salvar_foto_atleta(file_empty) is None
    
    file_no_ext = MagicMock()
    file_no_ext.filename = "no_ext"
    with pytest.raises(HTTPException) as exc:
        salvar_foto_atleta(file_no_ext)
    assert exc.value.status_code == 400
    assert "extensão" in exc.value.detail.lower()

# ==================== ROUTER: AUTH / USERS ====================

def test_auth_coverage(client, db):
    u_admin = get_unique_name("admin")
    u_coord = get_unique_name("coord")
    admin_headers = get_auth_headers(client, db, "admin", u_admin)
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    # 1. /token invalid password/user
    res = client.post("/token", data={"username": u_coord, "password": "wrongpassword"})
    assert res.status_code == 401
    
    # 2. /refresh invalid refresh token
    res = client.post("/refresh", json={"refresh_token": "nonexistent_or_invalid"})
    assert res.status_code == 401
    
    # 3. /refresh expired refresh token
    user = db.query(models.Usuario).filter(models.Usuario.username == u_coord).first()
    expired_token = models.RefreshToken(
        token="expired_" + get_unique_name("token"),
        id_usuario=user.id_usuario,
        expires_at=datetime.utcnow() - timedelta(days=1),
        revoked=False
    )
    db.add(expired_token)
    db.commit()
    
    res = client.post("/refresh", json={"refresh_token": expired_token.token})
    assert res.status_code == 401
    assert "expirado" in res.json()["detail"].lower()
    
    # 4. /register coordinator trying to register admin or coordinator
    res = client.post(
        "/register",
        json={"username": get_unique_name("new_adm"), "password": "password123", "role": "admin"},
        headers=coord_headers
    )
    assert res.status_code == 403
    
    res = client.post(
        "/register",
        json={"username": get_unique_name("new_coo"), "password": "password123", "role": "coordenador"},
        headers=coord_headers
    )
    assert res.status_code == 403
    
    # 5. /register duplicate username
    res = client.post(
        "/register",
        json={"username": u_coord, "password": "password123", "role": "professor"},
        headers=admin_headers
    )
    assert res.status_code == 400
    
    # 6. /users/{username}/role - coordinator trying to modify admin or coordinator role
    u_adm_edit = get_unique_name("adm_edit")
    res = client.post(
        "/register",
        json={"username": u_adm_edit, "password": "password123", "role": "admin"},
        headers=admin_headers
    )
    assert res.status_code == 201
    
    res = client.put(
        f"/users/{u_adm_edit}/role",
        json={"role": "professor"},
        headers=coord_headers
    )
    assert res.status_code == 403
    
    u_prof_prom = get_unique_name("prof_prom")
    res = client.post(
        "/register",
        json={"username": u_prof_prom, "password": "password123", "role": "professor"},
        headers=admin_headers
    )
    res = client.put(
        f"/users/{u_prof_prom}/role",
        json={"role": "coordenador"},
        headers=coord_headers
    )
    assert res.status_code == 403
    
    # 7. /users/{id_usuario} (delete)
    admin_user = db.query(models.Usuario).filter(models.Usuario.username == u_admin).first()
    res = client.delete(f"/users/{admin_user.id_usuario}", headers=admin_headers)
    assert res.status_code == 400
    
    admin_to_edit_user = db.query(models.Usuario).filter(models.Usuario.username == u_adm_edit).first()
    res = client.delete(f"/users/{admin_to_edit_user.id_usuario}", headers=coord_headers)
    assert res.status_code == 403
    
    # Exception handling (mocking commit to raise exception)
    prof_to_promote_user = db.query(models.Usuario).filter(models.Usuario.username == u_prof_prom).first()
    with patch("sqlalchemy.orm.Session.commit", side_effect=Exception("Database error")):
        res = client.delete(f"/users/{prof_to_promote_user.id_usuario}", headers=admin_headers)
        assert res.status_code == 400

# ==================== ROUTER: ALUNOS ====================

def test_alunos_coverage(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    u_prof = get_unique_name("prof_al")
    cpf_prof = get_unique_cpf()
    res = client.post(
        "/professores/",
        json={"nome": "Prof Aluno", "cpf": cpf_prof, "contato": "123", "username": u_prof, "password": "password123"},
        headers=coord_headers
    )
    assert res.status_code == 201
    id_prof = res.json()["id_professor"]
    
    prof_headers = get_auth_headers(client, db, "professor", u_prof)
    
    # Professor user without a Professor record
    u_prof_no_rec = get_unique_name("prof_norec")
    prof_no_record_headers = get_auth_headers(client, db, "professor", u_prof_no_rec)
    
    res = client.post("/modalidades/", json={"nome": get_unique_name("mod"), "descricao": "d"}, headers=coord_headers)
    id_mod = res.json()["id_modalidade"]
    
    res = client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"},
        headers=coord_headers
    )
    id_turma = res.json()["id_turma"]
    
    # Create another professor's class
    u_prof_other = get_unique_name("prof_oth")
    cpf_prof_other = get_unique_cpf()
    res = client.post(
        "/professores/",
        json={"nome": "Prof Other", "cpf": cpf_prof_other, "contato": "123", "username": u_prof_other, "password": "password123"},
        headers=coord_headers
    )
    id_prof_other = res.json()["id_professor"]
    
    res = client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof_other, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"},
        headers=coord_headers
    )
    id_turma_other = res.json()["id_turma"]
    
    # Create students
    s1_name = get_unique_name("student")
    res = client.post(
        "/alunos/",
        data={"nome_completo": s1_name, "data_nascimento": "2010-01-01", "telefone_1": "123", "endereco": "R", "escola": "Esc", "serie_ano": "9", "ids_turmas": str(id_turma)},
        headers=coord_headers
    )
    id_aluno1 = res.json()["id_aluno"]
    
    s2_name = get_unique_name("student")
    res = client.post(
        "/alunos/",
        data={"nome_completo": s2_name, "data_nascimento": "2010-01-01", "telefone_1": "123", "endereco": "R", "escola": "Esc", "serie_ano": "9", "ids_turmas": str(id_turma_other)},
        headers=coord_headers
    )
    id_aluno2 = res.json()["id_aluno"]
    
    # 1. listar_alunos as professor
    res = client.get("/alunos/", headers=prof_no_record_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0
    
    res = client.get("/alunos/", headers=prof_headers)
    assert res.status_code == 200
    aluno_ids = [a["id_aluno"] for a in res.json()]
    assert id_aluno1 in aluno_ids
    assert id_aluno2 not in aluno_ids
    
    # 2. listar_aluno as professor
    res = client.get(f"/alunos/{id_aluno1}", headers=prof_headers)
    assert res.status_code == 200
    
    res = client.get(f"/alunos/{id_aluno2}", headers=prof_headers)
    assert res.status_code == 403
    
    # 3. buscar_alunos_por_nome as professor
    res = client.get(f"/alunos/buscar/nome/{s1_name[:10]}", headers=prof_no_record_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0
    
    res = client.get(f"/alunos/buscar/nome/{s1_name[:10]}", headers=prof_headers)
    assert res.status_code == 200
    aluno_ids = [a["id_aluno"] for a in res.json()]
    assert id_aluno1 in aluno_ids
    assert id_aluno2 not in aluno_ids
    
    # 4. buscar_alunos_por_escola as professor
    res = client.get("/alunos/buscar/escola/Esc", headers=prof_no_record_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0
    
    res = client.get("/alunos/buscar/escola/Esc", headers=prof_headers)
    assert res.status_code == 200
    aluno_ids = [a["id_aluno"] for a in res.json()]
    assert id_aluno1 in aluno_ids
    assert id_aluno2 not in aluno_ids
    
    # 5. buscar_alunos_por_serie as professor
    res = client.get("/alunos/buscar/serie/9", headers=prof_no_record_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0
    
    res = client.get("/alunos/buscar/serie/9", headers=prof_headers)
    assert res.status_code == 200
    aluno_ids = [a["id_aluno"] for a in res.json()]
    assert id_aluno1 in aluno_ids
    assert id_aluno2 not in aluno_ids
    
    # 6. /alunos/{id_aluno} non-existent
    res = client.put(f"/alunos/99999", data={"nome_completo": "Ghost"}, headers=coord_headers)
    assert res.status_code == 404
    
    res = client.delete(f"/alunos/99999", headers=coord_headers)
    assert res.status_code == 404
    
    # 7. IntegrityError mockup for delete
    with patch("routers.alunos.servico_alunos.excluir_aluno", side_effect=IntegrityError("mock", "mock", "mock")):
        res = client.delete(f"/alunos/{id_aluno1}", headers=coord_headers)
        assert res.status_code == 400

# ==================== ROUTER: ATLETAS ====================

def test_atletas_coverage(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    res = client.post("/eventos/", json={"even_nome": get_unique_name("evt"), "descricao": "d"}, headers=coord_headers)
    id_evt = res.json()["id_evento"]
    res = client.post("/edicoes/", json={"id_evento": id_evt, "edic_ano": 2026, "tipo_competicao": "Mata-Mata", "data_inicio": "2026-01-01", "data_fim": "2026-03-01"}, headers=coord_headers)
    id_ed = res.json()["id_edicao"]
    res = client.post("/equipes/", json={"nome": get_unique_name("eq"), "id_edicao": id_ed}, headers=coord_headers)
    id_eq = res.json()["id_equipe"]
    
    # 1. /atletas/equipe/{id_equipe} team doesn't exist
    res = client.post(
        "/atletas/equipe/99999",
        data={"nome_completo": "A", "data_nascimento": "2005-01-01", "documento_pessoal": "1234"},
        headers=coord_headers
    )
    assert res.status_code == 404
    
    # 2. ValueError when creating athlete (via mock)
    with patch("routers.atletas.service_atletas.criar_atleta_equipe", side_effect=ValueError("validation error")):
        res = client.post(
            f"/atletas/equipe/{id_eq}",
            data={"nome_completo": "A", "data_nascimento": "2005-01-01", "documento_pessoal": "1234"},
            headers=coord_headers
        )
        assert res.status_code == 400
    
    # 3. GET/DELETE non-existent athlete
    assert client.get("/atletas/99999", headers=coord_headers).status_code == 404
    assert client.delete("/atletas/99999", headers=coord_headers).status_code == 404

# ==================== ROUTER: MATRICULAS ====================

def test_matriculas_coverage(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    u_prof = get_unique_name("prof_mat")
    cpf_prof = get_unique_cpf()
    res = client.post(
        "/professores/",
        json={"nome": "Prof Mat", "cpf": cpf_prof, "contato": "123", "username": u_prof, "password": "password123"},
        headers=coord_headers
    )
    id_prof = res.json()["id_professor"]
    prof_headers = get_auth_headers(client, db, "professor", u_prof)
    
    u_prof_norec = get_unique_name("prof_norec")
    prof_no_record_headers = get_auth_headers(client, db, "professor", u_prof_norec)
    
    res = client.post("/modalidades/", json={"nome": get_unique_name("mod"), "descricao": "d"}, headers=coord_headers)
    id_mod = res.json()["id_modalidade"]
    res = client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15", "vagas": 1},
        headers=coord_headers
    )
    id_turma1 = res.json()["id_turma"]
    
    # Create another class
    u_prof_oth = get_unique_name("prof_oth")
    cpf_prof_oth = get_unique_cpf()
    res = client.post(
        "/professores/",
        json={"nome": "Prof Other Mat", "cpf": cpf_prof_oth, "contato": "123", "username": u_prof_oth, "password": "password123"},
        headers=coord_headers
    )
    id_prof_other = res.json()["id_professor"]
    res = client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof_other, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"},
        headers=coord_headers
    )
    id_turma_other = res.json()["id_turma"]
    
    # Create students
    s1_name = get_unique_name("student")
    p1 = models.Participante(tipo="aluno")
    db.add(p1)
    db.flush()
    al1 = models.Aluno(
        id_participante=p1.id_participante,
        nome_completo=s1_name,
        data_nascimento=date(2010, 1, 1),
        telefone_1="123",
        endereco="R",
        escola="Esc",
        serie_ano="9"
    )
    db.add(al1)
    
    s2_name = get_unique_name("student")
    p2 = models.Participante(tipo="aluno")
    db.add(p2)
    db.flush()
    al2 = models.Aluno(
        id_participante=p2.id_participante,
        nome_completo=s2_name,
        data_nascimento=date(2010, 1, 1),
        telefone_1="123",
        endereco="R",
        escola="Esc",
        serie_ano="9"
    )
    db.add(al2)
    db.commit()
    
    id_aluno1 = al1.id_aluno
    id_aluno2 = al2.id_aluno
    
    # 1. realizar_matricula errors
    res = client.post("/matriculas/", json={"id_aluno": 99999, "id_turma": id_turma1}, headers=coord_headers)
    assert res.status_code == 404
    
    res = client.post("/matriculas/", json={"id_aluno": id_aluno1, "id_turma": 99999}, headers=coord_headers)
    assert res.status_code == 404
    
    res = client.post("/matriculas/", json={"id_aluno": id_aluno1, "id_turma": id_turma1}, headers=coord_headers)
    assert res.status_code == 201
    id_mat = res.json()["id_matricula"]
    
    res = client.post("/matriculas/", json={"id_aluno": id_aluno1, "id_turma": id_turma1}, headers=coord_headers)
    assert res.status_code == 400
    
    res = client.post("/matriculas/", json={"id_aluno": id_aluno1, "id_turma": id_turma_other}, headers=coord_headers)
    assert res.status_code == 409
    
    # 2. listar_matriculas as professor
    res = client.get("/matriculas/", headers=prof_no_record_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0
    
    res = client.get("/matriculas/", params={"turma_id": id_turma_other}, headers=prof_headers)
    assert res.status_code == 403
    
    res = client.get("/matriculas/", params={"turma_id": id_turma1}, headers=prof_headers)
    assert res.status_code == 200
    assert len(res.json()) == 1
    
    res = client.post("/matriculas/", json={"id_aluno": id_aluno2, "id_turma": id_turma_other}, headers=coord_headers)
    assert res.status_code == 201
    
    res = client.get("/matriculas/", params={"aluno_id": id_aluno2}, headers=prof_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0
    
    res = client.get("/matriculas/", headers=prof_headers)
    assert res.status_code == 200
    mat_ids = [m["id_matricula"] for m in res.json()]
    assert id_mat in mat_ids
    
    # 3. cancelar_matricula non-existent -> 404
    assert client.delete("/matriculas/99999", headers=coord_headers).status_code == 404

# ==================== ROUTERS: EDICOES, EQUIPES, PARTIDAS, PRESENCAS, PROFESSORES ====================

def test_edicoes_coverage(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    assert client.get("/edicoes/99999", headers=coord_headers).status_code == 404
    assert client.delete("/edicoes/99999", headers=coord_headers).status_code == 404
    
    # 404 Evento não encontrado para a edição (line 24)
    res = client.post(
        "/edicoes/",
        json={"id_evento": 99999, "edic_ano": 2026, "tipo_competicao": "Mata-Mata", "data_inicio": "2026-01-01", "data_fim": "2026-03-01"},
        headers=coord_headers
    )
    assert res.status_code == 404

    # ValueError on clonar-equipes (mocked) (lines 82-83)
    with patch("routers.edicoes.edicao_service.clonar_equipes", side_effect=ValueError("Cannot clone")):
        res = client.post("/edicoes/1/clonar-equipes?edicao_origem_id=2", headers=coord_headers)
        assert res.status_code == 400

def test_equipes_partidas_presencas_coverage(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    # --- Equipes ---
    assert client.get("/equipes/99999", headers=coord_headers).status_code == 404
    
    # --- Partidas ---
    assert client.get("/partidas/edicao/99999", headers=coord_headers).status_code == 200
    assert client.get("/partidas/99999", headers=coord_headers).status_code == 405
    assert client.delete("/partidas/99999", headers=coord_headers).status_code == 404
    
    # Upload sumula non-existent match
    res = client.post(
        "/partidas/99999/sumula",
        files={"file": ("sumula.png", io.BytesIO(b"fake png"), "image/png")},
        headers=coord_headers
    )
    assert res.status_code == 404
    
    # Registrar/atualizar/deletar estatisticas non-existent
    res = client.post("/partidas/99999/estatisticas", json={"id_participante": 1, "gols": 1}, headers=coord_headers)
    assert res.status_code == 404
    
    res = client.put("/partidas/1/estatisticas/99999", json={"id_participante": 1, "gols": 1}, headers=coord_headers)
    assert res.status_code == 404
    
    res = client.delete("/partidas/1/estatisticas/99999", headers=coord_headers)
    assert res.status_code == 404
    
    # --- Presencas ---
    res = client.post(
        "/presencas/lote",
        json={"data_aula": "2026-06-22", "id_turma": 99999, "presencas": [{"id_matricula": 99999, "status": "Presente"}]},
        headers=coord_headers
    )
    assert res.status_code == 400

def test_professores_exception_coverage(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    with patch("sqlalchemy.orm.Session.add", side_effect=Exception("DB fail")):
        res = client.post(
            "/professores/",
            json={"nome": "P", "cpf": get_unique_cpf(), "contato": "123", "username": get_unique_name("p_err"), "password": "password"},
            headers=coord_headers
        )
        assert res.status_code == 400

def test_professores_coverage(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    # --- Professores ---
    res = client.post(
        "/professores/",
        json={"nome": "P", "cpf": "invalid_cpf", "contato": "123", "username": get_unique_name("p_inv"), "password": "password"},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    res = client.post(
        "/professores/",
        json={"nome": "P", "cpf": get_unique_cpf(), "contato": "123", "username": u_coord, "password": "password"},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    cpf_dup = get_unique_cpf()
    res = client.post(
        "/professores/",
        json={"nome": "P", "cpf": cpf_dup, "contato": "123", "username": get_unique_name("p_unq1"), "password": "password"},
        headers=coord_headers
    )
    assert res.status_code == 201
    
    res = client.post(
        "/professores/",
        json={"nome": "P", "cpf": cpf_dup, "contato": "123", "username": get_unique_name("p_unq2"), "password": "password"},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    # Update professor profile checks
    u_prof_self = get_unique_name("prof_self")
    res = client.post(
        "/professores/",
        json={"nome": "Prof Self", "cpf": get_unique_cpf(), "contato": "123", "username": u_prof_self, "password": "password123"},
        headers=coord_headers
    )
    assert res.status_code == 201
    id_prof_self = res.json()["id_professor"]
    self_headers = get_auth_headers(client, db, "professor", u_prof_self)
    
    u_prof_other = get_unique_name("prof_oth")
    res = client.post(
        "/professores/",
        json={"nome": "Prof Self 2", "cpf": get_unique_cpf(), "contato": "123", "username": u_prof_other, "password": "password123"},
        headers=coord_headers
    )
    id_prof_other = res.json()["id_professor"]
    
    res = client.put(f"/professores/{id_prof_other}", json={"nome": "Hacked"}, headers=self_headers)
    assert res.status_code == 403
    
    res = client.put(f"/professores/{id_prof_self}", json={"cpf": "invalid"}, headers=self_headers)
    assert res.status_code == 400
    
    res = client.put(f"/professores/{id_prof_self}", json={"cpf": cpf_dup}, headers=self_headers)
    assert res.status_code == 400
    
    # Delete professor with active turmas -> 400
    res = client.post("/modalidades/", json={"nome": get_unique_name("mod"), "descricao": "d"}, headers=coord_headers)
    id_mod = res.json()["id_modalidade"]
    client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof_self, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"},
        headers=coord_headers
    )
    
    res = client.delete(f"/professores/{id_prof_self}", headers=coord_headers)
    assert res.status_code == 400

# ==================== ROUTERS: PUBLICO, TURMAS ====================

def test_publico_turmas_coverage(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    # --- Publico ---
    assert client.get("/publico/eventos/99999").status_code == 404
    
    # --- Turmas ---
    u_prof = get_unique_name("prof_tu")
    cpf_prof = get_unique_cpf()
    res = client.post(
        "/professores/",
        json={"nome": "Prof Turma", "cpf": cpf_prof, "contato": "123", "username": u_prof, "password": "password123"},
        headers=coord_headers
    )
    id_prof = res.json()["id_professor"]
    prof_headers = get_auth_headers(client, db, "professor", u_prof)
    
    u_prof_norec = get_unique_name("prof_norec")
    prof_no_rec_headers = get_auth_headers(client, db, "professor", u_prof_norec)
    
    res = client.post("/modalidades/", json={"nome": get_unique_name("mod"), "descricao": "d"}, headers=coord_headers)
    id_mod = res.json()["id_modalidade"]
    
    # First class
    res = client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"},
        headers=coord_headers
    )
    assert res.status_code == 201
    id_turma = res.json()["id_turma"]
    
    # Conflict class -> 400
    res = client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    # Update class with conflict -> 400
    res = client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "12:00:00", "horario_fim": "13:00:00", "categoria_idade": "Sub 15"},
        headers=coord_headers
    )
    id_turma2 = res.json()["id_turma"]
    
    res = client.put(
        f"/turmas/{id_turma2}",
        json={"horario_inicio": "10:30:00", "horario_fim": "11:30:00"},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    # 2. listar_turmas as professor
    res = client.get("/turmas/", headers=prof_no_rec_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0
    
    # 3. obter_turmas_professor non-existent -> 404
    assert client.get("/turmas/professor/99999", headers=coord_headers).status_code == 404
    # 4. obter_turmas_modalidade non-existent -> 404
    assert client.get("/turmas/modalidade/99999", headers=coord_headers).status_code == 404
    
    # 5. delete/put non-existent
    assert client.delete("/turmas/99999", headers=coord_headers).status_code == 404
    assert client.put("/turmas/99999", json={"categoria_idade": "S"}, headers=coord_headers).status_code == 404

def test_extra_routers_coverage(client, db):
    u_coord = get_unique_name("coord")
    coord_headers = get_auth_headers(client, db, "coordenador", u_coord)
    
    # 1. ALUNOS
    # - format validation
    res = client.post("/alunos/", data={"nome_completo": "A", "data_nascimento": "2010-01-01", "ids_turmas": "abc"}, headers=coord_headers)
    assert res.status_code == 400
    res = client.post("/alunos/", data={"nome_completo": "A", "data_nascimento": "2010-01-01", "ids_turmas": ""}, headers=coord_headers)
    assert res.status_code == 400
    res = client.post("/alunos/", data={"nome_completo": "A", "data_nascimento": "2010-01-01", "ids_turmas": "99999"}, headers=coord_headers)
    assert res.status_code == 404
    
    # - GET 404
    res = client.get("/alunos/99999", headers=coord_headers)
    assert res.status_code == 404
    
    # - GET all as coordinator
    res = client.get("/alunos/", headers=coord_headers)
    assert res.status_code == 200

    # - Create and update student with all fields
    res = client.post("/modalidades/", json={"nome": get_unique_name("mod"), "descricao": "d"}, headers=coord_headers)
    id_mod = res.json()["id_modalidade"]
    u_prof = get_unique_name("prof")
    res = client.post("/professores/", json={"nome": "P", "cpf": get_unique_cpf(), "contato": "123", "username": u_prof, "password": "password123"}, headers=coord_headers)
    id_prof = res.json()["id_professor"]
    res = client.post("/turmas/", json={"id_modalidade": id_mod, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"}, headers=coord_headers)
    id_turma = res.json()["id_turma"]
    
    res = client.post(
        "/alunos/",
        data={
            "nome_completo": "Full Student",
            "data_nascimento": "2010-01-01",
            "telefone_1": "12345",
            "endereco": "Street 1",
            "escola": "School 1",
            "serie_ano": "9",
            "ids_turmas": str(id_turma)
        },
        headers=coord_headers
    )
    assert res.status_code == 201
    id_aluno = res.json()["id_aluno"]
    
    res = client.put(
        f"/alunos/{id_aluno}",
        data={
            "nome_completo": "Updated Student",
            "data_nascimento": "2010-02-02",
            "escola": "School 2",
            "serie_ano": "10",
            "nome_mae": "Mother",
            "nome_pai": "Father",
            "telefone_1": "54321",
            "telefone_2": "99999",
            "endereco": "Street 2",
            "recomendacoes_medicas": "None"
        },
        headers=coord_headers
    )
    assert res.status_code == 200

    # 2. EQUIPES
    res = client.post("/equipes/99999/participantes/99999", headers=coord_headers)
    assert res.status_code == 404

    # 3. MATRICULAS
    res = client.get("/matriculas/", params={"aluno_id": id_aluno}, headers=coord_headers)
    assert res.status_code == 200

    # 4. PARTIDAS
    # - create with mocked ValueError
    with patch("routers.partidas.service_partidas.criar_partida", side_effect=ValueError("Mock value error")):
        res = client.post(
            "/partidas/",
            json={
                "id_edicao": 1,
                "id_modalidade": 1,
                "id_equipe_casa": 1,
                "id_equipe_visitante": 2,
                "id_local": 1,
                "id_arbitro": 1,
                "part_data": "2026-06-22",
                "part_hora": "15:00:00",
                "fase": "Semifinal"
            },
            headers=coord_headers
        )
        assert res.status_code == 400
        
    # - update 404
    res = client.put("/partidas/99999", json={"status": "Finalizada"}, headers=coord_headers)
    assert res.status_code == 404
    
    # Setup for sumula and statistics
    res = client.post("/eventos/", json={"even_nome": get_unique_name("evt"), "descricao": "d"}, headers=coord_headers)
    id_evt = res.json()["id_evento"]
    res = client.post("/edicoes/", json={"id_evento": id_evt, "edic_ano": 2026, "tipo_competicao": "Mata-Mata", "data_inicio": "2026-01-01", "data_fim": "2026-03-01"}, headers=coord_headers)
    id_ed = res.json()["id_edicao"]
    res = client.post("/equipes/", json={"nome": get_unique_name("eq1"), "id_edicao": id_ed}, headers=coord_headers)
    id_eq1 = res.json()["id_equipe"]
    res = client.post("/equipes/", json={"nome": get_unique_name("eq2"), "id_edicao": id_ed}, headers=coord_headers)
    id_eq2 = res.json()["id_equipe"]
    res = client.post("/locais/", json={"loca_nome": "Local 1", "loca_descricao": "Addr"}, headers=coord_headers)
    assert res.status_code == 201
    id_loc = res.json()["id_local"]
    res = client.post("/arbitros/", json={"apito_nome": "Arb 1", "apito_doc": "doc123", "apito_tel": "123456"}, headers=coord_headers)
    assert res.status_code == 201
    id_arb = res.json()["id_arbitro"]
    
    # Create valid match
    res = client.post(
        "/partidas/",
        json={
            "id_edicao": id_ed,
            "id_modalidade": id_mod,
            "id_equipe_casa": id_eq1,
            "id_equipe_visitante": id_eq2,
            "id_local": id_loc,
            "id_arbitro": id_arb,
            "part_data": "2026-06-22",
            "part_hora": "15:00:00",
            "fase": "Final"
        },
        headers=coord_headers
    )
    assert res.status_code == 201
    id_partida = res.json()["id_partida"]
    
    # - sumula upload invalid MIME type
    res = client.post(
        f"/partidas/{id_partida}/sumula",
        files={"file": ("sumula.png", io.BytesIO(b"fake png"), "text/plain")},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    # - sumula upload file write exception
    with patch("builtins.open", side_effect=Exception("Mock open exception")):
        res = client.post(
            f"/partidas/{id_partida}/sumula",
            files={"file": ("sumula.png", io.BytesIO(b"fake png"), "image/png")},
            headers=coord_headers
        )
        assert res.status_code == 500

    # - statistics non-existent player
    res = client.post(f"/partidas/{id_partida}/estatisticas", json={"id_participante": 99999, "gols": 2}, headers=coord_headers)
    assert res.status_code == 404

    # - statistics player not in match
    p_player = models.Participante(tipo="aluno")
    db.add(p_player)
    db.flush()
    al_rec = models.Aluno(id_participante=p_player.id_participante, nome_completo="Aluno Player", data_nascimento=date(2010, 1, 1), telefone_1="1", endereco="E", escola="Esc", serie_ano="9")
    db.add(al_rec)
    db.commit()
    id_player = p_player.id_participante
    
    # Create athlete participant
    p_athlete = models.Participante(tipo="atleta")
    db.add(p_athlete)
    db.flush()
    ath_rec = models.Atleta(id_participante=p_athlete.id_participante, nome_completo="Atleta Player", data_nascimento=date(2005, 1, 1), documento_pessoal="Doc")
    db.add(ath_rec)
    db.commit()
    id_athlete = p_athlete.id_participante
    
    res = client.post(f"/partidas/{id_partida}/estatisticas", json={"id_participante": id_player, "gols": 2}, headers=coord_headers)
    assert res.status_code == 400

    # - statistics duplicate player
    db.execute(models.equipes_participantes.insert().values(id_equipe=id_eq1, id_participante=id_player))
    db.execute(models.equipes_participantes.insert().values(id_equipe=id_eq2, id_participante=id_athlete))
    db.commit()
    
    res = client.post(f"/partidas/{id_partida}/estatisticas", json={"id_participante": id_player, "gols": 2}, headers=coord_headers)
    assert res.status_code == 201
    
    res = client.post(f"/partidas/{id_partida}/estatisticas", json={"id_participante": id_athlete, "gols": 1}, headers=coord_headers)
    assert res.status_code == 201
    
    res = client.post(f"/partidas/{id_partida}/estatisticas", json={"id_participante": id_player, "gols": 3}, headers=coord_headers)
    assert res.status_code == 400

    # 5. PROFESSORES
    # - view other profile as professor
    prof_self_headers = get_auth_headers(client, db, "professor", u_prof)
    res = client.get(f"/professores/99999", headers=prof_self_headers)
    assert res.status_code == 403

    # 6. PUBLICO
    res = client.get(f"/publico/eventos/{id_evt}")
    assert res.status_code == 200
    res = client.get("/publico/edicoes")
    assert res.status_code == 200
    res = client.get(f"/publico/edicoes/{id_ed}/equipes")
    assert res.status_code == 200
    res = client.get(f"/publico/partidas/{id_partida}/estatisticas")
    assert res.status_code == 200
    res = client.get(f"/publico/edicoes/{id_ed}/estatisticas")
    assert res.status_code == 200

    # 7. TURMAS
    # - create with non-existent modalidade
    res = client.post("/turmas/", json={"id_modalidade": 99999, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"}, headers=coord_headers)
    assert res.status_code == 404
    # - create with non-existent professor
    res = client.post("/turmas/", json={"id_modalidade": id_mod, "id_professor": 99999, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"}, headers=coord_headers)
    assert res.status_code == 404
    # - list as professor (with record)
    res = client.get("/turmas/", headers=prof_self_headers)
    assert res.status_code == 200
    # - view class not belonging to them
    u_prof_other = get_unique_name("prof_oth")
    res = client.post("/professores/", json={"nome": "P2", "cpf": get_unique_cpf(), "contato": "123", "username": u_prof_other, "password": "password123"}, headers=coord_headers)
    id_prof_other = res.json()["id_professor"]
    res = client.post("/turmas/", json={"id_modalidade": id_mod, "id_professor": id_prof_other, "dias_semana": ["TER"], "horario_inicio": "14:00:00", "horario_fim": "15:00:00", "categoria_idade": "Sub 15"}, headers=coord_headers)
    id_turma_other = res.json()["id_turma"]
    
    res = client.get(f"/turmas/{id_turma_other}", headers=prof_self_headers)
    assert res.status_code == 403
    # - list other professor's classes as professor
    res = client.get(f"/turmas/professor/{id_prof_other}", headers=prof_self_headers)
    assert res.status_code == 403
    # - list modalidade's classes as professor (filters applied)
    res = client.get(f"/turmas/modalidade/{id_mod}", headers=prof_self_headers)
    assert res.status_code == 200
    # - update class not belonging to them
    res = client.put(f"/turmas/{id_turma_other}", json={"categoria_idade": "Sub 17"}, headers=prof_self_headers)
    assert res.status_code == 403
    # - delete class raising IntegrityError
    from sqlalchemy.exc import IntegrityError
    with patch("routers.turmas.servico_turmas.excluir_turma", side_effect=IntegrityError("mock", "mock", "mock")):
        res = client.delete(f"/turmas/{id_turma}", headers=coord_headers)
        assert res.status_code == 400
