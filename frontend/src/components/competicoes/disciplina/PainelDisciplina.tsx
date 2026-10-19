'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  obterPainelDisciplinar,
  obterArtilharia,
  listarPartidas,
  listarEquipes,
  isErroApi,
} from '@/services/competicoes';
import type {
  EstadoEdicao,
  PainelDisciplinarDetalhe,
  TabelaArtilhariaDetalhe,
  PartidaDetalhe,
  EquipeDetalhe,
  SuspensaoDetalhe,
  OrigemSuspensao,
  SituacaoSuspensao,
} from '@/types/competicoes';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  RefreshCw,
  Plus,
  Loader2,
  Info,
  Calendar,
  AlertCircle,
  HelpCircle,
  Award,
  ChevronRight,
  User,
} from 'lucide-react';
import ModalCumprirSuspensao from './ModalCumprirSuspensao';
import ModalAjustarSuspensao from './ModalAjustarSuspensao';

interface PainelDisciplinaProps {
  idEdicaoCompeticao: number;
  estadoEdicao?: EstadoEdicao;
}

type SubAbaDisciplina = 'suspensoes' | 'cartoes' | 'artilharia';

export default function PainelDisciplina({
  idEdicaoCompeticao,
  estadoEdicao,
}: PainelDisciplinaProps) {
  const [subAba, setSubAba] = useState<SubAbaDisciplina>('suspensoes');

  // Dados carregados da API
  const [painel, setPainel] = useState<PainelDisciplinarDetalhe | null>(null);
  const [artilharia, setArtilharia] = useState<TabelaArtilhariaDetalhe | null>(null);
  const [partidas, setPartidas] = useState<PartidaDetalhe[]>([]);
  const [equipes, setEquipes] = useState<EquipeDetalhe[]>([]);

  // Estados de controle
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de modais
  const [modalCumprirAberto, setModalCumprirAberto] = useState<boolean>(false);
  const [suspensaoParaCumprir, setSuspensaoParaCumprir] =
    useState<SuspensaoDetalhe | null>(null);

  const [modalAjustarAberto, setModalAjustarAberto] = useState<boolean>(false);
  const [suspensaoParaAjustar, setSuspensaoParaAjustar] =
    useState<SuspensaoDetalhe | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const [resPainel, resArtilharia, resPartidas, resEquipes] =
        await Promise.all([
          obterPainelDisciplinar(idEdicaoCompeticao),
          obterArtilharia(idEdicaoCompeticao),
          listarPartidas(idEdicaoCompeticao),
          listarEquipes(idEdicaoCompeticao),
        ]);

      setPainel(resPainel);
      setArtilharia(resArtilharia);
      setPartidas(resPartidas);
      setEquipes(resEquipes);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar os dados disciplinares e de artilharia.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const abrirCumprir = (s: SuspensaoDetalhe) => {
    setSuspensaoParaCumprir(s);
    setModalCumprirAberto(true);
  };

  const abrirAjustar = (s: SuspensaoDetalhe) => {
    setSuspensaoParaAjustar(s);
    setModalAjustarAberto(true);
  };

  const abrirNovaSuspensaoManual = () => {
    setSuspensaoParaAjustar(null);
    setModalAjustarAberto(true);
  };

  const formatarOrigem = (origem: OrigemSuspensao | string) => {
    switch (origem) {
      case 'ACUMULO_AMARELOS':
        return 'Acúmulo de Amarelos';
      case 'SEGUNDO_AMARELO':
        return '2º Amarelo (Vermelho)';
      case 'VERMELHO_DIRETO':
        return 'Vermelho Direto';
      case 'MANUAL':
        return 'Punição Administrativa';
      default:
        return origem;
    }
  };

  const renderBadgeSituacao = (s: SuspensaoDetalhe) => {
    switch (s.situacao) {
      case 'ATIVA':
        return (
          <span
            data-testid={`badge-situacao-${s.id_suspensao}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Ativa
          </span>
        );
      case 'CUMPRIDA':
        return (
          <span
            data-testid={`badge-situacao-${s.id_suspensao}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
            Cumprida
          </span>
        );
      case 'EM_REVISAO':
        return (
          <span
            data-testid={`badge-em-revisao-${s.id_suspensao}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-sm"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Em Revisão
          </span>
        );
      case 'CANCELADA':
        return (
          <span
            data-testid={`badge-situacao-${s.id_suspensao}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"
          >
            Cancelada
          </span>
        );
      default:
        return (
          <span
            data-testid={`badge-situacao-${s.id_suspensao}`}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600"
          >
            {s.situacao}
          </span>
        );
    }
  };

  const temSuspensoesEmRevisao =
    painel?.suspensoes?.some((s) => s.situacao === 'EM_REVISAO') ?? false;

  const totalSuspensoesAtivas =
    painel?.suspensoes?.filter((s) => s.situacao === 'ATIVA').length ?? 0;

  return (
    <div className="space-y-6" data-testid="painel-disciplina">
      {/* Barra Superior de Navegação das Sub-Abas e Ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="subtab-suspensoes"
            onClick={() => setSubAba('suspensoes')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition ${
              subAba === 'suspensoes'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Suspensões & Cumprimentos</span>
            {painel && painel.suspensoes.length > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  subAba === 'suspensoes'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {painel.suspensoes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="subtab-cartoes"
            onClick={() => setSubAba('cartoes')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition ${
              subAba === 'cartoes'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Controle de Cartões</span>
            {painel && painel.resumo_cartoes.length > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  subAba === 'cartoes'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {painel.resumo_cartoes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="subtab-artilharia"
            onClick={() => setSubAba('artilharia')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition ${
              subAba === 'artilharia'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Artilharia</span>
            {artilharia && artilharia.artilheiros.length > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  subAba === 'artilharia'
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {artilharia.artilheiros.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {subAba === 'suspensoes' && (
            <button
              type="button"
              data-testid="btn-nova-suspensao"
              onClick={abrirNovaSuspensaoManual}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Suspensão Manual</span>
            </button>
          )}

          <button
            type="button"
            data-testid="btn-recarregar-disciplina"
            onClick={carregarDados}
            disabled={carregando}
            aria-label="Atualizar dados"
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerta de Erro Geral */}
      {erro && (
        <div
          data-testid="erro-disciplina"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={carregarDados}
            className="text-xs font-bold underline hover:text-red-900"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Estado de Carregamento Inicial */}
      {carregando && !painel && (
        <div
          data-testid="carregando-disciplina"
          className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500"
        >
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm">Carregando dados de disciplina e artilharia...</p>
        </div>
      )}

      {/* Conteúdo da Sub-Aba 1: Suspensões e Cumprimentos */}
      {subAba === 'suspensoes' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Alerta de destaque se houver suspensões em revisão */}
          {temSuspensoesEmRevisao && (
            <div
              data-testid="alerta-em-revisao"
              className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 shadow-sm"
            >
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  Suspensões Requerendo Revisão Administrativa
                </h4>
                <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                  Existem suspensões marcadas como <strong>EM REVISÃO</strong>. Isso ocorre
                  quando um cartão de origem foi removido ou alterado após cumprimentos já
                  terem sido registrados na súmula. Utilize o botão{' '}
                  <strong>&quot;Ajustar / Revisar&quot;</strong> para confirmar a punição,
                  cancelar a suspensão ou alterar a quantidade de jogos com a devida justificativa.
                </p>
              </div>
            </div>
          )}

          {/* Lista de Suspensões */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Suspensões Disciplinares da Edição
                </h3>
                <p className="text-xs text-slate-500">
                  Histórico de punições automáticas (por cartões) e manuais (administrativas).
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span>Ativas: <strong>{totalSuspensoesAtivas}</strong></span>
                <span>•</span>
                <span>Total: <strong>{painel?.suspensoes.length ?? 0}</strong></span>
              </div>
            </div>

            {(!painel?.suspensoes || painel.suspensoes.length === 0) ? (
              <div
                data-testid="sem-suspensoes"
                className="py-12 px-6 text-center text-slate-500"
              >
                <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">
                  Nenhuma suspensão registrada nesta edição.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Suspensões por acúmulo de cartões ou expulsões aparecerão aqui automaticamente
                  após o encerramento das súmulas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Atleta</th>
                      <th className="py-3 px-4">Equipe</th>
                      <th className="py-3 px-4">Origem</th>
                      <th className="py-3 px-4">Motivo</th>
                      <th className="py-3 px-4 text-center">Cumprimento</th>
                      <th className="py-3 px-4 text-center">Situação</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {painel.suspensoes.map((s) => {
                      const ehEmRevisao = s.situacao === 'EM_REVISAO';
                      return (
                        <tr
                          key={s.id_suspensao}
                          data-testid={`linha-suspensao-${s.id_suspensao}`}
                          className={`hover:bg-slate-50/70 transition ${
                            ehEmRevisao ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              <span>
                                {s.nome_esportivo || `Integrante #${s.id_integrante}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {s.nome_equipe || '-'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-md">
                              {formatarOrigem(s.origem)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={s.motivo}>
                            {s.motivo}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="font-bold text-slate-800">
                              {s.jogos_cumpridos}
                            </span>
                            <span className="text-slate-400"> / {s.jogos} jogos</span>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {renderBadgeSituacao(s)}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {s.situacao === 'ATIVA' && (
                                <button
                                  type="button"
                                  data-testid={`btn-cumprir-${s.id_suspensao}`}
                                  onClick={() => abrirCumprir(s)}
                                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                                  title="Registrar cumprimento de partida"
                                >
                                  Cumprir
                                </button>
                              )}
                              <button
                                type="button"
                                data-testid={`btn-ajustar-${s.id_suspensao}`}
                                onClick={() => abrirAjustar(s)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                                  ehEmRevisao
                                    ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700 font-bold'
                                    : 'text-slate-700 bg-white hover:bg-slate-100 border-slate-200'
                                }`}
                                title="Ajustar quantidade de jogos ou situação da suspensão"
                              >
                                {ehEmRevisao ? 'Revisar' : 'Ajustar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Sub-Aba 2: Controle de Cartões */}
      {subAba === 'cartoes' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Nota Informativa Destacada Conforme Spec 7.4 */}
          <div
            data-testid="nota-segundo-amarelo"
            className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 shadow-sm"
          >
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs md:text-sm text-blue-900 leading-relaxed font-medium">
              Os cartões amarelos que resultaram em expulsão por 2º amarelo na mesma partida não somam no saldo para acúmulo de amarelos.
            </div>
          </div>

          {/* Tabela de Resumo de Cartões */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800">
                Resumo de Cartões da Edição
              </h3>
              <p className="text-xs text-slate-500">
                Saldo acumulado para suspensão automática e contagem estatística oficial.
              </p>
            </div>

            {(!painel?.resumo_cartoes || painel.resumo_cartoes.length === 0) ? (
              <div
                data-testid="sem-cartoes"
                className="py-12 px-6 text-center text-slate-500"
              >
                <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">
                  Nenhum cartão registrado nesta edição até o momento.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Atleta</th>
                      <th className="py-3 px-4">Equipe</th>
                      <th className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-3.5 bg-amber-400 rounded-sm inline-block" />
                          Amarelos Totais
                        </span>
                      </th>
                      <th className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                          Saldo p/ Acúmulo
                        </span>
                      </th>
                      <th className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          2º Amarelo
                        </span>
                      </th>
                      <th className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-3.5 bg-red-600 rounded-sm inline-block" />
                          Vermelhos Diretos
                        </span>
                      </th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {painel.resumo_cartoes.map((r) => (
                      <tr
                        key={r.id_integrante}
                        data-testid={`linha-cartoes-${r.id_integrante}`}
                        className="hover:bg-slate-50/70 transition"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {r.nome_esportivo}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {r.nome_equipe}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap text-slate-700">
                          {r.amarelos_estatisticos}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap font-bold text-amber-700 bg-amber-50/30">
                          {r.amarelos_acumulo_atual}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap text-slate-700">
                          {r.expulsoes_segundo_amarelo}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap text-red-600 font-semibold">
                          {r.vermelhos_diretos}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {r.suspenso_atualmente ? (
                            <span
                              data-testid="badge-suspenso"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200"
                            >
                              Suspenso
                            </span>
                          ) : (
                            <span
                              data-testid="badge-regular"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                            >
                              Regular
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Sub-Aba 3: Artilharia da Edição */}
      {subAba === 'artilharia' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {artilharia?.possui_jogos_em_andamento && (
            <div
              data-testid="aviso-jogos-em-andamento"
              className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 shadow-sm"
            >
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs md:text-sm text-blue-900 leading-relaxed font-medium">
                Existem partidas em andamento nesta edição. Gols marcados em partidas não finalizadas estão indicados separadamente.
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Ranking Oficial de Artilharia
                </h3>
                <p className="text-xs text-slate-500">
                  Total de gols marcados pelos atletas na edição.
                </p>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Trophy className="w-5 h-5" />
              </div>
            </div>

            {(!artilharia?.artilheiros || artilharia.artilheiros.length === 0) ? (
              <div
                data-testid="sem-artilheiros"
                className="py-12 px-6 text-center text-slate-500"
              >
                <Award className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">
                  Nenhum gol registrado nesta edição até o momento.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4 text-center w-16">Pos</th>
                      <th className="py-3 px-4">Atleta</th>
                      <th className="py-3 px-4 text-center w-20">Nº</th>
                      <th className="py-3 px-4">Equipe</th>
                      <th className="py-3 px-4 text-center w-28">Gols</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {artilharia.artilheiros.map((a, index) => {
                      const posicao = index + 1;
                      const ehPodio = posicao <= 3;
                      return (
                        <tr
                          key={a.id_integrante}
                          data-testid={`linha-artilheiro-${a.id_integrante}`}
                          className={`hover:bg-slate-50/70 transition ${
                            posicao === 1 ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                posicao === 1
                                  ? 'bg-amber-400 text-slate-900'
                                  : posicao === 2
                                  ? 'bg-slate-300 text-slate-800'
                                  : posicao === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'text-slate-500'
                              }`}
                            >
                              {posicao}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                            {a.nome_esportivo}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-500 whitespace-nowrap">
                            {a.numero_camisa != null ? a.numero_camisa : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {a.nome_equipe}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="font-bold text-base text-slate-900">
                              {a.gols}
                            </span>
                            {a.gols_em_andamento > 0 && (
                              <span className="ml-1 text-xs text-blue-600 font-semibold" title="Gols em partidas em andamento">
                                (+{a.gols_em_andamento})
                              </span>
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
        </div>
      )}

      {/* Modais */}
      <ModalCumprirSuspensao
        suspensao={suspensaoParaCumprir}
        partidas={partidas}
        isOpen={modalCumprirAberto}
        onClose={() => {
          setModalCumprirAberto(false);
          setSuspensaoParaCumprir(null);
        }}
        onSucesso={carregarDados}
      />

      <ModalAjustarSuspensao
        suspensao={suspensaoParaAjustar}
        idEdicaoCompeticao={idEdicaoCompeticao}
        equipes={equipes}
        isOpen={modalAjustarAberto}
        onClose={() => {
          setModalAjustarAberto(false);
          setSuspensaoParaAjustar(null);
        }}
        onSucesso={carregarDados}
      />
    </div>
  );
}
