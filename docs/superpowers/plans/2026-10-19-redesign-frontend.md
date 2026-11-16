# Redesign do Frontend — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Ondas paralelas seguem superpowers:dispatching-parallel-agents.

**Goal:** Dar ao sistema inteiro (escolinhas, competições e portal) uma aparência profissional e consistente — estilo clean, azul, temas claro e escuro de primeira classe — sobre uma biblioteca de componentes própria.

**Architecture:** Tokens de cor em variáveis CSS (trocadas pela classe `.dark`) expostos ao Tailwind v4 via `@theme inline`; componentes em `src/components/ui/` no padrão shadcn (código no repo, variantes com `class-variance-authority`, primitivos Radix só onde há comportamento: Dialog, Tabs, DropdownMenu, Tooltip, Slot). As sobrescritas globais com `!important` saem do `globals.css` para `legado.css`, que segue importado até a última tela migrar e é apagado na integração. Telas são migradas por domínio, em ondas de agentes paralelos com posse exclusiva de arquivos.

**Tech Stack:** Next.js 16 / React 19, Tailwind CSS v4, `@radix-ui/react-{dialog,tabs,dropdown-menu,tooltip,slot}`, `class-variance-authority`, `clsx` + `tailwind-merge` (já instalados), `lucide-react` (já instalado), Playwright.

**Spec:** não há documento de spec separado — por decisão do usuário (2026-10-19) as decisões de design ficam na seção **Decisões de design** abaixo, que tem a autoridade de spec. Referência do estado anterior: screenshots em `docs/design/antes/` (Task 0.1).

## Decisões de design (aprovadas pelo usuário em 2026-10-19)

1. **Personalidade:** clean profissional (referência: Linear, Vercel, Stripe). Fundo neutro, bastante espaço, tipografia forte, uma única cor de destaque, sombras sutis, sem gradientes, sem "blobs" decorativos, sem animação de "pulo" em cards.
2. **Cor de destaque:** azul (`blue-600` no claro, `blue-500` no escuro). Demais cores só com função semântica (sucesso, alerta, perigo).
3. **Temas:** claro e escuro, ambos de primeira classe, construídos por tokens — nenhuma regra de tema por sobrescrita de classe utilitária.
4. **Abordagem:** componentes próprios no padrão shadcn/ui; Radix apenas para Dialog, Tabs, DropdownMenu, Tooltip e Slot.
5. **Linguagem na tela:** nenhum valor técnico exposto — estados (`EM_ANDAMENTO` → "Em andamento"), formatos e fases traduzidos; datas `dd/mm/aaaa`; vazio como "a definir"/estado vazio ilustrado.
6. **Hierarquia de ações:** no máximo uma ação primária por área; ações destrutivas em vermelho contornado ou dentro de menu "Mais ações"; exclusões sempre com `ConfirmDialog`.

## Design por área (5 seções aprovadas pelo usuário em 2026-10-19)

### D1 — Base visual
- Fundo `canvas` cinza muito claro; cards `surface` com borda fina, sem sombra pesada; texto em três níveis (`fg`, `fg-muted`, `fg-subtle`).
- Azul só em ação/destaque (botão primário, link, item ativo, aba selecionada); verde/âmbar/vermelho só com significado.
- Escuro: canvas `#0b1120`, surface `#111827`, azul `#3b82f6`; tudo por token.
- Geist; título de página 24 px semi-negrito com `tracking-tight`; título de card 16 px; corpo 14 px; números de placar e estatística com `tabular-nums`.
- Cantos 8 px (controles) e 12 px (cards/modais); espaçamento em múltiplos de 4, 24–32 px entre seções.
- Sem gradiente, sem decoração, sem "pulo" de card; hover só escurece a borda; transições de 150 ms em cor/opacidade; modal com fade + leve escala.
- Nunca valor técnico na tela; datas `dd/mm/aaaa`; ausência de dado como "a definir" ou "—".

