'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  GraduationCap, 
  ArrowLeft, 
  User, 
  Calendar, 
  Clock, 
  Users,
  ClipboardCheck,
  Download,
  CheckCircle,
  XCircle,
  CheckSquare,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import useSWR from 'swr';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function DetalhesTurmaPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [activeTab, setActiveTab] = useState<'alunos' | 'frequencia'>('alunos');
  
  const { data: turma, error: errorTurma, isLoading: loadingTurma } = useSWR(id ? `/turmas/${id}` : null, fetcher);
  
  const { data: matriculas, error: errorMatriculas, isLoading: loadingMatriculas } = useSWR(
    id ? `/matriculas/?turma_id=${id}` : null, 
    fetcher
  );
  
  const [chamada, setChamada] = useState<Record<number, 'P' | 'A' | null>>({});
  const [dataChamada, setDataChamada] = useState(new Date().toISOString().split('T')[0]);

  const alunos = matriculas?.map((m: any) => m.aluno) || [];

  const handlePresenca = (alunoId: number, status: 'P' | 'A') => {
    setChamada(prev => ({
      ...prev,
      [alunoId]: prev[alunoId] === status ? null : status
    }));
  };

  const markAllPresent = () => {
    const newChamada: Record<number, 'P'> = {};
    alunos.forEach((aluno: any) => {
      newChamada[aluno.id_aluno] = 'P';
    });
    setChamada(newChamada);
  };

  const saveChamada = async () => {
    try {
      console.log({ data: dataChamada, chamada });
      alert('Frequência salva com sucesso! (Simulado)');
    } catch (error) {
      alert('Erro ao salvar frequência.');
    }
  };

  if (loadingTurma) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
        <Loader2 size={48} className="animate-spin mb-4 text-indigo-600" />
        <p>Carregando detalhes da turma...</p>
      </div>
    );
  }

  if (errorTurma) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-red-500">
        <AlertTriangle size={48} className="mb-4" />
        <h2 className="text-xl font-bold mb-2">Erro ao carregar</h2>
        <p className="text-slate-600 mb-6">Não foi possível encontrar esta turma.</p>
        <button onClick={() => router.back()} className="px-6 py-2 bg-slate-100 rounded-lg">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            {turma?.descricao || `Turma #${turma?.id_turma}`}
            <span className="text-sm font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
              {turma?.categoria_idade}
            </span>
          </h1>
          <p className="text-slate-500">Detalhes e gestão da turma.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Coluna Esquerda: Informações Fixas */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <GraduationCap className="text-indigo-600" size={20} />
              Informações
            </h2>
            <div className="space-y-4">
              <InfoItem label="Modalidade" value={turma?.modalidade?.nome} />
              <InfoItem label="Professor" value={turma?.professor?.nome} icon={User} />
              <InfoItem label="Dias" value={turma?.dias_semana} icon={Calendar} />
              <InfoItem label="Horário" value={`${turma?.horario_inicio} - ${turma?.horario_fim}`} icon={Clock} />
              
              <div className="pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-500 leading-relaxed">
                  {turma?.descricao}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Link href={`/dashboard/turmas/${id}/editar`} className="flex-1">
              <button className="w-full py-3 rounded-xl border border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors">
                Editar Turma
              </button>
            </Link>
          </div>
        </div>

        {/* Coluna Direita: Abas Dinâmicas */}
        <div className="lg:col-span-2">
          
          {/* Navegação de Abas */}
          <div className="flex gap-4 mb-4 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('alunos')}
              className={clsx(
                "pb-3 px-2 font-semibold text-sm flex items-center gap-2 transition-all border-b-2",
                activeTab === 'alunos' 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <Users size={18} />
              Alunos
            </button>
            <button
              onClick={() => setActiveTab('frequencia')}
              className={clsx(
                "pb-3 px-2 font-semibold text-sm flex items-center gap-2 transition-all border-b-2",
                activeTab === 'frequencia' 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <ClipboardCheck size={18} />
              Frequência
            </button>
          </div>

          {/* Conteúdo da Aba: Alunos */}
          {activeTab === 'alunos' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  Lista de Matriculados
                  <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                    {loadingMatriculas ? '...' : alunos.length}
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {loadingMatriculas ? (
                    <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>
                ) : (
                    <>
                        {alunos.map((aluno: any) => (
                        <div key={aluno.id_aluno} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                {aluno.nome_completo.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-700">{aluno.nome_completo}</span>
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                            Matriculado
                            </span>
                        </div>
                        ))}
                        {alunos.length === 0 && (
                        <div className="p-8 text-center text-slate-400 italic">
                            Nenhum aluno matriculado nesta turma.
                        </div>
                        )}
                    </>
                )}
              </div>
            </div>
          )}

          {/* Conteúdo da Aba: Frequência */}
          {activeTab === 'frequencia' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              
              {/* Controles da Frequência */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    Controle de Frequência
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Selecione a data e marque a presença.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    value={dataChamada}
                    onChange={(e) => setDataChamada(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all" title="Baixar Relatório">
                    <Download size={20} />
                  </button>
                </div>
              </div>

              {/* Lista de Chamada */}
              <div className="p-4 space-y-3">
                {loadingMatriculas ? (
                    <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>
                ) : (
                    <>
                        {alunos.map((aluno: any) => {
                        const status = chamada[aluno.id_aluno];
                        const cardBg = status === 'P' ? 'bg-emerald-50 border-emerald-200' : 
                                        status === 'A' ? 'bg-red-50 border-red-200' : 
                                        'bg-white border-slate-100 hover:border-slate-300';

                        return (
                            <div 
                            key={aluno.id_aluno} 
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${cardBg}`}
                            >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                                status === 'P' ? 'bg-emerald-200 text-emerald-700' :
                                status === 'A' ? 'bg-red-200 text-red-700' :
                                'bg-slate-100 text-slate-500'
                                }`}>
                                {aluno.nome_completo.charAt(0)}
                                </div>
                                <span className={`font-medium transition-colors ${
                                status === 'P' ? 'text-emerald-900' :
                                status === 'A' ? 'text-red-900' :
                                'text-slate-700'
                                }`}>
                                {aluno.nome_completo}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                onClick={() => handlePresenca(aluno.id_aluno, 'P')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                    status === 'P' 
                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 scale-105' 
                                    : 'bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200'
                                }`}
                                >
                                <CheckCircle size={16} />
                                Presente
                                </button>
                                <button
                                onClick={() => handlePresenca(aluno.id_aluno, 'A')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                    status === 'A' 
                                    ? 'bg-red-500 text-white shadow-md shadow-red-200 scale-105' 
                                    : 'bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200'
                                }`}
                                >
                                <XCircle size={16} />
                                Ausente
                                </button>
                            </div>
                            </div>
                        );
                        })}
                        {alunos.length === 0 && (
                        <p className="text-center text-slate-400 py-4 italic">Sem alunos para chamada.</p>
                        )}
                    </>
                )}
              </div>

              {/* Rodapé da Chamada */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <button 
                  onClick={markAllPresent}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-2 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                >
                  <CheckSquare size={16} />
                  Marcar Todos Presentes
                </button>
                <button 
                  onClick={saveChamada}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center gap-2"
                >
                  <ClipboardCheck size={18} />
                  Salvar Chamada
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

function InfoItem({ label, value, icon: Icon }: any) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-semibold uppercase mb-0.5 flex items-center gap-1">
        {Icon && <Icon size={12} />}
        {label}
      </p>
      <p className="text-slate-800 font-medium">{value || '-'}</p>
    </div>
  );
}