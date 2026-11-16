'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Dumbbell,
  ClipboardList,
  UserCheck,
  ShieldAlert,
  Trophy,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Skeleton, Tooltip } from '@/components/ui';
import { cn } from '@/lib/cn';

interface ItemMenu {
  icon: LucideIcon;
  label: string;
  href: string;
  roles: string[];
}

interface GrupoMenu {
  rotulo: string;
  itens: ItemMenu[];
}

const GRUPOS: GrupoMenu[] = [
  {
    rotulo: 'Escolinha',
    itens: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', roles: ['admin', 'coordenador', 'professor', 'assistente'] },
      { icon: Users, label: 'Alunos', href: '/dashboard/alunos', roles: ['admin', 'coordenador', 'professor', 'assistente'] },
      { icon: UserCheck, label: 'Professores', href: '/dashboard/professores', roles: ['admin', 'coordenador'] },
      { icon: GraduationCap, label: 'Turmas', href: '/dashboard/turmas', roles: ['admin', 'coordenador', 'professor'] },
      { icon: Dumbbell, label: 'Modalidades', href: '/dashboard/modalidades', roles: ['admin', 'coordenador'] },
      { icon: ClipboardList, label: 'Matrículas', href: '/dashboard/matriculas', roles: ['admin', 'coordenador', 'assistente'] },
    ],
  },
  {
    rotulo: 'Competições',
    itens: [
      { icon: Trophy, label: 'Competições', href: '/dashboard/competicoes', roles: ['admin', 'coordenador'] },
      { icon: CalendarDays, label: 'Eventos', href: '/dashboard/eventos', roles: ['admin', 'coordenador'] },
    ],
  },
  {
    rotulo: 'Administração',
    itens: [{ icon: ShieldAlert, label: 'Usuários', href: '/dashboard/usuarios', roles: ['admin'] }],
  },
];

interface SidebarProps {
  recolhida: boolean;
  onAlternarRecolhida: () => void;
  gavetaAberta: boolean;
  onGavetaChange: (aberta: boolean) => void;
}

function ativo(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ recolhida, onAlternarRecolhida, gavetaAberta, onGavetaChange }: SidebarProps) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  // Fecha a gaveta ao navegar (mobile).
  useEffect(() => {
    onGavetaChange(false);
  }, [pathname, onGavetaChange]);

  useEffect(() => {
    if (!gavetaAberta) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onGavetaChange(false);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [gavetaAberta, onGavetaChange]);

  const grupos = GRUPOS.map((g) => ({
    ...g,
    itens: g.itens.filter((item) => user && item.roles.includes(user.role)),
  })).filter((g) => g.itens.length > 0);

  // Na gaveta (mobile) o menu sempre aparece expandido.
  const compacta = recolhida;

  return (
    <>
      {gavetaAberta && (
        <div
          data-testid="sidebar-fundo"
          className="fixed inset-0 z-30 bg-fg/40 lg:hidden"
          onClick={() => onGavetaChange(false)}
          aria-hidden="true"
        />
      )}
      <aside
        data-testid="sidebar"
        data-recolhida={recolhida ? 'true' : 'false'}
        aria-label="Menu principal"
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-line bg-surface text-fg transition-[transform,width] duration-150',
          gavetaAberta ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
          compacta ? 'lg:w-16' : 'lg:w-64',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-line px-4', compacta && 'lg:justify-center lg:px-0')}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-solid text-sm font-bold text-on-primary">
            GE
          </div>
          <span className={cn('truncate text-base font-semibold tracking-tight', compacta && 'lg:hidden')}>Gerencia Esporte</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Seções">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.rotulo} className="mb-5">
                <h3
                  className={cn(
                    'mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle',
                    compacta && 'lg:sr-only',
                  )}
                >
                  {grupo.rotulo}
                </h3>
                <ul className="space-y-1">
                  {grupo.itens.map((item) => {
                    const Icon = item.icon;
                    const marcado = ativo(pathname, item.href);
                    const link = (
                      <Link
                        href={item.href}
                        aria-current={marcado ? 'page' : undefined}
                        aria-label={compacta ? item.label : undefined}
                        className={cn(
                          'flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-focus',
                          compacta && 'lg:justify-center lg:px-0',
                          marcado ? 'bg-primary-soft text-primary' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                        )}
                      >
                        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                        <span className={cn(compacta && 'lg:hidden')}>{item.label}</span>
                      </Link>
                    );
                    return (
                      <li key={item.href}>
                        {compacta ? (
                          <Tooltip content={item.label} side="right">
                            {link}
                          </Tooltip>
                        ) : (
                          link
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>

        <div className="hidden shrink-0 border-t border-line p-3 lg:block">
          <button
            type="button"
            onClick={onAlternarRecolhida}
            aria-label={recolhida ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-pressed={recolhida}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-fg-muted outline-none transition-colors duration-150 hover:bg-surface-muted hover:text-fg focus-visible:ring-4 focus-visible:ring-focus',
              compacta && 'justify-center px-0',
            )}
          >
            {recolhida ? <PanelLeftOpen className="size-[18px]" aria-hidden="true" /> : <PanelLeftClose className="size-[18px]" aria-hidden="true" />}
            {!recolhida && <span>Recolher</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
