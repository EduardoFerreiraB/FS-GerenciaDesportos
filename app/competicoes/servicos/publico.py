"""Leitura do portal publico.

Somente leitura: nenhuma funcao aqui bloqueia linhas, reconcilia disciplina ou
escreve no banco. Tudo sai convertido campo a campo para os schemas de
``contratos.publico``. Edicao nao publicada e edicao inexistente produzem o
mesmo 404, para nao confirmar que o recurso existe.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from competicoes.contratos.publico import (
    ArtilhariaPublica,
    ArtilheiroPublico,
    ChaveamentoPublico,
    ClassificacaoPublica,
    CompeticaoPublica,
    CompeticaoRef,
    DueloPublico,
    EdicaoCompeticaoNoEvento,
    EdicaoEventoPublica,
    EdicaoEventoRef,
    EdicaoPublicaDetalhe,
    EdicaoPublicaResumo,
    EquipePublica,
    EventoPublico,
    EventoRef,
    GrupoClassificacaoPublico,
    GrupoPublico,
    IntegrantePublico,
    LinhaClassificacaoPublica,
    PartidaPublica,
    VagaPublica,
)
from competicoes.erros import NaoEncontrado
from competicoes.servicos.chave import descrever_origem, placares_dos_duelos
from competicoes.servicos.numeracao import numerar_jogos
from competicoes.modelos import (
    Competicao,
    DueloEliminatorio,
    EdicaoCompeticao,
    EdicaoEvento,
    Equipe,
    Evento,
    GrupoCompeticao,
    Partida,
)


def _nao_encontrado(recurso: str, campo: str) -> NaoEncontrado:
    return NaoEncontrado(f"{recurso} não encontrada.", campos=[campo])


def _resumo(edicao: EdicaoCompeticao) -> dict:
    return {
        "id_edicao_competicao": edicao.id_edicao_competicao,
        "identificacao": edicao.identificacao,
        "categoria": edicao.categoria,
        "data_inicio": edicao.data_inicio,
        "data_fim": edicao.data_fim,
        "formato": edicao.formato,
        "estado": edicao.estado,
    }


def _publicadas(edicoes: list[EdicaoCompeticao]) -> list[EdicaoCompeticao]:
    return sorted(
        (e for e in edicoes if e.publicada),
        key=lambda e: (e.data_inicio, e.id_edicao_competicao),
        reverse=True,
    )


def _competicao_publica(competicao: Competicao) -> CompeticaoPublica | None:
    edicoes = _publicadas(competicao.edicoes)
    if not edicoes:
        return None
    return CompeticaoPublica(
        slug=competicao.slug,
        nome=competicao.nome,
        descricao=competicao.descricao,
        modalidade=competicao.modalidade.nome,
        edicoes=[EdicaoPublicaResumo(**_resumo(e)) for e in edicoes],
    )


def listar_competicoes_publicas(db: Session) -> list[CompeticaoPublica]:
    competicoes = db.execute(
        select(Competicao)
        .where(Competicao.arquivado.is_(False))
        .options(selectinload(Competicao.edicoes), joinedload(Competicao.modalidade))
        .order_by(Competicao.nome, Competicao.id_competicao)
    ).scalars().unique().all()
    return [c for c in map(_competicao_publica, competicoes) if c is not None]


def obter_competicao_publica(db: Session, slug: str) -> CompeticaoPublica:
    competicao = db.execute(
        select(Competicao).where(Competicao.slug == slug)
    ).scalar_one_or_none()
    publica = _competicao_publica(competicao) if competicao is not None else None
    if publica is None:
        raise _nao_encontrado("Competicao", "slug")
    return publica


def _evento_publico(evento: Evento) -> EventoPublico | None:
    edicoes_evento: list[EdicaoEventoPublica] = []
    for edicao_evento in sorted(evento.edicoes, key=lambda e: e.data_inicio, reverse=True):
        disputas = _publicadas(edicao_evento.edicoes_competicao)
        if not disputas:
            continue
        edicoes_evento.append(EdicaoEventoPublica(
            id_edicao_evento=edicao_evento.id_edicao_evento,
            identificacao=edicao_evento.identificacao,
            data_inicio=edicao_evento.data_inicio,
            data_fim=edicao_evento.data_fim,
            competicoes=[
                EdicaoCompeticaoNoEvento(
                    **_resumo(e),
                    competicao=CompeticaoRef(slug=e.competicao.slug, nome=e.competicao.nome),
                )
                for e in disputas
            ],
        ))
    if not edicoes_evento:
        return None
    return EventoPublico(
        slug=evento.slug, nome=evento.nome, descricao=evento.descricao, edicoes=edicoes_evento,
    )


def _consulta_eventos():
    return select(Evento).options(
        selectinload(Evento.edicoes)
        .selectinload(EdicaoEvento.edicoes_competicao)
        .joinedload(EdicaoCompeticao.competicao)
    )


def listar_eventos_publicos(db: Session) -> list[EventoPublico]:
    eventos = db.execute(
        _consulta_eventos()
        .where(Evento.arquivado.is_(False))
        .order_by(Evento.nome, Evento.id_evento)
    ).scalars().unique().all()
    return [e for e in map(_evento_publico, eventos) if e is not None]


def obter_evento_publico(db: Session, slug: str) -> EventoPublico:
    evento = db.execute(_consulta_eventos().where(Evento.slug == slug)).scalars().unique().one_or_none()
    publico = _evento_publico(evento) if evento is not None else None
    if publico is None:
        raise _nao_encontrado("Evento", "slug")
    return publico


def obter_edicao_publicada(db: Session, id_edicao: int) -> EdicaoCompeticao:
    edicao = db.get(EdicaoCompeticao, id_edicao)
    if edicao is None or not edicao.publicada:
        raise _nao_encontrado("Edicao", "id_edicao_competicao")
    return edicao


def _ordem_integrante(integrante) -> tuple:
    return (integrante.numero_camisa is None, integrante.numero_camisa or 0, integrante.nome_esportivo)


def obter_edicao_publica(db: Session, id_edicao: int) -> EdicaoPublicaDetalhe:
    edicao = obter_edicao_publicada(db, id_edicao)
    equipes = db.execute(
        select(Equipe)
        .where(Equipe.id_edicao_competicao == id_edicao)
        .options(selectinload(Equipe.integrantes))
        .order_by(Equipe.nome, Equipe.id_equipe)
    ).scalars().all()
    grupos = db.execute(
        select(GrupoCompeticao)
        .where(GrupoCompeticao.id_edicao_competicao == id_edicao)
        .order_by(GrupoCompeticao.ordem, GrupoCompeticao.id_grupo)
    ).scalars().all()

    edicao_evento = None
    if edicao.edicao_evento is not None:
        evento = edicao.edicao_evento.evento
        edicao_evento = EdicaoEventoRef(
            identificacao=edicao.edicao_evento.identificacao,
            evento=EventoRef(slug=evento.slug, nome=evento.nome),
        )

    return EdicaoPublicaDetalhe(
        **_resumo(edicao),
        competicao=CompeticaoRef(slug=edicao.competicao.slug, nome=edicao.competicao.nome),
        edicao_evento=edicao_evento,
        grupos=[GrupoPublico(id_grupo=g.id_grupo, nome=g.nome, ordem=g.ordem) for g in grupos],
        equipes=[
            EquipePublica(
                id_equipe=e.id_equipe,
                nome=e.nome,
                sigla=e.sigla,
                id_grupo=e.id_grupo,
                integrantes=[
                    IntegrantePublico(
                        nome_esportivo=i.nome_esportivo,
                        numero_camisa=i.numero_camisa,
                        posicao=i.posicao,
                    )
                    for i in sorted(e.integrantes, key=_ordem_integrante)
                    if i.situacao == "ATIVO"
                ],
            )
            for e in equipes
        ],
    )


def _equipes_por_id(db: Session, id_edicao: int) -> dict[int, Equipe]:
    equipes = db.execute(
        select(Equipe).where(Equipe.id_edicao_competicao == id_edicao)
    ).scalars().all()
    return {e.id_equipe: e for e in equipes}


def listar_partidas_publicas(db: Session, id_edicao: int) -> list[PartidaPublica]:
    obter_edicao_publicada(db, id_edicao)
    partidas = db.execute(
        select(Partida)
        .where(Partida.id_edicao_competicao == id_edicao)
        .options(joinedload(Partida.local), selectinload(Partida.ocorrencias))
        .order_by(Partida.rodada, Partida.ordem_jogo, Partida.id_partida)
    ).scalars().unique().all()
    equipes = _equipes_por_id(db, id_edicao)
    grupos = {
        g.id_grupo: g.nome
        for g in db.execute(
            select(GrupoCompeticao).where(GrupoCompeticao.id_edicao_competicao == id_edicao)
        ).scalars()
    }
    fases = {
        d.id_duelo: d.fase
        for d in db.execute(
            select(DueloEliminatorio).where(DueloEliminatorio.id_edicao_competicao == id_edicao)
        ).scalars()
    }

    numeros = numerar_jogos(
        partidas,
        {
            d.id_duelo: (d.fase, d.posicao_chave)
            for d in db.execute(
                select(DueloEliminatorio).where(DueloEliminatorio.id_edicao_competicao == id_edicao)
            ).scalars()
        },
    )
    partidas = sorted(partidas, key=lambda p: numeros[p.id_partida])

    resultado: list[PartidaPublica] = []
    for p in partidas:
        com_placar = p.estado in ("EM_ANDAMENTO", "FINALIZADA")
        gols = [o for o in p.ocorrencias if o.tipo in ("GOL", "GOL_CONTRA")]
        resultado.append(PartidaPublica(
            id_partida=p.id_partida,
            id_grupo=p.id_grupo,
            nome_grupo=grupos.get(p.id_grupo),
            fase=fases.get(p.id_duelo),
            rodada=p.rodada,
            ordem_jogo=p.ordem_jogo,
            numero_jogo=numeros[p.id_partida],
            id_equipe_mandante=p.id_equipe_mandante,
            nome_mandante=equipes[p.id_equipe_mandante].nome,
            sigla_mandante=equipes[p.id_equipe_mandante].sigla,
            id_equipe_visitante=p.id_equipe_visitante,
            nome_visitante=equipes[p.id_equipe_visitante].nome,
            sigla_visitante=equipes[p.id_equipe_visitante].sigla,
            data=p.data,
            hora=p.hora,
            local=p.local.loca_nome if p.local is not None else None,
            estado=p.estado,
            gols_mandante=(
                sum(o.id_equipe_beneficiada == p.id_equipe_mandante for o in gols) if com_placar else None
            ),
            gols_visitante=(
                sum(o.id_equipe_beneficiada == p.id_equipe_visitante for o in gols) if com_placar else None
            ),
            penaltis_mandante=p.penaltis_mandante if com_placar else None,
            penaltis_visitante=p.penaltis_visitante if com_placar else None,
        ))
    return resultado


def _linhas_publicas(linhas) -> list[LinhaClassificacaoPublica]:
    return [
        LinhaClassificacaoPublica(
            posicao=l.posicao, id_equipe=l.id_equipe, nome_equipe=l.nome_equipe,
            jogos=l.jogos, vitorias=l.vitorias, empates=l.empates, derrotas=l.derrotas,
            gols_pro=l.gols_pro, gols_contra=l.gols_contra, saldo_gols=l.saldo_gols,
            pontos=l.pontos, aproveitamento=l.aproveitamento,
            empate_persistente=l.empate_persistente,
        )
        for l in linhas
    ]


def obter_classificacao_publica(db: Session, id_edicao: int) -> ClassificacaoPublica:
    from competicoes.servicos.classificacao import obter_classificacao_edicao

    obter_edicao_publicada(db, id_edicao)
    tabela = obter_classificacao_edicao(db, id_edicao)
    return ClassificacaoPublica(
        linhas=_linhas_publicas(tabela.linhas) if tabela.linhas is not None else None,
        grupos=(
            [
                GrupoClassificacaoPublico(
                    id_grupo=g.id_grupo, nome=g.nome, linhas=_linhas_publicas(g.linhas)
                )
                for g in tabela.grupos
            ]
            if tabela.grupos is not None
            else None
        ),
        possui_empate_persistente=tabela.possui_empate_persistente,
    )


def _ordem_fase(fase: str) -> int:
    """Primeira fase antes; terceiro lugar logo antes da final."""
    from competicoes.servicos.motores.chaveamento import NOMES_FASES

    if fase == "TERCEIRO_LUGAR":
        return -1
    if fase == "FINAL":
        return 0
    quantidade = next((q for q, nome in NOMES_FASES.items() if nome == fase), None)
    if quantidade is None and fase.startswith("FASE_"):
        quantidade = int(fase.removeprefix("FASE_"))
    return -(quantidade or 0)


def obter_chaveamento_publico(db: Session, id_edicao: int) -> ChaveamentoPublico:
    obter_edicao_publicada(db, id_edicao)
    duelos = db.execute(
        select(DueloEliminatorio)
        .where(DueloEliminatorio.id_edicao_competicao == id_edicao)
        .options(selectinload(DueloEliminatorio.vagas))
    ).scalars().unique().all()
    duelos = sorted(duelos, key=lambda d: (_ordem_fase(d.fase), d.posicao_chave))
    equipes = _equipes_por_id(db, id_edicao)
    grupos = {
        g.id_grupo: g.nome
        for g in db.execute(
            select(GrupoCompeticao).where(GrupoCompeticao.id_edicao_competicao == id_edicao)
        ).scalars()
    }
    por_id = {d.id_duelo: d for d in duelos}
    placares = placares_dos_duelos(db, duelos)

    resultado: list[DueloPublico] = []
    for d in duelos:
        vagas: list[VagaPublica] = []
        for v in sorted(d.vagas, key=lambda v: v.posicao):
            id_equipe = v.id_equipe_resolvida or (v.id_equipe if v.origem != "FOLGA" else None)
            vagas.append(VagaPublica(
                posicao=v.posicao,
                origem=v.origem,
                id_equipe=id_equipe,
                nome_equipe=equipes[id_equipe].nome if id_equipe in equipes else None,
                nome_grupo=grupos.get(v.id_grupo),
                descricao_origem=descrever_origem(v, grupos, por_id),
            ))
        resultado.append(DueloPublico(
            id_duelo=d.id_duelo, fase=d.fase, posicao_chave=d.posicao_chave, estado=d.estado,
            ida_volta=d.ida_volta, id_equipe_vencedora=d.id_equipe_vencedora, vagas=vagas,
            placar=placares.get(d.id_duelo),
        ))
    return ChaveamentoPublico(duelos=resultado)


def obter_artilharia_publica(db: Session, id_edicao: int) -> ArtilhariaPublica:
    from competicoes.servicos.sumula import obter_artilharia_edicao

    obter_edicao_publicada(db, id_edicao)
    tabela = obter_artilharia_edicao(db, id_edicao=id_edicao)
    return ArtilhariaPublica(
        possui_jogos_em_andamento=tabela.possui_jogos_em_andamento,
        artilheiros=[
            ArtilheiroPublico(
                posicao=a.posicao, nome_esportivo=a.nome_esportivo, numero_camisa=a.numero_camisa,
                id_equipe=a.id_equipe, nome_equipe=a.nome_equipe, gols=a.gols,
                gols_em_andamento=a.gols_em_andamento,
            )
            for a in tabela.artilheiros
        ],
    )
