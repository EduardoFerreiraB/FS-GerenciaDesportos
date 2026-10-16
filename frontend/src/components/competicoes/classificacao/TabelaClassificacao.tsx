'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  obterClassificacao,
  isErroApi,
} from '@/services/competicoes';
import type {
  TabelaClassificacaoDetalhe,
  GrupoClassificacaoDetalhe,
  LinhaClassificacao,
} from '@/types/competicoes';
import {
  Trophy,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Info,
  Medal,
  Users,
} from 'lucide-react';

interface TabelaClassificacaoProps {
  idEdicaoCompeticao: number;
  formato?: string;
}

export default function TabelaClassificacao({
  idEdicaoCompeticao,
  formato,
}: TabelaClassificacaoProps) {
  const [classificacao, setClassificacao] = useState<TabelaClassificacaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const dados = await obterClassificacao(idEdicaoCompeticao);
      setClassificacao(dados);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar a tabela de classificação.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Caso 1: Formato puramente MATA_MATA (eliminatório direto)
  if (formato === 'MATA_MATA') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto py-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">
            Competição em Formato Mata-Mata
          </h3>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Competições exclusivamente eliminatórias não possuem tabela de classificação pontuada ou
            fase de pontos corridos. O avanço das equipes e a definição dos campeões ocorrem diretamente
            através do chaveamento de duelos.
          </p>
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="text-left">
              Acesse a aba <strong>Jogos & Súmula</strong> para acompanhar a árvore de confrontos,
              agendamentos e resultados de cada fase eliminatória.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Estado de carregamento
  if (carregando) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Carregando classificação esportiva...</p>
      </div>
    );
  }

  // Estado de erro
  if (erro) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <div>
          <h4 className="font-bold text-red-800">Erro ao carregar classificação</h4>
          <p className="text-sm text-red-600 mt-1">{erro}</p>
        </div>
        <button
          type="button"
          onClick={carregarDados}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  const temGrupos = Boolean(classificacao?.grupos && classificacao.grupos.length > 0);
  const temLinhas = Boolean(classificacao?.linhas && classificacao.linhas.length > 0);
  const possuiEmpatePersistente = Boolean(
    classificacao?.possui_empate_persistente ||
      classificacao?.grupos?.some((g) => g.possui_empate_persistente)
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Tabela de Classificação</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe a pontuação, estatísticas de jogos e zonas de classificação das equipes.
          </p>
        </div>

        <button
          type="button"
          onClick={carregarDados}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          title="Atualizar tabela de classificação"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Banner de Empate Persistente */}
      {possuiEmpatePersistente && (
        <div
          role="alert"
          aria-label="Aviso de empates persistentes"
          className="p-4 bg-amber-50 border-l-4 border-amber-500 border-y border-r border-amber-200 rounded-xl flex items-start gap-3 shadow-sm text-amber-900"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-800 text-sm">
              Critérios de Desempate Empatados
            </p>
            <p className="text-amber-700 leading-relaxed">
              Atenção: existem empates pontuais que não puderam ser desempáticos pelos critérios técnicos do regulamento. Uma resolução manual ou sorteio pode ser necessária.
            </p>
          </div>
        </div>
      )}

      {/* Exibição por Grupos (GRUPOS_MATA_MATA) */}
      {temGrupos && classificacao?.grupos && (
        <div className="space-y-8">
          {classificacao.grupos.map((grupo) => (
            <TabelaGrupoCard
              key={grupo.id_grupo}
              grupo={grupo}
              limiteClassificacao={2}
            />
          ))}
        </div>
      )}

      {/* Exibição Geral de Pontos Corridos (PONTOS_CORRIDOS) */}
      {!temGrupos && temLinhas && classificacao?.linhas && (
        <TabelaGeralCard
          linhas={classificacao.linhas}
          limiteClassificacao={4}
          possuiEmpatePersistente={classificacao.possui_empate_persistente}
        />
      )}

      {/* Estado vazio quando não há grupos nem linhas computadas */}
      {!temGrupos && !temLinhas && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="font-bold text-slate-700">Classificação ainda não disponível</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Nenhuma pontuação foi registrada ainda. As posições serão calculadas automaticamente
            conforme os resultados das partidas forem lançados.
          </p>
        </div>
      )}

      {/* Legenda dos Critérios */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-slate-700">Legenda:</span>
          <span><strong>PTS</strong>: Pontos</span>
          <span><strong>J</strong>: Jogos</span>
          <span><strong>V</strong>: Vitórias</span>
          <span><strong>E</strong>: Empates</span>
          <span><strong>D</strong>: Derrotas</span>
          <span><strong>GP</strong>: Gols Pró</span>
          <span><strong>GC</strong>: Gols Contra</span>
          <span><strong>SG</strong>: Saldo de Gols</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
          <span>Equipes na zona verde avançam para a fase eliminatória / classificação direta.</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Subcomponente: Card e Tabela de um Grupo
// ==========================================

function TabelaGrupoCard({
  grupo,
  limiteClassificacao = 2,
}: {
  grupo: GrupoClassificacaoDetalhe;
  limiteClassificacao?: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <h4 className="font-bold text-slate-800 text-base">{grupo.nome}</h4>
          <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
            {grupo.linhas.length} equipes
          </span>
        </div>

        {grupo.possui_empate_persistente && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Empate nos critérios</span>
          </span>
        )}
      </div>

      <TabelaCorpo linhas={grupo.linhas} limiteClassificacao={limiteClassificacao} />
    </div>
  );
}

