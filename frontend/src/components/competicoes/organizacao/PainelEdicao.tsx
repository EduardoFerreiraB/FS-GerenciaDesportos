'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  obterEdicao,
  atualizarEdicao,
  publicarEdicao,
  isErroApi,
} from '@/services/competicoes';
import type {
  EdicaoCompeticaoDetalhe,
  Configuracao,
  FormatoCompeticao,
} from '@/types/competicoes';
import GestaoEquipes from '@/components/competicoes/elencos/GestaoEquipes';
import VisualizadorPartidas from '@/components/competicoes/disputa/VisualizadorPartidas';
import ChaveamentoEliminatorio from '@/components/competicoes/disputa/ChaveamentoEliminatorio';
import TabelaClassificacao from '@/components/competicoes/classificacao/TabelaClassificacao';
import FormularioConfiguracao from './FormularioConfiguracao';
import {
  Calendar,
  Settings,
  Users,
  Trophy,
  ShieldAlert,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Lock,
  RefreshCw,
  Loader2,
  Save,
} from 'lucide-react';

interface PainelEdicaoProps {
  idEdicaoCompeticao: number;
  onEdicaoAtualizada?: (edicao: EdicaoCompeticaoDetalhe) => void;
}

type AbaAtiva =
  | 'visao_geral'
  | 'configuracao'
  | 'equipes'
  | 'jogos'
  | 'classificacao'
  | 'disciplina';

