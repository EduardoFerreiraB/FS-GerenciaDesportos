from sqlalchemy.orm import Session
import models
import schemas
from services import turmas as servico_turmas

def cadastrar_aluno(db: Session, aluno: schemas.AlunoCreate, foto: str = None, documento: str = None, atestado: str = None):
    
    # Validação de Conflitos de Horário antes de iniciar a transação
    if aluno.ids_turmas:
        turmas_selecionadas = []
        for id_turma in aluno.ids_turmas:
            turma = servico_turmas.listar_turma_id(db, id_turma)
            if turma:
                turmas_selecionadas.append(turma)
        
        # Verifica conflitos entre as turmas selecionadas
        from services.matriculas import verificar_conflito_horario
        
        turmas_para_checar = []
        for turma_nova in turmas_selecionadas:
            if verificar_conflito_horario(turma_nova, turmas_para_checar):
                 raise ValueError(f"Conflito de horário detectado envolvendo a turma {turma_nova.descricao or turma_nova.id_turma}")
            turmas_para_checar.append(turma_nova)

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
        id_participante=db_participante.id_participante,
        foto=foto,
        documento_pessoal=documento,
        atestado_medico=atestado,
        ativo=True # Garante que nasce ativo
    )
    db.add(db.aluno)
    db.flush()

    # Cria matrículas para todas as turmas informadas
    if aluno.ids_turmas:
        for id_turma in aluno.ids_turmas:
            db_matricula = models.Matricula(
                id_aluno=db.aluno.id_aluno,
                id_turma=id_turma,
                ativo=True
            )
            db.add(db_matricula)
    
    db.commit()
    db.refresh(db.aluno)

    return db.aluno

def listar_aluno(db: Session, id_aluno: int):
    return db.query(models.Aluno).filter(models.Aluno.id_aluno == id_aluno).first()

def listar_alunos(db: Session, skip: int = 0, limit: int = 100):
    # Por padrão, lista apenas os ativos para o CRUD básico
    # Se precisar de inativos, precisaremos de um endpoint específico ou filtro
    return db.query(models.Aluno).filter(models.Aluno.ativo == True).offset(skip).limit(limit).all()

def listar_alunos_por_turma(db: Session, id_turma: int):
    # Faz join com Matricula para filtrar pela turma
    return db.query(models.Aluno).join(models.Matricula).filter(models.Matricula.id_turma == id_turma).all()

def listar_alunos_nome(db: Session, nome: str):
    return db.query(models.Aluno).filter(models.Aluno.nome_completo.ilike(f"%{nome}%"), models.Aluno.ativo == True).all()

def listar_alunos_escola(db: Session, escola: str):
    return db.query(models.Aluno).filter(models.Aluno.escola.ilike(f"%{escola}%"), models.Aluno.ativo == True).all()

def listar_alunos_serie(db: Session, serie_ano: str):
    return db.query(models.Aluno).filter(models.Aluno.serie_ano.ilike(f"%{serie_ano}%"), models.Aluno.ativo == True).all()

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
    """
    Realiza Soft Delete:
    1. Seta ativo=False no Aluno
    2. Seta ativo=False em todas as Matrículas (libera vaga na turma)
    """
    db_aluno = listar_aluno(db, id_aluno)

    if db_aluno:
        # Inativa o aluno
        db_aluno.ativo = False
        
        # Inativa as matrículas
        db.query(models.Matricula).filter(models.Matricula.id_aluno == id_aluno).update({models.Matricula.ativo: False})
        
        db.commit()
        return True
    return False