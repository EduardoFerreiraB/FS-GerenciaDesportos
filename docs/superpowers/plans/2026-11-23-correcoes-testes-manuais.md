# Correções dos Testes Manuais (RT01–RT16) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir todos os defeitos (DF) e aplicar as decisões sobre as divergências (PD) registrados nos roteiros manuais RT01–RT16, com testes automatizados que travem cada correção, executando em ondas de subagentes paralelos com posse exclusiva de arquivos e revisão cruzada pelo Gemini/Antigravity.

**Architecture:** uma Onda 0 sequencial cria a infraestrutura de orquestração e os contratos transversais (número do jogo, erro com detalhes por campo, leitura de erro no front, portas de E2E configuráveis). A Onda 1 roda 9 trilhas (lanes) em paralelo, cada uma dona de um conjunto disjunto de arquivos, em worktrees próprios. A Onda 2 integra, roda a suíte completa e o E2E, atualiza a spec e refaz a verificação manual pelo Chrome.

**Tech Stack:** FastAPI + SQLAlchemy (Python 3.14, pytest, MySQL/SQLite), Next.js App Router + React + Tailwind v4 + Radix (TypeScript, Playwright), Claude Code (orquestrador e subagentes), Gemini CLI `gemini` 0.47 e Antigravity CLI `agy` (revisão cruzada headless).

**Spec:** `docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md` (competições, eventos, portal) + os roteiros em `docs/testes/roteiros/RT01…RT16-*.md` (fonte dos DF/PD; cada linha "Obtido" é o comportamento a eliminar). O design visual vigente está em `docs/superpowers/plans/2026-10-19-redesign-frontend.md`.

## Global Constraints

- Nenhum commit é feito por agente: cada trilha entrega a lista de arquivos do seu **bloco de commit** e o usuário (conta `EduardoFerreiraB`) commita. Nunca incluir `Co-Authored-By` nem "Generated with Claude Code".
- Celular/responsividade fora do escopo (PD-RT08-02..04 ficam registrados, não implementados).
- Texto voltado ao usuário em português com acentuação correta. Nenhum enum cru (`EM_ANDAMENTO`, `SEMIFINAL`) e nenhum id interno ("jogo #94") em mensagem, título ou rótulo.
- Erros da API de competições mantêm o contrato `ErroResposta {codigo, mensagem, campos}`; o campo novo `detalhes` é aditivo.
- Ações destrutivas ou irreversíveis (excluir, finalizar edição, remover ocorrência, inativar integrante) sempre com diálogo de confirmação; correções após finalização exigem motivo (spec 7.2).
- Respostas públicas continuam pela allowlist de `app/competicoes/contratos/publico.py`; todo campo novo público entra na allowlist e no teste de allowlist.
- Toda trilha só edita os arquivos listados como seus; precisou de arquivo de outra trilha → `SendMessage` ao dono (ou ao orquestrador), nunca edição direta.
- E2E nunca usa o banco de desenvolvimento; cada trilha usa as portas da tabela de trilhas.
- Comandos de verificação (raiz do repositório):
  - Backend: `DATABASE_URL=sqlite:///:memory: SECRET_KEY=x .venv/bin/python -m pytest tests migration_tests competition_tests -q`
  - Tipos: `cd frontend && npx tsc --noEmit`
  - Build: `cd frontend && npm run build` (no sandbox liberar `fonts.googleapis.com` e `fonts.gstatic.com`)
  - E2E: `cd frontend && E2E_PORTA_API=<p> E2E_PORTA_WEB=<w> npx playwright test <spec>`
- Baseline registrado em 2026-10-19: pytest 472 passed / 1 skipped; Playwright 26 passed; `tsc` 0 erros; build OK. Nenhuma trilha pode terminar com menos testes passando do que o baseline medido na Onda 0.

## Review Focus

1. **Exclusão de evento em cascata com dados reais**: evento com edição de evento → edição de competição em andamento → partidas, súmulas, suspensões, decisões e publicação. Esperado: some tudo, nada órfão (contagem zero em cada tabela filha), e a confirmação exige digitar o nome exato. Teste em T1 (`test_excluir_evento_apaga_toda_a_arvore`).
2. **Concorrência de cliques nas ações novas de confirmação** (duplo clique em "Finalizar edição", "Excluir evento", "Remover ocorrência"). Esperado: uma única operação; o botão fica desabilitado enquanto a requisição corre. Teste em T11 e T15 (`confirmar desabilita durante envio`).
3. **Numeração de jogos depois de reabrir/encerrar grupos** (partidas de mata-mata criadas e removidas). Esperado: `numero_jogo` continua sequencial e estável para partidas que não mudaram. Teste em T0.2 (`test_numero_jogo_estavel_apos_reabrir`).
4. **Usuário com troca de senha obrigatória chamando a API diretamente** (token válido antigo). Esperado: 403 `SENHA_TROCA_OBRIGATORIA` em tudo, exceto trocar senha, `GET /me` e logout. Teste em T7.
5. **Mensagens de erro vindas da API em formulários com campos não mapeados** (campo do backend sem input correspondente na tela). Esperado: a mensagem aparece no alerta do topo do formulário, nunca é descartada. Teste em T0.2 (`extrairErro` com campo desconhecido) e no E2E da T15.

---

## 1. Orquestração Claude + Gemini/Antigravity

### 1.0 Acordo da sessão collab `4e5ae603d890` (23/11/2026) — prevalece sobre 1.1–1.4 onde divergir

Execução pelo protocolo `.agents/collab/PROTOCOL.md` (MCP `collab`), com dois agentes pares: `claude` e `antigravity`. Cada um pode usar subagentes próprios dentro das suas trilhas, sempre sob a sua identidade e com `collab_lock` nos arquivos.

| Agente | Tasks | Trilhas |
| --- | --- | --- |
| `claude` | T0.1, T0.2, T1, T2b, T2, T3, T4, T5, T8, T11, T12, T17, T18, T19 | Onda 0, L1, L2, L3, L5, L7, Onda 2 + arquivos de contrato compartilhados e migrações |
| `antigravity` | T6, T7, T9, T10, T13, T14, T15, T16 | L4, L6, L8, L9 (ordem: L4 → L6 → L8 → L9, conforme os contratos chegam); revisa as trilhas do `claude` e divide o reteste RT17 |

- **Sem worktrees:** os dois editam direto no branch `frontend/redesign`, com posse garantida por `collab_lock`.
- **Regras de convivência no mesmo working tree:** (1) ninguém roda `git stash/checkout/reset/restore/clean` nem formatador em massa; (2) commits só após Gate 2, um de cada vez, com `git add <arquivos da trilha>` explícitos; (3) na Onda 1 cada um roda só as próprias suítes — erro de `tsc` em arquivo de trilha alheia em andamento não bloqueia; suíte completa só na Onda 2; (4) migrações e arquivos de contrato compartilhados: só o `claude`, a pedido via `collab_post`.
- **Revisão cruzada:** substitui o script headless `revisar_trilha.sh` — cada agente revisa as trilhas do outro via `collab_post(kind="review")` antes do `collab_request_commit`.
- **Commits:** por trilha, após revisão cruzada e aprovação do usuário (Gate 2), sem coautoria. `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.gemini/`, `.agents/collab/` e `.collab/` ficam fora do git.
- **E2E paralelo:** distDir `.next-e2e-${E2E_PORTA_WEB}` e banco `frontend/e2e-${E2E_PORTA_API}.db` por trilha (T0.1).
- **Contratos antecipados na T0.2:** `formatarTelefone`/`formatarCpf` em `lib/formatos.ts` e os tipos/funções de `services/competicoes.ts`/`types/competicoes.ts` que T1, T2b e T5 vão expor, para L8/L9 compilarem antes dos endpoints ficarem prontos.
- **Review Focus extra (Antigravity):** na T6, cadastro recusado por erro de banco depois do upload também não deixa arquivo órfão.
- **Para confirmar no Gate 1:** PD-RT05-03 (atestado/documento obrigatórios na criação de aluno via API) e PD-RT09-03 (nome de competição único global — recomendado — ou por modalidade).

