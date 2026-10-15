import pytest
from datetime import date, time, datetime, timedelta
from unittest.mock import MagicMock, patch
import models
import schemas
from services import (
    professores as serv_prof,
    turmas as serv_turmas,
    alunos as serv_alunos,
    matriculas as serv_matriculas,
    arbitros as serv_arbitros,
    atletas as serv_atletas,
    locais as serv_locais,
    modalidades as serv_mod,
    presencas as serv_pres,
)


def create_mock_model(model_cls, **kwargs):
    m = MagicMock(spec=model_cls)
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m

# ==================== 1. PROFESSORES SERVICE ====================

def test_criar_professor_unitario():
    db = MagicMock()
    db.query().filter().first.return_value = None # Nenhum usuário duplicado
    
    prof_in = schemas.ProfessorCreate(
        username="prof1", password="password123", nome="Professor 1", cpf="12345678909", contato="123"
    )
    
    with patch("security.get_password_hash", return_value="hashed_password"):
        p = serv_prof.criar_professor(db, prof_in)
        assert p.nome == "Professor 1"
        db.add.assert_called()
        db.flush.assert_called()

def test_listar_professor_unitario():
    db = MagicMock()
    prof = create_mock_model(models.Professor, id_professor=1, nome="Prof 1", cpf="123")
    db.query().filter().first.return_value = prof
    
    res = serv_prof.listar_professor(db, 1)
    assert res == prof
    
    res_cpf = serv_prof.listar_professor_cpf(db, "123")
    assert res_cpf == prof

def test_listar_professores_unitario():
    db = MagicMock()
    profs = [create_mock_model(models.Professor, id_professor=1), create_mock_model(models.Professor, id_professor=2)]
    db.query().offset().limit().all.return_value = profs
    
    res = serv_prof.listar_professores(db)
    assert res == profs

def test_atualizar_professor_unitario():
    db = MagicMock()
    prof = create_mock_model(models.Professor, id_professor=1, nome="Prof Old")
    db.query().filter().first.return_value = prof
    
    up = schemas.ProfessorUpdate(nome="Prof New")
    res = serv_prof.atualizar_professor(db, 1, up)
    assert res.nome == "Prof New"
    
    # Inexistente
    db.query().filter().first.return_value = None
    assert serv_prof.atualizar_professor(db, 999, up) is None

def test_excluir_professor_sucesso_unitario():
    db = MagicMock()
    prof = create_mock_model(models.Professor, id_professor=1, turmas=[])
    db.query().filter().first.return_value = prof
    
    assert serv_prof.excluir_professor(db, 1) is True
    db.delete.assert_called_with(prof)

def test_excluir_professor_com_turmas_unitario():
    db = MagicMock()
    prof = create_mock_model(models.Professor, id_professor=1)
    prof.turmas = [create_mock_model(models.Turma, id_turma=5)]
    db.query().filter().first.return_value = prof
    
    with pytest.raises(ValueError, match="Não é possível excluir o professor"):
        serv_prof.excluir_professor(db, 1)

def test_excluir_professor_inexistente_unitario():
    db = MagicMock()
    db.query().filter().first.return_value = None
    assert serv_prof.excluir_professor(db, 999) is False


# ==================== 2. TURMAS SERVICE ====================

def test_dias_semana_str():
    assert serv_turmas.dias_semana_str(None) is None
    assert serv_turmas.dias_semana_str([]) is None
    assert serv_turmas.dias_semana_str(["SEG", "TER"]) == "SEG,TER"
    
    class MockEnum:
        def __init__(self, val):
            self.value = val
    assert serv_turmas.dias_semana_str([MockEnum("SEG")]) == "SEG"

def test_checar_conflito_agenda():
    assert serv_turmas.checar_conflito_agenda([], time(10, 0), time(11, 0), []) is False

    turmas = [
        create_mock_model(models.Turma, id_turma=1, dias_semana="SEG,TER", horario_inicio=time(10, 0), horario_fim=time(11, 0)),
        create_mock_model(models.Turma, id_turma=2, dias_semana=["SEG", "QUA"], horario_inicio=time(14, 0), horario_fim=time(15, 0)),
        create_mock_model(models.Turma, id_turma=3, dias_semana=None, horario_inicio=time(14, 0), horario_fim=time(15, 0))
    ]

    assert serv_turmas.checar_conflito_agenda(["QUI"], time(10, 0), time(11, 0), turmas) is False
    assert serv_turmas.checar_conflito_agenda(["SEG"], time(11, 0), time(12, 0), turmas) is False
    assert serv_turmas.checar_conflito_agenda(["SEG"], time(10, 30), time(11, 30), turmas) is True
    assert serv_turmas.checar_conflito_agenda(["SEG"], time(10, 30), time(11, 30), turmas, id_turma_ignorar=1) is False

