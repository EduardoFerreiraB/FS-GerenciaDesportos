'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { GraduationCap, MoreHorizontal, Plus, Search } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useNotification } from '@/context/NotificationContext';
import { formatarHora } from '@/lib/formatos';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
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

function iniciais(nome: string) {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
}

export default function TurmasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useNotification();
  useBreadcrumb([{ label: 'Dashboard', href: '/dashboard' }, { label: 'Turmas' }]);
  const [searchTerm, setSearchTerm] = useState('');
  const { data: turmas, error, isLoading, mutate: recarregar } = useSWR('/turmas/', fetcher);

  const [turmaToDelete, setTurmaToDelete] = useState<any>(null);
  const [previaExclusao, setPreviaExclusao] = useState<{ matriculas: number; presencas: number } | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);

  const podeGerenciar = user?.role !== 'professor';

  useEffect(() => {
    if (!turmaToDelete) {
      setPreviaExclusao(null);
      setCarregandoPrevia(false);
      return;
    }
    let ativo = true;
    setCarregandoPrevia(true);
    setPreviaExclusao(null);
    api
      .get(`/turmas/${turmaToDelete.id_turma}/exclusao/previa`)
      .then((res) => {
        if (ativo) setPreviaExclusao(res.data);
      })
      .catch(() => {
        if (ativo) setPreviaExclusao(null);
      })
      .finally(() => {
        if (ativo) setCarregandoPrevia(false);
      });
    return () => {
      ativo = false;
    };
  }, [turmaToDelete]);

  const filteredTurmas = turmas?.filter((t: any) =>
    (t.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.professor?.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const confirmDelete = async () => {
    if (!turmaToDelete) return;
    try {
      await api.delete(`/turmas/${turmaToDelete.id_turma}`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
      throw new Error(msg || 'Erro ao excluir turma.');
    }
    mutate('/turmas/');
    toast('Turma excluída.', 'success');
    setTurmaToDelete(null);
  };

  const descricaoExclusao = (() => {
    if (carregandoPrevia) {
      return 'Verificando matrículas e presenças vinculadas a esta turma...';
    }
    if (previaExclusao) {
      const { matriculas, presencas } = previaExclusao;
      const txtMatriculas = `${matriculas} ${matriculas === 1 ? 'matrícula' : 'matrículas'}`;
      const txtPresencas = `${presencas} ${presencas === 1 ? 'presença' : 'presenças'}`;
      return `Ao excluir esta turma, serão apagadas ${txtMatriculas} e ${txtPresencas} vinculadas. Esta ação não pode ser desfeita.`;
    }
    return 'Isso removerá os vínculos com os alunos matriculados e os registros de presença. Esta ação não pode ser desfeita.';
  })();

  return (
    <div>
      <PageHeader
        title="Turmas"
        description="Organize horários, professores e categorias das aulas."
        actions={
          podeGerenciar ? (
            <Button asChild leftIcon={<Plus className="size-4" />}>
              <Link href="/dashboard/turmas/novo">Nova turma</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="text"
          aria-label="Buscar turma"
          placeholder="Buscar turma por nome ou professor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <Alert tone="danger" title="Erro ao carregar turmas" action={<Button variant="secondary" size="sm" onClick={() => recarregar()}>Tentar novamente</Button>}>
          Não foi possível obter a lista de turmas.
        </Alert>
      ) : filteredTurmas.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title={searchTerm ? 'Nenhuma turma encontrada' : 'Nenhuma turma cadastrada'}
          description={
            searchTerm
              ? 'Tente outro termo de busca.'
              : podeGerenciar
                ? 'Crie a primeira turma para começar a matricular alunos.'
                : 'Nenhuma turma atribuída no momento.'
          }
          action={!searchTerm && podeGerenciar ? <Button asChild><Link href="/dashboard/turmas/novo">Nova turma</Link></Button> : undefined}
        />
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Turma</TH>
              <TH>Modalidade</TH>
              <TH>Professor</TH>
              <TH>Dias</TH>
              <TH>Horário</TH>
              <TH className="w-12"><span className="sr-only">Ações</span></TH>
            </TR>
          </THead>
          <TBody>
            {filteredTurmas.map((turma: any) => {
              const nome = turma.descricao || `Turma #${turma.id_turma}`;
              return (
                <TR key={turma.id_turma}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{iniciais(nome)}</span>
                      <div className="min-w-0">
                        <Link href={`/dashboard/turmas/${turma.id_turma}`} className="font-medium text-fg hover:text-primary">{nome}</Link>
                        {turma.categoria_idade ? <p className="text-xs text-fg-muted">{turma.categoria_idade}</p> : null}
                      </div>
                    </div>
                  </TD>
                  <TD><Badge tone="primary">{turma.modalidade?.nome || 'Geral'}</Badge></TD>
                  <TD className={turma.professor?.nome ? undefined : 'text-fg-muted'}>{turma.professor?.nome || 'Não atribuído'}</TD>
                  <TD className="text-fg-muted">{Array.isArray(turma.dias_semana) ? turma.dias_semana.join(', ') : (turma.dias_semana || '—')}</TD>
                  <TD className="whitespace-nowrap tabular-nums text-fg-muted">{formatarHora(turma.horario_inicio)} - {formatarHora(turma.horario_fim)}</TD>
                  <TD>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton aria-label={`Mais ações de ${nome}`} size="sm"><MoreHorizontal /></IconButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => router.push(`/dashboard/turmas/${turma.id_turma}`)}>Ver detalhes</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => router.push(`/dashboard/turmas/${turma.id_turma}/editar`)}>Editar</DropdownMenuItem>
                        {podeGerenciar ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem tone="danger" onSelect={() => setTurmaToDelete(turma)}>Excluir</DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!turmaToDelete}
        onOpenChange={(v) => { if (!v) setTurmaToDelete(null); }}
        title="Excluir turma"
        description={descricaoExclusao}
        confirmText={turmaToDelete?.descricao || `Turma #${turmaToDelete?.id_turma}`}
        confirmLabel="Excluir turma"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
