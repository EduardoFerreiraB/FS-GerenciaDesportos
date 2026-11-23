# Roteiro de Teste – Tela do Dashboard

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT07 – Dashboard |
| Versão | V2.0.0 (revisão da V1.0.0 de 20/02/2026 para o novo frontend) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (administrador); `prof.rt07` (professor criado para o teste) |

## Escopo do roteiro

- **Objetivo:** comprovar indicadores, gráfico, ações rápidas e alunos recentes do administrador, e a "Área do professor".
- **Massa de teste (criada pela API e removida no fim):** professor "Professor RT07" (id 4, usuário `prof.rt07`, CPF de teste `98765432029`) com a "Turma RT07" (id 5, Corrida, QUA 19:00–20:00). No primeiro acesso a senha de teste foi trocada pelo modal obrigatório.
- **Estado final conferido:** professores Jorge e Prof; turmas Futebolzin e Turma de basquete; 5 usuários originais.
- **Correspondência com a V1.0.0:** 001→001, 003→002, 004→003.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Indicadores do painel | Alta | [OK] |
| 002 | Gráfico de alunos por modalidade | Média | [!] |
| 003 | Ações rápidas | Alta | [!] |
| 004 | Alunos recentes e "Ver todos" | Alta | [OK] |
| 005 | Área do professor | Alta | [OK] |
| 006 | Professor: "Fazer chamada" | Média | [!] |
| 007 | Professor: ações visíveis conforme o perfil | Baixa | [!] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado.

---

## Caso 001 — Indicadores
Localização: Login › Dashboard · Código: `frontend/src/app/dashboard/page.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir o Dashboard e comparar com a API | Números iguais aos cadastros | Alunos 2, Turmas 2, Professores 2 ("1 sem turma"), Modalidades 3 ("1 sem turma"); API: 2, 2, 2 (1 sem turma), 3 (1 sem turma) | [OK] |

Observação: "Modalidades ativas" conta também a modalidade sem turma (PD-RT07-01).
Evidência: `001-indicadores.jpg`

## Caso 002 — Gráfico de alunos por modalidade
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Conferir rosca e legenda | Matrículas por modalidade | Basquete 1 (50%), Futebol 1 (50%); API: uma matrícula em cada | [OK] |
| 2 | Navegar com Tab | Paradas com nome | 2 paradas sem nome no gráfico (svg e grupo do Recharts) | [!] |

Observação: nas primeiras capturas a rosca aparece em branco durante a animação de entrada (~1 s); não é defeito.
Evidência: `002-foco-grafico-sem-nome.png` (do RT08) — ver PD-RT08-01.

## Caso 003 — Ações rápidas
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Nova matrícula" | Tela de matrícula | `/dashboard/matriculas` | [OK] |
| 2 | "Novo aluno" | Cadastro de aluno | `/dashboard/alunos/novo`, título "Nova matrícula" (ver PD-RT01-04) | [OK] |
| 3 | "Nova turma" | Cadastro de turma | `/dashboard/turmas/novo` | [OK] |
| 4 | "Nova competição — Organizar um campeonato" | Cadastro de competição | `/dashboard/competicoes` (lista); é preciso clicar de novo em "Nova competição" | [!] |

Evidência: `003-nova-competicao-vai-para-lista.jpg`
**Status final:** [!] — DF-RT07-01.

## Caso 004 — Alunos recentes
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Ver a seção | Nome, turma, nascimento, responsável e situação | "Aluno teste" (com foto) e "Teste", com turma, nascimento, responsável e "Ativo"; mais recente primeiro | [OK] |
| 2 | "Ver todos" | Lista de alunos | `/dashboard/alunos` | [OK] |

Observação: os nomes não são links para o aluno (PD-RT07-02). Aqui a foto aparece; na lista de Alunos não (DF-RT01-05).
Evidência: `004-alunos-recentes.jpg`

## Caso 005 — Área do professor
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Entrar como `prof.rt07` e trocar a senha obrigatória | Painel do professor | "Área do professor"; menu só com Dashboard, Alunos e Turmas | [OK] |
| 2 | Conferir os cartões | Alunos, turmas e aulas de hoje | Meus alunos 0, Minhas turmas 1, Aulas hoje 0 (segunda-feira; a turma é de quarta) | [OK] |
| 3 | Conferir "Próxima aula" | Próxima data correta | "Turma RT07", sub-9 · Corrida, "Quarta-feira, 18/11", 19:00–20:00 | [OK] |
| 4 | Turmas e Alunos do professor | Só os dele | Turmas: só "Turma RT07"; Alunos: lista vazia | [OK] |

Observação: "Minhas turmas" mostra o dia abreviado ("QUA · 19:00"), enquanto o cartão mostra "Quarta-feira".
Evidência: `005-area-do-professor.jpg`

## Caso 006 — "Fazer chamada"
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Clicar "Fazer chamada" | Abrir a turma na aba Frequência | Abre `/dashboard/turmas/5` na aba **Alunos** | [!] |

**Status final:** [!] — DF-RT07-02.

## Caso 007 — Ações conforme o perfil
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Como professor, ver Turmas e Alunos | Sem ações de cadastro | Botões "Nova turma" e "Nova matrícula"; estado vazio "Nenhum aluno cadastrado — Cadastre o primeiro aluno para começar." | [!] |

Evidência: `007-professor-ve-acoes-de-cadastro.jpg`
**Status final:** [!] — DF-RT07-03.

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT07-01 | Ação rápida "Nova competição" leva à lista | Baixa | 003 | Corrigido (T10) |
| DF-RT07-02 | "Fazer chamada" abre a aba Alunos | Baixa | 006 | Corrigido (T10) |
| DF-RT07-03 | Professor vê ações de cadastro que não pode usar | Baixa | 007 | Corrigido (T10) |

**DF-RT07-01** — `dashboard/page.tsx:190` aponta para `/dashboard/competicoes`. Sugestão: abrir direto o cadastro (rota ou parâmetro que abre o formulário).

**DF-RT07-02** — `dashboard/page.tsx:454` aponta para `/dashboard/turmas/{id}`; a página sempre começa na aba "alunos" (`turmas/[id]/page.tsx:209`). Sugestão: parâmetro `?aba=frequencia`.

**DF-RT07-03** — Alunos e Turmas não escondem "Nova matrícula"/"Nova turma" para o professor, e o estado vazio sugere cadastrar. A API nega a ação (coordenador ou acima). Mesma família de DF-RT06-02: tratar ações e rotas por perfil num lugar só.

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT07-01 | Indicadores | "Modalidades ativas" | Conta todas as modalidades, inclusive sem turma | Decidir o rótulo ("Modalidades") ou o critério |
| PD-RT07-02 | Alunos recentes | — | Nomes não abrem o aluno | Decidir se viram links |
| PD-RT08-01 | Acessibilidade | — | Gráfico com 2 paradas de Tab sem nome | Já registrado no RT08 |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 7 | 3 | 4 | 0 | 0 |

Parecer: **aprovado com ressalvas**. Números, gráfico, alunos recentes e a área do professor estão corretos. Ficam três ajustes de navegação e de ações por perfil.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Indicadores e gráfico conferidos contra a API. |
| — | Ações rápidas: "Nova competição" cai na lista. |
| — | Massa criada pela API: professor 4 (`prof.rt07`) e turma 5. Login, troca obrigatória de senha, área do professor. |
| — | "Fazer chamada" abre a aba Alunos; professor vê botões de cadastro. |
| fim | Limpeza pela API (turma 5 e professor 4: 204); sessão de volta ao Admin; base conferida. "Ver todos" OK. RT07 encerrado. |