### D2 — Componentes
- Botões: primário (máx. 1 por bloco), secundário, fantasma, perigo (só dentro de confirmação), perigo contornado; todos com `loading` sem mudar de largura e `disabled`.
- Campos: rótulo acima, ajuda abaixo em cinza, erro abaixo em vermelho com ícone, obrigatório com `*`, anel de foco azul.
- Modal: título, descrição, corpo com rolagem própria, rodapé com ações à direita; fecha por Esc/clique fora/×; foco preso e devolvido ao gatilho; modal sobre modal fecha só o de cima.
- `ConfirmDialog` (digitar o nome) em toda exclusão.
- Abas com sublinhado azul, navegáveis por seta.
- Menu "⋯ Mais ações": secundárias e destrutivas; "Excluir" por último, vermelho, após divisor.
- Etiquetas de estado: pílula com bolinha e texto traduzido (Em andamento azul, Finalizada verde, Rascunho cinza, Cancelada vermelho, Em revisão âmbar).
- Tabela: cabeçalho `surface-muted`, divisórias finas, hover sutil, ações em "⋯" à direita, rolagem horizontal interna.
- Estados de tela padrão: esqueleto (carregando), `EmptyState` com ação (vazio), `Alert` com "Tentar novamente" (erro).
- Toasts no canto inferior direito, com ícone e cor por tipo; somem em 4 s, exceto erro (fica até fechar).
- `PageHeader` (trilha, título, descrição, ações) e `StatCard` (rótulo, número, ícone, sem decoração).
- Vitrine `/test-ui` (só com `E2E_HARNESS=1`) com todas as peças nos dois temas.

### D3 — Estrutura da aplicação
- **Sidebar** 256 px, `surface` com borda à direita; logo "GE" + "Gerencia Esporte"; grupos rotulados: **Escolinha** (Dashboard, Alunos, Professores, Turmas, Modalidades, Matrículas), **Competições** (Competições, Eventos), **Administração** (Usuários, conforme permissão atual). Ativo com `bg-primary-soft text-primary`. Recolhível para só ícones (nome em `Tooltip`), preferência em `localStorage`. Abaixo de 1024 px vira gaveta aberta pelo ☰ da topbar.
- **Topbar** fixa, fundo levemente translúcido (`bg-surface/80 backdrop-blur`): trilha de navegação clicável à esquerda (ex.: "Competições / Copa Municipal / Edição 2026"); à direita, tema (sol/lua) e avatar com menu (nome, perfil, Alterar senha, Sair). Usuário e tema saem do rodapé da sidebar.
- Conteúdo com largura máxima 1280 px, centralizado, margens 24–32 px; toda página começa com `PageHeader`.
- **Login** em tela dividida: à esquerda (≥ `lg`) painel azul-escuro sólido com logo, nome e "Gestão de escolinhas e competições esportivas"; à direita card com Usuário, Senha (mostrar/ocultar), "Acessar Sistema", erro claro e link "Ver competições públicas". No celular, só o formulário com logo acima.

### D4 — Escolinha e competições (administração)
- **Dashboard:** 4 `StatCard` (alunos, turmas ativas, professores, modalidades) com linha de contexto (ex.: "3 sem turma"); rosca "Alunos por modalidade" com cores dos tokens e legenda, ou `EmptyState`; "Ações rápidas" como lista de links (Nova matrícula, Novo aluno, Nova turma, Nova competição); "Alunos recentes" em tabela.
- **Listas da escolinha** (alunos, professores, turmas, modalidades, matrículas, usuários): cabeçalho com "Novo…", busca e filtros, tabela com avatar de iniciais, nome em destaque, colunas essenciais, etiqueta de estado e "⋯" (Ver, Editar, Inativar/Excluir); datas e telefones formatados.
- **Formulários** em blocos titulados ("Dados pessoais", "Responsável", "Contato", "Matrícula"), 2 colunas no desktop e 1 no celular, rodapé fixo com Cancelar/Salvar.
- **Lista de competições:** cards em grade (nome, modalidade, nº de edições, estado e período da mais recente), busca; "Nova competição" e "Novo evento" no cabeçalho.
- **Página da competição:** cabeçalho com nome, modalidade, "Nova edição" (primário) e "⋯ → Excluir competição"; seletor de edição em lista suspensa ("Edição 2026 · Em andamento").
- **Cabeçalho da edição:** identificação, período formatado, etiqueta de estado, "Publicada/Não publicada" e **uma** ação primária pelo estado (Gerar tabela → Iniciar → Finalizar → Reabrir); demais em "⋯" (Publicar/Despublicar, Cancelar edição, Excluir edição).
- **Abas:** Visão geral, Configuração, Equipes, Jogos, Classificação, Disciplina.
- **Visão geral (nova):** equipes inscritas, jogos realizados/total, próximo jogo agendado, líder da classificação, artilheiro, e lista de pendências ("4 jogos sem data", "1 suspensão em revisão"). Só com dados que a API já fornece (`listarPartidas`, `obterClassificacao`, `obterArtilharia`, `obterPainelDisciplinar`, `listarEquipes`).
- **Jogos:** cartão de placar (escudos de iniciais, nomes, placar grande ou "×", pênaltis abaixo, data/local ou "a definir", etiqueta), agrupados por rodada/fase, filtros em barra única. **Súmula** em modal largo com linha do tempo por minuto (ícones próprios para gol, amarelo, vermelho) e equipes lado a lado.
- **Classificação:** P, J, V, E, D, GP, GC, SG, %; zona de classificados por barra fina colorida à esquerda; empate pendente com ícone e explicação.
- **Chaveamento:** colunas por fase com linhas conectoras; vencedor destacado; vagas pendentes como "Vencedor de Semifinal 1".
- **Equipes:** cards (sigla, nome, nº de atletas); elenco em gaveta lateral (camisa, nome, posição, situação).
- **Disciplina:** abas internas Suspensões, Cartões, Artilharia; suspensões em tabela com etiqueta ("Em revisão" âmbar com ícone) e ações em "⋯".

