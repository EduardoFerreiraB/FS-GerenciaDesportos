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

async function montarEdicao(
  request: APIRequestContext,
  publicar: boolean,
  quantidadeEquipes = 2,
  gerarTabela = true,
): Promise<Cenario> {
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
  for (const nomeEquipe of [`Águias ${ts}`, `Corujas ${ts}`, `Falcões ${ts}`].slice(0, quantidadeEquipes)) {
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

  // Gerar a tabela já leva a edição a EM_ANDAMENTO; sem ela, a edição fica em RASCUNHO ("Próximas").
  if (gerarTabela) {
    const gerar = await request.post(`${API}/competicoes/edicoes/${idEdicao}/gerar-tabela`, { headers, data: {} });
    expect(gerar.ok()).toBeTruthy();
  }

  if (publicar) {
    const pub = await request.post(`${API}/competicoes/edicoes/${idEdicao}/publicar`, {
      headers,
      data: { publicada: true },
    });
    expect(pub.ok()).toBeTruthy();
  }
  return { nomeCompeticao, slug: competicao.slug, idEdicao, nomeAtleta };
}

interface PartidaAdmin {
  id_partida: number;
  rodada: number | null;
}

async function cabecalhosGestao(request: APIRequestContext) {
  return { Authorization: `Bearer ${await tokenCoordenador(request)}` };
}

async function transicionarEdicao(
  request: APIRequestContext,
  headers: Record<string, string>,
  idEdicao: number,
  acao: 'iniciar' | 'finalizar',
) {
  const res = await request.post(`${API}/competicoes/edicoes/${idEdicao}/${acao}`, { headers, data: {} });
  expect(res.ok()).toBeTruthy();
}

async function partidasDaEdicao(
  request: APIRequestContext,
  headers: Record<string, string>,
  idEdicao: number,
): Promise<PartidaAdmin[]> {
  const res = await request.get(`${API}/competicoes/edicoes/${idEdicao}/partidas`, { headers });
  expect(res.ok()).toBeTruthy();
  const partidas = (await res.json()) as PartidaAdmin[];
  return partidas.sort((a, b) => (a.rodada ?? 0) - (b.rodada ?? 0) || a.id_partida - b.id_partida);
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
    await expect(page.getByText('Data e local a definir').first()).toBeVisible();
    await expect(page.getByText(/0 x 0/)).toHaveCount(0);
    await expect(page.getByTestId('gols-mandante')).toHaveCount(0);

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
    await expect(page.getByText('Data e local a definir').first()).toBeVisible();

    await page.route('**/competicoes/publico/**', (rota) => rota.abort());
    // Revalidação ao voltar à aba (o SWR limita a uma a cada 5s)
    await page.waitForTimeout(5500);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(page.getByText(/Não foi possível atualizar os jogos/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Data e local a definir').first()).toBeVisible();

    await page.unroute('**/competicoes/publico/**');
    await page.getByRole('button', { name: 'Tentar novamente' }).first().click();
    await expect(page.getByText(/Não foi possível atualizar/)).toHaveCount(0, { timeout: 15000 });
  });

  test('vitrine separa em andamento, próximas e encerradas', async ({ page, request }) => {
    const proxima = await montarEdicao(request, true, 2, false);
    const andamento = await montarEdicao(request, true);
    const encerrada = await montarEdicao(request, true);
    const headers = await cabecalhosGestao(request);

    await transicionarEdicao(request, headers, andamento.idEdicao, 'iniciar');

    await transicionarEdicao(request, headers, encerrada.idEdicao, 'iniciar');
    // Placar com vencedor: com 0 x 0 as duas equipes empatariam em tudo e o backend
    // (corretamente) recusaria finalizar a edição por empate persistente no título.
    for (const partida of await partidasDaEdicao(request, headers, encerrada.idEdicao)) {
      const fim = await request.post(`${API}/competicoes/partidas/${partida.id_partida}/resultado-simples`, {
        headers: { ...headers, 'Idempotency-Key': `e2e-vitrine-${partida.id_partida}-${Date.now()}` },
        data: { gols_mandante: 2, gols_visitante: 1 },
      });
      expect(fim.ok()).toBeTruthy();
    }
    await transicionarEdicao(request, headers, encerrada.idEdicao, 'finalizar');

    await page.goto('/');
    const secaoAndamento = page.getByTestId('secao-EM_ANDAMENTO');
    const secaoProximas = page.getByTestId('secao-RASCUNHO');
    const secaoEncerradas = page.getByTestId('secao-FINALIZADA');

    await expect(secaoAndamento.getByRole('heading', { name: /Em andamento/ })).toBeVisible();
    await expect(secaoProximas.getByRole('heading', { name: /Próximas/ })).toBeVisible();
    await expect(secaoEncerradas.getByRole('heading', { name: /Encerradas/ })).toBeVisible();

    const cartaoAndamento = secaoAndamento.getByRole('link', { name: andamento.nomeCompeticao });
    await expect(cartaoAndamento).toBeVisible();
    await expect(secaoProximas.getByRole('link', { name: proxima.nomeCompeticao })).toBeVisible();
    await expect(secaoEncerradas.getByRole('link', { name: encerrada.nomeCompeticao })).toBeVisible();

    // Cada edição aparece só na sua seção
    await expect(secaoProximas.getByRole('link', { name: andamento.nomeCompeticao })).toHaveCount(0);
    await expect(secaoEncerradas.getByRole('link', { name: andamento.nomeCompeticao })).toHaveCount(0);
    await expect(secaoAndamento.getByRole('link', { name: proxima.nomeCompeticao })).toHaveCount(0);
    await expect(secaoAndamento.getByRole('link', { name: encerrada.nomeCompeticao })).toHaveCount(0);

    // Linha viva só no cartão em andamento, sem valor técnico
    await expect(cartaoAndamento.getByText(/Rodada \d+ de \d+/)).toBeVisible();
    await expect(
      secaoProximas.getByRole('link', { name: proxima.nomeCompeticao }).getByText(/Rodada \d+ de \d+/),
    ).toHaveCount(0);
    await expect(page.getByText(/EM_ANDAMENTO|RASCUNHO|FINALIZADA/)).toHaveCount(0);
  });

  test('jogo em andamento aparece no topo com Ao vivo', async ({ page, request }) => {
    const cenario = await montarEdicao(request, true, 3);
    const headers = await cabecalhosGestao(request);
    await transicionarEdicao(request, headers, cenario.idEdicao, 'iniciar');

    const partidas = await partidasDaEdicao(request, headers, cenario.idEdicao);
    expect(partidas.length).toBeGreaterThan(1);
    // O último jogo da tabela é o que está em andamento: precisa subir para o topo
    const aoVivo = partidas[partidas.length - 1];
    const inicio = await request.post(`${API}/competicoes/partidas/${aoVivo.id_partida}/iniciar`, { headers });
    expect(inicio.ok()).toBeTruthy();

    await page.goto(`/publico/edicao/${cenario.idEdicao}`);
    const cartoes = page.locator('[data-testid^="partida-publica-"]');
    await expect(cartoes).toHaveCount(partidas.length);
    await expect(cartoes.first()).toHaveAttribute('data-testid', `partida-publica-${aoVivo.id_partida}`);
    await expect(cartoes.first().getByText('Ao vivo')).toBeVisible();
    await expect(cartoes.nth(1).getByText('Ao vivo')).toHaveCount(0);

    await expect(page.getByText(/Atualizado há \d+ s/)).toBeVisible();
  });
});
