# Checklist e Guia de Rollout: Domínio de Competições (Passo 9)

Este guia define a estratégia operacional de publicação em produção do novo domínio de competições esportivas (torneios coletivos e individuais), migrações de dados históricos e chaveamento da aplicação.

---

## 1. Visão Geral e Arquitetura do Rollout

A transição segue o padrão **Expand/Contract (Duas Etapas)** para eliminar downtime e garantir idempotência:

```
[Etapa 1: Backend & DB]                [Etapa 2: Frontend]              [Etapa 3: Pós-Rollout]
• Backup MySQL e ensaio SQLite         • Build & Typecheck (Next.js)     • Verificação de auditoria
• Alembic upgrade head (0001 -> 0005)  • Deploy do Frontend (Vercel)     • Monitoramento de logs/APIs
• Validadores offline de reconciliação • Smoke tests de navegação        • Suporte e observabilidade
• Deploy do Backend com rotas duplas
```

### Princípios Inegociáveis
1. **Retrocompatibilidade**: A API preserva endpoints e contratos pré-existentes. Clientes antigos continuam operacionais durante a Etapa 1.
2. **Auditabilidade de Dados**: Nenhuma linha histórica de `equipes` ou `partidas` é apagada sem registro em `migracao_equipes_origem` e `migracao_partidas_origem`.
3. **Integridade de Deleção**: Edições que possuem competições ativas/iniciadas ou com vínculos (equipes/confrontos/provas) não podem ser excluídas em cascata.
4. **Idempotência de DDL**: Migrações e scripts podem ser reexecutados sem corromper estado existente.

---

## 2. Pré-Requisitos e Janela de Manutenção

- [ ] **Comunicação da Janela**: Agendar janela operacional e notificar administradores/coordenadores.
- [ ] **Backup Lógico Completo do MySQL**:
  ```bash
  mysqldump -u <usuario> -p \
    --single-transaction \
    --quick \
    --triggers \
    --routines \
    --databases gerencia > backup_pre_rollout_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] **Confirmação do Backup**: Validar tamanho e integridade do arquivo gerado.
- [ ] **Verificação de Ambiente**:
  - `DATABASE_URL` configurada no ambiente de produção.
  - Python 3.12+ e virtualenv ativo.
  - Variável `SECRET_KEY` definida.

---

## 3. Etapa 1 — Rollout Aditivo e Compatível (Banco de Dados & Backend)

### 3.1 Aplicação das Migrações no Banco de Produção (Alembic)

1. **Inspeção Prévia do SQL Gerado (Modo Offline)**:
   ```bash
   DATABASE_URL="mysql+pymysql://<user>:<pwd>@<host>/<db>" alembic upgrade head --sql > /tmp/migration_preview.sql
   ```
   - [ ] Revisar `/tmp/migration_preview.sql` e verificar a cadeia de migrações:
     - `20261015_0100`: Baseline derivado do metadata ORM (escolinhas e infraestrutura base).
     - `20261015_0200`: Consolidação do domínio de competições de futebol (remoção do legado e criação das tabelas definitivas).

2. **Aplicação das Migrações em Produção**:
   > [!IMPORTANT]
   > A migração `20261015_0200` descarta as tabelas de competições legadas e exige explicitamente a opção de descarte:
   ```bash
   alembic upgrade head -x descartar_competicoes_teste=sim
   ```
   - [ ] Verificar status do Alembic:
     ```bash
     alembic current
     ```
     Deverá exibir a revisão `20261015_0200 (head)`.

### 3.2 Deploy e Validação do Backend (API)

1. **Deploy da Release da API**:
   - No Render ou servidor de aplicação, efetuar o deploy da release contendo o código atualizado.
2. **Smoke Test de Saúde e Endpoints**:
   - [ ] Healthcheck: `GET /health` -> `200 OK` (`{"status": "ok", "database": "connected"}`).
   - [ ] Documentação OpenAPI: `GET /docs` -> `200 OK` (verificar tag `Competições` com prefixo `/competicoes`).
   - [ ] Endpoints de escolinhas continuam respondendo normalmente:
     - `GET /modalidades/` -> `200 OK`.
     - `GET /alunos/` -> `200 OK`.
   - [ ] Rota legada de inscrição de atletas descontinuada:
     - `POST /atletas/equipe/1` -> `410 Gone`.

---

## 4. Etapa 2 — Chaveamento do Novo Frontend

Com o backend 100% atualizado e retrocompatível, inicia-se o deploy do novo frontend com suporte aos fluxos de competições esportivas.

### 4.1 Pré-Deploy do Frontend
- [ ] Executar validação estática no diretório `frontend`:
  ```bash
  cd frontend
  npx tsc --noEmit
  npm run build
  ```
  Garantir saída com **0 erros** e build concluído com sucesso.

### 4.2 Deploy na Vercel (Produção)
1. **Configuração de Variáveis na Vercel**:
   - `NEXT_PUBLIC_API_URL`: URL de produção da API (ex: `https://gerencia-desportos-backend.onrender.com`).
