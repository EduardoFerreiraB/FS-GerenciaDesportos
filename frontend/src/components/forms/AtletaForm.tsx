'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { 
  UserPlus, 
  UploadCloud, 
  Image as ImageIcon, 
  Save, 
  X,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';

interface AtletaFormProps {
  idEquipe: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function AtletaForm({ idEquipe, onSuccess, onCancel }: AtletaFormProps) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    mode: 'onChange'
  });
  
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      const formData = new FormData();
      formData.append('nome_completo', data.nome_completo);
      formData.append('data_nascimento', data.data_nascimento);
      formData.append('documento_pessoal', data.documento_pessoal);
      
      if (data.contato) formData.append('contato', data.contato);
      if (data.endereco) formData.append('endereco', data.endereco);
      if (fotoFile) formData.append('foto', fotoFile);

      await api.post(`/atletas/equipe/${idEquipe}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Atleta cadastrado e vinculado com sucesso!');
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || 'Erro ao cadastrar atleta.';
      alert(msg);
    }
  };

  const numberRegisterOptions = {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-2xl p-6 space-y-6 border border-slate-100 shadow-sm">
        
        {/* Foto */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-slate-300 flex flex-col items-center">
                  <ImageIcon size={32} />
                  <span className="text-[8px] uppercase font-bold mt-1">Sem Foto</span>
                </div>
              )}
            </div>
            {fotoPreview && (
              <button 
                type="button"
                onClick={() => { setFotoPreview(null); setFotoFile(null); }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <label className="cursor-pointer text-xs font-semibold text-primary hover:text-primary-hover transition-colors">
            Selecionar Foto
            <input type="file" className="hidden" accept="image/*" onChange={handleFotoChange} />
          </label>
        </div>

        {/* Dados Pessoais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Nome Completo <span className="text-red-500">*</span></label>
            <input 
              {...register('nome_completo', { required: 'Obrigatório' })}
              className={clsx("w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all", errors.nome_completo ? "border-red-300" : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500")}
              placeholder="Ex: Pedro Alvares"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Data de Nascimento <span className="text-red-500">*</span></label>
            <input 
              type="date"
              {...register('data_nascimento', { required: 'Obrigatório' })}
              className={clsx("w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all", errors.data_nascimento ? "border-red-300" : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Documento (RG/CPF) <span className="text-red-500">*</span></label>
            <input 
              {...register('documento_pessoal', { required: 'Obrigatório' })}
              className={clsx("w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all", errors.documento_pessoal ? "border-red-300" : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500")}
              placeholder="Apenas números"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Contato (WhatsApp)</label>
            <input 
              {...register('contato', numberRegisterOptions)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="Apenas números"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 ml-1">Endereço</label>
          <input 
            {...register('endereco')}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            placeholder="Rua, Número, Bairro..."
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-70"
          >
            {isSubmitting ? 'Salvando...' : 'Cadastrar Atleta'}
          </button>
        </div>
      </div>
    </form>
  );
}
