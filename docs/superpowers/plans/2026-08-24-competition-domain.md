# Competition Domain Implementation Plan

**Goal:** Implement `Evento → Edição → Competição`, with separate team and individual flows.

**Architecture:** Competition owns one modality, textual age category, exclusive registration mode, format, and result criterion. Team competitions use teams/confrontos; individual ones use direct registrations/provas/results.

**Spec:** `docs/superpowers/specs/2026-08-24-competition-domain-design.md`

## Global Constraints

- Do not calculate or validate ages; category is required text.
- Competition mode is exactly `EQUIPE` or `INDIVIDUAL`.
- Relays and individual-modality team results are out of scope.
- Preserve school-management behavior and existing data.
- Do not create commits.
- Executar um passo por vez com um subagente responsável e aguardar confirmação do usuário antes do próximo passo.

### Passo 1: Preparar migração versionada e proteger dados existentes

**Arquivos:** `requirements.txt`, `alembic/`, `app/database.py`, `app/main.py`.

- Adicionar Alembic e migration inicial do schema atual.
- Usar a `DATABASE_URL` da API e substituir `create_all()` em banco persistente.
- Testar banco vazio aplicando migrations.

### Passo 2: Criar o agregado `Competicao`

- Criar a competição como rascunho dentro de Evento → Edição, selecionando a modalidade. Permitir configurar a disputa antes de iniciá-la; detalhar a transição do rascunho nesta etapa.
- Rascunho exige nome, modalidade e categoria; modo, formato, critério e datas podem ser preenchidos depois. Validar a configuração resultante em cada edição e exigir esses campos para iniciar.
- A ação explícita `POST /competicoes/{id}/iniciar` faz `RASCUNHO → EM_ANDAMENTO`; o CRUD não altera status livremente. Após iniciar, bloquear edição de configuração e exclusão. Competição com equipes também não pode ser excluída ou trocar modalidade/modo.
- Acrescentar migration após a baseline aprovada para campos opcionais no rascunho e converter `PLANEJADA` para `RASCUNHO`, preservando registros e demais estados existentes.

**Arquivos:** modelos, schemas, serviço/router de competições e testes.

- Criar competição com edição, modalidade, nome, categoria, modo, formato, critério, datas, regulamento e status.
- Validar `PROVAS → INDIVIDUAL` e tabela/grupos/mata-mata → `EQUIPE`.
- Expor CRUD sob edição e `/competicoes/{id}` com escrita coordenador/admin.

### Passo 3: Migrar equipes para o escopo da competição

- Trocar vínculo principal de `Equipe → Edicao` para `Equipe → Competicao`, mantendo leitura legada até rollout.
- Criar/listar equipes somente em competição `EQUIPE`; adicionar/remover participante e impedir duas equipes na mesma competição.
- Preservar membros e partidas ao duplicar equipe histórica multi-modalidade.
- Testar modo equipe/individual, exclusividade, participação em competições distintas e permissões: criação por coordenador/admin; usuário sem permissão não adiciona/remove participante.

#### Passo 3.1: Validar migração de dados de equipes

**Arquivos:** migration em `alembic/versions/`; `scripts/validar_migracao_equipes.py`, executado apenas contra dump anonimizado.

- Para cada equipe histórica multi-modalidade, comparar partidas antes/depois por competição resultante; a soma deve ser igual ao original.
- Comparar conjunto de participantes pré/pós por competição; nenhum pode desaparecer.
- Gerar relatório `equipe original → equipes/competições geradas` para toda duplicação, destinado à revisão manual.
- Rejeitar a migration se houver equipe de modalidade não inferível com partidas associadas; o caso sem partidas entra no relatório manual.
- Critério de revisão: executar contra cópia anonimizada de produção e aprovar manualmente o relatório antes do rollout.

### Passo 4: Substituir `Partida` por fluxo de confrontos de equipe

- Criar `Confronto` por competição com equipes, fase/rodada/grupo, próximo confronto, data/hora, local, árbitro, resultado, vencedor, status e súmula.
- Restringir a modo equipe e migrar geração de pontos corridos, grupos e mata-mata.
- Testar promoção, bloqueio retroativo, conflitos e rejeição em competição individual.
- Para cada Partida migrada, preservar exatamente placar mandante/visitante, vencedor e status no Confronto.
- Garantir contagem total de partidas históricas igual à de confrontos gerados, sem perda/duplicidade.
- Gerar amostra aleatória de N confrontos e compará-la manualmente à Partida original antes do rollout, usando o processo do relatório de equipes.

### Passo 5: Criar inscrições individuais, provas e resultados finais

- Criar inscrições individuais únicas, provas internas e um resultado final por participante/prova.
- Armazenar tempo em milissegundos; classificar menor tempo primeiro.
- Não criar baterias, classificatórias, finais ou revezamentos.

### Passo 6: Centralizar classificação e regras de resultado

- Calcular tabela de equipes a partir de confrontos e classificação individual por posição/tempo.
- Expor consultas de classificação sem persistir ranking inicialmente.

### Passo 7: Adaptar portal público e permissões

- Expor evento, edição e competição; retornar somente dados compatíveis com o modo e sem documentos pessoais.
- Restringir escrita a admin/coordenador.

### Passo 8: Migrar a interface administrativa

#### 8a. `feat: add competition API layer and read views`

- Centralizar a camada de API em `frontend/src/services/index.ts` ou equivalente, removendo chamadas dispersas.
- Criar leitura de edições/competições, confrontos/tabela e provas/resultados.
- Testar renderização por modo, sem interação de escrita.

#### 8b. `feat: add competition write forms and validation`

- Criar formulários de evento → edição → competição, equipes, confrontos, provas e resultados.
- Ocultar controles incompatíveis, validar payloads e criar fluxo guiado de competição direta.

### Passo 9: Regressão, dados e rollout

- Executar suíte backend, verificações front-end e fluxos completos de futebol por equipe e natação individual.
- Validar migrations contra cópia anonimizada e publicar em duas etapas: aditiva/compatível, depois front-end novo e remoção de legado.
