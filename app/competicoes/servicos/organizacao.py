"""Serviços de organização de eventos, competições e edições."""

import re
import unicodedata
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Modalidade, Usuario
from competicoes.contratos.configuracao import validar_configuracao
from competicoes.contratos.organizacao import (
    CompeticaoAtualizar,
    CompeticaoComEdicaoCriar,
    CompeticaoDetalhe,
    EdicaoCompeticaoAtualizar,
    EdicaoCompeticaoCriar,
    EdicaoCompeticaoDetalhe,
    EdicaoEventoAtualizar,
    EdicaoEventoCriar,
    EdicaoEventoDetalhe,
    EventoAtualizar,
    EventoComEdicaoCriar,
    EventoDetalhe,
    PaginaCompeticoes,
    PaginaEventos,
)
from competicoes.erros import (
    ConfiguracaoInvalida,
    ConflitoEstado,
    Duplicidade,
    NaoEncontrado,
)
from competicoes.infra import (
    bloquear_edicao,
    conferir_revisao,
    incrementar_revisao,
    registrar_auditoria,
    transacao,
)
from competicoes.modelos import Competicao, EdicaoCompeticao, EdicaoEvento, Evento


def _slugify(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"[^\w\s-]", "", texto).strip().lower()
    slug = re.sub(r"[-\s]+", "-", texto)
    return slug[:100] or "item"


def _gerar_slug_unico(db: Session, model_class, nome: str) -> str:
    base = _slugify(nome)
    slug = base
    contador = 2
    id_col = (
        model_class.id_evento
        if hasattr(model_class, "id_evento")
        else model_class.id_competicao
    )
    while db.execute(select(id_col).where(model_class.slug == slug)).scalar_one_or_none() is not None:
        sufixo = f"-{contador}"
        slug = f"{base[:120 - len(sufixo)]}{sufixo}"
        contador += 1
    return slug


def _normalizar_configuracao_edicao(edicao: EdicaoCompeticao) -> dict:
    config = dict(edicao.configuracao or {})
    if "formato" not in config:
        config["formato"] = edicao.formato
    if edicao.formato == "PONTOS_CORRIDOS" and "desempates" not in config:
        config["desempates"] = ["SALDO_GOLS"]
    elif edicao.formato == "GRUPOS_MATA_MATA":
        if "desempates" not in config:
            config["desempates"] = ["SALDO_GOLS"]
        if "quantidade_grupos" not in config:
            config["quantidade_grupos"] = 2
        if "classificados_por_grupo" not in config:
            config["classificados_por_grupo"] = 2
    return config


def _para_edicao_competicao_detalhe(edicao: EdicaoCompeticao) -> EdicaoCompeticaoDetalhe:
    config = _normalizar_configuracao_edicao(edicao)
    return EdicaoCompeticaoDetalhe(
        id_edicao_competicao=edicao.id_edicao_competicao,
        id_competicao=edicao.id_competicao,
        id_edicao_evento=edicao.id_edicao_evento,
        identificacao=edicao.identificacao,
        categoria=edicao.categoria,
        data_inicio=edicao.data_inicio,
        data_fim=edicao.data_fim,
        formato=edicao.formato,
        configuracao=config,
        estado=edicao.estado,
        publicada=edicao.publicada,
        revisao=edicao.revisao,
        criado_em=edicao.criado_em,
    )


def _para_competicao_detalhe(competicao: Competicao) -> CompeticaoDetalhe:
    return CompeticaoDetalhe(
        id_competicao=competicao.id_competicao,
        nome=competicao.nome,
        descricao=competicao.descricao,
        slug=competicao.slug,
        id_modalidade=competicao.id_modalidade,
        arquivado=competicao.arquivado,
        criado_em=competicao.criado_em,
        edicoes=[_para_edicao_competicao_detalhe(e) for e in competicao.edicoes],
    )


# =========================================================================
# Eventos e Edições de Evento
# =========================================================================

