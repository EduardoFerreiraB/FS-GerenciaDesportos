'use client';

import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertTriangle, AlertCircle, CheckCircle2, User, UserX, Loader2 } from 'lucide-react';
import BuscaCompetidor from './BuscaCompetidor';
import ImportarAluno from './ImportarAluno';
import { competicoesService, isErroApi } from '@/services/competicoes';
import type { EquipeDetalhe, IntegranteDetalhe, CompetidorDetalhe } from '@/types/competicoes';

interface GavetaIntegranteProps {
  equipe: EquipeDetalhe;
  isOpen: boolean;
  onClose: () => void;
  onSalvo: () => void;
  integranteParaEditar?: IntegranteDetalhe | null;
}

export default function GavetaIntegrante({
  equipe,
  isOpen,
  onClose,
  onSalvo,
  integranteParaEditar,
}: GavetaIntegranteProps) {
  const [competidorSelecionado, setCompetidorSelecionado] = useState<CompetidorDetalhe | null>(null);
  const [nomeEsportivo, setNomeEsportivo] = useState('');
  const [numeroCamisa, setNumeroCamisa] = useState<string>('');
  const [posicao, setPosicao] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [inativando, setInativando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abaOrigem, setAbaOrigem] = useState<'busca' | 'importar'>('busca');

  // Inicializa estado quando abrir
  useEffect(() => {
    if (isOpen) {
      setErro(null);
      if (integranteParaEditar) {
        setNomeEsportivo(integranteParaEditar.nome_esportivo);
        setNumeroCamisa(
          integranteParaEditar.numero_camisa !== null && integranteParaEditar.numero_camisa !== undefined
            ? String(integranteParaEditar.numero_camisa)
            : ''
        );
        setPosicao(integranteParaEditar.posicao || '');
      } else {
        setCompetidorSelecionado(null);
        setNomeEsportivo('');
        setNumeroCamisa('');
        setPosicao('');
        setAbaOrigem('busca');
      }
    }
  }, [isOpen, integranteParaEditar]);

  if (!isOpen) return null;

  // Regra de camisa repetida na equipe
  const camisaNumero = numeroCamisa.trim() !== '' ? parseInt(numeroCamisa, 10) : null;
  const isCamisaRepetida =
    camisaNumero !== null &&
    !isNaN(camisaNumero) &&
    equipe.integrantes.some(
      (i) =>
        i.situacao === 'ATIVO' &&
        i.numero_camisa === camisaNumero &&
        i.id_integrante !== integranteParaEditar?.id_integrante
    );

  const handleSelectCompetidor = (c: CompetidorDetalhe) => {
    setCompetidorSelecionado(c);
    setNomeEsportivo(c.nome);
    setErro(null);
  };

  const handleSalvarInscricao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!integranteParaEditar && !competidorSelecionado) {
      setErro('Selecione ou cadastre um competidor para inscrever na equipe.');
      return;
    }
    if (!nomeEsportivo.trim()) {
      setErro('O nome esportivo é obrigatório.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      if (integranteParaEditar) {
        // Modo de visualização/edição: caso a API suporte edição futura
        onSalvo();
        onClose();
      } else if (competidorSelecionado) {
        await competicoesService.inscreverIntegrante(equipe.id_equipe, {
          id_competidor: competidorSelecionado.id_competidor,
          nome_esportivo: nomeEsportivo.trim(),
          numero_camisa: camisaNumero,
          posicao: posicao.trim() || undefined,
        });
        onSalvo();
        onClose();
      }
    } catch (err) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else {
        setErro('Erro ao inscrever integrante na equipe.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleInativarIntegrante = async () => {
    if (!integranteParaEditar) return;
    setInativando(true);
    setErro(null);

    try {
      await competicoesService.inativarIntegrante(integranteParaEditar.id_integrante);
      onSalvo();
      onClose();
    } catch (err) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else {
        setErro('Erro ao inativar integrante.');
      }
    } finally {
      setInativando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={integranteParaEditar ? 'Detalhes do Integrante' : 'Adicionar Integrante'}
        className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300"
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <UserPlus size={20} className="text-indigo-600" />
              {integranteParaEditar ? 'Detalhes do Integrante' : 'Adicionar Integrante'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Equipe: <span className="font-semibold text-slate-700">{equipe.nome}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Modo: Integrante Existente (Visualização / Inativação) */}
          {integranteParaEditar ? (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-base font-bold text-slate-800">
                    {integranteParaEditar.nome_esportivo}
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      integranteParaEditar.situacao === 'ATIVO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {integranteParaEditar.situacao}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <span className="font-medium text-slate-400 block">Camisa:</span>
                    <span className="text-sm font-semibold text-slate-700">
                      {integranteParaEditar.numero_camisa !== null
                        ? `#${integranteParaEditar.numero_camisa}`
                        : 'Sem número'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-400 block">Posição:</span>
                    <span className="text-sm font-semibold text-slate-700">
                      {integranteParaEditar.posicao || 'Não definida'}
                    </span>
                  </div>
                </div>
              </div>

              {integranteParaEditar.situacao === 'ATIVO' && (
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={inativando}
                    onClick={handleInativarIntegrante}
                    className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    {inativando ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <UserX size={16} />
                    )}
                    Inativar Integrante da Equipe
                  </button>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    O integrante será marcado como inativo, preservando o histórico de jogos e súmulas.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Modo: Novo Integrante */
            <form onSubmit={handleSalvarInscricao} className="space-y-6">
              {/* Seção 1: Seleção do Competidor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Selecionar Atleta
                </label>

                {competidorSelecionado ? (
                  <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        <User size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-indigo-900">
                          {competidorSelecionado.nome}
                        </div>
                        <div className="text-xs text-indigo-700">
                          {competidorSelecionado.id_aluno_origem
                            ? 'Aluno Escolar Importado'
                            : 'Competidor Comunitário (Terceiro)'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCompetidorSelecionado(null)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex border-b border-slate-200">
                      <button
                        type="button"
                        role="tab"
                        onClick={() => setAbaOrigem('busca')}
                        className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                          abaOrigem === 'busca'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Buscar / Novo Terceiro
                      </button>
                      <button
                        type="button"
                        role="tab"
                        onClick={() => setAbaOrigem('importar')}
                        className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                          abaOrigem === 'importar'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Importar Aluno da Escola
                      </button>
                    </div>

                    {abaOrigem === 'busca' ? (
                      <BuscaCompetidor
                        onSelectCompetidor={handleSelectCompetidor}
                        competidorSelecionado={competidorSelecionado}
                      />
                    ) : (
                      <ImportarAluno onAlunoImportado={handleSelectCompetidor} />
                    )}
                  </div>
                )}
              </div>

              {/* Seção 2: Dados de Inscrição na Equipe */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Dados da Inscrição na Equipe
                </label>

                <div>
                  <label htmlFor="nome-esportivo" className="block text-xs font-medium text-slate-700 mb-1">
                    Nome Esportivo (na camisa / súmula) *
                  </label>
                  <input
                    id="nome-esportivo"
                    type="text"
                    required
                    value={nomeEsportivo}
                    onChange={(e) => setNomeEsportivo(e.target.value)}
                    placeholder="Ex: Romário, Ronaldinho"
                    aria-label="Nome esportivo"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="numero-camisa" className="block text-xs font-medium text-slate-700 mb-1">
                      Número da Camisa
                    </label>
                    <input
                      id="numero-camisa"
                      type="number"
                      min="0"
                      max="999"
                      value={numeroCamisa}
                      onChange={(e) => setNumeroCamisa(e.target.value)}
                      placeholder="Ex: 10"
                      aria-label="Número da camisa"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="posicao" className="block text-xs font-medium text-slate-700 mb-1">
                      Posição
                    </label>
                    <input
                      id="posicao"
                      type="text"
                      value={posicao}
                      onChange={(e) => setPosicao(e.target.value)}
                      placeholder="Ex: Atacante, Goleiro"
                      aria-label="Posição"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Regra de camisa repetida: Aviso visual amigável sem bloqueio */}
                {isCamisaRepetida && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2.5">
                    <AlertTriangle size={18} className="shrink-0 text-amber-600" />
                    <div>
                      <span className="font-semibold">Número repetido na equipe:</span> Outro atleta
                      desta equipe já está registrado com o número {camisaNumero}. A numeração
                      duplicada é permitida pelas regras da competição, mas certifique-se da
                      identificação correta na súmula.
                    </div>
                  </div>
                )}
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando || !competidorSelecionado || !nomeEsportivo.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
                >
                  {salvando && <Loader2 size={16} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
