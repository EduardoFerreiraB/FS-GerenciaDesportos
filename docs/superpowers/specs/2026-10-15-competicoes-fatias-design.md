# Consolidação de competições em fatias entregáveis

Data: 2026-10-15

Status: **revisada e aprovada pelo usuário em 2026-10-15.** A revisão confirmou as
seções 3.1, 4.2 e 5.1 e alterou a 5.5 (número de camisa deixa de ter restrição de
unicidade). Nenhuma implementação autorizada por este documento: o plano de
implementação da primeira fatia será escrito a partir dele e também passa por
revisão.

Substitui [a especificação de 2026-09-28](2026-09-28-consolidacao-competicoes-futebol-design.md)
e o [plano de 16 tarefas](../plans/2026-09-28-consolidacao-competicoes-futebol.md)
derivado dela. Aquele documento permanece como referência histórica das decisões
de domínio, que esta especificação preserva em quase tudo; o que muda é o formato
da entrega, o motor de regulamentos e a cadeia de migrações.

## 1. Objetivo

Substituir os três caminhos esportivos que hoje convivem no sistema por um único
domínio de competições de futebol, entregue em cinco fatias verticais. Cada fatia
termina utilizável, com testes verdes registrados no momento e commit em branch.

Entidades do domínio final: evento e suas edições; competição e suas edições;
competidores independentes dos alunos; equipes e elencos por edição; grupos,
duelos eliminatórios e vagas; partidas sem agendamento obrigatório; ocorrências
como fonte do placar; disciplina com histórico de cumprimento; auditoria; portal
público.

## 2. Estado atual verificado em 2026-10-15

Verificação executada nesta sessão, não herdada de relatório anterior:

- `tests` + `competition_tests`: **326 testes passando**, exit 0, 104s, SQLite
  isolado. A contagem do checkpoint de 21/09 se confirma.
- `migration_tests`: **28 passando, 1 falhando**. A falha é
  `test_upgrade_empty_sqlite_matches_current_schema_and_constraints`: o schema
  migrado declara `UniqueConstraint('slug')` em `grupos_competicoes` enquanto o
  metadata ORM expressa a unicidade como índice único de coluna. É divergência
  real entre migração e ORM, no único teste que compara os dois.
- Não existe verificação em MySQL real. O arquivo `scripts/testar_mysql_competicoes.py`,
  citado como comando de teste no plano de 28/09, não existe em `scripts/`.
- Não existe verificação em navegador.
- **73 entradas não commitadas** na branch `test/Integração`, incluindo todo o
  trabalho V2 (routers, services, frontend, revisão Alembic 0006). Há um
  `stash@{0}` pendente de `dev/partidas`.
- `docker-compose.yml` versiona `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` em
  texto claro.

Conclusão: a lógica de negócio está coberta por testes; **o banco não está**.

### 2.1 O nó no schema atual

`competicoes` acumula identidade, recorrência e configuração no mesmo registro:
`id_edicao` nullable apontando para `edicoes` (que é de evento), `id_grupo`,
`modo_inscricao`, `formato`, `criterio_resultado`, `regras` em `Text` **e**
`regras_formato` em `JSON`.

`equipes` tem `id_edicao` **e** `id_competicao`, ambos nullable, com `participantes`
(M2M legado via `equipes_participantes`) **e** `jogadores` (elenco V2). Nada no
banco impede um elenco de referenciar equipe de outra edição.

Três gerações ativas simultaneamente:

| Geração | Tabelas e módulos |
| --- | --- |
| V1 | `competicoes`, `partidas`, `estatisticas_partida`, `equipes_participantes`, `atletas`, `edicoes` |
| V1.5 individuais | `inscricoes_individuais`, `provas`, `resultados_prova` |
| V2 | `grupos_competicoes`, `confrontos`, `jogadores`, `ocorrencias_partida`, `*_v2.py`, rotas `/v2` e `/v2/publico` |

## 3. Decisões desta revisão

Decisões tomadas pelo usuário nesta conversa, que diferenciam esta especificação
da de 28/09:

1. **Futebol é o produto por ora.** Outras modalidades são "algum dia, talvez".
   Consequência: o motor de regulamentos em JSON versionado é retirado.
2. **Ninguém usa o módulo de competições hoje**, nem informalmente. Consequência:
   a fatia 1 derruba as tabelas e rotas esportivas antigas de uma vez, e o domínio
   novo nasce com os nomes definitivos.
3. **Entrega em fatias verticais**, não big-bang coordenado.
4. **Commits em branch são permitidos e desejáveis**; merge em `main` só por fatia
   aprovada.
5. **Credenciais saem do `docker-compose.yml`** na fatia 0.
6. **Número de camisa não é restrição** (revisão da spec, 2026-10-15). Campo
   informativo opcional, sem unicidade; o cadastro foca nome e demais dados do
   competidor. Ver seção 5.5.

Decisões de domínio preservadas da especificação de 28/09: competidores
independentes dos alunos com importação opcional sem sincronização; equipes e
elencos pertencem à edição; cópia de elenco entre edições; ocorrências como fonte
única do placar; pênaltis como único desempate eliminatório, sem prorrogação nem
gol fora; disciplina gera alerta e acompanhamento sem punição administrativa
automática; publicação independente do estado esportivo; categoria opcional;
datas pertencem às edições.

### 3.1 O que foi retirado e por quê

