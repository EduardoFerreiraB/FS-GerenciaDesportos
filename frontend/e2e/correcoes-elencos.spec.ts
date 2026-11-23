import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E, BANCO_E2E_URL } from './helpers/ambiente';

test.describe('Correções de Equipes e Elencos (RT11)', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const authRes = await request.post(`${API_E2E}/token`, {
      form: {
        username: 'coordenador',
        password: 'coord123',
      },
    });
    if (!authRes.ok()) {
      throw new Error(`Falha no login do coordenador: ${authRes.status()} ${await authRes.text()}`);
    }
    const data = await authRes.json();
    token = data.access_token;
  });

  async function obterIdModalidade(request: any): Promise<number> {
    const res = await request.get(`${API_E2E}/modalidades/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok()) {
      const modalidades = await res.json();
      if (Array.isArray(modalidades) && modalidades.length > 0) {
        return modalidades[0].id_modalidade;
      }
    }
    return 1;
  }

  async function criarEdicaoTeste(request: any, nome: string, identificacao = '2026'): Promise<number> {
    const timestamp = Date.now();
    const idModalidade = await obterIdModalidade(request);
    const res = await request.post(`${API_E2E}/competicoes/competicoes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nome: `${nome} ${timestamp}`,
        id_modalidade: idModalidade,
        edicao: {
          identificacao,
          data_inicio: '2026-05-01',
          data_fim: '2026-06-30',
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
    expect(res.ok()).toBeTruthy();
    const comp = await res.json();
    return comp.edicoes[0].id_edicao_competicao as number;
  }

  async function obterOuCriarAlunoTeste(request: any, nome: string) {
    const res = await request.get(`${API_E2E}/alunos/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok()) {
      const alunos = await res.json();
      const existente = alunos.find((a: any) => a.nome_completo === nome);
      if (existente) return existente;
    }

    execSync(
      `.venv/bin/python -c "
import sys; sys.path.insert(0, 'app')
from datetime import date
from database import SessionLocal; import models
with SessionLocal() as db:
    part = models.Participante(tipo='aluno'); db.add(part); db.flush()
    aluno = models.Aluno(
        id_participante=part.id_participante,
        nome_completo='${nome}',
        data_nascimento=date(2008, 6, 15),
        escola='Escola Teste RT11',
        serie_ano='9º ano',
        nome_mae='Responsável Teste',
        telefone_1='11999997777',
        endereco='Rua Teste 123'
    )
    db.add(aluno); db.commit()
"`,
      { cwd: '..', env: { ...process.env, DATABASE_URL: BANCO_E2E_URL } },
    );

    const res2 = await request.get(`${API_E2E}/alunos/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const alunos2 = await res2.json();
    return alunos2.find((a: any) => a.nome_completo === nome) ?? alunos2[alunos2.length - 1];
  }

  test('DF-RT11-01: inativar integrante pede confirmação e permite reativar', async ({ page, request }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const idEdicao = await criarEdicaoTeste(request, 'Copa Inativação RT11');
    const timestamp = Date.now();

    const eqRes = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Leões RT11', sigla: 'LEO' },
    });
    expect(eqRes.ok()).toBeTruthy();
    const equipe = await eqRes.json();

    const compRes = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: `Atleta Reativável ${timestamp}` },
    });
    expect(compRes.ok()).toBeTruthy();
    const competidor = await compRes.json();

    const intRes = await request.post(`${API_E2E}/competicoes/equipes/${equipe.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        id_competidor: competidor.id_competidor,
        nome_esportivo: competidor.nome,
        numero_camisa: 11,
        posicao: 'Ponta',
      },
    });
    expect(intRes.ok()).toBeTruthy();

    await page.goto(`/test-elencos?idEdicao=${idEdicao}`);
    await page.getByText('Leões RT11').click();
    await expect(page.getByRole('dialog', { name: 'Leões RT11' })).toBeVisible();

    // Abre detalhes do integrante
    await page.getByRole('button', { name: new RegExp(competidor.nome) }).click();
    await expect(page.getByRole('dialog', { name: 'Detalhes do Integrante' })).toBeVisible();

    // 1. Clicar em inativar deve abrir confirmação (não inativa direto)
    await page.getByRole('button', { name: /inativar integrante da equipe/i }).click();
    const confirmDialog = page.getByRole('dialog', { name: /inativar integrante\?/i });
    await expect(confirmDialog).toBeVisible();

    // Cancelar mantém o integrante ativo
    await confirmDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(confirmDialog).toHaveCount(0);
    await expect(
      page.getByRole('dialog', { name: 'Detalhes do Integrante' }).getByText('Ativo', { exact: true }),
    ).toBeVisible();

    // 2. Confirmar inativação
    await page.getByRole('button', { name: /inativar integrante da equipe/i }).click();
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByTestId('btn-confirmar-exclusao').click();

    // Volta para o elenco com o integrante inativo
    const gavetaElenco = page.getByRole('dialog', { name: 'Leões RT11' });
    await expect(gavetaElenco).toBeVisible();
    await expect(gavetaElenco.getByText('Inativo', { exact: true })).toBeVisible();
    await expect(gavetaElenco.getByText(/0 ativos/i)).toBeVisible();

    // 3. Reabrir integrante inativo e reativar
    await gavetaElenco.getByRole('button', { name: new RegExp(competidor.nome) }).click();
    const botaoReativar = page.getByRole('button', { name: /reativar integrante/i });
    await expect(botaoReativar).toBeVisible();
    await botaoReativar.click();

    // Volta para o elenco com o integrante ativo novamente
    await expect(gavetaElenco).toBeVisible();
    await expect(gavetaElenco.getByText('Ativo', { exact: true })).toBeVisible();
    await expect(gavetaElenco.getByText(/1 ativo/i)).toBeVisible();
  });

  test('PD-RT11-01: busca de competidor e importação de aluno marcam Já inscrito e desabilitam inscrição', async ({
    page,
    request,
  }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const idEdicao = await criarEdicaoTeste(request, 'Copa Já Inscrito RT11');
    const timestamp = Date.now();

    const eq1Res = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Equipe Origem RT11', sigla: 'ORI' },
    });
    const eq1 = await eq1Res.json();

    const eq2Res = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Equipe Destino RT11', sigla: 'DES' },
    });
    expect(eq2Res.ok()).toBeTruthy();

    // Cria terceiro e inscreve na Equipe Origem
    const compTerceiroRes = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: `Terceiro Já Inscrito ${timestamp}` },
    });
    const compTerceiro = await compTerceiroRes.json();
    await request.post(`${API_E2E}/competicoes/equipes/${eq1.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        id_competidor: compTerceiro.id_competidor,
        nome_esportivo: compTerceiro.nome,
        numero_camisa: 5,
      },
    });

    // Cria/obtém aluno, importa como competidor e inscreve na Equipe Origem
    const aluno = await obterOuCriarAlunoTeste(request, `Aluno Já Inscrito ${timestamp}`);
    const impRes = await request.post(`${API_E2E}/competicoes/competidores/importar-aluno`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { id_aluno: aluno.id_aluno },
    });
    const compAluno = await impRes.json();
    await request.post(`${API_E2E}/competicoes/equipes/${eq1.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        id_competidor: compAluno.id_competidor,
        nome_esportivo: compAluno.nome,
        numero_camisa: 9,
      },
    });

    // Abre a Equipe Destino e tenta adicionar integrante
    await page.goto(`/test-elencos?idEdicao=${idEdicao}`);
    await page.getByText('Equipe Destino RT11').click();
    await page.getByRole('button', { name: /adicionar integrante na equipe equipe destino rt11/i }).click();

    // 1. Busca de competidor marca "Já inscrito" e desabilita seleção
    await page.getByPlaceholder(/buscar competidor/i).fill(compTerceiro.nome);
    await expect(page.getByText(compTerceiro.nome)).toBeVisible();
    const btnJaInscritoBusca = page.getByRole('button', {
      name: `${compTerceiro.nome} já inscrito nesta edição`,
    });
    await expect(btnJaInscritoBusca).toBeVisible();
    await expect(btnJaInscritoBusca).toBeDisabled();

    // 2. Importação de aluno marca "Já inscrito" e desabilita importação
    await page.getByRole('tab', { name: /importar aluno/i }).click();
    await page.getByPlaceholder(/buscar aluno/i).fill(aluno.nome_completo);
    await expect(page.getByText(aluno.nome_completo)).toBeVisible();
    const btnJaInscritoAluno = page.getByRole('button', {
      name: `${aluno.nome_completo} já inscrito nesta edição`,
    });
    await expect(btnJaInscritoAluno).toBeVisible();
    await expect(btnJaInscritoAluno).toBeDisabled();
  });

  test('PD-RT11-03: renomeia competidor na busca e exibe campos editáveis de camisa e posição', async ({
    page,
    request,
  }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const idEdicao = await criarEdicaoTeste(request, 'Copa Edição RT11');
    const timestamp = Date.now();

    const eqRes = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Águias RT11', sigla: 'AGU' },
    });
    const equipe = await eqRes.json();

    const nomeOriginal = `Competidor Original ${timestamp}`;
    const nomeAtualizado = `Competidor Renomeado ${timestamp}`;
    const compRes = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: nomeOriginal },
    });
    const competidor = await compRes.json();

    await request.post(`${API_E2E}/competicoes/equipes/${equipe.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        id_competidor: competidor.id_competidor,
        nome_esportivo: nomeOriginal,
        numero_camisa: 10,
        posicao: 'Meia',
      },
    });

    await page.goto(`/test-elencos?idEdicao=${idEdicao}`);
    await page.getByText('Águias RT11').click();

    // 1. Renomear competidor via BuscaCompetidor (PATCH /competicoes/competidores/{id})
    await page.getByRole('button', { name: /adicionar integrante na equipe águias rt11/i }).click();
    await page.getByPlaceholder(/buscar competidor/i).fill(nomeOriginal);
    await expect(page.getByText(nomeOriginal)).toBeVisible();

    await page.getByRole('button', { name: `Renomear competidor ${nomeOriginal}` }).click();
    const inputNovoNome = page.getByLabel(`Novo nome de ${nomeOriginal}`);
    await inputNovoNome.fill(nomeAtualizado);
    await page.getByRole('button', { name: 'Salvar nome do competidor' }).click();

    await expect(page.getByText(nomeAtualizado)).toBeVisible();

    // Confirma persistência na API
    const checkRes = await request.get(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { busca: nomeAtualizado },
    });
    expect(checkRes.ok()).toBeTruthy();
    const checkData = await checkRes.json();
    expect(checkData.itens.some((c: any) => c.id_competidor === competidor.id_competidor && c.nome === nomeAtualizado)).toBeTruthy();

    // 2. Fecha gaveta de adicionar, volta ao elenco e verifica campos editáveis de camisa e posição
    await page.getByRole('button', { name: 'Cancelar' }).click();
    const gavetaElenco = page.getByRole('dialog', { name: 'Águias RT11' });
    await expect(gavetaElenco).toBeVisible();
    await gavetaElenco.getByRole('button', { name: new RegExp(nomeOriginal) }).click();

    const inputNomeEsp = page.getByLabel(/nome esportivo/i);
    const inputCamisa = page.getByLabel(/número da camisa/i);
    const inputPosicao = page.getByLabel(/posição/i);
    const btnSalvarEdicao = page.getByRole('button', { name: /salvar alterações/i });

    await expect(inputCamisa).toHaveValue('10');
    await expect(inputPosicao).toHaveValue('Meia');
    await expect(btnSalvarEdicao).toBeDisabled();

    await inputNomeEsp.fill('Craque Atualizado RT11');
    await inputCamisa.fill('22');
    await inputPosicao.fill('Zagueiro');
    await expect(btnSalvarEdicao).toBeEnabled();
    await btnSalvarEdicao.click();

    // Volta ao elenco com os dados persistidos
    await expect(gavetaElenco).toBeVisible();
    await expect(gavetaElenco.getByText('Craque Atualizado RT11')).toBeVisible();
    await expect(gavetaElenco.getByText(/#?22\b/)).toBeVisible();
    await expect(gavetaElenco.getByText(/Zagueiro/)).toBeVisible();

    // Fecha elenco e edita nome e sigla da equipe (PATCH /equipes/{id})
    await gavetaElenco.getByRole('button', { name: /fechar/i }).click();
    await page.getByTestId(`btn-acoes-equipe-${equipe.id_equipe}`).click();
    await page.getByTestId(`btn-editar-equipe-${equipe.id_equipe}`).click();
    const dialogEditarEq = page.getByRole('dialog', { name: /editar equipe/i });
    await expect(dialogEditarEq).toBeVisible();
    await dialogEditarEq.getByLabel(/nome da equipe/i).fill('Águias Renomeadas RT11');
    await dialogEditarEq.getByLabel(/sigla/i).fill('AGR');
    await dialogEditarEq.getByRole('button', { name: /salvar alterações/i }).click();

    await expect(page.getByText('Equipe atualizada com sucesso.')).toBeVisible();
    await expect(page.getByText('Águias Renomeadas RT11')).toBeVisible();
    await expect(page.getByText('AGR', { exact: true })).toBeVisible();
  });

  test('DF-RT11-02 e PD-RT11-02: copiar elenco escolhe edição pelo nome e copia apenas integrantes ativos', async ({
    page,
    request,
  }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const ts = Date.now();
    const nomeComp = `Copa Cópia RT11 ${ts}`;
    const idEdicaoOrigem = await criarEdicaoTeste(request, nomeComp, '2026');
    const idEdicaoDestino = await criarEdicaoTeste(request, `Copa Destino RT11 ${ts}`, '2027');

    const eqRes = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicaoOrigem}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Falcões Origem', sigla: 'FAL' },
    });
    const equipe = await eqRes.json();

    const cAtivo = await (
      await request.post(`${API_E2E}/competicoes/competidores`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { nome: `Ativo Cópia ${ts}` },
      })
    ).json();
    const cInativo = await (
      await request.post(`${API_E2E}/competicoes/competidores`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { nome: `Inativo Cópia ${ts}` },
      })
    ).json();

    await request.post(`${API_E2E}/competicoes/equipes/${equipe.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { id_competidor: cAtivo.id_competidor, nome_esportivo: 'Atleta Ativo RT11', numero_camisa: 7 },
    });
    const intInativo = await (
      await request.post(`${API_E2E}/competicoes/equipes/${equipe.id_equipe}/integrantes`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { id_competidor: cInativo.id_competidor, nome_esportivo: 'Atleta Inativo RT11', numero_camisa: 8 },
      })
    ).json();
    await request.patch(`${API_E2E}/competicoes/integrantes/${intInativo.id_integrante}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { situacao: 'INATIVO' },
    });

    await page.goto(`/test-elencos?idEdicao=${idEdicaoDestino}`);
    await page.getByRole('button', { name: /copiar elenco/i }).click();

    const dialogCopiar = page.getByRole('dialog', { name: /copiar elenco/i });
    await expect(dialogCopiar).toBeVisible();
    // Não deve existir campo de ID numérico
    await expect(dialogCopiar.locator('input[type="number"]')).toHaveCount(0);

    const selectOrigem = dialogCopiar.getByTestId('select-origem-copia');
    await expect(selectOrigem).toBeVisible();
    await expect(selectOrigem.locator(`option[value="${idEdicaoOrigem}"]`)).toContainText(nomeComp);
    await selectOrigem.selectOption(String(idEdicaoOrigem));
    await dialogCopiar.getByRole('button', { name: /confirmar cópia/i }).click();

    await expect(page.getByText('Elencos copiados com sucesso.')).toBeVisible();
    await expect(page.getByText('Falcões Origem')).toBeVisible();
    // Apenas o integrante ativo deve ter sido copiado
    await expect(page.getByText(/1 atleta · 1 ativo/i)).toBeVisible();
  });
});
