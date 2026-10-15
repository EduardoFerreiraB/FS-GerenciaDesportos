'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { X, Trophy, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { competicaoService } from '@/services/competicoes';
import { ModoInscricao, FormatoCompeticao, CriterioResultado } from '@/types/competicoes';

const fetcher = (url: string) => api.get(url).then(res => res.data);

interface ModalNovaCompeticaoProps {
  idEdicao: number;
  onClose: () => void;
  onSuccess: (novaCompeticao: any) => void;
}

export default function ModalNovaCompeticao({ idEdicao, onClose, onSuccess }: ModalNovaCompeticaoProps) {
  const { data: modalidades, isLoading: loadingModalidades } = useSWR('/modalidades', fetcher);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      nome: '',
      categoria: 'Livre',
      id_modalidade: '',
      modo_inscricao: 'EQUIPE' as ModoInscricao,
      formato: 'PONTOS_CORRIDOS' as FormatoCompeticao,
      criterio_resultado: 'PONTOS' as CriterioResultado,
      data_inicio: '',
      data_fim: '',
      regras: '',
      iniciar_como_rascunho: true,
    }
  });

  const modoInscricao = watch('modo_inscricao');

  const onSubmit = async (data: any) => {
    setSalvando(true);
    setErro(null);
    try {
      const payload: any = {
        id_edicao: idEdicao,
        id_modalidade: parseInt(data.id_modalidade),
        nome: data.nome.trim(),
        categoria: data.categoria.trim(),
        modo_inscricao: data.modo_inscricao,
        formato: data.modo_inscricao === 'INDIVIDUAL' ? 'TABELA_UNICA' : data.formato,
        criterio_resultado: data.criterio_resultado,
        data_inicio: data.data_inicio || null,
        data_fim: data.data_fim || null,
        regras: data.regras ? data.regras.trim() : null,
      };

      if (data.iniciar_como_rascunho) {
        payload.status = 'RASCUNHO';
      }

      const res = await competicaoService.criar(payload);
      onSuccess(res);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao criar competição. Verifique os dados.';
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

        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
          <Trophy className="text-blue-600" size={26} />
          Nova Competição
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Cadastre uma modalidade e categoria dentro desta edição.
        </p>

        {erro && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>{erro}</div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Nome da Competição *
            </label>
            <input 
              {...register('nome', { required: 'Nome é obrigatório' })}
              placeholder="Ex: Futsal Masculino Sub-17"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {errors.nome && <span className="text-xs text-red-500 mt-1">{errors.nome.message}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Modalidade */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Modalidade *
              </label>
              {loadingModalidades ? (
                <div className="text-xs text-slate-400 py-2">Carregando modalidades...</div>
              ) : (
                <select 
                  {...register('id_modalidade', { required: 'Modalidade é obrigatória' })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="">Selecione...</option>
                  {modalidades?.map((m: any) => (
                    <option key={m.id_modalidade} value={m.id_modalidade}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              )}
              {errors.id_modalidade && <span className="text-xs text-red-500 mt-1">{errors.id_modalidade.message}</span>}
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Categoria *
              </label>
              <input 
                {...register('categoria', { required: 'Categoria é obrigatória' })}
                placeholder="Ex: Sub-17, Livre, Adulto"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {errors.categoria && <span className="text-xs text-red-500 mt-1">{errors.categoria.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Modo de Inscrição */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Modo de Inscrição *
              </label>
              <select 
                {...register('modo_inscricao', { 
                  onChange: (e) => {
                    if (e.target.value === 'INDIVIDUAL') {
                      setValue('formato', 'TABELA_UNICA');
                      setValue('criterio_resultado', 'TEMPO');
                    } else {
                      setValue('formato', 'PONTOS_CORRIDOS');
                      setValue('criterio_resultado', 'PONTOS');
                    }
                  }
                })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="EQUIPE">Coletivo (EQUIPE)</option>
                <option value="INDIVIDUAL">Individual (INDIVIDUAL)</option>
              </select>
            </div>

            {/* Formato */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Formato do Torneio *
              </label>
              {modoInscricao === 'INDIVIDUAL' ? (
                <div className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500">
                  Tabela Única (Provas Individuais)
                </div>
              ) : (
                <select 
                  {...register('formato')}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="PONTOS_CORRIDOS">Pontos Corridos</option>
                  <option value="GRUPOS">Fase de Grupos</option>
                  <option value="MATA_MATA">Mata-Mata Eliminatório</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Critério de Resultado */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Critério de Resultado
              </label>
              <select 
                {...register('criterio_resultado')}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                {modoInscricao === 'INDIVIDUAL' ? (
                  <>
                    <option value="TEMPO">Tempo (menor tempo ganha)</option>
                    <option value="PONTOS">Pontos</option>
                  </>
                ) : (
                  <>
                    <option value="PONTOS">Pontos (V=3, E=1, D=0)</option>
                    <option value="GOLS_SETS">Gols / Sets</option>
                  </>
                )}
              </select>
            </div>

            {/* Iniciar como Rascunho */}
            <div className="flex items-center gap-3 pt-6">
              <input 
                type="checkbox"
                id="iniciar_como_rascunho"
                {...register('iniciar_como_rascunho')}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="iniciar_como_rascunho" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Criar como Rascunho (Permite ajustar antes de iniciar)
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Datas */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Data de Início
              </label>
              <input 
                type="date"
                {...register('data_inicio')}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Data de Término
              </label>
              <input 
                type="date"
                {...register('data_fim')}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={salvando}
              className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={salvando}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2"
            >
              {salvando ? <Loader2 size={18} className="animate-spin" /> : 'Criar Competição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
