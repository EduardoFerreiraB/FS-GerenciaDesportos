# Roteiro de Teste – Tela para Login e Estrutura da Aplicação

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT08 – Login e Estrutura |
| Versão | V2.0.0 (novo) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 (casos 001–009 antes da pausa por limite de uso; 010–013 na retomada) |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (perfil administrador) |

## Escopo do roteiro

- **Objetivo:** comprovar acesso (login/logout, proteção de rota), troca de senha e a estrutura comum (tema, sidebar, trilha, menu do usuário, celular).
- **Fora do escopo:** telas de cada módulo (RT01–RT07, RT09–RT16).

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Acessar rota protegida sem login | Alta | [OK] |
| 002 | Login com senha incorreta | Alta | [OK] |
| 003 | Mostrar/ocultar senha | Baixa | [OK] |
| 004 | Navegar entre login e portal público | Média | [OK] |
| 005 | Login com credenciais válidas | Alta | [OK] |
| 006 | Menu do usuário | Média | [OK] |
| 007 | Tema escuro persiste após recarregar | Média | [OK] |
| 008 | Recolher sidebar, tooltip e persistência | Média | [OK] |
| 009 | Trilha de navegação clicável | Média | [OK] |
| 010 | Alterar senha — validações | Alta | [!] |
| 011 | Celular (500 px) — menu pelo ☰ | Baixa | [!] |
| 012 | Navegação por teclado e foco visível | Média | [!] |
| 013 | Sair do sistema e rotas protegidas | Alta | [X] |

---

