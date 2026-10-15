'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  RotateCw,
  Search,
  User,
  Shield,
} from 'lucide-react';
import { ArtilheiroItem, DisciplinarItem } from '@/types/competicoesV2';
import { competicoesV2Service } from '@/services/competicoesV2';

interface ArtilhariaCartoesProps {
  idCompeticao: number;
}

export default function ArtilhariaCartoes({ idCompeticao }: ArtilhariaCartoesProps) {
  const [abaAtiva, setAbaAtiva] = useState<'ARTILHARIA' | 'DISCIPLINAR'>('ARTILHARIA');
  const [artilheiros, setArtilheiros] = useState<ArtilheiroItem[]>([]);
  const [disciplinar, setDisciplinar] = useState<DisciplinarItem[]>([]);
  const [suspensos, setSuspensos] = useState<DisciplinarItem[]>([]);
  const [resumoDisciplinar, setResumoDisciplinar] = useState<{ totalAmarelos: number; totalVermelhos: number }>({
    totalAmarelos: 0,
    totalVermelhos: 0,
  });

  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [dadosArtilharia, dadosDisciplinar] = await Promise.all([
        competicoesV2Service.obterArtilharia(idCompeticao).catch(() => []),
        competicoesV2Service.obterDisciplinar(idCompeticao).catch(() => ({})),
      ]);

      setArtilheiros(Array.isArray(dadosArtilharia) ? dadosArtilharia : []);

      let listaJogadores: DisciplinarItem[] = [];
      let listaSuspensos: DisciplinarItem[] = [];
      let totAmarelos = 0;
      let totVermelhos = 0;

      if (Array.isArray(dadosDisciplinar)) {
        listaJogadores = dadosDisciplinar;
        listaSuspensos = dadosDisciplinar.filter((j) => j.suspenso);
      } else if (dadosDisciplinar && typeof dadosDisciplinar === 'object') {
        listaJogadores = (dadosDisciplinar as any).jogadores || [];
        listaSuspensos = (dadosDisciplinar as any).suspensos || listaJogadores.filter((j) => j.suspenso);
        totAmarelos = (dadosDisciplinar as any).total_amarelos || 0;
        totVermelhos = (dadosDisciplinar as any).total_vermelhos || 0;
      }

      setDisciplinar(listaJogadores);
      setSuspensos(listaSuspensos);
      setResumoDisciplinar({
        totalAmarelos: totAmarelos || listaJogadores.reduce((acc, j: any) => acc + (j.cartoes_amarelos ?? j.amarelos ?? 0), 0),
        totalVermelhos: totVermelhos || listaJogadores.reduce((acc, j: any) => acc + (j.cartoes_vermelhos ?? j.vermelhos ?? 0), 0),
      });
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao carregar dados estatísticos.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [idCompeticao]);

  useEffect(() => {
    if (idCompeticao) {
      carregarDados();
    }
  }, [idCompeticao, carregarDados]);

  const artilheirosFiltrados = artilheiros.filter((a) => {
    if (!busca.trim()) return true;
    const b = busca.toLowerCase();
    return (
      (a.nome_jogador && a.nome_jogador.toLowerCase().includes(b)) ||
      (a.nome_equipe && a.nome_equipe.toLowerCase().includes(b))
    );
  });

  const disciplinarFiltrado = disciplinar.filter((d) => {
    if (!busca.trim()) return true;
    const b = busca.toLowerCase();
    return (
      (d.nome_jogador && d.nome_jogador.toLowerCase().includes(b)) ||
      (d.nome_equipe && d.nome_equipe.toLowerCase().includes(b))
    );
  });

  const renderBadgePodio = (pos: number) => {
    if (pos === 1) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black text-xs border border-amber-300 shadow-sm" title="1º Lugar">
          🥇
        </span>
      );
    }
    if (pos === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-black text-xs border border-slate-300 shadow-sm" title="2º Lugar">
          🥈
        </span>
      );
    }
    if (pos === 3) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/10 text-amber-900 font-black text-xs border border-amber-600/30 shadow-sm" title="3º Lugar">
          🥉
        </span>
      );
    }
    return <span className="font-bold text-slate-400 text-xs pl-2">{pos}º</span>;
  };

  return (
    <div className="space-y-6">
      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-3 text-sm">
          <AlertTriangle size={20} className="shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl gap-1">
          <button
            onClick={() => {
              setAbaAtiva('ARTILHARIA');
              setBusca('');
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              abaAtiva === 'ARTILHARIA'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy size={16} />
            Artilharia de Gols
            {artilheiros.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black">
                {artilheiros.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setAbaAtiva('DISCIPLINAR');
              setBusca('');
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              abaAtiva === 'DISCIPLINAR'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert size={16} />
            Cartões & Suspensões
            {suspensos.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black animate-pulse">
                {suspensos.length} suspensos
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar atleta ou equipe..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={carregarDados}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Recarregar estatísticas"
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 size={36} className="animate-spin text-blue-600" />
          <p className="text-slate-500 text-xs font-medium">Carregando estatísticas apuradas...</p>
        </div>
      ) : abaAtiva === 'ARTILHARIA' ? (
        <div className="space-y-4">
          {artilheirosFiltrados.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center space-y-3">
              <Trophy size={40} className="mx-auto text-slate-300" />
              <h3 className="text-base font-bold text-slate-700">Nenhum gol registrado</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Assim que os gols forem lançados nas súmulas das partidas, o ranking de artilharia será exibido aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4 text-center w-16">Pos</th>
                      <th className="py-3.5 px-4">Atleta</th>
                      <th className="py-3.5 px-4">Equipe</th>
                      <th className="py-3.5 px-4 text-center w-28">Gols Marcados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {artilheirosFiltrados.map((art) => (
                      <tr
                        key={art.id_jogador}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        <td className="py-3 px-4 text-center">
                          {renderBadgePodio(art.posicao)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {art.nome_jogador ? art.nome_jogador.substring(0, 2).toUpperCase() : <User size={14} />}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">
                                {art.nome_jogador}
                              </div>
                              {art.numero_camisa && (
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  Camisa #{art.numero_camisa}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {art.nome_equipe}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-black text-sm border border-emerald-200 shadow-xs">
                            ⚽ {art.gols}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <div className="w-5 h-7 bg-amber-400 rounded-sm shadow-xs" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Cartões Amarelos
                </span>
                <span className="text-2xl font-black text-slate-800">
                  {resumoDisciplinar.totalAmarelos}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <div className="w-5 h-7 bg-rose-500 rounded-sm shadow-xs" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Cartões Vermelhos
                </span>
                <span className="text-2xl font-black text-slate-800">
                  {resumoDisciplinar.totalVermelhos}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shrink-0">
                <ShieldAlert size={26} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Atletas Suspensos
                </span>
                <span className="text-2xl font-black text-rose-600">
                  {suspensos.length}
                </span>
              </div>
            </div>
          </div>

          {suspensos.length > 0 && (
            <div className="bg-rose-50/80 border border-rose-200 rounded-3xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-800">
                <ShieldAlert size={20} className="shrink-0 text-rose-600" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Atenção: Atletas Cumprindo Suspensão Automática
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {suspensos.map((s) => (
                  <div
                    key={s.id_jogador}
                    className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-extrabold text-xs text-slate-800 block truncate">
                        {s.nome_jogador}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {s.nome_equipe}
                      </span>
                      <span className="text-[10px] font-bold text-rose-600 mt-0.5 block">
                        Motivo: {s.motivo_suspensao || 'Suspensão regulamentar'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-300 shrink-0">
                      Suspenso
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {disciplinarFiltrado.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center space-y-3">
              <Shield size={40} className="mx-auto text-slate-300" />
              <h3 className="text-base font-bold text-slate-700">Nenhum cartão registrado</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Esta competição possui disciplina impecável até o momento. Nenhum cartão amarelo ou vermelho foi aplicado.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Atleta</th>
                      <th className="py-3.5 px-4">Equipe</th>
                      <th className="py-3.5 px-4 text-center w-24">Amarelos</th>
                      <th className="py-3.5 px-4 text-center w-24">Vermelhos</th>
                      <th className="py-3.5 px-4 text-center w-24">Pontos</th>
                      <th className="py-3.5 px-4 text-center w-28">Condição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {disciplinarFiltrado.map((d: any) => {
                      const ca = d.cartoes_amarelos ?? d.amarelos ?? 0;
                      const cv = d.cartoes_vermelhos ?? d.vermelhos ?? 0;
                      const pts = d.pontos_disciplinar ?? d.pontos_disciplinares ?? (ca * 1 + cv * 3);

                      return (
                        <tr
                          key={d.id_jogador}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            d.suspenso ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">
                              {d.nome_jogador}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {d.nome_equipe}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-700">
                            {ca > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2.5 h-3.5 bg-amber-400 rounded-[2px]" />
                                {ca}
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-rose-700">
                            {cv > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2.5 h-3.5 bg-rose-500 rounded-[2px]" />
                                {cv}
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-600">
                            {pts}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {d.suspenso ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                                Suspenso
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Apto
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