**`regulamentos_competicao` e o motor de catálogo.** A especificação de 28/09
previa tabela de regulamentos versionados, arquivos JSON imutáveis por versão,
comando de publicação idempotente, unicidade `(modalidade, formato, versao)` e um
contrato de renderização com subconjunto documentado de widgets — booleanos,
inteiros, seletores, listas ordenáveis, agrupamento e visibilidade condicional.
Toda essa máquina serviria **três combinações de uma modalidade**.

Em lugar disso: `edicoes_competicao.formato` é um enum de três valores e
`edicoes_competicao.configuracao` é JSON validado por união discriminada Pydantic
sobre `formato`. Três modelos tipados e três formulários escritos à mão produzem
o mesmo resultado operacional com tipagem estática ponta a ponta, sem um
mini-framework de formulário para manter.

Caminho de extensão, documentado e não implementado: outra modalidade reaproveita
identidade, edições, competidores, equipes e elencos, e traz motor de disputa e
estruturas de resultado próprios. O catálogo não pouparia esse trabalho, porque a
própria especificação de 28/09 já reconhecia que uma prova futura não deve ser
forçada a caber em `partidas`.

**Tabelas de modalidades individuais.** `inscricoes_individuais`, `provas` e
`resultados_prova` são removidas, como já previsto em 28/09. Não ficam tabelas
vazias para uso futuro.

**A cadeia Alembic 0001–0006 como caminho obrigatório.** Ver seção 4.2.

## 4. Fatia 0 — estabilização e baseline de banco

Objetivo: ponto de retorno versionado e teste de equivalência schema↔ORM verde,
para que as fatias seguintes tenham como provar que o banco está correto. Nenhuma
mudança de domínio.

### 4.1 Versionar o trabalho atual

Branch a partir de `test/Integração`; commit dos 73 arquivos do V2 como estão.
Não é entrega, é rede de segurança antes de uma consolidação destrutiva.
Inspecionar `stash@{0}` de `dev/partidas` e descartá-lo ou aplicá-lo
explicitamente, registrando a decisão.

A restrição "não criar commits" das entregas anteriores é substituída por:
commits sim, merge em `main` apenas por fatia aprovada. A intenção original era
manter o trabalho revisável; o efeito observado foi um subsistema inteiro fora do
versionamento. Uma branch com commits é mais revisável — diff contra `main`,
bisect, ponto de retorno — e para migração destrutiva o ponto de retorno não é
luxo.

### 4.2 Novo baseline Alembic

Gerar revisão única a partir do metadata ORM atual (`20261015_0100_baseline`) e
mover `20260824_0001` … `20260914_0006` para `alembic/versions_arquivadas/`, fora
do caminho que o Alembic varre, com `README` explicando a decisão.

Três consequências:

- `test_upgrade_empty_sqlite_matches_current_schema_and_constraints` fica verde
  **por construção**: o baseline é derivado do metadata, não escrito à mão. A
  divergência de `grupos_competicoes.slug` deixa de existir em vez de ser
  remendada.
- Um banco novo para de executar `0003` e `0004`, que são lógica de reconciliação
  de dados históricos — clonar equipes, redirecionar partidas, escrever auditoria
  — rodando contra zero linhas, para ter suas tabelas derrubadas depois.
- O banco de dev recebe `alembic stamp 20261015_0100` **após conferência de
  equivalência**: o baseline contém exatamente as tabelas que a cadeia 0001–0006
  produziu, porque ambos descrevem o mesmo `app/models.py`. Se a conferência
  apontar qualquer diferença, não executar `stamp`; registrar a diferença e
  tratá-la em etapa aprovada.

`scripts/validar_migracao_equipes.py`, `scripts/validar_migracao_confrontos.py` e
`migration_tests/test_*_migration.py` referenciam revisões arquivadas. Movem para
`migration_tests/arquivados/`, fora da suíte padrão, preservados como referência.

Não executar `alembic downgrade` contra banco com dados.

### 4.3 Harness de MySQL descartável

Criar `scripts/testar_mysql_competicoes.py`: sobe um MySQL 8 descartável
(container efêmero, porta própria, banco com nome aleatório, derrubado ao fim),
aplica `upgrade head` e compara o schema resultante com o metadata ORM em tabelas,
tipos, nulabilidade, defaults, índices, unicidade, chaves estrangeiras e ações
`ondelete`.

Está na fatia 0, e não na última, porque é a ferramenta que todas as fatias
seguintes usam para provar que o banco está correto. Sem ela, a condição de aceite
"schema migrado equivale ao ORM" é aspiracional.

O harness nunca aponta para `DATABASE_URL` do ambiente. Recusa execução se a URL
alvo não for a do container que ele mesmo criou.

### 4.4 Higiene

- `test.db` e `test-task2.db` saem do diretório de trabalho. Já cobertos por
  `*.db` no `.gitignore`, mas confundem-se com banco de teste válido.
- `htmlcov/`, `scratch/`, `coverage_output.txt` entram no `.gitignore`.
- `docker-compose.yml` passa a ler `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`,
  `MYSQL_USER` e `MYSQL_DATABASE` de variáveis de ambiente, com `.env.example`
  documentando os nomes. O `healthcheck` do serviço `db` usa a mesma variável em
  vez de senha literal. As credenciais atuais, já expostas no histórico do git,
  devem ser rotacionadas no ambiente local do usuário — ação dele, fora do escopo
  de código.

### 4.5 Portão de saída da fatia 0

- `migration_tests` 29/29 verde.
- `tests` + `competition_tests` seguem 326 verdes — a fatia 0 não toca domínio.
- Harness MySQL verde: schema migrado ≡ ORM em MySQL 8 real.
- `alembic current` no banco de dev aponta o baseline novo.
- `git diff --check` limpo. Nada escrito em `.env`. Nenhuma execução contra o
  banco conectado além do `stamp` conferido.

