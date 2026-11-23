import io
import uuid
from datetime import date, time
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy.exc import IntegrityError

import models
from routers import alunos as router_alunos
from security import get_password_hash


def _gerar_cpf_valido() -> str:
    base = [int(c) for c in f"{uuid.uuid4().int % 10**9:09d}"]
    if len(set(base)) == 1:
        base[0] = (base[0] + 1) % 10
    soma1 = sum(base[i] * (10 - i) for i in range(9))
    d1 = 0 if (soma1 % 11) < 2 else 11 - (soma1 % 11)
    base.append(d1)
    soma2 = sum(base[i] * (11 - i) for i in range(10))
    d2 = 0 if (soma2 % 11) < 2 else 11 - (soma2 % 11)
    base.append(d2)
    return "".join(str(d) for d in base)


def _contar_arquivos(diretorio: Path) -> int:
    if not diretorio.exists():
        return 0
    return sum(1 for p in diretorio.rglob("*") if p.is_file())


def _docs_obrigatorios():
    return {
        "documento": ("documento.pdf", io.BytesIO(b"%PDF-1.4 doc"), "application/pdf"),
        "atestado": ("atestado.pdf", io.BytesIO(b"%PDF-1.4 atestado"), "application/pdf"),
    }


@pytest.fixture
def uploads_isolado(tmp_path, monkeypatch):
    pasta = tmp_path / "uploads"
    pasta.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(router_alunos, "UPLOAD_DIR", pasta)
    return pasta


@pytest.fixture
def ambiente_alunos(client, db):
    sufixo = uuid.uuid4().hex[:8]
    coord_username = f"coord_t6_{sufixo}"
    coord = models.Usuario(
        username=coord_username,
        password_hash=get_password_hash("senha123"),
        role="coordenador",
        must_change_password=False,
    )
    db.add(coord)

    mod = models.Modalidade(nome=f"Futsal T6 {sufixo}", duracao_minutos=60)
    db.add(mod)

    prof_user = models.Usuario(
        username=f"prof_t6_{sufixo}",
        password_hash=get_password_hash("senha123"),
        role="professor",
        must_change_password=False,
    )
    db.add(prof_user)
    db.flush()

    prof = models.Professor(
        id_usuario=prof_user.id_usuario,
        nome=f"Professor T6 {sufixo}",
        cpf=_gerar_cpf_valido(),
        contato="62999990000",
    )
    db.add(prof)
    db.flush()

    turma1 = models.Turma(
        id_modalidade=mod.id_modalidade,
        id_professor=prof.id_professor,
        descricao=f"Turma Manhã T6 {sufixo}",
        categoria_idade="Sub-15",
        horario_inicio=time(8, 0),
        horario_fim=time(9, 0),
    )
    turma2 = models.Turma(
        id_modalidade=mod.id_modalidade,
        id_professor=prof.id_professor,
        descricao=f"Turma Tarde T6 {sufixo}",
        categoria_idade="Sub-15",
        horario_inicio=time(14, 0),
        horario_fim=time(15, 0),
    )
    db.add_all([turma1, turma2])
    db.flush()
    db.add_all([
        models.TurmaDia(id_turma=turma1.id_turma, dia_semana="SEG"),
        models.TurmaDia(id_turma=turma2.id_turma, dia_semana="TER"),
    ])
    db.commit()

    resp = client.post("/token", data={"username": coord_username, "password": "senha123"})
    assert resp.status_code == 200
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    return {"headers": headers, "turma1": turma1, "turma2": turma2}


def _criar_aluno_base(client, headers, id_turma, nome=None, com_foto=False):
    if nome is None:
        nome = f"Aluno Base T6 {uuid.uuid4().hex[:8]}"
    files = _docs_obrigatorios()
    if com_foto:
        files["foto"] = ("foto.png", io.BytesIO(b"\x89PNG\r\n\x1a\nfoto"), "image/png")
    resp = client.post(
        "/alunos/",
        data={
            "nome_completo": nome,
            "data_nascimento": "2012-05-10",
            "escola": "Escola Municipal",
            "serie_ano": "7º ano",
            "nome_mae": "Maria Base",
            "nome_pai": "José Base",
            "telefone_1": "62999991111",
            "telefone_2": "62988882222",
            "endereco": "Rua A, 100",
            "recomendacoes_medicas": "Alergia a poeira",
            "ids_turmas": str(id_turma),
        },
        files=files,
        headers=headers,
    )
    return resp


