'use client';

import React from 'react';
import Link from 'next/link';
import { LogIn, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export function CabecalhoPublico() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 sticky top-0 z-10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
          GE
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100 text-lg leading-none">Portal Esportivo</p>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Acompanhe as competições
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
          title="Alterar tema"
          aria-label="Alterar tema"
        >
          {theme === 'dark' ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} />}
        </button>
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2"
        >
          <LogIn size={14} />
          Área restrita
        </Link>
      </div>
    </header>
  );
}

export function PaginaPublica({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <CabecalhoPublico />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">{children}</main>
    </div>
  );
}
