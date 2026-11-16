'use client';

import React from 'react';
import Link from 'next/link';
import { LogIn, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { Button, IconButton } from '@/components/ui';

export function CabecalhoPublico() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-focus">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-solid text-sm font-bold text-on-primary">
            GE
          </span>
          <span className="text-base font-semibold tracking-tight text-fg">Portal Esportivo</span>
        </Link>

        <div className="flex items-center gap-2">
          <IconButton variant="ghost" aria-label="Alterar tema" title="Alterar tema" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
          <Button asChild variant="secondary" size="md">
            <Link href="/login">
              <LogIn className="size-4" aria-hidden="true" />
              Área restrita
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function PaginaPublica({ children, faixa }: { children: React.ReactNode; faixa?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <CabecalhoPublico />
      {faixa}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
