"""Serviço de estrutura de disputa, chaveamento e geração de calendário."""

from collections import defaultdict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models
from competicoes.contratos.configuracao import validar_configuracao
from competicoes.contratos.disputa import (
    DueloDetalhe,
    EstruturaDisputaDetalhe,
    GrupoDetalhe,
    PartidaSimples,
    RodadaGerada,
    TabelaGerar,
    VagaDueloDetalhe,
)
from competicoes.erros import (
    ConfiguracaoInvalida,
    ConflitoEstado,
    NaoEncontrado,
)
from competicoes.infra import (
    bloquear_edicao,
    incrementar_revisao,
    registrar_auditoria,
    transacao,
)
from competicoes.modelos import (
    DueloEliminatorio,
    EdicaoCompeticao,
    Equipe,
    GrupoCompeticao,
    IntegranteEquipe,
    OcorrenciaPartida,
    Partida,
    VagaDuelo,
)
from competicoes.servicos.motores.chaveamento import (
    distribuir_equipes_grupos,
    gerar_arvore_mata_mata,
    gerar_cruzamentos_grupos_mata_mata,
    gerar_rodadas_pontos_corridos,
    gerar_tabela_grupos,
)
from competicoes.servicos.motores.classificacao import calcular_classificacao as calcular_tabela


