"""Regenera a revisao baseline do Alembic a partir do metadata ORM.

Ferramenta de desenvolvimento. Uso:

    env DATABASE_URL=sqlite:///:memory: PYTHONPATH=app python scripts/gerar_baseline.py

Recusa executar se DATABASE_URL nao for SQLite, para nunca tocar um banco real.
A geracao usa apenas um SQLite temporario vazio.
"""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REV_ID = "20261015_0100"
DESTINO_PADRAO = ROOT / "alembic" / "versions" / f"{REV_ID}_baseline.py"


def gerar(destino: Path) -> Path:
    from alembic import command
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    import models

    destino = Path(destino)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        url = f"sqlite:///{tmp / 'vazio.sqlite'}"
        versions = tmp / "versions"
        versions.mkdir()

        config = Config(str(ROOT / "alembic.ini"))
        config.set_main_option("sqlalchemy.url", url)
        # Diretorio de versoes isolado: a cadeia real nao participa da geracao.
        config.set_main_option("version_locations", str(versions))
        config.attributes["database_url"] = url
        config.attributes["target_metadata"] = models.Base.metadata

        command.revision(
            config,
            autogenerate=True,
            rev_id=REV_ID,
            message="baseline derivado do metadata ORM",
        )
        gerados = list(versions.glob(f"{REV_ID}_*.py"))
        if len(gerados) != 1:
            raise RuntimeError(f"Esperava uma revisao gerada, obtive {gerados}")
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(gerados[0], destino)
    return destino


def main() -> int:
    url = os.getenv("DATABASE_URL", "")
    if not url.startswith("sqlite"):
        print("Recusado: DATABASE_URL deve ser SQLite para gerar o baseline.", file=sys.stderr)
        return 2
    sys.path.insert(0, str(ROOT / "app"))
    print(gerar(DESTINO_PADRAO))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
