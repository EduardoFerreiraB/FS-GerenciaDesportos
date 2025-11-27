from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine
import models
from routers import modalidades
from routers import professores
from routers import turmas
from routers import alunos
from routers import matriculas
from routers import arbitros
from routers import locais
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Gerencia Esportes API",
    description="API para gerenciar escolinhas esportivas.",
    version="1.0.0"
)

app.include_router(modalidades.router)
app.include_router(professores.router)
app.include_router(turmas.router)
app.include_router(alunos.router)
app.include_router(matriculas.router)
app.include_router(arbitros.router)
app.include_router(locais.router)

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
