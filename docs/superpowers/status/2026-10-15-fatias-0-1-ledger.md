> Cópia versionada do ledger de execução (o original fica em `.superpowers/sdd/2026-10-15-fatias-0-1-fundacao-competicoes/progress.md`, fora do git). Retomada: ver [checkpoint da tarefa 5](2026-10-15-task5-checkpoint.md).

# SDD ledger — plan: docs/superpowers/plans/2026-10-15-fatias-0-1-fundacao-competicoes.md

Spec: docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md (aprovada 2026-10-15)
Branch: fatia-0/estabilizacao. Base inicial: c139d9b. Método: subagentes, ondas paralelas (escolha do usuário).
Task 0: complete (c139d9b, snapshot V1/V2, anterior a este ledger)

## Pre-flight scan

| Par / tarefa | Compartilhado | Achado | Ruling |
| --- | --- | --- | --- |
| T1 ↔ T3 | docs/database-migrations.md; T3 consome head 20261015_0100 | sequencial A→B | ok |
| T3 ↔ T11 | migration_tests/test_harness_mysql.py | T3 cria, T11 troca tabela | ok (R9) |
| T2 ↔ T4 | tests/conftest.py | ondas A e C, nunca simultâneo | ok |
| T4 ↔ T5 | app/main.py | C remove routers, D registra o novo | ok, sequencial |
| T5 ↔ T6 / T5 ↔ T7 | api/organizacao.py, api/elencos.py | T5 cria vazios, E preenche | ok |
| T6 ↔ T7 (paralelas) | servicos/__init__.py | T6 "cria"; T7 importa em paralelo → corrida | R3 |
| T6 ↔ T7 (paralelas) | consolidacao/conftest.py, factories.py | ambos tenderiam a acrescentar fixtures | R4 |
| T9 ↔ T10 (paralelas) | package.json/lock (Playwright) | T9 instala, T10 precisa rodar e2e ao mesmo tempo | R5 |
| T9 ↔ T10 (paralelas) | GestaoEquipes | T9 monta componente que T10 cria em paralelo → build quebra | R6 |
| T8 | build gate | apagar services V2/reescrever competicoes.ts quebra 24 consumidores que só T9 removeria | R7 |
| T4 | tabela `eventos` | plano manda preservar router eventos, mas models.Evento antigo (even_nome) colide com Evento novo na mesma tabela | R8 |
| T3 (auto-consistência) | teste de divergência | código usa `competidores`, que só existe após T4 | R9 |
| T1 (auto-consistência) | stamp do banco de dev | cadeia antiga gera UniqueConstraint em grupos_competicoes.slug; baseline segue ORM (índice) → conferência vai divergir | R10 |
| T5 (auto-consistência) | servicos/__init__.py | absorve R3 | ok |
| T6, T7, T11 | testes com `...` | corpos-esboço; implementador completa | ok |

## Rulings

- Ruling R1: Ondas paralelas apesar de SDD dizer "nunca paralelo" — pedido explícito do usuário; arquivos disjuntos por onda. Implementadores de onda paralela NÃO commitam; controlador commita cada tarefa com lista explícita de caminhos após a revisão. Tarefas solo commitam normalmente — custo se errado: commits misturados, corrigível com reset em branch não compartilhada.
- Ruling R2: Plano commitado junto com o commit da Task 1 — instrução do usuário — custo: nenhum.
- Ruling R3: `app/competicoes/servicos/__init__.py` vazio criado pela T5, não pela T6 — evita corrida T6/T7 — custo: nenhum.
- Ruling R4: T6/T7 não editam consolidacao/conftest.py nem factories.py; fixtures locais em seus próprios arquivos de teste — evita conflito paralelo — custo: alguma duplicação de fixture, consolidável na T11.
- Ruling R5: Instalação do Playwright, playwright.config.ts, webServer (backend SQLite migrado + admin + frontend) e helper de login movidos da T9 para a T8 — T9/T10 só adicionam specs — custo: T8 maior.
- Ruling R6: T8 cria stub tipado `components/competicoes/elencos/GestaoEquipes.tsx` (`{ idEdicaoCompeticao: number }`, retorna null); T10 substitui o corpo — contrato de montagem antes da onda F — custo: nenhum.
- Ruling R7: T8 remove/substitui todos os consumidores frontend dos services removidos (components/competicoes-v2, components/publico-v2, components/competicoes antigos, app/publico, app/eventos-publico, app/events, app/dashboard/edicoes, app/dashboard/equipes) e deixa placeholders mínimos em dashboard/competicoes e dashboard/eventos (que T9 reescreve) e página "recurso descontinuado" nas URLs públicas antigas — sem isso o gate de build da T8 é impossível — custo: T9 perde a parte de remoção.
- Ruling R8: T4 também remove models.Evento/Edicao antigos, routers/eventos.py, services/eventos.py e routers/publico.py (portal antigo) — spec 5.1 manda recriar tabelas homônimas; o plano dizer "preservar eventos" é defeito — custo se errado: perda de telas de eventos antigas, que a spec já substitui.
- Ruling R9: T3 escreve o teste de divergência com tabela existente hoje (ex.: `alunos`); T11 troca para `competidores` — custo: nenhum.
- Ruling R10: Não executar stamp automático; reportar ao usuário que a conferência do banco de dev deve divergir em grupos_competicoes.slug e que, como essa tabela é descartada pela consolidação, o caminho é decisão dele (recriar banco de dev ou corrigir e stampar) — custo: passo manual extra para o usuário.

