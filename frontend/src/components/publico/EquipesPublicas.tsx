'use client';

import React from 'react';
import type { EquipePublica, GrupoPublico } from '@/types/publico';

export default function EquipesPublicas({ equipes, grupos }: { equipes: EquipePublica[]; grupos: GrupoPublico[] }) {
  if (equipes.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Nenhuma equipe inscrita até agora.
      </p>
    );
  }
  const nomeGrupo = new Map(grupos.map((g) => [g.id_grupo, g.nome]));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {equipes.map((equipe) => (
        <section
          key={equipe.id_equipe}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-4"
        >
          <header className="flex items-baseline justify-between gap-2 mb-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">
              {equipe.nome}
              {equipe.sigla && <span className="ml-2 text-xs text-slate-400 font-semibold">{equipe.sigla}</span>}
            </h3>
            {equipe.id_grupo !== null && (
              <span className="text-xs text-slate-500">{nomeGrupo.get(equipe.id_grupo)}</span>
            )}
          </header>
          {equipe.integrantes.length === 0 ? (
            <p className="text-xs text-slate-400">Elenco não divulgado.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {equipe.integrantes.map((i, indice) => (
                <li key={`${i.nome_esportivo}-${indice}`} className="flex gap-3 text-slate-700 dark:text-slate-300">
                  <span className="w-6 text-right font-semibold text-slate-400">{i.numero_camisa ?? '–'}</span>
                  <span className="flex-1">{i.nome_esportivo}</span>
                  {i.posicao && <span className="text-xs text-slate-400">{i.posicao}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
