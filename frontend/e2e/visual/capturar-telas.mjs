// Captura screenshots de referência de todas as telas, nos dois temas e duas larguras.
// Uso (a partir da raiz do repositório):
//   bash frontend/e2e/visual/capturar.sh <pasta-saida> [filtro]
// O capturar.sh recria o banco E2E a CADA execução, sobe backend (8001) e frontend (3001)
// e chama este script. Filtro opcional: ids de tela separados por vírgula, casados por
// `includes` (ex.: "competicao-jogos,portal"). A numeração dos arquivos é a do conjunto
// completo, então um filtro gera os mesmos nomes (ex.: 10-competicao-jogos-...).
// Execução direta (ambiente já no ar, banco limpo): node e2e/visual/capturar-telas.mjs <saida> [filtro]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const API = process.env.API_URL || 'http://127.0.0.1:8001';
const WEB = process.env.WEB_URL || 'http://127.0.0.1:3001';
const saida = resolve(process.argv[2] || '../docs/design/antes');
const filtros = (process.argv[3] || '').split(',').map((f) => f.trim()).filter(Boolean);
mkdirSync(saida, { recursive: true });

let bearer = '';
let tokens = {};

async function api(metodo, caminho, corpo, extra = {}) {
  const res = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extra,
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${metodo} ${caminho} -> ${res.status}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

async function login() {
  const res = await fetch(`${API}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'admin', password: 'admin123' }),
  });
  if (!res.ok) throw new Error('login falhou');
  tokens = await res.json();
  bearer = tokens.access_token;
}

async function equipes(idEdicao, nomes, siglas, comElenco) {
  const ids = [];
  for (let i = 0; i < nomes.length; i++) {
    const eq = await api('POST', `/competicoes/edicoes/${idEdicao}/equipes`, { nome: nomes[i], sigla: siglas[i] });
    ids.push(eq.id_equipe);
    if (comElenco) {
      for (let n = 1; n <= 3; n++) {
        const c = await api('POST', '/competicoes/competidores', { nome: `Atleta ${siglas[i]} ${n}`, ativo: true });
        await api('POST', `/competicoes/equipes/${eq.id_equipe}/integrantes`, {
          id_competidor: c.id_competidor,
          nome_esportivo: `${siglas[i]} Jogador ${n}`,
          numero_camisa: n * 3,
        });
      }
    }
  }
  return ids;
}

async function montarDados() {
  await login();
  const mods = await api('GET', '/modalidades/');
  if (!Array.isArray(mods) || mods.length === 0) throw new Error('Nenhuma modalidade cadastrada: rode o setup-db.py do ambiente E2E.');
  const idMod = mods[0].id_modalidade;

  // Escolinha
  const prof = await api('POST', '/professores/', {
    nome: 'Carlos Henrique Souza', cpf: '529.982.247-25', contato: '(11) 91234-5678',
    username: 'prof.carlos', password: 'prof123456',
  });
  const turmas = [];
  turmas.push(await api('POST', '/turmas/', {
    descricao: 'Sub-11 Manhã', categoria_idade: 'Sub-11', horario_inicio: '08:00:00', horario_fim: '09:30:00',
    dias_semana: ['SEG', 'QUA'], id_modalidade: idMod, id_professor: prof.id_professor,
  }));
  turmas.push(await api('POST', '/turmas/', {
    descricao: 'Sub-15 Tarde', categoria_idade: 'Sub-15', horario_inicio: '15:00:00', horario_fim: '16:30:00',
    dias_semana: ['TER', 'QUI'], id_modalidade: idMod, id_professor: prof.id_professor,
  }));
  const alunos = [
    ['Ana Beatriz Lima', '2015-03-12', 'Maria Lima', [turmas[0].id_turma]],
    ['Bruno Costa Ferreira', '2010-08-25', 'Paula Costa', [turmas[1].id_turma]],
    ['Camila Rocha', '2014-11-02', 'Sandra Rocha', [turmas[0].id_turma, turmas[1].id_turma]],
  ];
  for (const [nome, nasc, mae, ids] of alunos) {
    const res = await fetch(`${API}/alunos/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}` },
      body: new URLSearchParams({
        nome_completo: nome, data_nascimento: nasc, nome_mae: mae, telefone_1: '(11) 98888-7777',
        escola: 'Escola Municipal Central', serie_ano: '5º ano', endereco: 'Rua das Flores, 120', ids_turmas: ids.join(','),
      }),
    });
    if (!res.ok) throw new Error(`POST /alunos/ -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  // Competição 1: pontos corridos, 4 equipes, 2 resultados, publicada e em andamento
  const c1 = await api('POST', '/competicoes/competicoes', {
    nome: 'Copa Municipal de Futebol', id_modalidade: idMod,
    edicao: {
      identificacao: '2026', data_inicio: '2026-06-01', data_fim: '2026-07-31', formato: 'PONTOS_CORRIDOS',
      configuracao: { formato: 'PONTOS_CORRIDOS', pontuacao: { vitoria: 3, empate: 1, derrota: 0 }, desempates: ['SALDO_GOLS', 'VITORIAS'] },
    },
  });
  const ed1 = c1.edicoes[0].id_edicao_competicao;
  await equipes(ed1, ['Águias FC', 'Corujas EC', 'Falcões AA', 'Tubarões SC'], ['AGU', 'COR', 'FAL', 'TUB'], true);
  await api('POST', `/competicoes/edicoes/${ed1}/gerar-tabela`, {});
  let partidas = await api('GET', `/competicoes/edicoes/${ed1}/partidas`);
  const placares = [[3, 1], [2, 2]];
  for (let i = 0; i < 2; i++) {
    const id = partidas[i].id_partida;
    await api('PATCH', `/competicoes/partidas/${id}/agendamento`, {
      data_hora: `2026-06-0${5 + i}T15:00:00`, local: 'Estádio Municipal', campo: 'Campo 1',
    });
    await api('POST', `/competicoes/partidas/${id}/resultado-simples`,
      { gols_mandante: placares[i][0], gols_visitante: placares[i][1], wo: false },
      { 'Idempotency-Key': `visual-${Date.now()}-${i}` });
  }
  await api('POST', `/competicoes/edicoes/${ed1}/iniciar`, {});
  await api('POST', `/competicoes/edicoes/${ed1}/publicar`, { publicada: true });

  // Competição 2: mata-mata de 4
  const c2 = await api('POST', '/competicoes/competicoes', {
    nome: 'Torneio Mata-Mata de Verão', id_modalidade: idMod,
    edicao: {
      identificacao: '2026', data_inicio: '2026-08-01', data_fim: '2026-08-30', formato: 'MATA_MATA',
      configuracao: { formato: 'MATA_MATA', ida_volta: false, final_unica: true, terceiro_lugar: false },
    },
  });
  const ed2 = c2.edicoes[0].id_edicao_competicao;
  await equipes(ed2, ['Leões', 'Panteras', 'Lobos', 'Ursos'], ['LEO', 'PAN', 'LOB', 'URS'], true);
  await api('POST', `/competicoes/edicoes/${ed2}/gerar-tabela`, {});

  // Evento
  await api('POST', '/competicoes/eventos', {
    nome: 'Festival Esportivo da Cidade', descricao: 'Reúne as competições do segundo semestre.',
    edicao: { identificacao: '2026', data_inicio: '2026-06-01', data_fim: '2026-08-30' },
  });
  return { idComp1: c1.id_competicao, ed1, idComp2: c2.id_competicao, ed2 };
}

const ABAS = [
  ['visao-geral', /vis[ãa]o geral/i],
  ['configuracao', /configura[çc][ãa]o/i],
  ['equipes', /equipes/i],
  ['jogos', /jogos/i],
  ['classificacao', /classifica[çc][ãa]o/i],
  ['disciplina', /disciplina/i],
];

const PONTOS = [{ n: 'claro', t: 'light' }, { n: 'escuro', t: 'dark' }];
const LARGURAS = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];

