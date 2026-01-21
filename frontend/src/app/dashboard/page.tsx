'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  GraduationCap, 
  Trophy,
  UserPlus,
  ClipboardList,
  PlusCircle,
  Dumbbell,
  ArrowRight
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import useSWR from 'swr';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const fetcher = (url: string) => api.get(url).then(res => res.data);

const COLORS = ['#3072F0', '#0EA5E9', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  
  // Só dispara as requisições se a autenticação já terminou
  // Se user existir, dispara. Se não, espera (null).
  const shouldFetch = !authLoading && !!user;

  const { data: alunos } = useSWR(shouldFetch ? '/alunos/' : null, fetcher);
  const { data: turmas } = useSWR(shouldFetch ? '/turmas/' : null, fetcher);
  const { data: professores } = useSWR(shouldFetch ? '/professores/' : null, fetcher);
  const { data: modalidades } = useSWR(shouldFetch ? '/modalidades/' : null, fetcher);
  const { data: matriculas } = useSWR(shouldFetch ? '/matriculas/' : null, fetcher);

  const totalAlunos = alunos?.length || 0;
  const totalTurmas = turmas?.length || 0;
  const totalProfessores = professores?.length || 0;
  const totalModalidades = modalidades?.length || 0;

  const recentAlunos = alunos ? [...alunos].slice(-5).reverse() : [];

  const alunosPorModalidade: Record<string, number> = {};

  if (matriculas && matriculas.length > 0 && turmas && modalidades) {
    matriculas.forEach((matricula: any) => {
      const turma = turmas.find((t: any) => t.id_turma === matricula.id_turma);
      if (turma) {
        let nomeModalidade = 'Outros';
        if (turma.modalidade && turma.modalidade.nome) {
            nomeModalidade = turma.modalidade.nome;
        } else if (turma.id_modalidade) {
            const mod = modalidades.find((m: any) => m.id_modalidade === turma.id_modalidade);
            if (mod) nomeModalidade = mod.nome;
        }
        alunosPorModalidade[nomeModalidade] = (alunosPorModalidade[nomeModalidade] || 0) + 1;
      }
    });
  }

  const dataGrafico = Object.keys(alunosPorModalidade).map((key, index) => ({
    name: key,
    value: alunosPorModalidade[key],
    color: COLORS[index % COLORS.length]
  }));

  const showChart = dataGrafico.length > 0;
  const dataPlaceholder = [{ name: 'Sem dados', value: 1, color: '#e2e8f0' }];

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500">Bem-vindo ao painel de controle.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total de Alunos" value={totalAlunos} icon={Users} color="bg-blue-50 text-blue-600" />
        <KpiCard title="Turmas Ativas" value={totalTurmas} icon={GraduationCap} color="bg-indigo-50 text-indigo-600" />
        <KpiCard title="Professores" value={totalProfessores} icon={UserPlus} color="bg-emerald-50 text-emerald-600" />
        <KpiCard title="Modalidades Ativas" value={totalModalidades} icon={Dumbbell} color="bg-orange-50 text-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <ClipboardList className="text-primary" size={20} />
              Ações Rápidas
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/dashboard/alunos/novo" className="w-full">
                <ActionButton 
                  title="Nova Matrícula" 
                  desc="Inscrever aluno em turma" 
                  icon={PlusCircle} 
                />
              </Link>
              <Link href="/dashboard/turmas" className="w-full">
                <ActionButton 
                  title="Gerir Turmas" 
                  desc="Criar ou editar turmas" 
                  icon={GraduationCap} 
                />
              </Link>
              <Link href="/dashboard/professores/novo" className="w-full">
                <ActionButton 
                  title="Cadastrar Professor" 
                  desc="Adicionar novo docente" 
                  icon={UserPlus} 
                />
              </Link>
              <Link href="/dashboard/modalidades" className="w-full">
                <ActionButton 
                  title="Modalidades" 
                  desc="Configurar esportes" 
                  icon={Trophy} 
                />
              </Link>
            </div>
          </section>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Alunos por Modalidade</h2>
          <div className="h-[250px] w-full" style={{ minHeight: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={showChart ? dataGrafico : dataPlaceholder}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {showChart ? (
                    dataGrafico.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))
                  ) : (
                    <Cell fill="#e2e8f0" />
                  )}
                </Pie>
                <Tooltip />
                {showChart && <Legend verticalAlign="bottom" height={36}/>}
              </PieChart>
            </ResponsiveContainer>
            {!showChart && (
                <p className="text-center text-xs text-slate-400 mt-2">Nenhuma matrícula registrada.</p>
            )}
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">Alunos Recentes</h2>
          <Link href="/dashboard/alunos">
            <button className="text-primary text-sm font-semibold hover:text-blue-700 flex items-center gap-1">
                Ver todos <ArrowRight size={16} />
            </button>
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">Aluno</th>
                <th className="px-6 py-4">Data Nasc.</th>
                <th className="px-6 py-4">Responsável</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentAlunos.map((aluno: any) => (
                <tr key={aluno.id_aluno} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{aluno.nome_completo}</td>
                  <td className="px-6 py-4 text-slate-600">{aluno.data_nascimento}</td>
                  <td className="px-6 py-4 text-slate-500">{aluno.nome_mae || aluno.nome_pai || '-'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      Ativo
                    </span>
                  </td>
                </tr>
              ))}
              {recentAlunos.length === 0 && (
                  <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">Nenhum aluno recente.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function KpiCard({ title, value, icon: Icon, color }: any) {
  const blobColor = color.includes('blue') ? 'bg-blue-100' :
                   color.includes('indigo') ? 'bg-indigo-100' :
                   color.includes('emerald') ? 'bg-emerald-100' :
                   color.includes('amber') ? 'bg-amber-100' :
                   color.includes('orange') ? 'bg-orange-100' : 'bg-slate-100';

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 relative overflow-hidden group hover:shadow-md transition-all duration-300">
      {/* Mancha arredondada (Blob) que invade o card - Agora com cor mais sólida */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 ${blobColor} opacity-70 rounded-full transition-transform duration-500 group-hover:scale-150 group-hover:rotate-12 group-hover:opacity-100`} />
      
      {/* Detalhe extra de acento no topo */}
      <div className={`absolute top-0 right-0 w-16 h-1 ${color.split(' ')[1].replace('text', 'bg')} opacity-40`} />

      <div className={`w-12 h-12 rounded-xl flex items-center justify-center relative z-10 ${color}`}>
        <Icon size={24} />
      </div>
      <div className="relative z-10">
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>
    </div>
  );
}

function ActionButton({ title, desc, icon: Icon }: any) {
  return (
    <button className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-blue-50/50 transition-all text-left group w-full h-full">
      <div className="bg-blue-50 text-primary p-3 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
        <Icon size={24} />
      </div>
      <div>
        <h4 className="font-bold text-slate-800 group-hover:text-primary transition-colors">{title}</h4>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </button>
  );
}