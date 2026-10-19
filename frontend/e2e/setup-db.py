import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = Path(__file__).resolve().parent.parent / "e2e.db"
DB_URL = f"sqlite:///{DB_PATH}"

os.environ["DATABASE_URL"] = DB_URL

# Banco descartável: recriado do zero a cada execução, para que dados de rodadas
# anteriores (alunos homônimos, competições antigas) não interfiram nos testes.
DB_PATH.unlink(missing_ok=True)

print(f"Aplicando migrações no banco SQLite E2E: {DB_PATH} ...")
subprocess.run(
    [sys.executable, "-m", "alembic", "-x", "descartar_competicoes_teste=sim", "upgrade", "head"],
    check=True,
    cwd=str(ROOT_DIR),
    env=dict(os.environ, DATABASE_URL=DB_URL),
)

sys.path.insert(0, str(ROOT_DIR / "app"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models
from security import get_password_hash

engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)

with Session() as db:
    admin = db.query(models.Usuario).filter_by(username="admin").first()
    if not admin:
        db.add(models.Usuario(username="admin", password_hash=get_password_hash("admin123"), role="admin", must_change_password=False))
        print("Usuário 'admin' criado com sucesso.")

    coord = db.query(models.Usuario).filter_by(username="coordenador").first()
    if not coord:
        db.add(models.Usuario(username="coordenador", password_hash=get_password_hash("coord123"), role="coordenador", must_change_password=False))
        print("Usuário 'coordenador' criado com sucesso.")

    modalidade = db.query(models.Modalidade).first()
    if not modalidade:
        db.add(models.Modalidade(nome="Futebol"))
        print("Modalidade 'Futebol' criada com sucesso.")

    db.commit()

print("Banco SQLite E2E pronto para uso.")
