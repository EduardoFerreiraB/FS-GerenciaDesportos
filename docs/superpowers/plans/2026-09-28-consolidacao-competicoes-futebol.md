# Consolidação de Competições e Futebol — Implementation Plan

> **SUPERSEDIDO em 2026-10-15.** Este plano de 16 tarefas não foi executado e não
> deve ser executado. A especificação que o originou foi substituída por
> [Consolidação de competições em fatias entregáveis](../specs/2026-10-15-competicoes-fatias-design.md),
> que entrega em cinco fatias verticais. Um plano novo será escrito a partir dela.
> Mantido como referência histórica.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development para implementar este plano tarefa por tarefa e superpowers:dispatching-parallel-agents para as frentes independentes. A execução paralela com permissão de edição já foi escolhida pelo usuário. Steps use checkbox (`- [ ]`) syntax for tracking. Não iniciar antes da revisão deste plano.

**Goal:** Substituir os fluxos esportivos duplicados por um único domínio de futebol com eventos/campeonatos recorrentes, edições, regulamentos dinâmicos, elencos, partidas, súmula, disciplina e portal público.

**Architecture:** A edição da competição é a unidade de disputa, vinculada opcionalmente à edição de um evento. Regulamentos imutáveis alimentam formulários e validação; equipes e elencos são inscrições da edição e ocorrências são a fonte do placar. O módulo novo fica isolado das escolinhas, com um único contrato de API e serviços transacionais; dados esportivos de teste são descartados por migração delimitada.

**Tech Stack:** Python/FastAPI, SQLAlchemy 2.0.44, Alembic 1.17.2, Pydantic 2.12.3; MySQL 8 e SQLite descartáveis; Next.js 16.1.3, React 19.2.3, TypeScript. Adicionar Playwright somente como dependência de teste na tarefa 12, registrando a versão exata resolvida no package-lock. Não atualizar as dependências de produção como parte deste trabalho.

**Spec:** [Especificação aprovada](../specs/2026-09-28-consolidacao-competicoes-futebol-design.md).

**Status:** plano escrito para revisão; nenhuma tarefa de implementação executada.

## Global Constraints

As seguintes restrições são copiadas da especificação e valem para todas as tarefas:

- Não criar commits Git nesta implementação; manter alterações revisáveis.
- Não alterar `.env` nem executar testes contra banco de desenvolvimento ou produção.
- Preservar usuários, autenticação, professores, modalidades, locais, árbitros, alunos, turmas, matrículas e presenças.
- Descarte de dados de competição não autoriza reset do banco inteiro. A limpeza será delimitada e aplicada ao ambiente-alvo somente na etapa de implantação.
- Não implantar nem executar limpeza no banco conectado durante o planejamento.
- Esta entrega contempla somente futebol. Outras modalidades terão caminho de extensão documentado, sem motores ou telas operacionais nesta entrega.
- Estados da edição: `RASCUNHO`, `EM_ANDAMENTO`, `FINALIZADA`, `CANCELADA`. Publicação é independente do estado esportivo.
- Formatos: pontos corridos, grupos + mata-mata e mata-mata direto. Admitir folgas, classificação automática e geração sem agendamento completo.
- Empates eliminatórios são decididos por pênaltis, sem prorrogação nem gol fora.

É um único subsistema: banco, serviços e telas compartilham o mesmo domínio. As tarefas são entregas verificáveis, mas o corte de produção é coordenado; não publicar uma etapa intermediária com frontend antigo e banco novo.

## Review Focus

Cinco condições que precisam de testes explícitos além do caminho feliz:

1. Repetir uma requisição após timeout não duplica gol, geração ou punição; uma edição concorrente retorna conflito. Testes nas tarefas 6, 8, 9 e 16.
2. Corrigir uma semifinal de ida/volta não deixa final/bronze com participantes antigos nem altera descendente já iniciado. Testes nas tarefas 6 e 10.
3. Excluir um aluno importado e alterar o nome do competidor não destroem o elenco histórico; duas importações concorrentes não duplicam pessoa. Testes nas tarefas 5 e 16.
4. Publicar rascunho e despublicar edição não vaza dados escolares/pessoais nem deixa acesso direto público. Testes nas tarefas 11 e 15.
5. Corte do banco e remoção de associações antigas preservam escolinhas, autenticação e cadastros compartilhados, mesmo com dados misturados. Testes nas tarefas 1 e 16.

## 1. Estrutura, contratos comuns e checkpoints

### 1.1 Arquivos e responsabilidades

Criar `app/competicoes/` com `__init__.py` e estes pacotes, cada um com seu `__init__.py`:

| Caminho | Responsabilidade e dono |
| --- | --- |
| `modelos/organizacao.py`, `pessoas.py`, `disputa.py`, `operacao.py` | Modelos e constraints; tarefa 1, integração central. |
| `contratos/comuns.py`, `organizacao.py`, `elencos.py`, `regulamentos.py`, `jogos.py`, `disciplina.py`, `publico.py` | DTOs Pydantic compartilhados; tarefa 2, depois alterações coordenadas. |
| `infra.py`, `erros.py` | Transação, revisões, locks, auditoria e envelopes; tarefa 2. |
| `servicos/regulamentos.py`, `publicar_catalogo.py` | Catálogo/validação/CLI; tarefa 3. |
| `servicos/organizacao.py` | Identidades, edições, publicação; tarefa 4. |
| `servicos/elencos.py` | Competidores, importação e inscrições; tarefa 5. |
| `motores/futebol/geracao.py`, `chaveamento.py`, `servicos/tabelas.py` | Geração pura, dependências e persistência; tarefa 6. |
| `motores/futebol/classificacao.py`, `servicos/classificacao.py`, `consultas.py` | Tabelas, empate e projeções de placar; tarefa 7. |
| `servicos/disciplina.py` | Punições e cumprimento; tarefa 8. |
| `servicos/sumula.py` | Gols, cartões e resultado simples; tarefa 9. |
| `servicos/operacao.py` | Início/finalização/reabertura, correção e promoção; tarefa 10. |
| `servicos/publico.py` | Consultas com allowlist; tarefa 11. |
| `api/` | Um arquivo por serviço homônimo: regulamentos, organizacao, elencos, tabelas, classificacao, disciplina, sumula, operacao, publico. |
| `router.py` | Registro central dos routers; só integrador edita. |
| `frontend/src/features/competicoes/` | Tipos, clientes e componentes definitivos, sem sufixo V2. |

`app/models.py` conserva apenas o domínio compartilhado e importa as classes novas ao final, no mesmo `Base`; novos modelos usam FKs/relacionamentos por nome e não importam `models` para evitar ciclo. Os schemas esportivos saem de `app/schemas.py` na retirada final. Não reorganizar o resto da aplicação.

Os `api/<dominio>.py` produzem `router: APIRouter`. O integrador registra cada módulo somente quando sua tarefa passa. Não criar stubs que retornam sucesso para operação ainda não implementada.

### 1.2 Convenções e tipos fixados

Usar nomes dos IDs da especificação, datas ISO e datetimes UTC. Revisões inteiras começam em 1; cada operação efetiva incrementa uma vez. Metadados `criado_em`/`atualizado_em` têm defaults coerentes entre ORM e migração. Erros têm `{"codigo": str, "mensagem": str, "campos": dict[str, str]}`.

DTOs em `contratos/comuns.py`:

- `ContextoMutacao(id_usuario: int, revisao: int, motivo: str | None = None, id_requisicao: UUID | None = None)`.
- `Pagina[T](itens: list[T], total: int, pagina: int, tamanho: int)`; padrão 20, máximo 100.
- `EstadoEdicao`, `EstadoPartida`, `Formato`, `TipoOcorrencia`: valores exatos da especificação, sem aliases.
- `ConfiguracaoFutebol`: união discriminada por `formato` em memória; o JSON salvo contém somente seus parâmetros. Objetos recebidos rejeitam propriedades extras; números inteiros não aceitam booleano como inteiro.

`ContextoMutacao` é interno: `id_usuario` vem exclusivamente da dependência de
autenticação, nunca do JSON recebido. No HTTP, mutações levam `revisao` e, quando
necessário, `motivo` no body; criação de ocorrência leva UUID no header
`Idempotency-Key`. A revisão é da edição para operações de edição/elenco/tabela,
e da partida para operações de súmula/finalização/reabertura de jogo. Para locks
internos de pais, a revisão pode ser omitida, mas o estado deve ser relido sob
lock. POST de recurso retorna 201; ações retornam 200; DELETE bem-sucedido, 204.

Em `contratos/organizacao.py`: `EventoCriar(nome, descricao?, slug, edicao: EdicaoEventoCriar)`, `EdicaoEventoCriar(identificacao, data_inicio, data_fim)`, `CompeticaoCriar(nome, descricao?, slug, id_modalidade, edicao: EdicaoCriar)`, `EdicaoCriar(identificacao, categoria?, data_inicio, data_fim, id_edicao_evento?, id_regulamento, configuracao)`. Slug explícito único; frontend sugere e permite editar. Views adicionam IDs, revisão e estados; não retornam relacionamento ORM recursivo. Nome 1–200 caracteres, identificação 1–80, categoria até 100; vazio de categoria normaliza para null.

