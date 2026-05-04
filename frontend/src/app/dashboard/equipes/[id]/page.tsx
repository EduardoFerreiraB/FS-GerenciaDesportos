'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Users, 
  ArrowLeft, 
  Trophy, 
  UserPlus, 
  Trash2, 
  Loader2, 
  AlertTriangle,
  Mail,
  Phone,
  Calendar,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import AtletaForm from '@/components/forms/AtletaForm';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function DetalhesEquipePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [isAtletaModalOpen, setIsAtletaModalOpen] = useState(false);

  const { data: equipe, error, isLoading } = useSWR(id ? `/equipes/${id}` : null, fetcher);

  const handleDeleteParticipante = async (idParticipante: number) => {
    // Para remover um participante de uma equipe, precisaríamos de uma rota no back-end.
    // Por enquanto, como o foco é o cadastro, vou deixar o botão de delete mas 
    // precisaremos implementar a lógica de desvinculação depois se necessário.
    alert("Funcionalidade de remover participante em desenvolvimento.");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
        <Loader2 size={48} className="animate-spin mb-4 text-blue-600" />
        <p>Carregando dados da equipe...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-red-500">
        <AlertTriangle size={48} className="mb-4" />
        <h2 className="text-xl font-bold mb-2">Erro ao carregar</h2>
        <p className="text-slate-600 mb-6">Não foi possível encontrar os dados desta equipe.</p>
        <button 
          onClick={() => router.push('/dashboard/equipes')}
          className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
        >
          Voltar para Lista
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            {equipe?.nome}
            <span className="text-sm font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full uppercase">
              {equipe?.edicao?.evento?.even_nome}
            </span>
          </h1>
          <p className="text-slate-500">Temporada {equipe?.edicao?.edic_ano}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Info da Equipe */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Trophy className="text-blue-600" size={20} />
              Informações
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Competição</p>
                <p className="text-slate-800 font-medium">{equipe?.edicao?.evento?.even_nome}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Ano da Edição</p>
                <p className="text-slate-800 font-medium">{equipe?.edicao?.edic_ano}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase mb-0.5">Total de Jogadores</p>
                <p className="text-slate-800 font-medium">{equipe?.participantes?.length || 0} inscritos</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsAtletaModalOpen(true)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <UserPlus size={22} />
            Adicionar Atleta
          </button>
        </div>

        {/* Lista de Participantes */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-blue-600" size={20} />
                Jogadores Inscritos
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Documento</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {equipe?.participantes?.map((p: any) => {
                    const dados = p.aluno || p.atleta;
                    const isAluno = p.tipo === 'aluno';
                    
                    return (
                      <tr key={p.id_participante} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={clsx(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                              isAluno ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                              {dados?.nome_completo?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{dados?.nome_completo}</p>
                              <p className="text-xs text-slate-400">{isAluno ? dados?.escola : 'Externo'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={clsx(
                            "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase",
                            isAluno ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                          )}>
                            {p.tipo}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono">
                          {dados?.documento_pessoal || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteParticipante(p.id_participante)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {equipe?.participantes?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                        Nenhum jogador inscrito nesta equipe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Adicionar Atleta */}
      {isAtletaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-2xl w-full animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <UserPlus />
                    Novo Atleta Externo
                  </h2>
                  <p className="text-blue-100 text-sm">Cadastre e vincule ao time {equipe?.nome}</p>
                </div>
                <button 
                  onClick={() => setIsAtletaModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[80vh]">
                <AtletaForm 
                  idEquipe={parseInt(id as string)} 
                  onSuccess={() => {
                    setIsAtletaModalOpen(false);
                    mutate(`/equipes/${id}`);
                  }}
                  onCancel={() => setIsAtletaModalOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
