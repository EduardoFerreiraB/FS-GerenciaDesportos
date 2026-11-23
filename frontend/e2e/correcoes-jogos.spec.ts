import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

// T11 (L7): jogos e súmula no painel.
// DF-RT12-01/02/03/05/06/07/08/09/10/12/14, DF-RT14-07/08, DF-RT13-07.

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

/** Grupos + mata-mata: 2 grupos de 2, 2 classificados, 3º lugar; equipes com sigla. */
async function criarEdicao(request: APIRequestContext, h: Cab) {
  const ts = Date.now();
  const r = await request.post(`${API_E2E}/competicoes/competicoes`, {
    headers: h,
    data: {
      nome: `Copa Jogos RT ${ts}`,
      id_modalidade: await modalidade(request, h),
      edicao: {
        identificacao: '2026',
        data_inicio: '2026-06-01',
        data_fim: '2026-07-31',
        formato: 'GRUPOS_MATA_MATA',
        configuracao: {
          formato: 'GRUPOS_MATA_MATA',
          quantidade_grupos: 2,
          classificados_por_grupo: 2,
          pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
          desempates: ['SALDO_GOLS', 'VITORIAS'],
          turno_e_returno_grupos: false,
          ida_volta_eliminatoria: false,
          final_unica: true,
          terceiro_lugar: true,
        },
      },
    },
  });
  expect(r.ok()).toBeTruthy();
  const comp = await r.json();
  const idEdicao = comp.edicoes[0].id_edicao_competicao as number;
  const atletas: Record<string, number> = {};
  for (const [nome, sigla] of [['Leões', 'LEO'], ['Tigres', 'TIG'], ['Águias', 'AGU'], ['Falcões', 'FAL']]) {
    const eq = await (await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: h, data: { nome, sigla },
    })).json();
    const competidor = await (await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: h, data: { nome: `Atleta ${nome} ${ts}` },
    })).json();
    const integrante = await (await request.post(`${API_E2E}/competicoes/equipes/${eq.id_equipe}/integrantes`, {
      headers: h, data: { id_competidor: competidor.id_competidor, nome_esportivo: `Atleta ${nome}` },
    })).json();
    atletas[nome] = integrante.id_integrante;
  }
  return { idCompeticao: comp.id_competicao as number, idEdicao, atletas };
}

async function partidas(request: APIRequestContext, h: Cab, idEdicao: number) {
  return (await request.get(`${API_E2E}/competicoes/edicoes/${idEdicao}/partidas`, { headers: h })).json();
}

async function placar(request: APIRequestContext, h: Cab, idPartida: number, gm: number, gv: number) {
  const r = await request.post(`${API_E2E}/competicoes/partidas/${idPartida}/resultado-simples`, {
    headers: { ...h, 'Idempotency-Key': `${idPartida}-${Date.now()}-${Math.random()}` },
    data: { gols_mandante: gm, gols_visitante: gv },
  });
  expect(r.ok()).toBeTruthy();
}

async function abrirJogos(page: Page, idCompeticao: number) {
  await page.goto(`/dashboard/competicoes/${idCompeticao}`);
  await page.getByTestId('tab-jogos').click();
}

