# Roteiro de Teste – Jogos e Súmula

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT12 – Jogos e súmula |
| Versão | V2.0.0 (novo) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 (casos 001–004) e 23/11/2026 (casos 005–011) — **CONCLUÍDO** |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (administrador) |

## Escopo do roteiro

- **Objetivo:** gerar tabela, agendar, lançar resultado simples, súmula detalhada (gols com autor, gol contra, cartões, 2º amarelo), encerrar fase de grupos, mata-mata com pênaltis, final e 3º lugar, reabertura com travas.
- **Massa:** edição 2026 (id 92) da "Copa RT Testes": Grupo A = Leões RT (145) × Águias RT (147), jogo #1 = partida 94; Grupo B = Tigres RT (146) × Falcões RT (148), jogo #2. Duelos: semifinais 1 e 2, final (3), 3º lugar (4).
- **Referência:** spec seções 6.2–6.5, 7.1–7.2 e 7.5.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Botão "Gerar tabela" do cabeçalho | Baixa | [OK] |
| 002 | Gerar tabela (grupos + mata-mata) | Alta | [!] |
| 003 | Chaveamento eliminatório | Alta | [!] |
| 004 | Agendar partida | Média | [!] |
| 005 | Lançar placar simples | Alta | [!] |
| 006 | Súmula detalhada: gols, gol contra, cartões, 2º amarelo | Alta | [OK] |
| 007 | Encerrar fase de grupos | Alta | [!] |
| 008 | Semifinal com pênaltis | Alta | [OK] |
| 009 | Final e 3º lugar | Alta | [!] |
| 010 | Reabrir partida com descendente iniciado (trava) | Alta | [OK] |
| 011 | Filtros de jogos | Baixa | [!] |

Totais: 4 [OK], 7 [!]. Defeitos: 14 (DF-RT12-01 a 14), 3 divergências.
Legenda: [OK] conforme; [!] funciona com ressalva; [X] falha.

---

## Caso 001 — Botão do cabeçalho
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Gerar tabela" no topo da edição | Ir para a geração | Abre a aba Jogos com "Tabela de jogos não gerada" e o botão "Gerar Calendário / Tabela" | [OK] |

Evidência: `001-gerar-tabela-botao-topo.jpg`

## Caso 002 — Gerar tabela
Código: `components/competicoes/disputa/VisualizadorPartidas.tsx`, backend `app/competicoes/servicos/disputa.py:131`
| # | Procedimento | Esperado (spec 6.4/7.5) | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Gerar Calendário / Tabela" | Gera grupos e jogos; permite conferir/ajustar grupos e cruzamento antes de iniciar; edição continua em rascunho | `POST /gerar-tabela` 201; Grupo A (Leões, Águias), Grupo B (Tigres, Falcões); 2 jogos com "Data e local a definir"; **a edição passa direto para EM_ANDAMENTO** (`disputa.py:384`); não há tela de ajuste de grupos | [!] |
| 2 | Ver o cabeçalho | Estado atualizado | Selo da aba Jogos diz "Em andamento", mas o cabeçalho da edição continua "Rascunho" até recarregar | [!] |
| 3 | Escudos | Usar a sigla da equipe | Mostram iniciais ("LR", "ÁR") em vez de LEO/AGU | [!] |

Evidência: `002-tabela-gerada-cabecalho-rascunho.jpg`

## Caso 003 — Chaveamento
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Logo após gerar | Chaveamento com semifinais, final e 3º lugar | "Chaveamento eliminatório indisponível — não há duelos" (o componente só carrega ao abrir a aba; não recarrega após gerar) | [X] |
| 2 | Recarregar a página | — | Semifinal 1 e 2, Final e Disputa de 3º lugar aparecem | [OK] |
| 3 | Ver as vagas da semifinal | Cruzamento visível (1ºA × 2ºB, 1ºB × 2ºA) | "1º do grupo" × "2º do grupo", sem a letra; a API devolve `nome_grupo: null` | [X] |

Evidência: `003-chaveamento-sem-letra-do-grupo.jpg`

## Caso 004 — Agendar partida
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Jogo #1 › Agendar | Data, horário, local, campo | Modal com esses campos (sem árbitro) | [OK] |
| 2 | Data 10/01/2027 (edição vai até 20/12/2026) | Recusar ou avisar | **Aceito** (`PATCH /partidas/94/agendamento` 200) | [!] |
| 3 | Mensagem | "Jogo #1" | "Agendamento do jogo **#94** salvo com sucesso!" (id interno) | [!] |
| 4 | Corrigir para 24/11/2026 10:00, Ginásio RT · Quadra 1 | Salvo | Cartão mostra "24/11/2026 · 10:00 · Ginásio RT · Quadra 1"; existe "Limpar Agendamento" | [OK] |