def test_put_aluno_apaga_opcional_com_null(client, db, ambiente_alunos, uploads_isolado):
    headers = ambiente_alunos["headers"]
    turma1 = ambiente_alunos["turma1"]

    res_create = _criar_aluno_base(client, headers, turma1.id_turma)
    assert res_create.status_code == 201
    aluno_id = res_create.json()["id_aluno"]

    # Limpar campos opcionais via multipart (string vazia e "null") mantendo campos omitidos
    res_put = client.put(
        f"/alunos/{aluno_id}",
        data={
            "nome_pai": "",
            "telefone_2": "null",
        },
        headers=headers,
    )
    assert res_put.status_code == 200
    body = res_put.json()
    assert body["nome_pai"] is None
    assert body["telefone_2"] is None
    assert body["recomendacoes_medicas"] == "Alergia a poeira"
    assert body["nome_mae"] == "Maria Base"

    # Limpar outro campo opcional via multipart mantendo nome_mae intacto
    res_put_2 = client.put(
        f"/alunos/{aluno_id}",
        data={"recomendacoes_medicas": ""},
        headers=headers,
    )
    assert res_put_2.status_code == 200
    assert res_put_2.json()["recomendacoes_medicas"] is None
    assert res_put_2.json()["nome_mae"] == "Maria Base"


def test_put_aluno_remove_foto(client, db, ambiente_alunos, uploads_isolado):
    headers = ambiente_alunos["headers"]
    turma1 = ambiente_alunos["turma1"]

    res_create = _criar_aluno_base(client, headers, turma1.id_turma, com_foto=True)
    assert res_create.status_code == 201
    aluno = res_create.json()
    assert aluno["foto"] is not None

    caminho_foto = uploads_isolado / aluno["foto"].removeprefix("uploads/")
    assert caminho_foto.is_file()

    res_put = client.put(
        f"/alunos/{aluno['id_aluno']}",
        data={"remover_foto": "true"},
        headers=headers,
    )
    assert res_put.status_code == 200
    assert res_put.json()["foto"] is None
    assert not caminho_foto.exists()