def gerar_tabela_edicao(
    db: Session,
    id_edicao: int,
    dados: TabelaGerar | None,
    responsavel: models.Usuario,
) -> EstruturaDisputaDetalhe:
    """Gera deterministamente o calendário e confrontos da edição."""
    edicao = bloquear_edicao(db, id_edicao)

    if edicao.estado != "RASCUNHO":
        raise ConflitoEstado(
            "Apenas edições em estado RASCUNHO podem ter a tabela gerada.",
            campos=["estado"],
        )

    config = validar_configuracao(edicao.formato, edicao.configuracao)

    # Carregar equipes ativas ordenadas por ID de forma determinística
    equipes = db.execute(
        select(Equipe)
        .where(
            Equipe.id_edicao_competicao == id_edicao,
            Equipe.situacao == "ATIVA",
        )
        .order_by(Equipe.id_equipe)
    ).scalars().all()

    if len(equipes) < 2:
        raise ConfiguracaoInvalida(
            f"A edição deve possuir no mínimo de 2 equipes ativas para gerar a tabela (encontradas {len(equipes)}).",
            campos=["equipes"],
        )

    # Validar que TODAS as equipes possuem ao menos 1 integrante inscrito ativo
    for eq in equipes:
        qtd_ativos = db.execute(
            select(func.count(IntegranteEquipe.id_integrante)).where(
                IntegranteEquipe.id_equipe == eq.id_equipe,
                IntegranteEquipe.situacao == "ATIVO",
            )
        ).scalar() or 0
        if qtd_ativos < 1:
            raise ConfiguracaoInvalida(
                f"A equipe '{eq.nome}' não possui nenhum integrante ativo inscrito.",
                campos=["equipes"],
            )

    equipes_ids = [eq.id_equipe for eq in equipes]

    with transacao(db):
        if edicao.formato == "PONTOS_CORRIDOS":
            turno_returno = bool(getattr(config, "turno_e_returno", False))
            rodadas = gerar_rodadas_pontos_corridos(equipes_ids, turno_returno=turno_returno)
            for r in rodadas:
                for p in r.partidas:
                    partida = Partida(
                        id_edicao_competicao=id_edicao,
                        id_grupo=None,
                        id_duelo=None,
                        rodada=r.rodada,
                        ordem_jogo=p.ordem_jogo,
                        id_equipe_mandante=p.id_equipe_mandante,
                        id_equipe_visitante=p.id_equipe_visitante,
                        estado="AGENDADA",
                    )
                    db.add(partida)

        elif edicao.formato == "GRUPOS_MATA_MATA":
            qtd_grupos = config.quantidade_grupos
            minimo_necessario = qtd_grupos * 2
            if len(equipes_ids) < minimo_necessario:
                raise ConfiguracaoInvalida(
                    f"Mínimo de {minimo_necessario} equipes necessário para {qtd_grupos} grupos de no mínimo 2 equipes.",
                    campos=["equipes"],
                )

            # Distribuição informada ou uniforme automática
            if dados and dados.distribuicao_grupos:
                dist = dados.distribuicao_grupos
            else:
                dist = distribuir_equipes_grupos(equipes_ids, qtd_grupos)

            # Criar grupos no banco
            grupos_map: dict[str, GrupoCompeticao] = {}
            for idx, nome_grupo in enumerate(dist.keys(), start=1):
                grupo_db = GrupoCompeticao(
                    id_edicao_competicao=id_edicao,
                    nome=nome_grupo,
                    ordem=idx,
                )
                db.add(grupo_db)
                grupos_map[nome_grupo] = grupo_db
            db.flush()

            # Associar equipes aos grupos
            equipes_by_id = {eq.id_equipe: eq for eq in equipes}
            for nome_grupo, tids in dist.items():
                g_id = grupos_map[nome_grupo].id_grupo
                for tid in tids:
                    if tid in equipes_by_id:
                        equipes_by_id[tid].id_grupo = g_id
            db.flush()

            # Gerar partidas da fase de grupos
            rodadas_grupos = gerar_tabela_grupos(
                dist, turno_returno=bool(config.turno_e_returno_grupos)
            )
            for rg in rodadas_grupos:
                for p in rg.partidas:
                    g_id = (
                        grupos_map[p.nome_grupo].id_grupo
                        if p.nome_grupo and p.nome_grupo in grupos_map
                        else None
                    )
                    partida = Partida(
                        id_edicao_competicao=id_edicao,
                        id_grupo=g_id,
                        id_duelo=None,
                        rodada=rg.rodada,
                        ordem_jogo=p.ordem_jogo,
                        id_equipe_mandante=p.id_equipe_mandante,
                        id_equipe_visitante=p.id_equipe_visitante,
                        estado="AGENDADA",
                    )
                    db.add(partida)

            # Gerar estrutura da árvore de mata-mata subsequente
            duelos_planejados = gerar_cruzamentos_grupos_mata_mata(
                nomes_grupos=list(dist.keys()),
                classificados_por_grupo=config.classificados_por_grupo,
                ida_volta=bool(config.ida_volta_eliminatoria),
                terceiro_lugar=bool(config.terceiro_lugar),
            )

            duelos_db_map: dict[tuple[str, int], DueloEliminatorio] = {}
            for d in duelos_planejados:
                duelo_db = DueloEliminatorio(
                    id_edicao_competicao=id_edicao,
                    fase=d.fase,
                    posicao_chave=d.posicao_chave,
                    estado="PENDENTE",
                    ida_volta=d.ida_volta,
                )
                db.add(duelo_db)
                duelos_db_map[(d.fase, d.posicao_chave)] = duelo_db
            db.flush()

            for d in duelos_planejados:
                duelo_db = duelos_db_map[(d.fase, d.posicao_chave)]
                for v in d.vagas:
                    id_grp = (
                        grupos_map[v.nome_grupo].id_grupo
                        if v.nome_grupo and v.nome_grupo in grupos_map
                        else None
                    )
                    origem_duelo_id = None
                    if v.fase_origem and v.posicao_duelo_origem:
                        duelo_origem = duelos_db_map.get((v.fase_origem, v.posicao_duelo_origem))
                        if duelo_origem:
                            origem_duelo_id = duelo_origem.id_duelo

                    vaga_db = VagaDuelo(
                        id_duelo=duelo_db.id_duelo,
                        posicao=v.posicao,
                        origem=v.origem,
                        id_equipe=v.id_equipe,
                        id_grupo=id_grp,
                        posicao_grupo=v.posicao_grupo,
                        id_duelo_origem=origem_duelo_id,
                        id_equipe_resolvida=v.id_equipe_resolvida,
                    )
                    db.add(vaga_db)
            db.flush()

        elif edicao.formato == "MATA_MATA":
            duelos_planejados = gerar_arvore_mata_mata(
                equipes_ids,
                ida_volta=bool(config.ida_volta),
                terceiro_lugar=bool(config.terceiro_lugar),
            )

            duelos_db_map: dict[tuple[str, int], DueloEliminatorio] = {}
            for d in duelos_planejados:
                duelo_db = DueloEliminatorio(
                    id_edicao_competicao=id_edicao,
                    fase=d.fase,
                    posicao_chave=d.posicao_chave,
                    estado="PENDENTE",
                    ida_volta=d.ida_volta,
                )
                db.add(duelo_db)
                duelos_db_map[(d.fase, d.posicao_chave)] = duelo_db
            db.flush()

            for d in duelos_planejados:
                duelo_db = duelos_db_map[(d.fase, d.posicao_chave)]
                for v in d.vagas:
                    origem_duelo_id = None
                    if v.fase_origem and v.posicao_duelo_origem:
                        duelo_origem = duelos_db_map.get((v.fase_origem, v.posicao_duelo_origem))
                        if duelo_origem:
                            origem_duelo_id = duelo_origem.id_duelo

                    eq_resolvida = v.id_equipe if v.origem == "EQUIPE_INICIAL" else None
                    vaga_db = VagaDuelo(
                        id_duelo=duelo_db.id_duelo,
                        posicao=v.posicao,
                        origem=v.origem,
                        id_equipe=v.id_equipe,
                        id_grupo=None,
                        posicao_grupo=None,
                        id_duelo_origem=origem_duelo_id,
                        id_equipe_resolvida=eq_resolvida,
                    )
                    db.add(vaga_db)
            db.flush()

            # Resolução imediata de duelos com FOLGA
            for d in duelos_planejados:
                duelo_db = duelos_db_map[(d.fase, d.posicao_chave)]
                vagas_d = db.execute(
                    select(VagaDuelo)
                    .where(VagaDuelo.id_duelo == duelo_db.id_duelo)
                    .order_by(VagaDuelo.posicao)
                ).scalars().all()

                tem_folga = any(v.origem == "FOLGA" for v in vagas_d)
                if tem_folga:
                    v_time = next(v for v in vagas_d if v.origem != "FOLGA")
                    duelo_db.estado = "RESOLVIDO"
                    duelo_db.id_equipe_vencedora = v_time.id_equipe
                    db.flush()

                    # Propaga o vencedor para duelos subsequentes
                    vagas_filhas = db.execute(
                        select(VagaDuelo).where(
                            VagaDuelo.id_duelo_origem == duelo_db.id_duelo,
                            VagaDuelo.origem == "VENCEDOR_DUELO",
                        )
                    ).scalars().all()
                    for vf in vagas_filhas:
                        vf.id_equipe_resolvida = v_time.id_equipe
                    db.flush()

            # Criação de partidas para duelos da primeira fase com ambas equipes definidas
            primeira_fase_nome = duelos_planejados[0].fase if duelos_planejados else None
            for (fase, _pos), duelo_db in duelos_db_map.items():
                if fase != primeira_fase_nome:
                    continue
                if duelo_db.estado == "RESOLVIDO":
                    continue
                vagas_d = db.execute(
                    select(VagaDuelo)
                    .where(VagaDuelo.id_duelo == duelo_db.id_duelo)
                    .order_by(VagaDuelo.posicao)
                ).scalars().all()

                if len(vagas_d) == 2 and vagas_d[0].id_equipe_resolvida and vagas_d[1].id_equipe_resolvida:
                    duelo_db.estado = "DEFINIDO"
                    t1 = vagas_d[0].id_equipe_resolvida
                    t2 = vagas_d[1].id_equipe_resolvida
                    p1 = Partida(
                        id_edicao_competicao=id_edicao,
                        id_grupo=None,
                        id_duelo=duelo_db.id_duelo,
                        ordem_jogo=1,
                        id_equipe_mandante=t1,
                        id_equipe_visitante=t2,
                        estado="AGENDADA",
                    )
                    db.add(p1)

                    eh_final_unica = getattr(config, "final_unica", True) and fase == "FINAL"
                    if duelo_db.ida_volta and not eh_final_unica:
                        p2 = Partida(
                            id_edicao_competicao=id_edicao,
                            id_grupo=None,
                            id_duelo=duelo_db.id_duelo,
                            ordem_jogo=2,
                            id_equipe_mandante=t2,
                            id_equipe_visitante=t1,
                            estado="AGENDADA",
                        )
                        db.add(p2)
            db.flush()

        edicao.estado = "EM_ANDAMENTO"
        incrementar_revisao(edicao)
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=id_edicao,
            acao="GERAR_TABELA",
            antes={"estado": "RASCUNHO"},
            depois={"estado": "EM_ANDAMENTO"},
            id_edicao_competicao=id_edicao,
            responsavel=responsavel,
        )

    return obter_estrutura_disputa(db, id_edicao)


