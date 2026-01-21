'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { 
  ShieldAlert, 
  Search, 
  Plus, 
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function UsuariosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: users, error, isLoading } = useSWR('/users', fetcher);
  
  // Estado para o Modal de Exclusão
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const filteredUsers = users?.filter((u: any) => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        await api.delete(`/users/${userToDelete.id_usuario}`); // Usa rota que criamos em auth.py
        mutate('/users'); // Revalida a lista
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
        alert('Usuário excluído com sucesso.');
      } catch (error: any) {
        const msg = error.response?.data?.detail || 'Erro ao excluir usuário.';
        alert(msg);
        setIsDeleteModalOpen(false); // Fecha mesmo com erro para limpar estado
      }
    }
  };

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-purple-600" size={28} />
            Gestão de Usuários
          </h1>
          <p className="text-slate-500 mt-1">Gerencie Coordenadores e Administradores do sistema.</p>
        </div>

        <Link href="/dashboard/usuarios/novo">
          <button className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-purple-200 transition-all flex items-center gap-2 active:scale-95">
            <Plus size={20} />
            Novo Usuário
          </button>
        </Link>
      </div>

      {/* Busca */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 my-8">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={22} />
          </span>
          <input 
            type="text" 
            placeholder="Buscar por nome de usuário..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-slate-700"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[300px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-purple-600" />
            <p>Carregando usuários...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-400">
            <AlertTriangle size={40} className="mb-4" />
            <p>Erro ao carregar usuários (Acesso Restrito).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm font-semibold uppercase tracking-wider">
                  <th className="px-6 py-5">Usuário</th>
                  <th className="px-6 py-5">Role (Cargo)</th>
                  <th className="px-6 py-5">ID</th>
                  <th className="px-6 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u: any) => (
                  <tr key={u.id_usuario} className="hover:bg-purple-50/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm uppercase">
                          {u.username.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-800">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        u.role === 'admin' ? 'bg-red-100 text-red-700' :
                        u.role === 'coordenador' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'professor' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                      #{u.id_usuario}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDeleteClick(u)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir Usuário"
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

      {/* Modal de Exclusão */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 border border-slate-100">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={30} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir Usuário?</h3>
              <p className="text-slate-500 text-sm mb-6">
                Tem certeza que deseja excluir o usuário <span className="font-bold">{userToDelete?.username}</span>? <br/>
                O acesso dele ao sistema será revogado imediatamente.
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