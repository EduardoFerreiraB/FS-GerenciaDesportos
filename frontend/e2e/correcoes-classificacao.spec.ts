import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

// T12 (L7): classificação, configuração, visão geral, ciclo e edição de competição.
// DF-RT13-01/02/03/04/05/08/10, DF-RT12-13, DF-RT10-02, PD-RT12-02, PD-RT10-01, PD-RT09-01, DF-RT15-03.

type Cab = { Authorization: string };

async function cabecalhos(request: APIRequestContext): Promise<Cab> {
  const r = await request.post(`${API_E2E}/token`, { form: { username: 'admin', password: 'admin123' } });
  expect(r.ok()).toBeTruthy();
  return { Authorization: `Bearer ${(await r.json()).access_token}` };
}

async function modalidade(request: APIRequestContext, h: Cab): Promise<number> {
  const lista = await (await request.get(`${API_E2E}/modalidades/`, { headers: h })).json();
  if (Array.isArray(lista) && lista.length > 0) return lista[0].id_modalidade;
  const nova = await request.post(`${API_E2E}/modalidades/`, { headers: h, data: { nome: `Futebol ${Date.now()}` } });
  return (await nova.json()).id_modalidade;
}

const PONTOS_CORRIDOS = {
  formato: 'PONTOS_CORRIDOS',
  pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
  desempates: ['SALDO_GOLS', 'VITORIAS'],
  turno_e_returno: false,
};

const GRUPOS = {
  formato: 'GRUPOS_MATA_MATA',
  quantidade_grupos: 2,
  classificados_por_grupo: 2,
  pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
  desempates: ['SALDO_GOLS', 'VITORIAS'],
  turno_e_returno_grupos: false,
  ida_volta_eliminatoria: false,
  final_unica: true,
  terceiro_lugar: true,
};

/** Competição com `equipes` equipes (1 atleta cada); devolve ids. */
async function criarCompeticao(
  request: APIRequestContext,
  h: Cab,
  configuracao: Record<string, unknown>,
  nomesEquipes: string[],
  nome = `Copa Classif ${Date.now()}`,
) {
  const r = await request.post(`${API_E2E}/competicoes/competicoes`, {
    headers: h,
    data: {
      nome,
      id_modalidade: await modalidade(request, h),
      edicao: {
        identificacao: '2026',
        data_inicio: '2026-06-01',
        data_fim: '2026-07-31',
        formato: configuracao.formato,
        configuracao,
      },
    },
  });
  expect(r.ok()).toBeTruthy();
  const comp = await r.json();
  const idEdicao = comp.edicoes[0].id_edicao_competicao as number;
  const equipes: Record<string, { id: number; atleta: number }> = {};
  for (const nomeEquipe of nomesEquipes) {
    const eq = await (await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: h, data: { nome: nomeEquipe },
    })).json();
    const competidor = await (await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: h, data: { nome: `Atleta ${nomeEquipe} ${Date.now()}` },
    })).json();
    const integrante = await (await request.post(`${API_E2E}/competicoes/equipes/${eq.id_equipe}/integrantes`, {
      headers: h, data: { id_competidor: competidor.id_competidor, nome_esportivo: `Atleta ${nomeEquipe}` },
    })).json();
    equipes[nomeEquipe] = { id: eq.id_equipe, atleta: integrante.id_integrante };
  }
  return { idCompeticao: comp.id_competicao as number, nome: comp.nome as string, idEdicao, equipes };
}

