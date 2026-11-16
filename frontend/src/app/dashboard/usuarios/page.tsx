'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { ShieldCheck, Search, Plus, MoreHorizontal, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/context/NotificationContext';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

const PERFIS: Record<string, { rotulo: string; tom: 'danger' | 'primary' | 'success' | 'neutral' }> = {
  admin: { rotulo: 'Administrador', tom: 'danger' },
  coordenador: { rotulo: 'Coordenador', tom: 'primary' },
  professor: { rotulo: 'Professor', tom: 'success' },
  assistente: { rotulo: 'Assistente', tom: 'neutral' },
};

export default function UsuariosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: users, error, isLoading, mutate: recarregar } = useSWR('/users', fetcher);
  const { toast } = useNotification();
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const filteredUsers = users?.filter((u: any) => u.username.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/users/${userToDelete.id_usuario}`);
      mutate('/users');
      toast('Usuário excluído com sucesso.', 'success');
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erro ao excluir usuário.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Gerencie Coordenadores e Administradores do sistema."
        actions={
          <Button asChild leftIcon={<Plus className="size-4" />}>
            <Link href="/dashboard/usuarios/novo">Novo usuário</Link>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="search"
          aria-label="Buscar por nome de usuário"
          placeholder="Buscar por nome de usuário..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <Alert
          tone="danger"
          title="Erro ao carregar usuários"
          action={
            <Button size="sm" variant="secondary" onClick={() => recarregar()}>
              Tentar novamente
            </Button>
          }
        >
          Acesso restrito ou falha de conexão.
        </Alert>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck />}
          title={searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
          description={searchTerm ? `Nada encontrado para "${searchTerm}".` : undefined}
        />
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Usuário</TH>
              <TH>Perfil</TH>
              <TH className="text-right">
                <span className="sr-only">Ações</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {filteredUsers.map((u: any) => {
              const perfil = PERFIS[u.role] ?? { rotulo: u.role, tom: 'neutral' as const };
              return (
                <TR key={u.id_usuario}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold uppercase text-primary"
                      >
                        {u.username.slice(0, 2)}
                      </div>
                      <span className="font-medium text-fg">{u.username}</span>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={perfil.tom} dot>
                      {perfil.rotulo}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton aria-label={`Mais ações para ${u.username}`} variant="ghost" size="sm">
                          <MoreHorizontal className="size-4" />
                        </IconButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem tone="danger" onSelect={() => setUserToDelete(u)}>
                          <Trash2 className="size-4" /> Excluir
                        </DropdownMenuItem>
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
        open={!!userToDelete}
        onOpenChange={(v) => !v && setUserToDelete(null)}
        title="Excluir usuário?"
        description={
          <>
            O acesso de <strong>{userToDelete?.username}</strong> ao sistema será revogado imediatamente.
          </>
        }
        confirmText={userToDelete?.username}
        confirmLabel="Excluir usuário"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
