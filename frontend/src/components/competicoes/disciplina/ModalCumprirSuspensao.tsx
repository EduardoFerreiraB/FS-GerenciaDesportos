'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { cumprirSuspensao, isErroApi } from '@/services/competicoes';
import type { SuspensaoDetalhe, PartidaDetalhe } from '@/types/competicoes';

interface ModalCumprirSuspensaoProps {
  suspensao: SuspensaoDetalhe | null;
  partidas: PartidaDetalhe[];
  isOpen: boolean;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalCumprirSuspensao({
  suspensao,
  partidas,
  isOpen,
  onClose,
  onSucesso,
}: ModalCumprirSuspensaoProps) {
  const [idPartida, setIdPartida] = useState<number | ''>('');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  // Filtra partidas da equipe do atleta
  const { partidasEquipe, outrasPartidas } = useMemo(() => {
    if (!suspensao?.id_equipe) {
      return { partidasEquipe: partidas, outrasPartidas: [] };
    }
    const equipe = partidas.filter(
      (p) =>
        p.id_equipe_mandante === suspensao.id_equipe ||
        p.id_equipe_visitante === suspensao.id_equipe
    );
    const outras = partidas.filter(
      (p) =>
        p.id_equipe_mandante !== suspensao.id_equipe &&
        p.id_equipe_visitante !== suspensao.id_equipe
    );
    return { partidasEquipe: equipe, outrasPartidas: outras };
  }, [suspensao?.id_equipe, partidas]);

  useEffect(() => {
    if (!isOpen || !suspensao) return;

    setErro(null);
    setSalvando(false);

    // Seleciona preferencialmente uma partida finalizada da equipe
    const candidata =
      partidasEquipe.find((p) => p.status === 'FINALIZADA') ||
      partidasEquipe[0] ||
      partidas[0];

    if (candidata) {
      setIdPartida(candidata.id_partida);
    } else {
      setIdPartida('');
    }
  }, [isOpen, suspensao?.id_suspensao]);

  if (!isOpen || !suspensao) return null;

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idPartida) {
      setErro('Selecione uma partida válida para cumprir a suspensão.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      await cumprirSuspensao(suspensao.id_suspensao, {
        id_partida: Number(idPartida),
      });
      onSucesso();
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao registrar o cumprimento da suspensão.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cumprir-titulo"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="modal-cumprir-titulo"
                className="text-lg font-bold text-slate-800"
              >
                Registrar Cumprimento
              </h2>
              <p className="text-xs text-slate-500">
                Suspensão #{suspensao.id_suspensao}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Fechar"
            data-testid="btn-fechar-modal-cumprir"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleConfirmar} className="p-6 space-y-4">
          {erro && (
            <div
              className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2.5 animate-in fade-in"
              role="alert"
              data-testid="alerta-erro-cumprimento"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{erro}</div>
            </div>
          )}

          {/* Resumo da Suspensão */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Atleta
              </span>
              <span className="font-bold text-slate-800">
                {suspensao.nome_esportivo || `Integrante #${suspensao.id_integrante}`}
              </span>
            </div>

            {suspensao.nome_equipe && (
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Equipe
                </span>
                <span className="font-medium text-slate-700">
                  {suspensao.nome_equipe}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Origem / Motivo
              </span>
              <span className="font-medium text-slate-700 text-right max-w-[240px] truncate" title={suspensao.motivo}>
                {suspensao.motivo}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Progresso
              </span>
              <span className="font-semibold text-blue-700">
                {suspensao.jogos_cumpridos} de {suspensao.jogos} jogos cumpridos
              </span>
            </div>
          </div>

          {/* Seleção de Partida */}
          <div>
            <label
              htmlFor="select-partida-cumprimento"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Partida onde cumpriu suspensão <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="select-partida-cumprimento"
                data-testid="select-partida-cumprimento"
                value={idPartida}
                onChange={(e) => setIdPartida(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">Selecione a partida...</option>
                {partidasEquipe.length > 0 && outrasPartidas.length > 0 ? (
                  <>
                    <optgroup label={`Partidas de ${suspensao.nome_equipe || 'Equipe'}`}>
                      {partidasEquipe.map((p) => {
                        const labelMandante = p.nome_mandante || 'Mandante';
                        const labelVisitante = p.nome_visitante || 'Visitante';
                        const rodadaStr = p.rodada ? `(Rodada ${p.rodada})` : '';
                        const statusStr = p.status === 'FINALIZADA' ? 'Finalizada' : p.status;
                        return (
                          <option key={p.id_partida} value={p.id_partida}>
                            Jogo #{p.numero_partida} {rodadaStr}: {labelMandante} vs {labelVisitante} [{statusStr}]
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="Outras Partidas da Edição">
                      {outrasPartidas.map((p) => {
                        const labelMandante = p.nome_mandante || 'Mandante';
                        const labelVisitante = p.nome_visitante || 'Visitante';
                        const rodadaStr = p.rodada ? `(Rodada ${p.rodada})` : '';
                        const statusStr = p.status === 'FINALIZADA' ? 'Finalizada' : p.status;
                        return (
                          <option key={p.id_partida} value={p.id_partida}>
                            Jogo #{p.numero_partida} {rodadaStr}: {labelMandante} vs {labelVisitante} [{statusStr}]
                          </option>
                        );
                      })}
                    </optgroup>
                  </>
                ) : (
                  (partidasEquipe.length > 0 ? partidasEquipe : partidas).map((p) => {
                    const labelMandante = p.nome_mandante || 'Mandante';
                    const labelVisitante = p.nome_visitante || 'Visitante';
                    const rodadaStr = p.rodada ? `(Rodada ${p.rodada})` : '';
                    const statusStr = p.status === 'FINALIZADA' ? 'Finalizada' : p.status;
                    return (
                      <option key={p.id_partida} value={p.id_partida}>
                        Jogo #{p.numero_partida} {rodadaStr}: {labelMandante} vs {labelVisitante} [{statusStr}]
                      </option>
                    );
                  })
                )}
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              O cumprimento deve ser registrado em uma partida finalizada posterior da equipe do atleta.
            </p>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              data-testid="btn-cancelar-cumprimento"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !idPartida}
              data-testid="btn-confirmar-cumprimento"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Cumprimento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
