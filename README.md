# SMCE 🏆

[![CI/CD Pipeline](https://github.com/EduardoFerreiraB/FS-GerenciaDesportos/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/EduardoFerreiraB/FS-GerenciaDesportos/actions/workflows/ci-cd.yml)

Sistema de matricula e controle esportivo, permitindo o controle de alunos, turmas, matrículas, frequências e modalidades.

## 🚀 Como Rodar Localmente

Este projeto utiliza **FastAPI (Python)** no backend e **Next.js** no frontend, com banco de dados **MySQL**.

### 📋 Pré-requisitos

Antes de começar, você precisará ter instalado em sua máquina:
* [Python 3.10+](https://www.python.org/)
* [Node.js 18+](https://nodejs.org/)
* [MySQL Server](https://dev.mysql.com/downloads/installer/) rodando.

---

### 🛠️ Passo 1: Instalação e Configuração (Primeira Vez)

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/seu-usuario/gerencia_esporte_api.git
   cd gerencia_esporte_api
   ```

2. **Crie e ative um ambiente virtual:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Linux/Mac
   # ou
   .venv\Scripts\activate     # Windows
   ```

3. **Execute o Script de Setup:**
   O script abaixo instalará automaticamente todas as dependências, configurará o banco MySQL, criará o usuário admin e **já iniciará o sistema para você**.
   ```bash
   python setup_local.py
   ```

   Com o usuário admin criado durante do setup, todas as configurações para usar o sistema estão prontas, basta usar as credencias que você criou para o user admin para entrar no sistema e navegar.

   Se quiser saber quais são as funcionalidades do sistema, a rota http://localhost:8000/docs te mostra todas as rotas existentes, desde criar modalidades a matricular aluno. Logado como usuário admin, você consegue fazer tudo no sistema, inclusive criar novos usuários.
---

### 🏃 Passo 2: Uso Diário (Próximas vezes)

Após ter realizado o setup inicial, você não precisa rodá-lo novamente. Para iniciar o Backend e o Frontend simultaneamente nas próximas vezes, basta usar:

```bash
python dev.py
```

* **Dashboard:** [http://localhost:3000](http://localhost:3000)
* **API Swagger:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ Tecnologias Utilizadas

**Backend:** FastAPI, SQLAlchemy, PyMySQL, JWT.
**Frontend:** Next.js, Tailwind CSS, TypeScript.

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
