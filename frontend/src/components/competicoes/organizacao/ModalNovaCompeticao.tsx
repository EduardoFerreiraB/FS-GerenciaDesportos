'use client';

import React, { useState, useEffect } from 'react';
import { X, Trophy, AlertCircle, Loader2 } from 'lucide-react';
import {
  criarCompeticaoComEdicao,
  listarEventos,
  isErroApi,
} from '@/services/competicoes';
import { modalidadeService } from '@/services';
import type {
  CompeticaoDetalhe,
  FormatoCompeticao,
  Configuracao,
  EventoDetalhe,
} from '@/types/competicoes';
import FormularioConfiguracao, {
  criarConfiguracaoPadrao,
} from './FormularioConfiguracao';

interface ModalNovaCompeticaoProps {
  aberto: boolean;
  onClose: () => void;
  onSuccess: (competicao: CompeticaoDetalhe) => void;
  idEdicaoEventoInicial?: number | null;
}

interface ModalidadeItem {
  id_modalidade: number;
  nome: string;
}

export default function ModalNovaCompeticao({
  aberto,
  onClose,
  onSuccess,
  idEdicaoEventoInicial = null,
}: ModalNovaCompeticaoProps) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [idModalidade, setIdModalidade] = useState<number | ''>('');
  const [modalidades, setModalidades] = useState<ModalidadeItem[]>([]);

  // Primeira Edição
  const [identificacao, setIdentificacao] = useState('1ª Edição');
  const [categoria, setCategoria] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [formato, setFormato] = useState<FormatoCompeticao>('GRUPOS_MATA_MATA');
  const [configuracao, setConfiguracao] = useState<Configuracao>(
    criarConfiguracaoPadrao('GRUPOS_MATA_MATA')
  );

  // Vínculo com evento
  const [idEdicaoEvento, setIdEdicaoEvento] = useState<number | null>(
    idEdicaoEventoInicial
  );
  const [eventos, setEventos] = useState<EventoDetalhe[]>([]);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      modalidadeService
        .getAll()
        .then((res: unknown) => {
          const mods = Array.isArray(res) ? (res as ModalidadeItem[]) : [];
          setModalidades(mods);
          if (mods.length > 0) {
            setIdModalidade((prev) => (prev === '' ? mods[0].id_modalidade : prev));
          }
        })
        .catch(() => {});

      listarEventos({ tamanho: 100 })
        .then((res) => {
          setEventos(res.itens);
        })
        .catch(() => {});
    }
  }, [aberto]);

  useEffect(() => {
    if (idEdicaoEventoInicial !== undefined) {
      setIdEdicaoEvento(idEdicaoEventoInicial);
    }
  }, [idEdicaoEventoInicial]);

  if (!aberto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('O nome da competição é obrigatório.');
      return;
    }
    if (!idModalidade) {
      setErro('A modalidade é obrigatória.');
      return;
    }
    if (!identificacao.trim()) {
      setErro('A identificação da edição é obrigatória.');
      return;
    }
    if (!dataInicio || !dataFim) {
      setErro('As datas de início e término são obrigatórias.');
      return;
    }

    try {
      setCarregando(true);
      const novaCompeticao = await criarCompeticaoComEdicao({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        id_modalidade: Number(idModalidade),
        edicao: {
          identificacao: identificacao.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim,
          categoria: categoria.trim() || null,
          formato,
          configuracao,
          id_edicao_evento: idEdicaoEvento || null,
        },
      });
      onSuccess(novaCompeticao);
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Ocorreu um erro ao criar a competição.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-nova-competicao-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 id="modal-nova-competicao-titulo" className="text-xl font-bold">
              Nova Competição
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          {/* Identificação Geral da Competição */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="nome-competicao"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Nome da Competição
                </label>
                <input
                  id="nome-competicao"
                  type="text"
                  required
                  placeholder="Ex: Campeonato Municipal"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="modalidade-competicao"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Modalidade
                </label>
                <select
                  id="modalidade-competicao"
                  required
                  value={idModalidade}
                  onChange={(e) => setIdModalidade(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="" disabled>
                    Selecione a modalidade
                  </option>
                  {modalidades.map((mod) => (
                    <option key={mod.id_modalidade} value={mod.id_modalidade}>
                      {mod.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="descricao-competicao"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Descrição (Opcional)
              </label>
              <textarea
                id="descricao-competicao"
                rows={2}
                placeholder="Detalhes sobre a competição..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Vínculo Opcional com Evento Esportivo */}
            {eventos.length > 0 && !idEdicaoEventoInicial && (
              <div>
                <label
                  htmlFor="evento-vinculo"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Vincular a Edição de Evento (Opcional)
                </label>
                <select
                  id="evento-vinculo"
                  value={idEdicaoEvento ?? ''}
                  onChange={(e) =>
                    setIdEdicaoEvento(e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Nenhum (Competição Independente)</option>
                  {eventos.map((ev) =>
                    ev.edicoes.map((ed) => (
                      <option key={ed.id_edicao_evento} value={ed.id_edicao_evento}>
                        {ev.nome} - {ed.identificacao} ({ed.data_inicio} até {ed.data_fim})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Dados da Primeira Edição */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              Dados da Primeira Edição
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="identificacao-edicao"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Identificação da Edição
                </label>
                <input
                  id="identificacao-edicao"
                  type="text"
                  required
                  placeholder="Ex: 2026 ou 1ª Edição"
                  value={identificacao}
                  onChange={(e) => setIdentificacao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="categoria-edicao"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Categoria (Opcional)
                </label>
                <input
                  id="categoria-edicao"
                  type="text"
                  placeholder="Ex: Sub-17, Adulto Principal"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="data-inicio-edicao"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Data de Início
                </label>
                <input
                  id="data-inicio-edicao"
                  type="date"
                  required
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="data-fim-edicao"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Data de Término
                </label>
                <input
                  id="data-fim-edicao"
                  type="date"
                  required
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Configuração de Formato e Regras */}
            <div className="pt-2">
              <FormularioConfiguracao
                formato={formato}
                onFormatoChange={setFormato}
                configuracao={configuracao}
                onChange={setConfiguracao}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={carregando}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={carregando}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Criar Competição</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
