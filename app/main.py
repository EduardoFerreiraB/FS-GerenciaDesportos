from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine
import models
from routers import (
    modalidades, professores, turmas, alunos, 
    matriculas, presencas, arbitros, locais, 
    eventos, edicoes, auth
)
import os
from pathlib import Path

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Gerencia Esportes API",
    description="API para gerenciar escolinhas esportivas.",
    version="1.0.0"
)

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"

if not UPLOAD_DIR.exists():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(auth.router)
app.include_router(modalidades.router)
app.include_router(professores.router)
app.include_router(turmas.router)
app.include_router(alunos.router)
app.include_router(matriculas.router)
app.include_router(presencas.router)
app.include_router(arbitros.router)
app.include_router(locais.router)
app.include_router(eventos.router)
app.include_router(edicoes.router)

@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the Gerencia Esportes API!"}

@app.get("/health", tags=["Health"])
async def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)