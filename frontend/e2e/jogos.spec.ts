import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { API_E2E } from './helpers/ambiente';

test.describe('Gestão de Partidas, Agendamento e Placar Simples (Fatia 2)', () => {
  let token: string;

  async function autenticar(page: Page, request: APIRequestContext): Promise<string> {
    const credenciais = [
      { username: 'admin', password: 'senha123' },
      { username: 'admin', password: 'admin123' },
      { username: 'coordenador', password: 'coord123' },
      { username: 'Coordenador', password: 'senha123' },
    ];

    let t = '';
    let r: string | null = null;

    for (const cred of credenciais) {
      try {
        const res = await request.post(`${API_E2E}/token`, {
          form: cred,
        });
        if (res.ok()) {
          const data = await res.json();
          t = data.access_token;
          r = data.refresh_token || null;
          break;
        }
      } catch {
        // tenta proxima credencial
      }
    }

    if (!t) {
      throw new Error('Falha ao autenticar em nenhum dos perfis de teste.');
    }

    await page.addInitScript(
      ({ tok, ref }) => {
        localStorage.setItem('token', tok);
        if (ref) localStorage.setItem('refresh_token', ref);
      },
      { tok: t, ref: r }
    );

    return t;
  }

  async function criarCompeticaoComEdicaoEEquipes(request: APIRequestContext, authTok: string) {
    const ts = Date.now();

    // Busca ID de modalidade válido disponível no sistema
    let idModalidade = 1;
    const resMod = await request.get(`${API_E2E}/modalidades/`, {
      headers: { Authorization: `Bearer ${authTok}` },
    });
    if (resMod.ok()) {
      const modalidades = await resMod.json();
      if (Array.isArray(modalidades) && modalidades.length > 0) {
        idModalidade = modalidades[0].id_modalidade;
      }
    }

    // 1. Criar Competição com Edição em Rascunho
    const resComp = await request.post(`${API_E2E}/competicoes/competicoes`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: {
        nome: `Torneio Jogos E2E ${ts}`,
        id_modalidade: idModalidade,
        edicao: {
          identificacao: `Edição ${ts}`,
          data_inicio: '2026-06-01',
          data_fim: '2026-07-31',
          formato: 'PONTOS_CORRIDOS',
          configuracao: {
            formato: 'PONTOS_CORRIDOS',
            pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
            desempates: ['SALDO_GOLS', 'VITORIAS'],
            disciplina: {
              limite_amarelos: 3,
              jogos_por_acumulo: 1,
              jogos_por_vermelho: 1,
              jogos_por_segundo_amarelo: 1,
              zerar_amarelos_ao_encerrar_grupos: false,
            },
          },
        },
      },
    });

    expect(resComp.ok()).toBeTruthy();
    const comp = await resComp.json();
    const idCompeticao = comp.id_competicao as number;
    const idEdicao = comp.edicoes[0].id_edicao_competicao as number;

    // 2. Cadastrar Equipe 1
    const resEq1 = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: {
        nome: `Falcões E2E ${ts}`,
        sigla: 'FAL',
      },
    });
    expect(resEq1.ok()).toBeTruthy();
    const eq1 = await resEq1.json();

    // Inscrever atleta na Equipe 1
    const resComp1 = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { nome: `Atleta Falcão ${ts}`, ativo: true },
    });
    expect(resComp1.ok()).toBeTruthy();
    const comp1 = await resComp1.json();

    const resInt1 = await request.post(`${API_E2E}/competicoes/equipes/${eq1.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { id_competidor: comp1.id_competidor, nome_esportivo: 'Falcão', numero_camisa: 10 },
    });
    expect(resInt1.ok()).toBeTruthy();

    // 3. Cadastrar Equipe 2
    const resEq2 = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: {
        nome: `Tubarões E2E ${ts}`,
        sigla: 'TUB',
      },
    });
    expect(resEq2.ok()).toBeTruthy();
    const eq2 = await resEq2.json();

    // Inscrever atleta na Equipe 2
    const resComp2 = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { nome: `Atleta Tubarão ${ts}`, ativo: true },
    });
    expect(resComp2.ok()).toBeTruthy();
    const comp2 = await resComp2.json();

    const resInt2 = await request.post(`${API_E2E}/competicoes/equipes/${eq2.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { id_competidor: comp2.id_competidor, nome_esportivo: 'Tubarão', numero_camisa: 9 },
    });
    expect(resInt2.ok()).toBeTruthy();

    return { idCompeticao, idEdicao };
  }

  test('visualiza aba Jogos, gera tabela, agenda partida e lança placar simples', async ({
    page,
    request,
  }) => {
    token = await autenticar(page, request);
    const { idCompeticao } = await criarCompeticaoComEdicaoEEquipes(request, token);

    // Navega diretamente até a página da competição
    await page.goto(`/dashboard/competicoes/${idCompeticao}`);

    // Clica na aba "Jogos"
    const abaJogos = page.getByTestId('tab-jogos');
    await expect(abaJogos).toBeVisible({ timeout: 10000 });
    await abaJogos.click();

    // Como está em RASCUNHO, o botão "Gerar Calendário / Tabela" deve estar presente
    const btnGerarTabela = page.getByRole('button', { name: /gerar calendário \/ tabela/i }).first();
    await expect(btnGerarTabela).toBeVisible();

    // Aciona a geração da tabela
    await btnGerarTabela.click();

    // Aguarda o feedback de sucesso e a renderização dos confrontos
    await expect(page.getByText(/tabela de jogos (e chaveamento )?gerad[ao]s? com sucesso/i)).toBeVisible({
      timeout: 10000,
    });

    // Deve exibir pelo menos uma partida (ex: Falcões vs Tubarões)
    await expect(page.getByText('Jogo 1', { exact: true })).toBeVisible();
    const primeiroCartao = page.locator('[data-testid^="cartao-partida-"]').first();
    await expect(primeiroCartao.getByTestId('status-partida')).toHaveText('Agendada');

    // ----------------------------------------------------
    // Teste de Agendamento da Partida
    // ----------------------------------------------------
    const btnAgendar = page.getByRole('button', { name: /^agendar$/i }).first();
    await expect(btnAgendar).toBeVisible();
    await btnAgendar.click();

    // O modal de agendamento deve abrir
    await expect(page.getByRole('dialog', { name: /agendar partida/i })).toBeVisible();

    // Preenche data, horário, local e campo
    await page.locator('#agendamento-data').fill('2026-06-20');
    await page.locator('#agendamento-hora').fill('15:30');
    await page.locator('#agendamento-local').fill('Arena Central');
    await page.locator('#agendamento-campo').fill('Campo 1');

    // Salva o agendamento
    await page.getByRole('button', { name: /salvar agendamento/i }).click();

    // Verifica feedback de sucesso e se a data/local aparecem no card
    await expect(page.getByRole('dialog', { name: /agendar partida/i })).not.toBeVisible();
    await expect(page.getByText(/agendamento do jogo/i)).toBeVisible();
    await expect(page.getByText('20/06/2026')).toBeVisible();
    await expect(page.getByText('15:30')).toBeVisible();
    await expect(page.getByText(/Arena Central/)).toBeVisible();

    // ----------------------------------------------------
    // Teste de Lançamento de Placar Simples
    // ----------------------------------------------------
    const btnLancarPlacar = page.getByRole('button', { name: /lançar placar/i }).first();
    await expect(btnLancarPlacar).toBeVisible();
    await btnLancarPlacar.click();

    // O modal de resultado simples deve abrir
    await expect(page.getByRole('dialog', { name: /lançar placar simples/i })).toBeVisible();

    // Preenche gols do mandante e visitante
    const inputGolsMandante = page.getByLabel(/gols falcões|gols mandante/i).first();
    await inputGolsMandante.fill('3');

    const inputGolsVisitante = page.getByLabel(/gols tubarões|gols visitante/i).first();
    await inputGolsVisitante.fill('1');

    // Confirma o resultado
    await page.getByRole('button', { name: /confirmar placar/i }).click();

    // Verifica que o modal fechou e o placar atualizado é exibido
    await expect(page.getByRole('dialog', { name: /lançar placar simples/i })).not.toBeVisible();
    await expect(page.getByText(/placar do jogo/i)).toBeVisible();

    // O placar 3 x 1 deve estar visível no card da partida
    await expect(primeiroCartao.getByTestId('gols-mandante')).toHaveText('3');
    await expect(primeiroCartao.getByTestId('gols-visitante')).toHaveText('1');

    // Status traduzido (badge no card)
    await expect(primeiroCartao.getByTestId('status-partida')).toHaveText('Finalizada');

    // Jogo finalizado só é corrigido por reabertura justificada
    await expect(page.getByRole('button', { name: /reabrir jogo/i }).first()).toBeVisible();
  });

  test('registra resultado por W.O. atribuindo vitória regulamentar e testa filtros', async ({
    page,
    request,
  }) => {
    token = await autenticar(page, request);
    const { idCompeticao } = await criarCompeticaoComEdicaoEEquipes(request, token);

    await page.goto(`/dashboard/competicoes/${idCompeticao}`);
    await page.getByTestId('tab-jogos').click();

    // Gera a tabela
    await page.getByRole('button', { name: /gerar calendário \/ tabela/i }).first().click();
    await expect(page.getByText(/tabela de jogos (e chaveamento )?gerad[ao]s? com sucesso/i)).toBeVisible();

    // Abre lançamento de placar
    await page.getByRole('button', { name: /lançar placar/i }).first().click();
    await expect(page.getByRole('dialog', { name: /lançar placar simples/i })).toBeVisible();

    // Seleciona opção Declarar Resultado por W.O.
    const checkWo = page.getByRole('checkbox', { name: /declarar resultado por w\.o\./i });
    await checkWo.check();

    // Seleciona a equipe derrotada por WO
    const radioWo = page.locator('input[name="equipe_wo"]').first();
    await radioWo.check();

    // Confirma placar
    await page.getByRole('button', { name: /confirmar placar/i }).click();

    // Modal fecha e exibe mensagem de sucesso
    await expect(page.getByRole('dialog', { name: /lançar placar simples/i })).not.toBeVisible();
    await expect(page.getByText(/placar do jogo/i)).toBeVisible();

    // Status traduzido no card
    await expect(
      page.locator('[data-testid^="cartao-partida-"]').first().getByTestId('status-partida')
    ).toHaveText('Finalizada');

    // Testa filtro por status FINALIZADA
    await page.locator('#filtro-status').selectOption('FINALIZADA');
    await expect(page.getByText('Jogo 1', { exact: true })).toBeVisible();

    // Testa filtro por status AGENDADA -> deve exibir estado vazio de filtros
    await page.locator('#filtro-status').selectOption('AGENDADA');
    await expect(
      page.getByText(/nenhuma partida encontrada para os filtros selecionados/i)
    ).toBeVisible();
  });
});
