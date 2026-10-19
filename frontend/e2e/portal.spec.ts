import { test, expect, APIRequestContext } from '@playwright/test';
import { API_E2E } from './helpers/ambiente';

/**
 * Portal público (Fatia 4): o visitante navega sem login. Os dados são
 * montados pela API administrativa; a navegação nunca injeta token.
 */
const API = `${API_E2E}`;

async function tokenCoordenador(request: APIRequestContext): Promise<string> {
  for (const form of [
    { username: 'coordenador', password: 'coord123' },
    { username: 'admin', password: 'admin123' },
  ]) {
    const res = await request.post(`${API}/token`, { form });
    if (res.ok()) return (await res.json()).access_token as string;
  }
  throw new Error('Falha ao autenticar perfil de gestão para montar os dados.');
}

interface Cenario {
  nomeCompeticao: string;
  slug: string;
  idEdicao: number;
  nomeAtleta: string;
}

async function montarEdicao(request: APIRequestContext, publicar: boolean): Promise<Cenario> {
  const token = await tokenCoordenador(request);
  const headers = { Authorization: `Bearer ${token}` };
  const ts = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const modalidades = await (await request.get(`${API}/modalidades/`, { headers })).json();
  const nomeCompeticao = `Copa Portal ${ts}`;
  const resComp = await request.post(`${API}/competicoes/competicoes`, {
    headers,
    data: {
      nome: nomeCompeticao,
      id_modalidade: modalidades[0].id_modalidade,
      edicao: {
        identificacao: '2026',
        data_inicio: '2026-06-01',
        data_fim: '2026-07-31',
        formato: 'PONTOS_CORRIDOS',
        configuracao: { formato: 'PONTOS_CORRIDOS', desempates: ['SALDO_GOLS'] },
      },
    },
  });
  expect(resComp.ok()).toBeTruthy();
  const competicao = await resComp.json();
  const idEdicao = competicao.edicoes[0].id_edicao_competicao as number;

  let nomeAtleta = '';
  for (const nomeEquipe of [`Águias ${ts}`, `Corujas ${ts}`]) {
    const equipe = await (
      await request.post(`${API}/competicoes/edicoes/${idEdicao}/equipes`, { headers, data: { nome: nomeEquipe } })
    ).json();
    const competidor = await (
      await request.post(`${API}/competicoes/competidores`, {
        headers,
        data: { nome: `Pessoa ${nomeEquipe}`, documento: `DOC-${ts}` },
      })
    ).json();
    nomeAtleta = `Camisa10 ${nomeEquipe}`;
    const inscricao = await request.post(`${API}/competicoes/equipes/${equipe.id_equipe}/integrantes`, {
      headers,
      data: { id_competidor: competidor.id_competidor, nome_esportivo: nomeAtleta, numero_camisa: 10 },
    });
    expect(inscricao.ok()).toBeTruthy();
  }

  const gerar = await request.post(`${API}/competicoes/edicoes/${idEdicao}/gerar-tabela`, { headers, data: {} });
  expect(gerar.ok()).toBeTruthy();

  if (publicar) {
    const pub = await request.post(`${API}/competicoes/edicoes/${idEdicao}/publicar`, {
      headers,
      data: { publicada: true },
    });
    expect(pub.ok()).toBeTruthy();
  }
  return { nomeCompeticao, slug: competicao.slug, idEdicao, nomeAtleta };
}

test.describe('Portal público (Fatia 4)', () => {
  test('visitante navega da vitrine até a edição publicada', async ({ page, request }) => {
    const cenario = await montarEdicao(request, true);

    await page.goto('/');
    await page.getByLabel('Buscar por nome').fill(cenario.nomeCompeticao);
    await page.getByRole('link', { name: cenario.nomeCompeticao }).click();
    await expect(page).toHaveURL(new RegExp(`/publico/competicao/${cenario.slug}$`));

    await page.getByRole('link', { name: /2026/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/publico/edicao/${cenario.idEdicao}$`));
    await expect(page.getByRole('heading', { name: new RegExp(cenario.nomeCompeticao) })).toBeVisible();

    // Jogo gerado sem agendamento aparece como "a definir", sem placar fictício
    await expect(page.getByText('Data a definir').first()).toBeVisible();
    await expect(page.getByText('Local a definir').first()).toBeVisible();
    await expect(page.getByText(/0 x 0/)).toHaveCount(0);

    await page.getByRole('tab', { name: 'Classificação' }).click();
    await expect(page.getByRole('columnheader', { name: 'P', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Equipes' }).click();
    await expect(page.getByText(cenario.nomeAtleta)).toBeVisible();
    await expect(page.getByText(/DOC-/)).toHaveCount(0);
  });

  test('edição não publicada mostra não encontrado', async ({ page, request }) => {
    const cenario = await montarEdicao(request, false);
    await page.goto(`/publico/edicao/${cenario.idEdicao}`);
    await expect(page.getByText('Não encontrado')).toBeVisible();
    await expect(page.getByText(cenario.nomeCompeticao)).toHaveCount(0);
  });

  test('falha de rede mostra erro com tentar novamente e recupera', async ({ page, request }) => {
    const cenario = await montarEdicao(request, true);
    await page.route('**/competicoes/publico/**', (rota) => rota.abort());

    await page.goto(`/publico/edicao/${cenario.idEdicao}`);
    await expect(page.getByText('Não foi possível carregar a edição.')).toBeVisible();
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await expect(tentar).toBeVisible();

    await page.unroute('**/competicoes/publico/**');
    await tentar.click();
    await expect(page.getByRole('heading', { name: new RegExp(cenario.nomeCompeticao) })).toBeVisible();
  });

  test('falha ao atualizar mantém os dados em tela e oferece nova tentativa', async ({ page, request }) => {
    const cenario = await montarEdicao(request, true);
    await page.goto(`/publico/edicao/${cenario.idEdicao}`);
    await expect(page.getByText('Data a definir').first()).toBeVisible();

    await page.route('**/competicoes/publico/**', (rota) => rota.abort());
    // Revalidação ao voltar à aba (o SWR limita a uma a cada 5s)
    await page.waitForTimeout(5500);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(page.getByText(/Não foi possível atualizar os jogos/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Data a definir').first()).toBeVisible();

    await page.unroute('**/competicoes/publico/**');
    await page.getByRole('button', { name: 'Tentar novamente' }).first().click();
    await expect(page.getByText(/Não foi possível atualizar/)).toHaveCount(0, { timeout: 15000 });
  });
});
