'use client';

import React from 'react';
import useSWR from 'swr';
import { 
  Trophy, 
  Medal, 
  Award, 
  Clock, 
  AlertCircle, 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Prova, ResultadoProva } from '@/types/competicoes';
import { competicaoService } from '@/services/competicoes';

interface TabelaClassificacaoProvaProps {
  prova: Prova;
  onEditarResultado?: (resultado: ResultadoProva) => void;
  onExcluirResultado?: (idResultado: number) => void;
  onLancarResultado?: () => void;
  readOnly?: boolean;
}

export function formatarTempoMs(tempo_ms?: number | null): string {
  if (tempo_ms === undefined || tempo_ms === null || tempo_ms <= 0) return '--:--.---';
  if (tempo_ms < 60000) {
    const segundos = Math.floor(tempo_ms / 1000);
    const ms = tempo_ms % 1000;
    return `${segundos.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}s`;
  }
  const minutos = Math.floor(tempo_ms / 60000);
  const resto = tempo_ms % 60000;
  const segundos = Math.floor(resto / 1000);
  const ms = resto % 1000;
  return `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function formatarGapMs(tempo_ms: number, tempo_lider: number): string {
  const diff = tempo_ms - tempo_lider;
  if (diff <= 0) return 'Líder';
  const segundos = (diff / 1000).toFixed(3);
  return `+${segundos}s`;
}

export function extrairNomeParticipante(resultado: ResultadoProva): string {
  if (resultado.participante) {
    if (resultado.participante.atleta?.nome_completo) {
      return resultado.participante.atleta.nome_completo;
    }
    if (resultado.participante.aluno?.nome_completo) {
      return resultado.participante.aluno.nome_completo;
    }
  }
  return `Participante #${resultado.id_participante}`;
}

