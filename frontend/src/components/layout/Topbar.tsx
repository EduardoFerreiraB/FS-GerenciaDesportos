'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, KeyRound, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useBreadcrumbItens, type ItemTrilha } from '@/context/BreadcrumbContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@/components/ui';
import ChangePasswordModal from '../auth/ChangePasswordModal';

const ROTULOS_ROTA: Record<string, string> = {
  dashboard: 'Dashboard',
  alunos: 'Alunos',
  professores: 'Professores',
  turmas: 'Turmas',
  modalidades: 'Modalidades',
  matriculas: 'Matrículas',
  usuarios: 'Usuários',
  competicoes: 'Competições',
  eventos: 'Eventos',
  novo: 'Novo',
  nova: 'Nova',
  editar: 'Editar',
};

/** Trilha padrão a partir da rota; segmentos desconhecidos (ids) são omitidos. */
export function trilhaPadrao(pathname: string): ItemTrilha[] {
  const segmentos = pathname.split('/').filter(Boolean);
  const itens: ItemTrilha[] = [];
  let acumulado = '';
  segmentos.forEach((seg) => {
    acumulado += `/${seg}`;
    const rotulo = ROTULOS_ROTA[seg];
    if (rotulo) itens.push({ label: rotulo, href: acumulado });
  });
  return itens;
}

interface TopbarProps {
  onAbrirMenu: () => void;
}

export default function Topbar({ onAbrirMenu }: TopbarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const publicados = useBreadcrumbItens();
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [trocaObrigatoria, setTrocaObrigatoria] = useState(false);

  useEffect(() => {
    setTrocaObrigatoria(Boolean(user?.must_change_password));
  }, [user]);

  const trilha = publicados ?? trilhaPadrao(pathname);
  const inicial = (user?.username?.charAt(0) || '?').toUpperCase();

  return (
    <>
      <header
        data-testid="topbar"
        className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur sm:px-6 lg:px-8"
      >
        <IconButton aria-label="Abrir menu" variant="ghost" className="lg:hidden" onClick={onAbrirMenu}>
          <Menu />
        </IconButton>

        <nav aria-label="Trilha" data-testid="trilha-topbar" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1 text-sm text-fg-muted">
            {trilha.map((item, i) => {
              const ultimo = i === trilha.length - 1;
              return (
                <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />}
                  {item.href && !ultimo ? (
                    <Link href={item.href} className="truncate rounded outline-none transition-colors hover:text-fg focus-visible:ring-4 focus-visible:ring-focus">
                      {item.label}
                    </Link>
                  ) : (
                    <span aria-current={ultimo ? 'page' : undefined} className={ultimo ? 'truncate font-medium text-fg' : 'truncate'}>
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <IconButton
          aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          variant="ghost"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </IconButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu do usuário"
              data-testid="menu-usuario"
              className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary outline-none transition-colors duration-150 hover:bg-surface-muted focus-visible:ring-4 focus-visible:ring-focus"
            >
              {inicial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-fg">{user?.username ?? 'Carregando...'}</p>
              <p className="truncate text-xs capitalize text-fg-muted">{user?.role ?? ''}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSenhaAberta(true)}>
              <KeyRound className="size-4" aria-hidden="true" />
              Alterar senha
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => logout()}>
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {(senhaAberta || trocaObrigatoria) && (
        <ChangePasswordModal
          onClose={() => setSenhaAberta(false)}
          onSuccess={() => {
            setSenhaAberta(false);
            setTrocaObrigatoria(false);
            // Recarrega para atualizar must_change_password no usuario.
            window.location.reload();
          }}
          forceChange={trocaObrigatoria}
        />
      )}
    </>
  );
}
