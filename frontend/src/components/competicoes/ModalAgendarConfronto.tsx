'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { X, CalendarPlus, AlertCircle, Loader2, MapPin, User, Shield } from 'lucide-react';
import api from '@/lib/api';
import { competicaoService } from '@/services/competicoes';
import { EquipeCompeticao, FormatoCompeticao } from '@/types/competicoes';

const fetcher = (url: string) => api.get(url).then((res) => res.data);

interface ModalAgendarConfrontoProps {
  idCompeticao: number;
  equipes: EquipeCompeticao[];
  formatoCompeticao?: FormatoCompeticao | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  id_equipe_mandante: string;
  id_equipe_visitante: string;
  data: string;
  hora: string;
  id_local: string;
  id_arbitro: string;
  fase?: string;
  rodada?: string;
  grupo?: string;
  observacoes?: string;
}

export default function ModalAgendarConfronto({
  idCompeticao,
  equipes,
  formatoCompeticao,
  onClose,
  onSuccess,
}: ModalAgendarConfrontoProps) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data: locais, isLoading: loadingLocais } = useSWR('/locais', fetcher);
  const { data: arbitros, isLoading: loadingArbitros } = useSWR('/arbitros', fetcher);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      id_equipe_mandante: '',
      id_equipe_visitante: '',
      data: '',
      hora: '',
      id_local: '',
      id_arbitro: '',
      fase: formatoCompeticao === 'MATA_MATA' ? 'Quartas' : 'Rodada 1',
      rodada: '1',
      grupo: '',
      observacoes: '',
    },
  });

  const watchMandante = watch('id_equipe_mandante');
  const watchVisitante = watch('id_equipe_visitante');

  const onSubmit = async (data: FormValues) => {
    if (data.id_equipe_mandante && data.id_equipe_visitante && data.id_equipe_mandante === data.id_equipe_visitante) {
      setErro('A equipe mandante e visitante não podem ser a mesma.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const horaFormatada = data.hora.length === 5 ? `${data.hora}:00` : data.hora;

      await competicaoService.criarConfronto({
        id_competicao: idCompeticao,
        id_local: parseInt(data.id_local, 10),
        id_arbitro: parseInt(data.id_arbitro, 10),
        data: data.data,
        hora: horaFormatada,
        fase: data.fase?.trim() || undefined,
        rodada: data.rodada ? parseInt(data.rodada, 10) : undefined,
        grupo: data.grupo?.trim() || undefined,
        id_equipe_mandante: data.id_equipe_mandante ? parseInt(data.id_equipe_mandante, 10) : undefined,
        id_equipe_visitante: data.id_equipe_visitante ? parseInt(data.id_equipe_visitante, 10) : undefined,
        observacoes: data.observacoes?.trim() || undefined,
      });

      onSuccess();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        'Erro ao agendar confronto. Verifique se há conflito de horário/local ou com as equipes.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 my-8 animate-in zoom-in-95 border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-3">
          <CalendarPlus className="text-blue-600" size={26} />
          Agendar Confronto
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Defina as equipes participantes, data, horário, local e arbitragem para a partida.
        </p>

        {erro && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>{erro}</div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Seleção de Equipes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            {/* Mandante */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Shield size={14} className="text-blue-600" />
                Equipe Mandante
              </label>
              <select
                {...register('id_equipe_mandante')}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="">A definir / Bye</option>
                {equipes.map((e) => (
                  <option
                    key={e.id_equipe}
                    value={e.id_equipe}
                    disabled={e.id_equipe.toString() === watchVisitante}
                  >
                    {e.nome} {e.grupo ? `(Gr. ${e.grupo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Visitante */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Shield size={14} className="text-purple-600" />
                Equipe Visitante
              </label>
              <select
                {...register('id_equipe_visitante')}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="">A definir / Bye</option>
                {equipes.map((e) => (
                  <option
                    key={e.id_equipe}
                    value={e.id_equipe}
                    disabled={e.id_equipe.toString() === watchMandante}
                  >
                    {e.nome} {e.grupo ? `(Gr. ${e.grupo})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Data do Jogo *
              </label>
              <input
                type="date"
                {...register('data', { required: 'A data do jogo é obrigatória' })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {errors.data && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.data.message}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Horário de Início *
              </label>
              <input
                type="time"
                {...register('hora', { required: 'O horário do jogo é obrigatório' })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {errors.hora && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.hora.message}</span>
              )}
            </div>
          </div>

          {/* Local e Árbitro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <MapPin size={14} className="text-rose-500" />
                Local da Partida *
              </label>
              {loadingLocais ? (
                <div className="text-xs text-slate-400 py-2.5">Carregando locais...</div>
              ) : (
                <select
                  {...register('id_local', { required: 'O local é obrigatório' })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="">Selecione um local...</option>
                  {locais
                    ?.filter((l: any) => l.ativo !== false)
                    .map((l: any) => (
                      <option key={l.id_local} value={l.id_local}>
                        {l.loca_nome}
                      </option>
                    ))}
                </select>
              )}
              {errors.id_local && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.id_local.message}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <User size={14} className="text-amber-500" />
                Árbitro Responsável *
              </label>
              {loadingArbitros ? (
                <div className="text-xs text-slate-400 py-2.5">Carregando árbitros...</div>
              ) : (
                <select
                  {...register('id_arbitro', { required: 'O árbitro é obrigatório' })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="">Selecione um árbitro...</option>
                  {arbitros?.map((a: any) => (
                    <option key={a.id_arbitro} value={a.id_arbitro}>
                      {a.apito_nome}
                    </option>
                  ))}
                </select>
              )}
              {errors.id_arbitro && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.id_arbitro.message}</span>
              )}
            </div>
          </div>

          {/* Fase, Rodada, Grupo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Fase / Etapa
              </label>
              <input
                {...register('fase')}
                placeholder={formatoCompeticao === 'MATA_MATA' ? 'Ex: Quartas' : 'Ex: Fase de Grupos'}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Rodada (Número)
              </label>
              <input
                type="number"
                min={1}
                {...register('rodada')}
                placeholder="Ex: 1"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Grupo
              </label>
              <input
                {...register('grupo')}
                placeholder="Ex: A ou B"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Observações Adicionais
            </label>
            <textarea
              {...register('observacoes')}
              rows={2}
              placeholder="Ex: Jogo com transmissão ao vivo. Chegada das equipes 30 min antes."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
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
                  <span>Agendando...</span>
                </>
              ) : (
                'Confirmar Agendamento'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
