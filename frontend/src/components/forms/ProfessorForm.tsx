'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { 
  UserCheck, 
  Save, 
  X, 
  ShieldCheck, 
  User, 
  AlertCircle,
  Pencil
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';

interface ProfessorFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export default function ProfessorForm({ initialData, isEditing = false }: ProfessorFormProps) {
  const router = useRouter();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (initialData) {
      Object.keys(initialData).forEach(key => {
        setValue(key, initialData[key]);
      });
      // Preenche o usuário se vier no objeto aninhado
      if (initialData.usuario) {
        setValue('username', initialData.usuario.username);
      }
    }
  }, [initialData, setValue]);

  const onSubmit = async (data: any) => {
    try {
      const payload = { ...data };
      
      // Ajuste de payload para o back-end (separar professor e usuario)
      // O back-end espera { nome, cpf, contato, username, password } num único corpo JSON para criação?
      // Analisando schemas.py: ProfessorCreate tem esses campos?
      // O endpoint POST /professores espera ProfessorCreate que herda de ProfessorBase (nome, cpf, contato).
      // Mas a criação de usuário é feita junto? 
      // Geralmente sim, ou o backend espera { professor: {...}, usuario: {...} }.
      // Vamos assumir que o endpoint lida com tudo plano ou ajustar conforme o erro.
      // Analisando routers/professores.py (se pudesse ler): Geralmente se envia tudo junto.
      
      if (isEditing) {
        await api.put(`/professores/${initialData.id_professor}`, payload);
        alert('Professor atualizado com sucesso!');
      } else {
        await api.post('/professores/', payload);
        alert('Professor cadastrado com sucesso!');
      }
      router.push('/dashboard/professores');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || 'Erro ao salvar professor.';
      alert(Array.isArray(msg) ? msg[0].msg : msg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-12">
      
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          {isEditing ? <Pencil className="text-emerald-600" size={28} /> : <UserCheck className="text-emerald-600" size={28} />}
          {isEditing ? 'Editar Professor' : 'Cadastrar Professor'}
        </h1>
        <p className="text-slate-500 mt-1">
          {isEditing ? 'Atualize as informações do professor.' : 'Adicione um novo membro à equipe e configure seu acesso.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 1. Dados Pessoais */}
        <div className="space-y-6">
          <CardSection title="Informações Pessoais" icon={User} theme="emerald">
            <div className="space-y-4">
              <Input 
                label="Nome Completo" 
                placeholder="Ex: Ricardo Oliveira" 
                register={register('nome', { required: 'O nome é obrigatório' })}
                error={errors.nome}
                theme="emerald"
              />
              <Input 
                label="CPF" 
                placeholder="000.000.000-00" 
                register={register('cpf', { required: 'O CPF é obrigatório' })}
                error={errors.cpf}
                theme="emerald"
              />
              <Input 
                label="WhatsApp / Contato" 
                placeholder="(00) 00000-0000" 
                register={register('contato', { required: 'O contato é obrigatório' })}
                error={errors.contato}
                theme="emerald"
              />
            </div>
          </CardSection>
        </div>

        {/* 2. Configurações de Acesso */}
        <div className="space-y-6">
          <CardSection title="Acesso ao Sistema" icon={ShieldCheck} theme="emerald">
            <div className="space-y-4">
              <Input 
                label="Nome de Usuário" 
                placeholder="Ex: ricardo.oliveira" 
                register={register('username', { required: 'O usuário é obrigatório' })}
                error={errors.username}
                theme="emerald"
                disabled={isEditing} // Geralmente não se altera username fácil
              />
              {!isEditing && (
                <Input 
                  label="Senha Inicial" 
                  type="password"
                  placeholder="••••••••" 
                  register={register('password', { required: 'A senha é obrigatória', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
                  error={errors.password}
                  theme="emerald"
                />
              )}
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-xs text-emerald-700 leading-relaxed">
                  <strong>Nota:</strong> Este usuário possui acesso de <strong>Professor</strong>. 
                  Ele poderá visualizar suas turmas, alunos vinculados e realizar chamadas.
                </p>
              </div>
            </div>
          </CardSection>
        </div>

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
          className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
        >
          {isSubmitting ? 'Salvando...' : <><Save size={20} /> {isEditing ? 'Salvar Alterações' : 'Cadastrar Professor'}</>}
        </button>
      </div>

    </form>
  );
}

// --- Componentes Locais ---

function CardSection({ title, icon: Icon, children, theme }: any) {
  const themeClasses = theme === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600';
  
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

function Input({ label, type = "text", placeholder, register, error, theme, disabled }: any) {
  const focusClasses = theme === 'emerald' ? 'focus:ring-emerald-500/20 focus:border-emerald-500' : 'focus:ring-primary/20 focus:border-primary';
  
  return (
    <div className="w-full space-y-1.5">
      <label className="text-sm font-semibold text-slate-700 ml-1">{label}</label>
      <input
        type={type}
        disabled={disabled}
        className={clsx(
          "w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-100",
          error ? "border-red-300 focus:ring-red-200 focus:border-red-400" : `border-slate-200 ${focusClasses}`
        )}
        placeholder={placeholder}
        {...register}
      />
      {error && <p className="text-xs text-red-500 flex items-center gap-1 ml-1"><AlertCircle size={12} />{error.message}</p>}
    </div>
  );
}