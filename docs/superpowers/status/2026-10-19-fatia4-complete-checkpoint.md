# Checkpoint — Revisão das fatias 0–3 e Fatia 4 (Portal Público)

**Data:** 2026-10-19
**Branch:** `fatia-0/estabilizacao` (HEAD `e1ff722`; tudo abaixo está **não commitado**, a pedido do usuário)
**Plano executado:** [`docs/superpowers/plans/2026-10-19-fatia-4-portal-publico.md`](../plans/2026-10-19-fatia-4-portal-publico.md)
**Spec:** [`docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md`](../specs/2026-10-15-competicoes-fatias-design.md), seção 8

## 1. Revisão das fatias 0–3: defeitos corrigidos

Cada defeito tem teste de regressão que falhou antes da correção
(`competition_tests/consolidacao/test_revisao_estabilidade.py`).

| Defeito | Efeito para o usuário | Correção |
|---|---|---|
| Duelo cujos dois lados vêm de folga nunca recebia partida (ex.: mata-mata com 5 ou 6 equipes) | Semifinal sem jogo; edição impossível de finalizar | `disputa._materializar_duelos_definidos` cria jogos para qualquer duelo com as duas vagas resolvidas |
| `final_unica` ignorada em chave de ida e volta | Final criada com dois jogos; com um jogo só, nunca resolvia | `ida_volta` do duelo FINAL = `ida_volta and not final_unica` na geração |
| Resultado simples aceito em partida finalizada ou cancelada | Contornava a reabertura justificada e as travas do grafo (descendente já iniciado) | 409; correção passa por `reabrir_partida` |
| Resultado simples não validava pênaltis | Empate eliminatório sem pênaltis travava o duelo; pênaltis aceitos em jogo de liga | Validação única `partidas._validar_penaltis`, usada também por `finalizar_partida` |
| Cruzamento não suportado / classificados maior que o grupo / distribuição manual com equipe de outra edição | 500 ou chave impossível | 422 com campos afetados |
| Excluir edição em rascunho com equipes | 500 (IntegrityError) | 409 "Remova as equipes inscritas" |
| Edição cancelada não podia ser despublicada | Contraria "publicação independente do estado" | Publicar/despublicar em qualquer estado |
| Duas reconciliações disciplinares divergentes (`partidas` × `disciplina`) | Ao finalizar outro jogo, revisão já resolvida pelo coordenador voltava a `EM_REVISAO`; uma apagava e a outra cancelava suspensões | `partidas._reconciliar_sancoes_edicao` delega à implementação única; sem lastro e sem cumprimento → `CANCELADA` com chave liberada |
| Criar equipe/inscrever sem bloquear a edição | Corrida com geração de tabela (spec 5.8) | `bloquear_edicao` |
| `tests/test_routers_all.py` e `test_security.py` faziam `importlib.reload` sem restaurar | `pytest` da raiz (como no CI) falhava 36 testes de competições | Estado dos módulos restaurado após o reload |
| `migration_tests` esperava head `0300` | 1 falha permanente | Head `0400` |
| E2E `elencos.spec.ts` criava aluno via `execSync` sem `DATABASE_URL` | Fora do sandbox gravaria no banco de desenvolvimento (via `.env`) | `DATABASE_URL` do `e2e.db` explícito |
| Botão "Editar Placar" em jogo finalizado | Agora seria 409 | Removido; correção pelo "Reabrir Jogo" |

Testes antigos que codificavam o comportamento defeituoso foram ajustados com
justificativa: `test_gerar_tabela_mata_mata_com_folgas` (3 partidas, não 2),
`test_re_registrar_resultado_exige_reabertura_e_substitui_ocorrencias`,
`test_remocao_cartao_apos_cumprimento_coloca_suspensao_em_revisao` (cancelada, não apagada).

### Decisões do usuário sobre as pendências (2026-10-19)

Registradas na spec, seção 3 item 7.

- **Gerar tabela → `EM_ANDAMENTO`:** mantido como está.
- **GET do painel disciplinar grava:** mantido.
- **Exclusão em cascata — implementado:** `DELETE /competicoes/edicoes/{id}` exclui em qualquer estado,
  apagando equipes, elencos, grupos, duelos/vagas, partidas, ocorrências, requisições, suspensões,
  cumprimentos e decisões; competidores e auditoria ficam (vínculo da auditoria vira NULL).
  `DELETE /competicoes/equipes/{id}` (novo) apaga a equipe e seus atletas, só com a edição em rascunho
  (com tabela gerada → 409). A ordem de exclusão fica em `app/competicoes/servicos/exclusao.py`, explícita
  no serviço (independe de `ON DELETE CASCADE`, igual em MySQL/TiDB/SQLite). Testes:
  `competition_tests/consolidacao/test_exclusao_cascata.py`. Ainda sem botões na interface
  (cliente `excluirEdicao`/`excluirEquipe` pronto) — fica para a etapa de frontend.
