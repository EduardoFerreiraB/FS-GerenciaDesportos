import { test, expect } from '@playwright/test';
import { authenticateDirectly, loginAs } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

/**
 * Estrutura da aplicação (D3): sidebar recolhível, gaveta abaixo de 1024px,
 * trilha da topbar e menu do usuário.
 */
test.describe('Estrutura da aplicação', () => {
  // Primeira visita ao /dashboard compila a página (recharts) no next dev.
  test.describe.configure({ timeout: 60000 });

  test('sidebar recolhida persiste após recarregar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await authenticateDirectly(page);
    await page.goto('/dashboard');

    const sidebar = page.getByTestId('sidebar');
    await expect(sidebar).toHaveAttribute('data-recolhida', 'false');

    await page.getByRole('button', { name: 'Recolher menu lateral' }).click();
    await expect(sidebar).toHaveAttribute('data-recolhida', 'true');

    await page.reload();
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-recolhida', 'true');

    await page.getByRole('button', { name: 'Expandir menu lateral' }).click();
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-recolhida', 'false');
  });

  test('abaixo de 1024px o menu abre pelo botão ☰', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticateDirectly(page);
    await page.goto('/dashboard');

    const sidebar = page.getByTestId('sidebar');
    await expect(sidebar).not.toBeInViewport();

    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(sidebar).toBeInViewport();

    await page.getByTestId('sidebar-fundo').click({ position: { x: 370, y: 400 } });
    await expect(sidebar).not.toBeInViewport();
  });

  test('trilha mostra Competições / <nome>', async ({ page, request }) => {
    const token = (await (await request.post(`${API_E2E}/token`, {
      form: { username: 'coordenador', password: 'coord123' },
    })).json()).access_token as string;
    const headers = { Authorization: `Bearer ${token}` };
    const modalidades = await (await request.get(`${API_E2E}/modalidades/`, { headers })).json();
    const nome = `Copa Trilha ${Date.now()}`;
    const resposta = await request.post(`${API_E2E}/competicoes/competicoes`, {
      headers,
      data: {
        nome,
        id_modalidade: modalidades[0].id_modalidade,
        edicao: {
          identificacao: 'Edição 2026', data_inicio: '2026-03-01', data_fim: '2026-06-30',
          formato: 'PONTOS_CORRIDOS', configuracao: { formato: 'PONTOS_CORRIDOS', desempates: ['SALDO_GOLS'] },
        },
      },
    });
    expect(resposta.ok()).toBeTruthy();
    const competicao = await resposta.json();

    await authenticateDirectly(page);
    await page.goto(`/dashboard/competicoes/${competicao.id_competicao}`);

    const trilha = page.getByTestId('trilha-topbar');
    await expect(trilha.getByRole('link', { name: 'Competições' })).toHaveAttribute('href', '/dashboard/competicoes');
    await expect(trilha.getByText(nome)).toBeVisible();
  });

  test('menu do usuário sai do sistema', async ({ page }) => {
    // Login pela tela: authenticateDirectly regrava o token a cada navegação.
    await loginAs(page);

    await page.getByTestId('menu-usuario').click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();

    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });
});
