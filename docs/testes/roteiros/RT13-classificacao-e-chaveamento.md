# Roteiro de Teste – Classificação e Chaveamento

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT13 – Classificação, desempates, decisão manual, chaveamento e ciclo de vida da edição |
| Versão | V2.0.0 (novo) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 23/11/2026 — **CONCLUÍDO** |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1568×712 |
| Usuário | `Admin` / `admin123` (administrador) |

## Escopo do roteiro

- **Objetivo:** validar a tabela de classificação (J, V, E, D, GP, GC, SG, PTS, aproveitamento), a ordem dos critérios de desempate, o confronto direto, a indicação de empate persistente, a decisão manual de empate e sua invalidação, a visão do chaveamento e o ciclo de vida da edição (finalizar, reabrir, cancelar).
- **Massa:** "Copa RT Testes" (88).
  - Edição **2027** (id 93): pontos corridos, turno único, 3/1/0, desempates VITÓRIAS → SALDO → GOLS PRÓ → CONFRONTO DIRETO; equipes Leões, Tigres, Águias e Falcões (cópias).
  - Edição **2026** (id 92): grupos + mata-mata concluído no RT12 (campeão Tigres, 3º Falcões).
- **Resultados planejados (edição 93):** Leões 1×1 Tigres; Águias 2×0 Falcões; Leões 1×0 Águias; Tigres 1×0 Águias; Leões 0×1 Falcões; Tigres 0×1 Falcões.
  Resultado esperado: Falcões 6 pts; Leões e Tigres 4 pts com 1 V, SG 0 e GP 2, e 1×1 no confronto direto (**empate persistente**); Águias 3 pts.
- **Referência:** spec `2026-10-15-competicoes-fatias-design.md` seções 5.6, 6.5, 7.3 e 7.5.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Critérios de desempate na configuração | Média | [!] |
| 002 | Gerar tabela de pontos corridos | Alta | [!] |
| 003 | Classificação inicial (sem jogos) | Média | [X] |
| 004 | Jogo em andamento não conta na classificação | Alta | [OK] |
| 005 | Desempate por saldo de gols | Alta | [!] |
| 006 | Empate persistente (confronto direto empatado) | Alta | [OK] |
| 007 | Resolver empate manualmente | Alta | [!] |
| 008 | Resultado alterado invalida a decisão | Alta | [!] |
| 009 | Finalizar edição (bloqueio com pendência) | Alta | [!] |
| 010 | Reabrir edição com justificativa | Média | [!] |
| 011 | Cancelar edição | Média | [!] |
| 012 | Classificação de grupos e chaveamento final (edição 92) | Média | [!] |

Totais: 2 [OK], 9 [!], 1 [X]. Defeitos: 11 novos (DF-RT13-01 a 11) + recorrências de DF-RT12-01/07/11; 2 divergências.
Legenda: [OK] conforme; [!] funciona com ressalva; [X] falha.

---

## Caso 001 — Critérios de desempate na configuração
**Pré-condição:** edição 93 em rascunho. **Localização:** aba Configuração; API `PUT /competicoes/edicoes/93`.
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Configuração | Pontuação, turno, desempates (ordem editável) e parâmetros disciplinares | Formato, turno e returno, pontuação 3/1/0, limite de amarelos e jogos por vermelho. **Não há campo para a ordem dos desempates** nem para jogos por acúmulo, jogos por 2º amarelo e zeragem (spec 5.6 e 7.4: "regras visíveis no formulário") | [X] |
| 2 | API: desempates repetidos (`VITORIAS, VITORIAS…`) | Recusar | 422 `CONFIGURACAO_INVALIDA`, campo `…desempates`; mensagem "Dados da requisicao invalidos." sem acentos | [!] |
| 3 | API: critério inexistente (`ID`) | Recusar | 422, campo `…desempates.1` | [OK] |
| 4 | API: ordem "saldo primeiro" e depois "Salvar Configuração" na tela | A tela não pode apagar o que não exibe | Ordem e disciplina preservadas (revisão 2 → 3); ordem padrão restaurada em seguida | [OK] |

## Caso 002 — Gerar tabela de pontos corridos
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Gerar Calendário / Tabela" | 6 jogos, 3 rodadas, cada par uma vez | Partidas 100–105: R1 Leões×Falcões, Tigres×Águias; R2 Águias×Leões, Falcões×Tigres; R3 Leões×Tigres, Águias×Falcões | [OK] |
| 2 | Mensagem | Sem menção a chaveamento | "Tabela de jogos **e chaveamento** gerados com sucesso!" num formato sem chaveamento | [!] |
| 3 | Cabeçalho e seletor | "Em andamento" | Cabeçalho segue "Rascunho" + botão "Gerar tabela" (DF-RT12-01); depois de trocar de aba o selo atualiza, mas o **seletor de edição continua "2027 · Rascunho"** até recarregar | [!] |
| 4 | Numeração | Única por edição | "Jogo #1, #2" reinicia a cada rodada (origem do DF-RT12-07) | [!] |

Evidência: `002-tabela-gerada-cabecalho-rascunho.jpg`

