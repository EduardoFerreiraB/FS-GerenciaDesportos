# Fatias 0 e 1 — Fundação de Banco e Domínio de Competições — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development para implementar este plano tarefa por tarefa, e superpowers:dispatching-parallel-agents nas ondas marcadas como paralelas. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer o baseline de banco verificável e o domínio novo de identidade, recorrência, competidores e elencos, retirando os três caminhos esportivos antigos do runtime e do banco.

**Architecture:** O baseline Alembic passa a ser derivado do metadata ORM, tornando a equivalência schema↔ORM verificável por construção e em MySQL real. O domínio novo vive no pacote `competicoes`, isolado das escolinhas: modelos e constraints garantem integridade (FK composta por edição, unicidade de inscrição), contratos Pydantic com união discriminada por formato substituem `dict/Any`, e serviços transacionais são a única porta de escrita. A edição da competição é a unidade de disputa; as fatias 2 a 4 pendurarão grupos, partidas, súmula e portal nela.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic 2; MySQL 8 (produção e harness descartável) e SQLite (suíte rápida); Next.js 16.1.3, React 19.2.3, TypeScript 5, SWR, axios. Não atualizar dependências de produção neste trabalho.

**Spec:** [Consolidação de competições em fatias entregáveis](../specs/2026-10-15-competicoes-fatias-design.md), seções 4 e 5.

## Global Constraints

Valores copiados da especificação. Valem para todas as tarefas.

- Não alterar `.env`. Não executar teste contra banco de desenvolvimento ou produção. A única operação permitida no banco conectado é o `alembic stamp` conferido da tarefa 1, **executada pelo usuário**, nunca por um agente.
- Preservar usuários, autenticação, refresh tokens, professores, modalidades, locais, árbitros, alunos, turmas, dias de turma, matrículas e presenças. A tabela `participantes` **permanece**: é infraestrutura das escolinhas.
- `atletas` permanece como cadastro, deixando de ser caminho de inscrição em competições.
- Commits em branch `fatia-0/estabilizacao`; merge em `main` somente por fatia aprovada. Commit por tarefa.
- Somente futebol. Nenhuma tabela vazia para modalidade futura.
- Imports do backend são planos (`PYTHONPATH=app`): o pacote novo é importado como `competicoes`, não `app.competicoes`.
- Estados da edição: `RASCUNHO`, `EM_ANDAMENTO`, `FINALIZADA`, `CANCELADA`. `publicada` é booleano independente do estado.
- Formatos: `PONTOS_CORRIDOS`, `GRUPOS_MATA_MATA`, `MATA_MATA`. Sem aliases.
- `numero_camisa` não tem restrição de unicidade (decisão de 2026-10-15).
- Permissões: escrita exige `check_coordenador_role` (admin ou coordenador) de `app/security.py`. Leitura do painel exige `get_current_active_user`.
- Erros: 401 sem autenticação, 403 sem permissão, 404 inexistente, 409 estado/revisão/duplicidade, 422 campo ou combinação inválida. Resposta de erro traz `codigo`, `mensagem` e `campos`; nunca SQL, credencial ou traceback.
- Comando de teste canônico:
  ```bash
  env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app \
    .venv/bin/python -m pytest -q <alvo>
  ```
- Nenhuma tarefa se declara pronta por compilar. `tsc --noEmit` e `npm run build` não substituem teste.

## Review Focus

Cinco condições que a especificação implica e que o caminho felizmente testado não exercita. Cada linha tem seu teste atribuído à tarefa dona do código.

1. **Upgrade sem a opção de descarte apaga tabelas esportivas.** A revisão de consolidação precisa recusar **antes do primeiro DDL**, não no meio. Teste na tarefa 4.
2. **Alterar o período de uma edição de evento cujos filhos não caberiam mais.** Deve falhar com 409 e período inalterado, nunca ajustar datas das edições esportivas silenciosamente. Teste na tarefa 6.
3. **Duas importações concorrentes do mesmo aluno.** Devem resultar em um único competidor; a segunda recebe o existente ou conflito, nunca uma pessoa duplicada. Teste na tarefa 7.
4. **Excluir um aluno que foi importado.** O competidor sobrevive com `id_aluno_origem` nulo e o elenco histórico permanece íntegro, inclusive `nome_esportivo`. Teste na tarefa 7.
5. **`PUT` de edição com `revisao` desatualizada.** Deve retornar 409 sem gravar, inclusive quando o payload é idêntico ao estado atual. Teste na tarefa 6.

## Ondas e uso de subagentes

Dependências reais, não divisão artificial. Um agente nunca edita arquivo de outro agente da mesma onda.

| Onda | Tarefas | Paralelismo | Por quê |
| --- | --- | --- | --- |
| A | 1, 2 | **2 agentes** | Baseline mexe em `alembic/`; higiene mexe em `.gitignore`, `docker-compose.yml`, `tests/conftest.py`. Zero sobreposição. |
| B | 3 | 1 agente | Harness MySQL valida o baseline da tarefa 1; precisa dele pronto. |
| C | 4 | 1 agente, integrador | Modelos e consolidação. Remove classes de `app/models.py` e o legado do runtime no mesmo commit, senão a aplicação não importa. Bloqueia tudo. |
| D | 5 | 1 agente | Contratos, infra e esqueleto da API. Define as assinaturas que a onda E consome. |
| E | 6, 7, 8 | **3 agentes** | Organização (serviço+rotas), elencos (serviço+rotas) e contratos TypeScript+cliente. Arquivos disjuntos; todos consomem a tarefa 5. |
| F | 9, 10 | **2 agentes** | Telas de organização e telas de elencos. Arquivos disjuntos; ambas consomem a tarefa 8. |
| G | 11 | 1 agente | Integração, regressão e portão da fatia 1. |

Cada despacho recebe contexto isolado: esta spec, este plano, o bloco Interfaces das tarefas que consome, a lista de arquivos autorizados e os comandos de teste. Um agente que precise alterar arquivo de outro **comunica**, não edita. Relato de agente não é evidência: o integrador roda os testes.

**Tarefa 0 — concluída.** Snapshot do V1/V2 commitado em `c139d9b` na branch `fatia-0/estabilizacao`, 115 arquivos, enviado ao remoto. Estado registrado: 326 testes passando, 1 falha em `migration_tests`, sem verificação em MySQL ou navegador.

---

# Fatia 0 — Estabilização

## Task 1: Baseline Alembic derivado do ORM

**Depende:** tarefa 0. **Onda A, paralela com a tarefa 2.** **Dono dos arquivos:** `alembic/`, `scripts/gerar_baseline.py`, `migration_tests/`, `docs/database-migrations.md`.

**Files:**
- Create: `alembic/versions/20261015_0100_baseline.py`, `scripts/gerar_baseline.py`, `alembic/versions_arquivadas/README.md`, `migration_tests/arquivados/__init__.py`
- Modify: `alembic/env.py`, `docs/database-migrations.md`
- Move: `alembic/versions/20260824_000{1,2,3,4,5}_*.py` e `alembic/versions/20260914_0006_competicao_v2.py` → `alembic/versions_arquivadas/`; `migration_tests/test_confrontos_migration.py`, `test_equipes_historicas_migration.py`, `test_individuais_migration.py`, `test_validar_migracao_confrontos.py`, `test_validar_migracao_equipes.py` → `migration_tests/arquivados/`
- Test: `migration_tests/test_schema_migrations.py` (mantém o arquivo, que já compara schema com ORM)

**Interfaces:**
- Produces: revisão `20261015_0100` como única `head`, sem `down_revision`. `scripts/gerar_baseline.py` com `gerar(destino: Path) -> Path`, que regenera a revisão a partir do metadata e devolve o caminho escrito.
- Produces: `alembic/env.py` passa a aceitar `config.attributes["target_metadata"]`, com `None` como padrão. Execuções normais seguem sem metadata, preservando DDL congelado; só o gerador injeta.

- [ ] **Step 1: Escrever o teste que falha**

Em `migration_tests/test_schema_migrations.py`, acrescentar:

```python
def test_baseline_e_unica_head(tmp_path):
    from alembic.script import ScriptDirectory
    script = ScriptDirectory.from_config(alembic_config(f"sqlite:///{tmp_path / 'x.sqlite'}"))
    assert [revision.revision for revision in script.get_revisions("heads")] == ["20261015_0100"]
    assert script.get_revision("20261015_0100").down_revision is None


def test_env_sem_metadata_por_padrao():
    import importlib.util
    spec = importlib.util.spec_from_file_location("env_alembic", ROOT / "alembic" / "env.py")
    assert spec is not None  # o módulo roda sob contexto Alembic; inspecionar o fonte
    fonte = (ROOT / "alembic" / "env.py").read_text()
    assert 'config.attributes.get("target_metadata")' in fonte
    assert "import models" not in fonte
```

