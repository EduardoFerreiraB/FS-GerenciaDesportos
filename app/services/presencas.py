from sqlalchemy.orm import Session
import models
import schemas
from datetime import date

def registrar_presenca(db: Session, presenca: schemas.PresencaCreate):
    presenca_existente = db.query(models.Presenca).filter(
        models.Presenca.id_matricula == presenca.id_matricula,
        models.Presenca.data_aula == presenca.data_aula
    ).first()

    if presenca_existente:
        presenca_existente.status = presenca.status
        presenca_existente.observacao = presenca.observacao
        db.commit()
        db.refresh(presenca_existente)
        return presenca_existente
    
    db_presenca = models.Presenca(
        id_matricula=presenca.id_matricula,
        data_aula=presenca.data_aula,
        status=presenca.status,
        observacao=presenca.observacao
    )
    db.add(db_presenca)
    db.commit()
    db.refresh(db_presenca)
    return db_presenca

def registrar_presenca_lote(db: Session, presencas: list[schemas.PresencaCreate]):
    resultados = []
    for p in presencas:
        resultados.append(registrar_presenca(db, p))
    return resultados

def listar_presencas_matricula(db: Session, id_matricula: int):
    return db.query(models.Presenca).filter(models.Presenca.id_matricula == id_matricula).order_by(models.Presenca.data_aula.desc()).all()

def listar_presencas_turma_data(db: Session, id_turma: int, data_aula: date):
    return db.query(models.Presenca).join(models.Matricula).filter(
        models.Matricula.id_turma == id_turma,
        models.Presenca.data_aula == data_aula
    ).all()
