'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { 
  UserCheck, 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  AlertTriangle,
  Phone,
  Loader2
} from 'lucide-react';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function ProfessoresPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: professores, error, isLoading } = useSWR('/professores/', fetcher);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [professorToDelete, setProfessorToDelete] = useState<any>(null);

  const filteredProfessores = professores?.filter((p: any) => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDeleteClick = (professor: any) => {
    setProfessorToDelete(professor);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (professorToDelete) {
      try {
        await api.delete(`/professores/${professorToDelete.id_professor}`);
        mutate('/professores/', filteredProfessores.filter((p: any) => p.id_professor !== professorToDelete.id_professor), false);
        setIsDeleteModalOpen(false);
        setProfessorToDelete(null);
      } catch (error) {
        alert('Erro ao excluir professor. Verifique se ele não possui turmas vinculadas.');
      }
    }
  };

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="text-emerald-600" size={28} />
            Gestão de Professores
          </h1>
          <p className="text-slate-500 mt-1">Gerencie a equipe docente e seus acessos.</p>
        </div>

        <Link href="/dashboard/professores/novo">
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-emerald-100 transition-all flex items-center gap-2 active:scale-95">
            <Plus size={20} />
            Cadastrar Professor
          </button>
        </Link>
      </div>

      {/* Busca */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={22} />
          </span>
          <input 
            type="text" 
            placeholder="Buscar professor por nome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-slate-700"
          />
        </div>
      </div>

      {/* Lista (Tabela) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[300px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-emerald-600" />
            <p>Carregando professores...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-400">
            <AlertTriangle size={40} className="mb-4" />
            <p>Erro ao carregar professores.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm font-semibold uppercase tracking-wider">
                  <th className="px-6 py-5">Professor</th>
                  <th className="px-6 py-5">CPF</th>
                  <th className="px-6 py-5">Contato</th>
                  <th className="px-6 py-5">Usuário Sistema</th>
                  <th className="px-6 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfessores.map((prof: any) => (
                  <tr key={prof.id_professor} className="hover:bg-emerald-50/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                          {prof.nome.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{prof.nome}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{prof.cpf}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <Phone size={14} className="text-slate-400" />
                          {prof.contato}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {prof.usuario ? (
                        <span className="text-slate-500 font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                          @{prof.usuario.username}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Sem usuário</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/dashboard/professores/${prof.id_professor}`}>
                          <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Pencil size={18} />
                          </button>
                        </Link>
                        <button 
                          onClick={() => handleDeleteClick(prof)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Delete */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 border border-slate-100">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={30} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Remover Professor?</h3>
              <p className="text-slate-500 text-sm mb-6">
                Tem certeza que deseja remover <span className="font-bold">{professorToDelete?.nome}</span>? <br/>
                Isso também desativará o acesso ao sistema.
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
                  Sim, remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}