'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import { 
  GraduationCap, 
  Search, 
  Plus, 
  Trash2, 
  Pencil, 
  Eye, 
  User, 
  Calendar, 
  Clock,
  AlertTriangle,
  Loader2
} from 'lucide-react';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function TurmasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: turmas, error, isLoading } = useSWR('/turmas/', fetcher);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [turmaToDelete, setTurmaToDelete] = useState<any>(null);

  const filteredTurmas = turmas?.filter((t: any) => 
    (t.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) || // Back usa descricao, front usava nome? Ajustar
    (t.professor?.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDeleteClick = (turma: any) => {
    setTurmaToDelete(turma);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (turmaToDelete) {
      try {
        await api.delete(`/turmas/${turmaToDelete.id_turma}`);
        mutate('/turmas/');
        setIsDeleteModalOpen(false);
        setTurmaToDelete(null);
      } catch (error) {
        alert('Erro ao excluir turma.');
      }
    }
  };

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="text-indigo-600" size={28} />
            Gestão de Turmas
          </h1>
          <p className="text-slate-500 mt-1">Organize horários, professores e categorias das aulas.</p>
        </div>

        <Link href="/dashboard/turmas/novo">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 active:scale-95">
            <Plus size={20} />
            Nova Turma
          </button>
        </Link>
      </div>

      {/* Busca */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-8 max-w-2xl">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={20} />
          </span>
          <input 
            type="text" 
            placeholder="Buscar turma por nome ou professor..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700"
          />
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-indigo-600" />
            <p>Carregando turmas...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-red-400">
            <AlertTriangle size={40} className="mb-4" />
            <p>Erro ao carregar turmas.</p>
        </div>
      ) : (
        /* Grid de Cards de Turmas */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTurmas.map((turma: any) => (
            <div key={turma.id_turma} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md hover:border-indigo-100 transition-all group flex flex-col">
                
                {/* Cabeçalho do Card */}
                <div className="p-6 pb-4">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">
                    {turma.modalidade?.nome || 'Geral'}
                    </span>
                    <span className="text-xs font-bold text-white bg-indigo-500 px-2 py-1 rounded-md shadow-sm">
                    {turma.categoria_idade}
                    </span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-1">{turma.descricao || `Turma #${turma.id_turma}`}</h3>
                </div>

                {/* Informações (Metadados) */}
                <div className="px-6 py-4 bg-slate-50/50 border-t border-b border-slate-100 space-y-3 flex-1">
                <div className="flex items-center gap-3 text-sm text-slate-700">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                    <User size={16} />
                    </div>
                    <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Professor</p>
                    <p className="font-medium">{turma.professor?.nome || 'Não atribuído'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-sm text-slate-700 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                        <Calendar size={16} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase">Dias</p>
                        <p className="font-medium">{turma.dias_semana || '-'}</p>
                    </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-slate-700 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                        <Clock size={16} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase">Horário</p>
                        <p className="font-medium">{turma.horario_inicio} - {turma.horario_fim}</p>
                    </div>
                    </div>
                </div>
                </div>

                {/* Rodapé (Ações) */}
                <div className="p-4 flex items-center justify-between bg-white">
                <Link href={`/dashboard/turmas/${turma.id_turma}`} className="flex-1">
                    <button className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1">
                    <Eye size={18} />
                    Ver Detalhes
                    </button>
                </Link>
                
                <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                    <Link href={`/dashboard/turmas/${turma.id_turma}/editar`}>
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                        <Pencil size={18} />
                    </button>
                    </Link>
                    <button 
                    onClick={() => handleDeleteClick(turma)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                    >
                    <Trash2 size={18} />
                    </button>
                </div>
                </div>

            </div>
            ))}
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
              <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir Turma?</h3>
              <p className="text-slate-500 text-sm mb-6">
                Tem certeza que deseja excluir a turma <span className="font-bold">{turmaToDelete?.descricao}</span>? <br/>
                Isso removerá os vínculos com os alunos matriculados.
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