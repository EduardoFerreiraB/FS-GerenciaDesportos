'use client';

import React, { useState } from 'react';
import { 
  Trophy,
  Calendar, 
  Radio, 
  Share2, 
  Check, 
  Sparkles, 
  Layers, 
  ShieldCheck 
} from 'lucide-react';
import { GrupoCompeticoes } from '@/types/competicoesV2';

export interface HeaderEventoPublicoProps {
  grupo: GrupoCompeticoes;
  temJogosAoVivo?: boolean;
}

export default function HeaderEventoPublico({
  grupo,
  temJogosAoVivo = false,
}: HeaderEventoPublicoProps) {
  const [copiado, setCopiado] = useState(false);

  const formatarData = (dataStr?: string | null) => {
    if (!dataStr) return null;
    try {
      const data = new Date(dataStr.includes('T') ? dataStr : `${dataStr}T00:00:00`);
      if (isNaN(data.getTime())) return null;
      return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const dataInicioFormatada = formatarData(grupo.data_inicio);
  const dataFimFormatada = formatarData(grupo.data_fim);

  const handleCompartilhar = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = {
      title: `${grupo.nome} - Portal Esportivo`,
      text: grupo.descricao || `Acompanhe os jogos, tabelas e artilharia de ${grupo.nome}!`,
      url,
    };

    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Usuário cancelou ou fallback para clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 3000);
      } catch {
        // Fallback
      }
    }
  };

  const totalCompeticoes = grupo.competicoes?.length || 0;

  const statusFormatado: Record<string, { label: string; cor: string }> = {
    EM_ANDAMENTO: { label: 'Em Andamento', cor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    ABERTA: { label: 'Inscrições / Ativo', cor: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    PLANEJADA: { label: 'Em Breve', cor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    FINALIZADA: { label: 'Encerrado', cor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    CANCELADA: { label: 'Cancelado', cor: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  };

  const statusInfo = statusFormatado[grupo.status?.toUpperCase()] || {
    label: grupo.status || 'Oficial',
    cor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };

  return (
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white shadow-2xl border border-white/10">
      {/* Luzes e Efeitos Decorativos de Fundo */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/3 h-64 w-64 -translate-y-1/2 rounded-full bg-amber-500/10 blur-2xl" />

      {/* Grid sutil esportivo */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.03]" 
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />

      <div className="relative z-10 p-6 sm:p-8 lg:p-10">
        {/* Barra Superior de Status e Ações */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Badge Pulsante AO VIVO */}
            {temJogosAoVivo && (
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 border border-rose-500/40 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-rose-300 shadow-lg shadow-rose-900/30 animate-pulse">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <Radio size={14} className="animate-bounce" />
                <span>AO VIVO</span>
              </div>
            )}

            {/* Badge de Status Geral do Evento */}
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusInfo.cor}`}>
              <ShieldCheck size={13} />
              {statusInfo.label}
            </span>

            {/* Total de modalidades / competições */}
            {totalCompeticoes > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold text-slate-200 backdrop-blur-sm">
                <Layers size={13} className="text-blue-400" />
                {totalCompeticoes} {totalCompeticoes === 1 ? 'Competição' : 'Competições'}
              </span>
            )}
          </div>

          {/* Botão de Compartilhar */}
          <button
            onClick={handleCompartilhar}
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition-all active:scale-95 cursor-pointer"
            title="Compartilhar link do evento"
          >
            {copiado ? (
              <>
                <Check size={14} className="text-emerald-400" />
                <span className="text-emerald-300">Link Copiado!</span>
              </>
            ) : (
              <>
                <Share2 size={14} className="text-slate-300" />
                <span>Compartilhar</span>
              </>
            )}
          </button>
        </div>

        {/* Bloco Central: Título Oficial e Descrição */}
        <div className="mt-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 text-amber-400 text-xs font-extrabold uppercase tracking-widest">
              <Trophy size={14} />
              <Sparkles size={14} />
              <span>Evento Agregador Oficial</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-md">
              {grupo.nome}
            </h1>

            {grupo.descricao ? (
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                {grupo.descricao}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">
                Acompanhe o chaveamento, classificação e artilharia oficial das competições deste evento.
              </p>
            )}
          </div>

          {/* Card Esportivo Lateral de Datas */}
          {(dataInicioFormatada || dataFimFormatada) && (
            <div className="shrink-0 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4 sm:p-5 flex items-center gap-4 shadow-xl">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Período da Disputa
                </p>
                <p className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                  {dataInicioFormatada && dataFimFormatada
                    ? `${dataInicioFormatada} a ${dataFimFormatada}`
                    : dataInicioFormatada || dataFimFormatada}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