def desfazer_tabela_edicao(
    db: Session,
    id_edicao: int,
    responsavel: models.Usuario,
) -> None:
    """Desfaz tabela de jogos, restaurando o estado da edição para RASCUNHO."""
    edicao = bloquear_edicao(db, id_edicao)

    if edicao.estado != "EM_ANDAMENTO":
        raise ConflitoEstado(
            "Apenas edições em andamento podem ter a tabela desfeita.",
            campos=["estado"],
        )

    partidas = db.execute(
        select(Partida).where(Partida.id_edicao_competicao == id_edicao)
    ).scalars().all()

    if any(p.estado != "AGENDADA" for p in partidas):
        raise ConflitoEstado(
            "Não é possível desfazer tabela com partidas em andamento ou finalizadas.",
            campos=["partidas"],
        )

    tem_ocorrencias = db.execute(
        select(OcorrenciaPartida.id_ocorrencia)
        .join(Partida)
        .where(Partida.id_edicao_competicao == id_edicao)
    ).first()
    if tem_ocorrencias:
        raise ConflitoEstado(
            "Não é possível desfazer tabela com partidas que possuem súmula ou ocorrências registradas.",
            campos=["partidas"],
        )

    with transacao(db):
        # 1. Resetar grupo nas equipes
        equipes = db.execute(
            select(Equipe).where(Equipe.id_edicao_competicao == id_edicao)
        ).scalars().all()
        for eq in equipes:
            eq.id_grupo = None
        db.flush()

        # 2. Excluir partidas
        for p in partidas:
            db.delete(p)
        db.flush()

        # 3. Excluir vagas e duelos
        vagas = db.execute(
            select(VagaDuelo).where(
                VagaDuelo.id_duelo.in_(
                    select(DueloEliminatorio.id_duelo).where(
                        DueloEliminatorio.id_edicao_competicao == id_edicao
                    )
                )
            )
        ).scalars().all()
        for v in vagas:
            db.delete(v)
        db.flush()

        duelos = db.execute(
            select(DueloEliminatorio).where(
                DueloEliminatorio.id_edicao_competicao == id_edicao
            )
        ).scalars().all()
        for d in duelos:
            db.delete(d)
        db.flush()

        # 4. Excluir grupos
        grupos = db.execute(
            select(GrupoCompeticao).where(
                GrupoCompeticao.id_edicao_competicao == id_edicao
            )
        ).scalars().all()
        for g in grupos:
            db.delete(g)
        db.flush()

        # 5. Voltar estado para RASCUNHO
        edicao.estado = "RASCUNHO"
        incrementar_revisao(edicao)
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=id_edicao,
            acao="DESFAZER_TABELA",
            antes={"estado": "EM_ANDAMENTO"},
            depois={"estado": "RASCUNHO"},
            id_edicao_competicao=id_edicao,
            responsavel=responsavel,
        )


