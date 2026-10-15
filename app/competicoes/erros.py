"""Erros de dominio com codigos estaveis e resposta HTTP explicita."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.responses import Response


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


def _caminho_competicoes(request: Request) -> bool:
    caminho = request.url.path
    return caminho == "/competicoes" or caminho.startswith("/competicoes/")


def registrar_tratadores(app: FastAPI) -> None:
    async def responder(_request: Request, erro: ErroCompeticao) -> JSONResponse:
        from competicoes.contratos.comuns import ErroResposta

        resposta = ErroResposta(codigo=erro.codigo, mensagem=erro.mensagem, campos=erro.campos)
        return JSONResponse(status_code=erro.status_code, content=resposta.model_dump())

    async def responder_validacao(request: Request, erro: RequestValidationError) -> JSONResponse:
        if not _caminho_competicoes(request):
            return await request_validation_exception_handler(request, erro)
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

    async def responder_http(request: Request, erro: HTTPException) -> Response:
        if not _caminho_competicoes(request):
            return await http_exception_handler(request, erro)
        from competicoes.contratos.comuns import ErroResposta

        codigo = {
            401: "NAO_AUTENTICADO", 403: "ACESSO_NEGADO", 404: "NAO_ENCONTRADO",
        }.get(erro.status_code, "ERRO_HTTP")
        resposta = ErroResposta(
            codigo=codigo,
            mensagem=erro.detail if isinstance(erro.detail, str) else "Requisicao recusada.",
            campos=[],
        )
        return JSONResponse(status_code=erro.status_code, content=resposta.model_dump(),
                            headers=erro.headers)

    app.add_exception_handler(RequestValidationError, responder_validacao)
    app.add_exception_handler(HTTPException, responder_http)

    for classe in (ErroCompeticao, NaoEncontrado, ConflitoEstado, ConflitoRevisao,
                   Duplicidade, ConfiguracaoInvalida):
        app.add_exception_handler(classe, responder)
