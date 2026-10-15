'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { 
  Trophy, 
  Loader2, 
  AlertCircle, 
  Shield, 
  Layers, 
  Award, 
  RotateCw,
  Users,
  Swords
} from 'lucide-react';
import { competicaoService } from '@/services/competicoes';
import { 
  FormatoCompeticao, 
  ClassificacaoEquipesResponse, 
  ClassificacaoEquipeRow 
} from '@/types/competicoes';

interface TabelaClassificacaoEquipesProps {
  idCompeticao: number;
  formato?: FormatoCompeticao | null;
}

export default function TabelaClassificacaoEquipes({
  idCompeticao,
  formato,
}: TabelaClassificacaoEquipesProps) {
  const { data, error, isLoading, mutate } = useSWR<ClassificacaoEquipesResponse>(
    idCompeticao ? `/competicoes/${idCompeticao}/classificacao-equipes` : null,
    () => competicaoService.obterClassificacaoEquipes(idCompeticao)
  );

  const [abaGrupos, setAbaGrupos] = useState<'grupos' | 'geral'>('grupos');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <Loader2 className="animate-spin text-blue-600" size={36} />
        <p className="text-sm font-medium text-slate-500">
          Calculando tabela de classificação...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center space-y-4">
        <AlertCircle size={36} className="mx-auto text-rose-500" />
        <div>
          <h3 className="text-base font-bold text-rose-800">
            Não foi possível carregar a classificação
          </h3>
          <p className="text-xs text-rose-600 mt-1">
            {error?.response?.data?.detail || 'Erro ao consultar classificação de equipes.'}
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="px-4 py-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-100/50 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
        >
          <RotateCw size={14} />
          Tentar Novamente
        </button>
      </div>
    );
  }

  const formatoAtual = data.formato || formato || 'PONTOS_CORRIDOS';
  const temGrupos = Boolean(data.grupos && Object.keys(data.grupos).length > 0);

  // Campeão e vice para mata-mata
  const campeao = data.campeao || data.mata_mata?.campeao;
  const viceCampeao = data.vice_campeao || data.mata_mata?.vice_campeao;
  const semifinalistas = data.semifinalistas || data.mata_mata?.semifinalistas || [];

  return (
    <div className="space-y-6">
      {/* Barra de Estatísticas Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Equipes</p>
          <p className="text-2xl font-black text-slate-800 mt-1 flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            {data.total_equipes}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Jogos Disputados</p>
          <p className="text-2xl font-black text-slate-800 mt-1 flex items-center gap-2">
            <Swords size={20} className="text-emerald-600" />
            {data.confrontos_disputados}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Formato</p>
          <p className="text-base font-bold text-slate-800 mt-2 truncate">
            {formatoAtual === 'PONTOS_CORRIDOS'
              ? 'Pontos Corridos'
              : formatoAtual === 'GRUPOS'
              ? 'Fase de Grupos'
              : 'Mata-Mata'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Atualização</p>
            <p className="text-xs font-semibold text-slate-600 mt-1">Automática</p>
          </div>
          <button
            onClick={() => mutate()}
            className="p-2.5 hover:bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl transition-colors cursor-pointer border border-slate-100"
            title="Atualizar Classificação"
          >
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      {/* Destaque de Pódio para Mata-Mata */}
      {formatoAtual === 'MATA_MATA' && (campeao || viceCampeao) && (
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-orange-50/30 border border-amber-200/80 rounded-3xl p-6 shadow-sm">
          <h3 className="text-base font-black text-amber-900 mb-4 flex items-center gap-2">
            <Trophy className="text-amber-500" size={20} />
            Quadro de Honra do Mata-Mata
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {campeao && (
              <div className="bg-white/90 backdrop-blur-sm border border-amber-200 rounded-2xl p-4 text-center shadow-sm">
                <span className="inline-block p-2 bg-amber-100 text-amber-700 rounded-full mb-2">
                  <Trophy size={24} />
                </span>
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-700">Campeão 🥇</p>
                <p className="text-lg font-black text-slate-800 mt-1 truncate">{campeao.nome_equipe}</p>
              </div>
            )}
            {viceCampeao && (
              <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                <span className="inline-block p-2 bg-slate-100 text-slate-600 rounded-full mb-2">
                  <Award size={24} />
                </span>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Vice-Campeão 🥈</p>
                <p className="text-lg font-black text-slate-800 mt-1 truncate">{viceCampeao.nome_equipe}</p>
              </div>
            )}
            {semifinalistas.length > 0 && (
              <div className="bg-white/90 backdrop-blur-sm border border-orange-200 rounded-2xl p-4 text-center shadow-sm">
                <span className="inline-block p-2 bg-orange-100 text-orange-700 rounded-full mb-2">
                  <Shield size={24} />
                </span>
                <p className="text-[11px] font-black uppercase tracking-wider text-orange-700">Semifinalistas 🥉</p>
                <div className="mt-1 space-y-0.5">
                  {semifinalistas.map((s) => (
                    <p key={s.id_equipe} className="text-xs font-bold text-slate-700 truncate">
                      {s.nome_equipe}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navegação entre abas se for formato de Grupos */}
      {formatoAtual === 'GRUPOS' && temGrupos && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
          <button
            onClick={() => setAbaGrupos('grupos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              abaGrupos === 'grupos'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={14} />
            Por Grupos
          </button>
          <button
            onClick={() => setAbaGrupos('geral')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              abaGrupos === 'geral'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trophy size={14} />
            Classificação Geral
          </button>
        </div>
      )}

      {/* Renderização das Tabelas */}
      {formatoAtual === 'GRUPOS' && temGrupos && abaGrupos === 'grupos' ? (
        <div className="space-y-8">
          {Object.entries(data.grupos!).map(([nomeGrupo, linhas]) => (
            <div key={nomeGrupo} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <h4 className="text-base font-extrabold text-slate-800 tracking-wide">
                  Grupo {nomeGrupo}
                </h4>
              </div>
              <TabelaCard rows={linhas} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {formatoAtual === 'GRUPOS' && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h4 className="text-base font-extrabold text-slate-800 tracking-wide">
                Classificação Geral Unificada
              </h4>
            </div>
          )}
          <TabelaCard rows={data.classificacao || []} />
        </div>
      )}
    </div>
  );
}

// Subcomponente que renderiza a estrutura visual da tabela
function TabelaCard({ rows }: { rows: ClassificacaoEquipeRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400">
        <Trophy size={36} className="mx-auto text-slate-300 mb-2 opacity-50" />
        <p className="font-semibold text-sm">Nenhum registro classificatório para exibir.</p>
        <p className="text-xs text-slate-400 mt-1">
          Inscreva as equipes e finalize confrontos para gerar pontuações.
        </p>
      </div>
    );
  }

  const getBadgePosicao = (pos: number) => {
    if (pos === 1) return 'bg-amber-100 text-amber-800 border-amber-300 font-black';
    if (pos === 2) return 'bg-slate-200 text-slate-800 border-slate-300 font-bold';
    if (pos === 3) return 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
    return 'bg-slate-50 text-slate-600 border-slate-200 font-semibold';
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-black uppercase tracking-wider text-[11px]">
              <th className="py-4 px-4 w-16 text-center">Pos</th>
              <th className="py-4 px-4">Equipe</th>
              <th className="py-4 px-3 text-center font-black text-blue-600">PTS</th>
              <th className="py-4 px-3 text-center">J</th>
              <th className="py-4 px-3 text-center text-emerald-600">V</th>
              <th className="py-4 px-3 text-center text-slate-500">E</th>
              <th className="py-4 px-3 text-center text-rose-500">D</th>
              <th className="py-4 px-3 text-center">GP</th>
              <th className="py-4 px-3 text-center">GC</th>
              <th className="py-4 px-3 text-center font-bold">SG</th>
              <th className="py-4 px-4 text-center">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {rows.map((row, idx) => {
              const pos = row.posicao || idx + 1;
              return (
                <tr
                  key={row.id_equipe}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  {/* Posição */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs border ${getBadgePosicao(
                        pos
                      )}`}
                    >
                      {pos}º
                    </span>
                  </td>

                  {/* Nome da Equipe */}
                  <td className="py-3.5 px-4 font-bold text-slate-800 text-sm">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-blue-600 shrink-0" />
                      <span className="truncate">{row.nome_equipe}</span>
                      {row.grupo && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold uppercase">
                          Gr. {row.grupo}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Pontos */}
                  <td className="py-3.5 px-3 text-center font-black text-sm text-blue-600 bg-blue-50/30">
                    {row.pontos}
                  </td>

                  {/* Jogos */}
                  <td className="py-3.5 px-3 text-center text-slate-700 font-semibold">
                    {row.jogos}
                  </td>

                  {/* Vitórias */}
                  <td className="py-3.5 px-3 text-center text-emerald-600 font-bold">
                    {row.vitorias}
                  </td>

                  {/* Empates */}
                  <td className="py-3.5 px-3 text-center text-slate-600">
                    {row.empates}
                  </td>

                  {/* Derrotas */}
                  <td className="py-3.5 px-3 text-center text-rose-600">
                    {row.derrotas}
                  </td>

                  {/* Gols Pró */}
                  <td className="py-3.5 px-3 text-center text-slate-600">
                    {row.gols_pro}
                  </td>

                  {/* Gols Contra */}
                  <td className="py-3.5 px-3 text-center text-slate-600">
                    {row.gols_contra}
                  </td>

                  {/* Saldo de Gols */}
                  <td
                    className={`py-3.5 px-3 text-center font-bold ${
                      row.saldo_gols > 0
                        ? 'text-emerald-600'
                        : row.saldo_gols < 0
                        ? 'text-rose-600'
                        : 'text-slate-500'
                    }`}
                  >
                    {row.saldo_gols > 0 ? `+${row.saldo_gols}` : row.saldo_gols}
                  </td>

                  {/* Aproveitamento */}
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-500">
                    {typeof row.aproveitamento === 'number'
                      ? `${row.aproveitamento.toFixed(1)}%`
                      : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legenda do Rodapé */}
      <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-slate-400 font-semibold">
        <span><strong className="text-slate-600">PTS:</strong> Pontos</span>
        <span><strong className="text-slate-600">J:</strong> Jogos</span>
        <span><strong className="text-slate-600">V:</strong> Vitórias</span>
        <span><strong className="text-slate-600">E:</strong> Empates</span>
        <span><strong className="text-slate-600">D:</strong> Derrotas</span>
        <span><strong className="text-slate-600">GP:</strong> Gols Pró</span>
        <span><strong className="text-slate-600">GC:</strong> Gols Contra</span>
        <span><strong className="text-slate-600">SG:</strong> Saldo de Gols</span>
        <span><strong className="text-slate-600">%:</strong> Aproveitamento</span>
      </div>
    </div>
  );
}