### 1.1 Papéis

| Papel | Quem | Faz | Não faz |
| --- | --- | --- | --- |
| Orquestrador | Claude Code (sessão principal) | Abre as ondas, cria os worktrees, despacha um subagente por trilha, roteia `SendMessage`, roda a revisão cruzada, integra, roda E2E serial, entrega os blocos de commit | Implementar código de trilha |
| Implementador | Subagente Claude por trilha (`isolation: "worktree"`) | Executa as tasks da sua trilha com TDD, só nos seus arquivos | Editar arquivo de outra trilha; commitar |
| Revisor de task | Subagente Claude novo por task (fluxo da skill subagent-driven-development) | Confere task contra o plano e a spec | Corrigir |
| Revisor cruzado | Gemini (`agy -p --mode plan`, com fallback `gemini -p --approval-mode plan`) | Lê o diff da trilha e devolve achados em JSON (somente leitura) | Editar arquivos |
| Trilha opcional "humano no loop" | Antigravity IDE, se o usuário quiser acompanhar uma trilha visualmente | Pode assumir a trilha L9 (Eventos + Portal) inteira no worktree dela | Tocar arquivos fora de L9 |

Por que essa divisão: dois agentes editando o mesmo arquivo é a principal fonte de retrabalho; com posse exclusiva por trilha e o Gemini como revisor somente leitura, o Gemini agrega um segundo par de olhos de outro fornecedor sem criar conflito de merge. A coordenação acontece por arquivos no repositório (plano com checkboxes, quadro de status), que os dois lados leem.

### 1.2 Trilhas, posse de arquivos e portas de E2E

| Trilha | Escopo | Dono exclusivo de | Portas E2E (API/Web) |
| --- | --- | --- | --- |
| L1 Back-Organização | Eventos, competições, elencos (backend) | `app/competicoes/servicos/organizacao.py`, `servicos/elencos.py`, `servicos/exclusao.py`, `api/organizacao.py`, `api/elencos.py`, `contratos/organizacao.py`, `contratos/elencos.py` | — |
| L2 Back-Disputa | Agendamento, chaveamento, classificação, artilharia, público | `servicos/partidas.py`, `servicos/disputa.py`, `servicos/classificacao.py`, `servicos/publico.py`, `servicos/motores/*`, `api/partidas.py`, `api/disputa.py`, `api/classificacao.py`, `api/publico.py`, `contratos/disputa.py`, `contratos/classificacao.py`, `contratos/publico.py` | — |
| L3 Back-Súmula/Disciplina | Ocorrências, suspensões | `servicos/sumula.py`, `servicos/disciplina.py`, `api/sumula.py`, `api/disciplina.py`, `contratos/sumula.py`, `contratos/disciplina.py` | — |
| L4 Back-Escolinha | Alunos, usuários/auth | `app/routers/*.py`, `app/schemas.py`, `app/security.py`, `app/utils.py` | — |
| L5 Front-Shell | Componentes compartilhados e casca | `frontend/src/components/ui/*`, `components/layout/*`, `components/auth/*`, `context/*`, `lib/api.ts` | 8011/3011 |
| L6 Front-Escolinha | Telas de alunos a dashboard | `frontend/src/app/dashboard/{alunos,professores,turmas,modalidades,matriculas,usuarios}/**`, `app/dashboard/page.tsx`, `components/forms/*` | 8012/3012 |
| L7 Front-Jogos/Classificação | Jogos, súmula, chaveamento, classificação, configuração, ciclo | `components/competicoes/{disputa,classificacao,visual}/*`, `components/competicoes/organizacao/{PainelEdicao,VisaoGeralEdicao,FormularioConfiguracao,CartoesOrganizacao}.tsx`, `app/dashboard/competicoes/**` | 8013/3013 |
| L8 Front-Disciplina/Elencos | Disciplina e equipes | `components/competicoes/{disciplina,elencos}/*` | 8014/3014 |
| L9 Front-Eventos/Portal | Eventos (admin) e portal público | `app/dashboard/eventos/**`, `components/competicoes/organizacao/{ModalNovoEvento,ModalNovaCompeticao,ModalConfirmarExclusao}.tsx`, `components/publico/*`, `app/publico/**`, `app/eventos-publico/**`, `app/page.tsx` | 8015/3015 |

Arquivos compartilhados de contrato (`frontend/src/services/competicoes.ts`, `frontend/src/types/competicoes.ts`, `frontend/src/lib/rotulos.ts`, `frontend/src/lib/formatos.ts`, `app/competicoes/erros.py`, `app/competicoes/modelos/*`, `alembic/versions/*`) **pertencem ao orquestrador**. Uma trilha que precisa de função/tipo novo neles manda `SendMessage` ao orquestrador com a assinatura exata; o orquestrador aplica e avisa as trilhas consumidoras. Migrações Alembic: só o orquestrador cria, uma por onda, na ordem pedida pelas trilhas.

### 1.3 Mensagens entre trilhas (contratos que se conversam)

| De → Para | Mensagem | Quando |
| --- | --- | --- |
| L1 → L9 | "`EdicaoEventoDetalhe.competicoes`, `POST /edicoes-evento/{id}/vinculos`, `DELETE /eventos/{id}` prontos" | Ao terminar T1 |
| L2 → L7, L9 | "`vagas[].nome_grupo`, `duelos[].placar` e `artilheiros[].posicao` compartilhada prontos" | Ao terminar T3/T4 |
| L3 → L8 | "`GET /suspensoes/{id}/partidas-elegiveis`, `responsavel_nome`, `historico[]` prontos" | Ao terminar T5 |
| L3 → L7 | "`DELETE /ocorrencias/{id}` exige `motivo` quando a partida já foi finalizada antes" | Ao terminar T5 |
| L4 → L6 | "`PUT /alunos/{id}` aceita `null` e `remover_foto`; WEBP e 5 MB aplicados" | Ao terminar T6 |
| L5 → L6, L7, L8, L9 | "`useNotificacao().sucesso/erro` sem empilhar e sem fechar modal; `ConfirmDialog` com `confirmarTexto`" | Ao terminar T8 (as telas podem começar antes usando a API atual e só trocar a chamada depois) |

Enquanto o contrato não chega, a trilha consumidora escreve o teste E2E contra o contrato do plano e segue para a próxima task; volta quando receber a mensagem.

### 1.4 Ondas

```
Onda 0 (sequencial, orquestrador): T0.1 → T0.2
Onda 1 (paralelo):  L1: T1, T2b | L2: T2, T3, T4 | L3: T5 | L4: T6, T7
                    L5: T8 | L6: T9, T10 | L7: T11, T12 | L8: T13, T14 | L9: T15, T16
                    (backends L1–L4 começam juntos; frontends L5–L9 começam juntos e consomem contratos à medida que chegam)
Onda 2 (sequencial, orquestrador): T17 integração e revisão cruzada → T18 spec e decisões → T19 reteste manual (Chrome) e regeneração dos .docx
```

---

## 2. Decisões sobre as divergências (PD)

As duas primeiras já foram decididas pelo usuário em 23/11/2026. As demais são **recomendações**: o orquestrador apresenta a tabela ao usuário antes da Onda 1 e só despacha as tasks marcadas depois da confirmação (linhas recusadas viram "fora do escopo" e a task correspondente pula o item).

