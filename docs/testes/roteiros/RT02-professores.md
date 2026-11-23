# Roteiro de Teste – Tela para Gestão de Professores

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT02 – Professores |
| Versão | V2.0.0 (revisão da V1.0.0 de 20/02/2026 para o novo frontend) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (perfil administrador) |

## Escopo do roteiro

- **Objetivo:** comprovar consulta, cadastro (com criação do acesso ao sistema), validações, edição e exclusão de professores.
- **Fora do escopo:** primeiro acesso do professor com troca obrigatória de senha (RT06 Usuários), celular.
- **Massa de teste:** professores existentes "Jorge" (id 1, dono das turmas 1 e 2) e "Prof" (id 2), não alterados. "Professor Teste RT02" (id 3, usuário `prof.rt02`, CPF de teste válido `12345678062`) criado no caso 005 e excluído no caso 012.
- **Correspondência com a V1.0.0:** 001→001, 002→002, 003→003, 006→004, 011→005, 008→006. Os demais casos são novos.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Consultar professor | Alta | [OK] |
| 002 | Consultar professor não cadastrado | Alta | [OK] |
| 003 | Cadastrar com campos obrigatórios vazios | Alta | [OK] |
| 004 | Cadastrar com senha curta e CPF inválido | Alta | [OK] |
| 005 | Cadastrar professor válido e criar o acesso | Alta | [OK] |
| 006 | Cadastrar com CPF já existente | Alta | [OK] |
| 007 | Cadastrar com nome de usuário já existente | Média | [!] |
| 008 | Editar dados de um professor | Alta | [OK] |
| 009 | Editar CPF para um já usado por outro professor | Média | [OK] |
| 010 | Excluir professor com turmas (bloqueio) e cancelar | Alta | [OK] |
| 011 | Excluir professor sem turmas | Alta | [OK] |
| 012 | Excluir com a busca ativa | Média | [X] |
| 013 | Lista: CPF e contato formatados | Baixa | [!] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado.

---

## Caso 001 — Consultar professor
Localização: Login › Professores · Código: `frontend/src/app/dashboard/professores/page.tsx`, backend `app/routers/professores.py`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Professores | Nome, CPF, contato, usuário do sistema e ações | Colunas Professor, CPF, Contato, Acesso ao sistema (`@Prof`, `@Prof1`) e menu "…" | [OK] |
| 2 | Buscar `jor` | Filtra pelo nome, sem diferenciar maiúsculas | Só "Jorge"; "1 professor" | [OK] |

Observação: a busca é só por nome (como o campo indica); buscar parte do CPF não encontra (PD-RT02-02).
Evidências: `001-lista.jpg`, `001-busca.jpg`

## Caso 002 — Consultar professor não cadastrado
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Buscar `Inexistente` | Mensagem de nenhum resultado | "Nenhum professor encontrado" / "Nada encontrado para "Inexistente"." | [OK] |

Observação: como no RT01, o estado vazio substitui a tabela (PD-RT01-01).
Evidência: `002-sem-resultado.jpg`

