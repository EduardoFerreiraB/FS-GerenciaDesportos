# Revisões arquivadas

Estas revisões (`20260824_0001` a `20260824_0005` e `20260914_0006`) formavam a
cadeia Alembic anterior. Foram arquivadas porque continham reconciliação de
dados históricos que, num banco novo, roda contra zero linhas, e seus
downgrades já estavam bloqueados.

- Elas **não fazem parte da cadeia**: o Alembic não lê este diretório.
- A revisão `20261015_0100` (baseline) é a única `head` e é equivalente ao
  **metadata ORM**, não à cadeia antiga. Um banco construído por esta cadeia
  difere do baseline em:
  - defaults de servidor que o ORM não declara: `grupos_competicoes.status='ATIVO'`
    e `criado_em=CURRENT_TIMESTAMP`; `jogadores.ativo=true` e
    `criado_em=CURRENT_TIMESTAMP`; `ocorrencias_partida.tempo_jogo='1T'` e
    `criado_em=CURRENT_TIMESTAMP`; `confrontos.ordem_jogo='1'`;
  - `grupos_competicoes.slug`: a cadeia antiga tem a constraint única
    `uq_grupos_competicoes_slug` e um índice NÃO único `ix_grupos_competicoes_slug`;
    o baseline tem um único índice único `ix_grupos_competicoes_slug`;
  - `equipes.id_edicao`: NOT NULL na cadeia antiga, anulável no ORM/baseline.
- Os testes e validadores correspondentes estão em `migration_tests/arquivados/`.