export default function PainelEdicao({
  idEdicaoCompeticao,
  onEdicaoAtualizada,
}: PainelEdicaoProps) {
  const [edicao, setEdicao] = useState<EdicaoCompeticaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('visao_geral');

  // Estado da aba de configuração
  const [formatoEdit, setFormatoEdit] = useState<FormatoCompeticao>('GRUPOS_MATA_MATA');
  const [configEdit, setConfigEdit] = useState<Configuracao | null>(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [mensagemSucessoConfig, setMensagemSucessoConfig] = useState<string | null>(null);
  const [erroConfig, setErroConfig] = useState<string | null>(null);

  // Estado de publicação
  const [alterandoPublicacao, setAlterandoPublicacao] = useState(false);
  const [erroPublicacao, setErroPublicacao] = useState<string | null>(null);

  const carregarEdicao = useCallback(async () => {
    try {
      setCarregando(true);
      setErroCarregamento(null);
      const dados = await obterEdicao(idEdicaoCompeticao);
      setEdicao(dados);
      setFormatoEdit(dados.formato);
      setConfigEdit(dados.configuracao);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroCarregamento(err.mensagem);
      } else if (err instanceof Error) {
        setErroCarregamento(err.message);
      } else {
        setErroCarregamento('Falha ao carregar detalhes da edição.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarEdicao();
  }, [carregarEdicao]);

  const handleAlternarPublicacao = async () => {
    if (!edicao) return;
    try {
      setAlterandoPublicacao(true);
      setErroPublicacao(null);
      const novaPublicada = !edicao.publicada;
      const atualizada = await publicarEdicao(edicao.id_edicao_competicao, novaPublicada);
      setEdicao(atualizada);
      if (onEdicaoAtualizada) {
        onEdicaoAtualizada(atualizada);
      }
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroPublicacao(err.mensagem);
      } else if (err instanceof Error) {
        setErroPublicacao(err.message);
      } else {
        setErroPublicacao('Falha ao alterar publicação da edição.');
      }
    } finally {
      setAlterandoPublicacao(false);
    }
  };

  const handleSalvarConfiguracao = async () => {
    if (!edicao || !configEdit) return;
    try {
      setSalvandoConfig(true);
      setErroConfig(null);
      setMensagemSucessoConfig(null);

      const edicaoAtualizada = await atualizarEdicao(edicao.id_edicao_competicao, {
        identificacao: edicao.identificacao,
        data_inicio: edicao.data_inicio,
        data_fim: edicao.data_fim,
        categoria: edicao.categoria,
        formato: formatoEdit,
        configuracao: configEdit,
        id_edicao_evento: edicao.id_edicao_evento,
        revisao: edicao.revisao,
      });

      setEdicao(edicaoAtualizada);
      setFormatoEdit(edicaoAtualizada.formato);
      setConfigEdit(edicaoAtualizada.configuracao);
      setMensagemSucessoConfig('Configuração salva com sucesso!');
      if (onEdicaoAtualizada) {
        onEdicaoAtualizada(edicaoAtualizada);
      }
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroConfig(err.mensagem);
      } else if (err instanceof Error) {
        setErroConfig(err.message);
      } else {
        setErroConfig('Falha ao salvar configuração da edição.');
      }
    } finally {
      setSalvandoConfig(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm text-slate-500">Carregando painel da edição...</p>
      </div>
    );
  }

  if (erroCarregamento || !edicao) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-red-800">Erro ao carregar edição</h3>
        <p className="text-sm text-red-600 max-w-md mx-auto">
          {erroCarregamento || 'Não foi possível encontrar as informações desta edição.'}
        </p>
        <button
          type="button"
          onClick={carregarEdicao}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Cabeçalho da Edição */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-800">
                {edicao.identificacao}
              </h2>

              {/* Badge de Estado */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  edicao.estado === 'RASCUNHO'
                    ? 'bg-amber-100 text-amber-800'
                    : edicao.estado === 'EM_ANDAMENTO'
                    ? 'bg-blue-100 text-blue-800'
                    : edicao.estado === 'FINALIZADA'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {edicao.estado}
              </span>

              {/* Badge de Publicação */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  edicao.publicada
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {edicao.publicada ? 'Publicada' : 'Não publicada'}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>Período: {edicao.data_inicio} até {edicao.data_fim}</span>
              {edicao.categoria && (
                <>
                  <span>•</span>
                  <span>Categoria: {edicao.categoria}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAlternarPublicacao}
              disabled={alterandoPublicacao}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-sm ${
                edicao.publicada
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {alterandoPublicacao ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : edicao.publicada ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              <span>{edicao.publicada ? 'Despublicar edição' : 'Publicar edição'}</span>
            </button>
          </div>
        </div>

        {erroPublicacao && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{erroPublicacao}</span>
          </div>
        )}
      </div>

      {/* Navegação de Abas */}
      <div className="border-b border-slate-200 px-6 bg-slate-50/30 flex overflow-x-auto gap-2">
        <button
          type="button"
          onClick={() => setAbaAtiva('visao_geral')}
          className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
            abaAtiva === 'visao_geral'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Visão Geral</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('configuracao')}
          className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
            abaAtiva === 'configuracao'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Configuração</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('equipes')}
          className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
            abaAtiva === 'equipes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Equipes & Elencos</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('jogos')}
          className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            abaAtiva === 'jogos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Jogos & Súmula</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('classificacao')}
          className={`py-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            abaAtiva === 'classificacao'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Classificação</span>
        </button>

        <button
          type="button"
          disabled
          title="Disponível na Fatia 3"
          className="py-3 px-4 text-sm font-semibold border-b-2 border-transparent text-slate-400 cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Disciplina</span>
          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
            Fatia 3
          </span>
        </button>
      </div>

      {/* Conteúdo das Abas */}
      <div className="p-6">
        {/* Aba Visão Geral */}
        {abaAtiva === 'visao_geral' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Período da Edição
                </span>
                <p className="text-base font-bold text-slate-800 mt-1">
                  {edicao.data_inicio} até {edicao.data_fim}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Formato da Competição
                </span>
                <p className="text-base font-bold text-slate-800 mt-1">
                  {edicao.formato === 'PONTOS_CORRIDOS'
                    ? 'Pontos Corridos'
                    : edicao.formato === 'GRUPOS_MATA_MATA'
                    ? 'Grupos + Mata-mata'
                    : 'Mata-mata'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status & Publicação
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{edicao.estado}</span>
                  <span className="text-xs text-slate-500">
                    ({edicao.publicada ? 'Pública' : 'Rascunho não público'})
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              <h4 className="font-bold flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                Edição Ativa
              </h4>
              <p className="text-xs text-blue-700">
                Utilize as abas acima para configurar o regulamento técnico, inscrever equipes e gerenciar os elencos.
              </p>
            </div>
          </div>
        )}

        {/* Aba Configuração */}
        {abaAtiva === 'configuracao' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Regras e Estrutura da Edição
                </h3>
                <p className="text-xs text-slate-500">
                  Ajuste o formato, fases, regras de pontuação e critérios disciplinares.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSalvarConfiguracao}
                disabled={salvandoConfig || edicao.estado === 'FINALIZADA'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {salvandoConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Salvar Configuração</span>
              </button>
            </div>

            {mensagemSucessoConfig && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{mensagemSucessoConfig}</span>
              </div>
            )}

            {erroConfig && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{erroConfig}</span>
              </div>
            )}

            {configEdit && (
              <FormularioConfiguracao
                formato={formatoEdit}
                onFormatoChange={setFormatoEdit}
                configuracao={configEdit}
                onChange={setConfigEdit}
                desabilitado={edicao.estado === 'FINALIZADA'}
              />
            )}
          </div>
        )}

        {/* Aba Equipes & Elencos */}
        {abaAtiva === 'equipes' && (
          <div>
            <GestaoEquipes idEdicaoCompeticao={edicao.id_edicao_competicao} />
          </div>
        )}

        {/* Aba Jogos & Súmula */}
        {abaAtiva === 'jogos' && (
          <div className="space-y-6">
            <VisualizadorPartidas
              idEdicaoCompeticao={edicao.id_edicao_competicao}
              estado={edicao.estado}
              formato={edicao.formato}
            />
            {edicao.formato !== 'PONTOS_CORRIDOS' && (
              <ChaveamentoEliminatorio idEdicaoCompeticao={edicao.id_edicao_competicao} />
            )}
          </div>
        )}

        {/* Aba Classificação */}
        {abaAtiva === 'classificacao' && (
          <div>
            <TabelaClassificacao
              idEdicaoCompeticao={edicao.id_edicao_competicao}
              formato={edicao.formato}
            />
          </div>
        )}
      </div>
    </div>
  );
}
