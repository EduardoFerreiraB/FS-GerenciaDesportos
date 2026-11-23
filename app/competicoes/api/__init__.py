"""Entrada unica da API de competicoes."""

from fastapi import APIRouter

from . import organizacao, elencos, disputa, partidas, classificacao, sumula, disciplina, publico

router = APIRouter(prefix="/competicoes", tags=["Competições"])
router.include_router(organizacao.router)
router.include_router(elencos.router)
router.include_router(disputa.router)
router.include_router(partidas.router)
router.include_router(classificacao.router)
router.include_router(sumula.router)
router.include_router(disciplina.router)
router.include_router(publico.router)
