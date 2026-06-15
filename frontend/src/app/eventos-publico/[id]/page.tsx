'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Users, 
  ArrowLeft, 
  Trophy, 
  Calendar, 
  Dumbbell, 
  Eye, 
  Loader2, 
  AlertTriangle,
  Award,
  ChevronRight,
  Sun,
  Moon,
  FileText,
  Download,
  MapPin,
  User,
  SlidersHorizontal
} from 'lucide-react';
import useSWR from 'swr';
import api from '@/lib/api';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';

const fetcher = (url: string) => api.get(url).then(res => res.data);
const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function DetalhesEventoPublicoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { theme, toggleTheme } = useTheme();

  // Estados
  const [activeTab, setActiveTab] = useState<'partidas' | 'equipes' | 'estatisticas'>('partidas');
  const [selectedModalidadeId, setSelectedModalidadeId] = useState<string>('');
  const [roundFilter, setRoundFilter] = useState<string>('');
  const [partidasSubTab, setPartidasSubTab] = useState<'confrontos' | 'tabela' | 'arvore'>('confrontos');
  const [activeEdicaoId, setActiveEdicaoId] = useState<number | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);

  // Fetch Evento e Edições
  const { data: evento, error: errorEvento, isLoading: isLoadingEvento } = useSWR(id ? `/publico/eventos/${id}` : null, fetcher);
  const { data: todasEdicoes, isLoading: isLoadingEdicoes } = useSWR('/publico/edicoes', fetcher);

  // Filtrar edições deste evento
  const edicoes = useMemo(() => {
    if (!todasEdicoes || !Array.isArray(todasEdicoes)) return [];
    return todasEdicoes
      .filter((e: any) => e.id_evento === parseInt(id))
      .sort((a: any, b: any) => (b.edic_ano || 0) - (a.edic_ano || 0));
  }, [todasEdicoes, id]);

  // Definir edição ativa padrão
  useEffect(() => {
    if (edicoes.length > 0 && !activeEdicaoId) {
      setActiveEdicaoId(edicoes[0].id_edicao);
    }
  }, [edicoes, activeEdicaoId]);

  // Edição ativa
  const activeEdicao = useMemo(() => {
    return edicoes.find((e: any) => e.id_edicao === activeEdicaoId) || null;
  }, [edicoes, activeEdicaoId]);

  // Fetch equipes, partidas e estatísticas da edição ativa
  const { data: equipes, isLoading: loadingEquipes } = useSWR(
    activeEdicaoId ? `/publico/edicoes/${activeEdicaoId}/equipes` : null, 
    fetcher
  );
  const { data: matches, isLoading: loadingMatches } = useSWR(
    activeEdicaoId ? `/publico/edicoes/${activeEdicaoId}/partidas` : null, 
    fetcher
  );
  const { data: stats, isLoading: loadingStats } = useSWR(
    activeEdicaoId ? `/publico/edicoes/${activeEdicaoId}/estatisticas` : null, 
    fetcher
  );

  // Auto-selecionar a primeira modalidade
  useEffect(() => {
    if (evento?.modalidades && evento.modalidades.length > 0 && !selectedModalidadeId) {
      setSelectedModalidadeId(evento.modalidades[0].id_modalidade.toString());
    }
  }, [evento, selectedModalidadeId]);

  // Lista de partidas filtradas pela modalidade
  const filteredMatches = useMemo(() => {
    if (!matches || !selectedModalidadeId) return [];
    return matches.filter((m: any) => m.id_modalidade === parseInt(selectedModalidadeId));
  }, [matches, selectedModalidadeId]);

  // Extrair rodadas para campeonato de Pontos Corridos
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

  // Auto-selecionar primeira rodada
  useEffect(() => {
    if (rounds.length > 0) {
      setRoundFilter(rounds[0]);
    } else {
      setRoundFilter('');
    }
  }, [rounds]);

  // Tabela de Classificação
  const classificationTable = useMemo(() => {
    if (!equipes || !filteredMatches) return [];
    
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

    const list = Object.values(statsMap).map((team: any) => {
      team.saldoGols = team.golsPro - team.golsContra;
      return team;
    });

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

  const phasesToShow = useMemo(() => {
    const allPhases = ['Oitavas', 'Quartas', 'Semifinal', 'Final'];
    const startIdx = allPhases.indexOf(activeEdicao?.fase_inicial || 'Oitavas');
    return startIdx !== -1 ? allPhases.slice(startIdx) : allPhases;
  }, [activeEdicao?.fase_inicial]);

  // Agregar Estatísticas / Leaderboards
  const leaderboards = useMemo(() => {
    if (!stats || !Array.isArray(stats)) return { scorers: [], assists: [], cards: [] };

    const players: Record<string, { nome: string; gols: number; assistencias: number; amarelos: number; vermelhos: number }> = {};

    stats.forEach((s: any) => {
      const nome = s.nome_jogador;
      if (!players[nome]) {
        players[nome] = { nome, gols: 0, assistencias: 0, amarelos: 0, vermelhos: 0 };
      }
      players[nome].gols += s.gols || 0;
      players[nome].assistencias += s.assistencias || 0;
      players[nome].amarelos += s.cartoes_amarelos || 0;
      players[nome].vermelhos += s.cartoes_vermelhos || 0;
    });

    const list = Object.values(players);

    const scorers = [...list].filter(p => p.gols > 0).sort((a, b) => b.gols - a.gols);
    const assists = [...list].filter(p => p.assistencias > 0).sort((a, b) => b.assistencias - a.assistencias);
    const cards = [...list].filter(p => p.amarelos > 0 || p.vermelhos > 0).sort((a, b) => (b.vermelhos * 3 + b.amarelos) - (a.vermelhos * 3 + a.amarelos));

    return { scorers, assists, cards };
  }, [stats]);

  if (isLoadingEvento || isLoadingEdicoes) {
    return <div className="flex justify-center p-20 min-h-screen items-center"><Loader2 className="animate-spin text-blue-600" size={48}/></div>;
  }

  if (errorEvento || !evento) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-red-500 bg-slate-50 dark:bg-slate-900">
        <AlertTriangle size={48} className="mb-4" />
        <h2 className="text-xl font-bold">Evento esportivo não encontrado</h2>
        <button onClick={() => router.push('/')} className="mt-4 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md cursor-pointer">Voltar ao Portal</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 sticky top-0 z-15 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-xl text-slate-500 dark:text-slate-400 transition-colors cursor-pointer">
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            GE
          </div>
          <div>
            <h1 className="font-bold text-slate-850 dark:text-slate-100 text-sm leading-none">{evento.even_nome}</h1>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Visualização Pública</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            title="Alterar Tema"
          >
            {theme === 'dark' ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} />}
          </button>

          <Link href="/login">
            <button className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer">
              Área Administrativa
            </button>
          </Link>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-in fade-in duration-300">
        
        {/* Info card & Season Selector */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
              {evento.even_nome}
              <Trophy className="text-amber-500 animate-pulse" size={24} />
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{evento.descricao || 'Campeonato esportivo oficial.'}</p>
          </div>

          <div className="flex items-center gap-3">
            {edicoes.length > 0 ? (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Edição:</span>
                <select
                  value={activeEdicaoId || ''}
                  onChange={(e) => setActiveEdicaoId(parseInt(e.target.value))}
                  className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-sm outline-none cursor-pointer"
                >
                  {edicoes.map((e: any) => (
                    <option key={e.id_edicao} value={e.id_edicao}>Edição {e.edic_ano}</option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3 py-1.5 rounded-xl">
                Nenhuma Edição cadastrada
              </span>
            )}
          </div>
        </div>

        {activeEdicao ? (
          <div className="space-y-6">
            {/* Format info bar */}
            <div className="bg-slate-100/50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/40 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Formato: <strong className="text-slate-800 dark:text-slate-200">{activeEdicao.tipo_competicao}</strong>{activeEdicao.tipo_competicao === 'Mata-Mata' && ` (Fase inicial: ${activeEdicao.fase_inicial})`}</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>Vigência: <strong className="text-slate-800 dark:text-slate-200">{new Date(activeEdicao.data_inicio).toLocaleDateString()} a {new Date(activeEdicao.data_fim).toLocaleDateString()}</strong></span>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => setActiveTab('partidas')}
                className={`px-6 py-3.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'partidas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-650 dark:hover:text-slate-300'}`}
              >
                <Trophy size={18} />
                Jogos e Classificação
              </button>
              <button 
                onClick={() => setActiveTab('equipes')}
                className={`px-6 py-3.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'equipes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-650 dark:hover:text-slate-300'}`}
              >
                <Users size={18} />
                Equipes ({equipes?.length || 0})
              </button>
              <button 
                onClick={() => setActiveTab('estatisticas')}
                className={`px-6 py-3.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'estatisticas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-650 dark:hover:text-slate-300'}`}
              >
                <Award size={18} />
                Artilharia e Stats
              </button>
            </div>

            {/* Content Switcher */}

            {/* --- TAB JOGOS E CLASSIFICAÇÃO --- */}
            {activeTab === 'partidas' && (
              <div className="space-y-6">
                {/* Modalidade filter bar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {evento.modalidades?.map((m: any) => (
                      <button
                        key={m.id_modalidade}
                        onClick={() => setSelectedModalidadeId(m.id_modalidade.toString())}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${selectedModalidadeId === m.id_modalidade.toString() ? 'bg-blue-600 text-white shadow-md shadow-blue-100 dark:shadow-none' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                      >
                        {m.nome}
                      </button>
                    ))}
                  </div>

                  <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    <button
                      onClick={() => setPartidasSubTab('confrontos')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${partidasSubTab === 'confrontos' ? 'bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-705'}`}
                    >
                      Confrontos
                    </button>
                    {activeEdicao.tipo_competicao === 'Pontos Corridos' && (
                      <button
                        onClick={() => setPartidasSubTab('tabela')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${partidasSubTab === 'tabela' ? 'bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-705'}`}
                      >
                        Tabela de Classificação
                      </button>
                    )}
                    {activeEdicao.tipo_competicao === 'Mata-Mata' && (
                      <button
                        onClick={() => setPartidasSubTab('arvore')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${partidasSubTab === 'arvore' ? 'bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-705'}`}
                      >
                        Chave do Torneio
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub Tab: Confrontos (Rounds & Matches List) */}
                {partidasSubTab === 'confrontos' && (
                  <div className="space-y-6">
                    {activeEdicao.tipo_competicao === 'Pontos Corridos' && rounds.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 dark:border-slate-700/30">
                        {rounds.map((r: string) => (
                          <button
                            key={r}
                            onClick={() => setRoundFilter(r)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${roundFilter === r ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                      {filteredMatches
                        .filter((m: any) => activeEdicao.tipo_competicao !== 'Pontos Corridos' || !roundFilter || m.fase === roundFilter)
                        .map((match: any) => (
                          <PublicMatchCard key={match.id_partida} match={match} />
                        ))}

                      {filteredMatches.length === 0 && (
                        <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                          <Calendar size={48} className="mx-auto text-slate-350 mb-4" />
                          <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum confronto agendado nesta modalidade.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub Tab: Tabela (Points League Table) */}
                {partidasSubTab === 'tabela' && (
                  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {classificationTable.map((team: any, index: number) => (
                            <tr key={team.id_equipe} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                              <td className="py-4 px-6 text-center font-bold">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${index === 0 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' : index === 1 ? 'bg-slate-200 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400' : index === 2 ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' : 'bg-slate-50 dark:bg-slate-900 text-slate-500'}`}>
                                  {index + 1}
                                </span>
                              </td>
                              <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-100">{team.nome}</td>
                              <td className="py-4 px-6 text-center text-blue-600 dark:text-blue-400 font-extrabold">{team.pontos}</td>
                              <td className="py-4 px-6 text-center">{team.jogos}</td>
                              <td className="py-4 px-6 text-center text-green-600 dark:text-green-400">{team.vitorias}</td>
                              <td className="py-4 px-6 text-center text-slate-500">{team.empates}</td>
                              <td className="py-4 px-6 text-center text-red-500">{team.derrotas}</td>
                              <td className="py-4 px-6 text-center">{team.golsPro}</td>
                              <td className="py-4 px-6 text-center">{team.golsContra}</td>
                              <td className={`py-4 px-6 text-center font-extrabold ${team.saldoGols > 0 ? 'text-green-600' : team.saldoGols < 0 ? 'text-red-500' : 'text-slate-500'}`}>{team.saldoGols}</td>
                            </tr>
                          ))}
                          
                          {classificationTable.length === 0 && (
                            <tr>
                              <td colSpan={10} className="py-12 text-center text-slate-450 italic font-normal">Nenhuma equipe para classificar.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sub Tab: Arvore (Knockout Bracket Tree) */}
                {partidasSubTab === 'arvore' && (
                  <div className="flex gap-8 overflow-x-auto pb-6 pt-4 items-center justify-start min-h-[400px]">
                    {phasesToShow.map((fase) => {
                      const faseMatches = bracketPhases[fase] || [];

                      return (
                        <div key={fase} className="flex flex-col gap-8 w-64 flex-shrink-0">
                          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest text-center border-b border-slate-100 dark:border-slate-750 pb-2">
                            {fase === 'Final' ? 'Grande Final' : fase}
                          </h3>

                          <div className="flex flex-col gap-6 justify-around flex-grow">
                            {faseMatches.map((m: any) => (
                              <div key={m.id_partida} className="bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="text-[10px] text-slate-400 font-bold mb-2">
                                  {m.part_data ? new Date(m.part_data).toLocaleDateString() : 'A agendar'}
                                </div>
                                <div className="space-y-2.5">
                                  <div className={`flex justify-between items-center ${m.status === 'Finalizada' && m.placar_casa > m.placar_visitante ? 'font-extrabold text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>
                                    <span className="truncate pr-2">{m.equipe_casa?.nome || 'A definir'}</span>
                                    <span className="bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded font-mono text-sm">{m.status === 'Finalizada' ? m.placar_casa : '-'}</span>
                                  </div>
                                  <div className={`flex justify-between items-center ${m.status === 'Finalizada' && m.placar_visitante > m.placar_casa ? 'font-extrabold text-slate-800 dark:text-slate-100' : 'text-slate-500'}`}>
                                    <span className="truncate pr-2">{m.equipe_visitante?.nome || 'A definir'}</span>
                                    <span className="bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded font-mono text-sm">{m.status === 'Finalizada' ? m.placar_visitante : '-'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            {faseMatches.length === 0 && (
                              <div className="text-center text-slate-400 italic text-xs py-8 bg-slate-50/40 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-100 dark:border-slate-750">
                                Aguardando definição
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* --- TAB EQUIPES --- */}
            {activeTab === 'equipes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {equipes?.map((eq: any) => {
                  const isExpanded = expandedTeamId === eq.id_equipe;
                  
                  return (
                    <div 
                      key={eq.id_equipe} 
                      className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center">
                            <Trophy size={22} />
                          </div>
                          <span className="text-xs font-bold text-slate-450 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-lg">
                            {eq.jogadores?.length || 0} Atletas
                          </span>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{eq.nome}</h3>
                          <p className="text-xs text-slate-400 mt-1">Equipe Oficial</p>
                        </div>

                        {/* List of Players Names only! */}
                        {isExpanded && (
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-700/40 space-y-2 max-h-60 overflow-y-auto pr-1 animate-in fade-in duration-200">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Elenco Inscrito:</h4>
                            {eq.jogadores && eq.jogadores.length > 0 ? (
                              <ul className="space-y-1.5">
                                {eq.jogadores.map((jg: any) => (
                                  <li key={jg.id_participante} className="text-xs font-semibold text-slate-600 dark:text-slate-350 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                    {jg.nome_completo}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-450 italic">Sem atletas inscritos.</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-6">
                        <button
                          onClick={() => setExpandedTeamId(isExpanded ? null : eq.id_equipe)}
                          className="w-full py-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye size={14} />
                          {isExpanded ? 'Ocultar Jogadores' : 'Visualizar Jogadores'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {equipes?.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <Users size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhuma equipe inscrita nesta temporada.</p>
                  </div>
                )}
              </div>
            )}

            {/* --- TAB ESTATISTICAS / LEADERBOARDS --- */}
            {activeTab === 'estatisticas' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Column: Artilharia (Scorers) */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700/40 pb-4">
                    <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center">
                      <Award size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Artilharia</h3>
                      <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wide">Gols marcados</p>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {leaderboards.scorers.map((p: any, idx: number) => (
                      <div key={p.nome} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-750/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`text-xs font-bold w-5 text-center ${idx === 0 ? 'text-amber-500' : 'text-slate-450'}`}>{idx + 1}º</span>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{p.nome}</p>
                        </div>
                        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-xl">{p.gols} <span className="text-[10px] font-bold text-slate-400">G</span></span>
                      </div>
                    ))}

                    {leaderboards.scorers.length === 0 && (
                      <p className="text-center text-slate-450 italic text-xs py-8">Nenhum gol registrado.</p>
                    )}
                  </div>
                </div>

                {/* Column: Assistências (Assists) */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700/40 pb-4">
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center">
                      <Award size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Assistências</h3>
                      <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wide">Passes para gol</p>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {leaderboards.assists.map((p: any, idx: number) => (
                      <div key={p.nome} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-750/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`text-xs font-bold w-5 text-center ${idx === 0 ? 'text-indigo-500' : 'text-slate-450'}`}>{idx + 1}º</span>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{p.nome}</p>
                        </div>
                        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-xl">{p.assistencias} <span className="text-[10px] font-bold text-slate-400">A</span></span>
                      </div>
                    ))}

                    {leaderboards.assists.length === 0 && (
                      <p className="text-center text-slate-450 italic text-xs py-8">Nenhuma assistência registrada.</p>
                    )}
                  </div>
                </div>

                {/* Column: Cartões (Cards) */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700/40 pb-4">
                    <div className="w-10 h-10 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Cartões</h3>
                      <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wide">Faltas e advertências</p>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {leaderboards.cards.map((p: any, idx: number) => (
                      <div key={p.nome} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-750/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold w-5 text-center text-slate-450">{idx + 1}º</span>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{p.nome}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {p.amarelos > 0 && (
                            <span className="text-xs font-extrabold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                              {p.amarelos}🟨
                            </span>
                          )}
                          {p.vermelhos > 0 && (
                            <span className="text-xs font-extrabold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                              {p.vermelhos}🟥
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {leaderboards.cards.length === 0 && (
                      <p className="text-center text-slate-450 italic text-xs py-8">Nenhum cartão registrado.</p>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>
        ) : (
          <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <Calendar size={48} className="mx-auto text-slate-350 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhuma edição ativa cadastrada para esta competição.</p>
          </div>
        )}

      </main>
    </div>
  );
}

// Simplified match card for visitors
function PublicMatchCard({ match }: { match: any }) {
  const dataFormatada = new Date(match.part_data).toLocaleDateString();

  const statusColors: Record<string, string> = {
    Agendada: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    'Em Andamento': 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    Finalizada: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
    Cancelada: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:shadow-md transition-shadow">
      <div className="flex-1 flex items-center justify-center lg:justify-start gap-6">
        <div className="text-right w-40 truncate font-bold text-slate-700 dark:text-slate-200">
          {match.equipe_casa?.nome || <span className="text-slate-450 font-normal italic">A definir</span>}
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-750 px-4 py-1.5 rounded-2xl">
          <span className="font-mono text-xl font-extrabold text-slate-800 dark:text-slate-100 w-6 text-center">
            {match.status === 'Agendada' ? '-' : match.placar_casa}
          </span>
          <span className="text-xs text-slate-400 font-bold">X</span>
          <span className="font-mono text-xl font-extrabold text-slate-800 dark:text-slate-100 w-6 text-center">
            {match.status === 'Agendada' ? '-' : match.placar_visitante}
          </span>
        </div>

        <div className="text-left w-40 truncate font-bold text-slate-700 dark:text-slate-200">
          {match.equipe_visitante?.nome || <span className="text-slate-450 font-normal italic">A definir</span>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1">
          <Calendar size={14} />
          <span className="font-semibold">{dataFormatada} às {match.part_hora.substring(0, 5)}</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin size={14} />
          <span className="font-semibold">{match.local?.loca_nome}</span>
        </div>
        <div className="flex items-center gap-1">
          <User size={14} />
          <span className="font-semibold">Apito: {match.arbitro?.apito_nome}</span>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase ${statusColors[match.status]}`}>
          {match.status}
        </span>
        
        {/* PDF Download sheet button if present */}
        {match.sumula_arquivo && (
          <a
            href={`${apiURL}/uploads/${match.sumula_arquivo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-105 dark:bg-slate-750 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition-colors border border-slate-150 dark:border-slate-700 cursor-pointer"
            title="Download da Súmula Oficial"
          >
            <FileText size={14} />
            Súmula
          </a>
        )}
      </div>
    </div>
  );
}