Tamanho: pequena. Arrumação e ferramenta, sem lógica de negócio.

## 5. Fatia 1 — identidade, recorrência, competidores e elencos

Esta fatia define o banco; todas as outras dependem dela. Ao fim: cadastrar
evento, competição, edição, equipes e elencos.

### 5.1 Retirada do legado esportivo

Porque ninguém usa o módulo de competições, a retirada acontece aqui e não no fim,
e o domínio novo nasce com os nomes definitivos.

Removidas do runtime, dos modelos e do banco: `competicoes` (V1), `equipes`,
`equipes_participantes`, `partidas`, `estatisticas_partida`, `confrontos`,
`jogadores`, `grupos_competicoes`, `edicoes`, `modalidades_evento`,
`inscricoes_individuais`, `provas`, `resultados_prova`, `migracao_equipes_origem`
e `migracao_partidas_origem`. Tabelas homônimas do schema novo são criadas
explicitamente, na ordem das chaves estrangeiras.

Removidos do código: routers e services V1/V2 de competição, confrontos,
classificação, individuais e público esportivo; clientes, páginas, componentes e
tipos correspondentes no frontend.

Preservados integralmente: usuários, autenticação, refresh tokens, professores,
modalidades, locais, árbitros, alunos, turmas, dias de turma, matrículas e
presenças. `participantes` **permanece** — é infraestrutura compartilhada das
escolinhas; o módulo novo simplesmente não a usa. `atletas` permanece como
cadastro, deixando de ser caminho de inscrição em competições; sua eventual
retirada é outro trabalho.

Adaptações: `app/services/alunos.py` e `app/services/atletas.py` perdem os acessos
a `equipes_participantes` e o helper de criação de atleta em equipe, preservando o
restante do fluxo. A rota `/atletas/equipe/{id}` responde 410. `Modalidade` perde
a associação antiga de eventos; `Modalidade.competicoes` aponta para a nova
identidade permanente. URLs antigas do frontend recebem aviso de recurso
descontinuado, sem segundo motor esportivo por trás.

A revisão de consolidação exige opção explícita de descarte
(`-x descartar_competicoes_teste=sim`), verificada **antes do primeiro DDL**. Seu
downgrade falha antes de qualquer mutação, com mensagem explicando que a
restauração se faz por backup. DDL congelado, sem importar modelos.

### 5.2 Identidade permanente

Cadastros sem regra esportiva e sem datas.

`eventos`: `id_evento` PK, `nome`, `descricao`, `slug` UNIQUE, `arquivado` BOOL,
`criado_em`.

`competicoes`: `id_competicao` PK, `nome`, `descricao`, `slug` UNIQUE,
`id_modalidade` FK → `modalidades`, `arquivado` BOOL, `criado_em`.

Não permitir alterar a modalidade de uma competição que já tenha edições; criar
outro cadastro. Preferir arquivamento à exclusão quando houver histórico.

### 5.3 Recorrência

`edicoes_evento`: `id_edicao_evento` PK, `id_evento` FK, `identificacao`,
`data_inicio`, `data_fim`, `criado_em`. UNIQUE `(id_evento, identificacao)`.
É um agrupador com período, sem nenhuma regra esportiva.

`edicoes_competicao`: `id_edicao_competicao` PK, `id_competicao` FK,
`id_edicao_evento` FK **nullable**, `identificacao`, `categoria` nullable,
`data_inicio`, `data_fim`, `formato` ENUM(`PONTOS_CORRIDOS`, `GRUPOS_MATA_MATA`,
`MATA_MATA`), `configuracao` JSON, `estado` ENUM(`RASCUNHO`, `EM_ANDAMENTO`,
`FINALIZADA`, `CANCELADA`), `publicada` BOOL, `revisao` INT, `criado_em`.
UNIQUE `(id_competicao, identificacao)`.

Restrições:

- `identificacao` é única **dentro do pai**, não globalmente. Aceita rótulos como
  `2026` ou `2026 — segundo semestre`.
- Datas de início e fim obrigatórias e ordenadas. Uma edição esportiva ligada a
  uma edição de evento cabe no período dela. Alterar o período do evento valida
  os filhos e **falha** se não couberem; não ajusta datas silenciosamente. Não há
  CHECK entre tabelas no MySQL, portanto é regra de serviço — declarada aqui para
  que o teste exista.
- Uma edição esportiva pertence a no máximo uma edição de evento. A edição de
  evento reúne competições diferentes sem duplicar a realização esportiva.
- A competição pode existir sem evento.
- `revisao` incrementa a cada alteração e serve de controle otimista: formulário
  desatualizado recebe conflito.

### 5.4 Competidores

`competidores`: `id_competidor` PK, `nome`, `data_nascimento` nullable,
`documento` nullable, `foto_url` nullable, `ativo` BOOL, `id_aluno_origem` FK →
`alunos` **UNIQUE, nullable, ON DELETE SET NULL**, `criado_em`.

- Sem escola, responsáveis ou informação médica. O competidor é independente do
  aluno.
- Importar aluno exige autorização de escolinhas **e** de gestão de competições.
  A operação reutiliza a origem única; não associa automaticamente por semelhança
  de nome. Duas importações concorrentes do mesmo aluno não criam duas pessoas —
  garantido pela unicidade, não por consulta prévia.
- Excluir aluno aplica `SET NULL` e preserva o competidor. O mapeamento
  SQLAlchemy reflete essa política, sem `delete-orphan` nesse vínculo.
