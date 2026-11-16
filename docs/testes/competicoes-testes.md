# Testes do módulo de Competições

Documento de referência dos testes que garantem a integridade do módulo de competições
(fatias 0 a 4): o que cada camada verifica, como executar e o que fazer para que o E2E
passe de forma confiável. Situação medida em **19/10/2026**.

## 1. Visão geral

Os testes seguem a pirâmide usual: muitos testes rápidos de regra pura na base, testes de
serviço e API no meio, e poucos testes de navegador no topo.

| Camada | O que garante | Onde | Testes |
| --- | --- | --- | --- |
| Unitários (motores puros) | Regras de futebol sem banco: tabela, chaveamento, classificação, desempates, súmula, disciplina, avanço | `competition_tests/consolidacao/test_motor_*.py` | 75 |
| Contratos e schema | Validação de entrada (Pydantic), constraints do banco (FK composta, unicidades, CHECK) | `test_contratos_infra.py`, `test_schema*.py`, `test_publico_allowlist.py` | 109 |
| Serviços e API (integração) | Cada operação com banco SQLite real e HTTP real: permissões, 404/409/422, auditoria, idempotência | `test_organizacao.py`, `test_elencos.py`, `test_servico_*.py`, `test_publico_api.py`, `test_exclusao_cascata.py` | 145 |
| Fluxos ponta a ponta (backend) | Campeonato inteiro por HTTP, do cadastro à finalização, um por fatia | `test_e2e_fatia1.py` … `test_e2e_fatia3.py` | 10 |
| Regressões e preservação | Defeitos já corrigidos não voltam; migração preserva dados das escolinhas | `test_revisao_estabilidade.py`, `test_preservacao.py`, `test_limpar_dados_e2e.py` | 27 |
| Migrações | Cadeia Alembic linear; schema migrado igual ao ORM | `migration_tests/` | 23 |
| E2E de navegador (Playwright) | Telas reais operando o sistema: estrutura, tema, componentes de UI, organização, exclusão, elencos, jogos, súmula, disciplina, classificação, portal público | `frontend/e2e/*.spec.ts` | 51 |

Total do módulo de competições: **366 testes em `competition_tests`, 23 de migração e 51 E2E**. A suíte completa do backend
(escolinhas incluídas) soma **472 testes**.

## 2. Testes do backend (pytest)

### 2.1 Unitários — motores puros

Ficam em `app/competicoes/servicos/motores/` e não tocam o banco: recebem listas e devolvem
resultados. Por isso são rápidos e determinísticos.

| Arquivo | Cobre |
| --- | --- |
| `test_motor_chaveamento.py` (26) | Round-robin com número par e ímpar, turno e returno com mandos invertidos, distribuição em grupos, chave com folgas, cruzamentos 1ºA × 2ºB |
| `test_motor_classificacao.py` (12) | Pontos, V/E/D, saldo, confronto direto em mini-tabela, empate persistente (nunca desempata por `id`) |
| `test_motor_avanco.py` (12) | Resolução de duelo em jogo único, ida e volta e pênaltis; propagação de vencedor e perdedor no grafo de vagas |
| `test_motor_sumula.py` (16) | Gol contra beneficiando o adversário, expulsão derivada do 2º amarelo, artilharia, travas de reabertura |
| `test_motor_disciplina.py` (9) | Acúmulo de amarelos, suspensões por vermelho, reconciliação idempotente, desempate manual |

### 2.2 Contratos e schema

- `test_contratos_infra.py`: configuração por formato (união discriminada), campos
  desconhecidos recusados, transação única por operação, controle de `revisao`.
- `test_schema.py`, `test_schema_fatia2.py`, `test_schema_fatia3.py`: o banco **impede**,
  sozinho, integrante de equipe de outra edição, competidor em duas equipes da mesma edição,
  partida entre equipes de edições diferentes e duelo com vaga inválida.
- `test_publico_allowlist.py`: cada campo exposto no portal público é uma decisão explícita;
  o teste falha se surgir campo novo sem decisão, ou campo proibido (documento, data de
  nascimento, motivo de sanção, configuração).

### 2.3 Serviços e API

Usam um SQLite descartável, migrado pela cadeia Alembic (não por `create_all`), com chaves
estrangeiras ligadas, e chamam a API por HTTP real com tokens de cada perfil.

