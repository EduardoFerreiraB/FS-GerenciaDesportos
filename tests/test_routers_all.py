import pytest
from datetime import date, time, timedelta
import models
import schemas
from security import get_password_hash
import io
import os
import importlib
from unittest.mock import MagicMock, patch
from pathlib import Path
from database import get_db

# ==================== HELPERS ====================

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

# ==================== TESTS: DATABASE & MAIN ====================

def test_database_url_not_set(monkeypatch):
    old_url = os.environ.get("DATABASE_URL")
    if "DATABASE_URL" in os.environ:
        monkeypatch.delenv("DATABASE_URL")
    
    import database
    with patch("dotenv.load_dotenv"):
        with pytest.raises(ValueError) as exc:
            importlib.reload(database)
    assert "DATABASE_URL environment variable is not set" in str(exc.value)
    
    if old_url:
        monkeypatch.setenv("DATABASE_URL", old_url)
    importlib.reload(database)

def test_get_db():
    from database import get_db
    generator = get_db()
    db_session = next(generator)
    assert db_session is not None
    try:
        next(generator)
    except StopIteration:
        pass

def test_main_allowed_origins_and_mkdir(monkeypatch):
    import main
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000, http://test.com")
    monkeypatch.setattr(Path, "exists", lambda x: False)
    mock_mkdir = MagicMock()
    monkeypatch.setattr(Path, "mkdir", mock_mkdir)
    importlib.reload(main)
    assert mock_mkdir.called

def test_root_and_health_endpoints(client):
    # GET /
    res = client.get("/")
    assert res.status_code == 200
    assert "Welcome" in res.json()["message"]
    
    # GET /health
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    
    # GET /health with error
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("db connection error")
    
    def override_get_db():
        yield mock_db
        
    client.app.dependency_overrides[get_db] = override_get_db
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "error"
    client.app.dependency_overrides.clear()

# ==================== TESTS: AUTH & USERS ====================

