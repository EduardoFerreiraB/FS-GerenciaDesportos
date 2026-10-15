"""Serviço de regras e cálculo de classificação individual para o Passo 6.

Contém lógica pura de cálculo em memória (sem persistência desnecessária de ranking)
para provas e competições em modo INDIVIDUAL, formatação de tempo legível,
atribuição de posições/pódio e geração do quadro geral de medalhas com desempate.
"""

from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

import models


# ============================================================================
# Helpers de Formatação e Resolução de Atleta
# ============================================================================

def formatar_tempo(tempo_ms: Optional[int]) -> str:
    """Formata tempo_ms em string legível:
    - Se tempo_ms < 60000 (< 1 minuto): 'SS.mmm' (ex: '25.432s')
    - Se tempo_ms >= 60000 (>= 1 minuto): 'MM:SS.mmm' (ex: '01:14.210')
    """
    if tempo_ms is None:
        return ""
    if tempo_ms < 0:
        tempo_ms = 0

    if tempo_ms < 60000:
        segundos = tempo_ms // 1000
        milis = tempo_ms % 1000
        return f"{segundos:02d}.{milis:03d}s"
    else:
        minutos = tempo_ms // 60000
        resto = tempo_ms % 60000
        segundos = resto // 1000
        milis = resto % 1000
        return f"{minutos:02d}:{segundos:02d}.{milis:03d}"


def obter_nome_participante(participante: Optional[models.Participante]) -> str:
    """Extrai o nome legível de um participante (derivado de atleta ou aluno)."""
    if not participante:
        return "Participante Desconhecido"

    if getattr(participante, "atleta", None) and getattr(participante.atleta, "nome_completo", None):
        return participante.atleta.nome_completo
    if getattr(participante, "aluno", None) and getattr(participante.aluno, "nome_completo", None):
        return participante.aluno.nome_completo

    return f"Participante {participante.id_participante}"


# ============================================================================
# Classificação por Prova
# ============================================================================

def calcular_classificacao_prova(db: Session, id_prova: int) -> Dict[str, Any]:
    """Calcula a classificação de uma prova individual:
    - Valida existência da prova (ValueError se 404).
    - Valida que a competição é INDIVIDUAL se houver vínculo.
    - Ordena por menor tempo_ms ASC.
    - Atletas válidos recebem posições sequenciais (1, 2, 3...).
    - Atletas desqualificados ficam ao final com posicao = None.
    - Identifica pódio: 1º (ouro), 2º (prata) e 3º (bronze).
    """
    prova = db.query(models.Prova).filter_by(id_prova=id_prova).first()
    if not prova:
        raise ValueError(f"Prova com id {id_prova} não encontrada.")

    if prova.competicao and prova.competicao.modo_inscricao != "INDIVIDUAL":
        raise ValueError("Classificação individual requer modo INDIVIDUAL.")

    # Mapa de número de peito das inscrições da competição
    mapa_numero_peito: Dict[int, Optional[int]] = {}
    if prova.id_competicao:
        inscricoes = (
            db.query(models.InscricaoIndividual)
            .filter_by(id_competicao=prova.id_competicao)
            .all()
        )
        for insc in inscricoes:
            mapa_numero_peito[insc.id_participante] = insc.numero_peito

    # Coletar resultados brutos
    resultados = (
        db.query(models.ResultadoProva)
        .filter_by(id_prova=id_prova)
        .all()
    )

    # Separar válidos e desqualificados
    validos = [r for r in resultados if not r.desqualificado]
    desqualificados = [r for r in resultados if r.desqualificado]

    # Ordenar válidos por tempo_ms crescente (desempate por id_participante)
    validos.sort(key=lambda r: (r.tempo_ms, r.id_participante))
    # Ordenar desqualificados por tempo_ms crescente
    desqualificados.sort(key=lambda r: (r.tempo_ms, r.id_participante))

    classificados: List[Dict[str, Any]] = []

    for idx, r in enumerate(validos, start=1):
        part = r.participante or db.query(models.Participante).filter_by(id_participante=r.id_participante).first()
        nome = obter_nome_participante(part)
        numero_peito = mapa_numero_peito.get(r.id_participante)
        classificados.append({
            "id_resultado": r.id_resultado,
            "id_participante": r.id_participante,
            "nome_participante": nome,
            "numero_peito": numero_peito,
            "tempo_ms": r.tempo_ms,
            "tempo_formatado": formatar_tempo(r.tempo_ms),
            "desqualificado": False,
            "motivo_desqualificacao": r.motivo_desqualificacao,
            "observacoes": r.observacoes,
            "posicao": idx,
        })

    for r in desqualificados:
        part = r.participante or db.query(models.Participante).filter_by(id_participante=r.id_participante).first()
        nome = obter_nome_participante(part)
        numero_peito = mapa_numero_peito.get(r.id_participante)
        classificados.append({
            "id_resultado": r.id_resultado,
            "id_participante": r.id_participante,
            "nome_participante": nome,
            "numero_peito": numero_peito,
            "tempo_ms": r.tempo_ms,
            "tempo_formatado": formatar_tempo(r.tempo_ms),
            "desqualificado": True,
            "motivo_desqualificacao": r.motivo_desqualificacao,
            "observacoes": r.observacoes,
            "posicao": None,
        })

    # Pódio (somente atletas válidos recebem medalhas)
    podio_ouro = classificados[0] if len(validos) >= 1 else None
    podio_prata = classificados[1] if len(validos) >= 2 else None
    podio_bronze = classificados[2] if len(validos) >= 3 else None

    podio = {
        "ouro": podio_ouro,
        "prata": podio_prata,
        "bronze": podio_bronze,
    }
    podio_lista = [p for p in [podio_ouro, podio_prata, podio_bronze] if p is not None]

    return {
        "id_prova": prova.id_prova,
        "nome": prova.nome,
        "nome_prova": prova.nome,
        "id_competicao": prova.id_competicao,
        "status": prova.status,
        "resultados": classificados,
        "classificacao": classificados,
        "podio": podio,
        "podio_lista": podio_lista,
    }


