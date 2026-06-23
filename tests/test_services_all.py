import pytest
from datetime import date, time, datetime, timedelta
from unittest.mock import patch, MagicMock
import models
import schemas
from services import (
    professores as serv_prof,
    turmas as serv_turmas,
    alunos as serv_alunos,
    matriculas as serv_matriculas,
    arbitros as serv_arbitros,
    atletas as serv_atletas,
    equipes as serv_equipes,
    eventos as serv_eventos,
    locais as serv_locais,
    modalidades as serv_mod,
    presencas as serv_pres,
    edicoes as serv_edic,
    partidas as serv_partidas
)

# ----------------- Helper Fixtures/Data -----------------

def create_mock_mod(db, nome="Futebol"):
    m = models.Modalidade(nome=nome, duracao_minutos=60, descricao="Esporte")
    db.add(m)
    db.commit()
    return m

def create_mock_prof(db, username="prof_user", cpf="111.111.111-11"):
    user = models.Usuario(username=username, password_hash="hash", role="professor")
    db.add(user)
    db.flush()
    prof = models.Professor(id_usuario=user.id_usuario, nome="Prof", cpf=cpf, contato="123456")
    db.add(prof)
    db.commit()
    return prof

# ----------------- 1. PROFESSORES SERVICE -----------------

def test_professores_crud(db):
    # Criar
    prof_in = schemas.ProfessorCreate(
        username="new_prof",
        password="password123", # pelo menos 6 caracteres
        nome="Novo Professor",
        cpf="12345678909",
        contato="123"
    )
    p = serv_prof.criar_professor(db, prof_in)
    assert p.nome == "Novo Professor"
    assert p.senha_temporaria == ""

    # Listar/buscar
    assert serv_prof.listar_professor(db, p.id_professor).id_professor == p.id_professor
    assert len(serv_prof.listar_professores(db)) > 0
    assert serv_prof.listar_professor_cpf(db, "12345678909").id_professor == p.id_professor

    # Atualizar
    up = schemas.ProfessorUpdate(nome="Prof Alt")
    p_alt = serv_prof.atualizar_professor(db, p.id_professor, up)
    assert p_alt.nome == "Prof Alt"
    assert serv_prof.atualizar_professor(db, 9999, up) is None

    # Excluir
    assert serv_prof.excluir_professor(db, p.id_professor) is True
    assert serv_prof.excluir_professor(db, 9999) is False

def test_excluir_professor_com_turma(db):
    mod = create_mock_mod(db)
    prof = create_mock_prof(db)
    turma = models.Turma(
        id_modalidade=mod.id_modalidade,
        id_professor=prof.id_professor,
        categoria_idade="Sub 15",
        horario_inicio=time(10, 0),
        horario_fim=time(11, 0)
    )
    db.add(turma)
    db.commit()

    with pytest.raises(ValueError) as exc:
        serv_prof.excluir_professor(db, prof.id_professor)
    assert "Não é possível excluir o professor" in str(exc.value)

# ----------------- 2. TURMAS SERVICE -----------------

def test_dias_semana_str():
    assert serv_turmas.dias_semana_str(None) is None
    assert serv_turmas.dias_semana_str([]) is None
    assert serv_turmas.dias_semana_str(["SEG", "TER"]) == "SEG,TER"
    
    class MockEnum:
        def __init__(self, val):
            self.value = val
    assert serv_turmas.dias_semana_str([MockEnum("SEG")]) == "SEG"

def test_checar_conflito_agenda():
    # Sem dias selecionados
    assert serv_turmas.checar_conflito_agenda([], time(10, 0), time(11, 0), []) is False

    # Mock turmas a comparar
    class MockTurma:
        def __init__(self, dias, inicio, fim, id_turma=1):
            self.id_turma = id_turma
            self.dias_semana = dias
            self.horario_inicio = inicio
            self.horario_fim = fim

    turmas = [
        MockTurma("SEG,TER", time(10, 0), time(11, 0), id_turma=1),
        MockTurma(["SEG", "QUA"], time(14, 0), time(15, 0), id_turma=2),
        MockTurma(None, time(14, 0), time(15, 0), id_turma=3)
    ]

    # Sem conflito (dia diferente)
    assert serv_turmas.checar_conflito_agenda(["QUI"], time(10, 0), time(11, 0), turmas) is False
    # Sem conflito (horário diferente)
    assert serv_turmas.checar_conflito_agenda(["SEG"], time(11, 0), time(12, 0), turmas) is False
    # Com conflito (dia e horário coincidem)
    assert serv_turmas.checar_conflito_agenda(["SEG"], time(10, 30), time(11, 30), turmas) is True
    # Ignorar ID
    assert serv_turmas.checar_conflito_agenda(["SEG"], time(10, 30), time(11, 30), turmas, id_turma_ignorar=1) is False

def test_criar_turma_e_conflitos(db):
    mod = create_mock_mod(db)
    prof = create_mock_prof(db)

    # Início >= Fim
    with pytest.raises(ValueError) as exc:
        serv_turmas.criar_turma(db, schemas.TurmaCreate(
            id_modalidade=mod.id_modalidade,
            id_professor=prof.id_professor,
            horario_inicio=time(11, 0),
            horario_fim=time(10, 0),
            dias_semana=["SEG"],
            categoria_idade="Sub 15"
        ))
    assert "anterior ao horário" in str(exc.value)

    # Criar válida
    t = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=mod.id_modalidade,
        id_professor=prof.id_professor,
        horario_inicio=time(10, 0),
        horario_fim=time(11, 0),
        dias_semana=["SEG"],
        categoria_idade="Sub 15"
    ))
    assert t.categoria_idade == "Sub 15"

    # Conflito ao criar
    with pytest.raises(ValueError) as exc:
        serv_turmas.criar_turma(db, schemas.TurmaCreate(
            id_modalidade=mod.id_modalidade,
            id_professor=prof.id_professor,
            horario_inicio=time(10, 30),
            horario_fim=time(11, 30),
            dias_semana=["SEG"],
            categoria_idade="Sub 15"
        ))
    assert "Conflito de horário" in str(exc.value)

