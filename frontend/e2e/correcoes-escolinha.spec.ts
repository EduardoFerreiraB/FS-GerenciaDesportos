import { test, expect, APIRequestContext } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

const PDF_MINIMO = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

function gerarCpfValido(semente: number): string {
  const base = String(100000000 + (Math.abs(semente) % 899999999)).slice(0, 9);
  const digitos = base.split('').map(Number);
  if (digitos.every((d) => d === digitos[0])) {
    digitos[8] = (digitos[8] + 1) % 10;
  }
  const calc = (arr: number[], pesoInicial: number) => {
    const soma = arr.reduce((acc, n, i) => acc + n * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calc(digitos, 10);
  const d2 = calc([...digitos, d1], 11);
  return [...digitos, d1, d2].join('');
}

function formatarCpfEsperado(cpf: string): string {
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
}

async function obterHeaders(request: APIRequestContext, username = 'admin', password = 'admin123') {
  const res = await request.post(`${API_E2E}/token`, {
    form: { username, password },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { Authorization: `Bearer ${body.access_token as string}` };
}

async function criarModalidadeApi(request: APIRequestContext, headers: Record<string, string>, nome: string, descricao = '') {
  const res = await request.post(`${API_E2E}/modalidades/`, {
    headers,
    data: { nome, descricao },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function criarProfessorApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  dados: { nome: string; cpf: string; contato: string; username: string; password?: string },
) {
  const res = await request.post(`${API_E2E}/professores/`, {
    headers,
    data: {
      nome: dados.nome,
      cpf: dados.cpf,
      contato: dados.contato,
      username: dados.username,
      password: dados.password ?? 'senha123',
    },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function trocarSenhaPrimeiroAcesso(
  request: APIRequestContext,
  username: string,
  senhaAntiga: string,
  senhaNova: string,
) {
  const headers = await obterHeaders(request, username, senhaAntiga);
  const res = await request.post(`${API_E2E}/change-password`, {
    headers,
    data: {
      old_password: senhaAntiga,
      new_password: senhaNova,
      confirm_password: senhaNova,
    },
  });
  expect(res.ok()).toBeTruthy();
}

async function criarTurmaApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  dados: {
    descricao: string;
    categoria_idade?: string;
    dias_semana: string[];
    horario_inicio: string;
    horario_fim: string;
    id_modalidade: number;
    id_professor: number;
  },
) {
  const res = await request.post(`${API_E2E}/turmas/`, {
    headers,
    data: {
      descricao: dados.descricao,
      categoria_idade: dados.categoria_idade ?? 'Sub-13',
      dias_semana: dados.dias_semana,
      horario_inicio: dados.horario_inicio,
      horario_fim: dados.horario_fim,
      id_modalidade: dados.id_modalidade,
      id_professor: dados.id_professor,
    },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function criarAlunoApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  nomeCompleto: string,
  idTurma: number,
) {
  const res = await request.post(`${API_E2E}/alunos/`, {
    headers,
    multipart: {
      nome_completo: nomeCompleto,
      data_nascimento: '2012-05-10',
      escola: 'Escola Teste',
      serie_ano: '7º ano',
      nome_mae: 'Mãe Teste',
      telefone_1: '62999990000',
      endereco: 'Rua Teste, 100',
      ids_turmas: String(idTurma),
      documento: { name: 'doc.pdf', mimeType: 'application/pdf', buffer: PDF_MINIMO },
      atestado: { name: 'atestado.pdf', mimeType: 'application/pdf', buffer: PDF_MINIMO },
    },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe('Professores (RT02)', () => {
  test('DF-RT02-02 e PD-RT02-02: CPF e contato formatados na lista/formulário e busca por CPF e usuário', async ({
    page,
    request,
  }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const cpf = gerarCpfValido(suf);
    const cpfFormatado = formatarCpfEsperado(cpf);
    const username = `prof.fmt.${suf}`;
    const nome = `Prof Formatação ${suf}`;

    const prof = await criarProfessorApi(request, headers, {
      nome,
      cpf,
      contato: '62999991234',
      username,
    });

    await authenticateDirectly(page);
    await page.goto('/dashboard/professores');

    const linha = page.locator('tbody tr', { hasText: nome });
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(cpfFormatado);
    await expect(linha).toContainText('(62) 99999-1234');

    const busca = page.getByRole('searchbox', { name: /buscar professor/i });
    await busca.fill(cpf);
    await expect(linha).toBeVisible();

    await busca.fill(cpfFormatado);
    await expect(linha).toBeVisible();

    await busca.fill(username);
    await expect(linha).toBeVisible();

    await page.goto(`/dashboard/professores/${prof.id_professor}`);
    await expect(page.getByLabel('CPF')).toHaveValue(cpfFormatado);
    await expect(page.getByLabel(/contato/i)).toHaveValue('(62) 99999-1234');

    await request.delete(`${API_E2E}/professores/${prof.id_professor}`, { headers });
  });

  test('DF-RT02-01: excluir com busca ativa mantém a busca e não esvazia a lista ao limpar', async ({
    page,
    request,
  }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const profFica = await criarProfessorApi(request, headers, {
      nome: `Prof Fica ${suf}`,
      cpf: gerarCpfValido(suf + 1),
      contato: '62988881111',
      username: `prof.fica.${suf}`,
    });
    const profSai = await criarProfessorApi(request, headers, {
      nome: `Prof Apagar ${suf}`,
      cpf: gerarCpfValido(suf + 2),
      contato: '62988882222',
      username: `prof.sai.${suf}`,
    });

    await authenticateDirectly(page);
    await page.goto('/dashboard/professores');

    const busca = page.getByRole('searchbox', { name: /buscar professor/i });
    await busca.fill(`Apagar ${suf}`);
    await expect(page.locator('tbody tr', { hasText: profSai.nome })).toBeVisible();

    await page.getByRole('button', { name: `Mais ações para ${profSai.nome}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('textbox').last().fill(profSai.nome);
    await page.getByRole('button', { name: 'Excluir professor' }).click();

    await expect(busca).toHaveValue(`Apagar ${suf}`);
    await expect(page.locator('tbody tr', { hasText: profSai.nome })).toHaveCount(0);

    await busca.fill('');
    await expect(page.locator('tbody tr', { hasText: profFica.nome })).toBeVisible();

    await request.delete(`${API_E2E}/professores/${profFica.id_professor}`, { headers });
  });

  test('PD-RT02-03: bloqueio de exclusão exibe o detail retornado pela API', async ({ page, request }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const mod = await criarModalidadeApi(request, headers, `Mod Prof Bloq ${suf}`);
    const prof = await criarProfessorApi(request, headers, {
      nome: `Prof Bloqueado ${suf}`,
      cpf: gerarCpfValido(suf + 3),
      contato: '62988883333',
      username: `prof.bloq.${suf}`,
    });
    const turma = await criarTurmaApi(request, headers, {
      descricao: `Turma Bloq ${suf}`,
      dias_semana: ['SEG'],
      horario_inicio: '08:00:00',
      horario_fim: '09:00:00',
      id_modalidade: mod.id_modalidade,
      id_professor: prof.id_professor,
    });

    await authenticateDirectly(page);
    await page.goto('/dashboard/professores');

    await page.getByRole('button', { name: `Mais ações para ${prof.nome}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('textbox').last().fill(prof.nome);
    await page.getByRole('button', { name: 'Excluir professor' }).click();

    await expect(page.getByRole('dialog')).toContainText(/alocado em uma ou mais turmas|turma/i);
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await request.delete(`${API_E2E}/turmas/${turma.id_turma}`, { headers });
    await request.delete(`${API_E2E}/professores/${prof.id_professor}`, { headers });
    await request.delete(`${API_E2E}/modalidades/${mod.id_modalidade}`, { headers });
  });
});

test.describe('Turmas (RT03)', () => {
  test('DF-RT03-02 e PD-RT03-02: trilha começa em Dashboard e horário invertido é bloqueado na tela', async ({
    page,
    request,
  }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const mod = await criarModalidadeApi(request, headers, `Mod Turma ${suf}`);
    const prof = await criarProfessorApi(request, headers, {
      nome: `Prof Turma ${suf}`,
      cpf: gerarCpfValido(suf + 10),
      contato: '62977771111',
      username: `prof.turma.${suf}`,
    });

    await authenticateDirectly(page);
    await page.goto('/dashboard/turmas');

    const trilha = page.getByTestId('trilha-topbar');
    await expect(trilha).toContainText('Dashboard');
    await expect(trilha).toContainText('Turmas');

    await page.goto('/dashboard/turmas/novo');
    await expect(page.getByTestId('trilha-topbar')).toContainText('Dashboard');

    await page.getByLabel(/modalidade/i).selectOption(String(mod.id_modalidade));
    await page.getByLabel(/professor responsável/i).selectOption(String(prof.id_professor));
    await page.getByLabel(/categoria/i).fill('Sub-15');
    await page.getByLabel(/descrição \/ nome/i).fill(`Turma Invertida ${suf}`);
    await page.getByRole('button', { name: 'Segunda' }).click();
    await page.getByLabel(/horário de início/i).fill('18:00');
    await page.getByLabel(/horário de fim/i).fill('17:00');

    let enviouPost = false;
    await page.route('**/turmas/', (route) => {
      if (route.request().method() === 'POST') enviouPost = true;
      route.continue();
    });

    await page.getByRole('button', { name: 'Criar Turma' }).click();
    await expect(page.getByText(/posterior ao horário de início/i)).toBeVisible();
    expect(enviouPost).toBe(false);

    await request.delete(`${API_E2E}/professores/${prof.id_professor}`, { headers });
    await request.delete(`${API_E2E}/modalidades/${mod.id_modalidade}`, { headers });
  });

  test('PD-RT03-01: diálogo de exclusão de turma mostra quantas matrículas e presenças serão apagadas', async ({
    page,
    request,
  }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const mod = await criarModalidadeApi(request, headers, `Mod Impacto ${suf}`);
    const prof = await criarProfessorApi(request, headers, {
      nome: `Prof Impacto ${suf}`,
      cpf: gerarCpfValido(suf + 11),
      contato: '62977772222',
      username: `prof.imp.${suf}`,
    });
    const turma = await criarTurmaApi(request, headers, {
      descricao: `Turma Impacto ${suf}`,
      dias_semana: ['TER'],
      horario_inicio: '10:00:00',
      horario_fim: '11:00:00',
      id_modalidade: mod.id_modalidade,
      id_professor: prof.id_professor,
    });
    const aluno = await criarAlunoApi(request, headers, `Aluno Impacto ${suf}`, turma.id_turma);
    const matsRes = await request.get(`${API_E2E}/matriculas/?turma_id=${turma.id_turma}`, { headers });
    const mats = await matsRes.json();
    await request.post(`${API_E2E}/presencas/lote`, {
      headers,
      data: {
        data_aula: '2026-11-20',
        id_turma: turma.id_turma,
        presencas: [{ id_matricula: mats[0].id_matricula, status: 'Presente' }],
      },
    });

    await authenticateDirectly(page);
    await page.goto('/dashboard/turmas');

    await page.getByRole('button', { name: `Mais ações de ${turma.descricao}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('1 matrícula');
    await expect(dialogo).toContainText('1 presença');
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await request.delete(`${API_E2E}/alunos/${aluno.id_aluno}`, { headers });
    await request.delete(`${API_E2E}/turmas/${turma.id_turma}`, { headers });
    await request.delete(`${API_E2E}/professores/${prof.id_professor}`, { headers });
    await request.delete(`${API_E2E}/modalidades/${mod.id_modalidade}`, { headers });
  });
});

test.describe('Modalidades (RT04)', () => {
  test('DF-RT04-01, PD-RT04-02 e PD-RT04-03: erro duplicado da API, edição e bloqueio de exclusão', async ({
    page,
    request,
  }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const nomeOriginal = `Handebol ${suf}`;
    const nomeEditado = `Handebol Editado ${suf}`;
    const mod = await criarModalidadeApi(request, headers, nomeOriginal, 'Descrição inicial');

    await authenticateDirectly(page);
    await page.goto('/dashboard/modalidades');

    // DF-RT04-01: duplicado mostra o detail da API
    await page.getByRole('button', { name: 'Nova modalidade' }).click();
    await page.getByLabel(/nome da modalidade/i).fill(nomeOriginal);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('dialog')).toContainText(/já existe/i);
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // PD-RT04-02: editar modalidade
    await page.getByRole('button', { name: `Mais ações de ${nomeOriginal}` }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await page.getByLabel(/nome da modalidade/i).fill(nomeEditado);
    await page.getByLabel(/descrição curta/i).fill('Nova descrição');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.locator('tbody tr', { hasText: nomeEditado })).toContainText('Nova descrição');

    // PD-RT04-03: bloqueio de exclusão com turma vinculada mostra detail da API
    const prof = await criarProfessorApi(request, headers, {
      nome: `Prof Mod ${suf}`,
      cpf: gerarCpfValido(suf + 20),
      contato: '62966661111',
      username: `prof.mod.${suf}`,
    });
    const turma = await criarTurmaApi(request, headers, {
      descricao: `Turma Mod ${suf}`,
      dias_semana: ['QUA'],
      horario_inicio: '14:00:00',
      horario_fim: '15:00:00',
      id_modalidade: mod.id_modalidade,
      id_professor: prof.id_professor,
    });

    await page.getByRole('button', { name: `Mais ações de ${nomeEditado}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('textbox').last().fill(nomeEditado);
    await page.getByRole('button', { name: 'Excluir modalidade' }).click();
    await expect(page.getByRole('dialog')).toContainText(/turma/i);
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await request.delete(`${API_E2E}/turmas/${turma.id_turma}`, { headers });
    await request.delete(`${API_E2E}/professores/${prof.id_professor}`, { headers });
    await request.delete(`${API_E2E}/modalidades/${mod.id_modalidade}`, { headers });
  });
});

test.describe('Matrículas (RT05)', () => {
  test('PD-RT05-01: diálogo marca "Já matriculado" e desabilita a turma atual do aluno', async ({
    page,
    request,
  }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const mod = await criarModalidadeApi(request, headers, `Mod Mat ${suf}`);
    const prof = await criarProfessorApi(request, headers, {
      nome: `Prof Mat ${suf}`,
      cpf: gerarCpfValido(suf + 30),
      contato: '62955551111',
      username: `prof.mat.${suf}`,
    });
    const turmaA = await criarTurmaApi(request, headers, {
      descricao: `Turma Atual ${suf}`,
      dias_semana: ['SEG'],
      horario_inicio: '09:00:00',
      horario_fim: '10:00:00',
      id_modalidade: mod.id_modalidade,
      id_professor: prof.id_professor,
    });
    const turmaB = await criarTurmaApi(request, headers, {
      descricao: `Turma Livre ${suf}`,
      dias_semana: ['QUI'],
      horario_inicio: '09:00:00',
      horario_fim: '10:00:00',
      id_modalidade: mod.id_modalidade,
      id_professor: prof.id_professor,
    });
    const aluno = await criarAlunoApi(request, headers, `Aluno Matrícula ${suf}`, turmaA.id_turma);

    await authenticateDirectly(page);
    await page.goto('/dashboard/matriculas');

    await page.getByRole('button', { name: `Matricular ${aluno.nome_completo}` }).click();
    const dialogo = page.getByRole('dialog');

    const itemAtual = dialogo.locator('li', { hasText: turmaA.descricao });
    await expect(itemAtual.getByRole('button', { name: 'Já matriculado' })).toBeDisabled();

    const itemLivre = dialogo.locator('li', { hasText: turmaB.descricao });
    await expect(itemLivre.getByRole('button', { name: 'Matricular' })).toBeEnabled();

    await request.delete(`${API_E2E}/alunos/${aluno.id_aluno}`, { headers });
    await request.delete(`${API_E2E}/turmas/${turmaA.id_turma}`, { headers });
    await request.delete(`${API_E2E}/turmas/${turmaB.id_turma}`, { headers });
    await request.delete(`${API_E2E}/professores/${prof.id_professor}`, { headers });
    await request.delete(`${API_E2E}/modalidades/${mod.id_modalidade}`, { headers });
  });
});

test.describe('Usuários (RT06)', () => {
  test('PD-RT06-01 e PD-RT06-03: editar perfil e ocultar Excluir na própria conta', async ({
    page,
    request,
  }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const username = `assist.rt06.${suf}`;
    const resUser = await request.post(`${API_E2E}/register`, {
      headers,
      data: { username, password: 'user123', role: 'assistente' },
    });
    expect(resUser.ok()).toBeTruthy();
    const criado = await resUser.json();

    await authenticateDirectly(page);
    await page.goto('/dashboard/usuarios');

    // PD-RT06-03: própria conta (admin) não tem botão de ações / Excluir
    const linhaAdmin = page.locator('tbody tr', { hasText: 'Você' }).first();
    await expect(linhaAdmin).toBeVisible();
    await expect(linhaAdmin).toContainText('admin');
    await expect(linhaAdmin.getByRole('button', { name: /mais ações/i })).toHaveCount(0);

    // PD-RT06-01: alterar perfil do usuário criado
    await page.getByRole('button', { name: `Mais ações para ${username}` }).click();
    await page.getByRole('menuitem', { name: 'Alterar perfil' }).click();
    await page.getByLabel('Perfil de acesso').selectOption('coordenador');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();

    await expect(page.locator('tbody tr', { hasText: username })).toContainText('Coordenador');

    await request.delete(`${API_E2E}/users/${criado.id_usuario}`, { headers });
  });

  test('DF-RT06-02 e PD-RT06-04: coordenador vê Usuários e só cria professor ou assistente', async ({
    page,
  }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });
    await page.goto('/dashboard/usuarios');

    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();

    await page.getByRole('link', { name: 'Novo usuário' }).click();
    await expect(page).toHaveURL(/\/dashboard\/usuarios\/novo/);

    const opcoes = await page.getByLabel('Perfil de acesso').locator('option').allInnerTexts();
    expect(opcoes).toEqual(['Professor', 'Assistente']);
  });
});

test.describe('Dashboard (RT07 e RT08)', () => {
  test('DF-RT07-01, PD-RT07-01, PD-RT07-02 e PD-RT08-01: modal de competição, rótulo Modalidades, links de alunos e gráfico acessível', async ({
    page,
    request,
  }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const mod = await criarModalidadeApi(request, headers, `Mod Dash ${suf}`);
    const prof = await criarProfessorApi(request, headers, {
      nome: `Prof Dash ${suf}`,
      cpf: gerarCpfValido(suf + 40),
      contato: '62944441111',
      username: `prof.dash.${suf}`,
    });
    const turma = await criarTurmaApi(request, headers, {
      descricao: `Turma Dash ${suf}`,
      dias_semana: ['SEX'],
      horario_inicio: '15:00:00',
      horario_fim: '16:00:00',
      id_modalidade: mod.id_modalidade,
      id_professor: prof.id_professor,
    });
    const aluno = await criarAlunoApi(request, headers, `Aluno Recente ${suf}`, turma.id_turma);

    await authenticateDirectly(page);
    await page.goto('/dashboard');

    // PD-RT07-01: rótulo "Modalidades"
    await expect(page.getByText('Modalidades', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Modalidades ativas')).toHaveCount(0);

    // PD-RT07-02: aluno recente é link clicável
    const linkAluno = page.getByRole('link', { name: aluno.nome_completo });
    await expect(linkAluno).toBeVisible();
    await expect(linkAluno).toHaveAttribute('href', `/dashboard/alunos/${aluno.id_aluno}`);

    // PD-RT08-01: gráfico tem aria-label e nenhuma parada de Tab sem nome dentro do gráfico
    const grafico = page.getByRole('img', { name: /gráfico de alunos por modalidade/i });
    await expect(grafico).toBeVisible();
    const focaveisSemNome = await grafico.evaluate((el) => {
      const nos = el.querySelectorAll('[tabindex]');
      return Array.from(nos).filter((n) => {
        const ti = Number(n.getAttribute('tabindex'));
        const nome = n.getAttribute('aria-label') || n.textContent?.trim();
        return ti >= 0 && !nome;
      }).length;
    });
    expect(focaveisSemNome).toBe(0);

    // DF-RT07-01: "Nova competição" abre o modal diretamente
    await page.getByRole('button', { name: /nova competição/i }).click();
    await expect(page.getByRole('dialog', { name: /nova competição/i })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await request.delete(`${API_E2E}/alunos/${aluno.id_aluno}`, { headers });
    await request.delete(`${API_E2E}/turmas/${turma.id_turma}`, { headers });
    await request.delete(`${API_E2E}/professores/${prof.id_professor}`, { headers });
    await request.delete(`${API_E2E}/modalidades/${mod.id_modalidade}`, { headers });
  });

  test('DF-RT07-02 e DF-RT07-03: professor não vê ações de cadastro e Fazer chamada abre aba Frequência', async ({
    page,
    request,
  }) => {
    const headers = await obterHeaders(request);
    const suf = Date.now();
    const mod = await criarModalidadeApi(request, headers, `Mod ProfDash ${suf}`);
    const username = `prof.rt07.${suf}`;
    const prof = await criarProfessorApi(request, headers, {
      nome: `Prof RT07 ${suf}`,
      cpf: gerarCpfValido(suf + 50),
      contato: '62933331111',
      username,
      password: 'temp123',
    });
    await trocarSenhaPrimeiroAcesso(request, username, 'temp123', 'prof123');
    const turma = await criarTurmaApi(request, headers, {
      descricao: `Turma Chamada ${suf}`,
      dias_semana: ['SEG', 'QUA', 'SEX'],
      horario_inicio: '16:00:00',
      horario_fim: '17:00:00',
      id_modalidade: mod.id_modalidade,
      id_professor: prof.id_professor,
    });

    await authenticateDirectly(page, { username, password: 'prof123' });
    await page.goto('/dashboard');

    // DF-RT07-03: sem ações de cadastro no dashboard do professor
    await expect(page.getByRole('heading', { name: 'Área do professor' })).toBeVisible();
    await expect(page.getByText('Novo aluno')).toHaveCount(0);
    await expect(page.getByText('Nova turma')).toHaveCount(0);
    await expect(page.getByText('Nova competição')).toHaveCount(0);

    // DF-RT07-02: "Fazer chamada" abre a aba Frequência diretamente
    await page.getByRole('link', { name: 'Fazer chamada' }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/turmas/${turma.id_turma}\\?aba=frequencia`));
    await expect(page.getByRole('tab', { name: 'Frequência' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Controle de Frequência')).toBeVisible();

    // DF-RT07-03 também na lista de turmas: sem botão "Nova turma"
    await page.goto('/dashboard/turmas');
    await expect(page.getByRole('link', { name: 'Nova turma' })).toHaveCount(0);

    await request.delete(`${API_E2E}/turmas/${turma.id_turma}`, { headers });
    await request.delete(`${API_E2E}/professores/${prof.id_professor}`, { headers });
    await request.delete(`${API_E2E}/modalidades/${mod.id_modalidade}`, { headers });
  });
});
