import { test, expect } from '@playwright/test';

test.describe('Fatia 3 — Súmula Detalhada, Reabertura Justificada e Desempate Manual', () => {
  test.beforeEach(async ({ page }) => {
    // Fallback de menor prioridade (registrado primeiro): a aba padrão "Visão geral" busca
    // equipes, partidas, classificação, artilharia e painel disciplinar. Sem mock, essas
    // chamadas iriam ao backend real com o token falso, recebendo 401 e deslogando a sessão.
    // 404 deixa cada indicador como "—" (falha parcial prevista); mocks dos testes têm prioridade.
    await page.route(
      /\/competicoes\/edicoes\/\d+\/(equipes|partidas|classificacao|artilharia|disciplinar)(\?.*)?$/,
      (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"sem mock"}' }),
    );

    // A página da competição busca as modalidades em GET /modalidades (o backend redireciona
    // para /modalidades/); com o token falso isso daria 401. Mocks dos testes têm prioridade.
    await page.route(/\/modalidades\/?(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

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

    // Mock padrão de modalidades
    await page.route('**/modalidades/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id_modalidade: 1, nome: 'Futebol' }]),
      });
    });

    // Mocks padrão preventivos para evitar requisições 401 não autenticadas
    await page.route('**/competicoes/edicoes/*/equipes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/competicoes/edicoes/*/decisoes-classificacao', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/competicoes/edicoes/*/artilharia', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_edicao_competicao: 1,
          possui_jogos_em_andamento: false,
          artilheiros: [],
        }),
      });
    });

    await page.route('**/competicoes/edicoes/*/disciplinar', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_edicao_competicao: 1,
          suspensoes: [],
          resumo_cartoes: [],
        }),
      });
    });
  });

  test('Cenário 1: Súmula Detalhada — gol com autor, gol contra para o adversário, 2º amarelo derivando expulsão e finalização', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const idComp = 301;
    const idEdicao = 401;
    const idPartida = 501;

    // Estado mutável da partida e da súmula no teste
    let golsMandante = 0;
    let golsVisitante = 0;
    let statusPartida = 'EM_ANDAMENTO';
    let yellowCount = 0;
    const ocorrencias: any[] = [];

    // Mock Competição
    await page.route(`**/competicoes/competicoes/${idComp}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_competicao: idComp,
          nome: 'Copa Metropolitana 2026',
          slug: 'copa-metropolitana-2026',
          edicoes: [
            {
              id_edicao_competicao: idEdicao,
              id_competicao: idComp,
              identificacao: 'Principal 2026',
              data_inicio: '2026-05-01',
              data_fim: '2026-07-31',
              formato: 'PONTOS_CORRIDOS',
              estado: 'EM_ANDAMENTO',
              publicada: true,
              revisao: 1,
            },
          ],
        }),
      });
    });

    // Mock Detalhe da Edição
    await page.route(`**/competicoes/edicoes/${idEdicao}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_edicao_competicao: idEdicao,
          id_competicao: idComp,
          identificacao: 'Principal 2026',
          formato: 'PONTOS_CORRIDOS',
          estado: 'EM_ANDAMENTO',
          publicada: true,
          revisao: 1,
          configuracao: {
            formato: 'PONTOS_CORRIDOS',
            pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
            desempates: ['SALDO_GOLS', 'VITORIAS'],
          },
        }),
      });
    });

    // Mock Equipes e Integrantes da Edição
    await page.route(`**/competicoes/edicoes/${idEdicao}/equipes`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id_equipe: 10,
            nome: 'Falcões FC',
            sigla: 'FAL',
            integrantes: [
              {
                id_integrante: 101,
                id_equipe: 10,
                nome_esportivo: 'Yuri Alberto',
                numero_camisa: 9,
                situacao: 'ATIVO',
              },
            ],
          },
          {
            id_equipe: 20,
            nome: 'Tubarões EC',
            sigla: 'TUB',
            integrantes: [
              {
                id_integrante: 201,
                id_equipe: 20,
                nome_esportivo: 'Veiga',
                numero_camisa: 23,
                situacao: 'ATIVO',
              },
            ],
          },
        ]),
      });
    });

    // Mock Listagem de Partidas
    await page.route(`**/competicoes/edicoes/${idEdicao}/partidas`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id_partida: idPartida,
            id_edicao_competicao: idEdicao,
            numero_partida: 1,
            ordem_jogo: 1,
            rodada: 1,
            id_equipe_mandante: 10,
            nome_mandante: 'Falcões FC',
            sigla_mandante: 'FAL',
            id_equipe_visitante: 20,
            nome_visitante: 'Tubarões EC',
            sigla_visitante: 'TUB',
            status: statusPartida,
            placar: {
              gols_mandante: golsMandante,
              gols_visitante: golsVisitante,
            },
            revisao: 1,
          },
        ]),
      });
    });

    // Mock Disputa
    await page.route(`**/competicoes/edicoes/${idEdicao}/disputa`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          grupos: [],
          duelos: [],
          partidas: [],
        }),
      });
    });

    // Mock Súmula Detalhada (GET)
    await page.route(`**/competicoes/partidas/${idPartida}/sumula`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          partida: {
            id_partida: idPartida,
            id_edicao_competicao: idEdicao,
            numero_partida: 1,
            id_equipe_mandante: 10,
            nome_mandante: 'Falcões FC',
            sigla_mandante: 'FAL',
            id_equipe_visitante: 20,
            nome_visitante: 'Tubarões EC',
            sigla_visitante: 'TUB',
            status: statusPartida,
            placar: {
              gols_mandante: golsMandante,
              gols_visitante: golsVisitante,
            },
          },
          ocorrencias,
          alertas_suspensos: [
            {
              id_suspensao: 88,
              id_integrante: 201,
              nome_esportivo: 'Veiga',
              id_equipe: 20,
              jogos_pendentes: 1,
              motivo: 'Suspensão preventiva automática',
            },
          ],
        }),
      });
    });

    // Mock Registro de Ocorrência (POST)
    await page.route(`**/competicoes/partidas/${idPartida}/ocorrencias`, async (route) => {
      const payload = JSON.parse(route.request().postData() || '{}');
      const tipo = payload.tipo;

      if (tipo === 'GOL') {
        golsMandante += 1;
        ocorrencias.push({
          id_ocorrencia: ocorrencias.length + 1,
          id_partida: idPartida,
          tipo: 'GOL',
          id_equipe_beneficiada: 10,
          id_integrante: payload.id_integrante,
          nome_integrante: 'Yuri Alberto',
          numero_camisa: 9,
          minuto: payload.minuto || 15,
          periodo: payload.periodo || '1º Tempo',
        });
      } else if (tipo === 'GOL_CONTRA') {
        // Gol contra do atleta mandante beneficia o visitante
        golsVisitante += 1;
        ocorrencias.push({
          id_ocorrencia: ocorrencias.length + 1,
          id_partida: idPartida,
          tipo: 'GOL_CONTRA',
          id_equipe_beneficiada: 20,
          id_integrante: payload.id_integrante,
          nome_integrante: 'Yuri Alberto',
          numero_camisa: 9,
          minuto: payload.minuto || 25,
          periodo: payload.periodo || '1º Tempo',
        });
      } else if (tipo === 'CARTAO_AMARELO') {
        yellowCount += 1;
        const ocId = ocorrencias.length + 1;
        ocorrencias.push({
          id_ocorrencia: ocId,
          id_partida: idPartida,
          tipo: 'CARTAO_AMARELO',
          id_equipe_beneficiada: 10,
          id_integrante: payload.id_integrante,
          nome_integrante: 'Yuri Alberto',
          numero_camisa: 9,
          minuto: payload.minuto || 35,
          periodo: payload.periodo || '1º Tempo',
        });

        // Segundo amarelo dispara expulsão derivada automática
        if (yellowCount >= 2) {
          ocorrencias.push({
            id_ocorrencia: ocorrencias.length + 1,
            id_partida: idPartida,
            tipo: 'EXPULSAO_SEGUNDO_AMARELO',
            id_equipe_beneficiada: 10,
            id_integrante: payload.id_integrante,
            nome_integrante: 'Yuri Alberto',
            numero_camisa: 9,
            minuto: payload.minuto || 75,
            periodo: payload.periodo || '2º Tempo',
            observacao: 'Expulsão automática por 2º cartão amarelo',
            id_ocorrencia_origem: ocId,
          });
        }
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          partida: {
            id_partida: idPartida,
            id_edicao_competicao: idEdicao,
            numero_partida: 1,
            id_equipe_mandante: 10,
            nome_mandante: 'Falcões FC',
            sigla_mandante: 'FAL',
            id_equipe_visitante: 20,
            nome_visitante: 'Tubarões EC',
            sigla_visitante: 'TUB',
            status: statusPartida,
            placar: {
              gols_mandante: golsMandante,
              gols_visitante: golsVisitante,
            },
          },
          ocorrencias,
          alertas_suspensos: [],
        }),
      });
    });

    // Mock Finalizar Partida (POST)
    await page.route(`**/competicoes/partidas/${idPartida}/finalizar`, async (route) => {
      statusPartida = 'FINALIZADA';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_partida: idPartida,
          id_edicao_competicao: idEdicao,
          numero_partida: 1,
          id_equipe_mandante: 10,
          nome_mandante: 'Falcões FC',
          id_equipe_visitante: 20,
          nome_visitante: 'Tubarões EC',
          status: 'FINALIZADA',
          placar: {
            gols_mandante: golsMandante,
            gols_visitante: golsVisitante,
          },
        }),
      });
    });

    // Acessa o painel da edição e a aba Jogos
    await page.goto(`/dashboard/competicoes/${idComp}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Copa Metropolitana 2026' })).toBeVisible();

    await page.getByTestId('tab-jogos').click();
    await expect(page.getByText('Jogo #1')).toBeVisible();

    // 1. Abrir Modal de Súmula Detalhada
    const btnSumula = page.getByTestId(`btn-sumula-${idPartida}`);
    await expect(btnSumula).toBeVisible();
    await btnSumula.click();

    // Verifica cabeçalho e alerta de suspenso informativo
    await expect(page.getByRole('heading', { name: /Súmula Detalhada do Jogo #1/i })).toBeVisible();
    await expect(page.getByText(/Alerta Disciplinar: Atletas com Suspensão Ativa/i)).toBeVisible();
    await expect(page.getByText('Veiga')).toBeVisible();

    // Placar inicial: 0 x 0
    await expect(page.getByTestId('placar-mandante')).toHaveText('0');
    await expect(page.getByTestId('placar-visitante')).toHaveText('0');

    // 2. Lançar GOL com autor
    await page.getByTestId('select-tipo-ocorrencia').selectOption('GOL');
    await page.getByTestId('select-equipe-ocorrencia').selectOption('10');
    await page.getByTestId('select-integrante-ocorrencia').selectOption('101');
    await page.getByTestId('input-minuto-ocorrencia').fill('15');
    await page.getByTestId('btn-registrar-ocorrencia').click();

    // Verifica que o placar do mandante foi para 1
    await expect(page.getByTestId('placar-mandante')).toHaveText('1');
    await expect(page.getByTestId('placar-visitante')).toHaveText('0');
    const linhaTempo = page.getByTestId('linha-tempo-sumula');
    await expect(linhaTempo.getByText('Yuri Alberto')).toBeVisible();

    // 3. Lançar GOL_CONTRA (pelo atleta mandante 101, beneficiando o visitante 20)
    await page.getByTestId('select-tipo-ocorrencia').selectOption('GOL_CONTRA');
    await page.getByTestId('select-equipe-ocorrencia').selectOption('10');
    await page.getByTestId('select-integrante-ocorrencia').selectOption('101');
    await page.getByTestId('input-minuto-ocorrencia').fill('25');
    await page.getByTestId('btn-registrar-ocorrencia').click();

    // Verifica que o placar do visitante subiu para 1 (1 x 1)
    await expect(page.getByTestId('placar-mandante')).toHaveText('1');
    await expect(page.getByTestId('placar-visitante')).toHaveText('1');
    await expect(linhaTempo.getByText('Gol contra', { exact: true })).toBeVisible();

    // 4. Lançar 1º CARTÃO AMARELO para Yuri Alberto
    await page.getByTestId('select-tipo-ocorrencia').selectOption('CARTAO_AMARELO');
    await page.getByTestId('select-equipe-ocorrencia').selectOption('10');
    await page.getByTestId('select-integrante-ocorrencia').selectOption('101');
    await page.getByTestId('input-minuto-ocorrencia').fill('35');
    await page.getByTestId('btn-registrar-ocorrencia').click();

    await expect(linhaTempo.getByText('Cartão amarelo', { exact: true })).toBeVisible();

    // 5. Lançar 2º CARTÃO AMARELO para o mesmo jogador
    await page.getByTestId('select-tipo-ocorrencia').selectOption('CARTAO_AMARELO');
    await page.getByTestId('select-equipe-ocorrencia').selectOption('10');
    await page.getByTestId('select-integrante-ocorrencia').selectOption('101');
    await page.getByTestId('input-minuto-ocorrencia').fill('75');
    await page.getByTestId('btn-registrar-ocorrencia').click();

    // Verifica que disparou automaticamente EXPULSAO_SEGUNDO_AMARELO
    await expect(linhaTempo.getByText('Expulsão (segundo amarelo)', { exact: true })).toBeVisible();

    // 6. Finalizar Partida
    const btnFinalizar = page.getByTestId('btn-finalizar-partida');
    await expect(btnFinalizar).toBeVisible();
    await btnFinalizar.click();

    // Confirma status traduzido exibido no modal
    await expect(page.getByTestId('badge-status-sumula')).toHaveText('Finalizada');

    // Fecha o modal
    await page.getByTestId('btn-fechar-sumula').click();
  });

  test('Cenário 2: Reabertura Justificada — bloqueio 409 quando jogo descendente iniciou e reabertura com justificativa', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const idComp = 302;
    const idEdicao = 402;
    const idPartida = 502;

    let tentativa = 0;

    await page.route(`**/competicoes/competicoes/${idComp}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_competicao: idComp,
          nome: 'Copa Regional Mata-Mata',
          slug: 'copa-regional-mata-mata',
          edicoes: [
            {
              id_edicao_competicao: idEdicao,
              id_competicao: idComp,
              identificacao: '2026',
              formato: 'PONTOS_CORRIDOS',
              estado: 'EM_ANDAMENTO',
              publicada: true,
              revisao: 1,
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
          formato: 'PONTOS_CORRIDOS',
          estado: 'EM_ANDAMENTO',
          publicada: true,
          revisao: 1,
        }),
      });
    });

    await page.route(`**/competicoes/edicoes/${idEdicao}/partidas`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id_partida: idPartida,
            id_edicao_competicao: idEdicao,
            numero_partida: 1,
            id_equipe_mandante: 10,
            nome_mandante: 'Time Semifinal 1',
            id_equipe_visitante: 20,
            nome_visitante: 'Time Semifinal 2',
            status: 'FINALIZADA',
            placar: { gols_mandante: 2, gols_visitante: 1 },
          },
        ]),
      });
    });

    await page.route(`**/competicoes/edicoes/${idEdicao}/disputa`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ duelos: [], grupos: [], partidas: [] }),
      });
    });

    // Endpoint de reabertura com conflito 409 na primeira vez e sucesso 200 na segunda
    await page.route(`**/competicoes/partidas/${idPartida}/reabrir`, async (route) => {
      tentativa += 1;
      if (tentativa === 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            codigo: 'CONFLITO_ESTADO',
            mensagem:
              'Não é possível reabrir partida pois a partida final descendente já foi iniciada.',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id_partida: idPartida,
            status: 'EM_ANDAMENTO',
          }),
        });
      }
    });

    await page.goto(`/dashboard/competicoes/${idComp}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Copa Regional Mata-Mata' })).toBeVisible();

    await page.getByTestId('tab-jogos').click();
    await expect(page.getByText('Jogo #1')).toBeVisible();

    // Partida finalizada deve exibir botão Reabrir Jogo
    const btnReabrir = page.getByTestId(`btn-reabrir-${idPartida}`);
    await expect(btnReabrir).toBeVisible();
    await btnReabrir.click();

    // Modal de Reabertura aberto
    await expect(page.getByRole('heading', { name: /Reabrir Jogo #1/i })).toBeVisible();

    // Botão de confirmação deve iniciar desabilitado se motivo for vazio
    const btnConfirmar = page.getByTestId('btn-confirmar-reabertura');
    await expect(btnConfirmar).toBeDisabled();

    // Preenche justificativa
    await page.getByTestId('input-motivo-reabertura').fill('Erro de lançamento no placar');
    await expect(btnConfirmar).toBeEnabled();

    // 1ª Tentativa: Dispara 409 e confere exibição do alerta
    await btnConfirmar.click();
    const alertaErro = page.getByTestId('alerta-erro-reabertura');
    await expect(alertaErro).toBeVisible();
    await expect(alertaErro).toContainText(
      'Não é possível reabrir partida pois a partida final descendente já foi iniciada.'
    );

    // 2ª Tentativa: Sem conflito -> sucesso
    await btnConfirmar.click();
    await expect(page.getByText(/Operação de reabertura realizada com sucesso!/i)).toBeVisible();
  });

  test('Cenário 3: Resolução manual de empate persistente na classificação com reordenação e justificativa', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const idComp = 303;
    const idEdicao = 403;

    let empateResolvido = false;
    let decisaoSalva: any = null;

    await page.route(`**/competicoes/competicoes/${idComp}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id_competicao: idComp,
          nome: 'Campeonato com Empate Técnico',
          slug: 'campeonato-com-empate-tecnico',
          edicoes: [
            {
              id_edicao_competicao: idEdicao,
              id_competicao: idComp,
              identificacao: '2026',
              formato: 'PONTOS_CORRIDOS',
              estado: 'EM_ANDAMENTO',
              publicada: true,
              revisao: 1,
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
          formato: 'PONTOS_CORRIDOS',
          estado: 'EM_ANDAMENTO',
          publicada: true,
          revisao: 1,
        }),
      });
    });

    // Mock Classificação inicial com empate persistente e atualizada após resolução
    await page.route(`**/competicoes/edicoes/${idEdicao}/classificacao`, async (route) => {
      if (!empateResolvido) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            linhas: [
              {
                posicao: 1,
                id_equipe: 10,
                nome_equipe: 'Equipe Alpha',
                jogos: 2,
                vitorias: 1,
                empates: 1,
                derrotas: 0,
                gols_pro: 2,
                gols_contra: 1,
                saldo_gols: 1,
                pontos: 4,
                empate_persistente: true,
              },
              {
                posicao: 1,
                id_equipe: 20,
                nome_equipe: 'Equipe Beta',
                jogos: 2,
                vitorias: 1,
                empates: 1,
                derrotas: 0,
                gols_pro: 2,
                gols_contra: 1,
                saldo_gols: 1,
                pontos: 4,
                empate_persistente: true,
              },
            ],
            possui_empate_persistente: true,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            linhas: [
              {
                posicao: 1,
                id_equipe: 20,
                nome_equipe: 'Equipe Beta',
                jogos: 2,
                vitorias: 1,
                empates: 1,
                derrotas: 0,
                gols_pro: 2,
                gols_contra: 1,
                saldo_gols: 1,
                pontos: 4,
                empate_persistente: false,
              },
              {
                posicao: 2,
                id_equipe: 10,
                nome_equipe: 'Equipe Alpha',
                jogos: 2,
                vitorias: 1,
                empates: 1,
                derrotas: 0,
                gols_pro: 2,
                gols_contra: 1,
                saldo_gols: 1,
                pontos: 4,
                empate_persistente: false,
              },
            ],
            possui_empate_persistente: false,
          }),
        });
      }
    });

    // Mock Listar e Registrar Decisões de Classificação
    await page.route(`**/competicoes/edicoes/${idEdicao}/decisoes-classificacao`, async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        decisaoSalva = {
          id_decisao: 1,
          id_edicao_competicao: idEdicao,
          id_grupo: body.id_grupo,
          conjunto_equipes: body.conjunto_equipes,
          ordem_escolhida: body.ordem_escolhida,
          motivo: body.motivo,
          revisao_resultados: 'hash123',
          valida: true,
        };
        empateResolvido = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(decisaoSalva),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(decisaoSalva ? [decisaoSalva] : []),
        });
      }
    });

    await page.goto(`/dashboard/competicoes/${idComp}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Campeonato com Empate Técnico' })).toBeVisible();

    await page.getByTestId('tab-classificacao').click();

    // Banner de alerta com botão de resolver empate deve estar visível
    await expect(page.getByRole('alert', { name: /empates persistentes/i })).toBeVisible();
    const btnResolver = page.getByTestId('btn-resolver-empate');
    await expect(btnResolver).toBeVisible();
    await btnResolver.click();

    // Modal de Desempate Manual aberto
    await expect(page.getByRole('heading', { name: /Resolver Empate Manualmente/i })).toBeVisible();

    // Mover Equipe Beta para 1ª colocação (subir Beta ou descer Alpha)
    const btnSubirBeta = page.getByTestId('btn-subir-20');
    await expect(btnSubirBeta).toBeVisible();
    await btnSubirBeta.click();

    // Preenche a justificativa / ata do desempate
    await page
      .getByTestId('input-motivo-desempate')
      .fill('Sorteio presencial realizado na sede com presença dos representantes.');

    // Salva a decisão manual
    await page.getByTestId('btn-salvar-desempate').click();

    // Confirma que o modal fechou e a mensagem de sucesso foi exibida
    await expect(
      page.getByText(/Decisão manual de desempate registrada com sucesso!/i)
    ).toBeVisible();

    // O aviso de empates persistentes deve ter desaparecido
    await expect(page.getByRole('alert', { name: /empates persistentes/i })).not.toBeVisible();

    // Confirma que a decisão manual registrada é exibida no histórico
    const listaDecisoes = page.getByTestId('lista-decisoes-classificacao');
    await expect(listaDecisoes).toBeVisible();
    await expect(page.getByTestId('item-decisao-1')).toBeVisible();
    await expect(page.getByText('Válida')).toBeVisible();
    await expect(
      page.getByText('Sorteio presencial realizado na sede com presença dos representantes.')
    ).toBeVisible();
  });
});