O teste existente `test_upgrade_empty_sqlite_matches_current_schema_and_constraints` já cobre a equivalência e hoje **falha** na unicidade de `grupos_competicoes.slug`; ele é o critério principal desta tarefa.

- [ ] **Step 2: Rodar para verificar que falha**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q migration_tests/test_schema_migrations.py -v`
Expected: `test_baseline_e_unica_head` FAIL (revisão inexistente), `test_env_sem_metadata_por_padrao` FAIL, `test_upgrade_empty_sqlite_...` FAIL em `assert {('slug',)} == set()`.

- [ ] **Step 3: Habilitar metadata injetável em `alembic/env.py`**

Trocar `target_metadata = None` por leitura de `config.attributes.get("target_metadata")`, usada tanto em `run_migrations_offline` quanto em `run_migrations_online`. Manter o comentário explicando que execuções normais não carregam modelos e que a injeção existe apenas para o gerador de baseline. Não adicionar `import models` ao módulo.

- [ ] **Step 4: Implementar `gerar(destino: Path) -> Path` em `scripts/gerar_baseline.py`**

Cria um SQLite temporário vazio, monta um `Config` com `attributes["target_metadata"] = models.Base.metadata` e `attributes["database_url"]` apontando para ele, e chama `command.revision(config, autogenerate=True, rev_id="20261015_0100", message="baseline derivado do metadata ORM")`. Mover o arquivo gerado para `destino`. O script é ferramenta de desenvolvimento: recusa execução se `DATABASE_URL` do ambiente não for SQLite.

- [ ] **Step 5: Gerar a revisão e arquivar a cadeia antiga**

Run: `env DATABASE_URL=sqlite:///:memory: PYTHONPATH=app .venv/bin/python scripts/gerar_baseline.py`

Depois: mover as seis revisões para `alembic/versions_arquivadas/` e os cinco testes de migração histórica para `migration_tests/arquivados/`. Conferir `down_revision = None` na revisão gerada. Escrever `alembic/versions_arquivadas/README.md` com: por que foram arquivadas (reconciliação de dados históricos rodando contra zero linhas, downgrades já bloqueados), que não estão na cadeia, e que a revisão `20261015_0100` descreve o mesmo schema que elas produziam.

- [ ] **Step 6: Rodar os testes para verificar que passam**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q migration_tests`
Expected: PASS, sem falhas e sem testes coletados de `migration_tests/arquivados/`.

- [ ] **Step 7: Documentar a adoção do baseline**

Em `docs/database-migrations.md`, substituir a seção de baseline antiga por: banco novo roda `alembic upgrade head` e chega à `20261015_0100`; banco existente confere equivalência e **o usuário** executa `alembic stamp 20261015_0100`; qualquer divergência interrompe a adoção; `alembic downgrade` segue proibido contra banco com dados. Retirar as instruções que apontam para as revisões arquivadas.

- [ ] **Step 8: Commit**

```bash
git add alembic scripts/gerar_baseline.py migration_tests docs/database-migrations.md
git commit -m "refactor(db): baseline Alembic derivado do metadata ORM"
```

## Task 2: Higiene do repositório, credenciais e isolamento de teste

**Depende:** tarefa 0. **Onda A, paralela com a tarefa 1.** **Dono dos arquivos:** `.gitignore`, `docker-compose.yml`, `.env.example`, `tests/conftest.py`.

**Files:**
- Modify: `.gitignore`, `docker-compose.yml`, `.env.example`, `tests/conftest.py`
- Test: `tests/test_conftest_isolamento.py` (criar)

**Interfaces:**
- Produces: `docker-compose.yml` sem credencial literal, lendo `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` do ambiente.
- Produces: a fixture de banco de `tests/conftest.py` passa a usar `tmp_path_factory`; nenhum teste cria `test.db` na raiz.

- [ ] **Step 1: Escrever o teste que falha**

```python
# tests/test_conftest_isolamento.py
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]


def test_conftest_nao_usa_banco_fixo_na_raiz():
    fonte = (RAIZ / "tests" / "conftest.py").read_text()
    assert "test.db" not in fonte
    assert "tmp_path_factory" in fonte


def test_nenhum_banco_de_teste_na_raiz():
    assert not (RAIZ / "test.db").exists()
    assert not (RAIZ / "test-task2.db").exists()


def test_compose_sem_credencial_literal():
    fonte = (RAIZ / "docker-compose.yml").read_text()
    assert "D252310m" not in fonte
    assert "root_password_segura" not in fonte
    assert "${MYSQL_PASSWORD" in fonte
    assert "${MYSQL_ROOT_PASSWORD" in fonte
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q tests/test_conftest_isolamento.py -v`
Expected: as três FAIL.

- [ ] **Step 3: Isolar a fixture de banco em `tests/conftest.py`**

Trocar o SQLite fixo na raiz por um arquivo sob `tmp_path_factory`, preservando as fixtures existentes e seus nomes — os testes de escolinhas consomem essas fixtures e não devem ser alterados nesta tarefa. Remover `test.db` e `test-task2.db` do diretório de trabalho.

- [ ] **Step 4: Parametrizar as credenciais do compose**

Em `docker-compose.yml`, trocar os quatro valores literais por `${MYSQL_DATABASE}`, `${MYSQL_USER}`, `${MYSQL_PASSWORD}` e `${MYSQL_ROOT_PASSWORD}`. O `healthcheck` do serviço `db` usa `-p$$MYSQL_PASSWORD` em vez da senha literal. Documentar os quatro nomes em `.env.example` sem valores reais. Acrescentar ao `.gitignore`: `htmlcov/`, `scratch/`, `coverage_output.txt`.

- [ ] **Step 5: Rodar os testes para verificar que passam**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q tests`
Expected: PASS, incluindo os três novos e a suíte de escolinhas inalterada.

- [ ] **Step 6: Commit**

```bash
git add .gitignore docker-compose.yml .env.example tests/conftest.py tests/test_conftest_isolamento.py
git commit -m "chore: isola banco de teste e retira credenciais do compose"
```

> As credenciais atuais já estão no histórico do git. A rotação no ambiente local é ação do usuário, fora do escopo de código. Registrar isso no relato da tarefa.

## Task 3: Harness de schema em MySQL 8 descartável

**Depende:** tarefas 1 e 2. **Onda B, sequencial.** **Dono dos arquivos:** `scripts/testar_mysql_competicoes.py`, `migration_tests/test_harness_mysql.py`.

**Files:**
- Create: `scripts/testar_mysql_competicoes.py`, `scripts/__init__.py`, `migration_tests/test_harness_mysql.py`
- Modify: `docs/database-migrations.md` (seção de verificação), `pytest.ini` ou `pyproject.toml` (marker `mysql`)

`scripts/__init__.py` existe para que `from scripts.testar_mysql_competicoes import ...` funcione com `PYTHONPATH=app:.`; os dois validadores já presentes em `scripts/` continuam executáveis como antes.

**Interfaces:**
- Produces: `comparar_schema(url: str) -> list[str]`, que aplica `upgrade head` na URL dada e devolve a lista de divergências entre o schema resultante e `models.Base.metadata` — vazia quando equivalentes. Compara tabelas, colunas, nulabilidade, tipos compilados no dialeto, defaults de servidor, chaves primárias, unicidade, índices, chaves estrangeiras e `ondelete`.
- Produces: `main(argv) -> int`, que sobe o container, chama `comparar_schema`, imprime as divergências e devolve 0 ou 1.
- Consumes: a revisão `20261015_0100` da tarefa 1 como única head.

- [ ] **Step 1: Escrever o teste que falha**

