'use client';

import React, { useState } from 'react';
import { 
  Trophy, 
  Plus, 
  Trash2, 
  Search, 
  X,
  Dumbbell,
  Activity,
  Target,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function ModalidadesPage() {
  const { data: modalidades, error, isLoading } = useSWR('/modalidades/', fetcher);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [modalidadeToDelete, setModalidadeToDelete] = useState<any>(null);

  // Filtro
  const filteredModalidades = modalidades?.filter((m: any) => 
    m.nome.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // --- Funções de Ação ---
  const handleDeleteClick = (modalidade: any) => {
    setModalidadeToDelete(modalidade);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (modalidadeToDelete) {
      try {
        await api.delete(`/modalidades/${modalidadeToDelete.id_modalidade}`);
        mutate('/modalidades/');
        setIsDeleteModalOpen(false);
        setModalidadeToDelete(null);
      } catch (error) {
        alert('Erro ao excluir modalidade. Verifique se existem turmas vinculadas.');
      }
    }
  };

  const handleAddModalidade = async (data: any) => {
    try {
      await api.post('/modalidades/', data);
      mutate('/modalidades/');
      setIsModalOpen(false);
    } catch (error: any) {
        console.error(error);
        alert('Erro ao criar modalidade.');
    }
  };

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="text-[#C5430C]" size={28} />
            Modalidades
          </h1>
          <p className="text-slate-500 mt-1">Gerencie os esportes oferecidos pela escola.</p>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#C5430C] hover:bg-[#A03609] text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-orange-200 transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus size={20} />
          Cadastrar Modalidade
        </button>
      </div>

      {/* Barra de Busca */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-8 w-full">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={20} />
          </span>
          <input 
            type="text" 
            placeholder="Buscar modalidade..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#C5430C]/20 focus:border-[#C5430C] outline-none transition-all text-slate-700"
          />
        </div>
      </div>

      {/* Loading / Error States */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-[#C5430C]" />
            <p>Carregando modalidades...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-red-400">
            <AlertTriangle size={40} className="mb-4" />
            <p>Erro ao carregar modalidades.</p>
        </div>
      ) : (
        /* Grid de Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredModalidades.map((modalidade: any) => {
            let Icon = Dumbbell;
            const nome = modalidade.nome.toLowerCase();
            if (nome.includes('futebol') || nome.includes('futsal')) Icon = Trophy;
            else if (nome.includes('volei') || nome.includes('basquete')) Icon = Activity;
            else if (nome.includes('natacao') || nome.includes('swimming')) Icon = Activity;
            else if (nome.includes('tiro') || nome.includes('alvo')) Icon = Target;

            return (
                <div key={modalidade.id_modalidade} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-orange-100 transition-all group relative overflow-hidden">
                {/* Botão de Exclusão */}
                <button 
                    onClick={() => handleDeleteClick(modalidade)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    title="Excluir Modalidade"
                >
                    <Trash2 size={18} />
                </button>

                <div className="flex flex-col items-center text-center pt-2">
                    <div className="w-16 h-16 bg-orange-50 text-[#C5430C] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon size={32} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">{modalidade.nome}</h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{modalidade.descricao || 'Sem descrição'}</p>
                </div>

                {/* Detalhe visual na base */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-50 via-[#C5430C]/20 to-orange-50 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                </div>
            );
            })}
            
            {/* Card de "Adicionar Novo" (Ghost) */}
            <button 
            onClick={() => setIsModalOpen(true)}
            className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-[#C5430C] hover:text-[#C5430C] hover:bg-orange-50/30 transition-all gap-2 min-h-[200px] group"
            >
            <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center transition-colors">
                <Plus size={24} />
            </div>
            <span className="font-semibold">Nova Modalidade</span>
            </button>
        </div>
      )}

      {/* --- Modal de Cadastro --- */}
      {isModalOpen && (
        <ModalCadastro onClose={() => setIsModalOpen(false)} onSave={handleAddModalidade} />
      )}

      {/* --- Modal de Exclusão --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 border border-slate-100">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir Modalidade?</h3>
              <p className="text-slate-500 text-sm mb-6">
                Tem certeza que deseja remover <span className="font-bold">{modalidadeToDelete?.nome}</span>?
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
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Sub-componente Modal de Cadastro
function ModalCadastro({ onClose, onSave }: any) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Dumbbell className="text-[#C5430C]" />
            Nova Modalidade
          </h2>
          <p className="text-slate-500 text-sm">Adicione um novo esporte ao sistema.</p>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nome da Modalidade</label>
            <input 
              {...register('nome', { required: true })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C5430C]/20 focus:border-[#C5430C] outline-none transition-all"
              placeholder="Ex: Judô"
            />
            {errors.nome && <span className="text-xs text-red-500">Campo obrigatório</span>}
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição Curta</label>
            <textarea 
              {...register('descricao')}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C5430C]/20 focus:border-[#C5430C] outline-none transition-all min-h-[80px]"
              placeholder="Ex: Aulas para iniciantes e avançados"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-[#C5430C] text-white font-semibold hover:bg-[#A03609] shadow-lg shadow-orange-100 disabled:opacity-70"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}