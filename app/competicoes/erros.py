"""Erros de domínio com códigos estáveis e resposta HTTP explícita."""

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
    detalhes: list[dict[str, str]]

    def __init__(
        self,
        mensagem: str,
        campos: list[str] | None = None,
        detalhes: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.campos = list(campos) if campos is not None else []
        self.detalhes = list(detalhes) if detalhes is not None else []


class NaoEncontrado(ErroCompeticao):
    codigo = "NAO_ENCONTRADO"
    status_code = 404


class ConflitoEstado(ErroCompeticao):
    codigo = "CONFLITO_ESTADO"
    status_code = 409


class ConflitoRevisao(ErroCompeticao):
    codigo = "CONFLITO_REVISAO"
    status_code = 409


class ConfirmacaoInvalida(ErroCompeticao):
    """Texto de confirmação de uma ação destrutiva não bate com o esperado."""

    codigo = "CONFIRMACAO_INVALIDA"
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


MENSAGEM_VALIDACAO = "Dados inválidos. Verifique os campos destacados."

# Tradução das mensagens padrão do Pydantic para texto de usuário.
_MENSAGENS_PYDANTIC = {
    "missing": "Campo obrigatório.",
    "string_too_short": "Texto muito curto.",
    "string_too_long": "Texto muito longo.",
    "greater_than_equal": "Valor abaixo do mínimo.",
    "greater_than": "Valor abaixo do mínimo.",
    "less_than_equal": "Valor acima do máximo.",
    "less_than": "Valor acima do máximo.",
    "int_type": "Informe um número inteiro.",
    "int_parsing": "Informe um número inteiro.",
    "date_type": "Informe uma data válida.",
    "date_parsing": "Informe uma data válida.",
    "date_from_datetime_parsing": "Informe uma data válida.",
    "extra_forbidden": "Campo não permitido.",
    "enum": "Opção inválida.",
    "literal_error": "Opção inválida.",
    "bool_type": "Informe verdadeiro ou falso.",
    "bool_parsing": "Informe verdadeiro ou falso.",
    "string_type": "Informe um texto.",
}


def _mensagem_validacao(item: dict) -> str:
    """Mensagem legível para um erro do Pydantic.

    Erros levantados pelos validadores do projeto (``ValueError``) já trazem o texto
    para o usuário; o Pydantic só acrescenta o prefixo "Value error, ".
    """
    tipo = item.get("type", "")
    if tipo == "value_error":
        texto = str(item.get("msg", ""))
        return texto.removeprefix("Value error, ").strip() or "Valor inválido."
    return _MENSAGENS_PYDANTIC.get(tipo, "Valor inválido.")


def registrar_tratadores(app: FastAPI) -> None:
    async def responder(_request: Request, erro: ErroCompeticao) -> JSONResponse:
        from competicoes.contratos.comuns import ErroResposta

        resposta = ErroResposta(
            codigo=erro.codigo, mensagem=erro.mensagem, campos=erro.campos,
            detalhes=erro.detalhes,
        )
        return JSONResponse(status_code=erro.status_code, content=resposta.model_dump())

    async def responder_validacao(request: Request, erro: RequestValidationError) -> JSONResponse:
        if not _caminho_competicoes(request):
            return await request_validation_exception_handler(request, erro)
        campos: list[str] = []
        detalhes: list[dict[str, str]] = []
        for item in erro.errors():
            caminho = item["loc"]
            if caminho and caminho[0] in {"body", "query", "path", "header", "cookie"}:
                caminho = caminho[1:]
            campo = ".".join(str(parte) for parte in caminho) or "requisicao"
            if campo not in campos:
                campos.append(campo)
                detalhes.append({"campo": campo, "mensagem": _mensagem_validacao(item)})
        return await responder(request, ConfiguracaoInvalida(
            MENSAGEM_VALIDACAO, campos=campos, detalhes=detalhes,
        ))

    async def responder_http(request: Request, erro: HTTPException) -> Response:
        # Erros com código estável próprio (ex.: SENHA_TROCA_OBRIGATORIA, levantado pela
        # segurança com detail = {"detail": "...", "codigo": "..."}).
        detalhe_com_codigo = isinstance(erro.detail, dict) and "codigo" in erro.detail
        if not _caminho_competicoes(request):
            if detalhe_com_codigo:
                return JSONResponse(status_code=erro.status_code, content=erro.detail,
                                    headers=erro.headers)
            return await http_exception_handler(request, erro)
        from competicoes.contratos.comuns import ErroResposta

        if detalhe_com_codigo:
            codigo = str(erro.detail["codigo"])
            mensagem = str(erro.detail.get("detail") or erro.detail.get("mensagem") or "Requisição recusada.")
        else:
            codigo = {
                401: "NAO_AUTENTICADO", 403: "ACESSO_NEGADO", 404: "NAO_ENCONTRADO",
            }.get(erro.status_code, "ERRO_HTTP")
            mensagem = erro.detail if isinstance(erro.detail, str) else "Requisição recusada."
        resposta = ErroResposta(codigo=codigo, mensagem=mensagem, campos=[])
        return JSONResponse(status_code=erro.status_code, content=resposta.model_dump(),
                            headers=erro.headers)

    app.add_exception_handler(RequestValidationError, responder_validacao)
    app.add_exception_handler(HTTPException, responder_http)

    for classe in (ErroCompeticao, NaoEncontrado, ConflitoEstado, ConflitoRevisao,
                   ConfirmacaoInvalida, Duplicidade, ConfiguracaoInvalida):
        app.add_exception_handler(classe, responder)
