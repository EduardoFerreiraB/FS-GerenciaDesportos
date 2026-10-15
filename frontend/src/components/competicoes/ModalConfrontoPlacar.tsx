'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Trophy, AlertCircle, Loader2, Calendar, MapPin, User, CheckCircle2 } from 'lucide-react';
import { competicaoService } from '@/services/competicoes';
import { Confronto, FormatoCompeticao } from '@/types/competicoes';

interface ModalConfrontoPlacarProps {
  confronto: Confronto;
  formatoCompeticao?: FormatoCompeticao | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  placar_mandante: number;
  placar_visitante: number;
  status: string;
  observacoes?: string;
}

export default function ModalConfrontoPlacar({
  confronto,
  formatoCompeticao,
  onClose,
  onSuccess,
}: ModalConfrontoPlacarProps) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Determina status inicial razoável (se já foi finalizado ou agendado, default para Finalizado se o usuário está lançando placar)
  const defaultStatus =
    confronto.status === 'Agendado' || confronto.status === 'Agendada'
      ? 'Finalizado'
      : confronto.status === 'Finalizada'
      ? 'Finalizado'
      : confronto.status;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      placar_mandante: confronto.placar_mandante || 0,
      placar_visitante: confronto.placar_visitante || 0,
      status: defaultStatus,
      observacoes: confronto.observacoes || '',
    },
  });

  const watchPlacarMandante = watch('placar_mandante');
  const watchPlacarVisitante = watch('placar_visitante');
  const watchStatus = watch('status');

  const isMataMata =
    formatoCompeticao === 'MATA_MATA' ||
    Boolean(confronto.id_proximo_confronto) ||
    Boolean(
      confronto.fase &&
        (confronto.fase.toLowerCase().includes('final') ||
          confronto.fase.toLowerCase().includes('semi') ||
          confronto.fase.toLowerCase().includes('oitavas') ||
          confronto.fase.toLowerCase().includes('quartas'))
    );

  const onSubmit = async (data: FormValues) => {
    const pMandante = Number(data.placar_mandante);
    const pVisitante = Number(data.placar_visitante);
    const statusFinal =
      data.status === 'Finalizada'
        ? 'Finalizado'
        : data.status === 'Agendada'
        ? 'Agendado'
        : data.status;

    // Se for mata-mata e estiver finalizando, proíbe empate
    if (isMataMata && statusFinal === 'Finalizado' && pMandante === pVisitante) {
      setErro('Confrontos eliminatórios (mata-mata) não podem terminar empatados. Defina o vencedor no placar.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      await competicaoService.atualizarConfronto(confronto.id_confronto, {
        placar_mandante: pMandante,
        placar_visitante: pVisitante,
        status: statusFinal,
        observacoes: data.observacoes?.trim() || undefined,
      });
      onSuccess();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        'Erro ao salvar placar do confronto. Verifique se os dados estão corretos.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  };

  const mandanteNome = confronto.equipe_mandante?.nome || 'Mandante (A definir)';
  const visitanteNome = confronto.equipe_visitante?.nome || 'Visitante (A definir)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X size={20} />
        </button>

        {/* Cabeçalho */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-3">
            <Trophy className="text-amber-500" size={26} />
            Lançar Placar
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span className="font-semibold text-slate-700">Confronto #{confronto.id_confronto}</span>
            {confronto.fase && (
              <>
                <span>•</span>
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold">
                  {confronto.fase}
                </span>
              </>
            )}
            {confronto.grupo && (
              <>
                <span>•</span>
                <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-bold">
                  Grupo {confronto.grupo}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Informações de Local e Data */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl mb-6 text-xs text-slate-600 border border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-slate-400 shrink-0" />
            <span className="truncate">
              {confronto.data ? new Date(confronto.data + 'T00:00:00').toLocaleDateString() : 'Sem data'} às{' '}
              {confronto.hora ? confronto.hora.substring(0, 5) : '00:00'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-slate-400 shrink-0" />
            <span className="truncate" title={confronto.local?.loca_nome || 'Local a definir'}>
              {confronto.local?.loca_nome || 'Local a definir'}
            </span>
          </div>
          {confronto.arbitro && (
            <div className="col-span-2 flex items-center gap-2 pt-1 border-t border-slate-200/60">
              <User size={15} className="text-slate-400 shrink-0" />
              <span className="truncate">Árbitro: {confronto.arbitro.apito_nome}</span>
            </div>
          )}
        </div>

        {erro && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div className="font-medium">{erro}</div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Placar Interativo */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between gap-4">
              {/* Mandante */}
              <div className="flex-1 text-center">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 truncate" title={mandanteNome}>
                  {mandanteNome}
                </span>
                <input
                  type="number"
                  min={0}
                  {...register('placar_mandante', {
                    required: true,
                    min: { value: 0, message: 'Valor mínimo é 0' },
                  })}
                  className="w-20 sm:w-24 text-center font-black text-2xl sm:text-3xl py-3 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all"
                />
              </div>

              {/* Divisor X */}
              <div className="flex flex-col items-center justify-center px-2">
                <span className="text-slate-400 font-black text-lg tracking-widest">VS</span>
              </div>

              {/* Visitante */}
              <div className="flex-1 text-center">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 truncate" title={visitanteNome}>
                  {visitanteNome}
                </span>
                <input
                  type="number"
                  min={0}
                  {...register('placar_visitante', {
                    required: true,
                    min: { value: 0, message: 'Valor mínimo é 0' },
                  })}
                  className="w-20 sm:w-24 text-center font-black text-2xl sm:text-3xl py-3 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all"
                />
              </div>
            </div>

            {/* Aviso visual de vencedor em tempo real */}
            {watchStatus === 'Finalizado' && Number(watchPlacarMandante) !== Number(watchPlacarVisitante) && (
              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600">
                <CheckCircle2 size={14} />
                <span>
                  Vencedor:{' '}
                  {Number(watchPlacarMandante) > Number(watchPlacarVisitante)
                    ? mandanteNome
                    : visitanteNome}
                </span>
              </div>
            )}

            {isMataMata && watchStatus === 'Finalizado' && Number(watchPlacarMandante) === Number(watchPlacarVisitante) && (
              <div className="mt-4 pt-3 border-t border-rose-200 flex items-center justify-center gap-1.5 text-xs font-bold text-rose-600">
                <AlertCircle size={14} />
                <span>Mata-mata não pode terminar empatado. Defina a equipe vencedora!</span>
              </div>
            )}
          </div>

          {/* Status do Confronto */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Status do Confronto *
            </label>
            <select
              {...register('status', { required: true })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="Finalizado">Finalizado (Calcula classificação e chave)</option>
              <option value="Em Andamento">Em Andamento (Partida ocorrendo)</option>
              <option value="Agendado">Agendado (Aguardando realização)</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Observações / Ocorrências da Partida
            </label>
            <textarea
              {...register('observacoes')}
              rows={3}
              placeholder="Ex: Partida decidida nos pênaltis (5x4). Acréscimo de 4 minutos no 2º tempo."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          {/* Súmula anexada */}
          {confronto.sumula_arquivo && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center justify-between">
              <span className="font-semibold">Súmula oficial vinculada à partida</span>
              <a
                href={confronto.sumula_arquivo}
                target="_blank"
                rel="noreferrer"
                className="underline font-bold hover:text-emerald-900"
              >
                Visualizar Arquivo
              </a>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {salvando ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Salvando Placar...</span>
                </>
              ) : (
                'Salvar Resultado'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