2. **Publicação da Release**:
   - Disparar o deploy da branch `main` no painel da Vercel.
   - Aguardar conclusão do build na plataforma.

### 4.3 Verificação Funcional Ponta a Ponta (Smoke Tests no Frontend)
- [ ] **Autenticação**:
  - Login como Administrador/Coordenador.
  - Login como Professor/Assistente (verificar restrições de permissão).
- [ ] **Torneios Coletivos (Futebol / Basquete / Futsal)**:
  - Navegar até uma Edição -> aba **Competições**.
  - Criar competição em status `RASCUNHO`.
  - Configurar modalidade, formato (Mata-Mata / Pontos Corridos / Grupos) e critério de placar.
  - Inscrever equipes.
  - Iniciar competição e gerar confrontos.
  - Lançar placar de partida e verificar atualização da tabela de classificação.
- [ ] **Torneios Individuais (Natação / Atletismo / Judô)**:
  - Criar competição individual em formato `PROVAS` com critério `TEMPO` ou `POSICAO`.
  - Cadastrar atletas participantes com número de peito.
  - Cadastrar provas e horários.
  - Iniciar competição, registrar resultados, desqualificações (DSQ) e pódio.
  - Conferir cálculo automático do Quadro Geral de Medalhas.
- [ ] **Portal Público**:
  - Acessar `/competicoes/[id]` sem autenticação.
  - Verificar visualização do chaveamento mata-mata / classificação e lista de confrontos.

---

## 5. Etapa 3 — Observabilidade, Monitoramento e Pós-Rollout

### 5.1 Verificação de Integridade dos Dados em Produção
- [ ] Executar contagens de integridade no MySQL:
  ```sql
  -- Verificar total de competições e estados
  SELECT status, COUNT(*) FROM competicoes GROUP BY status;

  -- Conferir registros de auditoria de equipes
  SELECT status, COUNT(*) FROM migracao_equipes_origem GROUP BY status;

  -- Conferir registros de auditoria de partidas para confrontos
  SELECT status, COUNT(*) FROM migracao_partidas_origem GROUP BY status;

  -- Garantir que não existem confrontos órfãos
  SELECT COUNT(*) FROM confrontos WHERE id_competicao NOT IN (SELECT id_competicao FROM competicoes);
  ```

### 5.2 Monitoramento Contínuo (Primeiras 48 Horas)
- [ ] Monitorar logs de erro HTTP (códigos 4xx e 5xx) no painel do Render/Uvicorn.
- [ ] Monitorar erros de renderização clientside no console do navegador / ferramentas de APM.
- [ ] Monitorar métricas de CPU, memória e pool de conexões do MySQL.

---

## 6. Plano de Contingência e Rollback

### Matriz de Decisão de Rollback
| Cenário de Falha | Ação Recomendada | Impacto no Usuário |
| :--- | :--- | :--- |
| **Falha na Etapa 1 (Migrações)** | Abortar transação; restaurar dump MySQL pré-rollout. | Nenhum; sistema antigo mantido. |
| **Falha na Etapa 1 (Deploy da API)** | Reverter imagem Docker no Render para a versão anterior. | Baixo; breve indisponibilidade de 1-2 min. |
| **Falha na Etapa 2 (Frontend)** | Instant Rollback na Vercel para o deployment anterior. | Baixo; usuários veem a interface legada funcional. |
| **Inconsistência de Dados Pós-Rollout** | Analisar tabela de auditoria correspondente (`migracao_*`); aplicar patch focal. | Médio; não reverter migração de banco via downgrade. |

### Nota Crítica sobre Downgrade de Banco
> [!CAUTION]
> As migrações `20260824_0003` e `20260824_0004` possuem travas explícitas de downgrade: se registros foram reconciliados, o comando `alembic downgrade` é **bloqueado intencionalmente** para evitar perda de dados históricos e quebra referencial de partidas migradas.
> Em caso de contingência severa no banco durante a Etapa 1, utilize a restauração completa do backup físico/lógico `backup_pre_rollout_*.sql`.

---

## 7. Checklist Rápido de Assinatura Operacional

| Etapa | Responsável | Status | Horário |
| :--- | :--- | :---: | :---: |
| 1. Backup completo do MySQL executado e validado | SRE / DBA | [ ] | __:__ |
| 2. Validação offline de equipes e confrontos (`exit 0`) | Backend Lead | [ ] | __:__ |
| 3. Aplicação do Alembic Upgrade (`head`) em produção | SRE / DBA | [ ] | __:__ |
| 4. Deploy da nova versão do Backend | DevOps | [ ] | __:__ |
| 5. Smoke tests da API e integridade de exclusão | QA / Backend | [ ] | __:__ |
| 6. Deploy do novo Frontend na Vercel | Frontend Lead | [ ] | __:__ |
| 7. Smoke tests ponta a ponta (coletivas e individuais) | QA / Produto | [ ] | __:__ |
| 8. Monitoramento de logs e aprovação final | Tech Lead | [ ] | __:__ |