- Não usar nome nem documento como chave de pessoa.

### 5.5 Equipes e elencos

`equipes`: `id_equipe` PK, `id_edicao_competicao` FK **NOT NULL**, `nome`,
`sigla` nullable, `situacao`, `criado_em`. UNIQUE `(id_edicao_competicao, nome)`
e UNIQUE `(id_edicao_competicao, id_equipe)`.

`integrantes_equipe`: `id_integrante` PK, `id_edicao_competicao`, `id_equipe`,
`id_competidor` FK, `nome_esportivo`, `numero_camisa` nullable, `posicao` nullable,
`situacao` ENUM(`ATIVO`, `INATIVO`), `criado_em`. FK composta
`(id_edicao_competicao, id_equipe)` → `equipes`. UNIQUE
`(id_edicao_competicao, id_competidor)`.

As restrições que fazem o trabalho:

- **A FK composta.** O `UNIQUE (id_edicao_competicao, id_equipe)` em `equipes`
  parece redundante, já que `id_equipe` é PK; existe só para ser alvo da FK
  composta. O efeito é que fica impossível no banco inserir integrante cuja
  equipe pertence a outra edição. Hoje isso não é barrado nem por consulta.
- **UNIQUE `(id_edicao_competicao, id_competidor)`.** Um competidor em no máximo
  uma equipe por edição, garantido por constraint. Verificação prévia não resolve:
  duas requisições concorrentes passam pela consulta e as duas inserem.
- **`numero_camisa` não tem restrição de unicidade — decidido em 2026-10-15.**
  Camisa é campo informativo opcional, não identidade. Não haverá controle real
  de numeração no cadastro de competidores, então uma constraint só produziria
  atrito no cadastro sem proteger nada que importe. Camisa repetida ou ausente é
  permitida; a interface pode avisar sobre repetição, mas não bloqueia. A
  identidade do integrante é `id_competidor` e, para exibição, `nome_esportivo`.
  Isso descarta também a discussão de índice único parcial, que o MySQL 8 não
  suporta.
- **`nome_esportivo` congelado na inscrição.** Denormalização deliberada: o elenco
  histórico guarda o nome como foi registrado naquela edição. Corrigir o cadastro
  do competidor depois não reescreve a súmula anterior. Correção histórica
  explícita é operação própria e auditada.

Regras de ciclo de vida do elenco:

- Equipes podem ser cadastradas vazias em rascunho; iniciar a edição exige pelo
  menos um integrante ativo por equipe. A aplicação não fiscaliza número mínimo
  regulamentar de atletas em campo.
- Depois do início, permitir inativar integrantes sem apagá-los e sem invalidar
  ocorrências anteriores. Novas inscrições após o início ficam fora do escopo.
- Copiar equipes e elencos de uma edição anterior é operação explícita e atômica,
  permitida em rascunho sem tabela gerada. Cria inscrições novas reutilizando os
  competidores. Não copia partidas, cartões, suspensões nem resultados.

### 5.6 Configuração por união discriminada

`configuracao` é JSON no banco; a verdade do formato está no tipo Python. `formato`
é o discriminador e cada valor tem seu modelo Pydantic:

- `PONTOS_CORRIDOS`: pontos por vitória/empate/derrota (inteiros não negativos,
  padrão 3/1/0), turno único ou turno e returno, ordem dos desempates,
  parâmetros disciplinares.
- `GRUPOS_MATA_MATA`: o conjunto acima aplicado à fase de grupos, mais quantidade
  de grupos, classificados por grupo, e as opções de eliminatória.
- `MATA_MATA`: ida e volta por fase, final única, disputa de terceiro lugar,
  parâmetros disciplinares.

Validação na escrita: tipos, campos desconhecidos, limites, enums, listas
ordenadas sem repetição e combinações de negócio. Defaults aplicados
explicitamente ao salvar, nunca na leitura. Configuração e formato são
obrigatórios na criação da edição; o rascunho permite alterá-los sem exigir
equipes nem tabela.

As chaves são únicas entre API, motores e TypeScript. Aliases antigos como
`turno_returno`/`turno_e_returno` e `GRUPOS`/`GRUPOS_MATA_MATA` não sobrevivem.

### 5.7 Infraestrutura compartilhada, criada aqui

`auditoria_competicao`: entidade, ID, ação, antes e depois relevantes,
responsável, instante, motivo, e a edição envolvida. Preserva referência legível
ao autor se a conta deixar de existir. Nasce na fatia 1 porque mudança de estado
e publicação de edição também merecem trilha. Não é exposta no portal público.

`requisicoes_partida`: chave de idempotência por partida. Mesma requisição e
mesmo payload retornam o resultado original; payload diferente com a mesma chave
gera conflito. Criada aqui, usada de fato na fatia 2. Evita duplicação por duplo
clique ou retry de rede; não substitui bloqueio de concorrência entre operadores.

### 5.8 Transação e concorrência

Uma operação de negócio é uma transação: serviços controlam commit e rollback;
rotas e helpers não fazem commits parciais. Bloquear a linha da edição para
geração, inscrição e alteração estrutural. Bloquear a partida para súmula.
Promoção de chaves e correções bloqueiam a edição e as partidas afetadas em ordem
estável.

### 5.9 Portão de saída da fatia 1

- Schema migrado ≡ ORM em SQLite e em MySQL 8 real pelo harness da fatia 0.
- Upgrade de banco vazio e de snapshot sintético com dados de escolinhas chegam
  ao mesmo schema, com os dados compartilhados preservados.