def test_criar_turma_horario_invalido_unitario():
    db = MagicMock()
    with pytest.raises(ValueError, match="anterior ao horário"):
        serv_turmas.criar_turma(db, schemas.TurmaCreate(
            id_modalidade=1, id_professor=1, horario_inicio=time(11, 0), horario_fim=time(10, 0), dias_semana=["SEG"], categoria_idade="Sub 15"
        ))

def test_criar_turma_conflito_unitario():
    db = MagicMock()
    t = create_mock_model(models.Turma, id_turma=10, dias_semana="SEG", horario_inicio=time(10,0), horario_fim=time(11,0))
    db.query().filter().all.return_value = [t]
    with pytest.raises(ValueError, match="Conflito de horário"):
        serv_turmas.criar_turma(db, schemas.TurmaCreate(
            id_modalidade=1, id_professor=1, horario_inicio=time(10, 30), horario_fim=time(11, 30), dias_semana=["SEG"], categoria_idade="Sub 15"
        ))

def test_criar_turma_sucesso_unitario():
    db = MagicMock()
    db.query().filter().all.return_value = []
    t = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=1, id_professor=1, horario_inicio=time(10, 0), horario_fim=time(11, 0), dias_semana=["SEG"], categoria_idade="Sub 15"
    ))
    assert t.categoria_idade == "Sub 15"
    db.add.assert_called()

def test_listar_turmas_unitario():
    db = MagicMock()
    t = create_mock_model(models.Turma, id_turma=1)
    db.query().filter().first.return_value = t
    db.query().offset().limit().all.return_value = [t]
    
    assert serv_turmas.listar_turma_id(db, 1) == t
    assert serv_turmas.listar_turmas(db) == [t]
    
    db.query().filter().all.return_value = [t]
    assert serv_turmas.listar_turmas_professor(db, 1) == [t]
    assert serv_turmas.listar_turmas_modalidade(db, 1) == [t]

def test_atualizar_turma_unitario():
    db = MagicMock()
    t = create_mock_model(models.Turma, id_turma=1, horario_inicio=time(10, 0), horario_fim=time(11, 0), dias_semana="SEG", id_professor=1, dias=MagicMock())
    db.query().filter().first.return_value = t
    db.query().filter().all.return_value = [] # no conflict
    
    res = serv_turmas.atualizar_turma(db, 1, schemas.TurmaUpdate(categoria_idade="Sub 17", dias_semana=["TER"]))
    assert res.categoria_idade == "Sub 17"

def test_atualizar_turma_inexistente_unitario():
    db = MagicMock()
    db.query().filter().first.return_value = None
    assert serv_turmas.atualizar_turma(db, 999, schemas.TurmaUpdate()) is None

def test_excluir_turma_unitario():
    db = MagicMock()
    t = create_mock_model(models.Turma, id_turma=1)
    db.query().filter().first.return_value = t
    
    assert serv_turmas.excluir_turma(db, 1) is True
    db.delete.assert_called_with(t)
    
    db.query().filter().first.return_value = None
    assert serv_turmas.excluir_turma(db, 999) is False


# ==================== 3. ALUNOS SERVICE ====================

def test_cadastrar_aluno_unitario():
    db = MagicMock()
    db.query().filter().first.return_value = None # Sem duplicado
    
    al_in = schemas.AlunoCreate(
        nome_completo="Aluno 1", data_nascimento=date(2010, 1, 1), escola="Esc", serie_ano="9", endereco="Rua", telefone_1="1", ids_turmas=[]
    )
    
    with patch("services.alunos.criar_participante", return_value=create_mock_model(models.Participante, id_participante=1)):
        res = serv_alunos.cadastrar_aluno(db, al_in)
        assert res.nome_completo == "Aluno 1"
        db.add.assert_called()

