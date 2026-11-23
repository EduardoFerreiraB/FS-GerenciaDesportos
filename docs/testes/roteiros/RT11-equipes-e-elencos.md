# Roteiro de Teste – Equipes e Elencos

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT11 – Equipes e elencos |
| Versão | V2.0.0 (novo) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (administrador) |

## Escopo do roteiro

- **Objetivo:** comprovar cadastro de equipes, inscrição de atletas (competidor existente, terceiro novo, aluno importado), regras de unicidade, inativação, exclusão de equipe e cópia de elenco.
- **Referência:** spec seções 5.4 e 5.5.
- **Massa de teste (edição 2026, id 92):** "Leões RT" criada pela tela (Atleta Alfa #10, Goleiro RT Teste #10, Teste #7 — depois inativado). "Tigres RT", "Águias RT" e "Falcões RT" criadas pela API com competidores já existentes, para ganhar tempo. Competidores **novos e permanentes** (não há exclusão de competidor): "Goleiro RT Teste" e "Falcão RT Teste". Equipe descartável "Excluir RT" criada e excluída. Edição 2027 (93) recebeu a cópia das 4 equipes.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Edição sem equipes e pendência "Resolver" | Média | [OK] |
| 002 | Criar equipe | Alta | [OK] |
| 003 | Equipe com nome repetido | Alta | [OK] |
| 004 | Inscrever competidor existente | Alta | [OK] |
| 005 | Inscrever competidor já inscrito na edição | Alta | [!] |
| 006 | Cadastrar terceiro novo e camisa repetida | Média | [OK] |
| 007 | Importar aluno já importado | Alta | [!] |
| 008 | Inativar integrante | Média | [!] |
| 009 | Ações da equipe | Baixa | [!] |
| 010 | Excluir equipe em rascunho | Alta | [OK] |
| 011 | Copiar elenco de outra edição | Alta | [!] |
| 012 | Copiar elenco de novo para a mesma edição | Média | [OK] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado.

---

## Caso 001 — Sem equipes
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Visão geral › pendência "Inscreva pelo menos 2 equipes" › Resolver | Ir para Equipes | Abre a aba Equipes: "Nenhuma equipe cadastrada", botões "Copiar elenco" e "Nova equipe" | [OK] |

Evidência: `001-sem-equipes.jpg`

## Caso 002 — Criar equipe
Código: `components/competicoes/elencos/GestaoEquipes.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Nova equipe sem nome | Botão desabilitado | "Criar equipe" desabilitado | [OK] |
| 2 | Sigla com 12 caracteres | Limitar a 10 | Campo aceita só 10 | [OK] |
| 3 | "Leões RT", sigla "LEO" | Criada | `POST /edicoes/92/equipes` 201; cartão "LEO Leões RT, 0 atletas" | [OK] |

Evidências: `002-nova-equipe.jpg`, `002-equipe-criada.jpg`

## Caso 003 — Nome repetido
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Outra "Leões RT" | Recusar | 409 "Ja existe uma equipe chamada 'Leões RT' nesta edicao." no modal | [OK] |

Evidência: `003-nome-repetido.jpg`

## Caso 004 — Competidor existente
Código: `components/competicoes/elencos/GavetaIntegrante.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Adicionar integrante › Buscar › "Atleta Alfa" › camisa 10, Atacante | Inscrito | `POST /equipes/145/integrantes` 201; elenco "#10 Atleta Alfa, Atacante, Ativo" | [OK] |

Evidências: `004-adicionar-integrante.jpg`, `004-integrante-inscrito.jpg`

## Caso 005 — Competidor já inscrito
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Na busca, ver "Atleta Alfa" | Indicar que já está inscrito | Aparece igual aos outros, com "Selecionar" | [!] |
| 2 | Inscrevê-lo de novo | Recusar | 409 "Competidor ja esta inscrito em uma equipe nesta edicao." | [OK] |

Evidência: `005-competidor-ja-inscrito.jpg`

## Caso 006 — Terceiro novo e camisa repetida
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Novo Terceiro (Avulso) "Goleiro RT Teste" | Cria e seleciona | `POST /competidores` 201; nome esportivo preenchido | [OK] |
| 2 | Camisa 10 (já usada na equipe) | Avisar sem bloquear (spec 5.5) | Aviso "Número repetido na equipe… A numeração duplicada é permitida…"; inscrição 201 | [OK] |

Observação: ao trocar de atleta, a mensagem de erro anterior e o nome esportivo antigo continuam na gaveta até o novo competidor ser selecionado.
Evidências: `006-novo-terceiro.jpg`, `006-camisa-repetida-aceita.jpg`

## Caso 007 — Importar aluno já importado
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Aba "Importar Aluno da Escola" | Lista de alunos e aviso | Aviso "Preservação de histórico esportivo"; "Teste" e "Aluno teste" | [OK] |
| 2 | Importar "Teste" (já é o competidor 41) | Reutilizar o competidor | `POST /competidores/importar-aluno` 200; continua um único competidor do aluno 2 | [OK] |
| 3 | Lista de alunos | Indicar quem já foi importado | Sem indicação | [!] |

Evidência: `007-importar-aluno.jpg`

## Caso 008 — Inativar integrante
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Detalhes do "Teste" | Ações do integrante | Só "Inativar Integrante da Equipe" (não edita camisa/posição nem remove inscrição) | [!] |
| 2 | Inativar | Pedir confirmação; manter histórico | Inativa na hora, sem confirmação (`PATCH` 200); "3 atletas (2 ativos)" | [!] |
| 3 | Abrir de novo | Opção de reativar | Nenhuma ação | [!] |

Evidências: `008-detalhe-integrante.jpg`, `008-integrante-inativado.jpg`
**Status final:** [!] — DF-RT11-01.

## Caso 009 — Ações da equipe
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "⋯" de uma equipe | Editar, ver elenco, adicionar, excluir | "Ver elenco", "Adicionar integrante", "Excluir equipe"; sem editar nome/sigla | [!] |

Evidência: `009-quatro-equipes.jpg`

## Caso 010 — Excluir equipe
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Criar "Excluir RT" e excluir pelo "⋯" | Confirmação digitando o nome; competidores mantidos | Diálogo explica que inscrições serão removidas e competidores continuam; `DELETE /equipes/149` 204; 4 equipes | [OK] |

Evidência: `010-excluir-equipe.jpg`

## Caso 011 — Copiar elenco
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Edição 2027 › Copiar elenco | Escolher a edição de origem | Aviso de escopo; lista "Edição 2026 (Rascunho)" e campo "Edição de origem" que pede o **ID** da edição | [!] |
| 2 | Confirmar | 4 equipes com os mesmos atletas | `POST /edicoes/93/copiar-equipes` 201; 4 equipes, 8 inscrições | [OK] |
| 3 | Conferir o "Teste" (inativo na origem) | — | Copiado como **ativo** | [!] |

Evidências: `011-copiar-elenco.jpg`, `011-elenco-copiado.jpg` — PD-RT11-02.

## Caso 012 — Cópia repetida
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Copiar de novo para a 2027 | Recusar sem copiar parte | 409 "Ja existe uma equipe chamada 'Leões RT' na edicao de destino."; continua com 4 equipes | [OK] |

Evidência: `012-copia-repetida-bloqueada.jpg`

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT11-01 | Inativar integrante não pede confirmação e não tem volta | Média | 008 | Corrigido (T14) |
| DF-RT11-02 | "Copiar elenco" pede o ID interno da edição | Baixa | 011 | Corrigido (T2b, T14) |

**DF-RT11-01** — Um clique em "Inativar Integrante da Equipe" (`GavetaIntegrante.tsx`) inativa sem confirmação e não existe "Reativar" (a API aceita `situacao` no `PATCH /integrantes/{id}`). Um clique errado deixa o atleta fora da súmula.

**DF-RT11-02** — O campo "Edição de origem — Ou digite o ID da edição de origem" expõe um número interno. Bastaria a lista de edições (e, se necessário, de outras competições).

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT11-01 | Usabilidade | — | Busca de competidor e lista de alunos não indicam quem já está inscrito/importado | Marcar "Já inscrito" |
| PD-RT11-02 | Spec 5.5 | Cópia cria inscrições novas | Integrante inativo na origem vira ativo no destino | Decidir regra |
| PD-RT11-03 | API × tela | `PATCH /competidores/{id}`, editar equipe | Sem tela para renomear competidor, editar equipe ou corrigir camisa/posição | Decidir escopo |
| PD-RT11-04 | Massa de teste | — | Competidores criados não podem ser excluídos | Aceitar (são registros permanentes por regra) |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 12 | 6 | 6 | 0 | 0 |

Parecer: **aprovado com ressalvas**. As regras de unicidade, importação sem duplicar, cópia atômica e exclusão estão corretas; faltam confirmações e edição.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Edição 2026 sem equipes. |
| — | Leões RT criada e elenco montado pela tela (casos 002–008). |
| — | Tigres, Águias e Falcões criadas pela API (competidor novo "Falcão RT Teste"). |
| — | "Excluir RT" criada e excluída; cópia para a 2027 e cópia repetida bloqueada. |
