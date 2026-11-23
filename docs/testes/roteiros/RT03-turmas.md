# Roteiro de Teste – Tela para Gestão de Turmas

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT03 – Turmas |
| Versão | V2.0.0 (revisão da V1.0.0 de 20/02/2026 para o novo frontend) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (perfil administrador) |

## Escopo do roteiro

- **Objetivo:** comprovar consulta, cadastro, validações de horário e conflito, detalhes (alunos e frequência), edição e exclusão de turmas.
- **Fora do escopo:** salvar chamada com presenças (alteraria dados reais; fica para o RT05 com massa própria), celular.
- **Massa de teste:** turmas existentes "Futebolzin" (id 1, Jorge, SEG/QUA/SEX 16:00–17:00, 1 aluno) e "Turma de basquete" (id 2, Jorge, TER/QUI 16:00–17:00), não alteradas. "Turma Teste RT03" (id 3) criada no caso 006 e excluída no caso 010.
- **Correspondência com a V1.0.0:** 006→001, 001→002, 010→003, 008→004, 003→004 (a V1 tinha dois casos 004).

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Consultar turma por nome e por professor | Alta | [OK] |
| 002 | Consultar turma não cadastrada | Alta | [OK] |
| 003 | Cadastrar com campos obrigatórios vazios | Alta | [OK] |
| 004 | Cadastrar com horário de fim antes do início | Alta | [OK] |
| 005 | Cadastrar com conflito de horário do professor | Alta | [OK] |
| 006 | Cadastrar turma válida (horário encostado em outra) | Alta | [OK] |
| 007 | Ver detalhes: alunos e frequência | Média | [!] |
| 008 | Editar dados de uma turma | Alta | [OK] |
| 009 | Editar criando conflito de horário | Média | [!] |
| 010 | Excluir turma sem matrículas (com a busca ativa) | Alta | [OK] |
| 011 | Excluir turma com matrículas | Alta | [B] |
| 012 | Trilha de navegação da lista | Baixa | [!] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado/não executado.

---

## Caso 001 — Consultar turma
Localização: Login › Turmas · Código: `frontend/src/app/dashboard/turmas/page.tsx`, backend `app/routers/turmas.py`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Turmas | Nome, modalidade, professor, dias, horário e ações (detalhes, editar, excluir) | Colunas Turma (com categoria), Modalidade, Professor, Dias, Horário; menu com "Ver detalhes", "Editar", "Excluir" | [OK] |
| 2 | Buscar `BASQ` | Filtra pelo nome | Só "Turma de basquete" | [OK] |
| 3 | Buscar `jorge` | Filtra pelo professor | As 2 turmas | [OK] |

Evidências: `001-lista.jpg`, `001-busca.jpg`

## Caso 002 — Turma não cadastrada
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Buscar `Volei` | Mensagem de nenhum resultado | "Nenhuma turma encontrada" / "Tente outro termo de busca." | [OK] |

Evidência: `002-sem-resultado.jpg`

## Caso 003 — Cadastrar com obrigatórios vazios
Localização: Turmas › Nova turma · Código: `frontend/src/components/forms/TurmaForm.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Criar Turma" sem preencher | Mensagem vermelha abaixo de cada campo | 7 mensagens (modalidade, professor, categoria, nome, dias, início, fim); foco em Modalidade; nenhuma chamada à API | [OK] |
| 2 | Preencher tudo menos os dias | Bloquear pedindo um dia | Aviso "Selecione pelo menos um dia da semana." e mensagem no campo | [OK] |

Observação: os botões de dia usam `aria-pressed`, corretamente.
Evidências: `003-campos-obrigatorios.jpg`, `003-sem-dia.jpg`

## Caso 004 — Horário de fim antes do início
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Segunda, 18:00 às 17:00 | Recusar com mensagem clara | API 400 "O horário de início deve ser anterior ao horário de término." | [OK] |

Observação: a validação só acontece na API (PD-RT03-02).
Evidência: `004-horario-invertido.jpg`

## Caso 005 — Conflito de horário do professor
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Jorge, segunda 16:30–17:30 (ele tem Futebolzin 16:00–17:00) | Recusar | API 400 "Conflito de horário: O professor já possui aula neste período." | [OK] |

Evidência: `005-conflito-professor.jpg`

## Caso 006 — Cadastrar turma válida
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Futebol, Jorge, sub-13, "Turma Teste RT03", segunda 17:00–18:00 (encostada na Futebolzin) | Aceitar e mostrar "Turma criada com sucesso" | `POST /turmas/` 201; toast "Turma criada com sucesso!"; lista com 3 turmas | [OK] |

Evidência: `006-turma-criada.jpg`

## Caso 007 — Ver detalhes: alunos e frequência
Localização: Turmas › Futebolzin · Código: `frontend/src/app/dashboard/turmas/[id]/page.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir "Futebolzin" | Informações e alunos matriculados | Modalidade, professor, dias, horário, 1 matriculado; aba Alunos com "Aluno teste — Matriculado" | [OK] |
| 2 | Aba Frequência | Data do dia e lista para marcar presença | Data 16/11/2026, botões Presente/Ausente, "Marcar Todos Presentes", contador "0 de 1 marcados" | [OK] |
| 3 | "Salvar Chamada" sem marcar ninguém | Bloquear | Aviso "Marque pelo menos um aluno." | [OK] |
| 4 | Observar as abas | Sem barras de rolagem | **Setas de rolagem vertical** visíveis à direita das abas (lista com 42 px de conteúdo em 41 px) | [!] |