def obter_estrutura_disputa(db: Session, id_edicao: int) -> EstruturaDisputaDetalhe:
    """Recupera a estrutura completa de disputa da edição."""
    edicao = db.execute(
        select(EdicaoCompeticao).where(
            EdicaoCompeticao.id_edicao_competicao == id_edicao
        )
    ).scalar_one_or_none()

    if edicao is None:
        raise NaoEncontrado(
            "Edição de competição não encontrada.",
            campos=["id_edicao_competicao"],
        )

    # Grupos
    grupos_db = db.execute(
        select(GrupoCompeticao)
        .where(GrupoCompeticao.id_edicao_competicao == id_edicao)
        .order_by(GrupoCompeticao.ordem)
    ).scalars().all()

    grupos_res: list[GrupoDetalhe] = []
    for g in grupos_db:
        tids = db.execute(
            select(Equipe.id_equipe)
            .where(Equipe.id_grupo == g.id_grupo)
            .order_by(Equipe.id_equipe)
        ).scalars().all()
        grupos_res.append(
            GrupoDetalhe(
                id_grupo=g.id_grupo,
                id_edicao_competicao=id_edicao,
                nome=g.nome,
                ordem=g.ordem,
                equipes=list(tids),
            )
        )

    # Duelos e vagas
    duelos_db = db.execute(
        select(DueloEliminatorio)
        .where(DueloEliminatorio.id_edicao_competicao == id_edicao)
        .order_by(DueloEliminatorio.fase, DueloEliminatorio.posicao_chave)
    ).scalars().all()

    duelos_res: list[DueloDetalhe] = []
    for d in duelos_db:
        vagas_db = db.execute(
            select(VagaDuelo)
            .where(VagaDuelo.id_duelo == d.id_duelo)
            .order_by(VagaDuelo.posicao)
        ).scalars().all()
        vagas_res = [
            VagaDueloDetalhe(
                id_vaga=v.id_vaga,
                id_duelo=v.id_duelo,
                posicao=v.posicao,
                origem=v.origem,
                id_equipe=v.id_equipe,
                id_grupo=v.id_grupo,
                posicao_grupo=v.posicao_grupo,
                id_duelo_origem=v.id_duelo_origem,
                id_equipe_resolvida=v.id_equipe_resolvida,
            )
            for v in vagas_db
        ]
        duelos_res.append(
            DueloDetalhe(
                id_duelo=d.id_duelo,
                id_edicao_competicao=id_edicao,
                fase=d.fase,
                posicao_chave=d.posicao_chave,
                estado=d.estado,
                id_equipe_vencedora=d.id_equipe_vencedora,
                ida_volta=d.ida_volta,
                vagas=vagas_res,
            )
        )

    # Partidas e rodadas
    partidas_db = db.execute(
        select(Partida)
        .where(Partida.id_edicao_competicao == id_edicao)
        .order_by(Partida.rodada, Partida.ordem_jogo)
    ).scalars().all()

    partidas_res: list[PartidaSimples] = []
    rodadas_map: dict[int, list[PartidaSimples]] = defaultdict(list)
    for p in partidas_db:
        ps = PartidaSimples(
            id_partida=p.id_partida,
            id_equipe_mandante=p.id_equipe_mandante,
            id_equipe_visitante=p.id_equipe_visitante,
            rodada=p.rodada,
            ordem_jogo=p.ordem_jogo,
            id_grupo=p.id_grupo,
            id_duelo=p.id_duelo,
            estado=p.estado,
        )
        partidas_res.append(ps)
        if p.rodada is not None:
            rodadas_map[p.rodada].append(ps)

    rodadas_res = [
        RodadaGerada(rodada=r_num, partidas=rodadas_map[r_num])
        for r_num in sorted(rodadas_map.keys())
    ]

    return EstruturaDisputaDetalhe(
        id_edicao_competicao=id_edicao,
        formato=edicao.formato,
        estado=edicao.estado,
        grupos=grupos_res,
        duelos=duelos_res,
        rodadas=rodadas_res,
        partidas=partidas_res,
        total_partidas=len(partidas_res),
    )


