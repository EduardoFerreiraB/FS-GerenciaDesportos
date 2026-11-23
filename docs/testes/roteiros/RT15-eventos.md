# Roteiro de Teste – Eventos

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT15 – Eventos: identidade, edições de evento e vínculo com competições |
| Versão | V2.0.0 (novo) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 23/11/2026 — **CONCLUÍDO** |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1568×712 |
| Usuário | `Admin` / `admin123` (administrador) |

## Escopo do roteiro

- **Objetivo:** validar a lista de eventos, a criação de evento com a primeira edição numa operação, as edições de evento (identificação única dentro do evento, datas), o vínculo de edições de competição a uma edição de evento (período deve caber), a alteração de período com filhos, a edição/arquivamento da identidade e as travas de exclusão.
- **Massa:** nenhum evento existia antes. Criados: evento **"Jogos RT Testes"** (id 5, edições "2026" id 5 e "2027" id 7); evento duplicado (id 6, depois renomeado e arquivado); competição **"Copa Evento RT"** (id 89, edição 2026 ligada à edição 5 do evento). Não há exclusão de evento — esses registros ficam no banco de desenvolvimento.
- **Referência:** spec `2026-10-15-competicoes-fatias-design.md` seções 5.2, 5.3, 7.5 (exclusões) e 9 (experiência administrativa).

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Lista de eventos (vazia, busca) | Baixa | [OK] |
| 002 | Validações do novo evento | Média | [!] |
| 003 | Criar evento com a primeira edição | Alta | [!] |
| 004 | Evento com nome repetido | Média | [OK] |
| 005 | Nova edição do evento | Média | [OK] |
| 006 | Vincular competição (dentro do período) e ver o vínculo | Alta | [X] |
| 007 | Vincular competição fora do período | Alta | [OK] |
| 008 | Alterar período da edição do evento com competição vinculada | Alta | [!] |
| 009 | Editar e arquivar o evento | Média | [!] |
| 010 | Travas de exclusão (edição e evento) | Alta | [!] |

Totais: 4 [OK], 5 [!], 1 [X]. Defeitos: 8 (DF-RT15-01 a 08); 2 divergências.
Legenda: [OK] conforme; [!] funciona com ressalva; [X] falha.

---

## Caso 001 — Lista de eventos
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Eventos sem dados | Estado vazio | "Nenhum evento esportivo encontrado" + "Criar primeiro evento"; botões "Ver competições" e "Novo evento" | [OK] |
| 2 | Buscar "testes", "JOGOS", "xyz123" | Filtrar sem diferenciar maiúsculas | Encontra os eventos; termo inexistente mostra "Nenhum evento corresponde ao termo pesquisado." | [OK] |

Evidência: `001-lista-vazia.jpg`

## Caso 002 — Validações do novo evento
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Formulário | Evento + primeira edição numa operação (spec 9) | Nome*, descrição, identificação da edição* (vem preenchida "1ª Edição"), início*, término* | [OK] |
| 2 | Enviar vazio | Campos sinalizados | Validação nativa "Preencha este campo" | [OK] |
| 3 | Término (01/11) antes do início (31/12) | Erro claro no campo de data | Recusado pelo backend, mas com a mensagem genérica "Dados da requisicao invalidos." (sem acentos, sem indicar o campo); nada é criado (operação atômica) | [!] |

Evidências: `002-formulario-novo-evento.jpg`, `002-campos-obrigatorios.jpg`, `002-datas-invertidas-msg-generica.jpg`

## Caso 003 — Criar evento
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Jogos RT Testes", edição 2026, 01/11–31/12/2026 | Criado + aviso | Card "1 edição · Última edição 2026 · 01/11/2026 a 31/12/2026"; fica na lista, **sem mensagem de sucesso** | [!] |
| 2 | Abrir "Novo evento" de novo | Formulário limpo | **Reabre com todos os dados do evento anterior** (nome, descrição, edição, datas); o 2º evento herdou a descrição sem ela ter sido digitada | [X] |
| 3 | Página do evento | Edições + "Adicionar competição" | Edição 2026 "Selecionada"; botões "Adicionar edição de evento", "Adicionar competição", "Vincular competição"; nenhuma ação de editar/arquivar | [!] |

Evidências: `003-evento-criado.jpg`, `003-formulario-nao-limpo.jpg`, `003-pagina-evento.jpg`

## Caso 004 — Nome repetido
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Criar outro "Jogos RT Testes" | Recusa ou slug distinto | Criado (id 6) com slug `jogos-rt-testes-2`; nenhum aviso de nome repetido | [OK] |

## Caso 005 — Nova edição do evento
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Adicionar edição de evento" › "2026" | Recusar | "Ja existe uma edicao com esta identificacao para este evento." (sem acentos) | [OK] |
| 2 | "2027", 01/01–31/12/2027 | Criada | Criada e já selecionada | [OK] |

Evidência: `005-edicao-duplicada.jpg`

