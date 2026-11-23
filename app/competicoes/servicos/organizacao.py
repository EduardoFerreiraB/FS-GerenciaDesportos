"""Serviços de organização de eventos, competições e edições."""

import re
import unicodedata
from sqlalchemy import func, select
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
    EventoResumo,
    PaginaCompeticoes,
    PaginaEventos,
    PreviaExclusaoEvento,
)
from competicoes.erros import (
    ConfiguracaoInvalida,
    ConfirmacaoInvalida,
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
from competicoes.modelos import (
    AuditoriaCompeticao,
    Competicao,
    DueloEliminatorio,
    EdicaoCompeticao,
    EdicaoEvento,
    Equipe,
    Evento,
    GrupoCompeticao,
    IntegranteEquipe,
    Partida,
)
from competicoes.servicos.classificacao import obter_classificacao_edicao
from competicoes.servicos.exclusao import (
    apagar_competicao,
    apagar_edicao,
    apagar_edicao_evento,
    apagar_evento,
)


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
    vinculo = edicao.edicao_evento
    evento = (
        EventoResumo(
            id_evento=vinculo.id_evento,
            nome=vinculo.evento.nome,
            identificacao_edicao=vinculo.identificacao,
        )
        if vinculo is not None
        else None
    )
    return EdicaoCompeticaoDetalhe(
        evento=evento,
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

def normalizar_nome(nome: str) -> str:
    """Forma de comparação de nomes: sem acentos, sem caixa e com espaços colapsados."""
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFKD", nome) if not unicodedata.combining(c)
    )
    return " ".join(sem_acento.casefold().split())


def _garantir_nome_unico(db: Session, modelo, nome: str, id_atual: int | None = None) -> None:
    """Evento e competição têm nome único (PD-RT15-02, PD-RT09-03), inclusive arquivados."""
    coluna_id = modelo.id_evento if modelo is Evento else modelo.id_competicao
    alvo = normalizar_nome(nome)
    for id_existente, nome_existente in db.execute(select(coluna_id, modelo.nome)).all():
        if id_existente != id_atual and normalizar_nome(nome_existente) == alvo:
            mensagem = (
                f"Já existe um evento chamado '{nome_existente}'." if modelo is Evento
                else f"Já existe uma competição chamada '{nome_existente}'."
            )
            raise Duplicidade(mensagem, campos=["nome"])


def _soltar_objetos_apagados(db: Session) -> None:
    """Tira da sessão os objetos de competições apagados por DELETE em lote.

    Os DELETE usam ``synchronize_session=False``; sem isso a sessão guardaria
    instâncias de linhas que não existem mais. A auditoria recém-gravada fica.
    """
    for objeto in list(db.identity_map.values()):
        if type(objeto).__module__.startswith("competicoes.modelos") and not isinstance(
            objeto, AuditoriaCompeticao
        ):
            db.expunge(objeto)


def _formatar_data(valor) -> str:
    return valor.strftime("%d/%m/%Y")


def criar_evento_com_edicao(
    db: Session, dados: EventoComEdicaoCriar, responsavel: Usuario
) -> EventoDetalhe:
    with transacao(db):
        if dados.edicao.data_inicio > dados.edicao.data_fim:
            raise ConfiguracaoInvalida(
                "A data de término deve ser igual ou posterior à data de início.",
                campos=["edicao.data_inicio", "edicao.data_fim"],
            )

        _garantir_nome_unico(db, Evento, dados.nome)
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
            raise NaoEncontrado("Evento não encontrado.", campos=["id_evento"])
        return EventoDetalhe.model_validate(evento)


def atualizar_evento(
    db: Session, id_evento: int, dados: EventoAtualizar, responsavel: Usuario
) -> EventoDetalhe:
    with transacao(db):
        evento = db.get(Evento, id_evento)
        if evento is None:
            raise NaoEncontrado("Evento não encontrado.", campos=["id_evento"])

        antes = {
            "nome": evento.nome,
            "descricao": evento.descricao,
            "arquivado": evento.arquivado,
        }
        if dados.nome is not None:
            _garantir_nome_unico(db, Evento, dados.nome, evento.id_evento)
            evento.nome = dados.nome
        if "descricao" in dados.model_fields_set:  # null apaga a descrição (DF-RT15-08)
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


def previa_exclusao_evento(db: Session, id_evento: int) -> PreviaExclusaoEvento:
    """Quanto some ao excluir o evento (mostrado no diálogo de confirmação)."""
    evento = db.get(Evento, id_evento)
    if evento is None:
        raise NaoEncontrado("Evento não encontrado.", campos=["id_evento"])
    ids_edicoes_evento = [e.id_edicao_evento for e in evento.edicoes]
    edicoes = db.execute(
        select(EdicaoCompeticao).where(EdicaoCompeticao.id_edicao_evento.in_(ids_edicoes_evento))
    ).scalars().all() if ids_edicoes_evento else []
    ids_edicoes = [e.id_edicao_competicao for e in edicoes]

    def contar(modelo, coluna) -> int:
        if not ids_edicoes:
            return 0
        return db.scalar(select(func.count()).select_from(modelo).where(coluna.in_(ids_edicoes))) or 0

    return PreviaExclusaoEvento(
        edicoes_evento=len(ids_edicoes_evento),
        edicoes_competicao=len(ids_edicoes),
        partidas=contar(Partida, Partida.id_edicao_competicao),
        equipes=contar(Equipe, Equipe.id_edicao_competicao),
        publicadas=sum(1 for e in edicoes if e.publicada),
    )


def _bloquear_edicoes_vinculadas(db: Session, ids_edicoes_evento: list[int]) -> list[dict]:
    if not ids_edicoes_evento:
        return []
    ids = db.scalars(
        select(EdicaoCompeticao.id_edicao_competicao)
        .where(EdicaoCompeticao.id_edicao_evento.in_(ids_edicoes_evento))
    ).all()
    resumo = []
    for id_edicao in ids:
        edicao = bloquear_edicao(db, id_edicao)
        resumo.append({
            "id_edicao_competicao": edicao.id_edicao_competicao,
            "id_competicao": edicao.id_competicao,
            "identificacao": edicao.identificacao,
            "estado": edicao.estado,
        })
    return resumo


def excluir_evento(
    db: Session, id_evento: int, confirmacao_nome: str, responsavel: Usuario
) -> None:
    """Exclui o evento em cascata (PD-RT15-01): edições do evento, edições de competição
    vinculadas com todo o conteúdo e as competições que ficarem sem edições.

    Confirmação reforçada: ``confirmacao_nome`` precisa ser idêntico ao nome cadastrado.
    """
    with transacao(db):
        evento = db.get(Evento, id_evento)
        if evento is None:
            raise NaoEncontrado("Evento não encontrado.", campos=["id_evento"])
        if confirmacao_nome != evento.nome:
            raise ConfirmacaoInvalida(
                "Digite o nome do evento exatamente como está cadastrado para confirmar a exclusão.",
                campos=["confirmacao_nome"],
            )
        ids_edicoes_evento = [e.id_edicao_evento for e in evento.edicoes]
        registrar_auditoria(
            db,
            entidade="eventos",
            id_entidade=evento.id_evento,
            acao="EXCLUIR",
            antes={
                "id_evento": evento.id_evento,
                "nome": evento.nome,
                "slug": evento.slug,
                "edicoes_evento": [
                    {"id_edicao_evento": e.id_edicao_evento, "identificacao": e.identificacao}
                    for e in evento.edicoes
                ],
                "edicoes_competicao": _bloquear_edicoes_vinculadas(db, ids_edicoes_evento),
            },
            depois=None,
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        apagar_evento(db, id_evento)
        _soltar_objetos_apagados(db)


def excluir_edicao_evento(
    db: Session, id_edicao_evento: int, confirmacao_identificacao: str, responsavel: Usuario
) -> None:
    """Exclui uma edição de evento com a mesma cascata do evento, restrita a ela."""
    with transacao(db):
        edicao_evento = db.get(EdicaoEvento, id_edicao_evento)
        if edicao_evento is None:
            raise NaoEncontrado("Edição de evento não encontrada.", campos=["id_edicao_evento"])
        if confirmacao_identificacao != edicao_evento.identificacao:
            raise ConfirmacaoInvalida(
                "Digite a identificação da edição exatamente como está cadastrada para confirmar a exclusão.",
                campos=["confirmacao_identificacao"],
            )
        registrar_auditoria(
            db,
            entidade="edicoes_evento",
            id_entidade=edicao_evento.id_edicao_evento,
            acao="EXCLUIR",
            antes={
                "id_evento": edicao_evento.id_evento,
                "identificacao": edicao_evento.identificacao,
                "edicoes_competicao": _bloquear_edicoes_vinculadas(db, [id_edicao_evento]),
            },
            depois=None,
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        apagar_edicao_evento(db, id_edicao_evento)
        _soltar_objetos_apagados(db)


def vincular_edicao_competicao(
    db: Session, id_edicao_evento: int, id_edicao_competicao: int, responsavel: Usuario
) -> EdicaoEventoDetalhe:
    """Liga uma edição de competição existente à edição do evento (DF-RT15-02)."""
    with transacao(db):
        edicao_evento = db.get(EdicaoEvento, id_edicao_evento)
        if edicao_evento is None:
            raise NaoEncontrado("Edição de evento não encontrada.", campos=["id_edicao_evento"])
        edicao = db.get(EdicaoCompeticao, id_edicao_competicao)
        if edicao is None:
            raise NaoEncontrado("Edição de competição não encontrada.", campos=["id_edicao_competicao"])
        edicao = bloquear_edicao(db, id_edicao_competicao)

        if edicao.id_edicao_evento == id_edicao_evento:
            return EdicaoEventoDetalhe.model_validate(edicao_evento)
        if edicao.id_edicao_evento is not None:
            atual = edicao.edicao_evento
            raise ConflitoEstado(
                f"Esta edição já está vinculada ao evento '{atual.evento.nome}' ({atual.identificacao}). "
                "Desvincule antes de ligar a outro evento.",
                campos=["id_edicao_competicao"],
            )
        if not (edicao_evento.data_inicio <= edicao.data_inicio and edicao.data_fim <= edicao_evento.data_fim):
            raise ConfiguracaoInvalida(
                f"O período da edição ({_formatar_data(edicao.data_inicio)} a {_formatar_data(edicao.data_fim)}) "
                f"precisa estar dentro do período do evento ({_formatar_data(edicao_evento.data_inicio)} a "
                f"{_formatar_data(edicao_evento.data_fim)}).",
                campos=["id_edicao_competicao"],
            )
        edicao.id_edicao_evento = id_edicao_evento
        incrementar_revisao(edicao)
        db.flush()
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=edicao.id_edicao_competicao,
            acao="VINCULAR_EVENTO",
            antes={"id_edicao_evento": None},
            depois={"id_edicao_evento": id_edicao_evento},
            id_edicao_competicao=edicao.id_edicao_competicao,
            responsavel=responsavel,
        )
        db.refresh(edicao_evento)
        return EdicaoEventoDetalhe.model_validate(edicao_evento)


def desvincular_edicao_competicao(
    db: Session, id_edicao_evento: int, id_edicao_competicao: int, responsavel: Usuario
) -> EdicaoEventoDetalhe:
    with transacao(db):
        edicao_evento = db.get(EdicaoEvento, id_edicao_evento)
        if edicao_evento is None:
            raise NaoEncontrado("Edição de evento não encontrada.", campos=["id_edicao_evento"])
        edicao = db.get(EdicaoCompeticao, id_edicao_competicao)
        if edicao is None or edicao.id_edicao_evento != id_edicao_evento:
            raise NaoEncontrado(
                "Esta edição de competição não está vinculada a esta edição do evento.",
                campos=["id_edicao_competicao"],
            )
        edicao = bloquear_edicao(db, id_edicao_competicao)
        edicao.id_edicao_evento = None
        incrementar_revisao(edicao)
        db.flush()
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=edicao.id_edicao_competicao,
            acao="DESVINCULAR_EVENTO",
            antes={"id_edicao_evento": id_edicao_evento},
            depois={"id_edicao_evento": None},
            id_edicao_competicao=edicao.id_edicao_competicao,
            responsavel=responsavel,
        )
        db.refresh(edicao_evento)
        return EdicaoEventoDetalhe.model_validate(edicao_evento)


def criar_edicao_evento(
    db: Session, id_evento: int, dados: EdicaoEventoCriar, responsavel: Usuario
) -> EdicaoEventoDetalhe:
    with transacao(db):
        evento = db.get(Evento, id_evento)
        if evento is None:
            raise NaoEncontrado("Evento não encontrado.", campos=["id_evento"])

        if dados.data_inicio > dados.data_fim:
            raise ConfiguracaoInvalida(
                "A data de término deve ser igual ou posterior à data de início.",
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
                "Já existe uma edição com esta identificação para este evento.",
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
                "Edição de evento não encontrada.", campos=["id_edicao_evento"]
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
                    "Já existe uma edição com esta identificação para este evento.",
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
                "A data de término deve ser igual ou posterior à data de início.",
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
                    "O novo período do evento não comporta as datas das edições esportivas vinculadas.",
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
                "Modalidade não encontrada.", campos=["id_modalidade"]
            )

        if dados.edicao.data_inicio > dados.edicao.data_fim:
            raise ConfiguracaoInvalida(
                "A data de término deve ser igual ou posterior à data de início.",
                campos=["edicao.data_inicio", "edicao.data_fim"],
            )

        if dados.edicao.id_edicao_evento is not None:
            edicao_evento = db.get(EdicaoEvento, dados.edicao.id_edicao_evento)
            if edicao_evento is None:
                raise NaoEncontrado(
                    "Edição de evento não encontrada.",
                    campos=["edicao.id_edicao_evento"],
                )
            if not (
                edicao_evento.data_inicio <= dados.edicao.data_inicio
                and dados.edicao.data_fim <= edicao_evento.data_fim
            ):
                raise ConfiguracaoInvalida(
                    "O período da edição da competição deve estar contido no período da edição do evento.",
                    campos=["edicao.data_inicio", "edicao.data_fim"],
                )

        config_validada = validar_configuracao(
            dados.edicao.formato,
            dados.edicao.configuracao.model_dump(mode="json")
            if hasattr(dados.edicao.configuracao, "model_dump")
            else dados.edicao.configuracao,
        )
        config_dict = config_validada.model_dump(mode="json")

        _garantir_nome_unico(db, Competicao, dados.nome)
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
                "Competição não encontrada.", campos=["id_competicao"]
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
                "Competição não encontrada.", campos=["id_competicao"]
            )

        if (
            dados.id_modalidade is not None
            and dados.id_modalidade != competicao.id_modalidade
        ):
            modalidade = db.get(Modalidade, dados.id_modalidade)
            if modalidade is None:
                raise NaoEncontrado(
                    "Modalidade não encontrada.", campos=["id_modalidade"]
                )
            if (
                db.query(EdicaoCompeticao)
                .filter(EdicaoCompeticao.id_competicao == id_competicao)
                .count()
                > 0
            ):
                raise ConflitoEstado(
                    "Não é permitido alterar a modalidade de uma competição que já possui edições.",
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
            _garantir_nome_unico(db, Competicao, dados.nome, competicao.id_competicao)
            competicao.nome = dados.nome
        if "descricao" in dados.model_fields_set:
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
                "Competição não encontrada.", campos=["id_competicao"]
            )

        if dados.data_inicio > dados.data_fim:
            raise ConfiguracaoInvalida(
                "A data de término deve ser igual ou posterior à data de início.",
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
                "Já existe uma edição com esta identificação para esta competição.",
                campos=["identificacao"],
            )

        if dados.id_edicao_evento is not None:
            edicao_evento = db.get(EdicaoEvento, dados.id_edicao_evento)
            if edicao_evento is None:
                raise NaoEncontrado(
                    "Edição de evento não encontrada.", campos=["id_edicao_evento"]
                )
            if not (
                edicao_evento.data_inicio <= dados.data_inicio
                and dados.data_fim <= edicao_evento.data_fim
            ):
                raise ConfiguracaoInvalida(
                    "O período da edição da competição deve estar contido no período da edição do evento.",
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
                "Edição de competição não encontrada.",
                campos=["id_edicao_competicao"],
            )
        return _para_edicao_competicao_detalhe(edicao)


