# Fatia 2 — Estrutura da Disputa e Resultado Simples: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar toda a estrutura de disputa (grupos, duelos eliminatórios e vagas), geração determinística de calendário/chaveamento, partidas com agendamento opcional, registro de resultado simples (placar derivado de gols em ocorrências) com idempotência, cálculo de classificação com mini-tabela de desempate, e interface completa com abas de Jogos & Súmula e Classificação.

**Architecture:** Mapeamento explícito de disputa em grafos de `vagas_duelo` com FKs compostas garantindo isolamento por edição. Geração algorítmica desacoplada em motores puros (`motores/chaveamento.py`, `motores/classificacao.py`, `motores/avanco.py`). Placar estritamente agregado a partir de `ocorrencias_partida` (sem coluna paralela de placar). Frontend com atualização otimista, modais operacionais e árvore de mata-mata.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic V2, MySQL 8 / SQLite, Next.js 16 (App Router / Turbopack), TypeScript estrito, Tailwind CSS, Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md`](../specs/2026-10-15-competicoes-fatias-design.md) (Seção 6).

## Global Constraints

- Nunca editar `.env`, `.env.example` ou credenciais do sistema.
- Não executar testes destrutivos ou migrações diretas no banco sem autorização do usuário.
- DDL e schemas devem ser 100% compatíveis com MySQL 8 local e TiDB Cloud v8.5.3 (regras de FK composta e CHECKs espelhados na camada de serviço conforme R17/R18).
- Placar é sempre agregação de ocorrências (`ocorrencias_partida`), nunca coluna avulsa editável na tabela `partidas`.
- Integrantes e equipes de partidas e duelos pertencem obrigatoriamente à mesma edição esportiva (FKs compostas).
- Isolamento estrito de arquivos por onda paralela conforme R1; o controlador revisa e comita explicitamente cada conjunto.

---

## Estrutura de Arquivos Planejada

```
app/
├── competicoes/
│   ├── modelos/
│   │   ├── disputa.py       # Grupos, DuelosEliminatorios e VagasDuelo
│   │   ├── partidas.py      # Partidas e OcorrenciasPartida
│   │   └── ...
│   ├── contratos/
│   │   ├── disputa.py       # Pydantic schemas para grupos, chaveamento e duelos
│   │   ├── partidas.py      # Pydantic schemas para partidas, agendamento e resultado simples
│   │   └── classificacao.py # Pydantic schemas para tabela de classificação
│   ├── servicos/
│   │   ├── motores/
│   │   │   ├── chaveamento.py   # Algoritmos puros de round-robin, folgas e cruzamentos
│   │   │   ├── avanco.py        # Resolução de duelos e propagação no grafo de vagas
│   │   │   └── classificacao.py # Cálculo de tabela, pontuação e mini-tabela de desempate
│   │   ├── disputa.py       # Orquestração de geração de tabela e encerramento de grupos
│   │   ├── partidas.py      # Agendamento e registro de placar simples com idempotência
│   │   └── classificacao.py # Serviço de cálculo e consulta da classificação
│   └── api/
│       ├── disputa.py       # Endpoints /edicoes/{id}/gerar-tabela, /disputa, /encerrar-grupos
│       ├── partidas.py      # Endpoints /partidas, /agendamento, /resultado-simples
│       └── classificacao.py # Endpoints /edicoes/{id}/classificacao
alembic/
└── versions/
    └── 20261015_0300_disputa_partidas.py # Migração Alembic da Fatia 2
frontend/src/
├── types/
│   └── competicoes.ts       # Extensão com contratos de disputa, partidas e classificação
├── services/
│   └── competicoes.ts       # Extensão do cliente HTTP para a Fatia 2
└── components/competicoes/
    ├── disputa/
    │   ├── VisualizadorPartidas.tsx  # Lista de jogos por rodada e grupo/fase
    │   ├── ChaveamentoEliminatorio.tsx # Árvore visual (Bracket) do mata-mata
    │   ├── ModalAgendarPartida.tsx   # Modal de agendamento opcional
    │   └── ModalResultadoSimples.tsx # Modal para inserção de placar e pênaltis
    └── classificacao/
        └── TabelaClassificacao.tsx   # Componente de classificação pontuada com abas de grupos
