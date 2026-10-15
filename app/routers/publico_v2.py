"""Roteador para endpoints públicos V2 (Eventos Agregadores e Portal Público).

Endpoints públicos sob o prefixo /v2/publico:
- GET /v2/publico/grupos/{slug}: Dados públicos do grupo/evento agregador e suas competições.
- GET /v2/publico/competicoes/{id}: Dados públicos da competição (oculta rascunhos).
- GET /v2/publico/competicoes/{id}/jogos: Jogos e resultados públicos com autores dos gols.
- GET /v2/publico/competicoes/{id}/classificacao: Tabela e chaveamento públicos.
- GET /v2/publico/competicoes/{id}/artilharia: Artilheiros públicos.

Conformidade LGPD:
- NUNCA expõe CPF, RG, telefone, e-mail, endereço ou documento de identificação de atletas.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from database import get_db
import models
from services import classificacao_v2


router = APIRouter(
    prefix="/v2/publico",
    tags=["Público V2"],
)


def _obter_competicao_publica(db: Session, id_competicao: int) -> models.Competicao:
    """Busca a competição garantindo que não esteja em RASCUNHO."""
    comp = (
        db.query(models.Competicao)
        .options(
            selectinload(models.Competicao.modalidade),
            selectinload(models.Competicao.grupo),
        )
        .filter(models.Competicao.id_competicao == id_competicao)
        .first()
    )
    if not comp or comp.status == "RASCUNHO":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competição não encontrada ou não disponível publicamente.",
        )
    return comp


@router.get(
    "/grupos/{slug}",
    summary="Consultar evento agregador e competições públicas pelo slug",
)
def obter_grupo_publico(
    slug: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    grupo = (
        db.query(models.GrupoCompeticoes)
        .options(
            selectinload(models.GrupoCompeticoes.competicoes).selectinload(models.Competicao.modalidade)
        )
        .filter(models.GrupoCompeticoes.slug == slug)
        .first()
    )
    if not grupo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evento/grupo não encontrado.",
        )

    # Filtra rigorosamente competições em RASCUNHO
    competicoes_publicas = [
        {
            "id_competicao": c.id_competicao,
            "nome": c.nome,
            "categoria": c.categoria,
            "modo_inscricao": c.modo_inscricao,
            "formato": c.formato,
            "criterio_resultado": c.criterio_resultado,
            "data_inicio": c.data_inicio.isoformat() if c.data_inicio else None,
            "data_fim": c.data_fim.isoformat() if c.data_fim else None,
            "status": c.status,
            "regras_formato": c.regras_formato,
            "modalidade": {
                "id_modalidade": c.modalidade.id_modalidade,
                "nome": c.modalidade.nome,
                "duracao_minutos": c.modalidade.duracao_minutos,
            } if c.modalidade else None,
        }
        for c in grupo.competicoes
        if c.status != "RASCUNHO"
    ]

    return {
        "id_grupo": grupo.id_grupo,
        "nome": grupo.nome,
        "descricao": grupo.descricao,
        "slug": grupo.slug,
        "data_inicio": grupo.data_inicio.isoformat() if grupo.data_inicio else None,
        "data_fim": grupo.data_fim.isoformat() if grupo.data_fim else None,
        "status": grupo.status,
        "criado_em": grupo.criado_em.isoformat() if grupo.criado_em else None,
        "competicoes": competicoes_publicas,
    }


@router.get(
    "/competicoes/{id_competicao}",
    summary="Consultar detalhes públicos da competição",
)
def obter_detalhes_competicao_publica(
    id_competicao: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    comp = _obter_competicao_publica(db, id_competicao)

    return {
        "id_competicao": comp.id_competicao,
        "nome": comp.nome,
        "categoria": comp.categoria,
        "modo_inscricao": comp.modo_inscricao,
        "formato": comp.formato,
        "criterio_resultado": comp.criterio_resultado,
        "data_inicio": comp.data_inicio.isoformat() if comp.data_inicio else None,
        "data_fim": comp.data_fim.isoformat() if comp.data_fim else None,
        "status": comp.status,
        "regras_formato": comp.regras_formato,
        "id_grupo": comp.id_grupo,
        "grupo": {
            "id_grupo": comp.grupo.id_grupo,
            "nome": comp.grupo.nome,
            "slug": comp.grupo.slug,
        } if comp.grupo else None,
        "modalidade": {
            "id_modalidade": comp.modalidade.id_modalidade,
            "nome": comp.modalidade.nome,
            "duracao_minutos": comp.modalidade.duracao_minutos,
        } if comp.modalidade else None,
    }


@router.get(
    "/competicoes/{id_competicao}/jogos",
    summary="Listar jogos públicos com resultados e autores dos gols",
)
def listar_jogos_publicos(
    id_competicao: int,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    _obter_competicao_publica(db, id_competicao)

    confrontos = (
        db.query(models.Confronto)
        .options(
            selectinload(models.Confronto.equipe_mandante),
            selectinload(models.Confronto.equipe_visitante),
            selectinload(models.Confronto.equipe_vencedora),
            selectinload(models.Confronto.local),
            selectinload(models.Confronto.arbitro),
            selectinload(models.Confronto.ocorrencias).selectinload(models.OcorrenciaPartida.jogador),
            selectinload(models.Confronto.ocorrencias).selectinload(models.OcorrenciaPartida.equipe),
        )
        .filter(models.Confronto.id_competicao == id_competicao)
        .order_by(
            models.Confronto.ordem_jogo,
            models.Confronto.data,
            models.Confronto.hora,
            models.Confronto.id_confronto,
        )
        .all()
    )

    jogos_formatados = []
    for c in confrontos:
        # Extrai ocorrências de gols de forma segura para LGPD
        gols = []
        for o in c.ocorrencias:
            if o.tipo in ("GOL", "GOL_CONTRA"):
                gols.append({
                    "id_ocorrencia": o.id_ocorrencia,
                    "id_equipe": o.id_equipe,
                    "nome_equipe": o.equipe.nome if o.equipe else None,
                    "id_jogador": o.id_jogador,
                    "nome_jogador": o.jogador.nome if o.jogador else None,
                    "tipo": o.tipo,
                    "minuto": o.minuto,
                    "tempo_jogo": o.tempo_jogo,
                    "observacao": o.observacao,
                })

        jogos_formatados.append({
            "id_confronto": c.id_confronto,
            "id_competicao": c.id_competicao,
            "fase": c.fase,
            "rodada": c.rodada,
            "grupo": c.grupo,
            "data": c.data.isoformat() if c.data else None,
            "hora": c.hora.strftime("%H:%M:%S") if c.hora else None,
            "id_local": c.id_local,
            "local": {"id_local": c.local.id_local, "loca_nome": c.local.loca_nome} if c.local else None,
            "id_equipe_mandante": c.id_equipe_mandante,
            "equipe_mandante": {"id_equipe": c.equipe_mandante.id_equipe, "nome": c.equipe_mandante.nome} if c.equipe_mandante else None,
            "id_equipe_visitante": c.id_equipe_visitante,
            "equipe_visitante": {"id_equipe": c.equipe_visitante.id_equipe, "nome": c.equipe_visitante.nome} if c.equipe_visitante else None,
            "placar_mandante": c.placar_mandante,
            "placar_visitante": c.placar_visitante,
            "penaltis_mandante": c.penaltis_mandante,
            "penaltis_visitante": c.penaltis_visitante,
            "id_equipe_vencedora": c.id_equipe_vencedora,
            "status": c.status,
            "gols": gols,
        })

    return jogos_formatados


@router.get(
    "/competicoes/{id_competicao}/classificacao",
    summary="Consultar tabela e classificação públicas",
)
def obter_classificacao_publica(
    id_competicao: int,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    _obter_competicao_publica(db, id_competicao)

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
    summary="Consultar artilharia pública",
)
def obter_artilharia_publica(
    id_competicao: int,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    _obter_competicao_publica(db, id_competicao)

    try:
        artilheiros = classificacao_v2.obter_artilharia_v2(db, id_competicao)
        # Sanitização explícita para conformidade LGPD
        artilheiros_limpos = [
            {
                "rank": a.get("rank"),
                "id_jogador": a.get("id_jogador"),
                "nome_jogador": a.get("nome_jogador"),
                "id_equipe": a.get("id_equipe"),
                "equipe": a.get("equipe"),
                "gols": a.get("gols"),
            }
            for a in artilheiros
        ]
        return artilheiros_limpos
    except classificacao_v2.CompeticaoNaoEncontradaError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
