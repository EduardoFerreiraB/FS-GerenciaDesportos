# Roteiro de Teste – Portal Público

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT16 – Portal público: publicação, acesso, conteúdo, privacidade e falhas |
| Versão | V2.0.0 (novo) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 23/11/2026 — **CONCLUÍDO** |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1568×712 |
| Usuário | `Admin` / `admin123` para publicar; portal e API pública acessados sem credencial |

## Escopo do roteiro

- **Objetivo:** validar publicação/despublicação independente do estado, 404 para edição privada, conteúdo do portal (jogos, classificação, chaveamento, artilharia), allowlist de campos, histórico de edições, portal de evento e tratamento de falha.
- **Massa:** "Copa RT Testes" (88): edições 2026 (92, em andamento, mata-mata concluído), 2027 (93, cancelada), 2028 (94, em andamento). "Copa Evento RT" (89, edição 2026 em rascunho, ligada ao evento "Jogos RT Testes" — slug `jogos-rt-testes`, edições 2026 e 2027). Antes do roteiro nada estava publicado.
- **Referência:** spec `2026-10-15-competicoes-fatias-design.md` seção 8.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Portal sem nada publicado | Média | [OK] |
| 002 | Acesso direto a edição não publicada (404) | Alta | [OK] |
| 003 | Publicar edição em andamento | Alta | [OK] |
| 004 | Página pública da competição e da edição | Alta | [!] |
| 005 | Allowlist de campos (privacidade) | Alta | [OK] |
| 006 | Histórico: duas edições navegáveis sem misturar | Média | [OK] |
| 007 | Publicar rascunho e portal do evento | Média | [!] |
| 008 | Despublicar | Alta | [OK] |
| 009 | Falha de carregamento com retentativa | Alta | [OK] |
| 010 | Rotas legadas e endereços inexistentes | Baixa | [!] |

Totais: 7 [OK], 3 [!]. Defeitos: 6 (DF-RT16-01 a 06) + recorrências.
Legenda: [OK] conforme; [!] funciona com ressalva; [X] falha.

---

## Caso 001 — Portal sem publicação
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir `/` | Estado vazio | "Competições" com busca; "Nenhuma competição publicada no momento." e "Nenhum evento com competição publicada no momento."; API `/competicoes/publico/competicoes` e `/eventos` devolvem `[]` | [OK] |

Evidência: `001-portal-vazio.jpg`

## Caso 002 — Edição não publicada
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | `/publico/competicao/copa-rt-testes` | 404 amigável | "Não encontrado — Este conteúdo não existe ou não está publicado." (sem link de volta ao portal) | [OK] |
| 2 | API `/publico/edicoes/92`, `/competicoes/copa-rt-testes`, `/eventos/jogos-rt-testes` | 404, não 403 | 404 `NAO_ENCONTRADO` nos três ("Evento nao encontrada." — gênero e acento) | [OK] |

Evidência: `002-nao-encontrado.jpg`

## Caso 003 — Publicar edição em andamento
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Edição 92 › "…" › Publicar edição | Publicada sem mudar o estado | Selos "Em andamento" + "Publicada"; menu passa a "Despublicar edição" | [OK] |

Evidência: `003-publicada-em-andamento.jpg`

## Caso 004 — Páginas públicas
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Home | Competição listada | Seção "Em andamento" com o card "Copa RT Testes · 2026 · Sub-13 · Grupos + mata-mata"; o card diz "**Rodada 1 de 1**" com o mata-mata já concluído | [!] |
| 2 | `/publico/competicao/copa-rt-testes` | Edições publicadas | Só a 2026 | [OK] |
| 3 | `/publico/edicao/92` › Jogos | Placares, pênaltis, "a definir" | Tudo correto ("Pênaltis 4 × 3", "Data e local a definir"); ordem: Semifinal → Final → Disputa de 3º → Rodada 1 (grupos por último, 3º depois da final) | [!] |
| 4 | Classificação | Por grupo | Correta; tabelas com rolagem horizontal escondendo colunas (DF-RT13-10) | [!] |
| 5 | Chaveamento | Placar, pênaltis, campeão | Troféus corretos (Tigres campeão, Falcões 3º), mas **todos os placares aparecem "–"**: a API pública do chaveamento não traz placar | [X] |
| 6 | Artilharia | Ranking | Beta "1º" e Bruno "2º" com 1 gol cada (DF-RT14-04) | [!] |
| 7 | Equipes | Elenco público | Nome esportivo, camisa e posição; integrante inativo ("Teste") não aparece | [OK] |

Evidências: `004-home-com-competicao.jpg`, `004-jogos-ordem.jpg`, `004-classificacao.jpg`, `004-chaveamento-sem-placar.jpg`, `004-artilharia.jpg`, `004-equipes.jpg`