- Integrante apontando equipe de outra edição levanta `IntegrityError` no flush.
- Competidor em duas equipes da mesma edição levanta `IntegrityError`.
- Upgrade sem a opção de descarte é recusado antes de qualquer DDL.
- Terceiro cadastrado sem aluno; aluno importado uma vez, inclusive sob
  concorrência; excluir aluno não remove competidor; copiar elenco não duplica
  inscrição nem altera histórico.
- Regressão de escolinhas e autenticação verde; nenhum consumidor restante das
  rotas esportivas retiradas.
- `tsc --noEmit` e `npm run build` sem novos erros; `git diff --check` limpo.

## 6. Fatia 2 — estrutura da disputa e resultado simples

Ao fim desta fatia é possível rodar um campeonato inteiro com placar. É a maior
das fatias, e a primeira que entrega valor operacional.

### 6.1 Grupos

`grupos_competicao`: `id_grupo` PK, `id_edicao_competicao` FK NOT NULL, `nome`,
`ordem`. UNIQUE `(id_edicao_competicao, nome)` e UNIQUE
`(id_edicao_competicao, id_grupo)`.

`equipes` ganha `id_grupo` nullable com FK composta
`(id_edicao_competicao, id_grupo)` → `grupos_competicao`: é impossível pôr uma
equipe num grupo de outra edição.

`grupos_competicao` são os grupos A/B/C **esportivos**. O `grupos_competicoes`
antigo era evento agregador, papel que agora pertence a `edicoes_evento`. Dois
nomes quase idênticos para coisas diferentes era uma armadilha real no schema
atual, e ela desaparece com a tabela antiga.

### 6.2 Duelos e vagas

`duelos_eliminatorios`: `id_duelo` PK, `id_edicao_competicao` FK, `fase`,
`posicao_chave`, `estado` ENUM(`PENDENTE`, `DEFINIDO`, `RESOLVIDO`),
`id_equipe_vencedora` nullable, `ida_volta` BOOL. UNIQUE
`(id_edicao_competicao, fase, posicao_chave)` e UNIQUE
`(id_edicao_competicao, id_duelo)`.

`vagas_duelo`, duas linhas por duelo: `id_vaga` PK, `id_duelo` FK, `posicao`
(1 ou 2), `origem` ENUM(`EQUIPE_INICIAL`, `POSICAO_GRUPO`, `VENCEDOR_DUELO`,
`PERDEDOR_DUELO`, `FOLGA`), `id_equipe` nullable, `id_grupo` nullable,
`posicao_grupo` nullable, `id_duelo_origem` nullable, `id_equipe_resolvida`
nullable. UNIQUE `(id_duelo, posicao)`, mais CHECK garantindo que exatamente um
conjunto de origem está preenchido — MySQL 8.0.16+ e SQLite suportam CHECK.
Validar que origem e duelo pertencem à mesma edição.

Por que isso importa concretamente: hoje `confrontos_v2.py` descobre para onde um
vencedor avança **lendo o texto do nome da fase**. Com `vagas_duelo`, o avanço é
um `UPDATE` na linha cuja `origem = VENCEDOR_DUELO` e
`id_duelo_origem = <duelo resolvido>`. Ida e volta, terceiro lugar, folgas e
reabertura com travas de dependência deixam de ser casos especiais e passam a ser
consultas no grafo de vagas.

Classificação automática por folga é `estado = RESOLVIDO` sem partida nenhuma —
não um placar fictício. Folga não produz gols, cartões, pontos de liga nem
cumprimento de suspensão.

### 6.3 Partidas

`partidas`: `id_partida` PK, `id_edicao_competicao` FK NOT NULL, `id_grupo`
nullable (FK composta), `id_duelo` nullable (FK composta), `rodada` nullable,
`ordem_jogo` SMALLINT, `id_equipe_mandante` e `id_equipe_visitante` — ambos com FK
composta para a edição —, `data` nullable, `hora` nullable, `id_local` FK
nullable, `id_arbitro` FK nullable, `estado` ENUM(`AGENDADA`, `EM_ANDAMENTO`,
`FINALIZADA`, `CANCELADA`), `penaltis_mandante` nullable, `penaltis_visitante`
nullable, `revisao` INT. CHECK `id_equipe_mandante <> id_equipe_visitante`.

- **Agendamento genuinamente opcional.** O gerador V2 inventa local, árbitro e
  horário padrão para satisfazer colunas obrigatórias. Aqui tudo é nullable e a
  interface mostra "a definir". Nenhum dado fictício entra no banco para contentar
  o schema.
- **Partida eliminatória só nasce com dois adversários conhecidos.** Antes disso
  existe o duelo com suas vagas pendentes, e a árvore desenha isso. Não há linha
  de partida com time nulo.
- `AGENDADA` significa jogo não iniciado, podendo ter agendamento pendente; a
  interface distingue as duas situações.
- A edição precisa estar em andamento para iniciar partida ou registrar resultado.
  Registrar o primeiro evento pode iniciar o jogo, mas nunca inicia a edição
  implicitamente.
- Pênaltis são inteiros não negativos e diferentes entre si, admitidos somente no
  jogo decisivo cujo placar ou agregado empatou.

### 6.4 Geração

Reaproveita os algoritmos de `app/services/confrontos_v2.py` sob contrato novo,
sem conservar aliases de formato ou chaves inconsistentes.

- Liga usa round-robin; quantidade ímpar gera folgas, sem jogos fictícios.
- Turno e returno invertem mandos. Grupos usam o mesmo cálculo, isolado por grupo.
- Grupos permitem distribuição automática equilibrada e ajuste manual antes de
  iniciar. Validar quantidade de grupos, de equipes e de classificados: cada grupo
  precisa permitir a quantidade configurada.
