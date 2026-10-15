"""Erros de dominio com codigos estaveis e resposta HTTP explicita."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
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

    async def responder_validacao(request: Request, erro: RequestValidationError) -> JSONResponse:
        campos = []
        for item in erro.errors():
            caminho = item["loc"]
            if caminho and caminho[0] in {"body", "query", "path", "header", "cookie"}:
                caminho = caminho[1:]
            campo = ".".join(str(parte) for parte in caminho) or "requisicao"
            if campo not in campos:
                campos.append(campo)
        return await responder(request, ConfiguracaoInvalida(
            "Dados da requisicao invalidos.", campos=campos,
        ))

    app.add_exception_handler(RequestValidationError, responder_validacao)

    for classe in (ErroCompeticao, NaoEncontrado, ConflitoEstado, ConflitoRevisao,
                   Duplicidade, ConfiguracaoInvalida):
        app.add_exception_handler(classe, responder)
