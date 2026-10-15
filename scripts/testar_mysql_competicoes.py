"""Harness de equivalencia schema/ORM em um banco MySQL descartavel.

Uso:

    env HARNESS_MYSQL_URL='mysql+pymysql://user:pass@localhost:3306/' \\
        PYTHONPATH=app:. .venv/bin/python scripts/testar_mysql_competicoes.py

``HARNESS_MYSQL_URL`` (ou ``--url``) aponta para um SERVIDOR compativel com
MySQL (MySQL local, TiDB...), sem nome de banco. O harness cria um banco
``harness_<id>`` aleatorio, aplica ``alembic upgrade head``, compara o schema
com ``models.Base.metadata`` e descarta esse mesmo banco no ``finally``. So
descarta o banco que ele proprio criou. Exige privilegio CREATE/DROP DATABASE.

Nunca usa ``DATABASE_URL`` nem ``.env``. Codigo de saida: 0 sem divergencias;
1 com divergencias ou falha de infraestrutura; 2 uso invalido.
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]


# --------------------------------------------------------------------------
# Comparacao de schema
# --------------------------------------------------------------------------

def _alembic_config(url: str) -> Config:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    # Tem precedencia sobre DATABASE_URL/.env em alembic/env.py.
    config.attributes["database_url"] = url
    return config


def _tipo(tipo, dialeto) -> str:
    texto = str(tipo.compile(dialect=dialeto)).lower().strip()
    # MySQL reflete BOOL como TINYINT(1); o ORM compila Boolean como BOOL.
    if texto in ("bool", "boolean"):
        return "tinyint(1)"
    return texto


def _default(valor) -> str | None:
    if valor is None:
        return None
    texto = str(getattr(valor, "arg", valor)).strip()
    while len(texto) > 1 and texto[0] == "(" and texto[-1] == ")":
        texto = texto[1:-1].strip()
    if len(texto) > 1 and texto[0] == texto[-1] and texto[0] in "'\"":
        texto = texto[1:-1]
    texto = texto.lower()
    if texto in ("true", "false"):
        texto = "1" if texto == "true" else "0"
    if texto in ("now()", "current_timestamp()", "current_timestamp"):
        texto = "current_timestamp"
    return texto


def _acao(valor) -> str:
    valor = (valor or "NO ACTION").upper()
    # NO ACTION e RESTRICT sao equivalentes em MySQL/InnoDB.
    return "NO ACTION" if valor == "RESTRICT" else valor


def _diff(rotulo: str, esperado: dict, atual: dict) -> list[str]:
    linhas = []
    for chave in sorted(set(esperado) | set(atual), key=str):
        if chave not in atual:
            linhas.append(f"{rotulo}: faltando no banco: {chave} (ORM: {esperado[chave]})")
        elif chave not in esperado:
            linhas.append(f"{rotulo}: sobrando no banco: {chave} (banco: {atual[chave]})")
        elif esperado[chave] != atual[chave]:
            linhas.append(
                f"{rotulo}: {chave} difere: ORM={esperado[chave]} banco={atual[chave]}"
            )
    return linhas


def comparar_schema(url: str) -> list[str]:
    """Aplica ``upgrade head`` em ``url`` e devolve as divergencias para o ORM."""
    import models

    metadata = models.Base.metadata
    command.upgrade(_alembic_config(url), "head")

    engine = create_engine(url)
    try:
        dialeto = engine.dialect
        atual = inspect(engine)
        divergencias: list[str] = []

        tabelas_banco = set(atual.get_table_names()) - {"alembic_version"}
        divergencias += _diff(
            "tabelas",
            {nome: "" for nome in metadata.tables},
            {nome: "" for nome in tabelas_banco},
        )

        for nome, tabela in sorted(metadata.tables.items()):
            if nome not in tabelas_banco:
                continue
            rotulo = lambda parte: f"{nome}.{parte}"  # noqa: E731
            colunas = {c["name"]: c for c in atual.get_columns(nome)}

            divergencias += _diff(
                rotulo("coluna tipo"),
                {c.name: _tipo(c.type, dialeto) for c in tabela.columns},
                {n: _tipo(c["type"], dialeto) for n, c in colunas.items()},
            )
            divergencias += _diff(
                rotulo("coluna nulabilidade"),
                {c.name: c.nullable for c in tabela.columns},
                {n: c["nullable"] for n, c in colunas.items()},
            )
            divergencias += _diff(
                rotulo("coluna default"),
                {c.name: _default(c.server_default) for c in tabela.columns},
                {n: _default(c["default"]) for n, c in colunas.items()},
            )
            divergencias += _diff(
                rotulo("chave primaria"),
                {c.name: True for c in tabela.primary_key.columns},
                {n: True for n, c in colunas.items() if c["primary_key"]},
            )

            esperado_uq = {
                tuple(c.name for c in uq.columns): None
                for uq in tabela.constraints
                if uq.__class__.__name__ == "UniqueConstraint"
            }
            atual_uq = {
                tuple(uq["column_names"]): None
                for uq in atual.get_unique_constraints(nome)
            }
            divergencias += _diff(rotulo("unicidade"), esperado_uq, atual_uq)

            esperado_idx = {
                i.name: (tuple(c.name for c in i.columns), bool(i.unique))
                for i in tabela.indexes
            }
            fks_cols = {tuple(fk["constrained_columns"]) for fk in atual.get_foreign_keys(nome)}
            atual_idx = {}
            for idx in atual.get_indexes(nome):
                cols = tuple(idx["column_names"])
                if idx.get("duplicates_constraint"):
                    continue  # espelho de UNIQUE constraint (MySQL)
                if idx["name"] not in esperado_idx and cols in fks_cols:
                    continue  # indice implicito criado pelo MySQL para a FK
                if idx["name"] not in esperado_idx and bool(idx.get("unique")) and cols in atual_uq:
                    continue  # espelho de UNIQUE constraint (SQLite)
                atual_idx[idx["name"]] = (cols, bool(idx.get("unique")))
            divergencias += _diff(rotulo("indice"), esperado_idx, atual_idx)

            esperado_fk = {}
            for constraint in tabela.foreign_key_constraints:
                cols = tuple(e.parent.name for e in constraint.elements)
                esperado_fk[cols] = (
                    constraint.elements[0].column.table.name,
                    tuple(e.column.name for e in constraint.elements),
                    _acao(constraint.ondelete),
                )
            atual_fk = {
                tuple(fk["constrained_columns"]): (
                    fk["referred_table"],
                    tuple(fk["referred_columns"]),
                    _acao(fk.get("options", {}).get("ondelete")),
                )
                for fk in atual.get_foreign_keys(nome)
            }
            divergencias += _diff(rotulo("chave estrangeira/ondelete"), esperado_fk, atual_fk)
        return divergencias
    finally:
        engine.dispose()


# --------------------------------------------------------------------------
# Banco descartavel em servidor MySQL-compativel
# --------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Compara o schema do Alembic com o ORM em um banco descartavel "
        "criado num servidor MySQL-compativel."
    )
    parser.add_argument(
        "--url",
        help="URL do servidor, sem nome de banco (padrao: variavel HARNESS_MYSQL_URL).",
    )
    parser.add_argument(
        "--usar-database-url",
        action="store_true",
        help="NAO SUPORTADO: recusado de proposito (ver mensagem).",
    )
    args = parser.parse_args(argv)
    if args.usar_database_url:
        parser.exit(
            2,
            "erro: este harness nunca usa DATABASE_URL nem .env. Ele aplica "
            "'alembic upgrade head' e depois compara o schema; apontar para o "
            "banco da aplicacao o alteraria. O unico alvo permitido e um banco "
            "descartavel criado pelo proprio harness no servidor de "
            "HARNESS_MYSQL_URL.\n",
        )

    bruta = args.url or os.environ.get("HARNESS_MYSQL_URL")
    if not bruta:
        print(
            "erro: defina HARNESS_MYSQL_URL (ou --url) com a URL do servidor, sem "
            "banco, ex.: mysql+pymysql://user:pass@localhost:3306/",
            file=sys.stderr,
        )
        return 1
    try:
        servidor = make_url(bruta)
    except Exception:
        print("erro: HARNESS_MYSQL_URL nao e uma URL SQLAlchemy valida.", file=sys.stderr)
        return 1
    if not servidor.get_backend_name().startswith("mysql"):
        print("erro: HARNESS_MYSQL_URL deve usar um driver mysql (ex.: mysql+pymysql).", file=sys.stderr)
        return 1
    if servidor.database:
        parser.exit(
            2,
            "erro: HARNESS_MYSQL_URL nao pode conter nome de banco. O harness "
            "cria e descarta o proprio banco 'harness_<id>'; aceitar um nome "
            "poderia apagar um banco real. Use mysql+pymysql://user:pass@host:3306/\n",
        )

    banco = f"harness_{uuid.uuid4().hex[:8]}"  # nunca vem de entrada externa
    admin = create_engine(servidor, isolation_level="AUTOCOMMIT")
    criado = False
    divergencias: list[str] = []
    try:
        try:
            with admin.connect() as conexao:
                conexao.execute(text(f"CREATE DATABASE `{banco}` CHARACTER SET utf8mb4"))
            criado = True
        except Exception as erro:
            print(
                f"erro: nao foi possivel criar o banco descartavel no servidor "
                f"(servidor inacessivel ou sem privilegio CREATE DATABASE): "
                f"{type(erro).__name__}: {str(erro).splitlines()[0]}",
                file=sys.stderr,
            )
            return 1
        print(f"Banco descartavel criado: {banco}")
        alvo = servidor.set(database=banco).render_as_string(hide_password=False)
        divergencias = comparar_schema(alvo)
    finally:
        if criado:
            try:
                with admin.connect() as conexao:
                    conexao.execute(text(f"DROP DATABASE `{banco}`"))
                print(f"Banco descartavel removido: {banco}")
            except Exception as erro:
                print(f"AVISO: falha ao remover o banco {banco}; remova-o manualmente: {erro}", file=sys.stderr)
        admin.dispose()

    if divergencias:
        print(f"{len(divergencias)} divergencia(s) entre Alembic (MySQL) e ORM:")
        for linha in divergencias:
            print(f"  - {linha}")
        return 1
    print("Schema do MySQL equivalente ao metadata ORM: sem divergencias.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
