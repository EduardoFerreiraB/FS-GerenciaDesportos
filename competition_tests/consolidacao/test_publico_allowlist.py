"""Allowlist do portal publico: todo campo exposto e uma decisao explicita.

Se um campo novo aparecer num schema publico sem entrar em ``ALLOWLIST_PUBLICA``
(ou se um schema novo surgir sem decisao), estes testes falham.
"""

import inspect

from competicoes.contratos import publico
from competicoes.contratos.comuns import Contrato

CAMPOS_PROIBIDOS = {
    "documento", "data_nascimento", "foto_url", "id_competidor", "id_aluno_origem",
    "motivo", "configuracao", "publicada", "revisao", "id_usuario_autor", "id_arbitro",
    "id_integrante", "chave_origem",
}


def _schemas_do_modulo() -> set[type]:
    return {
        obj for _, obj in inspect.getmembers(publico, inspect.isclass)
        if issubclass(obj, Contrato) and obj.__module__ == publico.__name__
    }


def test_cada_schema_publico_tem_exatamente_os_campos_decididos():
    for schema, campos in publico.ALLOWLIST_PUBLICA.items():
        assert set(schema.model_fields) == set(campos), schema.__name__


def test_todo_schema_do_modulo_esta_na_allowlist():
    assert _schemas_do_modulo() == set(publico.ALLOWLIST_PUBLICA)


def test_nenhum_campo_proibido():
    for schema in _schemas_do_modulo():
        assert not (set(schema.model_fields) & CAMPOS_PROIBIDOS), schema.__name__


def test_integrante_publico_so_tem_nome_camisa_posicao():
    assert set(publico.IntegrantePublico.model_fields) == {"nome_esportivo", "numero_camisa", "posicao"}
