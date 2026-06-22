import pytest
from security import get_password_hash
import models
from datetime import time, date

def setup_modalidade_professor_e_turmas(db):
    # 1. Modalidade
    mod = models.Modalidade(nome="Futsal", duracao_minutos=60)
    db.add(mod)
    db.flush()

    # 2. Usuário para o professor
    user_prof = models.Usuario(
        username="prof_val",
        password_hash=get_password_hash("prof123"),
        role="professor",
        must_change_password=False
    )
    db.add(user_prof)
    db.flush()

    # 3. Professor
    prof = models.Professor(
        id_usuario=user_prof.id_usuario,
        nome="Professor Teste",
        cpf="111.111.111-11",
        contato="99999999"
    )
    db.add(prof)
    db.flush()

    # 4. Turma A (Segunda-feira 14:00 - 15:00)
    turmaA = models.Turma(
        id_modalidade=mod.id_modalidade,
        id_professor=prof.id_professor,
        descricao="Futsal Sub 15 - Turma A",
        categoria_idade="Sub 15",
        horario_inicio=time(14, 0),
        horario_fim=time(15, 0)
    )
    db.add(turmaA)
    db.flush()
    db.add(models.TurmaDia(id_turma=turmaA.id_turma, dia_semana="SEG"))
    db.flush()

    # 5. Turma B (Segunda-feira 14:30 - 15:30) - CONFLITO COM A
    turmaB = models.Turma(
        id_modalidade=mod.id_modalidade,
        id_professor=prof.id_professor,
        descricao="Futsal Sub 15 - Turma B",
        categoria_idade="Sub 15",
        horario_inicio=time(14, 30),
        horario_fim=time(15, 30)
    )
    db.add(turmaB)
    db.flush()
    db.add(models.TurmaDia(id_turma=turmaB.id_turma, dia_semana="SEG"))
    db.flush()

    db.commit()
    return turmaA, turmaB

def test_cadastro_aluno_conflito_horario_rollback(client, db):
    # 1. Registrar um coordenador no banco para autenticação
    coord_user = models.Usuario(
        username="coord_test",
        password_hash=get_password_hash("coord123"),
        role="coordenador",
        must_change_password=False
    )
    db.add(coord_user)
    db.commit()

    # Login como coordenador
    login_response = client.post(
        "/token",
        data={"username": "coord_test", "password": "coord123"}
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Setup turmas conflitantes
    turmaA, turmaB = setup_modalidade_professor_e_turmas(db)

    # 2. Tentar cadastrar aluno informando os dois IDs conflitantes (turmaA e turmaB)
    form_data = {
        "nome_completo": "Aluno Conflitante Teste",
        "data_nascimento": "2010-05-15",
        "escola": "Escola Municipal",
        "serie_ano": "9º ano",
        "endereco": "Rua Teste, 123",
        "telefone_1": "(11) 99999-9999",
        "ids_turmas": f"{turmaA.id_turma},{turmaB.id_turma}"
    }

    # Fazer requisição multipart/form-data
    response = client.post("/alunos/", data=form_data, headers=headers)
    assert response.status_code == 400
    assert "Conflito" in response.json()["detail"]

    # 3. Certificar atomicidade: o aluno NÃO deve estar cadastrado no banco de dados!
    aluno_db = db.query(models.Aluno).filter(models.Aluno.nome_completo == "Aluno Conflitante Teste").first()
    assert aluno_db is None