def _edicao_possui_tabela_gerada(db: Session, id_edicao_competicao: int) -> bool:
    return (
        db.query(Partida.id_partida)
        .filter(Partida.id_edicao_competicao == id_edicao_competicao)
        .first()
        is not None
        or db.query(GrupoCompeticao.id_grupo)
        .filter(GrupoCompeticao.id_edicao_competicao == id_edicao_competicao)
        .first()
        is not None
        or db.query(DueloEliminatorio.id_duelo)
        .filter(DueloEliminatorio.id_edicao_competicao == id_edicao_competicao)
        .first()
        is not None
    )


def atualizar_edicao_competicao(
    db: Session,
    id_edicao_competicao: int,
    dados: EdicaoCompeticaoAtualizar,
    responsavel: Usuario,
) -> EdicaoCompeticaoDetalhe:
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)
        conferir_revisao(edicao, dados.revisao)

        if edicao.estado in ("FINALIZADA", "CANCELADA"):
            raise ConflitoEstado(
                "Não é possível alterar uma edição finalizada ou cancelada.",
                campos=["estado"],
            )

        if dados.data_inicio > dados.data_fim:
            raise ConfiguracaoInvalida(
                "A data de término deve ser igual ou posterior à data de início.",
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
                "Já existe uma edição com esta identificação para esta competição.",
                campos=["identificacao"],
            )

        if dados.id_edicao_evento is not None:
            edicao_evento = db.get(EdicaoEvento, dados.id_edicao_evento)
            if edicao_evento is None:
                raise NaoEncontrado(
                    "Edição de evento não encontrada.", campos=["id_edicao_evento"]
                )
            if not (
                edicao_evento.data_inicio <= dados.data_inicio
                and dados.data_fim <= edicao_evento.data_fim
            ):
                raise ConfiguracaoInvalida(
                    "O período da edição da competição deve estar contido no período da edição do evento.",
                    campos=["data_inicio", "data_fim"],
                )

        config_validada = validar_configuracao(
            dados.formato,
            dados.configuracao.model_dump(mode="json")
            if hasattr(dados.configuracao, "model_dump")
            else dados.configuracao,
        )
        config_dict = config_validada.model_dump(mode="json")

        if _edicao_possui_tabela_gerada(db, id_edicao_competicao):
            try:
                config_atual_dict = validar_configuracao(
                    edicao.formato, _normalizar_configuracao_edicao(edicao)
                ).model_dump(mode="json")
            except ConfiguracaoInvalida:
                config_atual_dict = edicao.configuracao or {}

            if dados.formato != edicao.formato or config_dict != config_atual_dict:
                raise ConflitoEstado(
                    "Não é possível alterar o formato ou configuração estrutural com tabela de jogos já gerada. Desfaça a tabela antes.",
                    campos=["configuracao"],
                )

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
        # Publicação é independente do estado: até edição cancelada pode sair do portal.
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
    """Exclui a edição e, em cascata, tudo o que pertence a ela.

    Decisão do usuário (2026-10-19): vale em qualquer estado. Somem equipes,
    elencos, grupos, chaveamento, partidas, súmulas, disciplina e decisões;
    competidores e a trilha de auditoria permanecem.
    """
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)
        antes = {
            "id_edicao_competicao": edicao.id_edicao_competicao,
            "id_competicao": edicao.id_competicao,
            "identificacao": edicao.identificacao,
            "estado": edicao.estado,
            "partidas": db.scalar(
                select(func.count()).select_from(Partida).where(
                    Partida.id_edicao_competicao == id_edicao_competicao
                )
            ),
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
        apagar_edicao(db, id_edicao_competicao)
        db.expunge(edicao)


def excluir_competicao(db: Session, id_competicao: int, responsavel: Usuario) -> None:
    """Exclui a competição e, em cascata, todas as suas edições (decisão de 2026-10-19).

    A auditoria registra a competição e cada edição removida; competidores permanecem.
    """
    with transacao(db):
        competicao = db.get(Competicao, id_competicao)
        if competicao is None:
            raise NaoEncontrado("Competição não encontrada.", campos=["id_competicao"])
        edicoes = [bloquear_edicao(db, e.id_edicao_competicao) for e in competicao.edicoes]
        registrar_auditoria(
            db,
            entidade="competicoes",
            id_entidade=competicao.id_competicao,
            acao="EXCLUIR",
            antes={
                "nome": competicao.nome,
                "slug": competicao.slug,
                "edicoes": [
                    {"id_edicao_competicao": e.id_edicao_competicao, "identificacao": e.identificacao,
                     "estado": e.estado}
                    for e in edicoes
                ],
            },
            depois=None,
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        apagar_competicao(db, id_competicao)
        for edicao in edicoes:
            db.expunge(edicao)
        db.expunge(competicao)


def iniciar_edicao_competicao(
    db: Session,
    id_edicao_competicao: int,
    responsavel: Usuario,
) -> EdicaoCompeticaoDetalhe:
    """Inicia a edição de competição, mudando RASCUNHO -> EM_ANDAMENTO (ou idempotente se já EM_ANDAMENTO)."""
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)
        tem_tabela = _edicao_possui_tabela_gerada(db, id_edicao_competicao)

        if edicao.estado == "EM_ANDAMENTO" and tem_tabela:
            return _para_edicao_competicao_detalhe(edicao)

        if edicao.estado != "RASCUNHO":
            raise ConflitoEstado(
                "Apenas edições em rascunho podem ser iniciadas.",
                campos=["estado"],
            )

        if not tem_tabela:
            raise ConflitoEstado(
                "Gere a tabela de jogos antes de iniciar a edição.",
                campos=["partidas"],
            )

        equipes = (
            db.query(Equipe)
            .filter(
                Equipe.id_edicao_competicao == id_edicao_competicao,
                Equipe.situacao == "ATIVA",
            )
            .all()
        )
        if len(equipes) < 2:
            raise ConflitoEstado(
                "A edição deve possuir ao menos 2 equipes ativas para ser iniciada.",
                campos=["equipes"],
            )
        for eq in equipes:
            qtd_ativos = (
                db.query(IntegranteEquipe)
                .filter(
                    IntegranteEquipe.id_equipe == eq.id_equipe,
                    IntegranteEquipe.situacao == "ATIVO",
                )
                .count()
            )
            if qtd_ativos < 1:
                raise ConflitoEstado(
                    f"A equipe '{eq.nome}' não possui nenhum integrante ativo inscrito.",
                    campos=["equipes"],
                )

        edicao.estado = "EM_ANDAMENTO"
        incrementar_revisao(edicao)
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=id_edicao_competicao,
            acao="INICIAR",
            antes={"estado": "RASCUNHO"},
            depois={"estado": "EM_ANDAMENTO"},
            id_edicao_competicao=id_edicao_competicao,
            responsavel=responsavel,
        )
        return _para_edicao_competicao_detalhe(edicao)


