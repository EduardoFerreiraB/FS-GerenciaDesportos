'use client';

import React from 'react';
import type { ArtilhariaPublica as Artilharia } from '@/types/publico';

export default function ArtilhariaPublica({ artilharia }: { artilharia: Artilharia }) {
  if (artilharia.artilheiros.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Nenhum gol com autoria registrada até agora.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {artilharia.possui_jogos_em_andamento && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Inclui gols de jogos em andamento, sinalizados ao lado do total.
        </p>
      )}
      <ol className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 divide-y divide-slate-100 dark:divide-slate-700/50">
        {artilharia.artilheiros.map((a) => (
          <li key={`${a.id_equipe}-${a.posicao}-${a.nome_esportivo}`} className="px-4 py-3 flex items-center gap-4 text-sm">
            <span className="w-6 font-bold text-slate-400">{a.posicao}</span>
            <span className="flex-1 min-w-0">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {a.nome_esportivo}
                {a.numero_camisa !== null && <span className="text-slate-400 font-normal"> · {a.numero_camisa}</span>}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{a.nome_equipe}</span>
            </span>
            <span className="text-right">
              <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{a.gols}</span>
              {a.gols_em_andamento > 0 && (
                <span className="block text-[10px] text-amber-600">{a.gols_em_andamento} em andamento</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