## Caso 005 — Allowlist
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Campos de `/publico/competicoes`, `/competicoes/{slug}`, `/edicoes/92` e `/partidas`, `/classificacao`, `/chaveamento`, `/artilharia` (sem credencial) | Só campos públicos | Nenhum de: documento, nascimento, contato, escola, motivo de sanção, auditoria, configuração, revisão, usuário, id de integrante/competidor | [OK] |
| 2 | Integrante | `nome_esportivo`, camisa, posição | Exatamente esses três campos | [OK] |
| 3 | Observação | — | Vaga mostra "1º do Grupo A" (o admin não mostra a letra — DF-RT12-03) e "Vencedor de **SEMIFINAL** 1" (enum em caixa alta) | [!] |

## Caso 006 — Histórico
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Publicar 2028 (94) | Duas edições na competição | Página da competição lista 2028 e 2026; a 2027 (cancelada, privada) não aparece | [OK] |
| 2 | Abrir 2028 | Dados só dela | Jogos 106–111 (3 finalizados, 3 "a definir"), artilharia só Beta 1, classificação própria; sem aba Chaveamento (pontos corridos) | [OK] |

Evidências: `006-duas-edicoes.jpg`, `006-edicao-2028.jpg`

## Caso 007 — Rascunho e evento
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Publicar a edição em rascunho da Copa Evento RT | Permitido | "Rascunho" + "Publicada" | [OK] |
| 2 | Home | Evento listado | Seção "Próximas" com Copa Evento RT e seção "Eventos" com "Jogos RT Testes · 2026"; o card público mostra o selo interno "**Rascunho**" | [!] |
| 3 | `/publico/evento/jogos-rt-testes` | Só edições com disputa publicada | Só a 2026 com "Copa Evento RT · 2026"; a 2027 não aparece | [OK] |

Evidências: `007-home-rodada-rascunho.jpg`, `007-portal-evento.jpg`

## Caso 008 — Despublicar
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Copa Evento RT › Despublicar edição | Some; 404 | "Não publicada"; edição, competição e evento voltam a 404; `/publico/eventos` vazio | [OK] |

Evidência: `008-evento-despublicado.jpg`

## Caso 009 — Falha
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Simular rede fora (fetch/XHR falhando) e abrir Classificação | Erro com retentativa | "Não foi possível carregar a classificação. Verifique sua conexão. Nenhum dado foi perdido." + "Tentar novamente" | [OK] |
| 2 | Restaurar e "Tentar novamente" | Recarrega | Classificação exibida | [OK] |

Evidências: `009-erro-com-retentativa.jpg`, `009-apos-retentativa.jpg`

## Caso 010 — Rotas legadas e inexistentes
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | `/eventos-publico/5` | Tratamento coerente | "Recurso descontinuado" + "Ver competições públicas" (sem o cabeçalho do portal) | [!] |
| 2 | `/publico/edicao/93` (privada), `/publico/edicao/abc`, `/publico/competicao/nao-existe` | 404 amigável | "Não encontrado" nos três; sem link de volta ao portal | [!] |

Evidência: `010-rota-legada.jpg`

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT16-01 | Chaveamento público sem placares nem pênaltis (API do chaveamento não traz placar) | Média | 004 | Corrigido (T3, T16) |
| DF-RT16-02 | Jogos do portal: mata-mata antes da fase de grupos e 3º lugar depois da final | Baixa | 004 | Corrigido (T16) |
| DF-RT16-03 | Card da home "Rodada X de Y" não reflete o andamento (1 de 1 com mata-mata concluído; 1 de 3 com jogos das 3 rodadas) | Baixa | 004, 007 | Corrigido (T16) |
| DF-RT16-04 | Selo interno "Rascunho" exibido ao público | Baixa | 007 | Corrigido (T16) |
| DF-RT16-05 | Página "Não encontrado"/"Recurso descontinuado" sem link de volta ao portal (a legada sem cabeçalho) | Baixa | 002, 010 | Corrigido (T16) |
| DF-RT16-06 | Textos públicos: "Evento nao encontrada" (gênero/acento) e "Vencedor de SEMIFINAL 1" (enum) | Baixa | 002, 005 | Corrigido (T3, T16) |

Recorrências: DF-RT13-10 (rolagem horizontal nas tabelas de grupo), DF-RT14-04 (artilharia com posições diferentes no empate), DF-RT13-11 (mensagens sem acento).

## Divergências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| — | — | — | Nenhuma divergência de regra: publicação independente do estado, 404 para privado, allowlist, histórico, seletor do evento e falha com retentativa conforme a spec 8 | — |

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Roteiro escrito; nada publicado. |
| — | Publicadas: 92 (em andamento), 94 (em andamento) e a edição 95 da Copa Evento RT (rascunho); conteúdo e allowlist conferidos. |
| — | Copa Evento RT despublicada; falha de rede simulada; rotas legadas conferidas. **RT16 concluído.** |

Estado ao final: edições 92 e 94 **publicadas** (aparecem no portal); 95 despublicada. Limpeza (excluir competições 88 e 89) aguardando confirmação.