### D5 — Portal público
- Cabeçalho próprio (sem sidebar): logo "GE" + "Portal Esportivo"; à direita tema e "Área restrita" (secundário).
- **Vitrine:** faixa de abertura com título "Competições", frase e busca em destaque; seções **Em andamento** (edições `EM_ANDAMENTO`, com linha viva "Rodada 3 de 7" / "Semifinais"), **Próximas** (`RASCUNHO`), **Encerradas** (`FINALIZADA`), e **Eventos**; estados de carga/vazio/erro com retentativa.
- **Edição:** cabeçalho (competição em destaque, edição, categoria, período, etiqueta, link do evento); abas Jogos, Classificação, Chaveamento, Artilharia, Equipes com o mesmo visual da administração e nenhum botão de ação; jogos ao vivo no topo com "● Ao vivo" e pulsação discreta (único movimento contínuo do sistema); artilharia em ranking com top 3 destacado; atualização a cada 30 s com "Atualizado há N s".
- Competição e evento: cabeçalho com nome/descrição e lista de edições em cards; seletor de edição do evento mantido.
- Celular: uma coluna, abas com rolagem lateral, placares compactos.

## Global Constraints

- Sem commits: cada bloco termina com os arquivos prontos e listados; **os commits são feitos pelo usuário** (seção Blocos de commit).
- Nenhuma mudança de backend, de `src/services/*` ou de `src/types/*` (somente leitura neste plano).
- Preservar os nomes acessíveis e `data-testid` usados pelos testes E2E. Quando um componente muda de papel (ex.: abas passam a `role="tab"`), o dono do componente atualiza o spec E2E correspondente no mesmo bloco.
- Nenhum `!important` e nenhum seletor global sobre classes utilitárias em CSS novo; cor sempre por token (`bg-surface`, `text-fg-muted`…), nunca `bg-white`/`text-slate-*` em código novo ou migrado.
- Contraste mínimo WCAG AA (4.5:1 texto normal) nos dois temas.
- Layout funcional a partir de 360 px de largura (sidebar vira gaveta abaixo de `lg`).
- Versões exatas das dependências novas fixadas no `package.json` (sem `^`).
- `npx tsc --noEmit` com 0 erros e `npm run build` com sucesso ao fim de cada bloco.

## Review Focus

1. **Tema escuro em tela ainda não migrada** — enquanto `legado.css` existir, telas antigas precisam continuar legíveis no escuro; o revisor abre uma tela antiga e uma nova lado a lado nos dois temas (Task 0.1 gera as screenshots de comparação).
2. **Modal dentro de modal** (súmula → reabrir partida; edição → confirmação de exclusão) — foco, Esc e clique fora devem fechar só o modal do topo. Teste em `ui.spec.ts` (Task 1.3).
3. **Tabelas largas no celular** (classificação com 10 colunas, lista de alunos) — rolagem horizontal dentro do card, sem estourar a página. Verificado nas screenshots a 390 px (Task 4.1).
4. **Textos longos** (nome de competição com 80 caracteres, equipe com nome grande no placar) — truncar com `title` em vez de quebrar o layout. Coberto na vitrine (Task 1.3) com textos longos.
5. **Preferência de tema do sistema** — primeira visita sem `localStorage` segue `prefers-color-scheme`; troca manual persiste. Teste em `tema.spec.ts` (Task 1.1).

---

## Tokens (contrato compartilhado por todas as tasks)

Definidos em `src/app/globals.css` como variáveis em `:root` e `.dark`, expostos por `@theme inline`. Classes resultantes que **todos** usam:

