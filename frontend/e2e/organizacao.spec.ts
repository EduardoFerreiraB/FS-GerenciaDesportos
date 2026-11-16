import { test, expect, APIRequestContext } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

interface PartidaApi {
  id_partida: number;
  id_equipe_mandante: number | null;
  id_equipe_visitante: number | null;
  status: string;
  data_hora: string | null;
}

/** Edição em andamento (tabela gerada via API) com um jogo já finalizado. */
async function edicaoComUmJogoRealizado(request: APIRequestContext) {
  const token = (await (await request.post(`${API_E2E}/token`, {
    form: { username: 'coordenador', password: 'coord123' },
  })).json()).access_token as string;
  const headers = { Authorization: `Bearer ${token}` };
  const ts = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const modalidades = await (await request.get(`${API_E2E}/modalidades/`, { headers })).json();

  const resComp = await request.post(`${API_E2E}/competicoes/competicoes`, {
    headers,
    data: {
      nome: `Copa Visão Geral ${ts}`,
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

  for (const nomeEquipe of [`Leões ${ts}`, `Tigres ${ts}`, `Panteras ${ts}`]) {
    const resEquipe = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers,
      data: { nome: nomeEquipe },
    });
    expect(resEquipe.ok()).toBeTruthy();
    const equipe = await resEquipe.json();
    const resCompetidor = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers,
      data: { nome: `Atleta ${nomeEquipe}`, ativo: true },
    });
    expect(resCompetidor.ok()).toBeTruthy();
    const competidor = await resCompetidor.json();
    const inscricao = await request.post(`${API_E2E}/competicoes/equipes/${equipe.id_equipe}/integrantes`, {
      headers,
      data: { id_competidor: competidor.id_competidor, nome_esportivo: `Camisa 9 ${nomeEquipe}`, numero_camisa: 9 },
    });
    expect(inscricao.ok()).toBeTruthy();
  }

  const gerar = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/gerar-tabela`, { headers, data: {} });
  expect(gerar.ok()).toBeTruthy();

  const partidas = (await (
    await request.get(`${API_E2E}/competicoes/edicoes/${idEdicao}/partidas`, { headers })
  ).json()) as PartidaApi[];
  const jogo = partidas.find((p) => p.id_equipe_mandante && p.id_equipe_visitante);
  expect(jogo).toBeTruthy();

  const resultado = await request.post(`${API_E2E}/competicoes/partidas/${jogo!.id_partida}/resultado-simples`, {
    headers: { ...headers, 'Idempotency-Key': `e2e-visao-geral-${ts}` },
    data: { gols_mandante: 2, gols_visitante: 1 },
  });
  expect(resultado.ok()).toBeTruthy();

  // Mesmas regras da aba Visão geral: canceladas não contam; "sem data" = agendada sem data/hora.
  const depois = ((await (
    await request.get(`${API_E2E}/competicoes/edicoes/${idEdicao}/partidas`, { headers })
  ).json()) as PartidaApi[]).filter((p) => p.status !== 'CANCELADA');
  return {
    idCompeticao: competicao.id_competicao as number,
    total: depois.length,
    realizados: depois.filter((p) => p.status === 'FINALIZADA').length,
    semData: depois.filter((p) => p.status === 'AGENDADA' && !p.data_hora).length,
  };
}

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

    // A edição aparece como Rascunho (rótulo traduzido) e não publicada
    await expect(page.getByRole('heading', { name: new RegExp(nomeComp, 'i') })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/não publicada/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('badge-estado-edicao')).toHaveText('Rascunho', { timeout: 15000 });
    await expect(page.getByText('RASCUNHO', { exact: true })).toHaveCount(0);
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

  test('visão geral mostra jogos realizados e pendência de jogos sem data', async ({ page, request }) => {
    const cenario = await edicaoComUmJogoRealizado(request);
    expect(cenario.realizados).toBe(1);
    expect(cenario.semData).toBeGreaterThan(0);

    await page.goto(`/dashboard/competicoes/${cenario.idCompeticao}`);

    // Visão geral é a aba inicial
    await expect(page.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true', {
      timeout: 15000,
    });
    await expect(page.getByTestId('visao-jogos-realizados')).toContainText(
      `${cenario.realizados}/${cenario.total}`,
      { timeout: 15000 },
    );
    const textoSemData = `${cenario.semData} ${cenario.semData === 1 ? 'jogo' : 'jogos'} sem data`;
    await expect(page.getByTestId('pendencias-edicao')).toContainText(textoSemData);
    await expect(page.getByTestId('visao-equipes')).toContainText('3');

    // A pendência leva à aba Jogos
    await page.getByRole('button', { name: `Resolver: ${textoSemData}` }).click();
    await expect(page.getByRole('tab', { name: 'Jogos' })).toHaveAttribute('aria-selected', 'true');
  });

  test('falha de carregamento mostra erro com tentar novamente', async ({ page }) => {
    await page.route('**/competicoes/eventos*', (route) => route.abort());
    await page.goto('/dashboard/eventos');
    await expect(page.getByRole('button', { name: /tentar novamente/i })).toBeVisible();
  });
});
