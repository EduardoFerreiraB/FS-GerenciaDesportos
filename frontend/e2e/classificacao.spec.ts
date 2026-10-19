import { test, expect } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';

test.describe('Classificação e Chaveamento Eliminatório', () => {
  test.beforeEach(async ({ page }) => {
    // Autentica token para acessar o dashboard
    await page.addInitScript(() => {
      localStorage.setItem('token', 'fake-jwt-token-for-e2e');
    });

    // Mock de verificação de autenticação do AuthContext
    await page.route('**/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_usuario: 1,
          username: 'admin',
          role: 'ADMIN',
          must_change_password: false,
        }),
      });
    });

    // Mock padrão para decisões de desempate manual de classificação
    await page.route('**/competicoes/edicoes/*/decisoes-classificacao', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('visualiza aba Classificação em pontos corridos com cabeçalhos e dados computados', async ({
    page,
  }) => {
    const idComp = 101;
    const idEdicao = 201;

    // Mock da competição
    await page.route(`**/competicoes/competicoes/${idComp}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_competicao: idComp,
          nome: 'Campeonato Municipal de Futebol',
          descricao: 'Edição de Pontos Corridos',
          slug: 'campeonato-municipal-futebol',
          arquivado: false,
          criado_em: '2026-01-01T00:00:00Z',
          edicoes: [
            {
              id_edicao_competicao: idEdicao,
              id_competicao: idComp,
              identificacao: '2026',
              data_inicio: '2026-05-01',
              data_fim: '2026-07-31',
              categoria: 'Principal',
              formato: 'PONTOS_CORRIDOS',
              estado: 'EM_ANDAMENTO',
              publicada: true,
              revisao: 1,
              criado_em: '2026-01-01T00:00:00Z',
              configuracao: {
                formato: 'PONTOS_CORRIDOS',
                pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
                desempates: ['SALDO_GOLS', 'VITORIAS'],
                disciplina: {
                  jogos_por_acumulo: 1,
                  jogos_por_vermelho: 1,
                  jogos_por_segundo_amarelo: 1,
                  zerar_amarelos_ao_encerrar_grupos: false,
                },
              },
            },
          ],
        }),
      });
    });

    // Mock do detalhe da edição
    await page.route(`**/competicoes/edicoes/${idEdicao}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_edicao_competicao: idEdicao,
          id_competicao: idComp,
          identificacao: '2026',
          data_inicio: '2026-05-01',
          data_fim: '2026-07-31',
          categoria: 'Principal',
          formato: 'PONTOS_CORRIDOS',
          estado: 'EM_ANDAMENTO',
          publicada: true,
          revisao: 1,
          criado_em: '2026-01-01T00:00:00Z',
          configuracao: {
            formato: 'PONTOS_CORRIDOS',
            pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
            desempates: ['SALDO_GOLS', 'VITORIAS'],
            disciplina: {
              jogos_por_acumulo: 1,
              jogos_por_vermelho: 1,
              jogos_por_segundo_amarelo: 1,
              zerar_amarelos_ao_encerrar_grupos: false,
            },
          },
        }),
      });
    });

    // Mock da classificação com linhas gerais de pontos corridos
    await page.route(`**/competicoes/edicoes/${idEdicao}/classificacao`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          linhas: [
            {
              posicao: 1,
              id_equipe: 10,
              nome_equipe: 'Grêmio Esportivo',
              jogos: 3,
              vitorias: 3,
              empates: 0,
              derrotas: 0,
              gols_pro: 9,
              gols_contra: 1,
              saldo_gols: 8,
              pontos: 9,
            },
            {
              posicao: 2,
              id_equipe: 20,
              nome_equipe: 'Flamengo Paulistano',
              jogos: 3,
              vitorias: 2,
              empates: 0,
              derrotas: 1,
              gols_pro: 5,
              gols_contra: 3,
              saldo_gols: 2,
              pontos: 6,
            },
            {
              posicao: 3,
              id_equipe: 30,
              nome_equipe: 'Santos da Serra',
              jogos: 3,
              vitorias: 1,
              empates: 0,
              derrotas: 2,
              gols_pro: 2,
              gols_contra: 5,
              saldo_gols: -3,
              pontos: 3,
            },
            {
              posicao: 4,
              id_equipe: 40,
              nome_equipe: 'União Alvorada',
              jogos: 3,
              vitorias: 0,
              empates: 0,
              derrotas: 3,
              gols_pro: 1,
              gols_contra: 8,
              saldo_gols: -7,
              pontos: 0,
            },
          ],
          grupos: null,
          possui_empate_persistente: false,
        }),
      });
    });

    await page.goto(`/dashboard/competicoes/${idComp}`);

    // Aguarda painel da edição carregar
    await expect(page.getByText('Campeonato Municipal de Futebol')).toBeVisible();

    // Clica na aba Classificação
    const abaClassificacao = page.getByRole('button', { name: /classificação/i });
    await abaClassificacao.click();

    // Verifica cabeçalhos da tabela
    await expect(page.getByRole('columnheader', { name: 'Pos', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Equipe', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'PTS', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'J', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'V', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'E', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'D', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'GP', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'GC', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'SG', exact: true })).toBeVisible();

    // Verifica dados computados da primeira colocada
    const linhaGremio = page.getByRole('row', { name: /Grêmio Esportivo/i });
    await expect(linhaGremio).toBeVisible();
    await expect(linhaGremio).toContainText('1º');
    await expect(linhaGremio).toContainText('Grêmio Esportivo');
    await expect(linhaGremio).toContainText('9'); // Pontos
    await expect(linhaGremio).toContainText('+8'); // Saldo de Gols

    // Verifica segunda colocada
    const linhaFlamengo = page.getByRole('row', { name: /Flamengo Paulistano/i });
    await expect(linhaFlamengo).toBeVisible();
    await expect(linhaFlamengo).toContainText('2º');
    await expect(linhaFlamengo).toContainText('6');
    await expect(linhaFlamengo).toContainText('+2');
  });

  test('exibe banner de empate persistente quando houver empates não resolvidos', async ({
    page,
  }) => {
    const idComp = 102;
    const idEdicao = 202;

    await page.route(`**/competicoes/competicoes/${idComp}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_competicao: idComp,
          nome: 'Torneio Integração',
          edicoes: [
            {
              id_edicao_competicao: idEdicao,
              id_competicao: idComp,
              identificacao: '2026',
              data_inicio: '2026-05-01',
              data_fim: '2026-07-31',
              formato: 'PONTOS_CORRIDOS',
              estado: 'EM_ANDAMENTO',
              publicada: true,
              revisao: 1,
              configuracao: { formato: 'PONTOS_CORRIDOS' },
            },
          ],
        }),
      });
    });

    await page.route(`**/competicoes/edicoes/${idEdicao}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_edicao_competicao: idEdicao,
          id_competicao: idComp,
          identificacao: '2026',
          data_inicio: '2026-05-01',
          data_fim: '2026-07-31',
          formato: 'PONTOS_CORRIDOS',
          estado: 'EM_ANDAMENTO',
          publicada: true,
          revisao: 1,
          configuracao: { formato: 'PONTOS_CORRIDOS' },
        }),
      });
    });

    await page.route(`**/competicoes/edicoes/${idEdicao}/classificacao`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          linhas: [
            {
              posicao: 1,
              id_equipe: 1,
              nome_equipe: 'Time A',
              jogos: 1,
              vitorias: 0,
              empates: 1,
              derrotas: 0,
              gols_pro: 1,
              gols_contra: 1,
              saldo_gols: 0,
              pontos: 1,
              empate_persistente: true,
            },
            {
              posicao: 1,
              id_equipe: 2,
              nome_equipe: 'Time B',
              jogos: 1,
              vitorias: 0,
              empates: 1,
              derrotas: 0,
              gols_pro: 1,
              gols_contra: 1,
              saldo_gols: 0,
              pontos: 1,
              empate_persistente: true,
            },
          ],
          possui_empate_persistente: true,
        }),
      });
    });

    await page.goto(`/dashboard/competicoes/${idComp}`);
    await page.getByRole('button', { name: /classificação/i }).click();

    // Banner de alerta deve ser renderizado
    await expect(page.getByRole('alert', { name: /empates persistentes/i })).toBeVisible();
    await expect(
      page.getByText(
        'Atenção: existem empates pontuais que não puderam ser desempáticos pelos critérios técnicos do regulamento. Uma resolução manual ou sorteio pode ser necessária.'
      )
    ).toBeVisible();
  });

  test('visualiza chaveamento eliminatório (bracket) com fases, duelos e destaques', async ({
    page,
  }) => {
    const idComp = 103;
    const idEdicao = 203;

    await page.route(`**/competicoes/competicoes/${idComp}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_competicao: idComp,
          nome: 'Copa dos Campeões Mata-Mata',
          edicoes: [
            {
              id_edicao_competicao: idEdicao,
              id_competicao: idComp,
              identificacao: '2026',
              data_inicio: '2026-06-01',
              data_fim: '2026-06-30',
              formato: 'MATA_MATA',
              estado: 'EM_ANDAMENTO',
              publicada: true,
              revisao: 1,
              configuracao: {
                formato: 'MATA_MATA',
                terceiro_lugar: true,
                ida_volta: false,
              },
            },
          ],
        }),
      });
    });

    await page.route(`**/competicoes/edicoes/${idEdicao}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_edicao_competicao: idEdicao,
          id_competicao: idComp,
          identificacao: '2026',
          data_inicio: '2026-06-01',
          data_fim: '2026-06-30',
          formato: 'MATA_MATA',
          estado: 'EM_ANDAMENTO',
          publicada: true,
          revisao: 1,
          configuracao: {
            formato: 'MATA_MATA',
            terceiro_lugar: true,
            ida_volta: false,
          },
        }),
      });
    });

    // Mock das equipes
    await page.route(`**/competicoes/edicoes/${idEdicao}/equipes`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id_equipe: 1, nome: 'Águia Dourada', sigla: 'AGU' },
          { id_equipe: 2, nome: 'Falcão Real', sigla: 'FAL' },
          { id_equipe: 3, nome: 'Leão da Vila', sigla: 'LEA' },
          { id_equipe: 4, nome: 'Tigre Azul', sigla: 'TIG' },
        ]),
      });
    });

    // Mock da disputa com Semifinais e Final
    await page.route(`**/competicoes/edicoes/${idEdicao}/disputa`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_edicao_competicao: idEdicao,
          formato: 'MATA_MATA',
          estado: 'EM_ANDAMENTO',
          grupos: [],
          duelos: [
            {
              id_duelo: 1,
              id_edicao_competicao: idEdicao,
              fase: 'SEMIFINAL',
              posicao_chave: 1,
              ordem_na_fase: 1,
              ida_e_volta: false,
              status: 'RESOLVIDO',
              id_equipe_vencedora: 1,
              vagas: [
                {
                  id_vaga: 101,
                  id_duelo: 1,
                  posicao: 1,
                  origem_tipo: 'MANUAL',
                  id_equipe: 1,
                  nome_equipe: 'Águia Dourada',
                },
                {
                  id_vaga: 102,
                  id_duelo: 1,
                  posicao: 2,
                  origem_tipo: 'MANUAL',
                  id_equipe: 2,
                  nome_equipe: 'Falcão Real',
                },
              ],
            },
            {
              id_duelo: 2,
              id_edicao_competicao: idEdicao,
              fase: 'SEMIFINAL',
              posicao_chave: 2,
              ordem_na_fase: 2,
              ida_e_volta: false,
              status: 'PENDENTE',
              id_equipe_vencedora: null,
              vagas: [
                {
                  id_vaga: 103,
                  id_duelo: 2,
                  posicao: 1,
                  origem_tipo: 'MANUAL',
                  id_equipe: 3,
                  nome_equipe: 'Leão da Vila',
                },
                {
                  id_vaga: 104,
                  id_duelo: 2,
                  posicao: 2,
                  origem_tipo: 'MANUAL',
                  id_equipe: 4,
                  nome_equipe: 'Tigre Azul',
                },
              ],
            },
            {
              id_duelo: 3,
              id_edicao_competicao: idEdicao,
              fase: 'FINAL',
              posicao_chave: 1,
              ordem_na_fase: 1,
              ida_e_volta: false,
              status: 'PENDENTE',
              id_equipe_vencedora: null,
              vagas: [
                {
                  id_vaga: 105,
                  id_duelo: 3,
                  posicao: 1,
                  origem_tipo: 'DUELO_VENCEDOR',
                  origem_id: 1,
                  id_equipe: 1, // Vencedor da semifinal 1 já avançou
                  nome_equipe: 'Águia Dourada',
                },
                {
                  id_vaga: 106,
                  id_duelo: 3,
                  posicao: 2,
                  origem_tipo: 'DUELO_VENCEDOR',
                  origem_id: 2,
                  id_equipe: null,
                  nome_equipe: null,
                },
              ],
            },
            {
              id_duelo: 4,
              id_edicao_competicao: idEdicao,
              fase: 'TERCEIRO_LUGAR',
              posicao_chave: 1,
              ordem_na_fase: 1,
              ida_e_volta: false,
              status: 'PENDENTE',
              id_equipe_vencedora: null,
              vagas: [
                {
                  id_vaga: 107,
                  id_duelo: 4,
                  posicao: 1,
                  origem_tipo: 'DUELO_PERDEDOR',
                  origem_id: 1,
                  id_equipe: 2,
                  nome_equipe: 'Falcão Real',
                },
                {
                  id_vaga: 108,
                  id_duelo: 4,
                  posicao: 2,
                  origem_tipo: 'DUELO_PERDEDOR',
                  origem_id: 2,
                  id_equipe: null,
                  nome_equipe: null,
                },
              ],
            },
          ],
          total_partidas: 4,
        }),
      });
    });

    // Mock das partidas para conferir scores no chaveamento
    await page.route(`**/competicoes/edicoes/${idEdicao}/partidas*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id_partida: 1,
            id_edicao_competicao: idEdicao,
            id_duelo: 1,
            id_equipe_mandante: 1,
            id_equipe_visitante: 2,
            nome_mandante: 'Águia Dourada',
            nome_visitante: 'Falcão Real',
            numero_partida: 1,
            status: 'FINALIZADA',
            placar: { gols_mandante: 3, gols_visitante: 1 },
            vencedor_id: 1,
            revisao: 1,
          },
        ]),
      });
    });

    await page.goto(`/dashboard/competicoes/${idComp}`);

    // Clica na aba Jogos & Súmula onde o chaveamento eliminatório reside
    await page.getByRole('button', { name: /jogos & súmula/i }).click();

    // Chaveamento deve estar visível
    const secaoChaveamento = page.getByRole('region', { name: /chaveamento eliminatório/i });
    await expect(secaoChaveamento).toBeVisible();

    // Fases devem estar rotuladas
    await expect(page.getByText('Semifinais', { exact: true })).toBeVisible();
    await expect(page.getByText('Grande Final', { exact: true })).toBeVisible();

    // Duelo 1 resolvido com vencedor destacado
    const cardDuelo1 = page.getByRole('article', { name: /duelo 1/i });
    await expect(cardDuelo1).toBeVisible();
    await expect(cardDuelo1).toContainText('Resolvido');
    await expect(cardDuelo1).toContainText('Águia Dourada');
    await expect(cardDuelo1).toContainText('3'); // score mandante
    await expect(cardDuelo1).toContainText('1'); // score visitante

    // Grande final mostra Águia Dourada aguardando vencedor do jogo 2
    const cardFinal = page.getByRole('article', { name: /duelo 3/i });
    await expect(cardFinal).toBeVisible();
    await expect(cardFinal).toContainText('Águia Dourada');
    await expect(cardFinal).toContainText('Venc. Jogo 2');

    // Disputa de 3º lugar
    await expect(page.getByText('Disputa de 3º Lugar (Medalha de Bronze)')).toBeVisible();
    const card3Lugar = page.getByRole('article', { name: /duelo 4/i });
    await expect(card3Lugar).toBeVisible();
    await expect(card3Lugar).toContainText('Falcão Real');
  });

  test('na aba Classificação de campeonato MATA_MATA, orienta ir para Jogos & Súmula', async ({
    page,
  }) => {
    const idComp = 104;
    const idEdicao = 204;

    await page.route(`**/competicoes/competicoes/${idComp}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_competicao: idComp,
          nome: 'Copa Eliminatória Pura',
          edicoes: [
            {
              id_edicao_competicao: idEdicao,
              id_competicao: idComp,
              identificacao: '2026',
              data_inicio: '2026-06-01',
              data_fim: '2026-06-30',
              formato: 'MATA_MATA',
              estado: 'EM_ANDAMENTO',
              publicada: true,
              revisao: 1,
              configuracao: { formato: 'MATA_MATA' },
            },
          ],
        }),
      });
    });

    await page.route(`**/competicoes/edicoes/${idEdicao}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_edicao_competicao: idEdicao,
          id_competicao: idComp,
          identificacao: '2026',
          data_inicio: '2026-06-01',
          data_fim: '2026-06-30',
          formato: 'MATA_MATA',
          estado: 'EM_ANDAMENTO',
          publicada: true,
          revisao: 1,
          configuracao: { formato: 'MATA_MATA' },
        }),
      });
    });

    await page.route(`**/competicoes/edicoes/${idEdicao}/classificacao`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          linhas: [],
          grupos: [],
          possui_empate_persistente: false,
        }),
      });
    });

    await page.goto(`/dashboard/competicoes/${idComp}`);
    await page.getByRole('button', { name: /classificação/i }).click();

    // Deve exibir aviso explicativo sobre formato mata-mata
    await expect(page.getByText('Competição em Formato Mata-Mata')).toBeVisible();
    await expect(page.getByText(/Acesse a aba/i)).toContainText('Jogos & Súmula');
  });
});
