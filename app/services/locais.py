from sqlalchemy.orm import Session
import models, schemas

def criar_local(db: Session, local: schemas.LocalCreate):
    db_local = models.Local(
        loca_nome=local.loca_nome,
        loca_descricao=local.loca_descricao,
        ativo=local.ativo
    )
    db.add(db_local)
    db.commit()
    db.refresh(db_local)
    return db_local

def listar_locais(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Local).offset(skip).limit(limit).all()

def listar_local_id(db: Session, id_local: int):
    return db.query(models.Local).filter(models.Local.id_local == id_local).first()

def atualizar_local(db: Session, id_local: int, local_atualizado: schemas.LocalCreate):
    db_local = listar_local_id(db, id_local)

    if not db_local:
        return None
    
    for chave, valor in local_atualizado.model_dump(exclude_unset=True).items():
        setattr(db_local, chave, valor)
    
    db.commit()
    db.refresh(db_local)
    return db_local

def excluir_local(db: Session, id_local: int):
    db_local = listar_local_id(db, id_local)

    if db_local:
        db.delete(db_local)
        db.commit()
        return True
    return False