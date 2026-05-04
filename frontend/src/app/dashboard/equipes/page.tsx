'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  Eye, 
  Trophy,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function EquipesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: equipes, error, isLoading } = useSWR('/equipes', fetcher);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [equipeToDelete, setEquipeToDelete] = useState<any>(null);

  const filteredEquipes = equipes?.filter((e: any) => 
    e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.edicao?.evento?.even_nome.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDeleteClick = (equipe: any) => {
    setEquipeToDelete(equipe);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (equipeToDelete) {
      try {
        await api.delete(`/equipes/${equipeToDelete.id_equipe}`);
        mutate('/equipes');
        setIsDeleteModalOpen(false);
        setEquipeToDelete(null);
      } catch (error) {
        alert('Erro ao excluir equipe.');
      }
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Gestão de Equipes
          </h1>
          <p className="text-slate-500 mt-1">Gerencie os times inscritos nas competições.</p>
        </div>

        <Link href="/dashboard/equipes/novo">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all flex items-center gap-2 active:scale-95">
            <Plus size={20} />
            Nova Equipe
          </button>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-8 max-w-2xl">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={20} />
          </span>
          <input 
            type="text" 
            placeholder="Buscar por nome da equipe ou competição..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Loader2 size={40} className="animate-spin mb-4 text-blue-600" />
          <p>Carregando equipes...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-red-400">
          <AlertTriangle size={40} className="mb-4" />
          <p>Erro ao carregar equipes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEquipes.map((equipe: any) => (
            <div key={equipe.id_equipe} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Trophy size={24} />
                </div>
                <button 
                  onClick={() => handleDeleteClick(equipe)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-slate-800">{equipe.nome}</h3>
                <p className="text-sm text-slate-500 flex items-center gap-1">
                  <span className="font-semibold text-blue-500">{equipe.edicao?.evento?.even_nome}</span> • {equipe.edicao?.edic_ano}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-50">
                <Link href={`/dashboard/equipes/${equipe.id_equipe}`}>
                  <button className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                    <Eye size={18} />
                    Ver Detalhes
                  </button>
                </Link>
              </div>
            </div>
          ))}
          
          {filteredEquipes.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
              <p>Nenhuma equipe encontrada.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Delete */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 border border-slate-100">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={30} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir Equipe?</h3>
              <p className="text-slate-500 text-sm mb-6">
                Tem certeza que deseja excluir a equipe <span className="font-bold">{equipeToDelete?.nome}</span>?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 shadow-lg shadow-red-100"
                >
                  Sim, excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
