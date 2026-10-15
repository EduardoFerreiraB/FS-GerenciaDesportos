'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  Calendar,
  Plus,
  ArrowLeft,
  Trash2,
  Edit3,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Layers,
  Sparkles,
  X,
  PlusCircle,
  Clock
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { useNotification } from '@/context/NotificationContext';
import { Competicao } from '@/types/competicoes';

const fetcher = (url: string) => api.get(url).then(res => res.data);

// Sub-componente para exibir o Card de cada Edição com contagem de competições
function EdicaoCard({
  edicao,
  onEdit,
  onDelete
}: {
  edicao: any;
  onEdit: (edicao: any) => void;
  onDelete: (id: number) => void;
}) {
  const router = useRouter();
  const { data: competicoes, isLoading } = useSWR<Competicao[]>(
    `/edicoes/${edicao.id_edicao}/competicoes`,
    fetcher
  );

  const dataInicio = new Date(edicao.data_inicio).toLocaleDateString('pt-BR');
  const dataFim = new Date(edicao.data_fim).toLocaleDateString('pt-BR');

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
            <Calendar size={22} />
          </div>
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(edicao)}
              title="Editar datas da edição"
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={() => onDelete(edicao.id_edicao)}
              title="Excluir edição"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">
            Edição Anual
          </span>
          <h3 className="text-2xl font-black text-slate-800 mt-2">
            Edição {edicao.edic_ano}
          </h3>
          <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mt-1">
            <Clock size={14} className="text-slate-400" />
            {dataInicio} até {dataFim}
          </p>
        </div>

        {/* Resumo de Competições */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 mb-6">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
            <span className="flex items-center gap-1.5">
              <Trophy size={15} className="text-amber-500" />
              Competições Vinculadas
            </span>
            <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 font-extrabold">
              {isLoading ? "..." : competicoes?.length || 0}
            </span>
          </div>

          {competicoes && competicoes.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {competicoes.slice(0, 3).map((c) => (
                <span
                  key={c.id_competicao}
                  className="text-[11px] font-semibold bg-white text-slate-600 px-2 py-0.5 rounded-md border border-slate-200"
                >
                  {c.nome}
                </span>
              ))}
              {competicoes.length > 3 && (
                <span className="text-[11px] font-bold text-slate-400 self-center">
                  +{competicoes.length - 3} mais
                </span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mt-1 italic">
              Nenhuma competição criada ainda.
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => router.push(`/dashboard/edicoes/${edicao.id_edicao}`)}
        className="w-full py-3 bg-slate-900 hover:bg-amber-500 text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm group-hover:shadow-md"
      >
        <Trophy size={16} />
        Acessar Competições da Edição
        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}

// Modal simples de Edição (Apenas Ano e Datas)
function ModalEdicaoDatas({
  onSubmit,
  onCancel,
  initialData
}: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
}) {
  const isEditing = !!initialData;
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: initialData ? {
      edic_ano: initialData.edic_ano,
      data_inicio: initialData.data_inicio ? initialData.data_inicio.substring(0, 10) : '',
      data_fim: initialData.data_fim ? initialData.data_fim.substring(0, 10) : ''
    } : {
      edic_ano: new Date().getFullYear(),
      data_inicio: '',
      data_fim: ''
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="text-amber-500" size={22} />
            {isEditing ? 'Editar Datas da Edição' : 'Nova Edição do Evento'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
          {isEditing
            ? "Atualize o ano e o período de realização desta edição."
            : "Defina o ano e as datas de início e fim. Dentro da edição você poderá configurar as competições (futebol, natação, etc.) e seus formatos (mata-mata, pontos corridos, etc.)."}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Ano da Edição</label>
            <input
              type="number"
              {...register('edic_ano', { required: true, min: 2000, max: 2100 })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold text-slate-800"
              placeholder="Ex: 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Data de Início</label>
              <input
                type="date"
                {...register('data_inicio', { required: true })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold text-slate-800"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Data de Fim</label>
              <input
                type="date"
                {...register('data_fim', { required: true })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold text-slate-800"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm shadow-md shadow-amber-200 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {isEditing ? 'Salvar Alterações' : 'Criar Edição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DetalhesEventoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { toast, confirm } = useNotification();

  const [modalEdicaoState, setModalEdicaoState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    data?: any;
  }>({ isOpen: false, mode: 'create' });

  // Fetch Evento e Edições
  const { data: evento, error: errorEvento, isLoading: isLoadingEvento } = useSWR(
    id ? `/eventos/${id}` : null,
    fetcher
  );
  const { data: todasEdicoes, mutate: mutateEdicoes, isLoading: isLoadingEdicoes } = useSWR(
    '/edicoes/',
    fetcher
  );

  // Filtrar edições deste evento
  const edicoes = useMemo(() => {
    if (!todasEdicoes || !Array.isArray(todasEdicoes)) return [];
    return todasEdicoes
      .filter((e: any) => e.id_evento === parseInt(id))
      .sort((a: any, b: any) => (b.edic_ano || 0) - (a.edic_ano || 0));
  }, [todasEdicoes, id]);

  const handleAddEdicao = async (formData: any) => {
    try {
      const response = await api.post('/edicoes/', {
        id_evento: parseInt(id),
        edic_ano: Number(formData.edic_ano),
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        tipo_competicao: 'Pontos Corridos' // Default técnico herdado
      });
      mutateEdicoes();
      setModalEdicaoState({ isOpen: false, mode: 'create' });
      toast('Edição criada com sucesso! Redirecionando para configurar as competições...', 'success');
      // Navega direto para a página da edição recém-criada
      router.push(`/dashboard/edicoes/${response.data.id_edicao}`);
    } catch (error: any) {
      toast(error.response?.data?.detail || 'Erro ao criar edição.', 'error');
    }
  };

  const handleEditEdicao = async (formData: any) => {
    if (!modalEdicaoState.data) return;
    try {
      await api.put(`/edicoes/${modalEdicaoState.data.id_edicao}`, {
        id_evento: parseInt(id),
        edic_ano: Number(formData.edic_ano),
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        tipo_competicao: modalEdicaoState.data.tipo_competicao || 'Pontos Corridos'
      });
      mutateEdicoes();
      setModalEdicaoState({ isOpen: false, mode: 'create' });
      toast('Edição atualizada com sucesso!', 'success');
    } catch (error: any) {
      toast(error.response?.data?.detail || 'Erro ao atualizar edição.', 'error');
    }
  };

  const handleDeleteEdicao = async (idEdicao: number) => {
    confirm({
      title: 'Excluir Edição',
      message: 'Tem certeza que deseja excluir esta edição? Se houver competições iniciadas ou com dados, remova-as primeiro.',
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await api.delete(`/edicoes/${idEdicao}`);
          mutateEdicoes();
          toast('Edição excluída com sucesso!', 'success');
        } catch (error: any) {
          toast(error.response?.data?.detail || 'Erro ao excluir edição.', 'error');
        }
      }
    });
  };

  if (isLoadingEvento || isLoadingEdicoes) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-slate-400">
        <Loader2 size={44} className="animate-spin mb-4 text-amber-500" />
        <p className="font-semibold text-sm">Carregando detalhes do evento...</p>
      </div>
    );
  }

  if (errorEvento || !evento) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-red-500">
        <AlertTriangle size={44} className="mb-4" />
        <p className="font-bold">Evento não encontrado.</p>
        <button
          onClick={() => router.push('/dashboard/eventos')}
          className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-sm font-semibold transition-all"
        >
          Voltar para Eventos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Botão Voltar e Cabeçalho do Evento */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/eventos')}
          className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Eventos</span>
            <span>/</span>
            <span className="text-amber-600">Edições</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mt-1 flex items-center gap-3">
            {evento.even_nome}
          </h1>
        </div>
      </div>

      {/* Card Informativo do Evento */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <p className="text-sm text-slate-600 leading-relaxed">
            {evento.descricao || 'Este evento não possui descrição cadastrada.'}
          </p>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Modalidades Esportivas do Evento
            </span>
            <div className="flex flex-wrap gap-1.5">
              {evento.modalidades && evento.modalidades.length > 0 ? (
                evento.modalidades.map((m: any) => (
                  <span
                    key={m.id_modalidade}
                    className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/50 px-3 py-1 rounded-xl flex items-center gap-1.5"
                  >
                    <Sparkles size={12} className="text-amber-500" />
                    {m.nome}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">Nenhuma modalidade vinculada ao evento.</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={() => setModalEdicaoState({ isOpen: true, mode: 'create' })}
            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus size={18} />
            Nova Edição
          </button>
        </div>
      </div>

      {/* Seção de Edições */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Layers className="text-amber-500" size={22} />
              Edições Realizadas ({edicoes.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Cada edição representa um ano do evento e abriga as competições das modalidades esportivas.
            </p>
          </div>
        </div>

        {edicoes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {edicoes.map((edicao: any) => (
              <EdicaoCard
                key={edicao.id_edicao}
                edicao={edicao}
                onEdit={(ed) => setModalEdicaoState({ isOpen: true, mode: 'edit', data: ed })}
                onDelete={handleDeleteEdicao}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-8">
            <div className="w-16 h-16 bg-white text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Calendar size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">Nenhuma edição cadastrada</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
              Crie a primeira edição deste evento (definindo apenas o ano e as datas de início e fim) para então cadastrar e gerenciar as competições.
            </p>
            <button
              onClick={() => setModalEdicaoState({ isOpen: true, mode: 'create' })}
              className="mt-6 bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-2xl text-sm transition-all shadow-md shadow-amber-100 inline-flex items-center gap-2"
            >
              <PlusCircle size={18} />
              Criar 1ª Edição Agora
            </button>
          </div>
        )}
      </div>

      {/* Modal de Criar/Editar Edição */}
      {modalEdicaoState.isOpen && (
        <ModalEdicaoDatas
          onSubmit={modalEdicaoState.mode === 'create' ? handleAddEdicao : handleEditEdicao}
          onCancel={() => setModalEdicaoState({ isOpen: false, mode: 'create' })}
          initialData={modalEdicaoState.data}
        />
      )}
    </div>
  );
}