test.describe('jogos e súmula', () => {
  let h: Cab;
  test.beforeEach(async ({ page, request }) => {
    h = await cabecalhos(request);
    await authenticateDirectly(page);
  });

  test('gerar a tabela atualiza estado e chaveamento sem recarregar; números e siglas', async ({ page, request }) => {
    const { idCompeticao } = await criarEdicao(request, h);
    await abrirJogos(page, idCompeticao);
    await expect(page.getByTestId('badge-estado-edicao')).toHaveText('Rascunho');

    await page.getByRole('button', { name: 'Gerar Calendário / Tabela' }).first().click();
    await expect(page.getByText(/gerados com sucesso/i)).toBeVisible();

    // DF-RT12-01: cabeçalho e seletor mudam sem recarregar.
    await expect(page.getByTestId('badge-estado-edicao')).toHaveText('Em andamento');
    await expect(page.getByTestId('seletor-edicao').locator('option:checked')).toHaveText(/Em andamento/);
    // DF-RT12-03: vagas com a letra do grupo; DF-RT12-05: "Jogo N" sequencial, sem "#".
    await expect(page.getByText('1º do Grupo A').first()).toBeVisible();
    await expect(page.getByText('Jogo 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Jogo 2', { exact: true })).toBeVisible();
    await expect(page.getByText(/Jogo #/)).toHaveCount(0);
    // DF-RT12-06: escudo com a sigla cadastrada.
    await expect(page.locator('[data-testid^="cartao-partida-"]').first().getByText(/^(LEO|TIG|AGU|FAL)$/).first()).toBeVisible();
  });

  test('pênaltis só no mata-mata, erro antigo some e chaveamento recarrega após encerrar', async ({ page, request }) => {
    const { idCompeticao, idEdicao } = await criarEdicao(request, h);
    expect((await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/gerar-tabela`, { headers: h, data: {} })).ok()).toBeTruthy();
    await abrirJogos(page, idCompeticao);

    // DF-RT12-09: jogo de grupo não oferece pênaltis.
    await page.getByRole('button', { name: /lançar placar/i }).first().click();
    const modal = page.getByRole('dialog', { name: /lançar placar simples/i });
    await expect(modal.getByText(/decisão por pênaltis/i)).toHaveCount(0);
    await modal.getByRole('button', { name: /cancelar/i }).click();

    // DF-RT12-08: erro de agendamento (fora do período) some ao corrigir o campo.
    await page.getByRole('button', { name: /^agendar$/i }).first().click();
    await page.locator('#agendamento-data').fill('2027-01-10');
    await page.getByRole('button', { name: /salvar agendamento/i }).click();
    const dialogoAgenda = page.getByRole('dialog', { name: /agendar partida/i });
    await expect(dialogoAgenda.getByText(/a data precisa estar entre 01\/06\/2026 e 31\/07\/2026/i)).toBeVisible();
    await page.locator('#agendamento-data').fill('2026-06-10');
    await expect(dialogoAgenda.getByText(/a data precisa estar entre/i)).toHaveCount(0);
    await page.getByRole('button', { name: /salvar agendamento/i }).click();
    await expect(page.getByText(/agendamento do jogo \d+ salvo/i)).toBeVisible();

    // Termina os grupos pela API e encerra pela tela.
    for (const p of await partidas(request, h, idEdicao)) await placar(request, h, p.id_partida, 2, 1);
    await page.getByRole('button', { name: 'Recarregar partidas' }).click();
    await page.getByRole('button', { name: 'Encerrar Fase de Grupos' }).click();
    await page.getByRole('button', { name: 'Confirmar Encerramento' }).click();
    await expect(page.getByText(/fase de grupos encerrada/i)).toBeVisible();

    // DF-RT12-10: o botão some; DF-RT12-02: chaveamento mostra as equipes sem recarregar.
    await expect(page.getByRole('button', { name: 'Encerrar Fase de Grupos' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Semifinal' }).getByText('Leões').or(
      page.getByRole('region', { name: 'Semifinal' }).getByText('Tigres')).first()).toBeVisible();

    // DF-RT12-12: filtro de rodada oferece as fases.
    const filtro = page.locator('#filtro-rodada');
    await expect(filtro.locator('option', { hasText: 'Semifinal' })).toHaveCount(1);
    await filtro.selectOption({ label: 'Semifinal' });
    await expect(page.locator('[data-testid^="cartao-partida-"]')).toHaveCount(2);

    // Jogo eliminatório oferece pênaltis.
    await page.getByRole('button', { name: /lançar placar/i }).first().click();
    await expect(page.getByRole('dialog', { name: /lançar placar simples/i }).getByText(/decisão por pênaltis/i)).toBeVisible();
  });

  test('remover ocorrência pede confirmação e, em jogo reaberto, motivo; gol do placar simples sem 0\'', async ({ page, request }) => {
    const { idCompeticao, idEdicao, atletas } = await criarEdicao(request, h);
    expect((await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/gerar-tabela`, { headers: h, data: {} })).ok()).toBeTruthy();
    const [jogo] = await partidas(request, h, idEdicao);
    // Amarelo pela súmula, depois finaliza e reabre: remover passa a exigir motivo.
    expect((await request.post(`${API_E2E}/competicoes/partidas/${jogo.id_partida}/iniciar`, { headers: h })).ok()).toBeTruthy();
    const nomeMandante = jogo.nome_mandante as string;
    const oc = await request.post(`${API_E2E}/competicoes/partidas/${jogo.id_partida}/ocorrencias`, {
      headers: h, data: { tipo: 'CARTAO_AMARELO', id_equipe: jogo.id_equipe_mandante, id_integrante: atletas[nomeMandante], minuto: 12 },
    });
    expect(oc.ok()).toBeTruthy();
    expect((await request.post(`${API_E2E}/competicoes/partidas/${jogo.id_partida}/finalizar`, { headers: h, data: {} })).ok()).toBeTruthy();
    expect((await request.post(`${API_E2E}/competicoes/partidas/${jogo.id_partida}/reabrir`, {
      headers: h, data: { motivo: 'Correção da súmula' },
    })).ok()).toBeTruthy();

    await abrirJogos(page, idCompeticao);
    await page.getByTestId(`btn-sumula-${jogo.id_partida}`).click();
    await expect(page.getByRole('heading', { name: /súmula detalhada do jogo \d+/i })).toBeVisible();

    await page.locator('[data-testid^="btn-remover-ocorrencia-"]').first().click();
    const confirmar = page.getByRole('dialog', { name: 'Remover ocorrência?' });
    await expect(confirmar).toBeVisible();
    await confirmar.getByRole('button', { name: 'Remover' }).click();
    await expect(confirmar.getByText(/informe o motivo da remoção/i)).toBeVisible();
    await confirmar.getByLabel('Motivo da remoção').fill('Cartão lançado no atleta errado');
    await confirmar.getByRole('button', { name: 'Remover' }).click();
    await expect(confirmar).toHaveCount(0);
    await expect(page.getByText('Ocorrência removida com sucesso!')).toBeVisible();

    // DF-RT14-08: gol do placar simples não mostra "0'".
    const [, outro] = await partidas(request, h, idEdicao);
    await placar(request, h, outro.id_partida, 1, 0);
    await page.getByTestId('btn-fechar-sumula').click();
    await page.getByRole('button', { name: 'Recarregar partidas' }).click();
    await page.getByTestId(`btn-sumula-${outro.id_partida}`).click();
    await expect(page.getByRole('heading', { name: /súmula detalhada/i })).toBeVisible();
    await expect(page.getByText("0'")).toHaveCount(0);
  });

  test('edição cancelada esconde Agendar, Lançar placar e Reabrir', async ({ page, request }) => {
    const { idCompeticao, idEdicao } = await criarEdicao(request, h);
    expect((await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/gerar-tabela`, { headers: h, data: {} })).ok()).toBeTruthy();
    const [jogo] = await partidas(request, h, idEdicao);
    await placar(request, h, jogo.id_partida, 1, 0);
    expect((await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/cancelar`, {
      headers: h, data: { motivo: 'Chuva forte' },
    })).ok()).toBeTruthy();

    await abrirJogos(page, idCompeticao);
    await expect(page.locator('[data-testid^="cartao-partida-"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^agendar$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /lançar placar/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /reabrir jogo/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /súmula/i }).first()).toBeVisible();
  });
});