```

---

## Ondas de Execução

- **Onda A:** Task 1 (Banco de Dados, Modelos e Migração Alembic `20261015_0300`).
- **Onda B (Paralela):** Task 2 (Contratos Pydantic e Motor de Chaveamento) + Task 3 (Motores de Avanço e Classificação).
- **Onda C (Paralela):** Task 4 (Serviço & API de Disputa) + Task 5 (Serviço & API de Partidas) + Task 6 (Serviço & API de Classificação).
- **Onda D (Paralela):** Task 7 (Frontend: Contratos TS, Cliente e Jogos/Súmula) + Task 8 (Frontend: Chaveamento Bracket e Tabela de Classificação).
- **Onda E:** Task 9 (Testes de Integração E2E, Harness MySQL Real e Portão de Fechamento da Fatia 2).

---

### Task 1: Banco de Dados — Modelos ORM e Migração Alembic `20261015_0300`

**Files:**
- Create: `app/competicoes/modelos/disputa.py`
- Create: `app/competicoes/modelos/partidas.py`
- Modify: `app/competicoes/modelos/pessoas.py` (adicionar `id_grupo` em `Equipe`)
- Modify: `app/competicoes/modelos/operacao.py` (adicionar FK em `RequisicaoPartida.id_partida`)
- Modify: `app/competicoes/modelos/__init__.py` (reexportar novos modelos)
- Create: `alembic/versions/20261015_0300_disputa_partidas.py`
- Test: `competition_tests/consolidacao/test_schema_fatia2.py`

**Interfaces:**
- Consumes: `edicoes_competicao`, `equipes`, `locais`, `arbitros`, `usuarios`.
- Produces: `grupos_competicao`, `duelos_eliminatorios`, `vagas_duelo`, `partidas`, `ocorrencias_partida`.

- [ ] **Step 1: Write failing schema and model tests**

```python
# competition_tests/consolidacao/test_schema_fatia2.py
import pytest
from sqlalchemy import text
from app.competicoes.modelos.disputa import GrupoCompeticao, DueloEliminatorio, VagaDuelo
from app.competicoes.modelos.partidas import Partida, OcorrenciaPartida

def test_tabelas_fatia2_registradas_no_metadata(schema_migrado):
    tabelas = set(schema_migrado.get_table_names())
    assert {"grupos_competicao", "duelos_eliminatorios", "vagas_duelo", "partidas", "ocorrencias_partida"} <= tabelas

def test_fk_composta_equipe_grupo(db, schema_migrado):
    cols = {c["name"] for c in schema_migrado.get_columns("equipes")}
    assert "id_grupo" in cols
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_schema_fatia2.py`
Expected: FAIL (tabelas e colunas ainda não existem).

- [ ] **Step 3: Implement ORM models and Alembic migration `20261015_0300`**

Implementar `GrupoCompeticao`, `DueloEliminatorio`, `VagaDuelo`, `Partida` e `OcorrenciaPartida` com todas as constraints descritas nas seções 6.1, 6.2 e 6.3 da spec (FKs compostas com `id_edicao_competicao`, CHECKs e UNIQUEs). Gerar a migração `20261015_0300_disputa_partidas.py`.

- [ ] **Step 4: Run tests and MySQL harness to verify passes**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_schema_fatia2.py`
Run: `scripts/testar_mysql_competicoes.py`
Expected: PASS em SQLite e MySQL descartável.

- [ ] **Step 5: Commit**

```bash
git add app/competicoes/modelos/ alembic/versions/ competition_tests/consolidacao/test_schema_fatia2.py
git commit -m "feat(competicoes): modelos e migracao da fatia 2 (disputa, duelos e partidas)"
```

---

### Task 2: Contratos Pydantic e Motor de Chaveamento

**Files:**
- Create: `app/competicoes/contratos/disputa.py`
- Create: `app/competicoes/servicos/motores/chaveamento.py`
- Test: `competition_tests/consolidacao/test_motor_chaveamento.py`