def test_atualizar_excluir_turma(db):
    mod = create_mock_mod(db)
    prof = create_mock_prof(db)
    t = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=mod.id_modalidade,
        id_professor=prof.id_professor,
        horario_inicio=time(10, 0),
        horario_fim=time(11, 0),
        dias_semana=["SEG"],
        categoria_idade="Sub 15"
    ))

    # Atualizar inexistente
    assert serv_turmas.atualizar_turma(db, 9999, schemas.TurmaUpdate()) is None

    # Atualizar horário inválido
    with pytest.raises(ValueError) as exc:
        serv_turmas.atualizar_turma(db, t.id_turma, schemas.TurmaUpdate(horario_inicio=time(12, 0), horario_fim=time(10, 0)))
    assert "anterior ao horário" in str(exc.value)

    # Atualizar com conflito
    prof2 = create_mock_prof(db, "prof_conflito", "222.222.222-22")
    t2 = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=mod.id_modalidade,
        id_professor=prof2.id_professor,
        horario_inicio=time(14, 0),
        horario_fim=time(15, 0),
        dias_semana=["SEG"],
        categoria_idade="Sub 15"
    ))
    # Tentar mudar professor de t2 para prof (que tem aula 10-11) e colocar horário 10:30
    with pytest.raises(ValueError) as exc:
        serv_turmas.atualizar_turma(db, t2.id_turma, schemas.TurmaUpdate(id_professor=prof.id_professor, horario_inicio=time(10, 30), horario_fim=time(11, 30)))
    assert "Conflito de horário na atualização" in str(exc.value)

    # Atualizar válida
    t_alt = serv_turmas.atualizar_turma(db, t.id_turma, schemas.TurmaUpdate(categoria_idade="Sub 17", dias_semana=["TER"]))
    assert t_alt.categoria_idade == "Sub 17"
    assert t_alt.dias_semana == ["TER"]

    # Listar turmas
    assert len(serv_turmas.listar_turmas(db)) > 0
    assert len(serv_turmas.listar_turmas_professor(db, prof.id_professor)) > 0
    assert len(serv_turmas.listar_turmas_modalidade(db, mod.id_modalidade)) > 0

    # Excluir
    # Criar uma matrícula para ver cascading
    part = models.Participante(tipo="aluno")
    db.add(part)
    db.flush()
    aluno = models.Aluno(id_participante=part.id_participante, nome_completo="Aluno T", data_nascimento=date(2010, 1, 1), escola="Esc", serie_ano="9", endereco="Rua", telefone_1="123")
    db.add(aluno)
    db.flush()
    mat = models.Matricula(id_aluno=aluno.id_aluno, id_turma=t.id_turma)
    db.add(mat)
    db.flush()
    pres = models.Presenca(id_matricula=mat.id_matricula, data_aula=date.today(), status="Presente")
    db.add(pres)
    db.commit()

    assert serv_turmas.excluir_turma(db, t.id_turma) is True
    assert serv_turmas.excluir_turma(db, 9999) is False

# ----------------- 3. ALUNOS SERVICE -----------------

def test_alunos_crud_and_conflitos(db):
    mod = create_mock_mod(db)
    prof1 = create_mock_prof(db, "prof_a", "111.111.111-11")
    prof2 = create_mock_prof(db, "prof_b", "222.222.222-22")
    # Criar turmas para professores diferentes para que ambas existam
    t1 = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=mod.id_modalidade,
        id_professor=prof1.id_professor,
        horario_inicio=time(10, 0),
        horario_fim=time(11, 0),
        dias_semana=["SEG"],
        categoria_idade="Sub 15"
    ))
    t2 = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=mod.id_modalidade,
        id_professor=prof2.id_professor,
        horario_inicio=time(10, 30),
        horario_fim=time(11, 30),
        dias_semana=["SEG"],
        categoria_idade="Sub 15"
    ))

    aluno_in = schemas.AlunoCreate(
        nome_completo="João",
        data_nascimento=date(2010, 5, 10),
        escola="Municipal",
        serie_ano="9º",
        endereco="Rua A",
        telefone_1="123",
        ids_turmas=[]
    )

    # Cadastro válido
    a = serv_alunos.cadastrar_aluno(db, aluno_in)
    assert a.nome_completo == "João"

    # Duplicado
    with pytest.raises(ValueError) as exc:
        serv_alunos.cadastrar_aluno(db, aluno_in)
    assert "Já existe um aluno cadastrado" in str(exc.value)

    # Conflito entre turmas informadas no cadastro do aluno
    aluno_in2 = schemas.AlunoCreate(
        nome_completo="José",
        data_nascimento=date(2010, 5, 10),
        escola="Municipal",
        serie_ano="9º",
        endereco="Rua A",
        telefone_1="123",
        ids_turmas=[t1.id_turma, t2.id_turma] # passamos como lista
    )
    with pytest.raises(ValueError) as exc:
        serv_alunos.cadastrar_aluno(db, aluno_in2)
    assert "Conflito de horário detectado" in str(exc.value)

    # Aluno já possui matrícula em conflito
    # Vamos cadastrar José na turma 1 apenas
    aluno_in3 = schemas.AlunoCreate(
        nome_completo="José",
        data_nascimento=date(2010, 5, 10),
        escola="Municipal",
        serie_ano="9º",
        endereco="Rua A",
        telefone_1="123",
        ids_turmas=[t1.id_turma]
    )
    a3 = serv_alunos.cadastrar_aluno(db, aluno_in3)
    
    # Agora tentamos matricular o aluno a3 na turma 2 via serv_matriculas, o que deve levantar ValueError por conflito de horário
    with pytest.raises(ValueError) as exc:
        serv_matriculas.criar_matricula(db, schemas.MatriculaCreate(id_aluno=a3.id_aluno, id_turma=t2.id_turma))
    assert "Conflito de horário" in str(exc.value)

    # Atualizar
    assert serv_alunos.atualizar_aluno(db, 9999, schemas.AlunoUpdate()) is None
    a_alt = serv_alunos.atualizar_aluno(
        db, 
        a3.id_aluno, 
        schemas.AlunoUpdate(nome_completo="José Silva"),
        foto="foto.jpg",
        documento="doc.pdf",
        atestado="atest.pdf"
    )
    assert a_alt.nome_completo == "José Silva"
    assert a_alt.foto == "foto.jpg"

    # Listagem
    assert serv_alunos.listar_aluno(db, a3.id_aluno).id_aluno == a3.id_aluno
    assert len(serv_alunos.listar_alunos(db)) > 0
    assert len(serv_alunos.listar_alunos_por_turma(db, t1.id_turma)) > 0
    assert len(serv_alunos.listar_alunos_nome(db, "José")) > 0
    assert len(serv_alunos.listar_alunos_escola(db, "Municipal")) > 0
    assert len(serv_alunos.listar_alunos_serie(db, "9º")) > 0

    # Excluir
    assert serv_alunos.excluir_aluno(db, a3.id_aluno) is True
    assert serv_alunos.excluir_aluno(db, 9999) is False

# ----------------- 4. MATRICULAS SERVICE -----------------

def test_matriculas_crud(db):
    mod = create_mock_mod(db)
    prof = create_mock_prof(db)
    t = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=mod.id_modalidade,
        id_professor=prof.id_professor,
        horario_inicio=time(10, 0),
        horario_fim=time(11, 0),
        dias_semana=["SEG"],
        categoria_idade="Sub 15"
    ))
    a = serv_alunos.cadastrar_aluno(db, schemas.AlunoCreate(
        nome_completo="Al", data_nascimento=date(2010, 1, 1), escola="Esc", serie_ano="9", endereco="Rua", telefone_1="1", ids_turmas=[]
    ))

    # Criar
    m = serv_matriculas.criar_matricula(db, schemas.MatriculaCreate(id_aluno=a.id_aluno, id_turma=t.id_turma))
    assert m.id_aluno == a.id_aluno
    
    # Verificar conflito aluno com turma inexistente
    assert serv_matriculas.verificar_conflito_aluno(db, a.id_aluno, 9999) is False

    # Listar
    assert len(serv_matriculas.listar_matriculas(db)) > 0
    assert len(serv_matriculas.listar_matriculas_turma(db, t.id_turma)) > 0
    assert len(serv_matriculas.listar_matriculas_aluno(db, a.id_aluno)) > 0
    assert serv_matriculas.verificar_matricula(db, a.id_aluno, t.id_turma) is not None

    # Cancelar
    assert serv_matriculas.cancelar_matricula(db, m.id_matricula) is True
    assert serv_matriculas.cancelar_matricula(db, 9999) is False

