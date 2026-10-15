# V2 Domínio de Competições — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a `Competicao` no cidadão de primeira classe do sistema esportivo, com configuração dinâmica e flexível de formatos para Futebol/Futsal (Pontos Corridos, Grupos + Mata-Mata, Mata-Mata com Ida/Volta e 3º Lugar), cadastro direto de equipes e jogadores, súmula rápida de beira de campo em tempo real (gols, artilharia e cartões) e portal público agregador para eventos/olimpíadas.

**Architecture:** A `Competicao` passa a existir de forma independente (sem obrigatoriedade de Evento ou Edição pai). O `GrupoCompeticoes` (Evento) atua como um agrupador opcional que reúne competições para exibição no portal público. O motor esportivo calcula classificação com desempates ordenáveis e promove vencedores na árvore mata-mata. Uma nova interface reativa permite criar competições em minutos e operar jogos ao vivo via mobile/tablet.

**Tech Stack:** FastAPI (Python 3.14 / SQLAlchemy 2.0 / Alembic / Pydantic v2), Next.js 16 (React 19 / TypeScript / TailwindCSS / Lucide Icons / SWR), SQLite / MySQL.

**Spec:** [`docs/superpowers/specs/2026-09-14-competition-domain-v2-design.md`](file:///home/eduardo/Documentos/Projetos/FS-GerenciaDesportos/docs/superpowers/specs/2026-09-14-competition-domain-v2-design.md)

## Global Constraints
- **Zero Commits Git**: O fluxo SDD deste projeto proíbe comandos `git commit`. A preservação do histórico é feita via uncommitted scoped diffs e verificação direta de arquivos.
- **Isolamento de Banco Real**: Todos os testes unitários e de integração devem rodar em SQLite em memória ou instâncias voláteis em `/tmp`. Nunca acessar credenciais de produção ou alterar `.env`.
- **Compatibilidade do Domínio de Escolinhas**: As entidades e rotas de Alunos, Turmas, Matrículas e Presenças não devem sofrer quebras ou alterações destrutivas.
- **Formatação e Linting**: O comando `git diff --check` deve retornar 100% limpo (código 0) ao final de cada tarefa.
- **Frontend Typecheck & Build**: `npx tsc --noEmit` deve passar com 0 erros e `npm run build` deve compilar todas as rotas com sucesso.

---

## Estrutura de Arquivos e Responsabilidades

### Backend
- `app/models.py`: Modelos SQLAlchemy para `Competicao` (com `id_grupo`, `regras_formato`), `GrupoCompeticoes`, `Equipe`, `Jogador`, `Confronto`, `OcorrenciaPartida`.
- `app/schemas.py`: Schemas Pydantic v2 de validação e serialização para as novas entidades e os 3 formatos flexíveis.
- `alembic/versions/20260914_0006_competicao_v2.py`: Migração Alembic aditiva com suporte a SQLite e MySQL offline.
- `app/services/competicoes_v2.py`: Criação, atualização e ciclo de vida de competições independentes e grupos de competições.
- `app/services/confrontos_v2.py`: Algoritmos de geração de jogos (Pontos Corridos, Grupos com cruzamento, Mata-mata com Ida/Volta e 3º lugar).
- `app/services/sumula_v2.py`: Registro em tempo real de gols, cartões e encerramento de partidas.
- `app/services/classificacao_v2.py`: Recálculo de tabelas com desempates configuráveis e ranking de artilharia.
- `app/routers/competicoes_v2.py`: Endpoints REST administrativos para competições, grupos, equipes, confrontos e súmulas.
- `app/routers/publico_v2.py`: Endpoints públicos do portal agregador (sem autenticação, seguros LGPD).

### Frontend
- `frontend/src/types/competicoesV2.ts`: Contratos e interfaces TypeScript completas.
- `frontend/src/services/competicoesV2.ts`: Cliente HTTP encapsulando as chamadas à API V2.
- `frontend/src/app/dashboard/competicoes/page.tsx`: Lista de competições com filtros e atalho de criação.
- `frontend/src/app/dashboard/competicoes/[id]/page.tsx`: Painel master da competição (4 abas).
- `frontend/src/components/competicoes-v2/ModalNovaCompeticaoV2.tsx`: Formulário dinâmico e reativo de criação.
- `frontend/src/components/competicoes-v2/GestaoEquipesElencos.tsx`: Cadastro de equipes e gaveta de jogadores.
- `frontend/src/components/competicoes-v2/TabelaJogosConfrontos.tsx`: Gestão de partidas com filtros e atalhos.
- `frontend/src/components/competicoes-v2/ArvoreMataMataV2.tsx`: Visualização eliminatória com ida/volta e 3º lugar.
- `frontend/src/components/competicoes-v2/ModalSumulaAoVivo.tsx`: Interface de beira de campo para tablet/celular.
- `frontend/src/components/competicoes-v2/ArtilhariaCartoes.tsx`: Estatísticas de goleadores e suspensões.
- `frontend/src/app/publico/evento/[slug]/page.tsx`: Portal público agregador com abas de competições.

---

## Fases e Tarefas de Implementação

### Fase 1: Fundação do Modelo de Dados e Schemas V2

#### Task 1: Modelos ORM, Schemas e Migração Alembic V2
**Responsável**: Subagente Backend 1  
**Arquivos:**
- Modificar: `app/models.py`
- Modificar: `app/schemas.py`
- Criar: `alembic/versions/20260914_0006_competicao_v2.py`
- Criar: `competition_tests/test_v2_modelos_schemas.py`

**Interfaces:**
- Produz: `models.GrupoCompeticoes`, `models.Jogador`, `models.OcorrenciaPartida`, `schemas.CompeticaoV2Create`, `schemas.RegrasFormatoSchema`.

- [ ] **Passo 1.1: Criar os testes unitários de modelo e schemas (RED)**
  - Escrever `competition_tests/test_v2_modelos_schemas.py` testando a instanciação de `Competicao` com `regras_formato` em JSON (Pontos Corridos com turno/returno, Grupos com ida/volta e mata-mata, Mata-mata com 3º lugar), criação de `GrupoCompeticoes`, `Equipe` e `Jogador`, e ocorrências de súmula (`OcorrenciaPartida`).
  - Executar: `PYTHONPATH=. .venv/bin/pytest competition_tests/test_v2_modelos_schemas.py` (deve falhar).

- [ ] **Passo 1.2: Implementar as entidades em `app/models.py`**
  - Adicionar `class GrupoCompeticoes(Base)`.
  - Adicionar `class Jogador(Base)` vinculado a `Equipe`.
  - Adicionar `class OcorrenciaPartida(Base)` vinculado a `Confronto`, `Equipe` e `Jogador`.
  - Atualizar `Competicao` para incluir `id_grupo = Column(Integer, ForeignKey("grupos_competicoes.id_grupo"), nullable=True)` e `regras_formato = Column(JSON, nullable=True)`.

- [ ] **Passo 1.3: Implementar schemas em `app/schemas.py`**
  - Definir schemas de validação para cada formato: `RegrasPontosCorridosSchema`, `RegrasGruposMataMataSchema`, `RegrasMataMataSchema`.
  - Definir schemas de `JogadorCreate`, `JogadorResponse`, `OcorrenciaPartidaCreate`, `OcorrenciaPartidaResponse`.
  - Definir `CompeticaoV2Create`, `CompeticaoV2Response`, `GrupoCompeticoesCreate`, `GrupoCompeticoesResponse`.

- [ ] **Passo 1.4: Criar a migração Alembic `20260914_0006_competicao_v2.py`**
  - DDL explícito criando `grupos_competicoes`, `jogadores`, `ocorrencias_partida` e alterando `competicoes`.
  - Testar compilação MySQL offline: `DATABASE_URL="mysql+pymysql://user:pass@localhost/gerencia" .venv/bin/alembic upgrade head --sql`.

- [ ] **Passo 1.5: Executar testes de validação (GREEN)**
  - Executar: `PYTHONPATH=. .venv/bin/pytest competition_tests/test_v2_modelos_schemas.py` (deve passar com 100%).
  - Verificar: `git diff --check` limpo.

---

### Fase 2: Motores de Negócio & API em Paralelo (Subagentes Concorrentes)

#### Task 2: Motor de Geração de Confrontos & Súmula Rápida
**Responsável**: Subagente Backend 2 (Execução Concorrente)  
**Arquivos:**
- Criar: `app/services/confrontos_v2.py`
- Criar: `app/services/sumula_v2.py`
- Criar: `competition_tests/test_v2_confrontos_sumula.py`

**Interfaces:**
- Consome: `models.Competicao`, `models.Equipe`, `models.Confronto`, `models.OcorrenciaPartida`.
- Produz: `gerar_tabela_confrontos_v2(db, competicao)`, `registrar_ocorrencia(db, confronto_id, dados)`, `finalizar_confronto_v2(db, confronto_id, penaltis)`.

- [ ] **Passo 2.1: Criar os testes unitários do motor de confrontos e súmula (RED)**
  - Testar geração de round-robin com turno e returno.
  - Testar geração de fase de grupos e chaveamento de cruzamento para o mata-mata.
  - Testar confrontos de mata-mata com Ida e Volta (agregação de placares) e decisão por pênaltis.
  - Testar disputa de 3º lugar.
  - Testar registro de gol atualizando placar do confronto instantaneamente.
  - Testar acúmulo de cartões amarelos gerando vermelho.

- [ ] **Passo 2.2: Implementar `app/services/confrontos_v2.py`**
  - Algoritmo de geração para os 3 formatos flexíveis com base no JSON `regras_formato`.
  - Tratamento de chaveamento eliminatório com pares de jogos (Ida e Volta) e vaga de 3º lugar.
  - Promoção de vencedor com trava de segurança retroativa.

- [ ] **Passo 2.3: Implementar `app/services/sumula_v2.py`**
  - Lógica rápida de beira de campo: `adicionar_gol`, `remover_gol`, `adicionar_cartao`, `encerrar_partida`.
  - Recálculo automático de placar e definição de classificado por placar agregado ou pênaltis.

- [ ] **Passo 2.4: Executar os testes (GREEN)**
  - Executar: `PYTHONPATH=. .venv/bin/pytest competition_tests/test_v2_confrontos_sumula.py`.

---

#### Task 3: Motor de Classificação & Artilharia
**Responsável**: Subagente Backend 3 (Execução Concorrente)  
**Arquivos:**
- Criar: `app/services/classificacao_v2.py`
- Criar: `competition_tests/test_v2_classificacao_artilharia.py`

**Interfaces:**
- Consome: `models.Competicao`, `models.Confronto`, `models.OcorrenciaPartida`.
- Produz: `calcular_classificacao_v2(db, id_competicao)`, `obter_artilharia_v2(db, id_competicao)`, `obter_disciplinar_v2(db, id_competicao)`.

- [ ] **Passo 3.1: Criar os testes do motor de classificação e estatísticas (RED)**
  - Testar classificação de pontos corridos com aplicação ordenada de critérios de desempate (Pontos, Vitórias, Saldo, Gols Pró, Confronto Direto, Menos Cartões).
  - Testar classificação por grupos com zonas de corte para o mata-mata.
  - Testar agregação de artilharia somando os gols marcados por atleta.
  - Testar relatório de cartões e atletas suspensos.

- [ ] **Passo 3.2: Implementar `app/services/classificacao_v2.py`**
  - Função matemática de ordenação por critérios dinâmicos.
  - Agrupamento de tabelas para formato `GRUPOS_MATA_MATA`.
  - Consolidação de artilheiros e cartões via consultas otimizadas no SQLAlchemy.

- [ ] **Passo 3.3: Executar testes (GREEN)**
  - Executar: `PYTHONPATH=. .venv/bin/pytest competition_tests/test_v2_classificacao_artilharia.py`.

---

#### Task 4: Roteadores REST e Endpoints V2
**Responsável**: Subagente Backend 4 (Execução Concorrente ou Sequencial)  
**Arquivos:**
- Criar: `app/routers/competicoes_v2.py`
- Criar: `app/routers/publico_v2.py`
- Modificar: `app/main.py` (registro de rotas)
- Criar: `competition_tests/test_v2_endpoints.py`

**Interfaces:**
- Consome: Serviços das Tasks 1, 2 e 3.
- Produz: Rotas REST sob `/v2/competicoes`, `/v2/grupos-competicoes`, `/v2/confrontos`, `/v2/publico`.

- [ ] **Passo 4.1: Criar testes de endpoints HTTP (RED)**
  - Testar CRUD de competição independente (`POST /v2/competicoes`, `GET /v2/competicoes/{id}`).
  - Testar cadastro de equipes e jogadores (`POST /v2/competicoes/{id}/equipes`, `POST /v2/equipes/{id}/jogadores`).
  - Testar geração de jogos e súmula rápida (`POST /v2/confrontos/{id}/ocorrencias`).
  - Testar consulta pública do evento agrupador (`GET /v2/publico/grupos/{slug}`).
  - Testar RBAC (401 anônimo para escrita, 403 não-admin, 200 público para leitura).

- [ ] **Passo 4.2: Implementar `app/routers/competicoes_v2.py` e `publico_v2.py`**
  - Rotas administrativas protegidas com `check_coordenador_role`.
  - Rotas públicas sem autenticação filtrando dados confidenciais (LGPD).

- [ ] **Passo 4.3: Registrar roteadores em `app/main.py`**
  - Incluir routers com tags e prefixos adequados.

- [ ] **Passo 4.4: Executar testes (GREEN)**
  - Executar: `PYTHONPATH=. .venv/bin/pytest competition_tests/test_v2_endpoints.py`.

---

### Fase 3: Frontend em Paralelo (Subagentes Concorrentes)

#### Task 5: Frontend - Criação Reativa & Gestão de Equipes/Elencos
**Responsável**: Subagente Frontend 1 (Execução Concorrente)  
**Arquivos:**
- Criar: `frontend/src/types/competicoesV2.ts`
- Criar: `frontend/src/services/competicoesV2.ts`
- Modificar: `frontend/src/app/dashboard/competicoes/page.tsx`
- Criar: `frontend/src/components/competicoes-v2/ModalNovaCompeticaoV2.tsx`
- Criar: `frontend/src/components/competicoes-v2/GestaoEquipesElencos.tsx`

- [ ] **Passo 5.1: Declarar tipos e serviços em `competicoesV2.ts`**
  - Tipos completos para formatos flexíveis, equipes, jogadores e grupos.
  - Funções de API: `criarCompeticao`, `listarCompeticoes`, `criarEquipe`, `adicionarJogador`, `listarJogadores`.

- [ ] **Passo 5.2: Criar `ModalNovaCompeticaoV2.tsx`**
  - Formulário dinâmico: ao selecionar formato (Pontos Corridos, Grupos + Mata-Mata, Mata-Mata Direto), renderiza na hora os seletores específicos (número de grupos, classificados, ida e volta, disputa de 3º lugar).
  - Validação em tempo real e feedback visual.

- [ ] **Passo 5.3: Criar `GestaoEquipesElencos.tsx`**
  - Lista de equipes participantes com busca.
  - Botão "+ Nova Equipe".
  - Gaveta expansível ou modal para visualizar e adicionar jogadores da equipe (Nome, Camisa, Posição).

- [ ] **Passo 5.4: Atualizar `/dashboard/competicoes/page.tsx`**
  - Listagem principal de competições com busca, badges de formato e botão de criação.

- [ ] **Passo 5.5: Validar compilação**
  - Executar: `cd frontend && npx tsc --noEmit`.

---

#### Task 6: Frontend - Painel Master, Árvore Mata-Mata & Súmula Beira de Campo
**Responsável**: Subagente Frontend 2 (Execução Concorrente)  
**Arquivos:**
- Modificar: `frontend/src/app/dashboard/competicoes/[id]/page.tsx`
- Criar: `frontend/src/components/competicoes-v2/TabelaJogosConfrontos.tsx`
- Criar: `frontend/src/components/competicoes-v2/ArvoreMataMataV2.tsx`
- Criar: `frontend/src/components/competicoes-v2/ModalSumulaAoVivo.tsx`
- Criar: `frontend/src/components/competicoes-v2/ArtilhariaCartoes.tsx`

- [ ] **Passo 6.1: Criar `TabelaJogosConfrontos.tsx`**
  - Listagem de jogos organizados por rodada/fase com filtros.
  - Botão de "Gerar Tabela" com confirmação.
  - Agendamento de local, data, hora e árbitro.
  - Botão de destaque "Súmula / Ao Vivo" em cada partida.

- [ ] **Passo 6.2: Criar `ModalSumulaAoVivo.tsx` (Beira de Campo)**
  - Layout limpo e responsivo para celular/tablet na mesa de jogo.
  - Placar grande central.
  - Botões rápidos: "+ Gol" (seleciona jogador em popup rápido), "Cartão Amarelo", "Cartão Vermelho".
  - Linha do tempo minuto a minuto de eventos.
  - Encerramento de partida com suporte a pênaltis.

- [ ] **Passo 6.3: Criar `ArvoreMataMataV2.tsx` e `ArtilhariaCartoes.tsx`**
  - Visualização em chaveamento de árvore para fases eliminatórias (com jogos de ida/volta agregados e pênaltis).
  - Tabela de classificação e ranking de artilharia com cartões acumulados.

- [ ] **Passo 6.4: Integrar no Painel Master `competicoes/[id]/page.tsx`**
  - Abas: 1. Equipes e Elencos | 2. Jogos e Confrontos | 3. Classificação e Chaveamento | 4. Estatísticas.

- [ ] **Passo 6.5: Validar compilação**
  - Executar: `cd frontend && npx tsc --noEmit`.

---

#### Task 7: Frontend - Portal Público Agrupador (`/publico/evento/[slug]`)
**Responsável**: Subagente Frontend 3 (Execução Concorrente)  
**Arquivos:**
- Criar: `frontend/src/app/publico/evento/[slug]/page.tsx`
- Criar: `frontend/src/components/publico-v2/HeaderEventoPublico.tsx`
- Criar: `frontend/src/components/publico-v2/CompeticaoPublicaView.tsx`

- [ ] **Passo 7.1: Criar `HeaderEventoPublico.tsx`**
  - Banner, título do evento/olimpíada, período e badge pulsante "AO VIVO" quando houver partidas em andamento.

- [ ] **Passo 7.2: Criar `CompeticaoPublicaView.tsx`**
  - Exibição aberta para torcedores: seletor de rodadas, jogos com autores dos gols, tabela de classificação e árvore do mata-mata.
  - Ranking de artilheiros da competição.
  - Filtro total de dados confidenciais (zero CPFs, documentos ou contatos).

- [ ] **Passo 7.3: Montar a página master `/publico/evento/[slug]/page.tsx`**
  - Barra de abas com as competições vinculadas ao evento (ex: `[Futebol Sub-17] [Futsal Adulto]`).
  - Navegação suave e responsiva sem exigir autenticação.

- [ ] **Passo 7.4: Validar compilação e build**
  - Executar: `cd frontend && npx tsc --noEmit && npm run build`.

---

### Fase 4: Integração Ponta a Ponta, Regressão e Validação Final

#### Task 8: Testes E2E Completos e Verificação de Regressão Global
**Responsável**: Subagente de Garantia de Qualidade (QA)  
**Arquivos:**
- Criar: `competition_tests/test_v2_e2e_fluxo_completo.py`

- [ ] **Passo 8.1: Implementar o teste E2E do fluxo completo V2**
  - Criação de uma Competição independente em formato `GRUPOS_MATA_MATA` com ida e volta.
  - Inscrição de 4 equipes com jogadores cadastrados no elenco.
  - Geração automática da tabela de jogos da fase de grupos.
  - Registro de gols com artilheiros e cartões via serviço de súmula rápida.
  - Finalização dos jogos e apuração da classificação dos grupos.
  - Cruzamento e promoção automática das equipes para a semifinal e grande final.
  - Desempate por pênaltis na final e consagração do campeão.
  - Agrupamento da competição em um evento/olimpíada e verificação dos dados no portal público agrupador.

- [ ] **Passo 8.2: Executar a regressão completa de backend**
  - `PYTHONPATH=. .venv/bin/pytest competition_tests/`
  - `PYTHONPATH=. .venv/bin/pytest migration_tests/`
  - `PYTHONPATH=. .venv/bin/pytest tests/`

- [ ] **Passo 8.3: Executar a verificação completa do frontend**
  - `cd frontend && npx tsc --noEmit`
  - `cd frontend && npm run build`

- [ ] **Passo 8.4: Verificar integridade de repositório**
  - `git diff --check` (deve ser 100% limpo).
  - Confirmar que nenhum commit foi realizado e nenhum arquivo residual (`test.db`) permanece no workspace.
