import { test, expect, APIRequestContext } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

/**
 * A competição é o principal e as edições são secundárias: excluir uma edição
 * mantém a competição; excluir a competição leva todas as edições junto.
 */
async function competicaoComDuasEdicoes(request: APIRequestContext) {
  const token = (await (await request.post(`${API_E2E}/token`, {
    form: { username: 'coordenador', password: 'coord123' },
  })).json()).access_token as string;
  const headers = { Authorization: `Bearer ${token}` };
  const modalidades = await (await request.get(`${API_E2E}/modalidades/`, { headers })).json();
  const nome = `Copa Exclusão ${Date.now()}`;
  const configuracao = { formato: 'PONTOS_CORRIDOS', desempates: ['SALDO_GOLS'] };

  const competicao = await (await request.post(`${API_E2E}/competicoes/competicoes`, {
    headers,
    data: {
      nome,
      id_modalidade: modalidades[0].id_modalidade,
      edicao: { identificacao: 'Edição 2025', data_inicio: '2025-03-01', data_fim: '2025-06-30',
                formato: 'PONTOS_CORRIDOS', configuracao },
    },
  })).json();
  const segunda = await request.post(`${API_E2E}/competicoes/competicoes/${competicao.id_competicao}/edicoes`, {
    headers,
    data: { identificacao: 'Edição 2026', data_inicio: '2026-03-01', data_fim: '2026-06-30',
            formato: 'PONTOS_CORRIDOS', configuracao },
  });
  expect(segunda.ok()).toBeTruthy();
  return { idCompeticao: competicao.id_competicao as number, nome, headers };
}

test('excluir edição mantém a competição; excluir competição leva tudo', async ({ page, request }) => {
  const { idCompeticao, nome, headers } = await competicaoComDuasEdicoes(request);
  await authenticateDirectly(page);
  await page.goto(`/dashboard/competicoes/${idCompeticao}`);

  // Excluir a edição 2026 exige digitar a identificação (ação fica no menu "⋯" da edição)
  await page.getByLabel('Edição', { exact: true }).selectOption({ label: 'Edição 2026 · Rascunho' });
  await expect(page.getByRole('heading', { name: 'Edição 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Mais ações da edição' }).click();
  await page.getByTestId('btn-excluir-edicao').click();
  const confirmar = page.getByTestId('btn-confirmar-exclusao');
  await expect(confirmar).toBeDisabled();
  await page.getByTestId('input-confirmacao-exclusao').fill('Edição 2026');
  await confirmar.click();

  const seletor = page.getByLabel('Edição', { exact: true });
  await expect(seletor.getByRole('option', { name: /Edição 2026/ })).toHaveCount(0);
  await expect(seletor.getByRole('option', { name: /Edição 2025/ })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Edição 2025' })).toBeVisible();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();

  // Excluir a competição apaga a edição restante e volta para a lista (menu "⋯" do cabeçalho)
  await page.getByRole('button', { name: 'Mais ações da competição' }).click();
  await page.getByTestId('btn-excluir-competicao').click();
  await page.getByTestId('input-confirmacao-exclusao').fill(nome);
  await page.getByTestId('btn-confirmar-exclusao').click();
  await expect(page).toHaveURL(/\/dashboard\/competicoes$/);

  const resposta = await request.get(`${API_E2E}/competicoes/competicoes/${idCompeticao}`, { headers });
  expect(resposta.status()).toBe(404);
});
