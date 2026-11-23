'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { ShieldCheck, Search, Plus, MoreHorizontal, Trash2, UserCog } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useNotification } from '@/context/NotificationContext';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
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

const OPCOES_PERFIL_ADMIN = [
  { valor: 'admin', rotulo: 'Administrador' },
  { valor: 'coordenador', rotulo: 'Coordenador' },
  { valor: 'professor', rotulo: 'Professor' },
  { valor: 'assistente', rotulo: 'Assistente' },
];

const OPCOES_PERFIL_COORDENADOR = [
  { valor: 'professor', rotulo: 'Professor' },
  { valor: 'assistente', rotulo: 'Assistente' },
];

export default function UsuariosPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const podeAcessar = user?.role === 'admin' || user?.role === 'coordenador';
  useBreadcrumb([{ label: 'Dashboard', href: '/dashboard' }, { label: 'Usuários' }]);

  const { data: users, error, isLoading, mutate: recarregar } = useSWR(
    !authLoading && podeAcessar ? '/users' : null,
    fetcher,
  );
  const { toast } = useNotification();
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [userToEditRole, setUserToEditRole] = useState<any>(null);
  const [novoPerfil, setNovoPerfil] = useState<string>('professor');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);

  const filteredUsers = users?.filter((u: any) => u.username.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/users/${userToDelete.id_usuario}`);
      mutate('/users');
      toast('Usuário excluído com sucesso.', 'success');
      setUserToDelete(null);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erro ao excluir usuário.');
    }
  };

  const abrirEditarPerfil = (u: any) => {
    setErroPerfil(null);
    setNovoPerfil(u.role);
    setUserToEditRole(u);
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEditRole) return;
    setSalvandoPerfil(true);
    setErroPerfil(null);
    try {
      await api.put(`/users/${encodeURIComponent(userToEditRole.username)}/role`, { role: novoPerfil });
      await mutate('/users');
      toast('Perfil atualizado com sucesso.', 'success');
      setUserToEditRole(null);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
      const texto = msg || 'Erro ao atualizar perfil do usuário.';
      setErroPerfil(texto);
      toast(texto, 'error');
    } finally {
      setSalvandoPerfil(false);
    }
  };

  if (!authLoading && user && !podeAcessar) {
    return (
      <div className="space-y-6">
        <PageHeader title="Usuários" description="Gerencie os acessos do sistema." />
        <Alert tone="warning" title="Acesso restrito">
          Apenas administradores e coordenadores podem acessar a gestão de usuários.
        </Alert>
      </div>
    );
  }

  const opcoesPerfil = user?.role === 'admin' ? OPCOES_PERFIL_ADMIN : OPCOES_PERFIL_COORDENADOR;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description={
          user?.role === 'coordenador'
            ? 'Visualize os usuários e gerencie acessos de professores e assistentes.'
            : 'Gerencie os acessos e perfis de usuários do sistema.'
        }
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
              const ehPropriaConta =
                Boolean(user?.username) &&
                u.username.toLowerCase() === user!.username.toLowerCase();
              const alvoEhSuperiorOuIgualCoord = u.role === 'admin' || u.role === 'coordenador';
              const podeAlterar =
                !ehPropriaConta &&
                (user?.role === 'admin' || (user?.role === 'coordenador' && !alvoEhSuperiorOuIgualCoord));
              const podeExcluir = podeAlterar;

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
                      {ehPropriaConta ? <Badge tone="neutral">Você</Badge> : null}
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={perfil.tom} dot>
                      {perfil.rotulo}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    {podeAlterar || podeExcluir ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton aria-label={`Mais ações para ${u.username}`} variant="ghost" size="sm">
                            <MoreHorizontal className="size-4" />
                          </IconButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {podeAlterar ? (
                            <DropdownMenuItem onSelect={() => abrirEditarPerfil(u)}>
                              <UserCog className="size-4" /> Alterar perfil
                            </DropdownMenuItem>
                          ) : null}
                          {podeAlterar && podeExcluir ? <DropdownMenuSeparator /> : null}
                          {podeExcluir ? (
                            <DropdownMenuItem tone="danger" onSelect={() => setUserToDelete(u)}>
                              <Trash2 className="size-4" /> Excluir
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <Dialog
        open={!!userToEditRole}
        onOpenChange={(v) => {
          if (!v && !salvandoPerfil) setUserToEditRole(null);
        }}
      >
        {userToEditRole ? (
          <DialogContent
            title="Alterar perfil"
            description={`Selecione o novo perfil de acesso para ${userToEditRole.username}.`}
          >
            <form id="form-editar-perfil" onSubmit={salvarPerfil} className="space-y-4">
              {erroPerfil ? <Alert tone="danger">{erroPerfil}</Alert> : null}
              <Field label="Perfil de acesso" htmlFor="editar-perfil-usuario" required>
                <Select
                  id="editar-perfil-usuario"
                  value={novoPerfil}
                  onChange={(e) => setNovoPerfil(e.target.value)}
                >
                  {opcoesPerfil.map((op) => (
                    <option key={op.valor} value={op.valor}>
                      {op.rotulo}
                    </option>
                  ))}
                </Select>
              </Field>
            </form>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setUserToEditRole(null)} disabled={salvandoPerfil}>
                Cancelar
              </Button>
              <Button type="submit" form="form-editar-perfil" loading={salvandoPerfil}>
                Salvar perfil
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

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
