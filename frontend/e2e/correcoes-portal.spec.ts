import { test, expect, APIRequestContext } from '@playwright/test';
import { API_E2E } from './helpers/ambiente';

const API = `${API_E2E}`;

async function cabecalhosGestao(request: APIRequestContext): Promise<Record<string, string>> {
  for (const form of [
    { username: 'coordenador', password: 'coord123' },
    { username: 'admin', password: 'admin123' },
  ]) {
    const res = await request.post(`${API}/token`, { form });
    if (res.ok()) {
      const { access_token } = (await res.json()) as { access_token: string };
      return { Authorization: `Bearer ${access_token}` };
    }
  }
  throw new Error('Falha ao autenticar perfil de gestão para montar os dados.');
}

interface PartidaAdmin {
  id_partida: number;
  rodada: number | null;
  fase: string | null;
  estado: string;
}

async function listarPartidas(
  request: APIRequestContext,
  headers: Record<string, string>,
  idEdicao: number,
): Promise<PartidaAdmin[]> {
  const res = await request.get(`${API}/competicoes/edicoes/${idEdicao}/partidas`, { headers });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as PartidaAdmin[];
}

async function finalizarPartida(
  request: APIRequestContext,
  headers: Record<string, string>,
  idPartida: number,
  chave: string,
) {
  const res = await request.post(`${API}/competicoes/partidas/${idPartida}/resultado-simples`, {
    headers: { ...headers, 'Idempotency-Key': chave },
    data: { gols_mandante: 2, gols_visitante: 1 },
  });
  expect(res.ok()).toBeTruthy();
}