def test_auth_routes(client, db):
    admin_headers = get_auth_headers(client, db, "admin", "admin_user_auth")
    
    # 1. Listar usuários me
    res = client.get("/users/me", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["username"] == "admin_user_auth"
    
    # 2. Criar novo usuário (register)
    res = client.post(
        "/register",
        json={"username": "new_user", "password": "password123", "role": "professor"},
        headers=admin_headers
    )
    assert res.status_code == 201
    
    # 3. Listar usuários
    res = client.get("/users", headers=admin_headers)
    assert res.status_code == 200
    
    # 4. Atualizar role de usuário
    res = client.put(
        "/users/new_user/role",
        json={"role": "assistente"},
        headers=admin_headers
    )
    assert res.status_code == 200
    
    # 5. Alterar senha
    headers_user = get_auth_headers(client, db, "assistente", "new_user")
    res = client.post(
        "/change-password",
        json={"old_password": "password123", "new_password": "newpassword123", "confirm_password": "newpassword123"},
        headers=headers_user
    )
    assert res.status_code == 200
    
    # 6. Erros de validação e não encontrados (executados ANTES de deletar o usuário!)
    # Alterar senha com senha atual incorreta
    res = client.post(
        "/change-password",
        json={"old_password": "wrong", "new_password": "newpassword123", "confirm_password": "newpassword123"},
        headers=headers_user
    )
    assert res.status_code == 400
    
    # Alterar senha com confirmação incorreta
    res = client.post(
        "/change-password",
        json={"old_password": "newpassword123", "new_password": "newpassword1234", "confirm_password": "different"},
        headers=headers_user
    )
    assert res.status_code == 400

    # 7. Deletar usuário
    user_db = db.query(models.Usuario).filter(models.Usuario.username == "new_user").first()
    res = client.delete(f"/users/{user_db.id_usuario}", headers=admin_headers)
    assert res.status_code == 204

    res = client.delete("/users/99999", headers=admin_headers)
    assert res.status_code == 404
    
    res = client.put("/users/nonexistent/role", json={"role": "assistente"}, headers=admin_headers)
    assert res.status_code == 404

# ==================== TESTS: LOCAIS, ARBITROS, EVENTOS, MODALIDADES ====================

def test_locais_arbitros_eventos_modalidades(client, db):
    coord_headers = get_auth_headers(client, db, "coordenador", "coord_user_lem")
    
    # --- Locais ---
    res = client.post("/locais/", json={"loca_nome": "Local Router", "loca_descricao": "d"}, headers=coord_headers)
    assert res.status_code == 201
    id_local = res.json()["id_local"]
    
    res = client.get("/locais/", headers=coord_headers)
    assert res.status_code == 200
    
    res = client.get(f"/locais/{id_local}", headers=coord_headers)
    assert res.status_code == 200
    
    res = client.put(f"/locais/{id_local}", json={"loca_nome": "Local Updated", "loca_descricao": "d"}, headers=coord_headers)
    assert res.status_code == 200
    
    # --- Arbitros ---
    res = client.post("/arbitros/", json={"apito_nome": "Arbitro Router", "apito_doc": "123", "apito_tel": "1"}, headers=coord_headers)
    assert res.status_code == 201
    id_arbitro = res.json()["id_arbitro"]
    
    res = client.get("/arbitros/", headers=coord_headers)
    assert res.status_code == 200
    
    res = client.get(f"/arbitros/{id_arbitro}", headers=coord_headers)
    assert res.status_code == 200
    
    res = client.put(f"/arbitros/{id_arbitro}", json={"apito_nome": "Arbitro Updated", "apito_doc": "123", "apito_tel": "1"}, headers=coord_headers)
    assert res.status_code == 200
    
    # --- Eventos ---
    res = client.post("/eventos/", json={"even_nome": "Evento Router", "descricao": "d"}, headers=coord_headers)
    assert res.status_code == 201
    id_evento = res.json()["id_evento"]
    
    res = client.get("/eventos/", headers=coord_headers)
    assert res.status_code == 200
    
    res = client.get(f"/eventos/{id_evento}", headers=coord_headers)
    assert res.status_code == 200
    
    res = client.put(f"/eventos/{id_evento}", json={"even_nome": "Evento Updated", "descricao": "d"}, headers=coord_headers)
    assert res.status_code == 200
    
    # --- Modalidades ---
    res = client.post("/modalidades/", json={"nome": "Mod Router", "descricao": "d"}, headers=coord_headers)
    assert res.status_code == 201
    id_modalidade = res.json()["id_modalidade"]
    
    # Duplicate name check
    res_dup = client.post("/modalidades/", json={"nome": "Mod Router", "descricao": "dup"}, headers=coord_headers)
    assert res_dup.status_code == 400
    
    res = client.get("/modalidades/", headers=coord_headers)
    assert res.status_code == 200
    
    res = client.get(f"/modalidades/{id_modalidade}", headers=coord_headers)
    assert res.status_code == 200
    
    res = client.put(f"/modalidades/{id_modalidade}", json={"nome": "Mod Updated", "descricao": "d"}, headers=coord_headers)
    assert res.status_code == 200
    
    # --- 404 Errors ---
    for path, payload in [
        ("/locais/99999", {"loca_nome": "a"}),
        ("/arbitros/99999", {"apito_nome": "a", "apito_doc": "1", "apito_tel": "1"}),
        ("/eventos/99999", {"even_nome": "a"}),
        ("/modalidades/99999", {"nome": "a"}),
    ]:
        assert client.get(path, headers=coord_headers).status_code == 404
        assert client.put(path, json=payload, headers=coord_headers).status_code == 404
        assert client.delete(path, headers=coord_headers).status_code == 404
        
    # Deletions success
    assert client.delete(f"/modalidades/{id_modalidade}", headers=coord_headers).status_code == 204
    assert client.delete(f"/eventos/{id_evento}", headers=coord_headers).status_code == 204
    assert client.delete(f"/arbitros/{id_arbitro}", headers=coord_headers).status_code == 204
    assert client.delete(f"/locais/{id_local}", headers=coord_headers).status_code == 204

# ==================== TESTS: EDICOES, EQUIPES ====================

def test_edicoes_equipes(client, db):
    coord_headers = get_auth_headers(client, db, "coordenador", "coord_user_ee")
    
    # Criar evento para edicao
    res = client.post("/eventos/", json={"even_nome": "Evt EE", "descricao": "d"}, headers=coord_headers)
    id_evento = res.json()["id_evento"]
    
    # 1. Criar Edicao
    res = client.post(
        "/edicoes/",
        json={"id_evento": id_evento, "edic_ano": 2026, "tipo_competicao": "Mata-Mata", "data_inicio": "2026-01-01", "data_fim": "2026-03-01"},
        headers=coord_headers
    )
    assert res.status_code == 201
    id_edicao = res.json()["id_edicao"]
    
    # 2. CRUD Edicoes
    assert client.get("/edicoes/", headers=coord_headers).status_code == 200
    assert client.get(f"/edicoes/{id_edicao}", headers=coord_headers).status_code == 200
    res = client.put(
        f"/edicoes/{id_edicao}",
        json={"id_evento": id_evento, "edic_ano": 2026, "tipo_competicao": "Grupos", "data_inicio": "2026-01-01", "data_fim": "2026-03-01"},
        headers=coord_headers
    )
    assert res.status_code == 200
    
    # 3. Criar Equipe
    res = client.post("/equipes/", json={"nome": "Equipe Router", "id_edicao": id_edicao, "grupo": "A"}, headers=coord_headers)
    assert res.status_code == 201
    id_equipe = res.json()["id_equipe"]
    
    # 4. CRUD Equipes
    assert client.get("/equipes/", headers=coord_headers).status_code == 200
    assert client.get(f"/equipes/{id_equipe}", headers=coord_headers).status_code == 200
    assert client.get(f"/equipes/edicao/{id_edicao}", headers=coord_headers).status_code == 200
    
    # 5. Adicionar participante à equipe (inserindo direto no DB)
    part = models.Participante(tipo="aluno")
    db.add(part)
    db.commit()
    id_part = part.id_participante
    
    res = client.post(f"/equipes/{id_equipe}/participantes/{id_part}", headers=coord_headers)
    assert res.status_code == 200
    
    # 6. Clonar equipes
    res = client.post(
        "/edicoes/",
        json={"id_evento": id_evento, "edic_ano": 2027, "tipo_competicao": "Mata-Mata", "data_inicio": "2027-01-01", "data_fim": "2027-03-01"},
        headers=coord_headers
    )
    id_edicao_nova = res.json()["id_edicao"]
    
    res = client.post(f"/edicoes/{id_edicao_nova}/clonar-equipes?edicao_origem_id={id_edicao}", headers=coord_headers)
    assert res.status_code == 200
    
    # 404s
    assert client.get("/edicoes/99999", headers=coord_headers).status_code == 404
    assert client.put("/edicoes/99999", json={"id_evento": id_evento, "edic_ano": 2026, "tipo_competicao": "Grupos", "data_inicio": "2026-01-01", "data_fim": "2026-03-01"}, headers=coord_headers).status_code == 404
    assert client.delete("/edicoes/99999", headers=coord_headers).status_code == 404
    
    assert client.get("/equipes/99999", headers=coord_headers).status_code == 404
    assert client.delete("/equipes/99999", headers=coord_headers).status_code == 404
    
    # Delete success
    assert client.delete(f"/equipes/{id_equipe}", headers=coord_headers).status_code == 204
    assert client.delete(f"/edicoes/{id_edicao}", headers=coord_headers).status_code == 204
    assert client.delete(f"/edicoes/{id_edicao_nova}", headers=coord_headers).status_code == 204

# ==================== TESTS: PROFESSORES, TURMAS, MATRICULAS, PRESENCAS ====================

def test_professores_turmas_matriculas_presencas(client, db):
    coord_headers = get_auth_headers(client, db, "coordenador", "coord_ptmp")
    
    # --- Professores ---
    res = client.post(
        "/professores/",
        json={"nome": "Prof Router", "cpf": "12345678909", "contato": "123", "username": "prof_ptmp", "password": "password123"},
        headers=coord_headers
    )
    assert res.status_code == 201
    id_professor = res.json()["id_professor"]
    
    assert client.get("/professores/", headers=coord_headers).status_code == 200
    assert client.get(f"/professores/{id_professor}", headers=coord_headers).status_code == 200
    assert client.get(f"/professores/buscar/cpf/12345678909", headers=coord_headers).status_code == 200
    
    res = client.put(
        f"/professores/{id_professor}",
        json={"nome": "Prof Updated", "cpf": "12345678909", "contato": "1234"},
        headers=coord_headers
    )
    assert res.status_code == 200
    
    # --- Turmas ---
    res = client.post("/modalidades/", json={"nome": "Mod PTMP", "descricao": "d"}, headers=coord_headers)
    id_mod = res.json()["id_modalidade"]
    
    res = client.post(
        "/turmas/",
        json={
            "id_modalidade": id_mod, "id_professor": id_professor, "dias_semana": ["SEG", "QUA"],
            "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15",
            "descricao": "Turma Router", "vagas": 20
        },
        headers=coord_headers
    )
    assert res.status_code == 201
    id_turma = res.json()["id_turma"]
    
    assert client.get("/turmas/", headers=coord_headers).status_code == 200
    assert client.get(f"/turmas/{id_turma}", headers=coord_headers).status_code == 200
    assert client.get(f"/turmas/professor/{id_professor}", headers=coord_headers).status_code == 200
    assert client.get(f"/turmas/modalidade/{id_mod}", headers=coord_headers).status_code == 200
    
    # Update turma
    res = client.put(
        f"/turmas/{id_turma}",
        json={
            "id_modalidade": id_mod, "id_professor": id_professor, "dias_semana": ["SEG", "QUA"],
            "horario_inicio": "10:00:00", "horario_fim": "11:30:00", "categoria_idade": "Sub 15",
            "descricao": "Turma Router Updated", "vagas": 20
        },
        headers=coord_headers
    )
    assert res.status_code == 200
    
    # --- Aluno & Matrícula ---
    # Cadastrar aluno
    res = client.post(
        "/alunos/",
        data={
            "nome_completo": "Aluno PTMP", "data_nascimento": "2010-01-01", "escola": "E",
            "serie_ano": "9", "telefone_1": "123", "endereco": "Rua Principal 123", "ids_turmas": str(id_turma)
        },
        headers=coord_headers
    )
    assert res.status_code == 201
    id_aluno = res.json()["id_aluno"]
    id_matricula = res.json()["matriculas"][0]["id_matricula"]
    
    # Matrículas CRUD
    assert client.get("/matriculas/", headers=coord_headers).status_code == 200
    assert client.get(f"/matriculas/", params={"turma_id": id_turma}, headers=coord_headers).status_code == 200
    
    # --- Presenças ---
    res = client.post(
        "/presencas/lote",
        json={
            "data_aula": "2026-06-22",
            "id_turma": id_turma,
            "presencas": [{"id_matricula": id_matricula, "status": "Presente", "observacao": ""}]
        },
        headers=coord_headers
    )
    assert res.status_code == 201
    
    # Buscar presenças
    assert client.get(f"/presencas/turma/{id_turma}/data/2026-06-22", headers=coord_headers).status_code == 200
    
    # 404s
    assert client.get("/professores/99999", headers=coord_headers).status_code == 404
    assert client.get("/professores/buscar/cpf/99999999999", headers=coord_headers).status_code == 404
    assert client.put("/professores/99999", json={"nome": "a", "cpf": "11144477735"}, headers=coord_headers).status_code == 404
    assert client.delete("/professores/99999", headers=coord_headers).status_code == 404
    
    assert client.get("/turmas/99999", headers=coord_headers).status_code == 404
    assert client.put("/turmas/99999", json={"id_modalidade": id_mod, "id_professor": id_professor, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"}, headers=coord_headers).status_code == 404
    assert client.delete("/turmas/99999", headers=coord_headers).status_code == 404
    
    assert client.delete("/matriculas/99999", headers=coord_headers).status_code == 404
    
    # Tentar deletar modalidade com turmas vinculadas (IntegrityError/400)
    res_mod_del = client.delete(f"/modalidades/{id_mod}", headers=coord_headers)
    assert res_mod_del.status_code == 400
    
    # Teardown
    assert client.delete(f"/matriculas/{id_matricula}", headers=coord_headers).status_code == 204
    assert client.delete(f"/turmas/{id_turma}", headers=coord_headers).status_code == 204
    assert client.delete(f"/professores/{id_professor}", headers=coord_headers).status_code == 204
    assert client.delete(f"/modalidades/{id_mod}", headers=coord_headers).status_code == 204

# ==================== TESTS: ALUNOS (FILE UPLOAD/DOWNLOAD) & ATLETAS ====================

def test_alunos_atletas_and_files(client, db):
    coord_headers = get_auth_headers(client, db, "coordenador", "coord_aaf")
    
    # Criar turma para associar aluno
    res = client.post("/modalidades/", json={"nome": "Mod AAF", "descricao": "d"}, headers=coord_headers)
    id_mod = res.json()["id_modalidade"]
    res = client.post(
        "/professores/",
        json={"nome": "Prof AAF", "cpf": "11144477735", "contato": "123", "username": "prof_aaf", "password": "password123"},
        headers=coord_headers
    )
    assert res.status_code == 201
    id_prof = res.json()["id_professor"]
    res = client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "10:00:00", "horario_fim": "11:00:00", "categoria_idade": "Sub 15"},
        headers=coord_headers
    )
    id_turma = res.json()["id_turma"]
    
    # 1. Alunos: Cadastrar com files corretos
    res = client.post(
        "/alunos/",
        data={
            "nome_completo": "Aluno F", "data_nascimento": "2010-01-01", "escola": "E",
            "serie_ano": "9", "telefone_1": "123", "endereco": "Rua F", "ids_turmas": str(id_turma)
        },
        files={
            "foto": ("foto.png", io.BytesIO(b"fake png"), "image/png"),
            "documento": ("doc.pdf", io.BytesIO(b"fake pdf"), "application/pdf"),
            "atestado": ("ate.jpg", io.BytesIO(b"fake jpg"), "image/jpeg")
        },
        headers=coord_headers
    )
    assert res.status_code == 201
    id_aluno = res.json()["id_aluno"]
    
    # 2. Alunos: Put com files
    res = client.put(
        f"/alunos/{id_aluno}",
        data={"nome_completo": "Aluno F Updated"},
        files={
            "foto": ("foto2.png", io.BytesIO(b"fake png"), "image/png")
        },
        headers=coord_headers
    )
    assert res.status_code == 200
    
    # 3. Alunos: File errors (extensão incorreta)
    res = client.post(
        "/alunos/",
        data={"nome_completo": "Aluno Err Extension", "data_nascimento": "2010-01-01", "telefone_1": "123", "endereco": "Rua Err", "ids_turmas": str(id_turma)},
        files={"foto": ("foto.txt", io.BytesIO(b"fake txt"), "image/png")},
        headers=coord_headers
    )
    assert res.status_code == 400
    assert "extensão" in res.json()["detail"].lower()
    
    # 4. Alunos: File errors (MIME type incorreto)
    res = client.post(
        "/alunos/",
        data={"nome_completo": "Aluno Err MIME", "data_nascimento": "2010-01-01", "telefone_1": "123", "endereco": "Rua Err", "ids_turmas": str(id_turma)},
        files={"foto": ("foto.png", io.BytesIO(b"fake png"), "text/plain")},
        headers=coord_headers
    )
    assert res.status_code == 400
    assert "mime type" in res.json()["detail"].lower()
    
    # 5. Alunos: Buscas
    assert client.get(f"/alunos/buscar/nome/Aluno", headers=coord_headers).status_code == 200
    assert client.get(f"/alunos/buscar/escola/E", headers=coord_headers).status_code == 200
    assert client.get(f"/alunos/buscar/serie/9", headers=coord_headers).status_code == 200
    
    # 6. Atletas
    # Criar edicao e equipe
    res = client.post("/eventos/", json={"even_nome": "Evt Atl", "descricao": "d"}, headers=coord_headers)
    id_evt = res.json()["id_evento"]
    res = client.post("/edicoes/", json={"id_evento": id_evt, "edic_ano": 2026, "tipo_competicao": "Mata-Mata", "data_inicio": "2026-01-01", "data_fim": "2026-03-01"}, headers=coord_headers)
    id_ed = res.json()["id_edicao"]
    res = client.post("/equipes/", json={"nome": "Eq Atl", "id_edicao": id_ed}, headers=coord_headers)
    id_eq = res.json()["id_equipe"]
    
    res = client.post(
        f"/atletas/equipe/{id_eq}",
        data={
            "nome_completo": "Atleta Eq", "data_nascimento": "2005-01-01", "documento_pessoal": "1234",
            "contato": "123", "endereco": "R"
        },
        files={
            "foto": ("atleta.png", io.BytesIO(b"fake png"), "image/png")
        },
        headers=coord_headers
    )
    assert res.status_code == 200
    id_atleta = res.json()["id_atleta"]
    
    assert client.get("/atletas/", headers=coord_headers).status_code == 200
    assert client.get(f"/atletas/{id_atleta}", headers=coord_headers).status_code == 200
    
    # 7. File errors no Atleta (extensão incorreta)
    res = client.post(
        f"/atletas/equipe/{id_eq}",
        data={"nome_completo": "Atleta Err", "data_nascimento": "2005-01-01", "documento_pessoal": "1234"},
        files={"foto": ("foto.txt", io.BytesIO(b"fake txt"), "image/png")},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    # 8. File errors no Atleta (MIME type incorreto)
    res = client.post(
        f"/atletas/equipe/{id_eq}",
        data={"nome_completo": "Atleta Err", "data_nascimento": "2005-01-01", "documento_pessoal": "1234"},
        files={"foto": ("foto.png", io.BytesIO(b"fake png"), "text/plain")},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    # Delete
    assert client.delete(f"/atletas/{id_atleta}", headers=coord_headers).status_code == 204
    assert client.delete(f"/alunos/{id_aluno}", headers=coord_headers).status_code == 204
    assert client.delete(f"/equipes/{id_eq}", headers=coord_headers).status_code == 204
    assert client.delete(f"/edicoes/{id_ed}", headers=coord_headers).status_code == 204
    assert client.delete(f"/eventos/{id_evt}", headers=coord_headers).status_code == 204
    assert client.delete(f"/turmas/{id_turma}", headers=coord_headers).status_code == 204
    assert client.delete(f"/professores/{id_prof}", headers=coord_headers).status_code == 204
    assert client.delete(f"/modalidades/{id_mod}", headers=coord_headers).status_code == 204

# ==================== TESTS: PARTIDAS & PUBLIC ====================

def test_partidas_and_public(client, db):
    coord_headers = get_auth_headers(client, db, "coordenador", "coord_part")
    
    # Setup
    res = client.post("/locais/", json={"loca_nome": "Local P", "loca_descricao": "d"}, headers=coord_headers)
    id_local = res.json()["id_local"]
    res = client.post("/arbitros/", json={"apito_nome": "Ref P", "apito_doc": "1", "apito_tel": "1"}, headers=coord_headers)
    id_arbitro = res.json()["id_arbitro"]
    res = client.post("/modalidades/", json={"nome": "Mod P", "descricao": "d"}, headers=coord_headers)
    id_mod = res.json()["id_modalidade"]
    res = client.post("/eventos/", json={"even_nome": "Evt P", "descricao": "d"}, headers=coord_headers)
    id_evento = res.json()["id_evento"]
    res = client.post("/edicoes/", json={"id_evento": id_evento, "edic_ano": 2026, "tipo_competicao": "Mata-Mata", "data_inicio": "2026-01-01", "data_fim": "2026-03-01"}, headers=coord_headers)
    id_edicao = res.json()["id_edicao"]
    res = client.post("/equipes/", json={"nome": "Eq P1", "id_edicao": id_edicao}, headers=coord_headers)
    id_eq1 = res.json()["id_equipe"]
    res = client.post("/equipes/", json={"nome": "Eq P2", "id_edicao": id_edicao}, headers=coord_headers)
    id_eq2 = res.json()["id_equipe"]
    
    # Criar final primeiro (para usar como id_proxima_partida)
    res_final = client.post(
        "/partidas/",
        json={
            "id_edicao": id_edicao, "id_local": id_local, "id_arbitro": id_arbitro, "id_modalidade": id_mod,
            "part_data": "2026-06-22", "part_hora": "16:00:00", "fase": "Final"
        },
        headers=coord_headers
    )
    id_final = res_final.json()["id_partida"]
    
    # 1. Criar Partida Semifinal (que tem próxima partida = id_final)
    res = client.post(
        "/partidas/",
        json={
            "id_edicao": id_edicao, "id_local": id_local, "id_arbitro": id_arbitro, "id_modalidade": id_mod,
            "id_equipe_casa": id_eq1, "id_equipe_visitante": id_eq2,
            "part_data": "2026-06-22", "part_hora": "14:00:00", "fase": "Semifinal",
            "id_proxima_partida": id_final
        },
        headers=coord_headers
    )
    assert res.status_code == 201
    id_partida = res.json()["id_partida"]
    
    # 2. Get/List
    assert client.get(f"/partidas/edicao/{id_edicao}", headers=coord_headers).status_code == 200
    
    # 3. Finalizar partida com empate ( mata-mata com proxima partida deve falhar com 400 )
    res = client.put(
        f"/partidas/{id_partida}",
        json={"placar_casa": 2, "placar_visitante": 2, "status": "Finalizada"},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    # Finalizar com sucesso
    res = client.put(
        f"/partidas/{id_partida}",
        json={"placar_casa": 3, "placar_visitante": 1, "status": "Finalizada"},
        headers=coord_headers
    )
    assert res.status_code == 200
    
    # 4. Upload súmula
    res = client.post(
        f"/partidas/{id_partida}/sumula",
        files={"file": ("sumula.png", io.BytesIO(b"fake png"), "image/png")},
        headers=coord_headers
    )
    assert res.status_code == 200
    
    # Upload sumula com tipo invalido
    res = client.post(
        f"/partidas/{id_partida}/sumula",
        files={"file": ("sumula.txt", io.BytesIO(b"fake txt"), "text/plain")},
        headers=coord_headers
    )
    assert res.status_code == 400
    
    # 5. Registrar estatísticas
    # Criar um participante/aluno para ter estatísticas
    res = client.post(
        "/professores/",
        json={"nome": "Prof P", "cpf": "12345678909", "contato": "123", "username": "prof_p", "password": "password123"},
        headers=coord_headers
    )
    id_prof = res.json()["id_professor"]
    res = client.post(
        "/turmas/",
        json={"id_modalidade": id_mod, "id_professor": id_prof, "dias_semana": ["SEG"], "horario_inicio": "14:00:00", "horario_fim": "15:00:00", "categoria_idade": "Sub 15"},
        headers=coord_headers
    )
    id_turma = res.json()["id_turma"]
    res = client.post(
        "/alunos/",
        data={"nome_completo": "Jogador P", "data_nascimento": "2010-01-01", "telefone_1": "123", "endereco": "Rua P", "escola": "Escola P", "serie_ano": "9", "ids_turmas": str(id_turma)},
        headers=coord_headers
    )
    id_aluno = res.json()["id_aluno"]
    aluno_db = db.query(models.Aluno).filter(models.Aluno.id_aluno == id_aluno).first()
    id_part = aluno_db.id_participante
    
    # Vincular participante ao time
    db.execute(models.equipes_participantes.insert().values(id_equipe=id_eq1, id_participante=id_part))
    db.commit()
    
    # Enviar estatística
    res = client.post(
        f"/partidas/{id_partida}/estatisticas",
        json={"id_participante": id_part, "gols": 2, "cartoes_amarelos": 1, "cartoes_vermelhos": 0},
        headers=coord_headers
    )
    assert res.status_code == 201
    id_estatistica = res.json()["id_estatistica"]
    
    # Listar estatísticas
    assert client.get(f"/partidas/{id_partida}/estatisticas", headers=coord_headers).status_code == 200
    
    # Atualizar estatística
    res = client.put(
        f"/partidas/{id_partida}/estatisticas/{id_estatistica}",
        json={"id_participante": id_part, "gols": 3, "cartoes_amarelos": 1, "cartoes_vermelhos": 0},
        headers=coord_headers
    )
    assert res.status_code == 200
    
    # 6. Publico endpoints (no auth)
    assert client.get("/publico/eventos").status_code == 200
    assert client.get(f"/publico/edicoes/{id_edicao}/partidas").status_code == 200
    assert client.get(f"/publico/edicoes/{id_edicao}/estatisticas").status_code == 200
    
    # 7. Reabrir partida (status="Agendada")
    res = client.put(
        f"/partidas/{id_partida}",
        json={"placar_casa": 0, "placar_visitante": 0, "status": "Agendada"},
        headers=coord_headers
    )
    assert res.status_code == 200
    
    # Remover estatística
    res = client.delete(f"/partidas/{id_partida}/estatisticas/{id_estatistica}", headers=coord_headers)
    assert res.status_code == 204
    
    # Erros 404
    assert client.get("/partidas/99999/estatisticas", headers=coord_headers).status_code == 404
    assert client.delete("/partidas/99999/estatisticas/99999", headers=coord_headers).status_code == 404
    
    # Clean up
    assert client.delete(f"/partidas/{id_partida}", headers=coord_headers).status_code == 204
    assert client.delete(f"/partidas/{id_final}", headers=coord_headers).status_code == 204
    assert client.delete(f"/alunos/{id_aluno}", headers=coord_headers).status_code == 204
    assert client.delete(f"/turmas/{id_turma}", headers=coord_headers).status_code == 204
    assert client.delete(f"/professores/{id_prof}", headers=coord_headers).status_code == 204
    assert client.delete(f"/equipes/{id_eq1}", headers=coord_headers).status_code == 204
    assert client.delete(f"/equipes/{id_eq2}", headers=coord_headers).status_code == 204
    assert client.delete(f"/edicoes/{id_edicao}", headers=coord_headers).status_code == 204
    assert client.delete(f"/eventos/{id_evento}", headers=coord_headers).status_code == 204
    assert client.delete(f"/modalidades/{id_mod}", headers=coord_headers).status_code == 204
    assert client.delete(f"/arbitros/{id_arbitro}", headers=coord_headers).status_code == 204
    assert client.delete(f"/locais/{id_local}", headers=coord_headers).status_code == 204
