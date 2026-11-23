# Roteiro de Teste – Tela para Gestão de Alunos

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT01 – Alunos |
| Versão | V2.0.0 (revisão da V1.0.0 de 20/02/2026 para o novo frontend) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (perfil administrador) |

## Escopo do roteiro

- **Objetivo:** comprovar consulta, cadastro, validações, edição, envio de arquivos e exclusão de alunos.
- **Fora do escopo:** módulo Matrículas (RT05), celular (fora do escopo atual do frontend).
- **Massa de teste:** alunos existentes "Teste" e "Aluno teste" (não alterados). Aluno "João Teste RT01" (id 5) criado no caso 005 e excluído no caso 011. Arquivos de teste gerados para o roteiro: `foto-teste.png`, `atestado-teste.pdf`, `documento-teste.pdf`, `foto.webp`, `arquivo.txt`, `foto-6mb.png`.
- **Correspondência com a V1.0.0:** 001→001, 002→002, 003→003, 006→004, 011→005, 007→006. Os demais casos são novos.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Consultar aluno | Alta | [OK] |
| 002 | Consultar aluno não cadastrado | Alta | [OK] |
| 003 | Cadastrar com campos obrigatórios vazios | Alta | [OK] |
| 004 | Cadastrar sem documentos e sem turma | Alta | [!] |
| 005 | Cadastrar aluno válido (foto, documentos, turma) | Alta | [OK] |
| 006 | Cadastrar aluno com nome e nascimento já existentes | Alta | [!] |
| 007 | Editar dados de um aluno | Alta | [OK] |
| 008 | Edição: turmas, remover foto e apagar campo opcional | Média | [X] |
| 009 | Enviar arquivos inválidos | Média | [X] |
| 010 | Lista: foto, telefone e contagem | Baixa | [!] |
| 011 | Excluir um aluno | Alta | [OK] |
| 012 | Excluir com a busca ativa | Média | [X] |
| 013 | Cancelar exclusão e cancelar cadastro | Baixa | [OK] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado.

---

## Caso 001 — Consultar aluno
Localização: Login › Alunos · Código: `frontend/src/app/dashboard/alunos/page.tsx`, backend `app/routers/alunos.py`
Pré-condição: ter aluno cadastrado.
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Alunos | Lista com nome, nascimento, responsável, contato e ações | 2 alunos, colunas corretas, menu "…" com Editar/Excluir | [OK] |
| 2 | Digitar `ALUNO` na busca | Filtra sem diferenciar maiúsculas | Só "Aluno teste"; contador "1 aluno" | [OK] |

Evidência: `evidencias/RT01/001-busca-aluno.jpg`

## Caso 002 — Consultar aluno não cadastrado
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Buscar `Zé Inexistente` | Mensagem de nenhum resultado com o termo pesquisado | "Nenhum aluno encontrado" / "Nada encontrado para "Zé Inexistente"." | [OK] |

Observação: a V1 esperava a tabela com as colunas mantidas; o novo design mostra um estado vazio sem tabela (PD-RT01-01).
Evidência: `evidencias/RT01/002-busca-sem-resultado.jpg`

