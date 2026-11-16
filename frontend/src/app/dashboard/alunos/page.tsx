'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { Users, Search, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { formatarData } from '@/lib/formatos';
import { useNotification } from '@/context/NotificationContext';
import {
  Alert,
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

const fetcher = (url: string) => api.get(url).then((res) => res.data);

function iniciais(nome: string) {
  const partes = (nome || '?').trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export default function AlunosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: alunos, error, isLoading, mutate: recarregar } = useSWR('/alunos/', fetcher);
  const { toast } = useNotification();
  const [alunoToDelete, setAlunoToDelete] = useState<any>(null);

  const filteredAlunos =
    alunos?.filter((aluno: any) => aluno.nome_completo.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  const confirmDelete = async () => {
    if (!alunoToDelete) return;
    try {
      await api.delete(`/alunos/${alunoToDelete.id_aluno}`);
      mutate('/alunos/', filteredAlunos.filter((a: any) => a.id_aluno !== alunoToDelete.id_aluno), false);
      toast('Aluno excluído com sucesso.', 'success');
    } catch {
      throw new Error('Erro ao excluir aluno. Verifique se ele não possui matrículas ativas.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alunos"
        description="Gerencie as matrículas e dados dos alunos."
        actions={
          <Button asChild leftIcon={<Plus className="size-4" />}>
            <Link href="/dashboard/alunos/novo">Nova matrícula</Link>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="search"
          aria-label="Buscar aluno por nome"
          placeholder="Buscar aluno por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <Alert
          tone="danger"
          title="Erro ao carregar alunos"
          action={
            <Button size="sm" variant="secondary" onClick={() => recarregar()}>
              Tentar novamente
            </Button>
          }
        >
          Verifique sua conexão.
        </Alert>
      ) : filteredAlunos.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={searchTerm ? 'Nenhum aluno encontrado' : 'Nenhum aluno cadastrado'}
          description={searchTerm ? `Nada encontrado para "${searchTerm}".` : 'Cadastre o primeiro aluno para começar.'}
          action={
            searchTerm ? undefined : (
              <Button asChild leftIcon={<Plus className="size-4" />}>
                <Link href="/dashboard/alunos/novo">Nova matrícula</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Aluno</TH>
                <TH>Nascimento</TH>
                <TH>Responsável</TH>
                <TH>Contato</TH>
                <TH className="text-right">
                  <span className="sr-only">Ações</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {filteredAlunos.map((aluno: any) => (
                <TR key={aluno.id_aluno}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
                      >
                        {iniciais(aluno.nome_completo)}
                      </div>
                      <Link
                        href={`/dashboard/alunos/${aluno.id_aluno}`}
                        className="font-medium text-fg hover:text-primary"
                      >
                        {aluno.nome_completo}
                      </Link>
                    </div>
                  </TD>
                  <TD className="tabular-nums">{formatarData(aluno.data_nascimento) ?? '—'}</TD>
                  <TD className="text-fg-muted">{aluno.nome_mae || aluno.nome_pai || '—'}</TD>
                  <TD className="tabular-nums text-fg-muted">{aluno.telefone_1 || '—'}</TD>
                  <TD className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton aria-label={`Mais ações para ${aluno.nome_completo}`} variant="ghost" size="sm">
                          <MoreHorizontal className="size-4" />
                        </IconButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/alunos/${aluno.id_aluno}`}>
                            <Pencil className="size-4" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem tone="danger" onSelect={() => setAlunoToDelete(aluno)}>
                          <Trash2 className="size-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="text-sm text-fg-muted">
            {filteredAlunos.length} {filteredAlunos.length === 1 ? 'aluno' : 'alunos'}
          </p>
        </>
      )}

      <ConfirmDialog
        open={!!alunoToDelete}
        onOpenChange={(v) => !v && setAlunoToDelete(null)}
        title="Excluir aluno?"
        description={
          <>
            Essa ação não poderá ser desfeita. O aluno <strong>{alunoToDelete?.nome_completo}</strong> será removido.
          </>
        }
        confirmText={alunoToDelete?.nome_completo}
        confirmLabel="Excluir aluno"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
