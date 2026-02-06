from sqlalchemy.orm import Session
import models
import schemas

def dias_semana_str(dias_lista: list) -> str:
    if not dias_lista:
        return None
    
    dias_valores = []
    for dia in dias_lista:
        if hasattr(dia, 'value'):
            dias_valores.append(dia.value)
        else:
            dias_valores.append(str(dia))

    ordem = {"SEG": 1, "TER": 2, "QUA": 3, "QUI": 4, "SEX": 5, "SAB": 6, "DOM": 7}
    dias_valores.sort(key=lambda x: ordem.get(x, 100))

    return ",".join(dias_valores)

def checar_conflito_agenda(dias_selecionados: list, horario_inicio, horario_fim, turmas_comparar: list, id_turma_ignorar: int = None) -> bool:
    """
    Função pura que verifica se há conflito entre um horário proposto e uma lista de turmas existentes.
    """
    if not dias_selecionados:
        return False
        
    # Normaliza os dias selecionados para uma lista de strings
    dias_novos = [d.value if hasattr(d, 'value') else str(d) for d in dias_selecionados]
    
    for turma in turmas_comparar:
        if id_turma_ignorar and getattr(turma, 'id_turma', None) == id_turma_ignorar:
            continue
            
        # Pega os dias da turma (pode ser string do banco ou lista do schema/modelo)
        dias_turma_raw = turma.dias_semana
        if isinstance(dias_turma_raw, str):
            dias_turma = dias_turma_raw.split(',')
        elif isinstance(dias_turma_raw, list):
            dias_turma = [d.value if hasattr(d, 'value') else str(d) for d in dias_turma_raw]
        else:
            dias_turma = []
        
        # Verifica interseção de dias e sobreposição de horários
        if any(dia in dias_turma for dia in dias_novos):
            if (horario_inicio < turma.horario_fim) and (turma.horario_inicio < horario_fim):
                return True
    return False

def verificar_conflito_horario(db: Session, id_professor: int, dias: list, inicio, fim, id_turma_atual: int = None):
    turmas_prof = db.query(models.Turma).filter(models.Turma.id_professor == id_professor).all()
    return checar_conflito_agenda(dias, inicio, fim, turmas_prof, id_turma_ignorar=id_turma_atual)

def criar_turma(db:Session, turma: schemas.TurmaCreate):
    if verificar_conflito_horario(db, turma.id_professor, turma.dias_semana, turma.horario_inicio, turma.horario_fim):
        raise ValueError("Conflito de horário: O professor já possui aula neste período.")

    dias_str = dias_semana_str(turma.dias_semana)

    db_turma = models.Turma(
        descricao=turma.descricao,
        categoria_idade=turma.categoria_idade,
        horario_inicio=turma.horario_inicio,
        horario_fim=turma.horario_fim,
        dias_semana=dias_str,
        id_modalidade=turma.id_modalidade,
        id_professor=turma.id_professor
    )

    db.add(db_turma)
    db.commit()
    db.refresh(db_turma)
    return db_turma

def listar_turma_id(db: Session, id_turma: int):
    return db.query(models.Turma).filter(models.Turma.id_turma == id_turma).first()

def listar_turmas(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Turma).offset(skip).limit(limit).all()

def listar_turmas_professor(db: Session, id_professor: int):
    return db.query(models.Turma).filter(models.Turma.id_professor == id_professor).all()

def listar_turmas_modalidade(db: Session, id_modalidade: int):
    return db.query(models.Turma).filter(models.Turma.id_modalidade == id_modalidade).all()

def atualizar_turma(db: Session, id_turma: int, turma_atualizada: schemas.TurmaUpdate):
    db_turma = listar_turma_id(db, id_turma)

    if not db_turma:
        return None
    
    dados_atualizados = turma_atualizada.model_dump(exclude_unset=True)

    novo_prof = dados_atualizados.get('id_professor', db_turma.id_professor)
    novos_dias = dados_atualizados.get('dias_semana', [])
    novo_inicio = dados_atualizados.get('horario_inicio', db_turma.horario_inicio)
    novo_fim = dados_atualizados.get('horario_fim', db_turma.horario_fim)

    if 'dias_semana' not in dados_atualizados:
        novos_dias = db_turma.dias_semana.split(',') if db_turma.dias_semana else []

    if verificar_conflito_horario(db, novo_prof, novos_dias, novo_inicio, novo_fim, id_turma_atual=id_turma):
        raise ValueError("Conflito de horário na atualização.")

    if 'dias_semana' in dados_atualizados:
        dados_atualizados['dias_semana'] = dias_semana_str(dados_atualizados['dias_semana'])

    for chave, valor, in dados_atualizados.items():
        setattr(db_turma, chave, valor)

    db.commit()
    db.refresh(db_turma)
    return db_turma

def excluir_turma(db: Session, id_turma: int):
    db_turma = listar_turma_id(db, id_turma)

    if db_turma:
        matriculas = db.query(models.Matricula).filter(models.Matricula.id_turma == id_turma).all()
        ids_matriculas = [m.id_matricula for m in matriculas]

        if ids_matriculas:
            db.query(models.Presenca).filter(models.Presenca.id_matricula.in_(ids_matriculas)).delete(synchronize_session=False)
            
            db.query(models.Matricula).filter(models.Matricula.id_turma == id_turma).delete(synchronize_session=False)
        
        db.delete(db_turma)
        db.commit()
        return True
    return False