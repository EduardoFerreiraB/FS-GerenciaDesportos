'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Trophy,
  Calendar,
  Layers,
  Users,
  Swords,
  BarChart3,
  Loader2,
  AlertTriangle,
  RotateCw,
  Clock,
  CheckCircle2,
  Shield,
  Medal,
} from 'lucide-react';
import { CompeticaoV2, ConfrontoV2, ClassificacaoEquipeItem } from '@/types/competicoesV2';
import { competicoesV2Service } from '@/services/competicoesV2';
import GestaoEquipesElencos from '@/components/competicoes-v2/GestaoEquipesElencos';
import TabelaJogosConfrontos from '@/components/competicoes-v2/TabelaJogosConfrontos';
import ArvoreMataMataV2 from '@/components/competicoes-v2/ArvoreMataMataV2';
import ArtilhariaCartoes from '@/components/competicoes-v2/ArtilhariaCartoes';

type AbaPainel = 'EQUIPES' | 'JOGOS' | 'CLASSIFICACAO' | 'ESTATISTICAS';

export default function DetalhesCompeticaoV2Page() {
  const router = useRouter();
  const params = useParams();
  const idStr = params.id as string;
  const idCompeticao = Number(idStr);

  const [competicao, setCompeticao] = useState<CompeticaoV2 | null>(null);
  const [confrontos, setConfrontos] = useState<ConfrontoV2[]>([]);
  const [classificacao, setClassificacao] = useState<any>(null);
  const [abaAtiva, setAbaAtiva] = useState<AbaPainel>('EQUIPES');

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    if (!idCompeticao || isNaN(idCompeticao)) return;
    setLoading(true);
    setErro(null);

    try {
      const [comp, confs, classif] = await Promise.all([
        competicoesV2Service.obterCompeticao(idCompeticao),
        competicoesV2Service.listarConfrontos(idCompeticao).catch(() => []),
        competicoesV2Service.obterClassificacao(idCompeticao).catch(() => null),
      ]);

      setCompeticao(comp);
      setConfrontos(confs);
      setClassificacao(classif);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao carregar os dados da competição.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [idCompeticao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const renderBadgeStatus = (status: string) => {
    switch (status) {
      case 'EM_ANDAMENTO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            Em Andamento
          </span>
        );
      case 'FINALIZADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} />
            Finalizada
          </span>
        );
      case 'ABERTA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
            <Clock size={13} />
            Inscrições Abertas
          </span>
        );
      case 'CANCELADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
            Cancelada
          </span>
        );
      case 'RASCUNHO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
            Rascunho
          </span>
        );
    }
  };

  const renderFormatoNome = (fmt: string) => {
    switch (fmt) {
      case 'PONTOS_CORRIDOS':
        return 'Pontos Corridos';
      case 'GRUPOS_MATA_MATA':
        return 'Fase de Grupos + Mata-Mata';
      case 'MATA_MATA':
        return 'Mata-Mata Direto';
      default:
        return fmt;
    }
  };

  if (loading && !competicao) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 size={44} className="animate-spin text-blue-600" />
        <p className="text-slate-500 text-sm font-medium">Carregando painel da competição...</p>
      </div>
    );
  }

  if (erro && !competicao) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-4">
          <AlertTriangle size={48} className="mx-auto text-rose-600" />
          <h2 className="text-xl font-bold text-rose-900">Não foi possível carregar a competição</h2>
          <p className="text-sm text-rose-700 max-w-md mx-auto">{erro}</p>
          <button
            onClick={() => router.push('/dashboard/competicoes')}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
            Voltar para Competições
          </button>
        </div>
      </div>
    );
  }

  if (!competicao) return null;

  const temMataMata =
    competicao.formato === 'MATA_MATA' ||
    competicao.formato === 'GRUPOS_MATA_MATA';

  return (
    <div className="space-y-8 pb-16">
      {/* Botão Voltar & Cabeçalho Principal */}
      <div className="space-y-4">
        <button
          onClick={() => router.push('/dashboard/competicoes')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Voltar para Lista de Competições
        </button>

        {/* Hero Card da Competição */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                {renderBadgeStatus(competicao.status)}

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/90 border border-white/15">
                  {renderFormatoNome(competicao.formato)}
                </span>

                {competicao.modalidade?.nome && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/20">
                    {competicao.modalidade.nome}
                  </span>
                )}

                {competicao.categoria && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-200 border border-purple-400/20">
                    {competicao.categoria}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {competicao.nome}
              </h1>

              {competicao.grupo?.nome && (
                <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold">
                  <Trophy size={14} className="text-indigo-400" />
                  <span>Evento Vinculado: {competicao.grupo.nome}</span>
                </div>
              )}
            </div>

            {/* Ações Rápidas do Cabeçalho */}
            <div className="flex items-center gap-3 self-start md:self-center">
              <button
                onClick={carregarDados}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all cursor-pointer backdrop-blur-sm"
                title="Recarregar dados"
              >
                <RotateCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Abas do Painel */}
      <div className="bg-white rounded-3xl border border-slate-100 p-2 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => setAbaAtiva('EQUIPES')}
            className={`py-3.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              abaAtiva === 'EQUIPES'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users size={16} />
            Equipes & Elencos
          </button>

          <button
            onClick={() => setAbaAtiva('JOGOS')}
            className={`py-3.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              abaAtiva === 'JOGOS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Swords size={16} />
            Tabela de Jogos
            {confrontos.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                abaAtiva === 'JOGOS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {confrontos.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setAbaAtiva('CLASSIFICACAO')}
            className={`py-3.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              abaAtiva === 'CLASSIFICACAO'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers size={16} />
            Classificação & Chaveamento
          </button>

          <button
            onClick={() => setAbaAtiva('ESTATISTICAS')}
            className={`py-3.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              abaAtiva === 'ESTATISTICAS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BarChart3 size={16} />
            Artilharia & Disciplinar
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div>
        {abaAtiva === 'EQUIPES' && (
          <GestaoEquipesElencos
            idCompeticao={idCompeticao}
            formato={competicao.formato}
          />
        )}

        {abaAtiva === 'JOGOS' && (
          <TabelaJogosConfrontos
            idCompeticao={idCompeticao}
            statusCompeticao={competicao.status}
            onConfrontosAtualizados={carregarDados}
          />
        )}

        {abaAtiva === 'CLASSIFICACAO' && (
          <div className="space-y-8">
            {/* Tabela de Pontos Corridos / Grupos */}
            {classificacao && (
              <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Trophy size={18} className="text-amber-500" />
                  Tabela de Classificação
                </h3>

                {/* Se tiver grupos separados */}
                {classificacao.grupos ? (
                  <div className="space-y-6">
                    {Object.entries(classificacao.grupos).map(([grupoNome, times]: [string, any]) => (
                      <div key={grupoNome} className="space-y-2">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                          Grupo {grupoNome}
                        </h4>
                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                                <th className="py-3 px-3 text-center w-12">Pos</th>
                                <th className="py-3 px-4">Equipe</th>
                                <th className="py-3 px-3 text-center">PTS</th>
                                <th className="py-3 px-3 text-center">J</th>
                                <th className="py-3 px-3 text-center">V</th>
                                <th className="py-3 px-3 text-center">E</th>
                                <th className="py-3 px-3 text-center">D</th>
                                <th className="py-3 px-3 text-center">GP</th>
                                <th className="py-3 px-3 text-center">GC</th>
                                <th className="py-3 px-3 text-center">SG</th>
                                <th className="py-3 px-3 text-center">%</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {times.map((item: ClassificacaoEquipeItem, idx: number) => (
                                <tr key={item.id_equipe} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                                    {item.posicao || idx + 1}º
                                  </td>
                                  <td className="py-2.5 px-4 font-bold text-slate-800 flex items-center gap-2">
                                    {item.nome_equipe}
                                    {item.classificado && (
                                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Classificado
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-black text-blue-700 bg-blue-50/30">
                                    {item.pontos}
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-slate-600">{item.jogos}</td>
                                  <td className="py-2.5 px-3 text-center text-slate-600">{item.vitorias}</td>
                                  <td className="py-2.5 px-3 text-center text-slate-600">{item.empates}</td>
                                  <td className="py-2.5 px-3 text-center text-slate-600">{item.derrotas}</td>
                                  <td className="py-2.5 px-3 text-center text-slate-600">{item.gols_pro}</td>
                                  <td className="py-2.5 px-3 text-center text-slate-600">{item.gols_contra}</td>
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-700">{item.saldo_gols}</td>
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-600">{item.aproveitamento}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(classificacao.tabela || classificacao.classificacao) ? (
                  /* Tabela única de pontos corridos */
                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                          <th className="py-3 px-3 text-center w-12">Pos</th>
                          <th className="py-3 px-4">Equipe</th>
                          <th className="py-3 px-3 text-center">PTS</th>
                          <th className="py-3 px-3 text-center">J</th>
                          <th className="py-3 px-3 text-center">V</th>
                          <th className="py-3 px-3 text-center">E</th>
                          <th className="py-3 px-3 text-center">D</th>
                          <th className="py-3 px-3 text-center">GP</th>
                          <th className="py-3 px-3 text-center">GC</th>
                          <th className="py-3 px-3 text-center">SG</th>
                          <th className="py-3 px-3 text-center">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(classificacao.tabela || classificacao.classificacao).map((item: ClassificacaoEquipeItem, idx: number) => (
                          <tr key={item.id_equipe} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                              {item.posicao || idx + 1}º
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-800">
                              {item.nome_equipe}
                            </td>
                            <td className="py-2.5 px-3 text-center font-black text-blue-700 bg-blue-50/30">
                              {item.pontos}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600">{item.jogos}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600">{item.vitorias}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600">{item.empates}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600">{item.derrotas}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600">{item.gols_pro}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600">{item.gols_contra}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">{item.saldo_gols}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-600">{item.aproveitamento}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Aguardando encerramento dos primeiros jogos para apuração da tabela.
                  </p>
                )}
              </div>
            )}

            {/* Árvore Mata-Mata se aplicável */}
            {temMataMata && (
              <div className="space-y-4">
                <ArvoreMataMataV2 confrontos={confrontos} />
              </div>
            )}
          </div>
        )}

        {abaAtiva === 'ESTATISTICAS' && (
          <ArtilhariaCartoes idCompeticao={idCompeticao} />
        )}
      </div>
    </div>
  );
}