async function criarEdicaoComEquipes(
  request: APIRequestContext,
  headers: Record<string, string>,
  opcoes: {
    prefixo: string;
    formato: 'PONTOS_CORRIDOS' | 'GRUPOS_MATA_MATA';
    configuracao: Record<string, unknown>;
    quantidadeEquipes: number;
    gerarTabela: boolean;
    publicar: boolean;
  },
) {
  const ts = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const modalidades = await (await request.get(`${API}/modalidades/`, { headers })).json();
  const nomeCompeticao = `${opcoes.prefixo} ${ts}`;

  const resComp = await request.post(`${API}/competicoes/competicoes`, {
    headers,
    data: {
      nome: nomeCompeticao,
      id_modalidade: modalidades[0].id_modalidade,
      edicao: {
        identificacao: '2026',
        data_inicio: '2026-06-01',
        data_fim: '2026-07-31',
        formato: opcoes.formato,
        configuracao: opcoes.configuracao,
      },
    },
  });
  expect(resComp.ok()).toBeTruthy();
  const competicao = await resComp.json();
  const idEdicao = competicao.edicoes[0].id_edicao_competicao as number;

  const nomesBase = ['Águias', 'Corujas', 'Falcões', 'Tigres'];
  for (const base of nomesBase.slice(0, opcoes.quantidadeEquipes)) {
    const nomeEquipe = `${base} ${ts}`;
    const resEquipe = await request.post(`${API}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers,
      data: { nome: nomeEquipe },
    });
    expect(resEquipe.ok()).toBeTruthy();
    const equipe = await resEquipe.json();

    const resCompetidor = await request.post(`${API}/competicoes/competidores`, {
      headers,
      data: { nome: `Atleta ${nomeEquipe}`, documento: `DOC-${base}-${ts}` },
    });
    expect(resCompetidor.ok()).toBeTruthy();
    const competidor = await resCompetidor.json();

    const resIntegrante = await request.post(`${API}/competicoes/equipes/${equipe.id_equipe}/integrantes`, {
      headers,
      data: { id_competidor: competidor.id_competidor, nome_esportivo: `Camisa 10 ${base}`, numero_camisa: 10 },
    });
    expect(resIntegrante.ok()).toBeTruthy();
  }

  if (opcoes.gerarTabela) {
    const gerar = await request.post(`${API}/competicoes/edicoes/${idEdicao}/gerar-tabela`, { headers, data: {} });
    expect(gerar.ok()).toBeTruthy();
  }

  if (opcoes.publicar) {
    const pub = await request.post(`${API}/competicoes/edicoes/${idEdicao}/publicar`, {
      headers,
      data: { publicada: true },
    });
    expect(pub.ok()).toBeTruthy();
  }

  return { nomeCompeticao, slug: competicao.slug as string, idEdicao, ts };
}

test.describe('Correções do portal público (RT16)', () => {
  test('jogos ordenados grupos → semifinal → 3º lugar → final e card mostra Mata-mata concluído (DF-RT16-02, DF-RT16-03)', async ({
    page,
    request,
  }) => {
    const headers = await cabecalhosGestao(request);
    const cenario = await criarEdicaoComEquipes(request, headers, {
      prefixo: 'Copa Ordem',
      formato: 'GRUPOS_MATA_MATA',
      configuracao: {
        formato: 'GRUPOS_MATA_MATA',
        quantidade_grupos: 2,
        classificados_por_grupo: 2,
        turno_e_returno_grupos: false,
        ida_volta_eliminatoria: false,
        final_unica: true,
        terceiro_lugar: true,
        desempates: ['VITORIAS', 'SALDO_GOLS', 'GOLS_PRO'],
      },
      quantidadeEquipes: 4,
      gerarTabela: true,
      publicar: true,
    });

    // Finaliza fase de grupos (2 jogos) e encerra grupos para gerar semifinais
    const partidasGrupos = await listarPartidas(request, headers, cenario.idEdicao);
    for (const p of partidasGrupos) {
      await finalizarPartida(request, headers, p.id_partida, `e2e-rt16-grp-${p.id_partida}-${cenario.ts}`);
    }
    const encerrar = await request.post(`${API}/competicoes/edicoes/${cenario.idEdicao}/encerrar-grupos`, {
      headers,
      data: {},
    });
    expect(encerrar.ok()).toBeTruthy();

    // Finaliza semifinais (partidas ainda não finalizadas após encerrar-grupos) para gerar 3º lugar e final
    const partidasAposGrupos = await listarPartidas(request, headers, cenario.idEdicao);
    const semifinais = partidasAposGrupos.filter((x) => x.estado !== 'FINALIZADA');
    expect(semifinais).toHaveLength(2);
    for (const p of semifinais) {
      await finalizarPartida(request, headers, p.id_partida, `e2e-rt16-semi-${p.id_partida}-${cenario.ts}`);
    }

    // Finaliza 3º lugar e final, mantendo a edição EM_ANDAMENTO
    const partidasAposSemi = await listarPartidas(request, headers, cenario.idEdicao);
    const finais = partidasAposSemi.filter((x) => x.estado !== 'FINALIZADA');
    expect(finais).toHaveLength(2);
    for (const p of finais) {
      await finalizarPartida(request, headers, p.id_partida, `e2e-rt16-fin-${p.id_partida}-${cenario.ts}`);
    }

    // DF-RT16-02: ordem das seções na aba Jogos
    await page.goto(`/publico/edicao/${cenario.idEdicao}`);
    const titulosSecoes = page.locator('section[aria-label] > h3');
    await expect(titulosSecoes).toHaveText(['Rodada 1', 'Semifinal', 'Disputa de 3º lugar', 'Final']);

    // DF-RT16-03: card da home mostra "Mata-mata concluído" (e não "Rodada 1 de 1")
    await page.goto('/');
    await page.getByLabel('Buscar por nome').fill(cenario.nomeCompeticao);
    const cartao = page.getByTestId('secao-EM_ANDAMENTO').getByRole('link', { name: cenario.nomeCompeticao });
    await expect(cartao.getByText('Mata-mata concluído')).toBeVisible();
    await expect(cartao.getByText(/Rodada 1 de 1/)).toHaveCount(0);
  });

  test('card da home mostra contagem real de jogos em pontos corridos (DF-RT16-03)', async ({ page, request }) => {
    const headers = await cabecalhosGestao(request);
    const cenario = await criarEdicaoComEquipes(request, headers, {
      prefixo: 'Copa Pontos',
      formato: 'PONTOS_CORRIDOS',
      configuracao: { formato: 'PONTOS_CORRIDOS', desempates: ['SALDO_GOLS'] },
      quantidadeEquipes: 4,
      gerarTabela: true,
      publicar: true,
    });

    // 4 equipes em pontos corridos = 6 jogos em 3 rodadas; finaliza 1 jogo de cada rodada (3 de 6)
    const partidas = await listarPartidas(request, headers, cenario.idEdicao);
    expect(partidas).toHaveLength(6);
    const porRodada = new Map<number, PartidaAdmin>();
    for (const p of partidas) {
      if (p.rodada !== null && !porRodada.has(p.rodada)) {
        porRodada.set(p.rodada, p);
      }
    }
    expect(porRodada.size).toBe(3);
    for (const p of porRodada.values()) {
      await finalizarPartida(request, headers, p.id_partida, `e2e-rt16-pc-${p.id_partida}-${cenario.ts}`);
    }

    await page.goto('/');
    await page.getByLabel('Buscar por nome').fill(cenario.nomeCompeticao);
    const cartao = page.getByTestId('secao-EM_ANDAMENTO').getByRole('link', { name: cenario.nomeCompeticao });
    await expect(cartao.getByText('3 de 6 jogos')).toBeVisible();
    await expect(cartao.getByText(/Rodada 1 de 3/)).toHaveCount(0);
  });

  test('público não vê "Rascunho" e vê "Em breve" na home, competição e edição (DF-RT16-04)', async ({
    page,
    request,
  }) => {
    const headers = await cabecalhosGestao(request);
    const cenario = await criarEdicaoComEquipes(request, headers, {
      prefixo: 'Copa Futura',
      formato: 'PONTOS_CORRIDOS',
      configuracao: { formato: 'PONTOS_CORRIDOS', desempates: ['SALDO_GOLS'] },
      quantidadeEquipes: 2,
      gerarTabela: false,
      publicar: true,
    });

    // Home
    await page.goto('/');
    await page.getByLabel('Buscar por nome').fill(cenario.nomeCompeticao);
    const cartaoHome = page.getByTestId('secao-RASCUNHO').getByRole('link', { name: cenario.nomeCompeticao });
    await expect(cartaoHome.getByText('Em breve', { exact: true })).toBeVisible();
    await expect(page.getByText('Rascunho')).toHaveCount(0);

    // Página da competição
    await cartaoHome.click();
    await expect(page).toHaveURL(new RegExp(`/publico/competicao/${cenario.slug}$`));
    await expect(page.getByText('Em breve', { exact: true })).toBeVisible();
    await expect(page.getByText('Rascunho')).toHaveCount(0);

    // Página da edição
    await page.getByRole('link', { name: /2026/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/publico/edicao/${cenario.idEdicao}$`));
    await expect(page.getByText('Em breve', { exact: true })).toBeVisible();
    await expect(page.getByText('Rascunho')).toHaveCount(0);
  });

  test('Não encontrado e Recurso descontinuado têm cabeçalho do portal e link funcional para Competições (DF-RT16-05)', async ({
    page,
  }) => {
    // ID inválido na rota de edição
    await page.goto('/publico/edicao/abc');
    await expect(page.locator('header').getByRole('link', { name: /Portal Esportivo/ })).toBeVisible();
    await expect(page.getByText('Não encontrado')).toBeVisible();
    await page.getByRole('link', { name: 'Competições', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);

    // Competição inexistente (404 da API via EstadoCarga)
    await page.goto('/publico/competicao/nao-existe-rt16-e2e');
    await expect(page.locator('header').getByRole('link', { name: /Portal Esportivo/ })).toBeVisible();
    await expect(page.getByText('Não encontrado')).toBeVisible();
    await page.getByRole('link', { name: 'Competições', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);

    // Rota legada descontinuada
    await page.goto('/eventos-publico/999');
    await expect(page.locator('header').getByRole('link', { name: /Portal Esportivo/ })).toBeVisible();
    await expect(page.getByText('Recurso descontinuado')).toBeVisible();
    await page.getByRole('link', { name: 'Competições', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Chaveamento público mostra placar, pênaltis e descrições legíveis sem enum (DF-RT16-01, DF-RT16-06)', async ({
    page,
    request,
  }) => {
    const headers = await cabecalhosGestao(request);
    const cenario = await criarEdicaoComEquipes(request, headers, {
      prefixo: 'Copa Chave Pública',
      formato: 'GRUPOS_MATA_MATA',
      configuracao: {
        formato: 'GRUPOS_MATA_MATA',
        quantidade_grupos: 2,
        classificados_por_grupo: 2,
        turno_e_returno_grupos: false,
        ida_volta_eliminatoria: false,
        final_unica: true,
        terceiro_lugar: true,
        desempates: ['VITORIAS', 'SALDO_GOLS', 'GOLS_PRO'],
      },
      quantidadeEquipes: 4,
      gerarTabela: true,
      publicar: true,
    });

    // Finaliza grupos e encerra grupos para gerar semifinais
    const partidasGrupos = await listarPartidas(request, headers, cenario.idEdicao);
    for (const p of partidasGrupos) {
      await finalizarPartida(request, headers, p.id_partida, `e2e-rt16-chv-grp-${p.id_partida}-${cenario.ts}`);
    }
    const encerrar = await request.post(`${API}/competicoes/edicoes/${cenario.idEdicao}/encerrar-grupos`, {
      headers,
      data: {},
    });
    expect(encerrar.ok()).toBeTruthy();

    // Finaliza a 1ª semifinal com empate 1x1 e vitória nos pênaltis (4x3)
    const partidasAposGrupos = await listarPartidas(request, headers, cenario.idEdicao);
    const semifinais = partidasAposGrupos.filter((x) => x.estado !== 'FINALIZADA');
    expect(semifinais).toHaveLength(2);
    const semi1 = semifinais[0];

    const resSimples = await request.post(
      `${API}/competicoes/partidas/${semi1.id_partida}/resultado-simples`,
      {
        headers: { ...headers, 'Idempotency-Key': `e2e-rt16-chv-semi1-${semi1.id_partida}-${cenario.ts}` },
        data: {
          gols_mandante: 1,
          gols_visitante: 1,
          penaltis_mandante: 4,
          penaltis_visitante: 3,
        },
      },
    );
    expect(resSimples.ok()).toBeTruthy();

    await page.goto(`/publico/edicao/${cenario.idEdicao}`);
    await page.getByRole('tab', { name: /chaveamento/i }).click();

    // DF-RT16-01: Semifinal 1 mostra placar 1x1 e pênaltis (4) e (3)
    const dueloSemi1 = page.getByRole('article', { name: 'Semifinal 1' });
    await expect(dueloSemi1).toBeVisible();
    await expect(dueloSemi1.getByText('(4)')).toBeVisible();
    await expect(dueloSemi1.getByText('(3)')).toBeVisible();

    // DF-RT16-06: Sem enum cru (ex.: VENCEDOR_DUELO / SEMIFINAL / TERCEIRO_LUGAR) na tela
    const textoChave = await page.locator('main').innerText();
    expect(textoChave).not.toMatch(/VENCEDOR_DUELO|PERDEDOR_DUELO|TERCEIRO_LUGAR|POSICAO_GRUPO/);
    await expect(page.getByRole('article', { name: 'Final', exact: true })).toContainText(/Vencedor da Semifinal 2/i);
  });
});
