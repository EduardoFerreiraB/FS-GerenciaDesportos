'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ClipboardList, GraduationCap, Search } from 'lucide-react';
import api from '@/lib/api';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useNotification } from '@/context/NotificationContext';
import { formatarHora } from '@/lib/formatos';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(res => res.data);

const ROTULO_DIA: Record<string, string> = {
  SEG: 'Seg', TER: 'Ter', QUA: 'Qua', QUI: 'Qui', SEX: 'Sex', SAB: 'Sáb', DOM: 'Dom',
};

function iniciais(nome: string) {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
}

function descreverDias(dias: unknown): string {
  if (Array.isArray(dias)) return dias.length ? dias.map((d) => ROTULO_DIA[d] || d).join(', ') : 'Dias a definir';
  return typeof dias === 'string' && dias ? dias : 'Dias a definir';
}

export default function MatriculasPage() {
  const { toast } = useNotification();
  useBreadcrumb([{ label: 'Dashboard', href: '/dashboard' }, { label: 'Matrículas' }]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAluno, setSelectedAluno] = useState<any>(null);
  const [turmaEmEnvio, setTurmaEmEnvio] = useState<number | null>(null);
  const { data: alunos, error: errorAlunos, isLoading: isLoadingAlunos, mutate: recarregarAlunos } = useSWR('/alunos/', fetcher);
  const { data: turmas, error: errorTurmas, isLoading: isLoadingTurmas, mutate: recarregarTurmas } = useSWR('/turmas/', fetcher);

  const turmasMatriculadasIds = new Set<number>(
    (selectedAluno?.matriculas ?? [])
      .filter((m: any) => m.ativo !== false)
      .map((m: any) => m.turma?.id_turma ?? m.id_turma)
      .filter((id: unknown): id is number => typeof id === 'number'),
  );

  const filteredAlunos = alunos?.filter((a: any) =>
    a.nome_completo.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleMatricular = async (turma: any) => {
    if (!selectedAluno) return;
    setTurmaEmEnvio(turma.id_turma);
    try {
      await api.post('/matriculas/', {
        id_aluno: selectedAluno.id_aluno,
        id_turma: turma.id_turma
      });
      await recarregarAlunos();
      toast(`Aluno ${selectedAluno.nome_completo} matriculado na turma ${turma.descricao} com sucesso!`, 'success');
      setSelectedAluno(null);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || 'Erro ao realizar matrícula.';
      toast(Array.isArray(msg) ? msg[0]?.msg || 'Erro ao realizar matrícula.' : msg, 'error');
    } finally {
      setTurmaEmEnvio(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Matrículas"
        description="Selecione um aluno para matriculá-lo em uma turma."
      />

      <div className="relative mb-4 max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="text"
          aria-label="Buscar aluno"
          placeholder="Buscar aluno por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoadingAlunos ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : errorAlunos ? (
        <Alert tone="danger" title="Erro ao carregar alunos" action={<Button variant="secondary" size="sm" onClick={() => recarregarAlunos()}>Tentar novamente</Button>}>
          Não foi possível obter a lista de alunos.
        </Alert>
      ) : filteredAlunos.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={searchTerm ? 'Nenhum aluno encontrado' : 'Nenhum aluno cadastrado'}
          description={searchTerm ? 'Tente outro termo de busca.' : 'Cadastre alunos para poder matriculá-los em turmas.'}
          action={!searchTerm ? <Button asChild><Link href="/dashboard/alunos/novo">Novo aluno</Link></Button> : undefined}
        />
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Aluno</TH>
              <TH className="w-32"><span className="sr-only">Ações</span></TH>
            </TR>
          </THead>
          <TBody>
            {filteredAlunos.map((aluno: any) => (
              <TR key={aluno.id_aluno}>
                <TD>
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                      {iniciais(aluno.nome_completo)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg" title={aluno.nome_completo}>{aluno.nome_completo}</p>
                      <p className="text-xs tabular-nums text-fg-muted">ID #{aluno.id_aluno}</p>
                    </div>
                  </div>
                </TD>
                <TD className="text-right">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedAluno(aluno)} aria-label={`Matricular ${aluno.nome_completo}`}>
                    Matricular
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={!!selectedAluno} onOpenChange={(v) => { if (!v && turmaEmEnvio === null) setSelectedAluno(null); }}>
        {selectedAluno ? (
          <DialogContent
            size="lg"
            title={`Matricular ${selectedAluno.nome_completo}`}
            description="Escolha uma turma disponível abaixo."
          >
            {isLoadingTurmas ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : errorTurmas ? (
              <Alert tone="danger" title="Erro ao carregar turmas" action={<Button variant="secondary" size="sm" onClick={() => recarregarTurmas()}>Tentar novamente</Button>}>
                Não foi possível obter a lista de turmas.
              </Alert>
            ) : !turmas || turmas.length === 0 ? (
              <EmptyState
                icon={<GraduationCap />}
                title="Nenhuma turma disponível."
                description="Crie uma turma antes de matricular alunos."
                action={<Button asChild variant="secondary"><Link href="/dashboard/turmas/novo">Nova turma</Link></Button>}
              />
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {turmas.map((turma: any) => {
                  const nome = turma.descricao || `Turma ${turma.id_turma}`;
                  const jaMatriculado = turmasMatriculadasIds.has(turma.id_turma);
                  return (
                    <li
                      key={turma.id_turma}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
                          <GraduationCap className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-fg" title={nome}>{nome}</p>
                            {jaMatriculado ? <Badge tone="success">Já matriculado</Badge> : null}
                          </div>
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                            {turma.modalidade?.nome ? <Badge tone="primary">{turma.modalidade.nome}</Badge> : null}
                            <span>{descreverDias(turma.dias_semana)}</span>
                            <span className="tabular-nums">{formatarHora(turma.horario_inicio) || '—'}–{formatarHora(turma.horario_fim) || '—'}</span>
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={jaMatriculado ? 'secondary' : 'primary'}
                        className="self-start sm:self-auto"
                        loading={turmaEmEnvio === turma.id_turma}
                        disabled={jaMatriculado || (turmaEmEnvio !== null && turmaEmEnvio !== turma.id_turma)}
                        onClick={() => handleMatricular(turma)}
                      >
                        {jaMatriculado ? 'Já matriculado' : 'Matricular'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