## Caso 001 — Acessar rota protegida sem login
Localização: URL `/dashboard` · Código: `frontend/src/context/AuthContext.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Limpar token do navegador e abrir `/dashboard` | Redirecionar para `/login` | Redirecionou para `/login` | [OK] |

Evidência: `evidencias/RT08/001-rota-protegida-redireciona-login.jpg`

## Caso 002 — Login com senha incorreta
Localização: Login · Código: `frontend/src/app/login/page.tsx`, backend `POST /token`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Usuário `Admin`, senha `senhaerrada`, Enter | Permanece no login com erro claro | Alerta "Usuário ou senha incorretos" (`role="alert"`), campos mantidos | [OK] |

Verificação: rótulos "Usuário" e "Senha" ligados aos campos (`label for`). Observação: campos não recebem `aria-invalid` após o erro (melhoria baixa, não defeito).
Evidência: `evidencias/RT08/002-senha-incorreta.jpg`

## Caso 003 — Mostrar/ocultar senha
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Clicar no olho | Senha visível, botão "Ocultar caracteres" | `type=text`, rótulo trocado | [OK] |
| 2 | Clicar de novo | Senha oculta, "Mostrar caracteres" | `type=password` | [OK] |

Evidência: `evidencias/RT08/003-mostrar-senha.png`

## Caso 004 — Navegar entre login e portal
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Clicar "Ver competições públicas" | Abre o portal `/` | `/`, título "Competições"; APIs públicas 200 | [OK] |
| 2 | Clicar "Área restrita" | Volta ao `/login` | `/login` | [OK] |

## Caso 005 — Login com credenciais válidas
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | `Admin` / `admin123`, "Acessar Sistema" | Abre o Dashboard | `/dashboard`; `POST /token` 200, `/users/me` e listas 200; console sem erros | [OK] |

Evidência: `evidencias/RT08/005-login-valido-dashboard.jpg`

## Caso 006 — Menu do usuário
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Clicar no avatar | Nome, perfil, Alterar senha, Sair | "admin / Admin", "Alterar senha", "Sair" | [OK] |
| 2 | Esc | Fecha e foco volta ao avatar | Fechou; foco no "Menu do usuário" | [OK] |

Evidência: `evidencias/RT08/006-menu-usuario.png`

## Caso 007 — Tema escuro persiste
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Clicar na lua e recarregar | Continua escuro | `html.dark`, `theme=dark`, fundo `rgb(11,17,32)` | [OK] |

Evidência: `evidencias/RT08/007-tema-escuro-persistido.jpg`

## Caso 008 — Recolher sidebar
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Clicar "Recolher" | Só ícones | Recolhida | [OK] |
| 2 | Passar o mouse em Alunos | Tooltip com o nome | Tooltip "Alunos"; todos os links com `aria-label` | [OK] |
| 3 | Recarregar | Continua recolhida | `data-recolhida=true`, `sidebar-recolhida=1` | [OK] |

Evidências: `evidencias/RT08/008-sidebar-recolhida.jpg`, `008-tooltip-alunos.png`

## Caso 009 — Trilha de navegação
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Alunos | Trilha "Dashboard / Alunos" | "[Dashboard] / Alunos" | [OK] |
| 2 | Abrir "Aluno teste" | Trilha "Alunos / Aluno teste" | "[Alunos] / Aluno teste", página "Editar aluno" | [OK] |
| 3 | Clicar "Alunos" na trilha | Volta à lista | `/dashboard/alunos` | [OK] |

Evidência: `evidencias/RT08/009-trilha-aluno.jpg`

## Caso 010 — Alterar senha (validações)
Localização: menu do usuário › Alterar senha · Código: `frontend/src/components/auth/ChangePasswordModal.tsx`, backend `POST /change-password`
Pré-condição: logado como `Admin`. A senha **não** é alterada de fato (a senha atual informada é sempre incorreta).
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir o modal pelo menu do usuário | Modal "Alterar senha" com 3 campos obrigatórios | Abriu; foco inicial no botão "Fechar" | [OK] |
| 2 | Clicar "Alterar senha" com tudo vazio | "Campo obrigatório" nos 3 campos, sem chamar a API | 3 mensagens; campos com `aria-invalid=true` e `aria-describedby` para o erro | [OK] |
| 3 | Nova senha `abc` | "Mínimo 6 caracteres" | Exibido | [OK] |
| 4 | Nova `novasenha1`, confirmação `outrasenha` | "As senhas não conferem", sem chamar a API | Exibido; nenhuma requisição | [OK] |
| 5 | Confirmação igual, senha atual `senhaerrada` | API recusa, mensagem clara, modal continua aberto | `POST /change-password` 400; toast "Senha atual incorreta."; modal aberto | [OK] |
| 6 | Cancelar / Esc | Modal fecha e o foco volta ao avatar | Modal fecha, mas o foco vai para o `<body>` | [!] |

Observações: o toast de erro só some ao ser fechado (intencional, `NotificationContext.tsx:42`). O selo "1 Issue" do Next aparece porque o modal faz `console.error` no erro esperado — só em desenvolvimento.
Evidências: `010-campos-obrigatorios.jpg`, `010-minimo-6-caracteres.jpg`, `010-senhas-nao-conferem.jpg`, `010-senha-atual-incorreta.jpg`
**Status final:** [!] — validações corretas; foco não retorna (DF-RT08-04).
A troca de senha bem-sucedida foi executada no RT06, caso 007 (usuário de teste `coord.rt06`).

## Caso 011 — Celular: menu pelo ☰
Localização: qualquer tela interna · Código: `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/ui/table.tsx`
Desvio: o Chrome não reduz a janela abaixo de 500 px; executado a **500 px** de largura (abaixo do ponto de quebra `lg`, layout de celular ativo).
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Reduzir a janela no Dashboard | Sidebar escondida, ☰ no topo, cartões empilhados, sem rolagem horizontal | Conforme esperado; largura do documento 485 px | [OK] |
| 2 | Clicar ☰ | Gaveta abre sobre fundo escurecido | Abriu com todos os grupos | [OK] |
| 3 | Clicar "Alunos" na gaveta | Navega e fecha a gaveta | `/dashboard/alunos`, gaveta fechada | [OK] |
| 4 | Conferir a lista de Alunos | Só a tabela rola na horizontal | **A página inteira rola** na horizontal (541 px em 500 px) | [X] |
| 5 | Abrir ☰ e pressionar Esc | Fecha e o foco volta ao ☰ | Fechou; foco em "Abrir menu" | [OK] |
| 6 | Com a gaveta fechada, navegar com Tab desde o início | Foco só em elementos visíveis | Foco passa por 9 links **fora da tela** (x = −244) | [X] |

Evidências: `011-celular-dashboard.jpg`, `011-gaveta-aberta.jpg`, `011-alunos-rolagem-horizontal.jpg`
**Status final:** [!] — fora do escopo atual: o frontend ainda não foi pensado para celular (decisão do responsável em 16/11/2026). Achados viraram PD-RT08-03 e PD-RT08-04.

## Caso 012 — Navegação por teclado e foco visível (desktop 1440 px)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | No Dashboard, Tab a partir do início | Ordem: menu lateral → Recolher → tema → usuário → conteúdo | Dashboard…Usuários, Recolher, tema, Menu do usuário, conteúdo | [OK] |
| 2 | Observar o foco em cada parada | Anel de foco visível | Anel visível em todos os elementos do app | [OK] |
| 3 | Seguir no conteúdo | Só paradas com nome | Antes de "Nova matrícula" há **2 paradas sem nome** no gráfico (svg `role=application` e grupo da pizza do Recharts) | [!] |

Evidências: `012-foco-visivel.jpg`, `012-foco-grafico-sem-nome.png`
**Status final:** [!] — PD-RT08-01.

## Caso 013 — Sair do sistema e rotas protegidas
Localização: menu do usuário › Sair · Código: `frontend/src/context/AuthContext.tsx`, `frontend/src/lib/api.ts`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Menu do usuário › Sair | Vai para `/login` e apaga os tokens | `/login`; restam só `theme` e `sidebar-recolhida` no `localStorage` | [OK] |
| 2 | Voltar no navegador | Continua fora do sistema | Permaneceu em `/login` | [OK] |
| 3 | Abrir `/dashboard/alunos` sem login | Redirecionar para `/login` | **Foi para `/` (portal público)**; `GET /alunos/` 401 | [X] |
| 4 | Abrir `/dashboard/turmas` sem login | Redirecionar para `/login` | Também foi para `/` | [X] |

Observação: o campo Senha aparece com pontos após sair, mas o valor lido pela página é vazio — é a sugestão do gerenciador de senhas do Chrome, não do sistema.
Evidências: `013-sair-volta-login.jpg`, `013-rota-protegida-vai-para-portal.jpg`
**Status final:** [X] — DF-RT08-01. O caso 001 passou porque só testou `/dashboard`, que não dispara a chamada à API antes do redirecionamento.

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT08-01 | Rota interna sem login vai para o portal, não para o login | Média | 013 | Corrigido (T8) |
| DF-RT08-04 | Foco não volta ao avatar ao fechar "Alterar senha" | Baixa | 010 | Corrigido (T8) |

> DF-RT08-02 e DF-RT08-03 foram reclassificados como PD-RT08-03 e PD-RT08-04: o sistema hoje é só para computador (decisão do responsável, 16/11/2026). Os números ficam reservados.

**DF-RT08-01 — Rota interna sem login vai para o portal, não para o login**
- Severidade: Média (detalhe segundo o responsável, mas deve ir para `/login`; também afeta sessão expirada sem refresh token).
- Passos: 1. Sair. 2. Abrir `http://localhost:3000/dashboard/alunos` (ou `/turmas`).
- Esperado / Obtido: `/login` / `/` (portal público).
- Rede: `GET /alunos/` → 401, seguido das APIs públicas do portal.
- Causa provável: o interceptor de 401 em `frontend/src/lib/api.ts:62` e `:91` faz `window.location.href = '/'`, e isso vence o `router.push('/login')` do `AuthContext.tsx:37`. Sugestão: redirecionar para `/login` no interceptor e/ou só buscar dados com usuário autenticado.

