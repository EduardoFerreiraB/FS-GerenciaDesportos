'use client';

import React from 'react';
import type { ChaveamentoPublico as Chaveamento, DueloPublico } from '@/types/publico';
import { descreverOrigem, rotuloFase } from './formatos';

function CartaoDuelo({ duelo }: { duelo: DueloPublico }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 divide-y divide-slate-100 dark:divide-slate-700/50">
      {duelo.vagas.map((vaga) => {
        const venceu = vaga.id_equipe !== null && vaga.id_equipe === duelo.id_equipe_vencedora;
        return (
          <div
            key={vaga.posicao}
            className={`px-3 py-2 text-sm ${venceu ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}
          >
            {vaga.nome_equipe ?? (
              <span className="italic text-slate-400">{descreverOrigem(vaga.descricao_origem) ?? 'A definir'}</span>
            )}
          </div>
        );
      })}
      {duelo.ida_volta && (
        <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">Ida e volta</p>
      )}
    </div>
  );
}

export default function ChaveamentoPublico({ chaveamento }: { chaveamento: Chaveamento }) {
  if (chaveamento.duelos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        O chaveamento ainda não foi gerado.
      </p>
    );
  }

  // A API já devolve as fases em ordem: primeira fase até a final.
  const fases: { fase: string; duelos: DueloPublico[] }[] = [];
  for (const duelo of chaveamento.duelos) {
    const atual = fases[fases.length - 1];
    if (atual && atual.fase === duelo.fase) atual.duelos.push(duelo);
    else fases.push({ fase: duelo.fase, duelos: [duelo] });
  }

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {fases.map(({ fase, duelos }) => (
        <section key={fase} className="min-w-56 flex-1 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {rotuloFase(fase)}
          </h3>
          {duelos.map((d) => (
            <CartaoDuelo key={d.id_duelo} duelo={d} />
          ))}
        </section>
      ))}
    </div>
  );
}