# ----------------- 5. ARBITROS SERVICE -----------------

def test_arbitros_crud(db):
    # Criar
    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref", apito_doc="doc", apito_tel="tel"))
    assert arb.apito_nome == "Ref"

    # Listar
    assert len(serv_arbitros.listar_arbitros(db)) > 0
    assert serv_arbitros.listar_arbitro_id(db, arb.id_arbitro).id_arbitro == arb.id_arbitro

    # Atualizar
    assert serv_arbitros.atualizar_arbitro(db, 9999, schemas.ArbitroCreate(apito_nome="A", apito_doc="d", apito_tel="t")) is None
    arb_alt = serv_arbitros.atualizar_arbitro(db, arb.id_arbitro, schemas.ArbitroCreate(apito_nome="Ref Alt", apito_doc="doc", apito_tel="tel"))
    assert arb_alt.apito_nome == "Ref Alt"

    # Excluir
    assert serv_arbitros.excluir_arbitro(db, arb.id_arbitro) is True
    assert serv_arbitros.excluir_arbitro(db, 9999) is False

# ----------------- 6. ATLETAS SERVICE -----------------

def test_atletas_crud(db):
    # Criar
    atl = serv_atletas.criar_atleta(db, schemas.AtletaCreate(nome_completo="Atl", data_nascimento=date(2005, 5, 5), documento_pessoal="123", contato="123", endereco="Rua"))
    assert atl.nome_completo == "Atl"

    # Listar
    assert len(serv_atletas.listar_atletas(db)) > 0
    assert serv_atletas.listar_atleta(db, atl.id_atleta).id_atleta == atl.id_atleta

    # Atualizar
    assert serv_atletas.atualizar_atleta(db, 9999, schemas.AtletaUpdate()) is None
    atl_alt = serv_atletas.atualizar_atleta(db, atl.id_atleta, schemas.AtletaUpdate(nome_completo="Atl Alt"))
    assert atl_alt.nome_completo == "Atl Alt"

    # Criar atleta equipe com equipe inexistente
    with pytest.raises(ValueError) as exc:
        serv_atletas.criar_atleta_equipe(db, schemas.AtletaCreate(nome_completo="Atl E", data_nascimento=date(2005, 5, 5), documento_pessoal="1234", contato="1", endereco="R"), 9999)
    assert "Equipe não encontrada" in str(exc.value)

    # Excluir
    assert serv_atletas.excluir_atleta(db, atl.id_atleta) is True
    assert serv_atletas.excluir_atleta(db, 9999) is False

# ----------------- 7. EQUIPES SERVICE -----------------

def test_equipes_crud(db):
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Evt", descricao="d"))
    ed = evt.edicoes[0]

    # Criar
    eq = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq A", id_edicao=ed.id_edicao))
    assert eq.nome == "Eq A"

    # Listar
    assert len(serv_equipes.listar_equipes(db)) > 0
    assert len(serv_equipes.listar_equipes_edicao(db, ed.id_edicao)) > 0
    assert serv_equipes.listar_equipe(db, eq.id_equipe).id_equipe == eq.id_equipe

    # Atualizar
    assert serv_equipes.atualizar_equipe(db, 9999, schemas.EquipeUpdate()) is None
    eq_alt = serv_equipes.atualizar_equipe(db, eq.id_equipe, schemas.EquipeUpdate(nome="Eq Alt"))
    assert eq_alt.nome == "Eq Alt"

    # Adicionar participante
    part = models.Participante(tipo="atleta")
    db.add(part)
    db.commit()
    assert serv_equipes.adicionar_participante_equipe(db, eq.id_equipe, part.id_participante) is True
    # Adicionar duplicado
    assert serv_equipes.adicionar_participante_equipe(db, eq.id_equipe, part.id_participante) is True
    # Inexistentes
    assert serv_equipes.adicionar_participante_equipe(db, 9999, part.id_participante) is False
    assert serv_equipes.adicionar_participante_equipe(db, eq.id_equipe, 9999) is False

    # Excluir
    assert serv_equipes.excluir_equipe(db, eq.id_equipe) is True
    assert serv_equipes.excluir_equipe(db, 9999) is False

# ----------------- 8. EVENTOS SERVICE -----------------

def test_eventos_crud(db):
    mod = create_mock_mod(db)

    # Criar com modalidade
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa", descricao="d", modalidade_ids=[mod.id_modalidade]))
    assert evt.even_nome == "Copa"
    assert len(evt.modalidades) == 1
    assert len(evt.edicoes) == 1 # auto edicao

    # Listar
    assert len(serv_eventos.listar_eventos(db)) > 0
    assert serv_eventos.listar_evento(db, evt.id_evento).id_evento == evt.id_evento

    # Atualizar
    assert serv_eventos.atualizar_evento(db, 9999, schemas.EventoUpdate(even_nome="A")) is None
    evt_alt = serv_eventos.atualizar_evento(db, evt.id_evento, schemas.EventoUpdate(even_nome="Super Copa", modalidade_ids=[]))
    assert evt_alt.even_nome == "Super Copa"
    assert len(evt_alt.modalidades) == 0

    # Excluir
    assert serv_eventos.excluir_evento(db, evt.id_evento) is True
    assert serv_eventos.excluir_evento(db, 9999) is False

# ----------------- 9. LOCAIS SERVICE -----------------

def test_locais_crud(db):
    # Criar
    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena", loca_descricao="d", ativo=True))
    assert loc.loca_nome == "Arena"

    # Listar
    assert len(serv_locais.listar_locais(db)) > 0
    assert serv_locais.listar_local_id(db, loc.id_local).id_local == loc.id_local

    # Atualizar
    assert serv_locais.atualizar_local(db, 9999, schemas.LocalCreate(loca_nome="A", loca_descricao="d", ativo=True)) is None
    loc_alt = serv_locais.atualizar_local(db, loc.id_local, schemas.LocalCreate(loca_nome="Arena Alt", loca_descricao="d", ativo=True))
    assert loc_alt.loca_nome == "Arena Alt"

    # Excluir
    assert serv_locais.excluir_local(db, loc.id_local) is True
    assert serv_locais.excluir_local(db, 9999) is False

# ----------------- 10. MODALIDADES SERVICE -----------------

