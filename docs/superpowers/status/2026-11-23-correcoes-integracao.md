# Integração Onda 2 — Correções dos Testes Manuais (RT01–RT16)

- **Data:** 2026-11-23
- **Branch:** `frontend/redesign` (base `b10ab55`)
- **Sessão `collab`:** `4e5ae603d890`

## Verificação completa (100% verde)

| Suíte | Comando | Resultado |
| :--- | :--- | :--- |
| Backend completo | `.venv/bin/pytest -q` | **595 passed, 1 skipped** |
| TypeScript | `cd frontend && npx tsc --noEmit` | **0 erros** |
| Build de produção | `cd frontend && npm run build` | **Compiled successfully (18/18 páginas)** |
| Playwright E2E completo | `cd frontend && npx playwright test` (96/100 + 9/9 após ajustes em `PainelEdicao.tsx` e `elencos.spec.ts`) | **100/100 passed** |
| Higiene do diff | `git diff --check` | **Limpo (0 problemas)** |

## Revisões cruzadas concluídas

- `L4` (`T6`, `T7`) e `L6` (`T9`, `T10`): revisadas pelo `claude` (msg `#55`) e ajustes aplicados e verificados (`98 passed` em `tests/`).
- `L8` (`T13`, `T14`) e `L9` (`T15`, `T16`): revisadas e aprovadas pelo `claude` (msg `#85`); nits 1, 2 e 4 aplicados (`tsc` 0).
- `T0.2`, `T2b`, `T1`, `T3`, `T5`: revisadas pelo `antigravity` (msg `#63`); ressalva Média em `disciplina.py` (`origem_presente` para acúmulo) e Baixa em `exclusao.py` corrigidas pelo `claude` (msg `#84`).
- `T2`, `T4`, `T8`, `T11`, `T12`: revisadas e aprovadas pelo `antigravity` (msgs `#71`, `#75`, `#79`, `#82`).

## Ajustes de integração feitos na `T17`

- `frontend/src/components/competicoes/organizacao/PainelEdicao.tsx`: optional chaining em `edicao.configuracao?.formato` para evitar quebra em respostas parciais/mocks legados (`sumula.spec.ts`).
- `frontend/e2e/elencos.spec.ts`: alinhado aos novos comportamentos aprovados `PD-RT11-01` (botão desabilitado `"Já inscrito"`) e `DF-RT11-02` / `PD-RT11-02` (seletor por nome em `CopiarElenco`).
- `frontend/e2e/organizacao.spec.ts`: alinhado ao botão `"Nova competição"` (`T15`) e mensagens acentuadas (`T0.2`).