## Progresso
- Ruling R11: `.env.example` é device node mascarado pelo sandbox; T2 não o escreve (conteúdo seria perdido). Nomes das variáveis vão para o README e o usuário atualiza `.env.example` manualmente. T2 também parametriza `DATABASE_URL` e `SECRET_KEY` literais do serviço `web` (linhas 37-38 do compose), não só o `db` — spec 4.4 manda tirar credenciais do compose — custo: passo manual do usuário em `.env`/`.env.example`.
- Ruling R12: Spec 4.2 manda mover `scripts/validar_migracao_*.py` para `migration_tests/arquivados/`; o plano (T3) diz que continuam em `scripts/`. Spec prevalece: T1 os move — custo: quem usava os validadores encontra-os no novo caminho.

## Progresso
- Onda A despachada em paralelo: T1, T2. BASE c139d9b. Implementadores não commitam (R1).
- T2: implementador DONE; controlador commitou 3960a34 (c139d9b..3960a34); revisão despachada. Pendência do usuário: adicionar MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, SECRET_KEY ao .env/.env.example; rotacionar credenciais antigas.
Task 2: complete (commits c139d9b..3960a34, review clean)
Task 2: minor (deferred): healthcheck do compose sem aspas em -p$$MYSQL_PASSWORD — senha com metacaractere quebra o check
Task 2: minor (deferred): DATABASE_URL do web interpola senha crua — senha com @ / : % quebra a URL; documentar ou usar variável separada
Task 2: minor (deferred): asserções de test_conftest_isolamento são checagens de texto-fonte (plan-mandated, baixa severidade)
- T1: implementador DONE_WITH_CONCERNS; controlador commitou 87ef2a0 (3960a34..87ef2a0) incluindo o plano (R2); revisão despachada. Concern rollout-checklist.md com caminho antigo dos validadores → escopo da T11.
- Ruling R13: Socket do Docker negado pelo sandbox (permission denied em /var/run/docker.sock). Socket controla a máquina; não contornar o sandbox nem delegar isso a subagente. T3 implementa o harness e verifica só `-m 'not mysql'`; a execução real em MySQL (`scripts/testar_mysql_competicoes.py`) é feita pelo usuário via `!` ao fim da T3 e de novo após a T4. Portões que exigem harness MySQL ficam "pendentes de execução do usuário" até lá — custo: bugs específicos de MySQL (FK composta, CHECK, Enum) aparecem mais tarde.
- Ruling R14: T1 Important #2 (test_env_sem_metadata_por_padrao só checa texto-fonte) é plan-mandated; o plano é meu e a checagem é fraca — acrescentar teste comportamental (autogenerate com/sem target_metadata injetado em diretório temporário), mantendo ou substituindo o textual. Spec não se opõe — custo: um teste a mais.
- Ruling R15: A afirmação da spec 4.2 de que o baseline "contém exatamente" o schema da cadeia antiga é imprecisa (server defaults e nome/tipo de constraint de slug diferem). A correção factual da spec fica para a T11, que atualiza a spec com evidências; a T1 corrige README e docs/database-migrations.md agora — custo: spec imprecisa até a T11.
Task 1: minor (deferred): downgrade() do baseline derruba todas as tabelas sem guarda, incluindo escolinhas — sugerido checar linhas antes; mesmo risco de 0001 antiga. PRIORIZAR NA REVISÃO FINAL.
Task 1: minor (deferred): arquivados/ referenciam scripts/validar_* e alembic/versions antigos — rodar explicitamente falha; nota no README
Task 1: minor (deferred): docs/rollout-checklist.md cita scripts/validar_migracao_*.py → T11
Task 1: minor (deferred): roundtrip test só confere resultados_prova na segunda subida; poderia repetir comparação schema≡ORM
Task 1: minor (deferred): boilerplate "please adjust!" do autogenerate no baseline (cosmético)
- Ruling R16: T1 teste sem-metadata afirma CommandError do autogenerate em vez de upgrade vazio — é o comportamento real do Alembic e prova a ausência de metadata — custo: nenhum.
Task 1: fix round 1/5 (implementer DONE; commit 87ef2a0..7c69306; re-review despachada)
Task 1: fix round 1/5 (2 addressed, 0 open; commits 87ef2a0..7c69306)
Task 1: complete (commits 3960a34..7c69306, review clean after 1 fix round)
- Onda A concluída. T3 despachada (solo, commita). BASE 7c69306.
- Fato do usuário (2026-10-15): Docker não é usado; dev = MySQL local; produção = TiDB Cloud. Arquivos Docker não são usados em deploy nem local.
- Ruling R17: Harness da T3 sem Docker: alvo é um servidor MySQL-compatível dado em HARNESS_MYSQL_URL (sem nome de banco); cria harness_<hex>, sobe, compara, derruba só o banco que criou. Serve para MySQL local e TiDB. T3 retomada com essa direção após já ter commitado 6a63f0d (versão Docker) — custo: retrabalho de uma rodada.
- Ruling R18: TiDB ignora CHECK por padrão (tidb_enable_check_constraint=OFF, docs PingCAP) e só honra FK em v6.6+. Todo CHECK do schema terá validação equivalente no serviço com teste próprio; CHECK fica como defesa extra. T4 e fatia 2 recebem isso no despacho — custo: validação duplicada (banco + serviço).
- Ruling R19: Texto da spec 4.3 (container Docker) e 4.4 (compose) desatualizado pelo fato acima; T11 atualiza a spec junto com as evidências — custo: spec imprecisa até a T11.
- Pendência do usuário: versão do cluster TiDB Cloud (precisa ≥ v6.6 para FK valer; ideal v8.5) e se pode ligar tidb_enable_check_constraint.
- T3: 766489e (amend de 6a63f0d após redirecionamento R17); revisão: Needs fixes. Fix round 1 despachado (unique index folding, normalização de índice de FK estreita, texto Docker no pytest.ini).
Task 3: minor (deferred): create_engine fora do try (driver ausente → traceback)
Task 3: minor (deferred): teste de mensagem só checa substring "erro"; teste de recusa de URL externa só checa código não-zero; capsys não usado
Task 3: minor (deferred): sem teste para recusa de driver não-mysql; nome de pacote `scripts` genérico
Task 3: minor (deferred): docs/database-migrations.md ainda tem linhas antigas de docker compose (20-25) → T11/R19
- Fato do usuário: TiDB Cloud v8.5.3 → FKs GA e aplicadas (foreign_key_checks ON por padrão desde v6.6). CHECK segue desligado por padrão → R18 mantido. Usuário vai rodar o harness.
Task 3: fix round 1/5 (3 addressed, 0 open; commits 766489e..8ff3fbe)
Task 3: complete (commits 7c69306..8ff3fbe, review clean after 1 fix round)
- Fatia 0: código completo. Portão pendente: execução real do harness pelo usuário (MySQL local).
- Ruling R20: Despachar T4 em paralelo com a execução do harness pelo usuário — arquivos disjuntos (eventual ajuste de normalização é escopo T3: scripts/testar_mysql_competicoes.py e migration_tests/test_harness_mysql.py, que T4 não toca); T4 commita com pathspec explícito — custo: se o harness revelar problema no baseline, T4 pode ter que reaplicar.
- Ruling R21: competition_tests/conftest.py antigo é genérico (importa models/app, liga PRAGMA foreign_keys); T4 o apaga se só servir aos testes removidos, ou o adapta — `pytest competition_tests` precisa continuar coletando sem erro. A consolidacao/conftest.py DEVE ligar PRAGMA foreign_keys=ON (senão o teste de FK composta passa por acidente).
- T4 despachada (solo, opus, commita). BASE 8ff3fbe.
- Execução real do harness pelo usuário (MySQL local): criou e REMOVEU harness_3f6fbdb3 (finally ok), mas quebrou em _alembic_config: senha com vírgula → %2C na URL → configparser interpolation ValueError. Comparação não rodou.
Task 3: reopened — fix round 2/5 despachado (URL percent-encoded; garantir render_as_string(hide_password=False)).
Task 3: fix round 2/5 (1 addressed, 0 open; commits 8ff3fbe..afae017). Controlador conferiu: alembic.ini sqlalchemy.url vazio; única montagem de URL usa render_as_string(hide_password=False) (l.291).
Task 3: complete (commits 7c69306..afae017, review clean after 2 fix rounds). Portão real pendente: nova execução do usuário.
- Execução real #2 do usuário: baseline subiu inteiro no MySQL 8 local (upgrade -> 20261015_0100 ok) e banco removido. Comparador quebrou: KeyError 'primary_key' (get_columns não traz primary_key no MySQL). Task 3: reopened — fix round 3/5 (auditoria completa de portabilidade da reflexão).
- T3 fix round 3: commit 3f749d4 (portabilidade da reflexão). Verificado em cópia git-archive: a árvore compartilhada tem edições não commitadas da T4 em app/models.py.
- Ruling R22: Harness passa config.attributes["descartar_competicoes_teste"]=True — opera sempre num banco recém-criado e vazio por ele mesmo, então o descarte é trivialmente seguro; sem isso o harness quebra assim que a revisão 0200 da T4 entrar. Adicionado à rodada 3 da T3 antes da revisão — custo: nenhum.
- Ruling R23: Próxima execução real do usuário só depois do commit da T4 — rodar agora compararia baseline com ORM pela metade; uma execução valida fatias 0+1 juntas — custo: evidência MySQL da fatia 0 isolada não existirá (o upgrade do baseline já foi provado na execução #2).
Task 3: fix round 3/5 (2 addressed, 0 open; commits afae017..4fb5b86)
Task 3: complete (commits 7c69306..4fb5b86, review clean after 3 fix rounds)
Task 3: minor (deferred): faltam testes negativos (VARCHAR(100)≠VARCHAR(200), INT≠BIGINT, ENUM com valores diferentes) provando que normalizações não mascaram diferença real — PRIORIZAR NA REVISÃO FINAL
Task 3: minor (deferred): lowercase de tipos/defaults mascara diferença só de caixa em valores de ENUM e defaults ('ATIVO' vs 'ativo')
Task 3: minor (deferred): strip de charset/collation mascara utf8 vs utf8mb4 (aceito: ORM não fixa charset)
Task 3: minor (deferred): aliases não normalizados (Numeric→DECIMAL, Float, TIMESTAMP fracionário) podem gerar falso positivo na execução real
Task 3: minor (deferred): peculiaridades de reflexão do TiDB não testadas
- T4: implementador DONE_WITH_CONCERNS, commit 0a9dd10 (4fb5b86..0a9dd10). Revisão (opus) despachada com pacote filtrado (deletados só listados; 886KB → 192KB).
- CHECKs criados pela T4 (espelhar em serviço — R18): edicoes_evento data_inicio<=data_fim; edicoes_competicao data_inicio<=data_fim; edicoes_competicao revisao>=1.
- Nota para o plano da fatia 2: requisicoes_partida.id_partida ainda sem FK (partidas não existe); fatia 2 adiciona.
- Usuário avisado para rodar o harness (fatias 0+1) em HEAD 0a9dd10.
- Ruling R24: T4 Important #1 (atletas sem rota de criação; a única era POST /atletas/equipe/{id}, agora 410) é lacuna da spec, plan-mandated. Decisão: atletas congelados (leitura e exclusão), sem nova rota — atleta só existia para entrar em equipe, papel agora do competidor; criar rota seria feature para entidade em retirada. Reportar ao usuário — custo se errado: uma rota POST /atletas/ reaproveitando criar_atleta e salvar_foto_atleta.
Task 4: complete (commits 4fb5b86..0a9dd10, review clean; 1 Important adjudicado por R24)
Task 4: minor (deferred): scripts/gerar_baseline.py sobrescreve 0100 sem checar existência; após a T4 o ORM ≠ baseline, re-executar corromperia a cadeia — adicionar guarda (recusar se destino existe ou há revisão após 0100). PRIORIZAR NA REVISÃO FINAL.
Task 4: minor (deferred): docs/database-migrations.md diz que 0100 é a única head e o deploy usa `alembic upgrade head` sem `-x descartar_competicoes_teste=sim` → T11 (afeta o deploy real do usuário)
Task 4: minor (deferred): código morto no router de atletas (salvar_foto_atleta e imports) após R24
Task 4: minor (deferred): SQLite não aplica valores de enum; contratos Pydantic devem validar (T5)
Task 4: minor (deferred): app/models.py importa competicoes.modelos no fim do módulo (acoplamento de ordem de carga)
- Onda C concluída. Onda D: T5 despachada (solo, commita). BASE 0a9dd10.
- EVIDÊNCIA (2026-10-15, execução real #3 do usuário, MySQL 8 local, HEAD 0a9dd10): baseline 0100 + consolidação 0200 aplicados; banco descartável removido; "Schema do MySQL equivalente ao metadata ORM: sem divergencias". Portão da fatia 0 FECHADO; schema da fatia 1 validado em MySQL real. TiDB ainda não executado.
- 2026-10-15: T5 interrompida a pedido do usuário antes de escrever qualquer arquivo (árvore limpa em 0a9dd10). Execução pausada; checkpoint em docs/superpowers/status/2026-10-15-fatias-0-1-checkpoint.md. Retomar pela T5.
- 2026-10-15: Usuário autorizou retomar do checkpoint e pediu subagentes em paralelo nas ondas previstas. HEAD a77751f, árvore limpa, branch fatia-0/estabilizacao. A spec e o plano já estavam aprovados; mantemos rulings R1–R24. Teste de baseline `competition_tests/consolidacao` em sandbox imprimiu 11 pontos e expirou em 60s (exit 124); investigar travamento antes de usar essa suíte como portão.
- T5 retomada: implementador despachado a partir de a77751f. Correção do exemplo do plano: atributo de auditoria `responsavel_nome`, conforme checkpoint e modelo ORM. Criar `servicos/__init__.py` vazio conforme R3.
- Task 5: complete (commits a77751f..5bbf609; revisão inicial encontrou três faltas do checkpoint; fix rounds 1 e 2 revisados sem achados abertos). Evidência: 59 testes focados, 94 de consolidação e 84 de regressão em processos SQLite isolados; `git diff --check` limpo. Testes HTTP fora do sandbox por travamento do portal AnyIO no sandbox. A suíte combinada `tests competition_tests/consolidacao` tem contaminação preexistente por `importlib.reload(database)`; coleta padrão inclui `scratch/debug_test.py` versionado neste HEAD local. Resolver na Task 11.
- Onda E liberada após 5bbf609. R1 continua: tarefas 6, 7 e 8 em paralelo com arquivos disjuntos e sem commits/staging pelos implementadores; controlador revisa e commita cada pathset explicitamente.
- Onda E iniciada em BASE 5bbf609: Task 6 `/root/task6_organizacao` (serviço/API organização e teste), Task 7 `/root/task7_elencos` (serviço/API elencos e teste), Task 8 `/root/task8_front_client` (cliente/tipos/frontend transitório e setup Playwright conforme R5–R7). Todos receberam proibição de tocar arquivos alheios ou commitar.
- Ruling R25: A Task 8 não inventa endpoints para iniciar/finalizar/cancelar edição nem atualizar integrante além dos blocos Interfaces da fatia 1; essas operações esportivas chegam nas fatias seguintes. T9/T10 só podem habilitar ações com endpoint real; controles futuros ficam desabilitados e identificados. Custo se errado: faltará ação operacional na fatia 1, mas o plano não entrega serviço correspondente.
- Ruling R26: `IntegranteCriar` não aceita `id_edicao_competicao`; o serviço da Task 7 deriva da equipe e prova a FK composta em teste de banco. Na importação do aluno, `documento_pessoal` é anexo escolar, portanto não vira `documento` do competidor; importam-se nome, nascimento e foto, com autorização dupla explícita. Custo se errado: documentação pessoal precisa ser preenchida separadamente no domínio esportivo.
- 2026-10-15: Usuário pediu parar se a Task 5 estivesse concluída. Agentes das Tasks 6, 7 e 8 interrompidos antes de qualquer edição; `git status --short` limpo em HEAD 5bbf609. Nenhuma implementação ou commit da onda E. Estado salvo no checkpoint versionado `docs/superpowers/status/2026-10-15-task5-checkpoint.md`; retomar pela onda E, sem reexecutar Task 5.
Task 2: minor (deferred): tests/test_conftest_isolamento.py e o plano (l.173-174) contêm a senha antiga literal para verificar sua ausência no compose — após a rotação ficam inofensivos; trocar a verificação por 'nenhuma credencial literal no compose' em vez da senha específica.