Em `contratos/elencos.py`: `CompetidorCriar(nome, data_nascimento?, documento?, foto_url?)`, `EquipeCriar(nome, sigla?)`, `IntegranteCriar(id_competidor, numero_camisa?, posicao?)`, `ImportarAlunos(id_turma, ids_alunos: list[int])`, `CopiarEquipes(id_edicao_origem, ids_equipes: list[int])`. Nome esportivo do integrante é capturado do competidor na inscrição. Nenhum campo escolar aparece nesses DTOs.

Em `contratos/jogos.py`:

- `Placar(mandante: int, visitante: int)`, derivado, nunca coluna editável.
- `OcorrenciaCriar(tipo, id_equipe, id_integrante_equipe?, id_equipe_beneficiada?, minuto?, periodo?, observacao?)`. Períodos `1T`/`2T`/null; minuto >= 0.
- `ResultadoSimples(mandante: int, visitante: int)`, ambos >= 0.
- `FinalizarPartida(penaltis_mandante?, penaltis_visitante?)`, sem placar normal.
- `Agendamento(data?, hora?, id_local?, id_arbitro?)` e `PartidaView` com IDs, estado, revisão, agendamento, `placar: Placar` derivado das ocorrências e ocorrências. O agregado de ida/volta é separado: `AgregadoDuelo(id_equipe_a, id_equipe_b, gols_a, gols_b)` no duelo, sem confundir os mandos do segundo jogo.
- `PlanoTabela(grupos, duelos, vagas, partidas, revisao_origem)` e `GeracaoSolicitada(plano: PlanoTabela)`: referências temporárias dentro da prévia são strings locais, nunca IDs presumidos do banco. Validar o plano completo antes de persistir.
- `ClassificacaoView(tabelas, empates_pendentes, campeao_id?)`; cada linha contém equipe, jogos, vitórias, empates, derrotas, gols pró/contra, saldo, pontos e posição esportiva opcional. Separar ordem de exibição de posição resolvida.
- `DecisaoEmpate(id_grupo?, equipes_empatadas: list[int], ordem: list[int], revisao_resultados: int, motivo: str)`; ordem é permutação exata das empatadas.

Em `contratos/disciplina.py`: `SuspensaoView(id_suspensao, id_integrante_equipe, motivo, jogos, cumpridos, situacao)`, `AjusteSuspensao(jogos: int, motivo: str)`, `CumprirSuspensao(id_partida: int, motivo: str | None)`; ajustes aceitam zero para revogação justificada, nunca valor menor que unidades cumpridas sem revisão explícita.

Views adicionais produzidas na tarefa 2: `RegulamentoView` contém exatamente os
campos públicos do catálogo da seção 1.4 e `id_regulamento`; `IntegranteView`
contém IDs, nome esportivo, camisa, posição e ativo; `EquipeView` contém ID,
edição, nome, sigla, grupo e integrantes; `OcorrenciaView` contém os campos de
criação, ID, revisão resultante e timestamp. `ArtilheiroView` contém integrante,
nome esportivo, equipe e gols. `DisciplinarView` contém cartões por integrante,
saldo elegível e suspensões; `TabelaClassificacao` é a lista de linhas e empates
descritos em `ClassificacaoView`. Tipos públicos são allowlists da tarefa 11,
declarados no arquivo `contratos/publico.py`, sem herdar views privadas.

### 1.3 Persistência adicional que concretiza a especificação

Além das entidades descritas na spec, materializar dois registros de controle necessários:

- `decisoes_classificacao`: edição, grupo opcional, conjunto empatado e ordem em JSON de IDs, revisão de resultados, autor, motivo e timestamps; não substituir por simples ordem alfabética. Dados são decisão auditada, não regras esportivas arbitrárias.
- `requisicoes_partida`: partida, UUID, autor, hash do payload normalizado, resultado JSON imutável e revisão resultante; UNIQUE(partida, UUID). Manter mesmo após excluir a ocorrência: repetição não recria gol removido.

Edição guarda `tabela_gerada: bool`, `fase_grupos_encerrada: bool`, `revisao_resultados: int` e `revisao`. Incrementar revisão de resultados quando placar, cartões relevantes ou finalização mudam; autoria isolada e registro de decisão manual não a incrementam. A decisão referencia a revisão existente, para não invalidar a si mesma nem decisões de outros grupos sem novos resultados. Duelo usa estados `PENDENTE`, `PRONTO`, `FINALIZADO`, `CLASSIFICACAO_AUTOMATICA`; vaga usa origens `EQUIPE`, `GRUPO`, `VENCEDOR`, `PERDEDOR`, `FOLGA`. Tabelas de origem são referenciadas por FKs, nunca IDs extraídos de texto. Partida guarda também `iniciada_em` e `finalizada_em`; timestamps são preservados na auditoria ao reabrir.

Índices: todos os FKs usados em listagem; edições por pai; partidas por (edição, estado, data), ocorrências por partida, elencos por equipe/edição, suspensões por (edição, integrante, situação). FKs compostas garantem mesma edição entre equipe/grupo/elenco/partida/duelo. Autor da auditoria tem FK SET NULL + nome registrado. Origem do aluno usa SET NULL, não cascade.

Suspensão tem `chave_origem` única por edição/integrante e `situacao` (`ATIVA`, `CUMPRIDA`, `REVOGADA`, `EM_REVISAO`); cumprimento tem UNIQUE(integrante, partida), além da FK da suspensão. Expulsão por segundo amarelo referencia a ocorrência geradora com unicidade. Referências a resultados/elencos usam RESTRICT; exclusão autorizada é serviço explícito.

### 1.4 Catálogo e chaves canônicas

Padrões comuns: `limite_amarelos=3` (null desabilita), `jogos_suspensao_acumulo=1`, `jogos_suspensao_vermelho=1`, `jogos_suspensao_segundo_amarelo=1`. Contagem estatística inclui todos os cartões, suspensão por acúmulo exclui amarelos do jogo com expulsão por segundo amarelo. Para desempate disciplinar: amarelo vale 1, vermelho direto/expulsão vale 3; não contar expulsão duas vezes.

| Formato | Chaves específicas e defaults |
| --- | --- |
| `PONTOS_CORRIDOS` | `turno_e_returno=false`; `vitoria_pontos=3`, `empate_pontos=1`, `derrota_pontos=0`; `criterios_desempate=[vitorias,saldo_gols,gols_pro,confronto_direto]`. Pontos sempre vêm antes da lista. |
| `GRUPOS_MATA_MATA` | `qtd_grupos=2`, `classificados_por_grupo=2`, `turno_e_returno_grupos=false`, `ida_volta_eliminatorias=false`, `final_jogo_unico=true`, `disputa_terceiro_lugar=false`, `zerar_amarelos_apos_grupos=false`; mesma pontuação/lista de desempates da liga. |
| `MATA_MATA` | `ida_volta_eliminatorias=false`, `final_jogo_unico=true`, `disputa_terceiro_lugar=false`. |

Catálogo JSON tem envelope `{formato, tipo_resultado:"PLACAR", versao:1, schema_configuracao}`. O schema usa `type`, `properties`, `required`, `additionalProperties:false`, `enum`, `default`, `minimum`, `maximum`, `minItems`, `uniqueItems`; `x-ui` tem `grupo`, `ordem`, `widget` e `visivel_quando:{campo,igual}`. Rejeitar keywords desconhecidas na publicação. Metadados não executam expressões. Se não houver ida/volta, normalizar `final_jogo_unico=true`; não apagar silenciosamente valores incompatíveis recebidos.

### 1.5 Verificação, fixtures e evidências

Criar suíte `competition_tests/consolidacao/`, com conftest independente que não importa `main` até configurar `DATABASE_URL=sqlite:///:memory:` e o app atual. DB por teste em `tmp_path`, FK SQLite ligada. Testes de migração usam Alembic; testes de serviço podem usar metadata já verificado. Fixture `db`, `client`, `catalogo_futebol` (três regulamentos), `gestor` e `professor`; dados esportivos declarados em cada teste ou factories com parâmetros explícitos em `factories.py`. Não usar `MockSession` como evidência de constraints.

Comando padrão (raiz):

```bash
env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q -m 'not mysql' --confcutdir=competition_tests/consolidacao competition_tests/consolidacao
```

Nas tarefas abaixo, acrescentar o arquivo de teste indicado ao lugar do diretório final. Registrar marcador `mysql` no conftest; esses testes são executados obrigatoriamente pelo runner isolado da tarefa 16, não pela suíte SQLite. Não usar skip para mascarar indisponibilidade do runner. RED deve falhar na expectativa nova, não por conexão externa. Cada tarefa termina com GREEN, revisão de diff e registro em `docs/superpowers/status/2026-09-28-consolidacao-competicoes.md`, sem commit. Revisores recebem spec, tarefa e diff, não todo o histórico da sessão.