```python
# migration_tests/test_harness_mysql.py
import pytest

from scripts.testar_mysql_competicoes import comparar_schema


def test_comparar_schema_sem_divergencia_em_sqlite(tmp_path):
    assert comparar_schema(f"sqlite:///{tmp_path / 'fresh.sqlite'}") == []


def test_comparar_schema_detecta_coluna_faltante(tmp_path, monkeypatch):
    """Remover uma coluna do metadata precisa aparecer como divergência."""
    url = f"sqlite:///{tmp_path / 'divergente.sqlite'}"
    comparar_schema(url)
    import models
    tabela = models.Base.metadata.tables["competidores"]
    coluna = tabela.c["documento"]
    tabela._columns.remove(coluna)
    try:
        assert any("documento" in linha for linha in comparar_schema(url))
    finally:
        tabela.append_column(coluna)


def test_harness_recusa_url_externa(monkeypatch):
    from scripts.testar_mysql_competicoes import main
    monkeypatch.setenv("DATABASE_URL", "mysql+pymysql://u:p@prod/db")
    with pytest.raises(SystemExit):
        main(["--usar-database-url"])


@pytest.mark.mysql
def test_schema_equivale_orm_em_mysql():
    from scripts.testar_mysql_competicoes import main
    assert main([]) == 0
```

O teste de coluna faltante usa `competidores`, criada na tarefa 4; até lá, usar `alunos`. Trocar para `competidores` como passo da tarefa 11.

- [ ] **Step 2: Rodar para verificar que falha**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app:. .venv/bin/python -m pytest -q migration_tests/test_harness_mysql.py -m 'not mysql' -v`
Expected: FAIL com `ModuleNotFoundError: scripts.testar_mysql_competicoes`.

- [ ] **Step 3: Implementar o harness**

`comparar_schema` usa `sqlalchemy.inspect` contra o metadata, no mesmo estilo de comparação já presente em `migration_tests/test_schema_migrations.py` — reaproveitar a lógica, estendendo para índices e `ondelete`, que o teste atual não cobre.

`main` sobe `mysql:8.0` via `docker run --rm -d` com porta efêmera, banco de nome aleatório (`harness_<uuid4().hex[:8]>`) e senha gerada na hora; espera o healthcheck; chama `comparar_schema`; e derruba o container em `finally`, inclusive em exceção. **Nunca** usa `DATABASE_URL` do ambiente: se `--usar-database-url` for passado ou a variável apontar para algo que não seja o container criado por ele, sair com erro explicando o risco. Registrar `mysql` em `pytest.ini`/`pyproject` como marker, para `-m 'not mysql'` funcionar sem aviso.

- [ ] **Step 4: Rodar os testes para verificar que passam**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app:. .venv/bin/python -m pytest -q migration_tests -m 'not mysql'`
Expected: PASS.

Run: `env PYTHONPATH=app:. .venv/bin/python scripts/testar_mysql_competicoes.py`
Expected: saída sem divergências, código de retorno 0.

- [ ] **Step 5: Documentar o comando de verificação**

Em `docs/database-migrations.md`, acrescentar o comando do harness como verificação obrigatória antes de qualquer release, deixando explícito que ele cria e destrói o próprio banco e nunca toca o banco configurado.

- [ ] **Step 6: Commit**

```bash
git add scripts/testar_mysql_competicoes.py migration_tests/test_harness_mysql.py docs/database-migrations.md
git commit -m "test(db): harness de equivalencia schema/ORM em MySQL descartavel"
```

### Portão da fatia 0

- `migration_tests` verde, incluindo a equivalência schema↔ORM que hoje falha.
- `tests` + `competition_tests` seguem 326 passando: a fatia 0 não toca domínio.
- `env PYTHONPATH=app:. .venv/bin/python scripts/testar_mysql_competicoes.py` → 0.
- `git diff --check` limpo.
- **Passo manual do usuário**, não de agente: conferir equivalência do banco de dev e rodar `alembic stamp 20261015_0100`.

---

# Fatia 1 — Identidade, recorrência, competidores e elencos

## Task 4: Modelos definitivos, revisão de consolidação e retirada do legado

**Depende:** tarefa 3. **Onda C, um agente integrador.** Bloqueia todas as demais.

As duas metades vão no mesmo commit porque remover classes de `app/models.py` quebra o import dos routers antigos: entre uma e outra a aplicação não sobe.

**Files:**
- Create: `app/competicoes/__init__.py`, `app/competicoes/modelos/{__init__,organizacao,pessoas,operacao}.py`, `alembic/versions/20261015_0200_consolidacao_futebol.py`, `competition_tests/consolidacao/{__init__,conftest,factories,test_schema,test_preservacao}.py`
- Modify: `app/models.py`, `app/main.py`, `app/services/alunos.py`, `app/services/atletas.py`, `app/routers/atletas.py`, `app/schemas.py`, `tests/conftest.py`
- Delete: `app/routers/{competicoes,competicoes_v2,confrontos,individuais,classificacao,publico_competicoes,publico_individuais,publico_v2,equipes,partidas,edicoes}.py`; `app/services/{competicoes,confrontos,confrontos_v2,classificacao_equipes,classificacao_individuais,classificacao_v2,individuais,sumula_v2,equipes,partidas,edicoes}.py`; `competition_tests/test_*.py` (os 16 antigos); `tests/{test_competicoes,test_competicoes_novo_modelo,test_compatibilidade_competicao_equipes,test_equipes_por_competicao,test_legacy_clone_equipes_rejeitado,test_integration_fluxo3_competicao}.py`

**Interfaces:**
- Produces, em `competicoes.modelos.organizacao`: `Evento`, `EdicaoEvento`, `Competicao`, `EdicaoCompeticao`.
- Produces, em `competicoes.modelos.pessoas`: `Competidor`, `Equipe`, `IntegranteEquipe`.
- Produces, em `competicoes.modelos.operacao`: `AuditoriaCompeticao`, `RequisicaoPartida`.
- Produces: `competicoes.modelos.__init__` reexporta as nove classes. Todas usam `database.Base`.
- Produces: `EdicaoCompeticao.id_edicao_competicao` é a chave que todo vínculo esportivo das fatias 2 a 4 referencia.

Colunas e restrições: seção 5 da spec, subseções 5.2 a 5.5 e 5.7. Nomes de coluna exatamente como lá.

- [ ] **Step 1: Escrever os testes de schema que falham**

```python
# competition_tests/consolidacao/test_schema.py
def test_tabelas_novas_existem(schema_migrado):
    assert {
        "eventos", "edicoes_evento", "competicoes", "edicoes_competicao",
        "competidores", "equipes", "integrantes_equipe",
        "auditoria_competicao", "requisicoes_partida",
    } <= set(schema_migrado.get_table_names())


def test_tabelas_antigas_removidas(schema_migrado):
    assert not {
        "equipes_participantes", "partidas", "estatisticas_partida", "confrontos",
        "jogadores", "grupos_competicoes", "edicoes", "modalidades_evento",
        "inscricoes_individuais", "provas", "resultados_prova",
        "migracao_equipes_origem", "migracao_partidas_origem",
    } & set(schema_migrado.get_table_names())


def test_tabelas_de_escolinhas_preservadas(schema_migrado):
    assert {
        "usuarios", "refresh_tokens", "professores", "modalidades", "turmas",
        "turmas_dias", "alunos", "matriculas", "presencas", "participantes",
        "atletas", "locais", "arbitros",
    } <= set(schema_migrado.get_table_names())


def test_fk_impede_integrante_de_equipe_de_outra_edicao(db):
    # equipe pertence à edição A; integrante declara edição B
    with pytest.raises(IntegrityError):
        db.flush()


def test_competidor_em_duas_equipes_da_mesma_edicao_e_rejeitado(db):
    with pytest.raises(IntegrityError):
        db.flush()


def test_camisa_repetida_na_mesma_equipe_e_permitida(db):
    db.flush()  # não levanta: camisa não tem unicidade


def test_excluir_aluno_anula_origem_e_preserva_competidor(db):
    # SET NULL, competidor e nome_esportivo intactos
    ...


def test_identificacao_de_edicao_e_unica_por_competicao_nao_global(db):
    # "2026" em duas competições diferentes: permitido
    # "2026" duas vezes na mesma competição: IntegrityError
    ...
```

```python
# competition_tests/consolidacao/test_preservacao.py
def test_upgrade_exige_descarte_explicito(sqlite_na_revisao_anterior):
    """Sem a opção, recusa antes de qualquer DDL e o schema fica intacto."""
    antes = set(inspect(engine).get_table_names())
    with pytest.raises(RuntimeError, match="descartar_competicoes_teste"):
        command.upgrade(config_sem_opcao, "head")
    assert set(inspect(engine).get_table_names()) == antes


def test_upgrade_preserva_dados_de_escolinhas(sqlite_com_dados_sinteticos):
    assert depois.alunos == antes.alunos
    assert depois.turmas == antes.turmas
    assert depois.matriculas == antes.matriculas
    assert depois.presencas == antes.presencas
    assert depois.participantes == antes.participantes
    assert depois.usuarios == antes.usuarios


def test_downgrade_da_consolidacao_falha_sem_mutar(sqlite_na_head):
    antes = set(inspect(engine).get_table_names())
    with pytest.raises(RuntimeError, match="backup"):
        command.downgrade(config, "-1")
    assert set(inspect(engine).get_table_names()) == antes


def test_importar_main_nao_cria_tabelas(tmp_path):
    """main não chama create_all; um banco vazio segue vazio após o import."""
    ...


def test_mappers_carregam():
    from sqlalchemy.orm import configure_mappers
    configure_mappers()
```