| Token / classe | Uso | Claro | Escuro |
| --- | --- | --- | --- |
| `bg-canvas` | fundo da aplicação | `#f8fafc` | `#0b1120` |
| `bg-surface` | cards, modais, sidebar | `#ffffff` | `#111827` |
| `bg-surface-muted` | cabeçalho de tabela, áreas internas | `#f1f5f9` | `#1f2937` |
| `border-line` / `border-line-strong` | bordas | `#e2e8f0` / `#cbd5e1` | `#1f2937` / `#374151` |
| `text-fg` / `text-fg-muted` / `text-fg-subtle` | texto principal / secundário / terciário | `#0f172a` / `#475569` / `#64748b` | `#f1f5f9` / `#94a3b8` / `#94a3b8` |
| `bg-primary` / `hover:bg-primary-hover` / `text-on-primary` | ação primária | `#2563eb` / `#1d4ed8` / `#ffffff` | `#3b82f6` / `#60a5fa` / `#ffffff` |
| `text-primary` / `bg-primary-soft` | links, item ativo, destaque suave | `#2563eb` / `#eff6ff` | `#60a5fa` / `rgb(59 130 246 / 0.15)` |
| `success`, `warning`, `danger` (+ `-soft`) | estados semânticos | `#15803d`, `#b45309`, `#b91c1c` / soft `#f0fdf4`, `#fffbeb`, `#fef2f2` | `#4ade80`, `#fbbf24`, `#f87171` / soft com 15% de opacidade |
| `ring-focus` | anel de foco | `rgb(37 99 235 / 0.35)` | `rgb(96 165 250 / 0.45)` |

Raio: controles `rounded-lg` (8 px), cards e modais `rounded-xl` (12 px). Sombra: cards `shadow-xs`, modais e menus `shadow-lg`. Tipografia: Geist (já carregada); títulos de página `text-2xl font-semibold tracking-tight`, de card `text-base font-semibold`, corpo `text-sm`.

## Componentes (contrato compartilhado)

Todos em `src/components/ui/`, exportados também por `src/components/ui/index.ts`. Utilitário `cn(...classes)` em `src/lib/cn.ts` (`clsx` + `tailwind-merge`).

| Componente | Props principais |
| --- | --- |
| `Button` | `variant: 'primary'\|'secondary'\|'ghost'\|'danger'\|'danger-outline'`, `size: 'sm'\|'md'\|'lg'`, `loading?`, `leftIcon?`, `rightIcon?`, `asChild?` (via Slot, para `<Link>`) |
| `IconButton` | `aria-label` obrigatório, `variant`, `size` |
| `Card`, `CardHeader`, `CardBody`, `CardFooter` | `CardHeader`: `title`, `description?`, `actions?` |
| `Badge` | `tone: 'neutral'\|'primary'\|'success'\|'warning'\|'danger'`, `dot?` |
| `StatusBadge` | `tipo: 'edicao'\|'partida'\|'duelo'\|'suspensao'\|'integrante'`, `valor: string` → rótulo e tom de `src/lib/rotulos.ts` |
| `Field` | `label`, `htmlFor`, `hint?`, `error?`, `required?`, `children` — o `<label>` real mantém `getByLabel` dos testes |
| `Input`, `Textarea`, `Select` (nativo estilizado), `Checkbox` (nativo) | repassam props nativas; `invalid?` |
| `Dialog`, `DialogContent`, `DialogFooter` | `DialogContent`: `title` (vira o nome acessível), `description?`, `size: 'sm'\|'md'\|'lg'\|'xl'`, `side: 'center'\|'right'` (right = gaveta lateral) |
| `ConfirmDialog` | `open`, `onOpenChange`, `title`, `description`, `confirmText?` (texto a digitar), `confirmLabel`, `tone: 'danger'\|'primary'`, `onConfirm(): Promise<void>` — mantém `data-testid="input-confirmacao-exclusao"` e `"btn-confirmar-exclusao"` |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Radix; `TabsTrigger` aceita `icon?` e `data-testid` |
| `DropdownMenu`, `DropdownMenuItem` | Radix; item `tone?: 'danger'` |
| `Tooltip` | `content`, `children` |
| `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` | `Table` envolve em contêiner com rolagem horizontal |
| `EmptyState` | `icon`, `title`, `description?`, `action?` |
| `Skeleton` | `className` |
| `Spinner` | `size` |
| `Alert` | `tone`, `title?`, `children`, `action?` |
| `PageHeader` | `title`, `description?`, `breadcrumbs?: {label, href?}[]`, `actions?` |
| `StatCard` | `label`, `value`, `icon`, `hint?` |