## Caso 003 — Classificação inicial
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Aba Classificação sem jogos | Zeros, sem alerta | Todas em "1º" com ícone de alerta e aviso "Empate não resolvido pelos critérios" e botão de resolver (confirma DF-RT12-11 em pontos corridos) | [X] |

Evidência: `003-classificacao-inicial-alerta-empate.jpg`

## Caso 004 — Jogo em andamento não conta
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Súmula Leões×Tigres: gol dos Leões (15'), sem finalizar | Jogo em andamento | Placar 1×0, partida em andamento | [OK] |
| 2 | Classificação (com recarregar) | Inalterada | Tudo zerado | [OK] |
| 3 | Gol dos Tigres (60') e "Finalizar Partida" | 1×1 finalizado | 1×1 FINALIZADA | [OK] |

Evidência: `004-jogo-em-andamento-nao-conta.jpg`

## Caso 005 — Desempate por saldo de gols
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Lançar Águias 2×0 Falcões, Águias 0×1 Leões, Tigres 1×0 Águias, Leões 0×1 Falcões | — | Todos salvos (conferido na API) | [OK] |
| 2 | Classificação | Tigres (4, 1V, +1) > Leões (4, 1V, 0); Águias (3, SG 0) > Falcões (3, SG −1) | Exatamente assim; aproveitamento 67/44/33/50% correto | [OK] |
| 3 | Zona de classificação | Só onde há vaga | Barra azul "Zona de classificação" em **todas** as 4 equipes num campeonato de pontos corridos sem vagas | [!] |

Evidência: `005-desempate-por-saldo.jpg`

## Caso 006 — Empate persistente
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Lançar Falcões 1×0 Tigres | Leões e Tigres iguais em tudo, confronto 1×1 | Ambos "2º" com ícone de alerta; aviso "Empate não resolvido pelos critérios"; nenhuma ordem por id | [OK] |

Evidência: `006-empate-persistente.jpg`

## Caso 007 — Resolver empate manualmente
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Resolver Empate Manualmente" | Ordem + motivo | Modal com setas para ordenar, justificativa obrigatória (mín. 3), botão desabilitado sem texto | [OK] |
| 2 | Tigres à frente, motivo "Sorteio RT13…" | Ordem aplicada | "Decisão manual de desempate registrada com sucesso!"; Tigres 2º, Leões 3º | [OK] |
| 3 | Registro | Motivo e **responsável** (spec 7.3) | Seção "Decisões manuais registradas (1)": ordem, motivo, "Válida". **Responsável não aparece** e a API não devolve o usuário; nas linhas da tabela não há indicação de que a posição veio de decisão manual | [!] |

Evidências: `007-modal-resolver-empate.jpg`, `007-modal-preenchido.png`, `007-decisao-registrada.jpg`

## Caso 008 — Resultado alterado invalida a decisão
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Reabrir Falcões×Tigres e relançar 2×0 | Decisão invalidada | "Invalidada por alteração de resultados"; Leões 2º por saldo (0 × −1) | [OK] |
| 2 | Reabrir e voltar a 1×0 | Exigir nova conferência (spec 7.3) | A decisão antiga volta a "Válida" e é reaplicada automaticamente (mesmos resultados → mesma revisão) | [!] |
| 3 | Alterar jogo que não envolve os empatados (Águias×Falcões 2×0 → 1×1) | Invalidar só a decisão afetada | Decisão invalidada mesmo sem mudança nos números de Leões e Tigres (invalidação por qualquer alteração) | [!] |

Evidências: `008-decisao-invalidada.jpg`, `008-decisao-revalidada.jpg`

## Caso 009 — Finalizar edição
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Com Águias×Falcões reaberto, "Finalizar edição" | Bloquear | "Todas as partidas obrigatórias devem estar finalizadas…" | [OK] |
| 2 | Jogo relançado, decisão inválida, "Finalizar edição" | Bloquear | Bloqueado: "Existe empate persistente não resolvido **na disputa pelo título**" — o empate é pelo 2º lugar (Falcões líder isolado com 7 pts) | [!] |
| 3 | Nova decisão (Leões à frente) e "Finalizar edição" | Confirmação, depois FINALIZADA | **Finaliza direto, sem diálogo de confirmação**; selo, seletor e botão ("Reabrir edição") atualizam | [!] |
| 4 | Reabrir jogo com edição finalizada | Ação indisponível | Botões "Reabrir Jogo" e "Agendar" continuam visíveis; o backend recusa com "A edição deve estar **EM_ANDAMENTO**…" (enum cru) | [!] |

Evidências: `009-finalizar-bloqueado-jogo-pendente.jpg`, `009-finalizar-bloqueado-empate-titulo.jpg`, `009-edicao-finalizada-sem-confirmacao.jpg`, `009-reabrir-jogo-edicao-finalizada.jpg`

## Caso 010 — Reabrir edição
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Reabrir edição" e confirmar vazio | Exigir justificativa | "Informe uma justificativa de pelo menos 3 caracteres." | [OK] |
| 2 | Justificar e confirmar | EM ANDAMENTO + aviso | Volta a "Em andamento"; **nenhuma mensagem de sucesso** | [!] |

Evidências: `010-reabrir-edicao-validacao.jpg`, `010-edicao-reaberta.jpg`

## Caso 011 — Cancelar edição
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Menu "…" › "Cancelar edição" | Justificativa | Modal "A edição deixa de valer, mas os dados são mantidos" com justificativa obrigatória e botão vermelho | [OK] |
| 2 | Confirmar | CANCELADA, registros preservados | Selo "Cancelada", jogos e placares mantidos; menu passa a oferecer só "Publicar" e "Excluir" | [OK] |
| 3 | Reabrir jogo / registrar decisão | Bloquear | Reabrir: recusado; decisão: 409 "A edição deve estar em andamento…" | [OK] |
| 4 | Agendar partida 100 (finalizada) | Bloquear (operação esportiva) | **Aceito** (`PATCH /partidas/100/agendamento` 200); agendamento desfeito em seguida | [X] |

Evidências: `011-modal-cancelar.jpg`, `011-edicao-cancelada.jpg`

## Caso 012 — Grupos e chaveamento (edição 92)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Classificação | Tabela por grupo com zona de classificados | Grupo A: Leões 3, Águias 0; Grupo B: Tigres 3, Falcões 0; legenda "Classificados para o mata-mata" | [OK] |
| 2 | Leitura das tabelas | Colunas visíveis | Em 1568 px cada tabela de grupo tem rolagem horizontal e a coluna "%" fica escondida | [!] |
| 3 | Chaveamento | Pênaltis, campeão e 3º | Verificado no RT12 (casos 008–010): (4)/(3), troféu no Tigres e Falcões 3º — após recarregar (DF-RT12-02) | [OK] |

Evidência: `012-classificacao-grupos.jpg`

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT13-01 | Configuração não exibe ordem dos desempates nem jogos por acúmulo, por 2º amarelo e zeragem | Média | 001 | Corrigido (T12) |
| DF-RT13-02 | Mensagem "Tabela de jogos e chaveamento gerados" em formato sem chaveamento | Baixa | 002 | Corrigido (T12) |
| DF-RT13-03 | "Zona de classificação" marca todas as equipes em pontos corridos | Baixa | 005 | Corrigido (T12) |
| DF-RT13-04 | Decisão manual sem responsável (API e tela) e sem marca na linha da classificação | Baixa | 007 | Corrigido (T4, T12) |
| DF-RT13-05 | "Finalizar edição" executa sem confirmação | Média | 009 | Corrigido (T12) |
| DF-RT13-06 | Bloqueio fala em "disputa pelo título" quando o empate é por outra posição | Baixa | 009 | Corrigido (T4) |
| DF-RT13-07 | Ações de jogo (Reabrir, Agendar) visíveis em edição finalizada/cancelada; erro mostra enum `EM_ANDAMENTO` | Baixa | 009, 011 | Corrigido (T2, T12) |
| DF-RT13-08 | Reabrir edição não mostra mensagem de sucesso | Baixa | 010 | Corrigido (T12) |
| DF-RT13-09 | Agendamento aceito em edição cancelada e em jogo finalizado | Média | 011 | Corrigido (T2) |
| DF-RT13-10 | Tabelas de grupo com rolagem horizontal escondendo a coluna "%" | Baixa | 012 | Corrigido (T12) |
| DF-RT13-11 | Mensagem de validação da API sem acentos ("Dados da requisicao invalidos.") | Baixa | 001 | Corrigido (T0.2) |

Recorrências: DF-RT12-01 (cabeçalho e também o **seletor de edição** desatualizados após gerar tabela), DF-RT12-07 (numeração reinicia por rodada/fase), DF-RT12-11 (alerta de empate sem jogos, também em pontos corridos).

## Divergências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT13-01 | Spec 7.3 | Resultado alterado invalida **a decisão afetada** e exige nova conferência | Invalidação por qualquer alteração na edição (mesmo sem afetar os empatados) e revalidação automática quando os resultados voltam ao estado original | Decidir: aceitar o comportamento (revisão global) e ajustar a spec, ou restringir aos jogos afetados e exigir nova conferência |
| PD-RT13-02 | Spec 5.6 | Ordem dos desempates "editável" | Editável apenas pela API | Ligado ao DF-RT13-01 |

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Roteiro escrito; execução iniciada na edição 93. |
| — | Configuração conferida (sem editor de desempates); validação da API testada; ordem padrão restaurada. |
| — | Tabela gerada (partidas 100–105); jogo em andamento não conta; desempate por saldo correto; empate persistente Leões×Tigres. |
| — | Decisão #1 registrada, invalidada (2×0), revalidada (1×0) e invalidada de novo (Águias×Falcões 1×1); decisão #2 (Leões à frente). |
| — | Edição 93 finalizada, reaberta e **cancelada**. Agendamento indevido na partida 100 desfeito. Edição 92 conferida e mantida EM ANDAMENTO para o RT14. **RT13 concluído.** |

Estado da massa: edição 93 CANCELADA (F 7, L 4, T 4, A 1; decisão #2 Leões à frente); edição 92 EM ANDAMENTO, mata-mata concluído, suspensão do Bruno ativa (0/1).
