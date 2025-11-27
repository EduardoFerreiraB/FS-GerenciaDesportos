from sqlalchemy.orm import Session
import models, schemas

def criar_arbitro(db: Session, arbitro: schemas.ArbitroCreate):
    db_arbitro = models.Arbitro(
        apito_nome=arbitro.apito_nome,
        apito_doc=arbitro.apito_doc,
        apito_tel=arbitro.apito_tel
    )
    db.add(db_arbitro)
    db.commit()
    db.refresh(db_arbitro)
    return db_arbitro

def listar_arbitros(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Arbitro).offset(skip).limit(limit).all()

def listar_arbitro_id(db: Session, id_arbitro: int):
    return db.query(models.Arbitro).filter(models.Arbitro.id_arbitro == id_arbitro).first()

def atualizar_arbitro(db: Session, id_arbitro: int, arbitro_atualizado: schemas.ArbitroCreate):
    db_arbitro = listar_arbitro_id(db, id_arbitro)

    if not db_arbitro:
        return None
    
    for chave, valor in arbitro_atualizado.model_dump(exclude_unset=True).items():
        setattr(db_arbitro, chave, valor)
    
    db.commit()
    db.refresh(db_arbitro)
    return db_arbitro

def excluir_arbitro(db: Session, id_arbitro: int):
    db_arbitro = listar_arbitro_id(db, id_arbitro)

    if db_arbitro:
        db.delete(db_arbitro)
        db.commit()
        return True
    return False
