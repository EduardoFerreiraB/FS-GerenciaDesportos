from sqlalchemy.orm import Session
import models
import schemas
from services import turmas as service_turmas

def verificar_conflito_horario(nova_turma: models.Turma, turmas_existentes: list[models.Turma]) -> bool:
    if not nova_turma.dias_semana:
        return False
    
    dias_nova = set(nova_turma.dias_semana.split(","))

    for turma in turmas_existentes:
        if not turma.dias_semana:
            continue

        dias_existente = set(turma.dias_semana.split(","))
        dias_comuns = dias_nova.intersection(dias_existente)

        if dias_comuns:
            if (nova_turma.horario_inicio < turma.horario_fim and turma.horario_inicio < nova_turma.horario_fim):
                return True

    return False

def listar_matricula(db: Session, id_matricula: int):
    return db.query(models.Matricula).filter(models.Matricula.id_matricula == id_matricula).first()

def listar_matriculas(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Matricula).offset(skip).limit(limit).all()

def listar_matriculas_turma(db: Session, id_turma: int):
    return db.query(models.Matricula).filter(models.Matricula.id_turma == id_turma, models.Matricula.ativo).all()

def listar_matriculas_aluno(db: Session, id_aluno: int):
    return db.query(models.Matricula).filter(models.Matricula.id_aluno == id_aluno, models.Matricula.ativo).all()

def verificar_matricula(db: Session, id_aluno: int, id_turma: int):
    return db.query(models.Matricula).filter(models.Matricula.id_aluno == id_aluno, models.Matricula.id_turma == id_turma).first()

def criar_matricula(db: Session, matricula: schemas.MatriculaCreate):
    turma_nova = service_turmas.listar_turma_id(db=db, id_turma=matricula.id_turma)
    if not turma_nova:
        raise ValueError("Turma não encontrada.")
    
    matriculas_existentes = listar_matriculas_aluno(db=db, id_aluno=matricula.id_aluno)
    turmas_existentes = [m.turma for m in matriculas_existentes if m.ativo]

    if verificar_conflito_horario(turma_nova, turmas_existentes):
        raise ValueError("Conflito de horário com outra matrícula existente.")
    
    db_matricula = models.Matricula(
        id_aluno=matricula.id_aluno,
        id_turma=matricula.id_turma,
        ativo=True
    )
    db.add(db_matricula)
    db.commit()
    db.refresh(db_matricula)
    return db_matricula

def cancelar_matricula(db: Session, id_matricula: int):
    db_matricula = listar_matricula(db, id_matricula)

    if db_matricula:
        db.delete(db_matricula)
        db.commit()
        return True
    return False