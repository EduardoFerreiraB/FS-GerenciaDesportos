# Checkpoint — Fatias 0 e 1 da consolidação de competições

**Data:** 2026-10-15
**Branch:** `fatia-0/estabilizacao` (HEAD `0a9dd10`)
**Estado:** pausado pelo usuário antes da tarefa 5. Árvore de trabalho limpa.

Documentos que este checkpoint acompanha:

- Spec aprovada: [`specs/2026-10-15-competicoes-fatias-design.md`](../specs/2026-10-15-competicoes-fatias-design.md)
- Plano em execução: [`plans/2026-10-15-fatias-0-1-fundacao-competicoes.md`](../plans/2026-10-15-fatias-0-1-fundacao-competicoes.md)
- Ledger completo da execução, com todas as decisões e pendências: [`2026-10-15-fatias-0-1-ledger.md`](2026-10-15-fatias-0-1-ledger.md)

## 1. Onde estamos

| Tarefa | Descrição | Estado | Commits |
| --- | --- | --- | --- |
| 0 | Snapshot do V1/V2 antes da consolidação | ✅ concluída | `c139d9b` |
| 1 | Baseline Alembic derivado do ORM | ✅ revisada | `87ef2a0`, `7c69306` |
| 2 | Higiene, credenciais fora do compose, banco de teste isolado | ✅ revisada | `3960a34` |
| 3 | Harness de schema em MySQL descartável | ✅ revisada, 3 rodadas de correção | `766489e` … `4fb5b86` |
| 4 | Modelos definitivos, revisão de consolidação, retirada do legado | ✅ revisada | `0a9dd10` |
| 5 | Contratos, infra transacional e esqueleto da API | ⏸ **não iniciada** — interrompida a pedido do usuário sem alterar arquivos | — |
| 6–11 | Organização, elencos, cliente TS, telas, integração | pendentes | — |

**Fatia 0: concluída**, com o portão fechado em MySQL real.
**Fatia 1: fundação de banco pronta** (tarefa 4); faltam serviços, API e frontend (tarefas 5 a 11).

## 2. Evidência medida

Execução real do harness pelo usuário, MySQL 8 local, HEAD `0a9dd10`:

```
Running upgrade  -> 20261015_0100, baseline derivado do metadata ORM
Running upgrade 20261015_0100 -> 20261015_0200, consolidacao do dominio de competicoes (futebol)
Banco descartavel removido: harness_df0bcc9b
Schema do MySQL equivalente ao metadata ORM: sem divergencias.
```

Suítes no fim da tarefa 4 (SQLite isolado, relatadas pelo implementador e conferidas na revisão):

- `competition_tests/consolidacao`: 35 passando
- `tests` + `migration_tests -m 'not mysql'`: 106 passando
- Teste da FK composta comprovadamente real: com `PRAGMA foreign_keys` desligado, ele falha.

**Ainda não executado:** harness contra o TiDB Cloud.

## 3. Fatos do ambiente que mudaram o desenho

- **Docker não é usado** no projeto. Desenvolvimento usa MySQL instalado localmente; produção usa **TiDB Cloud v8.5.3**. O harness foi refeito para apontar para qualquer servidor MySQL-compatível.
- **TiDB v8.5.3 aplica FOREIGN KEYs** (GA desde a v8.5). A FK composta que impede integrante de equipe de outra edição vale em produção.
- **TiDB ignora CHECK constraints por padrão** (`tidb_enable_check_constraint = OFF`). Decisão: todo CHECK do schema terá validação equivalente no serviço, com teste próprio. Os três CHECKs criados até agora:
  - `edicoes_evento`: `data_inicio <= data_fim`
  - `edicoes_competicao`: `data_inicio <= data_fim`
  - `edicoes_competicao`: `revisao >= 1`

## 4. Decisões que tomei em seu nome e merecem sua revisão

A lista completa (R1–R24) está no ledger. As que afetam o produto:

| # | Decisão | Custo se estiver errada |
| --- | --- | --- |
| R8 | O `Evento`/`Edicao` antigos, `routers/eventos.py`, `services/eventos.py` e o portal público antigo (`routers/publico.py`) foram removidos. O plano dizia preservar o router de eventos, mas o `Evento` antigo ocupa a mesma tabela `eventos` do novo. | Telas antigas de eventos deixam de funcionar; a spec já as substitui. |
| R18 | CHECKs sempre espelhados em validação de serviço. | Validação duplicada (banco + serviço). |
| R24 | **Atletas congelados**: só leitura e exclusão. A única rota de criação era `POST /atletas/equipe/{id}`, que agora responde 410. Não criei rota nova. | Se você precisa cadastrar atletas, falta uma rota `POST /atletas/` (pequena; o serviço `criar_atleta` ainda existe). |
| R10 | Não executei `stamp` no banco de dev. | Passo manual seu (seção 6). |

## 5. Como retomar

### 5.1 Retomar a execução

Abra uma sessão nova na raiz do projeto e peça para continuar a execução do plano a partir da tarefa 5, usando `superpowers:subagent-driven-development` com as ondas paralelas do plano. O ledger de trabalho do agente está em `.superpowers/sdd/2026-10-15-fatias-0-1-fundacao-competicoes/progress.md` (fora do git); a cópia versionada é o arquivo [`2026-10-15-fatias-0-1-ledger.md`](2026-10-15-fatias-0-1-ledger.md). Se a pasta `.superpowers/` sumir, restaure o ledger a partir da cópia — as linhas `Task N: complete` dizem o que não deve ser refeito.

