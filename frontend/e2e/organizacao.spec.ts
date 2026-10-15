import { test, expect } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';

test.describe('Organização de Eventos, Competições e Edições', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateDirectly(page);
  });

  test('cria competição independente e troca o formato descartando config incompatível', async ({ page }) => {
    const nomeComp = `Copa Metropolitana ${Date.now()}`;
    await page.goto('/dashboard/competicoes');
    await page.getByRole('button', { name: 'Nova competição' }).click();

    // Preenche dados básicos da competição e primeira edição
    await page.getByLabel('Nome da Competição').fill(nomeComp);
    await page.getByLabel('Identificação da Edição').fill('2026');
    await page.getByLabel('Modalidade').selectOption({ label: 'Futebol' });
    await page.getByLabel('Data de Início').fill('2026-06-01');
    await page.getByLabel('Data de Término').fill('2026-06-30');

    // Seleciona formato Grupos + Mata-mata e preenche quantidade de grupos
    await page.getByLabel('Formato').selectOption('GRUPOS_MATA_MATA');
    await page.getByLabel('Quantidade de grupos').fill('2');

    // Troca para pontos corridos -> deve abrir diálogo de confirmação de descarte
    await page.getByLabel('Formato').selectOption('PONTOS_CORRIDOS');
    await expect(page.getByRole('dialog', { name: /descartar/i })).toBeVisible();

    // Confirma descarte
    await page.getByRole('button', { name: /descartar|confirmar/i }).click();

    // Salva a competição
    await page.getByRole('button', { name: /salvar|criar competição/i }).click();

    // A edição aparece como RASCUNHO e não publicada
    await expect(page.getByRole('heading', { name: new RegExp(nomeComp, 'i') })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/não publicada/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('RASCUNHO').first()).toBeVisible({ timeout: 15000 });
  });

  test('edição fora do período do evento mostra o erro do backend', async ({ page }) => {
    const nomeEvento = `Jogos da Primavera ${Date.now()}`;
    // 1. Cria um evento com período definido
    await page.goto('/dashboard/eventos');
    await page.getByRole('button', { name: 'Novo evento' }).click();
    await page.getByLabel('Nome do Evento').fill(nomeEvento);
    await page.getByLabel('Identificação da Edição').fill('Edição 2026');
    await page.getByLabel('Data de Início').fill('2026-09-01');
    await page.getByLabel('Data de Término').fill('2026-09-15');
    await page.getByRole('button', { name: /salvar|criar evento/i }).click();

    // Aguarda carregar o evento ou clica para ver detalhe
    await expect(page.getByText(nomeEvento)).toBeVisible();
    await page.getByText(nomeEvento).click();

    // 2. Tenta adicionar competição ao evento com datas fora do período do evento
    await page.getByRole('button', { name: /adicionar competição/i }).click();
    await page.getByLabel('Nome da Competição').fill(`Futebol da Primavera ${Date.now()}`);
    await page.getByLabel('Identificação da Edição').fill('2026');
    await page.getByLabel('Modalidade').selectOption({ label: 'Futebol' });
    // Datas fora do período (evento vai de 01/09 a 15/09)
    await page.getByLabel('Data de Início').fill('2026-09-20');
    await page.getByLabel('Data de Término').fill('2026-09-25');
    await page.getByRole('button', { name: /salvar|criar competição/i }).click();

    // Espera a mensagem de erro do backend exibida na interface
    await expect(page.getByText(/deve estar contido no periodo/i)).toBeVisible();
  });

  test('falha de carregamento mostra erro com tentar novamente', async ({ page }) => {
    await page.route('**/competicoes/eventos*', (route) => route.abort());
    await page.goto('/dashboard/eventos');
    await expect(page.getByRole('button', { name: /tentar novamente/i })).toBeVisible();
  });
});