`src/lib/formatos.ts`: `formatarData(iso)`, `formatarDataHora(iso)`, `formatarHora(hora)`, `formatarPeriodo(inicio, fim)` (move e substitui `src/components/publico/formatos.ts`). `src/lib/rotulos.ts`: `ROTULO_ESTADO_EDICAO`, `ROTULO_ESTADO_PARTIDA`, `ROTULO_ESTADO_DUELO`, `ROTULO_SITUACAO_SUSPENSAO`, `ROTULO_FORMATO`, `rotuloFase(fase)`, `tomDoEstado(tipo, valor)`.

## Ondas, agentes e comunicação

```
Onda 0  (1 agente)          Task 0.1  base visual de referência
Onda 1  (3 agentes)         Task 1.1 tokens+tema │ Task 1.2 componentes de formulário/exibição │ Task 1.3 sobreposições+vitrine
Onda 2  (7 agentes)         Task 2.1 estrutura │ 2.2 escolinhas-pessoas │ 2.3 escolinhas-estrutura │
                            2.4 competições-organização │ 2.5 competições-jogos │ 2.6 competições-elencos/disciplina │ 2.7 portal
Onda 3  (1 agente)          Task 3.1 integração e limpeza
Final   (controlador)       revisão de branch inteira
```

**Posse exclusiva:** cada task lista os arquivos que pode editar; qualquer outro é somente leitura. Dois agentes nunca editam o mesmo arquivo.

**Comunicação entre agentes (SendMessage):**
- Onda 1: `tokens` publica os nomes finais das classes assim que o `globals.css` compila; `form-ui` e `overlay-ui` trabalham com a tabela de tokens acima e só esperam essa mensagem para rodar o `build`. `overlay-ui` pede a `form-ui` o aviso de conclusão antes de montar a vitrine (que usa os dois conjuntos).
- Onda 2: `src/components/ui/`, `src/lib/` e os CSS globais pertencem ao **controlador**. Agente que precisar de variante ou componente novo envia ao controlador: `PEDIDO-UI: <componente> — <o que falta> — <onde vai usar>`; o controlador implementa, responde `FEITO-UI: <nome>` e os demais recebem o aviso. Ninguém cria cópia local de componente.
- Onda 2: quando um agente muda um seletor usado em spec E2E de outro dono, envia `AVISO-SELETOR: <arquivo> — <antes> → <depois>` ao dono do spec antes de terminar.
- Onda 2: `competicoes-jogos` envia `VISUAL-PRONTO` a `portal` quando `src/components/competicoes/visual/*` estiver estável (props finais); `estrutura` envia `BREADCRUMB-PRONTO` a todos quando `useBreadcrumb` existir.
- Todo agente termina com um relatório: arquivos alterados, testes executados com resultado, pedidos/avisos trocados, pendências.

---

## Onda 0

### Task 0.1: Base visual de referência

**Files:**
- Create: `frontend/e2e/visual/capturar-telas.mjs`, `docs/design/antes/*.png`

**Interfaces:**
- Produces: `node e2e/visual/capturar-telas.mjs <pasta-saida>` — com o ambiente E2E no ar (portas 8001/3001), autentica como `admin/admin123`, cria dados de demonstração pela API (1 competição de pontos corridos com 4 equipes e 2 resultados, 1 mata-mata de 4, 1 edição publicada, 3 alunos, 2 turmas, 1 professor) e grava screenshots 1440×900 e 390×844, temas claro e escuro, de: login, dashboard, alunos, turmas, professores, competições (lista), competição (cada aba da edição), eventos, portal (vitrine e edição).

- [ ] **Step 1:** Escrever o script; rodar com o ambiente do `playwright.config.ts` (`npx playwright test --list` não sobe servidores: usar um `globalSetup` temporário ou subir backend e `next dev` no mesmo comando do script).
- [ ] **Step 2:** Gerar `docs/design/antes/`. Expected: ≥ 30 PNGs, nenhum em branco (tamanho > 20 KB).

## Onda 1 — Fundação (3 agentes em paralelo)

### Task 1.1: Tokens, tema e CSS global (`tokens`)

Design: **D1**.

**Files:**
- Modify: `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`, `frontend/src/context/ThemeContext.tsx`, `frontend/package.json`, `frontend/package-lock.json`
- Create: `frontend/src/app/legado.css`, `frontend/src/lib/cn.ts`, `frontend/src/lib/formatos.ts`, `frontend/src/lib/rotulos.ts`, `frontend/e2e/tema.spec.ts`
- Delete: `frontend/src/components/publico/formatos.ts` (atualizar os imports em `src/components/publico/*` e `src/app/publico/**`)

**Interfaces:**
- Produces: tokens da tabela acima; `useTheme(): { theme: 'light'|'dark', setTheme(t), toggleTheme() }`; `cn`; funções de `formatos.ts` e `rotulos.ts`.