## 2. Tarefas de implementação

### Task 1: Banco definitivo, migração delimitada e inicialização segura

**Depende:** revisão deste plano. **Responsável:** integrador. **Entrega:** metadata/schema novo verificável, API compartilhada inicia sem modelos antigos.

**Files:** criar `app/competicoes/modelos/{__init__,organizacao,pessoas,disputa,operacao}.py`, `app/competicoes/__init__.py`, `alembic/versions/20260928_0007_consolidacao_futebol.py`, `competition_tests/consolidacao/{conftest,factories,test_schema,test_preservacao}.py`; modificar `app/models.py`, `app/main.py`, `app/services/alunos.py`, `app/services/atletas.py`, `app/routers/atletas.py`, `tests/conftest.py`.

**Interfaces:** consome `database.Base`; produz classes `Evento`, `EdicaoEvento`, `Competicao`, `EdicaoCompeticao`, `RegulamentoCompeticao`, `Competidor`, `Equipe`, `IntegranteEquipe`, `GrupoCompeticao`, `DueloEliminatorio`, `VagaDuelo`, `Partida`, `OcorrenciaPartida`, `AuditoriaCompeticao`, `SuspensaoCompeticao`, `CumprimentoSuspensao`, `DecisaoClassificacao`, `RequisicaoPartida`, conforme spec/seção 1.3. Usar `id_edicao_competicao` em todos os vínculos esportivos novos.

- [ ] **1.1 Preparar isolamento e testes de schema.** Aplicar `using-git-worktrees` na execução; transportar também os arquivos untracked relevantes do workspace atual, nunca apenas HEAD. Inventariar e conferir hashes antes/depois, excluindo `.env`, uploads e bancos. Fixar `tests/conftest.py` para SQLite em `tmp_path_factory`, mantendo fixtures existentes sem tocar `test.db`. Escrever `test_upgrade_exige_descarte_explicito`, `test_upgrade_preserva_escolinhas`, `test_schema_equivale_orm`, `test_fk_impede_equipe_de_outra_edicao` com estas expectativas:

```python
assert sem_opcao.descarte_recusado and sem_opcao.revisao == "20260914_0006"
assert depois.dados_compartilhados == antes.dados_compartilhados
assert schema_migrado == schema_orm  # inclui ondelete, defaults e índices
with pytest.raises(IntegrityError):
    db.flush()  # integrante aponta equipe de outra edição
```

- [ ] **1.2 Executar RED:** comando padrão com `test_schema.py test_preservacao.py`; registrar falhas de estrutura/guarda esperadas.
- [ ] **1.3 Implementar modelos e revisão 0007.** `down_revision="20260914_0006"`; aceitar descarte somente com `config.attributes['descartar_competicoes_teste']=True` ou `-x descartar_competicoes_teste=sim`. Checar antes do primeiro DDL. DDL congelado, sem importar modelos. Retirar/recriar apenas tabelas da seção 9 da spec; manter revisões 0001–0006 intactas. Downgrade 0007 falha antes de qualquer mutação, com explicação de restauração. Criar CHECKs, defaults e índices equivalentes nos dois dialetos.
- [ ] **1.4 Desacoplar startup e exclusões escolares.** Retirar imports/includes de routers esportivos antigos do `main`, mantendo auth/escolinhas/cadastros. Retirar acessos a `equipes_participantes` nos dois serviços e o helper `criar_atleta_equipe`. Desativar `/atletas/equipe/{id}` com 410 e retirar seu import do serviço de equipes; preservar CRUD de atletas. Remover `Modalidade.eventos` e associação antiga; `Modalidade.competicoes` aponta à nova identidade permanente. Não importar DTOs antigos que referenciem classes removidas.
- [ ] **1.5 Executar GREEN e revisão:** mesmos testes, `test_importar_main_nao_cria_tabelas`, carga de mappers e regressão de cadastro/exclusão de aluno. Registrar que as antigas suítes esportivas ainda serão substituídas na tarefa 16; não apagá-las para alegar regressão aprovada.

### Task 2: Contratos, transações e auditoria comuns

**Depende:** 1. **Files:** criar `app/competicoes/contratos/` com os sete arquivos da seção 1.1, `infra.py`, `erros.py`, `router.py`, `api/__init__.py`, `competition_tests/consolidacao/test_infra_contratos.py`; modificar `app/main.py` para registrar erros e router central.

**Interfaces:** produz DTOs da seção 1.2 e `ErroDominio(codigo: str, mensagem: str, http_status: int, campos: dict[str,str])`; `mutacao(db: Session) -> ContextManager[None]`; `bloquear_edicao(db, id_edicao: int, revisao: int | None = None) -> EdicaoCompeticao`; `bloquear_partida(db, id_partida: int, revisao: int) -> Partida`; `auditar(db, id_edicao: int, ctx: ContextoMutacao, entidade: str, id_entidade: int, acao: str, antes: dict, depois: dict) -> None`. Helpers não fazem commit. Nos contratos de serviço deste plano, `db` sempre é `Session` e `ctx` sempre é `ContextoMutacao`.

- [ ] **2.1 Escrever testes** `test_mutacao_reverte_tudo`, `test_revisao_antiga_409`, `test_contratos_rejeitam_alias_e_extra`, `test_auditoria_sobrevive_autor_removido`:

```python
assert resposta.status_code == 409
assert resposta.json()["codigo"] == "REVISAO_DESATUALIZADA"
assert (edicao.revisao, numero_ocorrencias, numero_auditorias) == antes
assert auditoria.id_usuario is None and auditoria.nome_responsavel == "gestor"
```

- [ ] **2.2 Executar RED:** comando padrão com `test_infra_contratos.py`.
- [ ] **2.3 Implementar contratos e unidade transacional.** Autenticação FastAPI pode abrir transação antes do serviço: não chamar `begin()` cegamente. `mutacao` conclui a transação da sessão da requisição uma vez e reverte na falha; proibir nesting de serviços de comando. Antes de ler dados usados para decisões concorrentes, adquirir locks em ordem edição→partida→dependentes. Não reutilizar ORM/snapshot pré-lock; consultas decisórias usam leitura bloqueante/recarregada. Respostas de escrita incluem a revisão nova. Registrar auditoria na mesma transação.
- [ ] **2.4 Executar GREEN:** validar schemas de todos os DTOs, tipos estritos e envelopes sem SQL. Exportar em `docs/competition-api.json` somente o contrato implementado; completar na tarefa 11. Checkpoint revisado, sem commit.

### Task 3: Catálogo versionado e validação das configurações

**Depende:** 2. **Files:** criar os três JSONs em `app/regulamentos/futebol/`, `app/competicoes/servicos/{__init__,regulamentos}.py`, `publicar_catalogo.py`, `api/regulamentos.py`, `competition_tests/consolidacao/test_regulamentos.py`; integrador modifica `router.py`.

**Interfaces:** `validar_configuracao(regulamento: RegulamentoCompeticao, dados: dict) -> dict`; `listar_regulamentos(db, id_modalidade: int) -> list[RegulamentoView]`; `publicar_catalogo(db, id_modalidade: int, diretorio: Path) -> list[RegulamentoCompeticao]`. GET `/competicoes/regulamentos?id_modalidade=`; deve preceder `/competicoes/{id}`. CLI `PYTHONPATH=app python -m competicoes.publicar_catalogo --id-modalidade ID --catalogo futebol` usa DATABASE_URL explícita na execução de teste.

- [ ] **3.1 Escrever testes** `test_catalogo_imutavel_idempotente`, `test_defaults_materializados`, `test_modalidade_sem_motor`, `test_json_rejeita_tipo_chave_condicao`:

```python
assert publicar_duas_vezes.ids_primeira == publicar_duas_vezes.ids_segunda
assert normalizada["vitoria_pontos"] == 3
assert normalizada["turno_e_returno"] is False
assert modalidade_sem_regulamento.itens == []
assert alterar_mesma_versao.codigo == "REGULAMENTO_IMUTAVEL"
```

- [ ] **3.2 Executar RED:** comando padrão com `test_regulamentos.py`.
- [ ] **3.3 Implementar catálogo/validador.** Usar o subconjunto fechado da seção 1.4; não anunciar suporte ao JSON Schema completo. JSON somente apresenta/valida dados; registro de motor explícito aceita apenas futebol/PLACAR e três formatos. Validar catálogo antes de escrever; bloquear modalidade ao alternar versão ativa. Não modificar versão já existente. Validar limites de equipes/grupos na geração, quando as inscrições são conhecidas.
- [ ] **3.4 Executar GREEN**, incluindo `true` recebido onde se exige inteiro, critérios repetidos, alias antigo e versão desconhecida; confirmar nenhum catálogo é escrito ao iniciar a API. Checkpoint sem commit.

### Task 4: Eventos, competições permanentes e edições

**Depende:** 3. **Files:** criar `app/competicoes/servicos/organizacao.py`, `api/organizacao.py`, `competition_tests/consolidacao/test_organizacao.py`; integrador registra router.