## Caso 006 — Vincular competição e ver o vínculo
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Edição 2026 › "Vincular competição" | Escolher uma edição de competição existente (ex.: Copa RT Testes 2026) | Abre **"Nova Competição"** (cria competição + 1ª edição); não há como vincular uma edição existente pela tela | [!] |
| 2 | Criar "Copa Evento RT", edição 2026, 25/11–15/12/2026 | Listada no evento | Criada (competição 89, edição ligada à edição 5 do evento, conferido na API) | [OK] |
| 3 | Card "Competições vinculadas a 2026" (também após recarregar) | Listar Copa Evento RT | **Card vazio** — só o texto sobre o período; o componente não lista competições | [X] |
| 4 | Página da Copa Evento RT | Indicar o evento | Nenhuma menção ao evento/edição de evento | [!] |

Evidências: `006-vincular-abre-nova-competicao.jpg`, `006-competicoes-vinculadas-vazio.jpg`, `006-competicao-sem-evento.jpg`

## Caso 007 — Competição fora do período
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Nova competição com edição 10–20/01/2027 na edição 2026 do evento | Recusar | "O periodo da edicao da competicao deve estar contido no periodo da edicao do evento."; nada criado | [OK] |

Evidência: `007-fora-do-periodo.jpg`

## Caso 008 — Alterar período com filhos (API — não há tela)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Procurar edição do período na tela | Editar edição do evento | Não existe ação de editar edição de evento | [!] |
| 2 | `PATCH /edicoes-evento/5` fim 30/11 (filho vai até 15/12) | Falhar sem ajustar | 409 "O novo periodo do evento nao comporta as datas das edicoes esportivas vinculadas." | [OK] |
| 3 | Renomear "2026" para "2027" | Recusar | 409 DUPLICIDADE | [OK] |
| 4 | Fim 20/12 (ainda comporta) | Aceitar | 200; período restaurado depois para 31/12 | [OK] |

## Caso 009 — Editar e arquivar (API — não há tela)
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Procurar editar/arquivar na tela | Ações disponíveis | Não existem na lista nem na página do evento | [!] |
| 2 | `PATCH /eventos/6` nome "(duplicado)", `descricao: null` | Nome e descrição alterados | Nome alterado; **descrição não é apagada** (null ignorado) | [!] |
| 3 | `PATCH` `arquivado: true` | Some da lista | Some da lista; não há como ver arquivados (nem pela tela) | [OK] |

## Caso 010 — Travas de exclusão
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Tela | Excluir com travas (spec 7.5) | Nenhuma ação de excluir evento ou edição de evento | [!] |
| 2 | `DELETE /edicoes-evento/7` (vazia) e `DELETE /eventos/6` | Permitir vazia; bloquear com filhos | 405 nos dois — exclusão não existe | [!] |

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT15-01 | Card "Competições vinculadas" não lista as competições da edição do evento | Alta | 006 | Corrigido (T1, T15) |
| DF-RT15-02 | "Vincular competição" só cria competição nova; não vincula edição existente | Média | 006 | Corrigido (T1, T15) |
| DF-RT15-03 | Página da competição não mostra o evento a que pertence | Baixa | 006 | Corrigido (T12, T15) |
| DF-RT15-04 | Formulário "Novo evento" não é limpo após criar; o próximo evento herda os dados | Média | 003 | Corrigido (T15) |
| DF-RT15-05 | Datas invertidas no novo evento: mensagem genérica sem destacar o campo | Baixa | 002 | Corrigido (T1, T15) |
| DF-RT15-06 | Criar evento/edição/competição pelo evento não mostra mensagem de sucesso | Baixa | 003, 005, 006 | Corrigido (T15) |
| DF-RT15-07 | Sem tela para editar/arquivar evento e editar período/identificação da edição de evento | Média | 008, 009 | Corrigido (T15) |
| DF-RT15-08 | `PATCH /eventos` ignora `descricao: null` (não dá para apagar a descrição) | Baixa | 009 | Corrigido (T1) |

Recorrência: DF-RT13-11 (mensagens da API sem acentos: "requisicao", "edicao", "periodo", "nao").

## Divergências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT15-01 | Spec 7.5 | Bloquear exclusão de evento com edições e de edição de evento com competições (implica exclusão quando vazio) | Não existe exclusão de evento nem de edição de evento (API 405, sem tela); só arquivamento pela API | **Decidido (23/11/2026):** implementar exclusão de evento **em cascata** — apaga as edições do evento e tudo o que estiver vinculado a ele (competições/edições vinculadas e seus dados), com fluxo de exclusão mais seguro (confirmação reforçada) e garantia de que os dados são apagados de fato. Fica para a fase de correções. |
| PD-RT15-02 | Spec 5.2 | Slug único | Nomes de evento idênticos aceitos sem aviso | **Decidido (23/11/2026):** não aceitar eventos com nomes idênticos (recusar na criação e na edição). Fica para a fase de correções. |

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Roteiro escrito; nenhum evento existente. |
| — | Eventos 5 e 6 criados (6 duplicado, depois renomeado e arquivado pela API); edição 2027 (7) criada. |
| — | Competição 89 "Copa Evento RT" criada pela página do evento (dentro do período); tentativa fora do período recusada. |
| — | Regras de período e duplicidade da edição de evento testadas pela API (sem tela). Exclusão inexistente. **RT15 concluído.** |

Estado da massa: evento 5 ativo (edições 5 e 7), evento 6 arquivado; competição 89 (edição 2026 em rascunho, ligada ao evento) — excluir junto com a 88 no fim do RT16; eventos permanecem (sem exclusão).
