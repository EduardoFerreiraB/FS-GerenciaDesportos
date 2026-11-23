# Quadro — Correções dos testes manuais (RT01–RT16)

Plano: `docs/superpowers/plans/2026-11-23-correcoes-testes-manuais.md` · Sessão collab `4e5ae603d890` (estado das tasks: `collab_status`).

## Baseline (23/11/2026, T0.1)

| Verificação | Resultado | Observação |
| --- | --- | --- |
| `pytest tests migration_tests competition_tests` (SQLite em memória) | **486 passed, 1 skipped** | Medido com a T7 (Antigravity) já aplicada e a T6 em andamento |
| `npx tsc --noEmit` | **0 erros** | |
| `npm run build` | não medido nesta rodada (cota) | Último registro: OK (fatia 4) |
| Playwright completo | não medido nesta rodada (cota) | Último registro: 51/51 (redesign, 16/11) |
| Playwright em paralelo | **OK** | `portal.spec.ts` (8011/3011) 6/6 e `estrutura.spec.ts` (8012/3012) 4/4 ao mesmo tempo |

## Infra de E2E paralelo (T0.1)

- Portas por variável: `E2E_PORTA_API` (padrão 8001) e `E2E_PORTA_WEB` (padrão 3001) — fonte única em `frontend/e2e/helpers/ambiente.ts`.
- Por execução: banco `frontend/e2e-<api>.db`, build `.next-e2e-<web>`, tsconfig `tsconfig.e2e-<web>.json` (gerado; herda o `tsconfig.json` e evita que o `next dev` altere o arquivo versionado). Todos ignorados pelo git.
- Portas por trilha: L5 8011/3011 · L6 8012/3012 · L7 8013/3013 · L8 8014/3014 · L9 8015/3015.

## Decisões de PD confirmadas no Gate 1

Todas as recomendações da seção 2 do plano foram aprovadas pelo usuário, com destaque para:
- **PD-RT05-03:** a API exige atestado e documento na criação de aluno.
- **PD-RT09-03:** nome de competição único globalmente.
- PD-RT15-01 e PD-RT15-02 (decididos antes): exclusão de evento em cascata segura; nomes de evento únicos.