def finalizar_edicao_competicao(
    db: Session,
    id_edicao_competicao: int,
    responsavel: Usuario,
) -> EdicaoCompeticaoDetalhe:
    """Finaliza a edição após todas as partidas obrigatórias estarem concluídas e título definido."""
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)

        if edicao.estado != "EM_ANDAMENTO":
            raise ConflitoEstado(
                "Apenas edições em andamento podem ser finalizadas.",
                campos=["estado"],
            )

        partidas = (
            db.query(Partida)
            .filter(Partida.id_edicao_competicao == id_edicao_competicao)
            .all()
        )
        if not partidas:
            raise ConflitoEstado(
                "A edição não possui partidas cadastradas para ser finalizada.",
                campos=["partidas"],
            )

        if any(p.estado != "FINALIZADA" for p in partidas):
            raise ConflitoEstado(
                "Todas as partidas obrigatórias devem estar finalizadas para encerrar a edição. Partidas canceladas ou pendentes impedem a finalização.",
                campos=["partidas"],
            )

        if edicao.formato in ("MATA_MATA", "GRUPOS_MATA_MATA"):
            duelos = (
                db.query(DueloEliminatorio)
                .filter(
                    DueloEliminatorio.id_edicao_competicao == id_edicao_competicao
                )
                .all()
            )
            if not duelos or any(d.estado != "RESOLVIDO" for d in duelos):
                raise ConflitoEstado(
                    "Todos os confrontos eliminatórios devem estar resolvidos para finalizar a edição.",
                    campos=["duelos"],
                )

        if edicao.formato == "PONTOS_CORRIDOS":
            tabela = obter_classificacao_edicao(db, id_edicao_competicao)
            linhas = tabela.linhas or []
            empatada = next((l for l in linhas[:2] if l.empate_persistente), None)
            if empatada is not None:
                nomes = [l.nome_equipe for l in linhas if l.posicao == empatada.posicao and l.empate_persistente]
                lista = nomes[0] if len(nomes) == 1 else f"{', '.join(nomes[:-1])} e {nomes[-1]}"
                disputa = "pelo título" if empatada.posicao == 1 else f"pela {empatada.posicao}ª posição"
                raise ConflitoEstado(
                    f"Há empate não resolvido {disputa} ({lista}). Registre a decisão antes de finalizar.",
                    campos=["classificacao"],
                )

        edicao.estado = "FINALIZADA"
        incrementar_revisao(edicao)
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=id_edicao_competicao,
            acao="FINALIZAR",
            antes={"estado": "EM_ANDAMENTO"},
            depois={"estado": "FINALIZADA"},
            id_edicao_competicao=id_edicao_competicao,
            responsavel=responsavel,
        )
        return _para_edicao_competicao_detalhe(edicao)