`conftest.py` desta pasta cria SQLite sob `tmp_path_factory` e expõe `db`, `schema_migrado`, `sqlite_na_revisao_anterior`, `sqlite_com_dados_sinteticos` e `sqlite_na_head`. `factories.py` monta evento, competição, edição, competidor, equipe e integrante mínimos, para os testes das tarefas 6 e 7 reusarem.

- [ ] **Step 2: Rodar para verificar que falha**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao -v`
Expected: erros de coleção por modelos e revisão inexistentes.

- [ ] **Step 3: Implementar os nove modelos**

Em `app/competicoes/modelos/`, conforme a seção 5 da spec. Pontos que o teste não determina sozinho:

- `equipes` declara `UniqueConstraint("id_edicao_competicao", "id_equipe")` para ser alvo da `ForeignKeyConstraint(["id_edicao_competicao", "id_equipe"], ["equipes.id_edicao_competicao", "equipes.id_equipe"])` de `integrantes_equipe`.
- `competidores.id_aluno_origem` usa `ondelete="SET NULL"` e o relacionamento **não** usa `delete-orphan`.
- `edicoes_competicao.configuracao` é `JSON`; `formato` e `estado` são `Enum` com os valores fixados nas Global Constraints.
- `auditoria_competicao` guarda o responsável por FK **e** um campo textual legível, preservado se a conta for removida.

- [ ] **Step 4: Retirar o legado de `app/models.py` e `app/schemas.py`**

Remover as classes e tabelas listadas em `test_tabelas_antigas_removidas`, mais `Competicao`, `Equipe`, `Jogador`, `Confronto`, `OcorrenciaPartida`, `Partida`, `EstatisticaPartida`, `Edicao`, `GrupoCompeticoes`, `InscricaoIndividual`, `Prova` e `ResultadoProva` do módulo antigo. `Modalidade.competicoes` passa a apontar para `competicoes.modelos.organizacao.Competicao`; remover `Modalidade.eventos` e a associação de modalidades por evento. Em `app/schemas.py`, remover os DTOs que referenciam as classes removidas. Preservar tudo de escolinhas, autenticação e cadastros.

- [ ] **Step 5: Implementar a revisão `20261015_0200`**

`down_revision = "20261015_0100"`. **Primeira instrução do `upgrade()`**, antes de qualquer DDL: exigir `config.attributes["descartar_competicoes_teste"] is True` ou `-x descartar_competicoes_teste=sim`, levantando `RuntimeError` com o nome da opção caso contrário. Derrubar as tabelas antigas na ordem das FKs, criar as novas com CHECKs, defaults e índices equivalentes nos dois dialetos. DDL congelado: **não importar modelos**. `downgrade()` levanta `RuntimeError` explicando que a restauração se faz por backup, antes de mutar qualquer coisa.

- [ ] **Step 6: Desacoplar startup e serviços escolares**

Em `app/main.py`, remover os imports e `include_router` dos onze routers esportivos antigos, preservando auth, modalidades, professores, turmas, alunos, matrículas, presenças, árbitros, locais, eventos e atletas. Em `app/services/alunos.py` e `app/services/atletas.py`, remover os acessos a `equipes_participantes` e o helper de criação de atleta em equipe, preservando o restante do fluxo. `/atletas/equipe/{id}` em `app/routers/atletas.py` passa a responder **410**, mantendo o CRUD de atletas. Em `tests/conftest.py`, remover as fixtures que referenciam modelos esportivos removidos, sem mexer na isolação que a tarefa 2 estabeleceu. Apagar os arquivos listados em Delete.

- [ ] **Step 7: Rodar os testes para verificar que passam**

```bash
env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app \
  .venv/bin/python -m pytest -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao
env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app \
  .venv/bin/python -m pytest -q tests migration_tests -m 'not mysql'
env PYTHONPATH=app:. .venv/bin/python scripts/testar_mysql_competicoes.py
```
Expected: todas PASS; harness MySQL retorna 0 com as tabelas novas.

- [ ] **Step 8: Commit**

```bash
git add app/competicoes app/models.py app/schemas.py app/main.py app/services app/routers alembic/versions competition_tests tests
git commit -m "feat(competicoes): modelos definitivos e retirada do dominio esportivo antigo"
```

## Task 5: Contratos, infraestrutura transacional e esqueleto da API

**Depende:** tarefa 4. **Onda D, um agente.** Define as assinaturas que a onda E consome — nenhuma tarefa da onda E começa antes do commit desta.

**Files:**
- Create: `app/competicoes/contratos/{__init__,comuns,configuracao,organizacao,elencos}.py`, `app/competicoes/{infra,erros}.py`, `app/competicoes/api/{__init__,organizacao,elencos}.py`, `competition_tests/consolidacao/test_contratos_infra.py`
- Modify: `app/main.py`

**Interfaces:**
- Produces, em `erros.py`: `ErroCompeticao(Exception)` com `codigo: str`, `mensagem: str`, `campos: list[str]`; subclasses `NaoEncontrado` (404), `ConflitoEstado` (409), `ConflitoRevisao` (409), `Duplicidade` (409), `ConfiguracaoInvalida` (422); e `registrar_tratadores(app: FastAPI) -> None`, que mapeia cada uma para a resposta `{"codigo", "mensagem", "campos"}`.
- Produces, em `infra.py`:
  - `transacao(db: Session) -> AbstractContextManager[None]` — commit ao sair, rollback em exceção. Serviços são os únicos que a abrem.
  - `bloquear_edicao(db: Session, id_edicao_competicao: int) -> EdicaoCompeticao` — `SELECT ... FOR UPDATE` no MySQL, no-op funcional no SQLite; levanta `NaoEncontrado`.
  - `conferir_revisao(entidade: Any, revisao_cliente: int) -> None` — levanta `ConflitoRevisao` quando divergem.
  - `incrementar_revisao(entidade: Any) -> None`.
  - `registrar_auditoria(db, *, entidade: str, id_entidade: int, acao: str, antes: dict | None, depois: dict | None, id_edicao_competicao: int | None, responsavel: Usuario, motivo: str | None = None) -> AuditoriaCompeticao`.
- Produces, em `contratos/configuracao.py`:
  - `CriterioDesempate` (`VITORIAS`, `SALDO_GOLS`, `GOLS_PRO`, `CONFRONTO_DIRETO`).
  - `PontuacaoSchema(vitoria: int = 3, empate: int = 1, derrota: int = 0)`, inteiros não negativos.
  - `DisciplinaSchema(limite_amarelos: int | None = 3, jogos_por_acumulo: int = 1, jogos_por_vermelho: int = 1, jogos_por_segundo_amarelo: int = 1, zerar_amarelos_ao_encerrar_grupos: bool = False)`.
  - `ConfiguracaoPontosCorridos(formato: Literal["PONTOS_CORRIDOS"], pontuacao, desempates: list[CriterioDesempate], turno_e_returno: bool = False, disciplina)`.
  - `ConfiguracaoGruposMataMata(formato: Literal["GRUPOS_MATA_MATA"], pontuacao, desempates, quantidade_grupos: int, classificados_por_grupo: int, turno_e_returno_grupos: bool = False, ida_volta_eliminatoria: bool = False, final_unica: bool = True, terceiro_lugar: bool = False, disciplina)`.
  - `ConfiguracaoMataMata(formato: Literal["MATA_MATA"], ida_volta: bool = False, final_unica: bool = True, terceiro_lugar: bool = False, disciplina)`.
  - `Configuracao = Annotated[Union[...], Field(discriminator="formato")]`.
  - `validar_configuracao(formato: str, dados: dict) -> Configuracao` — aplica defaults, recusa campo desconhecido, `desempates` sem repetição e não vazio, e levanta `ConfiguracaoInvalida` com os campos afetados.
- Produces, em `api/__init__.py`: `router = APIRouter(prefix="/competicoes", tags=["Competições"])`, já incluindo `organizacao.router` e `elencos.router`. Os dois módulos nascem com `router = APIRouter()` vazio: as tarefas 6 e 7 preenchem cada um o seu, sem tocar neste arquivo.

Os parâmetros disciplinares entram agora, embora só a fatia 3 os use, para que o schema da edição não precise de migração depois.

- [ ] **Step 1: Escrever os testes que falham**

```python
def test_configuracao_aplica_defaults_de_pontuacao():
    config = validar_configuracao("PONTOS_CORRIDOS", {"desempates": ["SALDO_GOLS"]})
    assert config.pontuacao.vitoria == 3
    assert config.pontuacao.empate == 1
    assert config.pontuacao.derrota == 0
    assert config.disciplina.limite_amarelos == 3


