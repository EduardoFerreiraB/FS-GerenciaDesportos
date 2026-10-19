'use client';

import React, { useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { isErroApi } from '@/services/competicoes';

interface ModalConfirmarExclusaoProps {
  aberto: boolean;
  titulo: string;
  /** O que será apagado, em linguagem do usuário. */
  descricao: React.ReactNode;
  /** Texto que o usuário precisa digitar para liberar o botão (ex.: o nome). */
  textoConfirmacao: string;
  onConfirmar: () => Promise<void>;
  onFechar: () => void;
}

/**
 * Exclusão é irreversível e em cascata: o botão só libera depois de digitar o
 * nome exato, para não apagar um campeonato com um clique errado.
 */
export default function ModalConfirmarExclusao({
  aberto,
  titulo,
  descricao,
  textoConfirmacao,
  onConfirmar,
  onFechar,
}: ModalConfirmarExclusaoProps) {
  const [digitado, setDigitado] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) return null;

  const liberado = digitado.trim() === textoConfirmacao.trim();

  const fechar = () => {
    if (excluindo) return;
    setDigitado('');
    setErro(null);
    onFechar();
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liberado) return;
    try {
      setExcluindo(true);
      setErro(null);
      await onConfirmar();
      setDigitado('');
    } catch (err: unknown) {
      setErro(isErroApi(err) ? err.mensagem : 'Não foi possível excluir. Tente novamente.');
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-exclusao-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <form onSubmit={confirmar} className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
        <div className="flex justify-between items-start gap-4">
          <h2 id="modal-exclusao-titulo" className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            {titulo}
          </h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-slate-600 space-y-2">{descricao}</div>
        <p className="text-sm font-semibold text-rose-700">Esta ação não pode ser desfeita.</p>

        <div>
          <label htmlFor="confirmacao-exclusao" className="block text-sm text-slate-700 mb-1">
            Para confirmar, digite <strong>{textoConfirmacao}</strong>
          </label>
          <input
            id="confirmacao-exclusao"
            data-testid="input-confirmacao-exclusao"
            type="text"
            autoComplete="off"
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {erro && (
          <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={fechar}
            disabled={excluindo}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm"
          >
            Voltar
          </button>
          <button
            type="submit"
            data-testid="btn-confirmar-exclusao"
            disabled={!liberado || excluindo}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Excluir definitivamente
          </button>
        </div>
      </form>
    </div>
  );
}