**Interfaces:**
- Produces:
  - `gerar_rodadas_pontos_corridos(equipes_ids: list[int], turno_returno: bool) -> list[RodadaGerada]`
  - `distribuir_equipes_grupos(equipes_ids: list[int], qtd_grupos: int) -> dict[int, list[int]]`
  - `gerar_arvore_mata_mata(equipes_ou_vagas: list[dict], ida_volta: bool, terceiro_lugar: bool) -> ArvoreMataMataGerada`

- [ ] **Step 1: Write failing tests for round-robin and bracket generator**

Testar liga par (4 equipes = 3 rodadas), liga ímpar (5 equipes = 5 rodadas com 1 folga por rodada, sem jogo fictício), returno com mandos invertidos, eliminatória com 6 equipes (gera 2 folgas na primeira fase), terceiro lugar com 2 semis.

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_motor_chaveamento.py`
Expected: FAIL.

- [ ] **Step 3: Implement `chaveamento.py` and Pydantic schemas**

Implementar algoritmo do polígono determinístico, distribuição uniforme em grupos e geração da árvore de mata-mata com `vagas_duelo`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_motor_chaveamento.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/competicoes/contratos/disputa.py app/competicoes/servicos/motores/chaveamento.py competition_tests/consolidacao/test_motor_chaveamento.py
git commit -m "feat(competicoes): contratos de disputa e motor deterministico de chaveamento"
```

---

### Task 3: Motores de Avanço de Fase e Classificação

**Files:**
- Create: `app/competicoes/contratos/classificacao.py`
- Create: `app/competicoes/servicos/motores/avanco.py`
- Create: `app/competicoes/servicos/motores/classificacao.py`
- Test: `competition_tests/consolidacao/test_motor_classificacao.py`
- Test: `competition_tests/consolidacao/test_motor_avanco.py`

**Interfaces:**
- Produces:
  - `calcular_tabela(partidas: list[PartidaDados], configuracao: Configuracao) -> list[LinhaClassificacao]`
  - `resolver_duelo(duelo: DueloDados, partidas: list[PartidaDados]) -> ResultadoDueloResolvido`
  - `propagar_avanco_grafo(vagas: list[VagaDados], duelo_resolvido: DueloDados) -> list[VagaAtualizacao]`

- [ ] **Step 1: Write failing tests for classification and bracket progression**

