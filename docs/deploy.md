# Guia de Deploy (Back-end no Render & Front-end na Vercel)

Este documento orienta o deploy da aplicação em produção de forma rápida e integrada.

---

## 1. Passo 1: Deploy do Back-end no Render

O Render lerá o nosso `Dockerfile` de produção e disponibilizará a API automaticamente.

1. Acesse o [Dashboard do Render](https://dashboard.render.com/) e faça login (você pode conectar com sua conta do GitHub).
2. Clique no botão **New +** e selecione **Web Service**.
3. Conecte o repositório do seu GitHub contendo o projeto.
4. Preencha as configurações do serviço:
   * **Name**: `gerencia-desportos-backend` (ou de sua preferência)
   * **Region**: Escolha a mais próxima (ex: `Oregon (US West)` ou `Ohio (US East)`)
   * **Branch**: `main`
   * **Root Directory**: Deixe em branco (o repositório raiz)
   * **Runtime**: Selecione **Docker** (isso fará com que o Render compile o `Dockerfile` otimizado automaticamente)
   * **Instance Type**: Escolha a opção gratuita (**Free**) ou superior.
5. Em **Advanced**:
   * Adicione as variáveis de ambiente:
     * `ENV`: `production`
     * `SECRET_KEY`: Uma chave alfanumérica longa e segura para assinar os tokens JWT.
   * Procure pela opção **Auto Deploy** e mude para **No** (para impedir deploys automáticos sem antes validar os testes).
6. Clique em **Create Web Service**.
7. Ao concluir, o Render também disponibilizará a URL pública da sua API (ex: `https://gerencia-desportos-backend.onrender.com`). **Copie essa URL**.

---

## 2. Passo 2: Deploy do Front-end na Vercel

A Vercel é especializada em hospedar e compilar aplicações Next.js de forma otimizada.

1. Acesse o [Dashboard da Vercel](https://vercel.com/dashboard) e faça login com seu GitHub.
2. Clique em **Add New...** > **Project**.
3. Importe o mesmo repositório do GitHub.
4. Ajuste as configurações do projeto:
   * **Framework Preset**: O painel deve reconhecer automaticamente como **Next.js**.
   * **Root Directory**: Clique em *Edit* e selecione a pasta **`frontend`** (pois o front-end está isolado dentro desse diretório).
5. Abra a seção **Environment Variables** e adicione a seguinte variável:
   * **Key**: `NEXT_PUBLIC_API_URL`
   * **Value**: Cole a URL gerada pelo Render no Passo 1 (ex: `https://gerencia-desportos-backend.onrender.com`).
6. Clique em **Deploy**.
7. Em menos de 2 minutos, a Vercel gerará o link público do seu front-end (ex: `https://gerencia-desportos-frontend.vercel.app`).

Pronto! Seu sistema completo estará online e se comunicando com segurança.
