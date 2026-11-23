import { test, expect } from '@playwright/test';

const corDoFundo = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('Tema claro/escuro', () => {
  test('primeira visita segue prefers-color-scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.evaluate(() => localStorage.clear());
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('troca manual persiste após recarregar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  });

  test('tokens mudam com o tema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('theme', 'light'));
    await page.reload();
    const claro = await corDoFundo(page);
    expect(claro).toBe('rgb(248, 250, 252)'); // --canvas claro #f8fafc

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect.poll(() => corDoFundo(page)).toBe('rgb(11, 17, 32)'); // --canvas escuro #0b1120
    expect(claro).not.toBe(await corDoFundo(page));
  });

  test('alternar pelo botão persiste', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/test-ui');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    const grupo = page.getByRole('group', { name: 'Tema' });
    await grupo.getByRole('button', { name: /escuro/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: /claro/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