def encerrar_fase_grupos(
    db: Session,
    id_edicao: int,
    responsavel: models.Usuario,
) -> EstruturaDisputaDetalhe:
    """Encerra a fase de grupos, computa classificação e avança os classificados para o mata-mata."""
    edicao = bloquear_edicao(db, id_edicao)

    if edicao.formato != "GRUPOS_MATA_MATA":
        raise ConflitoEstado(
            "Apenas edições no formato GRUPOS_MATA_MATA possuem encerramento de fase de grupos.",
            campos=["formato"],
        )

    if edicao.estado != "EM_ANDAMENTO":
        raise ConflitoEstado(
            "A edição deve estar EM_ANDAMENTO para encerrar a fase de grupos.",
            campos=["estado"],
        )

    partidas_grupos = db.execute(
        select(Partida).where(
            Partida.id_edicao_competicao == id_edicao,
            Partida.id_grupo.isnot(None),
        )
    ).scalars().all()

    if not partidas_grupos:
        raise ConflitoEstado(
            "Não há partidas de grupos cadastradas nesta edição.",
            campos=["partidas"],
        )

    if any(p.estado != "FINALIZADA" for p in partidas_grupos):
        raise ConflitoEstado(
            "Todas as partidas da fase de grupos devem estar finalizadas antes do encerramento.",
            campos=["partidas"],
        )

    config = validar_configuracao(edicao.formato, edicao.configuracao)
    classificados_por_grupo = config.classificados_por_grupo
    pts_cfg = {
        "vitoria": config.pontuacao.vitoria,
        "empate": config.pontuacao.empate,
        "derrota": config.pontuacao.derrota,
    }
    criterios_desempate = [c.value for c in config.desempates]

    grupos = db.execute(
        select(GrupoCompeticao)
        .where(GrupoCompeticao.id_edicao_competicao == id_edicao)
        .order_by(GrupoCompeticao.ordem)
    ).scalars().all()

    classificados_por_grupo_map: dict[int, list[int]] = {}

    for g in grupos:
        equipes_grupo = db.execute(
            select(Equipe)
            .where(Equipe.id_grupo == g.id_grupo)
            .order_by(Equipe.id_equipe)
        ).scalars().all()

        partidas_deste = [p for p in partidas_grupos if p.id_grupo == g.id_grupo]
        partidas_dados = []
        for p in partidas_deste:
            gm = sum(
                1 for oc in p.ocorrencias
                if oc.tipo == "GOL" and oc.id_equipe_beneficiada == p.id_equipe_mandante
            )
            gv = sum(
                1 for oc in p.ocorrencias
                if oc.tipo == "GOL" and oc.id_equipe_beneficiada == p.id_equipe_visitante
            )
            partidas_dados.append({
                "id_partida": p.id_partida,
                "id_equipe_mandante": p.id_equipe_mandante,
                "id_equipe_visitante": p.id_equipe_visitante,
                "estado": p.estado,
                "gols_mandante": gm,
                "gols_visitante": gv,
            })

        tabela = calcular_tabela(
            equipes=[{"id_equipe": eq.id_equipe, "nome_equipe": eq.nome} for eq in equipes_grupo],
            partidas=partidas_dados,
            configuracao_pontos=pts_cfg,
            ordem_desempates=criterios_desempate,
        )

        # Checa empate persistente na zona de classificação
        linhas_classificadas = tabela[:classificados_por_grupo]
        if any(linha.empate_persistente for linha in linhas_classificadas):
            raise ConflitoEstado(
                f"Empate persistente não resolvido no grupo '{g.nome}'. Não é possível avançar sem critérios de desempate conclusivos.",
                campos=["classificacao"],
            )

        classificados_por_grupo_map[g.id_grupo] = [
            linha.id_equipe for linha in linhas_classificadas
        ]

    with transacao(db):
        # 1. Preencher vagas de primeira fase eliminatória vindas de grupos
        vagas_grupo = db.execute(
            select(VagaDuelo).where(
                VagaDuelo.origem == "POSICAO_GRUPO",
                VagaDuelo.id_duelo.in_(
                    select(DueloEliminatorio.id_duelo).where(
                        DueloEliminatorio.id_edicao_competicao == id_edicao
                    )
                ),
            )
        ).scalars().all()

        for v in vagas_grupo:
            if v.id_grupo in classificados_por_grupo_map:
                classificados = classificados_por_grupo_map[v.id_grupo]
                if v.posicao_grupo and 1 <= v.posicao_grupo <= len(classificados):
                    v.id_equipe_resolvida = classificados[v.posicao_grupo - 1]
        db.flush()

        # 2. Verificar duelos com ambas as equipes resolvidas e criar partidas
        duelos_elim = db.execute(
            select(DueloEliminatorio).where(
                DueloEliminatorio.id_edicao_competicao == id_edicao
            )
        ).scalars().all()

        for duelo in duelos_elim:
            vagas_d = db.execute(
                select(VagaDuelo)
                .where(VagaDuelo.id_duelo == duelo.id_duelo)
                .order_by(VagaDuelo.posicao)
            ).scalars().all()

            if (
                len(vagas_d) == 2
                and vagas_d[0].id_equipe_resolvida
                and vagas_d[1].id_equipe_resolvida
            ):
                duelo.estado = "DEFINIDO"
                ja_tem_partida = db.execute(
                    select(Partida).where(Partida.id_duelo == duelo.id_duelo)
                ).first()

                if not ja_tem_partida:
                    t1 = vagas_d[0].id_equipe_resolvida
                    t2 = vagas_d[1].id_equipe_resolvida
                    p1 = Partida(
                        id_edicao_competicao=id_edicao,
                        id_grupo=None,
                        id_duelo=duelo.id_duelo,
                        ordem_jogo=1,
                        id_equipe_mandante=t1,
                        id_equipe_visitante=t2,
                        estado="AGENDADA",
                    )
                    db.add(p1)

                    eh_final_unica = getattr(config, "final_unica", True) and duelo.fase == "FINAL"
                    if duelo.ida_volta and not eh_final_unica:
                        p2 = Partida(
                            id_edicao_competicao=id_edicao,
                            id_grupo=None,
                            id_duelo=duelo.id_duelo,
                            ordem_jogo=2,
                            id_equipe_mandante=t2,
                            id_equipe_visitante=t1,
                            estado="AGENDADA",
                        )
                        db.add(p2)
        db.flush()

        incrementar_revisao(edicao)
        registrar_auditoria(
            db,
            entidade="edicoes_competicao",
            id_entidade=id_edicao,
            acao="ENCERRAR_FASE_GRUPOS",
            antes=None,
            depois=None,
            id_edicao_competicao=id_edicao,
            responsavel=responsavel,
        )

    return obter_estrutura_disputa(db, id_edicao)
