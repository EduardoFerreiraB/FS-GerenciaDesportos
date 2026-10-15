from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from database import Base
import models
import schemas
from routers import equipes as equipes_router
from services import equipes as equipes_service


def test_create_all_cria_coluna_de_competicao_para_novo_banco():
    # Removing the model field would make new create_all databases miss the team scope.
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    assert "id_competicao" in {column["name"] for column in inspect(engine).get_columns("equipes")}


def test_rota_legada_rejeita_criacao_sem_competicao():
    # Removing the route guard would let the legacy endpoint bypass competition validation.
    with pytest.raises(HTTPException) as erro:
        equipes_router.criar_equipe(
            schemas.EquipeCreate(nome="Equipe legada", id_edicao=1),
            MagicMock(),
            None,
        )

    assert erro.value.status_code == 422


def test_servico_legado_nao_persiste_equipe_sem_competicao():
    # Restoring the old edition-only service would let a future legacy route bypass competition validation.
    with pytest.raises(ValueError, match="id_competicao"):
        equipes_service.criar_equipe(
            MagicMock(),
            schemas.EquipeCreate(nome="Equipe legada", id_edicao=1),
        )


def test_servico_de_equipes_rejeita_competicao_individual():
    # Removing the service guard would allow a non-router caller to create a team in an individual competition.
    competicao = MagicMock(id_competicao=1, id_edicao=1, modo_inscricao="INDIVIDUAL")

    with pytest.raises(ValueError, match="não aceita equipes"):
        equipes_service.criar_equipe_competicao(
            MagicMock(),
            competicao,
            schemas.EquipeCompeticaoCreate(nome="Equipe indevida"),
        )


def test_leitura_historica_de_equipes_sem_competicao_permanece_disponivel():
    # Filtering all reads by competition would hide teams created before the competition model.
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    equipe_historica = models.Equipe(nome="Equipe histórica", id_edicao=1)
    session.add(equipe_historica)
    session.commit()

    equipes = equipes_service.listar_equipes(session)

    assert [equipe.nome for equipe in equipes] == ["Equipe histórica"]
    assert equipes[0].id_competicao is None
