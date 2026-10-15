# Checkpoint — tarefa 5 da consolidação de competições

**Data:** 2026-10-15
**Branch:** `fatia-0/estabilizacao`
**HEAD:** `5bbf609`
**Estado:** pausado a pedido do usuário após a tarefa 5. Árvore de trabalho limpa.

Este checkpoint sucede [o checkpoint das tarefas 0–4](2026-10-15-fatias-0-1-checkpoint.md). A [spec aprovada](../specs/2026-10-15-competicoes-fatias-design.md), o [plano em execução](../plans/2026-10-15-fatias-0-1-fundacao-competicoes.md) e o [ledger atualizado](2026-10-15-fatias-0-1-ledger.md) continuam sendo as fontes de requisitos e decisões. O [relatório detalhado da tarefa 5](2026-10-15-task5-report.md) registra a evidência de TDD e testes.

## Trabalho concluído

| Tarefa | Estado | Commits |
| --- | --- | --- |
| 0–4 | Concluídas e revisadas no checkpoint anterior | até `0a9dd10` |
| 5 — contratos, transações e esqueleto da API | Concluída, revisão inicial e duas rodadas de correção aprovadas | `40334b2`, `761b95f`, `5bbf609` |
| 6–8 — onda E paralela | Subagentes interrompidos antes de editar arquivos | nenhum |
| 9–11 | Não iniciadas | nenhum |

A tarefa 5 criou contratos Pydantic tipados para configuração, organização e elencos; infraestrutura de transação, bloqueio, revisão e auditoria; erros de domínio; roteador central `/competicoes` com subroteadores vazios; e fixtures compartilhadas para os testes HTTP. O envelope `{codigo, mensagem, campos}` é aplicado às rotas de competições, inclusive nos erros de validação e autenticação. As rotas de escolinhas preservam o formato anterior `detail`.

As rotas operacionais e as telas novas **ainda não existem**. O módulo de competições local continua indisponível até as próximas tarefas; o roteador central vazio é apenas a base para elas. Nenhuma migração foi executada no banco de desenvolvimento ou de produção.

## Evidência desta retomada

- 59 testes focados da tarefa 5 passaram.
- 94 testes de `competition_tests/consolidacao` passaram.
- 84 testes de `tests` passaram.
- `git diff --check` ficou limpo; as revisões independentes não deixaram achados abertos na tarefa 5.

As suítes acima foram executadas em **processos separados**, com SQLite descartável. No sandbox, testes com `TestClient` travam no portal AnyIO; as execuções HTTP que embasam os números foram feitas fora dele, ainda com banco descartável. Uma execução combinada das suítes expôs contaminação de estado em `tests/test_routers_all.py::test_database_url_not_set`, que recarrega `database`. A coleta padrão também encontra o arquivo versionado `scratch/debug_test.py`, já removido no commit remoto posterior `d6a9095`. Ambos os ajustes pertencem ao portão de integração da tarefa 11; nenhuma falha foi ocultada por `skip`.

## Retomada

Retomar **pela onda E**, tarefas 6 (organização), 7 (elencos) e 8 (cliente TypeScript), em paralelo e com arquivos disjuntos. As interfaces da tarefa 5 estão fixadas no HEAD `5bbf609`; os briefs correspondentes estão no workspace ignorado `.superpowers/sdd/2026-10-15-fatias-0-1-fundacao-competicoes/`. Se esse workspace não existir numa nova cópia, o ledger versionado acima preserva as decisões R1–R26 e o plano contém os requisitos completos.

Depois da onda E, seguir as tarefas 9 e 10 em paralelo e a tarefa 11 de integração. Preservar as restrições do plano: não alterar `.env`, não testar no banco de desenvolvimento/produção e não fazer merge em `main` sem decisão do usuário.