**Interfaces:** `criar_evento(db, dados: EventoCriar, id_usuario: int) -> EventoView`; `criar_competicao(db, dados: CompeticaoCriar, id_usuario: int) -> CompeticaoView`; `criar_edicao_evento(db, id_evento: int, dados: EdicaoEventoCriar, id_usuario: int) -> EdicaoEventoView`; `criar_edicao_competicao(db, id_competicao: int, dados: EdicaoCriar, id_usuario: int) -> EdicaoView`; `atualizar_configuracao(db, id_edicao: int, id_regulamento: int, configuracao: dict, ctx) -> EdicaoView`; `publicar_edicao(db, id_edicao: int, publicada: bool, ctx) -> EdicaoView`. CRUD/arquivo/listagem nos recursos `/eventos`, `/eventos/{id}/edicoes`, `/competicoes`, `/competicoes/{id}/edicoes`, `/edicoes-evento/{id}`, `/edicoes-competicao/{id}`; configuração e publicação via PUT sub-recursos. Filtros de edição de evento para listar competições vinculadas.

- [ ] **4.1 Escrever testes** `test_criar_identidade_e_primeira_edicao_atomico`, `test_periodo_evento_respeita_filhos`, `test_publicacao_independe_estado`, `test_exclusao_pais_restrita`:

```python
assert (edicao.estado, edicao.publicada, edicao.categoria) == ("RASCUNHO", False, None)
assert edicao_2027.id_competicao == edicao_2026.id_competicao
assert edicao_2027.id_edicao_competicao != edicao_2026.id_edicao_competicao
assert publicacao.estado == "RASCUNHO" and publicacao.publicada
assert excluir_evento_com_filhos.status_code == 409
```

- [ ] **4.2 Executar RED:** comando padrão com `test_organizacao.py`.
- [ ] **4.3 Implementar comandos e consultas.** Criação de pai+filho na mesma transação; colisão de slug/identificação gera 409 e não deixa pai órfão. Não renomear modalidade com edições. Bloquear configuração após tabela gerada. DELETE somente rascunho sem disputa/histórico; arquivamento não apaga filhos e impede novas edições até desarquivar. Cada endpoint de escrita exige admin/coordenador; leituras internas exigem autenticação. Iniciar/finalizar/cancelar/reabrir ficam na tarefa 10.
- [ ] **4.4 Executar GREEN**, com período inválido, pai de outra modalidade, tentativa professor, falha na segunda metade da criação e revisão antiga. Checkpoint sem commit.

### Task 5: Competidores, elencos, importação e cópia

**Depende:** 4. **Files:** criar `app/competicoes/servicos/elencos.py`, `api/elencos.py`, `competition_tests/consolidacao/test_elencos.py`; integrador registra router.

**Interfaces:** `criar_competidor(db, dados: CompetidorCriar, id_usuario: int) -> CompetidorView`; `criar_equipe(db, id_edicao: int, dados: EquipeCriar, ctx) -> EquipeView`; `inscrever(db, id_equipe: int, dados: IntegranteCriar, ctx) -> IntegranteView`; `importar_alunos(db, id_equipe: int, dados: ImportarAlunos, ctx) -> list[IntegranteView]`; `copiar_equipes(db, id_edicao_destino: int, dados: CopiarEquipes, ctx) -> list[EquipeView]`; `listar_alunos_disponiveis(db,id_turma:int,pagina:int,tamanho:int,id_usuario:int)->Pagina[AlunoImportavel]`, onde `AlunoImportavel` tem somente `id_aluno`, `nome`, `data_nascimento`. Recursos `/competidores`, `/edicoes-competicao/{id}/equipes`, `/equipes/{id}/integrantes`, `/equipes/{id}/importar-alunos`, `/edicoes-competicao/{id}/copiar-equipes`, `/integrantes/{id}`. GET `/competidores/alunos-disponiveis?id_turma=` filtra matrícula ativa e aplica autorização escolar. Atualizar nome/ativo/camisa por PUT específico com revisão da edição.

- [ ] **5.1 Escrever testes** `test_terceiro_sem_aluno`, `test_importacao_reutiliza_origem`, `test_copia_preserva_historico`, `test_um_time_por_edicao`, `test_excluir_aluno_preserva_competidor`:

```python
assert terceiro.id_aluno_origem is None
assert importar_novamente.id_competidor == primeiro.id_competidor
assert copia.id_equipe != original.id_equipe
assert copia.integrantes[0].id_competidor == original.integrantes[0].id_competidor
assert elenco_2026.nome_esportivo == nome_antes_da_correcao_cadastral
assert competidor_apos_exclusao.id_aluno_origem is None
```

- [ ] **5.2 Executar RED:** comando padrão com `test_elencos.py`.
- [ ] **5.3 Implementar serviços.** Lock da edição e aluno/competidor de origem antes de reler vínculos; constraint única é proteção final. Verificar matrícula ativa na turma selecionada e permissão do organizador. Copiar só nome e nascimento do aluno; não copiar `documento_pessoal` do aluno, que hoje pode ser caminho de arquivo, nem fotos/documentos escolares privados. Inativação mantém ocorrências. Cópia preserva equipes existentes no destino; conflito de inscrição reverte a operação. Nova tentativa com revisão obsoleta retorna 409, não duplica times. Permitir selecionar quais equipes copiar; nunca copiar dados esportivos. Bloquear novas inscrições após início; trocar equipe inscrita fica fora do escopo.
- [ ] **5.4 Executar GREEN**, incluindo camisa repetida entre ativos, reativação conflitante, jogador de outra edição e importação parcial inválida revertida por inteiro. Checkpoint sem commit.

### Task 6: Geração, grupos, vagas e jogos sem agendamento

**Depende:** 4. **Files:** criar `app/competicoes/motores/{__init__.py,futebol/__init__.py,futebol/geracao.py,futebol/chaveamento.py}`, `servicos/tabelas.py`, `api/tabelas.py`, `competition_tests/consolidacao/test_geracao.py`.

**Interfaces:** `prever_tabela(formato: Formato, configuracao: dict, ids_equipes: list[int]) -> PlanoTabela`; `validar_plano(plano: PlanoTabela, formato: Formato, configuracao: dict, ids_equipes: list[int]) -> None`; `descendentes_afetados(vagas: list[VagaDuelo], id_duelo: int) -> set[int]`; `gerar_tabela(db, id_edicao: int, dados: GeracaoSolicitada, ctx) -> PlanoTabela`; `desfazer_tabela(db, id_edicao: int, ctx) -> None`. POST `/edicoes-competicao/{id}/tabela/previa` não grava; POST `/edicoes-competicao/{id}/tabela` confirma; DELETE `/edicoes-competicao/{id}/tabela` desfaz. A prévia inclui revisão de origem para rejeitar elenco alterado.

- [ ] **6.1 Escrever testes** `test_liga_impar_returno`, `test_grupos_cruzamento_explicito`, `test_folgas_sem_partida`, `test_geracao_sem_agendamento`, `test_plano_invalido_nao_grava`:

```python
assert len(liga_3_times_turno.partidas) == 3
assert len(liga_3_times_returno.partidas) == 6
assert sum(d.estado == "CLASSIFICACAO_AUTOMATICA" for d in chave_5.duelos) == 3
assert all(p.data is None and p.id_arbitro is None for p in previa.partidas)
assert cruzamentos_2x2 == [("1A", "2B"), ("1B", "2A")]
assert apos_tentativa_repetida.quantidade_partidas == antes.quantidade_partidas
```

- [ ] **6.2 Executar RED:** comando padrão com `test_geracao.py`.
- [ ] **6.3 Implementar algoritmos puros.** Round-robin por rotação, folga interna removida do resultado; returno inverte mandos. Para chave de tamanho potência de dois, ordenar seeds por espelhamento recursivo, slots excedentes vazios: nenhum duelo inicial vazio×vazio. Grupos distribuídos por snake sobre a ordem de equipes enviada; ordenação de vagas por colocação e depois nome do grupo, pareamento espelhado, exceção explícita 2×2 acima. Permitir editar grupos/seeds/cruzamentos na prévia, validar unicidade de participantes e vagas, DAG sem ciclos, fases e mesma edição. Bronze exige duas semifinais efetivamente disputáveis. Ida/volta cria duas partidas quando o duelo tem adversários; não criar partidas para vagas futuras.
- [ ] **6.4 Persistir prévia validada** numa transação sob lock da edição. Confirmar exatamente a prévia conferida; não regenerar aleatoriamente. Segunda geração sem desfazer retorna 409. Desfazer limpa jogos/duelos/grupos sem ocorrências somente em rascunho. Rotina interna `materializar_duelo(db, duelo: DueloEliminatorio) -> list[Partida]` não faz commit e será consumida pela tarefa 10.
- [ ] **6.5 Executar GREEN**, testando 2, 3, 5, 8 equipes, volta invertida, grupos com poucos integrantes, cruzamento repetido, ciclo e adversários de outra edição. Checkpoint sem commit.

### Task 7: Placar derivado, classificação, empates e artilharia

