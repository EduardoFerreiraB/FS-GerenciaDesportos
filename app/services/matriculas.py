from sqlalchemy.orm import Session
import models
import schemas
from services import turmas as servico_turmas

def verificar_conflito_aluno(db: Session, id_aluno: int, nova_turma_id: int):
    nova_turma = servico_turmas.listar_turma_id(db, nova_turma_id)
    if not nova_turma:
        return False 
    matriculas_aluno = listar_matriculas_aluno(db, id_aluno)
    
    # Extrair turmas das matrículas
    turmas_aluno = []
    for m in matriculas_aluno:
        t = m.turma if m.turma else servico_turmas.listar_turma_id(db, m.id_turma)
        if t:
            turmas_aluno.append(t)
    
    dias_nova = nova_turma.dias_semana.split(',') if isinstance(nova_turma.dias_semana, str) else []
    
    return servico_turmas.checar_conflito_agenda(
        dias_nova, 
        nova_turma.horario_inicio, 
        nova_turma.horario_fim, 
        turmas_aluno, 
        id_turma_ignorar=nova_turma.id_turma
    )

def criar_matricula(db: Session, matricula: schemas.MatriculaCreate):
    if verificar_conflito_aluno(db, matricula.id_aluno, matricula.id_turma):
        raise ValueError("Conflito de horário: O aluno já está matriculado em outra turma neste horário.")

    db_matricula = models.Matricula(
        id_aluno=matricula.id_aluno,
        id_turma=matricula.id_turma,
    )
    db.add(db_matricula)
    db.commit()
    db.refresh(db_matricula)
    return db_matricula

def listar_matriculas(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Matricula).offset(skip).limit(limit).all()

def listar_matriculas_turma(db: Session, id_turma: int):
    return db.query(models.Matricula).filter(models.Matricula.id_turma == id_turma).all()

def listar_matriculas_aluno(db: Session, id_aluno: int):
    return db.query(models.Matricula).filter(
        models.Matricula.id_aluno == id_aluno,
        models.Matricula.ativo == True
    ).all()

def verificar_matricula(db: Session, id_aluno: int, id_turma: int):
    return db.query(models.Matricula).filter(
        models.Matricula.id_aluno == id_aluno,
        models.Matricula.id_turma == id_turma,
        models.Matricula.ativo == True
    ).first()

def cancelar_matricula(db: Session, id_matricula: int):
    db_matricula = db.query(models.Matricula).filter(models.Matricula.id_matricula == id_matricula).first()
    
    if db_matricula:
        db.delete(db_matricula) 
        db.commit()
        return True
    return False