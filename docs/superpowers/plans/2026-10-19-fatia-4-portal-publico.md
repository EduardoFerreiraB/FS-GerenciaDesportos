# Fatia 4 — Portal Público: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitante sem login navega por competições e eventos publicados e acompanha, em cada edição publicada, equipes, jogos, classificação, chaveamento e artilharia — sem vazamento de campo privado e sem confundir falha com ausência de dados.

**Architecture:** Novo roteador somente leitura `/competicoes/publico/*`, sem autenticação, apoiado num serviço `servicos/publico.py` que reaproveita os cálculos puros de classificação, disputa e artilharia e converte tudo para schemas públicos próprios (allowlist explícita, nunca dump de ORM nem dos contratos administrativos). Edição não publicada — ou inexistente — devolve o mesmo 404. No frontend, páginas públicas em `/`, `/publico/competicao/[slug]`, `/publico/evento/[slug]` e `/publico/edicao/[id]`, com SWR (atualização periódica, sem WebSocket) e um componente de erro com "Tentar novamente".

**Tech Stack:** FastAPI + SQLAlchemy 2 + Pydantic 2 (backend); Next.js 16 / React 19 + SWR + Tailwind (frontend); pytest e Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md`](../specs/2026-10-15-competicoes-fatias-design.md), seção 8 (e seções 9 e 10).

## Global Constraints

- `publicada` é independente de `estado`: rascunho pode ser publicado; edição finalizada pode ser despublicada.
- Acesso direto a edição não publicada retorna **404**, não 403.
- Respostas públicas usam **allowlist de campos** em schemas próprios, nunca `model_dump` de ORM.
- Fora do portal: documento, data de nascimento completa, contato, vínculo escolar, motivo privado de sanção e qualquer auditoria.
- Do elenco saem `nome_esportivo`, camisa e posição, e nada mais.
- O seletor de edições de um evento mostra apenas edições com alguma disputa publicada.
- Jogo sem agendamento aparece como "a definir".
- Atualização periódica e após ações, sem WebSocket.
- Erro de carregamento aparece como erro, com ação de tentar novamente; nunca lista vazia nem classificação ausente silenciosa.
- Não alterar `.env`; não testar contra banco de desenvolvimento; sem commits nesta execução (pedido do usuário).

## Review Focus

1. **Identidade só com edições não publicadas** — competição/evento existe mas nenhuma edição está publicada: o visitante deve receber 404 no detalhe e não ver o item na listagem. Teste em Task 2.
2. **Edição publicada de competição/evento arquivado** — arquivar é decisão administrativa de retirar da vitrine: a identidade arquivada some da listagem pública, mas o link direto da edição publicada continua funcionando (histórico). Teste em Task 2.
3. **Integrante inativo e equipe inativa** — o elenco público mostra só integrantes `ATIVO`; dados privados do competidor nunca aparecem, nem pelo nome do campo, nem pelo valor. Teste em Task 2 (busca textual do documento e da data de nascimento no JSON).
4. **Jogo agendado sem placar** — partida `AGENDADA` não mostra "0 x 0": `gols_*` vêm `null`; sem data/local o frontend mostra "a definir". Teste em Task 3 e Task 5.
5. **Falha depois de já ter dados** — refresh periódico falha com dados em tela: manter os dados e mostrar aviso com "Tentar novamente", em vez de apagar a tela. Teste em Task 6 (Playwright com `page.route` abortando a API).

---

### Task 1: Contratos públicos com allowlist

**Files:**
- Create: `app/competicoes/contratos/publico.py`
- Test: `competition_tests/consolidacao/test_publico_allowlist.py`

**Interfaces:**
- Produces (todos herdam `Contrato`, `extra="forbid"`):
  - `IntegrantePublico{nome_esportivo: str, numero_camisa: int|None, posicao: str|None}`
  - `EquipePublica{id_equipe: int, nome: str, sigla: str|None, id_grupo: int|None, integrantes: list[IntegrantePublico]}`
  - `GrupoPublico{id_grupo: int, nome: str, ordem: int}`
  - `CompeticaoRef{slug: str, nome: str}`
  - `EdicaoPublicaResumo{id_edicao_competicao: int, identificacao: str, categoria: str|None, data_inicio: date, data_fim: date, formato: str, estado: str}`
  - `EdicaoPublicaDetalhe(EdicaoPublicaResumo) + {competicao: CompeticaoRef, edicao_evento: EdicaoEventoRef|None, grupos: list[GrupoPublico], equipes: list[EquipePublica]}`
  - `EdicaoEventoRef{identificacao: str, evento: EventoRef}`; `EventoRef{slug: str, nome: str}`
  - `CompeticaoPublica{slug: str, nome: str, descricao: str|None, modalidade: str, edicoes: list[EdicaoPublicaResumo]}`
  - `EdicaoEventoPublica{id_edicao_evento: int, identificacao: str, data_inicio: date, data_fim: date, competicoes: list[EdicaoCompeticaoNoEvento]}`; `EdicaoCompeticaoNoEvento(EdicaoPublicaResumo) + {competicao: CompeticaoRef}`
  - `EventoPublico{slug: str, nome: str, descricao: str|None, edicoes: list[EdicaoEventoPublica]}`
  - `PartidaPublica{id_partida, id_grupo, nome_grupo, fase, rodada, ordem_jogo, id_equipe_mandante, nome_mandante, id_equipe_visitante, nome_visitante, data, hora, local, estado, gols_mandante: int|None, gols_visitante: int|None, penaltis_mandante, penaltis_visitante}`
  - `LinhaClassificacaoPublica{posicao, id_equipe, nome_equipe, jogos, vitorias, empates, derrotas, gols_pro, gols_contra, saldo_gols, pontos, aproveitamento, empate_persistente}`
  - `GrupoClassificacaoPublico{id_grupo, nome, linhas}`; `ClassificacaoPublica{linhas: list|None, grupos: list|None, possui_empate_persistente: bool}`
  - `VagaPublica{posicao: int, origem: str, id_equipe: int|None, nome_equipe: str|None, descricao_origem: str|None}`
  - `DueloPublico{id_duelo, fase, posicao_chave, estado, ida_volta, id_equipe_vencedora, vagas: list[VagaPublica]}`; `ChaveamentoPublico{duelos: list[DueloPublico]}`
  - `ArtilheiroPublico{posicao, nome_esportivo, numero_camisa, id_equipe, nome_equipe, gols, gols_em_andamento}`; `ArtilhariaPublica{possui_jogos_em_andamento: bool, artilheiros: list[ArtilheiroPublico]}`
  - `ALLOWLIST_PUBLICA: dict[type, frozenset[str]]` — a decisão explícita, campo a campo, para cada schema acima.

- [ ] **Step 1: Teste da allowlist** — `test_cada_schema_publico_tem_exatamente_os_campos_decididos`: para cada `(schema, campos)` em `ALLOWLIST_PUBLICA`, `set(schema.model_fields) == campos`; e `test_todo_schema_do_modulo_esta_na_allowlist`: toda subclasse de `Contrato` definida em `contratos.publico` aparece em `ALLOWLIST_PUBLICA`. Adicionar `test_nenhum_campo_proibido`: nenhum schema público contém `documento`, `data_nascimento`, `foto_url`, `id_competidor`, `id_aluno_origem`, `motivo`, `configuracao`, `publicada`, `revisao`, `id_usuario_autor`, `id_arbitro`.
- [ ] **Step 2: Rodar e ver falhar** — `.venv/bin/pytest competition_tests/consolidacao/test_publico_allowlist.py -q` → ImportError.
- [ ] **Step 3: Implementar `contratos/publico.py`** — `ALLOWLIST_PUBLICA` escrito à mão (literal de frozensets), não derivado de `model_fields`; é ele que obriga a decisão quando um campo novo aparecer.
- [ ] **Step 4: Rodar e ver passar.**

### Task 2: Serviço e API pública — identidades, edição e equipes

**Files:**
- Create: `app/competicoes/servicos/publico.py`, `app/competicoes/api/publico.py`
- Modify: `app/competicoes/api/__init__.py` (incluir `publico.router` com prefixo `/publico`)
- Test: `competition_tests/consolidacao/test_publico_api.py`

**Interfaces:**
- Consumes: Task 1.
- Produces (serviço, todos somente leitura, sem `bloquear_edicao` e sem escrita):
  - `listar_competicoes_publicas(db) -> list[CompeticaoPublica]` — não arquivadas com ≥1 edição publicada; `edicoes` só as publicadas, ordenadas por `data_inicio` desc.
  - `obter_competicao_publica(db, slug: str) -> CompeticaoPublica` — 404 se inexistente ou sem edição publicada.
  - `listar_eventos_publicos(db) -> list[EventoPublico]` e `obter_evento_publico(db, slug) -> EventoPublico` — só edições de evento com ≥1 edição de competição publicada; evento sem nenhuma → 404 / fora da lista.
  - `obter_edicao_publicada(db, id_edicao: int) -> EdicaoCompeticao` — helper; levanta `NaoEncontrado("Edicao nao encontrada.", campos=["id_edicao_competicao"])` tanto para inexistente quanto para `publicada=False` (mesma mensagem, mesmo corpo).
  - `obter_edicao_publica(db, id_edicao) -> EdicaoPublicaDetalhe` — equipes ordenadas por nome; integrantes só `ATIVO`, ordenados por camisa (nulos por último) e nome.
- Rotas (sem dependência de autenticação): `GET /competicoes/publico/competicoes`, `/competicoes/{slug}`, `/eventos`, `/eventos/{slug}`, `/edicoes/{id_edicao_competicao}`.

- [ ] **Step 1: Testes** (via `client` HTTP, sem cabeçalho de autenticação):
  - `test_edicao_nao_publicada_e_inexistente_retornam_mesmo_404` — corpos JSON idênticos, `status_code == 404`, `codigo == "NAO_ENCONTRADO"`.
  - `test_rascunho_publicado_aparece_e_finalizada_despublicada_some` — publicar em `RASCUNHO` → 200; cancelar a edição e despublicar → 404 (publicação independente do estado).
  - `test_competicao_sem_edicao_publicada_nao_aparece` e `test_evento_mostra_so_edicoes_com_disputa_publicada` (evento com duas edições de evento; só a que tem competição publicada aparece).
  - `test_competicao_arquivada_sai_da_lista_mas_edicao_continua_acessivel`.
  - `test_elenco_publico_nao_vaza_dados_privados` — competidor com `documento="DOC-SECRETO-123"` e `data_nascimento=2011-04-05`; o texto da resposta não contém `DOC-SECRETO-123` nem `2011-04-05`; integrante inativo não aparece; chaves do integrante são exatamente `{"nome_esportivo","numero_camisa","posicao"}`.
  - `test_historico_duas_edicoes_nao_se_misturam` — duas edições publicadas da mesma competição, com equipes de nomes diferentes; `/competicoes/{slug}` lista as duas; cada `/edicoes/{id}` só traz as próprias equipes.
- [ ] **Step 2: Rodar e ver falhar** (404 de rota inexistente / import).
- [ ] **Step 3: Implementar serviço e rotas.** Conversão campo a campo para os schemas públicos.
- [ ] **Step 4: Rodar e ver passar.**

### Task 3: API pública — jogos, classificação, chaveamento e artilharia

**Files:**
- Modify: `app/competicoes/servicos/publico.py`, `app/competicoes/api/publico.py`
- Test: `competition_tests/consolidacao/test_publico_api.py`

**Interfaces:**
- Consumes: `obter_edicao_publicada` (Task 2); `servicos.classificacao.obter_classificacao_edicao(db, id)`; `servicos.disputa.obter_estrutura_disputa(db, id)`; `servicos.sumula.obter_artilharia_edicao(db, id_edicao=id)` — os três são só leitura.
- Produces: `listar_partidas_publicas(db, id) -> list[PartidaPublica]`, `obter_classificacao_publica(db, id) -> ClassificacaoPublica`, `obter_chaveamento_publico(db, id) -> ChaveamentoPublico`, `obter_artilharia_publica(db, id) -> ArtilhariaPublica`; rotas `GET /competicoes/publico/edicoes/{id}/partidas|classificacao|chaveamento|artilharia`.
- Regras: `gols_*` é `null` em `AGENDADA` e `CANCELADA`; `fase` vem do duelo; `local` é `Local.loca_nome`; `VagaPublica.descricao_origem` descreve vaga pendente (`"1º do Grupo A"`, `"Vencedor de SEMIFINAL 1"`, `"Perdedor de SEMIFINAL 2"`, `"Folga"`), `nome_equipe` preenchido quando resolvida.

- [ ] **Step 1: Testes**
  - `test_partidas_publicas_sem_placar_quando_agendadas` — após gerar tabela, todas `AGENDADA` com `gols_mandante is None`, `data is None`; após resultado 2x1 numa delas, `gols_mandante == 2`.
  - `test_classificacao_publica_espelha_a_administrativa` — mesmas linhas (posição, pontos) que `obter_classificacao_edicao`.
  - `test_chaveamento_publico_descreve_vagas_pendentes` — mata-mata de 4: final com duas vagas `descricao_origem` `"Vencedor de SEMIFINAL 1"`/`"Vencedor de SEMIFINAL 2"`.
  - `test_artilharia_publica_sem_ids_internos` — chaves de cada artilheiro exatamente as da allowlist.
  - `test_subrecursos_de_edicao_nao_publicada_retornam_404` — as quatro rotas → 404.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar; rodar `competition_tests/consolidacao` inteiro.**

### Task 4: Frontend — tipos, serviço, estados de carga e páginas de vitrine

**Files:**
- Create: `frontend/src/types/publico.ts`, `frontend/src/services/publico.ts`, `frontend/src/components/publico/EstadoCarga.tsx`, `frontend/src/components/publico/CabecalhoPublico.tsx`, `frontend/src/app/publico/competicao/[slug]/page.tsx`
- Modify: `frontend/src/app/page.tsx` (substitui o portal legado que chamava `/publico/eventos`), `frontend/src/app/publico/evento/[slug]/page.tsx` (substitui o aviso de descontinuado)

**Interfaces:**
- Produces: tipos TS espelhando Task 1 com os mesmos nomes; `servicoPublico.{listarCompeticoes, obterCompeticao(slug), listarEventos, obterEvento(slug), obterEdicao(id), listarPartidas(id), obterClassificacao(id), obterChaveamento(id), obterArtilharia(id)}`; `INTERVALO_ATUALIZACAO_MS = 30000`; `<EstadoCarga carregando erro naoEncontrado temDados onTentarNovamente>` — renderiza spinner, bloco de erro com botão "Tentar novamente" (sem dados), aviso compacto "Não foi possível atualizar" + botão (com dados) ou "Não encontrado" (404).
- Regra: 404 vira `naoEncontrado`; qualquer outra falha vira `erro`; nunca lista vazia em caso de erro.

- [ ] **Step 1: Implementar tipos e serviço** com `api` de `@/lib/api`.
- [ ] **Step 2: Implementar `EstadoCarga` e o cabeçalho público.**
- [ ] **Step 3: Página `/`**: duas seções, "Competições" e "Eventos", com busca por nome; cada competição lista edições publicadas como links para `/publico/edicao/{id}`; cada evento leva a `/publico/evento/{slug}`.
- [ ] **Step 4: Páginas de competição e evento** — evento com seletor das edições de evento (só as devolvidas pela API) e as disputas da edição escolhida.
- [ ] **Step 5: `npx tsc --noEmit`** → 0 erros.

### Task 5: Frontend — página da edição

**Files:**
- Create: `frontend/src/app/publico/edicao/[id]/page.tsx`, `frontend/src/components/publico/{JogosPublicos,ClassificacaoPublica,ChaveamentoPublico,ArtilhariaPublica,EquipesPublicas}.tsx`

**Interfaces:**
- Consumes: Task 4.
- Abas: Jogos, Classificação (oculta em `MATA_MATA`), Chaveamento (oculta em `PONTOS_CORRIDOS`), Artilharia, Equipes. Cada aba busca com SWR (`refreshInterval: INTERVALO_ATUALIZACAO_MS`) e usa `EstadoCarga`.
- Jogos: placar só quando `gols_mandante !== null`; data/hora/local ausentes → "a definir"; empate persistente sinalizado na classificação.

- [ ] **Step 1: Implementar página e componentes.**
- [ ] **Step 2: `npx tsc --noEmit` e `npm run build`** → sucesso.

### Task 6: Portão de saída

**Files:**
- Create: `frontend/e2e/portal.spec.ts`
- Create: `docs/superpowers/status/2026-10-19-fatia4-complete-checkpoint.md`

- [ ] **Step 1: Playwright `portal.spec.ts`** (dados criados via API como coordenador, navegação sem login):
  - `visitante navega da vitrine até a edição publicada` — vê competição, abre edição, vê jogos com "a definir", aba Equipes mostra nome esportivo.
  - `edição não publicada mostra não encontrado`.
  - `falha de rede mostra erro com tentar novamente e recupera` — `page.route('**/competicoes/publico/**', r => r.abort())`, vê "Tentar novamente", remove a rota, clica e vê os dados.
- [ ] **Step 2: Rodar** `npx playwright test e2e/portal.spec.ts` e a suíte E2E inteira.
- [ ] **Step 3: Rodar** `DATABASE_URL=sqlite:///:memory: SECRET_KEY=x .venv/bin/python -m pytest tests migration_tests competition_tests -q`, `npx tsc --noEmit`, `npm run build`, `git diff --check`.
- [ ] **Step 4: Registrar o checkpoint** com as saídas medidas.