| Arquivo | Cobre |
| --- | --- |
| `test_organizacao.py` | Eventos, competições e edições; períodos; publicação independente do estado |
| `test_elencos.py` | Competidores, importação de aluno sem duplicar (inclusive concorrente), cópia de elenco |
| `test_servico_disputa.py` | Geração e desfazer tabela, encerramento da fase de grupos |
| `test_servico_partidas.py` | Agendamento opcional, placar simples idempotente, avanço automático no mata-mata |
| `test_servico_sumula.py` | Súmula detalhada, pênaltis, cancelamento, reabertura justificada |
| `test_servico_disciplina.py` | Suspensões automáticas e manuais, cumprimento, revisão disciplinar |
| `test_servico_classificacao.py`, `test_servico_ciclo_vida_desempate.py` | Classificação por API, desempate manual com hash, iniciar/finalizar/reabrir/cancelar edição |
| `test_publico_api.py` | Portal sem login, mesmo 404 para edição privada e inexistente, sem vazamento de dados, histórico de edições |
| `test_exclusao_cascata.py` | Excluir competição apaga todas as edições; excluir edição apaga só ela; excluir equipe apaga seus atletas; nenhum `DELETE` com subconsulta (recusado pelo MySQL) |

### 2.4 Fluxos ponta a ponta do backend

`test_e2e_fatia1.py` a `test_e2e_fatia3.py` montam campeonatos completos pela API: cadastro,
elencos, geração, resultados, súmula, cartões, suspensão cumprida, mata-mata com pênaltis,
reabertura bloqueada por jogo descendente iniciado, desempate manual e finalização.

### 2.5 Como executar

```
# Módulo de competições (≈ 8 s)
.venv/bin/pytest competition_tests/consolidacao -q

# Suíte completa do backend, como no CI (≈ 30 s)
DATABASE_URL=sqlite:///:memory: SECRET_KEY=teste .venv/bin/python -m pytest tests migration_tests competition_tests -q

# Um arquivo ou um teste específico
.venv/bin/pytest competition_tests/consolidacao/test_publico_api.py -q
.venv/bin/pytest competition_tests/consolidacao -k "folga" -q
```

Use `python -m pytest` na suíte completa: `migration_tests` importa o pacote `scripts` a
partir da raiz. Os testes nunca usam o banco do `.env`.

### 2.6 Banco MySQL real

`scripts/testar_mysql_competicoes.py` aplica as migrações num banco MySQL descartável (nome
aleatório, apagado ao fim) e compara o schema com o ORM. Exige `HARNESS_MYSQL_URL` com um
usuário que possa criar e apagar bancos. Rodar antes de deploy e sempre que houver migração.

## 3. Testes E2E de navegador (Playwright)

### 3.1 O que existe

| Spec | Cenários | Backend |
| --- | --- | --- |
| `estrutura.spec.ts` | Sidebar recolhida persiste; gaveta pelo ☰ abaixo de 1024 px; trilha "Competições / <nome>"; sair pelo menu do usuário | Real |
| `tema.spec.ts` | Primeira visita segue `prefers-color-scheme`; troca manual persiste; tokens mudam com o tema | Sem backend |
| `ui.spec.ts` | Vitrine `/test-ui`: nome acessível do modal, Esc fecha só o modal do topo, foco volta ao gatilho, `ConfirmDialog`, abas por teclado, menu, tabela larga a 390 px, cores dos tokens no escuro | Sem backend |
| `organizacao.spec.ts` | Criar competição e trocar formato; edição fora do período do evento; erro com "tentar novamente"; Visão geral com jogos realizados e pendência de jogos sem data | Real |
| `exclusao.spec.ts` | Excluir edição mantendo a competição; excluir competição com todas as edições (confirmação digitando o nome) | Real |
| `elencos.spec.ts` | Terceiro e aluno importado no elenco; importação sem duplicar; conflito de inscrição; cópia de elenco; camisa repetida aceita; excluir equipe pelo menu "⋯" (rascunho) | Real |
| `jogos.spec.ts` | Gerar tabela, agendar, lançar placar; W.O. e filtros | Real |
| `disciplina.spec.ts` | Suspensões automáticas e artilharia; cumprimento; suspensão manual; revisão | Real |
| `portal.spec.ts` | Navegação pública até a edição; edição privada; falha de rede com retentativa; falha ao atualizar mantém dados; vitrine separa Em andamento/Próximas/Encerradas; jogo ao vivo no topo | Real |
| `sumula.spec.ts` | Súmula detalhada; reabertura bloqueada; desempate manual | Simulado (`page.route`) |
| `classificacao.spec.ts` | Classificação, empate persistente, chaveamento, aviso no mata-mata | Simulado (`page.route`) |

"Simulado" significa que o teste intercepta as chamadas e responde com dados fixos: valida a
tela sem depender do banco. "Real" passa pela API e pelo banco de teste.

### 3.2 Ambiente isolado

O `frontend/playwright.config.ts` sobe sozinho tudo o que o teste precisa:

1. Apaga e recria `frontend/e2e.db` (SQLite) com as migrações e os usuários
   `admin/admin123` e `coordenador/coord123`, mais a modalidade Futebol.