export default function TabelaClassificacaoProva({
  prova,
  onEditarResultado,
  onExcluirResultado,
  onLancarResultado,
  readOnly = false,
}: TabelaClassificacaoProvaProps) {
  // SWR para carregar dados atualizados da classificação da prova
  const { data: classificacaoData, isLoading } = useSWR(
    prova?.id_prova ? `/provas/${prova.id_prova}/classificacao` : null,
    () => competicaoService.obterClassificacaoProva(prova.id_prova),
    {
      revalidateOnFocus: false,
    }
  );

  // Fallback para os resultados já presentes no objeto da prova
  const rawResultados: ResultadoProva[] = classificacaoData?.resultados || prova.resultados || [];

  // Separar e ordenar resultados
  const validos = rawResultados
    .filter(r => !r.desqualificado)
    .sort((a, b) => a.tempo_ms - b.tempo_ms);

  const desqualificados = rawResultados
    .filter(r => r.desqualificado)
    .sort((a, b) => a.tempo_ms - b.tempo_ms);

  const todosClassificados = [...validos, ...desqualificados];
  const tempoLider = validos.length > 0 ? validos[0].tempo_ms : null;

  const ouro = validos[0] || null;
  const prata = validos[1] || null;
  const bronze = validos[2] || null;

  if (isLoading && !rawResultados.length) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-3xl border border-slate-100">
        <Loader2 className="animate-spin text-purple-600 mr-3" size={24} />
        <span className="text-sm font-medium text-slate-500">Carregando classificação da prova...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pódio Visual Destacado */}
      {validos.length > 0 && (
        <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-yellow-500/20 text-yellow-400 rounded-2xl border border-yellow-500/30">
                <Trophy size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Pódio Oficial
                </h3>
                <p className="text-xs text-slate-400">
                  {prova.nome} • Melhores tempos homologados
                </p>
              </div>
            </div>

            {!readOnly && onLancarResultado && (
              <button
                onClick={onLancarResultado}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
              >
                <Plus size={15} />
                Lançar Resultado
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 🥈 2º Lugar - Prata */}
            <div className="order-2 md:order-1 bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between relative backdrop-blur-sm">
              <div className="flex items-start justify-between mb-3">
                <span className="px-2.5 py-1 bg-slate-700/80 text-slate-200 border border-slate-600 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Medal size={14} className="text-slate-300" />
                  2º Prata
                </span>
                {prata && (
                  <span className="text-xs font-semibold text-slate-400">
                    {formatarGapMs(prata.tempo_ms, tempoLider || prata.tempo_ms)}
                  </span>
                )}
              </div>

              {prata ? (
                <div>
                  <h4 className="text-base font-bold text-white truncate mb-1">
                    {extrairNomeParticipante(prata)}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock size={13} className="text-slate-300" />
                    <span className="font-mono font-bold text-slate-200 text-sm">
                      {formatarTempoMs(prata.tempo_ms)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-slate-500 text-xs italic">
                  Aguardando competidor
                </div>
              )}
            </div>

            {/* 🥇 1º Lugar - Ouro */}
            <div className="order-1 md:order-2 bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-400/50 rounded-2xl p-5 flex flex-col justify-between relative shadow-lg shadow-yellow-500/10 backdrop-blur-sm">
              <div className="flex items-start justify-between mb-3">
                <span className="px-3 py-1 bg-yellow-400 text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-yellow-400/30">
                  <Trophy size={14} />
                  1º Ouro
                </span>
                <span className="text-xs font-bold text-yellow-300/90 uppercase tracking-wider">
                  Campeão
                </span>
              </div>

              {ouro ? (
                <div>
                  <h4 className="text-lg font-black text-white truncate mb-1">
                    {extrairNomeParticipante(ouro)}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-yellow-200/80">
                    <Clock size={14} className="text-yellow-400" />
                    <span className="font-mono font-black text-yellow-300 text-base">
                      {formatarTempoMs(ouro.tempo_ms)}
                    </span>
                    <span className="text-[10px] text-yellow-400/70 font-mono">
                      ({ouro.tempo_ms} ms)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs italic">
                  Aguardando resultado do vencedor
                </div>
              )}
            </div>

            {/* 🥉 3º Lugar - Bronze */}
            <div className="order-3 md:order-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between relative backdrop-blur-sm">
              <div className="flex items-start justify-between mb-3">
                <span className="px-2.5 py-1 bg-amber-900/60 text-amber-200 border border-amber-700/60 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Award size={14} className="text-amber-400" />
                  3º Bronze
                </span>
                {bronze && (
                  <span className="text-xs font-semibold text-slate-400">
                    {formatarGapMs(bronze.tempo_ms, tempoLider || bronze.tempo_ms)}
                  </span>
                )}
              </div>

              {bronze ? (
                <div>
                  <h4 className="text-base font-bold text-white truncate mb-1">
                    {extrairNomeParticipante(bronze)}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock size={13} className="text-amber-400" />
                    <span className="font-mono font-bold text-slate-200 text-sm">
                      {formatarTempoMs(bronze.tempo_ms)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-slate-500 text-xs italic">
                  Aguardando competidor
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Resultados */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock size={18} className="text-purple-600" />
              Classificação Completa da Prova
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ordenação por menor tempo de conclusão em milissegundos
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold">
              {todosClassificados.length} {todosClassificados.length === 1 ? 'resultado' : 'resultados'}
            </span>
            {!readOnly && onLancarResultado && (
              <button
                onClick={onLancarResultado}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-100 cursor-pointer"
              >
                <Plus size={15} />
                Lançar Resultado
              </button>
            )}
          </div>
        </div>

        {todosClassificados.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Clock size={32} />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">
              Nenhum resultado registrado nesta prova
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
              Registre os tempos dos atletas inscritos para calcular a classificação oficial e os medalhistas.
            </p>
            {!readOnly && onLancarResultado && (
              <button
                onClick={onLancarResultado}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-purple-100 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Lançar Primeiro Resultado
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Posição</th>
                  <th className="py-3.5 px-6">Atleta</th>
                  <th className="py-3.5 px-6">Tempo</th>
                  <th className="py-3.5 px-6">Diferença (Gap)</th>
                  <th className="py-3.5 px-6">Situação</th>
                  <th className="py-3.5 px-6">Observações</th>
                  {!readOnly && (onEditarResultado || onExcluirResultado) && (
                    <th className="py-3.5 px-6 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {todosClassificados.map((resultado, index) => {
                  const isValido = !resultado.desqualificado;
                  const colocacao = isValido ? index + 1 : null;
                  const isOuro = colocacao === 1;
                  const isPrata = colocacao === 2;
                  const isBronze = colocacao === 3;

                  return (
                    <tr 
                      key={resultado.id_resultado}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isOuro ? 'bg-yellow-50/40' :
                        isPrata ? 'bg-slate-50/40' :
                        isBronze ? 'bg-amber-50/30' :
                        resultado.desqualificado ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Posição */}
                      <td className="py-4 px-6 font-bold whitespace-nowrap">
                        {isValido ? (
                          <div className="flex items-center gap-1.5">
                            {isOuro && (
                              <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-xl text-xs font-black flex items-center gap-1">
                                🥇 1º
                              </span>
                            )}
                            {isPrata && (
                              <span className="px-2.5 py-1 bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-1">
                                🥈 2º
                              </span>
                            )}
                            {isBronze && (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black flex items-center gap-1">
                                🥉 3º
                              </span>
                            )}
                            {!isOuro && !isPrata && !isBronze && (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold">
                                {colocacao}º
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-black tracking-wide">
                            DSQ
                          </span>
                        )}
                      </td>

                      {/* Atleta */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {extrairNomeParticipante(resultado).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {extrairNomeParticipante(resultado)}
                            </p>
                            {resultado.participante?.tipo && (
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                {resultado.participante.tipo}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tempo */}
                      <td className="py-4 px-6 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-sm">
                          {formatarTempoMs(resultado.tempo_ms)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {resultado.tempo_ms} ms
                        </div>
                      </td>

                      {/* Gap */}
                      <td className="py-4 px-6 font-mono text-xs whitespace-nowrap">
                        {isValido && tempoLider !== null ? (
                          <span className={isOuro ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                            {formatarGapMs(resultado.tempo_ms, tempoLider)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Situação */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {isValido ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} />
                            Válido
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle size={12} />
                              Desqualificado
                            </span>
                            {resultado.motivo_desqualificacao && (
                              <p className="text-[11px] text-rose-600 font-medium">
                                {resultado.motivo_desqualificacao}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Observações */}
                      <td className="py-4 px-6 text-xs text-slate-500 max-w-xs truncate">
                        {resultado.observacoes || '-'}
                      </td>

                      {/* Ações */}
                      {!readOnly && (onEditarResultado || onExcluirResultado) && (
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {onEditarResultado && (
                              <button
                                onClick={() => onEditarResultado(resultado)}
                                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                title="Editar Resultado"
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                            {onExcluirResultado && (
                              <button
                                onClick={() => {
                                  if (confirm(`Deseja realmente remover o resultado de "${extrairNomeParticipante(resultado)}"?`)) {
                                    onExcluirResultado(resultado.id_resultado);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Excluir Resultado"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
