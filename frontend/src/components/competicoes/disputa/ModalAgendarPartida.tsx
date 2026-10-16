'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Building, Loader2, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { agendarPartida, isErroApi } from '@/services/competicoes';
import type { PartidaDetalhe, PartidaAgendar } from '@/types/competicoes';

interface PartidaEstendida extends PartidaDetalhe {
  data?: string | null;
  hora?: string | null;
  ordem_jogo?: number;
}

interface ModalAgendarPartidaProps {
  partida: PartidaDetalhe | null;
  isOpen: boolean;
  onClose: () => void;
  onSucesso: (partidaAtualizada: PartidaDetalhe) => void;
}

export default function ModalAgendarPartida({
  partida,
  isOpen,
  onClose,
  onSucesso,
}: ModalAgendarPartidaProps) {
  const p = partida as PartidaEstendida | null;

  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [local, setLocal] = useState('');
  const [campo, setCampo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !p) return;

    let initData = '';
    let initHora = '';

    if (p.data) {
      initData = String(p.data);
    } else if (p.data_hora) {
      initData = p.data_hora.split('T')[0] || '';
    }

    if (p.hora) {
      initHora = String(p.hora).slice(0, 5);
    } else if (p.data_hora && p.data_hora.includes('T')) {
      const partHora = p.data_hora.split('T')[1];
      if (partHora) {
        initHora = partHora.slice(0, 5);
      }
    }

    setData(initData);
    setHora(initHora);
    setLocal(p.local || '');
    setCampo(p.campo || '');
    setErro(null);
  }, [isOpen, p]);

  if (!isOpen || !p) return null;

  const temAgendamentoExistente = Boolean(p.data || p.data_hora || p.local || p.campo);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      const payload: PartidaAgendar = {
        data: data || null,
        hora: hora ? (hora.length === 5 ? `${hora}:00` : hora) : null,
        local: local.trim() || null,
        campo: campo.trim() || null,
      };

      const partidaAtualizada = await agendarPartida(p.id_partida, payload);
      onSucesso(partidaAtualizada);
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao agendar a partida. Verifique os dados e tente novamente.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleLimpar = async () => {
    setLimpando(true);
    setErro(null);

    try {
      const payload: PartidaAgendar = {
        data: null,
        hora: null,
        local: null,
        campo: null,
      };

      const partidaAtualizada = await agendarPartida(p.id_partida, payload);
      onSucesso(partidaAtualizada);
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao limpar agendamento da partida.');
      }
    } finally {
      setLimpando(false);
    }
  };

  const tituloJogo = `${p.nome_mandante || 'Mandante'} vs ${p.nome_visitante || 'Visitante'}`;
  const numeroJogo = p.numero_partida || p.ordem_jogo || p.id_partida;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-agendar-titulo"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={salvando || limpando}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <h3 id="modal-agendar-titulo" className="text-lg font-bold text-slate-800">
              Agendar Partida
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Jogo #{numeroJogo} • {tituloJogo}
            </p>
          </div>
        </div>

        {erro && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
            <div className="font-medium">{erro}</div>
          </div>
        )}

        <form onSubmit={handleSalvar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="agendamento-data" className="block text-xs font-semibold text-slate-700 mb-1">
                Data do Jogo
              </label>
              <div className="relative">
                <input
                  id="agendamento-data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  disabled={salvando || limpando}
                />
              </div>
            </div>

            <div>
              <label htmlFor="agendamento-hora" className="block text-xs font-semibold text-slate-700 mb-1">
                Horário
              </label>
              <div className="relative">
                <input
                  id="agendamento-hora"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  disabled={salvando || limpando}
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="agendamento-local" className="block text-xs font-semibold text-slate-700 mb-1">
              Local / Praça Esportiva
            </label>
            <div className="relative">
              <input
                id="agendamento-local"
                type="text"
                placeholder="Ex: Estádio Municipal, Centro Esportivo"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder:text-slate-400"
                disabled={salvando || limpando}
              />
            </div>
          </div>

          <div>
            <label htmlFor="agendamento-campo" className="block text-xs font-semibold text-slate-700 mb-1">
              Campo / Quadra
            </label>
            <div className="relative">
              <input
                id="agendamento-campo"
                type="text"
                placeholder="Ex: Campo 1, Quadra Principal"
                value={campo}
                onChange={(e) => setCampo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder:text-slate-400"
                disabled={salvando || limpando}
              />
            </div>
          </div>

          {/* Rodapé com Ações */}
          <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <div>
              {temAgendamentoExistente && (
                <button
                  type="button"
                  onClick={handleLimpar}
                  disabled={salvando || limpando}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                >
                  {limpando ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  <span>Limpar Agendamento</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando || limpando}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={salvando || limpando}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50 min-w-[140px]"
              >
                {salvando ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Salvar Agendamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