def test_modalidades_crud(db):
    # Criar
    m = serv_mod.criar_modalidade(db, schemas.ModalidadeCreate(nome="Volei", descricao="d"))
    assert m.nome == "Volei"

    # Listar
    assert len(serv_mod.listar_modalidades(db)) > 0
    assert serv_mod.listar_modalidade(db, m.id_modalidade).id_modalidade == m.id_modalidade
    assert serv_mod.listar_modalidade_nome(db, "Volei").id_modalidade == m.id_modalidade

    # Atualizar
    assert serv_mod.atualizar_modalidade(db, 9999, schemas.ModalidadeUpdate()) is None
    m_alt = serv_mod.atualizar_modalidade(db, m.id_modalidade, schemas.ModalidadeUpdate(nome="Volei Alt"))
    assert m_alt.nome == "Volei Alt"

    # Excluir com turmas
    prof = create_mock_prof(db, "prof_mod", "333.333.333-33")
    turma = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=m.id_modalidade, id_professor=prof.id_professor, horario_inicio=time(10,0), horario_fim=time(11,0), dias_semana=["SEG"], categoria_idade="Sub 15"
    ))
    with pytest.raises(ValueError) as exc:
        serv_mod.excluir_modalidade(db, m.id_modalidade)
    assert "possui turmas vinculadas" in str(exc.value)

    # Excluir válida
    serv_turmas.excluir_turma(db, turma.id_turma)
    assert serv_mod.excluir_modalidade(db, m.id_modalidade).id_modalidade == m.id_modalidade
    assert serv_mod.excluir_modalidade(db, 9999) is None

# ----------------- 11. PRESENCAS SERVICE -----------------

def test_presencas_crud(db):
    mod = create_mock_mod(db)
    prof = create_mock_prof(db)
    t = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=mod.id_modalidade, id_professor=prof.id_professor, horario_inicio=time(10,0), horario_fim=time(11,0), dias_semana=["SEG"], categoria_idade="Sub 15"
    ))
    a = serv_alunos.cadastrar_aluno(db, schemas.AlunoCreate(
        nome_completo="Aluno P", data_nascimento=date(2010, 1, 1), escola="Esc", serie_ano="9", endereco="Rua", telefone_1="1", ids_turmas=[]
    ))
    m = serv_matriculas.criar_matricula(db, schemas.MatriculaCreate(id_aluno=a.id_aluno, id_turma=t.id_turma))

    # Registrar lote
    lote = schemas.ListaPresenca(
        id_turma=t.id_turma,
        data_aula=date.today(),
        presencas=[schemas.PresencaItem(id_matricula=m.id_matricula, status="Presente", observacao="Nenhuma")]
    )
    reg = serv_pres.registrar_presenca_lote(db, lote)
    assert len(reg) == 1
    assert reg[0].status == "Presente"

    # Atualizar lote existente
    lote.presencas[0].status = "Ausente"
    reg2 = serv_pres.registrar_presenca_lote(db, lote)
    assert reg2[0].status == "Ausente"

    # Matrícula inválida
    lote_invalido = schemas.ListaPresenca(
        id_turma=t.id_turma,
        data_aula=date.today(),
        presencas=[schemas.PresencaItem(id_matricula=9999, status="Presente", observacao="")]
    )
    with pytest.raises(ValueError) as exc:
        serv_pres.registrar_presenca_lote(db, lote_invalido)
    assert "é inválida, inativa" in str(exc.value)

    # Listar presenças
    assert len(serv_pres.listar_presencas_turma_data(db, t.id_turma, date.today())) > 0
    assert len(serv_pres.listar_presencas_turma_data(db, 9999, date.today())) == 0

# ----------------- 12. EDICOES SERVICE -----------------

def test_edicoes_crud(db):
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa E", descricao="d"))
    
    # Criar
    ed_in = schemas.EdicaoCreate(
        id_evento=evt.id_evento,
        edic_ano=2026,
        tipo_competicao="Mata-Mata",
        fase_inicial="Semifinal",
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 3, 1)
    )
    ed = serv_edic.criar_edicao(db, ed_in)
    assert ed.edic_ano == 2026

    # Listar
    assert len(serv_edic.listar_edicoes(db)) > 0
    assert serv_edic.listar_edicao_id(db, ed.id_edicao).id_edicao == ed.id_edicao

    # Atualizar
    assert serv_edic.atualizar_edicao(db, 9999, ed_in) is None
    ed_alt = serv_edic.atualizar_edicao(db, ed.id_edicao, schemas.EdicaoCreate(
        id_evento=evt.id_evento, edic_ano=2027, tipo_competicao="Pontos Corridos", data_inicio=date(2027,1,1), data_fim=date(2027,3,1)
    ))
    assert ed_alt.edic_ano == 2027

    # Clonar equipes
    eq = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq E", id_edicao=ed.id_edicao))
    part = models.Participante(tipo="atleta")
    db.add(part)
    db.commit()
    serv_equipes.adicionar_participante_equipe(db, eq.id_equipe, part.id_participante)

    novas = serv_edic.clonar_equipes(db, ed.id_edicao, evt.edicoes[0].id_edicao)
    assert len(novas) == 1
    assert novas[0].nome == "Eq E"
    assert len(novas[0].participantes) == 1

    # Excluir
    assert serv_edic.excluir_edicao(db, ed.id_edicao) is True
    assert serv_edic.excluir_edicao(db, 9999) is False

def test_gerar_confrontos_pontos_corridos_errors(db):
    mod = create_mock_mod(db)
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa PC", descricao="d"))
    ed = evt.edicoes[0]

    # Inexistente
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_pontos_corridos(db, 9999, mod.id_modalidade, date.today())
    assert "Edição não encontrada" in str(exc.value)

    # <2 equipes
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_pontos_corridos(db, ed.id_edicao, mod.id_modalidade, date.today())
    assert "pelo menos 2 equipes" in str(exc.value)

    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 1", id_edicao=ed.id_edicao))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 2", id_edicao=ed.id_edicao))

    # Sem local ativo
    db.query(models.Local).delete()
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_pontos_corridos(db, ed.id_edicao, mod.id_modalidade, date.today())
    assert "Nenhum local ativo" in str(exc.value)

    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena PC", loca_descricao="d", ativo=True))

    # Sem árbitro
    db.query(models.Arbitro).delete()
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_pontos_corridos(db, ed.id_edicao, mod.id_modalidade, date.today())
    assert "Nenhum árbitro" in str(exc.value)

    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref PC", apito_doc="doc", apito_tel="1"))

    # Sucesso pontos corridos (ímpar/par)
    partidas = serv_edic.gerar_confrontos_pontos_corridos(db, ed.id_edicao, mod.id_modalidade, date.today())
    assert len(partidas) == 1 # 2 equipes -> 1 rodada, 1 jogo

    # Já existem partidas em andamento/finalizadas
    partidas[0].status = "Finalizada"
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_pontos_corridos(db, ed.id_edicao, mod.id_modalidade, date.today())
    assert "porque já existem partidas" in str(exc.value)