def test_cadastrar_aluno_duplicado_unitario():
    db = MagicMock()
    db.query().filter().first.return_value = create_mock_model(models.Aluno, nome_completo="Aluno 1")
    
    al_in = schemas.AlunoCreate(
        nome_completo="Aluno 1", data_nascimento=date(2010, 1, 1), escola="Esc", serie_ano="9", endereco="Rua", telefone_1="1", ids_turmas=[]
    )
    with pytest.raises(ValueError, match="Já existe um aluno cadastrado"):
        serv_alunos.cadastrar_aluno(db, al_in)

def test_cadastrar_aluno_conflito_horario():
    db = MagicMock()
    db.query().filter().first.return_value = None # Sem duplicado
    
    t1 = create_mock_model(models.Turma, id_turma=1, dias_semana="SEG", horario_inicio=time(10,0), horario_fim=time(11,0), descricao="T1")
    t2 = create_mock_model(models.Turma, id_turma=2, dias_semana="SEG", horario_inicio=time(10,30), horario_fim=time(11,30), descricao="T2")
    
    def mock_listar_turma(session, id_turma):
        return t1 if id_turma == 1 else t2
    
    with patch("services.alunos.servico_turmas.listar_turma_id", side_effect=mock_listar_turma):
        with patch("services.alunos.servico_turmas.checar_conflito_agenda", return_value=True):
            al_in = schemas.AlunoCreate(
                nome_completo="Aluno Conflito", data_nascimento=date(2010, 1, 1), escola="Esc", serie_ano="9", endereco="Rua", telefone_1="1", ids_turmas=[1, 2]
            )
            with pytest.raises(ValueError, match="Conflito de horário detectado"):
                serv_alunos.cadastrar_aluno(db, al_in)

def test_listar_alunos_unitario():
    db = MagicMock()
    al = create_mock_model(models.Aluno, id_aluno=1, nome_completo="Aluno 1")
    
    db.query().filter().first.return_value = al
    assert serv_alunos.listar_aluno(db, 1) == al
    
    db.query().offset().limit().all.return_value = [al]
    assert serv_alunos.listar_alunos(db) == [al]
    
    db.query().join().filter().all.return_value = [al]
    assert serv_alunos.listar_alunos_por_turma(db, 5) == [al]

    db.query().filter().all.return_value = [al]
    assert serv_alunos.listar_alunos_nome(db, "Aluno") == [al]
    assert serv_alunos.listar_alunos_escola(db, "Esc") == [al]
    assert serv_alunos.listar_alunos_serie(db, "9") == [al]

def test_atualizar_aluno_unitario():
    db = MagicMock()
    al = create_mock_model(models.Aluno, id_aluno=1, nome_completo="Old Aluno")
    db.query().filter().first.return_value = al
    
    res = serv_alunos.atualizar_aluno(db, 1, schemas.AlunoUpdate(nome_completo="New Aluno"))
    assert res.nome_completo == "New Aluno"
    
    # Inexistente
    db.query().filter().first.return_value = None
    assert serv_alunos.atualizar_aluno(db, 999, schemas.AlunoUpdate()) is None

def test_excluir_aluno_sucesso_unitario():
    db = MagicMock()
    al = create_mock_model(models.Aluno, id_aluno=1, matriculas=[])
    db.query().filter().first.return_value = al
    
    res = serv_alunos.excluir_aluno(db, 1)
    assert res is True
    assert db.delete.called
    assert db.commit.called

def test_criar_participante_unitario():
    db = MagicMock()
    participante = serv_alunos.criar_participante(db, "aluno")
    assert participante.tipo == "aluno"
    db.add.assert_called_once_with(participante)
    db.flush.assert_called_once()

@patch("services.alunos.criar_participante")
def test_cadastrar_aluno_matricula_conflito_unitario(mock_criar_part):
    db = MagicMock()
    mock_criar_part.return_value = MagicMock(id_participante=99)
    db.query().filter().first.return_value = None  # Aluno não existe
    
    with patch("services.turmas.checar_conflito_agenda", return_value=False):
        with patch("services.turmas.listar_turma_id", return_value=create_mock_model(models.Turma, id_turma=1)):
            with patch("services.matriculas.verificar_conflito_aluno", return_value=True):
                aluno_in = schemas.AlunoCreate(nome_completo="Aluno Conflito", data_nascimento=date(2000, 1, 1), ids_turmas=[1])
                with pytest.raises(ValueError, match="já possui matrícula em outra turma nesse mesmo horário"):
                    serv_alunos.cadastrar_aluno(db, aluno_in)

