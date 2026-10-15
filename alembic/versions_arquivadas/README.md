# Revisões arquivadas

Estas revisões (`20260824_0001` a `20260824_0005` e `20260914_0006`) formavam a
cadeia Alembic anterior. Foram arquivadas porque continham reconciliação de
dados históricos que, num banco novo, roda contra zero linhas, e seus
downgrades já estavam bloqueados.

- Elas **não fazem parte da cadeia**: o Alembic não lê este diretório.
- A revisão `20261015_0100` (baseline, derivada do metadata ORM) descreve o
  mesmo schema que elas produziam, e é a única `head`.
- Os testes e validadores correspondentes estão em `migration_tests/arquivados/`.