Evidências: `007-detalhes-alunos.jpg`, `007-frequencia.jpg`, `007-chamada-vazia.jpg`, `007-abas-setas-rolagem.png`
**Status final:** [!] — DF-RT03-01.

## Caso 008 — Editar dados de uma turma
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir a edição de "Turma Teste RT03" | Dados, dias e horários carregados | Tudo carregado (Segunda marcada, 17:00–18:00); trilha "Turmas / Turma Teste RT03 / Editar" | [OK] |
| 2 | Categoria `sub-15`, marcar Quarta, salvar | Salva e volta à lista | `PUT /turmas/3` 200; "Turma atualizada com sucesso!"; lista mostra SEG, QUA e sub-15 | [OK] |

Evidências: `008-edicao-aberta.jpg`, `008-edicao-salva.jpg`

## Caso 009 — Editar criando conflito
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Mudar para 16:00–17:00 (choca com Futebolzin na segunda) | Recusar | API 400 "Conflito de horário na atualização." | [OK] |
| 2 | Corrigir e clicar "Salvar Alterações" | Salvar | O primeiro clique **caiu no toast de erro**, que cobria o botão; só salvou após fechar o toast | [!] |

Evidências: `009-edicao-conflito.jpg`, `009-toast-cobre-botao.jpg`
**Status final:** [!] — mesmo defeito de DF-RT02-03 (toasts de erro cobrindo o botão principal).

## Caso 010 — Excluir turma sem matrículas (com a busca ativa)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Buscar `RT03`, … › Excluir | Confirmação em duas etapas | "Excluir turma" avisa que remove os vínculos com alunos matriculados; pede o nome; botão desabilitado | [OK] |
| 2 | Digitar o nome e confirmar | Exclui | `DELETE /turmas/3` 204; toast "Turma excluída." | [OK] |
| 3 | Limpar a busca | Lista com as 2 turmas restantes | 2 turmas (a tela revalida a lista) | [OK] |

Evidências: `010-confirmacao-exclusao.jpg`, `010-lista-apos-excluir.jpg`

## Caso 011 — Excluir turma com matrículas
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Excluir "Futebolzin" (1 aluno) | Bloquear ou avisar claramente | **Não executado** | [B] |

Motivo: pelo código (`app/services/turmas.py:126-140`), a exclusão apaga em cascata as presenças e matrículas da turma; executar destruiria dados reais. Ver PD-RT03-01.

## Caso 012 — Trilha de navegação da lista
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Turmas | Trilha "Dashboard / Turmas", como nas outras listas | Só "Turmas" | [!] |

Evidência: `001-lista.jpg`
**Status final:** [!] — DF-RT03-02.

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT03-01 | Setas de rolagem vertical aparecem nas abas | Baixa | 007 | Corrigido (T8) |
| DF-RT03-02 | Trilha da lista de Turmas sem "Dashboard" | Baixa | 012 | Corrigido (T10) |

Também observado: DF-RT02-03 (toast de erro cobre o botão principal) no caso 009.

**DF-RT03-01 — Setas de rolagem nas abas**
- Causa provável: `frontend/src/components/ui/tabs.tsx:12` usa `overflow-x-auto` na lista de abas; o conteúdo tem 1 px a mais que a altura, e o navegador mostra rolagem vertical. Sugestão: `overflow-y-hidden` ou ajustar a borda/indicador. O componente é usado em outras telas (competições), então o defeito deve se repetir.

**DF-RT03-02 — Trilha sem "Dashboard"**
- Causa: `frontend/src/app/dashboard/turmas/page.tsx:44` define a trilha só com `{ label: 'Turmas' }`; Alunos e Professores mostram "Dashboard / …".

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT03-01 | Exclusão | — | Excluir turma apaga matrículas **e presenças** em cascata; o diálogo fala só em "vínculos com os alunos"; a mensagem do router sobre "dependências ativas" nunca ocorre | Decidir: bloquear com matrículas ativas ou avisar que o histórico de frequência será perdido (mesma decisão de PD-RT01-03) |
| PD-RT03-02 | Validação | — | Horário invertido só é validado na API | Aceitar, ou validar também na tela |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 12 | 8 | 3 | 0 | 1 |

Parecer: **aprovado com ressalvas**. Cadastro, validações de horário e conflito, edição e exclusão funcionam. Ficam dois defeitos visuais e a decisão sobre a exclusão em cascata.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Base: 2 turmas do Jorge, 1 aluno na Futebolzin. Leitura do código: exclusão apaga em cascata → caso 011 não executado. |
| — | Casos 001–003 OK. Primeiro clique em "Segunda" errou porque o layout mudou ao sumirem os erros; refeito. |
| — | Casos 004–006 OK; turma id 3 criada. |
| — | Caso 007: só leitura na Futebolzin; chamada não salva. Setas de rolagem nas abas. |
| — | Casos 008–009: edição OK; conflito recusado; toast de erro cobriu o botão. |
| — | Caso 010: turma 3 excluída com a busca ativa; lista correta. Base de volta às 2 turmas. RT03 encerrado. |
