'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Users, 
  ArrowLeft, 
  Plus, 
  Eye, 
  Trash2, 
  Loader2, 
  AlertTriangle,
  Trophy,
  Calendar,
  PlusCircle,
  X
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function DetalhesEdicaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [isEquipeModalOpen, setIsEquipeModalOpen] = useState(false);

  const { data: edicao, error, isLoading } = useSWR(id ? `/edicoes/${id}` : null, fetcher);
  const { data: equipes, isLoading: loadingEquipes } = useSWR(id ? `/equipes/edicao/${id}` : null, fetcher);

  const handleAddEquipe = async (data: any) => {
    try {
      await api.post('/equipes/', {
        nome: data.nome,
        id_edicao: parseInt(id as string)
      });
      mutate(`/equipes/edicao/${id}`);
      setIsEquipeModalOpen(false);
    } catch (error) {
      alert('Erro ao criar equipe.');
    }
  };

  const handleDeleteEquipe = async (equipeId: number) => {
    if (confirm('Deseja realmente excluir esta equipe?')) {
      try {
        await api.delete(`/equipes/${equipeId}`);
        mutate(`/equipes/edicao/${id}`);
      } catch (error) {
        alert('Erro ao excluir equipe.');
      }
    }
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={48}/></div>;

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Edição {edicao?.edic_ano}
            <span className="text-sm font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase">
              {edicao?.evento?.even_nome}
            </span>
          </h1>
          <p className="text-slate-500">Gestão de equipes participantes desta temporada.</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
          <Users className="text-blue-600" size={20} />
          Equipes Inscritas
        </h2>
        <button 
          onClick={() => setIsEquipeModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
        >
          <Plus size={18} />
          Inscrever Equipe
        </button>
      </div>

      {/* Grid de Equipes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {equipes?.map((equipe: any) => (
          <div key={equipe.id_equipe} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Trophy size={24} />
              </div>
              <button 
                onClick={() => handleDeleteEquipe(equipe.id_equipe)}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={18} />
              </button>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-slate-800">{equipe.nome}</h3>
              <p className="text-sm text-slate-500">{equipe.participantes?.length || 0} jogadores</p>
            </div>

            <div className="pt-4 border-t border-slate-50">
              <Link 
                href={`/dashboard/equipes/${equipe.id_equipe}`}
                className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Eye size={18} />
                Ver Jogadores
              </Link>
            </div>
          </div>
        ))}

        {equipes?.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <Users size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Nenhuma equipe inscrita nesta edição.</p>
          </div>
        )}
      </div>

      {/* Modal Nova Equipe */}
      {isEquipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100 relative">
            <button onClick={() => setIsEquipeModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X /></button>
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PlusCircle className="text-blue-600" /> Nova Equipe</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleAddEquipe({ nome: formData.get('nome') });
            }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Nome da Equipe</label>
                <input name="nome" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Ex: Estrelas de Goianira" />
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setIsEquipeModalOpen(false)} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100">Criar Equipe</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