@patch("services.alunos.criar_participante")
def test_cadastrar_aluno_exception_rollback_unitario(mock_criar_part):
    db = MagicMock()
    mock_criar_part.return_value = MagicMock(id_participante=99)
    db.query().filter().first.return_value = None
    
    db.add.side_effect = Exception("Erro de Banco Generico")
    
    aluno_in = schemas.AlunoCreate(nome_completo="Aluno Falha", data_nascimento=date(2000, 1, 1), ids_turmas=[])
    with pytest.raises(Exception, match="Erro de Banco Generico"):
        serv_alunos.cadastrar_aluno(db, aluno_in)
    db.rollback.assert_called_once()

def test_excluir_aluno_unitario():
    db = MagicMock()
    al = create_mock_model(models.Aluno, id_aluno=1)
    db.query().filter().first.return_value = al
    
    assert serv_alunos.excluir_aluno(db, 1) is True
    db.delete.assert_called_with(al)
    
    db.query().filter().first.return_value = None
    assert serv_alunos.excluir_aluno(db, 999) is False


# ==================== 4. MATRICULAS SERVICE ====================

def test_criar_matricula_unitario():
    db = MagicMock()
    
    with patch("services.matriculas.verificar_conflito_aluno", return_value=False):
        m = serv_matriculas.criar_matricula(db, schemas.MatriculaCreate(id_aluno=1, id_turma=10))
        assert m.id_aluno == 1
        db.add.assert_called()

def test_criar_matricula_conflito_unitario():
    db = MagicMock()
    
    with patch("services.matriculas.verificar_conflito_aluno", return_value=True):
        with pytest.raises(ValueError, match="Conflito de horário"):
            serv_matriculas.criar_matricula(db, schemas.MatriculaCreate(id_aluno=1, id_turma=10))

def test_verificar_conflito_aluno_unitario():
    db = MagicMock()
    
    t_dest = create_mock_model(models.Turma, id_turma=999, dias_semana=["SEG"], horario_inicio=time(10,0), horario_fim=time(11,0))
    t_outra = create_mock_model(models.Turma, id_turma=2, dias_semana=["SEG"], horario_inicio=time(10,30), horario_fim=time(11,30))
    
    def mock_query(model):
        q = MagicMock()
        if model == models.Turma:
            q.filter().first.return_value = t_dest
        elif model == models.Matricula:
            # list matriculas
            m = create_mock_model(models.Matricula, id_matricula=1, id_turma=2, turma=t_outra)
            q.filter().all.return_value = [m]
        return q
        
    db.query.side_effect = mock_query
    
    with patch("services.matriculas.servico_turmas.listar_turma_id", return_value=t_dest):
        assert serv_matriculas.verificar_conflito_aluno(db, 1, 999) is True

def test_matriculas_listar_e_cancelar_unitario():
    db = MagicMock()
    m = create_mock_model(models.Matricula, id_matricula=1)
    
    db.query().offset().limit().all.return_value = [m]
    assert serv_matriculas.listar_matriculas(db) == [m]
    
    db.query().filter().all.return_value = [m]
    assert serv_matriculas.listar_matriculas_turma(db, 1) == [m]
    assert serv_matriculas.listar_matriculas_aluno(db, 1) == [m]
    
    db.query().filter().first.return_value = m
    assert serv_matriculas.verificar_matricula(db, 1, 1) == m
    
    # Cancelar sucesso
    assert serv_matriculas.cancelar_matricula(db, 1) is True
    # Cancelar inexistente
    db.query().filter().first.return_value = None
    assert serv_matriculas.cancelar_matricula(db, 999) is False


# ==================== 5. ARBITROS SERVICE ====================

