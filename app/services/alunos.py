from sqlalchemy.orm import Session
import models
import schemas

def cadastrar_aluno(db: Session, aluno: schemas.AlunoCreate):
    
    db_participante = models.Participante(
        tipo="aluno"
    )
    db.add(db_participante)
    db.flush()

    db.aluno = models.Aluno(
        nome_completo=aluno.nome_completo,
        data_nascimento=aluno.data_nascimento,
        escola=aluno.escola,
        serie_ano=aluno.serie_ano,
        nome_mae=aluno.nome_mae,
        nome_pai=aluno.nome_pai,
        telefone_1=aluno.telefone_1,
        telefone_2=aluno.telefone_2,
        endereco=aluno.endereco,
        recomendacoes_medicas=aluno.recomendacoes_medicas,
        id_participante=db_participante.id_participante
    )
    db.add(db.aluno)
    db.flush()

    db_matricula = models.Matricula(
        id_aluno=db.aluno.id_aluno,
        id_turma=aluno.id_turma,
        ativo=True
    )
    db.add(db_matricula)
    db.commit()
    db.refresh(db.aluno)

    return db.aluno

def listar_aluno(db: Session, id_aluno: int):
    return db.query(models.Aluno).filter(models.Aluno.id_aluno == id_aluno).first()

def listar_alunos(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Aluno).offset(skip).limit(limit).all()

def listar_alunos_nome(db: Session, nome: str):
    return db.query(models.Aluno).filter(models.Aluno.nome_completo.ilike(f"%{nome}%")).all()

def listar_alunos_escola(db: Session, escola: str):
    return db.query(models.Aluno).filter(models.Aluno.escola.ilike(f"%{escola}%")).all()

def listar_alunos_serie(db: Session, serie_ano: str):
    return db.query(models.Aluno).filter(models.Aluno.serie_ano.ilike(f"%{serie_ano}%")).all()

def atualizar_aluno(db: Session, id_aluno: int, aluno_atualizado: schemas.AlunoCreate):
    db_aluno = listar_aluno(db, id_aluno)

    if not db_aluno:
        return None
    
    dados_atualizados = aluno_atualizado.model_dump(exclude_unset=True)

    if 'id_turma' in dados_atualizados:
        del dados_atualizados['id_turma']

    for chave, valor in dados_atualizados.items():
        setattr(db_aluno, chave, valor)

    db.commit()
    db.refresh(db_aluno)
    return db_aluno

def excluir_aluno(db: Session, id_aluno: int):

    db_aluno = listar_aluno(db, id_aluno)

    if db_aluno:
        id_participante = db_aluno.id_participante

        db.delete(db_aluno)

        db_participante = db.query(models.Participante).filter(models.Participante.id_participante == id_participante).first()
        if db_participante:
            db.delete(db_participante)

        db.commit()
        return True
    return False