**Depende:** 6. **Files:** criar `app/competicoes/consultas.py`, `motores/futebol/classificacao.py`, `servicos/classificacao.py`, `api/classificacao.py`, `competition_tests/consolidacao/test_classificacao.py`.

**Interfaces:** `placares(db, ids_partidas: list[int]) -> dict[int, Placar]`; `calcular_tabela(equipes: list[EquipeResumo], jogos: list[JogoResultado], cartoes: dict[int, CartoesResumo], configuracao: dict) -> TabelaClassificacao`; `obter_classificacao(db, id_edicao: int) -> ClassificacaoView`; `registrar_desempate(db, id_edicao: int, dados: DecisaoEmpate, ctx) -> ClassificacaoView`; `obter_artilharia(db, id_edicao: int) -> list[ArtilheiroView]`. GET `/edicoes-competicao/{id}/classificacao`, `/artilharia`; POST `/desempates`. DTOs de cálculo ficam em `contratos/jogos.py`: `EquipeResumo(id_equipe,nome)`, `JogoResultado(id_partida,mandante,visitante,estado,placar)`, `CartoesResumo(amarelos,vermelhos,pontos_disciplinares)`.

- [ ] **7.1 Escrever testes** `test_apenas_finalizados_pontuam`, `test_confronto_direto_multiplos_empatados`, `test_empate_nao_classifica_por_id`, `test_autoria_sem_alterar_placar`, `test_gol_contra_fora_artilharia`:

```python
assert tabela_time_1.pontos == 4  # vitória + empate, ignorar jogo ao vivo
assert empate.posicao is None and empate.precisa_decisao
assert decisao.ordem == ordem_escolhida
assert decisao_apos_resultado_alterado.valida is False
assert placar_apos_atribuir == placar_antes
assert gols_artilheiro == gols_normais_atribuidos
```

- [ ] **7.2 Executar RED:** comando padrão com `test_classificacao.py`.
- [ ] **7.3 Implementar projeções por agregação em lote**, sem N+1 e sem colunas de placar normal. Refinar empates critério a critério; mini-tabela só com jogos relevantes concluídos. Empates pendentes afetam vaga/título; ordem visual estável não resolve esporte. Decisão manual é versionada por resultados, permutação exata e auditada; rejeitar equipe fora do grupo. Artilharia inclui gols de jogos não cancelados, sinaliza partidas em andamento e exclui gols contra/pênaltis. Pontos disciplinares seguem 1.4.
- [ ] **7.4 Executar GREEN**, incluindo inversão de mandos, empate tríplice, grupo independente, critério inexistente e decisão obsoleta. Checkpoint sem commit.

### Task 8: Suspensões, zeragem e cumprimento explícito

**Depende:** 5. **Files:** criar `app/competicoes/servicos/disciplina.py`, `api/disciplina.py`, `competition_tests/consolidacao/test_disciplina.py`.

**Interfaces:** `reconciliar_sancoes(db, id_partida: int, ctx) -> list[SuspensaoCompeticao]` (helper sem commit, chamado na finalização); `obter_disciplinar(db, id_edicao: int) -> DisciplinarView`; `cumprir_suspensao(db, id_suspensao: int, dados: CumprirSuspensao, ctx) -> SuspensaoView`; `ajustar_suspensao(db, id_suspensao: int, dados: AjusteSuspensao, ctx) -> SuspensaoView`; `zerar_saldo_grupos(db, id_edicao: int, ctx) -> None` (helper). GET `/edicoes-competicao/{id}/disciplinar`, POST `/suspensoes/{id}/cumprimentos`, PUT `/suspensoes/{id}`.

- [ ] **8.1 Escrever testes** `test_sancao_nao_duplica`, `test_segundo_amarelo_nao_soma_acumulo`, `test_cumprimento_exige_jogo_posterior`, `test_zeragem_preserva_punicao`, `test_correcao_sancao_cumprida_exige_revisao`:

```python
assert (sanction.jogos, total_sancoes) == (1, 1)
assert repetir_finalizacao.ids_sancoes == primeira_finalizacao.ids_sancoes
assert cumprir_mesma_partida_duas_vezes.status_code == 409
assert saldo_apos_zeragem == 0 and suspensao_anterior.situacao == "ATIVA"
assert correcao.situacao == "EM_REVISAO" and cumprimento_original.existe
```

- [ ] **8.2 Executar RED:** comando padrão com `test_disciplina.py`.
- [ ] **8.3 Implementar fila de sanções.** Origem automática combina integrante, ciclo de acúmulo/expulsão e ocorrência geradora; processar em ordem de início efetivo/ID de partida. Persistir instante de início/fim em partidas para decidir posterioridade, independente da data planejada. Cada conjunto completo de amarelos elegíveis gera uma sanção; segundo amarelo exclui os amarelos daquela partida do saldo. Zeragem de grupos usa marco auditado da revisão/resultados, sem apagar cartões. Cumprimento exige partida da equipe finalizada e iniciada depois da origem da punição; uma unidade por integrante/partida. Se há ocorrência de participação do suspenso, rejeitar cumprimento simples e exigir ajuste disciplinar justificado. Sem expulsão automática de inscrições nem alteração de placar.
- [ ] **8.4 Executar GREEN**, incluindo limite null, dois ciclos de acúmulo, revogação justificada, jogo cancelado/folga, tentativa antes da sanção e conflito de revisão. Checkpoint sem commit.

### Task 9: Súmula transacional, resultado simples e idempotência

**Depende:** 5, 7. **Files:** criar `app/competicoes/servicos/sumula.py`, `api/sumula.py`, `competition_tests/consolidacao/test_sumula.py`.

**Interfaces:** `registrar_ocorrencia(db, id_partida: int, dados: OcorrenciaCriar, ctx) -> OcorrenciaView`; `remover_ocorrencia(db, id_ocorrencia: int, ctx) -> PartidaView`; `atribuir_autor(db, id_ocorrencia: int, id_integrante: int, ctx) -> OcorrenciaView`; `definir_resultado_simples(db, id_partida: int, dados: ResultadoSimples, ctx) -> PartidaView`; `agendar_partida(db, id_partida: int, dados: Agendamento, ctx) -> PartidaView`. GET/PUT `/partidas/{id}`, POST `/partidas/{id}/ocorrencias`, DELETE `/ocorrencias/{id}`, PUT `/ocorrencias/{id}/autor`, PUT `/partidas/{id}/resultado-simples`.

- [ ] **9.1 Escrever testes** `test_idempotencia_precede_revisao`, `test_resultado_simples_preserva_autoria`, `test_segundo_amarelo_unico`, `test_gol_contra_beneficia_adversario`, `test_suspenso_nao_bloqueia_registro`:

```python
assert repetir_mesmo_uuid.json() == resposta_original.json()
assert repetir_uuid_outro_payload.status_code == 409
assert placa_mandante == 2  # um gol atribuído + um sem autoria
assert tentar_reduzir_abaixo_gols_atribuidos.status_code == 422
assert quantidade_expulsoes_derivadas == 1
assert registrar_gol_suspenso.status_code == 201
```

- [ ] **9.2 Executar RED:** comando padrão com `test_sumula.py`.
- [ ] **9.3 Implementar comandos.** Lock edição→partida, verificar edição em andamento e jogo não cancelado/finalizado; primeira ocorrência inicia partida. Para UUID já conhecido, validar hash+autor e responder registro persistido antes de rejeitar revisão antiga; mesma UUID de outro autor gera conflito. Não incrementar revisão no replay. Alteração de autoria finalizada exige motivo e edição reaberta, mas não modifica chaveamento. Resultado simples ajusta somente gols normais sem autoria; gol contra/atribuído precisa edição explícita. Remoção do segundo amarelo desfaz expulsão vinculada. Cartão/autor fora do elenco da partida gera 422. Nunca executar punição administrativa.
- [ ] **9.4 Executar GREEN**, incluindo replay após remoção do gol, duplo clique, autoria posterior e partida ainda sem horário/local/árbitro. O comportamento de concorrência real é comprovado na tarefa 16. Checkpoint sem commit.

### Task 10: Ciclo de vida, avanço de fases e correções com dependências

**Depende:** 6, 7, 8, 9. **Files:** criar `app/competicoes/servicos/operacao.py`, `api/operacao.py`, `competition_tests/consolidacao/test_operacao.py`; consumir helpers sem editar arquivos dos agentes anteriores.

