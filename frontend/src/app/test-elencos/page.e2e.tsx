'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import GestaoEquipes from '@/components/competicoes/elencos/GestaoEquipes';

function TestElencosInner() {
  const searchParams = useSearchParams();
  const idEdicaoParam = searchParams.get('idEdicao');
  const idEdicao = idEdicaoParam ? parseInt(idEdicaoParam, 10) : 1;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Gestão de Elencos (E2E Test Harness)</h1>
        <GestaoEquipes idEdicaoCompeticao={idEdicao} />
      </div>
    </div>
  );
}

export default function TestElencosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Carregando painel de teste...</div>}>
      <TestElencosInner />
    </Suspense>
  );
}