// ==========================================
// Subcomponente: Card e Tabela Geral
// ==========================================

function TabelaGeralCard({
  linhas,
  limiteClassificacao = 4,
  possuiEmpatePersistente,
}: {
  linhas: LinhaClassificacao[];
  limiteClassificacao?: number;
  possuiEmpatePersistente?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Medal className="w-4 h-4 text-amber-500" />
          <h4 className="font-bold text-slate-800 text-base">Classificação Geral</h4>
          <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
            {linhas.length} equipes
          </span>
        </div>

        {possuiEmpatePersistente && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Empate nos critérios</span>
          </span>
        )}
      </div>

      <TabelaCorpo linhas={linhas} limiteClassificacao={limiteClassificacao} />
    </div>
  );
}

// ==========================================
// Subcomponente: Corpo da Tabela Responsiva
// ==========================================

function TabelaCorpo({
  linhas,
  limiteClassificacao = 2,
}: {
  linhas: LinhaClassificacao[];
  limiteClassificacao?: number;
}) {
  if (linhas.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Nenhuma equipe pontuada neste grupo.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse" role="table">
        <thead>
          <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
            <th scope="col" className="py-3 px-4 w-14 text-center">
              Pos
            </th>
            <th scope="col" className="py-3 px-4">
              Equipe
            </th>
            <th scope="col" className="py-3 px-3 text-center w-16 bg-blue-50/60 text-blue-900 font-bold">
              PTS
            </th>
            <th scope="col" className="py-3 px-3 text-center w-12" title="Jogos disputados">
              J
            </th>
            <th scope="col" className="py-3 px-3 text-center w-12" title="Vitórias">
              V
            </th>
            <th scope="col" className="py-3 px-3 text-center w-12" title="Empates">
              E
            </th>
            <th scope="col" className="py-3 px-3 text-center w-12" title="Derrotas">
              D
            </th>
            <th scope="col" className="py-3 px-3 text-center w-14" title="Gols Pró">
              GP
            </th>
            <th scope="col" className="py-3 px-3 text-center w-14" title="Gols Contra">
              GC
            </th>
            <th scope="col" className="py-3 px-3 text-center w-14" title="Saldo de Gols">
              SG
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {linhas.map((linha) => {
            const naZona = linha.posicao <= limiteClassificacao;
            const linhaEmpatada = (linha as unknown as { empate_persistente?: boolean }).empate_persistente;

            return (
              <tr
                key={linha.id_equipe}
                className={`transition hover:bg-slate-50/80 ${
                  naZona ? 'bg-emerald-50/20' : ''
                }`}
              >
                {/* Posição */}
                <td className="py-3 px-4 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                        linha.posicao === 1
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : naZona
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {linha.posicao}º
                    </span>
                  </div>
                </td>

                {/* Nome da Equipe */}
                <td className="py-3 px-4 font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 hover:text-blue-600">
                      {linha.nome_equipe}
                    </span>
                    {linhaEmpatada && (
                      <span
                        title="Empate persistente com outra equipe"
                        className="inline-flex items-center text-amber-600"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {naZona && (
                      <span className="hidden sm:inline-block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                        Zona
                      </span>
                    )}
                  </div>
                </td>

                {/* Pontos */}
                <td className="py-3 px-3 text-center font-bold text-slate-900 bg-blue-50/40 text-base">
                  {linha.pontos}
                </td>

                {/* Jogos */}
                <td className="py-3 px-3 text-center text-slate-600">{linha.jogos}</td>

                {/* Vitórias */}
                <td className="py-3 px-3 text-center font-medium text-emerald-700">
                  {linha.vitorias}
                </td>

                {/* Empates */}
                <td className="py-3 px-3 text-center text-slate-500">{linha.empates}</td>

                {/* Derrotas */}
                <td className="py-3 px-3 text-center text-rose-600">{linha.derrotas}</td>

                {/* Gols Pró */}
                <td className="py-3 px-3 text-center text-slate-600">{linha.gols_pro}</td>

                {/* Gols Contra */}
                <td className="py-3 px-3 text-center text-slate-600">{linha.gols_contra}</td>

                {/* Saldo de Gols */}
                <td
                  className={`py-3 px-3 text-center font-semibold ${
                    linha.saldo_gols > 0
                      ? 'text-emerald-600'
                      : linha.saldo_gols < 0
                      ? 'text-rose-600'
                      : 'text-slate-500'
                  }`}
                >
                  {linha.saldo_gols > 0 ? `+${linha.saldo_gols}` : linha.saldo_gols}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