## Caso 003 — Cadastrar com campos obrigatórios vazios
Localização: Professores › Novo professor · Código: `frontend/src/components/forms/ProfessorForm.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Cadastrar professor" sem preencher | Mensagem vermelha abaixo de cada campo faltante | 5 mensagens (nome, CPF, contato, usuário, senha); foco no Nome; nenhuma chamada à API | [OK] |

Evidência: `003-campos-obrigatorios.jpg`

## Caso 004 — Senha curta e CPF inválido
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Senha `abc` | "Mínimo 6 caracteres", sem chamar a API | Exibido; nenhuma requisição | [OK] |
| 2 | CPF digitado `123.456.789-00` | Aceitar só números | Campo ficou `12345678900` | [OK] |
| 3 | Senha válida, CPF `12345678900` (dígitos errados) | Recusar com mensagem clara | API 400 "CPF inválido. Certifique-se de que o número está correto." | [OK] |

Evidências: `004-senha-curta.jpg`, `004-cpf-invalido.jpg`

## Caso 005 — Cadastrar professor válido e criar o acesso
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Professor Teste RT02", CPF `12345678062`, contato, usuário `prof.rt02`, senha de teste | Cadastra e volta à lista | `POST /professores/` 201; toast de sucesso; 3 professores, `@prof.rt02` | [OK] |
| 2 | Pela API, `POST /token` com o novo usuário (sem trocar a sessão do Admin) | Login aceito, perfil professor | 200; `role=professor`; `must_change_password=true` | [OK] |

Evidência: `005-cadastro-sucesso.jpg`

## Caso 006 — CPF já existente
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Cadastrar com o CPF de "Jorge" | Mensagem de CPF já cadastrado | API 400 "Este CPF já está cadastrado para outro professor." | [OK] |

Evidência: `006-cpf-duplicado.jpg`

## Caso 007 — Nome de usuário já existente
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Usuário `admin` (existe `Admin`) | Recusar | API 400 "Este nome de usuário já está sendo utilizado." (comparação sem diferenciar maiúsculas) | [OK] |
| 2 | Observar as mensagens | Erros anteriores somem | Os 3 toasts de erro dos casos 004–007 ficaram empilhados e **cobriram o botão "Cadastrar professor"** | [!] |

Evidência: `007-usuario-duplicado-toasts-empilhados.jpg`
**Status final:** [!] — DF-RT02-03.

## Caso 008 — Editar dados de um professor
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir "Professor Teste RT02" | Dados carregados; usuário não editável; sem campo de senha | Conforme esperado; trilha "Professores / Professor Teste RT02" | [OK] |
| 2 | Alterar nome e contato, salvar | Salva e volta à lista | `PUT /professores/3` 200; lista com "Professor Editado RT02" e o novo contato | [OK] |

Evidências: `008-edicao-aberta.jpg`, `008-edicao-salva.jpg`
Observação: não há como o administrador redefinir a senha do professor nesta tela (PD-RT02-04).

## Caso 009 — Editar CPF para um já existente
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Trocar o CPF pelo de "Jorge" e salvar | Recusar e manter na edição | API 400 "Este CPF já está cadastrado para outro professor."; continuou na edição | [OK] |

Evidência: `009-edicao-cpf-duplicado.jpg`

## Caso 010 — Excluir professor com turmas e cancelar
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | … › Excluir em "Jorge" | Confirmação pedindo o nome | Diálogo; botão desabilitado até digitar "Jorge" | [OK] |
| 2 | Confirmar | Bloquear, explicando o motivo | `DELETE /professores/1` 400; erro no diálogo "Erro ao excluir professor. Verifique se ele não possui turmas vinculadas."; nada excluído | [OK] |
| 3 | Cancelar | Fecha sem excluir | Fechou; "Jorge" continua | [OK] |

Observação: o backend devolve "…está alocado em uma ou mais turmas.", mas a tela mostra uma mensagem genérica própria (PD-RT02-03).
Evidência: `010-excluir-com-turmas-bloqueado.jpg`

## Caso 011 — Excluir professor sem turmas
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Excluir "Professor Editado RT02" digitando o nome | Exclui professor e o acesso | `DELETE /professores/3` 204; toast "Professor excluído com sucesso." | [OK] |
| 2 | Pela API, `POST /token` com `prof.rt02` | Acesso removido | 401 | [OK] |

## Caso 012 — Excluir com a busca ativa
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Caso 011 feito com a busca "Editado"; depois limpar a busca | Lista com "Jorge" e "Prof" | **"Nenhum professor cadastrado"** (a API devolve os 2) | [X] |

Evidência: `012-lista-vazia-apos-excluir.jpg`
**Status final:** [X] — DF-RT02-01.

## Caso 013 — Lista: CPF e contato formatados
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Ver as colunas CPF e Contato | `951.068.120-20`, `(62) 98855-6235` (design D4) | `95106812020`, `62988556235` | [!] |

Evidência: `001-lista.jpg`
**Status final:** [!] — DF-RT02-02.

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT02-01 | Excluir com a busca ativa esvazia a lista | Média | 012 | Corrigido (T10) |
| DF-RT02-02 | CPF e contato sem formatação | Baixa | 013 | Corrigido (T10) |
| DF-RT02-03 | Toasts de erro se acumulam, não somem e cobrem o botão principal | Baixa | 007 | Corrigido (T8) |

Todos ficam para o plano de correções feito após a execução de todos os roteiros.

**DF-RT02-01 — Excluir com a busca ativa esvazia a lista**
- Mesmo defeito de DF-RT01-04. Causa: `professores/page.tsx:51` grava no cache a lista filtrada sem revalidar. Corrigir as duas telas (e verificar as demais listas) juntas.

**DF-RT02-02 — CPF e contato sem formatação**
- Mesmo padrão de DF-RT01-06 (lista e formulário só com números). Sugestão: uma função de formatação comum em `lib/formatos`.

**DF-RT02-03 — Toasts de erro se acumulam e cobrem o botão principal**
- Passos: provocar 3 erros seguidos no cadastro.
- Esperado / Obtido: só a mensagem mais recente, sem cobrir ações / 3 toasts empilhados no canto inferior direito, por cima de "Cadastrar professor"; um toast de erro também continuou visível depois de navegar para outra tela.
- Causa provável: `NotificationContext.tsx:42` deixa toasts de erro abertos até o usuário fechar. Sugestão: tempo maior em vez de infinito, limitar a quantidade e substituir o erro anterior do mesmo formulário. Problema transversal (vale para todas as telas).

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT02-01 | RT02 V1, caso 002 | Tabela mantida com colunas | Estado vazio sem tabela | Aceitar (igual PD-RT01-01) |
| PD-RT02-02 | Busca | — | Só por nome; CPF não é buscável | Decidir se a busca deve incluir CPF e usuário |
| PD-RT02-03 | Exclusão | Mensagem do motivo | Tela troca a mensagem do backend por uma genérica | Mostrar `detail` da API |
| PD-RT02-04 | Acesso | — | Administrador não redefine senha do professor nesta tela | Verificar no RT06 (Usuários) |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 13 | 10 | 2 | 1 | 0 |

Parecer: **aprovado com ressalvas**. Cadastro, criação do acesso, validações de CPF e usuário, edição e bloqueio de exclusão estão corretos. Ficam o defeito de lista após exclusão (compartilhado com Alunos) e dois defeitos visuais.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Base: professores Jorge (turmas 1 e 2) e Prof. CPFs de teste válidos gerados. |
| — | Casos 001–004 sem falhas. |
| — | Casos 006–007: erros corretos; toasts de erro empilhados cobriram o botão. |
| — | Caso 005: professor id 3 criado; login de `prof.rt02` validado pela API (exige troca de senha). |
| — | Casos 008–009 OK. |
| — | Caso 010: exclusão de Jorge bloqueada (400); nada alterado. |
| — | Casos 011–012: professor 3 excluído com a busca ativa; acesso removido (401); lista vazia até recarregar. Base de volta aos 2 professores. RT02 encerrado. |