- [ ] **Step 1: `tema.spec.ts`** — `primeira visita segue prefers-color-scheme` (`page.emulateMedia({ colorScheme: 'dark' })` → `html` tem classe `dark`); `troca manual persiste após recarregar`; `tokens mudam com o tema` (cor computada de `body` difere entre claro e escuro).
- [ ] **Step 2:** Rodar e ver falhar onde o comportamento ainda não existe.
- [ ] **Step 3:** Instalar dependências fixas: `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`, `@radix-ui/react-slot`, `class-variance-authority` (versões estáveis atuais, sem `^`).
- [ ] **Step 4:** Reescrever `globals.css` só com: import do Tailwind, `@custom-variant dark`, variáveis de tema, `@theme inline`, estilos base mínimos (body, foco visível, seleção de texto, scrollbar). Mover **todo** o resto (sobrescritas de `.bg-white`, gradientes, `.dark .text-slate-*`, inputs com `!important`) para `legado.css`, importado em `layout.tsx` depois do `globals.css`. Corrigir `min-height: 100-screen`.
- [ ] **Step 5:** `ThemeContext` com `setTheme`; script inline do `layout.tsx` mantém a lógica de `prefers-color-scheme`.
- [ ] **Step 6:** `formatos.ts`, `rotulos.ts` (rótulos de todos os enums de `src/types/competicoes.ts`), `cn.ts`.
- [ ] **Step 7:** Avisar `form-ui` e `overlay-ui`: `TOKENS-PRONTOS`.
- [ ] **Step 8:** `npx playwright test e2e/tema.spec.ts` verde; `tsc` e `build` verdes; telas antigas idênticas às de `docs/design/antes/` (o `legado.css` preserva o visual atual).

### Task 1.2: Componentes de formulário e exibição (`form-ui`)

Design: **D1, D2**.

**Files:**
- Create: `frontend/src/components/ui/{button,icon-button,card,badge,status-badge,field,input,textarea,select,checkbox,table,empty-state,skeleton,spinner,alert,page-header,stat-card}.tsx`

**Interfaces:**
- Consumes: tokens e `cn` (Task 1.1), `rotulos.ts` para `StatusBadge`.
- Produces: componentes da tabela acima com as props exatas listadas.

- [ ] **Step 1:** Implementar com `cva` para variantes; todo componente aceita `className` e repassa `ref` (React 19: `ref` como prop).
- [ ] **Step 2:** `Button` com `loading` desabilita e mostra `Spinner` sem mudar a largura; `asChild` renderiza `<Link>`.
- [ ] **Step 3:** `Table` com contêiner `overflow-x-auto`; `TH` com `scope="col"`.
- [ ] **Step 4:** Ao terminar, enviar `FORM-UI-PRONTO` para `overlay-ui`; `tsc` verde.

### Task 1.3: Sobreposições, vitrine e testes de componentes (`overlay-ui`)

Design: **D2**.

**Files:**
- Create: `frontend/src/components/ui/{dialog,confirm-dialog,tabs,dropdown-menu,tooltip,index}.ts(x)`, `frontend/src/app/test-ui/page.e2e.tsx`, `frontend/e2e/ui.spec.ts`

**Interfaces:**
- Consumes: Task 1.1 e Task 1.2 (`index.ts` reexporta tudo).
- Produces: `/test-ui` (só com `E2E_HARNESS=1`): vitrine com todas as variantes em claro e escuro, textos longos, tabela de 10 colunas e modal dentro de modal.

- [ ] **Step 1: `ui.spec.ts`** — `dialog tem nome acessível igual ao título`; `Esc fecha só o modal do topo`; `foco volta ao gatilho ao fechar`; `ConfirmDialog só libera com o texto exato`; `tabs navegam por seta e ativam com Enter`; `menu suspenso fecha ao escolher item`; `tabela larga rola dentro do card a 390px sem rolagem horizontal da página`.
- [ ] **Step 2:** Rodar e ver falhar (rota inexistente).
- [ ] **Step 3:** Implementar os componentes Radix com os tokens; `DialogContent` com `max-h` e rolagem interna.
- [ ] **Step 4:** Esperar `FORM-UI-PRONTO`, montar a vitrine.
- [ ] **Step 5:** `npx playwright test e2e/ui.spec.ts` verde; `tsc` e `build` verdes.

## Onda 2 — Migração das telas (7 agentes em paralelo)

