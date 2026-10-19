'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Trophy,
  ArrowLeft,
  Plus,
  AlertCircle,
  RefreshCw,
  Loader2,
  Calendar,
  X,
  Trash2,
} from 'lucide-react';
import {
  obterCompeticao,
  criarEdicaoCompeticao,
  excluirCompeticao,
  isErroApi,
} from '@/services/competicoes';
import type {
  CompeticaoDetalhe,
  EdicaoCompeticaoDetalhe,
  FormatoCompeticao,
  Configuracao,
} from '@/types/competicoes';
import PainelEdicao from '@/components/competicoes/organizacao/PainelEdicao';
import ModalConfirmarExclusao from '@/components/competicoes/organizacao/ModalConfirmarExclusao';
import FormularioConfiguracao, {
  criarConfiguracaoPadrao,
} from '@/components/competicoes/organizacao/FormularioConfiguracao';

export default function CompeticaoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const idCompeticao = Number(params?.id);

  const [competicao, setCompeticao] = useState<CompeticaoDetalhe | null>(null);
  const [edicaoSelecionadaId, setEdicaoSelecionadaId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal Nova Edição
  const [modalNovaEdicaoAberto, setModalNovaEdicaoAberto] = useState(false);
  const [identificacaoNova, setIdentificacaoNova] = useState('');
  const [dataInicioNova, setDataInicioNova] = useState('');
  const [dataFimNova, setDataFimNova] = useState('');
  const [categoriaNova, setCategoriaNova] = useState('');
  const [formatoNovo, setFormatoNovo] = useState<FormatoCompeticao>('GRUPOS_MATA_MATA');
  const [configNovo, setConfigNovo] = useState<Configuracao>(
    criarConfiguracaoPadrao('GRUPOS_MATA_MATA')
  );
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroNovaEdicao, setErroNovaEdicao] = useState<string | null>(null);

  const carregarCompeticao = useCallback(async () => {
    if (isNaN(idCompeticao)) {
      setErro('ID de competição inválido.');
      setCarregando(false);
      return;
    }
    try {
      setCarregando(true);
      setErro(null);
      const dados = await obterCompeticao(idCompeticao);
      setCompeticao(dados);
      if (dados.edicoes && dados.edicoes.length > 0) {
        setEdicaoSelecionadaId((prev) => {
          if (prev && dados.edicoes.some((e) => e.id_edicao_competicao === prev)) {
            return prev;
          }
          return dados.edicoes[dados.edicoes.length - 1].id_edicao_competicao;
        });
      } else {
        setEdicaoSelecionadaId(null);
      }
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar detalhes da competição.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idCompeticao]);

  useEffect(() => {
    carregarCompeticao();
  }, [carregarCompeticao]);

  const handleCriarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificacaoNova.trim() || !dataInicioNova || !dataFimNova) {
      setErroNovaEdicao('Preencha os campos obrigatórios da edição.');
      return;
    }
    try {
      setSalvandoEdicao(true);
      setErroNovaEdicao(null);
      const novaEdicao = await criarEdicaoCompeticao(idCompeticao, {
        identificacao: identificacaoNova.trim(),
        data_inicio: dataInicioNova,
        data_fim: dataFimNova,
        categoria: categoriaNova.trim() || null,
        formato: formatoNovo,
        configuracao: configNovo,
      });

      setModalNovaEdicaoAberto(false);
      setIdentificacaoNova('');
      setDataInicioNova('');
      setDataFimNova('');
      setCategoriaNova('');
      await carregarCompeticao();
      setEdicaoSelecionadaId(novaEdicao.id_edicao_competicao);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroNovaEdicao(err.mensagem);
      } else if (err instanceof Error) {
        setErroNovaEdicao(err.message);
      } else {
        setErroNovaEdicao('Falha ao criar nova edição.');
      }
    } finally {
      setSalvandoEdicao(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm text-slate-500">Carregando detalhes da competição...</p>
      </div>
    );
  }

  if (erro || !competicao) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-red-800">Erro ao carregar competição</h3>
          <p className="text-sm text-red-600 max-w-md mx-auto">{erro}</p>
          <div className="flex justify-center gap-3">
            <Link
              href="/dashboard/competicoes"
              className="px-4 py-2 border border-slate-300 bg-white rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
            >
              Voltar para competições
            </Link>
            <button
              type="button"
              onClick={carregarCompeticao}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar novamente</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Navegação Superior */}
      <div>
        <Link
          href="/dashboard/competicoes"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para competições</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Trophy className="w-7 h-7 text-amber-500" />
              {competicao.nome}
            </h1>
            {competicao.descricao && (
              <p className="text-sm text-slate-500 mt-1">{competicao.descricao}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="btn-excluir-competicao"
              onClick={() => setModalExclusaoAberto(true)}
              className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-medium text-sm transition flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir competição</span>
            </button>
            <button
              type="button"
              onClick={() => setModalNovaEdicaoAberto(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nova edição</span>
            </button>
          </div>
        </div>
      </div>

      {/* Seletor de Edição */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-bold text-slate-800">Edições da Competição:</span>
          </div>

          {competicao.edicoes && competicao.edicoes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {competicao.edicoes.map((ed) => {
                const ativa = ed.id_edicao_competicao === edicaoSelecionadaId;
                return (
                  <button
                    key={ed.id_edicao_competicao}
                    type="button"
                    onClick={() => setEdicaoSelecionadaId(ed.id_edicao_competicao)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                      ativa
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{ed.identificacao}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        ativa ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {ed.estado}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-xs text-slate-500 italic">
              Nenhuma edição cadastrada para esta competição.
            </span>
          )}
        </div>
      </div>

      {/* Painel da Edição Selecionada */}
      {edicaoSelecionadaId ? (
        <PainelEdicao
          idEdicaoCompeticao={edicaoSelecionadaId}
          onEdicaoAtualizada={carregarCompeticao}
          onEdicaoExcluida={() => {
            setEdicaoSelecionadaId(null);
            carregarCompeticao();
          }}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-700">Nenhuma edição selecionada</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Crie a primeira edição desta competição para começar a definir regulamentos e equipes.
          </p>
          <button
            type="button"
            onClick={() => setModalNovaEdicaoAberto(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Criar primeira edição</span>
          </button>
        </div>
      )}

      <ModalConfirmarExclusao
        aberto={modalExclusaoAberto}
        titulo="Excluir competição"
        textoConfirmacao={competicao.nome}
        descricao={
          <>
            <p>
              A competição <strong>{competicao.nome}</strong> será apagada junto com{' '}
              <strong>
                {competicao.edicoes.length === 1 ? '1 edição' : `${competicao.edicoes.length} edições`}
              </strong>{' '}
              e tudo o que pertence a elas: equipes, elencos, jogos, súmulas, classificação e suspensões.
            </p>
            <p>
              Para encerrar só um campeonato e manter a competição, use <strong>Cancelar Edição</strong> ou{' '}
              <strong>Excluir Edição</strong> na edição. Os competidores cadastrados não são apagados.
            </p>
          </>
        }
        onFechar={() => setModalExclusaoAberto(false)}
        onConfirmar={async () => {
          await excluirCompeticao(competicao.id_competicao);
          router.push('/dashboard/competicoes');
        }}
      />

      {/* Modal Nova Edição */}
      {modalNovaEdicaoAberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-nova-edicao-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h2 id="modal-nova-edicao-titulo" className="text-xl font-bold text-slate-800">
                Nova Edição da Competição
              </h2>
              <button
                type="button"
                onClick={() => setModalNovaEdicaoAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {erroNovaEdicao && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                <span>{erroNovaEdicao}</span>
              </div>
            )}

            <form onSubmit={handleCriarEdicao} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="nova-edicao-identificacao"
                    className="block text-sm font-semibold text-slate-700 mb-1"
                  >
                    Identificação da Edição
                  </label>
                  <input
                    id="nova-edicao-identificacao"
                    type="text"
                    required
                    placeholder="Ex: 2026 ou 2ª Edição"
                    value={identificacaoNova}
                    onChange={(e) => setIdentificacaoNova(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="nova-edicao-categoria"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Categoria (Opcional)
                  </label>
                  <input
                    id="nova-edicao-categoria"
                    type="text"
                    placeholder="Ex: Sub-17"
                    value={categoriaNova}
                    onChange={(e) => setCategoriaNova(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="nova-edicao-data-inicio"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Data de Início
                  </label>
                  <input
                    id="nova-edicao-data-inicio"
                    type="date"
                    required
                    value={dataInicioNova}
                    onChange={(e) => setDataInicioNova(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="nova-edicao-data-fim"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Data de Término
                  </label>
                  <input
                    id="nova-edicao-data-fim"
                    type="date"
                    required
                    value={dataFimNova}
                    onChange={(e) => setDataFimNova(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <FormularioConfiguracao
                  formato={formatoNovo}
                  onFormatoChange={setFormatoNovo}
                  configuracao={configNovo}
                  onChange={setConfigNovo}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovaEdicaoAberto(false)}
                  disabled={salvandoEdicao}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {salvandoEdicao && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Salvar Edição</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