def test_gerar_confrontos_mata_mata_and_groups_errors(db):
    mod = create_mock_mod(db)
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa MM", descricao="d"))
    ed = evt.edicoes[0]
    ed.tipo_competicao = "Mata-Mata"
    ed.fase_inicial = "Semifinal"
    db.commit()

    # Inexistente
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_mata_mata(db, 9999, mod.id_modalidade, "Semifinal", date.today())
    assert "Edição não encontrada" in str(exc.value)

    # Sem equipes
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_mata_mata(db, ed.id_edicao, mod.id_modalidade, "Semifinal", date.today())
    assert "equipes registradas" in str(exc.value)

    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 1", id_edicao=ed.id_edicao))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 2", id_edicao=ed.id_edicao))

    # Fase inválida
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_mata_mata(db, ed.id_edicao, mod.id_modalidade, "Invalida", date.today())
    assert "Fase inicial inválida" in str(exc.value)

    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena MM", loca_descricao="d", ativo=True))
    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref MM", apito_doc="doc", apito_tel="1"))

    # Sucesso Mata-Mata
    partidas = serv_edic.gerar_confrontos_mata_mata(db, ed.id_edicao, mod.id_modalidade, "Semifinal", date.today())
    assert len(partidas) == 3 # Semifinal (2) + Final (1)

    # Erros de Grupos
    ed.tipo_competicao = "Grupos"
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_grupos(db, ed.id_edicao, mod.id_modalidade)
    assert "pelo menos 4 equipes" in str(exc.value)

    # Adicionar mais equipes para fechar 4
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 3", id_edicao=ed.id_edicao))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 4", id_edicao=ed.id_edicao))

    # Sucesso Grupos
    partidas_g = serv_edic.gerar_confrontos_grupos(db, ed.id_edicao, mod.id_modalidade)
    assert len(partidas_g) > 0

    # Teste wrapper gerar_confrontos_edicao
    # Inexistente
    with pytest.raises(ValueError):
        serv_edic.gerar_confrontos_edicao(db, 9999, mod.id_modalidade)
    # Sucesso Pontos Corridos
    ed.tipo_competicao = "Pontos Corridos"
    db.commit()
    assert len(serv_edic.gerar_confrontos_edicao(db, ed.id_edicao, mod.id_modalidade)) > 0

    # Sucesso Mata-Mata
    ed.tipo_competicao = "Mata-Mata"
    ed.fase_inicial = "Semifinal"
    db.commit()
    assert len(serv_edic.gerar_confrontos_edicao(db, ed.id_edicao, mod.id_modalidade)) > 0

    # Mata-Mata sem fase inicial
    ed.fase_inicial = None
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_edicao(db, ed.id_edicao, mod.id_modalidade)
    assert "deve ser definida" in str(exc.value)

    # Sucesso Grupos
    ed.tipo_competicao = "Grupos"
    db.commit()
    assert len(serv_edic.gerar_confrontos_edicao(db, ed.id_edicao, mod.id_modalidade)) > 0

    # Tipo inválido (usando mock/patch para ignorar validação de enum de banco)
    mock_ed = MagicMock(tipo_competicao="Inv", id_edicao=ed.id_edicao)
    with patch("sqlalchemy.orm.Query.first", return_value=mock_ed):
        with pytest.raises(ValueError) as exc:
            serv_edic.gerar_confrontos_edicao(db, ed.id_edicao, mod.id_modalidade)
        assert "Geração automática" in str(exc.value)

# ----------------- 13. PARTIDAS SERVICE -----------------

def test_partidas_crud_and_conflitos(db):
    mod = create_mock_mod(db)
    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena P", loca_descricao="d", ativo=True))
    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref P", apito_doc="doc", apito_tel="1"))
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa P", descricao="d"))
    ed = evt.edicoes[0]

    eq1 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 1", id_edicao=ed.id_edicao))
    eq2 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 2", id_edicao=ed.id_edicao))

    # Criar
    part_in = schemas.PartidaCreate(
        id_edicao=ed.id_edicao,
        id_local=loc.id_local,
        id_arbitro=arb.id_arbitro,
        id_modalidade=mod.id_modalidade,
        id_equipe_casa=eq1.id_equipe,
        id_equipe_visitante=eq2.id_equipe,
        part_data=date.today(),
        part_hora=time(14, 0),
        placar_casa=0,
        placar_visitante=0,
        status="Agendada"
    )
    p = serv_partidas.criar_partida(db, part_in)
    assert p.status == "Agendada"

    # Criar com conflito de local
    part_in2 = schemas.PartidaCreate(
        id_edicao=ed.id_edicao, id_local=loc.id_local, id_arbitro=9999, id_modalidade=mod.id_modalidade,
        part_data=date.today(), part_hora=time(14, 30), status="Agendada"
    )
    with pytest.raises(ValueError) as exc:
        serv_partidas.criar_partida(db, part_in2)
    assert "O local já possui" in str(exc.value)

    # Criar com conflito de árbitro
    loc2 = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena P2", loca_descricao="d", ativo=True))
    part_in3 = schemas.PartidaCreate(
        id_edicao=ed.id_edicao, id_local=loc2.id_local, id_arbitro=arb.id_arbitro, id_modalidade=mod.id_modalidade,
        part_data=date.today(), part_hora=time(14, 30), status="Agendada"
    )
    with pytest.raises(ValueError) as exc:
        serv_partidas.criar_partida(db, part_in3)
    assert "O árbitro já possui" in str(exc.value)

    # Criar com conflito de equipes
    arb2 = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref P2", apito_doc="doc2", apito_tel="1"))
    part_in4 = schemas.PartidaCreate(
        id_edicao=ed.id_edicao, id_local=loc2.id_local, id_arbitro=arb2.id_arbitro, id_modalidade=mod.id_modalidade,
        id_equipe_casa=eq1.id_equipe, part_data=date.today(), part_hora=time(14, 30), status="Agendada"
    )
    with pytest.raises(ValueError) as exc:
        serv_partidas.criar_partida(db, part_in4)
    assert "Uma das equipes" in str(exc.value)

    # Criar com criação inline
    part_in_inline = schemas.PartidaCreate(
        id_edicao=ed.id_edicao,
        id_modalidade=mod.id_modalidade,
        part_data=date.today(),
        part_hora=time(18, 0),
        local_inline=schemas.LocalInline(loca_nome="Arena Inline", loca_descricao="d"),
        arbitro_inline=schemas.ArbitroInline(apito_nome="Ref Inline", apito_doc="doc_inline", apito_tel="1")
    )
    p_inline = serv_partidas.criar_partida(db, part_in_inline)
    assert p_inline.local.loca_nome == "Arena Inline"
    assert p_inline.arbitro.apito_nome == "Ref Inline"

    # Erros de criação inline sem parâmetros
    with pytest.raises(ValueError):
        serv_partidas.criar_partida(db, schemas.PartidaCreate(id_edicao=ed.id_edicao, id_modalidade=mod.id_modalidade, part_data=date.today(), part_hora=time(18, 0)))
    with pytest.raises(ValueError):
        serv_partidas.criar_partida(db, schemas.PartidaCreate(id_edicao=ed.id_edicao, id_local=loc.id_local, id_modalidade=mod.id_modalidade, part_data=date.today(), part_hora=time(18, 0)))

    # Listar
    assert serv_partidas.listar_partida(db, p.id_partida).id_partida == p.id_partida
    assert len(serv_partidas.listar_partidas_edicao(db, ed.id_edicao)) > 0

    # Atualizar inexistente
    assert serv_partidas.atualizar_partida(db, 9999, schemas.PartidaUpdate()) is None

    # Atualizar com conflito
    with pytest.raises(ValueError):
        serv_partidas.atualizar_partida(db, p_inline.id_partida, schemas.PartidaUpdate(part_hora=time(14, 0), id_local=loc.id_local))

    # Excluir
    assert serv_partidas.excluir_partida(db, p_inline.id_partida) is True
    assert serv_partidas.excluir_partida(db, 9999) is False

