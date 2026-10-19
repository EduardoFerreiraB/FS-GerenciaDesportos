'use client';

import React from 'react';
import { Calendar, MapPin } from 'lucide-react';
import type { PartidaPublica } from '@/types/publico';
import { formatarData, formatarHora } from '@/lib/formatos';
import { rotuloFase } from '@/lib/rotulos';

const ROTULO_ESTADO: Record<PartidaPublica['estado'], string> = {
  AGENDADA: 'Agendado',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Encerrado',
  CANCELADA: 'Cancelado',
};

function contexto(partida: PartidaPublica): string {
  if (partida.fase) {
    const jogo = partida.ordem_jogo === 2 ? ' · volta' : '';
    return `${rotuloFase(partida.fase)}${jogo}`;
  }
  const partes = [partida.nome_grupo, partida.rodada ? `Rodada ${partida.rodada}` : null];
  return partes.filter(Boolean).join(' · ');
}

function CartaoPartida({ partida }: { partida: PartidaPublica }) {
  const data = formatarData(partida.data);
  const hora = formatarHora(partida.hora);
  const temPlacar = partida.gols_mandante !== null && partida.gols_visitante !== null;
  const temPenaltis = partida.penaltis_mandante !== null && partida.penaltis_visitante !== null;

  return (
    <li
      data-testid={`partida-publica-${partida.id_partida}`}
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden"
    >
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600 dark:text-slate-300">{contexto(partida)}</span>
        <span
          className={`font-semibold uppercase tracking-wide ${
            partida.estado === 'EM_ANDAMENTO' ? 'text-amber-600' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {ROTULO_ESTADO[partida.estado]}
        </span>
      </div>
      <div className="px-4 py-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="text-right font-bold text-slate-800 dark:text-slate-100 truncate">{partida.nome_mandante}</span>
        <span className="text-center min-w-16">
          {temPlacar ? (
            <>
              <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                {partida.gols_mandante} x {partida.gols_visitante}
              </span>
              {temPenaltis && (
                <span className="block text-xs text-slate-500">
                  pên. {partida.penaltis_mandante} x {partida.penaltis_visitante}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs font-bold text-slate-400 uppercase">vs</span>
          )}
        </span>
        <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{partida.nome_visitante}</span>
      </div>
      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} />
          {data ? `${data}${hora ? ` às ${hora}` : ''}` : 'Data a definir'}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} />
          {partida.local ?? 'Local a definir'}
        </span>
      </div>
    </li>
  );
}

export default function JogosPublicos({ partidas }: { partidas: PartidaPublica[] }) {
  if (partidas.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        A tabela de jogos ainda não foi gerada.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {partidas.map((p) => (
        <CartaoPartida key={p.id_partida} partida={p} />
      ))}
    </ul>
  );
}
