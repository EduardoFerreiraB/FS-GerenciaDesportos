import pytest
from sqlalchemy import create_engine, text

from scripts.testar_mysql_competicoes import comparar_schema


def test_comparar_schema_sem_divergencia_em_sqlite(tmp_path):
    assert comparar_schema(f"sqlite:///{tmp_path / 'fresh.sqlite'}") == []


def test_comparar_schema_detecta_coluna_faltante_no_banco(tmp_path):
    """Coluna do metadata ausente no banco precisa aparecer como divergencia.

    Usa alunos.nome_pai (anulavel); a tarefa 11 troca por competidores.documento.
    O banco e alterado (API publica) em vez de mutar o metadata ORM.
    """
    url = f"sqlite:///{tmp_path / 'divergente.sqlite'}"
    assert comparar_schema(url) == []
    with create_engine(url).begin() as conexao:
        conexao.execute(text("ALTER TABLE alunos DROP COLUMN nome_pai"))
    assert any("nome_pai" in linha for linha in comparar_schema(url))


def test_comparar_schema_detecta_coluna_extra_e_indice_faltante(tmp_path):
    url = f"sqlite:///{tmp_path / 'extra.sqlite'}"
    comparar_schema(url)
    with create_engine(url).begin() as conexao:
        conexao.execute(text("ALTER TABLE alunos ADD COLUMN lixo INTEGER"))
        conexao.execute(text("DROP INDEX ix_alunos_id_aluno"))
    linhas = comparar_schema(url)
    assert any("lixo" in linha for linha in linhas)
    assert any("ix_alunos_id_aluno" in linha for linha in linhas)


def test_harness_recusa_url_externa(monkeypatch, capsys):
    from scripts.testar_mysql_competicoes import main
    monkeypatch.setenv("DATABASE_URL", "mysql+pymysql://u:p@prod/db")
    with pytest.raises(SystemExit) as saida:
        main(["--usar-database-url"])
    assert saida.value.code != 0


def test_main_sem_url_falha_com_mensagem(monkeypatch, capsys):
    import scripts.testar_mysql_competicoes as harness
    monkeypatch.delenv("HARNESS_MYSQL_URL", raising=False)
    assert harness.main([]) == 1
    assert "HARNESS_MYSQL_URL" in capsys.readouterr().err


def test_harness_recusa_url_com_nome_de_banco(monkeypatch, capsys):
    import scripts.testar_mysql_competicoes as harness
    monkeypatch.setenv("HARNESS_MYSQL_URL", "mysql+pymysql://u:p@localhost:3306/producao")
    with pytest.raises(SystemExit) as saida:
        harness.main([])
    assert saida.value.code != 0
    assert "nome de banco" in capsys.readouterr().err


def test_main_servidor_inacessivel_falha_sem_traceback(monkeypatch, capsys):
    import scripts.testar_mysql_competicoes as harness
    monkeypatch.setenv("HARNESS_MYSQL_URL", "mysql+pymysql://u:p@127.0.0.1:1/")
    assert harness.main([]) == 1
    assert "erro" in capsys.readouterr().err


@pytest.mark.mysql
def test_schema_equivale_orm_em_mysql():
    import os
    if not os.environ.get("HARNESS_MYSQL_URL"):
        pytest.skip("defina HARNESS_MYSQL_URL (servidor MySQL/TiDB sem nome de banco)")
    from scripts.testar_mysql_competicoes import main
    assert main([]) == 0
