"""Entrada unica da API de competicoes."""

from fastapi import APIRouter

from . import organizacao, elencos, disputa, partidas, classificacao

router = APIRouter(prefix="/competicoes", tags=["Competições"])
router.include_router(organizacao.router)
router.include_router(elencos.router)
router.include_router(disputa.router)
router.include_router(partidas.router)
router.include_router(classificacao.router)
