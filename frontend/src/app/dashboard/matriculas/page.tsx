'use client';

import React, { useState } from 'react';
import { 
  ClipboardList, 
  Search, 
  User, 
  GraduationCap, 
  CheckCircle,
  X,
  Filter,
  Loader2
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function MatriculasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAluno, setSelectedAluno] = useState<any>(null);
  const { data: alunos, isLoading: isLoadingAlunos } = useSWR('/alunos/', fetcher);
  const { data: turmas, isLoading: isLoadingTurmas } = useSWR('/turmas/', fetcher);

  const filteredAlunos = alunos?.filter((a: any) => 
    a.nome_completo.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleMatricular = async (turma: any) => {
    if (!selectedAluno) return;

    try {
      await api.post('/matriculas/', {
        id_aluno: selectedAluno.id_aluno,
        id_turma: turma.id_turma
      });
      alert(`Aluno ${selectedAluno.nome_completo} matriculado na turma ${turma.descricao} com sucesso!`);
      setSelectedAluno(null);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || 'Erro ao realizar matrícula.';
      alert(msg);
    }
  };

  return (
    <>
      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList className="text-blue-600" size={28} />
          Nova Matrícula
        </h1>
        <p className="text-slate-500 mt-1">Selecione um aluno para iniciar o processo de matrícula.</p>
      </div>

      {/* Busca de Aluno */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={22} />
          </span>
          <input 
            type="text" 
            placeholder="Buscar aluno por nome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700"
          />
        </div>
      </div>

      {/* Lista de Alunos (Grid) */}
      {isLoadingAlunos ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlunos.map((aluno: any) => (
            <div 
              key={aluno.id_aluno}
              onClick={() => setSelectedAluno(aluno)}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group relative overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  {aluno.nome_completo.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{aluno.nome_completo}</h3>
                  <p className="text-xs text-slate-500">ID: #{aluno.id_aluno}</p>
                </div>
              </div>
              
              {/* Indicador de Seleção */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">
                <ArrowRightCircle size={24} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Seleção de Turma */}
      {selectedAluno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <User className="text-blue-500" />
                  Matricular {selectedAluno.nome_completo}
                </h2>
                <p className="text-sm text-slate-500">Escolha uma turma disponível abaixo.</p>
              </div>
              <button 
                onClick={() => setSelectedAluno(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* Lista de Turmas Disponíveis */}
            {isLoadingTurmas ? (
               <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : (
              <div className="overflow-y-auto pr-2 space-y-3 flex-1">
                {turmas?.map((turma: any) => (
                  <div key={turma.id_turma} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <GraduationCap size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{turma.descricao || `Turma ${turma.id_turma}`}</h4>
                        <p className="text-xs text-slate-500">
                          {turma.modalidade?.nome} • {turma.dias_semana || 'Dias a definir'} • {turma.horario_inicio}-{turma.horario_fim}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleMatricular(turma)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                      Matricular
                    </button>
                  </div>
                ))}
                {turmas?.length === 0 && <p className="text-center text-slate-400">Nenhuma turma disponível.</p>}
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}

const ArrowRightCircle = ({ size }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16l4-4-4-4" />
    <path d="M8 12h8" />
  </svg>
);