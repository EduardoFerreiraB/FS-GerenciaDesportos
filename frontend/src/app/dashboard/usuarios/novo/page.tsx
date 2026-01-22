'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { 
  ShieldCheck, 
  Save, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';

export default function NovoUsuarioPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data: any) => {
    try {
      await api.post('/register', data);
      alert('Usuário criado com sucesso!');
      router.push('/dashboard/usuarios');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || 'Erro ao criar usuário.';
      alert(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-12">
      
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="text-purple-600" size={28} />
          Cadastrar Novo Usuário
        </h1>
        <p className="text-slate-500 mt-1">Crie contas administrativas ou de coordenação.</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-6 space-y-6">
            
            <div className="space-y-4">
              <Input 
                label="Nome de Usuário" 
                placeholder="Ex: coordenador.joao" 
                register={register('username', { required: 'Obrigatório' })}
                error={errors.username}
                theme="purple"
              />
              <Input 
                label="Senha" 
                type="password"
                placeholder="••••••••" 
                register={register('password', { required: 'Obrigatório', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
                error={errors.password}
                theme="purple"
              />
              
              <div className="w-full space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1">Perfil de Acesso (Role)</label>
                <select 
                  {...register('role', { required: true })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="coordenador">Coordenador</option>
                  <option value="admin">Administrador</option>
                  <option value="assistente">Assistente</option>
                  {/* Professor não aparece aqui pois é criado via tela de Professores */}
                </select>
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
                className="px-8 py-3 rounded-xl bg-purple-600 text-white font-semibold shadow-lg shadow-purple-100 hover:bg-purple-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
                >
                <Save size={20} />
                Criar Usuário
                </button>
            </div>

        </div>
      </div>
    </form>
  );
}

function Input({ label, type = "text", placeholder, register, error, theme }: any) {
  return (
    <div className="w-full space-y-1.5">
      <label className="text-sm font-semibold text-slate-700 ml-1">{label}</label>
      <input
        type={type}
        className={clsx(
          "w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-slate-400",
          error ? "border-red-300 focus:ring-red-200 focus:border-red-400" : "border-slate-200 focus:ring-purple-500/20 focus:border-purple-500"
        )}
        placeholder={placeholder}
        {...register}
      />
      {error && <p className="text-xs text-red-500 flex items-center gap-1 ml-1"><AlertCircle size={12} />{error.message}</p>}
    </div>
  );
}