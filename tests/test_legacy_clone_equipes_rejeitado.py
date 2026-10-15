from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from routers import edicoes as edicoes_router
from services import edicoes as edicoes_service


MENSAGEM_CLONAGEM_LEGADA = "clonagem direcionada por competição"


def test_servico_de_clonagem_legada_rejeita_criacao_apenas_por_edicao():
    with pytest.raises(ValueError, match=MENSAGEM_CLONAGEM_LEGADA):
        edicoes_service.clonar_equipes(MagicMock(), 1, 2)


def test_endpoint_de_clonagem_legada_responde_conflito():
    with patch(
        "routers.edicoes.edicao_service.clonar_equipes",
        side_effect=ValueError(
            "Clonagem de equipes por edição está indisponível até que exista clonagem direcionada por competição."
        ),
    ):
        with pytest.raises(HTTPException) as erro:
            edicoes_router.clonar_equipes(2, 1, MagicMock(), None)

    assert erro.value.status_code == 409
    assert MENSAGEM_CLONAGEM_LEGADA in erro.value.detail