async function main() {
  const d = await montarDados();
  console.log('Dados criados:', JSON.stringify(d));

  const telas = [
    { id: 'login', auth: false, url: '/login' },
    { id: 'dashboard', url: '/dashboard' },
    { id: 'alunos', url: '/dashboard/alunos' },
    { id: 'turmas', url: '/dashboard/turmas' },
    { id: 'professores', url: '/dashboard/professores' },
    { id: 'competicoes-lista', url: '/dashboard/competicoes' },
    ...ABAS.map(([nome, rx]) => ({ id: `competicao-${nome}`, url: `/dashboard/competicoes/${d.idComp1}`, aba: rx })),
    { id: 'competicao-matamata-jogos', url: `/dashboard/competicoes/${d.idComp2}`, aba: /jogos/i },
    { id: 'eventos', url: '/dashboard/eventos' },
    { id: 'portal-vitrine', auth: false, url: '/' },
    { id: 'portal-edicao', auth: false, url: `/publico/edicao/${d.ed1}` },
  ].map((t, i) => ({ ...t, numero: String(i + 1).padStart(2, '0') }))
    .filter((t) => filtros.length === 0 || filtros.some((f) => t.id.includes(f)));

  const browser = await chromium.launch();
  const feitos = [];
  try {
    for (const tela of telas) {
      const prefixo = tela.numero;
      for (const p of PONTOS) {
        for (const l of LARGURAS) {
          const ctx = await browser.newContext({ viewport: { width: l.w, height: l.h } });
          await ctx.addInitScript(
            ({ tok, ref, tema, auth }) => {
              try {
                if (auth) { localStorage.setItem('token', tok); localStorage.setItem('refresh_token', ref); }
                localStorage.setItem('theme', tema);
              } catch {}
            },
            { tok: tokens.access_token, ref: tokens.refresh_token || '', tema: p.t, auth: tela.auth !== false },
          );
          const page = await ctx.newPage();
          await page.goto(`${WEB}${tela.url}`, { waitUntil: 'networkidle' });
          if (tela.aba) {
            try {
              await page.getByRole('button', { name: tela.aba }).or(page.getByRole('tab', { name: tela.aba })).first().click({ timeout: 8000 });
            } catch (e) {
              console.warn(`AVISO: clique na aba falhou em ${tela.id} ${p.n} ${l.w} (layout atual cobre o botão): ${String(e.message).split('\n')[0]}`);
            }
            await page.waitForLoadState('networkidle');
          }
          await page.waitForTimeout(800);
          await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
          const arq = `${prefixo}-${tela.id}-${p.n}-${l.w}.png`;
          await page.screenshot({ path: resolve(saida, arq), fullPage: l.w === 390 });
          feitos.push(arq);
          await ctx.close();
        }
      }
    }

  } finally {
    await browser.close();
  }
  console.log(`${feitos.length} capturas em ${saida}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
