# Roteiro de Teste – Competição e Edição

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT10 – Competição e edição |
| Versão | V2.0.0 (novo) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (administrador) |

## Escopo do roteiro

- **Objetivo:** comprovar a página da competição: menus, configuração da edição (validação e controle de revisão) e criação de nova edição.
- **Fora deste roteiro:** publicação (RT16), ciclo de vida iniciar/finalizar/reabrir/cancelar (RT12 e RT13), exclusão de edição e de competição (fim do RT16).
- **Massa de teste:** "Copa RT Testes" (88). Criada a edição **"2027"** (id 93, pontos corridos, 01–28/02/2027).
- **Referência:** spec seções 5.3, 5.6 e 7.5.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Menus da competição e da edição | Média | [!] |
| 002 | Configuração carregada | Alta | [OK] |
| 003 | Salvar configuração inválida | Alta | [!] |
| 004 | Salvar configuração válida | Alta | [OK] |
| 005 | Conflito de revisão (registro alterado por outro) | Alta | [OK] |
| 006 | Nova edição com identificação repetida | Alta | [!] |
| 007 | Trocar o formato ao criar edição | Média | [OK] |
| 008 | Criar nova edição | Alta | [OK] |
| 009 | Edição selecionada ao recarregar | Baixa | [!] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado.

---

## Caso 001 — Menus
Localização: Competições › Copa RT Testes · Código: `app/dashboard/competicoes/[id]/page.tsx`, `components/competicoes/organizacao/PainelEdicao.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "⋯" da competição | Editar e excluir | Só "Excluir competição" | [!] |
| 2 | "⋯" da edição | Publicar, cancelar, excluir, editar | "Publicar edição", "Cancelar edição", "Excluir edição" | [!] |

Observação: não há como editar nome/descrição da competição nem identificação, datas, categoria ou evento da edição, embora a API ofereça `PATCH /competicoes/{id}` e `PUT /edicoes/{id}` (PD-RT10-01). As abas mostram as setas de rolagem de DF-RT03-01.
Evidência: `001-menus-edicao.jpg`

## Caso 002 — Configuração carregada
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Aba Configuração | Valores gravados no cadastro | Todos iguais ao RT09 (2 grupos, 2 classificados, final única, 3º lugar, 3/1/0, limite 2, 1 jogo) | [OK] |

Evidência: `002-configuracao.jpg`

## Caso 003 — Configuração inválida
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Classificados por grupo" = 0, Salvar | Recusar indicando o campo | API 422 com `campos: ["configuracao.GRUPOS_MATA_MATA.classificados_por_grupo"]`; tela mostra só "Dados da requisicao invalidos." | [!] |

Evidência: `003-configuracao-invalida.jpg` — DF-RT09-01.

## Caso 004 — Configuração válida
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Voltar para 2 e salvar | Salva | `PUT /edicoes/92` 200; "Configuração salva com sucesso!"; revisão 1 → 2 | [OK] |

Evidência: `004-configuracao-salva.jpg`

## Caso 005 — Conflito de revisão
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Alterar a edição pela API (revisão 2 → 3), simulando outro usuário | — | 200 | [OK] |
| 2 | Salvar na tela, que ainda tem a revisão 2 | Recusar sem sobrescrever | `PUT` 409; "O registro foi alterado. Atualize os dados antes de salvar." | [OK] |

Observação: não há botão para atualizar; é preciso recarregar a página.
Evidência: `005-conflito-revisao.jpg`

## Caso 006 — Nova edição com identificação repetida
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Nova edição" › identificação "2026" › Salvar | Recusar | 1º clique sem efeito (sem requisição); 2º clique: `POST /competicoes/88/edicoes` 409 "Ja existe uma edicao com esta identificacao para esta competicao." | [!] |

Observação: mensagem correta, porém sem acentos (DF-RT10-01). O primeiro clique sem efeito não se repetiu e pode ser da automação.
Evidência: `006-nova-edicao.jpg`

## Caso 007 — Trocar o formato
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Formato "Pontos corridos" | Avisar que a configuração do formato anterior será descartada | Diálogo "Descartar configuração atual?"; após confirmar, só aparecem campos de pontos corridos (turno e returno, pontuação, disciplina) | [OK] |

Evidência: `007-trocar-formato-confirmacao.jpg`

## Caso 008 — Criar nova edição
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "2027", 01–28/02/2027, pontos corridos, Salvar | Cria e seleciona | `POST` 201; seletor "2027 · Rascunho"; cabeçalho "Pontos corridos" | [OK] |

Evidência: `008-edicao-2027-criada.jpg`

## Caso 009 — Edição selecionada ao recarregar
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Com a edição 2026 aberta, recarregar | Continuar na 2026 | Volta para a 2027 (mais recente); o endereço não guarda a edição nem a aba | [!] |

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT10-01 | Mensagens do backend de competições sem acentos | Baixa | 006 | Corrigido (T0.2, T1) |
| DF-RT10-02 | Página não guarda a edição/aba no endereço | Baixa | 009 | Corrigido (T12) |

**DF-RT10-01** — Exemplos: "Ja existe uma edicao com esta identificacao…", "Competidor ja esta inscrito…", "Dados da requisicao invalidos.". Aparecem direto para o usuário. Corrigir os textos em `app/competicoes/` (serviços e tratador de erros).

**DF-RT10-02** — Recarregar ou compartilhar o link sempre abre a edição mais recente e a Visão geral. Sugestão: `?edicao=92&aba=jogos`.

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT10-01 | Spec 5.3/7.5; API | Edição de competição, edição e evento | Sem telas de edição (só a configuração esportiva) | Decidir escopo (corrigir nome digitado errado hoje exige excluir e recriar) |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 9 | 5 | 4 | 0 | 0 |

Parecer: **aprovado com ressalvas**. Configuração, revisão e nova edição funcionam; faltam telas de edição e mensagens melhores.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Competição 88 aberta; menus conferidos. |
| — | Configuração: inválida 422, válida 200, conflito 409 (alteração simulada pela API). |
| — | Nova edição: "2026" repetida 409; "2027" pontos corridos criada (93). Troca de formato pelo teclado/JS, porque o preenchimento automático não aciona o estado do campo. |
