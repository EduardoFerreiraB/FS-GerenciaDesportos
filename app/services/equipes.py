from sqlalchemy import select
from sqlalchemy.orm import Session
import models
import schemas

def criar_equipe(db: Session, equipe: schemas.EquipeCreate):
    """Block the pre-competition creation path.

    Teams now belong to a team-mode competition, so callers must use
    ``criar_equipe_competicao`` after resolving and validating it.  Keeping
    this guard prevents a future use of the old service from recreating the
    edition-only write path; historical team reads remain available.
    """
    raise ValueError("Informe id_competicao; crie equipes pela competição.")

def criar_equipe_competicao(
    db: Session,
    competicao: models.Competicao,
    equipe: schemas.EquipeCompeticaoCreate,
):
    if competicao.modo_inscricao != "EQUIPE":
        raise ValueError("A competição não aceita equipes.")

    db_equipe = models.Equipe(
        nome=equipe.nome,
        grupo=equipe.grupo,
        id_edicao=competicao.id_edicao,
        id_competicao=competicao.id_competicao,
    )
    db.add(db_equipe)
    db.commit()
    db.refresh(db_equipe)
    return db_equipe

def listar_equipes(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Equipe).offset(skip).limit(limit).all()

def listar_equipes_edicao(db: Session, id_edicao: int):
    return db.query(models.Equipe).filter(models.Equipe.id_edicao == id_edicao).all()

def listar_equipes_competicao(db: Session, id_competicao: int):
    return db.query(models.Equipe).filter(models.Equipe.id_competicao == id_competicao).all()

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
    # This lookup only discovers whether the request is competition-scoped.
    # Discard its transaction before taking the competition lock: otherwise a
    # MySQL repeatable-read snapshot could predate a competing roster change.
    scope = db.execute(
        select(models.Equipe.id_competicao).where(models.Equipe.id_equipe == id_equipe)
    ).first()
    if scope and isinstance(scope[0], int):
        id_competicao = scope[0]
        db.rollback()
        # A lock on the competition, rather than on one team or participant,
        # makes the query-and-insert sequence serial for every roster write in
        # that competition on MySQL.  SQLite ignores FOR UPDATE but still has
        # the same observable validation path in isolated tests.
        competicao = (
            db.query(models.Competicao)
            .filter(models.Competicao.id_competicao == id_competicao)
            .with_for_update()
            .first()
        )
        if not competicao:
            return False
        db_equipe = listar_equipe(db, id_equipe)
        db_participante = (
            db.query(models.Participante)
            .filter(models.Participante.id_participante == id_participante)
            .first()
        )
        if not db_equipe or not db_participante:
            return False
        participante_em_outra_equipe = (
            db.query(models.Equipe)
            .join(models.equipes_participantes)
            .filter(
                models.Equipe.id_competicao == competicao.id_competicao,
                models.equipes_participantes.c.id_participante == id_participante,
                models.Equipe.id_equipe != id_equipe,
            )
            .with_for_update()
            .first()
        )
        if participante_em_outra_equipe:
            raise ValueError("O participante já pertence a outra equipe desta competição.")
    else:
        db_equipe = listar_equipe(db, id_equipe)
        db_participante = (
            db.query(models.Participante)
            .filter(models.Participante.id_participante == id_participante)
            .first()
        )
        if not db_equipe or not db_participante:
            return False
    
    if db_participante not in db_equipe.participantes:
        db_equipe.participantes.append(db_participante)
        db.commit()
    return True

def remover_participante_equipe(db: Session, id_equipe: int, id_participante: int):
    db_equipe = listar_equipe(db, id_equipe)
    if not db_equipe:
        return False

    participante = next(
        (
            participante
            for participante in db_equipe.participantes
            if participante.id_participante == id_participante
        ),
        None,
    )
    if not participante:
        return False

    db_equipe.participantes.remove(participante)
    db.commit()
    return True
