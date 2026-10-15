from sqlalchemy.orm import Session
import models
import schemas

def criar_atleta(db: Session, atleta: schemas.AtletaCreate, foto: str = None):
    # 1. Criar Participante
    db_participante = models.Participante(tipo="atleta")
    db.add(db_participante)
    db.flush()

    # 2. Criar Atleta
    db_atleta = models.Atleta(
        id_participante=db_participante.id_participante,
        nome_completo=atleta.nome_completo,
        data_nascimento=atleta.data_nascimento,
        documento_pessoal=atleta.documento_pessoal,
        contato=atleta.contato,
        endereco=atleta.endereco,
        foto=foto
    )
    db.add(db_atleta)
    db.commit()
    db.refresh(db_atleta)
    return db_atleta

def listar_atletas(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Atleta).offset(skip).limit(limit).all()

def listar_atleta(db: Session, id_atleta: int):
    return db.query(models.Atleta).filter(models.Atleta.id_atleta == id_atleta).first()

def atualizar_atleta(db: Session, id_atleta: int, atleta_atualizado: schemas.AtletaUpdate):
    db_atleta = listar_atleta(db, id_atleta)
    if not db_atleta:
        return None
    
    for chave, valor in atleta_atualizado.model_dump(exclude_unset=True).items():
        setattr(db_atleta, chave, valor)
    
    db.commit()
    db.refresh(db_atleta)
    return db_atleta

def excluir_atleta(db: Session, id_atleta: int):
    db_atleta = listar_atleta(db, id_atleta)
    if db_atleta:
        id_participante = db_atleta.id_participante

        db.delete(db_atleta)
        
        db_participante = db.query(models.Participante).filter(
            models.Participante.id_participante == id_participante
        ).first()
        if db_participante:
            db.delete(db_participante)
            
        db.commit()
        return True
    return False
