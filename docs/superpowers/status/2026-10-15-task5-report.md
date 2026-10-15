# Task 5 — Contratos, infraestrutura transacional e esqueleto da API

Data: 2026-10-15. Branch: `fatia-0/estabilizacao`.

Status: implementação concluída; suítes exigidas verdes em processos separados.
Há limitações preexistentes de coleta padrão e de execução conjunta, detalhadas abaixo.

## Escopo e decisões

- Fonte: `task-5-brief.md`, Global Constraints do plano e seção 5 da spec aprovada.
- Nenhuma edição de `.env`, operação em banco de desenvolvimento/produção ou mudança de dependência.
- Todos os comandos pytest usam `DATABASE_URL=sqlite:///:memory:`. As fixtures existentes usam cópias SQLite descartáveis de migrações, sob os diretórios temporários do pytest.
- Ruling aplicado: `servicos/__init__.py` existe e tem zero bytes.
- Auditoria usa `responsavel_nome` e preserva o username após exclusão do usuário; não foi criado alias `responsavel_descricao`.
- Os subrouters organização/elencos permanecem vazios e são incluídos no central. O teste HTTP de exemplo foi adaptado para uma rota temporária na aplicação de teste, pois `GET /competicoes/eventos/{id}` pertence à Task 6.
- Nenhum subagente despachado. Self-review realizado sobre todos os arquivos.

## Implementação

### Contratos

- `Contrato` centraliza `ConfigDict(extra="forbid", from_attributes=True)`, herdado pelos schemas; envelope `ErroResposta` e `Pagina[T]` possuem campos tipados.
- `Configuracao` é união discriminada por `formato`, com três modelos e defaults independentes de pontuação/disciplina.
- Pontos são inteiros estritos não negativos; limites e jogos disciplinares são positivos; `limite_amarelos=None` desabilita o limite. Booleans de configuração são estritos.
- Desempates são enums, obrigatórios nas configurações pontuadas, não vazios e sem repetição. Campos desconhecidos são recusados inclusive nos objetos aninhados.
- `validar_configuracao` injeta o formato na cópia dos dados, rejeita divergência explícita e transforma erros Pydantic em `ConfiguracaoInvalida`, com caminhos como `pontuacao.vitoria` ou `disciplina.limite_amarelos`. Mensagens internas de validação não são expostas no envelope.
- DTOs de organização incluem identidades, primeira edição, criação/atualização/detalhes de edição, publicação e páginas. Primeira edição usa o campo `edicao` em `EventoComEdicaoCriar` e `CompeticaoComEdicaoCriar`.
- `EdicaoCompeticaoAtualizar` representa PUT completo e exige `revisao`. `EdicaoEventoAtualizar` representa PATCH e preserva a distinção entre campos omitidos e enviados pelo `model_fields_set`/`model_dump(exclude_unset=True)`.
- Configuração nos DTOs é a união tipada, incluindo seu discriminador; formato da edição e formato da configuração devem coincidir.
- DTOs de elencos incluem competidores, importação de aluno, equipes, integrantes, inativação e cópia. Campo escolar é recusado. A origem do aluno só existe na saída. Camisa é opcional e informativa, sem unicidade.
- Campos de enum da edição, equipe e integrante são tipados por Literal, cobrindo a limitação do SQLite identificada na Task 4.
- Não existem `Any` nem `dict` sem parâmetros em assinaturas públicas. JSON nas funções de configuração/auditoria usa `dict[str, JsonValue]`; revisão usa `EntidadeComRevisao` (Protocol).

### Infraestrutura e HTTP

- `transacao` produz um context manager, faz commit na saída e rollback tanto em falhas do corpo quanto em falhas de commit; não abre `db.begin()` sobre o autobegin existente da sessão.
- `bloquear_edicao` usa SELECT com atualização da identity map, FOR UPDATE no dialeto MySQL e consulta funcional comum no SQLite; ausente produz `NaoEncontrado`.
- Revisão desatualizada produz `ConflitoRevisao` com campo `revisao`; incremento é explícito.
- Auditoria faz apenas add/flush e copia profundamente antes/depois, evitando mutação posterior do snapshot. FK de usuário pode tornar-se NULL preservando o nome legível.
- Cinco subclasses de domínio são mapeadas para 404/409/422 e envelope exato `codigo`, `mensagem`, `campos`. O handler também cobre a classe base.
- `main.py` inclui o router central `/competicoes`, com tag `Competições`, e registra os tratadores.

## TDD: RED e GREEN

