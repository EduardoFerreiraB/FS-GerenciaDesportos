from sqlalchemy.orm import Session
import models
import schemas

def criar_turma(db:Session, turma: schemas.TurmaCreate):
    db_turma = models.Turma(
        descricao=turma.descricao,
        categoria_idade=turma.categoria_idade,
        horario_inicio=turma.horario_inicio,
        horario_fim=turma.horario_fim,
        dias_semana=turma.dias_semana,
        id_modalidade=turma.id_modalidade,
        id_professor=turma.id_professor
    )

    db.add(db_turma)
    db.commit()
    db.refresh(db_turma)
    return db_turma

def listar_turma_id(db: Session, id_turma: int):
    return db.query(models.Turma).filter(models.Turma.id_turma == id_turma).first()

def listar_turmas(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Turma).offset(skip).limit(limit).all()

def listar_turmas_professor(db: Session, id_professor: int):
    return db.query(models.Turma).filter(models.Turma.id_professor == id_professor).all()

def listar_turmas_modalidade(db: Session, id_modalidade: int):
    return db.query(models.Turma).filter(models.Turma.id_modalidade == id_modalidade).all()

def atualizar_turma(db: Session, id_turma: int, turma_atualizada: schemas.TurmaCreate):
    db_turma = listar_turma_id(db, id_turma)

    if not db_turma:
        return None
    
    dados_atualizados = turma_atualizada.model_dump(exclude_unset=True)
    for chave, valor, in dados_atualizados.items():
        setattr(db_turma, chave, valor)

    db.commit()
    db.refresh(db_turma)
    return db_turma

def excluir_turma(db: Session, id_turma: int):
    db_turma = listar_turma_id(db, id_turma)

    if db_turma:
        db.delete(db_turma)
        db.commit()
        return True
    return False