| PD | Decisão | Task |
| --- | --- | --- |
| PD-RT15-01 | **Decidido:** excluir evento em cascata (edições de evento, edições de competição vinculadas e todos os dados delas), com confirmação reforçada (digitar o nome do evento) e exclusão física verificada | T1, T15 |
| PD-RT15-02 | **Decidido:** nomes de evento únicos (criação e edição) | T1, T15 |
| PD-RT09-03 | Recomendado: nomes de competição também únicos (mesma regra do evento) | T1 |
| PD-RT01-01, RT01-02, RT02-01 | Aceitar o novo design (estado vazio sem tabela; validação por campo) | — |
| PD-RT01-03, PD-RT03-01 | Avisar no diálogo de exclusão de aluno/turma quantas matrículas e presenças serão apagadas (não bloquear) | T6, T9, T10 |
| PD-RT01-04 | Renomear o botão "Nova matrícula" da tela de Alunos para "Novo aluno" | T9 |
| PD-RT01-05 | Foto montada com `NEXT_PUBLIC_API_URL` | T9 |
| PD-RT02-02 | Busca de professores por nome, CPF e usuário | T10 |
| PD-RT02-03, PD-RT04-03 | Mostrar o `detail` da API nos bloqueios de exclusão | T10 |
| PD-RT02-04 | Fora do escopo (coberto pela tela de Usuários) | — |
| PD-RT03-02 | Validar horário invertido também na tela | T10 |
| PD-RT04-01 | Aceitar o botão do topo | — |
| PD-RT04-02 | Incluir edição de modalidade (a API já existe) | T10 |
| PD-RT05-01 | Diálogo de matrícula marca "Já matriculado" e desabilita a turma | T10 |
| PD-RT05-02 | Cancelar matrícula pela tela do aluno (com DF-RT01-01) | T9 |
| PD-RT05-03 | API exige atestado e documento na **criação** de aluno | T6 |
| PD-RT06-01 | Incluir edição de perfil na tela de Usuários | T10 |
| PD-RT06-02 | API bloqueia usuário com troca de senha pendente | T7 |
| PD-RT06-03 | Ocultar "Excluir" na linha da própria conta | T10 |
| PD-RT06-04 | Coordenador acessa Usuários limitado a criar professor/assistente | T7, T8, T10 |
| PD-RT07-01 | Rótulo "Modalidades" (contagem total) | T10 |
| PD-RT07-02 | Nomes de alunos recentes viram links | T10 |
| PD-RT08-01 | Gráfico do dashboard com `aria-label` e sem camada de teclado do Recharts | T10 |
| PD-RT08-02..04 | Fora do escopo (celular) | — |
| PD-RT09-01 | Formulários de competição/evento com mensagem abaixo do campo (sem validação nativa do navegador) | T12, T15 |
| PD-RT09-02, PD-RT13-02 | Expor na configuração a ordem dos desempates e os parâmetros disciplinares completos (= DF-RT13-01) | T12 |
| PD-RT10-01, PD-RT15-07 | Telas de edição de competição (nome, descrição), edição de competição (identificação, categoria, datas) e evento (nome, descrição, período das edições) | T12, T15 |
| PD-RT11-01 | Busca de competidor e lista de alunos marcam "Já inscrito" | T14 |
| PD-RT11-02 | Cópia de elenco leva só integrantes ativos | T2b |
| PD-RT11-03 | Editar camisa/posição do integrante, nome/sigla da equipe e nome esportivo do competidor | T2b, T14 |
| PD-RT11-04 | Aceitar (competidores são permanentes) | — |
| PD-RT12-01 | Atualizar a spec: gerar tabela inicia a edição; ajuste manual de grupos fora do escopo | T18 |
| PD-RT12-02 | Visão geral mostra campeão e pódio quando o mata-mata termina | T12 |
| PD-RT12-03 | "Agendar" oculto em jogo finalizado (e a API recusa) | T2, T11 |
| PD-RT13-01 | Manter invalidação por qualquer alteração de resultado, mas **sem revalidação automática**: decisão invalidada nunca volta a valer; exige nova decisão. Atualizar a spec 7.3 | T4, T18 |
| PD-RT14-01 | Proibir "Cumprida" sem cumprimentos; encerramento administrativo usa "Cancelada" com justificativa | T5 |

---

## 3. Rastreabilidade DF → Task

| Task | DF cobertos |
| --- | --- |
| T0.2 | DF-RT09-01, DF-RT13-11, DF-RT10-01 (handler), DF-RT12-05, DF-RT12-07, DF-RT14-01 (contrato do número) |
| T1 | DF-RT15-01 (API), DF-RT15-02 (API), DF-RT15-05 (API), DF-RT15-08, DF-RT10-01 (mensagens de L1) |
| T2 | DF-RT12-04, DF-RT13-09, DF-RT13-07 (mensagem) |
| T2b | DF-RT11-02 (API) |
| T3 | DF-RT12-03, DF-RT16-01, DF-RT16-06 |
| T4 | DF-RT12-11, DF-RT13-04, DF-RT13-06, DF-RT14-04, DF-RT12-13 (API) |
| T5 | DF-RT14-02, DF-RT14-05, DF-RT14-06, DF-RT14-07 (API) |
| T6 | DF-RT01-02, DF-RT01-03, DF-RT01-07, DF-RT01-08, DF-RT01-10 |
| T7 | DF-RT06-02 (API) |
| T8 | DF-RT08-01, DF-RT08-04, DF-RT02-03, DF-RT04-02, DF-RT03-01, DF-RT06-01 |
| T9 | DF-RT01-01, DF-RT01-04, DF-RT01-05, DF-RT01-06, DF-RT01-09 |
| T10 | DF-RT02-01, DF-RT02-02, DF-RT03-02, DF-RT04-01, DF-RT06-02, DF-RT07-01, DF-RT07-02, DF-RT07-03 |
| T11 | DF-RT12-01, DF-RT12-02, DF-RT12-05, DF-RT12-06, DF-RT12-07, DF-RT12-08, DF-RT12-09, DF-RT12-10, DF-RT12-12, DF-RT12-14, DF-RT14-07 (tela), DF-RT14-08 |
| T12 | DF-RT13-01, DF-RT13-02, DF-RT13-03, DF-RT13-05, DF-RT13-07 (tela), DF-RT13-08, DF-RT13-10, DF-RT12-13, DF-RT10-02, DF-RT13-04 (tela) |
| T13 | DF-RT14-01, DF-RT14-02 (tela), DF-RT14-03, DF-RT14-04 (tela), DF-RT14-05 (tela), DF-RT14-06 (tela) |
| T14 | DF-RT11-01, DF-RT11-02 (tela) |
| T15 | DF-RT15-01..07 (tela) |
| T16 | DF-RT16-01 (tela), DF-RT16-02, DF-RT16-03, DF-RT16-04, DF-RT16-05 |

---

## Onda 0 — orquestrador, sequencial

### Task 0.1: Infraestrutura de orquestração e baseline

**Files** (instruções de agente e o MCP `collab` já existem e ficam fora do git — ver 1.0):
- Modify: `frontend/playwright.config.ts` — `PORTA_API = Number(process.env.E2E_PORTA_API ?? 8001)`, `PORTA_WEB = Number(process.env.E2E_PORTA_WEB ?? 3001)`, banco `frontend/e2e-${PORTA_API}.db`; o `webServer` do Next passa `E2E_PORTA_WEB` adiante
- Modify: `frontend/next.config.ts` — `distDir: harnessE2E ? \`.next-e2e-${process.env.E2E_PORTA_WEB ?? 3001}\` : ".next"`
- Modify: `.gitignore` — `frontend/e2e-*.db`, `frontend/.next-e2e-*`
- Create: `docs/superpowers/status/2026-11-23-correcoes-quadro.md` (baseline e decisões de PD confirmadas; o estado das tasks vive no `collab_status`)

- [ ] **Step 1:** Medir o baseline (backend, `tsc`, build, `npx playwright test` nas portas padrão) e registrar os números no quadro.
- [ ] **Step 2:** Rodar dois E2E ao mesmo tempo (`E2E_PORTA_API=8011 E2E_PORTA_WEB=3011 npx playwright test portal.spec.ts` e `E2E_PORTA_API=8012 E2E_PORTA_WEB=3012 npx playwright test estrutura.spec.ts`) → Esperado: ambos passam (portas, bancos e distDir isolados).
- [ ] **Step 3:** Registrar no quadro as decisões de PD confirmadas/recusadas pelo usuário no Gate 1.
- [ ] **Step 4:** Revisão cruzada pelo `antigravity` e Gate 2: bloco de commit 0 (`frontend/playwright.config.ts`, `frontend/next.config.ts`, `.gitignore`, o quadro).

