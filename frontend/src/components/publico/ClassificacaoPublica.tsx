'use client';

import React from 'react';
import type { ClassificacaoPublica as Classificacao, LinhaClassificacaoPublica } from '@/types/publico';

const COLUNAS: { chave: keyof LinhaClassificacaoPublica; rotulo: string; titulo: string }[] = [
  { chave: 'pontos', rotulo: 'P', titulo: 'Pontos' },
  { chave: 'jogos', rotulo: 'J', titulo: 'Jogos' },
  { chave: 'vitorias', rotulo: 'V', titulo: 'Vitórias' },
  { chave: 'empates', rotulo: 'E', titulo: 'Empates' },
  { chave: 'derrotas', rotulo: 'D', titulo: 'Derrotas' },
  { chave: 'gols_pro', rotulo: 'GP', titulo: 'Gols pró' },
  { chave: 'gols_contra', rotulo: 'GC', titulo: 'Gols contra' },
  { chave: 'saldo_gols', rotulo: 'SG', titulo: 'Saldo de gols' },
];

function Tabela({ titulo, linhas }: { titulo?: string; linhas: LinhaClassificacaoPublica[] }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden">
      {titulo && (
        <h3 className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700/50">
          {titulo}
        </h3>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Equipe</th>
              {COLUNAS.map((c) => (
                <th key={c.chave} className="px-2 py-2 text-center" title={c.titulo}>
                  {c.rotulo}
                </th>
              ))}
              <th className="px-2 py-2 text-center" title="Aproveitamento">%</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id_equipe} className="border-t border-slate-100 dark:border-slate-700/50">
                <td className="px-3 py-2 font-semibold text-slate-500">{l.posicao}</td>
                <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">
                  {l.nome_equipe}
                  {l.empate_persistente && (
                    <span
                      className="ml-2 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded"
                      title="Empate não resolvido pelos critérios; aguarda decisão da organização"
                    >
                      empate
                    </span>
                  )}
                </td>
                {COLUNAS.map((c) => (
                  <td key={c.chave} className="px-2 py-2 text-center text-slate-700 dark:text-slate-300">
                    {l[c.chave] as number}
                  </td>
                ))}
                <td className="px-2 py-2 text-center text-slate-700 dark:text-slate-300">
                  {Math.round(l.aproveitamento)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ClassificacaoPublica({ classificacao }: { classificacao: Classificacao }) {
  const tabelas = classificacao.grupos
    ? classificacao.grupos.map((g) => <Tabela key={g.id_grupo} titulo={g.nome} linhas={g.linhas} />)
    : [<Tabela key="geral" linhas={classificacao.linhas ?? []} />];

  return (
    <div className="space-y-4">
      {classificacao.possui_empate_persistente && (
        <p className="text-sm rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-amber-800 dark:text-amber-200">
          Há empate que os critérios de desempate não resolveram. A ordem entre essas equipes ainda será decidida pela organização.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{tabelas}</div>
    </div>
  );
}