def test_configuracao_recusa_campo_desconhecido():
    with pytest.raises(ConfiguracaoInvalida) as erro:
        validar_configuracao("MATA_MATA", {"gol_fora_de_casa": True})
    assert "gol_fora_de_casa" in erro.value.campos


def test_configuracao_recusa_desempate_repetido():
    with pytest.raises(ConfiguracaoInvalida):
        validar_configuracao("PONTOS_CORRIDOS", {"desempates": ["SALDO_GOLS", "SALDO_GOLS"]})


def test_configuracao_recusa_formato_de_outro_schema():
    with pytest.raises(ConfiguracaoInvalida):
        validar_configuracao("PONTOS_CORRIDOS", {"quantidade_grupos": 4})


def test_conferir_revisao_rejeita_desatualizada(edicao):
    edicao.revisao = 3
    with pytest.raises(ConflitoRevisao):
        conferir_revisao(edicao, 2)


def test_transacao_faz_rollback_em_excecao(db, evento):
    with pytest.raises(ValueError):
        with transacao(db):
            db.add(evento)
            raise ValueError
    assert db.query(Evento).count() == 0


def test_auditoria_preserva_autor_legivel(db, usuario):
    registro = registrar_auditoria(db, entidade="eventos", id_entidade=1, acao="CRIAR",
                                   antes=None, depois={"nome": "Jogos"},
                                   id_edicao_competicao=None, responsavel=usuario)
    db.delete(usuario)
    db.flush()
    assert registro.responsavel_descricao  # texto permanece


def test_tratadores_de_erro_respondem_envelope(client):
    resposta = client.get("/competicoes/eventos/999999")
    assert resposta.status_code == 404
    assert set(resposta.json()) == {"codigo", "mensagem", "campos"}
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_contratos_infra.py -v`
Expected: FAIL com imports inexistentes.

- [ ] **Step 3: Implementar `erros.py` e `infra.py`**

Assinaturas no bloco Interfaces. `bloquear_edicao` aplica `with_for_update()` apenas quando o dialeto suporta, para a suíte SQLite não quebrar.

- [ ] **Step 4: Implementar os contratos**

`contratos/configuracao.py` conforme o bloco Interfaces, com `model_config = ConfigDict(extra="forbid")` em todos os schemas. `contratos/organizacao.py` e `contratos/elencos.py` trazem os DTOs de entrada e saída que as tarefas 6 e 7 consomem; `contratos/comuns.py` traz o envelope de erro e a paginação. Nenhum `Any` ou `dict` cru em assinatura pública.

- [ ] **Step 5: Registrar o router central e os tratadores**

Em `app/main.py`, `from competicoes.api import router as competicoes_router`, `app.include_router(competicoes_router)` e `registrar_tratadores(app)`.

- [ ] **Step 6: Rodar os testes para verificar que passam**

Run: o mesmo comando do Step 2, mais `tests` e `competition_tests/consolidacao` completos.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/competicoes app/main.py competition_tests/consolidacao/test_contratos_infra.py
git commit -m "feat(competicoes): contratos, infra transacional e esqueleto da API"
```

## Task 6: Organização — eventos, competições e edições

**Depende:** tarefa 5. **Onda E, paralela com as tarefas 7 e 8.** **Dono dos arquivos:** `app/competicoes/servicos/organizacao.py`, `app/competicoes/api/organizacao.py`, `competition_tests/consolidacao/test_organizacao.py`. Não editar `api/__init__.py` nem arquivos das tarefas 7 e 8.

**Files:**
- Create: `app/competicoes/servicos/{__init__,organizacao}.py`, `competition_tests/consolidacao/test_organizacao.py`
- Modify: `app/competicoes/api/organizacao.py` (o router vazio criado na tarefa 5)

**Interfaces:**
- Consumes: modelos da tarefa 4; `transacao`, `bloquear_edicao`, `conferir_revisao`, `incrementar_revisao`, `registrar_auditoria`, `validar_configuracao` e os erros da tarefa 5; DTOs de `contratos/organizacao.py`.
- Produces:
  - `criar_evento_com_edicao(db, dados: EventoComEdicaoCriar, responsavel: Usuario) -> EventoDetalhe`
  - `criar_competicao_com_edicao(db, dados: CompeticaoComEdicaoCriar, responsavel) -> CompeticaoDetalhe`
  - `criar_edicao_competicao(db, id_competicao: int, dados: EdicaoCompeticaoCriar, responsavel) -> EdicaoCompeticaoDetalhe`
  - `atualizar_edicao_competicao(db, id_edicao_competicao: int, dados: EdicaoCompeticaoAtualizar, responsavel) -> EdicaoCompeticaoDetalhe` — `dados.revisao` é obrigatório
  - `atualizar_edicao_evento(db, id_edicao_evento: int, dados: EdicaoEventoAtualizar, responsavel) -> EdicaoEventoDetalhe`
  - `publicar_edicao(db, id_edicao_competicao: int, publicada: bool, responsavel) -> EdicaoCompeticaoDetalhe`
  - `arquivar_evento(db, id_evento: int, responsavel) -> EventoDetalhe`, `arquivar_competicao(db, id_competicao: int, responsavel) -> CompeticaoDetalhe`
  - `excluir_edicao_competicao(db, id_edicao_competicao: int, responsavel) -> None`
- Produces, em `api/organizacao.py`: `POST|GET /eventos`, `GET|PATCH /eventos/{id_evento}`, `POST /eventos/{id_evento}/edicoes`, `PATCH /edicoes-evento/{id_edicao_evento}`, `POST|GET /competicoes`, `GET|PATCH /competicoes/{id_competicao}`, `POST /competicoes/{id_competicao}/edicoes`, `GET|PUT|DELETE /edicoes/{id_edicao_competicao}`, `POST /edicoes/{id_edicao_competicao}/publicar`. Escrita com `Depends(check_coordenador_role)`; leitura com `Depends(get_current_active_user)`.

- [ ] **Step 1: Escrever os testes que falham**

```python
def test_criar_evento_cria_identidade_e_primeira_edicao(db, usuario):
    detalhe = criar_evento_com_edicao(db, dados, usuario)
    assert detalhe.slug and len(detalhe.edicoes) == 1


def test_competicao_pode_existir_sem_evento(db, usuario):
    detalhe = criar_competicao_com_edicao(db, dados_sem_evento, usuario)
    assert detalhe.edicoes[0].id_edicao_evento is None


def test_identificacao_repetida_na_mesma_competicao_e_conflito(db, usuario):
    criar_edicao_competicao(db, id_competicao, EdicaoCompeticaoCriar(identificacao="2026", ...), usuario)
    with pytest.raises(Duplicidade):
        criar_edicao_competicao(db, id_competicao, EdicaoCompeticaoCriar(identificacao="2026", ...), usuario)


def test_identificacao_igual_em_competicoes_diferentes_e_permitida(db, usuario):
    ...  # não levanta


def test_datas_invertidas_sao_rejeitadas(db, usuario):
    with pytest.raises(ConfiguracaoInvalida):
        criar_edicao_competicao(db, id_competicao, dados_com_fim_antes_do_inicio, usuario)


def test_edicao_esportiva_deve_caber_no_periodo_do_evento(db, usuario):
    with pytest.raises(ConfiguracaoInvalida):
        criar_edicao_competicao(db, id_competicao, dados_fora_do_periodo_do_evento, usuario)


# Review Focus 2
def test_encurtar_periodo_do_evento_que_nao_cabe_nos_filhos_falha_sem_alterar(db, usuario):
    with pytest.raises(ConflitoEstado):
        atualizar_edicao_evento(db, id_edicao_evento, periodo_curto, usuario)
    db.refresh(edicao_evento)
    assert edicao_evento.data_fim == data_fim_original
    assert edicao_esportiva.data_fim == data_fim_esportiva_original


# Review Focus 5
def test_revisao_desatualizada_retorna_conflito_mesmo_com_payload_identico(db, usuario):
    edicao.revisao = 5
    with pytest.raises(ConflitoRevisao):
        atualizar_edicao_competicao(db, edicao.id_edicao_competicao, dados_identicos_revisao_4, usuario)


def test_atualizacao_bem_sucedida_incrementa_revisao(db, usuario):
    antes = edicao.revisao
    atualizar_edicao_competicao(db, edicao.id_edicao_competicao, dados, usuario)
    assert edicao.revisao == antes + 1


def test_trocar_modalidade_de_competicao_com_edicoes_e_conflito(db, usuario):
    with pytest.raises(ConflitoEstado):
        ...


def test_publicar_rascunho_e_despublicar_finalizada(db, usuario):
    assert publicar_edicao(db, id_rascunho, True, usuario).publicada is True
    assert publicar_edicao(db, id_finalizada, False, usuario).publicada is False


def test_excluir_edicao_em_andamento_e_conflito(db, usuario):
    with pytest.raises(ConflitoEstado):
        excluir_edicao_competicao(db, id_em_andamento, usuario)


def test_excluir_evento_com_edicoes_e_conflito(db, usuario): ...


def test_operacoes_de_escrita_sao_auditadas(db, usuario):
    criar_evento_com_edicao(db, dados, usuario)
    assert db.query(AuditoriaCompeticao).filter_by(acao="CRIAR", entidade="eventos").count() == 1


@pytest.mark.parametrize("papel,esperado", [(None, 401), ("professor", 403), ("coordenador", 201)])
def test_permissao_de_escrita_por_papel(client, papel, esperado): ...
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_organizacao.py -v`
Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar `servicos/organizacao.py`**

