"""Erros de dominio com codigos estaveis e resposta HTTP explicita."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ErroCompeticao(Exception):
    codigo: str = "ERRO_COMPETICAO"
    status_code: int = 400
    mensagem: str
    campos: list[str]

    def __init__(self, mensagem: str, campos: list[str] | None = None) -> None:
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.campos = list(campos) if campos is not None else []


class NaoEncontrado(ErroCompeticao):
    codigo = "NAO_ENCONTRADO"
    status_code = 404


class ConflitoEstado(ErroCompeticao):
    codigo = "CONFLITO_ESTADO"
    status_code = 409


class ConflitoRevisao(ErroCompeticao):
    codigo = "CONFLITO_REVISAO"
    status_code = 409


class Duplicidade(ErroCompeticao):
    codigo = "DUPLICIDADE"
    status_code = 409


class ConfiguracaoInvalida(ErroCompeticao):
    codigo = "CONFIGURACAO_INVALIDA"
    status_code = 422


def registrar_tratadores(app: FastAPI) -> None:
    async def responder(_request: Request, erro: ErroCompeticao) -> JSONResponse:
        from competicoes.contratos.comuns import ErroResposta

        resposta = ErroResposta(codigo=erro.codigo, mensagem=erro.mensagem, campos=erro.campos)
        return JSONResponse(status_code=erro.status_code, content=resposta.model_dump())

    for classe in (ErroCompeticao, NaoEncontrado, ConflitoEstado, ConflitoRevisao,
                   Duplicidade, ConfiguracaoInvalida):
        app.add_exception_handler(classe, responder)
