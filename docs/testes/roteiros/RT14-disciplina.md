# Roteiro de Teste – Disciplina

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT14 – Disciplina: cartões, suspensões automáticas e manuais, cumprimento e revisão |
| Versão | V2.0.0 (novo) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 23/11/2026 — **CONCLUÍDO** |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1568×712 |
| Usuário | `Admin` / `admin123` (administrador) |

## Escopo do roteiro

- **Objetivo:** validar o painel de disciplina (suspensões, cartões, artilharia), o cumprimento explícito de suspensão e suas regras, a suspensão manual, o ajuste/revisão, as sanções automáticas (vermelho direto, 2º amarelo, acúmulo), a idempotência ao reprocessar súmula, a derivação ao remover o cartão de origem e a revisão obrigatória quando a correção afeta punição já cumprida.
- **Massa:**
  - Edição **2026** (id 92, limite de 2 amarelos): Bruno (Tigres) suspenso 1 jogo por 2º amarelo na partida 95 (Grupo B); Tigres jogou depois a semifinal 97 e a final 98.
  - Edição de apoio **2028** (id 94, criada pela API neste roteiro; partidas 106–111): pontos corridos, turno único, limite de 2 amarelos, equipes copiadas da 2026.
- **Referência:** spec `2026-10-15-competicoes-fatias-design.md` seções 7.2 (motivo obrigatório em correções) e 7.4.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Painel de disciplina (suspensões, cartões, artilharia) | Média | [!] |
| 002 | Registrar cumprimento — regras da partida | Alta | [!] |
| 003 | Uma partida cumpre no máximo uma unidade por atleta | Alta | [OK] |
| 004 | Suspensão manual | Média | [OK] |
| 005 | Ajustar / revisar suspensão | Média | [!] |
| 006 | Vermelho direto gera suspensão | Alta | [OK] |
| 007 | Reprocessar súmula não duplica punição | Alta | [!] |
| 008 | Remover cartão de origem desfaz a expulsão derivada | Alta | [!] |
| 009 | Acúmulo de amarelos (amarelos da expulsão não contam) | Alta | [OK] |
| 010 | Correção após punição cumprida exige revisão | Alta | [OK] |

Totais: 5 [OK], 5 [!]. Defeitos: 8 (DF-RT14-01 a 08); 1 divergência.
Legenda: [OK] conforme; [!] funciona com ressalva; [X] falha.

---

## Caso 001 — Painel de disciplina (edição 92)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Aba Disciplina › Suspensões | Bruno, 2º amarelo, 0/1, Ativa | Exato; contadores "Ativas: 1 · Total: 1" | [OK] |
| 2 | Cartões | Amarelos da expulsão fora do acúmulo | Bruno: 2 amarelos, saldo p/ acúmulo **0**, 2º amarelo 1, "Suspenso"; aviso explicando a regra | [OK] |
| 3 | Artilharia | Gols com autoria; empate tratado como empate | Beta 1 e Bruno 1 (gol contra e gols sem autor fora); mas aparecem como **1º e 2º** com o mesmo número de gols | [!] |

Evidências: `001-suspensoes.jpg`, `001-cartoes.jpg`, `001-artilharia-empate-posicoes.jpg`

## Caso 002 — Registrar cumprimento
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "…" › Cumprir | Lista de partidas válidas | Modal com atleta, motivo, progresso; opções aparecem como "**Jogo undefined**: Tigres RT × Águias RT · Finalizada"; lista inclui a própria partida de origem, partidas de outras equipes e (na 2028) partidas ainda agendadas | [!] |
| 2 | Partida 95 (origem) | Recusar | "A suspensão só pode ser cumprida em partida posterior à sua origem." | [OK] |
| 3 | Partida 96 (outra equipe) | Recusar | "A partida informada não envolve a equipe do integrante suspenso." | [OK] |
| 4 | Partida 97 (Bruno marcou gol nela) | Recusar (ele jogou) | "O integrante possui ocorrência registrada nesta partida; exija revisão ou ajuste disciplinar manual." | [OK] |
| 5 | Partida 98 (final, sem ocorrência do Bruno) | Aceitar | "Cumprida", 1/1, Ativas 0 — **sem mensagem de sucesso** | [!] |

