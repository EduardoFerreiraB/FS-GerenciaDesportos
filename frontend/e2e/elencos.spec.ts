import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { authenticateDirectly } from './helpers/auth';
import { API_E2E, BANCO_E2E_URL } from './helpers/ambiente';

test.describe('Gestão de Elencos e Equipes', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    // Obter token de coordenador para criação de dados de teste via API
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

  async function obterIdModalidade(request: any) {
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

  async function criarEdicaoTeste(request: any, nome: string, identificacao: string = '2026') {
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
      const existente = alunos.find((a: any) => a.nome_completo.includes(nome));
      if (existente) {
        return existente;
      }
    }

    // Se não houver, garante criação no banco ativo
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
        data_nascimento=date(2008, 5, 20),
        escola='Escola Municipal Sigilosa',
        serie_ano='9º ano',
        nome_mae='Mãe Privada',
        telefone_1='11999998888',
        endereco='Rua Secreta 456'
    )
    db.add(aluno); db.commit()
"`,
      // Sempre o banco E2E: sem DATABASE_URL o backend carregaria o .env (banco de desenvolvimento).
      { cwd: '..', env: { ...process.env, DATABASE_URL: BANCO_E2E_URL } }
    );

    const res2 = await request.get(`${API_E2E}/alunos/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const alunos2 = await res2.json();
    return alunos2[alunos2.length - 1];
  }

  test('cadastra terceiro, importa aluno e inscreve no elenco', async ({ page, request }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const idEdicao = await criarEdicaoTeste(request, 'Copa Integrantes');
    const aluno = await obterOuCriarAlunoTeste(request, 'Aluno Escolar Teste E2E');

    await page.goto(`/test-elencos?idEdicao=${idEdicao}`);

    // Cria uma equipe na edição
    await page.getByRole('button', { name: /nova equipe/i }).click();
    await page.getByLabel(/nome da equipe/i).fill('Falcões Dourados');
    await page.getByLabel(/sigla/i).fill('FAL');
    await page.getByRole('button', { name: /criar equipe/i }).click();

    // A equipe deve ser listada
    await expect(page.getByText('Falcões Dourados')).toBeVisible();

    // Abre o elenco da equipe (gaveta lateral)
    await page.getByText('Falcões Dourados').click();
    await expect(page.getByRole('dialog', { name: 'Falcões Dourados' })).toBeVisible();

    // 1. Cadastra competidor terceiro avulso (a gaveta de inscrição substitui a do elenco)
    await page.getByRole('button', { name: /adicionar integrante/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Aba de novo competidor terceiro
    await page.getByRole('button', { name: 'Novo Terceiro (Avulso)' }).click();

    const timestamp = Date.now();
    const nomeTerceiro = `Competidor Terceiro ${timestamp}`;
    await page.getByLabel(/nome do competidor/i).fill(nomeTerceiro);
    await page.getByRole('button', { name: /cadastrar e selecionar/i }).click();

    // Preenche dados do integrante
    await page.getByLabel(/número da camisa/i).fill('10');
    await page.getByLabel(/posição/i).fill('Meio-Campo');
    await page.getByRole('button', { name: 'Salvar' }).click();

    // Ao salvar, volta para o elenco atualizado: confere que o terceiro está lá
    await expect(page.getByText(nomeTerceiro)).toBeVisible();
    await expect(page.getByText(/#10/)).toBeVisible();

    // 2. Importa aluno da escola
    await page.getByRole('button', { name: /adicionar integrante/i }).click();
    await page.getByRole('tab', { name: /importar aluno/i }).or(
      page.getByText(/importar aluno/i)
    ).click();

    // Localiza o aluno na lista de alunos escolares
    await page.getByPlaceholder(/buscar aluno/i).fill(aluno.nome_completo);
    await page.getByRole('button', { name: /importar como competidor/i }).click();

    // Preenche dados do integrante para o aluno importado
    await page.getByLabel(/número da camisa/i).fill('7');
    await page.getByLabel(/posição/i).fill('Atacante');
    await page.getByRole('button', { name: 'Salvar' }).click();

    // Confere que ambos os integrantes aparecem no elenco
    await expect(page.getByText(aluno.nome_completo)).toBeVisible();

    // Regra crítica de privacidade: NÃO exibe dados escolares privados na tela esportiva
    await expect(page.getByText('Escola Municipal Sigilosa')).toHaveCount(0);
    await expect(page.getByText('Mãe Privada')).toHaveCount(0);
    await expect(page.getByText('Rua Secreta 456')).toHaveCount(0);
  });

  test('importar o mesmo aluno duas vezes não duplica', async ({ page, request }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const idEdicao = await criarEdicaoTeste(request, 'Copa Idempotência');
    const aluno = await obterOuCriarAlunoTeste(request, 'Aluno Repetido');

    await page.goto(`/test-elencos?idEdicao=${idEdicao}`);

    // Cria equipe
    await page.getByRole('button', { name: /nova equipe/i }).click();
    await page.getByLabel(/nome da equipe/i).fill('Time Idempotência');
    await page.getByRole('button', { name: /criar equipe/i }).click();

    await page.getByText('Time Idempotência').click();
    await page.getByRole('button', { name: /adicionar integrante/i }).click();
    await page.getByRole('tab', { name: /importar aluno/i }).or(
      page.getByText(/importar aluno/i)
    ).click();

    await page.getByPlaceholder(/buscar aluno/i).fill(aluno.nome_completo);
    // Primeira importação
    await page.getByRole('button', { name: /importar como competidor/i }).click();

    // Segunda tentativa de importação do mesmo aluno via API direta para validar idempotência
    const resSegunda = await request.post(`${API_E2E}/competicoes/competidores/importar-aluno`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { id_aluno: aluno.id_aluno },
    });
    // Deve retornar 200 OK reutilizando o mesmo competidor
    expect(resSegunda.status()).toBe(200);
    const comp2 = await resSegunda.json();
    expect(comp2.id_aluno_origem).toBe(aluno.id_aluno);
  });

  test('inscrever competidor já inscrito na edição mostra conflito', async ({ page, request }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const idEdicao = await criarEdicaoTeste(request, 'Copa Conflito');
    const timestamp = Date.now();

    // Cria competidor avulso via API
    const compRes = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: `Jogador Disputado ${timestamp}` },
    });
    const competidor = await compRes.json();

    // Cria duas equipes
    const eq1Res = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Equipe Azul' },
    });
    const eq1 = await eq1Res.json();

    const eq2Res = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Equipe Vermelha' },
    });
    const eq2 = await eq2Res.json();

    // Inscreve na Equipe Azul via API
    await request.post(`${API_E2E}/competicoes/equipes/${eq1.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        id_competidor: competidor.id_competidor,
        nome_esportivo: competidor.nome,
        numero_camisa: 10,
      },
    });

    // Tenta inscrever o mesmo competidor na Equipe Vermelha pela UI
    await page.goto(`/test-elencos?idEdicao=${idEdicao}`);
    await page.getByText('Equipe Vermelha').click();
    await page.getByRole('button', { name: /adicionar integrante na equipe equipe vermelha/i }).click();

    // Busca o competidor já inscrito: com PD-RT11-01 o botão fica marcado e desabilitado como "Já inscrito"
    await page.getByPlaceholder(/buscar competidor/i).fill(competidor.nome);
    const btnJaInscrito = page.getByRole('button', { name: new RegExp(`${competidor.nome} já inscrito`, 'i') });
    await expect(btnJaInscrito).toBeVisible();
    await expect(btnJaInscrito).toBeDisabled();
  });

  test('copiar elenco da edição anterior cria inscrições novas', async ({ page, request }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    // Cria edição anterior 2025
    const timestamp = Date.now();
    const idModalidade = await obterIdModalidade(request);
    const compRes = await request.post(`${API_E2E}/competicoes/competicoes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nome: `Torneio de Continuidade ${timestamp}`,
        id_modalidade: idModalidade,
        edicao: {
          identificacao: '2025',
          data_inicio: '2025-05-01',
          data_fim: '2025-06-30',
          formato: 'PONTOS_CORRIDOS',
          configuracao: {
            formato: 'PONTOS_CORRIDOS',
            pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
            desempates: ['SALDO_GOLS'],
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
    const comp = await compRes.json();
    const idEdicao2025 = comp.edicoes[0].id_edicao_competicao;

    // Cria equipe e integrante em 2025
    const eqRes = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao2025}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Gaviões Históricos', sigla: 'GAV' },
    });
    const eq2025 = await eqRes.json();

    const atletaRes = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: `Craque Antigo ${timestamp}` },
    });
    const atleta = await atletaRes.json();

    await request.post(`${API_E2E}/competicoes/equipes/${eq2025.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        id_competidor: atleta.id_competidor,
        nome_esportivo: atleta.nome,
        numero_camisa: 9,
      },
    });

    // Cria edição 2026 na mesma competição
    const ed2026Res = await request.post(`${API_E2E}/competicoes/competicoes/${comp.id_competicao}/edicoes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        identificacao: '2026',
        data_inicio: '2026-05-01',
        data_fim: '2026-06-30',
        formato: 'PONTOS_CORRIDOS',
        configuracao: {
          formato: 'PONTOS_CORRIDOS',
          pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
          desempates: ['SALDO_GOLS'],
          disciplina: {
            limite_amarelos: 3,
            jogos_por_acumulo: 1,
            jogos_por_vermelho: 1,
            jogos_por_segundo_amarelo: 1,
            zerar_amarelos_ao_encerrar_grupos: false,
          },
        },
      },
    });
    const ed2026 = await ed2026Res.json();
    const idEdicao2026 = ed2026.id_edicao_competicao;

    // Acessa a edição 2026 (em RASCUNHO) e usa "Copiar Elenco"
    await page.goto(`/test-elencos?idEdicao=${idEdicao2026}`);
    await page.getByRole('button', { name: /copiar elenco/i }).click();

    // Modal de cópia de elenco (DF-RT11-02 / PD-RT11-02: seleção por nome e só ativos)
    await expect(page.getByRole('dialog', { name: /copiar elenco/i })).toBeVisible();
    await expect(
      page.getByText(/apenas equipes e integrantes ativos|partidas e punições não são copiados/i)
    ).toBeVisible();

    // Seleciona a edição de origem (2025) pelo seletor de nome
    await page.getByTestId('select-origem-copia').selectOption(String(idEdicao2025));
    await page.getByRole('button', { name: /confirmar cópia/i }).click();

    // A equipe copiada deve aparecer na lista
    await expect(page.getByText('Gaviões Históricos')).toBeVisible();

    // Abre o elenco da equipe e confere o atleta copiado
    await page.getByText('Gaviões Históricos').click();
    await expect(page.getByText(atleta.nome)).toBeVisible();
  });

  test('camisa repetida é aceita com aviso, não bloqueio', async ({ page, request }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const idEdicao = await criarEdicaoTeste(request, 'Copa Camisas');
    const timestamp = Date.now();

    // Cria equipe e primeiro integrante com camisa 10 via API
    const eqRes = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Santos FC' },
    });
    const eq = await eqRes.json();

    const c1Res = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: `Pelé Primeiro ${timestamp}` },
    });
    const c1 = await c1Res.json();

    await request.post(`${API_E2E}/competicoes/equipes/${eq.id_equipe}/integrantes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        id_competidor: c1.id_competidor,
        nome_esportivo: c1.nome,
        numero_camisa: 10,
      },
    });

    const c2Res = await request.post(`${API_E2E}/competicoes/competidores`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: `Neymar Segundo ${timestamp}` },
    });
    const c2 = await c2Res.json();

    // Na UI, adiciona o segundo integrante com a mesma camisa 10
    await page.goto(`/test-elencos?idEdicao=${idEdicao}`);
    await page.getByText('Santos FC').click();
    await page.getByRole('button', { name: /adicionar integrante/i }).click();

    await page.getByPlaceholder(/buscar competidor/i).fill(c2.nome);
    await page.getByRole('button', { name: /selecionar/i }).click();

    // Digita a mesma camisa 10
    await page.getByLabel(/número da camisa/i).fill('10');

    // Regra explícita do brief: aviso visual "Número repetido na equipe", mas NÃO bloqueia o botão Salvar
    await expect(page.getByText(/número repetido/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();

    // Salva com camisa repetida (deve ter sucesso)
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(c2.nome)).toBeVisible();
  });

  test('exclui equipe pelo menu "⋯" com confirmação (edição em rascunho)', async ({ page, request }) => {
    await authenticateDirectly(page, { username: 'coordenador', password: 'coord123' });

    const idEdicao = await criarEdicaoTeste(request, 'Copa Exclusão Equipe');
    const eqRes = await request.post(`${API_E2E}/competicoes/edicoes/${idEdicao}/equipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome: 'Equipe Descartável', sigla: 'DES' },
    });
    expect(eqRes.ok()).toBeTruthy();
    const eq = await eqRes.json();

    await page.goto(`/test-elencos?idEdicao=${idEdicao}`);
    await expect(page.getByText('Equipe Descartável')).toBeVisible();

    await page.getByTestId(`btn-acoes-equipe-${eq.id_equipe}`).click();
    await page.getByRole('menuitem', { name: /excluir equipe/i }).click();

    const confirmacao = page.getByRole('dialog', { name: /excluir equipe/i });
    await expect(confirmacao).toBeVisible();
    await expect(page.getByTestId('btn-confirmar-exclusao')).toBeDisabled();
    await page.getByTestId('input-confirmacao-exclusao').fill('Equipe Descartável');
    await page.getByTestId('btn-confirmar-exclusao').click();

    await expect(confirmacao).toHaveCount(0);
    await expect(page.getByText('Equipe Descartável')).toHaveCount(0);
    await expect(page.getByText(/nenhuma equipe cadastrada/i)).toBeVisible();
  });
});