- **`/test-elencos` fora do build de produção — implementado:** a página virou `page.e2e.tsx`, que o Next
  só reconhece com `E2E_HARNESS=1` (`next.config.ts`); o Playwright sobe o `next dev` com essa variável.
- **Paginação:** adiada para a etapa de frontend.
- Ainda em aberto, sem decisão: campos de compatibilidade herdados do V2 (`status`, `data_hora`, `campo`,
  W.O. que inventa 3×0 com `minuto=0`).

## 2. Fatia 4 — Portal Público

Backend (`/competicoes/publico/*`, sem autenticação, somente leitura):
`competicoes`, `competicoes/{slug}`, `eventos`, `eventos/{slug}`, `edicoes/{id}`,
`edicoes/{id}/partidas|classificacao|chaveamento|artilharia`.
Schemas em `app/competicoes/contratos/publico.py` com `ALLOWLIST_PUBLICA` campo a campo.

Frontend: `/` (vitrine de competições e eventos, substitui o portal legado que chamava endpoint
inexistente), `/publico/competicao/[slug]`, `/publico/evento/[slug]` (seletor só com edições que têm
disputa publicada), `/publico/edicao/[id]` (abas Jogos, Classificação, Chaveamento, Artilharia, Equipes).
SWR com atualização a cada 30 s e ao voltar à aba; `EstadoCarga` distingue carregando, não encontrado,
erro sem dados (bloco com "Tentar novamente") e erro com dados (aviso, dados mantidos).

### Portão de saída (medido nesta sessão)

- Publicação independente do estado; edição privada e inexistente → mesmo 404 (`test_publico_api.py`).
- Allowlist conferida campo a campo; teste falha se surgir campo ou schema sem decisão (`test_publico_allowlist.py`).
- Histórico: duas edições da mesma competição navegáveis sem misturar equipes nem resultados.
- Falha de rede → erro com retentativa; falha ao atualizar mantém dados (`frontend/e2e/portal.spec.ts`).
- `DATABASE_URL=sqlite:///:memory: SECRET_KEY=x .venv/bin/python -m pytest tests migration_tests competition_tests -q` → **466 passed, 1 skipped** (após a exclusão em cascata) (o skip é o teste que exige MySQL).
- `npx playwright test` (banco E2E limpo) → **25 passed**.
- `npx tsc --noEmit` → 0 erros; `npm run build` → sucesso (rotas `/publico/*` geradas).
- `git diff --check` nos caminhos alterados → limpo.
- **Não executado:** harness MySQL (`scripts/testar_mysql_competicoes.py`) — exige credenciais do `.env`,
  que o sandbox não lê. A fatia 4 não altera schema.

## 3. Complemento (19/10, após as decisões)

- **Competição como principal:** `DELETE /competicoes/competicoes/{id}` exclui a competição com todas as
  edições; botões "Excluir competição" (página da competição) e "Excluir Edição" (painel da edição), com
  confirmação digitando o nome. Cancelar edição mantém tudo; "Nova edição" cria outra na mesma competição.
- **MySQL:** a exclusão usava `DELETE ... WHERE id IN (SELECT ... mesma tabela)`, recusado pelo MySQL
  (erro 1093) e aceito pelo SQLite. Corrigido (IDs lidos antes) e protegido por teste que reprova
  qualquer `DELETE` com subconsulta. Validado no MySQL local pela limpeza dos dados de E2E.
- **E2E isolado:** portas 8001/3001, banco recriado a cada execução, sem reaproveitar servidor.
  Limpeza do lixo antigo: `scripts/limpar_dados_e2e.py` (executado pelo usuário: 82 competições, 4 eventos
  e 163 competidores de teste removidos do banco local).
- Documentação: `docs/testes/competicoes-testes.md` e `docs/testes/competicoes_testes.pdf`.
- Medido: pytest raiz **472 passed, 1 skipped**; Playwright **26 passed**; `tsc` 0; build OK.