Regras comuns a todas as tasks da onda:
- Usar somente `src/components/ui/*`, tokens e `src/lib/*`; remover das telas migradas `bg-white`, `text-slate-*`, gradientes e classes que dependem do `legado.css`.
- Toda tela com: `PageHeader` (título, descrição, trilha, ação primária), estados de carregando (`Skeleton`), vazio (`EmptyState`) e erro (`Alert` com "Tentar novamente").
- Estados e datas sempre via `StatusBadge`/`rotulos.ts`/`formatos.ts`.
- Modais via `Dialog`/`ConfirmDialog`; ações secundárias de linha em `DropdownMenu`.
- Ao terminar: `npx tsc --noEmit`, os specs E2E do seu domínio, e screenshots do seu domínio com `capturar-telas.mjs` em `docs/design/depois/`.

### Task 2.1: Estrutura da aplicação (`estrutura`)

**Files:** `src/app/dashboard/layout.tsx`, `src/components/layout/Sidebar.tsx`, Create `src/components/layout/Topbar.tsx`, Create `src/context/BreadcrumbContext.tsx`, `src/app/login/page.tsx`, `src/components/auth/ChangePasswordModal.tsx`, `src/context/NotificationContext.tsx`, Create `e2e/estrutura.spec.ts`

Design: **D3** (e toasts de **D2**).

- Sidebar, topbar, área de conteúdo e login exatamente como D3. A trilha vem de um mapa rota → rótulo; páginas com nome dinâmico (competição, edição) publicam o rótulo via um `BreadcrumbContext` criado nesta task (`useBreadcrumb(itens)`), que as tasks 2.2–2.4 usam.
- Login mantém os rótulos "Usuário", "Senha" e o botão "Acessar Sistema" (usados por `helpers/auth.ts`).
- Toasts do `NotificationContext` conforme D2, com `role="status"` (erro: `role="alert"`).
- Testes: criar `e2e/estrutura.spec.ts` — `sidebar recolhida persiste após recarregar`; `abaixo de 1024px o menu abre pelo botão ☰`; `trilha mostra Competições / <nome>`; `menu do usuário sai do sistema`. Rodar a suíte E2E inteira ao fim (todos os specs fazem login).

### Task 2.2: Escolinhas — pessoas (`escolinhas-pessoas`)

**Files:** `src/app/dashboard/alunos/**`, `src/app/dashboard/professores/**`, `src/app/dashboard/usuarios/**`, `src/components/forms/{AlunoForm,ProfessorForm}.tsx`

Design: **D4 — Listas da escolinha e Formulários**.

### Task 2.3: Escolinhas — estrutura (`escolinhas-estrutura`)

**Files:** `src/app/dashboard/page.tsx`, `src/app/dashboard/turmas/**`, `src/app/dashboard/modalidades/**`, `src/app/dashboard/matriculas/**`, `src/components/forms/TurmaForm.tsx`

Design: **D4 — Dashboard, Listas da escolinha e Formulários**. Gráfico com `recharts` (já instalado) usando as cores dos tokens.

### Task 2.4: Competições — organização (`competicoes-organizacao`)

**Files:** `src/app/dashboard/competicoes/**`, `src/app/dashboard/eventos/**`, `src/components/competicoes/organizacao/*`, `e2e/organizacao.spec.ts`, `e2e/exclusao.spec.ts`

Design: **D4 — Lista de competições, Página da competição, Cabeçalho da edição, Abas e Visão geral**.

- Create `src/components/competicoes/organizacao/VisaoGeralEdicao.tsx` (aba Visão geral de D4), buscando em paralelo com `Promise.allSettled` — um dado que falhar mostra "—" no seu card, sem derrubar a aba.
- Abas com `Tabs` (passam a `role="tab"`): **atualizar os specs que clicam nas abas como `button`** e avisar os donos (`AVISO-SELETOR`) de `jogos.spec.ts`, `disciplina.spec.ts`, `sumula.spec.ts`, `classificacao.spec.ts`.
- Ações do cabeçalho em "⋯": manter os `data-testid` existentes (`btn-cancelar-edicao`, `btn-excluir-edicao`, `btn-excluir-competicao`, `btn-finalizar-edicao`, `btn-reabrir-edicao`) nos itens de menu e ajustar `exclusao.spec.ts`/`organizacao.spec.ts` para abrir o menu antes.
- `ModalConfirmarExclusao` passa a ser um invólucro de `ConfirmDialog` (mesmos `data-testid`).
- Teste novo em `organizacao.spec.ts`: `visão geral mostra jogos realizados e pendência de jogos sem data` (dados via API).

### Task 2.5: Competições — jogos, súmula, classificação e chaveamento (`competicoes-jogos`)

