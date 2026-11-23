'use client';

import React from 'react';
import { Network } from 'lucide-react';
import type { ChaveamentoPublico as Chaveamento } from '@/types/publico';
import { ChaveFases, type DueloChave } from '@/components/competicoes/visual';
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

  const duelosNormalizados: DueloChave[] = chaveamento.duelos.map((d) => ({
    id: d.id_duelo,
    fase: d.fase,
    ordem: d.posicao_chave,
    status: d.estado,
    idaVolta: d.ida_volta,
    idVencedor: d.id_equipe_vencedora,
    vagas: [...d.vagas]
      .sort((a, b) => a.posicao - b.posicao)
      .map((v, idx) => ({
        idEquipe: v.id_equipe,
        nome: v.nome_equipe,
        pendente: v.descricao_origem,
        gols: d.placar?.gols?.[idx] ?? null,
        penaltis: d.placar?.penaltis?.[idx] ?? null,
      })),
  }));

  return <ChaveFases duelos={duelosNormalizados} />;
}
