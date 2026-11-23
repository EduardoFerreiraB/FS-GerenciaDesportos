import { Page, expect } from '@playwright/test';
import { API_E2E } from './ambiente';

export interface LoginOptions {
  username?: string;
  password?: string;
}

/**
 * Realiza o login na aplicação preenchendo o formulário de login via UI.
 */
export async function loginAs(page: Page, options: LoginOptions = {}) {
  const username = options.username ?? 'admin';
  const password = options.password ?? 'admin123';

  await page.goto('/login');

  const userInput = page.getByLabel('Usuário').or(page.getByPlaceholder('Seu usuário'));
  await userInput.fill(username);

  const passInput = page.getByLabel('Senha').or(page.getByPlaceholder('••••••••'));
  await passInput.fill(password);

  await page.getByRole('button', { name: /acessar sistema|entrar/i }).click();

  // Aguarda transição para o dashboard
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Autentica o usuário diretamente injetando os tokens no localStorage do navegador.
 * Evita repetição do fluxo visual em testes que não testam o login em si.
 */
export async function authenticateDirectly(page: Page, options: LoginOptions = {}) {
  const username = options.username ?? 'admin';
  const password = options.password ?? 'admin123';

  const response = await page.request.post(`${API_E2E}/token`, {
    form: {
      username,
      password,
    },
  });

  if (!response.ok()) {
    throw new Error(`Falha ao obter token de autenticação: ${response.status()} ${await response.text()}`);
  }

  const data = await response.json();
  const token = data.access_token as string;
  const refreshToken = (data.refresh_token as string) || null;

  await page.addInitScript(
    ({ t, r }) => {
      localStorage.setItem('token', t);
      if (r) {
        localStorage.setItem('refresh_token', r);
      }
    },
    { t: token, r: refreshToken }
  );
}
