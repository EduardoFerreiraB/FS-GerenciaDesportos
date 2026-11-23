import { test, expect, APIRequestContext } from '@playwright/test';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E } from './helpers/ambiente';

// PNG válido 1x1 pixel (transparente)
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

// PDF mínimo válido
const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'utf-8',
);

let seq = 1;
function proximoId(): number {
  seq += 1;
  return Date.now() + seq;
}

function gerarCpfValido(semente: number): string {
  const base = String(semente).replace(/\D/g, '').padStart(9, '1').slice(-9);
  const nums = base.split('').map(Number);
  const calc = (slice: number[]) => {
    const soma = slice.reduce((acc, n, i) => acc + n * (slice.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calc(nums);
  const d2 = calc([...nums, d1]);
  return `${base}${d1}${d2}`;
}

async function obterHeadersAdmin(request: APIRequestContext) {
  const resp = await request.post(`${API_E2E}/token`, {
    form: { username: 'admin', password: 'admin123' },
  });
  expect(resp.ok()).toBeTruthy();
  const { access_token } = await resp.json();
  return { Authorization: `Bearer ${access_token as string}` };
}

async function criarDuasTurmasSemConflito(request: APIRequestContext, headers: Record<string, string>) {
  const n = proximoId();
  const modalidades = await (await request.get(`${API_E2E}/modalidades/`, { headers })).json();
  const idModalidade = modalidades[0].id_modalidade as number;

  const profResp = await request.post(`${API_E2E}/professores/`, {
    headers,
    data: {
      nome: `Prof Alunos ${n}`,
      cpf: gerarCpfValido(n),
      contato: '62999990000',
      username: `prof_alunos_${n}`,
      password: 'Password123',
    },
  });
  expect(profResp.status()).toBe(201);
  const prof = await profResp.json();

  const turma1Resp = await request.post(`${API_E2E}/turmas/`, {
    headers,
    data: {
      descricao: `Turma Futebol ${n}`,
      categoria_idade: 'Sub-14',
      horario_inicio: '08:00:00',
      horario_fim: '09:30:00',
      dias_semana: ['SEG', 'QUA'],
      id_modalidade: idModalidade,
      id_professor: prof.id_professor,
    },
  });
  expect(turma1Resp.status()).toBe(201);
  const turma1 = await turma1Resp.json();

  const turma2Resp = await request.post(`${API_E2E}/turmas/`, {
    headers,
    data: {
      descricao: `Turma Basquete ${n}`,
      categoria_idade: 'Sub-14',
      horario_inicio: '15:00:00',
      horario_fim: '16:30:00',
      dias_semana: ['TER', 'QUI'],
      id_modalidade: idModalidade,
      id_professor: prof.id_professor,
    },
  });
  expect(turma2Resp.status()).toBe(201);
  const turma2 = await turma2Resp.json();

  return { turma1, turma2 };
}

async function criarAlunoViaApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  opts: {
    nome: string;
    idsTurmas: number[];
    comFoto?: boolean;
    nomePai?: string;
    telefone1?: string;
    telefone2?: string;
    recomendacoes?: string;
  },
) {
  const multipart: Record<string, any> = {
    nome_completo: opts.nome,
    data_nascimento: '2013-05-10',
    escola: 'Escola Municipal Teste',
    serie_ano: '7º Ano',
    nome_mae: 'Maria Responsável',
    telefone_1: opts.telefone1 ?? '62999991234',
    endereco: 'Rua das Flores, 100',
    ids_turmas: opts.idsTurmas.join(','),
    documento: {
      name: 'documento.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_MINIMO,
    },
    atestado: {
      name: 'atestado.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_MINIMO,
    },
  };
  if (opts.nomePai) multipart.nome_pai = opts.nomePai;
  if (opts.telefone2) multipart.telefone_2 = opts.telefone2;
  if (opts.recomendacoes) multipart.recomendacoes_medicas = opts.recomendacoes;
  if (opts.comFoto) {
    multipart.foto = {
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    };
  }

  const resp = await request.post(`${API_E2E}/alunos/`, {
    headers,
    multipart,
  });
  expect(resp.status()).toBe(201);
  return resp.json();
}

test('botão do topo diz "Novo aluno" e não "Nova matrícula"', async ({ page }) => {
  await authenticateDirectly(page);
  await page.goto('/dashboard/alunos');

  await expect(page.getByRole('link', { name: 'Novo aluno' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nova matrícula' })).toHaveCount(0);
});

test('turma e documentos são validados como obrigatórios antes do envio', async ({ page, request }) => {
  const headers = await obterHeadersAdmin(request);
  await criarDuasTurmasSemConflito(request, headers);

  await authenticateDirectly(page);
  await page.goto('/dashboard/alunos/novo');

  let requisicoesPost = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/alunos')) {
      requisicoesPost += 1;
    }
  });

  await page.getByLabel(/Nome completo/i).fill(`Aluno Validação ${proximoId()}`);
  await page.getByLabel(/Data de nascimento/i).fill('2014-03-15');
  await page.getByLabel(/^Escola/i).fill('Escola Estadual');
  await page.getByLabel(/Série \/ Ano/i).fill('6º Ano');
  await page.getByLabel(/Nome da mãe/i).fill('Ana Souza');
  await page.getByLabel(/Telefone 1/i).fill('62999991234');
  await page.getByLabel(/Endereço completo/i).fill('Av. Brasil, 200');

  await page.getByRole('button', { name: 'Cadastrar aluno' }).click();

  await expect(page.getByText('Atestado médico é obrigatório.')).toBeVisible();
  await expect(page.getByText('Documento pessoal é obrigatório.')).toBeVisible();
  await expect(page.getByText('Selecione pelo menos uma turma.')).toBeVisible();
  expect(requisicoesPost).toBe(0);
});

test('telefone formatado (62) 99999-1234 no formulário e na lista, foto ou iniciais e URL da API sem localhost:8000 fixo', async ({
  page,
  request,
}) => {
  const headers = await obterHeadersAdmin(request);
  const { turma1 } = await criarDuasTurmasSemConflito(request, headers);
  const n = proximoId();
  const nomeComFoto = `Carlos Foto ${n}`;
  const nomeSemFoto = `Bruno SemFoto ${n}`;

  await criarAlunoViaApi(request, headers, {
    nome: nomeComFoto,
    idsTurmas: [turma1.id_turma],
    comFoto: true,
    telefone1: '62999991234',
  });
  await criarAlunoViaApi(request, headers, {
    nome: nomeSemFoto,
    idsTurmas: [turma1.id_turma],
    comFoto: false,
    telefone1: '6233334444',
  });

  await authenticateDirectly(page);
  await page.goto('/dashboard/alunos');

  const linhaComFoto = page.getByRole('row', { name: new RegExp(nomeComFoto) });
  await expect(linhaComFoto).toBeVisible();
  await expect(linhaComFoto).toContainText('(62) 99999-1234');

  const imgFoto = linhaComFoto.locator('img');
  await expect(imgFoto).toBeVisible();
  const src = await imgFoto.getAttribute('src');
  expect(src).toBeTruthy();
  expect(src).toContain(API_E2E);
  expect(src).not.toContain('http://localhost:8000');

  const linhaSemFoto = page.getByRole('row', { name: new RegExp(nomeSemFoto) });
  await expect(linhaSemFoto).toBeVisible();
  await expect(linhaSemFoto).toContainText('(62) 3333-4444');
  await expect(linhaSemFoto.locator('img')).toHaveCount(0);
  await expect(linhaSemFoto).toContainText('BS');

  // Conferir máscara no formulário de novo aluno
  await page.goto('/dashboard/alunos/novo');
  const telInput = page.getByLabel(/Telefone 1/i);
  await telInput.fill('62999991234');
  await expect(telInput).toHaveValue('(62) 99999-1234');
});

test('edição mostra e salva turmas, permite cancelar matrícula, remove foto e apaga campo opcional', async ({
  page,
  request,
}) => {
  const headers = await obterHeadersAdmin(request);
  const { turma1, turma2 } = await criarDuasTurmasSemConflito(request, headers);
  const n = proximoId();
  const nome = `Lucas Edição ${n}`;

  const aluno = await criarAlunoViaApi(request, headers, {
    nome,
    idsTurmas: [turma1.id_turma],
    comFoto: true,
    nomePai: 'José Pai Antigo',
    telefone1: '62999991234',
    telefone2: '62988887777',
    recomendacoes: 'Alergia a poeira',
  });

  await authenticateDirectly(page);
  await page.goto(`/dashboard/alunos/${aluno.id_aluno}`);

  // Telefones formatados ao carregar edição
  await expect(page.getByLabel(/Telefone 1/i)).toHaveValue('(62) 99999-1234');
  await expect(page.getByLabel(/Telefone 2/i)).toHaveValue('(62) 98888-7777');

  // Foto carregada com API_E2E (sem localhost:8000 fixo)
  const previewImg = page.getByAltText('Pré-visualização da foto');
  await expect(previewImg).toBeVisible();
  const previewSrc = await previewImg.getAttribute('src');
  expect(previewSrc).toContain(API_E2E);
  expect(previewSrc).not.toContain('http://localhost:8000');

  // Turma 1 aparece pré-marcada; marcar turma 2
  const cbTurma1 = page.getByLabel(new RegExp(turma1.descricao));
  const cbTurma2 = page.getByLabel(new RegExp(turma2.descricao));
  await expect(cbTurma1).toBeChecked();
  await expect(cbTurma2).not.toBeChecked();
  await cbTurma2.check();

  // Remover foto e apagar campos opcionais
  await page.getByRole('button', { name: 'Remover foto' }).click();
  await expect(page.getByAltText('Pré-visualização da foto')).toHaveCount(0);
  await page.getByLabel(/Nome do pai/i).fill('');
  await page.getByLabel(/Telefone 2/i).fill('');
  await page.getByLabel(/Recomendações médicas/i).fill('');

  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page).toHaveURL(/\/dashboard\/alunos$/);

  // Recarregar a edição e confirmar que tudo persistiu
  await page.goto(`/dashboard/alunos/${aluno.id_aluno}`);
  await expect(page.getByAltText('Pré-visualização da foto')).toHaveCount(0);
  await expect(page.getByLabel(/Nome do pai/i)).toHaveValue('');
  await expect(page.getByLabel(/Telefone 2/i)).toHaveValue('');
  await expect(page.getByLabel(/Recomendações médicas/i)).toHaveValue('');
  await expect(page.getByLabel(new RegExp(turma1.descricao))).toBeChecked();
  await expect(page.getByLabel(new RegExp(turma2.descricao))).toBeChecked();

  // Cancelar matrícula da turma 2 pela tela do aluno
  const itemTurma2 = page.locator('li', { hasText: turma2.descricao });
  await itemTurma2.getByRole('button', { name: 'Cancelar matrícula' }).click();
  await page.getByTestId('btn-confirmar-exclusao').click();

  await expect(page.locator('li', { hasText: turma2.descricao })).toHaveCount(0);
  await expect(page.getByLabel(new RegExp(turma2.descricao))).not.toBeChecked();

  // Confirmar persistência após recarregar
  await page.reload();
  await expect(page.getByLabel(new RegExp(turma1.descricao))).toBeChecked();
  await expect(page.getByLabel(new RegExp(turma2.descricao))).not.toBeChecked();
});

test('diálogo de exclusão mostra matrículas e presenças e excluir com busca ativa mantém lista consistente', async ({
  page,
  request,
}) => {
  const headers = await obterHeadersAdmin(request);
  const { turma1 } = await criarDuasTurmasSemConflito(request, headers);
  const n = proximoId();
  const nomeExcluir = `Zeca Excluir ${n}`;
  const nomeManter = `Helena Manter ${n}`;

  const alunoExcluir = await criarAlunoViaApi(request, headers, {
    nome: nomeExcluir,
    idsTurmas: [turma1.id_turma],
  });
  await criarAlunoViaApi(request, headers, {
    nome: nomeManter,
    idsTurmas: [turma1.id_turma],
  });

  // Registrar 1 presença para o aluno que será excluído
  const idMatricula = alunoExcluir.matriculas[0].id_matricula as number;
  const presResp = await request.post(`${API_E2E}/presencas/lote`, {
    headers,
    data: {
      data_aula: '2026-11-20',
      id_turma: turma1.id_turma,
      presencas: [{ id_matricula: idMatricula, status: 'Presente' }],
    },
  });
  expect(presResp.status()).toBe(201);

  await authenticateDirectly(page);
  await page.goto('/dashboard/alunos');

  // Filtrar pelo aluno a excluir
  const campoBusca = page.getByLabel('Buscar aluno por nome');
  await campoBusca.fill(nomeExcluir);
  await expect(page.getByRole('row', { name: new RegExp(nomeExcluir) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(nomeManter) })).toHaveCount(0);

  // Abrir diálogo de exclusão e conferir prévia (1 matrícula e 1 presença)
  await page.getByRole('button', { name: `Mais ações para ${nomeExcluir}` }).click();
  await page.getByRole('menuitem', { name: 'Excluir' }).click();

  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toContainText('1 matrícula');
  await expect(dialogo).toContainText('1 presença');

  await page.getByTestId('input-confirmacao-exclusao').fill(nomeExcluir);
  await page.getByTestId('btn-confirmar-exclusao').click();

  // Busca permanece ativa e aluno excluído desaparece
  await expect(campoBusca).toHaveValue(nomeExcluir);
  await expect(page.getByRole('row', { name: new RegExp(nomeExcluir) })).toHaveCount(0);
  await expect(page.getByText('Nenhum aluno encontrado')).toBeVisible();

  // Limpar a busca: os demais alunos continuam visíveis (não mostra lista vazia!)
  await campoBusca.fill('');
  await expect(page.getByRole('row', { name: new RegExp(nomeManter) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(nomeExcluir) })).toHaveCount(0);
});
