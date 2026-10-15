'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { X, Clock, AlertCircle, Loader2, Calendar, MapPin, FileText } from 'lucide-react';
import api from '@/lib/api';
import { competicaoService } from '@/services/competicoes';
import { Prova, StatusProva, LocalSimples } from '@/types/competicoes';

const fetcher = (url: string) => api.get(url).then(res => res.data);

interface ModalProvaFormProps {
  isOpen: boolean;
  onClose: () => void;
  idCompeticao: number;
  prova?: Prova | null;
  onSuccess: () => void;
}

interface FormValues {
  nome: string;
  data: string;
  hora: string;
  id_local: string;
  status: StatusProva;
  observacoes: string;
}

export default function ModalProvaForm({
  isOpen,
  onClose,
  idCompeticao,
  prova,
  onSuccess,
}: ModalProvaFormProps) {
  const { data: locais } = useSWR<LocalSimples[]>('/locais', fetcher);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const isEditando = Boolean(prova);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      nome: '',
      data: '',
      hora: '',
      id_local: '',
      status: 'Agendada',
      observacoes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      setErro(null);
      if (prova) {
        reset({
          nome: prova.nome || '',
          data: prova.data ? prova.data.split('T')[0] : '',
          hora: prova.hora || '',
          id_local: prova.id_local ? prova.id_local.toString() : '',
          status: prova.status || 'Agendada',
          observacoes: prova.observacoes || '',
        });
      } else {
        reset({
          nome: '',
          data: '',
          hora: '',
          id_local: '',
          status: 'Agendada',
          observacoes: '',
        });
      }
    }
  }, [isOpen, prova, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: FormValues) => {
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        nome: data.nome.trim(),
        data: data.data || undefined,
        hora: data.hora || undefined,
        id_local: data.id_local ? parseInt(data.id_local, 10) : undefined,
        status: data.status,
        observacoes: data.observacoes ? data.observacoes.trim() : undefined,
      };

      if (isEditando && prova) {
        await competicaoService.atualizarProva(prova.id_prova, payload);
      } else {
        await competicaoService.criarProva(idCompeticao, payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao salvar prova. Verifique os dados fornecidos.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-3">
          <Clock className="text-purple-600" size={26} />
          {isEditando ? 'Editar Prova Individual' : 'Nova Prova Individual'}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {isEditando
            ? 'Atualize as informações de horário, local e status desta prova.'
            : 'Defina a prova (ex: 100m Rasos, 50m Nado Livre) dentro da competição individual.'}
        </p>

        {erro && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>{erro}</div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome da Prova */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Nome da Prova *
            </label>
            <input
              type="text"
              placeholder="Ex: 100 Metros Rasos - Masculino"
              {...register('nome', { required: 'Nome da prova é obrigatório' })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium text-slate-800"
            />
            {errors.nome && (
              <span className="text-xs text-rose-500 mt-1 block">{errors.nome.message}</span>
            )}
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                Data
              </label>
              <input
                type="date"
                {...register('data')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                Horário
              </label>
              <input
                type="time"
                step="1"
                {...register('hora')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800"
              />
            </div>
          </div>

          {/* Local e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                <MapPin size={14} className="text-slate-400" />
                Local
              </label>
              <select
                {...register('id_local')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800 bg-white"
              >
                <option value="">Nenhum local selecionado</option>
                {locais?.map(local => (
                  <option key={local.id_local} value={local.id_local}>
                    {local.loca_nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Status
              </label>
              <select
                {...register('status')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800 bg-white font-medium"
              >
                <option value="Agendada">Agendada</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Finalizada">Finalizada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" />
              Observações / Informações Técnicas
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Raia 1 a 8, cronometragem eletrônica, eliminatória única."
              {...register('observacoes')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800 resize-none"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-100 transition-all flex items-center gap-2 cursor-pointer"
            >
              {salvando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : isEditando ? (
                'Salvar Alterações'
              ) : (
                'Cadastrar Prova'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
