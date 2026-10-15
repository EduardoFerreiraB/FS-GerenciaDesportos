from __future__ import with_statement

import os
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool


# Resolve from the repository instead of the caller's working directory, the
# same local `.env` used by app/database.py. Exported variables still win.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Revisions are explicit, frozen DDL.  Do not import application models here:
# runtime model changes must never alter an already-issued migration.
target_metadata = None


def database_url():
    # Programmatic callers (notably isolated migration tests) set this
    # attribute.  It must take precedence over a developer's shell/.env URL.
    return (
        config.attributes.get("database_url")
        or os.getenv("DATABASE_URL")
        or config.get_main_option("sqlalchemy.url")
    )


def run_migrations_offline():
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = database_url()
    connectable = engine_from_config(configuration, prefix="sqlalchemy.", poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