def test_arbitros_crud_unitario():
    db = MagicMock()
    
    # Criar
    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref", apito_doc="123", apito_tel="123"))
    assert arb.apito_nome == "Ref"
    db.add.assert_called()
    
    # Listar
    db.query().offset().limit().all.return_value = [arb]
    assert serv_arbitros.listar_arbitros(db) == [arb]
    
    db.query().filter().first.return_value = arb
    assert serv_arbitros.listar_arbitro_id(db, 1) == arb
    
    # Atualizar
    res = serv_arbitros.atualizar_arbitro(db, 1, schemas.ArbitroCreate(apito_nome="Ref Alt", apito_doc="1", apito_tel="1"))
    assert res.apito_nome == "Ref Alt"
    
    # Atualizar inexistente
    db.query().filter().first.return_value = None
    assert serv_arbitros.atualizar_arbitro(db, 999, schemas.ArbitroCreate(apito_nome="A", apito_doc="d", apito_tel="t")) is None
    
    # Excluir
    db.query().filter().first.return_value = arb
    assert serv_arbitros.excluir_arbitro(db, 1) is True
    db.delete.assert_called_with(arb)
    
    db.query().filter().first.return_value = None
    assert serv_arbitros.excluir_arbitro(db, 999) is False


# ==================== 6. ATLETAS SERVICE ====================

def test_atletas_crud_unitario():
    db = MagicMock()
    
    # Criar
    atl = serv_atletas.criar_atleta(db, schemas.AtletaCreate(nome_completo="Atl", data_nascimento=date(2005,1,1), documento_pessoal="123", contato="123", endereco="R"))
    assert atl.nome_completo == "Atl"
    db.add.assert_called()
    
    # Listar
    db.query().offset().limit().all.return_value = [atl]
    assert serv_atletas.listar_atletas(db) == [atl]
    
    db.query().filter().first.return_value = atl
    assert serv_atletas.listar_atleta(db, 1) == atl
    
    # Atualizar
    res = serv_atletas.atualizar_atleta(db, 1, schemas.AtletaUpdate(nome_completo="Atl Alt"))
    assert res.nome_completo == "Atl Alt"
    
    # Atualizar inexistente
    db.query().filter().first.return_value = None
    assert serv_atletas.atualizar_atleta(db, 999, schemas.AtletaUpdate()) is None
    
    # Excluir
    db.query().filter().first.return_value = atl
    assert serv_atletas.excluir_atleta(db, 1) is True
    db.delete.assert_called_with(atl)
    
    db.query().filter().first.return_value = None
    assert serv_atletas.excluir_atleta(db, 999) is False


# ==================== 9. LOCAIS SERVICE ====================

def test_locais_crud_unitario():
    db = MagicMock()
    
    # Criar
    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Local 1", loca_descricao="d", ativo=True))
    assert loc.loca_nome == "Local 1"
    
    # Listar
    db.query().offset().limit().all.return_value = [loc]
    assert serv_locais.listar_locais(db) == [loc]
    
    db.query().filter().first.return_value = loc
    assert serv_locais.listar_local_id(db, 1) == loc
    
    # Atualizar
    res = serv_locais.atualizar_local(db, 1, schemas.LocalCreate(loca_nome="Local Alt", loca_descricao="d", ativo=True))
    assert res.loca_nome == "Local Alt"
    
    db.query().filter().first.return_value = None
    assert serv_locais.atualizar_local(db, 999, schemas.LocalCreate(loca_nome="A", loca_descricao="d", ativo=True)) is None
    
    # Excluir
    db.query().filter().first.return_value = loc
    assert serv_locais.excluir_local(db, 1) is True
    
    db.query().filter().first.return_value = None
    assert serv_locais.excluir_local(db, 999) is False


# ==================== 10. MODALIDADES SERVICE ====================

def test_modalidades_crud_unitario():
    db = MagicMock()
    
    # Criar
    m = serv_mod.criar_modalidade(db, schemas.ModalidadeCreate(nome="Mod 1", descricao="d"))
    assert m.nome == "Mod 1"
    
    # Listar
    db.query().offset().limit().all.return_value = [m]
    assert serv_mod.listar_modalidades(db) == [m]
    
    db.query().filter().first.return_value = m
    assert serv_mod.listar_modalidade(db, 1) == m
    assert serv_mod.listar_modalidade_nome(db, "Mod 1") == m
    
    # Atualizar
    res = serv_mod.atualizar_modalidade(db, 1, schemas.ModalidadeUpdate(nome="Mod Alt"))
    assert res.nome == "Mod Alt"
    
    db.query().filter().first.return_value = None
    assert serv_mod.atualizar_modalidade(db, 999, schemas.ModalidadeUpdate()) is None

