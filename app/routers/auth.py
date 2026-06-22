from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
import models
from security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    check_admin_role,
    check_coordenador_role,
    get_password_hash,
    get_current_user
)
from datetime import timedelta, datetime, timezone
from typing import List
from schemas import (
    Token,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdateRole,
    ChangePassword,
    RefreshTokenRequest
)

router = APIRouter(
    tags=["Autenticação"],
)

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(db=db, id_usuario=user.id_usuario)
    return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token}

@router.post("/refresh", response_model=Token)
def refresh_token(request_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    db_token = db.query(models.RefreshToken).filter(
        models.RefreshToken.token == request_data.refresh_token,
        models.RefreshToken.revoked == False
    ).first()

    if not db_token:
        raise HTTPException(status_code=401, detail="Refresh token inválido ou revogado.")

    expires_at = db_token.expires_at
    # Handle offset-naive or aware datetimes
    if expires_at.tzinfo is not None:  # pragma: no cover
        now = datetime.now(timezone.utc)
    else:
        now = datetime.utcnow()

    if expires_at < now:
        db_token.revoked = True
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expirado.")

    user = db_token.usuario
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    # Revoke current token and rotate
    db_token.revoked = True
    db.commit()

    new_refresh_token = create_refresh_token(db=db, id_usuario=user.id_usuario)

    return {"access_token": new_access_token, "token_type": "bearer", "refresh_token": new_refresh_token}

@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    password_data: ChangePassword,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    if not verify_password(password_data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")

    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(status_code=400, detail="As novas senhas não conferem.")
    current_user.password_hash = get_password_hash(password_data.new_password)
    current_user.must_change_password = False
    
    db.commit()
    
    return {"message": "Senha alterada com sucesso."}

@router.get("/users/me", response_model=UsuarioResponse)
async def read_users_me(current_user: models.Usuario = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=List[UsuarioResponse])
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(check_admin_role)
):
    users = db.query(models.Usuario).offset(skip).limit(limit).all()
    return users

@router.post("/register", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user: UsuarioCreate, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    # Coordinators can only create professors or assistants
    if current_user.role == "coordenador" and user.role in ["admin", "coordenador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Acesso negado: Coordenadores só podem criar usuários de nível inferior (professor ou assistente)."
        )

    db_user = db.query(models.Usuario).filter(models.Usuario.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Nome de usuário já cadastrado.")
    
    hashed_password = get_password_hash(user.password)
    new_user = models.Usuario(
        username=user.username,
        password_hash=hashed_password,
        role=user.role,
        must_change_password=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/users/{username}/role", response_model=UsuarioResponse)
def update_user_role(
    username: str, 
    role_data: UsuarioUpdateRole, 
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    db_user = db.query(models.Usuario).filter(models.Usuario.username == username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    if current_user.role == "coordenador":
        if db_user.role in ["admin", "coordenador"] or role_data.role in ["admin", "coordenador"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Acesso negado: Coordenadores não podem alterar privilégios de administradores ou outros coordenadores."
            )

    db_user.role = role_data.role
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/users/{id_usuario}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    id_usuario: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role)
):
    if current_user.id_usuario == id_usuario:
        raise HTTPException(status_code=400, detail="Você não pode excluir sua própria conta.")
    
    user_to_delete = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    if current_user.role == "coordenador" and user_to_delete.role in ["admin", "coordenador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: Coordenadores não podem excluir administradores ou outros coordenadores."
        )

    try:
        db.delete(user_to_delete)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Não é possível excluir este usuário. Ele pode estar vinculado a um Professor ou outro registro.")
    
    return None
