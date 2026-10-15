'use client';

import React, { useMemo } from 'react';
import { 
  Trophy, 
  Calendar, 
  MapPin, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Award
} from 'lucide-react';
import { Confronto } from '@/types/competicoes';

interface ArvoreMataMataProps {
  confrontos: Confronto[];
  onLancarPlacar?: (confronto: Confronto) => void;
  campeao?: { id_equipe: number; nome_equipe: string } | null;
  viceCampeao?: { id_equipe: number; nome_equipe: string } | null;
  semifinalistas?: Array<{ id_equipe: number; nome_equipe: string }>;
}

export default function ArvoreMataMata({
  confrontos,
  onLancarPlacar,
  campeao,
  viceCampeao,
}: ArvoreMataMataProps) {
  // Ordenação lógica das fases de eliminatórias
  const orderedPhases = useMemo(() => {
    const standardOrder = ['oitavas', 'quartas', 'semi', 'final', '3º'];

    const getPhaseRank = (phaseName: string): number => {
      const lower = phaseName.toLowerCase();
      if (lower.includes('oitava') || lower.includes('round of 16')) return 1;
      if (lower.includes('quarta') || lower.includes('quarter')) return 2;
      if (lower.includes('semi')) return 3;
      if (lower.includes('final') && !lower.includes('semi') && !lower.includes('quarta') && !lower.includes('oitava') && !lower.includes('3')) return 4;
      if (lower.includes('3') || lower.includes('terceiro')) return 5;
      return 10;
    };

    // Coleta todas as fases distintas dos confrontos
    const phasesMap: Record<string, Confronto[]> = {};
    confrontos.forEach((c) => {
      const faseKey = c.fase?.trim() || 'Fase Eliminatória';
      if (!phasesMap[faseKey]) {
        phasesMap[faseKey] = [];
      }
      phasesMap[faseKey].push(c);
    });

    const sortedPhaseKeys = Object.keys(phasesMap).sort((a, b) => {
      const rankA = getPhaseRank(a);
      const rankB = getPhaseRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });

    return sortedPhaseKeys.map((fase) => ({
      fase,
      confrontos: phasesMap[fase].sort((x, y) => x.id_confronto - y.id_confronto),
    }));
  }, [confrontos]);

  if (!confrontos || confrontos.length === 0) {
    return (
      <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
        <Trophy size={48} className="mx-auto text-slate-300 mb-3 opacity-60" />
        <h3 className="text-base font-bold text-slate-700">
          Nenhum confronto eliminatório encontrado
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Gere os confrontos de mata-mata ou agende partidas eliminatórias para visualizar o chaveamento da competição.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Campeão quando definido */}
      {campeao && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-white rounded-3xl p-6 shadow-lg shadow-amber-200/50 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in zoom-in-95">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-3.5 bg-white/20 backdrop-blur-md rounded-2xl">
              <Trophy size={36} className="text-yellow-100" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Sparkles size={16} className="text-yellow-200" />
                <span className="text-xs font-black uppercase tracking-widest text-yellow-100">
                  Grande Campeão da Competição
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight mt-0.5">
                {campeao.nome_equipe}
              </h2>
            </div>
          </div>

          {viceCampeao && (
            <div className="px-5 py-3 bg-black/15 backdrop-blur-sm rounded-2xl border border-white/20 text-center sm:text-right">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-200">
                Vice-Campeão 🥈
              </p>
              <p className="text-sm font-bold mt-0.5">{viceCampeao.nome_equipe}</p>
            </div>
          )}
        </div>
      )}

      {/* Chaveamento em Árvore Horizontal */}
      <div className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 lg:p-8 overflow-x-auto shadow-inner">
        <div className="flex items-stretch gap-8 lg:gap-12 min-w-max pb-4">
          {orderedPhases.map(({ fase, confrontos: matchesDaFase }, idx) => (
            <div key={fase} className="flex flex-col w-72 shrink-0">
              {/* Cabeçalho da Fase */}
              <div className="mb-6 text-center">
                <span className="inline-block px-4 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm">
                  {fase}
                </span>
                <p className="text-[11px] font-semibold text-slate-400 mt-1.5">
                  {matchesDaFase.length} {matchesDaFase.length === 1 ? 'partida' : 'partidas'}
                </p>
              </div>

              {/* Lista de Partidas da Fase com espaçamento proporcional */}
              <div className="flex flex-col justify-around gap-6 h-full">
                {matchesDaFase.map((confronto) => {
                  const finalizada =
                    confronto.status === 'Finalizado' || confronto.status === 'Finalizada';
                  const emAndamento = confronto.status === 'Em Andamento';

                  const mandanteVenceu =
                    finalizada && confronto.placar_mandante > confronto.placar_visitante;
                  const visitanteVenceu =
                    finalizada && confronto.placar_visitante > confronto.placar_mandante;

                  const mandanteNome = confronto.equipe_mandante?.nome || 'A definir';
                  const visitanteNome = confronto.equipe_visitante?.nome || 'A definir';

                  return (
                    <div
                      key={confronto.id_confronto}
                      className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative group"
                    >
                      {/* Top Bar do Card */}
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-3 pb-2 border-b border-slate-100">
                        <span>Jogo #{confronto.id_confronto}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            finalizada
                              ? 'bg-emerald-100 text-emerald-700'
                              : emAndamento
                              ? 'bg-amber-100 text-amber-700 animate-pulse'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {confronto.status}
                        </span>
                      </div>

                      {/* Equipes e Placares */}
                      <div className="space-y-2">
                        {/* Mandante */}
                        <div
                          className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                            mandanteVenceu
                              ? 'bg-emerald-50/80 font-black text-slate-900'
                              : finalizada
                              ? 'text-slate-400 font-medium'
                              : 'text-slate-700 font-semibold'
                          }`}
                        >
                          <span className="truncate pr-2 text-xs" title={mandanteNome}>
                            {mandanteNome}
                          </span>
                          <span
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black shrink-0 ${
                              finalizada
                                ? mandanteVenceu
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-500'
                                : 'bg-slate-50 text-slate-400'
                            }`}
                          >
                            {finalizada || emAndamento ? confronto.placar_mandante : '-'}
                          </span>
                        </div>

                        {/* Visitante */}
                        <div
                          className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                            visitanteVenceu
                              ? 'bg-emerald-50/80 font-black text-slate-900'
                              : finalizada
                              ? 'text-slate-400 font-medium'
                              : 'text-slate-700 font-semibold'
                          }`}
                        >
                          <span className="truncate pr-2 text-xs" title={visitanteNome}>
                            {visitanteNome}
                          </span>
                          <span
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black shrink-0 ${
                              finalizada
                                ? visitanteVenceu
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-500'
                                : 'bg-slate-50 text-slate-400'
                            }`}
                          >
                            {finalizada || emAndamento ? confronto.placar_visitante : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Informações Extras (Data, Local) */}
                      <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between gap-2">
                        <span className="truncate flex items-center gap-1">
                          <Calendar size={11} className="shrink-0" />
                          {confronto.data
                            ? new Date(confronto.data + 'T00:00:00').toLocaleDateString()
                            : 'Data a definir'}
                        </span>
                        {confronto.local && (
                          <span className="truncate max-w-[110px]" title={confronto.local.loca_nome}>
                            {confronto.local.loca_nome}
                          </span>
                        )}
                      </div>

                      {/* Botão de Ação Rápida */}
                      {onLancarPlacar && (
                        <button
                          onClick={() => onLancarPlacar(confronto)}
                          className="mt-3 w-full py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 font-bold text-xs rounded-xl border border-slate-200/60 transition-colors cursor-pointer"
                        >
                          {finalizada ? 'Editar Placar' : 'Lançar Placar'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
