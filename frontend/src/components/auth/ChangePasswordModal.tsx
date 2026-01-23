'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { X, Lock, Save, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { clsx } from 'clsx';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
  forceChange?: boolean; 
}

export default function ChangePasswordModal({ onClose, onSuccess, forceChange = false }: ChangePasswordModalProps) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  
  const newPassword = watch('new_password');

  const onSubmit = async (data: any) => {
    try {
      await api.post('/change-password', {
        old_password: data.old_password,
        new_password: data.new_password,
        confirm_password: data.confirm_password
      });
      alert('Senha alterada com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || 'Erro ao alterar senha.';
      alert(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100 relative">
        
        {!forceChange && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        )}

        <div className="mb-6 text-center">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            {forceChange ? 'Alteração Obrigatória' : 'Alterar Senha'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {forceChange 
              ? 'Por segurança, você precisa alterar sua senha no primeiro acesso.' 
              : 'Digite sua senha atual e a nova senha.'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Senha Atual</label>
            <input 
              type="password"
              {...register('old_password', { required: 'Obrigatório' })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
              placeholder="••••••••"
            />
            {errors.old_password && <span className="text-xs text-red-500 ml-1">Campo obrigatório</span>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Nova Senha</label>
            <input 
              type="password"
              {...register('new_password', { 
                required: 'Obrigatório',
                minLength: { value: 6, message: 'Mínimo 6 caracteres' }
              })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
              placeholder="••••••••"
            />
            {errors.new_password && <span className="text-xs text-red-500 ml-1">{errors.new_password.message as string}</span>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Confirmar Nova Senha</label>
            <input 
              type="password"
              {...register('confirm_password', { 
                required: 'Obrigatório',
                validate: (val: string) => {
                  if (watch('new_password') != val) {
                    return "As senhas não conferem";
                  }
                },
              })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
              placeholder="••••••••"
            />
            {errors.confirm_password && <span className="text-xs text-red-500 ml-1">{errors.confirm_password.message as string}</span>}
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 shadow-lg shadow-amber-100 disabled:opacity-70 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Salvando...' : <><Save size={20} /> Alterar Senha</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}