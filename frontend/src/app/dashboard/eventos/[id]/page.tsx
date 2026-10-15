'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Calendar,
  ArrowLeft,
  Plus,
  AlertCircle,
  RefreshCw,
  Loader2,
  Trophy,
  X,
} from 'lucide-react';
import {
  obterEvento,
  criarEdicaoEvento,
  isErroApi,
} from '@/services/competicoes';
import type { EventoDetalhe } from '@/types/competicoes';
import ModalNovaCompeticao from '@/components/competicoes/organizacao/ModalNovaCompeticao';

export default function EventoDetalhePage() {
  const params = useParams();
  const idEvento = Number(params?.id);

  const [evento, setEvento] = useState<EventoDetalhe | null>(null);
  const [edicaoEventoSelecionadaId, setEdicaoEventoSelecionadaId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal Nova Edição do Evento
  const [modalNovaEdicaoAberto, setModalNovaEdicaoAberto] = useState(false);
  const [identificacaoEdicao, setIdentificacaoEdicao] = useState('');
  const [dataInicioEdicao, setDataInicioEdicao] = useState('');
  const [dataFimEdicao, setDataFimEdicao] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  // Modal Adicionar Competição
  const [modalAdicionarCompeticaoAberto, setModalAdicionarCompeticaoAberto] = useState(false);

  const carregarEvento = useCallback(async () => {
    if (isNaN(idEvento)) {
      setErro('ID de evento inválido.');
      setCarregando(false);
      return;
    }
    try {
      setCarregando(true);
      setErro(null);
      const dados = await obterEvento(idEvento);
      setEvento(dados);
      if (dados.edicoes && dados.edicoes.length > 0) {
        setEdicaoEventoSelecionadaId((prev) => {
          if (prev && dados.edicoes.some((e) => e.id_edicao_evento === prev)) {
            return prev;
          }
          return dados.edicoes[dados.edicoes.length - 1].id_edicao_evento;
        });
      }
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar detalhes do evento.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEvento]);

  useEffect(() => {
    carregarEvento();
  }, [carregarEvento]);

  const handleCriarEdicaoEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificacaoEdicao.trim() || !dataInicioEdicao || !dataFimEdicao) {
      setErroEdicao('Preencha todos os campos obrigatórios da edição.');
      return;
    }
    try {
      setSalvandoEdicao(true);
      setErroEdicao(null);
      const novaEdicao = await criarEdicaoEvento(idEvento, {
        identificacao: identificacaoEdicao.trim(),
        data_inicio: dataInicioEdicao,
        data_fim: dataFimEdicao,
      });

      setModalNovaEdicaoAberto(false);
      setIdentificacaoEdicao('');
      setDataInicioEdicao('');
      setDataFimEdicao('');
      await carregarEvento();
      setEdicaoEventoSelecionadaId(novaEdicao.id_edicao_evento);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroEdicao(err.mensagem);
      } else if (err instanceof Error) {
        setErroEdicao(err.message);
      } else {
        setErroEdicao('Falha ao criar nova edição do evento.');
      }
    } finally {
      setSalvandoEdicao(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm text-slate-500">Carregando detalhes do evento...</p>
      </div>
    );
  }

  if (erro || !evento) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-red-800">Erro ao carregar evento</h3>
          <p className="text-sm text-red-600 max-w-md mx-auto">{erro}</p>
          <div className="flex justify-center gap-3">
            <Link
              href="/dashboard/eventos"
              className="px-4 py-2 border border-slate-300 bg-white rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
            >
              Voltar para eventos
            </Link>
            <button
              type="button"
              onClick={carregarEvento}
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

  const edicaoAtiva = evento.edicoes.find(
    (e) => e.id_edicao_evento === edicaoEventoSelecionadaId
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Navegação e Cabeçalho */}
      <div>
        <Link
          href="/dashboard/eventos"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para eventos</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-600" />
              {evento.nome}
            </h1>
            {evento.descricao && (
              <p className="text-sm text-slate-500 mt-1">{evento.descricao}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setModalNovaEdicaoAberto(true)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Adicionar edição de evento</span>
            </button>
            <button
              type="button"
              onClick={() => setModalAdicionarCompeticaoAberto(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition flex items-center gap-2 shadow-sm"
            >
              <Trophy className="w-4 h-4" />
              <span>Adicionar competição</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lista / Seletor de Edições do Evento */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Edições Registradas do Evento
        </h3>

        {evento.edicoes && evento.edicoes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evento.edicoes.map((ed) => {
              const selecionada = ed.id_edicao_evento === edicaoEventoSelecionadaId;
              return (
                <div
                  key={ed.id_edicao_evento}
                  onClick={() => setEdicaoEventoSelecionadaId(ed.id_edicao_evento)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    selecionada
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <strong className="text-base text-slate-800">{ed.identificacao}</strong>
                    {selecionada && (
                      <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                        Ativa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">
                    Período: {ed.data_inicio} até {ed.data_fim}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">
            Nenhuma edição cadastrada para este evento.
          </p>
        )}
      </div>

      {/* Detalhe da Edição Ativa */}
      {edicaoAtiva && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Competições vinculadas a {edicaoAtiva.identificacao}
              </h3>
              <p className="text-xs text-slate-500">
                Período oficial: {edicaoAtiva.data_inicio} até {edicaoAtiva.data_fim}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setModalAdicionarCompeticaoAberto(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Vincular competição</span>
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Todas as competições criadas nesta edição devem respeitar o período do evento ({edicaoAtiva.data_inicio} a {edicaoAtiva.data_fim}).
          </p>
        </div>
      )}

      {/* Modal Adicionar Edição de Evento */}
      {modalNovaEdicaoAberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edicao-evento-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h2 id="modal-edicao-evento-titulo" className="text-xl font-bold text-slate-800">
                Nova Edição do Evento
              </h2>
              <button
                type="button"
                onClick={() => setModalNovaEdicaoAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {erroEdicao && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                <span>{erroEdicao}</span>
              </div>
            )}

            <form onSubmit={handleCriarEdicaoEvento} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="edicao-evento-identificacao"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Identificação da Edição
                </label>
                <input
                  id="edicao-evento-identificacao"
                  type="text"
                  required
                  placeholder="Ex: 2027 ou 2ª Edição"
                  value={identificacaoEdicao}
                  onChange={(e) => setIdentificacaoEdicao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edicao-evento-inicio"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Data de Início
                  </label>
                  <input
                    id="edicao-evento-inicio"
                    type="date"
                    required
                    value={dataInicioEdicao}
                    onChange={(e) => setDataInicioEdicao(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edicao-evento-fim"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Data de Término
                  </label>
                  <input
                    id="edicao-evento-fim"
                    type="date"
                    required
                    value={dataFimEdicao}
                    onChange={(e) => setDataFimEdicao(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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

      {/* Modal Adicionar Competição ao Evento */}
      <ModalNovaCompeticao
        aberto={modalAdicionarCompeticaoAberto}
        onClose={() => setModalAdicionarCompeticaoAberto(false)}
        onSuccess={() => {
          setModalAdicionarCompeticaoAberto(false);
          carregarEvento();
        }}
        idEdicaoEventoInicial={edicaoEventoSelecionadaId}
      />
    </div>
  );
}
