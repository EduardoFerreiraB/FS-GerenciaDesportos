from sqlalchemy.orm import Session
import models
import schemas
import security

def listar_professor(db: Session, id_professor: int):
    return db.query(models.Professor).filter(models.Professor.id_professor == id_professor).first()

def listar_professores(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Professor).offset(skip).limit(limit).all()

def listar_professor_cpf(db: Session, cpf: str):
    return db.query(models.Professor).filter(models.Professor.cpf == cpf).first()

def criar_professor(db: Session, professor: schemas.ProfessorCreate):
    senha_plana = professor.cpf[6:] if len(professor.cpf) >= 6 else "mudar123"

    senha_hash = security.get_password_hash(senha_plana)

    db_usuario = models.Usuario(
        username=professor.cpf,
        password_hash=senha_hash,
        role="professor"
    )

    db.add(db_usuario)
    db.flush()

    db_professor = models.Professor(
        nome=professor.nome,
        cpf=professor.cpf,
        contato=professor.contato,
        id_usuario=db_usuario.id_usuario
    )

    db.add(db_professor)
    db.commit()
    db.refresh(db_professor)

    db_professor.senha_temporaria = senha_plana
    return db_professor

def atualizar_professor(db: Session, id_professor: int, professor_atualizado: schemas.ProfessorCreate):
    db_professor = listar_professor(db=db, id_professor=id_professor)
    if not db_professor:
        return None
    
    db_professor.nome = professor_atualizado.nome
    db_professor.cpf = professor_atualizado.cpf
    db_professor.contato = professor_atualizado.contato

    db.commit()
    db.refresh(db_professor)
    return db_professor

def excluir_professor(db: Session, id_professor: int):
    db_professor = listar_professor(db=db, id_professor=id_professor)
    if db_professor:
        db.delete(db_professor)
        db.commit()
        return True
    return False