def reabrir_edicao_competicao(
    db: Session,
    id_edicao_competicao: int,
    motivo: str,
    responsavel: Usuario,
) -> EdicaoCompeticaoDetalhe:
    """Reabre uma edição FINALIZADA voltando para EM_ANDAMENTO (bloqueado para CANCELADA)."""
    if not motivo or len(motivo.strip()) < 3:
        raise ConfiguracaoInvalida(
            "É obrigatório informar um motivo válido para reabrir a edição.",
            campos=["motivo"],
        )

    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)
        if edicao.estado != "FINALIZADA":
            raise ConflitoEstado(
                "Apenas edições finalizadas podem ser reabertas.",
                campos=["estado"],
            )

        edicao.estado = "EM_ANDAMENTO"
        incrementar_revisao(edicao)
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=id_edicao_competicao,
            acao="REABRIR",
            antes={"estado": "FINALIZADA"},
            depois={"estado": "EM_ANDAMENTO"},
            id_edicao_competicao=id_edicao_competicao,
            responsavel=responsavel,
            motivo=motivo.strip(),
        )
        return _para_edicao_competicao_detalhe(edicao)


def cancelar_edicao_competicao(
    db: Session,
    id_edicao_competicao: int,
    motivo: str,
    responsavel: Usuario,
) -> EdicaoCompeticaoDetalhe:
    """Cancela administrativamente a edição preservando todos os registros esportivos."""
    if not motivo or len(motivo.strip()) < 3:
        raise ConfiguracaoInvalida(
            "É obrigatório informar um motivo válido para cancelar a edição.",
            campos=["motivo"],
        )

    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)
        if edicao.estado == "CANCELADA":
            raise ConflitoEstado(
                "A edição já está cancelada.",
                campos=["estado"],
            )

        estado_anterior = edicao.estado
        edicao.estado = "CANCELADA"
        incrementar_revisao(edicao)
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=id_edicao_competicao,
            acao="CANCELAR",
            antes={"estado": estado_anterior},
            depois={"estado": "CANCELADA"},
            id_edicao_competicao=id_edicao_competicao,
            responsavel=responsavel,
            motivo=motivo.strip(),
        )
        return _para_edicao_competicao_detalhe(edicao)
