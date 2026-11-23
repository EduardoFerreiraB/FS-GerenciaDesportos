# Roteiro de Teste – Tela para Gestão de Modalidades

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT04 – Modalidades |
| Versão | V2.0.0 (revisão da V1.0.0 de 20/02/2026 para o novo frontend) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (perfil administrador) |

## Escopo do roteiro

- **Objetivo:** comprovar consulta, cadastro, validações e exclusão de modalidades.
- **Massa de teste:** modalidades existentes Futebol (id 4, com turma), Corrida (id 5, sem turma) e Basquete (id 6, com turma), não alteradas. "Vôlei RT04" (id 8) criada no caso 004 e excluída no caso 007. Antes de cada exclusão foi conferido qual menu estava aberto, para não excluir a "Corrida" por engano.
- **Correspondência com a V1.0.0:** 004→001, 007→002, 001→003, 002→004.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Consultar modalidade | Alta | [OK] |
| 002 | Consultar modalidade não cadastrada | Alta | [!] |
| 003 | Cadastrar sem nome | Alta | [OK] |
| 004 | Cadastrar modalidade válida | Alta | [OK] |
| 005 | Cadastrar com nome já existente | Média | [!] |
| 006 | Excluir modalidade com turmas (bloqueio) | Alta | [OK] |
| 007 | Excluir modalidade sem turmas | Alta | [OK] |
| 008 | Editar modalidade | Média | [B] |
| 009 | Trilha de navegação | Baixa | [!] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado/não executável.

---

## Caso 001 — Consultar modalidade
Localização: Login › Modalidades · Código: `frontend/src/app/dashboard/modalidades/page.tsx`, backend `app/routers/modalidades.py`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Modalidades | Nome e descrição | 3 modalidades com nome, descrição ("—" quando vazia) e menu "…" | [OK] |
| 2 | Buscar `fute` | Filtra pelo nome | Só "Futebol" | [OK] |

Evidências: `001-lista.jpg`, `001-busca.jpg`

## Caso 002 — Modalidade não cadastrada
| # | Procedimento | Esperado (V1) | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Buscar `Natação` | Mostrar a opção de cadastrar nova modalidade | "Nenhuma modalidade encontrada / Tente outro termo de busca.", sem botão no estado vazio (o botão "Nova modalidade" continua no topo) | [!] |

Evidência: `002-sem-resultado.jpg` — ver PD-RT04-01.

## Caso 003 — Cadastrar sem nome
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Nova modalidade" › Salvar vazio | Mensagem no campo; nada enviado | "Campo obrigatório" no nome; nenhuma chamada à API | [OK] |

Evidência: `003-nome-obrigatorio.jpg`

## Caso 004 — Cadastrar modalidade válida
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Nome "Vôlei RT04", descrição, Salvar | Nova modalidade na lista | `POST /modalidades/` 201; toast "Modalidade cadastrada."; modal fechou; aparece na lista | [OK] |
| 2 | Reabrir "Nova modalidade" | Formulário limpo | Nome e descrição vazios | [OK] |

Evidência: `004-cadastro-sucesso.jpg`

## Caso 005 — Nome já existente
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Nome `futebol` | Recusar dizendo que já existe | API 400 "Modalidade com este nome já existe." (compara sem maiúsculas); a tela mostra só **"Erro ao criar modalidade."** | [!] |
| 2 | Fechar o toast de erro no "×" | Toast fecha; modal continua com o texto | **O modal também fechou** e o texto digitado foi perdido | [!] |

Evidências: `005-nome-duplicado-mensagem-generica.jpg`, `005-modal-fechou-ao-fechar-toast.jpg`
**Status final:** [!] — DF-RT04-01, DF-RT04-02.

## Caso 006 — Excluir modalidade com turmas
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | … › Excluir em "Futebol" | Confirmação; aviso sobre turmas | Diálogo "Modalidades com turmas vinculadas não podem ser excluídas…"; pede o nome | [OK] |
| 2 | Digitar "Futebol" e confirmar | Bloquear | `DELETE /modalidades/4` 400; erro no diálogo "Erro ao excluir modalidade. Verifique se existem turmas vinculadas."; nada excluído | [OK] |

Evidência: `006-excluir-com-turmas-bloqueado.jpg`

## Caso 007 — Excluir modalidade sem turmas
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Excluir "Vôlei RT04" digitando o nome | Exclui | `DELETE /modalidades/8` 204; toast "Modalidade excluída."; lista com as 3 originais | [OK] |

Evidência: `007-modalidade-excluida.jpg`

## Caso 008 — Editar modalidade
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Procurar a ação de editar | Editar nome/descrição | Menu "…" só tem "Excluir"; não há edição na tela (o backend tem `PUT /modalidades/{id}`) | [B] |

Ver PD-RT04-02.

## Caso 009 — Trilha de navegação
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Modalidades | "Dashboard / Modalidades" | Só "Modalidades" | [!] |

Mesmo defeito de DF-RT03-02 (`modalidades/page.tsx:44`).

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT04-01 | Nome duplicado mostra mensagem genérica | Baixa | 005 | Corrigido (T10) |
| DF-RT04-02 | Fechar um toast fecha o modal aberto e perde o formulário | Baixa | 005 | Corrigido (T8) |

Também observado: DF-RT03-02 (trilha sem "Dashboard") no caso 009.

**DF-RT04-01 — Mensagem genérica no nome duplicado**
- Causa: `modalidades/page.tsx:74` mostra sempre "Erro ao criar modalidade." e ignora o `detail` da API ("Modalidade com este nome já existe."). Sugestão: mostrar o `detail`, de preferência no próprio campo.

**DF-RT04-02 — Fechar o toast fecha o modal**
- Passos: provocar um erro no modal › fechar o toast pelo "×".
- Esperado / Obtido: só o toast fecha / o modal fecha junto e perde o que foi digitado.
- Causa provável: os toasts ficam fora do conteúdo do diálogo; o Radix trata o clique como "interação fora" e fecha o modal. Sugestão: ignorar cliques na região de toasts em `onInteractOutside` (no componente `ui/dialog.tsx`), ou mostrar o erro dentro do modal. Afeta todos os modais com toast de erro.

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT04-01 | RT04 V1, caso 004 | Busca sem resultado oferece cadastrar | Estado vazio sem ação durante a busca | Decidir: adicionar "Cadastrar <termo>" no estado vazio ou aceitar o botão do topo |
| PD-RT04-02 | API × tela | `PUT /modalidades/{id}` existe | Não há edição na tela | Decidir se a edição entra no escopo |
| PD-RT04-03 | Exclusão | Motivo do bloqueio | Tela mostra mensagem própria e ignora o `detail` da API | Igual PD-RT02-03 |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 9 | 5 | 3 | 0 | 1 |

Parecer: **aprovado com ressalvas**. Cadastro, validação e exclusão (com bloqueio) funcionam. Ficam mensagens de erro genéricas, o modal que fecha junto com o toast e a falta de edição.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Base: Futebol, Corrida, Basquete. |
| — | Casos 001–003 OK; trilha só "Modalidades". |
| — | Caso 005: duplicado recusado com mensagem genérica; ao fechar o toast o modal fechou e perdeu o texto. |
| — | Caso 004: "Vôlei RT04" (id 8) criada; modal limpo ao reabrir. |
| — | Caso 006: exclusão de Futebol bloqueada (400), conferido o menu aberto antes. |
| — | Caso 007: "Vôlei RT04" excluída. Base de volta às 3 modalidades. RT04 encerrado. |
