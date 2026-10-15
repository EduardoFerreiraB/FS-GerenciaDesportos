"""Isolated HTTP/database fixtures for the competition-draft contract.

This suite intentionally does not import ``tests/conftest.py`` because that
legacy fixture creates and drops the developer ``test.db`` database.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import anyio
import httpx
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "app"
sys.path.insert(0, str(APP_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "competition-test-secret")

import models
from database import Base, get_db
from main import app


class ASGIClient:
    """Small synchronous façade over HTTPX's in-process ASGI transport."""

    def request(self, method, url, **kwargs):
        async def send():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.request(method, url, **kwargs)

        return anyio.run(send)

    def get(self, url, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url, **kwargs):
        return self.request("POST", url, **kwargs)

    def put(self, url, **kwargs):
        return self.request("PUT", url, **kwargs)

    def delete(self, url, **kwargs):
        return self.request("DELETE", url, **kwargs)


@pytest.fixture()
def db(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'competition.sqlite'}",
        connect_args={"check_same_thread": False},
    )
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    session = sessionmaker(autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield ASGIClient()
    finally:
        app.dependency_overrides.clear()
