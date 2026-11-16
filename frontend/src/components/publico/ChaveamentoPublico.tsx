'use client';

import React from 'react';
import { Network } from 'lucide-react';
import type { ChaveamentoPublico as Chaveamento } from '@/types/publico';
import { ChaveFases, duelosPublicos } from '@/components/competicoes/visual';
import { EmptyState } from '@/components/ui';

export default function ChaveamentoPublico({ chaveamento }: { chaveamento: Chaveamento }) {
  if (chaveamento.duelos.length === 0) {
    return (
      <EmptyState
        icon={<Network />}
        title="O chaveamento ainda não foi gerado."
        description="Os confrontos aparecem aqui quando a fase eliminatória for definida."
      />
    );
  }
  return <ChaveFases duelos={duelosPublicos(chaveamento.duelos)} />;
}
