'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, AlertTriangle, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { competicoesService, isErroApi } from '@/services/competicoes';
import type { EstadoEdicao, EdicaoCompeticaoDetalhe } from '@/types/competicoes';

interface CopiarElencoProps {
  idEdicaoCompeticao: number;
  isOpen: boolean;
  onClose: () => void;
  onCopiado: () => void;
  estadoEdicao?: EstadoEdicao;
}

export default function CopiarElenco({
  idEdicaoCompeticao,
  isOpen,
  onClose,
  onCopiado,
  estadoEdicao = 'RASCUNHO',
}: CopiarElencoProps) {
  const [idOrigemInput, setIdOrigemInput] = useState<string>('');
  const [edicoesDisponiveis, setEdicoesDisponiveis] = useState<EdicaoCompeticaoDetalhe[]>([]);
  const [carregandoEdicoes, setCarregandoEdicoes] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const isRascunho = estadoEdicao === 'RASCUNHO';

  useEffect(() => {
    if (!isOpen) return;

    setIdOrigemInput('');
    setErro(null);
    setSucesso(null);

    let ativo = true;
    async function carregarHistoricoEdicoes() {
      setCarregandoEdicoes(true);
      try {
        const edicaoAtual = await competicoesService.obterEdicao(idEdicaoCompeticao);
        if (!ativo || !edicaoAtual) return;

        const comp = await competicoesService.obterCompeticao(edicaoAtual.id_competicao);
        if (ativo && comp?.edicoes) {
          const outras = comp.edicoes.filter(
            (e) => e.id_edicao_competicao !== idEdicaoCompeticao
          );
          setEdicoesDisponiveis(outras);
          if (outras.length > 0) {
            setIdOrigemInput(String(outras[0].id_edicao_competicao));
          }
        }
      } catch (err) {
        // Falha não crítica se for ambiente mock ou sem edição pai
      } finally {
        if (ativo) setCarregandoEdicoes(false);
      }
    }

    carregarHistoricoEdicoes();
    return () => {
      ativo = false;
    };
  }, [idEdicaoCompeticao, isOpen]);

  if (!isOpen) return null;

  const handleCopiar = async (e: React.FormEvent) => {
    e.preventDefault();
    const idOrigem = parseInt(idOrigemInput, 10);
    if (!idOrigem || isNaN(idOrigem)) {
      setErro('Informe ou selecione uma edição de origem válida.');
      return;
    }

    if (!isRascunho) {
      setErro('A cópia de equipes e elencos só é permitida enquanto a edição destino estiver em RASCUNHO.');
      return;
    }

    setCopiando(true);
    setErro(null);
    setSucesso(null);

    try {
      await competicoesService.copiarEquipes(idEdicaoCompeticao, idOrigem);
      onCopiado();
      onClose();
    } catch (err) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else {
        setErro('Erro ao copiar elencos da edição de origem.');
      }
    } finally {
      setCopiando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Copiar Elenco"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 relative animate-in zoom-in-95"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Copy size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Copiar Elenco de Edição Anterior</h3>
            <p className="text-xs text-slate-500">
              Replica as equipes e inscrições de atletas para a edição atual
            </p>
          </div>
        </div>

        {/* Bloqueio se não estiver em RASCUNHO */}
        {!isRascunho && (
          <div className="p-3.5 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
            <div>
              <span className="font-bold">Ação Bloqueada:</span> A cópia de elencos só é permitida quando a edição de destino estiver no estado <span className="font-semibold">RASCUNHO</span>. A edição atual está em estado {estadoEdicao}.
            </div>
          </div>
        )}

        {/* Aviso Explícito: Apenas equipes e inscrições são copiadas */}
        <div className="p-3.5 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-800">Escopo da Operação de Cópia</p>
            <p className="text-amber-700 leading-relaxed">
              Apenas equipes e inscrições de competidores são copiadas; partidas e punições não são copiadas.
            </p>
          </div>
        </div>

        {erro && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {sucesso && (
          <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{sucesso}</span>
          </div>
        )}

        <form onSubmit={handleCopiar} className="space-y-4">
          <div>
            <label htmlFor="edicao-origem" className="block text-xs font-semibold text-slate-700 mb-1">
              Edição de Origem *
            </label>

            {edicoesDisponiveis.length > 0 ? (
              <div className="space-y-2">
                <select
                  id="edicao-origem-select"
                  aria-label="Selecionar edição anterior"
                  value={idOrigemInput}
                  onChange={(e) => setIdOrigemInput(e.target.value)}
                  disabled={!isRascunho || copiando}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {edicoesDisponiveis.map((ed) => (
                    <option key={ed.id_edicao_competicao} value={ed.id_edicao_competicao}>
                      Edição {ed.identificacao} (ID: {ed.id_edicao_competicao}) - {ed.estado}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-500">
                  Ou digite o ID da edição de origem:
                </div>
                <input
                  id="edicao-origem"
                  type="number"
                  aria-label="Edição de origem"
                  value={idOrigemInput}
                  onChange={(e) => setIdOrigemInput(e.target.value)}
                  placeholder="ID da edição de origem"
                  disabled={!isRascunho || copiando}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ) : (
              <div>
                <input
                  id="edicao-origem"
                  aria-label="Edição de origem"
                  type="number"
                  required
                  value={idOrigemInput}
                  onChange={(e) => setIdOrigemInput(e.target.value)}
                  placeholder="Ex: 1"
                  disabled={!isRascunho || copiando}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {carregandoEdicoes && (
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Buscando edições da competição...
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={copiando}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isRascunho || copiando || !idOrigemInput.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
            >
              {copiando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Copy size={16} />
              )}
              Confirmar Cópia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