Testar cálculo de J/V/E/D/GP/GC/SG/PTS; desempate por saldo, gols pró e confronto direto (mini-tabela); detecção de empate persistente (nunca desempata por ID); avanço em jogo único e ida e volta; resolução de folga automática (`RESOLVIDO`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_motor_classificacao.py competition_tests/consolidacao/test_motor_avanco.py`
Expected: FAIL.

- [ ] **Step 3: Implement `classificacao.py` and `avanco.py`**

Implementar mini-tabela recursiva de confronto direto apenas com jogos finalizados entre empatados; implementar resolvedor de duelos agregando mandante e visitante em ida e volta com pênaltis no jogo de volta.

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_motor_classificacao.py competition_tests/consolidacao/test_motor_avanco.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/competicoes/contratos/classificacao.py app/competicoes/servicos/motores/ competition_tests/consolidacao/test_motor_classificacao.py competition_tests/consolidacao/test_motor_avanco.py
git commit -m "feat(competicoes): motores de classificacao e avanco de eliminatorias"
```

---

### Task 4: Serviços e API de Disputa & Geração de Calendário

**Files:**
- Create: `app/competicoes/servicos/disputa.py`
- Create: `app/competicoes/api/disputa.py`
- Modify: `app/competicoes/api/__init__.py` (incluir router de disputa)
- Test: `competition_tests/consolidacao/test_servico_disputa.py`

**Interfaces:**
- Produces:
  - `gerar_tabela_edicao(db: Session, id_edicao: int, dados: TabelaGerar, responsavel: Usuario) -> EstruturaDisputaDetalhe`
  - `desfazer_tabela_edicao(db: Session, id_edicao: int, responsavel: Usuario) -> None`
  - `obter_estrutura_disputa(db: Session, id_edicao: int) -> EstruturaDisputaDetalhe`
  - `encerrar_fase_grupos(db: Session, id_edicao: int, responsavel: Usuario) -> EstruturaDisputaDetalhe`

- [ ] **Step 1: Write failing service and API tests**

Cenários: geração em rascunho com bloqueio pessimista; validação de mínimo 1 integrante por equipe; geração de grupos e liga; desfazer tabela sem jogos iniciados; encerrar fase de grupos validando ausência de empates não resolvidos.

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_servico_disputa.py`
Expected: FAIL.

- [ ] **Step 3: Implement service and REST router**

Endpoints: `POST /edicoes/{id}/gerar-tabela`, `DELETE /edicoes/{id}/tabela`, `GET /edicoes/{id}/disputa`, `POST /edicoes/{id}/encerrar-grupos`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_servico_disputa.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/competicoes/servicos/disputa.py app/competicoes/api/disputa.py app/competicoes/api/__init__.py competition_tests/consolidacao/test_servico_disputa.py
git commit -m "feat(competicoes): servicos e API de estrutura de disputa e geracao de tabela"
```

---

### Task 5: Serviços e API de Partidas, Agendamento e Placar Simples

**Files:**
- Create: `app/competicoes/contratos/partidas.py`
- Create: `app/competicoes/servicos/partidas.py`
- Create: `app/competicoes/api/partidas.py`
- Modify: `app/competicoes/api/__init__.py` (incluir router de partidas)
- Test: `competition_tests/consolidacao/test_servico_partidas.py`

**Interfaces:**
- Produces:
  - `listar_partidas(db: Session, id_edicao: int, id_grupo: int | None, fase: str | None, rodada: int | None) -> list[PartidaDetalhe]`
  - `agendar_partida(db: Session, id_partida: int, dados: PartidaAgendar, responsavel: Usuario) -> PartidaDetalhe`
  - `registrar_resultado_simples(db: Session, id_partida: int, dados: ResultadoSimples, idempotency_key: str, responsavel: Usuario) -> PartidaDetalhe`

- [ ] **Step 1: Write failing tests for partidas and resultado simples**

Cenários: listagem com filtros; agendamento opcional (campos nulos aceitos); resultado simples idempotente gerando ocorrências de gol; placar agregado; recusa se edição não estiver em andamento; avanço automático do vencedor para a próxima fase.

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_servico_partidas.py`
Expected: FAIL.

- [ ] **Step 3: Implement service and REST router**

Endpoints: `GET /edicoes/{id}/partidas`, `PATCH /partidas/{id}/agendamento`, `POST /partidas/{id}/resultado-simples`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_servico_partidas.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/competicoes/contratos/partidas.py app/competicoes/servicos/partidas.py app/competicoes/api/partidas.py app/competicoes/api/__init__.py competition_tests/consolidacao/test_servico_partidas.py
git commit -m "feat(competicoes): servicos e API de partidas, agendamento e resultado simples"
```

---

### Task 6: Serviços e API de Classificação

**Files:**
- Create: `app/competicoes/servicos/classificacao.py`
- Create: `app/competicoes/api/classificacao.py`
- Modify: `app/competicoes/api/__init__.py` (incluir router de classificação)
- Test: `competition_tests/consolidacao/test_servico_classificacao.py`

**Interfaces:**
- Produces:
  - `obter_classificacao_edicao(db: Session, id_edicao: int) -> TabelaClassificacaoDetalhe`

- [ ] **Step 1: Write failing tests for classificacao API**

Cenários: classificação geral em pontos corridos; classificação separada por grupos; mini-tabela aplicada entre empatados; jogos finalizados computados.

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_servico_classificacao.py`
Expected: FAIL.

- [ ] **Step 3: Implement service and router**

Endpoint: `GET /edicoes/{id}/classificacao`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest competition_tests/consolidacao/test_servico_classificacao.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/competicoes/servicos/classificacao.py app/competicoes/api/classificacao.py app/competicoes/api/__init__.py competition_tests/consolidacao/test_servico_classificacao.py
git commit -m "feat(competicoes): servicos e API de consulta da classificacao pontuada"
```

---

### Task 7: Frontend — Contratos TypeScript, Cliente HTTP e Aba de Jogos & Súmula

**Files:**
- Modify: `frontend/src/types/competicoes.ts`
- Modify: `frontend/src/services/competicoes.ts`
- Create: `frontend/src/components/competicoes/disputa/VisualizadorPartidas.tsx`
- Create: `frontend/src/components/competicoes/disputa/ModalAgendarPartida.tsx`
- Create: `frontend/src/components/competicoes/disputa/ModalResultadoSimples.tsx`
- Modify: `frontend/src/components/competicoes/organizacao/PainelEdicao.tsx` (habilitar aba Jogos & Súmula)
- Test: `frontend/e2e/jogos.spec.ts`

**Interfaces:**
- Produces: Visualização de jogos por rodadas e grupos, agendamento de jogos e lançamento de resultado simples diretamente pela UI.

- [ ] **Step 1: Write failing e2e Playwright test for match scheduling and score recording**

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx playwright test e2e/jogos.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement components, types and API client**

- [ ] **Step 4: Run typecheck and e2e test to verify it passes**

Run: `cd frontend && npx tsc --noEmit && npx playwright test e2e/jogos.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/competicoes.ts frontend/src/services/competicoes.ts frontend/src/components/competicoes/disputa/ frontend/src/components/competicoes/organizacao/PainelEdicao.tsx frontend/e2e/jogos.spec.ts
git commit -m "feat(frontend): gestao de partidas, agendamento e resultado simples"
```

---

### Task 8: Frontend — Chaveamento Visual (Bracket) e Tabela de Classificação

**Files:**
- Create: `frontend/src/components/competicoes/disputa/ChaveamentoEliminatorio.tsx`
- Create: `frontend/src/components/competicoes/classificacao/TabelaClassificacao.tsx`
- Modify: `frontend/src/components/competicoes/organizacao/PainelEdicao.tsx` (habilitar aba Classificação)
- Test: `frontend/e2e/classificacao.spec.ts`

**Interfaces:**
- Produces: Diagrama visual de árvore eliminatória com avanço de times e tabela de classificação com critérios de desempate.

- [ ] **Step 1: Write failing e2e Playwright test for classification and bracket**

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx playwright test e2e/classificacao.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement bracket and classification components**

- [ ] **Step 4: Run typecheck and e2e test to verify it passes**

Run: `cd frontend && npx tsc --noEmit && npx playwright test e2e/classificacao.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/competicoes/disputa/ChaveamentoEliminatorio.tsx frontend/src/components/competicoes/classificacao/TabelaClassificacao.tsx frontend/src/components/competicoes/organizacao/PainelEdicao.tsx frontend/e2e/classificacao.spec.ts
git commit -m "feat(frontend): chaveamento eliminatorio em arvore e tabela de classificacao"
```

---

### Task 9: Integração E2E, Harness MySQL Real e Portão de Saída da Fatia 2

**Files:**
- Create: `competition_tests/consolidacao/test_e2e_fatia2.py`
- Modify: `docs/superpowers/status/2026-10-15-fatia2-complete-checkpoint.md`
- Test: All test suites.

**Interfaces:**
- Valida o fluxo completo de um campeonato (pontos corridos, grupos e mata-mata), desde a geração determinística até o encerramento com placar e classificação.

- [ ] **Step 1: Write full lifecycle E2E integration test**

Criar campeonato de teste, cadastrar equipes com elencos, gerar tabela, lançar placares simples com concorrência e idempotência, avançar duelos eliminatórios e verificar classificação final.

- [ ] **Step 2: Execute MySQL harness against real MySQL 8 local**

Run: `python scripts/testar_mysql_competicoes.py`
Expected: `Schema do MySQL equivalente ao metadata ORM: sem divergencias.`

- [ ] **Step 3: Run full backend and frontend regression gates**

Run: `.venv/bin/pytest competition_tests/consolidacao/`
Run: `PYTHONPATH=. .venv/bin/pytest tests migration_tests -m 'not mysql'`
Run: `cd frontend && npx tsc --noEmit && npm run build && npx playwright test`
Expected: All suites 100% GREEN.

- [ ] **Step 4: Commit and create checkpoint**

```bash
git add competition_tests/consolidacao/test_e2e_fatia2.py docs/superpowers/status/2026-10-15-fatia2-complete-checkpoint.md
git commit -m "test(competicoes): integracao e portao de fechamento da fatia 2"
```
