'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { 
  Trophy, 
  Medal, 
  Award, 
  Clock, 
  Users, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Hash
} from 'lucide-react';
import { competicaoService } from '@/services/competicoes';
import { ClassificacaoIndividualResponse, AtletaMedalhasRow } from '@/types/competicoes';
import { formatarTempoMs } from './TabelaClassificacaoProva';

interface QuadroMedalhasCompeticaoProps {
  idCompeticao: number;
}

export default function QuadroMedalhasCompeticao({ idCompeticao }: QuadroMedalhasCompeticaoProps) {
  const { data, error, isLoading, mutate } = useSWR<ClassificacaoIndividualResponse>(
    idCompeticao ? `/competicoes/${idCompeticao}/classificacao-individual` : null,
    () => competicaoService.obterClassificacaoIndividual(idCompeticao)
  );

  const [mostrarPodiosPorProva, setMostrarPodiosPorProva] = useState(true);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-100 space-y-3">
        <Loader2 className="animate-spin text-purple-600" size={36} />
        <p className="text-sm font-medium text-slate-500">
          Calculando quadro geral de medalhas e estatísticas...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-rose-700 flex items-start gap-4">
        <AlertCircle size={24} className="shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-base mb-1">Não foi possível carregar a classificação</h4>
          <p className="text-xs text-rose-600 mb-3">
            Ocorreu um erro ao calcular o quadro geral de medalhas da competição.
          </p>
          <button
            onClick={() => mutate()}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const quadro = data.quadro_medalhas || [];
  const provas = data.provas || [];

  // Cálculos de KPIs
  const totalMedalhasOuro = quadro.reduce((acc, row) => acc + (row.ouros || 0), 0);
  const totalMedalhasPrata = quadro.reduce((acc, row) => acc + (row.pratas || 0), 0);
  const totalMedalhasBronze = quadro.reduce((acc, row) => acc + (row.bronzes || 0), 0);
  const totalMedalhas = totalMedalhasOuro + totalMedalhasPrata + totalMedalhasBronze;

  const totalAtletasPremiados = quadro.filter(r => (r.total_medalhas || 0) > 0).length;
  const atletaDestaque = quadro.length > 0 && quadro[0].total_medalhas > 0 ? quadro[0] : null;

  return (
    <div className="space-y-8">
      {/* Cards de Métricas e Destaque Olímpico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Provas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total de Provas</p>
            <p className="text-2xl font-black text-slate-800">{data.total_provas || provas.length}</p>
          </div>
        </div>

        {/* Atletas Medalhistas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Atletas no Pódio</p>
            <p className="text-2xl font-black text-slate-800">{totalAtletasPremiados}</p>
          </div>
        </div>

        {/* Medalhas Distribuídas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-yellow-50 text-yellow-600 rounded-2xl">
            <Trophy size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Medalhas Totais</p>
            <p className="text-2xl font-black text-slate-800">{totalMedalhas}</p>
          </div>
        </div>

        {/* Atleta Destaque */}
        <div className="bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-purple-500/10 p-5 rounded-3xl border border-yellow-200/60 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-yellow-400 text-slate-900 rounded-2xl shadow-md shadow-yellow-400/20">
            <Sparkles size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-yellow-800">Líder do Quadro</p>
            <p className="text-sm font-black text-slate-800 truncate">
              {atletaDestaque ? atletaDestaque.nome_participante : 'Aguardando'}
            </p>
            {atletaDestaque && (
              <p className="text-[11px] font-semibold text-yellow-700">
                🥇 {atletaDestaque.ouros} | 🥈 {atletaDestaque.pratas} | 🥉 {atletaDestaque.bronzes}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabela do Quadro Geral de Medalhas */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-100 text-yellow-800 rounded-2xl">
              <Trophy size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Quadro Geral de Medalhas e Ranking de Atletas
              </h3>
              <p className="text-xs text-slate-500">
                Classificação ordenada por: Ouros &gt; Pratas &gt; Bronzes &gt; Total
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-full">
              {quadro.length} {quadro.length === 1 ? 'competidor' : 'competidores'}
            </span>
          </div>
        </div>

        {quadro.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Trophy size={32} />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">
              Nenhum atleta ranqueado no quadro ainda
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Quando os resultados das provas forem lançados, o quadro de medalhas será calculado e atualizado automaticamente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Rank</th>
                  <th className="py-3.5 px-6">Atleta</th>
                  <th className="py-3.5 px-6 text-center">
                    <span className="inline-flex items-center gap-1 text-yellow-700 font-black">
                      🥇 Ouro
                    </span>
                  </th>
                  <th className="py-3.5 px-6 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-600 font-black">
                      🥈 Prata
                    </span>
                  </th>
                  <th className="py-3.5 px-6 text-center">
                    <span className="inline-flex items-center gap-1 text-amber-700 font-black">
                      🥉 Bronze
                    </span>
                  </th>
                  <th className="py-3.5 px-6 text-center">Total</th>
                  <th className="py-3.5 px-6 text-center">Provas</th>
                  <th className="py-3.5 px-6 text-center">Melhor Pos.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {quadro.map((row, index) => {
                  const rank = index + 1;
                  const isPrimeiro = rank === 1 && row.total_medalhas > 0;
                  const isSegundo = rank === 2 && row.total_medalhas > 0;
                  const isTerceiro = rank === 3 && row.total_medalhas > 0;

                  return (
                    <tr
                      key={row.id_participante}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isPrimeiro
                          ? 'bg-yellow-50/30 font-medium'
                          : isSegundo
                          ? 'bg-slate-50/40'
                          : isTerceiro
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-4 px-6 font-bold whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isPrimeiro ? (
                            <span className="px-2.5 py-1 bg-yellow-400 text-slate-900 rounded-xl text-xs font-black shadow-sm flex items-center gap-1">
                              <Trophy size={13} />
                              1º
                            </span>
                          ) : isSegundo ? (
                            <span className="px-2.5 py-1 bg-slate-300 text-slate-800 rounded-xl text-xs font-black flex items-center gap-1">
                              <Medal size={13} />
                              2º
                            </span>
                          ) : isTerceiro ? (
                            <span className="px-2.5 py-1 bg-amber-200 text-amber-900 rounded-xl text-xs font-black flex items-center gap-1">
                              <Award size={13} />
                              3º
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-slate-500 font-semibold text-xs">
                              {rank}º
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Atleta */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {row.nome_participante.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-snug">
                              {row.nome_participante}
                            </p>
                            {row.numero_peito && (
                              <span className="text-[11px] font-mono font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                #{row.numero_peito}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Ouros */}
                      <td className="py-4 px-6 text-center font-mono font-bold text-yellow-700">
                        {row.ouros > 0 ? (
                          <span className="px-2.5 py-1 bg-yellow-100/80 rounded-lg border border-yellow-200">
                            {row.ouros}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Pratas */}
                      <td className="py-4 px-6 text-center font-mono font-bold text-slate-700">
                        {row.pratas > 0 ? (
                          <span className="px-2.5 py-1 bg-slate-200/80 rounded-lg border border-slate-300">
                            {row.pratas}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Bronzes */}
                      <td className="py-4 px-6 text-center font-mono font-bold text-amber-700">
                        {row.bronzes > 0 ? (
                          <span className="px-2.5 py-1 bg-amber-100/80 rounded-lg border border-amber-200">
                            {row.bronzes}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-4 px-6 text-center font-mono font-black text-slate-900 text-base">
                        {row.total_medalhas > 0 ? (
                          <span className="text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl">
                            {row.total_medalhas}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>

                      {/* Provas Disputadas */}
                      <td className="py-4 px-6 text-center font-mono text-slate-600 text-xs">
                        {row.provas_disputadas || 0}
                      </td>

                      {/* Melhor Posição */}
                      <td className="py-4 px-6 text-center font-mono text-xs">
                        {row.melhor_posicao ? (
                          <span className="font-semibold text-slate-700">
                            {row.melhor_posicao}º
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumo de Pódios por Prova */}
      {provas.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <Medal size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Resumo dos Pódios Homologados por Prova
                </h3>
                <p className="text-xs text-slate-500">
                  Vencedores de cada bateria e tempo conquistado
                </p>
              </div>
            </div>

            <button
              onClick={() => setMostrarPodiosPorProva(!mostrarPodiosPorProva)}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {mostrarPodiosPorProva ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>

          {mostrarPodiosPorProva && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {provas.map(p => {
                const ouro = p.podio?.ouro;
                const prata = p.podio?.prata;
                const bronze = p.podio?.bronze;
                const temPodio = Boolean(ouro || prata || bronze);

                return (
                  <div
                    key={p.id_prova}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <h4 className="font-bold text-sm text-slate-800 truncate">
                        {p.nome}
                      </h4>
                      <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5 bg-white rounded-md border border-slate-200/50">
                        {p.status}
                      </span>
                    </div>

                    {temPodio ? (
                      <div className="space-y-2 text-xs">
                        {/* 🥇 Ouro */}
                        <div className="flex items-center justify-between bg-yellow-50/80 p-2 rounded-xl border border-yellow-200/60">
                          <span className="font-black text-yellow-800 flex items-center gap-1.5">
                            🥇 1º
                            <span className="font-semibold text-slate-900 truncate max-w-[120px]">
                              {ouro?.participante?.atleta?.nome_completo ||
                                ouro?.participante?.aluno?.nome_completo ||
                                `Atleta #${ouro?.id_participante}`}
                            </span>
                          </span>
                          <span className="font-mono font-bold text-yellow-900 text-[11px]">
                            {ouro?.tempo_formatado || formatarTempoMs(ouro?.tempo_ms)}
                          </span>
                        </div>

                        {/* 🥈 Prata */}
                        {prata && (
                          <div className="flex items-center justify-between bg-slate-100/80 p-2 rounded-xl border border-slate-200/60">
                            <span className="font-black text-slate-700 flex items-center gap-1.5">
                              🥈 2º
                              <span className="font-semibold text-slate-900 truncate max-w-[120px]">
                                {prata.participante?.atleta?.nome_completo ||
                                  prata.participante?.aluno?.nome_completo ||
                                  `Atleta #${prata.id_participante}`}
                              </span>
                            </span>
                            <span className="font-mono font-bold text-slate-700 text-[11px]">
                              {prata.tempo_formatado || formatarTempoMs(prata.tempo_ms)}
                            </span>
                          </div>
                        )}

                        {/* 🥉 Bronze */}
                        {bronze && (
                          <div className="flex items-center justify-between bg-amber-50/80 p-2 rounded-xl border border-amber-200/60">
                            <span className="font-black text-amber-800 flex items-center gap-1.5">
                              🥉 3º
                              <span className="font-semibold text-slate-900 truncate max-w-[120px]">
                                {bronze.participante?.atleta?.nome_completo ||
                                  bronze.participante?.aluno?.nome_completo ||
                                  `Atleta #${bronze.id_participante}`}
                              </span>
                            </span>
                            <span className="font-mono font-bold text-amber-900 text-[11px]">
                              {bronze.tempo_formatado || formatarTempoMs(bronze.tempo_ms)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-2 text-center">
                        Nenhum resultado homologado ainda.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