async function gerar(request: APIRequestContext, h: Cab, idEdicao: number) {
  expect((await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/gerar-tabela`, { headers: h, data: {} })).ok()).toBeTruthy();
}

async function partidas(request: APIRequestContext, h: Cab, idEdicao: number) {
  return (await request.get(`${API_E2E}/competicoes/edicoes/${idEdicao}/partidas`, { headers: h })).json();
}

/** Lança o placar pela equipe: `gols[idEquipe]`. */
async function placar(request: APIRequestContext, h: Cab, p: { id_partida: number; id_equipe_mandante: number; id_equipe_visitante: number }, gols: Record<number, number>) {
  const r = await request.post(`${API_E2E}/competicoes/partidas/${p.id_partida}/resultado-simples`, {
    headers: { ...h, 'Idempotency-Key': `${p.id_partida}-${Date.now()}-${Math.random()}` },
    data: { gols_mandante: gols[p.id_equipe_mandante], gols_visitante: gols[p.id_equipe_visitante] },
  });
  expect(r.ok()).toBeTruthy();
}

/** Jogo com gols por autor identificado (via súmula). */
async function jogoComGols(request: APIRequestContext, h: Cab, idPartida: number, gols: Array<{ id_equipe: number; id_integrante: number }>) {
  expect((await request.post(`${API_E2E}/competicoes/partidas/${idPartida}/iniciar`, { headers: h })).ok()).toBeTruthy();
  for (const g of gols) {
    const r = await request.post(`${API_E2E}/competicoes/partidas/${idPartida}/ocorrencias`, {
      headers: h, data: { tipo: 'GOL', id_equipe: g.id_equipe, id_integrante: g.id_integrante, minuto: 10 },
    });
    expect(r.ok()).toBeTruthy();
  }
  expect((await request.post(`${API_E2E}/competicoes/partidas/${idPartida}/finalizar`, { headers: h, data: {} })).ok()).toBeTruthy();
}

async function abrir(page: Page, idCompeticao: number, aba?: string) {
  await page.goto(`/dashboard/competicoes/${idCompeticao}`);
  if (aba) await page.getByTestId(`tab-${aba}`).click();
}

test.describe('classificação, configuração e ciclo', () => {
  let h: Cab;
  test.beforeEach(async ({ page, request }) => {
    h = await cabecalhos(request);
    await authenticateDirectly(page);
  });

  test('configuração mostra e salva a ordem dos desempates e os jogos de suspensão', async ({ page, request }) => {
    const { idCompeticao } = await criarCompeticao(request, h, PONTOS_CORRIDOS, ['A', 'B']);
    await abrir(page, idCompeticao, 'configuracao');
    const lista = page.getByTestId('lista-desempates');
    await expect(lista.getByRole('listitem')).toHaveText([/1º\s*Saldo de gols/, /2º\s*Número de vitórias/]);
    await expect(page.getByLabel('Jogos de suspensão por acúmulo de amarelos')).toBeVisible();
    await expect(page.getByLabel('Jogos de suspensão por expulsão com o 2º amarelo')).toBeVisible();

    await page.getByRole('button', { name: 'Subir Número de vitórias' }).click();
    await page.getByLabel('Adicionar critério').selectOption({ label: 'Gols marcados' });
    await page.getByLabel('Jogos de suspensão por acúmulo de amarelos').fill('2');
    await page.getByRole('button', { name: 'Salvar Configuração' }).click();
    await expect(page.getByText('Configuração salva com sucesso!')).toBeVisible();

    await page.reload();
    await page.getByTestId('tab-configuracao').click();
    await expect(page.getByTestId('lista-desempates').getByRole('listitem')).toHaveText([
      /Número de vitórias/, /Saldo de gols/, /Gols marcados/,
    ]);
    await expect(page.getByLabel('Jogos de suspensão por acúmulo de amarelos')).toHaveValue('2');
  });

  test('pontos corridos: mensagem sem chaveamento e tabela sem zona; aba no endereço', async ({ page, request }) => {
    const { idCompeticao, idEdicao } = await criarCompeticao(request, h, PONTOS_CORRIDOS, ['A', 'B', 'C']);
    await abrir(page, idCompeticao, 'jogos');
    await expect(page).toHaveURL(/aba=jogos/);
    await page.getByRole('button', { name: 'Gerar Calendário / Tabela' }).first().click();
    await expect(page.getByText('Tabela de jogos gerada com sucesso!')).toBeVisible();
    await expect(page.getByText(/chaveamento/i)).toHaveCount(0);

    // DF-RT10-02: edição e aba sobrevivem ao recarregar.
    await page.goto(`/dashboard/competicoes/${idCompeticao}?edicao=${idEdicao}&aba=classificacao`);
    await expect(page.getByTestId('tab-classificacao')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Zona de classificação')).toHaveCount(0);
  });

  test('decisão mostra responsável e as linhas decididas têm marca', async ({ page, request }) => {
    const { idCompeticao, idEdicao, equipes } = await criarCompeticao(request, h, PONTOS_CORRIDOS, ['Leões', 'Tigres', 'Águias']);
    await gerar(request, h, idEdicao);
    const [l, t, a] = [equipes['Leões'].id, equipes['Tigres'].id, equipes['Águias'].id];
    for (const p of await partidas(request, h, idEdicao)) {
      const par = new Set([p.id_equipe_mandante, p.id_equipe_visitante]);
      const vencedor = par.has(l) && par.has(t) ? l : par.has(t) && par.has(a) ? t : a;
      await placar(request, h, p, { [p.id_equipe_mandante]: p.id_equipe_mandante === vencedor ? 1 : 0, [p.id_equipe_visitante]: p.id_equipe_visitante === vencedor ? 1 : 0 });
    }
    const r = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/decisoes-classificacao`, {
      headers: h, data: { conjunto_equipes: [l, t, a], ordem_escolhida: [t, l, a], motivo: 'Sorteio público' },
    });
    expect(r.ok()).toBeTruthy();

    await abrir(page, idCompeticao, 'classificacao');
    await expect(page.getByTestId('marca-decisao')).toHaveCount(3);
    await expect(page.getByTestId('responsavel-decisao')).toContainText('Registrada por admin');
    await expect(page.getByText(/Decisão #/)).toHaveCount(0);
  });

  test('finalizar pede confirmação, reabrir mostra sucesso e a visão geral mostra o campeão', async ({ page, request }) => {
    const { idCompeticao, idEdicao, equipes } = await criarCompeticao(request, h, PONTOS_CORRIDOS, ['Leões', 'Tigres']);
    await gerar(request, h, idEdicao);
    const [jogo] = await partidas(request, h, idEdicao);
    await placar(request, h, jogo, { [equipes['Leões'].id]: 2, [equipes['Tigres'].id]: 0 });

    await abrir(page, idCompeticao);
    await page.getByTestId('btn-finalizar-edicao').click();
    const confirmacao = page.getByRole('dialog', { name: 'Finalizar edição?' });
    await expect(confirmacao).toBeVisible();
    await expect(page.getByTestId('badge-estado-edicao')).toHaveText('Em andamento');
    await confirmacao.getByRole('button', { name: 'Finalizar edição' }).click();
    await expect(page.getByTestId('sucesso-ciclo-edicao')).toHaveText('Edição finalizada com sucesso.');
    await expect(page.getByTestId('badge-estado-edicao')).toHaveText('Finalizada');

    // PD-RT12-02: campeão e vice na visão geral.
    await page.getByTestId('tab-classificacao').click();
    await page.getByTestId('tab-visao-geral').click();
    await expect(page.getByTestId('visao-campeao')).toContainText('Leões');
    await expect(page.getByTestId('visao-campeao')).toContainText('Vice: Tigres');

    await page.getByTestId('btn-reabrir-edicao').click();
    await page.getByTestId('input-motivo-ciclo-edicao').fill('Correção de súmula');
    await page.getByTestId('btn-confirmar-ciclo-edicao').click();
    await expect(page.getByTestId('sucesso-ciclo-edicao')).toHaveText('Edição reaberta com sucesso.');
  });

  test('tabela de grupo mostra todas as colunas sem rolagem em 1440 px', async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { idCompeticao, idEdicao } = await criarCompeticao(request, h, GRUPOS, ['Leões RT', 'Tigres RT', 'Águias RT', 'Falcões RT']);
    await gerar(request, h, idEdicao);
    await abrir(page, idCompeticao, 'classificacao');
    const tabelas = page.locator('table');
    await expect(tabelas).toHaveCount(2);
    for (const tabela of await tabelas.all()) {
      const rolagem = await tabela.evaluate((el) => {
        const caixa = el.parentElement as HTMLElement;
        return caixa.scrollWidth - caixa.clientWidth;
      });
      expect(rolagem).toBeLessThanOrEqual(1);
    }
  });

  test('card Artilheiro mostra os empatados', async ({ page, request }) => {
    const { idCompeticao, idEdicao, equipes } = await criarCompeticao(request, h, PONTOS_CORRIDOS, ['Leões', 'Tigres']);
    await gerar(request, h, idEdicao);
    const [jogo] = await partidas(request, h, idEdicao);
    await jogoComGols(request, h, jogo.id_partida, [
      { id_equipe: equipes['Leões'].id, id_integrante: equipes['Leões'].atleta },
      { id_equipe: equipes['Tigres'].id, id_integrante: equipes['Tigres'].atleta },
    ]);
    await abrir(page, idCompeticao);
    await expect(page.getByTestId('visao-artilheiro')).toContainText('Atleta Leões e Atleta Tigres');
  });

  test('editar competição e edição; nome repetido aparece abaixo do campo', async ({ page, request }) => {
    const existente = await criarCompeticao(request, h, PONTOS_CORRIDOS, [], `Copa Existente ${Date.now()}`);
    const { idCompeticao } = await criarCompeticao(request, h, PONTOS_CORRIDOS, []);
    await abrir(page, idCompeticao);

    await page.getByTestId('menu-acoes-competicao').click();
    await page.getByTestId('btn-editar-competicao').click();
    const dialogo = page.getByRole('dialog', { name: 'Editar competição' });
    await dialogo.getByLabel('Nome').fill(existente.nome.toUpperCase());
    await dialogo.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(dialogo.getByText(/Já existe uma competição chamada/)).toBeVisible();
    const novoNome = `Copa Renomeada ${Date.now()}`;
    await dialogo.getByLabel('Nome').fill(novoNome);
    await dialogo.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('heading', { level: 1, name: novoNome })).toBeVisible();

    await page.getByTestId('menu-acoes-edicao').click();
    await page.getByTestId('btn-editar-edicao').click();
    const edicao = page.getByRole('dialog', { name: 'Editar edição' });
    await edicao.getByLabel('Data de término').fill('2026-05-01');
    await edicao.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(edicao.getByText('A data de término deve ser igual ou posterior à data de início.')).toBeVisible();
    await edicao.getByLabel('Data de término').fill('2026-07-31');
    await edicao.getByLabel('Identificação').fill('Temporada 2026');
    await edicao.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Temporada 2026' })).toBeVisible();
  });
});
