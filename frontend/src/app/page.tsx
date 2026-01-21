'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { LogIn, User, Lock, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth(); // Usa o hook de autenticação
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('username', data.username);
      formData.append('password', data.password);

      const response = await api.post('/token', formData);
      const token = response.data.access_token;

      // Chama o login do contexto e espera ele resolver (buscar usuário -> redirecionar)
      await login(token);
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Usuário ou senha incorretos');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-8 border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-primary mb-4">
            <LogIn size={32} />
          </div>
          <h1 className="text-3xl font-bold text-primary">Gerencia Esporte</h1>
          <p className="text-slate-500 mt-2">Acesse sua conta para gerenciar a escolinha</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">Usuário</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <User size={20} />
              </span>
              <input
                {...register('username', { required: 'Informe o usuário' })}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="Seu nome de usuário"
              />
            </div>
            {errors.username && <p className="text-xs text-red-500 ml-1">{errors.username.message as string}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 ml-1">Senha</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={20} />
              </span>
              <input
                {...register('password', { required: 'Informe a senha' })}
                type="password"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            {errors.password && <p className="text-xs text-red-500 ml-1">{errors.password.message as string}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Entrando...' : 'Acessar Sistema'}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-400">
            © 2026 Gerencia Esporte - Sistema de Gestão Esportiva
          </p>
        </div>
      </div>
    </div>
  );
}