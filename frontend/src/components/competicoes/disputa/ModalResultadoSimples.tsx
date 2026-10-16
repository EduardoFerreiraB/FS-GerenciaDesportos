'use client';

import React, { useState, useEffect } from 'react';
import { X, Trophy, AlertCircle, Loader2, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { registrarResultadoSimples, isErroApi } from '@/services/competicoes';
import type { PartidaDetalhe, ResultadoSimples } from '@/types/competicoes';

interface PartidaEstendida extends PartidaDetalhe {
  ordem_jogo?: number;
}

interface ModalResultadoSimplesProps {
  partida: PartidaDetalhe | null;
  isOpen: boolean;
  onClose: () => void;
  onSucesso: (partidaAtualizada: PartidaDetalhe) => void;
}

export default function ModalResultadoSimples({
  partida,
  isOpen,
  onClose,
  onSucesso,
}: ModalResultadoSimplesProps) {
  const p = partida as PartidaEstendida | null;

  const [golsMandante, setGolsMandante] = useState<number>(0);
  const [golsVisitante, setGolsVisitante] = useState<number>(0);

  const [temPenaltis, setTemPenaltis] = useState<boolean>(false);
  const [penaltisMandante, setPenaltisMandante] = useState<string>('');
  const [penaltisVisitante, setPenaltisVisitante] = useState<string>('');

  const [ehWo, setEhWo] = useState<boolean>(false);
  const [equipeDerrotadaWo, setEquipeDerrotadaWo] = useState<number | null>(null);

  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !p) return;

    setGolsMandante(p.placar?.gols_mandante ?? 0);
    setGolsVisitante(p.placar?.gols_visitante ?? 0);

    const temPen = p.placar?.penaltis_mandante != null || p.placar?.penaltis_visitante != null;
    setTemPenaltis(temPen);
    setPenaltisMandante(p.placar?.penaltis_mandante != null ? String(p.placar.penaltis_mandante) : '');
    setPenaltisVisitante(p.placar?.penaltis_visitante != null ? String(p.placar.penaltis_visitante) : '');

    setEhWo(false);
    setEquipeDerrotadaWo(null);
    setErro(null);
  }, [isOpen, p]);

  if (!isOpen || !p) return null;

  const nomeMandante = p.nome_mandante || 'Mandante';
  const nomeVisitante = p.nome_visitante || 'Visitante';
  const numeroJogo = p.numero_partida || p.ordem_jogo || p.id_partida;

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      let payload: ResultadoSimples;

      if (ehWo) {
        if (!equipeDerrotadaWo) {
          setErro('Selecione a equipe que cometeu ou sofreu o W.O.');
          setSalvando(false);
          return;
        }

        payload = {
          wo: true,
          equipe_wo_id: equipeDerrotadaWo,
          gols_mandante: 0,
          gols_visitante: 0,
        };
      } else {
        const gm = Math.max(0, Math.floor(Number(golsMandante) || 0));
        const gv = Math.max(0, Math.floor(Number(golsVisitante) || 0));

        let pm: number | null = null;
        let pv: number | null = null;

        if (temPenaltis) {
          if (penaltisMandante.trim() === '' || penaltisVisitante.trim() === '') {
            setErro('Preencha os pênaltis convertidos por ambas as equipes.');
            setSalvando(false);
            return;
          }

          pm = Math.max(0, Math.floor(Number(penaltisMandante) || 0));
          pv = Math.max(0, Math.floor(Number(penaltisVisitante) || 0));

          if (pm === pv) {
            setErro('A disputa por pênaltis não pode terminar empatada.');
            setSalvando(false);
            return;
          }
        }

        payload = {
          gols_mandante: gm,
          gols_visitante: gv,
          penaltis_mandante: pm,
          penaltis_visitante: pv,
          wo: false,
        };
      }

      const partidaAtualizada = await registrarResultadoSimples(p.id_partida, payload);
      onSucesso(partidaAtualizada);
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao registrar o resultado da partida. Verifique o estado da competição.');
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
        aria-labelledby="modal-resultado-titulo"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={salvando}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Trophy size={24} />
          </div>
          <div>
            <h3 id="modal-resultado-titulo" className="text-lg font-bold text-slate-800">
              Lançar Placar Simples
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Jogo #{numeroJogo} • Registro Oficial de Resultado
            </p>
          </div>
        </div>

        {erro && (
          <div className="p-3.5 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
            <div className="font-medium leading-relaxed">{erro}</div>
          </div>
        )}

        <form onSubmit={handleSalvar} className="space-y-5">
          {/* Placar Mandante x Visitante */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="grid grid-cols-5 items-center gap-2">
              {/* Mandante */}
              <div className="col-span-2 text-center">
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider truncate mb-1" title={nomeMandante}>
                  {p.sigla_mandante ? `${p.sigla_mandante} - ` : ''}{nomeMandante}
                </span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  disabled={ehWo || salvando}
                  value={ehWo ? '' : golsMandante}
                  onChange={(e) => setGolsMandante(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  aria-label={`Gols ${nomeMandante}`}
                  className="w-20 mx-auto text-center text-3xl font-extrabold text-slate-800 bg-white border border-slate-300 rounded-xl py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {/* Separador */}
              <div className="col-span-1 text-center">
                <span className="text-lg font-black text-slate-400">X</span>
              </div>

              {/* Visitante */}
              <div className="col-span-2 text-center">
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider truncate mb-1" title={nomeVisitante}>
                  {p.sigla_visitante ? `${p.sigla_visitante} - ` : ''}{nomeVisitante}
                </span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  disabled={ehWo || salvando}
                  value={ehWo ? '' : golsVisitante}
                  onChange={(e) => setGolsVisitante(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  aria-label={`Gols ${nomeVisitante}`}
                  className="w-20 mx-auto text-center text-3xl font-extrabold text-slate-800 bg-white border border-slate-300 rounded-xl py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Opção de Disputa por Pênaltis */}
          {!ehWo && (
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={temPenaltis}
                  onChange={(e) => setTemPenaltis(e.target.checked)}
                  disabled={salvando}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Decisão por Pênaltis (desempate eliminatório)
                </span>
              </label>

              {temPenaltis && (
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-4 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1 truncate" title={nomeMandante}>
                      Pênaltis {nomeMandante}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={penaltisMandante}
                      onChange={(e) => setPenaltisMandante(e.target.value)}
                      placeholder="0"
                      aria-label={`Pênaltis ${nomeMandante}`}
                      disabled={salvando}
                      className="w-full px-3 py-1.5 text-sm font-semibold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1 truncate" title={nomeVisitante}>
                      Pênaltis {nomeVisitante}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={penaltisVisitante}
                      onChange={(e) => setPenaltisVisitante(e.target.value)}
                      placeholder="0"
                      aria-label={`Pênaltis ${nomeVisitante}`}
                      disabled={salvando}
                      className="w-full px-3 py-1.5 text-sm font-semibold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Opção de W.O. */}
          <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ehWo}
                onChange={(e) => {
                  const check = e.target.checked;
                  setEhWo(check);
                  if (check) {
                    setTemPenaltis(false);
                    if (p.id_equipe_mandante && !equipeDerrotadaWo) {
                      setEquipeDerrotadaWo(p.id_equipe_mandante);
                    }
                  }
                }}
                disabled={salvando}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <span className="text-xs font-semibold text-amber-900">
                Declarar Resultado por W.O.
              </span>
            </label>

            {ehWo && (
              <div className="pt-2 border-t border-amber-200/60 space-y-2 animate-in fade-in duration-150">
                <p className="text-[11px] text-amber-800">
                  Selecione a equipe ausente/infratora (derrotada por W.O.). A outra equipe receberá vitória regulamentar de 3x0.
                </p>

                <div className="space-y-1.5">
                  {p.id_equipe_mandante && (
                    <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="radio"
                        name="equipe_wo"
                        value={p.id_equipe_mandante}
                        checked={equipeDerrotadaWo === p.id_equipe_mandante}
                        onChange={() => setEquipeDerrotadaWo(p.id_equipe_mandante!)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span>{nomeMandante} (Derrotada por W.O.)</span>
                    </label>
                  )}

                  {p.id_equipe_visitante && (
                    <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="radio"
                        name="equipe_wo"
                        value={p.id_equipe_visitante}
                        checked={equipeDerrotadaWo === p.id_equipe_visitante}
                        onChange={() => setEquipeDerrotadaWo(p.id_equipe_visitante!)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span>{nomeVisitante} (Derrotada por W.O.)</span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rodapé de Ações */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50 min-w-[150px]"
            >
              {salvando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Confirmar Placar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
