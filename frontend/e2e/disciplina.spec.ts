import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { API_E2E } from './helpers/ambiente';

test.describe('Painel de Disciplina, Cumprimentos e Artilharia (Fatia 3 - Task 8)', () => {
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

  async function criarCenarioCompeticao(request: APIRequestContext, authTok: string) {
    const ts = Date.now();

    // 1. Modalidade
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

    // 2. Competição com Edição em Pontos Corridos com Turno e Returno
    const resComp = await request.post(`${API_E2E}/competicoes/competicoes`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: {
        nome: `Torneio Disciplina E2E ${ts}`,
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
            turno_e_returno: true,
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

    // 3. Equipe 1: Falcões
    const resEq1 = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { nome: `Falcões FC ${ts}`, sigla: 'FAL' },
    });
    expect(resEq1.ok()).toBeTruthy();
    const eq1 = await resEq1.json();

    const resComp1 = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { nome: `Carlos Falcão ${ts}`, ativo: true },
    });
    const comp1 = await resComp1.json();

    const resInt1 = await request.post(
      `${API_E2E}/competicoes/equipes/${eq1.id_equipe}/integrantes`,
      {
        headers: { Authorization: `Bearer ${authTok}` },
        data: { id_competidor: comp1.id_competidor, nome_esportivo: 'Carlos', numero_camisa: 10 },
      }
    );
    expect(resInt1.ok()).toBeTruthy();
    const int1 = await resInt1.json();

    // 4. Equipe 2: Tubarões
    const resEq2 = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { nome: `Tubarões EC ${ts}`, sigla: 'TUB' },
    });
    expect(resEq2.ok()).toBeTruthy();
    const eq2 = await resEq2.json();

    // Integrante 2: Bruno (Artilheiro)
    const resComp2 = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { nome: `Bruno Tubarão ${ts}`, ativo: true },
    });
    const comp2 = await resComp2.json();

    const resInt2 = await request.post(
      `${API_E2E}/competicoes/equipes/${eq2.id_equipe}/integrantes`,
      {
        headers: { Authorization: `Bearer ${authTok}` },
        data: { id_competidor: comp2.id_competidor, nome_esportivo: 'Bruno', numero_camisa: 9 },
      }
    );
    expect(resInt2.ok()).toBeTruthy();
    const int2 = await resInt2.json();

    // Integrante 3: Marcos (para suspensão manual)
    const resComp3 = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${authTok}` },
      data: { nome: `Marcos Tubarão ${ts}`, ativo: true },
    });
    const comp3 = await resComp3.json();

    const resInt3 = await request.post(
      `${API_E2E}/competicoes/equipes/${eq2.id_equipe}/integrantes`,
      {
        headers: { Authorization: `Bearer ${authTok}` },
        data: { id_competidor: comp3.id_competidor, nome_esportivo: 'Marcos', numero_camisa: 5 },
      }
    );
    expect(resInt3.ok()).toBeTruthy();
    const int3 = await resInt3.json();

    // 5. Gerar Calendário / Tabela
    const resTab = await request.post(
      `${API_E2E}/competicoes/edicoes/${idEdicao}/gerar-tabela`,
      {
        headers: { Authorization: `Bearer ${authTok}` },
        data: null,
      }
    );
    expect(resTab.ok()).toBeTruthy();

    // Carregar partidas geradas (ordenadas por rodada)
    const resPartidas = await request.get(
      `${API_E2E}/competicoes/edicoes/${idEdicao}/partidas`,
      {
        headers: { Authorization: `Bearer ${authTok}` },
      }
    );
    expect(resPartidas.ok()).toBeTruthy();
    const partidas = await resPartidas.json();
    partidas.sort((a: { rodada: number }, b: { rodada: number }) => a.rodada - b.rodada);

    return {
      idCompeticao,
      idEdicao,
      eq1,
      eq2,
      int1,
      int2,
      int3,
      p1: partidas[0],
      p2: partidas[1],
    };
  }

  test('Cenário 1: visualiza suspensões automáticas, controle de cartões e artilharia oficial', async ({
    page,
    request,
  }) => {
    token = await autenticar(page, request);
    const { idCompeticao, idEdicao, eq1, eq2, int1, int2, p1 } = await criarCenarioCompeticao(
      request,
      token
    );

    // 1. Lança ocorrência de Cartão Vermelho Direto para Carlos (Falcões) na Partida 1
    const resVermelho = await request.post(
      `${API_E2E}/competicoes/partidas/${p1.id_partida}/ocorrencias`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tipo: 'CARTAO_VERMELHO_DIRETO',
          id_equipe: eq1.id_equipe,
          id_integrante: int1.id_integrante,
          minuto: 22,
          motivo: 'Falta violenta em lance manifesto de gol',
        },
      }
    );
    expect(resVermelho.ok()).toBeTruthy();

    // 2. Lança ocorrência de Gol para Bruno (Tubarões) na Partida 1
    const resGol = await request.post(
      `${API_E2E}/competicoes/partidas/${p1.id_partida}/ocorrencias`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tipo: 'GOL',
          id_equipe: eq2.id_equipe,
          id_integrante: int2.id_integrante,
          minuto: 38,
        },
      }
    );
    expect(resGol.ok()).toBeTruthy();

    // 3. Finaliza a Partida 1 (gera sanções automáticas e consolida artilharia)
    const resFinalizar = await request.post(
      `${API_E2E}/competicoes/partidas/${p1.id_partida}/finalizar`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      }
    );
    expect(resFinalizar.ok()).toBeTruthy();

    // 4. Navega até o Painel da Edição
    await page.goto(`/dashboard/competicoes/${idCompeticao}`);
    await expect(page.getByRole('heading', { level: 1, name: /Torneio Disciplina E2E/ })).toBeVisible({ timeout: 10000 });

    // 5. Clica na aba "Disciplina"
    const abaDisciplina = page.getByTestId('tab-disciplina');
    await expect(abaDisciplina).toBeVisible();
    await abaDisciplina.click();

    // 6. Painel Disciplina visível
    const painelDisciplina = page.getByTestId('painel-disciplina');
    await expect(painelDisciplina).toBeVisible();

    // --- Sub-Aba 1: Suspensões & Cumprimentos ---
    // Sub-abas são Radix Tabs: a ativa tem data-state="active" / aria-selected="true".
    await expect(page.getByTestId('subtab-suspensoes')).toHaveAttribute('data-state', 'active');
    await expect(page.getByTestId('subtab-suspensoes')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Carlos')).toBeVisible();
    await expect(page.getByText('Vermelho direto', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/suspensão automática por cartão vermelho direto/i)
    ).toBeVisible();
    await expect(page.getByText('0 / 1 jogos')).toBeVisible();
    await expect(
      page.locator('[data-testid^="badge-situacao-"]').first()
    ).toContainText('Ativa');
    // Ações da linha ficam no menu "⋯"
    await page.getByRole('button', { name: /mais ações da suspensão de carlos/i }).click();
    await expect(page.getByRole('menuitem', { name: /^cumprir$/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /^ajustar$/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // --- Sub-Aba 2: Controle de Cartões ---
    const subtabCartoes = page.getByTestId('subtab-cartoes');
    await subtabCartoes.click();
    await expect(subtabCartoes).toHaveAttribute('data-state', 'active');

    // Nota informativa obrigatória da Spec 7.4
    const notaSegundoAmarelo = page.getByTestId('nota-segundo-amarelo');
    await expect(notaSegundoAmarelo).toBeVisible();
    await expect(notaSegundoAmarelo).toContainText(
      'Os cartões amarelos que resultaram em expulsão por 2º amarelo na mesma partida não somam no saldo para acúmulo de amarelos.'
    );

    // Linha do atleta Carlos nos cartões
    const linhaCarlos = page.getByTestId(`linha-cartoes-${int1.id_integrante}`);
    await expect(linhaCarlos).toBeVisible();
    await expect(linhaCarlos).toContainText('Carlos');
    await expect(linhaCarlos.getByTestId('badge-suspenso')).toBeVisible();

    // --- Sub-Aba 3: Artilharia da Edição ---
    const subtabArtilharia = page.getByTestId('subtab-artilharia');
    await subtabArtilharia.click();

    await expect(page.getByText('Ranking Oficial de Artilharia')).toBeVisible();
    const linhaBruno = page.getByTestId(`linha-artilheiro-${int2.id_integrante}`);
    await expect(linhaBruno).toBeVisible();
    await expect(linhaBruno).toContainText('Bruno');
    await expect(linhaBruno).toContainText('9'); // número da camisa
    await expect(linhaBruno).toContainText('1'); // total de gols
  });

  test('Cenário 2: registra cumprimento de suspensão formal em partida finalizada posterior', async ({
    page,
    request,
  }) => {
    token = await autenticar(page, request);
    const { idCompeticao, idEdicao, eq1, int1, p1, p2 } = await criarCenarioCompeticao(
      request,
      token
    );

    // 1. Partida 1: Vermelho Direto para Carlos e finalização
    await request.post(
      `${API_E2E}/competicoes/partidas/${p1.id_partida}/ocorrencias`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tipo: 'CARTAO_VERMELHO_DIRETO',
          id_equipe: eq1.id_equipe,
          id_integrante: int1.id_integrante,
          minuto: 15,
          motivo: 'Conduta violenta',
        },
      }
    );
    await request.post(`${API_E2E}/competicoes/partidas/${p1.id_partida}/finalizar`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });

    // 2. Partida 2 (Rodada 2 posterior): Finalizada sem participação de Carlos
    const resFin2 = await request.post(
      `${API_E2E}/competicoes/partidas/${p2.id_partida}/finalizar`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      }
    );
    expect(resFin2.ok()).toBeTruthy();

    // 3. Obtém ID da suspensão gerada
    const resDisc = await request.get(
      `${API_E2E}/competicoes/edicoes/${idEdicao}/disciplinar`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const disc = await resDisc.json();
    expect(disc.suspensoes.length).toBeGreaterThan(0);
    const suspensao = disc.suspensoes[0];

    // 4. Acessa a interface
    await page.goto(`/dashboard/competicoes/${idCompeticao}`);
    await page.getByTestId('tab-disciplina').click();

    // 5. Abre o menu "⋯" e clica em "Cumprir"
    await page.getByTestId(`btn-acoes-suspensao-${suspensao.id_suspensao}`).click();
    const btnCumprir = page.getByTestId(`btn-cumprir-${suspensao.id_suspensao}`);
    await expect(btnCumprir).toBeVisible();
    await btnCumprir.click();

    // 6. Modal de Cumprimento abre
    await expect(page.getByRole('dialog', { name: /registrar cumprimento/i })).toBeVisible();
    await expect(page.getByText(`Suspensão #${suspensao.id_suspensao}`)).toBeVisible();

    // Seleciona a Partida 2 (jogo posterior finalizado)
    const selectPartida = page.getByTestId('select-partida-cumprimento');
    await selectPartida.selectOption(String(p2.id_partida));

    // Confirma cumprimento
    const btnConfirmar = page.getByTestId('btn-confirmar-cumprimento');
    await btnConfirmar.click();

    // 7. Modal fecha e dados são atualizados
    await expect(page.getByRole('dialog', { name: /registrar cumprimento/i })).not.toBeVisible();

    // A situação deve mudar para CUMPRIDA
    const badgeSituacao = page.getByTestId(`badge-situacao-${suspensao.id_suspensao}`);
    await expect(badgeSituacao).toBeVisible();
    await expect(badgeSituacao).toContainText('Cumprida');

    // Jogos cumpridos agora são 1 / 1
    const linhaSuspensao = page.getByTestId(`linha-suspensao-${suspensao.id_suspensao}`);
    await expect(linhaSuspensao).toContainText('1 / 1 jogos');

    // "Cumprir" não deve mais existir no menu de uma suspensão cumprida
    await page.getByTestId(`btn-acoes-suspensao-${suspensao.id_suspensao}`).click();
    await expect(page.getByTestId(`btn-ajustar-${suspensao.id_suspensao}`)).toBeVisible();
    await expect(page.getByTestId(`btn-cumprir-${suspensao.id_suspensao}`)).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('Cenário 3: cria suspensão manual e ajusta situação com justificativa obrigatória', async ({
    page,
    request,
  }) => {
    token = await autenticar(page, request);
    const { idCompeticao, idEdicao, int3 } = await criarCenarioCompeticao(request, token);

    // 1. Navega até a aba Disciplina
    await page.goto(`/dashboard/competicoes/${idCompeticao}`);
    await page.getByTestId('tab-disciplina').click();

    // 2. Clica no botão "Nova Suspensão Manual"
    const btnNovaSuspensao = page.getByTestId('btn-nova-suspensao');
    await expect(btnNovaSuspensao).toBeVisible();
    await btnNovaSuspensao.click();

    // 3. Modal de Ajuste/Criação abre
    await expect(page.getByRole('dialog', { name: /nova suspensão manual/i })).toBeVisible();

    // Tenta submeter sem preencher para validar campos obrigatórios
    const btnSalvarNova = page.getByTestId('btn-salvar-suspensao');
    await expect(btnSalvarNova).toBeDisabled();

    // Seleciona o integrante Marcos
    const selectIntegrante = page.getByTestId('select-integrante');
    await selectIntegrante.selectOption(String(int3.id_integrante));

    // Define 2 jogos
    const inputJogos = page.getByTestId('input-jogos-suspensao');
    await inputJogos.fill('2');

    // Preenche motivo com menos de 3 caracteres -> botão deve permanecer desabilitado
    const inputMotivo = page.getByTestId('input-motivo-suspensao');
    await inputMotivo.fill('Oi');
    await expect(btnSalvarNova).toBeDisabled();

    // Preenche justificativa válida
    await inputMotivo.fill('Suspensão administrativa por indisciplina no vestiário');
    await expect(btnSalvarNova).toBeEnabled();
    await btnSalvarNova.click();

    // 4. Modal fecha e nova suspensão aparece na tabela
    await expect(page.getByRole('dialog', { name: /nova suspensão manual/i })).not.toBeVisible();
    await expect(page.getByText('Marcos')).toBeVisible();
    await expect(page.getByText('Manual', { exact: true })).toBeVisible();
    await expect(page.getByText('Suspensão administrativa por indisciplina no vestiário')).toBeVisible();
    await expect(page.getByText('0 / 2 jogos')).toBeVisible();

    // 5. Ajustar a suspensão recém-criada
    const resDisc = await request.get(
      `${API_E2E}/competicoes/edicoes/${idEdicao}/disciplinar`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const disc = await resDisc.json();
    const suspensaoManual = disc.suspensoes.find(
      (s: { id_integrante: number }) => s.id_integrante === int3.id_integrante
    );
    expect(suspensaoManual).toBeDefined();

    await page.getByTestId(`btn-acoes-suspensao-${suspensaoManual.id_suspensao}`).click();
    const btnAjustar = page.getByTestId(`btn-ajustar-${suspensaoManual.id_suspensao}`);
    await expect(btnAjustar).toBeVisible();
    await btnAjustar.click();

    // 6. Modal abre em modo de Ajuste
    await expect(
      page.getByRole('dialog', { name: /ajustar \/ revisar suspensão/i })
    ).toBeVisible();

    // Altera a situação para CANCELADA
    const selectSituacao = page.getByTestId('select-situacao-suspensao');
    await selectSituacao.selectOption('CANCELADA');

    // Preenche a justificativa obrigatória do ajuste
    const inputMotivoAjuste = page.getByTestId('input-motivo-ajuste');
    await inputMotivoAjuste.fill('Julgamento pelo TJD acatou efeito suspensivo e anulou a punição');

    const btnSalvarAjuste = page.getByTestId('btn-salvar-ajuste');
    await expect(btnSalvarAjuste).toBeEnabled();
    await btnSalvarAjuste.click();

    // 7. Modal fecha e situação é atualizada na interface
    await expect(
      page.getByRole('dialog', { name: /ajustar \/ revisar suspensão/i })
    ).not.toBeVisible();

    const badgeSituacao = page.getByTestId(`badge-situacao-${suspensaoManual.id_suspensao}`);
    await expect(badgeSituacao).toBeVisible();
    await expect(badgeSituacao).toContainText('Cancelada');
  });

  test('Cenário 4: destaca visualmente suspensão em estado EM_REVISAO e exibe botão Revisar', async ({
    page,
    request,
  }) => {
    token = await autenticar(page, request);
    const { idCompeticao, idEdicao, int3 } = await criarCenarioCompeticao(request, token);

    // Cria suspensão manual via API
    const resManual = await request.post(
      `${API_E2E}/competicoes/edicoes/${idEdicao}/suspensoes`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          id_integrante: int3.id_integrante,
          jogos: 1,
          motivo: 'Conduta sob investigação disciplinar',
        },
      }
    );
    expect(resManual.ok()).toBeTruthy();
    const suspensao = await resManual.json();

    // Ajusta para EM_REVISAO
    const resAjuste = await request.put(
      `${API_E2E}/competicoes/suspensoes/${suspensao.id_suspensao}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          situacao: 'EM_REVISAO',
          motivo: 'Cartão de origem alterado após encerramento da súmula',
        },
      }
    );
    expect(resAjuste.ok()).toBeTruthy();

    // Acessa a interface
    await page.goto(`/dashboard/competicoes/${idCompeticao}`);
    await page.getByTestId('tab-disciplina').click();

    // Verifica que o alerta de destaque para EM_REVISAO aparece
    const alertaRevisao = page.getByTestId('alerta-em-revisao');
    await expect(alertaRevisao).toBeVisible();
    await expect(alertaRevisao).toContainText('Suspensões em revisão administrativa');

    // Verifica o badge especial de EM_REVISAO
    const badgeRevisao = page.getByTestId(`badge-em-revisao-${suspensao.id_suspensao}`);
    await expect(badgeRevisao).toBeVisible();
    await expect(badgeRevisao).toContainText(/em revisão/i);

    // A ação no menu "⋯" deve ter o texto "Revisar"
    await page.getByTestId(`btn-acoes-suspensao-${suspensao.id_suspensao}`).click();
    const btnRevisar = page.getByTestId(`btn-ajustar-${suspensao.id_suspensao}`);
    await expect(btnRevisar).toBeVisible();
    await expect(btnRevisar).toHaveText('Revisar');
  });
});