### Task 0.2: Contratos transversais

**Files:**
- Modify: `app/competicoes/erros.py` (handler de validação), `app/competicoes/contratos/comuns.py` (`ErroResposta`)
- Modify: `app/competicoes/servicos/disputa.py` (só a função nova `numerar_jogos`), `app/competicoes/contratos/disputa.py` e `contratos/publico.py` (campo `numero_jogo`), `servicos/partidas.py` e `servicos/publico.py` (preencher o campo)
- Create: `frontend/src/lib/erros.ts`
- Modify: `frontend/src/types/competicoes.ts` (`numero_jogo: number` em `PartidaDetalhe` e `PartidaPublica`; remover `numero_partida`)
- Test: `competition_tests/consolidacao/test_contratos_correcoes.py`, `competition_tests/consolidacao/test_mensagens_acentuadas.py`, `frontend/e2e/contratos-erros.spec.ts`

**Interfaces:**
- Produces: `numerar_jogos(partidas: list[Partida]) -> dict[int, int]` — numeração 1..N por edição, ordem: fase de grupos/pontos corridos por (rodada, id_grupo, ordem_jogo), depois mata-mata por fase (oitavas → quartas → semifinal → disputa de 3º → final) e `posicao_chave`; empate de ordenação por `id_partida`.
- Produces: `PartidaDetalhe.numero_jogo: int`, `PartidaPublica.numero_jogo: int`.
- Produces: `ErroResposta.detalhes: list[DetalheCampo]`, `DetalheCampo = {campo: str, mensagem: str}`; mensagem geral do 422 = `"Dados inválidos. Verifique os campos destacados."`; `detalhes[].mensagem` traduz `missing` → "Campo obrigatório.", `string_too_short` → "Texto muito curto.", `greater_than_equal` → "Valor abaixo do mínimo.", e repassa a mensagem de `ValueError` dos validadores do projeto.
- Produces (front): `extrairErro(erro: unknown): { mensagem: string; campos: Record<string, string> }` — usa `detalhes`; campo sem mapeamento fica só em `mensagem`; erro de rede → `"Não foi possível conectar ao servidor."`.

- [ ] **Step 1: Testes que falham**

```python
def test_numero_jogo_sequencial_grupos_e_mata_mata(edicao_grupos_mata_mata_concluida):
    nums = [p["numero_jogo"] for p in listar_partidas_api(edicao_grupos_mata_mata_concluida)]
    assert sorted(nums) == list(range(1, len(nums) + 1))
    # semifinais 3 e 4, 3º lugar 5, final 6 numa edição de 2 grupos de 2
    assert numero_por_fase(edicao_grupos_mata_mata_concluida) == {"GRUPOS": [1, 2], "SEMIFINAL": [3, 4], "TERCEIRO_LUGAR": [5], "FINAL": [6]}

def test_numero_jogo_estavel_apos_reabrir(edicao_grupos_mata_mata_concluida):
    antes = mapa_numero_por_id(edicao_grupos_mata_mata_concluida)
    reabrir_e_refinalizar_final(edicao_grupos_mata_mata_concluida)
    assert mapa_numero_por_id(edicao_grupos_mata_mata_concluida) == antes

def test_validacao_422_traz_detalhes_legiveis(client_admin):
    r = client_admin.post("/competicoes/eventos", json={"nome": "", "edicao": {"identificacao": "2026", "data_inicio": "2026-12-31", "data_fim": "2026-11-01"}})
    corpo = r.json()
    assert r.status_code == 422
    assert corpo["mensagem"] == "Dados inválidos. Verifique os campos destacados."
    assert {d["campo"] for d in corpo["detalhes"]} >= {"nome", "edicao.data_fim"}
    assert all(d["mensagem"] for d in corpo["detalhes"])
```

`test_mensagens_acentuadas.py`: parametrizado por módulo de `app/competicoes/**/*.py`; para cada literal de string que é mensagem (`ErroDominio(...)`, `HTTPException(detail=...)`, `mensagem=`), falha se contiver alguma das palavras `requisicao, edicao, periodo, nao, competicao, ja, inscricao, partida invalida, sumula, decisao, classificacao, suspensao, obrigatorio, numero, exclusao, acao, posicao`. Cada trilha de backend deixa verdes os módulos que possui; T17 exige todos verdes.

`contratos-erros.spec.ts`: monta a tela de novo evento, provoca o 422 de datas e espera o texto do detalhe abaixo do campo "Data de término" (o teste fica vermelho até a T15 usar `extrairErro`; marcado `test.fixme` até lá e reativado pela T15).

- [ ] **Step 2:** Rodar `pytest competition_tests/consolidacao/test_contratos_correcoes.py -q` → FAIL (`numero_jogo` ausente).
- [ ] **Step 3:** Implementar `numerar_jogos`, os campos e o handler; `extrairErro` em `frontend/src/lib/erros.ts`; trocar em `types/competicoes.ts` o campo `numero_partida` por `numero_jogo` (o `tsc` vai apontar os usos em L7/L8 — o orquestrador avisa essas trilhas, que corrigem nos próprios arquivos).
- [ ] **Step 4:** Rodar backend completo → PASS (exceto `test_mensagens_acentuadas`, que fica parcialmente vermelho por módulo até a Onda 1); `npx tsc --noEmit` → só erros nos arquivos de L7/L8 que usam `numero_partida`.
- [ ] **Step 5:** Bloco de commit 0b (usuário commita). Avisar todas as trilhas: "contratos da T0.2 disponíveis".

---

## Onda 1 — trilhas em paralelo

### Task 1 (L1): Eventos — exclusão em cascata segura, nomes únicos, vínculo e listagem

**Files:**
- Modify: `app/competicoes/servicos/organizacao.py`, `servicos/exclusao.py`, `api/organizacao.py`, `contratos/organizacao.py`
- Test: `competition_tests/consolidacao/test_eventos_correcoes.py`

**Interfaces:**
- Produces: `DELETE /competicoes/eventos/{id_evento}` com corpo `{"confirmacao_nome": str}` → 204; 409 `CONFIRMACAO_INVALIDA` se o nome não bater exatamente; apaga evento → edições de evento → edições de competição vinculadas (reusa `excluir_edicao_competicao` de `servicos/exclusao.py`) e, quando uma competição fica sem nenhuma edição, a competição também.
- Produces: `DELETE /competicoes/edicoes-evento/{id}` com `{"confirmacao_identificacao": str}` → 204, mesma cascata restrita à edição.
- Produces: `GET /competicoes/eventos/{id}/exclusao/previa` → `{edicoes_evento: int, edicoes_competicao: int, partidas: int, equipes: int, publicadas: int}` (para o diálogo mostrar o impacto).
- Produces: `EdicaoEventoDetalhe.competicoes: list[{id_competicao, nome, id_edicao_competicao, identificacao, estado, publicada}]`.
- Produces: `POST /competicoes/edicoes-evento/{id}/vinculos` `{"id_edicao_competicao": int}` → 200 `EdicaoEventoDetalhe`; 422 se o período não couber; 409 se já vinculada a outra edição de evento. `DELETE /competicoes/edicoes-evento/{id}/vinculos/{id_edicao_competicao}` → desvincula.
- Produces: 409 `DUPLICIDADE` campo `nome` para evento ou competição com nome igual a outro (comparação sem diferenciar maiúsculas/acentos e espaços nas pontas), na criação e na edição.
- Produces: `PATCH /eventos/{id}` aplica `descricao: null` (usa `model_fields_set`).

- [ ] **Step 1: Testes que falham**