**(Reclassificado → PD-RT08-03) DF-RT08-02 — Tabelas causam rolagem horizontal da página no celular**
- Severidade: Média.
- Passos: janela de 500 px › Alunos.
- Esperado / Obtido: só a tabela rola / o documento fica com 541 px e a página rola.
- Causa provável: o contêiner em `frontend/src/components/ui/table.tsx:7` tem `overflow-x-auto` mas não `relative`; o `<span className="sr-only">Ações</span>` (posição absoluta) escapa do contêiner e alarga a página. O mesmo cabeçalho existe em 6 telas. Sugestão: adicionar `relative` ao contêiner.

**(Reclassificado → PD-RT08-04) DF-RT08-03 — Gaveta fechada no celular continua recebendo foco**
- Severidade: Média (acessibilidade por teclado).
- Passos: janela de 500 px › recarregar › Tab.
- Esperado / Obtido: foco no ☰ e no conteúdo / foco em Dashboard, Alunos, Professores… fora da tela, sem indicação visual.
- Causa provável: `frontend/src/components/layout/Sidebar.tsx` só translada o `<aside>` (`-translate-x-full`); falta `inert`/`invisible` quando fechada no celular. A gaveta aberta também não move o foco para dentro nem tem `aria-modal`; o ☰ não tem `aria-expanded`.

