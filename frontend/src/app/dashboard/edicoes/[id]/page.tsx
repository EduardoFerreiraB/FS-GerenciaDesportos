'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Users, 
  ArrowLeft, 
  Plus, 
  Eye, 
  Trash2, 
  Loader2, 
  AlertTriangle,
  Trophy,
  Calendar,
  PlusCircle,
  X,
  Sliders,
  MapPin,
  User,
  ListPlus,
  UploadCloud,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  SlidersHorizontal
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function DetalhesEdicaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // Estados dos Modais
  const [activeTab, setActiveTab] = useState<'equipes' | 'partidas'>('equipes');
  const [isEquipeModalOpen, setIsEquipeModalOpen] = useState(false);
  const [isPartidaModalOpen, setIsPartidaModalOpen] = useState(false);
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<any | null>(null);
  const [selectedMatchForSumula, setSelectedMatchForSumula] = useState<any | null>(null);
  const [selectedMatchForStats, setSelectedMatchForStats] = useState<any | null>(null);

  // Estados de filtros/sub-tabs das Partidas
  const [selectedModalidadeId, setSelectedModalidadeId] = useState<string>('');
  const [roundFilter, setRoundFilter] = useState<string>('');
  const [partidasSubTab, setPartidasSubTab] = useState<'confrontos' | 'tabela' | 'arvore'>('confrontos');

  // Estados de loading da geração
  const [isGenerating, setIsGenerating] = useState(false);

  // Data Fetching
  const { data: edicao, error, isLoading } = useSWR(id ? `/edicoes/${id}` : null, fetcher);
  const { data: equipes, isLoading: loadingEquipes } = useSWR(id ? `/equipes/edicao/${id}` : null, fetcher);
  const { data: matches, mutate: mutateMatches, isLoading: loadingMatches } = useSWR(id ? `/partidas/edicao/${id}` : null, fetcher);
  const { data: modalidades } = useSWR('/modalidades', fetcher);
  const { data: locais } = useSWR('/locais', fetcher);
  const { data: arbitros } = useSWR('/arbitros', fetcher);

  // Auto-selecionar a primeira modalidade quando carrega
  useEffect(() => {
    if (edicao?.evento?.modalidades && edicao.evento.modalidades.length > 0 && !selectedModalidadeId) {
      setSelectedModalidadeId(edicao.evento.modalidades[0].id_modalidade.toString());
    } else if (modalidades && modalidades.length > 0 && !selectedModalidadeId) {
      setSelectedModalidadeId(modalidades[0].id_modalidade.toString());
    }
  }, [edicao, modalidades, selectedModalidadeId]);

  // Lista de partidas filtradas pela modalidade selecionada
  const filteredMatches = useMemo(() => {
    if (!matches || !selectedModalidadeId) return [];
    return matches.filter((m: any) => m.id_modalidade === parseInt(selectedModalidadeId));
  }, [matches, selectedModalidadeId]);

  // Extrair rodadas exclusivas (para Pontos Corridos)
  const rounds = useMemo(() => {
    const list = filteredMatches
      .map((m: any) => m.fase)
      .filter((fase: string) => fase && fase.startsWith('Rodada '));
    const unique = Array.from(new Set(list)) as string[];
    return unique.sort((a, b) => {
      const numA = parseInt(a.replace('Rodada ', '')) || 0;
      const numB = parseInt(b.replace('Rodada ', '')) || 0;
      return numA - numB;
    });
  }, [filteredMatches]);

  // Auto-selecionar a primeira rodada caso mude modalidade
  useEffect(() => {
    if (rounds.length > 0) {
      setRoundFilter(rounds[0]);
    } else {
      setRoundFilter('');
    }
  }, [rounds]);

  // Computa a Tabela de Classificação
  const classificationTable = useMemo(() => {
    if (!equipes || !filteredMatches) return [];
    
    // Inicializar mapa de estatísticas para todas as equipes
    const statsMap: Record<number, any> = {};
    equipes.forEach((eq: any) => {
      statsMap[eq.id_equipe] = {
        id_equipe: eq.id_equipe,
        nome: eq.nome,
        pontos: 0,
        jogos: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        golsPro: 0,
        golsContra: 0,
        saldoGols: 0
      };
    });

    // Processar partidas finalizadas
    filteredMatches.forEach((m: any) => {
      if (m.status === 'Finalizada' && m.id_equipe_casa && m.id_equipe_visitante) {
        const casa = statsMap[m.id_equipe_casa];
        const visit = statsMap[m.id_equipe_visitante];

        if (casa && visit) {
          casa.jogos += 1;
          visit.jogos += 1;
          casa.golsPro += m.placar_casa;
          casa.golsContra += m.placar_visitante;
          visit.golsPro += m.placar_visitante;
          visit.golsContra += m.placar_casa;

          if (m.placar_casa > m.placar_visitante) {
            casa.pontos += 3;
            casa.vitorias += 1;
            visit.derrotas += 1;
          } else if (m.placar_visitante > m.placar_casa) {
            visit.pontos += 3;
            visit.vitorias += 1;
            casa.derrotas += 1;
          } else {
            casa.pontos += 1;
            visit.pontos += 1;
            casa.empates += 1;
            visit.empates += 1;
          }
        }
      }
    });

    // Calcular saldo de gols e transformar em array
    const list = Object.values(statsMap).map((team: any) => {
      team.saldoGols = team.golsPro - team.golsContra;
      return team;
    });

    // Ordenação tradicional da tabela
    return list.sort((a: any, b: any) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
      if (b.saldoGols !== a.saldoGols) return b.saldoGols - a.saldoGols;
      return b.golsPro - a.golsPro;
    });
  }, [equipes, filteredMatches]);

  // Estruturar chaves de Mata-Mata
  const bracketPhases = useMemo(() => {
    const phases = ['Oitavas', 'Quartas', 'Semifinal', 'Final'];
    const bracket: Record<string, any[]> = {
      Oitavas: [],
      Quartas: [],
      Semifinal: [],
      Final: []
    };

    filteredMatches.forEach((m: any) => {
      if (phases.includes(m.fase)) {
        bracket[m.fase].push(m);
      }
    });

    return bracket;
  }, [filteredMatches]);

  const handleAddEquipe = async (data: any) => {
    try {
      await api.post('/equipes/', {
        nome: data.nome,
        id_edicao: parseInt(id)
      });
      mutate(`/equipes/edicao/${id}`);
      setIsEquipeModalOpen(false);
    } catch (error) {
      alert('Erro ao criar equipe.');
    }
  };

  const handleDeleteEquipe = async (equipeId: number) => {
    if (confirm('Deseja realmente excluir esta equipe?')) {
      try {
        await api.delete(`/equipes/${equipeId}`);
        mutate(`/equipes/edicao/${id}`);
      } catch (error) {
        alert('Erro ao excluir equipe. Verifique se ela possui atletas vinculados.');
      }
    }
  };

  const handleGerarConfrontos = async () => {
    if (!selectedModalidadeId) return;
    setIsGenerating(true);
    try {
      await api.post(`/edicoes/${id}/gerar-confrontos`, {
        id_modalidade: parseInt(selectedModalidadeId)
      });
      mutateMatches();
      alert('Tabela/confrontos gerados com sucesso!');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Erro ao gerar confrontos.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={48}/></div>;

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push(`/dashboard/eventos/${edicao?.id_evento}`)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Edição {edicao?.edic_ano}
            <span className="text-sm font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase">
              {edicao?.evento?.even_nome}
            </span>
          </h1>
          <p className="text-slate-500">
            Formato: <strong className="text-blue-600">{edicao?.tipo_competicao}</strong> 
            {edicao?.tipo_competicao === 'Mata-Mata' && ` (Inicia em: ${edicao?.fase_inicial})`} | Período: {new Date(edicao?.data_inicio).toLocaleDateString()} a {new Date(edicao?.data_fim).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('equipes')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === 'equipes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Users size={18} />
          Equipes Inscritas ({equipes?.length || 0})
        </button>
        <button 
          onClick={() => setActiveTab('partidas')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === 'partidas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Trophy size={18} />
          Confrontos e Partidas
        </button>
      </div>

      {/* Conteúdo Aba Equipes */}
      {activeTab === 'equipes' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
              <Users className="text-blue-600" size={20} />
              Lista de Equipes
            </h2>
            <button 
              onClick={() => setIsEquipeModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
            >
              <Plus size={18} />
              Inscrever Equipe
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {equipes?.map((equipe: any) => (
              <div key={equipe.id_equipe} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all group p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Trophy size={24} />
                  </div>
                  <button 
                    onClick={() => handleDeleteEquipe(equipe.id_equipe)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{equipe.nome}</h3>
                  <p className="text-sm text-slate-500">{equipe.participantes?.length || 0} jogadores</p>
                </div>

                <div className="pt-4 border-t border-slate-50">
                  <Link 
                    href={`/dashboard/equipes/${equipe.id_equipe}`}
                    className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    Ver Jogadores
                  </Link>
                </div>
              </div>
            ))}

            {equipes?.length === 0 && (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Users size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">Nenhuma equipe inscrita nesta edição.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo Aba Partidas */}
      {activeTab === 'partidas' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Seletor de Modalidade e botões de ação */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="text-blue-600" size={20} />
              <label className="font-bold text-slate-700 text-sm">Modalidade:</label>
              <select 
                value={selectedModalidadeId} 
                onChange={(e) => setSelectedModalidadeId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {edicao?.evento?.modalidades?.map((mod: any) => (
                  <option key={mod.id_modalidade} value={mod.id_modalidade}>{mod.nome}</option>
                )) || modalidades?.map((mod: any) => (
                  <option key={mod.id_modalidade} value={mod.id_modalidade}>{mod.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGerarConfrontos}
                disabled={isGenerating || !selectedModalidadeId}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <ListPlus size={16} />}
                Gerar Confrontos
              </button>
              
              <button
                onClick={() => setIsPartidaModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2"
              >
                <Plus size={16} />
                Agendar Partida
              </button>
            </div>
          </div>

          {/* Sub-navegação do tipo de campeonato */}
          {filteredMatches.length > 0 && (
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl self-start w-fit">
              <button 
                onClick={() => setPartidasSubTab('confrontos')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${partidasSubTab === 'confrontos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Lista de Jogos
              </button>
              {edicao?.tipo_competicao === 'Pontos Corridos' && (
                <button 
                  onClick={() => setPartidasSubTab('tabela')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${partidasSubTab === 'tabela' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Tabela Classificação
                </button>
              )}
              {edicao?.tipo_competicao === 'Mata-Mata' && (
                <button 
                  onClick={() => setPartidasSubTab('arvore')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${partidasSubTab === 'arvore' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Chaveamento (Árvore)
                </button>
              )}
            </div>
          )}

          {/* Visualização de Rodadas / Lista de Jogos */}
          {filteredMatches.length > 0 && partidasSubTab === 'confrontos' && (
            <div className="space-y-6">
              {edicao?.tipo_competicao === 'Pontos Corridos' && rounds.length > 0 && (
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 w-fit">
                  <span className="text-xs font-bold text-slate-500">Filtrar Rodada:</span>
                  <div className="flex gap-1">
                    {rounds.map((rd) => (
                      <button
                        key={rd}
                        onClick={() => setRoundFilter(rd)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${roundFilter === rd ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {rd.replace('Rodada ', 'R')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {filteredMatches
                  .filter((m: any) => !roundFilter || m.fase === roundFilter)
                  .map((match: any) => (
                    <MatchCard 
                      key={match.id_partida}
                      match={match} 
                      onLancarPlacar={(m: any) => setSelectedMatchForScore(m)}
                      onManageSumula={(m: any) => setSelectedMatchForSumula(m)}
                      onManageStats={(m: any) => setSelectedMatchForStats(m)}
                      mutateMatches={mutateMatches}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Visualização Tabela de Classificação */}
          {filteredMatches.length > 0 && partidasSubTab === 'tabela' && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm animate-in fade-in duration-200">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase">
                    <th className="py-4 px-6 text-center w-12">Pos</th>
                    <th className="py-4 px-6">Equipe</th>
                    <th className="py-4 px-6 text-center">P</th>
                    <th className="py-4 px-6 text-center">J</th>
                    <th className="py-4 px-6 text-center">V</th>
                    <th className="py-4 px-6 text-center">E</th>
                    <th className="py-4 px-6 text-center">D</th>
                    <th className="py-4 px-6 text-center">GP</th>
                    <th className="py-4 px-6 text-center">GC</th>
                    <th className="py-4 px-6 text-center">SG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                  {classificationTable.map((row: any, idx: number) => (
                    <tr key={row.id_equipe} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-4 px-6 font-bold text-slate-800">{row.nome}</td>
                      <td className="py-4 px-6 text-center font-black text-blue-600">{row.pontos}</td>
                      <td className="py-4 px-6 text-center">{row.jogos}</td>
                      <td className="py-4 px-6 text-center text-green-600 font-semibold">{row.vitorias}</td>
                      <td className="py-4 px-6 text-center text-slate-500">{row.empates}</td>
                      <td className="py-4 px-6 text-center text-red-500">{row.derrotas}</td>
                      <td className="py-4 px-6 text-center">{row.golsPro}</td>
                      <td className="py-4 px-6 text-center">{row.golsContra}</td>
                      <td className={`py-4 px-6 text-center font-semibold ${row.saldoGols > 0 ? 'text-green-600' : row.saldoGols < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        {row.saldoGols > 0 ? `+${row.saldoGols}` : row.saldoGols}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Visualização de Árvore Mata-Mata */}
          {filteredMatches.length > 0 && partidasSubTab === 'arvore' && (
            <div className="overflow-x-auto py-8">
              <div className="flex gap-12 min-w-max items-center justify-center">
                {Object.keys(bracketPhases)
                  .filter(phase => bracketPhases[phase].length > 0)
                  .map((phase) => (
                    <div key={phase} className="flex flex-col gap-8 w-64">
                      <h3 className="text-center font-black text-slate-500 uppercase tracking-widest text-xs border-b border-slate-200 pb-2 mb-4">
                        {phase}
                      </h3>
                      <div className="flex flex-col justify-around h-full gap-6">
                        {bracketPhases[phase].map((match: any) => (
                          <div key={match.id_partida} className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative">
                            <div className="text-[10px] text-slate-400 font-bold mb-2 flex justify-between">
                              <span>ID: #{match.id_partida}</span>
                              <span className="text-blue-500 uppercase">{match.status}</span>
                            </div>
                            
                            <div className="space-y-2">
                              {/* Equipe Casa */}
                              <div className={`flex justify-between items-center text-sm ${match.status === 'Finalizada' && match.placar_casa > match.placar_visitante ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                                <span className="truncate">{match.equipe_casa?.nome || 'A definir'}</span>
                                <span className="bg-slate-50 px-2 py-0.5 rounded font-black text-xs">{match.status !== 'Agendada' ? match.placar_casa : '-'}</span>
                              </div>
                              
                              {/* Equipe Visitante */}
                              <div className={`flex justify-between items-center text-sm ${match.status === 'Finalizada' && match.placar_visitante > match.placar_casa ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                                <span className="truncate">{match.equipe_visitante?.nome || 'A definir'}</span>
                                <span className="bg-slate-50 px-2 py-0.5 rounded font-black text-xs">{match.status !== 'Agendada' ? match.placar_visitante : '-'}</span>
                              </div>
                            </div>

                            {/* Botão rápido para lançar placar */}
                            <button 
                              onClick={() => setSelectedMatchForScore(match)}
                              className="mt-3 w-full py-1 text-center bg-slate-50 hover:bg-blue-50 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
                            >
                              Editar placar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Estado Vazio de Partidas */}
          {filteredMatches.length === 0 && (
            <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Nenhum confronto gerado para esta modalidade nesta edição.</p>
              <p className="text-slate-400 text-xs mt-1">Inscreva todas as equipes primeiro e depois clique em "Gerar Confrontos".</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Inscrever Equipe */}
      {isEquipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100 relative">
            <button onClick={() => setIsEquipeModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X /></button>
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PlusCircle className="text-blue-600" /> Nova Equipe</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleAddEquipe({ nome: formData.get('nome') });
            }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Nome da Equipe</label>
                <input name="nome" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Ex: Estrelas de Goianira" />
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setIsEquipeModalOpen(false)} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100">Criar Equipe</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agendar Partida (Manual & Inline) */}
      {isPartidaModalOpen && (
        <ModalAgendarPartida 
          idEdicao={id}
          modalidades={edicao?.evento?.modalidades || modalidades}
          equipes={equipes}
          locais={locais}
          arbitros={arbitros}
          onClose={() => setIsPartidaModalOpen(false)}
          onSuccess={() => { setIsPartidaModalOpen(false); mutateMatches(); }}
        />
      )}

      {/* Modal Lançar Placar */}
      {selectedMatchForScore && (
        <ModalLancarPlacar 
          match={selectedMatchForScore}
          onClose={() => setSelectedMatchForScore(null)}
          onSuccess={() => { setSelectedMatchForScore(null); mutateMatches(); }}
        />
      )}

      {/* Modal Súmula */}
      {selectedMatchForSumula && (
        <ModalSumula 
          match={selectedMatchForSumula}
          onClose={() => setSelectedMatchForSumula(null)}
          onSuccess={() => { setSelectedMatchForSumula(null); mutateMatches(); }}
        />
      )}

      {/* Modal Estatísticas de Partida */}
      {selectedMatchForStats && (
        <ModalEstatisticas 
          match={selectedMatchForStats}
          onClose={() => setSelectedMatchForStats(null)}
        />
      )}
    </div>
  );
}

// Sub-Componente de Visualização de Jogo (Card)
function MatchCard({ match, onLancarPlacar, onManageSumula, onManageStats, mutateMatches }: any) {
  const dataFormatada = new Date(match.part_data).toLocaleDateString();

  const statusColors: Record<string, string> = {
    Agendada: 'bg-slate-100 text-slate-600',
    'Em Andamento': 'bg-amber-100 text-amber-600',
    Finalizada: 'bg-green-100 text-green-600',
    Cancelada: 'bg-red-100 text-red-600'
  };

  const handleDelete = async () => {
    if (confirm('Deseja excluir esta partida permanentemente?')) {
      try {
        await api.delete(`/partidas/${match.id_partida}`);
        mutateMatches();
      } catch (error) {
        alert('Erro ao excluir partida.');
      }
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:shadow-md transition-shadow">
      
      {/* Placar e Equipes */}
      <div className="flex-1 flex items-center justify-center lg:justify-start gap-6">
        <div className="text-right w-40 truncate font-bold text-slate-700">
          {match.equipe_casa?.nome || <span className="text-slate-400 font-normal italic">A definir</span>}
        </div>

        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
          <span className="text-xl font-black text-slate-800">{match.status !== 'Agendada' ? match.placar_casa : '-'}</span>
          <span className="text-slate-400 text-xs font-bold uppercase">VS</span>
          <span className="text-xl font-black text-slate-800">{match.status !== 'Agendada' ? match.placar_visitante : '-'}</span>
        </div>

        <div className="text-left w-40 truncate font-bold text-slate-700">
          {match.equipe_visitante?.nome || <span className="text-slate-400 font-normal italic">A definir</span>}
        </div>
      </div>

      {/* Informações da Partida */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-8 text-xs text-slate-500 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-8">
        <div>
          <p className="font-semibold text-slate-400">Data e Hora</p>
          <p className="font-bold text-slate-700 mt-0.5">{dataFormatada} - {match.part_hora.substring(0, 5)}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-400">Local</p>
          <p className="font-bold text-slate-700 mt-0.5 truncate max-w-[120px]" title={match.local?.loca_nome}>
            {match.local?.loca_nome || 'Não definido'}
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-400">Árbitro</p>
          <p className="font-bold text-slate-700 mt-0.5 truncate max-w-[120px]" title={match.arbitro?.apito_nome}>
            {match.arbitro?.apito_nome || 'Não definido'}
          </p>
        </div>
        {match.fase && (
          <div>
            <p className="font-semibold text-slate-400">Etapa/Fase</p>
            <p className="font-bold text-blue-600 mt-0.5">{match.fase}</p>
          </div>
        )}
        <div>
          <p className="font-semibold text-slate-400">Status</p>
          <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase mt-1 ${statusColors[match.status]}`}>
            {match.status}
          </span>
        </div>
        <div>
          <p className="font-semibold text-slate-400">Súmula</p>
          {match.sumula_arquivo ? (
            <span className="text-green-600 font-bold flex items-center gap-1 mt-0.5">
              <CheckCircle2 size={12} /> Enviada
            </span>
          ) : (
            <span className="text-slate-400 italic mt-0.5">Pendente</span>
          )}
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-2 lg:flex-col justify-end border-t lg:border-t-0 border-slate-100 pt-4 lg:pt-0">
        <button 
          onClick={() => onLancarPlacar(match)}
          className="flex-1 lg:flex-none px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all"
        >
          Lançar Resultado
        </button>
        <button 
          onClick={() => onManageStats(match)}
          className="flex-1 lg:flex-none px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all"
        >
          Estatísticas
        </button>
        <button 
          onClick={() => onManageSumula(match)}
          className="flex-1 lg:flex-none px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl transition-all"
        >
          Súmula
        </button>
        <button 
          onClick={handleDelete}
          className="p-2 text-slate-300 hover:text-red-500 rounded-xl transition-colors border border-transparent hover:border-slate-100"
          title="Excluir partida"
        >
          <Trash2 size={16} />
        </button>
      </div>

    </div>
  );
}

// Modal Agendar Partida com Inline Creation
function ModalAgendarPartida({ idEdicao, modalidades, equipes, locais, arbitros, onClose, onSuccess }: any) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();
  
  const [isLocalInline, setIsLocalInline] = useState(false);
  const [isArbitroInline, setIsArbitroInline] = useState(false);

  const onSubmit = async (data: any) => {
    try {
      const payload = {
        id_edicao: parseInt(idEdicao),
        id_modalidade: parseInt(data.id_modalidade),
        part_data: data.part_data,
        part_hora: data.part_hora,
        id_equipe_casa: data.id_equipe_casa ? parseInt(data.id_equipe_casa) : null,
        id_equipe_visitante: data.id_equipe_visitante ? parseInt(data.id_equipe_visitante) : null,
        observacoes: data.observacoes || null,
        // Inline ou existente
        id_local: isLocalInline ? null : parseInt(data.id_local),
        local_inline: isLocalInline ? {
          loca_nome: data.local_nome,
          loca_descricao: data.local_descricao || null
        } : null,
        id_arbitro: isArbitroInline ? null : parseInt(data.id_arbitro),
        arbitro_inline: isArbitroInline ? {
          apito_nome: data.arbitro_nome,
          apito_doc: data.arbitro_doc,
          apito_tel: data.arbitro_tel
        } : null
      };

      await api.post('/partidas/', payload);
      alert('Partida agendada com sucesso!');
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Erro ao agendar partida.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 my-8 animate-in zoom-in-95 border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X /></button>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PlusCircle className="text-blue-600" /> Agendar Partida</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Modalidade */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Modalidade</label>
              <select {...register('id_modalidade', { required: true })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                <option value="">Selecione...</option>
                {modalidades?.map((m: any) => (
                  <option key={m.id_modalidade} value={m.id_modalidade}>{m.nome}</option>
                ))}
              </select>
            </div>

            {/* Data e Hora */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Data</label>
                <input type="date" {...register('part_data', { required: true })} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Hora</label>
                <input type="time" {...register('part_hora', { required: true })} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
              </div>
            </div>

            {/* Equipe Casa */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Equipe Casa</label>
              <select {...register('id_equipe_casa')} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                <option value="">A definir / Bye</option>
                {equipes?.map((e: any) => (
                  <option key={e.id_equipe} value={e.id_equipe}>{e.nome}</option>
                ))}
              </select>
            </div>

            {/* Equipe Visitante */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Equipe Visitante</label>
              <select {...register('id_equipe_visitante')} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                <option value="">A definir / Bye</option>
                {equipes?.map((e: any) => (
                  <option key={e.id_equipe} value={e.id_equipe}>{e.nome}</option>
                ))}
              </select>
            </div>

          </div>

          <hr className="border-slate-100" />

          {/* Seção Local */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MapPin size={16} className="text-red-500" /> Local da Partida
              </label>
              <label className="flex items-center gap-2 text-xs text-blue-600 font-bold cursor-pointer">
                <input type="checkbox" checked={isLocalInline} onChange={(e) => setIsLocalInline(e.target.checked)} className="rounded" />
                Cadastrar Novo Local Inline
              </label>
            </div>

            {isLocalInline ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Nome do Local</label>
                  <input {...register('local_nome', { required: isLocalInline })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm" placeholder="Ex: Quadra Poliesportiva A" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Descrição/Endereço</label>
                  <input {...register('local_descricao')} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm" placeholder="Ex: Rua 10, Centro" />
                </div>
              </div>
            ) : (
              <select {...register('id_local', { required: !isLocalInline })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                <option value="">Selecione um local...</option>
                {locais?.filter((l: any) => l.ativo).map((l: any) => (
                  <option key={l.id_local} value={l.id_local}>{l.loca_nome}</option>
                ))}
              </select>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Seção Árbitro */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User size={16} className="text-amber-500" /> Árbitro
              </label>
              <label className="flex items-center gap-2 text-xs text-blue-600 font-bold cursor-pointer">
                <input type="checkbox" checked={isArbitroInline} onChange={(e) => setIsArbitroInline(e.target.checked)} className="rounded" />
                Cadastrar Novo Árbitro Inline
              </label>
            </div>

            {isArbitroInline ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Nome Completo</label>
                  <input {...register('arbitro_nome', { required: isArbitroInline })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm" placeholder="Ex: João da Silva" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">CPF/Documento</label>
                  <input {...register('arbitro_doc', { required: isArbitroInline })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm" placeholder="Ex: 000.000.000-00" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Telefone</label>
                  <input {...register('arbitro_tel', { required: isArbitroInline })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm" placeholder="Ex: (62) 99999-9999" />
                </div>
              </div>
            ) : (
              <select {...register('id_arbitro', { required: !isArbitroInline })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                <option value="">Selecione um árbitro...</option>
                {arbitros?.map((a: any) => (
                  <option key={a.id_arbitro} value={a.id_arbitro}>{a.apito_nome}</option>
                ))}
              </select>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Observações</label>
            <textarea {...register('observacoes')} rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" placeholder="Ex: Partida de abertura." />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100">Agendar Jogo</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal Lançar Placar e Status
function ModalLancarPlacar({ match, onClose, onSuccess }: any) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      placar_casa: match.placar_casa || 0,
      placar_visitante: match.placar_visitante || 0,
      status: match.status || 'Agendada',
      observacoes: match.observacoes || ''
    }
  });

  const onSubmit = async (data: any) => {
    try {
      await api.put(`/partidas/${match.id_partida}`, {
        placar_casa: parseInt(data.placar_casa),
        placar_visitante: parseInt(data.placar_visitante),
        status: data.status,
        observacoes: data.observacoes || null
      });
      alert('Resultado salvo com sucesso!');
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Erro ao registrar resultado.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100 relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X /></button>
        <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><Trophy className="text-amber-500" /> Registrar Placar</h2>
        <p className="text-xs text-slate-500 mb-6">Partida #{match.id_partida} - {match.fase}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* Placar */}
          <div className="flex items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex-1 text-center">
              <label className="text-xs font-bold text-slate-500 block mb-1 truncate">{match.equipe_casa?.nome || 'Casa'}</label>
              <input type="number" min={0} {...register('placar_casa', { required: true })} className="w-16 text-center font-black text-xl bg-white border border-slate-200 rounded-lg py-1.5" />
            </div>
            
            <span className="font-black text-slate-400 text-sm">X</span>
            
            <div className="flex-1 text-center">
              <label className="text-xs font-bold text-slate-500 block mb-1 truncate">{match.equipe_visitante?.nome || 'Visitante'}</label>
              <input type="number" min={0} {...register('placar_visitante', { required: true })} className="w-16 text-center font-black text-xl bg-white border border-slate-200 rounded-lg py-1.5" />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Status da Partida</label>
            <select {...register('status', { required: true })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
              <option value="Agendada">Agendada</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Finalizada">Finalizada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Notas / Obs</label>
            <textarea {...register('observacoes')} rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs" placeholder="Ex: Decidido nos pênaltis." />
          </div>

          <div className="flex gap-3 pt-6">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100">Salvar Resultado</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal Súmula (Upload de PDF/Imagem)
function ModalSumula({ match, onClose, onSuccess }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      // Validar extensão
      const ext = selected.name.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext || '')) {
        alert('Tipo de arquivo inválido. Apenas imagens (.jpg, .png) ou PDF (.pdf) são aceitos.');
        return;
      }
      setFile(selected);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await api.post(`/partidas/${match.id_partida}/sumula`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Súmula enviada com sucesso!');
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Erro ao enviar súmula.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100 relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X /></button>
        <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><FileText className="text-amber-500" /> Súmula da Partida</h2>
        <p className="text-xs text-slate-500 mb-6">Partida #{match.id_partida}</p>

        <div className="space-y-6">
          {match.sumula_arquivo && (
            <div className="bg-green-50 border border-green-150 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600" size={18} />
                <span className="text-xs font-bold text-green-700">Arquivo de Súmula Existente</span>
              </div>
              <a 
                href={api.defaults.baseURL + match.sumula_arquivo} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Download size={14} /> Download
              </a>
            </div>
          )}

          <div className="border-2 border-dashed border-slate-200 p-6 rounded-2xl text-center hover:bg-slate-50 transition-colors relative">
            <input 
              type="file" 
              accept=".jpg,.jpeg,.png,.pdf" 
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />
            <p className="text-xs font-semibold text-slate-600">Arraste ou clique para selecionar arquivo</p>
            <p className="text-[10px] text-slate-400 mt-1">Imagens (JPG, PNG) ou PDF de até 5MB</p>
            
            {file && (
              <p className="mt-3 text-xs font-bold text-blue-600 bg-blue-50 py-1.5 px-3 rounded-lg truncate max-w-xs mx-auto">
                {file.name}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600">Cancelar</button>
            <button 
              onClick={handleUpload}
              disabled={!file || isUploading} 
              className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-100 disabled:opacity-50"
            >
              {isUploading ? 'Enviando...' : 'Enviar Súmula'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal Estatísticas da Partida (Gols, Assistências, Cartões)
function ModalEstatisticas({ match, onClose }: any) {
  // SWR para pegar estatísticas da partida
  const { data: stats, mutate: mutateStats } = useSWR(`/partidas/${match.id_partida}/estatisticas`, fetcher);
  
  // Buscar participantes das equipes participantes da partida para listagem
  const { data: teamCasa } = useSWR(match.id_equipe_casa ? `/equipes/${match.id_equipe_casa}` : null, fetcher);
  const { data: teamVisitante } = useSWR(match.id_equipe_visitante ? `/equipes/${match.id_equipe_visitante}` : null, fetcher);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      id_participante: '',
      gols: 0,
      assistencias: 0,
      cartoes_amarelos: 0,
      cartoes_vermelhos: 0
    }
  });

  // Consolidar jogadores da partida
  const playersList = useMemo(() => {
    const list: any[] = [];
    if (teamCasa?.participantes) {
      teamCasa.participantes.forEach((p: any) => {
        list.push({
          id_participante: p.id_participante,
          nome: p.aluno?.nome_completo || p.atleta?.nome_completo || 'Jogador sem nome',
          equipe: teamCasa.nome
        });
      });
    }
    if (teamVisitante?.participantes) {
      teamVisitante.participantes.forEach((p: any) => {
        list.push({
          id_participante: p.id_participante,
          nome: p.aluno?.nome_completo || p.atleta?.nome_completo || 'Jogador sem nome',
          equipe: teamVisitante.nome
        });
      });
    }
    return list;
  }, [teamCasa, teamVisitante]);

  const handleAddStat = async (data: any) => {
    try {
      await api.post(`/partidas/${match.id_partida}/estatisticas`, {
        id_participante: parseInt(data.id_participante),
        gols: parseInt(data.gols),
        assistencias: parseInt(data.assistencias),
        cartoes_amarelos: parseInt(data.cartoes_amarelos),
        cartoes_vermelhos: parseInt(data.cartoes_vermelhos)
      });
      mutateStats();
      reset();
      alert('Estatística registrada!');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Erro ao registrar estatística.');
    }
  };

  const handleDeleteStat = async (idStat: number) => {
    if (confirm('Remover registro de estatística?')) {
      try {
        await api.delete(`/partidas/${match.id_partida}/estatisticas/${idStat}`);
        mutateStats();
      } catch (error) {
        alert('Erro ao deletar.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 my-8 animate-in zoom-in-95 border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X /></button>
        <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><Users className="text-blue-500" /> Estatísticas e Ações do Jogo</h2>
        <p className="text-xs text-slate-500 mb-6">Registre gols, cartões e assistências para os atletas desta partida.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Formulário Novo Registro */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-700 text-sm border-b pb-1.5">Lançar Ação</h3>
            <form onSubmit={handleSubmit(handleAddStat)} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Atleta</label>
                <select {...register('id_participante', { required: true })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                  <option value="">Selecione...</option>
                  {playersList.map((p) => (
                    <option key={p.id_participante} value={p.id_participante}>{p.nome} ({p.equipe})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Gols</label>
                  <input type="number" min={0} {...register('gols', { required: true })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Assistências</label>
                  <input type="number" min={0} {...register('assistencias', { required: true })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">C. Amarelo</label>
                  <input type="number" min={0} max={2} {...register('cartoes_amarelos', { required: true })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">C. Vermelho</label>
                  <input type="number" min={0} max={1} {...register('cartoes_vermelhos', { required: true })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-50 mt-4"
              >
                Registrar Evento
              </button>
            </form>
          </div>

          {/* Lista de Registros Cadastrados */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-700 text-sm border-b pb-1.5">Resumo de Ações</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {stats?.map((st: any) => {
                const atletaNome = st.participante?.aluno?.nome_completo || st.participante?.atleta?.nome_completo || 'Atleta';
                return (
                  <div key={st.id_estatistica} className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{atletaNome}</p>
                      <div className="flex gap-2 text-[10px] text-slate-500 mt-1">
                        {st.gols > 0 && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-black">{st.gols} Gols</span>}
                        {st.assistencias > 0 && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-black">{st.assistencias} Ast</span>}
                        {st.cartoes_amarelos > 0 && <span className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-black">{st.cartoes_amarelos} CA</span>}
                        {st.cartoes_vermelhos > 0 && <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-black">{st.cartoes_vermelhos} CV</span>}
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleDeleteStat(st.id_estatistica)}
                      className="text-slate-300 hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}

              {stats?.length === 0 && (
                <p className="text-center text-slate-400 italic text-xs py-8">Nenhuma ação de gol ou cartão cadastrada para esta partida.</p>
              )}
            </div>
          </div>

        </div>

        <div className="flex justify-end pt-6 mt-6 border-t border-slate-100">
          <button onClick={onClose} className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-xl text-xs">Fechar Painel</button>
        </div>

      </div>
    </div>
  );
}
