import { test, expect, type Page } from '@playwright/test';
import { authenticateDirectly, loginAs } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

// T8 (L5): estrutura geral do painel.
// DF-RT08-01, DF-RT08-04, DF-RT02-03, DF-RT04-02, DF-RT03-01, DF-RT06-01, PD-RT06-04.

const notificacoesDeErro = (page: Page) => page.locator('[data-notificacao] [role="alert"]');

async function dispararErro(page: Page, mensagem: string) {
  // O NotificationProvider troca window.alert por um toast; mensagens com "Erro" viram erro.
  await page.evaluate((m) => window.alert(m), mensagem);
}

test('rota interna sem login vai para o login e volta para ela', async ({ page }) => {
  await page.goto('/dashboard/turmas');
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard%2Fturmas$/);

  await page.getByLabel('Usuário').fill('admin');
  await page.getByLabel('Senha', { exact: true }).fill('admin123');
  await page.getByRole('button', { name: 'Acessar Sistema' }).click();
  await expect(page).toHaveURL(/\/dashboard\/turmas$/);
});

test('redirect para fora do app é ignorado', async ({ page }) => {
  await page.goto('/login?redirect=%2F%2Fexemplo.com');
  await page.getByLabel('Usuário').fill('admin');
  await page.getByLabel('Senha', { exact: true }).fill('admin123');
  await page.getByRole('button', { name: 'Acessar Sistema' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test.describe('com sessão', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateDirectly(page);
    await page.goto('/dashboard');
    await expect(page.getByTestId('menu-usuario')).toBeVisible();
  });

  test('dois erros seguidos mostram uma única notificação', async ({ page }) => {
    await dispararErro(page, 'Erro um');
    await dispararErro(page, 'Erro dois');
    await expect(notificacoesDeErro(page)).toHaveCount(1);
    await expect(notificacoesDeErro(page)).toContainText('Erro dois');
  });

  test('fechar a notificação não fecha o diálogo aberto', async ({ page }) => {
    await page.getByTestId('menu-usuario').click();
    await page.getByRole('menuitem', { name: 'Alterar senha' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Alterar senha' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel('Senha atual').fill('digitado');

    await dispararErro(page, 'Erro ao salvar');
    await page.getByRole('button', { name: 'Fechar notificação' }).click();

    await expect(notificacoesDeErro(page)).toHaveCount(0);
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByLabel('Senha atual')).toHaveValue('digitado');
  });

  test('foco volta ao avatar ao fechar Alterar senha', async ({ page }) => {
    await page.getByTestId('menu-usuario').click();
    await page.getByRole('menuitem', { name: 'Alterar senha' }).click();
    await page.getByRole('dialog', { name: 'Alterar senha' }).getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('button', { name: 'Menu do usuário' })).toBeFocused();
  });
});

test('troca obrigatória abre sem botão de fechar e a API também a exige', async ({ page, request }) => {
  const token = await (await request.post(`${API_E2E}/token`, { form: { username: 'admin', password: 'admin123' } })).json();
  const username = `troca${Date.now()}`;
  const criado = await request.post(`${API_E2E}/register`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    data: { username, password: 'senha123', role: 'professor' },
  });
  expect(criado.ok()).toBeTruthy();

  await authenticateDirectly(page, { username, password: 'senha123' });
  await page.goto('/dashboard');
  const dialogo = page.getByRole('dialog', { name: 'Alteração obrigatória' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Fechar' })).toHaveCount(0);
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeVisible();
});

test.describe('vitrine de componentes', () => {
  test('confirmação por texto só libera com o texto exato', async ({ page }) => {
    await page.goto('/test-ui');
    await page.getByRole('button', { name: 'Excluir competição' }).click();
    const confirmar = page.getByTestId('btn-confirmar-exclusao');
    await expect(confirmar).toBeDisabled();
    await page.getByTestId('input-confirmacao-exclusao').fill('copa municipal');
    await expect(confirmar).toBeDisabled();
    await page.getByTestId('input-confirmacao-exclusao').fill('Copa Municipal');
    await expect(confirmar).toBeEnabled();
  });

  test('abas sem rolagem vertical', async ({ page }) => {
    await page.goto('/test-ui');
    const lista = page.getByRole('tablist', { name: 'Seções' });
    await expect(lista).toBeVisible();
    const overflowY = await lista.evaluate((el) => getComputedStyle(el).overflowY);
    // Sem rolagem vertical o navegador não desenha as setas de rolagem (DF-RT03-01).
    expect(overflowY).toBe('hidden');
  });
});

test('coordenador vê o item Usuários no menu', async ({ page }) => {
  await loginAs(page, { username: 'coordenador', password: 'coord123' });
  await expect(page.getByRole('link', { name: 'Usuários' })).toBeVisible();
});