```python
def test_excluir_evento_apaga_toda_a_arvore(evento_com_edicao_competicao_em_andamento):
    r = client.request("DELETE", f"/competicoes/eventos/{ev.id}", json={"confirmacao_nome": ev.nome})
    assert r.status_code == 204
    for tabela in ("eventos", "edicoes_evento", "edicoes_competicao", "partidas", "ocorrencias_partida",
                   "suspensoes_competicao", "decisoes_classificacao", "equipes_competicao", "integrantes_equipe"):
        assert contar_ligados_ao_evento(db, tabela, ev.id) == 0

def test_excluir_evento_exige_nome_exato(evento_simples):
    r = client.request("DELETE", f"/competicoes/eventos/{ev.id}", json={"confirmacao_nome": ev.nome.lower() + " "})
    assert r.status_code == 409 and r.json()["codigo"] == "CONFIRMACAO_INVALIDA"
    assert evento_existe(ev.id)

def test_nome_de_evento_duplicado_recusado_ignorando_caixa_e_acento():
    criar_evento("Jogos Escolares")
    r = criar_evento("JOGOS ESCOLARES ")
    assert r.status_code == 409 and r.json()["campos"] == ["nome"]

def test_nome_de_competicao_duplicado_recusado(): ...  # mesma assertiva para /competicoes/competicoes
def test_renomear_evento_para_nome_existente_recusado(): ...  # PATCH → 409 campos ["nome"]
def test_patch_evento_descricao_null_apaga(): assert patch({"descricao": None}).json()["descricao"] is None
def test_edicao_evento_lista_competicoes_vinculadas(): assert [c["nome"] for c in detalhe["edicoes"][0]["competicoes"]] == ["Copa X"]
def test_vincular_edicao_existente_dentro_do_periodo(): assert r.status_code == 200
def test_vincular_edicao_fora_do_periodo_422(): assert r.json()["campos"] == ["id_edicao_competicao"]
def test_vincular_edicao_ja_vinculada_409(): ...
def test_previa_exclusao_conta_impacto(): assert previa == {"edicoes_evento": 1, "edicoes_competicao": 1, "partidas": 6, "equipes": 4, "publicadas": 1}
```

- [ ] **Step 2:** `pytest competition_tests/consolidacao/test_eventos_correcoes.py -q` → FAIL.
- [ ] **Step 3:** Implementar. Comparação de nomes: `normalizar_nome(nome: str) -> str` (NFKD sem diacríticos, `casefold`, `strip`, espaços internos colapsados) em `servicos/organizacao.py`. Se precisar de índice/coluna `nome_normalizado`, pedir migração ao orquestrador. Corrigir os acentos das mensagens dos módulos de L1.
- [ ] **Step 4:** `pytest competition_tests -q` → PASS; `test_mensagens_acentuadas` verde para os módulos de L1.
- [ ] **Step 5:** `SendMessage` L9: contratos de T1 prontos. Bloco de commit 1.

### Task 2b (L1): Elencos — cópia só de ativos e edição de equipe

**Files:**
- Modify: `app/competicoes/servicos/elencos.py`, `api/elencos.py`, `contratos/elencos.py`
- Test: `competition_tests/consolidacao/test_elencos_correcoes.py`

**Interfaces:**
- Produces: cópia de elenco ignora integrantes `INATIVO`.
- Produces: `PATCH /competicoes/equipes/{id_equipe}` `{nome?, sigla?}` → `EquipeDetalhe`; editável em qualquer estado da edição (nome e sigla não são estruturais); `sigla` única dentro da edição (409 `DUPLICIDADE` campo `sigla`).
- Produces: `PATCH /competicoes/integrantes/{id}` (já existe) aceita `numero_camisa` e `posicao`; `PATCH /competicoes/competidores/{id}` (já existe) aceita `nome_esportivo` — só confirmar por teste.
- Produces: `GET /competicoes/edicoes/{id}/copiar-equipes/origens` → `[{id_edicao_competicao, rotulo: "Copa X · 2026", equipes: int}]` (para o seletor da L8 deixar de pedir ID).

- [ ] **Step 1:** Testes: `test_copia_ignora_integrante_inativo`, `test_patch_equipe_nome_e_sigla`, `test_sigla_duplicada_409`, `test_origens_de_copia_listam_edicoes_da_competicao_menos_a_atual`.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** implementar. **Step 4:** Rodar → PASS.
- [ ] **Step 5:** `SendMessage` L8. Bloco de commit 1 (mesmo bloco da T1).

### Task 2 (L2): Agendamento com regras de estado e período

**Files:**
- Modify: `app/competicoes/servicos/partidas.py`, `api/partidas.py`
- Test: `competition_tests/consolidacao/test_agendamento_correcoes.py`

**Interfaces:**
- Produces: `agendar_partida` recusa com 409 `CONFLITO_ESTADO` quando a edição está `FINALIZADA`/`CANCELADA` ("A edição precisa estar em rascunho ou em andamento para agendar jogos.") ou a partida está `FINALIZADA`/`CANCELADA` ("Jogo finalizado não pode ser reagendado."); 422 campo `data` quando a data sai do período da edição ("A data precisa estar entre 23/11/2026 e 20/12/2026."). Limpar agendamento (tudo nulo) continua permitido para partida não finalizada.

- [ ] **Step 1:** Testes `test_agendar_fora_do_periodo_422`, `test_agendar_em_edicao_cancelada_409`, `test_agendar_jogo_finalizado_409`, `test_limpar_agendamento_de_jogo_agendado_ok`, cada um conferindo `status_code`, `codigo`, `campos` e a mensagem exata acima.
- [ ] **Step 2–4:** FAIL → implementar (inclui trocar textos com enum cru como "A edição deve estar EM_ANDAMENTO" por "A edição precisa estar em andamento para reabrir um jogo.") → PASS.
- [ ] **Step 5:** Bloco de commit 2.

### Task 3 (L2): Chaveamento — letra do grupo, placar e textos legíveis

**Files:**
- Modify: `app/competicoes/servicos/disputa.py` (vagas), `servicos/publico.py` (`descrever`), `contratos/disputa.py`, `contratos/publico.py` (allowlist)
- Test: `competition_tests/consolidacao/test_chaveamento_correcoes.py`, ajustar o teste de allowlist existente em `competition_tests/consolidacao/test_contratos_infra.py`

**Interfaces:**
- Produces: `VagaDetalhe.nome_grupo` preenchido ("Grupo A") nas vagas `POSICAO_GRUPO` (admin e público).
- Produces: `DueloDetalhe.placar` e `DueloPublico.placar`: `{gols: [int|None, int|None], penaltis: [int|None, int|None]}` na ordem das vagas (soma das partidas do duelo; ida e volta agregadas).
- Produces: `descricao_origem` legível: "1º do Grupo A", "Vencedor da Semifinal 1", "Perdedor da Semifinal 2".

- [ ] **Step 1:** Testes `test_vaga_posicao_grupo_tem_letra`, `test_duelo_traz_placar_e_penaltis` (semifinal 1×1 pên. 4×3 → `{"gols": [1, 1], "penaltis": [4, 3]}`), `test_descricao_origem_sem_enum` (nenhuma descrição casa `[A-Z]{4,}`), e a allowlist do público incluindo `placar`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** `SendMessage` L7 e L9. Bloco de commit 2.

### Task 4 (L2): Classificação, decisões e artilharia

**Files:**
- Modify: `app/competicoes/servicos/classificacao.py`, `servicos/motores/*` (classificação), `api/classificacao.py`, `contratos/classificacao.py`
- Test: `competition_tests/consolidacao/test_classificacao_correcoes.py`

**Interfaces:**
- Produces: `empate_persistente` só é sinalizado entre equipes com pelo menos um jogo finalizado (grupo/edição sem jogos → nenhum alerta, todos na posição 1 sem ícone).
- Produces: `DecisaoClassificacaoDetalhe.responsavel_nome: str` e `criado_em`; decisão invalidada (`valida=False`) **nunca** volta a `True` (PD-RT13-01): revalidar exige nova decisão.
- Produces: bloqueio de finalização com texto pela posição: "Há empate não resolvido pela 2ª posição (Leões RT e Tigres RT). Registre a decisão antes de finalizar." (título → "pelo título").
- Produces: `ArtilheiroDetalhe.posicao` compartilhada no empate (competição padrão "1, 1, 3"): mesmos gols → mesma posição; ordenação de exibição por gols desc, depois nome.