def test_excluir_modalidade_conflito_unitario():
    db = MagicMock()
    m = create_mock_model(models.Modalidade, id_modalidade=1)
    db.query().filter().first.return_value = m
    
    # Caso 1: Com turmas vinculadas (erro)
    m.turmas = [create_mock_model(models.Turma, id_turma=1)]
    with pytest.raises(ValueError, match="possui turmas vinculadas"):
        serv_mod.excluir_modalidade(db, 1)
        
    # Caso 2: Sem turmas vinculadas (sucesso)
    m.turmas = []
    assert serv_mod.excluir_modalidade(db, 1) == m
    db.delete.assert_called_with(m)
    
    # Caso 3: Inexistente
    db.query().filter().first.return_value = None
    assert serv_mod.excluir_modalidade(db, 999) is None


# ==================== 11. PRESENCAS SERVICE ====================

def test_registrar_presenca_lote_unitario():
    db = MagicMock()
    
    m = create_mock_model(models.Matricula, id_matricula=1, ativo=True)
    db.query().filter().all.return_value = [m]
    db.query().filter().first.return_value = None # no existing presenca
    
    lote = schemas.ListaPresenca(
        id_turma=5,
        data_aula=date.today(),
        presencas=[schemas.PresencaItem(id_matricula=1, status="Presente", observacao="")]
    )
    
    res = serv_pres.registrar_presenca_lote(db, lote)
    assert len(res) == 1
    assert res[0].status == "Presente"

def test_registrar_presenca_lote_invalido_unitario():
    db = MagicMock()
    db.query().filter().all.return_value = [] # no valid matriculas
    
    lote = schemas.ListaPresenca(
        id_turma=5,
        data_aula=date.today(),
        presencas=[schemas.PresencaItem(id_matricula=999, status="Presente", observacao="")]
    )
    with pytest.raises(ValueError, match="é inválida, inativa"):
        serv_pres.registrar_presenca_lote(db, lote)

def test_listar_presencas_turma_data_unitario():
    db = MagicMock()
    p = create_mock_model(models.Presenca, id_presenca=1)
    m = create_mock_model(models.Matricula, id_matricula=1, ativo=True)
    
    def mock_query(model):
        q = MagicMock()
        if model == models.Matricula:
            q.filter().all.return_value = [m]
        elif model == models.Presenca:
            q.filter().all.return_value = [p]
        return q
        
    db.query.side_effect = mock_query
    
    assert serv_pres.listar_presencas_turma_data(db, 5, date.today()) == [p]


def test_verificar_conflito_aluno_turma_nao_encontrada_unitario():
    db = MagicMock()
    with patch('services.turmas.listar_turma_id', return_value=None):
        res = serv_matriculas.verificar_conflito_aluno(db, 1, 99)
        assert res is False

def test_registrar_presenca_lote_unitario():
    db = MagicMock()
    mat_valida = create_mock_model(models.Matricula, id_matricula=1)
    pres_exist = create_mock_model(models.Presenca, id_presenca=1, status='Falta')
    
    def mock_filter_pres(*args, **kwargs):
        q = MagicMock()
        if 'id_matricula' in str(args[0]):
            q.first.return_value = pres_exist
        else:
            q.all.return_value = [mat_valida]
        return q
    db.query().filter.side_effect = mock_filter_pres
    
    lista = schemas.ListaPresenca(id_turma=1, data_aula=date(2023,1,1), presencas=[schemas.PresencaItem(id_matricula=1, status='Presente')])
    res = serv_pres.registrar_presenca_lote(db, lista)
    
    assert res[0].status == 'Presente'
    assert db.commit.called

def test_listar_presencas_sem_alunos_unitario():
    db = MagicMock()
    db.query().filter().all.return_value = []
    res = serv_pres.listar_presencas_turma_data(db, 1, date(2023,1,1))
    assert res == []

def test_registrar_presenca_matricula_invalida_unitario():
    db = MagicMock()
    db.query().filter().all.return_value = []
    
    lista = schemas.ListaPresenca(id_turma=1, data_aula=date(2023,1,1), presencas=[schemas.PresencaItem(id_matricula=99, status='Presente')])
    with pytest.raises(ValueError, match='inválida'):
        serv_pres.registrar_presenca_lote(db, lista)