**DF-RT08-04 — Foco não volta ao avatar ao fechar "Alterar senha"**
- Severidade: Baixa.
- Passos: menu do usuário › Alterar senha › Esc (ou Cancelar).
- Esperado / Obtido: foco no "Menu do usuário" / foco no `<body>`.
- Causa provável: o item de menu que abriu o modal é desmontado; o modal não devolve o foco ao gatilho (`Topbar.tsx` / `ChangePasswordModal.tsx`).

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT08-01 | Design (acessibilidade, foco) | Toda parada de Tab tem nome e propósito | Gráfico "Alunos por modalidade" cria 2 paradas sem nome (Recharts `accessibilityLayer`) | Decidir: dar `aria-label`/`title` ao gráfico ou desligar a camada de teclado. Verificar no RT07 |
| PD-RT08-02 | Roteiro (celular 390 px) | Testar a 390 px | Chrome limita a janela a 500 px | Celular fora do escopo atual |
| PD-RT08-03 | Responsividade (fora do escopo atual) | Só a tabela rola | Página rola; `ui/table.tsx:7` sem `relative` | Registrar para quando houver versão para celular |
| PD-RT08-04 | Responsividade (fora do escopo atual) | Gaveta fechada sem foco | Links fora da tela recebem Tab | Registrar para quando houver versão para celular |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 13 | 9 | 3 | 1 | 0 |

Parecer: **aprovado com ressalvas**. Login, tema, sidebar, trilha e validações de senha estão corretos. DF-RT08-01 e DF-RT08-04 serão corrigidos no plano de correções feito após a execução de todos os roteiros.

---

## Observações para outros roteiros (anotadas durante o RT08)

- **RT01 (Alunos):** "Aluno teste" tem foto (aparece no Dashboard e na edição), mas a lista de alunos mostra só as iniciais. Verificar.
- **RT01 (Alunos):** telefone sem máscara na lista ("62984632310"); o design D4 pede telefones formatados.

## Diário de execução

| Hora | Evento |
| --- | --- |
| 12:35 | Início. Ambiente: `frontend/redesign` @ `b10ab55`; extensão conectada; janela 1440×900. |
| 12:36 | Casos 001–004 executados sem falhas. |
| 12:37 | Caso 005: login `Admin` aceito (backend aceita maiúscula; perfil exibido como "admin"). |
| 12:38 | Casos 006–008. Primeiro hover do tooltip caiu entre itens; repetido sobre o ícone. |
| 12:39 | Caso 009: primeira visita à edição de aluno compilou no `next dev` (~5 s). |
| 12:40 | **Pausado** por limite de uso. Próximo: casos 010–013. |
| retomada | Nova aba; sessão do `Admin` ainda ativa (tema claro, sidebar expandida). |
| retomada | Caso 010: validações OK; senha não alterada (atual incorreta → 400). Foco não volta ao avatar. |
| retomada | Caso 011: Chrome limita a 500 px. Achados DF-02 (rolagem da página em Alunos) e DF-03 (foco na gaveta fechada). |
| retomada | Caso 012: gráfico em branco nas primeiras capturas era a animação de entrada; renderiza após ~1 s. |
| retomada | Caso 013: rota interna sem login vai para o portal (DF-01), reproduzido em Alunos e Turmas. RT08 encerrado. |
| revisão | Responsável: celular fora do escopo (DF-02/03 → PD-03/04); DF-01 rebaixado para Média; corrigir tudo só após todos os roteiros. |