- [ ] **Step 1:** Testes `test_sem_jogos_nao_sinaliza_empate`, `test_decisao_invalidada_nao_revalida_ao_voltar_resultado` (reproduz o caso 008 do RT13: 1×0 → 2×0 → 1×0 ⇒ `valida is False` e alerta de empate de novo), `test_decisao_traz_responsavel`, `test_bloqueio_cita_a_posicao_em_disputa`, `test_artilharia_empate_mesma_posicao` (Beta 1, Bruno 1 → posições `[1, 1]`).
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** `SendMessage` L7 (decisão/artilharia) e L9 (artilharia). Bloco de commit 2.

### Task 5 (L3): Súmula e disciplina

**Files:**
- Modify: `app/competicoes/servicos/sumula.py`, `servicos/disciplina.py`, `api/sumula.py`, `api/disciplina.py`, `contratos/sumula.py`, `contratos/disciplina.py`
- Test: `competition_tests/consolidacao/test_disciplina_correcoes.py`

**Interfaces:**
- Produces: `DELETE /competicoes/ocorrencias/{id}` aceita corpo `{"motivo": str}`; obrigatório (≥ 3 caracteres, 422 campo `motivo`) quando a partida já foi finalizada alguma vez (há registro de reabertura na auditoria); grava auditoria com o motivo.
- Produces: reprocessar a súmula de uma partida reaberta **reaproveita** a suspensão automática existente pela `chave_origem` (sem criar cancelada + nova); cancelar só quando a ocorrência de origem deixa de existir.
- Produces: `SuspensaoDetalhe.responsavel_nome`, `CumprimentoDetalhe.responsavel_nome`, `SuspensaoDetalhe.historico: list[{em, responsavel_nome, acao, situacao_anterior, situacao_nova, justificativa}]` (lido da auditoria).
- Produces: `PUT /suspensoes/{id}` com `situacao="CUMPRIDA"` e cumprimentos < jogos → 422 campo `situacao` ("Para marcar como cumprida, registre os cumprimentos nas partidas.").
- Produces: `GET /competicoes/suspensoes/{id}/partidas-elegiveis` → `[{id_partida, numero_jogo, rotulo: "Jogo 6 · Final · Leões RT × Tigres RT"}]`: só partidas finalizadas, da equipe do atleta, posteriores à origem, sem ocorrência do atleta e sem cumprimento dele.

- [ ] **Step 1:** Testes `test_remover_ocorrencia_de_partida_reaberta_exige_motivo`, `test_remover_ocorrencia_em_partida_nunca_finalizada_sem_motivo_ok`, `test_reprocessar_nao_cria_copia_cancelada` (reabrir+finalizar 2× ⇒ exatamente 1 suspensão para a chave), `test_suspensao_traz_responsavel_e_historico`, `test_cumprida_sem_cumprimento_422`, `test_partidas_elegiveis_filtra_origem_outra_equipe_agendada_e_jogada`.
- [ ] **Step 2–4:** FAIL → implementar → PASS (mensagens acentuadas nos módulos de L3).
- [ ] **Step 5:** `SendMessage` L7 e L8. Bloco de commit 3.

### Task 6 (L4): Alunos — atualização parcial, foto, arquivos

**Files:**
- Modify: `app/routers/alunos.py`, `app/schemas.py` (só schemas de aluno), `app/utils.py` (validação de upload)
- Test: `tests/test_alunos_correcoes.py`

**Interfaces:**
- Produces: `PUT /alunos/{id}` aplica `null` em campos opcionais enviados (apagar) e aceita `remover_foto=true` (apaga o arquivo e zera `foto`).
- Produces: upload aceita `image/webp` (além de jpeg/png) para foto; rejeita arquivo > 5 MB com 413/422 "Arquivo maior que 5 MB."; cadastro recusado não deixa arquivo em `uploads/` (salvar em temporário e mover só após commit, ou apagar no `except`).
- Produces: `POST /alunos` exige atestado e documento (422 campos `atestado`, `documento`) — PD-RT05-03; `PUT` não exige.
- Produces: `GET /alunos/{id}/exclusao/previa` → `{matriculas: int, presencas: int}` (PD-RT01-03).

- [ ] **Step 1:** Testes `test_put_aluno_apaga_opcional_com_null`, `test_put_aluno_remove_foto`, `test_upload_webp_aceito`, `test_upload_6mb_recusado`, `test_cadastro_recusado_nao_deixa_orfao` (conta arquivos em `uploads/` antes/depois), `test_criar_aluno_sem_documentos_422`, `test_previa_exclusao_aluno`.
- [ ] **Step 2–4:** FAIL → implementar → PASS. Mesmo endpoint de prévia para turma (`GET /turmas/{id}/exclusao/previa`) em `app/routers/turmas.py`.
- [ ] **Step 5:** `SendMessage` L6. Bloco de commit 4.

### Task 7 (L4): Troca de senha obrigatória e perfil coordenador

**Files:**
- Modify: `app/security.py`, `app/routers/auth.py`
- Test: `tests/test_auth_correcoes.py`

**Interfaces:**
- Produces: dependência de usuário autenticado retorna 403 `{"detail": "Troque sua senha para continuar.", "codigo": "SENHA_TROCA_OBRIGATORIA"}` quando `must_change_password=True`, exceto em `POST /users/me/password` (ou a rota de troca existente), `GET /users/me` e logout/refresh.
- Produces: coordenador lista usuários e cria apenas `professor`/`assistente` (o backend já restringe a criação; confirmar listagem e recusa de `PUT /users/{u}/role` para perfis acima do dele).

- [ ] **Step 1:** Testes `test_usuario_com_troca_pendente_bloqueado_na_api`, `test_usuario_com_troca_pendente_pode_trocar_senha_e_ver_me`, `test_coordenador_lista_usuarios`, `test_coordenador_nao_promove_a_admin`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** `SendMessage` L5 e L6. Bloco de commit 4.

### Task 8 (L5): Casca e componentes compartilhados

**Files:**
- Modify: `frontend/src/lib/api.ts`, `context/NotificationContext.tsx`, `components/ui/tabs.tsx`, `components/ui/confirm-dialog.tsx`, `components/layout/Topbar.tsx`, `components/layout/Sidebar.tsx`, `components/auth/ChangePasswordModal.tsx`
- Test: `frontend/e2e/correcoes-shell.spec.ts`

**Interfaces:**
- Produces: rota `/dashboard/**` sem sessão → `/login?redirect=<rota>`; após login volta à rota (DF-RT08-01). 403 `SENHA_TROCA_OBRIGATORIA` abre o `ChangePasswordModal`.
- Produces: `useNotificacao(): { sucesso(msg: string): void; erro(msg: string | unknown): void }` — no máximo 1 toast de erro visível (o novo substitui o anterior), some em 6 s, fica fora da área do rodapé dos diálogos, e fechar o toast não fecha o `Dialog` aberto (DF-RT02-03, DF-RT04-02). `erro(unknown)` usa `extrairErro`.
- Produces: `ConfirmDialog` ganha `confirmarTexto?: string` (o botão só habilita quando o usuário digita exatamente esse texto) e `enviando?: boolean` (desabilita os botões).
- Produces: `tabs.tsx` sem setas de rolagem vertical (DF-RT03-01); foco volta ao avatar ao fechar "Alterar senha" (DF-RT08-04); troca obrigatória sem "×" (DF-RT06-01); Sidebar mostra "Usuários" para coordenador (PD-RT06-04).

- [ ] **Step 1: E2E que falham**

