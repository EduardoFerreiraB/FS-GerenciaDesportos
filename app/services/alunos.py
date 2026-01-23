from sqlalchemy.orm import Session
import models
import schemas
from services import turmas as servico_turmas
from services import matriculas as servico_matriculas

def criar_participante(db: Session, tipo: str):
    db_participante = models.Participante(tipo=tipo)
    db.add(db_participante)
    db.commit()
    db.refresh(db_participante)
    return db_participante

def cadastrar_aluno(db: Session, aluno: schemas.AlunoCreate, foto: str = None, documento: str = None, atestado: str = None):
    participante = criar_participante(db, tipo="aluno")

    db_aluno = models.Aluno(
        id_participante=participante.id_participante,
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
        foto=foto,
        documento_pessoal=documento,
        atestado_medico=atestado
    )

    db.add(db_aluno)
    db.commit()
    db.refresh(db_aluno)

    if aluno.ids_turmas:
        for id_turma in aluno.ids_turmas:
            turma = servico_turmas.listar_turma_id(db, id_turma)
            if turma:
                try:
                    matricula = schemas.MatriculaCreate(id_aluno=db_aluno.id_aluno, id_turma=id_turma)
                    servico_matriculas.criar_matricula(db, matricula)
                except ValueError:
                    pass

    return db_aluno

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

def listar_alunos_por_turma(db: Session, id_turma: int):
    matriculas = db.query(models.Matricula).filter(
        models.Matricula.id_turma == id_turma, 
        models.Matricula.ativo == True
    ).all()
    
    alunos = [m.aluno for m in matriculas]
    return alunos

def atualizar_aluno(db: Session, id_aluno: int, aluno_atualizado: schemas.AlunoUpdate):
    db_aluno = listar_aluno(db, id_aluno)

    if not db_aluno:
        return None
    
    dados_atualizados = aluno_atualizado.model_dump(exclude_unset=True)

    for chave, valor, in dados_atualizados.items():
        setattr(db_aluno, chave, valor)

    db.commit()
    db.refresh(db_aluno)
    return db_aluno

def excluir_aluno(db: Session, id_aluno: int):
    db_aluno = listar_aluno(db, id_aluno)

    if db_aluno:
        db.delete(db_aluno)
        db.commit()
        return True
    return False