Ordem restante, com o paralelismo do plano:

| Onda | Tarefas | Agentes |
| --- | --- | --- |
| D | 5 — contratos, infra, esqueleto da API | 1 |
| E | 6 organização ∥ 7 elencos ∥ 8 contratos TS + cliente | 3 em paralelo |
| F | 9 telas de organização ∥ 10 telas de elencos | 2 em paralelo |
| G | 11 integração e portão da fatia 1 | 1 |

### 5.2 O que o despacho da tarefa 5 precisa levar além do brief

O brief sai de `scripts/task-brief` do plugin superpowers. Estes pontos já tinham sido decididos para o despacho e não estão no plano:

1. Criar `app/competicoes/servicos/__init__.py` vazio (as tarefas 6 e 7 vão escrever nesse pacote em paralelo).
2. `api/organizacao.py` e `api/elencos.py` nascem com `router = APIRouter()` vazio; `api/__init__.py` inclui os dois.
3. **Fixtures compartilhadas** em `competition_tests/consolidacao/conftest.py`: `client` (TestClient com `get_db` sobreposto à mesma sessão SQLite), `usuario` (coordenador persistido) e `cabecalhos_por_papel` (cabeçalhos de autenticação por papel, usando `security.create_access_token`). As tarefas 6 e 7 ficam proibidas de editar esse arquivo e `factories.py`.
4. A coluna de autor legível da auditoria se chama **`responsavel_nome`** (o teste do plano usa `responsavel_descricao`, que não existe).
5. Enums sempre como `Literal`/`Enum` nos contratos — o SQLite não aplica valores de enum.
6. Validador de modelo rejeitando `data_inicio > data_fim` nos contratos que carregam as duas datas (espelho do CHECK que o TiDB ignora).
7. `registrar_tratadores` também converte `RequestValidationError` no envelope `{"codigo","mensagem","campos"}` com 422.

### 5.3 Pontos já identificados para as próximas tarefas

- **Tarefa 8:** `@playwright/test` não está instalado em `frontend/`; os navegadores já estão em cache em `~/.cache/ms-playwright` (chromium-1243). A instalação precisa de acesso ao registro npm.
- **Tarefa 11:** atualizar `docs/database-migrations.md` (ainda diz que a 0100 é a única head e omite `-x descartar_competicoes_teste=sim` no deploy), `docs/rollout-checklist.md` (caminho antigo dos validadores) e as seções 4.2–4.4 da spec (Docker, equivalência com a cadeia antiga).
- **Plano da fatia 2:** `requisicoes_partida.id_partida` ainda não tem FK (a tabela `partidas` não existe); a exigência de "ao menos um integrante ativo por equipe para iniciar a edição" entra junto com `iniciar_edicao`.

### 5.4 Pendências menores priorizadas para a revisão final da branch

1. `scripts/gerar_baseline.py` sobrescreve a revisão 0100 sem checar se ela existe. Depois da tarefa 4 o ORM difere do baseline; re-executar o script corromperia a cadeia. Precisa de guarda.
2. O `downgrade()` do baseline derruba todas as tabelas, inclusive as das escolinhas, sem guarda. Mesmo risco da antiga 0001.
3. Faltam testes negativos no harness provando que as normalizações não mascaram diferença real (`VARCHAR(100)` vs `VARCHAR(200)`, `INT` vs `BIGINT`, ENUM com valores diferentes).
4. `tests/test_conftest_isolamento.py` (linha 19) e o plano (linhas 173–174) contêm a senha antiga do MySQL como literal, para verificar que ela não está mais no compose. Depois da rotação da senha ficam inofensivos; o teste deve passar a verificar "nenhuma credencial literal no compose" em vez da senha específica.

As demais pendências menores estão no ledger.

## 6. Ações que dependem de você

1. **Enviar a branch.** Nada desta sessão foi enviado ao remoto (o sandbox não tem acesso às suas chaves SSH):
   ```
   git push -u origin fatia-0/estabilizacao
   ```
2. **Trocar a senha do usuário `dudu` no MySQL local.** Ela estava no histórico do `docker-compose.yml` e também foi digitada nesta conversa. Se a mesma senha for usada em outro lugar, troque lá também.
3. **Variáveis do compose** (só se um dia usar o Docker): adicionar ao `.env` e, sem valores, ao `.env.example`: `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `SECRET_KEY`. O sandbox não consegue escrever o `.env.example`.
4. **Banco de dev.** Ele está na cadeia antiga (até `20260914_0006`). A conferência para `stamp` vai divergir nos pontos listados em `docs/database-migrations.md` (server defaults antigos, constraint de `slug`, `equipes.id_edicao` NOT NULL). Como essas tabelas são todas descartadas pela revisão 0200, as opções são: aceitar as diferenças, rodar `alembic stamp 20261015_0100` e depois `alembic upgrade head -x descartar_competicoes_teste=sim`; ou recriar o banco de dev. Faça backup antes de qualquer um dos dois.
5. **Harness no TiDB (opcional, recomendado antes do deploy):** o mesmo comando, apontando `HARNESS_MYSQL_URL` para o servidor do TiDB Cloud, com um usuário que possa criar e apagar bancos.
