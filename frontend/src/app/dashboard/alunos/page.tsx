'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import api from '@/lib/api';

// Fetcher para o SWR
const fetcher = (url: string) => api.get(url).then(res => res.data);

// Função segura para formatar data (YYYY-MM-DD -> DD/MM/YYYY) sem timezone
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

export default function AlunosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: alunos, error, isLoading } = useSWR('/alunos/', fetcher);
  
  // Estado para o Modal de Exclusão
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [alunoToDelete, setAlunoToDelete] = useState<any>(null);

  // Filtro no front-end (ideal seria no back, mas ok para v1)
  const filteredAlunos = alunos?.filter((aluno: any) => 
    aluno.nome_completo.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDeleteClick = (aluno: any) => {
    setAlunoToDelete(aluno);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (alunoToDelete) {
      try {
        await api.delete(`/alunos/${alunoToDelete.id_aluno}`);
        // Atualiza a lista localmente
        mutate('/alunos/', filteredAlunos.filter((a: any) => a.id_aluno !== alunoToDelete.id_aluno), false);
        setIsDeleteModalOpen(false);
        setAlunoToDelete(null);
      } catch (error) {
        alert('Erro ao excluir aluno. Verifique se ele não possui matrículas ativas.');
      }
    }
  };

  return (
    <>
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-primary" size={28} />
            Gestão de Alunos
          </h1>
          <p className="text-slate-500 mt-1">Gerencie as matrículas e dados dos alunos.</p>
        </div>

        <Link href="/dashboard/alunos/novo">
          <button className="bg-primary hover:bg-primary-hover text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all flex items-center gap-2 active:scale-95">
            <Plus size={20} />
            Nova Matrícula
          </button>
        </Link>
      </div>

      {/* Card de Busca */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={22} />
          </span>
          <input 
            type="text" 
            placeholder="Buscar aluno por nome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-slate-700 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Card da Lista (Tabela) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[300px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-primary" />
            <p>Carregando alunos...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-400">
            <AlertTriangle size={40} className="mb-4" />
            <p>Erro ao carregar alunos. Verifique sua conexão.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm font-semibold uppercase tracking-wider">
                    <th className="px-6 py-5">Nome do Aluno</th>
                    <th className="px-6 py-5">Idade / Nasc.</th>
                    <th className="px-6 py-5">Responsável</th>
                    <th className="px-6 py-5">Contato</th>
                    <th className="px-6 py-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAlunos.length > 0 ? (
                    filteredAlunos.map((aluno: any) => (
                      <tr key={aluno.id_aluno} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                              {aluno.nome_completo.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{aluno.nome_completo}</p>
                              <p className="text-xs text-slate-400">ID: #{aluno.id_aluno.toString().padStart(4, '0')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-700 font-medium">
                            {formatDate(aluno.data_nascimento)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {aluno.nome_mae || aluno.nome_pai || '-'}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {aluno.telefone_1}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/dashboard/alunos/${aluno.id_aluno}`}>
                              <button className="p-2 text-slate-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                                <Pencil size={18} />
                              </button>
                            </Link>
                            <button 
                              onClick={() => handleDeleteClick(aluno)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Search size={32} className="text-slate-200" />
                          <p>Nenhum aluno encontrado para "{searchTerm}"</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-sm text-slate-500">
              <p>Mostrando {filteredAlunos.length} registros</p>
            </div>
          </>
        )}
      </div>

      {/* Modal de Exclusão */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Aluno?</h3>
              <p className="text-slate-500 mb-6">
                Tem certeza que deseja excluir <span className="font-bold text-slate-700">{alunoToDelete?.nome_completo}</span>? <br/>
                Essa ação não poderá ser desfeita.
              </p>
              
              <div className="flex items-center gap-3 w-full">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors"
                >
                  Não, cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
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