```ts
test('rota interna sem login vai para o login e volta', async ({ page }) => {
  await page.goto('/dashboard/turmas');
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard%2Fturmas/);
  await login(page); await expect(page).toHaveURL(/\/dashboard\/turmas$/);
});
test('dois erros seguidos mostram um único toast', ...);           // expect(page.getByRole('alert')).toHaveCount(1)
test('fechar o toast não fecha o modal aberto', ...);              // dialog continua visível com os dados digitados
test('confirmarTexto só habilita com o texto exato', ...);
test('foco volta ao avatar ao fechar Alterar senha', ...);         // expect(page.getByRole('button', { name: 'Menu do usuário' })).toBeFocused()
test('troca obrigatória não tem botão fechar', ...);
test('abas sem setas de rolagem', ...);                             // nenhum botão de scroll dentro do tablist
```

- [ ] **Step 2:** `E2E_PORTA_API=8011 E2E_PORTA_WEB=3011 npx playwright test correcoes-shell.spec.ts` → FAIL.
- [ ] **Step 3:** Implementar. **Step 4:** Mesmo comando → PASS; `npx tsc --noEmit` sem erros novos.
- [ ] **Step 5:** `SendMessage` L6, L7, L8, L9 (contratos de UI). Bloco de commit 5.

### Task 9 (L6): Alunos

**Files:**
- Modify: `frontend/src/app/dashboard/alunos/**`, `frontend/src/components/forms/AlunoForm.tsx`
- Test: `frontend/e2e/correcoes-alunos.spec.ts`

**Interfaces:**
- Consumes: T6 (`PUT` com `null`/`remover_foto`, prévia de exclusão), T8 (`useNotificacao`, `ConfirmDialog`), `formatarTelefone(digitos: string): string` e `formatarCpf` — pedir ao orquestrador em `lib/formatos.ts` se ainda não existirem.

- [ ] **Step 1:** E2E: `edição mostra e salva turmas e permite cancelar matrícula` (DF-RT01-01, PD-RT05-02), `remover foto na edição persiste`, `apagar campo opcional persiste`, `excluir com busca ativa mantém a lista filtrada sem o excluído` (DF-RT01-04), `lista mostra foto ou iniciais`, `telefone formatado (62) 99999-1234 na lista e no formulário`, `turma e documentos marcados como obrigatórios antes do envio`, `diálogo de exclusão mostra quantas matrículas e presenças serão apagadas`, `botão do topo diz "Novo aluno"`, `foto usa NEXT_PUBLIC_API_URL` (nenhum `src` com `localhost:8000` fixo).
- [ ] **Step 2:** Rodar (portas 8012/3012) → FAIL. **Step 3:** implementar. **Step 4:** → PASS.
- [ ] **Step 5:** Bloco de commit 6.

### Task 10 (L6): Professores, Turmas, Modalidades, Matrículas, Usuários, Dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/{professores,turmas,modalidades,matriculas,usuarios}/**`, `app/dashboard/page.tsx`, `components/forms/{ProfessorForm,TurmaForm}.tsx`
- Test: `frontend/e2e/correcoes-escolinha.spec.ts`

**Interfaces:**
- Consumes: T6 (prévia de turma), T7 (perfis), T8.

- [ ] **Step 1:** E2E, um por item: professores — `excluir com busca ativa` (DF-RT02-01), `CPF e contato formatados` (DF-RT02-02), `busca por CPF e usuário` (PD-RT02-02), `bloqueio de exclusão mostra o detail da API` (PD-RT02-03); turmas — `trilha começa em Dashboard` (DF-RT03-02), `horário invertido bloqueado na tela` (PD-RT03-02), `exclusão mostra impacto` (PD-RT03-01); modalidades — `nome duplicado mostra a mensagem da API` (DF-RT04-01), `editar modalidade` (PD-RT04-02); matrículas — `turma já cursada aparece "Já matriculado" e desabilitada` (PD-RT05-01); usuários — `coordenador vê a tela e só cria professor/assistente` (DF-RT06-02, PD-RT06-04), `editar perfil` (PD-RT06-01), `sem Excluir na própria linha` (PD-RT06-03); dashboard — `Nova competição abre o modal de nova competição` (DF-RT07-01), `Fazer chamada abre a aba Chamada` (DF-RT07-02), `professor não vê ações de cadastro` (DF-RT07-03), `rótulo "Modalidades"` (PD-RT07-01), `alunos recentes são links` (PD-RT07-02), `gráfico tem nome acessível e nenhuma parada de Tab sem nome` (PD-RT08-01).
- [ ] **Step 2–4:** FAIL → implementar → PASS (portas 8012/3012).
- [ ] **Step 5:** Bloco de commit 6.

### Task 11 (L7): Jogos e súmula (admin)

**Files:**
- Modify: `components/competicoes/disputa/*`, `components/competicoes/visual/{CartaoPlacar,EscudoIniciais,adaptadores}.ts(x)`
- Test: `frontend/e2e/correcoes-jogos.spec.ts`

**Interfaces:**
- Consumes: T0.2 (`numero_jogo`), T2 (regras de agendamento), T3 (placar/letra no chaveamento), T5 (motivo ao remover), T8.
- Produces: `EscudoEquipe({ sigla, nome })` mostra a sigla cadastrada e cai para iniciais só sem sigla (usado também por L9 — L9 importa, não edita).

- [ ] **Step 1:** E2E: `após gerar a tabela o cabeçalho e o seletor mostram Em andamento sem recarregar` (DF-RT12-01, RT13 seletor), `chaveamento recarrega após gerar, encerrar grupos e lançar placar` (DF-RT12-02), `vaga mostra 1º do Grupo A` (DF-RT12-03), `mensagens e títulos usam "Jogo N" sequencial e nunca o id` (DF-RT12-05, DF-RT12-07), `escudo mostra a sigla` (DF-RT12-06), `erro antigo some ao editar o formulário` (DF-RT12-08), `pênaltis só aparece em jogo eliminatório` (DF-RT12-09), `Encerrar fase de grupos some depois de encerrada` (DF-RT12-10), `filtro de rodada inclui Semifinal, 3º lugar e Final` (DF-RT12-12), `reabrir mantém a rolagem` (DF-RT12-14), `remover ocorrência pede confirmação e, em jogo reaberto, motivo` (DF-RT14-07), `gol sem minuto aparece sem "0'"` (DF-RT14-08), `Agendar e Reabrir ocultos em jogo finalizado de edição finalizada/cancelada` (DF-RT13-07, PD-RT12-03), `confirmar desabilita durante envio` (Review Focus 2).
- [ ] **Step 2–4:** FAIL → implementar → PASS (portas 8013/3013). Corrigir os usos de `numero_partida` apontados pelo `tsc`.
- [ ] **Step 5:** Bloco de commit 7.

### Task 12 (L7): Classificação, configuração, visão geral e ciclo da edição

**Files:**
- Modify: `components/competicoes/classificacao/*`, `components/competicoes/visual/{TabelaClassificacaoVisual,ChaveFases}.tsx`, `components/competicoes/organizacao/{PainelEdicao,VisaoGeralEdicao,FormularioConfiguracao,CartoesOrganizacao}.tsx`, `app/dashboard/competicoes/**`
- Test: `frontend/e2e/correcoes-classificacao.spec.ts`

**Interfaces:**
- Consumes: T0.2 (`extrairErro`), T1 (edição de competição/edição já existente na API), T4, T8.

- [ ] **Step 1:** E2E: `configuração mostra e salva a ordem dos desempates e jogos por acúmulo, por 2º amarelo e zeragem` (DF-RT13-01), `mensagem de geração sem "chaveamento" em pontos corridos` (DF-RT13-02), `pontos corridos sem zona de classificação` (DF-RT13-03), `decisão mostra responsável e as linhas decididas têm marca` (DF-RT13-04), `Finalizar edição pede confirmação` (DF-RT13-05), `reabrir edição mostra sucesso` (DF-RT13-08), `tabela de grupo mostra todas as colunas sem rolagem em 1440 px` (DF-RT13-10, também na classificação pública — L9 reaproveita o componente), `card Artilheiro mostra empatados` (DF-RT12-13), `edição e aba ficam no endereço (?edicao=92&aba=jogos) e sobrevivem ao recarregar` (DF-RT10-02), `visão geral mostra campeão e pódio após a final` (PD-RT12-02), `editar nome/descrição da competição e identificação/categoria/datas da edição` (PD-RT10-01), `formulários mostram erro abaixo do campo` (PD-RT09-01).
- [ ] **Step 2–4:** FAIL → implementar → PASS (portas 8013/3013).
- [ ] **Step 5:** Bloco de commit 7.

