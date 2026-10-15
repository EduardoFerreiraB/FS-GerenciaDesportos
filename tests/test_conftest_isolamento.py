from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]


def test_conftest_nao_usa_banco_fixo_na_raiz():
    fonte = (RAIZ / "tests" / "conftest.py").read_text()
    assert "test.db" not in fonte
    assert "tmp_path_factory" in fonte


def test_nenhum_banco_de_teste_na_raiz():
    assert not (RAIZ / "test.db").exists()
    assert not (RAIZ / "test-task2.db").exists()


def test_compose_sem_credencial_literal():
    fonte = (RAIZ / "docker-compose.yml").read_text()
    assert "D252310m" not in fonte
    assert "root_password_segura" not in fonte
    assert "chave_secreta_para_desenvolvimento_local" not in fonte
    assert "${MYSQL_PASSWORD" in fonte
    assert "${MYSQL_ROOT_PASSWORD" in fonte
