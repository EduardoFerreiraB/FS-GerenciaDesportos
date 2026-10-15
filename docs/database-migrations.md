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

## Banco existente: baseline seguro

A revisão `20260824_0001` é um retrato do schema atual, incluindo
`competicoes` e `equipes.id_competicao`; ela não transforma dados históricos.

1. Faça backup e verifique o ambiente e o alvo antes de qualquer comando.
2. Compare tabelas, colunas, chaves estrangeiras, índices e constraints do
   banco existente com a revisão. Confirme também o estado atual com
   `alembic current`.
3. Somente se o schema já for exatamente equivalente à revisão, registre o
   baseline com `alembic stamp 20260824_0001`.
4. Se houver qualquer diferença — por exemplo, o banco legado não possuir
   `competicoes` ou `equipes.id_competicao` — **não execute `stamp`**. Registre
   a diferença e crie/revise uma migração corretiva em uma etapa aprovada.
5. Depois de um `stamp` validado ou de uma atualização normal, rode
   `alembic upgrade head` antes de iniciar a API.

`stamp` apenas marca uma revisão na tabela `alembic_version`; ele não cria nem
altera tabelas. Marcá-lo contra um schema diferente ocultaria o desvio e pode
causar perda de dados em releases posteriores.

Não use `alembic downgrade` contra um banco adotado por `stamp` ou contendo
dados de produção: o downgrade da revisão inicial remove as tabelas do schema.

## Passo 3: reconciliação de equipes históricas

A revisão `20260824_0003` é aditiva: conserva `equipes.id_edicao`, mantém
`id_competicao` anulável durante o rollout e cria a auditoria
`migracao_equipes_origem`. Para uma equipe histórica sem competição, ela usa
as partidas por modalidade e a competição `EQUIPE` da mesma edição. Se houver
mais de uma modalidade, mantém o registro original para uma competição, cria
uma cópia para cada competição adicional, copia integralmente o elenco e
redireciona as partidas da modalidade correspondente. Não cria participantes
nem apaga equipes ou partidas.

Antes do primeiro rollout, produza dois dumps SQLite **anonimizados**: um na
revisão `20260824_0002` e outro após aplicar `20260824_0003` somente à cópia.
Valide-os sem credenciais e sem escrita no dump:

```bash
python scripts/validar_migracao_equipes.py \
  --antes /copia/anonimizada-0002.sqlite \
  --depois /copia/anonimizada-0003.sqlite \
  --relatorio /tmp/relatorio-equipes.json
```

O relatório contém cada `equipe original → equipe/competição`, as contagens
pré/pós de partidas e os conjuntos de participantes. O processo deve ser
revisado manualmente antes do rollout. O validador termina com erro se uma
equipe com partidas não tiver exatamente uma competição EQUIPE inferível para
cada modalidade, ou se houver divergência de partidas/elenco.

Equipes sem partidas e sem modalidade inferível não são alteradas: recebem
`PENDENTE` na auditoria e entram no relatório para decisão manual. O downgrade
de `20260824_0003` é bloqueado após qualquer reconciliação, pois desfazer
clones e partidas não é seguro automaticamente. A geração MySQL offline só
emite DDL; ela não reconcilia dados. Não execute a migração em `.env`, banco
local de desenvolvimento ou produção antes da aprovação do relatório.

As alterações de elenco de equipes vinculadas bloqueiam a linha da competição
antes de reler o elenco e inserir o participante. A consulta inicial usada
somente para descobrir a competição é descartada com rollback antes do lock,
para não reutilizar um snapshot anterior no MySQL. O participante continua
permitido em outra competição e a resposta de conflito segue sendo `422`.