def test_partidas_mata_mata_vencedor_e_bloqueios(db):
    mod = create_mock_mod(db)
    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena MM P", loca_descricao="d", ativo=True))
    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref MM P", apito_doc="doc", apito_tel="1"))
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa MM P", descricao="d"))
    ed = evt.edicoes[0]

    eq1 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 1", id_edicao=ed.id_edicao))
    eq2 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 2", id_edicao=ed.id_edicao))
    eq3 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 3", id_edicao=ed.id_edicao))
    eq4 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 4", id_edicao=ed.id_edicao))

    # Criar final
    final_match = models.Partida(
        id_edicao=ed.id_edicao, id_local=loc.id_local, id_arbitro=arb.id_arbitro, id_modalidade=mod.id_modalidade,
        part_data=date.today(), part_hora=time(16, 0), status="Agendada", fase="Final"
    )
    db.add(final_match)
    db.flush()

    # Criar semi
    semi_match = models.Partida(
        id_edicao=ed.id_edicao, id_local=loc.id_local, id_arbitro=arb.id_arbitro, id_modalidade=mod.id_modalidade,
        id_equipe_casa=eq1.id_equipe, id_equipe_visitante=eq2.id_equipe, id_proxima_partida=final_match.id_partida,
        part_data=date.today(), part_hora=time(14, 0), status="Agendada", fase="Semifinal"
    )
    db.add(semi_match)
    db.flush()
    db.commit()

    # Finalizar mata-mata empatada -> deve falhar
    with pytest.raises(ValueError) as exc:
        serv_partidas.atualizar_partida(db, semi_match.id_partida, schemas.PartidaUpdate(placar_casa=1, placar_visitante=1, status="Finalizada"))
    assert "não podem terminar empatadas" in str(exc.value)

    # Finalizar com vitória de Eq 1 -> Eq 1 vai para a Final
    serv_partidas.atualizar_partida(db, semi_match.id_partida, schemas.PartidaUpdate(placar_casa=2, placar_visitante=1, status="Finalizada"))
    db.refresh(final_match)
    assert final_match.id_equipe_casa == eq1.id_equipe

    # Alterar vencedor na semi quando final está agendada -> Eq 2 vence
    serv_partidas.atualizar_partida(db, semi_match.id_partida, schemas.PartidaUpdate(placar_casa=0, placar_visitante=3, status="Finalizada"))
    db.refresh(final_match)
    assert final_match.id_equipe_casa == eq2.id_equipe

    # Iniciar a final
    serv_partidas.atualizar_partida(db, final_match.id_partida, schemas.PartidaUpdate(status="Em Andamento"))

    # Tentar reabrir ou mudar vencedor da semi quando a final já começou -> deve falhar
    with pytest.raises(ValueError) as exc:
        serv_partidas.atualizar_partida(db, semi_match.id_partida, schemas.PartidaUpdate(placar_casa=1, placar_visitante=0, status="Finalizada"))
    assert "Não é possível alterar o vencedor" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        serv_partidas.atualizar_partida(db, semi_match.id_partida, schemas.PartidaUpdate(status="Agendada"))
    assert "Não é possível reabrir a partida" in str(exc.value)

    # Re-preencher final_match com duas equipes para forçar erro de vagas ocupadas
    final_match.status = "Agendada"
    final_match.id_equipe_casa = eq1.id_equipe
    final_match.id_equipe_visitante = eq2.id_equipe
    db.commit()

    # Criar semi3 com equipes eq3 e eq4 (nenhuma delas está na final) apontando para a final
    semi3 = models.Partida(
        id_edicao=ed.id_edicao, id_local=loc.id_local, id_arbitro=arb.id_arbitro, id_modalidade=mod.id_modalidade,
        id_equipe_casa=eq3.id_equipe, id_equipe_visitante=eq4.id_equipe, id_proxima_partida=final_match.id_partida,
        part_data=date.today(), part_hora=time(12, 0), status="Agendada", fase="Semifinal"
    )
    db.add(semi3)
    db.commit()

    # Agora a vitória de eq3 (que não é eq1 nem eq2) deve lançar ValueError pois ambas as vagas da final já estão ocupadas por eq1 e eq2!
    with pytest.raises(ValueError) as exc:
        serv_partidas.atualizar_partida(db, semi3.id_partida, schemas.PartidaUpdate(placar_casa=1, placar_visitante=0, status="Finalizada"))
    assert "Ambas as vagas da próxima partida já estão ocupadas" in str(exc.value)

def test_alunos_rollback_path(db):
    with patch("services.alunos.criar_participante", side_effect=RuntimeError("db error")):
        with pytest.raises(RuntimeError):
            serv_alunos.cadastrar_aluno(db, schemas.AlunoCreate(
                nome_completo="Err", data_nascimento=date(2010,1,1), escola="E", serie_ano="9", endereco="R", telefone_1="1", ids_turmas=[]
            ))

def test_alunos_conflict_db(db):
    mod = create_mock_mod(db)
    prof = create_mock_prof(db)
    t1 = serv_turmas.criar_turma(db, schemas.TurmaCreate(
        id_modalidade=mod.id_modalidade, id_professor=prof.id_professor, horario_inicio=time(10,0), horario_fim=time(11,0), dias_semana=["SEG"], categoria_idade="Sub 15"
    ))
    with patch("services.matriculas.verificar_conflito_aluno", return_value=True):
        with pytest.raises(ValueError) as exc:
            serv_alunos.cadastrar_aluno(db, schemas.AlunoCreate(
                nome_completo="ConflictDB", data_nascimento=date(2010,1,1), escola="E", serie_ano="9", endereco="R", telefone_1="1", ids_turmas=[t1.id_turma]
            ))
        assert "O aluno já possui matrícula" in str(exc.value)

def test_atletas_criar_atleta_equipe_success(db):
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa Atl", descricao="d"))
    ed = evt.edicoes[0]
    eq = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Team Atl", id_edicao=ed.id_edicao))
    atl = serv_atletas.criar_atleta_equipe(db, schemas.AtletaCreate(
        nome_completo="Atl E", data_nascimento=date(2005,5,5), documento_pessoal="123", contato="123", endereco="R"
    ), eq.id_equipe)
    assert atl.nome_completo == "Atl E"

def test_edicoes_points_corridos_odd_teams(db):
    mod = create_mock_mod(db)
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa PC", descricao="d"))
    ed = evt.edicoes[0]
    eq1 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 1", id_edicao=ed.id_edicao))
    eq2 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 2", id_edicao=ed.id_edicao))
    eq3 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 3", id_edicao=ed.id_edicao))
    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena PC Odd", loca_descricao="d", ativo=True))
    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref Odd", apito_doc="doc_odd", apito_tel="1"))
    
    db.query(models.Partida).filter(models.Partida.id_edicao == ed.id_edicao).delete()
    db.commit()
    
    partidas = serv_edic.gerar_confrontos_pontos_corridos(db, ed.id_edicao, mod.id_modalidade, date.today())
    assert len(partidas) > 0

