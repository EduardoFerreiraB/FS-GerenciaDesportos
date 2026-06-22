import pytest
from security import get_password_hash
import models

def test_criar_usuario_e_login(client, db):
    # 1. Registrar um coordenador no banco usando hash
    admin_user = models.Usuario(
        username="admin_test",
        password_hash=get_password_hash("admin123"),
        role="admin",
        must_change_password=False
    )
    db.add(admin_user)
    db.commit()

    # 2. Obter token de acesso por login
    login_response = client.post(
        "/token",
        data={"username": "admin_test", "password": "admin123"}
    )
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data
    assert "refresh_token" in token_data
    
    # 3. Testar a rota de refresh token
    refresh_response = client.post(
        "/refresh",
        json={"refresh_token": token_data["refresh_token"]}
    )
    assert refresh_response.status_code == 200
    new_token_data = refresh_response.json()
    assert "access_token" in new_token_data
    assert "refresh_token" in new_token_data
    assert new_token_data["refresh_token"] != token_data["refresh_token"]

def test_restricao_de_perfil_usuario(client, db):
    # Criar um usuário comum sem privilégios
    common_user = models.Usuario(
        username="professor_test",
        password_hash=get_password_hash("pass123"),
        role="professor",
        must_change_password=False
    )
    db.add(common_user)
    db.commit()

    # Login como professor
    login_response = client.post(
        "/token",
        data={"username": "professor_test", "password": "pass123"}
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Tentar acessar endpoint restrito a admin (/users)
    users_response = client.get("/users", headers=headers)
    assert users_response.status_code == 403
