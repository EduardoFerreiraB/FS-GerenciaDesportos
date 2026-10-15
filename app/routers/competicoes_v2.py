"""Roteador para endpoints administrativos V2 (Domínio de Competições).

Endpoints disponíveis sob o prefixo /v2:
- POST /v2/grupos-competicoes: Criação de grupo/evento agregador.
- GET /v2/grupos-competicoes: Listagem de grupos/eventos.
- GET /v2/grupos-competicoes/{id}: Detalhes do grupo com suas competições.
- POST /v2/competicoes: Criação de competição independente (com regras_formato flexível).
- GET /v2/competicoes: Listagem de competições (com filtros por modalidade, status, grupo).
- GET /v2/competicoes/{id}: Detalhes completos da competição.
- PUT /v2/competicoes/{id}: Atualização da competição.
- DELETE /v2/competicoes/{id}: Exclusão com validação de confrontos.
- POST /v2/competicoes/{id}/equipes: Cadastro de equipe na competição.
- GET /v2/competicoes/{id}/equipes: Lista de equipes da competição.
- POST /v2/equipes/{id}/jogadores: Cadastro de jogador no elenco da equipe.
- GET /v2/equipes/{id}/jogadores: Lista de jogadores da equipe.
- DELETE /v2/jogadores/{id}: Remoção de jogador.
- POST /v2/competicoes/{id}/gerar-confrontos: Disparo do motor de geração de confrontos.
- GET /v2/competicoes/{id}/confrontos: Lista de confrontos com filtro por rodada/fase/grupo.
- POST /v2/confrontos/{id}/ocorrencias: Lançamento rápido de beira de campo (gols, cartões).
- DELETE /v2/confrontos/ocorrencias/{id}: Exclusão de ocorrência (estorno de gol/cartão).
- POST /v2/confrontos/{id}/finalizar: Encerramento da partida com suporte a pênaltis.
- GET /v2/competicoes/{id}/classificacao: Consulta da classificação apurada.
- GET /v2/competicoes/{id}/artilharia: Consulta de artilharia consolidada.
- GET /v2/competicoes/{id}/disciplinar: Relatório disciplinar de cartões e suspensões.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from database import get_db
import models
import schemas
from security import check_coordenador_role, get_current_active_user
from services import classificacao_v2, confrontos_v2, sumula_v2


router = APIRouter(
    prefix="/v2",
    tags=["Competições V2 - Administrativo"],
)


# ==============================================================================
# 1. GRUPOS DE COMPETIÇÕES
# ==============================================================================

@router.post(
    "/grupos-competicoes",
    response_model=schemas.GrupoCompeticoesResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar grupo ou evento agregador de competições",
)
def criar_grupo_competicoes(
    grupo: schemas.GrupoCompeticoesCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    existente = db.query(models.GrupoCompeticoes).filter(models.GrupoCompeticoes.slug == grupo.slug).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Slug '{grupo.slug}' já está em uso.",
        )

    db_grupo = models.GrupoCompeticoes(**grupo.model_dump())
    db.add(db_grupo)
    db.commit()
    db.refresh(db_grupo)
    return db_grupo


@router.get(
    "/grupos-competicoes",
    response_model=List[schemas.GrupoCompeticoesResponse],
    summary="Listar grupos ou eventos agregadores",
)
def listar_grupos_competicoes(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    return db.query(models.GrupoCompeticoes).order_by(models.GrupoCompeticoes.id_grupo.desc()).all()


@router.get(
    "/grupos-competicoes/{id_grupo}",
    response_model=schemas.GrupoCompeticoesDetalhadoResponse,
    summary="Obter detalhes de grupo com suas competições",
)
def obter_grupo_competicoes(
    id_grupo: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    grupo = (
        db.query(models.GrupoCompeticoes)
        .options(selectinload(models.GrupoCompeticoes.competicoes))
        .filter(models.GrupoCompeticoes.id_grupo == id_grupo)
        .first()
    )
    if not grupo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")
    return grupo


# ==============================================================================
# 2. COMPETIÇÕES V2
# ==============================================================================

@router.post(
    "/competicoes",
    response_model=schemas.CompeticaoV2Response,
    status_code=status.HTTP_201_CREATED,
    summary="Criar competição independente V2",
)
def criar_competicao_v2(
    competicao: schemas.CompeticaoV2Create,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    mod = db.query(models.Modalidade).filter(models.Modalidade.id_modalidade == competicao.id_modalidade).first()
    if not mod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modalidade não encontrada.")

    if competicao.id_grupo is not None:
        grp = db.query(models.GrupoCompeticoes).filter(models.GrupoCompeticoes.id_grupo == competicao.id_grupo).first()
        if not grp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")

    dados = competicao.model_dump()
    db_comp = models.Competicao(status="RASCUNHO", **dados)
    db.add(db_comp)
    db.commit()
    db.refresh(db_comp)
    return db_comp


@router.get(
    "/competicoes",
    response_model=List[schemas.CompeticaoV2Response],
    summary="Listar competições com filtros (modalidade, status, grupo)",
)
def listar_competicoes_v2(
    id_modalidade: Optional[int] = Query(None, description="Filtrar por modalidade"),
    status: Optional[str] = Query(None, description="Filtrar por status"),
    id_grupo: Optional[int] = Query(None, description="Filtrar por grupo agregador"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    q = db.query(models.Competicao).options(
        selectinload(models.Competicao.modalidade),
        selectinload(models.Competicao.grupo),
    )
    if id_modalidade is not None:
        q = q.filter(models.Competicao.id_modalidade == id_modalidade)
    if status is not None:
        q = q.filter(models.Competicao.status == status)
    if id_grupo is not None:
        q = q.filter(models.Competicao.id_grupo == id_grupo)

    return q.order_by(models.Competicao.id_competicao.desc()).all()


@router.get(
    "/competicoes/{id_competicao}",
    response_model=schemas.CompeticaoV2Response,
    summary="Obter detalhes completos da competição",
)
def obter_competicao_v2(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    comp = (
        db.query(models.Competicao)
        .options(
            selectinload(models.Competicao.modalidade),
            selectinload(models.Competicao.grupo),
        )
        .filter(models.Competicao.id_competicao == id_competicao)
        .first()
    )
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")
    return comp


@router.put(
    "/competicoes/{id_competicao}",
    response_model=schemas.CompeticaoV2Response,
    summary="Atualizar competição V2",
)
def atualizar_competicao_v2(
    id_competicao: int,
    dados_atualizados: schemas.CompeticaoV2Update,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    dados = dados_atualizados.model_dump(exclude_unset=True)

    if "id_modalidade" in dados and dados["id_modalidade"] is not None:
        mod = db.query(models.Modalidade).filter(models.Modalidade.id_modalidade == dados["id_modalidade"]).first()
        if not mod:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modalidade não encontrada.")

    if "id_grupo" in dados and dados["id_grupo"] is not None:
        grp = db.query(models.GrupoCompeticoes).filter(models.GrupoCompeticoes.id_grupo == dados["id_grupo"]).first()
        if not grp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")

    for chave, valor in dados.items():
        setattr(comp, chave, valor)

    db.commit()
    db.refresh(comp)
    return comp


@router.delete(
    "/competicoes/{id_competicao}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir competição com validação de confrontos",
)
def excluir_competicao_v2(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    jogos_ativos = (
        db.query(models.Confronto)
        .filter(
            models.Confronto.id_competicao == id_competicao,
            models.Confronto.status.in_(["Em Andamento", "Finalizado"]),
        )
        .first()
    )
    if jogos_ativos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível excluir competição com confrontos em andamento ou finalizados.",
        )

    # Limpeza em cascata para exclusão segura
    ids_confrontos = [
        c.id_confronto
        for c in db.query(models.Confronto.id_confronto).filter(models.Confronto.id_competicao == id_competicao).all()
    ]
    if ids_confrontos:
        db.query(models.OcorrenciaPartida).filter(
            models.OcorrenciaPartida.id_confronto.in_(ids_confrontos)
        ).delete(synchronize_session=False)
        db.query(models.Confronto).filter(
            models.Confronto.id_competicao == id_competicao
        ).delete(synchronize_session=False)

    ids_equipes = [
        e.id_equipe
        for e in db.query(models.Equipe.id_equipe).filter(models.Equipe.id_competicao == id_competicao).all()
    ]
    if ids_equipes:
        db.query(models.Jogador).filter(
            models.Jogador.id_equipe.in_(ids_equipes)
        ).delete(synchronize_session=False)
        db.query(models.Equipe).filter(
            models.Equipe.id_competicao == id_competicao
        ).delete(synchronize_session=False)

    db.delete(comp)
    db.commit()
    return None


# ==============================================================================
# 3. EQUIPES E JOGADORES (ELENCO)
# ==============================================================================

@router.post(
    "/competicoes/{id_competicao}/equipes",
    response_model=schemas.Equipe,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar equipe na competição",
)
def criar_equipe_competicao_v2(
    id_competicao: int,
    equipe: schemas.EquipeCompeticaoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")
    if comp.modo_inscricao != "EQUIPE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A competição não aceita equipes.",
        )

    db_equipe = models.Equipe(
        nome=equipe.nome,
        grupo=equipe.grupo,
        id_competicao=id_competicao,
        id_edicao=comp.id_edicao,
    )
    db.add(db_equipe)
    db.commit()
    db.refresh(db_equipe)
    return db_equipe


@router.get(
    "/competicoes/{id_competicao}/equipes",
    response_model=List[schemas.Equipe],
    summary="Listar equipes da competição",
)
def listar_equipes_competicao_v2(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")
    return db.query(models.Equipe).filter(models.Equipe.id_competicao == id_competicao).all()


@router.post(
    "/equipes/{id_equipe}/jogadores",
    response_model=schemas.JogadorResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar jogador no elenco da equipe",
)
def adicionar_jogador_elenco_v2(
    id_equipe: int,
    jogador: schemas.JogadorCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    equipe = db.query(models.Equipe).filter(models.Equipe.id_equipe == id_equipe).first()
    if not equipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipe não encontrada.")

    db_jogador = models.Jogador(id_equipe=id_equipe, **jogador.model_dump())
    db.add(db_jogador)
    db.commit()
    db.refresh(db_jogador)
    return db_jogador


@router.get(
    "/equipes/{id_equipe}/jogadores",
    response_model=List[schemas.JogadorResponse],
    summary="Listar jogadores do elenco da equipe",
)
def listar_jogadores_equipe_v2(
    id_equipe: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    equipe = db.query(models.Equipe).filter(models.Equipe.id_equipe == id_equipe).first()
    if not equipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipe não encontrada.")
    return db.query(models.Jogador).filter(models.Jogador.id_equipe == id_equipe).all()


@router.delete(
    "/jogadores/{id_jogador}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover jogador do elenco",
)
def remover_jogador_v2(
    id_jogador: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    jogador = db.query(models.Jogador).filter(models.Jogador.id_jogador == id_jogador).first()
    if not jogador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jogador não encontrado.")
    db.delete(jogador)
    db.commit()
    return None


# ==============================================================================
# 4. CONFRONTOS E SÚMULA RÁPIDA
# ==============================================================================

@router.post(
    "/competicoes/{id_competicao}/gerar-confrontos",
    response_model=List[schemas.Confronto],
    status_code=status.HTTP_201_CREATED,
    summary="Gerar confrontos da competição via motor V2",
)
def gerar_confrontos_v2(
    id_competicao: int,
    parametros: Optional[schemas.GerarConfrontosCompeticaoRequest] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    kwargs = {}
    if parametros:
        if parametros.fase_inicial:
            kwargs["fase_inicial"] = parametros.fase_inicial
        if parametros.data_inicio:
            kwargs["data_inicio"] = parametros.data_inicio
        if parametros.hora_padrao:
            kwargs["hora_padrao"] = parametros.hora_padrao
        if parametros.id_local_padrao:
            kwargs["id_local_padrao"] = parametros.id_local_padrao
        if parametros.id_arbitro_padrao:
            kwargs["id_arbitro_padrao"] = parametros.id_arbitro_padrao

    try:
        confrontos = confrontos_v2.gerar_tabela_confrontos_v2(db=db, competicao=comp, **kwargs)
        return confrontos
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/competicoes/{id_competicao}/confrontos",
    response_model=List[schemas.Confronto],
    summary="Listar confrontos da competição com filtros",
)
def listar_confrontos_v2(
    id_competicao: int,
    rodada: Optional[int] = Query(None, description="Filtrar por rodada"),
    fase: Optional[str] = Query(None, description="Filtrar por fase"),
    grupo: Optional[str] = Query(None, description="Filtrar por grupo"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
):
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    q = (
        db.query(models.Confronto)
        .options(
            selectinload(models.Confronto.equipe_mandante),
            selectinload(models.Confronto.equipe_visitante),
            selectinload(models.Confronto.equipe_vencedora),
            selectinload(models.Confronto.local),
            selectinload(models.Confronto.arbitro),
            selectinload(models.Confronto.ocorrencias),
        )
        .filter(models.Confronto.id_competicao == id_competicao)
    )

    if rodada is not None:
        q = q.filter(models.Confronto.rodada == rodada)
    if fase is not None:
        q = q.filter(models.Confronto.fase == fase)
    if grupo is not None:
        q = q.filter(models.Confronto.grupo == grupo)

    return q.order_by(
        models.Confronto.ordem_jogo,
        models.Confronto.data,
        models.Confronto.hora,
        models.Confronto.id_confronto,
    ).all()


@router.post(
    "/confrontos/{id_confronto}/ocorrencias",
    response_model=schemas.OcorrenciaPartidaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar ocorrência na súmula rápida (gol, cartão)",
)
def registrar_ocorrencia_confronto_v2(
    id_confronto: int,
    payload: schemas.OcorrenciaPartidaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    confronto = db.query(models.Confronto).filter(models.Confronto.id_confronto == id_confronto).first()
    if not confronto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Confronto não encontrado.")

    tipo_norm = payload.tipo.strip().upper()
    try:
        if tipo_norm in ("GOL", "GOL_CONTRA"):
            contra = getattr(payload, "contra", False) or (tipo_norm == "GOL_CONTRA")
            ocorrencia = sumula_v2.adicionar_gol(
                db=db,
                id_confronto=id_confronto,
                id_equipe=payload.id_equipe,
                id_jogador=payload.id_jogador,
                minuto=payload.minuto,
                contra=contra,
                tempo_jogo=payload.tempo_jogo,
                observacao=payload.observacao,
            )
        elif tipo_norm in ("CARTAO_AMARELO", "CARTAO_VERMELHO"):
            if not payload.id_jogador:
                raise ValueError("Registro de cartão requer a identificação do jogador.")
            ocorrencia = sumula_v2.adicionar_cartao(
                db=db,
                id_confronto=id_confronto,
                id_equipe=payload.id_equipe,
                id_jogador=payload.id_jogador,
                tipo=tipo_norm,
                minuto=payload.minuto,
                tempo_jogo=payload.tempo_jogo,
                observacao=payload.observacao,
            )
        else:
            raise ValueError(f"Tipo de ocorrência inválido: '{payload.tipo}'.")

        nome_jogador = ocorrencia.jogador.nome if ocorrencia.jogador else None
        nome_equipe = ocorrencia.equipe.nome if ocorrencia.equipe else None

        return schemas.OcorrenciaPartidaResponse(
            id_ocorrencia=ocorrencia.id_ocorrencia,
            id_confronto=ocorrencia.id_confronto,
            id_equipe=ocorrencia.id_equipe,
            id_jogador=ocorrencia.id_jogador,
            tipo=ocorrencia.tipo,
            minuto=ocorrencia.minuto,
            tempo_jogo=ocorrencia.tempo_jogo,
            observacao=ocorrencia.observacao,
            criado_em=ocorrencia.criado_em,
            nome_jogador=nome_jogador,
            nome_equipe=nome_equipe,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete(
    "/confrontos/ocorrencias/{id_ocorrencia}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover ocorrência da súmula rápida com ajuste de placar",
)
def remover_ocorrencia_confronto_v2(
    id_ocorrencia: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    ocorrencia = db.query(models.OcorrenciaPartida).filter(
        models.OcorrenciaPartida.id_ocorrencia == id_ocorrencia
    ).first()
    if not ocorrencia:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ocorrência não encontrada.")

    try:
        if ocorrencia.tipo in ("GOL", "GOL_CONTRA"):
            sumula_v2.remover_gol(db, id_ocorrencia)
        else:
            if ocorrencia.confronto and ocorrencia.confronto.status == "Finalizado":
                raise ValueError("Não é possível remover ocorrência de confronto já finalizado.")
            db.delete(ocorrencia)
            db.commit()
        return None
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/confrontos/{id_confronto}/finalizar",
    response_model=schemas.Confronto,
    summary="Finalizar confronto com suporte a cobranças de pênaltis",
)
def finalizar_confronto_v2(
    id_confronto: int,
    payload: Optional[schemas.FinalizarConfrontoRequest] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(check_coordenador_role),
):
    confronto = db.query(models.Confronto).filter(models.Confronto.id_confronto == id_confronto).first()
    if not confronto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Confronto não encontrado.")

    penaltis_m = payload.penaltis_mandante if payload else None
    penaltis_v = payload.penaltis_visitante if payload else None
    obs = payload.observacoes if payload else None

    try:
        return sumula_v2.finalizar_confronto(
            db=db,
            id_confronto=id_confronto,
            penaltis_mandante=penaltis_m,
            penaltis_visitante=penaltis_v,
            observacoes=obs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ==============================================================================
# 5. RELATÓRIOS APURADOS: CLASSIFICAÇÃO, ARTILHARIA E DISCIPLINAR
# ==============================================================================

@router.get(
    "/competicoes/{id_competicao}/classificacao",
    summary="Consultar classificação apurada V2",
)
def obter_classificacao_v2(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
) -> Dict[str, Any]:
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    try:
        res = classificacao_v2.calcular_classificacao_v2(db, id_competicao)
        if isinstance(res, dict) and "classificacao" in res:
            for row in res["classificacao"]:
                if isinstance(row, dict) and "nome_equipe" in row and "equipe" not in row:
                    row["equipe"] = row["nome_equipe"]
            if "tabela" not in res:
                res["tabela"] = res["classificacao"]
        return res
    except classificacao_v2.CompeticaoNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except classificacao_v2.ModoCompeticaoInvalidoError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/competicoes/{id_competicao}/artilharia",
    summary="Consultar artilharia consolidada V2",
)
def obter_artilharia_v2(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
) -> List[Dict[str, Any]]:
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    try:
        return classificacao_v2.obter_artilharia_v2(db, id_competicao)
    except classificacao_v2.CompeticaoNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/competicoes/{id_competicao}/disciplinar",
    summary="Consultar relatório disciplinar de cartões e suspensões V2",
)
def obter_disciplinar_v2(
    id_competicao: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user),
) -> Dict[str, Any]:
    comp = db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competição não encontrada.")

    try:
        return classificacao_v2.obter_disciplinar_v2(db, id_competicao)
    except classificacao_v2.CompeticaoNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
