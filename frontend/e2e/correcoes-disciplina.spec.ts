import { test, expect } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

test.describe('Correções de Disciplina (RT14 - parte independente)', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const authRes = await request.post(`${API_E2E}/token`, {
      form: { username: 'coordenador', password: 'coord123' },
    });
    expect(authRes.ok()).toBeTruthy();
    const data = await authRes.json();
    token = data.access_token;
  });

  test('DF-RT14-01 (sem Jogo undefined), DF-RT14-03 (toasts de sucesso) e DF-RT14-04 (artilharia compartilhada)', async ({
    page,
    request,
  }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const headers = { Authorization: `Bearer ${token}` };
    const ts = Date.now();

    // Obtém modalidade
    const modRes = await request.get(`${API_E2E}/modalidades/`, { headers });
    const mods = await modRes.json();
    const idModalidade = Array.isArray(mods) && mods.length > 0 ? mods[0].id_modalidade : 1;

    // Cria competição pontos corridos (turno e returno = 2 jogos entre 2 equipes)
    const compRes = await request.post(`${API_E2E}/competicoes/competicoes`, {
      headers,
      data: {
        nome: `Copa Disciplina RT14 ${ts}`,
        id_modalidade: idModalidade,
        edicao: {
          identificacao: '2026',
          data_inicio: '2026-05-01',
          data_fim: '2026-06-30',
          formato: 'PONTOS_CORRIDOS',
          configuracao: {
            formato: 'PONTOS_CORRIDOS',
            turno_e_returno: true,
            pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
            desempates: ['SALDO_GOLS', 'VITORIAS'],
            disciplina: {
              limite_amarelos: 2,
              jogos_por_acumulo: 1,
              jogos_por_vermelho: 1,
              jogos_por_segundo_amarelo: 1,
              zerar_amarelos_ao_encerrar_grupos: false,
            },
          },
        },
      },
    });
    expect(compRes.ok()).toBeTruthy();
    const comp = await compRes.json();
    const idCompeticao = comp.id_competicao as number;
    const idEdicao = comp.edicoes[0].id_edicao_competicao as number;

    // Cria 2 equipes e 2 competidores (um em cada equipe)
    const eq1 = await (
      await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
        headers,
        data: { nome: 'Tigres RT14', sigla: 'TIG' },
      })
    ).json();
    const eq2 = await (
      await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
        headers,
        data: { nome: 'Leões RT14', sigla: 'LEO' },
      })
    ).json();

    const c1 = await (
      await request.post(`${API_E2E}/competicoes/competidores`, {
        headers,
        data: { nome: `Alfa RT14 ${ts}` },
      })
    ).json();
    const c2 = await (
      await request.post(`${API_E2E}/competicoes/competidores`, {
        headers,
        data: { nome: `Beta RT14 ${ts}` },
      })
    ).json();

    const int1 = await (
      await request.post(`${API_E2E}/competicoes/equipes/${eq1.id_equipe}/integrantes`, {
        headers,
        data: { id_competidor: c1.id_competidor, nome_esportivo: 'Alfa RT14', numero_camisa: 9 },
      })
    ).json();
    const int2 = await (
      await request.post(`${API_E2E}/competicoes/equipes/${eq2.id_equipe}/integrantes`, {
        headers,
        data: { id_competidor: c2.id_competidor, nome_esportivo: 'Beta RT14', numero_camisa: 10 },
      })
    ).json();

    // Gera tabela
    const genRes = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/gerar-tabela`, {
      headers,
    });
    expect(genRes.ok()).toBeTruthy();

    // Lista partidas
    const partidas = await (
      await request.get(`${API_E2E}/competicoes/edicoes/${idEdicao}/partidas`, { headers })
    ).json();
    expect(partidas.length).toBeGreaterThanOrEqual(2);
    const p1 = partidas[0];
    const p2 = partidas[1];

    // Partida 1: 1 gol Alfa, 1 gol Beta (empate na artilharia), 1 vermelho direto para Alfa
    await request.post(`${API_E2E}/competicoes/partidas/${p1.id_partida}/ocorrencias`, {
      headers,
      data: {
        tipo: 'GOL',
        id_equipe: eq1.id_equipe,
        id_integrante: int1.id_integrante,
        minuto: 10,
      },
    });
    await request.post(`${API_E2E}/competicoes/partidas/${p1.id_partida}/ocorrencias`, {
      headers,
      data: {
        tipo: 'GOL',
        id_equipe: eq2.id_equipe,
        id_integrante: int2.id_integrante,
        minuto: 20,
      },
    });
    const vermRes = await request.post(`${API_E2E}/competicoes/partidas/${p1.id_partida}/ocorrencias`, {
      headers,
      data: {
        tipo: 'CARTAO_VERMELHO_DIRETO',
        id_equipe: eq1.id_equipe,
        id_integrante: int1.id_integrante,
        minuto: 30,
      },
    });
    expect(vermRes.ok()).toBeTruthy();
    const fin1 = await request.post(`${API_E2E}/competicoes/partidas/${p1.id_partida}/finalizar`, {
      headers,
      data: {},
    });
    expect(fin1.ok()).toBeTruthy();

    // Partida 2: finalizada 0x0 (sem ocorrência de Alfa -> elegível para cumprimento)
    const fin2 = await request.post(`${API_E2E}/competicoes/partidas/${p2.id_partida}/finalizar`, {
      headers,
      data: {},
    });
    expect(fin2.ok()).toBeTruthy();

    // Abre a página da competição e vai na aba Disciplina
    await page.goto(`/dashboard/competicoes/${idCompeticao}`);
    await page.getByRole('tab', { name: /disciplina/i }).click();
    await expect(page.getByTestId('painel-disciplina')).toBeVisible();

    // 1. Artilharia: empate com 1 gol -> ambos na posição 1 (DF-RT14-04)
    await page.getByTestId('subtab-artilharia').click();
    await expect(page.getByTestId(`posicao-artilheiro-${int1.id_integrante}`)).toHaveText('1');
    await expect(page.getByTestId(`posicao-artilheiro-${int2.id_integrante}`)).toHaveText('1');

    // 2. Suspensões: abrir Cumprir, verificar que lista apenas partida elegível com "Jogo N · ..." (DF-RT14-01, DF-RT14-02, DF-RT14-03)
    await page.getByTestId('subtab-suspensoes').click();
    const btnAcoes = page.locator('[data-testid^="btn-acoes-suspensao-"]').first();
    await btnAcoes.click();
    await page.locator('[data-testid^="btn-cumprir-"]').first().click();

    const selectPartida = page.getByTestId('select-partida-cumprimento');
    await expect(selectPartida).toBeVisible();
    await expect(selectPartida.locator('option')).toHaveCount(2); // placeholder + 1 partida elegível (p2)
    const opcoesTexto = await selectPartida.locator('option').allTextContents();
    for (const texto of opcoesTexto) {
      expect(texto).not.toContain('undefined');
    }
    expect(opcoesTexto.some((t) => /Jogo \d+ ·/.test(t))).toBeTruthy();

    await page.getByTestId('btn-confirmar-cumprimento').click();
    await expect(page.getByText('Cumprimento registrado com sucesso.')).toBeVisible();

    // 3. Criar suspensão manual + toast de sucesso (DF-RT14-03)
    await page.getByTestId('btn-nova-suspensao').click();
    await page.getByTestId('select-integrante').selectOption(String(int2.id_integrante));
    await page.getByTestId('input-motivo-suspensao').fill('Conduta antidesportiva teste');
    await page.getByTestId('btn-salvar-suspensao').click();
    await expect(page.getByText('Suspensão manual criada com sucesso.')).toBeVisible();

    // 4. PD-RT14-01: tentar marcar Cumprida sem cumprimentos mostra o erro da API no campo Situação
    await page.locator('[data-testid^="btn-acoes-suspensao-"]').last().click();
    await page.locator('[data-testid^="btn-ajustar-"]').last().click();
    await page.getByTestId('select-situacao-suspensao').selectOption('CUMPRIDA');
    await page.getByTestId('input-motivo-ajuste').fill('Tentativa sem cumprimento');
    await page.getByTestId('btn-salvar-ajuste').click();
    await expect(page.locator('#select-situacao-suspensao-erro')).toBeVisible();
    await expect(page.locator('#select-situacao-suspensao-erro')).toContainText(/cumprimentos/i);

    // 5. Ajustar suspensão para CANCELADA com sucesso + toast (DF-RT14-03)
    await page.getByTestId('select-situacao-suspensao').selectOption('CANCELADA');
    await page.getByTestId('input-motivo-ajuste').fill('Ajuste administrativo de teste');
    await page.getByTestId('btn-salvar-ajuste').click();
    await expect(page.getByText('Suspensão atualizada com sucesso.')).toBeVisible();

    // 6. DF-RT14-05: abrir Histórico e verificar responsável e justificativas
    await page.locator('[data-testid^="btn-acoes-suspensao-"]').last().click();
    await page.locator('[data-testid^="btn-historico-"]').last().click();
    const modalHistorico = page.getByTestId('modal-historico-suspensao');
    await expect(modalHistorico).toBeVisible();
    await expect(modalHistorico).toContainText(/Responsável/i);
    await expect(modalHistorico).toContainText('Ajuste administrativo de teste');
    await page.getByRole('button', { name: /fechar/i }).last().click();
  });
});
