'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { 
  Users, 
  Save, 
  X, 
  Trophy,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';
import useSWR from 'swr';

const fetcher = (url: string) => api.get(url).then(res => res.data);

interface EquipeFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export default function EquipeForm({ initialData, isEditing = false }: EquipeFormProps) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    mode: 'onChange'
  });

  const { data: edicoes } = useSWR('/edicoes/', fetcher);

  const onSubmit = async (data: any) => {
    try {
      const payload = {
        nome: data.nome,
        id_edicao: parseInt(data.id_edicao)
      };

      if (isEditing) {
        await api.put(`/equipes/${initialData.id_equipe}`, payload);
        alert('Equipe atualizada com sucesso!');
      } else {
        await api.post('/equipes/', payload);
        alert('Equipe criada com sucesso!');
      }
      router.push('/dashboard/equipes');
    } catch (error: any) {
      console.error(error);
      alert('Erro ao salvar equipe.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="text-blue-600" size={28} />
          {isEditing ? 'Editar Equipe' : 'Nova Equipe'}
        </h1>
        <p className="text-slate-500 mt-1">
          {isEditing ? 'Altere os dados da equipe abaixo.' : 'Crie uma nova equipe para uma competição.'}
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
          <div className="space-y-4">
            <div className="w-full space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Nome da Equipe <span className="text-red-500">*</span>
              </label>
              <input
                {...register('nome', { required: 'Nome é obrigatório' })}
                className={clsx(
                  "w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-slate-400",
                  errors.nome ? "border-red-300 focus:ring-red-200 focus:border-red-400" : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
                )}
                placeholder="Ex: Goianira FC"
              />
              {errors.nome && <p className="text-xs text-red-500 flex items-center gap-1 ml-1"><AlertCircle size={12} />{errors.nome.message as string}</p>}
            </div>

            <div className="w-full space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Competição / Edição <span className="text-red-500">*</span>
              </label>
              <select 
                {...register('id_edicao', { required: 'Selecione uma edição' })}
                className={clsx(
                  "w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all appearance-none cursor-pointer",
                  errors.id_edicao ? "border-red-300 focus:ring-red-200 focus:border-red-400" : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
                )}
              >
                <option value="">Selecione...</option>
                {edicoes?.map((e: any) => (
                  <option key={e.id_edicao} value={e.id_edicao}>
                    {e.evento?.even_nome} - {e.edic_ano}
                  </option>
                ))}
              </select>
              {errors.id_edicao && <p className="text-xs text-red-500 flex items-center gap-1 ml-1"><AlertCircle size={12} />{errors.id_edicao.message as string}</p>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <X size={20} />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
            >
              <Save size={20} />
              {isEditing ? 'Salvar Alterações' : 'Criar Equipe'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