Assinaturas no bloco Interfaces. Cada função abre uma `transacao`, confere revisão quando aplicável, grava auditoria e devolve DTO — nunca modelo ORM. `atualizar_edicao_evento` relê as edições esportivas filhas sob bloqueio antes de validar o período novo.

- [ ] **Step 4: Implementar os endpoints em `api/organizacao.py`**

Rotas no bloco Interfaces. O router apenas traduz HTTP: nenhuma regra de negócio, nenhum commit.

- [ ] **Step 5: Rodar os testes para verificar que passam**

Run: o comando do Step 2 e, depois, `competition_tests/consolidacao` completo.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/competicoes/servicos/organizacao.py app/competicoes/servicos/__init__.py \
        app/competicoes/api/organizacao.py competition_tests/consolidacao/test_organizacao.py
git commit -m "feat(competicoes): servicos e rotas de eventos, competicoes e edicoes"
```

## Task 7: Elencos — competidores, inscrições, importação e cópia

**Depende:** tarefa 5. **Onda E, paralela com as tarefas 6 e 8.** **Dono dos arquivos:** `app/competicoes/servicos/elencos.py`, `app/competicoes/api/elencos.py`, `competition_tests/consolidacao/test_elencos.py`.

**Files:**
- Create: `app/competicoes/servicos/elencos.py`, `competition_tests/consolidacao/test_elencos.py`
- Modify: `app/competicoes/api/elencos.py`

**Interfaces:**
- Consumes: igual à tarefa 6, com os DTOs de `contratos/elencos.py`.
- Produces:
  - `criar_competidor(db, dados: CompetidorCriar, responsavel) -> CompetidorDetalhe`
  - `importar_aluno(db, id_aluno: int, responsavel) -> CompetidorDetalhe` — idempotente
  - `listar_competidores(db, busca: str | None, pagina: int, tamanho: int) -> PaginaCompetidores`
  - `criar_equipe(db, id_edicao_competicao: int, dados: EquipeCriar, responsavel) -> EquipeDetalhe`
  - `inscrever_integrante(db, id_equipe: int, dados: IntegranteCriar, responsavel) -> IntegranteDetalhe`
  - `inativar_integrante(db, id_integrante: int, responsavel) -> IntegranteDetalhe`
  - `renomear_competidor(db, id_competidor: int, nome: str, responsavel) -> CompetidorDetalhe` — altera só o cadastro, nunca o `nome_esportivo` já registrado
  - `copiar_equipes(db, id_edicao_origem: int, id_edicao_destino: int, responsavel) -> list[EquipeDetalhe]`
- Consumes também: `excluir_aluno` de `app/services/alunos.py`, serviço já existente das escolinhas, usado apenas pelos testes desta tarefa. Não alterá-lo: a tarefa 4 já o desacoplou das tabelas removidas.
- Produces, em `api/elencos.py`: `GET|POST /competidores`, `POST /competidores/importar-aluno`, `GET|POST /edicoes/{id_edicao_competicao}/equipes`, `POST /equipes/{id_equipe}/integrantes`, `PATCH /integrantes/{id_integrante}`, `POST /edicoes/{id_edicao_competicao}/copiar-equipes`.

- [ ] **Step 1: Escrever os testes que falham**

```python
def test_terceiro_sem_aluno_e_cadastrado(db, usuario):
    detalhe = criar_competidor(db, CompetidorCriar(nome="Fulano"), usuario)
    assert detalhe.id_aluno_origem is None


def test_importar_aluno_duas_vezes_devolve_o_mesmo_competidor(db, usuario):
    primeiro = importar_aluno(db, id_aluno, usuario)
    segundo = importar_aluno(db, id_aluno, usuario)
    assert primeiro.id_competidor == segundo.id_competidor
    assert db.query(Competidor).filter_by(id_aluno_origem=id_aluno).count() == 1


# Review Focus 3
def test_importacoes_concorrentes_do_mesmo_aluno_nao_duplicam(db_factory, usuario):
    """Duas sessões importam o mesmo aluno; a segunda vê o existente ou recebe conflito."""
    ...
    assert total_de_competidores_com_essa_origem == 1


# Review Focus 4
def test_excluir_aluno_preserva_competidor_e_elenco_historico(db, usuario):
    integrante = inscrever_integrante(db, id_equipe, IntegranteCriar(id_competidor=..., nome_esportivo="Zico"), usuario)
    excluir_aluno(db, id_aluno)
    db.refresh(competidor)
    assert competidor.id_aluno_origem is None
    assert db.get(IntegranteEquipe, integrante.id_integrante).nome_esportivo == "Zico"


def test_importar_nao_traz_dados_escolares(db, usuario):
    detalhe = importar_aluno(db, id_aluno, usuario)
    assert not hasattr(detalhe, "id_turma")
    assert not hasattr(detalhe, "responsavel")


def test_competidor_em_duas_equipes_da_mesma_edicao_e_conflito(db, usuario):
    inscrever_integrante(db, id_equipe_a, dados, usuario)
    with pytest.raises(Duplicidade):
        inscrever_integrante(db, id_equipe_b_mesma_edicao, dados, usuario)


def test_mesmo_competidor_em_edicoes_diferentes_e_permitido(db, usuario): ...


def test_camisa_repetida_e_aceita(db, usuario):
    inscrever_integrante(db, id_equipe, IntegranteCriar(..., numero_camisa=10), usuario)
    inscrever_integrante(db, id_equipe, IntegranteCriar(..., numero_camisa=10), usuario)  # não levanta


def test_alterar_nome_do_competidor_nao_reescreve_nome_esportivo(db, usuario):
    renomear_competidor(db, id_competidor, "Arthur Antunes", usuario)
    assert db.get(IntegranteEquipe, id_integrante).nome_esportivo == "Zico"


def test_inscrever_em_equipe_de_outra_edicao_e_rejeitado(db, usuario):
    with pytest.raises(ConflitoEstado):
        inscrever_integrante(db, id_equipe_de_outra_edicao, dados, usuario)


def test_copiar_equipes_cria_inscricoes_novas_reusando_competidores(db, usuario):
    equipes = copiar_equipes(db, id_origem, id_destino, usuario)
    assert {e.nome for e in equipes} == nomes_da_origem
    assert competidores_reusados and ids_de_integrante_distintos


def test_copiar_equipes_exige_destino_em_rascunho(db, usuario):
    with pytest.raises(ConflitoEstado):
        copiar_equipes(db, id_origem, id_destino_em_andamento, usuario)


def test_copiar_equipes_e_atomico(db, usuario):
    """Falha no meio não deixa equipe parcial no destino."""
    ...
    assert db.query(Equipe).filter_by(id_edicao_competicao=id_destino).count() == 0


