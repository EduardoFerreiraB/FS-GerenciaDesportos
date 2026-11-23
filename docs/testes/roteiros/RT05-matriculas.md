# Roteiro de Teste – Tela para Matrículas

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT05 – Matrículas |
| Versão | V2.0.0 (revisão da V1.0.0 de 20/02/2026 para o novo frontend) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (perfil administrador) |

## Escopo do roteiro

- **Objetivo:** comprovar consulta de alunos, matrícula em turma, bloqueio de matrícula repetida e de conflito de horário, reflexo na turma e registro de frequência (pendente do RT03).
- **Massa de teste (criada pela API e removida no fim):** aluna "Maria RT05" (id 6), matriculada na "Turma de basquete" (TER/QUI 16:00–17:00); turma "Turma Conflito RT05" (id 4, Prof, Corrida, TER 16:30–17:30). Na chamada só a aluna de teste foi marcada, para não gravar presença de aluno real.
- **Estado final conferido:** alunos "Teste" e "Aluno teste"; turmas "Futebolzin" e "Turma de basquete"; matrículas (aluno 2, turma 2) e (aluno 4, turma 1); nenhuma presença em 16/11/2026.
- **Correspondência com a V1.0.0:** 001→001, 002→002, 003→003, 004→004.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Consultar aluno | Alta | [OK] |
| 002 | Matricular aluno em uma turma | Alta | [OK] |
| 003 | Matricular aluno já matriculado na turma | Alta | [OK] |
| 004 | Consultar aluno não cadastrado | Alta | [OK] |
| 005 | Matricular com conflito de horário | Alta | [OK] |
| 006 | Matrícula aparece nos detalhes da turma | Média | [OK] |
| 007 | Registrar frequência e recarregar | Alta | [OK] |
| 008 | Diálogo indica turmas atuais do aluno | Baixa | [!] |
| 009 | Cancelar matrícula | Média | [B] |
| 010 | Trilha de navegação | Baixa | [!] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado/não executável.

---

## Caso 001 — Consultar aluno
Localização: Login › Matrículas · Código: `frontend/src/app/dashboard/matriculas/page.tsx`, backend `app/routers/matriculas.py`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Matrículas | Alunos com nome, id e ação de matricular | "Teste ID #2", "Aluno teste ID #4", "Maria RT05 ID #6", botão "Matricular" em cada | [OK] |
| 2 | Buscar `maria` | Filtra | Só "Maria RT05" | [OK] |

Evidências: `001-lista.jpg`, `001-busca.jpg`

## Caso 002 — Matricular aluno
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Matricular" em Maria RT05 | Lista de turmas | Diálogo com as 3 turmas, modalidade, dias e horário | [OK] |
| 2 | "Matricular" em Futebolzin | Mensagem de sucesso | `POST /matriculas/` 201; "Aluno Maria RT05 matriculado na turma Futebolzin com sucesso!"; diálogo fechou | [OK] |

Evidências: `002-escolher-turma.jpg`, `002-matricula-sucesso.jpg`

## Caso 003 — Já matriculado
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Matricular de novo em Futebolzin | "Matrícula já existe para este aluno e turma." | API 400 com essa mensagem; diálogo continua aberto | [OK] |

Evidência: `003-ja-matriculado.jpg`

## Caso 004 — Aluno não cadastrado
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Buscar `Ninguém` | Mensagem de nenhum aluno encontrado | "Nenhum aluno encontrado / Tente outro termo de busca." (estado vazio, sem a tabela — ver PD-RT01-01) | [OK] |

Evidência: `004-sem-resultado.jpg`

## Caso 005 — Conflito de horário
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Matricular Maria em "Turma Conflito RT05" (TER 16:30, ela tem TER 16:00–17:00) | Recusar | API 409 "Conflito de horário: O aluno já está matriculado em outra turma neste horário." | [OK] |

Observação: os dois toasts de erro ficaram empilhados (DF-RT02-03). O diálogo foi fechado com Esc, não pelo "×" do toast (DF-RT04-02).
Evidência: `005-conflito-horario.jpg`

## Caso 006 — Matrícula nos detalhes da turma
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Turmas › Futebolzin | Maria na lista | "Lista de Matriculados 2": Aluno teste e Maria RT05, situação "Matriculado"; contador 2 | [OK] |

Evidência: `006-turma-mostra-matricula.jpg`

## Caso 007 — Registrar frequência
Localização: Turmas › Futebolzin › Frequência · Código: `frontend/src/app/dashboard/turmas/[id]/page.tsx`, backend `POST /presencas/lote`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Marcar só Maria como Presente | Botão marcado; contador atualizado | `aria-pressed=true`; linha verde; "1 de 2 marcados" | [OK] |
| 2 | "Salvar Chamada" | Salva | `POST /presencas/lote` 201; "Frequência salva com sucesso!" | [OK] |
| 3 | Recarregar e abrir Frequência | Presença mantida | Maria continua "Presente"; Aluno teste sem marcação | [OK] |

Evidências: `007-chamada-salva.jpg`, `007-chamada-recarregada.jpg`

## Caso 008 — Diálogo indica turmas atuais
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir "Matricular" de Maria (já na Turma de basquete) | Indicar turmas em que já está, ou desabilitá-las | Todas as turmas aparecem iguais, com "Matricular" | [!] |

Ver PD-RT05-01.

## Caso 009 — Cancelar matrícula
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Procurar ação de cancelar matrícula (Matrículas, Alunos, Turmas) | Cancelar/trancar | Nenhuma tela oferece; o backend tem `DELETE /matriculas/{id}` | [B] |

Ver PD-RT05-02. A limpeza da massa foi feita pela API.

## Caso 010 — Trilha de navegação
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Matrículas | "Dashboard / Matrículas" | Só "Matrículas" | [!] |

Mesmo defeito de DF-RT03-02 (`matriculas/page.tsx:46`).

---

## Defeitos encontrados

Nenhum defeito novo. Reapareceram DF-RT02-03 (toasts empilhados), DF-RT04-02 (fechar o toast fecha o diálogo, evitado no teste) e DF-RT03-02 (trilha).

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT05-01 | Usabilidade | — | O diálogo de matrícula não mostra em quais turmas o aluno já está nem antecipa conflitos | Decidir: marcar "Já matriculado" e desabilitar, ou mostrar as turmas atuais |
| PD-RT05-02 | API × tela | `DELETE /matriculas/{id}` existe | Não há cancelamento de matrícula em nenhuma tela | Decidir se entra no escopo (relaciona-se com DF-RT01-01: a edição do aluno também não mexe em turmas) |
| PD-RT05-03 | Regra de negócio | Atestado e documento obrigatórios no cadastro de aluno | A API aceita aluno sem esses arquivos (a regra está só na tela) | Decidir se a API também deve exigir |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 10 | 7 | 2 | 0 | 1 |

Parecer: **aprovado com ressalvas**. Matrícula, bloqueios de duplicidade e de conflito, reflexo na turma e frequência funcionam. Falta o cancelamento de matrícula pela tela.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Massa criada pela API: turma 4 (TER 16:30–17:30) e aluna 6 (na Turma de basquete). API aceitou aluna sem documentos. |
| — | Casos 001 e 004 OK. |
| — | Casos 002, 003 e 005: matrícula 201, repetida 400, conflito 409. |
| — | Casos 006–007: Maria aparece na Futebolzin; chamada salva só para ela e mantida após recarregar. |
| — | Caso 009: sem cancelamento na tela. |
| fim | Limpeza pela API: aluna 6 (204, levou matrículas e presença) e turma 4 (204). Base conferida igual ao início. RT05 encerrado. |
