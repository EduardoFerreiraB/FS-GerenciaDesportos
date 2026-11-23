"""Mensagens de erro do domínio de competições em português correto e sem enum cru.

Varre o código de ``app/competicoes`` (AST) e olha os textos passados para os erros de
domínio, ``HTTPException`` e ``ValueError`` (validadores dos contratos). Falha se algum
texto trouxer uma palavra conhecida escrita sem acento ("edicao", "nao", ...).

Módulos ainda não corrigidos ficam em ``PENDENTES`` (xfail estrito): cada trilha remove os
seus ao corrigir; a integração (T17) exige a lista vazia.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2] / "app" / "competicoes"

CHAMADAS = {
    "ErroCompeticao", "NaoEncontrado", "ConflitoEstado", "ConflitoRevisao", "Duplicidade",
    "ConfiguracaoInvalida", "HTTPException", "ValueError",
}
ARGUMENTOS_NOMEADOS = {"mensagem", "detail"}

PALAVRAS_SEM_ACENTO = (
    "requisicao", "edicao", "edicoes", "periodo", "nao", "competicao", "competicoes", "ja",
    "inscricao", "invalida", "invalido", "sumula", "decisao", "classificacao", "suspensao",
    "obrigatorio", "obrigatoria", "numero", "exclusao", "acao", "posicao", "configuracao",
    "inicio", "historico", "possivel", "disponivel", "valido", "valida", "eliminatorio",
    "eliminatoria",
)
_PADRAO = re.compile(
    r"\b(" + "|".join(PALAVRAS_SEM_ACENTO) + r")\b",
    re.IGNORECASE,
)

# Código interno (enum) não aparece em texto para o usuário: "EM_ANDAMENTO", "RASCUNHO".
_ENUM_CRU = re.compile(
    r"\b[A-Z]{2,}_[A-Z_]{2,}\b|\b(RASCUNHO|FINALIZADA|AGENDADA|CANCELADA|ATIVA|PENDENTE|CUMPRIDA)\b"
)

# Módulos com mensagens ainda sem acento → trilha responsável (remova ao corrigir).
PENDENTES: dict[str, str] = {}


def _modulos() -> list[str]:
    return sorted(
        str(p.relative_to(RAIZ)) for p in RAIZ.rglob("*.py") if "__pycache__" not in p.parts
    )


def _nome_chamada(no: ast.Call) -> str | None:
    if isinstance(no.func, ast.Name):
        return no.func.id
    if isinstance(no.func, ast.Attribute):
        return no.func.attr
    return None


def _textos(no: ast.AST) -> list[str]:
    if isinstance(no, ast.Constant) and isinstance(no.value, str):
        return [no.value]
    if isinstance(no, ast.JoinedStr):
        return ["".join(v.value for v in no.values
                        if isinstance(v, ast.Constant) and isinstance(v.value, str))]
    if isinstance(no, ast.BinOp):
        return _textos(no.left) + _textos(no.right)
    if isinstance(no, ast.IfExp):
        return _textos(no.body) + _textos(no.orelse)
    return []


def mensagens_sem_acento(caminho: Path) -> list[str]:
    arvore = ast.parse(caminho.read_text(encoding="utf-8"))
    achados: list[str] = []
    for no in ast.walk(arvore):
        if not isinstance(no, ast.Call) or _nome_chamada(no) not in CHAMADAS:
            continue
        candidatos = list(no.args[:1]) + [
            k.value for k in no.keywords if k.arg in ARGUMENTOS_NOMEADOS
        ]
        for candidato in candidatos:
            for texto in _textos(candidato):
                if _PADRAO.search(texto) or _ENUM_CRU.search(texto):
                    achados.append(f"linha {no.lineno}: {texto!r}")
    return achados


@pytest.mark.parametrize(
    "modulo",
    [
        pytest.param(m, marks=pytest.mark.xfail(strict=True, reason=f"pendente: {PENDENTES[m]}"))
        if m in PENDENTES else m
        for m in _modulos()
    ],
)
def test_mensagens_com_acentuacao(modulo: str) -> None:
    achados = mensagens_sem_acento(RAIZ / modulo)
    assert not achados, "Mensagens sem acento:\n" + "\n".join(achados)


def test_detector_reconhece_texto_sem_acento(tmp_path: Path) -> None:
    arquivo = tmp_path / "exemplo.py"
    arquivo.write_text(
        'raise ConflitoEstado("A edicao nao pode ser alterada.")\n'
        'raise NaoEncontrado(mensagem=f"Partida {x} nao encontrada")\n'
        'raise ConflitoEstado("A edição não pode ser alterada.")\n'
        'raise ConflitoEstado("A edição deve estar EM_ANDAMENTO.")\n',

        encoding="utf-8",
    )
    assert len(mensagens_sem_acento(arquivo)) == 3