def test_edicoes_mata_mata_validation_checks(db):
    mod = create_mock_mod(db)
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa MM", descricao="d"))
    ed_mm = serv_edic.criar_edicao(db, schemas.EdicaoCreate(
        id_evento=evt.id_evento, edic_ano=2026, tipo_competicao="Mata-Mata", fase_inicial="Semifinal", data_inicio=date(2026,1,1), data_fim=date(2026,3,1)
    ))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq MM 1", id_edicao=ed_mm.id_edicao))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq MM 2", id_edicao=ed_mm.id_edicao))
    
    # Sem local ativo
    db.query(models.Local).delete()
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_mata_mata(db, ed_mm.id_edicao, mod.id_modalidade, "Semifinal", date.today())
    assert "Nenhum local ativo" in str(exc.value)
    
    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena MM New", loca_descricao="d", ativo=True))
    
    # Sem árbitro
    db.query(models.Arbitro).delete()
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_mata_mata(db, ed_mm.id_edicao, mod.id_modalidade, "Semifinal", date.today())
    assert "Nenhum árbitro" in str(exc.value)

def test_edicoes_groups_validation_checks_and_odd_group(db):
    mod = create_mock_mod(db)
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa Gr", descricao="d"))
    ed_gr = serv_edic.criar_edicao(db, schemas.EdicaoCreate(
        id_evento=evt.id_evento, edic_ano=2026, tipo_competicao="Grupos", data_inicio=date(2026,1,1), data_fim=date(2026,3,1)
    ))
    for i in range(5):
        serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome=f"Eq G {i}", id_edicao=ed_gr.id_edicao, grupo="A" if i < 3 else "B"))
    
    # Sem local ativo
    db.query(models.Local).delete()
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_grupos(db, ed_gr.id_edicao, mod.id_modalidade)
    assert "Nenhum local ativo" in str(exc.value)
    
    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena G New", loca_descricao="d", ativo=True))
    
    # Sem árbitro
    db.query(models.Arbitro).delete()
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_grupos(db, ed_gr.id_edicao, mod.id_modalidade)
    assert "Nenhum árbitro" in str(exc.value)
    
    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref G New", apito_doc="doc_g_new", apito_tel="1"))
    serv_edic.gerar_confrontos_grupos(db, ed_gr.id_edicao, mod.id_modalidade)

def test_partidas_mata_mata_promotion_and_status_checks(db):
    mod = create_mock_mod(db)
    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena MM P", loca_descricao="d", ativo=True))
    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref MM P", apito_doc="doc", apito_tel="1"))
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa MM P", descricao="d"))
    ed = evt.edicoes[0]

    eq_mm1 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq MM 1", id_edicao=ed.id_edicao))
    eq_mm2 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq MM 2", id_edicao=ed.id_edicao))
    eq_mm3 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq MM 3", id_edicao=ed.id_edicao))
    eq_mm4 = serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq MM 4", id_edicao=ed.id_edicao))
    
    db.query(models.Partida).filter(models.Partida.id_edicao == ed.id_edicao).delete()
    db.commit()

    # Criar final
    final_match = models.Partida(
        id_edicao=ed.id_edicao, id_local=loc.id_local, id_arbitro=arb.id_arbitro, id_modalidade=mod.id_modalidade,
        part_data=date.today(), part_hora=time(16, 0), status="Agendada", fase="Final"
    )
    db.add(final_match)
    db.flush()

    # Criar semi 1 e semi 2
    semi1 = models.Partida(
        id_edicao=ed.id_edicao, id_local=loc.id_local, id_arbitro=arb.id_arbitro, id_modalidade=mod.id_modalidade,
        id_equipe_casa=eq_mm1.id_equipe, id_equipe_visitante=eq_mm2.id_equipe, id_proxima_partida=final_match.id_partida,
        part_data=date.today(), part_hora=time(14, 0), status="Agendada", fase="Semifinal"
    )
    semi2 = models.Partida(
        id_edicao=ed.id_edicao, id_local=loc.id_local, id_arbitro=arb.id_arbitro, id_modalidade=mod.id_modalidade,
        id_equipe_casa=eq_mm3.id_equipe, id_equipe_visitante=eq_mm4.id_equipe, id_proxima_partida=final_match.id_partida,
        part_data=date.today(), part_hora=time(14, 0), status="Agendada", fase="Semifinal"
    )
    db.add_all([semi1, semi2])
    db.commit()

    # Finalizar semi 1 (vencedor eq_mm1) -> final.id_equipe_casa = eq_mm1
    serv_partidas.atualizar_partida(db, semi1.id_partida, schemas.PartidaUpdate(placar_casa=2, placar_visitante=1, status="Finalizada"))
    db.refresh(final_match)
    assert final_match.id_equipe_casa == eq_mm1.id_equipe

    # Finalizar semi 2 (vencedor eq_mm3) -> final.id_equipe_visitante = eq_mm3
    serv_partidas.atualizar_partida(db, semi2.id_partida, schemas.PartidaUpdate(placar_casa=2, placar_visitante=1, status="Finalizada"))
    db.refresh(final_match)
    assert final_match.id_equipe_visitante == eq_mm3.id_equipe

    # Mudar vencedor semi 2 (eq_mm4 vence) -> final.id_equipe_visitante deve mudar para eq_mm4
    serv_partidas.atualizar_partida(db, semi2.id_partida, schemas.PartidaUpdate(placar_casa=0, placar_visitante=2, status="Finalizada"))
    db.refresh(final_match)
    assert final_match.id_equipe_visitante == eq_mm4.id_equipe

    # Finalizar a partida Final
    serv_partidas.atualizar_partida(db, final_match.id_partida, schemas.PartidaUpdate(placar_casa=3, placar_visitante=2, status="Finalizada"))

    # Tentar mudar vencedor da semi 2 após final finalizada -> deve falhar
    with pytest.raises(ValueError) as exc:
        serv_partidas.atualizar_partida(db, semi2.id_partida, schemas.PartidaUpdate(placar_casa=3, placar_visitante=0, status="Finalizada"))
    assert "Não é possível alterar o vencedor" in str(exc.value)
    db.expire_all()

    # Tentar reabrir a semi 2 após final finalizada -> deve falhar
    with pytest.raises(ValueError) as exc:
        serv_partidas.atualizar_partida(db, semi2.id_partida, schemas.PartidaUpdate(status="Agendada"))
    assert "Não é possível reabrir a partida" in str(exc.value)
    db.expire_all()

    # 7. Reabrir a semi 2 e semi 1 quando final está apenas "Agendada" (deve colocar final slot de volta para None)
    # Vamos reabrir a final primeiro
    serv_partidas.atualizar_partida(db, final_match.id_partida, schemas.PartidaUpdate(status="Agendada"))
    # Reabrir semi 2 (vencedor visitante)
    serv_partidas.atualizar_partida(db, semi2.id_partida, schemas.PartidaUpdate(status="Agendada"))
    # Reabrir semi 1 (vencedor casa)
    serv_partidas.atualizar_partida(db, semi1.id_partida, schemas.PartidaUpdate(status="Agendada"))
    db.refresh(final_match)
    assert final_match.id_equipe_visitante is None
    assert final_match.id_equipe_casa is None

    # 8. Tentar finalizar semi 1 quando a final já foi iniciada/finalizada (mas semi 1 estava "Agendada")
    # Colocar final em andamento
    serv_partidas.atualizar_partida(db, final_match.id_partida, schemas.PartidaUpdate(status="Em Andamento"))
    # Criar uma nova semi que estava "Agendada"
    semi_new = models.Partida(
        id_edicao=ed.id_edicao, id_local=loc.id_local, id_arbitro=arb.id_arbitro, id_modalidade=mod.id_modalidade,
        id_equipe_casa=eq_mm1.id_equipe, id_equipe_visitante=eq_mm2.id_equipe, id_proxima_partida=final_match.id_partida,
        part_data=date.today(), part_hora=time(14, 0), status="Agendada", fase="Semifinal"
    )
    db.add(semi_new)
    db.commit()
    with pytest.raises(ValueError) as exc:
        serv_partidas.atualizar_partida(db, semi_new.id_partida, schemas.PartidaUpdate(placar_casa=2, placar_visitante=1, status="Finalizada"))
    assert "Não é possível finalizar a partida pois a próxima partida" in str(exc.value)