Evidências: `002-cumprir-jogo-undefined.jpg`, `002-suspensao-cumprida.jpg`

## Caso 003 — Uma unidade por partida
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Suspensão manual do Bruno (caso 004) › Cumprir com a partida 98 | Recusar | "Uma partida cumpre no máximo uma suspensão por integrante." | [OK] |

Evidência: `003-uma-partida-por-integrante.jpg`

## Caso 004 — Suspensão manual
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Nova suspensão manual" vazio | Bloquear | "Criar suspensão" desabilitado até escolher atleta e motivo (mín. 3) | [OK] |
| 2 | 0 jogos | Recusar | Validação nativa do campo (mín. 1) impede o envio | [OK] |
| 3 | Bruno, 1 jogo, motivo | Criada | Origem "Manual", 0/1, "Ativa" | [OK] |

Evidência: `004-nova-suspensao-manual.jpg`

## Caso 005 — Ajustar / revisar
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Ajustar" sem justificativa | Bloquear | "Salvar ajuste" desabilitado; "Mínimo de 3 caracteres" | [OK] |
| 2 | Situação "Em revisão" + justificativa | Salvo | Linha destacada "Em revisão" e aviso "Suspensões em revisão administrativa"; menu passa a "Revisar" | [OK] |
| 3 | Situação "Cumprida" com 0/1 jogos | Exigir partida (cumprimento explícito, spec 7.4) | **Aceito**: "Cumprida" com 0 / 1 jogos e nenhum cumprimento | [!] |
| 4 | Situação "Cancelada" | Salvo | "Cancelada" | [OK] |
| 5 | Histórico | Responsável e justificativas consultáveis | A tela não mostra histórico nem responsável; a API (`/disciplinar`) não devolve responsável da suspensão nem do cumprimento, nem as justificativas de ajuste | [!] |

Evidência: `005-suspensao-cancelada.jpg`

