'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { 
  GraduationCap, 
  Save, 
  X, 
  Clock, 
  AlignLeft,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';
import useSWR from 'swr';

const fetcher = (url: string) => api.get(url).then(res => res.data);

const diasSemana = [
  { id: 'SEG', label: 'Segunda' },
  { id: 'TER', label: 'Terça' },
  { id: 'QUA', label: 'Quarta' },
  { id: 'QUI', label: 'Quinta' },
  { id: 'SEX', label: 'Sexta' },
  { id: 'SAB', label: 'Sábado' },
  { id: 'DOM', label: 'Domingo' },
];

interface TurmaFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export default function TurmaForm({ initialData, isEditing = false }: TurmaFormProps) {
  const router = useRouter();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm();
  const [selectedDias, setSelectedDias] = useState<string[]>([]);

  // Buscar dados reais para os selects
  const { data: modalidades } = useSWR('/modalidades/', fetcher);
  const { data: professores } = useSWR('/professores/', fetcher);

  useEffect(() => {
    if (initialData) {
      Object.keys(initialData).forEach(key => {
        if (key !== 'dias_semana') setValue(key, initialData[key]);
      });
      
      // Ajuste: A API provavelmente retorna string "SEG,QUA" ou JSON. O form usa array.
      if (initialData.dias_semana) {
        if (Array.isArray(initialData.dias_semana)) {
          setSelectedDias(initialData.dias_semana);
        } else if (typeof initialData.dias_semana === 'string') {
          try {
            // Tenta limpar aspas simples se vier do Python string representation
            const cleanStr = initialData.dias_semana.replace(/'/g, '"');
            if (cleanStr.startsWith('[')) {
                 const parsed = JSON.parse(cleanStr);
                 setSelectedDias(Array.isArray(parsed) ? parsed : [initialData.dias_semana]);
            } else {
                 setSelectedDias(initialData.dias_semana.split(',').map((d:string) => d.trim()));
            }
          } catch {
             setSelectedDias(initialData.dias_semana.split(',').map((d:string) => d.trim()));
          }
        }
      }
    }
  }, [initialData, setValue]);

  const toggleDia = (id: string) => {
    setSelectedDias(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const onSubmit = async (data: any) => {
    if (selectedDias.length === 0) {
      alert('Selecione pelo menos um dia da semana.');
      return;
    }

    try {
      // Limpeza de horários para garantir HH:MM:SS
      const inicio = data.horario_inicio.length === 5 ? data.horario_inicio + ":00" : data.horario_inicio;
      const fim = data.horario_fim.length === 5 ? data.horario_fim + ":00" : data.horario_fim;

      const payload = {
        descricao: data.descricao,
        categoria_idade: data.categoria_idade,
        horario_inicio: inicio,
        horario_fim: fim,
        dias_semana: selectedDias, 
        id_modalidade: parseInt(data.modalidade_id),
        id_professor: parseInt(data.professor_id)
      };

      if (isEditing) {
        // Ao atualizar, usamos o ID da URL ou do initialData
        await api.put(`/turmas/${initialData.id_turma}`, payload);
        alert('Turma atualizada com sucesso!');
      } else {
        await api.post('/turmas/', payload);
        alert('Turma criada com sucesso!');
      }
      router.push('/dashboard/turmas');
    } catch (error: any) {
      console.error("Erro detalhado:", error.response?.data); 
      
      // Tratamento melhorado para exibir o erro real do Pydantic (422) ou lógica (400)
      let errorMessage = 'Erro ao salvar turma.';
      if (error.response?.data?.detail) {
          const detail = error.response.data.detail;
          if (Array.isArray(detail)) {
              // Erro de validação Pydantic (422)
              errorMessage = detail.map((e: any) => `${e.loc[1]}: ${e.msg}`).join('\n');
          } else {
              // Erro de lógica (400)
              errorMessage = detail;
          }
      }
      
      alert(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-12">
      
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <GraduationCap className="text-indigo-600" size={28} />
          {isEditing ? 'Editar Turma' : 'Nova Turma'}
        </h1>
        <p className="text-slate-500 mt-1">
          {isEditing ? 'Altere os dados da turma abaixo.' : 'Preencha os dados para criar uma nova turma.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* 1. Informações da Turma */}
        <CardSection title="Informações da Turma" icon={AlignLeft} theme="indigo">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Modalidade */}
            <div className="w-full space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Modalidade</label>
              <select 
                {...register('modalidade_id', { required: 'Selecione uma modalidade' })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="">Selecione...</option>
                {modalidades?.map((m: any) => (
                  <option key={m.id_modalidade} value={m.id_modalidade}>{m.nome}</option>
                ))}
              </select>
              {errors.modalidade_id && <span className="text-xs text-red-500 ml-1">{errors.modalidade_id.message as string}</span>}
            </div>

            {/* Professor */}
            <div className="w-full space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Professor Responsável</label>
              <select 
                {...register('professor_id', { required: 'Selecione um professor' })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="">Selecione...</option>
                {professores?.map((p: any) => (
                  <option key={p.id_professor} value={p.id_professor}>{p.nome}</option>
                ))}
              </select>
              {errors.professor_id && <span className="text-xs text-red-500 ml-1">{errors.professor_id.message as string}</span>}
            </div>

            {/* Categoria */}
            <Input 
              label="Categoria / Idade" 
              placeholder="Ex: Sub-11, Adulto..." 
              register={register('categoria_idade', { required: 'A categoria é obrigatória' })}
              error={errors.categoria_idade}
              theme="indigo"
            />

            {/* Descrição */}
            <Input 
              label="Descrição / Nome da Turma" 
              placeholder="Ex: Futebol Manhã Iniciante" 
              register={register('descricao', { required: 'O nome/descrição é obrigatório' })}
              error={errors.descricao}
              theme="indigo"
            />
          </div>
        </CardSection>

        {/* 2. Horários e Dias */}
        <CardSection title="Horários e Dias" icon={Calendar} theme="indigo">
          <div className="space-y-6">
            
            {/* Dias da Semana */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">Dias da Semana</label>
              <div className="flex flex-wrap gap-2">
                {diasSemana.map((dia) => (
                  <button
                    key={dia.id}
                    type="button"
                    onClick={() => toggleDia(dia.id)}
                    className={clsx(
                      "px-4 py-2 rounded-lg text-sm font-semibold transition-all border",
                      selectedDias.includes(dia.id)
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
              {selectedDias.length === 0 && <p className="text-xs text-slate-400 mt-2 ml-1">Selecione pelo menos um dia.</p>}
            </div>

            {/* Horários */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="w-full space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
                  <Clock size={16} className="text-indigo-500" /> Horário de Início
                </label>
                <input
                  type="time"
                  {...register('horario_inicio', { required: 'Obrigatório' })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                />
                {errors.horario_inicio && <span className="text-xs text-red-500 ml-1">Campo obrigatório</span>}
              </div>

              <div className="w-full space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
                  <Clock size={16} className="text-indigo-500" /> Horário de Fim
                </label>
                <input
                  type="time"
                  {...register('horario_fim', { required: 'Obrigatório' })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                />
                {errors.horario_fim && <span className="text-xs text-red-500 ml-1">Campo obrigatório</span>}
              </div>
            </div>

          </div>
        </CardSection>

      </div>

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200">
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
          className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
        >
          {isSubmitting ? 'Salvando...' : <><Save size={20} /> {isEditing ? 'Salvar Alterações' : 'Criar Turma'}</>}
        </button>
      </div>

    </form>
  );
}

// --- Componentes Locais --- 

function CardSection({ title, icon: Icon, children, theme }: any) {
  const themeClasses = theme === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600';
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow duration-300 h-full">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
        <div className={clsx("p-2 rounded-lg", themeClasses)}>
          <Icon size={20} />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function Input({ label, type = "text", placeholder, register, error, theme }: any) {
  const focusClasses = theme === 'indigo' ? 'focus:ring-indigo-500/20 focus:border-indigo-500' : 'focus:ring-primary/20 focus:border-primary';
  
  return (
    <div className="w-full space-y-1.5">
      <label className="text-sm font-semibold text-slate-700 ml-1">{label}</label>
      <input
        type={type}
        className={clsx(
          "w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-slate-400",
          error ? "border-red-300 focus:ring-red-200 focus:border-red-400" : `border-slate-200 ${focusClasses}`
        )}
        placeholder={placeholder}
        {...register}
      />
      {error && <p className="text-xs text-red-500 flex items-center gap-1 ml-1"><AlertCircle size={12} />{error.message}</p>}
    </div>
  );
}
