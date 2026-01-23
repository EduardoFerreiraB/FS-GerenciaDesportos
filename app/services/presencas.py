from sqlalchemy.orm import Session
from datetime import date
import models
import schemas

def registrar_presenca_lote(db: Session, lista_presenca: schemas.ListaPresenca):
    registros = []
    
    for item in lista_presenca.presencas:
        presenca_existente = db.query(models.Presenca).filter(
            models.Presenca.id_matricula == item.id_matricula,
            models.Presenca.data_aula == lista_presenca.data_aula
        ).first()

        if presenca_existente:
            presenca_existente.status = item.status
            presenca_existente.observacao = item.observacao
            registros.append(presenca_existente)
        else:
            nova_presenca = models.Presenca(
                id_matricula=item.id_matricula,
                data_aula=lista_presenca.data_aula,
                status=item.status,
                observacao=item.observacao
            )
            db.add(nova_presenca)
            registros.append(nova_presenca)
    
    db.commit()
    for r in registros:
        db.refresh(r)
        
    return registros

def listar_presencas_turma_data(db: Session, id_turma: int, data_aula: date):
    matriculas = db.query(models.Matricula).filter(
        models.Matricula.id_turma == id_turma,
        models.Matricula.ativo == True
    ).all()
    
    ids_matriculas = [m.id_matricula for m in matriculas]
    
    if not ids_matriculas:
        return []

    presencas = db.query(models.Presenca).filter(
        models.Presenca.id_matricula.in_(ids_matriculas),
        models.Presenca.data_aula == data_aula
    ).all()
    
    return presencas