def test_upload_webp_aceito(client, db, ambiente_alunos, uploads_isolado):
    headers = ambiente_alunos["headers"]
    turma1 = ambiente_alunos["turma1"]

    files = _docs_obrigatorios()
    files["foto"] = ("perfil.webp", io.BytesIO(b"RIFF\x00\x00\x00\x00WEBP"), "image/webp")

    res = client.post(
        "/alunos/",
        data={
            "nome_completo": "Aluno WebP",
            "data_nascimento": "2013-02-20",
            "escola": "Escola B",
            "serie_ano": "6º ano",
            "telefone_1": "62999990001",
            "endereco": "Rua B, 20",
            "ids_turmas": str(turma1.id_turma),
        },
        files=files,
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["foto"].endswith(".webp")


def test_upload_6mb_recusado(client, db, ambiente_alunos, uploads_isolado):
    headers = ambiente_alunos["headers"]
    turma1 = ambiente_alunos["turma1"]

    antes = _contar_arquivos(uploads_isolado)
    arquivo_6mb = b"x" * (6 * 1024 * 1024)
    files = _docs_obrigatorios()
    files["foto"] = ("grande.png", io.BytesIO(arquivo_6mb), "image/png")

    res = client.post(
        "/alunos/",
        data={
            "nome_completo": "Aluno Foto Grande",
            "data_nascimento": "2013-03-10",
            "escola": "Escola C",
            "serie_ano": "6º ano",
            "telefone_1": "62999990002",
            "endereco": "Rua C, 30",
            "ids_turmas": str(turma1.id_turma),
        },
        files=files,
        headers=headers,
    )
    assert res.status_code in (413, 422)
    assert "Arquivo maior que 5 MB." in str(res.json()["detail"])
    assert _contar_arquivos(uploads_isolado) == antes


def test_cadastro_recusado_nao_deixa_orfao(client, db, ambiente_alunos, uploads_isolado):
    headers = ambiente_alunos["headers"]
    turma1 = ambiente_alunos["turma1"]

    res_ok = _criar_aluno_base(client, headers, turma1.id_turma, nome="Aluno Duplicado", com_foto=True)
    assert res_ok.status_code == 201
    contagem_antes = _contar_arquivos(uploads_isolado)

    # Tentativa duplicada (mesmo nome e data de nascimento)
    res_dup = _criar_aluno_base(client, headers, turma1.id_turma, nome="Aluno Duplicado", com_foto=True)
    assert res_dup.status_code == 400
    assert _contar_arquivos(uploads_isolado) == contagem_antes

    # Tentativa com extensão inválida no atestado (foto e documento válidos não podem sobrar)
    res_ext = client.post(
        "/alunos/",
        data={
            "nome_completo": "Aluno Ext Invalida",
            "data_nascimento": "2013-07-07",
            "escola": "Escola D",
            "serie_ano": "6º ano",
            "telefone_1": "62999990003",
            "endereco": "Rua D, 40",
            "ids_turmas": str(turma1.id_turma),
        },
        files={
            "foto": ("foto.png", io.BytesIO(b"png"), "image/png"),
            "documento": ("doc.pdf", io.BytesIO(b"pdf"), "application/pdf"),
            "atestado": ("atestado.txt", io.BytesIO(b"texto"), "text/plain"),
        },
        headers=headers,
    )
    assert res_ext.status_code == 400
    assert _contar_arquivos(uploads_isolado) == contagem_antes


def test_cadastro_recusado_por_erro_de_banco_nao_deixa_orfao(client, db, ambiente_alunos, uploads_isolado):
    headers = ambiente_alunos["headers"]
    turma1 = ambiente_alunos["turma1"]

    contagem_antes = _contar_arquivos(uploads_isolado)

    with patch(
        "routers.alunos.servico_alunos.cadastrar_aluno",
        side_effect=IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed")),
    ):
        res = _criar_aluno_base(client, headers, turma1.id_turma, nome="Aluno Erro DB", com_foto=True)
        assert res.status_code in (400, 409, 500)

    assert _contar_arquivos(uploads_isolado) == contagem_antes


def test_criar_aluno_sem_documentos_422(client, db, ambiente_alunos, uploads_isolado):
    headers = ambiente_alunos["headers"]
    turma1 = ambiente_alunos["turma1"]

    # Sem documento e sem atestado
    res = client.post(
        "/alunos/",
        data={
            "nome_completo": "Aluno Sem Docs",
            "data_nascimento": "2012-08-15",
            "escola": "Escola E",
            "serie_ano": "7º ano",
            "telefone_1": "62999990004",
            "endereco": "Rua E, 50",
            "ids_turmas": str(turma1.id_turma),
        },
        headers=headers,
    )
    assert res.status_code == 422
    detalhe_str = str(res.json()["detail"]).lower()
    assert "atestado" in detalhe_str
    assert "documento" in detalhe_str

    # PUT não exige atestado nem documento
    res_create = _criar_aluno_base(client, headers, turma1.id_turma, nome="Aluno Com Docs")
    assert res_create.status_code == 201
    aluno_id = res_create.json()["id_aluno"]

    res_put = client.put(
        f"/alunos/{aluno_id}",
        data={"escola": "Escola Atualizada"},
        headers=headers,
    )
    assert res_put.status_code == 200
    assert res_put.json()["escola"] == "Escola Atualizada"


def test_previa_exclusao_aluno(client, db, ambiente_alunos, uploads_isolado):
    headers = ambiente_alunos["headers"]
    turma1 = ambiente_alunos["turma1"]
    turma2 = ambiente_alunos["turma2"]

    res = _criar_aluno_base(
        client,
        headers,
        f"{turma1.id_turma},{turma2.id_turma}",
        nome="Aluno Previa Exclusao",
    )
    assert res.status_code == 201
    aluno = res.json()
    id_aluno = aluno["id_aluno"]
    matriculas = aluno["matriculas"]
    assert len(matriculas) == 2

    db.add_all([
        models.Presenca(id_matricula=matriculas[0]["id_matricula"], data_aula=date(2026, 11, 1), status="Presente"),
        models.Presenca(id_matricula=matriculas[0]["id_matricula"], data_aula=date(2026, 11, 8), status="Ausente"),
        models.Presenca(id_matricula=matriculas[1]["id_matricula"], data_aula=date(2026, 11, 2), status="Presente"),
    ])
    db.commit()

    res_previa = client.get(f"/alunos/{id_aluno}/exclusao/previa", headers=headers)
    assert res_previa.status_code == 200
    assert res_previa.json() == {"matriculas": 2, "presencas": 3}

    res_404 = client.get("/alunos/999999/exclusao/previa", headers=headers)
    assert res_404.status_code == 404


def test_previa_exclusao_turma(client, db, ambiente_alunos, uploads_isolado):
    headers = ambiente_alunos["headers"]
    turma1 = ambiente_alunos["turma1"]

    res1 = _criar_aluno_base(client, headers, turma1.id_turma, nome="Aluno Turma Previa 1")
    res2 = _criar_aluno_base(client, headers, turma1.id_turma, nome="Aluno Turma Previa 2")
    assert res1.status_code == 201
    assert res2.status_code == 201

    mat1 = res1.json()["matriculas"][0]["id_matricula"]
    mat2 = res2.json()["matriculas"][0]["id_matricula"]

    db.add_all([
        models.Presenca(id_matricula=mat1, data_aula=date(2026, 11, 1), status="Presente"),
        models.Presenca(id_matricula=mat1, data_aula=date(2026, 11, 8), status="Presente"),
        models.Presenca(id_matricula=mat2, data_aula=date(2026, 11, 1), status="Ausente"),
        models.Presenca(id_matricula=mat2, data_aula=date(2026, 11, 8), status="Justificado"),
    ])
    db.commit()

    res_previa = client.get(f"/turmas/{turma1.id_turma}/exclusao/previa", headers=headers)
    assert res_previa.status_code == 200
    assert res_previa.json() == {"matriculas": 2, "presencas": 4}

    res_404 = client.get("/turmas/999999/exclusao/previa", headers=headers)
    assert res_404.status_code == 404
