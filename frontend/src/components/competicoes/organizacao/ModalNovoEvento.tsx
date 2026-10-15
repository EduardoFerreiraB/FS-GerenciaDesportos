'use client';

import React, { useState } from 'react';
import { X, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { criarEventoComEdicao, isErroApi } from '@/services/competicoes';
import type { EventoDetalhe } from '@/types/competicoes';

interface ModalNovoEventoProps {
  aberto: boolean;
  onClose: () => void;
  onSuccess: (evento: EventoDetalhe) => void;
}

export default function ModalNovoEvento({
  aberto,
  onClose,
  onSuccess,
}: ModalNovoEventoProps) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [identificacao, setIdentificacao] = useState('1ª Edição');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('O nome do evento é obrigatório.');
      return;
    }
    if (!identificacao.trim()) {
      setErro('A identificação da edição é obrigatória.');
      return;
    }
    if (!dataInicio || !dataFim) {
      setErro('As datas de início e término são obrigatórias.');
      return;
    }

    try {
      setCarregando(true);
      const novoEvento = await criarEventoComEdicao({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        edicao: {
          identificacao: identificacao.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim,
        },
      });
      onSuccess(novoEvento);
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Ocorreu um erro ao criar o evento.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-novo-evento-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 id="modal-novo-evento-titulo" className="text-xl font-bold">
              Novo Evento Esportivo
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="nome-evento" className="block text-sm font-semibold text-slate-700 mb-1">
              Nome do Evento
            </label>
            <input
              id="nome-evento"
              type="text"
              required
              placeholder="Ex: Jogos da Primavera 2026"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="descricao-evento" className="block text-sm font-medium text-slate-700 mb-1">
              Descrição (Opcional)
            </label>
            <textarea
              id="descricao-evento"
              rows={2}
              placeholder="Informações gerais sobre o evento..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Primeira Edição do Evento</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="identificacao-edicao" className="block text-sm font-medium text-slate-700 mb-1">
                  Identificação da Edição
                </label>
                <input
                  id="identificacao-edicao"
                  type="text"
                  required
                  placeholder="Ex: 2026 ou 1ª Edição"
                  value={identificacao}
                  onChange={(e) => setIdentificacao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="data-inicio-edicao" className="block text-sm font-medium text-slate-700 mb-1">
                    Data de Início
                  </label>
                  <input
                    id="data-inicio-edicao"
                    type="date"
                    required
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="data-fim-edicao" className="block text-sm font-medium text-slate-700 mb-1">
                    Data de Término
                  </label>
                  <input
                    id="data-fim-edicao"
                    type="date"
                    required
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={carregando}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={carregando}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Criar Evento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
