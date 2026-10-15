"""Modelos definitivos do dominio de competicoes.

Todos usam ``database.Base``. ``EdicaoCompeticao.id_edicao_competicao`` e a
chave que todo vinculo esportivo das fatias seguintes referencia.

Restricoes CHECK declaradas aqui sao defesa em profundidade: o TiDB as ignora
por padrao, entao a camada de servico precisa repetir cada uma (lista em
``CHECKS_PARA_SERVICO``).
"""

from competicoes.modelos.operacao import AuditoriaCompeticao, RequisicaoPartida
from competicoes.modelos.organizacao import (
    Competicao,
    EdicaoCompeticao,
    EdicaoEvento,
    Evento,
    ESTADOS_EDICAO,
    FORMATOS_EDICAO,
)
from competicoes.modelos.pessoas import (
    Competidor,
    Equipe,
    IntegranteEquipe,
    SITUACOES_EQUIPE,
    SITUACOES_INTEGRANTE,
)

CHECKS_PARA_SERVICO = {
    "ck_edicoes_evento_periodo": ("edicoes_evento", "data_inicio <= data_fim"),
    "ck_edicoes_competicao_periodo": ("edicoes_competicao", "data_inicio <= data_fim"),
    "ck_edicoes_competicao_revisao": ("edicoes_competicao", "revisao >= 1"),
}

__all__ = [
    "AuditoriaCompeticao",
    "CHECKS_PARA_SERVICO",
    "Competicao",
    "Competidor",
    "ESTADOS_EDICAO",
    "EdicaoCompeticao",
    "EdicaoEvento",
    "Equipe",
    "Evento",
    "FORMATOS_EDICAO",
    "IntegranteEquipe",
    "RequisicaoPartida",
    "SITUACOES_EQUIPE",
    "SITUACOES_INTEGRANTE",
]
