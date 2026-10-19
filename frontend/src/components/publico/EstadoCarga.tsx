'use client';

import React from 'react';
import { AlertTriangle, Loader2, RefreshCw, SearchX } from 'lucide-react';
import { ehNaoEncontrado } from '@/services/publico';

interface EstadoCargaProps {
  carregando: boolean;
  erro: unknown;
  temDados: boolean;
  onTentarNovamente: () => void;
  /** Ex.: "a classificação". Usado nas mensagens. */
  recurso: string;
  children: React.ReactNode;
}

function BotaoTentarNovamente({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition cursor-pointer"
    >
      <RefreshCw size={14} />
      Tentar novamente
    </button>
  );
}

/**
 * Falha é falha: erro de carregamento nunca vira lista vazia. Sem dados, mostra
 * o erro com retentativa; com dados já em tela, mantém os dados e avisa.
 */
export default function EstadoCarga({
  carregando,
  erro,
  temDados,
  onTentarNovamente,
  recurso,
  children,
}: EstadoCargaProps) {
  if (!temDados && erro) {
    if (ehNaoEncontrado(erro)) {
      return (
        <div className="py-16 text-center space-y-3" role="status">
          <SearchX size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">Não encontrado</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Este conteúdo não existe ou não está publicado.
          </p>
        </div>
      );
    }
    return (
      <div className="py-16 text-center space-y-4" role="alert">
        <AlertTriangle size={40} className="mx-auto text-rose-500" />
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            Não foi possível carregar {recurso}.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Verifique sua conexão. Nenhum dado foi perdido.
          </p>
        </div>
        <BotaoTentarNovamente onClick={onTentarNovamente} />
      </div>
    );
  }

  if (!temDados && carregando) {
    return (
      <div className="py-16 flex flex-col items-center text-slate-400" role="status">
        <Loader2 size={32} className="animate-spin text-blue-600 mb-3" />
        <p className="text-sm">Carregando {recurso}...</p>
      </div>
    );
  }

  return (
    <>
      {erro && !ehNaoEncontrado(erro) ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
        >
          <span>Não foi possível atualizar {recurso}. Os dados exibidos podem estar desatualizados.</span>
          <BotaoTentarNovamente onClick={onTentarNovamente} />
        </div>
      ) : null}
      {children}
    </>
  );
}
