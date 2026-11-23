import { test, expect } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

test.describe('Correções de Eventos (RT15)', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const authRes = await request.post(`${API_E2E}/token`, {
      form: { username: 'coordenador', password: 'coord123' },
    });
    expect(authRes.ok()).toBeTruthy();
    token = (await authRes.json()).access_token;
  });

  test('DF-RT15-04, DF-RT15-05, DF-RT15-06 e PD-RT15-02: datas invertidas no campo, toast de sucesso, formulário limpo e nome duplicado no campo', async ({
    page,
  }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });
    const sufixo = Date.now();
    const nomeEvento = `Jogos RT15 ${sufixo}`;

    await page.goto('/dashboard/eventos');
    await page.getByRole('button', { name: /novo evento/i }).click();

    const dialog = page.getByRole('dialog', { name: /novo evento esportivo/i });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/nome do evento/i).fill(nomeEvento);
    await dialog.getByLabel(/descrição/i).fill('Descrição do primeiro evento');
    await dialog.getByLabel(/identificação da edição/i).fill('2026');
    await dialog.getByLabel(/data de início/i).fill('2026-12-31');
    await dialog.getByLabel(/data de término/i).fill('2026-11-01');

    // DF-RT15-05: datas invertidas mostram erro abaixo de Data de Término
    await dialog.getByRole('button', { name: /criar evento/i }).click();
    const erroCampoFim = dialog.locator('#data-fim-edicao-erro');
    await expect(erroCampoFim).toBeVisible();
    await expect(erroCampoFim).toContainText(/término/i);

    // Corrige a data e cria com sucesso
    await dialog.getByLabel(/data de início/i).fill('2026-11-01');
    await dialog.getByLabel(/data de término/i).fill('2026-12-31');
    await expect(erroCampoFim).toHaveCount(0);
    await dialog.getByRole('button', { name: /criar evento/i }).click();

    // DF-RT15-06: toast de sucesso
    await expect(page.getByText('Evento criado com sucesso.')).toBeVisible();
    await expect(page.getByText(nomeEvento)).toBeVisible();

    // DF-RT15-04: reabrir Novo evento deve vir limpo
    await page.getByRole('button', { name: /novo evento/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/nome do evento/i)).toHaveValue('');
    await expect(dialog.getByLabel(/descrição/i)).toHaveValue('');
    await expect(dialog.getByLabel(/identificação da edição/i)).toHaveValue('1ª Edição');
    await expect(dialog.getByLabel(/data de início/i)).toHaveValue('');
    await expect(dialog.getByLabel(/data de término/i)).toHaveValue('');

    // PD-RT15-02: nome repetido mostra erro abaixo do campo Nome
    await dialog.getByLabel(/nome do evento/i).fill(nomeEvento.toLowerCase());
    await dialog.getByLabel(/data de início/i).fill('2026-11-01');
    await dialog.getByLabel(/data de término/i).fill('2026-12-31');
    await dialog.getByRole('button', { name: /criar evento/i }).click();
    const erroCampoNome = dialog.locator('#nome-evento-erro');
    await expect(erroCampoNome).toBeVisible();
  });

  test('DF-RT15-06 e DF-RT15-07: criar edição, editar evento, editar edição do evento e arquivar', async ({
    page,
  }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const sufixo = Date.now();
    const nomeInicial = `Festival RT15 ${sufixo}`;
    const nomeEditado = `Festival RT15 Editado ${sufixo}`;

    await page.goto('/dashboard/eventos');
    await page.getByRole('button', { name: /novo evento/i }).click();
    const dialogNovo = page.getByRole('dialog', { name: /novo evento esportivo/i });
    await dialogNovo.getByLabel(/nome do evento/i).fill(nomeInicial);
    await dialogNovo.getByLabel(/identificação da edição/i).fill('2026');
    await dialogNovo.getByLabel(/data de início/i).fill('2026-05-01');
    await dialogNovo.getByLabel(/data de término/i).fill('2026-05-30');
    await dialogNovo.getByRole('button', { name: /criar evento/i }).click();
    await expect(page.getByText(nomeInicial)).toBeVisible();

    // Abre a página do evento
    await page.getByText(nomeInicial).click();
    await expect(page.getByRole('heading', { name: nomeInicial })).toBeVisible();

    // 1. Adicionar nova edição do evento + toast de sucesso
    await page.getByRole('button', { name: /adicionar edição de evento/i }).click();
    const dialogNovaEd = page.getByRole('dialog', { name: /nova edição do evento/i });
    await dialogNovaEd.getByLabel(/identificação da edição/i).fill('2027');
    await dialogNovaEd.getByLabel(/data de início/i).fill('2027-06-01');
    await dialogNovaEd.getByLabel(/data de término/i).fill('2027-06-30');
    await dialogNovaEd.getByRole('button', { name: /salvar edição/i }).click();
    await expect(page.getByText('Edição do evento criada com sucesso.')).toBeVisible();
    await expect(page.getByText('Competições vinculadas a 2027')).toBeVisible();

    // 2. Editar edição do evento (DF-RT15-07)
    await page.getByTestId('btn-editar-edicao-evento').click();
    const dialogEditarEd = page.getByRole('dialog', { name: /editar edição do evento/i });
    await dialogEditarEd.getByLabel(/identificação da edição/i).fill('2027-Rev');
    await dialogEditarEd.getByLabel(/data de término/i).fill('2027-07-15');
    await dialogEditarEd.getByRole('button', { name: /salvar alterações/i }).click();
    await expect(page.getByText('Edição do evento atualizada com sucesso.')).toBeVisible();
    await expect(page.getByText('Competições vinculadas a 2027-Rev')).toBeVisible();

    // 3. Editar evento (DF-RT15-07)
    await page.getByTestId('btn-editar-evento').click();
    const dialogEditarEv = page.getByRole('dialog', { name: /editar evento/i });
    await dialogEditarEv.getByLabel(/nome do evento/i).fill(nomeEditado);
    await dialogEditarEv.getByLabel(/descrição/i).fill('Nova descrição do festival');
    await dialogEditarEv.getByRole('button', { name: /salvar alterações/i }).click();
    await expect(page.getByText('Evento atualizado com sucesso.')).toBeVisible();
    await expect(page.getByRole('heading', { name: nomeEditado })).toBeVisible();

    // 4. Arquivar evento (DF-RT15-07)
    await page.getByTestId('btn-arquivar-evento').click();
    const dialogConfirmar = page.getByRole('dialog', { name: /arquivar evento/i });
    await expect(dialogConfirmar).toBeVisible();
    await dialogConfirmar.getByRole('button', { name: /^arquivar$/i }).click();
    await expect(page.getByText('Evento arquivado com sucesso.')).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/eventos$/);
    await expect(page.getByText(nomeEditado)).toHaveCount(0);
  });

  test('DF-RT15-01, DF-RT15-02 e PD-RT15-01: vincular competição existente, listar com link, e excluir evento em cascata com prévia e confirmação pelo nome', async ({
    page,
    request,
  }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const headers = { Authorization: `Bearer ${token}` };
    const ts = Date.now();
    const nomeEvento = `Olimpíada Cascata ${ts}`;
    const nomeComp = `Copa Vínculo RT15 ${ts}`;

    // Cria evento via API
    const evRes = await request.post(`${API_E2E}/competicoes/eventos`, {
      headers,
      data: {
        nome: nomeEvento,
        edicao: { identificacao: '2026', data_inicio: '2026-08-01', data_fim: '2026-08-31' },
      },
    });
    expect(evRes.ok()).toBeTruthy();
    const evento = await evRes.json();

    // Cria competição independente dentro do período do evento
    const modRes = await request.get(`${API_E2E}/modalidades/`, { headers });
    const mods = await modRes.json();
    const idModalidade = Array.isArray(mods) && mods.length > 0 ? mods[0].id_modalidade : 1;

    const compRes = await request.post(`${API_E2E}/competicoes/competicoes`, {
      headers,
      data: {
        nome: nomeComp,
        id_modalidade: idModalidade,
        edicao: {
          identificacao: '2026',
          data_inicio: '2026-08-05',
          data_fim: '2026-08-25',
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
    expect(compRes.ok()).toBeTruthy();
    const comp = await compRes.json();
    const idEdicaoComp = comp.edicoes[0].id_edicao_competicao as number;

    await page.goto(`/dashboard/eventos/${evento.id_evento}`);
    await expect(page.getByRole('heading', { name: nomeEvento })).toBeVisible();

    // DF-RT15-02: Vincular competição existente
    await page.getByTestId('btn-vincular-competicao').click();
    const dialogVincular = page.getByRole('dialog', { name: /vincular competição existente/i });
    await expect(dialogVincular).toBeVisible();
    await dialogVincular.getByTestId('select-edicao-vincular').selectOption(String(idEdicaoComp));
    await dialogVincular.getByRole('button', { name: /confirmar vínculo/i }).click();
    await expect(page.getByText('Competição vinculada com sucesso.')).toBeVisible();

    // DF-RT15-01: Card lista a competição vinculada com link
    const itemVinculado = page.getByTestId(`competicao-vinculada-${idEdicaoComp}`);
    await expect(itemVinculado).toBeVisible();
    const linkComp = itemVinculado.getByRole('link', { name: new RegExp(nomeComp) });
    await expect(linkComp).toHaveAttribute(
      'href',
      `/dashboard/competicoes/${comp.id_competicao}?edicao=${idEdicaoComp}`,
    );

    // PD-RT15-01: Excluir evento em cascata mostra prévia e exige digitar o nome exato
    await page.getByTestId('btn-excluir-evento').click();
    const dialogExcluir = page.getByRole('dialog', { name: new RegExp(nomeEvento) });
    await expect(dialogExcluir).toBeVisible();
    const previa = dialogExcluir.getByTestId('previa-exclusao-evento');
    await expect(previa).toBeVisible();
    await expect(previa).toContainText(/1\s*edição do evento/i);
    await expect(previa).toContainText(/1\s*edição de competição vinculada/i);

    const btnConfirmar = dialogExcluir.getByTestId('btn-confirmar-exclusao');
    await expect(btnConfirmar).toBeDisabled();

    const inputConfirmar = dialogExcluir.getByTestId('input-confirmacao-exclusao');
    await inputConfirmar.fill('nome errado');
    await expect(btnConfirmar).toBeDisabled();

    await inputConfirmar.fill(nomeEvento);
    await expect(btnConfirmar).toBeEnabled();
    await btnConfirmar.click();

    await expect(page.getByText('Evento excluído com sucesso.')).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/eventos$/);

    // Confirma exclusão física em cascata na API
    const checkEv = await request.get(`${API_E2E}/competicoes/eventos/${evento.id_evento}`, {
      headers,
    });
    expect(checkEv.status()).toBe(404);
    const checkComp = await request.get(
      `${API_E2E}/competicoes/competicoes/${comp.id_competicao}`,
      { headers },
    );
    expect(checkComp.status()).toBe(404);
  });
});