# ============================================================================
# Classificação Individual da Competição (Consolidado e Quadro de Medalhas)
# ============================================================================

def calcular_classificacao_individual_competicao(db: Session, id_competicao: int) -> Dict[str, Any]:
    """Calcula a classificação geral e quadro de medalhas da competição:
    - Valida que a competição existe (ValueError se 404).
    - Valida que modo_inscricao == 'INDIVIDUAL' (ValueError se não for).
    - Coleta todas as provas e calcula o resultado/pódio de cada uma.
    - Quadro de medalhas / Ranking geral:
      - Agrupa por atleta/participante.
      - Conta ouros (1º), pratas (2º), bronzes (3º), total de medalhas,
        provas disputadas e melhor posição alcançada.
      - Ordena por: ouros DESC, pratas DESC, bronzes DESC, total de medalhas DESC, nome ASC.
    """
    competicao = db.query(models.Competicao).filter_by(id_competicao=id_competicao).first()
    if not competicao:
        raise ValueError(f"Competição com id {id_competicao} não encontrada.")

    if competicao.modo_inscricao != "INDIVIDUAL":
        raise ValueError("Classificação individual requer modo INDIVIDUAL.")

    # Obter provas ordenadas
    provas = (
        db.query(models.Prova)
        .filter_by(id_competicao=id_competicao)
        .order_by(models.Prova.id_prova.asc())
        .all()
    )

    # Inscrições para mapear participantes inscritos e seus números de peito
    inscricoes = (
        db.query(models.InscricaoIndividual)
        .filter_by(id_competicao=id_competicao)
        .all()
    )
    mapa_numero_peito = {i.id_participante: i.numero_peito for i in inscricoes}

    # Inicializar participantes a partir das inscrições
    atletas_stats: Dict[int, Dict[str, Any]] = {}
    for insc in inscricoes:
        part = insc.participante or db.query(models.Participante).filter_by(id_participante=insc.id_participante).first()
        nome = obter_nome_participante(part)
        atletas_stats[insc.id_participante] = {
            "id_participante": insc.id_participante,
            "nome_participante": nome,
            "numero_peito": insc.numero_peito,
            "ouros": 0,
            "pratas": 0,
            "bronzes": 0,
            "total_medalhas": 0,
            "provas_disputadas": 0,
            "melhores_posicoes": [],
        }

    # Calcular classificação de cada prova
    provas_classificadas: List[Dict[str, Any]] = []
    for prova in provas:
        res_prova = calcular_classificacao_prova(db, prova.id_prova)
        provas_classificadas.append(res_prova)

        for r in res_prova["resultados"]:
            part_id = r["id_participante"]
            if part_id not in atletas_stats:
                part = db.query(models.Participante).filter_by(id_participante=part_id).first()
                nome = r.get("nome_participante") or obter_nome_participante(part)
                num_peito = mapa_numero_peito.get(part_id, r.get("numero_peito"))
                atletas_stats[part_id] = {
                    "id_participante": part_id,
                    "nome_participante": nome,
                    "numero_peito": num_peito,
                    "ouros": 0,
                    "pratas": 0,
                    "bronzes": 0,
                    "total_medalhas": 0,
                    "provas_disputadas": 0,
                    "melhores_posicoes": [],
                }

            stat = atletas_stats[part_id]
            stat["provas_disputadas"] += 1
            pos = r.get("posicao")
            if pos == 1:
                stat["ouros"] += 1
            elif pos == 2:
                stat["pratas"] += 1
            elif pos == 3:
                stat["bronzes"] += 1

            if pos is not None:
                stat["melhores_posicoes"].append(pos)

    # Consolidar totais e melhor posição de cada atleta
    ranking_lista: List[Dict[str, Any]] = []
    for stat in atletas_stats.values():
        stat["total_medalhas"] = stat["ouros"] + stat["pratas"] + stat["bronzes"]
        melhores = stat.pop("melhores_posicoes", [])
        stat["melhor_posicao"] = min(melhores) if melhores else None
        ranking_lista.append(stat)

    # Ordenar ranking geral:
    # 1. ouros DESC
    # 2. pratas DESC
    # 3. bronzes DESC
    # 4. total_medalhas DESC
    # 5. nome_participante ASC (case-insensitive)
    # 6. id_participante ASC
    ranking_lista.sort(
        key=lambda item: (
            -item["ouros"],
            -item["pratas"],
            -item["bronzes"],
            -item["total_medalhas"],
            (item["nome_participante"] or "").strip().lower(),
            item["id_participante"],
        )
    )

    # Atribuir posições no ranking geral
    for idx, item in enumerate(ranking_lista, start=1):
        item["posicao"] = idx

    return {
        "id_competicao": competicao.id_competicao,
        "nome": competicao.nome,
        "nome_competicao": competicao.nome,
        "modo_inscricao": competicao.modo_inscricao,
        "total_provas": len(provas),
        "provas": provas_classificadas,
        "quadro_medalhas": ranking_lista,
        "ranking_geral": ranking_lista,
    }
