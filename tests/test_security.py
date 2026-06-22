import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
from jose import jwt, JWTError
from fastapi import HTTPException
import models
from security import (
    SECRET_KEY,
    ALGORITHM,
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    check_admin_role,
    check_coordenador_role,
    check_professor_role,
    check_assistente_role,
    create_refresh_token,
    get_current_active_user
)

@pytest.mark.asyncio
async def test_get_current_active_user():
    user = models.Usuario(username="active", role="professor")
    assert await get_current_active_user(user) == user

def test_password_hashing():
    password = "secret_password"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False

def test_create_access_token_custom_delta():
    data = {"sub": "testuser"}
    delta = timedelta(minutes=5)
    token = create_access_token(data, expires_delta=delta)
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == "testuser"
    assert "exp" in decoded

def test_create_access_token_default_delta():
    data = {"sub": "testuser"}
    token = create_access_token(data)
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == "testuser"
    assert "exp" in decoded

@pytest.mark.asyncio
async def test_get_current_user_success(db):
    user = models.Usuario(username="testuser", password_hash="hash", role="professor")
    db.add(user)
    db.commit()

    token = create_access_token({"sub": "testuser"})
    retrieved_user = await get_current_user(token, db)
    assert retrieved_user.id_usuario == user.id_usuario

@pytest.mark.asyncio
async def test_get_current_user_invalid_token(db):
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user("invalid_token_xyz", db)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Não foi possível validar as credenciais"

@pytest.mark.asyncio
async def test_get_current_user_no_sub(db):
    token = jwt.encode({"key": "val"}, SECRET_KEY, algorithm=ALGORITHM)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token, db)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Não foi possível validar as credenciais"

@pytest.mark.asyncio
async def test_get_current_user_not_found(db):
    token = create_access_token({"sub": "nonexistent"})
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token, db)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Não foi possível validar as credenciais"

@pytest.mark.asyncio
async def test_check_roles():
    admin = models.Usuario(username="admin", role="admin")
    coord = models.Usuario(username="coord", role="coordenador")
    prof = models.Usuario(username="prof", role="professor")
    assist = models.Usuario(username="assist", role="assistente")

    # Admin checks
    assert await check_admin_role(admin) == admin
    with pytest.raises(HTTPException) as exc_info:
        await check_admin_role(coord)
    assert exc_info.value.status_code == 403

    # Coordenador checks
    assert await check_coordenador_role(admin) == admin
    assert await check_coordenador_role(coord) == coord
    with pytest.raises(HTTPException) as exc_info:
        await check_coordenador_role(prof)
    assert exc_info.value.status_code == 403

    # Professor checks
    assert await check_professor_role(admin) == admin
    assert await check_professor_role(coord) == coord
    assert await check_professor_role(prof) == prof
    with pytest.raises(HTTPException) as exc_info:
        await check_professor_role(assist)
    assert exc_info.value.status_code == 403

    # Assistente checks
    assert await check_assistente_role(admin) == admin
    assert await check_assistente_role(coord) == coord
    assert await check_assistente_role(assist) == assist
    with pytest.raises(HTTPException) as exc_info:
        await check_assistente_role(prof)
    assert exc_info.value.status_code == 403

def test_create_refresh_token_and_cleanup(db):
    user = models.Usuario(username="refresh_user", password_hash="hash", role="professor")
    db.add(user)
    db.commit()

    # Adicionar tokens antigos expiráveis/revogáveis para verificar a limpeza
    old_revoked = models.RefreshToken(
        id_usuario=user.id_usuario,
        token="old_revoked",
        expires_at=datetime.utcnow() + timedelta(days=5),
        revoked=True
    )
    old_expired = models.RefreshToken(
        id_usuario=user.id_usuario,
        token="old_expired",
        expires_at=datetime.utcnow() - timedelta(days=1),
        revoked=False
    )
    db.add_all([old_revoked, old_expired])
    db.commit()

    new_token = create_refresh_token(db, user.id_usuario)
    assert isinstance(new_token, str)

    # Verificar que novos tokens existem e antigos foram excluídos
    tokens = db.query(models.RefreshToken).filter(models.RefreshToken.id_usuario == user.id_usuario).all()
    assert len(tokens) == 1
    assert tokens[0].token == new_token

def test_security_production_secret_key_check():
    # Testar quando ENV é production e SECRET_KEY é chave padrão
    with patch.dict("os.environ", {"ENV": "production", "SECRET_KEY": "chave_secreta_para_desenvolvimento_local"}):
        with patch("os.getenv", side_effect=lambda key, default=None: "chave_secreta_para_desenvolvimento_local" if key == "SECRET_KEY" else "production" if key == "ENV" else default):
            # Recarregar/reavaliar a verificação de chave
            with pytest.raises(ValueError) as exc_info:
                import importlib
                import security
                importlib.reload(security)
            assert "SECRET_KEY deve ser definida e segura" in str(exc_info.value)
    
    # Recarregar de volta para limpar o estado global do módulo security
    import importlib
    import security
    importlib.reload(security)
