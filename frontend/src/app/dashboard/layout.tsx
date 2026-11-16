'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { BreadcrumbProvider } from '@/context/BreadcrumbContext';
import { cn } from '@/lib/cn';

const CHAVE_SIDEBAR = 'sidebar-recolhida';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [recolhida, setRecolhida] = useState(false);
  const [gavetaAberta, setGavetaAberta] = useState(false);

  useEffect(() => {
    try {
      setRecolhida(localStorage.getItem(CHAVE_SIDEBAR) === '1');
    } catch {
      // sem armazenamento: usa o padrao expandido
    }
  }, []);

  const alternarRecolhida = useCallback(() => {
    setRecolhida((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_SIDEBAR, novo ? '1' : '0');
      } catch {
        // preferencia vale so para esta sessao
      }
      return novo;
    });
  }, []);

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen bg-canvas text-fg">
        <Sidebar
          recolhida={recolhida}
          onAlternarRecolhida={alternarRecolhida}
          gavetaAberta={gavetaAberta}
          onGavetaChange={setGavetaAberta}
        />
        <div className={cn('flex min-h-screen flex-col transition-[margin] duration-150', recolhida ? 'lg:ml-16' : 'lg:ml-64')}>
          <Topbar onAbrirMenu={() => setGavetaAberta(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1280px] space-y-8">{children}</div>
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