def test_equipe_pode_ser_criada_vazia_em_rascunho(db, usuario):
    """Equipe sem integrante é válida em rascunho. A exigência de ao menos um
    integrante ativo pertence a `iniciar_edicao`, que chega na fatia 2 junto
    com a geração da tabela — não existe função para testá-la aqui."""
    assert criar_equipe(db, id_edicao_rascunho, EquipeCriar(nome="Azul"), usuario).integrantes == []


def test_inativar_integrante_preserva_registro(db, usuario):
    detalhe = inativar_integrante(db, id_integrante, usuario)
    assert detalhe.situacao == "INATIVO"
    assert db.get(IntegranteEquipe, id_integrante) is not None


@pytest.mark.parametrize("papel,esperado", [(None, 401), ("professor", 403), ("coordenador", 201)])
def test_permissao_de_escrita_por_papel(client, papel, esperado): ...
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_elencos.py -v`
Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar `servicos/elencos.py`**

`importar_aluno` tenta inserir e trata a violação da unicidade de `id_aluno_origem` relendo o competidor existente — é assim que a concorrência fica correta sem consulta prévia. `copiar_equipes` roda numa única `transacao` com bloqueio da edição de destino. `inscrever_integrante` grava `nome_esportivo` no momento da inscrição e nunca o recalcula a partir do competidor.

- [ ] **Step 4: Implementar os endpoints em `api/elencos.py`**

Rotas no bloco Interfaces. A resposta de competidor não inclui campo escolar algum.

- [ ] **Step 5: Rodar os testes para verificar que passam**

Run: o comando do Step 2 e, depois, `competition_tests/consolidacao` completo.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/competicoes/servicos/elencos.py app/competicoes/api/elencos.py \
        competition_tests/consolidacao/test_elencos.py
git commit -m "feat(competicoes): competidores, inscricoes, importacao e copia de elencos"
```

## Task 8: Contratos TypeScript e cliente HTTP

**Depende:** tarefa 5. **Onda E, paralela com as tarefas 6 e 7.** **Dono dos arquivos:** `frontend/src/types/competicoes.ts`, `frontend/src/services/competicoes.ts`, `frontend/src/services/index.ts`, `frontend/src/components/layout/Sidebar.tsx`.

Depende dos **contratos** da tarefa 5, não dos serviços: as assinaturas já estão fixadas, então este trabalho corre junto com as tarefas 6 e 7.

**Files:**
- Rewrite: `frontend/src/types/competicoes.ts`, `frontend/src/services/competicoes.ts`
- Modify: `frontend/src/services/index.ts`, `frontend/src/components/layout/Sidebar.tsx`
- Delete: `frontend/src/types/competicoesV2.ts`, `frontend/src/services/competicoesV2.ts`

**Interfaces:**
- Produces: tipos `Evento`, `EdicaoEvento`, `Competicao`, `EdicaoCompeticao`, `Competidor`, `Equipe`, `IntegranteEquipe`, `Configuracao` (união discriminada por `formato`, espelhando `contratos/configuracao.py`), `ErroApi` (`{ codigo, mensagem, campos }`).
- Produces: cliente com `listarEventos`, `criarEventoComEdicao`, `obterEvento`, `criarEdicaoEvento`, `atualizarEdicaoEvento`, `listarCompeticoes`, `criarCompeticaoComEdicao`, `obterCompeticao`, `criarEdicaoCompeticao`, `obterEdicao`, `atualizarEdicao`, `publicarEdicao`, `excluirEdicao`, `listarCompetidores`, `criarCompetidor`, `importarAluno`, `listarEquipes`, `criarEquipe`, `inscreverIntegrante`, `inativarIntegrante`, `copiarEquipes`. Nenhum `any`.

- [ ] **Step 1: Escrever o teste de tipos que falha**

`frontend/src/types/__tests__/competicoes.test-d.ts`, verificado por `tsc --noEmit`:

```ts
import type { Configuracao, EdicaoCompeticao } from "../competicoes";

// @ts-expect-error formato inexistente
const invalido: Configuracao = { formato: "PROVAS" };

// @ts-expect-error quantidade_grupos não existe em PONTOS_CORRIDOS
const errado: Configuracao = { formato: "PONTOS_CORRIDOS", quantidade_grupos: 4 };

const ok: Configuracao = {
  formato: "GRUPOS_MATA_MATA",
  pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
  desempates: ["SALDO_GOLS"],
  quantidade_grupos: 2,
  classificados_por_grupo: 2,
  disciplina: { limite_amarelos: 3, jogos_por_acumulo: 1, jogos_por_vermelho: 1, jogos_por_segundo_amarelo: 1, zerar_amarelos_ao_encerrar_grupos: false },
};

const edicao: EdicaoCompeticao = { ...ok } as unknown as EdicaoCompeticao;
void [invalido, errado, edicao];
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `cd frontend && npx tsc --noEmit`
Expected: erros nos tipos inexistentes, e as duas diretivas `@ts-expect-error` **não** satisfeitas.

- [ ] **Step 3: Escrever os tipos e o cliente**

Os tipos espelham os contratos Pydantic nome a nome. O cliente usa a instância axios já existente em `frontend/src/services/index.ts` e mapeia erro da API para `ErroApi`, sem engolir falha: a função rejeita, e a tela decide. Remover os arquivos V2 e as exportações correspondentes de `index.ts`; retirar do `Sidebar.tsx` os itens das telas esportivas apagadas na tarefa 4 e apontar o item de competições para `/dashboard/competicoes`.

- [ ] **Step 4: Rodar a verificação para confirmar que passa**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: zero erros; as duas `@ts-expect-error` satisfeitas.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types frontend/src/services frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(frontend): contratos e cliente HTTP do dominio de competicoes"
```

## Task 9: Telas de eventos, competições e edições

**Depende:** tarefas 6 e 8. **Onda F, paralela com a tarefa 10.** **Dono dos arquivos:** `frontend/src/app/dashboard/competicoes/{page.tsx,[id]/page.tsx}`, `frontend/src/app/dashboard/eventos/`, `frontend/src/components/competicoes/organizacao/`.

**Files:**
- Rewrite: `frontend/src/app/dashboard/competicoes/page.tsx`, `frontend/src/app/dashboard/competicoes/[id]/page.tsx`, `frontend/src/app/dashboard/eventos/page.tsx`, `frontend/src/app/dashboard/eventos/[id]/page.tsx`
- Create: `frontend/src/components/competicoes/organizacao/{ModalNovoEvento,ModalNovaCompeticao,FormularioConfiguracao,PainelEdicao}.tsx`
- Delete: `frontend/src/components/competicoes-v2/`, `frontend/src/components/competicoes/` (arquivos V1 restantes), `frontend/src/app/dashboard/edicoes/`, `frontend/src/app/dashboard/equipes/`

**Interfaces:**
- Consumes: o cliente e os tipos da tarefa 8.
- Produces: `FormularioConfiguracao` recebe `formato: Configuracao["formato"]` e devolve `Configuracao` válida; é o componente que a tarefa 10 **não** toca.

- [ ] **Step 1: Escrever o teste de interação que falha**

Em `frontend/e2e/organizacao.spec.ts` (Playwright, adicionado como dependência de teste nesta tarefa, versão exata registrada no `package-lock.json`):

```ts
test("cria competição independente e troca o formato descartando config incompatível", async ({ page }) => {
  await page.goto("/dashboard/competicoes");
  await page.getByRole("button", { name: "Nova competição" }).click();
  // preenche nome, edição, modalidade, datas, formato GRUPOS_MATA_MATA
  await page.getByLabel("Quantidade de grupos").fill("2");
  await page.getByLabel("Formato").selectOption("PONTOS_CORRIDOS");
  await expect(page.getByRole("dialog", { name: /descartar/i })).toBeVisible();
  // confirma, salva, e a edição aparece como RASCUNHO não publicada
});

test("edição fora do período do evento mostra o erro do backend", async ({ page }) => {
  // espera a mensagem da API, não uma lista vazia
});

test("falha de carregamento mostra erro com tentar novamente", async ({ page }) => {
  await page.route("**/competicoes/eventos*", (route) => route.abort());
  await expect(page.getByRole("button", { name: /tentar novamente/i })).toBeVisible();
});
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `cd frontend && npx playwright test e2e/organizacao.spec.ts`
Expected: FAIL — telas e rótulos inexistentes.

- [ ] **Step 3: Implementar as telas**

A listagem oferece **Novo evento** e **Nova competição** e dá acesso ao histórico por edição. A página do evento oferece **Adicionar competição**. `FormularioConfiguracao` monta os campos conforme o formato escolhido e avisa antes de descartar configuração incompatível. `PainelEdicao` mostra visão geral e configuração, com botões distintos de iniciar, finalizar, cancelar e publicar, habilitados conforme o estado que o backend informa — as abas de jogos, classificação e disciplina ficam visíveis e desabilitadas, com a nota de que chegam nas fatias 2 e 3. Erro de carregamento renderiza erro com ação de tentar novamente.

- [ ] **Step 4: Rodar as verificações para confirmar que passam**

Run: `cd frontend && npx playwright test e2e/organizacao.spec.ts && npx tsc --noEmit && npm run build`
Expected: PASS e zero erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard frontend/src/components/competicoes frontend/e2e frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): telas de eventos, competicoes e edicoes"
```

