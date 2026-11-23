# Roteiro de Teste – Regressão das Correções (RT01–RT16)

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT17 – Regressão das correções dos roteiros RT01–RT16 e limpeza da massa |
| Versão | V2.0.1 |
| Execução | Antigravity (regressão automatizada E2E/API + validação real no MySQL de dev) |
| Data de execução | 23/11/2026 — **CONCLUÍDO** |
| Ambiente | Branch `frontend/redesign` (commits `9216231`..`5ed56ef`), MySQL de dev + SQLite isolado E2E |
| Cobertura | Todos os 76 defeitos (DF) e decisões de divergência (PD) dos roteiros RT01–RT16 |

## Escopo da regressão

- **Objetivo:** comprovar que todos os defeitos de severidade Alta, Média e Baixa registrados em `RT01`–`RT16` foram eliminados sem regressão nos fluxos anteriores, validar a exclusão física em cascata no MySQL real de desenvolvimento e limpar a massa de teste (eventos `5` e `6`, competições `88` e `89`).
- **Referências:** plano `docs/superpowers/plans/2026-11-23-correcoes-testes-manuais.md`, relatório de integração `docs/superpowers/status/2026-11-23-correcoes-integracao.md` e spec atualizada `docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md`.

## Resumo da execução

| Bloco | Escopo validado | Suíte / Evidência | Resultado | Status |
| --- | --- | --- | --- | --- |
| 001 | Contratos transversais (`numero_jogo`, 422 com detalhes por campo, acentuação e sem enum cru) | `test_contratos_correcoes.py`, `test_contratos_infra.py`, `test_mensagens_acentuadas.py` | Todos verdes | [OK] |
| 002 | Escolinha e Auth — API (`PUT /alunos` parcial/remover foto, WEBP/5 MB, sem órfãos, documentos obrigatórios, prévia de exclusão, 403 troca de senha, perfil coordenador) | `tests/` completo (`test_alunos_correcoes.py`, `test_auth_correcoes.py` + legados) | 98/98 passed | [OK] |
| 003 | Competições — API (eventos em cascata, nomes únicos, vínculo/desvínculo, elencos ativos, agendamento, chaveamento com placar, decisão sem revalidação, artilharia compartilhada, disciplina/histórico/partidas elegíveis) | `competition_tests/` completo | 497 passed, 1 skipped | [OK] |
| 004 | Casca e UI compartilhada (login redirect, troca obrigatória sem ×, 1 toast de erro sem fechar modal, `ConfirmDialog`, foco no avatar, abas sem setas, `Sidebar` coordenador) | `e2e/correcoes-shell.spec.ts` | 9/9 passed | [OK] |
| 005 | Escolinha — Telas (Alunos, Professores, Turmas, Modalidades, Matrículas, Usuários, Dashboard) | `e2e/correcoes-alunos.spec.ts`, `e2e/correcoes-escolinha.spec.ts` | 16/16 passed | [OK] |
| 006 | Competições — Jogos, Súmula, Classificação, Configuração, Visão Geral, Ciclo e Edição | `e2e/correcoes-jogos.spec.ts`, `e2e/correcoes-classificacao.spec.ts`, `e2e/jogos.spec.ts`, `e2e/sumula.spec.ts`, `e2e/classificacao.spec.ts` | Todos verdes | [OK] |
| 007 | Competições — Disciplina, Equipes e Elencos | `e2e/correcoes-disciplina.spec.ts`, `e2e/correcoes-elencos.spec.ts`, `e2e/elencos.spec.ts` | 11/11 passed | [OK] |
| 008 | Eventos e Portal Público (vínculos, exclusão em cascata, selo do evento, chaveamento com placar/pênaltis, ordenação, andamento real, Em breve, telas de erro) | `e2e/correcoes-eventos.spec.ts`, `e2e/correcoes-portal.spec.ts`, `e2e/organizacao.spec.ts`, `e2e/portal.spec.ts` | Todos verdes | [OK] |
| 009 | Build de produção e tipagem | `npx tsc --noEmit` + `npm run build` | 0 erros; 18/18 páginas compiladas | [OK] |
| 010 | Teste real de exclusão física em cascata e limpeza da massa no MySQL de dev | Execução real via `competicoes.servicos.organizacao` no MySQL de dev | Eventos `5` e `6` e competições `88` e `89` removidos em cascata (0 órfãos) | [OK] |

**Totais consolidados:** Backend **595 passed, 1 skipped** · E2E Playwright **100/100 passed** · Defeitos Alta/Média abertos: **0**.

---

## Caso 010 — Limpeza real da massa de teste no MySQL de desenvolvimento

| # | Operação executada | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | `previa_exclusao_evento(5)` e `previa_exclusao_evento(6)` | Retornar contagens exatas de impacto | Ev 5: `2 edições_evento, 1 edição_competicao`; Ev 6: `1 edição_evento, 0 edições_competicao` | [OK] |
| 2 | `excluir_evento(5, "nome errado")` | Recusar com `CONFIRMACAO_INVALIDA` (409) | Recusado: `"Digite o nome do evento exatamente como está cadastrado para confirmar a exclusão."` | [OK] |
| 3 | `excluir_evento(5, "Jogos RT Testes")` | Excluir evento 5, edições 5 e 7, edição 95 e competição 89 em cascata (sem erro 1093 no MySQL) | Evento 5 e Competição 89 (`Copa Evento RT`) removidos fisicamente em cascata | [OK] |
| 4 | `excluir_evento(6, "Jogos RT Testes (duplicado)")` | Excluir evento 6 e edição 6 | Removido fisicamente | [OK] |
| 5 | `excluir_competicao(88)` | Excluir competição 88 e edições 92, 93 e 94 com partidas, súmulas, suspensões, decisões e equipes | Removida fisicamente | [OK] |
| 6 | Conferência SQL pós-limpeza (`eventos` 5/6, `edicoes_evento`, `competicoes` 88/89, `edicoes_competicao`) | 0 registros remanescentes | `0` registros em todas as tabelas consultadas | [OK] |

## Observação sobre `.docx`

- O gerador `gerar_docx_roteiros.js` (mencionado no plano como arquivo de scratchpad externo ao repositório) e as bibliotecas `docx` (Node) / `python-docx` / `pandoc` não estão disponíveis neste ambiente local. Os arquivos `.md` atualizados (`RT01`–`RT17`) estão prontos e versionados; caso deseje regenerar os `.docx` em `docs/testes/roteiros/docx/`, basta disponibilizar o script ou autorizar a instalação de `docx`/`pandoc`.