**Interfaces:** `iniciar_edicao(db,id_edicao:int,ctx)->EdicaoView`; `finalizar_edicao(db,id_edicao:int,ctx)->EdicaoView`; `reabrir_edicao(db,id_edicao:int,ctx)->EdicaoView`; `cancelar_edicao(db,id_edicao:int,ctx)->EdicaoView`; `finalizar_partida(db,id_partida:int,dados:FinalizarPartida,ctx)->PartidaView`; `reabrir_partida(db,id_partida:int,ctx)->PartidaView`; `encerrar_grupos(db,id_edicao:int,ctx)->PlanoTabela`; `reabrir_grupos(db,id_edicao:int,ctx)->PlanoTabela`; `iniciar_partida(db,id_partida:int,ctx)->PartidaView`; `cancelar_partida(db,id_partida:int,ctx)->PartidaView`. POST `/edicoes-competicao/{id}/{iniciar,finalizar,reabrir,cancelar}`, `/edicoes-competicao/{id}/grupos/{encerrar,reabrir}` e `/partidas/{id}/{iniciar,finalizar,reabrir,cancelar}`. PUT agendamento fica na tarefa 9. Cancelamento de partida só antes de começar e sem ocorrências; reabertura de cancelada recoloca AGENDADA. Reabertura de finalizada retorna EM_ANDAMENTO preservando ocorrências e exigindo nova finalização.

- [ ] **10.1 Escrever testes** `test_inicio_exige_elenco_e_tabela`, `test_final_ida_volta_agregado`, `test_reabrir_invalida_descendentes`, `test_bronze_iniciado_bloqueia_semifinal`, `test_grupos_empate_pendente`, `test_finalizacao_nao_ignora_cancelado`:

```python
assert iniciar_sem_integrante.status_code == 422
assert vencedor_agregado == equipe_a.id_equipe  # mandos invertidos no jogo 2
assert reabrir_com_bronze_iniciado.status_code == 409
assert apos_reabrir.final.adversario_dependente is None
assert encerrar_grupos_com_empate.status_code == 409
assert finalizar_com_jogo_cancelado.status_code == 409
```

- [ ] **10.2 Executar RED:** comando padrão com `test_operacao.py`.
- [ ] **10.3 Implementar orquestração em transação única.** Finalizar partida calcula placar/agregado, exige pênaltis apenas no decisivo empatado, reconcilia disciplina e resolve vagas. Materializar descendentes prontos sem placar/agendamento fictício. Reabertura examina todo o grafo afetado, incluindo perdedores/bronze e jogo de volta; se algum começou, rejeitar tudo. Caso permitido, retirar resoluções e partidas dependentes ainda não iniciadas, preservando uma entrada auditada das mudanças. Volta iniciada bloqueia corrigir ida. Encerrar grupos fixa classificação e aplica marco de zeragem; reabrir grupos invalida decisões/vagas e reconcilia esse marco sem apagar sanções cumpridas. Não chamar serviços que fazem commit dentro de outra mutação.
- [ ] **10.4 Implementar regras da edição.** Finalização exige todos os jogos obrigatórios resolvidos e campeão/posições relevantes definidos. Finalizada só reabre para EM_ANDAMENTO; cancelada não reabre nesta entrega. Nenhuma reabertura permite voltar a editar configuração estrutural. Publicação não muda com reabertura/cancelamento. Auditar motivos e antes/depois. Operações sem mudança não duplicam sanções/partidas.
- [ ] **10.5 Executar GREEN:** adicionar empate de liga que define título, correção de cartão que troca classificado, autoria isolada e rollback total quando um descendente bloqueia a operação. Checkpoint sem commit.

### Task 11: Portal HTTP público e verificação dos contratos administrativos

**Depende:** 10. **Files:** criar `app/competicoes/servicos/publico.py`, `api/publico.py`, `competition_tests/consolidacao/{test_publico,test_api_contratos}.py`; atualizar `router.py`, `docs/competition-api.json` por exportação OpenAPI.

**Interfaces:** `obter_evento_publico(db,slug:str)->EventoPublicoView`; `obter_competicao_publica(db,slug:str)->CompeticaoPublicaView`; `obter_edicao_publica(db,id_edicao:int)->EdicaoPublicaView`. GET `/publico/eventos/{slug}`, `/publico/eventos/{slug}/edicoes/{id}`, `/publico/competicoes/{slug}`, `/publico/edicoes-competicao/{id}` e sub-recursos `/partidas`, `/classificacao`, `/artilharia`, `/disciplinar`. Todas as consultas verificam publicação, inclusive consultas por ID de partida e componentes aninhados.

- [ ] **11.1 Escrever testes** `test_rascunho_publicado_visivel`, `test_despublicacao_bloqueia_todos_subrecursos`, `test_dados_publicos_allowlist`, `test_permissoes_por_perfil`:

```python
assert rascunho_publicado.status_code == 200
assert privado_por_id.status_code == 404
assert set(jogador_publico) == {"id_integrante_equipe", "nome", "numero_camisa", "id_equipe"}
assert not campos_publicos & {"documento", "id_aluno_origem", "data_nascimento", "nome_mae"}
assert (anonimo_publicacao, professor_publicacao, gestor_publicacao) == (401, 403, 200)
```

- [ ] **11.2 Executar RED:** comando padrão com os dois arquivos.
- [ ] **11.3 Implementar schemas públicos separados.** DTOs de evento/competição só têm identidade pública e edições visíveis. Edição pública: identificação, categoria, datas, modalidade, formato, estado, regras de apresentação aprovadas, equipes e projeções esportivas. Disciplinar público mostra cartões e situação de suspensão, sem justificativas/auditoria/documentos/foto escolar. Resposta nunca serializa modelo ORM inteiro. Validar publicação em cada request; não usar cache que continue expondo edição despublicada.
- [ ] **11.4 Executar GREEN e exportar OpenAPI**, verificando schema de todo endpoint novo, filtros/paginação e ausência de `/v2` e dos antigos recursos esportivos no app registrado. Métodos não implementados não aparecem no schema. Checkpoint sem commit.

### Task 12: Formulário dinâmico e navegação de eventos/edições

**Depende:** 4; pode rodar em paralelo com 5/6. **Files:** criar `frontend/src/features/competicoes/{types.ts,api/organizacao.ts,api/regulamentos.ts,FormularioRegulamento.tsx,FormularioCompeticao.tsx,FormularioEvento.tsx,HistoricoEdicoes.tsx,PainelEdicao.tsx}`, `frontend/playwright.config.ts`, `frontend/e2e/{fixtures.ts,organizacao.spec.ts}`, `scripts/servidor_e2e.py`; modificar `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/app/dashboard/competicoes/{page.tsx,[id]/page.tsx}`, `frontend/src/app/dashboard/eventos/{page.tsx,[id]/page.tsx}`, `frontend/src/components/layout/Sidebar.tsx`; criar `frontend/src/app/dashboard/competicoes/[id]/edicoes/[idEdicao]/page.tsx` e `frontend/src/app/dashboard/eventos/[id]/edicoes/[idEdicao]/page.tsx`.

**Interfaces:** `types.ts` espelha todos os contratos da tarefa 2, incluindo enums e erro, sem `any`; domínio faltante exige alteração coordenada. `FormularioRegulamento({schema: SchemaConfiguracao, value: ConfiguracaoFutebol, onChange, errors, disabled}: Props)`, `HistoricoEdicoes({edicoes,onSelecionar}: Props)`, `PainelEdicao({idEdicao:number}: Props)` com tipos de callbacks explícitos. API usa `@/lib/api` para autenticados; exporta `criarCompeticao(dados):Promise<CompeticaoView>`, `criarEvento(dados):Promise<EventoView>`, `criarEdicao(id,dados):Promise<EdicaoView>`, `listarRegulamentos(idModalidade):Promise<RegulamentoView[]>`, `obterEdicao(id):Promise<EdicaoView>` e PUTs de configuração/publicação.