## Task 10: Telas de competidores, equipes e elencos

**Depende:** tarefas 7 e 8. **Onda F, paralela com a tarefa 9.** **Dono dos arquivos:** `frontend/src/components/competicoes/elencos/`, `frontend/e2e/elencos.spec.ts`. Não editar as páginas nem os componentes da tarefa 9.

**Files:**
- Create: `frontend/src/components/competicoes/elencos/{GestaoEquipes,GavetaIntegrante,BuscaCompetidor,ImportarAluno,CopiarElenco}.tsx`, `frontend/e2e/elencos.spec.ts`

**Interfaces:**
- Consumes: o cliente e os tipos da tarefa 8. `GestaoEquipes` recebe `idEdicaoCompeticao: number` e é montado pela aba de equipes de `PainelEdicao`, que a tarefa 9 entrega com o ponto de montagem pronto.

- [ ] **Step 1: Escrever o teste de interação que falha**

```ts
test("cadastra terceiro, importa aluno e inscreve no elenco", async ({ page }) => {
  // busca competidor, cadastra terceiro sem aluno, importa um aluno,
  // inscreve ambos e confere que a tela não mostra dado escolar
});

test("importar o mesmo aluno duas vezes não duplica", async ({ page }) => { ... });

test("inscrever competidor já inscrito na edição mostra conflito", async ({ page }) => { ... });

test("copiar elenco da edição anterior cria inscrições novas", async ({ page }) => { ... });

test("camisa repetida é aceita com aviso, não bloqueio", async ({ page }) => {
  await expect(page.getByText(/número repetido/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar" })).toBeEnabled();
});
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `cd frontend && npx playwright test e2e/elencos.spec.ts`
Expected: FAIL — componentes inexistentes.

- [ ] **Step 3: Implementar os componentes**

`BuscaCompetidor` busca por nome com paginação; `ImportarAluno` só aparece para quem tem a autorização de escolinhas; `GavetaIntegrante` edita camisa, posição e nome esportivo, com aviso não bloqueante de camisa repetida; `CopiarElenco` só é oferecido em edição em rascunho, com confirmação e mensagem de que partidas e punições não são copiadas.

- [ ] **Step 4: Rodar as verificações para confirmar que passam**

Run: `cd frontend && npx playwright test e2e/elencos.spec.ts && npx tsc --noEmit && npm run build`
Expected: PASS e zero erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/competicoes/elencos frontend/e2e/elencos.spec.ts
git commit -m "feat(frontend): gestao de competidores, equipes e elencos"
```

## Task 11: Integração, regressão e portão da fatia 1

**Depende:** tarefas 9 e 10. **Onda G, um agente integrador.**

**Files:**
- Create: `competition_tests/consolidacao/test_e2e_fatia1.py`
- Modify: `migration_tests/test_harness_mysql.py` (trocar a tabela do teste de divergência para `competidores`), `docs/superpowers/specs/2026-10-15-competicoes-fatias-design.md` (marcar as fatias 0 e 1 como concluídas, com os números medidos), `docs/rollout-checklist.md`

**Interfaces:**
- Consumes: tudo das tarefas 1 a 10.

- [ ] **Step 1: Escrever o teste de ciclo de vida que falha**

```python
def test_ciclo_completo_da_fatia_1(client, usuario_coordenador):
    """Evento → edição de evento → competição vinculada → edição esportiva →
    equipes → competidores (terceiro + aluno importado) → elencos →
    cópia para a edição seguinte → publicação."""
    ...
    assert edicao_2027.equipes == edicao_2026.equipes
    assert inscricoes_distintas and competidores_reusados


def test_duas_edicoes_nao_misturam_inscricoes(client, usuario_coordenador):
    assert set(elenco_2026) & set(elenco_2027) == set()  # ids de integrante


def test_nenhum_consumidor_das_rotas_retiradas(client):
    for rota in ["/competicoes/", "/confrontos/", "/individuais/", "/classificacao/",
                 "/v2/competicoes", "/v2/publico/eventos", "/equipes/", "/partidas/", "/edicoes/"]:
        assert client.get(rota).status_code in (404, 405)
    assert client.get("/atletas/equipe/1").status_code == 410


def test_regressao_de_escolinhas_apos_consolidacao(client):
    """Fluxo aluno → turma → matrícula → presença segue funcionando."""
    ...
```

- [ ] **Step 2: Rodar para verificar que falha**

Run: `env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app .venv/bin/python -m pytest -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao/test_e2e_fatia1.py -v`
Expected: FAIL.

- [ ] **Step 3: Corrigir o que a integração revelar**

Divergência entre tarefas paralelas vira correção aqui, no arquivo de quem a introduziu, registrando qual tarefa a causou. Trocar a tabela do teste de divergência do harness para `competidores`, agora que ela existe.

- [ ] **Step 4: Rodar a bateria completa do portão**

```bash
env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app \
  .venv/bin/python -m pytest -q --confcutdir=competition_tests/consolidacao competition_tests/consolidacao
env DATABASE_URL=sqlite:///:memory: SECRET_KEY=competition-test-secret PYTHONPATH=app:. \
  .venv/bin/python -m pytest -q tests migration_tests -m 'not mysql'
env PYTHONPATH=app:. .venv/bin/python scripts/testar_mysql_competicoes.py
git diff --check
cd frontend && npx playwright test && npx tsc --noEmit && npm run build
```
Expected: todas verdes; harness retorna 0; `git diff --check` sem saída.

- [ ] **Step 5: Registrar as evidências medidas**

Na spec, marcar as fatias 0 e 1 como concluídas com os números **desta** execução — contagem de testes, data, resultado do harness. Em `docs/rollout-checklist.md`, retirar as instruções que apontam para as revisões arquivadas e para rotas removidas, e registrar que o rollout agora exige `alembic upgrade head` até `20261015_0200` com a opção de descarte.

- [ ] **Step 6: Commit**

```bash
git add competition_tests/consolidacao/test_e2e_fatia1.py migration_tests/test_harness_mysql.py docs
git commit -m "test(competicoes): integracao e portao da fatia 1"
```

### Portão da fatia 1

- Schema migrado ≡ ORM em SQLite e em MySQL 8 real.
- Upgrade de banco vazio e de snapshot sintético com dados de escolinhas chegam ao mesmo schema, com os dados compartilhados preservados.
- `IntegrityError` para integrante de equipe de outra edição e para competidor em duas equipes da mesma edição.
- Upgrade sem a opção de descarte recusado antes de qualquer DDL; downgrade recusado sem mutar.
- Terceiro sem aluno; aluno importado uma vez, inclusive sob concorrência; excluir aluno preserva competidor e elenco; cópia de elenco não duplica inscrição.
- Nenhum consumidor das rotas retiradas; `/atletas/equipe/{id}` em 410; regressão de escolinhas e autenticação verde.
- Fluxos de navegador das tarefas 9 e 10 passando; `tsc --noEmit`, `npm run build` e `git diff --check` limpos.
- Merge em `main` é decisão do usuário, não de agente.

---

## Fora do escopo deste plano

Grupos esportivos, duelos, vagas, partidas, geração, classificação, súmula, correções, disciplina e portal público. São as fatias 2 a 4, com planos próprios escritos nos pontos de reavaliação, conforme a seção 11 da spec.

Dois itens da seção 5 da spec que dependem de código que só existe mais tarde e por isso não têm tarefa aqui, registrados para não se perderem:

- **"Iniciar a edição exige pelo menos um integrante ativo por equipe"** (spec 5.5) é validação de `iniciar_edicao`, que pressupõe tabela gerada. Vai para a fatia 2, junto com a geração.
- **`requisicoes_partida`** é criada na tarefa 4 e fica sem consumidor nesta fatia: a idempotência que ela sustenta entra com o resultado simples, na fatia 2. A tabela nasce agora para a edição não precisar de migração depois.