### Task 13 (L8): Disciplina (admin)

**Files:**
- Modify: `components/competicoes/disciplina/*`
- Test: `frontend/e2e/correcoes-disciplina.spec.ts`

**Interfaces:**
- Consumes: T0.2, T4 (posição compartilhada), T5 (`partidas-elegiveis`, `historico`, `responsavel_nome`, regra de "Cumprida"), T8.

- [ ] **Step 1:** E2E: `modal de cumprimento lista "Jogo N · fase · equipes" só com partidas elegíveis` (DF-RT14-01, DF-RT14-02), `cumprir e ajustar mostram sucesso` (DF-RT14-03), `artilharia com empate mostra a mesma posição` (DF-RT14-04), `histórico da suspensão mostra responsável e justificativas` (DF-RT14-05), `reabrir/finalizar não gera linhas canceladas repetidas` (DF-RT14-06), `ajuste para Cumprida sem cumprimentos mostra o erro da API` (PD-RT14-01).
- [ ] **Step 2–4:** FAIL → implementar → PASS (portas 8014/3014).
- [ ] **Step 5:** Bloco de commit 8.

### Task 14 (L8): Equipes e elencos (admin)

**Files:**
- Modify: `components/competicoes/elencos/*`
- Test: `frontend/e2e/correcoes-elencos.spec.ts`

**Interfaces:**
- Consumes: T2b (`origens`, `PATCH /equipes/{id}`, cópia só de ativos), T8 (`ConfirmDialog`).

- [ ] **Step 1:** E2E: `inativar integrante pede confirmação e permite reativar` (DF-RT11-01), `copiar elenco escolhe a edição pelo nome` (DF-RT11-02), `busca e importação marcam Já inscrito` (PD-RT11-01), `editar camisa/posição, nome/sigla da equipe e nome esportivo` (PD-RT11-03).
- [ ] **Step 2–4:** FAIL → implementar → PASS (portas 8014/3014).
- [ ] **Step 5:** Bloco de commit 8.

### Task 15 (L9): Eventos (admin)

**Files:**
- Modify: `app/dashboard/eventos/**`, `components/competicoes/organizacao/{ModalNovoEvento,ModalNovaCompeticao,ModalConfirmarExclusao}.tsx`
- Test: `frontend/e2e/correcoes-eventos.spec.ts` (e reativar o `test.fixme` de `contratos-erros.spec.ts`)

**Interfaces:**
- Consumes: T1 (todos os contratos), T0.2 (`extrairErro`), T8 (`ConfirmDialog.confirmarTexto`, `useNotificacao`).

- [ ] **Step 1:** E2E: `card da edição lista as competições vinculadas com link` (DF-RT15-01), `Vincular competição escolhe edição existente; Nova competição continua disponível` (DF-RT15-02), `página da competição mostra o evento com link` (DF-RT15-03 — coordenar com L7: L7 renderiza o selo no cabeçalho, L9 fornece o componente `SeloEvento({ evento })`), `novo evento abre limpo após criar` (DF-RT15-04), `datas invertidas mostram erro abaixo de Data de término` (DF-RT15-05), `criar evento/edição/competição mostra sucesso` (DF-RT15-06), `editar evento, arquivar e editar período/identificação da edição` (DF-RT15-07), `nome de evento repetido mostra erro no campo nome` (PD-RT15-02), `excluir evento mostra o impacto e exige digitar o nome` (PD-RT15-01), `confirmar desabilita durante envio`.
- [ ] **Step 2–4:** FAIL → implementar → PASS (portas 8015/3015).
- [ ] **Step 5:** Bloco de commit 9.

### Task 16 (L9): Portal público

**Files:**
- Modify: `components/publico/*`, `app/publico/**`, `app/eventos-publico/**`, `app/page.tsx`
- Test: `frontend/e2e/correcoes-portal.spec.ts`

**Interfaces:**
- Consumes: T0.2 (`numero_jogo`), T3 (`placar` nos duelos, descrições), T4 (artilharia), T11 (`EscudoEquipe`), T12 (tabela de grupo sem rolagem).

- [ ] **Step 1:** E2E: `chaveamento público mostra placar e pênaltis` (DF-RT16-01), `jogos ordenados grupos → semifinal → 3º lugar → final` (DF-RT16-02), `card da home mostra o andamento real ("Mata-mata concluído", "3 de 6 jogos")` (DF-RT16-03), `público não vê "Rascunho" (vê "Em breve")` (DF-RT16-04), `Não encontrado e Recurso descontinuado têm cabeçalho do portal e link para Competições` (DF-RT16-05), `textos públicos sem enum` (DF-RT16-06).
- [ ] **Step 2–4:** FAIL → implementar → PASS (portas 8015/3015).
- [ ] **Step 5:** Bloco de commit 9.

---

## Onda 2 — integração (orquestrador, sequencial)

### Task 17: Integração, suíte completa e revisão cruzada

- [ ] **Step 1:** Confirmar que toda trilha passou pela revisão cruzada (`collab_post kind="review"` do outro agente) e teve o Gate 2; achados abertos voltam ao dono da trilha. Achado repetido após uma rodada de correção → decisão do usuário.
- [ ] **Step 2:** Integrar os worktrees na ordem L1–L4, L5, L6–L9 (o orquestrador resolve conflitos só em arquivos de contrato).
- [ ] **Step 3:** Rodar backend completo → Esperado: todos passam, incluindo `test_mensagens_acentuadas` (todos os módulos) e ≥ baseline + testes novos.
- [ ] **Step 4:** `npx tsc --noEmit` → 0 erros; `npm run build` → sucesso.
- [ ] **Step 5:** `npx playwright test` (todas as specs, portas padrão) → Esperado: baseline + todas as `correcoes-*.spec.ts` passando.
- [ ] **Step 6:** Revisão final do branch inteiro: um revisor Claude (modelo mais capaz) e o `antigravity` (`collab_start_review`).
- [ ] **Step 7:** Entregar ao usuário a tabela dos blocos de commit 0, 0b, 1–9 com a lista de arquivos de cada um.

### Task 18: Spec e registro das decisões

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md` (5.2 nomes únicos de evento e competição; 6.4/7.5 gerar tabela inicia a edição e ajuste manual de grupos fora do escopo; 7.3 invalidação sem revalidação automática; 7.4 "Cumprida" só com cumprimentos; 7.5 exclusão de evento em cascata com confirmação pelo nome)
- Modify: cada `docs/testes/roteiros/RTxx-*.md` — coluna "Situação" dos DF vira "Corrigido (Task N)" e os PD ganham a decisão final.

- [ ] **Step 1:** Editar a spec e os roteiros. **Step 2:** Bloco de commit 10.

### Task 19: Reteste manual e documentos

- [ ] **Step 1:** Rodar no Chrome (Claude in Chrome) um roteiro de regressão `docs/testes/roteiros/RT17-regressao-correcoes.md`, com um caso por DF de severidade Alta/Média e amostragem de Baixa, usando a massa mantida (competições 88/89, eventos 5/6).
- [ ] **Step 2:** Regerar os .docx (script do gerador em `scripts/orquestracao/gerar_docx_roteiros.js`, movido do scratchpad para o repositório nesta task) incluindo o RT17.
- [ ] **Step 3:** Com o usuário de acordo, limpar a massa: excluir as competições 88 e 89 e os eventos 5 e 6 pela própria exclusão em cascata nova (vale como teste real da T1/T15).
- [ ] **Step 4:** Bloco de commit 11.
