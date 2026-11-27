# SMCE 🏆

[![CI/CD Pipeline](https://github.com/EduardoFerreiraB/FS-GerenciaDesportos/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/EduardoFerreiraB/FS-GerenciaDesportos/actions/workflows/ci-cd.yml)

Sistema web para gestão de programas esportivos: alunos, professores, turmas, modalidades, matrículas e frequência, além de **eventos e competições** com súmula, classificação e um **portal público** para acompanhar os resultados.

---

## ✨ Funcionalidades

### Gestão esportiva
* **Alunos e professores** — cadastro e ficha detalhada, com upload de documentos dos alunos.
* **Modalidades e turmas** — turmas vinculadas a uma modalidade, com professor, categoria de idade, dias da semana e horários.
* **Matrículas** — vínculo entre aluno e turma.
* **Frequência** — registro de presenças por turma.
* **Usuários e perfis** — `admin`, `coordenador`, `professor` e `assistente`, com autenticação JWT.
* **Dashboard** — visão geral com indicadores do programa.

### Eventos e competições
* **Eventos** que agrupam uma ou mais **competições**, com edições próprias.
* **Equipes e elencos** formados por alunos das turmas ou por **competidores externos** (pessoas cadastradas só para competir).
* **Partidas** — agendamento, início, resultado, finalização, cancelamento e reabertura.
* **Súmula** com ocorrências (gols, cartões etc.), **artilharia** e **controle disciplinar** (suspensões).
* **Classificação** e **chaveamento** calculados automaticamente.
* **Árbitros e locais** de jogo.

### Portal público
Páginas abertas, sem login, para acompanhar eventos, competições e edições (tabela, jogos e resultados):
`/publico/evento/{slug}`, `/publico/competicao/{slug}` e `/publico/edicao/{id}`.

---

## 🛠️ Tecnologias

| Camada | Stack |
|---|---|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PyMySQL, JWT (python-jose + bcrypt) |
| **Banco** | MySQL 8 (produção/desenvolvimento) · SQLite (testes) |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, componentes no estilo shadcn/ui sobre Radix UI, SWR, React Hook Form, Recharts, tema claro e escuro |
| **Testes** | pytest (backend) · Playwright (E2E do frontend) |
| **CI/CD** | GitHub Actions → deploy no Render (API) e Vercel (frontend) |

---

## 📁 Estrutura

```
app/                  Backend FastAPI
├── routers/          Rotas de gestão (alunos, turmas, matrículas, presenças...)
├── competicoes/      Domínio de eventos e competições
│   ├── api/          Rotas (organização, elencos, partidas, súmula, classificação, público...)
│   ├── contratos/    Schemas de entrada e saída
│   ├── modelos/      Modelos ORM
│   └── servicos/     Regras de negócio
├── models.py · schemas.py · security.py · database.py
alembic/              Migrações do banco (baseline única 20261015_0100)
frontend/             Next.js
├── src/app/          Páginas (dashboard/, publico/, login/)
└── e2e/              Testes Playwright
tests/                Testes do backend
docs/                 Deploy, migrações, design e roteiros de teste
```

---

## 🚀 Como rodar localmente

### 📋 Pré-requisitos
* [Python 3.12+](https://www.python.org/)
* [Node.js 22+](https://nodejs.org/)
* [MySQL 8](https://dev.mysql.com/downloads/) rodando

### 🛠️ Primeira vez

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/EduardoFerreiraB/FS-GerenciaDesportos.git
   cd FS-GerenciaDesportos
   ```

2. **Crie e ative um ambiente virtual:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Linux/Mac
   .venv\Scripts\activate      # Windows
   ```

3. **Instale as dependências e configure o banco:**
   ```bash
   python setup_local.py
   ```
   O script instala as dependências do backend e do frontend, cria o banco MySQL e gera o arquivo `.env` com `DATABASE_URL` e `SECRET_KEY`.

4. **Crie as tabelas com o Alembic:**
   ```bash
   alembic upgrade head
   ```
   O schema é versionado exclusivamente pelo Alembic; nem a API nem os scripts criam tabelas sozinhos. Detalhes em [`docs/database-migrations.md`](docs/database-migrations.md).

5. **Crie o usuário administrador:**
   ```bash
   python create_admin.py
   ```
   > Se o `setup_local.py` tentou criar o admin antes do passo 4, ele falha por falta de tabelas — basta rodar este comando depois da migração.

### 🏃 Uso diário

```bash
python dev.py
```

Inicia backend e frontend juntos:

* **Dashboard:** http://localhost:3000
* **Portal público:** http://localhost:3000/publico/...
* **API (Swagger):** http://localhost:8000/docs

O frontend usa `NEXT_PUBLIC_API_URL` para encontrar a API (padrão `http://localhost:8000`).

---

## 🧪 Testes

**Backend** (usa SQLite, sem precisar de MySQL):
```bash
DATABASE_URL=sqlite:///./test.db SECRET_KEY=teste python -m pytest
```

**Frontend:**
```bash
cd frontend
npx tsc --noEmit        # checagem de tipos
npx playwright test     # E2E — sobe backend e frontend isolados com banco SQLite próprio
```

A pipeline do GitHub Actions roda os testes do backend e o typecheck + build do frontend em todo push e pull request para a `main`; o deploy só acontece em push na `main` com tudo verde.

---

## 🐳 Docker Compose

O `docker-compose.yml` não contém credenciais; ele lê as variáveis abaixo do ambiente ou de um `.env` (não versionado):

* `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`
* `SECRET_KEY`

```bash
docker compose run --rm web alembic upgrade head   # uma vez, antes de subir
docker compose up
```

A API fica em http://localhost:8000 e o MySQL em `localhost:3307`.

---

## ☁️ Deploy

Backend no **Render** (via `Dockerfile`) e frontend na **Vercel** (pasta `frontend`). O passo a passo está em [`docs/deploy.md`](docs/deploy.md). Em cada release, rode `alembic upgrade head` antes de liberar a nova versão da API.
