# Roteiro de Teste – Lista e Cadastro de Competições

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT09 – Lista de competições |
| Versão | V2.0.0 (novo) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (administrador) |

## Escopo do roteiro

- **Objetivo:** comprovar a lista de competições (busca e filtro) e o cadastro de competição com a primeira edição e o regulamento.
- **Referência:** `docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md` (seções 5.3 e 5.6).
- **Massa de teste:** competições existentes "Campeonato de Futebol" e "Teste" (rascunho), não alteradas. Criada a **"Copa RT Testes"** (competição 88, edição "2026" id 92: grupos + mata-mata, 2 grupos, 2 classificados, final única, 3º lugar, limite de 2 amarelos), usada nos roteiros RT10 a RT16.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Listar competições | Alta | [OK] |
| 002 | Buscar por nome | Média | [OK] |
| 003 | Filtrar por modalidade | Média | [OK] |
| 004 | Cadastrar sem campos obrigatórios | Alta | [!] |
| 005 | Cadastrar com data de término antes do início | Alta | [!] |
| 006 | Cadastrar competição com regulamento | Alta | [OK] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado.

---

## Caso 001 — Listar competições
Localização: Login › Competições · Código: `frontend/src/app/dashboard/competicoes/page.tsx`, backend `GET /competicoes/competicoes`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Competições | Cartões com modalidade, nome, edições, estado e período | 2 cartões (Futebol, "1 edição", "1ª Edição", "Rascunho", período) e contador "2 competições" | [OK] |
| 2 | Depois do caso 006 | Nova competição aparece | 3 cartões; "Copa RT Testes" com descrição e período 23/11–20/12/2026 | [OK] |

Observação: a trilha mostra só "Competições" (mesmo ponto de DF-RT03-02).
Evidências: `001-lista.jpg`, `001-lista-com-nova.jpg`

## Caso 002 — Buscar por nome
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Buscar `copa` | Só a Copa RT Testes | 1 cartão, "1 competição" | [OK] |

Evidência: `002-busca.jpg`

## Caso 003 — Filtrar por modalidade
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Filtro "Basquete" | Nenhum resultado | "Nenhuma competição encontrada / Nenhuma competição corresponde aos filtros informados." | [OK] |
| 2 | Filtro "Futebol" | As 3 | 3 competições | [OK] |

Evidência: `003-filtro-sem-resultado.jpg`

## Caso 004 — Cadastrar sem obrigatórios
Localização: Competições › Nova competição · Código: `components/competicoes/organizacao/ModalNovaCompeticao.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Criar Competição" vazio | Mensagem no campo, no padrão do sistema | Balão nativo do navegador "Preencha este campo." no nome; nada enviado | [!] |

Observação: os outros formulários usam mensagens próprias em vermelho abaixo do campo; aqui a validação é a nativa do navegador (PD-RT09-01).
Evidências: `004-nova-competicao.jpg`, `004-validacao-nativa.jpg`

## Caso 005 — Datas invertidas
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Início 30/11/2026, término 01/11/2026 | Recusar dizendo que o término deve ser depois do início | API 422; mensagem "Dados da requisicao invalidos." no topo do modal, **fora da área visível** e sem indicar o campo | [!] |
| 2 | Conferir a lista | Nada criado | Nenhuma competição criada | [OK] |

Evidência: `005-datas-invertidas-mensagem-generica.jpg`
**Status final:** [!] — DF-RT09-01.

## Caso 006 — Cadastrar competição com regulamento
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Copa RT Testes", Futebol, descrição, edição "2026", Sub-13, 23/11–20/12/2026 | — | Campos preenchidos | [OK] |
| 2 | Grupos + mata-mata: 2 grupos, 2 classificados, final única, 3º lugar, 3/1/0, limite 2 amarelos, 1 jogo por vermelho | — | Opções disponíveis | [OK] |
| 3 | "Criar Competição" | Cria e abre a competição | `POST /competicoes/competicoes` 201; abre a página da competição com a edição "2026 · Rascunho", "Não publicada", pendências "Inscreva pelo menos 2 equipes" e "Tabela não gerada" | [OK] |

Observação: o formulário não tem "jogos por acúmulo de amarelos", "jogos por segundo amarelo" nem a ordem dos critérios de desempate, previstos na especificação (seção 5.6) — PD-RT09-02.
Evidências: `006-configuracao.jpg`, `006-competicao-criada.jpg`

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT09-01 | Erros de validação da API aparecem como "Dados da requisicao invalidos." | Média | 005 | Corrigido (T0.2) |

**DF-RT09-01 — Mensagem genérica e escondida**
- A API devolve `{"codigo":"…","mensagem":"Dados da requisicao invalidos.","campos":["…"]}` (o campo com problema vem em `campos`), mas a tela mostra só a `mensagem`, sem acento, no topo do modal, que fica fora da vista quando o usuário clicou em "Criar" no rodapé.
- Sugestão: traduzir `campos` em mensagens por campo e rolar até o primeiro erro. O mesmo acontece na Configuração da edição (RT10, caso 003).
- Relacionado: as mensagens do backend de competições vêm sem acentos ("Ja existe…", "edicao") — ver DF-RT10-01.

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT09-01 | Padrão de formulários | Mensagem em vermelho abaixo do campo | Validação nativa do navegador | Padronizar |
| PD-RT09-02 | Spec 5.6 e 7.4 | Configuração com jogos por acúmulo, por segundo amarelo e ordem de desempates | Só limite de amarelos, jogos por vermelho e zerar amarelos | Decidir se entram na tela |
| PD-RT09-03 | Organização | — | Nome de competição pode repetir (o sistema gera outro endereço) | Aceitar ou impedir |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 6 | 4 | 2 | 0 | 0 |

Parecer: **aprovado com ressalvas**.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Lista com 2 competições em rascunho. |
| — | Caso 004: validação nativa. Caso 005: 422 com mensagem genérica; nada criado. |
| — | Caso 006: "Copa RT Testes" criada (88/92). Casos 001–003 com a nova competição. |
