'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import AlunoForm from '@/components/forms/AlunoForm';
import useSWR from 'swr';
import api from '@/lib/api';
import { Loader2, AlertCircle } from 'lucide-react';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function EditarAlunoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const { data: aluno, error, isLoading } = useSWR(id ? `/alunos/${id}` : null, fetcher);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
        <Loader2 size={48} className="animate-spin mb-4 text-primary" />
        <p>Carregando dados do aluno...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-red-500">
        <AlertCircle size={48} className="mb-4" />
        <h2 className="text-xl font-bold mb-2">Erro ao carregar</h2>
        <p className="text-slate-600 mb-6">Não foi possível encontrar os dados deste aluno.</p>
        <button 
          onClick={() => router.push('/dashboard/alunos')}
          className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
        >
          Voltar para Lista
        </button>
      </div>
    );
  }

  return <AlunoForm initialData={aluno} isEditing={true} />;
}