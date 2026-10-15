"""Entrada unica da API de competicoes."""

from fastapi import APIRouter

from . import organizacao, elencos

router = APIRouter(prefix="/competicoes", tags=["Competições"])
router.include_router(organizacao.router)
router.include_router(elencos.router)
