'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Trophy, 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Copy, 
  Trash2, 
  Users,
  Loader2,
  AlertTriangle,
  X,
  ChevronRight,
  PlusCircle
} from 'lucide-react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function DetalhesEventoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  
  const [isEdicaoModalOpen, setIsEdicaoModalOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [targetEdicaoId, setTargetEdicaoId] = useState<number | null>(null);

  const { data: evento, error: errorEvento, isLoading: isLoadingEvento } = useSWR(id ? `/eventos/${id}` : null, fetcher);
  const { data: todasEdicoes, isLoading: isLoadingEdicoes } = useSWR('/edicoes/', fetcher);

  const edicoesEvento = useMemo(() => {
    if (!todasEdicoes || !Array.isArray(todasEdicoes)) return [];
    return todasEdicoes
      .filter((e: any) => e.id_evento === parseInt(id as string))
      .sort((a: any, b: any) => (b.edic_ano || 0) - (a.edic_ano || 0));
  }, [todasEdicoes, id]);

  const handleAddEdicao = async (data: any) => {
    try {
      await api.post('/edicoes/', {
        id_evento: parseInt(id as string),
        edic_ano: parseInt(data.edic_ano),
        data_inicio: data.data_inicio,
        data_fim: data.data_fim
      });
      mutate('/edicoes/');
      setIsEdicaoModalOpen(false);
    } catch (error) {
      alert('Erro ao criar edição.');
    }
  };

  const handleCloneTeams = async (sourceId: number) => {
    if (!targetEdicaoId) return;
    try {
      await api.post(`/edicoes/${targetEdicaoId}/clonar-equipes?edicao_origem_id=${sourceId}`);
      alert('Equipes clonadas com sucesso!');
      setIsCloneModalOpen(false);
      router.push(`/dashboard/edicoes/${targetEdicaoId}`);
    } catch (error) {
      alert('Erro ao clonar equipes.');
    }
  };

  if (isLoadingEvento || isLoadingEdicoes) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
        <Loader2 size={48} className="animate-spin mb-4 text-amber-500" />
        <p>Carregando edições...</p>
      </div>
    );
  }

  if (errorEvento) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-red-500">
        <AlertTriangle size={48} className="mb-4" />
        <h2 className="text-xl font-bold">Evento não encontrado</h2>
        <button onClick={() => router.push('/dashboard/eventos')} className="mt-4 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/eventos')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            {evento?.even_nome}
            <Trophy className="text-amber-500" size={24} />
          </h1>
          <p className="text-slate-500">{evento?.descricao || 'Sem descrição adicional.'}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
          <Calendar className="text-amber-500" size={20} />
          Edições do Evento
        </h2>
        <button 
          onClick={() => setIsEdicaoModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          Nova Edição
        </button>
      </div>

      {/* Lista de Edições */}
      <div className="grid grid-cols-1 gap-4">
        {edicoesEvento.map((edicao: any) => (
          <div key={edicao.id_edicao} className="bg-white border border-slate-100 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between hover:shadow-md transition-all gap-4">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase">Ano</span>
                <span className="text-xl font-black text-amber-600">{edicao.edic_ano}</span>
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">Edição {edicao.edic_ano}</p>
                <p className="text-sm text-slate-500">
                  {new Date(edicao.data_inicio).toLocaleDateString()} até {new Date(edicao.data_fim).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setTargetEdicaoId(edicao.id_edicao); setIsCloneModalOpen(true); }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-2"
                title="Trazer equipes de outra edição"
              >
                <Copy size={16} />
                Clonar Equipes
              </button>
              
              <Link 
                href={`/dashboard/edicoes/${edicao.id_edicao}`}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all flex items-center gap-2"
              >
                Gerenciar Equipes
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        ))}

        {edicoesEvento.length === 0 && (
          <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Nenhuma edição cadastrada para este evento.</p>
            <button 
              onClick={() => setIsEdicaoModalOpen(true)}
              className="mt-4 text-amber-600 font-bold hover:underline"
            >
              Criar primeira edição agora
            </button>
          </div>
        )}
      </div>

      {/* Modal Nova Edição */}
      {isEdicaoModalOpen && (
        <ModalEdicao onSubmit={handleAddEdicao} onCancel={() => setIsEdicaoModalOpen(false)} />
      )}

      {/* Modal Clonar Equipes */}
      {isCloneModalOpen && (
        <ModalClone 
          edicoesDisponiveis={edicoesEvento.filter((e: any) => e.id_edicao !== targetEdicaoId)}
          onClone={handleCloneTeams}
          onCancel={() => setIsCloneModalOpen(false)}
        />
      )}
    </div>
  );
}

function ModalEdicao({ onSubmit, onCancel }: any) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PlusCircle className="text-amber-500" /> Nova Edição</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Ano da Edição</label>
            <input type="number" {...register('edic_ano', { required: true })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20" placeholder="Ex: 2026" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Data Início</label>
              <input type="date" {...register('data_inicio', { required: true })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Data Fim</label>
              <input type="date" {...register('data_fim', { required: true })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-6">
            <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-100">Criar Edição</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalClone({ edicoesDisponiveis, onClone, onCancel }: any) {
  const [sourceId, setSourceId] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><Copy className="text-blue-500" /> Clonar Equipes</h2>
        <p className="text-sm text-slate-500 mb-6">Selecione uma edição anterior para copiar todos os times e seus jogadores inscritos para esta nova edição.</p>
        
        <div className="space-y-4">
          <select 
            value={sourceId} 
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
          >
            <option value="">Selecione a edição de origem...</option>
            {edicoesDisponiveis.map((e: any) => (
              <option key={e.id_edicao} value={e.id_edicao}>Edição {e.edic_ano} ({new Date(e.data_inicio).getFullYear()})</option>
            ))}
          </select>

          <div className="flex gap-3 pt-4">
            <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600">Cancelar</button>
            <button 
              onClick={() => onClone(parseInt(sourceId))}
              disabled={!sourceId}
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              Confirmar Clonagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
