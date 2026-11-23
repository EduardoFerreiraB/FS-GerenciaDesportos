# Fatia 3 — Súmula Detalhada, Correções, Empates, Disciplina e Ciclo de Vida: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a súmula detalhada por partida (gols com autoria, gols contra, cartões amarelos, vermelhos diretos e expulsão derivada por segundo amarelo), artilharia da edição, travas de correção e reabertura baseadas no grafo de `vagas_duelo`, resolução auditada de empates persistentes (`decisoes_classificacao`), controle disciplinar completo (`suspensoes_competicao` e `cumprimentos_suspensao` com alertas não-bloqueantes), e ciclo de vida completo da edição e das partidas.

**Architecture:** Extensão dos modelos e motores de competição mantendo o placar 100% derivado de `ocorrencias_partida` (`GOL` e `GOL_CONTRA`). Derivação automática de `EXPULSAO_SEGUNDO_AMARELO` vinculada por `id_ocorrencia_origem`. Grafo de dependências transitivas sobre `vagas_duelo` para bloquear reabertura se qualquer duelo descendente (incluindo 3º lugar) ou jogo de volta já tiver iniciado, ou limpar resoluções pendentes caso permitido. Fila disciplinar idempotente por `chave_origem` e cumprimento explícito por partida posterior finalizada (`UNIQUE(id_partida, id_integrante)`).

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic V2, MySQL 8 / SQLite, Next.js 16 (App Router / Turbopack), TypeScript estrito, Tailwind CSS, Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md`](../specs/2026-10-15-competicoes-fatias-design.md) (Seção 7).

## Global Constraints

- Nunca editar `.env`, `.env.example` ou credenciais do sistema.
- DDL e schemas 100% compatíveis com MySQL 8 local e SQLite de testes.
- Placar é sempre agregação de ocorrências (`GOL` e `GOL_CONTRA` para `id_equipe_beneficiada`).
- Jogador suspenso gera alerta persistente, nunca bloqueia lançamento de súmula nem altera pontos/placar automaticamente.
- Toda correção pós-finalização, reabertura, decisão de desempate e ajuste disciplinar manual exige `motivo` não vazio e grava registro em `auditoria_competicao`.
- Isolamento estrito de arquivos por onda paralela conforme R1; o controlador revisa e comita explicitamente cada conjunto.

---

## Estrutura de Arquivos Planejada

```
app/
├── competicoes/
│   ├── modelos/
│   │   ├── partidas.py      # Expansão de TIPOS_OCORRENCIA (GOL, GOL_CONTRA, cartões, expulsão derivada)
│   │   ├── disciplina.py    # SuspensaoCompeticao, CumprimentoSuspensao, DecisaoClassificacao
│   │   └── __init__.py      # Reexportação dos novos modelos
│   ├── contratos/
│   │   ├── configuracao.py  # Adição de critérios disciplinares em CriterioDesempate
│   │   ├── sumula.py        # Contratos de ocorrências, súmula, reabertura e artilharia
│   │   └── disciplina.py    # Contratos de suspensões, cumprimentos, alertas e decisões de classificação
│   ├── servicos/
│   │   ├── motores/
│   │   │   ├── sumula.py        # Derivação de 2º amarelo, artilharia e grafo transitivo de travas de reabertura
│   │   │   ├── disciplina.py    # Cálculo de ciclos de amarelos, chaves de origem, zeragem e revisão disciplinar
│   │   │   └── classificacao.py # Extensão com desempates disciplinares e decisões manuais versionadas
│   │   ├── sumula.py        # Operações transacionais de súmula, autoria, reabertura e artilharia
│   │   ├── disciplina.py    # Reconciliação de sanções, cumprimento explícito, alertas e ajustes
│   │   ├── partidas.py      # Integração de GOL_CONTRA, proteção de autoria no resultado simples e sanções
│   │   ├── disputa.py       # Reabertura de fase de grupos com travas e respeito a decisões manuais
│   │   ├── classificacao.py # Registro e aplicação de decisões manuais de desempate
│   │   └── organizacao.py   # Ciclo de vida da edição (iniciar, finalizar, reabrir, cancelar) e travas de exclusão
│   └── api/
│       ├── sumula.py        # Endpoints de súmula, ocorrências, reabertura/ciclo de partida e artilharia
│       ├── disciplina.py    # Endpoints de painel disciplinar, suspensões e cumprimentos
│       ├── organizacao.py   # Endpoints de ciclo de vida da edição
│       ├── disputa.py       # Endpoint de reabertura de fase de grupos
│       └── classificacao.py # Endpoints de decisões de desempate
alembic/
└── versions/
    └── 20261015_0400_sumula_disciplina_decisoes.py # Migração Alembic da Fatia 3