- [ ] **12.1 Preparar teste de navegador e RED.** Adicionar `@playwright/test` com versão exata no lock e script `test:e2e: "playwright test"`. Dois `webServer` isolados: Python 18080 e Next 13000, `reuseExistingServer:false`, `workers:1`. O servidor Python cria SQLite sob `/tmp`, define variáveis antes de importar o app, aplica migração com descarte explícito e publica catálogo com dados sintéticos. Frontend recebe URL 18080; login usa API real e token de usuário sintético, não desabilita autorização. A integração de servidores segue a [documentação oficial do Playwright](https://playwright.dev/docs/test-webserver). Instalação e download de navegador ocorrem só na implementação.
- [ ] **12.2 Escrever `organizacao.spec.ts`**, testes `cria campeonato e primeira edição`, `cria competição dentro do evento`, `formulário respeita catálogo e não altera versão`, `troca de formato confirma perda`, `erro de rede não parece lista vazia`:

```typescript
await page.getByRole('button', { name: 'Nova competição', exact: true }).click();
await page.getByLabel('Pontos por vitória').fill('2');
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await expect(page.getByText('Rascunho', { exact: true })).toBeVisible();
expect(edicaoSalva.configuracao.vitoria_pontos).toBe(2);
expect(regulamentoOriginal.schema_configuracao.properties.vitoria_pontos.default).toBe(3);
```

- [ ] **12.3 Executar RED:** em `frontend`, `npm run test:e2e -- e2e/organizacao.spec.ts`; falhar nos elementos/fluxos ainda inexistentes.
- [ ] **12.4 Implementar componentes e rotas.** Mostrar exatamente “Novo evento” e “Nova competição”. Reaproveitar estilo atual, sem reproduzir lógica de formato fixa. Campos condicionais/lists ordenáveis acessíveis por teclado; sem `eval` ou HTML vindo de JSON. Valores padrão explícitos, categoria opcional, datas obrigatórias; tratar 409 com recarga/conciliação das escolhas em vez de sobrescrever. Evento sugere edição/datas aos filhos; não requer dupla digitação. Modalidade sem regulamento mostra indisponibilidade. Painel inicial mostra configuração/histórico; ações esportivas serão integradas na tarefa 14.
- [ ] **12.5 Executar GREEN**, `npx tsc --noEmit` e `npm run build`; registrar teste de mobile/teclado e não apenas compilação. Checkpoint sem commit.

### Task 13: Interface de equipes, competidores, importação e cópia

**Depende:** 5, 12. **Files:** criar `frontend/src/features/competicoes/{api/elencos.ts,GestaoElencos.tsx,SelecionarCompetidor.tsx,ImportarAlunos.tsx,CopiarEquipes.tsx}`, `frontend/e2e/elencos.spec.ts`; integração de `GestaoElencos` no `PainelEdicao.tsx` feita pelo integrador.

**Interfaces:** `GestaoElencos({idEdicao:number,revisao:number,estado:EstadoEdicao,onEdicaoAlterada:(edicao:EdicaoView)=>void})`; cliente `listarCompetidores(busca,pagina)`, `criarCompetidor(dados)`, `criarEquipe(idEdicao,dados,ctx)`, `inscrever(idEquipe,dados,ctx)`, `importarAlunos(idEquipe,dados,ctx)`, `copiarEquipes(idDestino,dados,ctx)` com retornos da tarefa 5.

- [ ] **13.1 Escrever testes** `terceiro sem matrícula`, `importa aluno sem expor dados privados`, `copia times para 2027 sem mudar 2026`, `revisão antiga não duplica inscrição`:

```typescript
await page.getByRole('button', { name: 'Adicionar jogador' }).click();
await expect(page.getByLabel('Nome')).toBeVisible();
await expect(page.getByLabel('Matrícula')).toHaveCount(0);
expect(elenco2027[0].id_integrante_equipe).not.toBe(elenco2026[0].id_integrante_equipe);
expect(elenco2027[0].id_competidor).toBe(elenco2026[0].id_competidor);
await expect(page.getByText('Os dados foram alterados. Atualize para continuar.')).toBeVisible();
```

- [ ] **13.2 Executar RED:** `npm run test:e2e -- e2e/elencos.spec.ts`.
- [ ] **13.3 Implementar telas.** Busca paginada, criação rápida, camisa/posição no elenco, seleção de turma/alunos com matrícula ativa e cópia seletiva. Após início, não mostrar inscrição nova; oferecer inativar sem apagar histórico. Explicar conflito de camisa/pessoa/equipe com mensagem de campo. Importação usa o endpoint autorizado mínimo da tarefa 5, sem trafegar ficha escolar completa para a tela de competição.
- [ ] **13.4 Executar GREEN**, incluindo rollback de lote inválido, jogador sem origem escolar e acesso negado a professor para escrita. Typecheck e checkpoint sem commit.

### Task 14: Painel esportivo, tabela, súmula e disciplina no frontend

**Depende:** 10, 12; integrar componente da 13 quando concluído. **Files:** criar `frontend/src/features/competicoes/{api/jogos.ts,api/disciplina.ts,PreviaTabela.tsx,Jogos.tsx,Sumula.tsx,Classificacao.tsx,Chaveamento.tsx,Disciplinar.tsx,HistoricoCorrecoes.tsx}`, `frontend/e2e/operacao.spec.ts`; modificar `PainelEdicao.tsx` após liberação do integrador.

**Interfaces:** componentes recebem `idEdicao` ou `partida:PartidaView`, `onAlterado:()=>Promise<void>` e permissão de escrita; cliente espelha comandos das tarefas 6–10. `sumulaApi.registrarOcorrencia(id,dados,ctx)` conserva UUID ao repetir falha de rede e usa novo UUID para novo ato do usuário. Revisão é a da última resposta carregada, nunca incrementada no cliente por suposição.

- [ ] **14.1 Escrever testes** `geração sem agendamento`, `gol repetido após timeout`, `completar autoria sem novo gol`, `pênaltis separados`, `reabrir bloqueado pelo bronze`, `cumprimento de suspensão`:

```typescript
await expect(page.getByText('Agendamento pendente').first()).toBeVisible();
expect(aposRetry.placar).toEqual({ mandante: 1, visitante: 0 });
expect(aposIdentificarAutor.placar).toEqual(antesIdentificarAutor.placar);
await expect(page.getByText('Classificação automática').first()).toBeVisible();
await expect(page.getByLabel('Motivo da correção')).toBeVisible();
expect(aposCumprir.cumpridos).toBe(1);
```

- [ ] **14.2 Executar RED:** `npm run test:e2e -- e2e/operacao.spec.ts`.
- [ ] **14.3 Implementar abas e ações.** Prévia editável de grupos/seeds/cruzamentos, confirmação e desfazer explícitos. Árvore renderiza duelos/vagas e não exige partida fictícia; resultados de ida/volta e bronze distintos. Súmula alterna entrada simples/detalhada, gols sem autoria, cartões, pênaltis e histórico. Oferecer motivos em reabertura/ajustes, manter campos preenchidos quando houver erro, bloquear confirmação duplicada enquanto request está pendente. Classificação não mostra empate irresolvido como classificado. Estado/publicação são ações distintas. Suspensão alerta mas não bloqueia relato; cumprimento é explícito, com jogo elegível.
- [ ] **14.4 Executar GREEN**, com finalização da edição, cancelamento preservando dados, permissão de leitura e mobile. Typecheck/build e checkpoint sem commit. Não corrigir contratos unilateralmente; integrador coordena divergências.

### Task 15: Portal público com histórico de edições

**Depende:** 11, 12. **Files:** criar `frontend/src/features/competicoes/{api/publico.ts,PortalEvento.tsx,PortalCompeticao.tsx}`, `frontend/e2e/publico.spec.ts`, `frontend/src/app/publico/competicao/[slug]/page.tsx`, `frontend/src/app/publico/competicao/[slug]/edicoes/[idEdicao]/page.tsx`; modificar `frontend/src/app/publico/evento/[slug]/page.tsx`; criar `frontend/src/app/publico/evento/[slug]/edicoes/[idEdicao]/page.tsx`.

**Interfaces:** `publicoApi` usa cliente sem interceptador de autenticação; `obterEvento(slug)`, `obterCompeticao(slug)`, `obterEdicao(id)` retornam apenas DTOs da tarefa 11. `PortalEvento({slug,idEdicaoEvento?})` e `PortalCompeticao({slug,idEdicao?})` compartilham componentes esportivos em modo leitura, com props públicas que não exigem dados privados.

- [ ] **15.1 Escrever testes** `publica rascunho sem login`, `histórico por edição`, `despublicar fecha URL direta`, `nenhum dado privado em respostas`:

```typescript
await expect(page.getByText('2026', { exact: true }).first()).toBeVisible();
expect(requestDiretoPrivado.status()).toBe(404);
expect(camposResposta).not.toContain('id_aluno_origem');
expect(camposResposta).not.toContain('documento');
await expect(page.getByText('A definir').first()).toBeVisible();
```

- [ ] **15.2 Executar RED:** `npm run test:e2e -- e2e/publico.spec.ts`.
- [ ] **15.3 Implementar portal responsivo.** Eventos/seletores incluem somente edições com disputas publicadas; permitir rascunho publicado e indicar cancelada/finalizada. Atualizar dados a cada 15 segundos enquanto página estiver visível; ao receber 404 por despublicação, remover conteúdo já exibido. Sem cache público persistente no Next para esses recursos (`cache:'no-store'` quando usar fetch). Não redirecionar anônimo ao login; mostrar indisponibilidade e permitir tentar novamente em falha de rede.
- [ ] **15.4 Executar GREEN**, viewport móvel, ausência de login e ausência de campos privados na rede, não só no HTML. Typecheck/build e checkpoint sem commit.

### Task 16: Retirada final, regressão MySQL e pacote de implantação

**Depende:** 11, 13, 14, 15. **Responsável:** integrador com revisão independente. **Files:** criar `competition_tests/consolidacao/{test_concorrencia_mysql,test_e2e_final,test_sem_legado}.py`, `scripts/testar_mysql_competicoes.py`, `docs/competition-test-map.md`; modificar suites antigas e `migration_tests/test_schema_migrations.py`, `docs/database-migrations.md`, `docs/rollout-checklist.md`, `docs/competition-drafts.md`, `Dockerfile`, `frontend/src/services/index.ts` e fixtures conforme abaixo; retirar arquivos esportivos substituídos.

**Interfaces:** runner `python scripts/testar_mysql_competicoes.py` cria container MySQL 8 descartável com nome/porta aleatórios, credenciais efêmeras e sem volumes persistentes, passa URL por ambiente aos testes e remove somente o container criado por ele em `finally`. Não lê `.env`; rejeita URL recebida externamente como alvo de limpeza. Testes usam barreiras entre duas sessões, não sleeps como sincronização. Serviços para E2E são os mesmos publicados em produção, sem bypass de regra.

O runner executa a suíte com `-m mysql`, incluindo testes de migração/equivalência
de schema parametrizados para MySQL, além de concorrência. Passa
`MYSQL_COMPETITION_TEST_URL` somente ao subprocesso; fixtures `mysql_db` criam
schema de teste nessa instância. Sem Docker/MySQL disponível, termina com erro
explícito e a validação permanece pendente. A suíte rápida usa somente `db`
SQLite; a separação por marcador não dispensa nenhuma das duas verificações.

- [ ] **16.1 Mapear e escrever testes RED.** Em `docs/competition-test-map.md`, mapear cada teste esportivo antigo para teste novo equivalente ou requisito explicitamente retirado, preservando checks de escolinhas em arquivos mistos. Acrescentar `test_mysql_importacao_concorrente`, `test_mysql_dois_gols_sem_perda`, `test_mysql_geracao_concorrente`, `test_mysql_publicacao_catalogo_concorrente`, `test_corte_preserva_dados_compartilhados`, `test_fluxo_completo_tres_formatos`:

```python
assert total_competidores_com_mesma_origem == 1
assert total_gols == 1 and sorted(statuses_mesma_revisao) == [201, 409]
assert retry_com_revisao_atualizada.placar.mandante == 2
assert total_tabelas_edicao == 1
assert versoes_ativas_modalidade_formato == 1
assert dados_compartilhados_depois == dados_compartilhados_antes
assert not rotas_registradas & rotas_legadas
```

- [ ] **16.2 Executar RED** em ambiente descartável, coletando lacunas de integração antes de retirar código. Registrar falhas ambientais separadas de defeitos; não certificar concorrência a partir de SQLite. Ajustar testes de migrações históricas para usar revisão alvo explícita 0006 ou anterior; testes de head usam descarte explícito e novo modelo. Roundtrip antigo não deve exigir downgrade destrutivo da revisão 0007.
- [ ] **16.3 Remover implementações substituídas.** Retirar routers esportivos antigos em `app/routers/{eventos,edicoes,equipes,partidas,competicoes,confrontos,individuais,classificacao,publico,publico_competicoes,publico_individuais,competicoes_v2,publico_v2}.py` e serviços esportivos antigos equivalentes, incluindo `confrontos_v2`, `sumula_v2`, `classificacao_v2`, classificações individuais/equipes. Remover schemas antigos esportivos de `app/schemas.py`, preservando os compartilhados. Remover componentes antigos em `frontend/src/components/{competicoes,competicoes-v2,publico-v2}/` depois de reaproveitar apresentação, clientes `frontend/src/services/{competicoes,competicoesV2}.ts` e tipos antigos homônimos. Atualizar exports de `services/index.ts`; manter aluno/turma/modalidade/atleta e retirar `cadastrarAtletaNaEquipe`.
- [ ] **16.4 Retirar entradas antigas de navegação.** Páginas `/dashboard/equipes`, `/dashboard/equipes/novo`, `/dashboard/equipes/[id]` e `/dashboard/edicoes/[id]` mostram aviso de fluxo descontinuado com link à página principal ou são removidas conforme ausência de links internos. Não reinterpretar ID antigo como ID novo. Remover scripts de reconciliação esportiva antigos e seus consumidores de implantação. `rg` sobre runtime deve encontrar zero referências a `Confronto`, `GrupoCompeticoes`, `equipes_participantes`, `modo_inscricao`, `/v2/competicoes`; ocorrências em migrações/documentação histórica são esperadas e não removidas indiscriminadamente.
- [ ] **16.5 Completar publicação e testes finais.** Docker deve conter o catálogo em `app/regulamentos` e o módulo CLI, sem rodá-lo no CMD. Documentar backup, target/revisão, pausa de escritas esportivas, descarte explícito, publicação de catálogo e corte conjunto API/frontend. Comandos de implantação são instruções, não executados nesta tarefa contra banco conectado. Atualizar o checkpoint antigo com link para esta consolidação sem apagar seu histórico.
- [ ] **16.6 Executar GREEN completo:** comando padrão da suíte nova; runner MySQL; `.venv/bin/python -m pytest -q migration_tests` e `tests` sob `DATABASE_URL=sqlite:///:memory:` e fixtures já corrigidas; em frontend `npm run test:e2e`, `npx tsc --noEmit`, `npm run build`; `git diff --check`. Usar timeouts suficientes por suíte, dividir execução quando necessário e registrar todos os resultados. Nenhuma falha conhecida pode ser ocultada com skip/mocks enfraquecidos. Testes dos contratos removidos podem ser aposentados somente com mapa e substituição aprovados na revisão.
- [ ] **16.7 Revisão final:** verificar spec item a item, rodar revisão de código independente conforme skills de execução e entregar relatório de evidências, diffs e instruções operacionais. Não fazer commit, merge, deploy ou descarte do banco do usuário. Marcar conclusão somente quando checks reais estiverem verdes; limitação ambiental do MySQL/navegador fica explícita como pendência, nunca como aprovação.

Comandos finais de backend, na raiz e somente após as fixtures da tarefa 1 e a
adaptação dos testes desta tarefa:

```bash
env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q -m 'not mysql' --confcutdir=competition_tests/consolidacao competition_tests/consolidacao
env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q migration_tests tests
.venv/bin/python scripts/testar_mysql_competicoes.py
git diff --check
```

Em `frontend`: `npm run test:e2e`, `npx tsc --noEmit` e `npm run build`.

## 3. Dependências e uso dos agentes

| Onda | Tarefas elegíveis | Regra de integração |
| --- | --- | --- |
| A | 1 → 2 → 3 → 4 | Sequencial; define schema e contratos antes de dividir trabalho. |
| B | 5, 6, 12 | Até três agentes: elencos, geração, formulário/organização. |
| C | 7 após 6; 8 após 5; 13 após 5+12 | Frentes independentes; arquivos compartilhados continuam com integrador. |
| D | 9 após 5+7; depois 10 após 6+7+8+9 | Súmula e integração esportiva têm dependências reais, não paralelizar artificialmente. |
| E | 11 e 14 após 10; 15 após 11+12 | API pública e painel podem avançar separados; portal consome contrato público pronto. |
| F | 16 | Integração, retirada do legado e revisão global. |

Há quatro slots na sessão: integrador + até três agentes. Cada despacho usa contexto isolado (`fork_turns="none"`), inclui spec, este plano, interfaces consumidas, arquivos autorizados e comandos de teste. Liberdade de edição vale dentro desses arquivos. Agente deve comunicar mudança necessária em arquivo compartilhado, não editar simultaneamente. Revisões e evidências pertencem à tarefa; não usar relato do agente como única prova.

Não pressupor que os arquivos untracked do trabalho anterior existam em um checkout limpo. O integrador deve conferir que o ambiente de execução contém exatamente a base revisada, sem sobrescrever alterações do usuário. Não criar commit de snapshot.

## 4. Cobertura da especificação e revisão do plano

| Seção da spec | Tarefas responsáveis |
| --- | --- |
| 1–2: escopo, preservação, reaproveitamento | 1, 16; limites globais de todas as tarefas |
| 3.1: recorrência, isolamento e elencos | 1, 4, 5, 13 |
| 3.2: regulamentos e expansão futura | 2, 3, 12 |
| 3.3–4: grupos, duelos, geração e futebol | 1, 6, 7, 10, 14 |
| 5: ocorrências, correções e auditoria | 2, 7, 9, 10, 14 |
| 6: disciplina | 1, 8, 10, 14 |
| 7: estados, exclusões, concorrência | 2, 4–6, 9–10, 16 |
| 8: APIs e experiência pública/administrativa | 4–15 |
| 9: migração e retirada | 1, 16 |
| 10: testes e aceite | RED/GREEN por tarefa e integração 16 |
| 11: execução paralela | ondas acima e revisão independente |

Checklist da revisão do plano, preenchido pelo autor após a revisão documental
(não representa execução dos testes de implementação):

- [x] Cada requisito da spec tem tarefa e teste responsável.
- [x] Assinaturas/DTOs consumidos têm produtor; contratos compartilhados têm dono.
- [x] Cada tarefa tem RED, implementação delimitada, GREEN e revisão sem commit.
- [x] As cinco condições de Review Focus têm testes nas tarefas indicadas.
- [x] Nenhuma etapa exige tocar banco conectado, perder arquivos untracked ou editar o mesmo arquivo em paralelo.
- [x] Testes MySQL e de navegador são obrigatórios e não substituídos por compilação/SQLite.

## 5. Handoff

Após a revisão do usuário, executar pelo método já escolhido: agentes com permissão
de edição, usando `superpowers:subagent-driven-development` e
`superpowers:dispatching-parallel-agents` nas ondas independentes. Não solicitar a
escolha do método novamente. Aprovação da especificação permitiu escrever este
plano; a execução aguarda a revisão deste plano.