- O cruzamento é materializado nas vagas e apresentado antes do início. Para dois
  grupos com dois classificados, 1ºA × 2ºB e 1ºB × 2ºA. Para outras quantidades,
  proposta determinística por posição e grupo, revisável antes do início,
  validando que cada vaga aparece uma única vez.
- Eliminatória com quantidade que não é potência de dois distribui folgas na
  primeira fase. O tamanho da chave é calculado a partir das inscrições; não
  oferecer escolha textual de fase inicial incompatível.
- Terceiro lugar só é oferecido quando houver duas semifinais disputadas.
- Encerrar a fase de grupos é explícito e exige jogos resolvidos e ausência de
  empates pendentes nas vagas. Só então as vagas de eliminatória recebem equipe.
- Geração repetida ou concorrente não duplica tabela — bloqueio da edição e
  verificação de tabela existente.
- Desfazer a tabela é operação explícita, permitida em rascunho sem jogo iniciado,
  ocorrência ou resultado.

### 6.5 Resultado e classificação nesta fatia

`ocorrencias_partida` é criada aqui: `id_ocorrencia` PK, `id_partida` FK, `tipo`,
`id_equipe_beneficiada`, `id_integrante` nullable, `minuto` nullable, `periodo`
nullable, `observacao`, `id_usuario_autor`, `criado_em`,
`id_ocorrencia_origem` nullable (auto-FK, usada na fatia 3).

Na fatia 2 ela recebe apenas `GOL` sem autoria, produzido pelo resultado simples.
Tipos de cartão, gol contra e autoria entram na fatia 3.

O placar é **sempre** agregação de ocorrências, inclusive na fatia 2. Não há
coluna de placar editável como segunda fonte. Isso evita que a fatia 2 grave
placar numa coluna e a fatia 3 precise migrar os dados para ocorrências.
Resultado simples de 2×1 cria dois gols sem autoria para o mandante e um para o
visitante; repetir o mesmo total não duplica nada.

Classificação com J, V, E, D, GP, GC, SG, PTS e aproveitamento, reaproveitando o
particionamento progressivo de `app/services/classificacao_v2.py` sob contrato
novo.

- Pontos são a primeira ordenação, obrigatoriamente.
- Desempates nesta fatia: vitórias, saldo de gols, gols pró e confronto direto,
  em ordem editável. Os critérios disciplinares entram na fatia 3 com os cartões.
- Confronto direto usa mini-tabela entre os empatados, aplicada somente quando os
  jogos relevantes entre eles estiverem finalizados; dentro dela valem pontos,
  saldo e gols pró.
- Empate persistente tem indicação explícita. Ordenação visual estável não é
  classificação esportiva, e **nunca** desempatar por `id`.
- Classificação pontuada considera apenas jogos finalizados.
- Ida e volta agrega gols por identidade da equipe, com mandos invertidos.

### 6.6 Portão de saída da fatia 2

- Liga com número par e ímpar de equipes; returno com mandos invertidos.
- Grupos e cruzamentos materializados; eliminatória com folgas; ida e volta;
  pênaltis; final única; terceiro lugar.
- Geração sem agendamento; tentativa repetida e concorrente não duplica tabela.
- Alteração estrutural bloqueada com tabela gerada; `revisao` desatualizada
  recebe conflito.
- Resultado simples idempotente sob requisição repetida.
- Empate não resolvido não classifica equipe por `id`.
- Schema ≡ ORM em MySQL real; suíte verde registrada no momento; fluxo real de
  navegador executado; `tsc --noEmit`, `build` e `git diff --check` limpos.

## 7. Fatia 3 — súmula detalhada, correções e disciplina

### 7.1 Ocorrências completas

Tipos: `GOL`, `GOL_CONTRA`, `CARTAO_AMARELO`, `CARTAO_VERMELHO_DIRETO`,
`EXPULSAO_SEGUNDO_AMARELO`.

- **Gol contra.** `id_equipe_beneficiada` é coluna explícita, não derivada do
  autor. Em gol normal é a equipe do integrante; em gol contra é a adversária.
  Deixar isso implícito é como se erra esse cálculo.
- **A ocorrência referencia o integrante, não o competidor.** `id_integrante`
  aponta para a inscrição naquela equipe e edição, e o serviço valida que a equipe
  do integrante disputa aquela partida.
- Cartão exige integrante conhecido. Gol pode ser sem autoria.
- Atribuir autor a um gol existente **não muda o placar**; recalcula artilharia.
  Remover gol reduz o total.
- **Expulsão por segundo amarelo é derivada.** O segundo `CARTAO_AMARELO` na mesma
  partida gera `EXPULSAO_SEGUNDO_AMARELO` com `id_ocorrencia_origem` apontando o
  amarelo que a disparou. Remover ou corrigir aquele amarelo atualiza a derivação,
  sem expulsão órfã nem duplicada.
- Resultado simples não remove silenciosamente gols com autoria ou gols contra:
  pede correção explícita das ocorrências envolvidas.
- Pênaltis ficam na partida decisiva, separados do placar normal e da artilharia.
- Artilharia considera gols normais atribuídos em jogos não cancelados, indicando
  os jogos ainda em andamento.

### 7.2 Travas de correção

Reabrir uma partida finalizada é simples; o difícil é o que isso invalida. Com o
grafo de `vagas_duelo`, a trava é computável:

1. Partir da partida a corrigir e caminhar o grafo de vagas para frente: todos os
   duelos descendentes, transitivamente, incluindo o de terceiro lugar.
