from sqlalchemy.orm import Session
import models
import schemas

def criar_equipe(db: Session, equipe: schemas.EquipeCreate):
    db_equipe = models.Equipe(
        nome=equipe.nome,
        id_edicao=equipe.id_edicao
    )
    db.add(db_equipe)
    db.commit()
    db_equipe = db.query(models.Equipe).filter(models.Equipe.id_equipe == db_equipe.id_equipe).first()
    return db_equipe

def listar_equipes(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Equipe).offset(skip).limit(limit).all()

def listar_equipes_edicao(db: Session, id_edicao: int):
    return db.query(models.Equipe).filter(models.Equipe.id_edicao == id_edicao).all()

def listar_equipe(db: Session, id_equipe: int):
    return db.query(models.Equipe).filter(models.Equipe.id_equipe == id_equipe).first()

def atualizar_equipe(db: Session, id_equipe: int, equipe_atualizada: schemas.EquipeUpdate):
    db_equipe = listar_equipe(db, id_equipe)
    if not db_equipe:
        return None
    
    for chave, valor in equipe_atualizada.model_dump(exclude_unset=True).items():
        setattr(db_equipe, chave, valor)
    
    db.commit()
    db.refresh(db_equipe)
    return db_equipe

def excluir_equipe(db: Session, id_equipe: int):
    db_equipe = listar_equipe(db, id_equipe)
    if db_equipe:
        db.delete(db_equipe)
        db.commit()
        return True
    return False

def adicionar_participante_equipe(db: Session, id_equipe: int, id_participante: int):
    db_equipe = listar_equipe(db, id_equipe)
    db_participante = db.query(models.Participante).filter(models.Participante.id_participante == id_participante).first()
    
    if not db_equipe or not db_participante:
        return False
    
    if db_participante not in db_equipe.participantes:
        db_equipe.participantes.append(db_participante)
        db.commit()
    return True
