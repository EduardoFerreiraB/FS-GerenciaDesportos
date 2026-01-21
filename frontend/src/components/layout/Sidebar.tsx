'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Dumbbell, 
  LogOut, 
  ClipboardList,
  UserCheck,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();
  
  const allMenuItems = [
    { 
      icon: LayoutDashboard, 
      label: 'Dashboard', 
      href: '/dashboard', 
      roles: ['admin', 'coordenador', 'professor', 'assistente'] 
    },
    { 
      icon: Users, 
      label: 'Alunos', 
      href: '/dashboard/alunos', 
      roles: ['admin', 'coordenador', 'professor', 'assistente'] 
    },
    { 
      icon: UserCheck, 
      label: 'Professores', 
      href: '/dashboard/professores', 
      roles: ['admin', 'coordenador'] 
    },
    { 
      icon: GraduationCap, 
      label: 'Turmas', 
      href: '/dashboard/turmas', 
      roles: ['admin', 'coordenador', 'professor'] 
    },
    { 
      icon: Dumbbell, 
      label: 'Modalidades', 
      href: '/dashboard/modalidades', 
      roles: ['admin', 'coordenador'] 
    },
    { 
      icon: ClipboardList, 
      label: 'Matrículas', 
      href: '/dashboard/matriculas', 
      roles: ['admin', 'coordenador', 'assistente'] 
    },
    { 
      icon: ShieldAlert, 
      label: 'Usuários', 
      href: '/dashboard/usuarios', 
      roles: ['admin'] 
    },
  ];

  // Se ainda estiver carregando os dados do usuário, mostra um skeleton ou spinner na sidebar
  if (isLoading) {
    return (
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-10 p-6">
         <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="mt-8 space-y-3">
                {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-100 rounded"></div>)}
            </div>
         </div>
      </aside>
    );
  }

  // Filtra itens baseado na role
  const menuItems = allMenuItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-10">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-slate-100">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
          GE
        </div>
        <span className="font-bold text-slate-800 text-lg">Gerencia Esporte</span>
      </div>

      {/* Menu Principal */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 pl-2">
          Menu Principal
        </h3>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm',
                  isActive 
                    ? 'bg-blue-50 text-primary' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon size={20} className={isActive ? 'text-primary' : 'text-slate-400'} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Perfil do Usuário */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-sm uppercase">
            {user?.username?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.username || 'Usuário'}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{user?.role || 'Visitante'}</p>
          </div>
          <button 
            onClick={logout}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}