frontend/src/
├── types/
│   └── competicoes.ts       # Contratos TS de súmula, ocorrências, artilharia, disciplina e decisões
├── services/
│   └── competicoes.ts       # Métodos HTTP para a Fatia 3
└── components/competicoes/
    ├── disputa/
    │   ├── ModalSumulaDetalhada.tsx # Lançamento de gols, gol contra, cartões, autoria e alertas de suspensos
    │   ├── ModalReabrirPartida.tsx  # Reabertura justificada de partida ou fase de grupos
    │   └── VisualizadorPartidas.tsx # Integração de Súmula, Reabertura e Ciclo de Vida da Edição
    ├── classificacao/
    │   └── TabelaClassificacao.tsx  # Resolução manual de empate persistente com justificativa
    └── disciplina/
        ├── PainelDisciplina.tsx       # Aba de Disciplina (suspensões, cartões, alertas) e Artilharia
        ├── ModalCumprirSuspensao.tsx  # Confirmação explícita de cumprimento em partida elegível
        └── ModalAjustarSuspensao.tsx  # Ajuste disciplinar manual com justificativa
```

---

## Ondas de Execução

- **Onda A (Paralela — 3 Subagentes):**
  - **Task 1:** Banco de Dados, Modelos ORM (`disciplina.py`, `partidas.py`) e Migração Alembic `20261015_0400`.
  - **Task 2:** Contratos Pydantic (`sumula.py`) e Motor Puro de Súmula, Artilharia e Travas de Grafo (`motores/sumula.py`).
  - **Task 3:** Contratos Pydantic (`disciplina.py`, `configuracao.py`) e Motores Puros de Disciplina e Desempate (`motores/disciplina.py`, `motores/classificacao.py`).
- **Onda B (Paralela — 3 Subagentes):**
  - **Task 4:** Serviços e API de Súmula Detalhada, Artilharia e Reabertura de Partidas (`servicos/sumula.py`, `servicos/partidas.py`, `api/sumula.py`).
  - **Task 5:** Serviços e API de Disciplina, Suspensões, Cumprimentos e Alertas (`servicos/disciplina.py`, `api/disciplina.py`).
  - **Task 6:** Serviços e API de Ciclo de Vida da Edição, Reabertura de Grupos e Decisões de Desempate (`organizacao.py`, `disputa.py`, `classificacao.py`).
- **Onda C (Paralela — 2 Subagentes):**
  - **Task 7:** Frontend — Súmula Detalhada, Reabertura Justificada, Desempate Manual e Ciclo de Vida + E2E (`sumula.spec.ts`).
  - **Task 8:** Frontend — Painel de Disciplina, Cumprimento de Suspensões, Ajustes e Artilharia + E2E (`disciplina.spec.ts`).
- **Onda D:**
  - **Task 9:** Testes E2E de Integração Backend (`test_e2e_fatia3.py`), Harness MySQL 8 Real e Checkpoint Final da Fatia 3.

---

### Task 1: Banco de Dados — Modelos ORM e Migração Alembic `20261015_0400`

**Files:**
- Create: `app/competicoes/modelos/disciplina.py`
- Modify: `app/competicoes/modelos/partidas.py`
- Modify: `app/competicoes/modelos/__init__.py`
- Create: `alembic/versions/20261015_0400_sumula_disciplina_decisoes.py`
- Test: `competition_tests/consolidacao/test_schema_fatia3.py`

- [ ] **Step 1: Write failing schema and model tests** (`test_schema_fatia3.py`) verificando as tabelas `suspensoes_competicao`, `cumprimentos_suspensao`, `decisoes_classificacao`, a constraint `uq_cumprimentos_partida_integrante` e os novos valores de enum em `ocorrencias_partida.tipo`.
- [ ] **Step 2: Run test to verify RED** (`.venv/bin/pytest competition_tests/consolidacao/test_schema_fatia3.py`).
- [ ] **Step 3: Implement ORM models and migration `20261015_0400`**.
- [ ] **Step 4: Run test to verify GREEN** e validar com `scripts/testar_mysql_competicoes.py`.

---

### Task 2: Contratos Pydantic e Motor Puro de Súmula, Artilharia e Travas de Grafo

**Files:**
- Create: `app/competicoes/contratos/sumula.py`
- Create: `app/competicoes/servicos/motores/sumula.py`
- Test: `competition_tests/consolidacao/test_motor_sumula.py`

- [ ] **Step 1: Write failing unit tests** (`test_motor_sumula.py`) cobrindo:
  - Determinação de `id_equipe_beneficiada` em `GOL` vs `GOL_CONTRA`.
  - Derivação de `EXPULSAO_SEGUNDO_AMARELO` ao receber o 2º `CARTAO_AMARELO` do mesmo integrante na mesma partida, e remoção da expulsão ao remover o amarelo de origem.
  - Validação de `ResultadoSimples` preservando gols com autoria e gols contra (rejeitando se o novo placar for inferior aos gols já identificados).
  - Cálculo de artilharia (apenas `GOL` normal com autor em partidas não canceladas, indicando partidas em andamento, excluindo `GOL_CONTRA` e pênaltis).
  - Busca transitiva no grafo de `vagas_duelo`: dado um duelo ou fase de grupos a reabrir, identifica todos os duelos descendentes (incluindo disputa de 3º lugar) e bloqueia se qualquer descendente já tiver partida iniciada/finalizada.
- [ ] **Step 2: Run test to verify RED**.
- [ ] **Step 3: Implement contracts and pure engine**.
- [ ] **Step 4: Run test to verify GREEN**.

---

### Task 3: Contratos Pydantic e Motores Puros de Disciplina e Desempate Manual

**Files:**
- Create: `app/competicoes/contratos/disciplina.py`
- Modify: `app/competicoes/contratos/configuracao.py`
- Create: `app/competicoes/servicos/motores/disciplina.py`
- Modify: `app/competicoes/servicos/motores/classificacao.py`
- Test: `competition_tests/consolidacao/test_motor_disciplina.py`

- [ ] **Step 1: Write failing unit tests** (`test_motor_disciplina.py`) cobrindo:
  - Contagem de amarelos para suspensão vs estatística: dois amarelos na mesma partida geram suspensão por `SEGUNDO_AMARELO`, e esses dois amarelos **não** somam para o acúmulo de amarelos.
  - Geração de `chave_origem` determinística por ciclo de acúmulo e por expulsão para garantir idempotência ao reprocessar súmula.
  - Marco de zeragem de amarelos ao encerrar grupos: zera saldo residual de amarelos para a fase seguinte sem apagar suspensões já geradas.
  - Mudança de situação para `EM_REVISAO` quando o cartão gerador de uma suspensão já cumprida é removido na correção de súmula.
  - Cálculo de `revisao_resultados` (hash determinístico dos resultados finalizados) para validar ou invalidar automaticamente uma `DecisaoClassificacao` quando placares mudam.
  - Desempate no motor de classificação por critérios disciplinares (`MENOS_CARTOES_VERMELHOS`, `MENOS_CARTOES_AMARELOS`) e por decisão manual válida.
- [ ] **Step 2: Run test to verify RED**.
- [ ] **Step 3: Implement contracts and pure engines**.
- [ ] **Step 4: Run test to verify GREEN**.

---

### Task 4: Serviços e API de Súmula Detalhada, Artilharia e Reabertura de Partidas

**Files:**
- Create: `app/competicoes/servicos/sumula.py`
- Modify: `app/competicoes/servicos/partidas.py`
- Create: `app/competicoes/api/sumula.py`
- Test: `competition_tests/consolidacao/test_servico_sumula.py`

- [ ] **Step 1: Write failing integration tests** (`test_servico_sumula.py`) cobrindo:
  - Registro de ocorrências (`GOL`, `GOL_CONTRA`, `CARTAO_AMARELO`, `CARTAO_VERMELHO_DIRETO`) com idempotência por `Idempotency-Key`.
  - Primeiro evento inicia partida `AGENDADA` -> `EM_ANDAMENTO` (exigindo edição `EM_ANDAMENTO`).
  - Segundo amarelo gera automaticamente `EXPULSAO_SEGUNDO_AMARELO`; remover o 2º amarelo remove a expulsão derivada.
  - Atribuir autor a gol sem autoria não altera placar; em partida finalizada exige `motivo` e edição reaberta.
  - Resultado simples preserva gols com autoria/contra e falha com 422 se tentar reduzir abaixo deles.
  - Reabertura de partida eliminatória limpa vagas e partidas descendentes não iniciadas, mas retorna 409 se a final ou disputa de 3º lugar já tiver começado.
  - Endpoint de artilharia da edição (`GET /edicoes/{id}/artilharia`).
- [ ] **Step 2: Run test to verify RED**.
- [ ] **Step 3: Implement services and API endpoints**.
- [ ] **Step 4: Run test to verify GREEN**.

---

### Task 5: Serviços e API de Disciplina — Suspensões, Cumprimentos, Alertas e Ajustes

**Files:**
- Create: `app/competicoes/servicos/disciplina.py`
- Create: `app/competicoes/api/disciplina.py`
- Test: `competition_tests/consolidacao/test_servico_disciplina.py`

- [ ] **Step 1: Write failing integration tests** (`test_servico_disciplina.py`) cobrindo:
  - Reconciliação automática de suspensões ao finalizar partida (acúmulo de amarelos, segundo amarelo, vermelho direto) sem duplicar ao reprocessar.
  - Cumprimento explícito de suspensão (`POST /suspensoes/{id}/cumprimentos`) exigindo partida posterior da equipe, `FINALIZADA`, respeitando `UNIQUE(id_partida, id_integrante)` (409 se tentar usar a mesma partida duas vezes para o mesmo integrante, ou partida anterior/cancelada).
  - Jogador suspenso em campo gera alerta em `obter_painel_disciplinar` e na súmula, mas **não bloqueia** o registro de gol/cartão na partida seguinte.
  - Correção de súmula que remove cartão de suspensão já cumprida coloca a suspensão em `EM_REVISAO`.
  - Ajuste manual e criação manual de suspensão exigindo `motivo` e gerando auditoria.
- [ ] **Step 2: Run test to verify RED**.
- [ ] **Step 3: Implement services and API endpoints**.
- [ ] **Step 4: Run test to verify GREEN**.

---

### Task 6: Serviços e API de Ciclo de Vida da Edição, Reabertura de Grupos e Decisões de Desempate

**Files:**
- Modify: `app/competicoes/servicos/organizacao.py`
- Modify: `app/competicoes/api/organizacao.py`
- Modify: `app/competicoes/servicos/disputa.py`
- Modify: `app/competicoes/api/disputa.py`
- Modify: `app/competicoes/servicos/classificacao.py`
- Modify: `app/competicoes/api/classificacao.py`
- Test: `competition_tests/consolidacao/test_servico_ciclo_vida_desempate.py`

- [ ] **Step 1: Write failing integration tests** (`test_servico_ciclo_vida_desempate.py`) cobrindo:
  - Ciclo de vida da edição: `iniciar`, `finalizar` (bloqueado se houver jogo não finalizado ou cancelado, ou empate persistente no título/vagas), `reabrir` (com motivo obrigatório), `cancelar` (com motivo obrigatório, bloqueando novas escritas esportivas).
  - Exclusão restrita: bloquear exclusão de evento/competição com edições ou edição de evento com competições vinculadas.
  - Registro de decisão manual de desempate (`POST /edicoes/{id}/decisoes-classificacao` com motivo), resolvendo empate persistente para permitir encerrar grupos ou finalizar liga; invalidação automática da decisão se um resultado do grupo for alterado após a decisão.
  - Reabertura da fase de grupos (`POST /edicoes/{id}/reabrir-fase-grupos` com motivo): limpa vagas de mata-mata e partidas eliminatórias não iniciadas, mas bloqueia com 409 se alguma partida do mata-mata já iniciou.
- [ ] **Step 2: Run test to verify RED**.
- [ ] **Step 3: Implement services and API endpoints**.
- [ ] **Step 4: Run test to verify GREEN**.

---

### Task 7: Frontend — Súmula Detalhada, Reabertura Justificada, Desempate Manual e Ciclo de Vida

**Files:**
- Create: `frontend/src/components/competicoes/disputa/ModalSumulaDetalhada.tsx`
- Create: `frontend/src/components/competicoes/disputa/ModalReabrirPartida.tsx`
- Modify: `frontend/src/components/competicoes/disputa/VisualizadorPartidas.tsx`
- Modify: `frontend/src/components/competicoes/classificacao/TabelaClassificacao.tsx`
- Create: `frontend/e2e/sumula.spec.ts`

- [ ] **Step 1: Implement components and E2E tests** (`sumula.spec.ts`) testando abertura da súmula detalhada, lançamento de gol com autor, gol contra (somando para o adversário), dois amarelos gerando expulsão automática, reabertura justificada de partida e resolução manual de empate na classificação.
- [ ] **Step 2: Verify `npx tsc --noEmit`, `npm run build` and Playwright E2E GREEN**.

---

### Task 8: Frontend — Painel de Disciplina, Cumprimento de Suspensões e Artilharia

**Files:**
- Create: `frontend/src/components/competicoes/disciplina/PainelDisciplina.tsx`
- Create: `frontend/src/components/competicoes/disciplina/ModalCumprirSuspensao.tsx`
- Create: `frontend/src/components/competicoes/disciplina/ModalAjustarSuspensao.tsx`
- Create: `frontend/e2e/disciplina.spec.ts`

- [ ] **Step 1: Implement components and E2E tests** (`disciplina.spec.ts`) testando visualização da aba Disciplina & Artilharia, exibição da tabela de artilheiros, alerta não-bloqueante de suspenso, confirmação explícita de cumprimento de suspensão em partida finalizada posterior e ajuste manual justificado.
- [ ] **Step 2: Verify `npx tsc --noEmit`, `npm run build` and Playwright E2E GREEN**.

---

### Task 9: Portão de Saída da Fatia 3 — Integração E2E, MySQL Harness e Checkpoint

**Files:**
- Create: `competition_tests/consolidacao/test_e2e_fatia3.py`
- Create: `docs/superpowers/status/2026-10-15-fatia3-complete-checkpoint.md`

- [ ] **Step 1: Write and run `test_e2e_fatia3.py`** validando o fluxo ponta a ponta completo da Fatia 3 nos três formatos.
- [ ] **Step 2: Run MySQL 8 schema equivalence harness** (`scripts/testar_mysql_competicoes.py`), suíte Pytest completa e suíte Playwright E2E completa.
- [ ] **Step 3: Document checkpoint** (`2026-10-15-fatia3-complete-checkpoint.md`).
