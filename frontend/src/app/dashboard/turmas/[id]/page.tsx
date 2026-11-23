'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Calendar,
  CheckCheck,
  CheckSquare,
  ClipboardCheck,
  Clock,
  Dumbbell,
  Pencil,
  User,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useNotification } from '@/context/NotificationContext';
import { formatarData, formatarHora } from '@/lib/formatos';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(res => res.data);

const ROTULO_DIA: Record<string, string> = {
  SEG: 'Segunda', TER: 'Terça', QUA: 'Quarta', QUI: 'Quinta', SEX: 'Sexta', SAB: 'Sábado', DOM: 'Domingo',
};

function iniciais(nome: string) {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
}

function descreverDias(dias: unknown): string | null {
  if (Array.isArray(dias)) return dias.length ? dias.map((d) => ROTULO_DIA[d] || d).join(', ') : null;
  if (typeof dias === 'string' && dias) return dias.split(',').map((d) => ROTULO_DIA[d.trim()] || d.trim()).join(', ');
  return null;
}

export default function DetalhesTurmaPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-72" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full lg:col-span-2" />
          </div>
        </div>
      }
    >
      <DetalhesTurmaConteudo />
    </Suspense>
  );
}

function DetalhesTurmaConteudo() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id;
  const { user } = useAuth();
  const { toast } = useNotification();
  const abaParam = searchParams.get('aba');
  const [activeTab, setActiveTab] = useState<'alunos' | 'frequencia'>(
    abaParam === 'frequencia' || abaParam === 'chamada' ? 'frequencia' : 'alunos',
  );

  useEffect(() => {
    if (abaParam === 'frequencia' || abaParam === 'chamada') {
      setActiveTab('frequencia');
    } else if (abaParam === 'alunos') {
      setActiveTab('alunos');
    }
  }, [abaParam]);

  const podeGerenciar = user?.role !== 'professor';

  const { data: turma, error: errorTurma, isLoading: loadingTurma, mutate: recarregarTurma } = useSWR(id ? `/turmas/${id}` : null, fetcher);
  const { data: matriculas, error: errorMatriculas, isLoading: loadingMatriculas, mutate: recarregarMatriculas } = useSWR(id ? `/matriculas/?turma_id=${id}` : null, fetcher);

  const [chamada, setChamada] = useState<Record<number, 'P' | 'A' | null>>({});
  const [dataChamada, setDataChamada] = useState(new Date().toISOString().split('T')[0]);
  const [loadingChamada, setLoadingChamada] = useState(false);
  const [salvandoChamada, setSalvandoChamada] = useState(false);

  const nomeTurma = turma?.descricao || (id ? `Turma #${id}` : 'Turma');
  useBreadcrumb([
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Turmas', href: '/dashboard/turmas' },
    { label: nomeTurma },
  ]);

  const alunos = matriculas?.map((m: any) => m.aluno) || [];

  useEffect(() => {
    if (id && dataChamada && activeTab === 'frequencia') {
      setLoadingChamada(true);
      api.get(`/presencas/turma/${id}/data/${dataChamada}`)
        .then(res => {
          const novoEstado: Record<number, 'P' | 'A' | null> = {};
          if (matriculas) {
             matriculas.forEach((m: any) => {
                 const p = res.data.find((ps: any) => ps.id_matricula === m.id_matricula);
                 novoEstado[m.id_aluno] = p ? (p.status === 'Presente' ? 'P' : 'A') : null;
             });
             setChamada(novoEstado);
          }
        })
        .finally(() => setLoadingChamada(false));
    }
  }, [id, dataChamada, activeTab, matriculas]);

  const handlePresenca = (alunoId: number, status: 'P' | 'A') => {
    setChamada(prev => ({ ...prev, [alunoId]: prev[alunoId] === status ? null : status }));
  };

  const markAllPresent = () => {
    const newChamada: Record<number, 'P'> = {};
    alunos.forEach((aluno: any) => { newChamada[aluno.id_aluno] = 'P'; });
    setChamada(newChamada);
  };

  const saveChamada = async () => {
    if (!matriculas) return;
    const presencasParaEnviar = Object.entries(chamada)
        .filter(([_, status]) => status !== null)
        .map(([alunoId, status]) => {
            const m = matriculas.find((m: any) => m.id_aluno === parseInt(alunoId));
            return m ? { id_matricula: m.id_matricula, status: status === 'P' ? 'Presente' : 'Ausente' } : null;
        }).filter(Boolean);

    if (presencasParaEnviar.length === 0) {
      toast('Marque pelo menos um aluno.', 'warning');
      return;
    }

    setSalvandoChamada(true);
    try {
      await api.post('/presencas/lote', { data_aula: dataChamada, id_turma: parseInt(id as string), presencas: presencasParaEnviar });
      toast('Frequência salva com sucesso!', 'success');
    } catch (error) {
      toast('Erro ao salvar frequência.', 'error');
    } finally {
      setSalvandoChamada(false);
    }
  };

  if (loadingTurma) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (errorTurma) {
    return (
      <div>
        <Alert
          tone="danger"
          title="Erro ao carregar turma."
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => recarregarTurma()}>Tentar novamente</Button>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/turmas')}>Voltar para a lista</Button>
            </div>
          }
        >
          Não foi possível obter os dados desta turma.
        </Alert>
      </div>
    );
  }

  const horario = turma?.horario_inicio || turma?.horario_fim
    ? `${formatarHora(turma?.horario_inicio) || '—'} - ${formatarHora(turma?.horario_fim) || '—'}`
    : null;
  const marcados = Object.values(chamada).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{nomeTurma}</span>
            {turma?.categoria_idade ? <Badge tone="primary">{turma.categoria_idade}</Badge> : null}
          </span>
        }
        description="Gestão de alunos e frequência."
        actions={
          <Button asChild variant="secondary" leftIcon={<Pencil className="size-4" />}>
            <Link href={`/dashboard/turmas/${id}/editar`}>Editar Turma</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Informações" />
          <CardBody>
            <dl className="space-y-4">
              <InfoItem label="Modalidade" value={turma?.modalidade?.nome} icon={Dumbbell} />
              <InfoItem label="Professor" value={turma?.professor?.nome} icon={User} />
              <InfoItem label="Dias" value={descreverDias(turma?.dias_semana)} icon={Calendar} />
              <InfoItem label="Horário" value={horario} icon={Clock} numerico />
              <InfoItem label="Alunos matriculados" value={matriculas ? String(alunos.length) : null} icon={Users} numerico />
            </dl>
          </CardBody>
        </Card>

        <div className="min-w-0 lg:col-span-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'alunos' | 'frequencia')}>
            <TabsList>
              <TabsTrigger value="alunos" icon={<Users className="size-4" />}>Alunos</TabsTrigger>
              <TabsTrigger value="frequencia" icon={<ClipboardCheck className="size-4" />}>Frequência</TabsTrigger>
            </TabsList>

            <TabsContent value="alunos">
              <Card>
                <CardHeader
                  title={<span className="flex items-center gap-2">Lista de Matriculados <Badge className="tabular-nums">{alunos.length}</Badge></span>}
                />
                {loadingMatriculas ? (
                  <CardBody className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </CardBody>
                ) : errorMatriculas ? (
                  <CardBody>
                    <Alert tone="danger" title="Erro ao carregar alunos" action={<Button variant="secondary" size="sm" onClick={() => recarregarMatriculas()}>Tentar novamente</Button>}>
                      Não foi possível obter os alunos desta turma.
                    </Alert>
                  </CardBody>
                ) : alunos.length === 0 ? (
                  <CardBody>
                    <EmptyState
                      icon={<Users />}
                      title="Nenhum aluno matriculado"
                      description={
                        podeGerenciar
                          ? 'Matricule alunos nesta turma pela tela de Matrículas.'
                          : 'Esta turma ainda não possui alunos matriculados.'
                      }
                      action={
                        podeGerenciar ? (
                          <Button asChild variant="secondary">
                            <Link href="/dashboard/matriculas">Nova matrícula</Link>
                          </Button>
                        ) : undefined
                      }
                    />
                  </CardBody>
                ) : (
                  <CardBody className="p-0">
                  <Table embutida>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Aluno</TH>
                        <TH className="hidden sm:table-cell">Nascimento</TH>
                        <TH className="text-right">Situação</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {alunos.map((aluno: any) => (
                        <TR key={aluno.id_aluno}>
                          <TD>
                            <div className="flex items-center gap-3">
                              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                                {iniciais(aluno.nome_completo)}
                              </span>
                              <Link href={`/dashboard/alunos/${aluno.id_aluno}`} className="truncate font-medium text-fg hover:text-primary" title={aluno.nome_completo}>
                                {aluno.nome_completo}
                              </Link>
                            </div>
                          </TD>
                          <TD className="hidden whitespace-nowrap tabular-nums text-fg-muted sm:table-cell">{formatarData(aluno.data_nascimento) || '—'}</TD>
                          <TD className="text-right"><Badge tone="success" dot>Matriculado</Badge></TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                  </CardBody>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="frequencia">
              <Card>
                <CardHeader
                  title="Controle de Frequência"
                  description={`Aula de ${formatarData(dataChamada) || '—'}. Selecione a data e marque a presença.`}
                  actions={
                    <Field label={<span className="sr-only">Data da aula</span>} htmlFor="data-chamada" className="gap-0">
                      <Input id="data-chamada" type="date" value={dataChamada} onChange={(e) => setDataChamada(e.target.value)} className="w-auto" />
                    </Field>
                  }
                  className="flex-col sm:flex-row"
                />
                <CardBody className="space-y-2">
                  {loadingMatriculas || loadingChamada ? (
                    <>
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </>
                  ) : alunos.length === 0 ? (
                    <EmptyState icon={<ClipboardCheck />} title="Nenhum aluno para a chamada" description="A turma ainda não tem alunos matriculados." />
                  ) : (
                    alunos.map((aluno: any) => {
                      const status = chamada[aluno.id_aluno];
                      return (
                        <div
                          key={aluno.id_aluno}
                          className={cn(
                            'flex flex-col gap-3 rounded-lg border p-3 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between',
                            status === 'P' ? 'border-success/40 bg-success-soft' : status === 'A' ? 'border-danger/40 bg-danger-soft' : 'border-line bg-surface',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span aria-hidden="true" className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                              status === 'P' ? 'bg-surface text-success' : status === 'A' ? 'bg-surface text-danger' : 'bg-surface-muted text-fg-muted',
                            )}>
                              {iniciais(aluno.nome_completo)}
                            </span>
                            <span className="truncate font-medium text-fg" title={aluno.nome_completo}>{aluno.nome_completo}</span>
                          </div>
                          <div className="flex items-center gap-2" role="group" aria-label={`Presença de ${aluno.nome_completo}`}>
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-pressed={status === 'P'}
                              onClick={() => handlePresenca(aluno.id_aluno, 'P')}
                              className={cn('h-9', status === 'P' && 'border-success bg-success-soft text-success hover:bg-success-soft')}
                            >
                              Presente
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-pressed={status === 'A'}
                              onClick={() => handlePresenca(aluno.id_aluno, 'A')}
                              className={cn('h-9', status === 'A' && 'border-danger bg-danger-soft text-danger hover:bg-danger-soft')}
                            >
                              Ausente
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardBody>
                <CardFooter className="flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <Button variant="ghost" leftIcon={<CheckSquare className="size-4" />} onClick={markAllPresent} disabled={alunos.length === 0}>
                    Marcar Todos Presentes
                  </Button>
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-xs tabular-nums text-fg-muted">
                      <CheckCheck aria-hidden="true" className="mr-1 inline size-3.5" />
                      {marcados} de {alunos.length} marcados
                    </span>
                    <Button leftIcon={<ClipboardCheck className="size-4" />} onClick={saveChamada} loading={salvandoChamada}>
                      Salvar Chamada
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon: Icon, numerico }: { label: string; value?: string | null; icon: React.ElementType; numerico?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-fg-subtle">{label}</dt>
        <dd className={cn('break-words text-sm font-medium', value ? 'text-fg' : 'text-fg-muted', numerico && 'tabular-nums')}>{value || 'A definir'}</dd>
      </div>
    </div>
  );
}