Prefixo comum dos comandos: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest`.

1. **RED**, antes da implementação:
   `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_contratos_infra.py -v`
   Resultado: exit 2, erro de coleta esperado `ModuleNotFoundError: No module named 'competicoes.contratos'`.
2. **GREEN**, núcleo sem testes HTTP, no sandbox:
   `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_contratos_infra.py -k 'not tratadores' -v`
   Resultado: **28 passed, 6 deselected**, 0,52s.
3. **GREEN**, arquivo completo, fora do sandbox:
   `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_contratos_infra.py -v`
   Resultado: **34 passed**, exit 0, 0,55s.
4. **GREEN**, consolidação completa isolada, fora do sandbox:
   `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao`
   Resultado: **69 passed**, exit 0, 1,60s.
5. **GREEN**, regressão completa isolada, fora do sandbox:
   `timeout 60s <prefixo> -q tests`
   Resultado: **84 passed**, exit 0, 19,07s.
6. `git diff --check`: exit 0, sem erros.

Os 34 testes novos cobrem defaults, formatos, campos desconhecidos, tipos/limites, desempates, isolamento de defaults e dados de entrada, DTOs e revisão obrigatória, revisão otimista, leitura/bloqueio da edição, SQL FOR UPDATE para MySQL, commit visível em outra sessão, rollback do corpo, rollback de commit inválido, preservação da autoria e do snapshot da auditoria, ausência de commit parcial e envelopes HTTP.

Warnings observados nos processos verdes: deprecações preexistentes de `declarative_base`, Config Pydantic legado, `datetime.utcnow` e warnings de identity map de RefreshToken nos testes legados. Nenhum warning novo específico da implementação desta tarefa.

## Diagnóstico do travamento anterior

Baseline antes de editar produção:
`timeout 25s <prefixo> --confcutdir=competition_tests/consolidacao competition_tests/consolidacao -vv -o faulthandler_timeout=12`.

A execução avançou pelos mesmos 11 testes e parou em `test_rota_de_atleta_em_equipe_responde_410`. O dump mostrou a thread principal esperando `anyio.from_thread`/`TestClient` e o portal asyncio no seletor. O mesmo teste isolado com escalonamento, mesmo ambiente SQLite, passou em **0,35s**, exit 0. Portanto os testes HTTP foram executados fora do sandbox para validação efetiva. Nenhuma alteração de produção foi feita para contornar esse comportamento ambiental.

## Concerns para integração / Task 11

1. **Interação de ordem preexistente entre suítes.**
   `timeout 60s <prefixo> -q tests competition_tests/consolidacao`
   terminou com **152 passed, 1 failed**, 20,48s. Falha:
   `competition_tests/consolidacao/test_preservacao.py::test_modelos_reexportados`.
   Causa: `tests/test_routers_all.py::test_database_url_not_set` usa `importlib.reload(database)` e recria `Base`; os modelos previamente importados continuam herdando da Base original.
   Reprodução mínima:
   `timeout 60s <prefixo> -q tests/test_routers_all.py::test_database_url_not_set competition_tests/consolidacao/test_preservacao.py::test_modelos_reexportados --tb=short`
   => **1 passed, 1 failed**, 0,05s. O integrador determinou manter Task 5 nos arquivos previstos e tratar isolamento na Task 11. Nenhum teste legado foi alterado ou suprimido.
2. **Coleta padrão inclui rascunho versionado.**
   `timeout 60s <prefixo> -q` termina com exit 2 durante a coleta de `scratch/debug_test.py`: `from conftest import MockSession` resolve `migration_tests/conftest.py` e falha.
   `git ls-files scratch/debug_test.py` confirma que o arquivo está versionado neste HEAD local, embora `scratch/` conste no `.gitignore`.
   Informação do integrador: a branch remota publicou posteriormente o commit `d6a9095`, removendo exatamente esse arquivo. A remoção será tratada na integração/Task 11, sem desviar Task 5.
3. **Bloqueio MySQL.** O teste confirma o SQL MySQL emitido (`FOR UPDATE`) e a opção `populate_existing`. A Task 5 não executou concorrência/bloqueio contra um servidor MySQL real; essa validação permanece no harness/portão de integração.
4. **Consumo pelos serviços futuros.** Regras de datas entre pais/filhos, permissão, unicidade traduzida, estado esportivo e persistência da configuração normalizada pertencem às Tasks 6/7. Os serviços devem abrir `transacao` uma única vez por operação, bloquear antes de alterar, salvar configuração com `model_dump(mode="json")` e tratar PATCH com `exclude_unset=True`.

## Arquivos

Criados:

- `app/competicoes/contratos/__init__.py`
- `app/competicoes/contratos/comuns.py`
- `app/competicoes/contratos/configuracao.py`
- `app/competicoes/contratos/organizacao.py`
- `app/competicoes/contratos/elencos.py`
- `app/competicoes/erros.py`
- `app/competicoes/infra.py`
- `app/competicoes/api/__init__.py`
- `app/competicoes/api/organizacao.py`
- `app/competicoes/api/elencos.py`
- `app/competicoes/servicos/__init__.py` (vazio)
- `competition_tests/consolidacao/test_contratos_infra.py`

Modificado: `app/main.py` (quatro linhas: imports, include_router, registro de handlers).

Este relatório foi copiado do artefato local ignorado para o checkpoint versionado da tarefa 5.

## Self-review

- Confirmado o escopo da Task 5 e os três rulings.
- Revisadas assinaturas contra Interfaces e consumidores das Tasks 6/7/8.
- Revisados os caminhos de falha de configuração, commit e revisão, sem commits nos helpers de bloqueio/auditoria.
- Confirmados limites, enums, nomes dos campos, ausência de aliases legados e de campos escolares indevidos.
- Conferidos imports planos `competicoes`, ausência de alteração de modelo/migração/autenticação/escolinhas e package de serviços vazio.
- Resultados de falhas preexistentes explicitamente preservados neste relatório.

Commit: `40334b2` — `feat(competicoes): contratos, infra transacional e esqueleto da API`.
O índice passou por `git diff --cached --check` antes do commit; os 13 arquivos previstos foram incluídos. `git add` precisou de escalonamento porque `.git/index.lock` é somente leitura no sandbox; o commit foi executado com o mesmo escalonamento.

## Fix round 1 — checkpoint §5.2

A revisão apontou três requisitos do checkpoint que estavam ausentes do brief lido na implementação inicial. O checkpoint foi lido integralmente nesta rodada. Escopo adicional autorizado: `competition_tests/consolidacao/conftest.py`; nenhum arquivo alheio foi alterado.

### Correções

1. `registrar_tratadores` registra `RequestValidationError` e devolve 422 com envelope exato `codigo`, `mensagem`, `campos`. O código é `CONFIGURACAO_INVALIDA`, a mensagem é genérica e os campos são caminhos únicos sem o prefixo HTTP (`body`, `query`, `path`, `header`, `cookie`). A resposta não serializa a entrada inválida nem mensagens/contexto internos do Pydantic. O teste inclui campo escolar com conteúdo privado e confirma o envelope sem esse conteúdo.
2. `_PeriodoEdicao` aplica um `model_validator(mode="after")` compartilhado para recusar `data_inicio > data_fim`. É herdado por criação de edição de evento/competição, PUT de edição de competição, PATCH de edição de evento e detalhes correspondentes. As datas de criação continuam obrigatórias. PATCH aceita uma única data ou datas iguais; a comparação com o valor persistido quando apenas uma data chega continua sendo responsabilidade da Task 6.
3. Fixtures compartilhadas adicionadas:
   - `client(db)`: TestClient real com `get_db` sobreposto à mesma sessão SQLite; restaura os overrides anteriores no teardown.
   - `usuario(db)`: coordenador persistido por commit no setup do banco descartável, preservado mesmo após rollback da operação testada.
   - `cabecalhos_por_papel(db, usuario)`: retorna função `cabecalhos_por_papel(role)`, para `None`, `admin`, `coordenador`, `professor` e `assistente`. `None` retorna `{}`; os demais produzem Bearer JWT por `security.create_access_token`. A conta coordenadora é a fixture `usuario`. As outras contas são persistidas no setup da fixture, evitando commit de dados de negócio ao solicitar cabeçalhos no corpo do teste. Não há substituição de dependência de autenticação.

### RED / GREEN

Mesmo prefixo de pytest e mesmas restrições SQLite da execução inicial. Testes HTTP e suítes completas executados fora do sandbox.

- **RED**: `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_contratos_infra.py -k 'validacao_http or periodo or patch_aceita or fixtures_autenticam or fixture_usuario' --tb=short`.
  Resultado: **6 failed, 3 passed, 6 errors**, 34 deselected, 0,38s. Duas falhas de envelope HTTP, quatro de datas invertidas e seis erros pelas fixtures ausentes. Os três casos já verdes caracterizam a aceitação de PATCH parcial/período de um dia.
- GREEN por correção: validação HTTP **2 passed**; datas/PATCH **7 passed**; fixtures com JWT real **6 passed**.
- **GREEN focado**: `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_contratos_infra.py --disable-warnings` => **49 passed**, 23 warnings, 0,63s, exit 0.
- **GREEN consolidação completa, processo próprio**: `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao --disable-warnings` => **84 passed**, 23 warnings, 1,75s, exit 0.
- **GREEN regressão completa, processo próprio**: `timeout 60s <prefixo> -q tests --disable-warnings` => **84 passed**, 293 warnings, 19,23s, exit 0.
- `git diff --check` => exit 0.

### Self-review e concerns

Revisados o handler sem vazamento da entrada, localização de campos, herança da validação de datas, obrigatoriedade das datas na criação, autenticação JWT sem mocks e uso da mesma sessão SQLite. As rotas usadas para provar as fixtures existem apenas no teste e são removidas no teardown.

Os concerns anteriores de ordem entre suítes, coleta do rascunho versionado e validação em MySQL real permanecem registrados para integração. Não foram introduzidos skips ou alterações nos testes legados. As Tasks 6/7 podem consumir as três fixtures, sem editar `conftest.py` ou `factories.py`.

Arquivos alterados nesta rodada: `app/competicoes/erros.py`, `app/competicoes/contratos/organizacao.py`, `competition_tests/consolidacao/conftest.py`, `competition_tests/consolidacao/test_contratos_infra.py`.

Commit de fix: `761b95f` — `fix(competicoes): completar contratos e fixtures do checkpoint`. Árvore limpa após commit; `git diff HEAD --check` sem erros.

## Fix round 2 — escopo HTTP e preservação das escolinhas

A revisão identificou que o handler global de validação alterava o 422 dos formulários de escolinhas, que consomem `detail`. A rodada foi limitada a `app/competicoes/erros.py` e seus testes em `test_contratos_infra.py`. O integrador também solicitou cobertura do envelope para 401/403 levantados pelas dependências reais de segurança.

### Correções e self-review

- O handler de `RequestValidationError` produz o envelope apenas para o caminho exato `/competicoes` ou seu subcaminho `/competicoes/…`. Outros caminhos delegam ao `request_validation_exception_handler` padrão do FastAPI. A fronteira do prefixo é explícita: `/competicoes-outro` continua com `detail`.
- Adicionado handler de `starlette.exceptions.HTTPException`, que também alcança as exceções FastAPI levantadas pelas dependências de segurança. Sob `/competicoes`, 401 recebe `NAO_AUTENTICADO`, 403 recebe `ACESSO_NEGADO`, 404 recebe `NAO_ENCONTRADO`; outros status HTTP usam `ERRO_HTTP`. Os erros de domínio continuam com seus códigos específicos.
- As respostas HTTP de competições têm os três campos exatos e preservam headers como `WWW-Authenticate: Bearer`. Fora do domínio, o handler delega ao `http_exception_handler` padrão, preservando `detail` e os headers originais.
- Testes usam `check_coordenador_role`, JWT e sessão SQLite reais, sem mocks de autenticação: ausência de token produz 401; professor recebe 403; coordenador recebe 200. Os mesmos cenários são exercitados em caminho de escolinhas.
- Não houve alteração em `security.py`, frontend, contratos de negócio, fixtures ou rotas operacionais. Self-review conferiu fronteira de prefixo, delegação padrão, códigos e preservação dos headers.

### RED / GREEN

Mesmo prefixo e ambiente SQLite dos comandos anteriores; HTTP fora do sandbox.

- **RED validação por domínio**: `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_contratos_infra.py -k envelope_de_validacao_limitado --disable-warnings --tb=short` => **2 failed, 2 passed**, 49 deselected, 0,30s. Os caminhos de escolinhas e prefixo semelhante recebiam o envelope indevidamente.
- **RED 401/403**: `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_contratos_infra.py -k erros_de_seguranca --disable-warnings --tb=short` => **2 failed, 4 passed**, 53 deselected, 0,49s. 401 e 403 de competições ainda devolviam `detail`.
- **GREEN focado completo**: `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_contratos_infra.py --disable-warnings` => **59 passed**, 27 warnings, 0,69s, exit 0.
- **GREEN consolidação completa**: `timeout 60s <prefixo> -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao --disable-warnings` => **94 passed**, 27 warnings, 1,89s, exit 0. Inclui a rota legada 410.
- **GREEN regressão isolada**: `timeout 60s <prefixo> -q tests --disable-warnings` => **84 passed**, 293 warnings, 19,10s, exit 0.
- `git diff --check` => exit 0.

Concerns anteriores de coleta padrão/ordem entre suítes e verificação MySQL permanecem para integração. Nenhuma ampliação do domínio nesta rodada.

Commit do fix round 2: `5bbf609` — `fix(competicoes): limitar envelopes HTTP ao dominio esportivo`.
