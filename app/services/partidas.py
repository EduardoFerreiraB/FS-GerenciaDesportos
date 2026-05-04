from sqlalchemy.orm import Session
from datetime import date, time
import models
import schemas

def verificar_conflito_partida(db: Session, id_local: int, id_arbitro: int, data: date, hora: time, id_partida_ignorar: int = None):
    # Conflito de Local
    conflito_local = db.query(models.Partida).filter(
        models.Partida.id_local == id_local,
        models.Partida.part_data == data,
        models.Partida.part_hora == hora,
        models.Partida.status != "Cancelada"
    )
    if id_partida_ignorar:
        conflito_local = conflito_local.filter(models.Partida.id_partida != id_partida_ignorar)
    
    if conflito_local.first():
        return "O local já possui uma partida agendada para este horário."

    # Conflito de Árbitro
    conflito_arbitro = db.query(models.Partida).filter(
        models.Partida.id_arbitro == id_arbitro,
        models.Partida.part_data == data,
        models.Partida.part_hora == hora,
        models.Partida.status != "Cancelada"
    )
    if id_partida_ignorar:
        conflito_arbitro = conflito_arbitro.filter(models.Partida.id_partida != id_partida_ignorar)
    
    if conflito_arbitro.first():
        return "O árbitro já possui uma partida agendada para este horário."

    return None

def criar_partida(db: Session, partida: schemas.PartidaCreate):
    erro = verificar_conflito_partida(db, partida.id_local, partida.id_arbitro, partida.part_data, partida.part_hora)
    if erro:
        raise ValueError(erro)

    db_partida = models.Partida(**partida.model_dump())
    db.add(db_partida)
    db.commit()
    db.refresh(db_partida)
    return db_partida

def listar_partida(db: Session, id_partida: int):
    return db.query(models.Partida).filter(models.Partida.id_partida == id_partida).first()

def listar_partidas_edicao(db: Session, id_edicao: int):
    return db.query(models.Partida).filter(models.Partida.id_edicao == id_edicao).all()

def atualizar_partida(db: Session, id_partida: int, partida_atualizada: schemas.PartidaUpdate):
    db_partida = listar_partida(db, id_partida)
    if not db_partida:
        return None
    
    dados = partida_atualizada.model_dump(exclude_unset=True)
    
    # Se mudar local, arbitro, data ou hora, validar conflito
    novo_local = dados.get("id_local", db_partida.id_local)
    novo_arbitro = dados.get("id_arbitro", db_partida.id_arbitro)
    nova_data = dados.get("part_data", db_partida.part_data)
    nova_hora = dados.get("part_hora", db_partida.part_hora)
    
    if any(k in dados for k in ["id_local", "id_arbitro", "part_data", "part_hora"]):
        erro = verificar_conflito_partida(db, novo_local, novo_arbitro, nova_data, nova_hora, id_partida_ignorar=id_partida)
        if erro:
            raise ValueError(erro)

    for chave, valor in dados.items():
        setattr(db_partida, chave, valor)
    
    db.commit()
    db.refresh(db_partida)
    return db_partida

def excluir_partida(db: Session, id_partida: int):
    db_partida = listar_partida(db, id_partida)
    if db_partida:
        db.delete(db_partida)
        db.commit()
        return True
    return False