## Caso 006 — Vermelho direto
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Reabrir final 98; vermelho direto para Atleta Alfa (70'); finalizar | Suspensão de 1 jogo | #38 "Vermelho direto" 0/1 Ativa, chave `ED92:INT175:VERM_DIR:OC149`; cartões: 1 vermelho, "Suspenso" | [OK] |

## Caso 007 — Reprocessar não duplica
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Reabrir e finalizar de novo sem mudanças | Uma única punição | Uma única **ativa** (sem duplicar), mas a reabertura cancela a anterior (#38, perde a chave) e a finalização cria outra (#39); cada ciclo deixa mais uma linha "Cancelada" do mesmo cartão na lista | [!] |

Evidência: `007-copias-canceladas.jpg`

## Caso 008 — Remover cartão de origem
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Final reaberta: 2 amarelos para "Goleiro RT Teste" | Expulsão derivada | "Expulsão (segundo amarelo)" gerada | [OK] |
| 2 | "Remover" no 1º amarelo | Pedir confirmação e motivo (spec 7.2) | Remove **na hora, sem confirmação e sem motivo**; amarelo e expulsão derivada somem (7 → 5 ocorrências) | [!] |
| 3 | Finalizar | Sem punição para o goleiro | Nenhuma suspensão nem cartão para ele | [OK] |
| 4 | Observação | — | Gols do placar simples aparecem na súmula com minuto **"0'"** | [!] |

Evidências: `008-expulsao-derivada.jpg`, `008-removido-sem-confirmacao.jpg`

## Caso 009 — Acúmulo (edição 2028)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Jogo 107: Bruno 2 amarelos (expulsão), Beta 1 amarelo + gol | Expulsão do Bruno | #41 Bruno "Segundo amarelo" | [OK] |
| 2 | Jogo 109: 1 amarelo para cada | Beta suspenso por acúmulo; Bruno não | #42 Beta "Acúmulo de amarelos" 0/1; Bruno: 3 amarelos estatísticos, **1** no saldo de acúmulo, sem nova suspensão; alerta do Bruno suspenso aparece na súmula do jogo 109 | [OK] |

Evidências: `009-suspensoes-acumulo.jpg`, `009-cartoes-acumulo.jpg`

## Caso 010 — Correção após cumprimento
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Jogo 110 finalizado 0×0; cumprir #42 com ele | Cumprida | 1/1 "Cumprida" | [OK] |
| 2 | Reabrir 109 e remover o amarelo do Beta | Não apagar histórico; exigir revisão | #42 vai para "Em revisão" mantendo 1/1; aviso de revisão administrativa | [OK] |
| 3 | "Revisar" › Cancelada + justificativa | Resolvida | "Cancelada" com o cumprimento preservado; saldo do Beta volta a 1 | [OK] |

Evidências: `010-amarelo-origem-removido.jpg`, `010-suspensao-em-revisao.jpg`

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT14-01 | Partidas no modal de cumprimento aparecem como "Jogo undefined" | Média | 002 | Corrigido (T0.2, T13) |
| DF-RT14-02 | Modal de cumprimento oferece partidas inelegíveis (origem, outras equipes, agendadas) | Baixa | 002 | Corrigido (T5, T13) |
| DF-RT14-03 | Cumprir e ajustar suspensão não mostram mensagem de sucesso | Baixa | 002, 005 | Corrigido (T13) |
| DF-RT14-04 | Artilharia dá posições diferentes para atletas com o mesmo número de gols | Baixa | 001 | Corrigido (T4, T13) |
| DF-RT14-05 | Responsável e justificativas de ajuste da suspensão/cumprimento não aparecem (tela nem API) | Média | 005 | Corrigido (T5, T13) |
| DF-RT14-06 | Reabrir/finalizar de novo deixa cópias "Canceladas" da mesma punição na lista | Baixa | 007 | Corrigido (T5, T13) |
| DF-RT14-07 | Remover ocorrência sem confirmação e sem motivo (inclusive em partida reaberta) | Média | 008, 010 | Corrigido (T5, T11) |
| DF-RT14-08 | Gols do placar simples exibidos com minuto "0'" na súmula | Baixa | 008 | Corrigido (T11) |

Recorrências: DF-RT12-05 (títulos "Súmula Detalhada do Jogo #98/#107/#109"); PD-RT11-02 (cópia de elenco reativou o "Teste", inativo na edição 92).

## Divergências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT14-01 | Spec 7.4 | Cumprimento explícito, vinculado a partida posterior da equipe | O ajuste manual permite marcar "Cumprida" sem nenhuma partida (0/1) | Decidir se o ajuste administrativo pode encerrar a punição sem cumprimento (e, se sim, rotular como "encerrada por ajuste") |

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Roteiro escrito. |
| — | Edição 92: cumprimento do Bruno (recusas 95/96/97; aceito na 98); suspensão manual #37 criada, em revisão, "cumprida" sem partida e cancelada. |
| — | Final 98 reaberta 3 vezes: vermelho direto (Atleta Alfa, #40 ativa; #38/#39 canceladas), amarelos do goleiro adicionados e removidos. |
| — | Edição 2028 (id 94) criada pela API, equipes copiadas da 92, tabela gerada; jogos 107, 109 e 110 finalizados; acúmulo e revisão testados. **RT14 concluído.** |

Estado da massa: edição 92 EM ANDAMENTO (final 1×2 com vermelho do Atleta Alfa — suspensão #40 ativa); edição 94 (2028) EM ANDAMENTO com 3 jogos finalizados e 3 agendados — pode ser excluída junto com a competição 88 no fim do RT16.