def criar_evento_com_edicao(
    db: Session, dados: EventoComEdicaoCriar, responsavel: Usuario
) -> EventoDetalhe:
    with transacao(db):
        if dados.edicao.data_inicio > dados.edicao.data_fim:
            raise ConfiguracaoInvalida(
                "A data de inicio deve ser anterior ou igual a data de fim.",
                campos=["edicao.data_inicio", "edicao.data_fim"],
            )

        slug = _gerar_slug_unico(db, Evento, dados.nome)
        evento = Evento(
            nome=dados.nome,
            descricao=dados.descricao,
            slug=slug,
            arquivado=False,
        )
        db.add(evento)
        db.flush()

        edicao = EdicaoEvento(
            id_evento=evento.id_evento,
            identificacao=dados.edicao.identificacao,
            data_inicio=dados.edicao.data_inicio,
            data_fim=dados.edicao.data_fim,
        )
        db.add(edicao)
        db.flush()

        registrar_auditoria(
            db,
            entidade="eventos",
            id_entidade=evento.id_evento,
            acao="CRIAR",
            antes=None,
            depois={
                "nome": evento.nome,
                "slug": evento.slug,
                "descricao": evento.descricao,
            },
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        db.refresh(evento)
        return EventoDetalhe.model_validate(evento)


def listar_eventos(
    db: Session,
    busca: str | None = None,
    arquivado: bool = False,
    pagina: int = 1,
    tamanho: int = 50,
) -> PaginaEventos:
    with transacao(db):
        consulta = db.query(Evento).filter(Evento.arquivado == arquivado)
        if busca:
            termo = f"%{busca}%"
            consulta = consulta.filter(Evento.nome.ilike(termo))
        total = consulta.count()
        offset = (pagina - 1) * tamanho
        itens = (
            consulta.order_by(Evento.criado_em.desc(), Evento.id_evento.desc())
            .offset(offset)
            .limit(tamanho)
            .all()
        )
        return PaginaEventos(
            itens=[EventoDetalhe.model_validate(e) for e in itens],
            total=total,
            pagina=pagina,
            tamanho=tamanho,
        )


def obter_evento(db: Session, id_evento: int) -> EventoDetalhe:
    with transacao(db):
        evento = db.get(Evento, id_evento)
        if evento is None:
            raise NaoEncontrado("Evento nao encontrado.", campos=["id_evento"])
        return EventoDetalhe.model_validate(evento)


def atualizar_evento(
    db: Session, id_evento: int, dados: EventoAtualizar, responsavel: Usuario
) -> EventoDetalhe:
    with transacao(db):
        evento = db.get(Evento, id_evento)
        if evento is None:
            raise NaoEncontrado("Evento nao encontrado.", campos=["id_evento"])

        antes = {
            "nome": evento.nome,
            "descricao": evento.descricao,
            "arquivado": evento.arquivado,
        }
        if dados.nome is not None:
            evento.nome = dados.nome
        if dados.descricao is not None:
            evento.descricao = dados.descricao
        if dados.arquivado is not None:
            evento.arquivado = dados.arquivado
        db.flush()

        depois = {
            "nome": evento.nome,
            "descricao": evento.descricao,
            "arquivado": evento.arquivado,
        }
        registrar_auditoria(
            db,
            entidade="eventos",
            id_entidade=evento.id_evento,
            acao="ATUALIZAR",
            antes=antes,
            depois=depois,
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        return EventoDetalhe.model_validate(evento)


def arquivar_evento(
    db: Session, id_evento: int, responsavel: Usuario
) -> EventoDetalhe:
    return atualizar_evento(
        db, id_evento, EventoAtualizar(arquivado=True), responsavel
    )


def excluir_evento(db: Session, id_evento: int, responsavel: Usuario) -> None:
    with transacao(db):
        evento = db.get(Evento, id_evento)
        if evento is None:
            raise NaoEncontrado("Evento nao encontrado.", campos=["id_evento"])
        if len(evento.edicoes) > 0:
            raise ConflitoEstado(
                "Nao e permitido excluir evento que possui edicoes.",
                campos=["edicoes"],
            )
        antes = {
            "id_evento": evento.id_evento,
            "nome": evento.nome,
            "slug": evento.slug,
        }
        registrar_auditoria(
            db,
            entidade="eventos",
            id_entidade=evento.id_evento,
            acao="EXCLUIR",
            antes=antes,
            depois=None,
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        db.delete(evento)


def criar_edicao_evento(
    db: Session, id_evento: int, dados: EdicaoEventoCriar, responsavel: Usuario
) -> EdicaoEventoDetalhe:
    with transacao(db):
        evento = db.get(Evento, id_evento)
        if evento is None:
            raise NaoEncontrado("Evento nao encontrado.", campos=["id_evento"])

        if dados.data_inicio > dados.data_fim:
            raise ConfiguracaoInvalida(
                "A data de inicio deve ser anterior ou igual a data de fim.",
                campos=["data_inicio", "data_fim"],
            )

        duplicada = (
            db.query(EdicaoEvento)
            .filter(
                EdicaoEvento.id_evento == id_evento,
                EdicaoEvento.identificacao == dados.identificacao,
            )
            .first()
        )
        if duplicada is not None:
            raise Duplicidade(
                "Ja existe uma edicao com esta identificacao para este evento.",
                campos=["identificacao"],
            )

        edicao = EdicaoEvento(
            id_evento=id_evento,
            identificacao=dados.identificacao,
            data_inicio=dados.data_inicio,
            data_fim=dados.data_fim,
        )
        db.add(edicao)
        db.flush()

        registrar_auditoria(
            db,
            entidade="edicoes_evento",
            id_entidade=edicao.id_edicao_evento,
            acao="CRIAR",
            antes=None,
            depois={
                "id_evento": id_evento,
                "identificacao": edicao.identificacao,
                "data_inicio": edicao.data_inicio.isoformat(),
                "data_fim": edicao.data_fim.isoformat(),
            },
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        return EdicaoEventoDetalhe.model_validate(edicao)


def atualizar_edicao_evento(
    db: Session,
    id_edicao_evento: int,
    dados: EdicaoEventoAtualizar,
    responsavel: Usuario,
) -> EdicaoEventoDetalhe:
    with transacao(db):
        edicao_evento = db.get(EdicaoEvento, id_edicao_evento)
        if edicao_evento is None:
            raise NaoEncontrado(
                "Edicao de evento nao encontrada.", campos=["id_edicao_evento"]
            )

        if dados.identificacao is not None:
            duplicada = (
                db.query(EdicaoEvento)
                .filter(
                    EdicaoEvento.id_evento == edicao_evento.id_evento,
                    EdicaoEvento.identificacao == dados.identificacao,
                    EdicaoEvento.id_edicao_evento != id_edicao_evento,
                )
                .first()
            )
            if duplicada is not None:
                raise Duplicidade(
                    "Ja existe uma edicao com esta identificacao para este evento.",
                    campos=["identificacao"],
                )

        nova_data_inicio = (
            dados.data_inicio
            if dados.data_inicio is not None
            else edicao_evento.data_inicio
        )
        nova_data_fim = (
            dados.data_fim
            if dados.data_fim is not None
            else edicao_evento.data_fim
        )
        if nova_data_inicio > nova_data_fim:
            raise ConfiguracaoInvalida(
                "A data de inicio deve ser anterior ou igual a data de fim.",
                campos=["data_inicio", "data_fim"],
            )

        consulta_filhas = (
            select(EdicaoCompeticao)
            .where(EdicaoCompeticao.id_edicao_evento == id_edicao_evento)
            .execution_options(populate_existing=True)
        )
        if db.get_bind().dialect.name == "mysql":
            consulta_filhas = consulta_filhas.with_for_update()
        filhas = db.execute(consulta_filhas).scalars().all()

        for filha in filhas:
            if filha.data_inicio < nova_data_inicio or filha.data_fim > nova_data_fim:
                raise ConflitoEstado(
                    "O novo periodo do evento nao comporta as datas das edicoes esportivas vinculadas.",
                    campos=["data_inicio", "data_fim"],
                )

        antes = {
            "identificacao": edicao_evento.identificacao,
            "data_inicio": edicao_evento.data_inicio.isoformat(),
            "data_fim": edicao_evento.data_fim.isoformat(),
        }
        if dados.identificacao is not None:
            edicao_evento.identificacao = dados.identificacao
        if dados.data_inicio is not None:
            edicao_evento.data_inicio = dados.data_inicio
        if dados.data_fim is not None:
            edicao_evento.data_fim = dados.data_fim
        db.flush()

        depois = {
            "identificacao": edicao_evento.identificacao,
            "data_inicio": edicao_evento.data_inicio.isoformat(),
            "data_fim": edicao_evento.data_fim.isoformat(),
        }
        registrar_auditoria(
            db,
            entidade="edicoes_evento",
            id_entidade=edicao_evento.id_edicao_evento,
            acao="ATUALIZAR",
            antes=antes,
            depois=depois,
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        return EdicaoEventoDetalhe.model_validate(edicao_evento)


# =========================================================================
# Competições e Edições de Competição
# =========================================================================

def criar_competicao_com_edicao(
    db: Session, dados: CompeticaoComEdicaoCriar, responsavel: Usuario
) -> CompeticaoDetalhe:
    with transacao(db):
        modalidade = db.get(Modalidade, dados.id_modalidade)
        if modalidade is None:
            raise NaoEncontrado(
                "Modalidade nao encontrada.", campos=["id_modalidade"]
            )

        if dados.edicao.data_inicio > dados.edicao.data_fim:
            raise ConfiguracaoInvalida(
                "A data de inicio deve ser anterior ou igual a data de fim.",
                campos=["edicao.data_inicio", "edicao.data_fim"],
            )

        if dados.edicao.id_edicao_evento is not None:
            edicao_evento = db.get(EdicaoEvento, dados.edicao.id_edicao_evento)
            if edicao_evento is None:
                raise NaoEncontrado(
                    "Edicao de evento nao encontrada.",
                    campos=["edicao.id_edicao_evento"],
                )
            if not (
                edicao_evento.data_inicio <= dados.edicao.data_inicio
                and dados.edicao.data_fim <= edicao_evento.data_fim
            ):
                raise ConfiguracaoInvalida(
                    "O periodo da edicao da competicao deve estar contido no periodo da edicao do evento.",
                    campos=["edicao.data_inicio", "edicao.data_fim"],
                )

        config_validada = validar_configuracao(
            dados.edicao.formato,
            dados.edicao.configuracao.model_dump(mode="json")
            if hasattr(dados.edicao.configuracao, "model_dump")
            else dados.edicao.configuracao,
        )
        config_dict = config_validada.model_dump(mode="json")

        slug = _gerar_slug_unico(db, Competicao, dados.nome)
        competicao = Competicao(
            nome=dados.nome,
            descricao=dados.descricao,
            slug=slug,
            id_modalidade=dados.id_modalidade,
            arquivado=False,
        )
        db.add(competicao)
        db.flush()

        edicao = EdicaoCompeticao(
            id_competicao=competicao.id_competicao,
            id_edicao_evento=dados.edicao.id_edicao_evento,
            identificacao=dados.edicao.identificacao,
            categoria=dados.edicao.categoria,
            data_inicio=dados.edicao.data_inicio,
            data_fim=dados.edicao.data_fim,
            formato=dados.edicao.formato,
            configuracao=config_dict,
            estado="RASCUNHO",
            publicada=False,
            revisao=1,
        )
        db.add(edicao)
        db.flush()

        registrar_auditoria(
            db,
            entidade="competicoes",
            id_entidade=competicao.id_competicao,
            acao="CRIAR",
            antes=None,
            depois={
                "nome": competicao.nome,
                "slug": competicao.slug,
                "id_modalidade": competicao.id_modalidade,
            },
            id_edicao_competicao=edicao.id_edicao_competicao,
            responsavel=responsavel,
        )
        db.refresh(competicao)
        return _para_competicao_detalhe(competicao)


def listar_competicoes(
    db: Session,
    busca: str | None = None,
    id_modalidade: int | None = None,
    arquivado: bool = False,
    pagina: int = 1,
    tamanho: int = 50,
) -> PaginaCompeticoes:
    with transacao(db):
        consulta = db.query(Competicao).filter(Competicao.arquivado == arquivado)
        if id_modalidade is not None:
            consulta = consulta.filter(Competicao.id_modalidade == id_modalidade)
        if busca:
            termo = f"%{busca}%"
            consulta = consulta.filter(Competicao.nome.ilike(termo))
        total = consulta.count()
        offset = (pagina - 1) * tamanho
        itens = (
            consulta.order_by(
                Competicao.criado_em.desc(), Competicao.id_competicao.desc()
            )
            .offset(offset)
            .limit(tamanho)
            .all()
        )
        return PaginaCompeticoes(
            itens=[_para_competicao_detalhe(c) for c in itens],
            total=total,
            pagina=pagina,
            tamanho=tamanho,
        )


def obter_competicao(db: Session, id_competicao: int) -> CompeticaoDetalhe:
    with transacao(db):
        comp = db.get(Competicao, id_competicao)
        if comp is None:
            raise NaoEncontrado(
                "Competicao nao encontrada.", campos=["id_competicao"]
            )
        return _para_competicao_detalhe(comp)


def atualizar_competicao(
    db: Session,
    id_competicao: int,
    dados: CompeticaoAtualizar,
    responsavel: Usuario,
) -> CompeticaoDetalhe:
    with transacao(db):
        competicao = db.get(Competicao, id_competicao)
        if competicao is None:
            raise NaoEncontrado(
                "Competicao nao encontrada.", campos=["id_competicao"]
            )

        if (
            dados.id_modalidade is not None
            and dados.id_modalidade != competicao.id_modalidade
        ):
            modalidade = db.get(Modalidade, dados.id_modalidade)
            if modalidade is None:
                raise NaoEncontrado(
                    "Modalidade nao encontrada.", campos=["id_modalidade"]
                )
            if (
                db.query(EdicaoCompeticao)
                .filter(EdicaoCompeticao.id_competicao == id_competicao)
                .count()
                > 0
            ):
                raise ConflitoEstado(
                    "Nao e permitido alterar a modalidade de uma competicao que ja possui edicoes.",
                    campos=["id_modalidade"],
                )
            competicao.id_modalidade = dados.id_modalidade

        antes = {
            "nome": competicao.nome,
            "descricao": competicao.descricao,
            "arquivado": competicao.arquivado,
            "id_modalidade": competicao.id_modalidade,
        }
        if dados.nome is not None:
            competicao.nome = dados.nome
        if dados.descricao is not None:
            competicao.descricao = dados.descricao
        if dados.arquivado is not None:
            competicao.arquivado = dados.arquivado
        db.flush()

        depois = {
            "nome": competicao.nome,
            "descricao": competicao.descricao,
            "arquivado": competicao.arquivado,
            "id_modalidade": competicao.id_modalidade,
        }
        registrar_auditoria(
            db,
            entidade="competicoes",
            id_entidade=competicao.id_competicao,
            acao="ATUALIZAR",
            antes=antes,
            depois=depois,
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        return _para_competicao_detalhe(competicao)


def arquivar_competicao(
    db: Session, id_competicao: int, responsavel: Usuario
) -> CompeticaoDetalhe:
    return atualizar_competicao(
        db, id_competicao, CompeticaoAtualizar(arquivado=True), responsavel
    )


def criar_edicao_competicao(
    db: Session,
    id_competicao: int,
    dados: EdicaoCompeticaoCriar,
    responsavel: Usuario,
) -> EdicaoCompeticaoDetalhe:
    with transacao(db):
        competicao = db.get(Competicao, id_competicao)
        if competicao is None:
            raise NaoEncontrado(
                "Competicao nao encontrada.", campos=["id_competicao"]
            )

        if dados.data_inicio > dados.data_fim:
            raise ConfiguracaoInvalida(
                "A data de inicio deve ser anterior ou igual a data de fim.",
                campos=["data_inicio", "data_fim"],
            )

        duplicada = (
            db.query(EdicaoCompeticao)
            .filter(
                EdicaoCompeticao.id_competicao == id_competicao,
                EdicaoCompeticao.identificacao == dados.identificacao,
            )
            .first()
        )
        if duplicada is not None:
            raise Duplicidade(
                "Ja existe uma edicao com esta identificacao para esta competicao.",
                campos=["identificacao"],
            )

        if dados.id_edicao_evento is not None:
            edicao_evento = db.get(EdicaoEvento, dados.id_edicao_evento)
            if edicao_evento is None:
                raise NaoEncontrado(
                    "Edicao de evento nao encontrada.", campos=["id_edicao_evento"]
                )
            if not (
                edicao_evento.data_inicio <= dados.data_inicio
                and dados.data_fim <= edicao_evento.data_fim
            ):
                raise ConfiguracaoInvalida(
                    "O periodo da edicao da competicao deve estar contido no periodo da edicao do evento.",
                    campos=["data_inicio", "data_fim"],
                )

        config_validada = validar_configuracao(
            dados.formato,
            dados.configuracao.model_dump(mode="json")
            if hasattr(dados.configuracao, "model_dump")
            else dados.configuracao,
        )
        config_dict = config_validada.model_dump(mode="json")

        edicao = EdicaoCompeticao(
            id_competicao=id_competicao,
            id_edicao_evento=dados.id_edicao_evento,
            identificacao=dados.identificacao,
            categoria=dados.categoria,
            data_inicio=dados.data_inicio,
            data_fim=dados.data_fim,
            formato=dados.formato,
            configuracao=config_dict,
            estado="RASCUNHO",
            publicada=False,
            revisao=1,
        )
        db.add(edicao)
        db.flush()

        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=edicao.id_edicao_competicao,
            acao="CRIAR",
            antes=None,
            depois={
                "id_competicao": id_competicao,
                "identificacao": edicao.identificacao,
                "formato": edicao.formato,
            },
            id_edicao_competicao=edicao.id_edicao_competicao,
            responsavel=responsavel,
        )
        return _para_edicao_competicao_detalhe(edicao)


def obter_edicao_competicao(
    db: Session, id_edicao_competicao: int
) -> EdicaoCompeticaoDetalhe:
    with transacao(db):
        edicao = db.get(EdicaoCompeticao, id_edicao_competicao)
        if edicao is None:
            raise NaoEncontrado(
                "Edicao de competicao nao encontrada.",
                campos=["id_edicao_competicao"],
            )
        return _para_edicao_competicao_detalhe(edicao)


def atualizar_edicao_competicao(
    db: Session,
    id_edicao_competicao: int,
    dados: EdicaoCompeticaoAtualizar,
    responsavel: Usuario,
) -> EdicaoCompeticaoDetalhe:
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)
        conferir_revisao(edicao, dados.revisao)

        if dados.data_inicio > dados.data_fim:
            raise ConfiguracaoInvalida(
                "A data de inicio deve ser anterior ou igual a data de fim.",
                campos=["data_inicio", "data_fim"],
            )

        outra = (
            db.query(EdicaoCompeticao)
            .filter(
                EdicaoCompeticao.id_competicao == edicao.id_competicao,
                EdicaoCompeticao.identificacao == dados.identificacao,
                EdicaoCompeticao.id_edicao_competicao != id_edicao_competicao,
            )
            .first()
        )
        if outra is not None:
            raise Duplicidade(
                "Ja existe uma edicao com esta identificacao para esta competicao.",
                campos=["identificacao"],
            )

        if dados.id_edicao_evento is not None:
            edicao_evento = db.get(EdicaoEvento, dados.id_edicao_evento)
            if edicao_evento is None:
                raise NaoEncontrado(
                    "Edicao de evento nao encontrada.", campos=["id_edicao_evento"]
                )
            if not (
                edicao_evento.data_inicio <= dados.data_inicio
                and dados.data_fim <= edicao_evento.data_fim
            ):
                raise ConfiguracaoInvalida(
                    "O periodo da edicao da competicao deve estar contido no periodo da edicao do evento.",
                    campos=["data_inicio", "data_fim"],
                )

        config_validada = validar_configuracao(
            dados.formato,
            dados.configuracao.model_dump(mode="json")
            if hasattr(dados.configuracao, "model_dump")
            else dados.configuracao,
        )
        config_dict = config_validada.model_dump(mode="json")

        antes = {
            "identificacao": edicao.identificacao,
            "categoria": edicao.categoria,
            "data_inicio": edicao.data_inicio.isoformat()
            if edicao.data_inicio
            else None,
            "data_fim": edicao.data_fim.isoformat()
            if edicao.data_fim
            else None,
            "formato": edicao.formato,
            "configuracao": edicao.configuracao,
            "id_edicao_evento": edicao.id_edicao_evento,
            "revisao": edicao.revisao,
        }
        incrementar_revisao(edicao)
        edicao.identificacao = dados.identificacao
        edicao.categoria = dados.categoria
        edicao.data_inicio = dados.data_inicio
        edicao.data_fim = dados.data_fim
        edicao.formato = dados.formato
        edicao.configuracao = config_dict
        edicao.id_edicao_evento = dados.id_edicao_evento

        db.flush()
        depois = {
            "identificacao": edicao.identificacao,
            "categoria": edicao.categoria,
            "data_inicio": edicao.data_inicio.isoformat()
            if edicao.data_inicio
            else None,
            "data_fim": edicao.data_fim.isoformat()
            if edicao.data_fim
            else None,
            "formato": edicao.formato,
            "configuracao": edicao.configuracao,
            "id_edicao_evento": edicao.id_edicao_evento,
            "revisao": edicao.revisao,
        }
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=edicao.id_edicao_competicao,
            acao="ATUALIZAR",
            antes=antes,
            depois=depois,
            id_edicao_competicao=edicao.id_edicao_competicao,
            responsavel=responsavel,
        )
        return _para_edicao_competicao_detalhe(edicao)


def publicar_edicao(
    db: Session,
    id_edicao_competicao: int,
    publicada: bool,
    responsavel: Usuario,
) -> EdicaoCompeticaoDetalhe:
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)
        antes = {"publicada": edicao.publicada}
        edicao.publicada = publicada
        db.flush()
        depois = {"publicada": edicao.publicada}
        acao = "PUBLICAR" if publicada else "DESPUBLICAR"
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=edicao.id_edicao_competicao,
            acao=acao,
            antes=antes,
            depois=depois,
            id_edicao_competicao=edicao.id_edicao_competicao,
            responsavel=responsavel,
        )
        return _para_edicao_competicao_detalhe(edicao)


def excluir_edicao_competicao(
    db: Session, id_edicao_competicao: int, responsavel: Usuario
) -> None:
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)
        if edicao.estado != "RASCUNHO":
            raise ConflitoEstado(
                "Apenas edicoes em rascunho podem ser excluidas.",
                campos=["estado"],
            )
        antes = {
            "id_edicao_competicao": edicao.id_edicao_competicao,
            "identificacao": edicao.identificacao,
            "estado": edicao.estado,
        }
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=edicao.id_edicao_competicao,
            acao="EXCLUIR",
            antes=antes,
            depois=None,
            id_edicao_competicao=edicao.id_edicao_competicao,
            responsavel=responsavel,
        )
        db.delete(edicao)