def test_edicoes_mata_mata_exceed_limit_and_groups_empty(db):
    mod = create_mock_mod(db)
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa MM Limit", descricao="d"))
    ed = evt.edicoes[0]
    ed.tipo_competicao = "Mata-Mata"
    db.commit()
    
    # Criar 5 equipes para uma semifinal (limite de 4)
    for i in range(5):
        serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome=f"Eq {i}", id_edicao=ed.id_edicao))
        
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_mata_mata(db, ed.id_edicao, mod.id_modalidade, "Semifinal", date.today())
    assert "excede o limite" in str(exc.value)

    # Groups: <4 equipes
    ed_gr = serv_edic.criar_edicao(db, schemas.EdicaoCreate(
        id_evento=evt.id_evento, edic_ano=2026, tipo_competicao="Grupos", data_inicio=date(2026,1,1), data_fim=date(2026,3,1)
    ))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq 1", id_edicao=ed_gr.id_edicao))
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_grupos(db, ed_gr.id_gr_dummy if hasattr(ed_gr, "id_gr_dummy") else ed_gr.id_edicao, mod.id_modalidade)
    assert "pelo menos 4 equipes" in str(exc.value)

def test_edicoes_missing_coverage_paths(db):
    mod = create_mock_mod(db)
    evt = serv_eventos.criar_evento(db, schemas.EventoCreate(even_nome="Copa Missing paths", descricao="d"))
    ed = evt.edicoes[0]
    
    # 1. gerar_confrontos_grupos com Edição inexistente (linha 246)
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_grupos(db, 99999, mod.id_modalidade)
    assert "Edição não encontrada" in str(exc.value)

    # 2. gerar_confrontos_mata_mata com partidas em andamento/finalizadas (linha 175)
    # Primeiro geramos confrontos válidos
    loc = serv_locais.criar_local(db, schemas.LocalCreate(loca_nome="Arena MM missing", loca_descricao="d", ativo=True))
    arb = serv_arbitros.criar_arbitro(db, schemas.ArbitroCreate(apito_nome="Ref MM missing", apito_doc="doc", apito_tel="1"))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq MM 1", id_edicao=ed.id_edicao))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq MM 2", id_edicao=ed.id_edicao))
    
    # Geramos confrontos
    ed.tipo_competicao = "Mata-Mata"
    db.commit()
    partidas = serv_edic.gerar_confrontos_mata_mata(db, ed.id_edicao, mod.id_modalidade, "Final", date.today())
    
    # Colocar uma partida como finalizada
    partidas[0].status = "Finalizada"
    db.commit()
    
    # Tentar gerar novamente
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_mata_mata(db, ed.id_edicao, mod.id_modalidade, "Final", date.today())
    assert "já existem partidas em andamento ou finalizadas" in str(exc.value)

    # 3. gerar_confrontos_grupos com partidas em andamento/finalizadas (linha 267)
    ed_gr = serv_edic.criar_edicao(db, schemas.EdicaoCreate(
        id_evento=evt.id_evento, edic_ano=2026, tipo_competicao="Grupos", data_inicio=date(2026,1,1), data_fim=date(2026,3,1)
    ))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq GR 1", id_edicao=ed_gr.id_edicao))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq GR 2", id_edicao=ed_gr.id_edicao))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq GR 3", id_edicao=ed_gr.id_edicao))
    serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome="Eq GR 4", id_edicao=ed_gr.id_edicao))
    
    partidas_gr = serv_edic.gerar_confrontos_grupos(db, ed_gr.id_edicao, mod.id_modalidade)
    partidas_gr[0].status = "Em Andamento"
    db.commit()
    
    with pytest.raises(ValueError) as exc:
        serv_edic.gerar_confrontos_grupos(db, ed_gr.id_edicao, mod.id_modalidade)
    assert "já existem partidas em andamento ou finalizadas" in str(exc.value)

    # 4. gerar_confrontos_grupos com um grupo com menos de 2 equipes (linha 296)
    ed_gr2 = serv_edic.criar_edicao(db, schemas.EdicaoCreate(
        id_evento=evt.id_evento, edic_ano=2027, tipo_competicao="Grupos", data_inicio=date(2027,1,1), data_fim=date(2027,3,1)
    ))
    # Criamos 4 equipes
    eqs = []
    for i in range(4):
        eqs.append(serv_equipes.criar_equipe(db, schemas.EquipeCreate(nome=f"Eq GR2 {i}", id_edicao=ed_gr2.id_edicao)))
    
    # Atribuímos grupos de forma que o Grupo B tenha apenas 1 equipe (e o Grupo A tenha 3)
    eqs[0].grupo = "A"
    eqs[1].grupo = "A"
    eqs[2].grupo = "A"
    eqs[3].grupo = "B"
    db.commit()
    
    # Deve rodar sem problemas, apenas pulando o Grupo B porque tem menos de 2 equipes
    partidas_gr2 = serv_edic.gerar_confrontos_grupos(db, ed_gr2.id_edicao, mod.id_modalidade)
    # Apenas partidas do Grupo A devem ser geradas. Como são 3 equipes no grupo A, com rotação (e None), deve rodar.
    # Vamos verificar se as partidas geradas envolvem apenas equipes do grupo A
    for p in partidas_gr2:
        if p.id_equipe_casa:
            eq_casa = db.query(models.Equipe).filter(models.Equipe.id_equipe == p.id_equipe_casa).first()
            assert eq_casa.grupo == "A"
        if p.id_equipe_visitante:
            eq_vis = db.query(models.Equipe).filter(models.Equipe.id_equipe == p.id_equipe_visitante).first()
            assert eq_vis.grupo == "A"



