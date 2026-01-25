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
    
    # Validação de Conflitos de Horário antes de iniciar a transação
    if aluno.ids_turmas:
        turmas_selecionadas = []
        for id_turma in aluno.ids_turmas:
            turma = servico_turmas.listar_turma_id(db, id_turma)
            if turma:
                turmas_selecionadas.append(turma)
        
        from services.matriculas import verificar_conflito_horario
        
        turmas_para_checar = []
        for turma_nova in turmas_selecionadas:
            if verificar_conflito_horario(turma_nova, turmas_para_checar):
                 raise ValueError(f"Conflito de horário detectado envolvendo a turma {turma_nova.descricao or turma_nova.id_turma}")
            turmas_para_checar.append(turma_nova)

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
        atestado_medico=atestado,
        ativo=True
    )

    db.add(db_aluno)
    db.commit()
    db.refresh(db_aluno)

    if aluno.ids_turmas:
        for id_turma in aluno.ids_turmas:
            try:
                matricula_schema = schemas.MatriculaCreate(id_aluno=db_aluno.id_aluno, id_turma=id_turma)
                servico_matriculas.criar_matricula(db, matricula_schema)
            except ValueError:
                pass
    
    return db_aluno

def listar_aluno(db: Session, id_aluno: int):
    return db.query(models.Aluno).filter(models.Aluno.id_aluno == id_aluno).first()

def listar_alunos(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Aluno).offset(skip).limit(limit).all()

def listar_alunos_por_turma(db: Session, id_turma: int):
    return db.query(models.Aluno).join(models.Matricula).filter(
        models.Matricula.id_turma == id_turma,
        models.Matricula.ativo == True
    ).all()

def listar_alunos_nome(db: Session, nome: str):
    return db.query(models.Aluno).filter(models.Aluno.nome_completo.ilike(f"%{nome}%")).all()

def listar_alunos_escola(db: Session, escola: str):
    return db.query(models.Aluno).filter(models.Aluno.escola.ilike(f"%{escola}%")).all()

def listar_alunos_serie(db: Session, serie_ano: str):
    return db.query(models.Aluno).filter(models.Aluno.serie_ano.ilike(f"%{serie_ano}%")).all()

def atualizar_aluno(db: Session, id_aluno: int, aluno_atualizado: schemas.AlunoUpdate):
    db_aluno = listar_aluno(db, id_aluno)

    if not db_aluno:
        return None
    
    dados_atualizados = aluno_atualizado.model_dump(exclude_unset=True)

    for chave, valor in dados_atualizados.items():
        setattr(db_aluno, chave, valor)

    db.commit()
    db.refresh(db_aluno)
    return db_aluno

def excluir_aluno(db: Session, id_aluno: int):
    db_aluno = listar_aluno(db, id_aluno)

    if db_aluno:
        # 1. Buscar matrículas para limpar dependências
        matriculas = db.query(models.Matricula).filter(models.Matricula.id_aluno == id_aluno).all()
        ids_matriculas = [m.id_matricula for m in matriculas]

        # 2. Deletar Presenças do aluno (via matrículas)
        if ids_matriculas:
            db.query(models.Presenca).filter(models.Presenca.id_matricula.in_(ids_matriculas)).delete(synchronize_session=False)
            
            # 3. Deletar Matrículas
            db.query(models.Matricula).filter(models.Matricula.id_aluno == id_aluno).delete(synchronize_session=False)

        # 4. Deletar Aluno
        id_participante = db_aluno.id_participante
        db.delete(db_aluno)

        # 5. Deletar Participante (se for o caso)
        db_participante = db.query(models.Participante).filter(models.Participante.id_participante == id_participante).first()
        if db_participante:
            db.delete(db_participante)

        db.commit()
        return True
    return False