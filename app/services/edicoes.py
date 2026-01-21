from sqlalchemy.orm import Session
import models
import schemas

def criar_edicao(db: Session, edicao: schemas.EdicaoCreate):
    db_edicao = models.Edicao(
        id_evento=edicao.id_evento,
        edic_ano=edicao.edic_ano,
        data_inicio=edicao.data_inicio,
        data_fim=edicao.data_fim
    )

    db.add(db_edicao)
    db.commit()
    db.refresh(db_edicao)
    return db_edicao

def listar_evento(db: Session, edicao_id: int):
    return db.query(models.Edicao).filter(models.Edicao.id_edicao == edicao_id).first()

def listar_edicoes(db: Session, skip: int = 0, limit: int = 10):
    return db.query(models.Edicao).offset(skip).limit(limit).all()

def atualizar_edicao(db: Session, edicao_id: int, edicao_atualizada: schemas.EdicaoCreate):
    db_edicao = listar_evento(db, edicao_id)

    if not db_edicao:
        return None
    
    dados = edicao_atualizada.model_dump(exclude_unset=True)
    for key, value in dados.items():
        setattr(db_edicao, key, value)

    db.commit()
    db.refresh(db_edicao)
    return db_edicao

def excluir_edicao(db: Session, edicao_id: int):
    db_edicao = listar_evento(db, edicao_id)

    if db_edicao:
        db.delete(db_edicao)
        db.commit()
        return True
    return False