## Caso 003 — Cadastrar com campos obrigatórios vazios
Localização: Alunos › Nova matrícula · Código: `frontend/src/components/forms/AlunoForm.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Clicar "Cadastrar aluno" sem preencher | Mensagem em cada obrigatório; nada enviado | 7 mensagens (nome, nascimento, escola, série, mãe, telefone, endereço); `aria-invalid`; foco no Nome; nenhuma chamada à API | [OK] |

Observação: a V1 esperava o toast "Erro ao salvar o Aluno"; agora a validação é por campo (PD-RT01-02).
Evidência: `evidencias/RT01/003-campos-obrigatorios.jpg`

## Caso 004 — Cadastrar sem documentos e sem turma
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Preencher todos os campos, sem atestado/documento | Bloquear indicando os campos | Toast "Atestado Médico e Documento Pessoal são obrigatórios…"; campos de arquivo não ficam marcados | [!] |
| 2 | Anexar atestado e documento, sem turma | Tela indicar que a turma é obrigatória antes de enviar | Enviou; API 400 "Pelo menos uma turma deve ser selecionada."; a seção Matrícula não indica obrigatoriedade | [!] |

Observação: telefone digitado como `(62) 99999-1234` vira `62999991234` (só números, sem máscara).
Evidências: `004-sem-documentos.jpg`, `004-sem-turma.jpg`
**Status final:** [!] — DF-RT01-09.

## Caso 005 — Cadastrar aluno válido
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Com foto PNG, atestado e documento PDF, turma "Futebolzin", cadastrar "João Teste RT01" (15/03/2014) | Cadastra, volta para a lista com mensagem de sucesso | `POST /alunos/` 201; toast "Aluno cadastrado com sucesso!"; lista com 3 alunos | [OK] |
| 2 | Conferir na API | Foto, documentos e matrícula gravados | `foto`, `documento_pessoal`, `atestado_medico` preenchidos; matrícula 4 na turma 1 | [OK] |

Evidência: `evidencias/RT01/005-cadastro-sucesso.jpg`

## Caso 006 — Cadastrar aluno duplicado
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Novo cadastro com o mesmo nome e nascimento (outros dados diferentes) | Recusar com mensagem clara | API 400; toast "Já existe um aluno cadastrado com este nome e data de nascimento." | [OK] |
| 2 | Conferir a pasta `uploads/` | Nenhum arquivo gravado | +1 foto, +1 documento, +1 atestado gravados mesmo com a recusa | [!] |

Evidência: `evidencias/RT01/006-duplicado.jpg`
**Status final:** [!] — DF-RT01-10.

## Caso 007 — Editar dados de um aluno
Localização: Alunos › nome do aluno (ou … › Editar) · Código: `AlunoForm.tsx`, `app/routers/alunos.py` (PUT)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir a edição de "João Teste RT01" | Dados carregados, trilha "Alunos / João Teste RT01" | Dados e foto carregados; trilha correta | [OK] |
| 2 | Alterar a escola e salvar | Salva e volta à lista | `PUT /alunos/5` 200; "Aluno atualizado com sucesso!"; escola gravada | [OK] |

Evidências: `007-edicao-aberta.jpg`, `007-edicao-salva.jpg`

## Caso 008 — Edição: turmas, remover foto e apagar campo opcional
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir a edição | Turmas atuais marcadas ("Futebolzin") | **Nenhuma turma marcada** | [X] |
| 2 | Marcar "Turma de basquete" e salvar | Matrícula criada, ou turmas não editáveis aqui | Toast de sucesso; **turma não adicionada** (só a turma 1) | [X] |
| 3 | Clicar "Remover foto" e salvar | Foto removida | Toast de sucesso; **foto continua** | [X] |
| 4 | Apagar "Nome do pai" e salvar | Campo fica vazio | Toast de sucesso; **"José Teste" continua** | [X] |

Evidência: `evidencias/RT01/008-alteracoes-ignoradas.jpg`
**Status final:** [X] — DF-RT01-01, DF-RT01-02, DF-RT01-03.

## Caso 009 — Enviar arquivos inválidos
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Foto `.webp` (a tela anuncia "JPG, PNG ou WEBP") | Aceitar | API 400 "Extensão de arquivo '.webp' não é permitida…" | [X] |
| 2 | Atestado `.txt` | Recusar com mensagem clara | API 400 "Extensão de arquivo '.txt' não é permitida…" | [OK] |
| 3 | Foto PNG de 6 MB (a tela diz "máx. 5 MB") | Recusar | **Aceita**; `PUT` 200 | [X] |

Evidências: `009-webp-recusado.jpg`, `009-txt-recusado.jpg`, `009-foto-6mb-aceita.jpg`
**Status final:** [X] — DF-RT01-07, DF-RT01-08.

## Caso 010 — Lista: foto, telefone e contagem
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Ver "Aluno teste" e "João Teste RT01" (ambos com foto) | Miniatura da foto | Só as iniciais ("AT", "JR") | [!] |
| 2 | Ver a coluna Contato | Telefone formatado (design D4) | `62999449101` sem máscara | [!] |
| 3 | Ver o contador | "n alunos" | "2 alunos" / "3 alunos" / "1 aluno" | [OK] |

Evidência: `evidencias/RT01/010-lista-sem-foto-telefone-sem-mascara.jpg`
**Status final:** [!] — DF-RT01-05, DF-RT01-06.

## Caso 011 — Excluir um aluno
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | … › Excluir em "João Teste RT01" | Confirmação em duas etapas | Diálogo "Excluir aluno?" pedindo para digitar o nome; botão desabilitado | [OK] |
| 2 | Digitar só "João Teste" | Continua desabilitado | Desabilitado | [OK] |
| 3 | Digitar o nome completo e confirmar | Aluno excluído | `DELETE /alunos/5` 204; toast "Aluno excluído com sucesso."; matrícula também removida | [OK] |

Evidência: `evidencias/RT01/011-confirmacao-exclusao.jpg`
Observação: o diálogo não avisa que matrículas e presenças também são apagadas (PD-RT01-03).

## Caso 012 — Excluir com a busca ativa
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Buscar "João", excluir, limpar a busca | Lista mostra os 2 alunos restantes | **"Nenhum aluno cadastrado"** | [X] |
| 2 | Recarregar a página | — | 2 alunos (dados intactos; erro só na tela) | [OK] |

Evidência: `evidencias/RT01/012-lista-vazia-apos-excluir.jpg`
**Status final:** [X] — DF-RT01-04.

## Caso 013 — Cancelar exclusão e cancelar cadastro
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | … › Excluir em "Teste" › Cancelar | Fecha sem excluir | Fechou; nenhum `DELETE`; 2 alunos | [OK] |
| 2 | Nova matrícula, digitar um nome, Cancelar | Volta sem salvar | Voltou para `/dashboard/alunos`; nenhum `POST` | [OK] |

Observação: ao fechar o diálogo o foco vai para o `<body>` (mesmo padrão de DF-RT08-04). O cancelamento não avisa sobre dados não salvos.

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT01-01 | Edição não mostra nem salva as turmas | Média | 008 | Corrigido (T9) |
| DF-RT01-02 | "Remover foto" na edição não tem efeito | Média | 008 | Corrigido (T6, T9) |
| DF-RT01-03 | Não é possível apagar campo opcional na edição | Média | 008 | Corrigido (T6, T9) |
| DF-RT01-04 | Excluir com a busca ativa esvazia a lista | Média | 012 | Corrigido (T9) |
| DF-RT01-05 | Lista de alunos não mostra a foto | Baixa | 010 | Corrigido (T9) |
| DF-RT01-06 | Telefone sem formatação na lista e no formulário | Baixa | 004, 010 | Corrigido (T9) |
| DF-RT01-07 | Tela anuncia WEBP, mas o backend recusa | Baixa | 009 | Corrigido (T6) |
| DF-RT01-08 | Limite de 5 MB anunciado não é aplicado | Baixa | 009 | Corrigido (T6) |
| DF-RT01-09 | Turma e documentos obrigatórios não sinalizados nos campos | Baixa | 004 | Corrigido (T9) |
| DF-RT01-10 | Cadastro recusado deixa arquivos órfãos em `uploads/` | Baixa | 006 | Corrigido (T6) |

Todos ficam para o plano de correções feito após a execução de todos os roteiros.

**DF-RT01-01 — Edição não mostra nem salva as turmas**
- Passos: editar aluno matriculado em "Futebolzin" › marcar "Turma de basquete" › salvar.
- Esperado / Obtido: turma atual marcada e nova matrícula criada (ou seção oculta na edição) / nada marcado; toast de sucesso, turma não adicionada.
- Causa provável: `AlunoForm.tsx` pré-marca com `initialData.ids_turmas`, mas `GET /alunos/{id}` não devolve esse campo (devolve `matriculas`); no modo edição o `ids_turmas` não é enviado e o `PUT` não o aceita.

**DF-RT01-02 — "Remover foto" na edição não tem efeito**
- Passos: editar aluno com foto › "Remover foto" › salvar.
- Esperado / Obtido: foto removida / foto continua, com toast de sucesso.
- Causa provável: `AlunoForm.tsx` só limpa o estado local; o `PUT` não tem como pedir remoção (`services/alunos.py` só troca a foto quando recebe uma nova).

**DF-RT01-03 — Não é possível apagar campo opcional na edição**
- Passos: editar › apagar "Nome do pai" › salvar.
- Esperado / Obtido: campo vazio / valor antigo mantido, com toast de sucesso.
- Causa provável: `AlunoForm.tsx` só envia `nome_pai`, `telefone_2` e `recomendacoes_medicas` quando preenchidos; o backend ignora campos ausentes.

**DF-RT01-04 — Excluir com a busca ativa esvazia a lista**
- Passos: buscar "João" › excluir › limpar a busca.
- Esperado / Obtido: demais alunos visíveis / "Nenhum aluno cadastrado" até recarregar.
- Causa provável: `alunos/page.tsx:52` grava no cache do SWR a lista **filtrada** (`filteredAlunos`) sem revalidar; deve partir de `alunos` ou revalidar.

**DF-RT01-05 — Lista não mostra a foto**
- Causa provável: `alunos/page.tsx` sempre renderiza as iniciais; não usa `aluno.foto` (o Dashboard usa).

**DF-RT01-06 — Telefone sem formatação**
- Lista mostra `62999449101`; o formulário remove a máscara digitada. O design D4 pede telefones formatados.

**DF-RT01-07 — WEBP anunciado e recusado**
- Tela: "JPG, PNG ou WEBP (máx. 5 MB)"; `app/routers/alunos.py:32` aceita só jpg, jpeg, png e pdf.

**DF-RT01-08 — Limite de 5 MB não aplicado**
- Foto PNG de 6 MB aceita (`PUT` 200). Nem o formulário nem `salvar_arquivo` verificam o tamanho.

**DF-RT01-09 — Obrigatórios não sinalizados nos campos**
- Atestado e documento avisam só por toast; a seção Matrícula não indica que uma turma é obrigatória, e o erro só vem da API.

**DF-RT01-10 — Arquivos órfãos**
- Passos: cadastro duplicado com foto e documentos.
- Causa provável: `app/routers/alunos.py:81-83` grava os arquivos antes de `services/alunos.py` checar duplicidade e conflito de horário; nada apaga os arquivos na recusa. A pasta `uploads/fotos` já tem 237 arquivos para 2 alunos.

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT01-01 | RT01 V1, caso 002 | Tabela mantida com colunas | Estado vazio sem tabela | Aceitar (novo design) |
| PD-RT01-02 | RT01 V1, caso 003 | Toast "Erro ao salvar o Aluno" | Mensagem em cada campo | Aceitar (melhor) |
| PD-RT01-03 | Exclusão | — | Exclusão apaga matrículas e presenças sem avisar; a mensagem de "registros vinculados" do router nunca ocorre | Decidir: avisar no diálogo ou bloquear |
| PD-RT01-04 | Nomenclatura | — | Botão "Nova matrícula" na tela de Alunos cadastra aluno; existe também o módulo Matrículas | Decidir o rótulo ("Novo aluno"?) |
| PD-RT01-05 | Configuração | URL da API por variável de ambiente | `AlunoForm.tsx` monta a foto com `http://localhost:8000/` fixo | Corrigir junto com DF-RT01-05 (quebra fora do ambiente local) |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 13 | 7 | 3 | 3 | 0 |

Parecer: **aprovado com ressalvas**. Consulta, cadastro, validações principais e exclusão funcionam. A edição tem três alterações silenciosamente ignoradas (DF-RT01-01 a 03), que são as mais importantes do plano de correção deste módulo.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Login `Admin`; 2 alunos na base. Arquivos de teste gerados (PNG, PDF, WEBP, TXT, PNG 6 MB). |
| — | Casos 001–003 sem falhas. |
| — | Caso 004: documentos avisados só por toast; turma obrigatória só detectada pela API. |
| — | Caso 005: aluno id 5 criado com matrícula na turma 1. Contagem de `uploads/` antes do 006: 236/124/124. |
| — | Caso 006: recusa correta, mas `uploads/` passou para 237/125/125. |
| — | Casos 007–008: escola salva; turmas, foto e nome do pai ignorados com toast de sucesso. |
| — | Caso 009: WEBP recusado, TXT recusado, 6 MB aceito (foto do aluno 5 trocada pelo arquivo de 6 MB). |
| — | Casos 011–012: aluno 5 excluído com a busca ativa; lista ficou vazia até recarregar. |
| — | Caso 013 OK. Base de volta aos 2 alunos originais. RT01 encerrado. |
