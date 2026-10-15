"""Fixtures da consolidacao: SQLite descartavel sob ``tmp_path_factory``.

Toda conexao aberta por estas fixtures liga ``PRAGMA foreign_keys=ON``; sem
isso o SQLite ignora as chaves estrangeiras e os testes de FK passariam por
acidente. O schema dos testes de constraint vem da cadeia Alembic (DDL
congelado), nao de ``create_all``.
"""

from __future__ import annotations

import os
import shutil
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[2]
APP_DIR = ROOT / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "competition-test-secret")

REVISAO_ANTERIOR = "20261015_0100"
REVISAO_CONSOLIDACAO = "20261015_0200"
REVISAO_FATIA2 = "20261015_0300"


@dataclass
class BancoSqlite:
    url: str
    engine: Engine

    def tabelas(self) -> set[str]:
        return set(inspect(self.engine).get_table_names())


def engine_com_fk(url: str) -> Engine:
    engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _ligar_fk(conexao_dbapi, _registro):
        cursor = conexao_dbapi.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def config_alembic(url: str, *, descartar: bool) -> Config:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    config.attributes["database_url"] = url
    if descartar:
        config.attributes["descartar_competicoes_teste"] = True
    return config


def _novo_banco(diretorio: Path, nome: str) -> BancoSqlite:
    url = f"sqlite:///{diretorio / nome}"
    return BancoSqlite(url=url, engine=engine_com_fk(url))


@pytest.fixture(scope="session")
def _modelo_na_head(tmp_path_factory) -> Path:
    """Banco migrado ate a head uma vez; cada teste trabalha numa copia."""
    caminho = tmp_path_factory.mktemp("consolidacao_modelo") / "head.sqlite"
    command.upgrade(config_alembic(f"sqlite:///{caminho}", descartar=True), "head")
    return caminho


@pytest.fixture()
def sqlite_na_head(_modelo_na_head, tmp_path_factory):
    destino = tmp_path_factory.mktemp("consolidacao_head") / "head.sqlite"
    shutil.copyfile(_modelo_na_head, destino)
    banco = BancoSqlite(url=f"sqlite:///{destino}", engine=engine_com_fk(f"sqlite:///{destino}"))
    yield banco
    banco.engine.dispose()


@pytest.fixture()
def schema_migrado(sqlite_na_head):
    return inspect(sqlite_na_head.engine)


@pytest.fixture()
def db(sqlite_na_head):
    sessao = sessionmaker(autoflush=False, bind=sqlite_na_head.engine)()
    try:
        yield sessao
    finally:
        sessao.rollback()
        sessao.close()


@pytest.fixture()
def client(db):
    """HTTP real sobre a mesma sessao isolada, sem substituir autenticacao."""
    from fastapi.testclient import TestClient
    from database import get_db
    from main import app

    overrides_anteriores = app.dependency_overrides.copy()

    def obter_sessao():
        yield db

    app.dependency_overrides[get_db] = obter_sessao
    try:
        with TestClient(app) as cliente:
            yield cliente
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(overrides_anteriores)


@pytest.fixture()
def usuario(db):
    """Autor coordenador duravel mesmo se a operacao testada der rollback."""
    from models import Usuario

    autor = Usuario(username="teste-coordenador", password_hash="hash-nao-utilizado",
                    role="coordenador", must_change_password=False)
    db.add(autor)
    db.commit()
    db.refresh(autor)
    return autor


@pytest.fixture()
def cabecalhos_por_papel(db, usuario) -> Callable[[str | None], dict[str, str]]:
    """Use cabecalhos_por_papel(role); None representa acesso sem token.

    As contas sao persistidas no setup, evitando commit de dados da operacao
    quando o teste pedir um cabecalho. A conta coordenadora e a fixture usuario.
    """
    from models import Usuario
    from security import create_access_token

    usuarios = {"coordenador": usuario}
    for papel in ("admin", "professor", "assistente"):
        usuarios[papel] = Usuario(
            username=f"teste-{papel}", password_hash="hash-nao-utilizado",
            role=papel, must_change_password=False,
        )
        db.add(usuarios[papel])
    db.commit()

    def criar_cabecalhos(papel: str | None) -> dict[str, str]:
        if papel is None:
            return {}
        token = create_access_token({"sub": usuarios[papel].username})
        return {"Authorization": f"Bearer {token}"}

    return criar_cabecalhos


@pytest.fixture()
def sqlite_na_revisao_anterior(tmp_path_factory):
    banco = _novo_banco(tmp_path_factory.mktemp("consolidacao_anterior"), "anterior.sqlite")
    command.upgrade(config_alembic(banco.url, descartar=False), REVISAO_ANTERIOR)
    yield banco
    banco.engine.dispose()


@pytest.fixture()
def sqlite_com_dados_sinteticos(sqlite_na_revisao_anterior):
    """Baseline com escolinhas e dados esportivos antigos misturados."""
    from .factories import popular_snapshot_sintetico

    popular_snapshot_sintetico(sqlite_na_revisao_anterior.engine)
    return sqlite_na_revisao_anterior
