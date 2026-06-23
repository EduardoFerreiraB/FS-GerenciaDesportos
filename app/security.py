from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models
import os
from dotenv import load_dotenv

load_dotenv()

# Configurações JWT
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or SECRET_KEY == "chave_secreta_para_desenvolvimento_local":
    # Em um cenário real, você pode lançar uma exceção ou emitir um aviso crítico.
    # Para garantir a segurança, exigiremos que a SECRET_KEY seja definida.
    if os.getenv("ENV") == "production":
        raise ValueError("SECRET_KEY deve ser definida e segura em ambiente de produção!")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.Usuario).filter(models.Usuario.username == username).first()
    if user is None:
        raise credentials_exception
    return user

import uuid

async def get_current_active_user(current_user: models.Usuario = Depends(get_current_user)):
    return current_user

async def check_admin_role(current_user: models.Usuario = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado: Requer privilégios de Administrador")
    return current_user

async def check_coordenador_role(current_user: models.Usuario = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "coordenador"]:
        raise HTTPException(status_code=403, detail="Acesso negado: Requer privilégios de Coordenador ou Administrador")
    return current_user

async def check_professor_role(current_user: models.Usuario = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "coordenador", "professor"]:
        raise HTTPException(status_code=403, detail="Acesso negado: Requer privilégios de Professor, Coordenador ou Administrador")
    return current_user

async def check_assistente_role(current_user: models.Usuario = Depends(get_current_active_user)):
    if current_user.role not in ["admin", "coordenador", "assistente"]:
        raise HTTPException(status_code=403, detail="Acesso negado: Requer privilégios de Assistente, Coordenador ou Administrador")
    return current_user

def create_refresh_token(db: Session, id_usuario: int) -> str:
    token_str = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    db_token = models.RefreshToken(
        id_usuario=id_usuario,
        token=token_str,
        expires_at=expires_at,
        revoked=False
    )
    db.add(db_token)

    # Limpar tokens antigos revogados ou expirados do mesmo usuário para evitar crescimento infinito
    now = datetime.utcnow()
    db.query(models.RefreshToken).filter(
        models.RefreshToken.id_usuario == id_usuario,
        (models.RefreshToken.revoked == True) | 
        (models.RefreshToken.expires_at < now)
    ).delete(synchronize_session=False)

    db.commit()
    db.refresh(db_token)
    return token_str