2. Sobe o backend na porta **8001** apontando para esse banco.
3. Sobe o frontend (`next dev`) na porta **3001**, com `E2E_HARNESS=1`, o que habilita a
   página de apoio `/test-elencos` (que não existe no build de produção).

As portas são diferentes das de desenvolvimento (8000/3000) e o Playwright nunca reaproveita
um servidor já aberto. Assim, mesmo com o sistema rodando para uso, os testes **não gravam
no banco de desenvolvimento**.

### 3.3 Passo a passo para o E2E passar

1. **Dependências** (uma vez): `.venv` do backend com `pip install -r requirements.txt`;
   no `frontend/`, `npm install` e `npx playwright install chromium`.
2. **Portas livres**: 8001 e 3001 não podem estar em uso (`ss -ltn | grep -E ':(8001|3001)'`).
   Não é preciso parar o sistema que roda em 8000/3000.
3. **Executar** a partir de `frontend/`:
   ```
   npx playwright test                       # todos
   npx playwright test e2e/portal.spec.ts    # um arquivo
   npx playwright test --headed              # vendo o navegador
   npx playwright test --ui                  # modo interativo, passo a passo
   ```
4. **Ler uma falha**: o terminal mostra a linha e o erro; `test-results/<teste>/` guarda o
   contexto da página; `npx playwright show-report` abre o relatório.
5. **Primeira execução lenta**: o `next dev` compila cada página na primeira visita; um
   cenário pode estourar 60 s uma vez. Repetir o teste isolado confirma se é lentidão
   (passa em segundos) ou defeito.

### 3.4 Regras para novos testes E2E

- Criar os próprios dados pela API no início do teste, com nome + timestamp
  (`Copa X ${Date.now()}`); nunca depender de dado que "já está lá".
- Usar sempre `API_E2E` de `e2e/helpers/ambiente.ts`, nunca um endereço escrito à mão.
- Preferir seletores por papel e nome exato (`getByRole('button', { name: '…' })`) para não
  casar com dois elementos.
- Em teste de erro, interceptar a rede com `page.route(...)` em vez de derrubar o backend.
- Specs **simulados** usam token falso: toda chamada sem mock vai ao backend real, recebe 401 e
  desloga a sessão (a tela volta ao portal). A página da competição abre na aba **Visão geral**,
  que busca equipes, partidas, classificação, artilharia e painel disciplinar, e a página
  busca `/modalidades`. `sumula.spec.ts` e `classificacao.spec.ts` registram, no início do
  `beforeEach`, respostas padrão de menor prioridade para essas rotas; mocks registrados
  depois têm prioridade (o Playwright testa as rotas da última para a primeira).
- Abas são `role="tab"` (Radix): clicar por `getByTestId('tab-<aba>')`; ações secundárias
  ficam em menus "⋯" (`menuitem`) e precisam do menu aberto antes.

## 4. Dados de teste que ficaram no banco de desenvolvimento

Até 19/10/2026 o Playwright podia reaproveitar um backend já aberto na porta 8000 e gravar
no banco de desenvolvimento. Por isso aparecem competições como "Torneio Disciplina E2E
1760…". O ambiente agora é isolado (seção 3.2); para limpar o que ficou:

```
.venv/bin/python scripts/limpar_dados_e2e.py            # só lista o que encontrou
.venv/bin/python scripts/limpar_dados_e2e.py --apagar   # apaga (faça backup antes)
```

O script reconhece apenas o padrão exato que os testes geram (nome fixo + timestamp de 13
dígitos e alunos fictícios com escola e mãe fictícias) e é ele mesmo coberto por teste
(`test_limpar_dados_e2e.py`), que garante que dados reais, mesmo com nomes parecidos, ficam
intactos. Alunos reais que um teste antigo tenha importado como competidor são apenas
listados, para revisão manual.

## 5. Situação em 19/10/2026

| Verificação | Resultado |
| --- | --- |
| `pytest` completo do backend | 472 aprovados, 1 pulado (exige MySQL) |
| Módulo de competições | 366 aprovados |
| Playwright E2E | 26 aprovados |
| `npx tsc --noEmit` | 0 erros |
| `npm run build` | sucesso |
| Harness MySQL | não executado nesta data (precisa de credenciais locais) |

## 6. Situação em 16/11/2026 (redesign do frontend concluído)

| Verificação | Resultado |
| --- | --- |
| Playwright E2E | 51 aprovados (inclui `estrutura`, `tema` e `ui`) |
| `npx tsc --noEmit` | 0 erros |
| `npm run build` | sucesso (precisa de acesso a `fonts.googleapis.com` para baixar a fonte Geist) |
| `git diff --check` | sem problemas |
| Screenshots | `docs/design/depois/` — 16 telas × 2 temas × 2 larguras (64 capturas) |
| `pytest` do backend | não reexecutado: o redesign não alterou o backend |
