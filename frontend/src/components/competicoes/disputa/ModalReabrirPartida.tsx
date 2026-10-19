'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Ban,
  Trophy,
} from 'lucide-react';
import {
  reabrirPartida,
  cancelarPartida,
  reabrirFaseGrupos,
  isErroApi,
} from '@/services/competicoes';
import type { PartidaDetalhe } from '@/types/competicoes';

export type ModoReabertura = 'REABRIR_PARTIDA' | 'CANCELAR_PARTIDA' | 'REABRIR_GRUPOS';

export interface ModalReabrirPartidaProps {
  isOpen: boolean;
  modo: ModoReabertura;
  partida?: PartidaDetalhe | null;
  idEdicaoCompeticao: number;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalReabrirPartida({
  isOpen,
  modo,
  partida,
  idEdicaoCompeticao,
  onClose,
  onSucesso,
}: ModalReabrirPartidaProps) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setErro(null);
      setSalvando(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  let titulo = 'Reabrir Partida';
  let descricao =
    'Esta ação reabrirá a partida finalizada para o status Em Andamento, permitindo alterações no placar e súmula. Duelos eliminatórios seguintes que dependem deste resultado serão resetados caso ainda não tenham sido iniciados.';
  let textoBotao = 'Confirmar Reabertura';
  let icone = <RotateCcw size={22} className="text-amber-600" />;
  let corBotao = 'bg-amber-600 hover:bg-amber-700 text-white';

  if (modo === 'CANCELAR_PARTIDA') {
    titulo = `Cancelar Jogo #${partida?.numero_partida || partida?.id_partida || ''}`;
    descricao =
      'Esta ação cancelará a partida agendada. Apenas partidas que ainda não possuem ocorrências registradas podem ser canceladas.';
    textoBotao = 'Confirmar Cancelamento';
    icone = <Ban size={22} className="text-rose-600" />;
    corBotao = 'bg-rose-600 hover:bg-rose-700 text-white';
  } else if (modo === 'REABRIR_GRUPOS') {
    titulo = 'Reabrir Fase de Grupos';
    descricao =
      'Esta ação desfaz o encerramento da fase de grupos, permitindo reabrir partidas dos grupos e retificar resultados. Caso o chaveamento mata-mata já tenha duelos com partidas iniciadas, a operação será bloqueada.';
    textoBotao = 'Confirmar Reabertura de Grupos';
    icone = <Trophy size={22} className="text-indigo-600" />;
    corBotao = 'bg-indigo-600 hover:bg-indigo-700 text-white';
  } else if (partida) {
    titulo = `Reabrir Jogo #${partida.numero_partida || partida.id_partida} (${partida.nome_mandante || 'Mandante'} vs ${partida.nome_visitante || 'Visitante'})`;
  }

  const motivoValido = motivo.trim().length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!motivoValido) {
      setErro('Informe uma justificativa com no mínimo 3 caracteres.');
      return;
    }

    try {
      setSalvando(true);

      if (modo === 'REABRIR_PARTIDA') {
        if (!partida) {
          throw new Error('Nenhuma partida informada para reabertura.');
        }
        await reabrirPartida(partida.id_partida, motivo.trim());
      } else if (modo === 'CANCELAR_PARTIDA') {
        if (!partida) {
          throw new Error('Nenhuma partida informada para cancelamento.');
        }
        await cancelarPartida(partida.id_partida, motivo.trim());
      } else if (modo === 'REABRIR_GRUPOS') {
        await reabrirFaseGrupos(idEdicaoCompeticao, motivo.trim());
      }

      onSucesso();
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Ocorreu um erro ao processar a operação.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-reabrir-titulo"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-5 animate-in zoom-in-95"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              {icone}
            </div>
            <div>
              <h3 id="modal-reabrir-titulo" className="text-base font-bold text-slate-800">
                {titulo}
              </h3>
              <p className="text-xs text-slate-500">Operação monitorada com auditoria</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Descrição contextual */}
        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          {descricao}
        </p>

        {/* Mensagem de Erro (incluindo Conflito 409 de jogos descendentes) */}
        {erro && (
          <div
            data-testid="alerta-erro-reabertura"
            className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-medium flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Aviso do Sistema:</span>
              <span>{erro}</span>
            </div>
          </div>
        )}

        {/* Formulário com Motivo Obrigatório */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="input-motivo"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Justificativa / Motivo * <span className="text-slate-400">(mínimo 3 caracteres)</span>
            </label>
            <textarea
              id="input-motivo"
              data-testid="input-motivo-reabertura"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo desta alteração para registro em auditoria..."
              className="w-full text-xs font-medium px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              autoFocus
            />
            <div className="flex justify-between items-center mt-1 text-[11px] text-slate-400">
              <span>{motivo.trim().length} caractere(s)</span>
              {!motivoValido && motivo.length > 0 && (
                <span className="text-amber-600">Mínimo de 3 caracteres exigido</span>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="btn-confirmar-reabertura"
              disabled={salvando || !motivoValido}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${corBotao}`}
            >
              {salvando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <span>{textoBotao}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
