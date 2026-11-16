'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  GraduationCap,
  UserPlus,
  ClipboardList,
  PlusCircle,
  Dumbbell,
  ArrowRight,
  CalendarCheck,
  Clock,
  Trophy,
  PieChart as IconePizza,
  LayoutDashboard,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import useSWR from 'swr';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatarData, formatarHora } from '@/lib/formatos';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(res => res.data);

// Cores só por tokens (variáveis CSS), para funcionar nos dois temas.
const CORES = [
  'var(--primary)',
  'var(--success)',
  'var(--warning)',
  'var(--danger)',
  'var(--fg-muted)',
  'var(--line-strong)',
];

function Avatar({ nome, className = '' }: { nome: string; className?: string }) {
  const iniciais = (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
  return (
    <span aria-hidden="true" className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary ${className}`}>
      {iniciais}
    </span>
  );
}

function plural(n: number, singular: string, pluralTxt: string) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

function Rosca({ dados, altura = 220 }: { dados: { name: string; value: number; color: string }[]; altura?: number }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const total = dados.reduce((acc, d) => acc + d.value, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="w-full" style={{ height: altura }}>
        {montado ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dados} cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" paddingAngle={2} dataKey="value" stroke="var(--surface)" strokeWidth={2}>
                {dados.map((d, i) => <Cell key={`c-${i}`} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)', fontSize: 12 }}
                itemStyle={{ color: 'var(--fg)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : null}
      </div>
      <ul className="space-y-1.5 text-sm" aria-label="Legenda do gráfico">
        {dados.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-fg">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="tabular-nums text-fg-muted">
              {d.value} <span className="text-fg-subtle">({Math.round((d.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartaoGrafico({ dados, carregando }: { dados: { name: string; value: number; color: string }[]; carregando: boolean }) {
  return (
    <Card>
      <CardHeader title="Alunos por modalidade" description="Matrículas agrupadas pela modalidade da turma." />
      <CardBody>
        {carregando ? (
          <Skeleton className="h-56 w-full" />
        ) : dados.length > 0 ? (
          <Rosca dados={dados} />
        ) : (
          <EmptyState icon={<IconePizza />} title="Sem dados ainda" description="Quando houver matrículas, a distribuição por modalidade aparece aqui." className="border-0 py-8" />
        )}
      </CardBody>
    </Card>
  );
}

function montarDadosGrafico(matriculas: any[] | undefined, turmas: any[] | undefined, modalidades: any[] | undefined, padrao: (turma: any) => string) {
  const contagem: Record<string, number> = {};
  if (matriculas && matriculas.length > 0 && turmas && modalidades) {
    matriculas.forEach((matricula: any) => {
      const turma = turmas.find((t: any) => t.id_turma === matricula.id_turma);
      if (turma) {
        const nome = padrao(turma);
        contagem[nome] = (contagem[nome] || 0) + 1;
      }
    });
  }
  return Object.keys(contagem).map((key, index) => ({
    name: key,
    value: contagem[key],
    color: CORES[index % CORES.length],
  }));
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();

  const shouldFetch = !authLoading && !!user;

  const { data: alunos, error: erroAlunos, mutate: recarregarAlunos } = useSWR(shouldFetch ? '/alunos/' : null, fetcher);
  const { data: turmas, error: erroTurmas } = useSWR(shouldFetch ? '/turmas/' : null, fetcher);
  const { data: professores, error: erroProfessores } = useSWR(shouldFetch ? '/professores/' : null, fetcher);
  const { data: modalidades, error: erroModalidades } = useSWR(shouldFetch ? '/modalidades/' : null, fetcher);
  const { data: matriculas, error: erroMatriculas } = useSWR(shouldFetch ? '/matriculas/' : null, fetcher);

  if (user?.role === 'professor') {
    return <DashboardProfessor turmas={turmas} alunos={alunos} modalidades={modalidades} matriculas={matriculas} />;
  }

  const erro = erroAlunos || erroTurmas || erroProfessores || erroModalidades || erroMatriculas;
  const carregando = !erro && (!alunos || !turmas || !professores || !modalidades || !matriculas);

  const totalAlunos = alunos?.length || 0;
  const totalTurmas = turmas?.length || 0;
  const totalProfessores = professores?.length || 0;
  const totalModalidades = modalidades?.length || 0;
  const recentAlunos = alunos ? [...alunos].slice(-5).reverse() : [];

  const alunosSemTurma = alunos ? alunos.filter((a: any) => !(a.matriculas && a.matriculas.length > 0)).length : null;
  const turmasSemProfessor = turmas ? turmas.filter((t: any) => !t.id_professor && !t.professor).length : null;
  const professoresSemTurma = professores && turmas
    ? professores.filter((p: any) => !turmas.some((t: any) => t.id_professor === p.id_professor || t.professor?.id_professor === p.id_professor)).length
    : null;
  const modalidadesSemTurma = modalidades && turmas
    ? modalidades.filter((m: any) => !turmas.some((t: any) => t.id_modalidade === m.id_modalidade || t.modalidade?.id_modalidade === m.id_modalidade)).length
    : null;

  const dataGrafico = montarDadosGrafico(matriculas, turmas, modalidades, (turma) => {
    if (turma.modalidade?.nome) return turma.modalidade.nome;
    if (turma.id_modalidade) {
      const mod = modalidades?.find((m: any) => m.id_modalidade === turma.id_modalidade);
      if (mod) return mod.nome;
    }
    return 'Outros';
  });

  const valor = (n: number) => (carregando ? '—' : n);
  const dica = (n: number | null, texto: string) => (n === null || carregando ? undefined : n > 0 ? texto : undefined);

  const acoes = [
    { href: '/dashboard/matriculas', titulo: 'Nova matrícula', desc: 'Inscrever um aluno em uma turma', icone: PlusCircle },
    { href: '/dashboard/alunos/novo', titulo: 'Novo aluno', desc: 'Cadastrar um aluno', icone: UserPlus },
    { href: '/dashboard/turmas/novo', titulo: 'Nova turma', desc: 'Criar uma turma de aulas', icone: GraduationCap },
    { href: '/dashboard/competicoes', titulo: 'Nova competição', desc: 'Organizar um campeonato', icone: Trophy },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Visão geral da escolinha." />

      {erro ? (
        <Alert tone="danger" title="Não foi possível carregar o painel" action={<Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Tentar novamente</Button>}>
          Verifique a conexão e tente de novo.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de alunos" value={valor(totalAlunos)} icon={<Users />} hint={dica(alunosSemTurma, `${alunosSemTurma} sem turma`)} />
        <StatCard label="Turmas ativas" value={valor(totalTurmas)} icon={<GraduationCap />} hint={dica(turmasSemProfessor, `${turmasSemProfessor} sem professor`)} />
        <StatCard label="Professores" value={valor(totalProfessores)} icon={<UserPlus />} hint={dica(professoresSemTurma, `${professoresSemTurma} sem turma`)} />
        <StatCard label="Modalidades ativas" value={valor(totalModalidades)} icon={<Dumbbell />} hint={dica(modalidadesSemTurma, `${modalidadesSemTurma} sem turma`)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CartaoGrafico dados={dataGrafico} carregando={carregando} />
        </div>
        <Card>
          <CardHeader title="Ações rápidas" />
          <ul className="divide-y divide-line">
            {acoes.map(({ href, titulo, desc, icone: Icone }) => (
              <li key={href}>
                <Link href={href} className="group flex items-center gap-3 px-5 py-3 outline-none transition-colors duration-150 hover:bg-surface-muted focus-visible:ring-4 focus-visible:ring-focus">
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icone className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{titulo}</span>
                    <span className="block truncate text-xs text-fg-muted">{desc}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 text-fg-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section aria-labelledby="titulo-recentes" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="titulo-recentes" className="text-base font-semibold text-fg">Alunos recentes</h2>
          <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight className="size-4" />}>
            <Link href="/dashboard/alunos">Ver todos</Link>
          </Button>
        </div>
        {carregando ? (
          <Skeleton className="h-48 w-full" />
        ) : recentAlunos.length === 0 ? (
          <EmptyState icon={<Users />} title="Nenhum aluno cadastrado" description="Cadastre o primeiro aluno para vê-lo aqui." action={<Button asChild><Link href="/dashboard/alunos/novo">Novo aluno</Link></Button>} />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Aluno</TH>
                <TH>Turma</TH>
                <TH>Nascimento</TH>
                <TH>Responsável</TH>
                <TH>Situação</TH>
              </TR>
            </THead>
            <TBody>
              {recentAlunos.map((aluno: any) => {
                const turmaNome = aluno.matriculas?.[0]?.turma?.descricao;
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const cleanBaseUrl = baseUrl.replace(/\/$/, '');
                const cleanFotoPath = aluno.foto ? aluno.foto.replace(/^\//, '') : null;
                const fotoUrl = cleanFotoPath ? `${cleanBaseUrl}/${cleanFotoPath}` : null;
                return (
                  <TR key={aluno.id_aluno}>
                    <TD>
                      <div className="flex items-center gap-3">
                        {fotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fotoUrl} alt="" className="size-9 rounded-full border border-line object-cover" />
                        ) : (
                          <Avatar nome={aluno.nome_completo} />
                        )}
                        <span className="font-medium text-fg">{aluno.nome_completo}</span>
                      </div>
                    </TD>
                    <TD>{turmaNome ? <Badge tone="primary">{turmaNome}</Badge> : <span className="text-fg-muted">Sem turma</span>}</TD>
                    <TD className="tabular-nums text-fg-muted">{formatarData(aluno.data_nascimento) ?? '—'}</TD>
                    <TD className="text-fg-muted">{aluno.nome_mae || aluno.nome_pai || '—'}</TD>
                    <TD><Badge tone="success" dot>Ativo</Badge></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function obterProximaDataObjeto(diasSemana: any, horarioInicioStr: string): Date {
  const WEEKDAY_MAP: Record<string, number> = {
    'DOM': 0, 'SEG': 1, 'TER': 2, 'QUA': 3, 'QUI': 4, 'SEX': 5, 'SAB': 6
  };
  
  const diasArray = Array.isArray(diasSemana) ? diasSemana : (typeof diasSemana === 'string' ? diasSemana.split(',').map(d => d.trim()) : []);
  const diasIndices = diasArray.map(d => WEEKDAY_MAP[d.toUpperCase()]).filter(v => v !== undefined);
  const agora = new Date();
  
  if (diasIndices.length === 0) {
    const farDate = new Date();
    farDate.setFullYear(agora.getFullYear() + 10);
    return farDate;
  }

  let classHour = 0;
  let classMinute = 0;
  if (horarioInicioStr) {
    const parts = horarioInicioStr.split(':');
    if (parts.length >= 2) {
      classHour = parseInt(parts[0], 10);
      classMinute = parseInt(parts[1], 10);
    }
  }

  for (let offset = 0; offset <= 7; offset++) {
    const dataAlvo = new Date(agora);
    dataAlvo.setDate(agora.getDate() + offset);
    const diaSemanaIdx = dataAlvo.getDay();

    if (diasIndices.includes(diaSemanaIdx)) {
      if (offset === 0) {
        const horaAlvo = new Date(agora);
        horaAlvo.setHours(classHour, classMinute, 0, 0);
        if (agora > horaAlvo) {
          continue;
        }
      }
      dataAlvo.setHours(classHour, classMinute, 0, 0);
      return dataAlvo;
    }
  }

  const fallback = new Date(agora);
  fallback.setDate(agora.getDate() + 7);
  fallback.setHours(classHour, classMinute, 0, 0);
  return fallback;
}

function obterProximaDataAulaFormatada(diasSemana: any, horarioInicioStr: string): string {
  const diasArray = Array.isArray(diasSemana) ? diasSemana : (typeof diasSemana === 'string' ? diasSemana.split(',').map(d => d.trim()) : []);
  if (diasArray.length === 0) return 'Sem dia definido';
  
  const WEEKDAY_MAP: Record<string, number> = {
    'DOM': 0, 'SEG': 1, 'TER': 2, 'QUA': 3, 'QUI': 4, 'SEX': 5, 'SAB': 6
  };
  
  const WEEKDAY_NAME: Record<number, string> = {
    0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado'
  };

  const diasIndices = diasArray.map(d => WEEKDAY_MAP[d.toUpperCase()]).filter(v => v !== undefined);
  if (diasIndices.length === 0) return diasArray.join(', ');

  const agora = new Date();
  
  let classHour = 0;
  let classMinute = 0;
  if (horarioInicioStr) {
    const parts = horarioInicioStr.split(':');
    if (parts.length >= 2) {
      classHour = parseInt(parts[0], 10);
      classMinute = parseInt(parts[1], 10);
    }
  }

  for (let offset = 0; offset <= 7; offset++) {
    const dataAlvo = new Date(agora);
    dataAlvo.setDate(agora.getDate() + offset);
    const diaSemanaIdx = dataAlvo.getDay();

    if (diasIndices.includes(diaSemanaIdx)) {
      if (offset === 0) {
        const horaAlvo = new Date(agora);
        horaAlvo.setHours(classHour, classMinute, 0, 0);
        if (agora > horaAlvo) {
          continue;
        }
      }
      
      const diaNome = WEEKDAY_NAME[diaSemanaIdx];
      const diaNum = String(dataAlvo.getDate()).padStart(2, '0');
      const mesNum = String(dataAlvo.getMonth() + 1).padStart(2, '0');
      
      if (offset === 0) {
        return `Hoje (${diaNum}/${mesNum})`;
      } else if (offset === 1) {
        return `Amanhã (${diaNum}/${mesNum})`;
      } else {
        return `${diaNome}, ${diaNum}/${mesNum}`;
      }
    }
  }

  return diasArray.join(', ');
}

function DashboardProfessor({ turmas, alunos, modalidades, matriculas }: any) {
  const minhasTurmas = turmas || [];
  const meusAlunos = alunos || [];
  
  // Ordena as turmas pela data da próxima ocorrência
  const minhasTurmasOrdenadas = [...minhasTurmas].sort((a, b) => {
    const dataA = obterProximaDataObjeto(a.dias_semana, a.horario_inicio);
    const dataB = obterProximaDataObjeto(b.dias_semana, b.horario_inicio);
    return dataA.getTime() - dataB.getTime();
  });
  
  const proximaAula = minhasTurmasOrdenadas.length > 0 ? minhasTurmasOrdenadas[0] : null;

  const WEEKDAY_MAP: Record<string, number> = {
    'DOM': 0, 'SEG': 1, 'TER': 2, 'QUA': 3, 'QUI': 4, 'SEX': 5, 'SAB': 6
  };
  const hojeIdx = new Date().getDay();
  const aulasHoje = minhasTurmas.filter((t: any) => {
    const diasArray = Array.isArray(t.dias_semana) ? t.dias_semana : (typeof t.dias_semana === 'string' ? t.dias_semana.split(',').map((d: any) => d.trim()) : []);
    const indices = diasArray.map((d: string) => WEEKDAY_MAP[d.toUpperCase()]).filter((v: any) => v !== undefined);
    return indices.includes(hojeIdx);
  }).length;

  const dataGrafico = montarDadosGrafico(matriculas, turmas, modalidades, (turma) => turma.modalidade?.nome || 'Minhas aulas');
  const carregando = !turmas || !alunos;

  return (
    <div className="space-y-6">
      <PageHeader title="Área do professor" description="Suas turmas, alunos e próximas aulas." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Meus alunos" value={carregando ? '—' : meusAlunos.length} icon={<Users />} />
        <StatCard label="Minhas turmas" value={carregando ? '—' : minhasTurmas.length} icon={<GraduationCap />} />
        <StatCard label="Aulas hoje" value={carregando ? '—' : aulasHoje} icon={<CalendarCheck />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {proximaAula && (
            <Card>
              <CardHeader
                title="Próxima aula"
                description={`${proximaAula.categoria_idade ?? ''}${proximaAula.modalidade?.nome ? ` · ${proximaAula.modalidade.nome}` : ''}`}
              />
              <CardBody className="space-y-4">
                <h3 className="text-xl font-semibold tracking-tight text-fg">{proximaAula.descricao}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-3">
                    <CalendarCheck aria-hidden="true" className="size-5 text-fg-muted" />
                    <div><p className="text-xs text-fg-muted">Dia</p><p className="text-sm font-medium text-fg">{obterProximaDataAulaFormatada(proximaAula.dias_semana, proximaAula.horario_inicio)}</p></div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-3">
                    <Clock aria-hidden="true" className="size-5 text-fg-muted" />
                    <div><p className="text-xs text-fg-muted">Horário</p><p className="text-sm font-medium tabular-nums text-fg">{formatarHora(proximaAula.horario_inicio)} - {formatarHora(proximaAula.horario_fim)}</p></div>
                  </div>
                </div>
                <Button asChild leftIcon={<ClipboardList className="size-4" />}>
                  <Link href={`/dashboard/turmas/${proximaAula.id_turma}`}>Fazer chamada</Link>
                </Button>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Minhas turmas" />
            {carregando ? (
              <CardBody><Skeleton className="h-24 w-full" /></CardBody>
            ) : minhasTurmas.length === 0 ? (
              <CardBody><EmptyState icon={<LayoutDashboard />} title="Nenhuma turma atribuída" className="border-0 py-8" /></CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {minhasTurmas.map((t: any) => {
                  const diasTexto = Array.isArray(t.dias_semana) ? t.dias_semana.join(', ') : t.dias_semana;
                  return (
                    <li key={t.id_turma}>
                      <Link href={`/dashboard/turmas/${t.id_turma}`} className="flex items-center justify-between gap-3 px-5 py-3 outline-none transition-colors duration-150 hover:bg-surface-muted focus-visible:ring-4 focus-visible:ring-focus">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-fg">{t.descricao}</span>
                          <span className="block text-xs text-fg-muted">{diasTexto} · {formatarHora(t.horario_inicio)}</span>
                        </span>
                        <ArrowRight aria-hidden="true" className="size-4 text-fg-subtle" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
        <CartaoGrafico dados={dataGrafico} carregando={carregando} />
      </div>
    </div>
  );
}
