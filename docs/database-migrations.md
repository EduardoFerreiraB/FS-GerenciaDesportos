# Migrações de banco de dados

O schema é versionado pelo Alembic. A API e `create_admin.py` não executam
`create_all()`: aplique a migração antes de iniciar qualquer processo que use
o banco.

O Alembic usa a mesma variável `DATABASE_URL` da API. Em desenvolvimento, ele
também lê `.env` sem substituir uma variável já exportada no shell. Não coloque
credenciais no `alembic.ini`.

## Banco novo

Com o ambiente virtual ativo, antes de iniciar a API:

```bash
alembic upgrade head
PYTHONPATH=app uvicorn app.main:app --reload
```

No Docker Compose, com o serviço do banco disponível, execute uma vez antes
de subir ou reiniciar `web`:

```bash
docker compose run --rm web alembic upgrade head
docker compose up web
```

A imagem contém `alembic.ini` e `alembic/`, portanto o mesmo comando pode ser
executado como uma etapa explícita de release. No Render, abra um shell/one-off
command com as mesmas variáveis do serviço e execute `alembic upgrade head`
antes de liberar a nova instância. Não inclua esse comando no `CMD` da API: a
execução deve ser coordenada uma vez por release.

## Baseline `20261015_0100`

A cadeia de migrações foi consolidada em uma única revisão, `20261015_0100`,
gerada a partir do metadata ORM por `scripts/gerar_baseline.py` (apenas contra
SQLite temporário). Ela é a única `head` e não tem `down_revision`.

- **Banco novo:** `alembic upgrade head` cria todo o schema e chega à
  `20261015_0100`.
- **Banco existente:** faça backup, compare tabelas, colunas, chaves
  estrangeiras, índices e constraints com a revisão e confira `alembic current`.
  Somente se o schema for exatamente equivalente, **o usuário** executa
  `alembic stamp 20261015_0100`. Qualquer divergência interrompe a adoção: não
  execute `stamp`; registre a diferença e trate-a numa etapa aprovada.
- **Diferenças conhecidas** entre um banco criado pela cadeia antiga e o
  baseline (que segue o metadata ORM). Espere vê-las na comparação:
  - defaults de servidor ausentes no baseline: `grupos_competicoes.status='ATIVO'`
    e `criado_em=now()`; `jogadores.ativo=true` e `criado_em=now()`;
    `ocorrencias_partida.tempo_jogo='1T'` e `criado_em=now()`;
    `confrontos.ordem_jogo='1'`;
  - `grupos_competicoes.slug`: constraint única `uq_grupos_competicoes_slug` +
    índice não único, contra um único índice único no baseline;
  - `equipes.id_edicao`: NOT NULL no banco antigo, anulável no baseline.

  Essas tabelas serão todas recriadas/descartadas pela revisão de consolidação
  seguinte. A decisão do usuário é: aceitar as diferenças e executar `stamp`,
  ou recriar o banco de desenvolvimento. Não há migração corretiva.
- `stamp` apenas marca a revisão em `alembic_version`; não cria nem altera
  tabelas. Marcá-lo contra um schema diferente oculta o desvio.
- `alembic downgrade` segue proibido contra banco com dados: o downgrade do
  baseline remove as tabelas.

Execuções normais do Alembic não carregam os modelos (`target_metadata` é
`None`); somente o gerador injeta o metadata via `config.attributes`.
