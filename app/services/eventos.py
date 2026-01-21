from sqlalchemy.orm import Session
import models
import schemas


def criar_evento(db: Session, evento: schemas.EventoCreate):
    db_evento = models.Evento(
        even_nome=evento.even_nome,
        descricao=evento.descricao
    )

    if evento.modalidade_ids:
        modalidades = db.query(models.Modalidade).filter(
            models.Modalidade.id_modalidade.in_(evento.modalidade_ids)
        ).all()
        db_evento.modalidades = modalidades

    db.add(db_evento)
    db.commit()
    db.refresh(db_evento)
    return db_evento

def listar_evento(db: Session, id_evento: int):
    return db.query(models.Evento).filter(models.Evento.id_evento == id_evento).first()

def listar_eventos(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Evento).offset(skip).limit(limit).all()

def atualizar_evento(db: Session, id_evento: int, evento_atualizado: schemas.EventoCreate):
    db_evento = listar_evento(db, id_evento)

    if not db_evento:
        return None
    
    db_evento.even_nome = evento_atualizado.even_nome
    db_evento.descricao = evento_atualizado.descricao

    if evento_atualizado.modalidade_ids is not None:
        modalidades = db.query(models.Modalidade).filter(
            models.Modalidade.id_modalidade.in_(evento_atualizado.modalidade_ids)
        ).all()
        db_evento.modalidades = modalidades

    db.commit()
    db.refresh(db_evento)
    return db_evento

def excluir_evento(db: Session, id_evento: int):
    db_evento = listar_evento(db, id_evento)

    if db_evento:
        db.delete(db_evento)
        db.commit()
        return True
    return False