**Files:** `src/components/competicoes/disputa/*`, `src/components/competicoes/classificacao/*`, Create `src/components/competicoes/visual/*`, `e2e/jogos.spec.ts`, `e2e/sumula.spec.ts`, `e2e/classificacao.spec.ts`

Design: **D4 — Jogos (com súmula), Classificação e Chaveamento**. Os visuais de cartão de placar, linha de classificação e chave ficam em componentes de apresentação puros (sem chamada de API) em `src/components/competicoes/visual/` (`CartaoPlacar`, `LinhaClassificacao`, `ChaveFases`), que a Task 2.7 reutiliza.

### Task 2.6: Competições — elencos e disciplina (`competicoes-elencos`)

**Files:** `src/components/competicoes/elencos/*`, `src/components/competicoes/disciplina/*`, `src/app/test-elencos/page.e2e.tsx`, `e2e/elencos.spec.ts`, `e2e/disciplina.spec.ts`

Design: **D4 — Equipes e Disciplina**. Gaveta lateral = `DialogContent` com `side="right"`.

### Task 2.7: Portal público (`portal`)

**Files:** `src/app/page.tsx`, `src/app/publico/**`, `src/components/publico/*`, `e2e/portal.spec.ts`

Design: **D5**.

- Reutiliza `src/components/competicoes/visual/*` da Task 2.5 (componentes de apresentação puros). Ordem na onda: começa por cabeçalho, vitrine e estados; a página da edição espera a mensagem `VISUAL-PRONTO` do agente `competicoes-jogos`.
- "Linha viva" da vitrine só nos cards **Em andamento**, calculada de `listarPartidas` da edição (rodada atual / total, ou fase atual); falha nesse dado oculta a linha, sem erro no card.
- "Atualizado há N s" a partir do último sucesso do SWR; pulsação do "● Ao vivo" respeita `prefers-reduced-motion`.
- Testes novos em `portal.spec.ts`: `vitrine separa em andamento, próximas e encerradas`; `jogo em andamento aparece no topo com Ao vivo`.

## Onda 3 — Integração

### Task 3.1: Integração e limpeza (`integracao`)

**Files:** `src/app/legado.css` (Delete), `src/app/layout.tsx` (remover import), `src/components/forms/{AtletaForm,EquipeForm}.tsx` (Delete — sem uso), `src/app/eventos-publico/[id]/page.tsx` (aplicar `EmptyState`), `docs/testes/competicoes-testes.md`, `docs/design/depois/*`

- [ ] **Step 1:** `grep -rnE "bg-white|text-slate-|from-blue|bg-gradient|!important" src` → zero ocorrências fora de `components/ui` justificadas.
- [ ] **Step 2:** Apagar `legado.css`; regenerar screenshots `docs/design/depois/` nos dois temas e dois tamanhos.
- [ ] **Step 3:** Suíte completa: `npx playwright test` (inclui `tema.spec.ts` e `ui.spec.ts`), `npx tsc --noEmit`, `npm run build`, `git diff --check`.
- [ ] **Step 4:** Atualizar `docs/testes/competicoes-testes.md` com os specs novos.

---

## Blocos de commit (para o usuário)

Cada bloco fecha com `tsc` 0 erros, `build` ok e a suíte E2E do bloco verde. O controlador entrega a lista de arquivos de cada bloco ao fim da onda.

| Bloco | Conteúdo | Tasks |
| --- | --- | --- |
| 1 — Fundação | dependências, tokens, tema, `legado.css`, `lib/*`, `components/ui/*`, vitrine, `tema.spec.ts`, `ui.spec.ts`, script de captura | 0.1, 1.1, 1.2, 1.3 |
| 2 — Estrutura | layout, sidebar, topbar, `BreadcrumbContext`, login, toasts, `estrutura.spec.ts` | 2.1 |
| 3 — Escolinhas | dashboard, alunos, professores, turmas, modalidades, matrículas, usuários | 2.2, 2.3 |
| 4 — Competições | organização (com Visão geral), jogos/súmula/classificação/chaveamento, `competicoes/visual/*`, elencos/disciplina + specs E2E ajustados | 2.4, 2.5, 2.6 |
| 5 — Portal | vitrine e páginas públicas | 2.7 |
| 6 — Integração | remoção do legado e de código morto, screenshots finais, documentação | 3.1 |

Sugestão de mensagens: `feat(ui): fundação do design system`, `feat(ui): estrutura da aplicação`, `feat(ui): telas da escolinha`, `feat(ui): telas de competições`, `feat(ui): portal público`, `chore(ui): remove estilos legados`.