2. Se **qualquer** descendente afetado já tem partida iniciada, bloquear. Checar
   apenas a próxima partida imediata é o erro natural aqui.
3. Se nenhum iniciou, reabrir invalida as resoluções descendentes: vagas voltam a
   `PENDENTE`, duelos a `DEFINIDO` ou `PENDENTE`, e partidas eliminatórias já
   geradas com adversário agora indefinido são removidas.

Fase de grupos encerrada segue a mesma lógica um nível acima: corrigir resultado
exige reabrir a fase, o que invalida as vagas preenchidas por posição de grupo —
bloqueado se as eliminatórias dependentes já começaram.

Liga é o caso simples: reabrir jogo finalizado permite corrigir e recalcular.

Edição finalizada precisa ser reaberta antes de corrigir jogos. Resultados de
edição cancelada não são modificados nesta entrega. Corrigir autoria sem mudar
resultado não desfaz chaveamento.

Correção de resultado, de autoria, de disciplina e reabertura após finalização
**exigem motivo** e vão para `auditoria_competicao`. Lançamento normal de súmula
registra autoria sem exigir justificativa — caso contrário o operador de beira de
campo digita motivo a cada gol.

### 7.3 Empate não resolvido

`decisoes_classificacao`: edição, conjunto de equipes empatadas, vaga ou título em
disputa, equipe escolhida, motivo, responsável, e a **revisão de resultados** sob
a qual a decisão foi tomada. Resultado alterado depois invalida a decisão afetada
e exige nova conferência, em vez de carregar silenciosamente uma escolha feita
sobre dados que mudaram.

### 7.4 Disciplina

`suspensoes_competicao`: `id_suspensao` PK, `id_edicao_competicao`,
`id_integrante`, `motivo`, `origem`, `chave_origem` UNIQUE para origem automática,
`jogos`, `situacao`, responsável. A chave única é o que faz reprocessar uma súmula
não duplicar punição.

`cumprimentos_suspensao`: `id_cumprimento` PK, `id_suspensao` FK, `id_partida` FK,
responsável, data. UNIQUE `(id_partida, id_integrante)` materializa a regra de que
uma partida cumpre no máximo uma unidade da fila daquele integrante. Jogo
cancelado e classificação automática não cumprem punição. O cumprimento é
confirmado pelo organizador após finalizar uma partida posterior à punição, da
equipe do competidor; não se infere ausência só porque não houve ocorrência com o
jogador.

Parâmetros em `configuracao`:

- Limite de amarelos configurável, padrão 3, desabilitável.
- Jogos por acúmulo, por vermelho direto e por segundo amarelo: inteiros
  positivos, padrão 1.
- Sem zeragem automática entre fases. Zeragem de saldo de amarelos ao encerrar
  grupos é opcional, e suspensões já geradas nunca são apagadas por ela.

Duas regras de contagem que ficam visíveis no formulário, não só no código: os
amarelos que geraram expulsão por segundo amarelo **não contam também** para
acúmulo, e contagem estatística é separada de contagem para suspensão.

Sanções automáticas são processadas ao finalizar o jogo; alertas provisórios podem
aparecer durante a partida. Ajustes manuais exigem motivo e ficam auditados.

Jogador suspenso gera **alerta persistente, não bloqueio**. A súmula registra o
que aconteceu em campo; o sistema não retira pontos, não altera placar e não
desclassifica equipe automaticamente. Correção de cartão que afete classificados
aplica as mesmas travas de dependência; se afetar punição já cumprida, exige
revisão disciplinar explícita em vez de apagar o histórico.

### 7.5 Ciclo de vida da edição

| Ação | Condições |
| --- | --- |
| Criar edição | Rascunho, formato suportado, configuração válida, datas válidas. |
| Gerar tabela | Rascunho, equipes suficientes, configuração coerente, nenhuma tabela existente. |
| Desfazer tabela | Rascunho, nenhum jogo iniciado, ocorrência ou resultado; explícita. |
| Iniciar edição | Tabela gerada e conferida, sem inconsistência estrutural. Agendamento pode estar pendente. |
| Finalizar edição | Jogos obrigatórios resolvidos, classificação e título sem decisão pendente. Jogo cancelado não equivale a resultado resolvido. |
| Reabrir edição | Administrador ou coordenador, com justificativa; retorna a em andamento. |
| Cancelar edição | Justificativa; preserva registros e bloqueia novas operações esportivas. |
| Publicar/despublicar | Permissão de gestão; independente do estado, sem expor campo privado. |

Mudança estrutural — formato, grupos, turnos, pontuação, desempates e composição
das equipes na tabela — fica bloqueada com tabela gerada. Desfazê-la permite
editar apenas antes do início. Ajuste de descrição, publicação e agendamento tem
operação própria e nunca reabre configuração esportiva implicitamente.

Exclusão física somente de rascunho sem disputa nem histórico. Bloquear exclusão
de evento ou competição com edições, e de edição de evento com competições
vinculadas. Não configurar cascata de pai que apague resultados.

### 7.6 Portão de saída da fatia 3

- Expulsão por segundo amarelo sem duplicação; remover o amarelo de origem
  atualiza a derivação.
- Sanção por acúmulo; zeragem opcional; cumprimento explícito; correção após
  cumprimento exige revisão disciplinar.
- Alerta de suspenso não bloqueia lançamento.
- Resultado simples e detalhado produzem o mesmo placar; gol contra; autoria
  posterior; remoção; requisição repetida; dois operadores simultâneos.
