'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Users, AlertCircle, Loader2 } from 'lucide-react';
import { competicaoService } from '@/services/competicoes';
import { FormatoCompeticao } from '@/types/competicoes';

interface ModalNovaEquipeCompeticaoProps {
  idCompeticao: number;
  idEdicao: number;
  formato?: FormatoCompeticao | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  nome: string;
  grupo?: string;
}

export default function ModalNovaEquipeCompeticao({
  idCompeticao,
  idEdicao,
  formato,
  onClose,
  onSuccess,
}: ModalNovaEquipeCompeticaoProps) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      nome: '',
      grupo: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    setSalvando(true);
    setErro(null);
    try {
      await competicaoService.criarEquipe({
        nome: data.nome.trim(),
        id_competicao: idCompeticao,
        id_edicao: idEdicao,
        grupo: data.grupo?.trim() || undefined,
      });
      onSuccess();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        'Erro ao cadastrar equipe. Verifique se o nome já está em uso nesta competição.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
          <Users className="text-blue-600" size={26} />
          Inscrever Equipe
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Cadastre uma nova equipe participante para disputar esta competição.
        </p>

        {erro && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>{erro}</div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Nome da Equipe */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Nome da Equipe *
            </label>
            <input
              {...register('nome', {
                required: 'O nome da equipe é obrigatório',
                minLength: {
                  value: 2,
                  message: 'O nome deve ter pelo menos 2 caracteres',
                },
              })}
              placeholder="Ex: Tigres do Cerrado FC"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              autoFocus
            />
            {errors.nome && (
              <span className="text-xs text-rose-500 mt-1 block">
                {errors.nome.message}
              </span>
            )}
          </div>

          {/* Grupo (visível para formato GRUPOS ou opcional para organização) */}
          {formato === 'GRUPOS' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Grupo na Competição
              </label>
              <select
                {...register('grupo')}
                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="">Automático / A Definir</option>
                <option value="A">Grupo A</option>
                <option value="B">Grupo B</option>
                <option value="C">Grupo C</option>
                <option value="D">Grupo D</option>
                <option value="E">Grupo E</option>
                <option value="F">Grupo F</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Selecione a chave em que a equipe disputará a fase de grupos.
              </p>
            </div>
          )}

          {/* Ações */}
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
                  <span>Cadastrando...</span>
                </>
              ) : (
                'Inscrever Equipe'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
