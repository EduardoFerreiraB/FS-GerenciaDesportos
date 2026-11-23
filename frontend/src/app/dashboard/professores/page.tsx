'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Users, Search, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
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

function formatarCpf(valor: string | null | undefined): string {
  const d = (valor || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatarTelefone(valor: string | null | undefined): string {
  const d = (valor || '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function ProfessoresPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: professores, error, isLoading, mutate: recarregar } = useSWR('/professores/', fetcher);
  const { toast } = useNotification();
  const [professorToDelete, setProfessorToDelete] = useState<any>(null);

  const termo = searchTerm.trim().toLowerCase();
  const termoDigitos = searchTerm.replace(/\D/g, '');

  const filteredProfessores =
    professores?.filter((prof: any) => {
      if (!termo) return true;
      const nomeMatch = (prof.nome || '').toLowerCase().includes(termo);
      const usuarioMatch = (prof.usuario?.username || '').toLowerCase().includes(termo);
      const cpfDigitos = (prof.cpf || '').replace(/\D/g, '');
      const cpfFormatado = formatarCpf(prof.cpf).toLowerCase();
      const cpfMatch =
        cpfFormatado.includes(termo) ||
        (termoDigitos.length > 0 && cpfDigitos.includes(termoDigitos));
      return nomeMatch || usuarioMatch || cpfMatch;
    }) || [];

  const confirmDelete = async () => {
    if (!professorToDelete) return;
    try {
      await api.delete(`/professores/${professorToDelete.id_professor}`);
      await recarregar(
        (atual: any[] | undefined) =>
          (atual ?? []).filter((a: any) => a.id_professor !== professorToDelete.id_professor),
        { revalidate: true },
      );
      toast('Professor excluído com sucesso.', 'success');
      setProfessorToDelete(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
      throw new Error(msg || 'Erro ao excluir professor. Verifique se ele não possui turmas vinculadas.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Professores"
        description="Gerencie a equipe docente e seus acessos."
        actions={
          <Button asChild leftIcon={<Plus className="size-4" />}>
            <Link href="/dashboard/professores/novo">Novo professor</Link>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="search"
          aria-label="Buscar professor por nome, CPF ou usuário"
          placeholder="Buscar professor por nome, CPF ou usuário..."
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
          title="Erro ao carregar professores"
          action={
            <Button size="sm" variant="secondary" onClick={() => recarregar()}>
              Tentar novamente
            </Button>
          }
        >
          Verifique sua conexão.
        </Alert>
      ) : filteredProfessores.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={searchTerm ? 'Nenhum professor encontrado' : 'Nenhum professor cadastrado'}
          description={searchTerm ? `Nada encontrado para "${searchTerm}".` : 'Cadastre o primeiro professor para começar.'}
          action={
            searchTerm ? undefined : (
              <Button asChild leftIcon={<Plus className="size-4" />}>
                <Link href="/dashboard/professores/novo">Novo professor</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Professor</TH>
                <TH>CPF</TH>
                <TH>Contato</TH>
                <TH>Acesso ao sistema</TH>
                <TH className="text-right">
                  <span className="sr-only">Ações</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {filteredProfessores.map((prof: any) => (
                <TR key={prof.id_professor}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
                      >
                        {iniciais(prof.nome)}
                      </div>
                      <Link
                        href={`/dashboard/professores/${prof.id_professor}`}
                        className="font-medium text-fg hover:text-primary"
                      >
                        {prof.nome}
                      </Link>
                    </div>
                  </TD>
                  <TD className="tabular-nums text-fg-muted">{prof.cpf ? formatarCpf(prof.cpf) : '—'}</TD>
                  <TD className="tabular-nums text-fg-muted">{prof.contato ? formatarTelefone(prof.contato) : '—'}</TD>
                  <TD>
                    {prof.usuario ? (
                      <span className="text-fg-muted">@{prof.usuario.username}</span>
                    ) : (
                      <span className="text-fg-subtle">Sem usuário</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton aria-label={`Mais ações para ${prof.nome}`} variant="ghost" size="sm">
                          <MoreHorizontal className="size-4" />
                        </IconButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/professores/${prof.id_professor}`}>
                            <Pencil className="size-4" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem tone="danger" onSelect={() => setProfessorToDelete(prof)}>
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
            {filteredProfessores.length} {filteredProfessores.length === 1 ? 'professor' : 'professores'}
          </p>
        </>
      )}

      <ConfirmDialog
        open={!!professorToDelete}
        onOpenChange={(v) => !v && setProfessorToDelete(null)}
        title="Excluir professor?"
        description={
          <>
            Essa ação não poderá ser desfeita. O professor <strong>{professorToDelete?.nome}</strong> será removido.
          </>
        }
        confirmText={professorToDelete?.nome}
        confirmLabel="Excluir professor"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