Evidências: `004-agendar-partida.jpg`, `004-agendamento-fora-do-periodo-aceito.jpg`

## Caso 005 — Lançar placar simples (Jogo #1, Leões × Águias)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Lançar Placar" no Jogo #1 | Modal com placar | Modal "Lançar Placar Simples" com placar, "Decisão por pênaltis" e "W.O." | [OK] |
| 2 | Marcar pênaltis num jogo de **grupo** (0×0, pênaltis 4×3) e confirmar | Opção nem deveria aparecer em jogo de grupo | A opção aparece; o backend recusa com "Pênaltis só são permitidos em confrontos eliminatórios." | [!] |
| 3 | Desmarcar pênaltis e lançar 2×1 | Placar salvo | Mensagem de erro anterior **continua no modal** até salvar; ao confirmar: "Placar do jogo **#94** registrado com sucesso!"; cartão "Finalizada", 2×1, botão vira "Reabrir Jogo" | [!] |
| 4 | Aba Classificação | Grupo A atualizado | Leões 3 pts, 1J 1V, 2 GP, 1 GC, SG +1; Águias 0 pts, SG −1 | [OK] |
| 5 | Grupo B (nenhum jogo disputado) | Sem alerta | Aviso "Empate não resolvido pelos critérios" e ícone de alerta em Tigres/Falcões com 0 jogos (some depois que o jogo #2 é disputado) | [!] |

Evidências: `005-penaltis-em-jogo-de-grupo-recusado.jpg`, `005-placar-lancado.jpg`, `005-classificacao-apos-placar.jpg`

## Caso 006 — Súmula detalhada (Jogo #2, Tigres × Falcões)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Súmula" no Jogo #2 | Súmula do jogo | Título "Súmula Detalhada do Jogo **#95**" (id interno, mesmo problema do DF-RT12-05); tipos: gol, gol contra, amarelo, vermelho direto; atleta opcional | [!] |
| 2 | Gol Tigres, #9 Beta, 10' 1º T | Placar 1×0, jogo inicia | 1×0; jogo vai para "Em andamento"/"Ao vivo" | [OK] |
| 3 | Gol contra, #11 Falcão (Falcões), 20' | Conta para os Tigres | 2×0; aparece na coluna dos Tigres como "Gol contra #11 Falcão" | [OK] |
| 4 | Gol Falcões sem autoria, 30' 2º T | Placar 2×1, autoria pendente | 2×1; "Sem autoria definida" com botão "Identificar Autor" | [OK] |
| 5 | Amarelos para #5 Bruno aos 35' e 40' | Expulsão automática | Gerada "Expulsão (segundo amarelo)" aos 40' — "Expulsão automática por 2º cartão amarelo" | [OK] |
| 6 | 3º amarelo para Bruno (42') | Recusar | "Integrante já recebeu dois cartões amarelos nesta partida." | [OK] |
| 7 | Minuto −5 | Recusar | Validação nativa do campo (mín. 0, máx. 150) bloqueia o envio | [OK] |
| 8 | "Finalizar Partida" | Placar consolidado, lançamentos bloqueados | "Partida finalizada; novos lançamentos estão bloqueados…"; ainda é possível ajustar autoria (permitido pela spec 7.6) | [OK] |
| 9 | Classificação e Disciplina | Grupo B e suspensão | Tigres 3 pts (2×1), alerta de empate some; Disciplina: Bruno suspenso 1 jogo, origem "Segundo amarelo"; Artilharia conta Beta (gol contra e gol sem autor não contam) | [OK] |

Evidências: `006-sumula-ocorrencias-expulsao.jpg`, `006-sumula-finalizada.jpg`, `006-classificacao-grupos.jpg`, `006-suspensao-automatica.jpg`

## Caso 007 — Encerrar fase de grupos
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Encerrar Fase de Grupos" | Confirmação | Diálogo explica consolidação e exige jogos finalizados | [OK] |
| 2 | Confirmar | Semifinais 1ºA×2ºB e 1ºB×2ºA | "Fase de grupos encerrada!"; Semifinal: Leões × Falcões e Tigres × Águias (cruzamento correto) | [OK] |
| 3 | Numeração dos jogos | Números distintos | **As duas semifinais aparecem como "Jogo #1"** (depois final e 3º lugar também "Jogo #1") | [X] |
| 4 | Chaveamento | Mostrar as equipes | Continua "1º do grupo / 2º do grupo" até clicar em atualizar (DF-RT12-02); após atualizar mostra as equipes com sigla (LEO, FAL…) — os cartões de jogo seguem com iniciais (DF-RT12-06) | [!] |
| 5 | Clicar de novo em "Encerrar Fase de Grupos" | Botão oculto ou recusa | Botão continua visível; repetir mostra "Fase de grupos encerrada!" de novo; API `POST /encerrar-grupos` devolve 200 e não duplica jogos (idempotente) | [!] |

Evidências: `007-semifinais-criadas-jogo1-duplicado.jpg`, `007-chaveamento-nao-atualizado.jpg`, `007-chaveamento-apos-atualizar.jpg`

## Caso 008 — Semifinais com pênaltis
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Semifinal 1: 1×1 sem pênaltis | Recusar | "Confronto eliminatório empatado exige definição de pênaltis." | [OK] |
| 2 | Pênaltis 3×3 | Recusar | "A disputa por pênaltis não pode terminar empatada." | [OK] |
| 3 | Pênaltis 4×3 | Leões avançam | Finalizada 1×1 "Pênaltis 4 × 3"; chaveamento mostra (4)/(3) e troféu nos Leões | [OK] |
| 4 | Semifinal 2 pela súmula; Bruno (suspenso) marca | Alerta, sem bloqueio (spec 7.4: "alerta persistente, não bloqueio") | Súmula mostra "Alerta Disciplinar: Atletas com Suspensão Ativa… não bloqueia"; gol aceito; finalizada 1×0 | [OK] |
| 5 | Suspensão após o jogo | Cumprimento explícito (spec 7.6) | Disciplina continua "0 / 1 jogos — Ativa" — conforme spec; cumprimento será testado no RT14 | [OK] |
| 6 | Final e 3º lugar | Criados | Final Leões × Tigres (partida 98) e 3º Falcões × Águias (99) | [OK] |

Evidências: `008-empate-sem-penaltis-recusado.jpg`, `008-semifinal-penaltis.jpg`, `008-suspensao-nao-cumprida-auto.jpg`

## Caso 009 — Final e 3º lugar
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Final 0×2, 3º lugar 3×2 | Salvos | "Placar do jogo #98/#99 registrado com sucesso!" | [OK] |
| 2 | Chaveamento | Final e 3º resolvidos | Continua "Definido" com "–" até clicar em atualizar; depois: Tigres campeão (troféu), Falcões 3º | [!] |
| 3 | Ordem das seções | Semifinal, 3º lugar, Final (ou Final antes) | Lista: Semifinal → Disputa de 3º lugar → Final (aceitável) | [OK] |
| 4 | Visão geral | 6/6 jogos, sem pendências | "6/6 · 100% concluído", "Nenhuma pendência"; "Líder da classificação: Leões RT" (não mostra campeão — PD-RT12-02); "Artilheiro: Beta 1 gol" — Bruno também tem 1 gol e não aparece empate | [!] |

Evidências: `009-chaveamento-sem-placar-final.jpg`, `009-chaveamento-final-resolvido.jpg`, `009-visao-geral-concluida.jpg`

## Caso 010 — Reabertura com trava
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Reabrir Jogo" na Semifinal 1 | Pede justificativa | Modal "Reabrir Jogo **#96**" com justificativa obrigatória (mín. 3), aviso de auditoria e de reset de descendentes | [OK] |
| 2 | Confirmar (final já disputada) | Bloquear | "Não foi possível concluir — Confronto eliminatório subsequente já foi iniciado ou possui ocorrências registradas." | [OK] |
| 3 | Reabrir a Final (sem descendente) | Permitir | Partida 98 volta a EM_ANDAMENTO; página **rola para o topo** após confirmar | [OK] |
| 4 | Relançar 1×2 | Finalizada | Partida 98 FINALIZADA com 1×2 | [OK] |

Evidências: `010-reabrir-semifinal-bloqueado.jpg`, `010-reabrir-final-volta-ao-topo.jpg`

## Caso 011 — Filtros de jogos
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Opções | Rodada/fase, grupo, situação | Rodada: só "Rodada 1" (**sem Semifinal/Final/3º lugar**); Grupo: A, B; Situação: Agendadas, Em andamento, Finalizadas, Canceladas | [!] |
| 2 | Grupo A | 1 jogo | 1 jogo | [OK] |
| 3 | Finalizadas | 6 jogos | 6 jogos | [OK] |
| 4 | Agendadas (nenhuma) | Estado vazio | "Nenhuma partida encontrada para os filtros selecionados." + "Redefinir filtros"; aparece "Limpar filtros" | [OK] |
| 5 | Rodada 1 | 2 jogos | 2 jogos | [OK] |

Evidência: `011-filtro-sem-resultado.jpg`

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT12-01 | Cabeçalho continua "Rascunho" após gerar a tabela | Baixa | 002 | Corrigido (T11) |
| DF-RT12-02 | Chaveamento não recarrega após gerar a tabela | Média | 003 | Corrigido (T11) |
| DF-RT12-03 | Vagas do chaveamento sem a letra do grupo | Média | 003 | Corrigido (T3, T11) |
| DF-RT12-04 | Agendamento aceita data fora do período da edição | Baixa | 004 | Corrigido (T2) |
| DF-RT12-05 | Mensagem de agendamento usa o id interno ("jogo #94") | Baixa | 004 | Corrigido (T0.2, T11) |
| DF-RT12-06 | Escudos usam iniciais em vez da sigla cadastrada | Baixa | 002 | Corrigido (T11) |
| DF-RT12-07 | Jogos do mata-mata numerados todos como "Jogo #1" (semifinais, final, 3º lugar) | Média | 007 | Corrigido (T0.2, T11) |
| DF-RT12-08 | Mensagem de erro anterior permanece no modal após corrigir os dados | Baixa | 005, 006 | Corrigido (T11) |
| DF-RT12-09 | Opção "Decisão por pênaltis" aparece em jogo de grupo (backend recusa) | Baixa | 005 | Corrigido (T11) |
| DF-RT12-10 | "Encerrar Fase de Grupos" continua visível após encerrar; repetir mostra sucesso de novo | Baixa | 007 | Corrigido (T11) |
| DF-RT12-11 | Classificação mostra "Empate não resolvido" em grupo sem jogos disputados | Baixa | 005 | Corrigido (T4) |
| DF-RT12-12 | Filtro "Rodada" não oferece as fases eliminatórias | Baixa | 011 | Corrigido (T11) |
| DF-RT12-13 | Card "Artilheiro" mostra só um atleta quando há empate | Baixa | 009 | Corrigido (T4, T12) |
| DF-RT12-14 | Após reabrir jogo a página volta ao topo | Baixa | 010 | Corrigido (T11) |

Observações de abrangência:
- DF-RT12-02 também ocorre após encerrar grupos (007) e após lançar placar da final/3º (009): o chaveamento só atualiza com o botão de recarregar.
- DF-RT12-05 também ocorre em: mensagens de placar ("jogo #94/#96/#98/#99"), título da súmula ("Jogo #95/#97") e do modal de reabertura ("Jogo #96/#98").

## Divergências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT12-01 | Spec 6.4 e 7.5 | Gerar tabela em rascunho; conferir e ajustar grupos/cruzamento; "Iniciar edição" separado | Gerar já inicia a edição; sem ajuste manual de grupos; "Iniciar" não aparece na tela | Decidir: atualizar a spec ou o sistema |
| PD-RT12-02 | — | Visão geral destacar o resultado final | Com a final disputada, a Visão geral segue mostrando "Líder da classificação: Leões RT" (líder do grupo A), sem campeão | Avaliar mostrar campeão/pódio ao concluir o mata-mata |
| PD-RT12-03 | — | — | "Agendar" continua disponível em jogo finalizado | Avaliar se deve ficar oculto ou apenas registrar data/local |

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Tabela gerada na edição 92 (estado foi para EM_ANDAMENTO). |
| — | Chaveamento só apareceu após recarregar. Jogo #1 agendado (data fora do período aceita, depois corrigida). |
| pausa | **Pausado por limite de uso.** Próximo: caso 005 (lançar placar do Jogo #1). |
| 23/11 | Retomado. Jogo #1 2×1 (pênaltis em jogo de grupo recusados). |
| — | Súmula do jogo #2: gol, gol contra, gol sem autor, 2 amarelos → expulsão; finalizado 2×1; Bruno suspenso 1 jogo. |
| — | Fase de grupos encerrada; semifinais Leões×Falcões (1×1, pên. 4×3) e Tigres×Águias (1×0, gol do Bruno suspenso — alerta sem bloqueio). |
| — | Final Leões 0×2 Tigres; 3º Falcões 3×2 Águias. Reabrir semifinal bloqueado; final reaberta e relançada 1×2. Filtros conferidos. **RT12 concluído.** |

Estado da massa ao final: edição 92 EM_ANDAMENTO, 6/6 jogos finalizados (campeão Tigres, 3º Falcões); suspensão do Bruno ativa (0/1) para o RT14.