- Corrigir uma semifinal de ida e volta não deixa final nem terceiro lugar com
  participante antigo, e não altera descendente já iniciado.
- Reabertura recalcula o permitido, bloqueia descendente iniciado e mantém
  auditoria.
- Schema ≡ ORM em MySQL real; suíte verde registrada no momento; fluxo real de
  navegador; `tsc`, `build` e `git diff --check` limpos.

## 8. Fatia 4 — portal público

### 8.1 Publicação e vazamento

`publicada` é independente de `estado`: rascunho pode ser publicado, para divulgar
tabela antes de começar, e edição finalizada pode ser despublicada. Acesso direto
a edição não publicada retorna **404**, não 403 — 403 confirmaria que o recurso
existe.

Respostas públicas usam **allowlist de campos** em schemas próprios, nunca
`model_dump` de ORM. Fora do portal: documento, data de nascimento completa,
contato, vínculo escolar, motivo privado de sanção e qualquer auditoria. Do elenco
saem `nome_esportivo`, camisa e posição, e nada mais.

O seletor de edições de um evento mostra apenas edições com alguma disputa
publicada, para o visitante não cair num evento vazio. Jogo sem agendamento
aparece como "a definir". Atualização periódica e após ações, sem WebSocket.

### 8.2 Falha é falha

Erro de carregamento aparece como erro, com ação de tentar novamente. Não virar
lista vazia nem classificação ausente silenciosa — é o tipo de degradação que faz
o organizador achar que perdeu dados.

### 8.3 Portão de saída da fatia 4

- Publicação independente do estado; acesso direto a edição privada retorna 404.
- Resposta pública conferida campo a campo contra a allowlist, com teste que falha
  se um campo novo aparecer sem decisão explícita.
- Histórico: duas edições da mesma competição navegáveis, sem misturar inscrição,
  configuração nem resultado.
- Falha de rede renderiza erro com retentativa, não lista vazia.
- Suíte verde registrada no momento; fluxo real de navegador; `tsc`, `build` e
  `git diff --check` limpos.

## 9. API, permissões e frontend

API única, sem recursos concorrentes. Recursos esportivos são endereçados pela
edição; a identidade permanente lista suas edições. Tipos de retorno explícitos e
schemas públicos próprios substituem `any` e dumps de ORM. Roteadores cuidam de
autenticação, contrato e HTTP; serviços aplicam regra; ORM e constraints garantem
integridade persistente. O motor de futebol é explícito; nenhum registro de banco
seleciona código por caminho ou import.

Permissões: administrador e coordenador gerenciam competições; usuários
autenticados dos perfis existentes consultam o painel conforme o acesso atual.
Importação de alunos passa também pela autorização de escolinhas. Sem ACL por
organizador e sem papéis novos.

Erros: 401 sem autenticação; 403 sem permissão; 404 recurso inexistente ou edição
não publicada no portal; 409 estado, revisão ou duplicidade incompatível; 422
campo ou combinação inválida. Erro traz código estável, mensagem legível e campos
afetados; nunca SQL, credencial ou detalhe interno.

Experiência administrativa: a página principal oferece **Novo evento** e **Nova
competição**, lista as identidades e dá acesso ao histórico por edição. Novo evento
cria identidade e primeira edição numa operação, e sua página oferece **Adicionar
competição**. O painel da edição tem visão geral e configuração, equipes e elencos,
jogos e súmula, classificação e chaveamento, artilharia e disciplina. Iniciar,
finalizar, cancelar e publicar são botões distintos, com confirmação nas operações
que descartam configuração ou tabela. Trocar formato avisa antes de descartar
configuração incompatível. A geração exibe prévia de grupos, cruzamentos e folgas,
e o agendamento mostra pendências sem inventar valores.

Reaproveitar a estrutura visual de `frontend/src/components/competicoes-v2/` —
painel, árvore, súmula móvel e portal — sob os contratos novos.

## 10. Restrições válidas para todas as fatias

- Não alterar `.env`. Não executar teste contra banco de desenvolvimento ou
  produção. A única operação permitida no banco conectado é o `stamp` conferido
  da fatia 0.
- Preservar usuários, autenticação, professores, modalidades, locais, árbitros,
  alunos, turmas, matrículas e presenças. `participantes` permanece.
- Descarte de dados de competição não autoriza reset do banco inteiro.
- Commits em branch; merge em `main` apenas por fatia aprovada.
- Somente futebol. Outras modalidades têm caminho de extensão documentado, sem
  motor nem tela operacional.
- Empate eliminatório é decidido por pênaltis, sem prorrogação e sem gol fora.
- Nenhuma fatia se declara pronta por existirem componentes ou por compilar.
  Typecheck e build não substituem teste de interação. Contagem de teste anterior
  não vale como evidência de execução atual.

## 11. Ordem e dependências

```
fatia 0  →  fatia 1  →  fatia 2  →  fatia 3  →  fatia 4
```

Estritamente sequencial entre fatias: cada uma depende do schema que a anterior
estabeleceu. Dentro de uma fatia há frentes paralelizáveis — na fatia 2, motor de
geração e interface de operação; na fatia 3, disciplina e súmula — e a divisão
concreta pertence ao plano de implementação, não a esta especificação.

Entre fatias há um ponto de reavaliação: o escopo da fatia seguinte pode ser
revisto à luz do que a anterior revelou.

## 12. Critério de conclusão

Um único caminho esportivo ativo; banco verificado em MySQL 8 real contra o
metadata ORM; fluxos administrativos e públicos completos para futebol; e, ao fim
de cada fatia, os testes daquele portão passando com execução registrada na
ocasião.
