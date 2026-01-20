import sys
import os

# Adiciona o diretório 'app' ao path do Python para permitir imports como se estivesse dentro dele
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import security

def create_super_user():
    db = SessionLocal()
    
    print("--- Criar Super Usuário (Admin) ---")
    username = input("Username: ")
    password = input("Password: ")
    
    if not username or not password:
        print("Erro: Username e Password são obrigatórios.")
        return

    # Verifica se já existe
    existing_user = db.query(models.Usuario).filter(models.Usuario.username == username).first()
    if existing_user:
        print(f"Erro: Usuário '{username}' já existe.")
        return

    # Cria o usuário
    hashed_password = security.get_password_hash(password)
    db_user = models.Usuario(
        username=username,
        password_hash=hashed_password,
        role="admin" # Força role de Admin
    )
    
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        print(f"Sucesso! Admin '{username}' criado com ID: {db_user.id_usuario}")
    except Exception as e:
        print(f"Erro ao criar usuário: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # Garante que as tabelas existem
    models.Base.metadata.create_all(bind=engine)
    create_super_user()
