from sqlalchemy.orm import Session
import models
import schemas

def criar_modalidade(db: Session, modalidade: schemas.ModalidadeCreate):
    db_modalidade = models.Modalidade(
        nome=modalidade.nome,
        descricao=modalidade.descricao
    )

    db.add(db_modalidade)
    db.commit()
    db.refresh(db_modalidade)
    return db_modalidade

def listar_modalidade(db: Session, id_modalidade: int):
    return db.query(models.Modalidade).filter(models.Modalidade.id_modalidade == id_modalidade).first()

def listar_modalidades(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Modalidade).offset(skip).limit(limit).all()

def atualizar_modalidade(db: Session, id_modalidade: int, modalidade_atualizada: schemas.ModalidadeCreate):
    db_modalidade = listar_modalidade(db, id_modalidade)

    if not db_modalidade:
        return None
    
    db_modalidade.nome = modalidade_atualizada.nome
    db_modalidade.descricao = modalidade_atualizada.descricao

    db.commit()
    db.refresh(db_modalidade)
    return db_modalidade

def excluir_modalidade(db: Session, id_modalidade: int):
    db_modalidade = listar_modalidade(db, id_modalidade)

    if not db_modalidade:
        return None

    db.delete(db_modalidade)
    db.commit()
    return db_modalidade