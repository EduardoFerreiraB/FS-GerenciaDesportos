'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { 
  Trophy, 
  Search, 
  Plus, 
  Trash2, 
  Eye, 
  Loader2,
  AlertTriangle,
  Calendar,
  X
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useNotification } from '@/context/NotificationContext';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function EventosPage() {
  const router = useRouter();
  const { toast, confirm } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { data: eventos, error, isLoading } = useSWR('/eventos/', fetcher);
  const { data: modalidades } = useSWR('/modalidades/', fetcher);

  const filteredEventos = eventos?.filter((e: any) => 
    e.even_nome.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAddEvento = async (data: any) => {
    try {
      const response = await api.post('/eventos/', {
        even_nome: data.even_nome,
        descricao: data.descricao,
        modalidade_ids: data.modalidade_ids.map(Number)
      });
      mutate('/eventos/');
      setIsModalOpen(false);
      toast('Evento criado com sucesso!', 'success');
      // Vai direto para o painel do evento criado
      router.push(`/dashboard/eventos/${response.data.id_evento}`);
    } catch (error) {
      toast('Erro ao criar evento.', 'error');
    }
  };

  const handleDeleteEvento = async (id: number) => {
    confirm({
      title: 'Excluir Evento',
      message: 'Tem certeza que deseja excluir este evento? Todas as edições, equipes e partidas vinculadas serão permanentemente deletadas.',
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await api.delete(`/eventos/${id}`);
          mutate('/eventos/');
          toast('Evento excluído com sucesso!', 'success');
        } catch (error) {
          toast('Erro ao excluir evento.', 'error');
        }
      }
    });
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="text-amber-500" size={28} />
            Eventos e Competições
          </h1>
          <p className="text-slate-500 mt-1">Gerencie os campeonatos e festivais esportivos.</p>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-amber-100 transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus size={20} />
          Criar Novo Evento
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-8 max-w-2xl">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={20} />
          </span>
          <input 
            type="text" 
            placeholder="Buscar por nome do evento..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-slate-700"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Loader2 size={40} className="animate-spin mb-4 text-amber-500" />
          <p>Carregando eventos...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-red-400">
          <AlertTriangle size={40} className="mb-4" />
          <p>Erro ao carregar eventos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEventos.map((evento: any) => (
            <div key={evento.id_evento} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <Trophy size={24} />
                  </div>
                  <button 
                    onClick={() => handleDeleteEvento(evento.id_evento)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 animate-in fade-in"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 mb-1">{evento.even_nome}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-4">{evento.descricao || 'Sem descrição'}</p>
                
                <div className="flex flex-wrap gap-1">
                  {evento.modalidades?.map((m: any) => (
                    <span key={m.id_modalidade} className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {m.nome}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-50 bg-slate-50/30">
                <Link href={`/dashboard/eventos/${evento.id_evento}`}>
                  <button className="w-full py-2.5 bg-white border border-slate-200 hover:border-amber-500 text-slate-600 hover:text-amber-600 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm">
                    <Trophy size={18} />
                    Acessar Competição
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cadastro de Evento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 my-8 animate-in zoom-in-95 border border-slate-100 relative max-h-[95vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X /></button>
            
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="text-amber-500" />
                Novo Evento
              </h2>
              <p className="text-slate-500 text-sm">Defina os parâmetros do evento.</p>
            </div>

            <EventoForm 
              modalidades={modalidades || []} 
              onSubmit={handleAddEvento} 
              onCancel={() => setIsModalOpen(false)} 
            />
          </div>
        </div>
      )}
    </>
  );
}

function EventoForm({ modalidades, onSubmit, onCancel }: any) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      even_nome: '',
      descricao: '',
      modalidade_ids: []
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700 ml-1">Nome do Evento <span className="text-red-500">*</span></label>
        <input 
          {...register('even_nome', { required: 'Obrigatório' })}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
          placeholder="Ex: Campeonato Municipal de Futebol"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700 ml-1">Descrição</label>
        <textarea 
          {...register('descricao')}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all min-h-[60px] text-sm"
          placeholder="Detalhes adicionais..."
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700 ml-1">Modalidades <span className="text-red-500">*</span></label>
        <select 
          multiple
          {...register('modalidade_ids', { required: 'Selecione ao menos uma' })}
          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all min-h-[90px] text-sm"
        >
          {modalidades.map((m: any) => (
            <option key={m.id_modalidade} value={m.id_modalidade}>{m.nome}</option>
          ))}
        </select>
        <p className="text-[10px] text-slate-400 mt-1">Segure Ctrl (ou Cmd) para selecionar várias.</p>
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 text-sm">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-lg shadow-amber-100 disabled:opacity-70 text-sm">
          {isSubmitting ? 'Salvando...' : 'Criar Evento'}
        </button>
      </div>
    </form>
  );
}
