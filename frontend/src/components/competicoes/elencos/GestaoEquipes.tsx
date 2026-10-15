'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Copy,
  ChevronDown,
  ChevronUp,
  UserPlus,
  AlertCircle,
  Loader2,
  Shield,
  User,
  X,
} from 'lucide-react';
import GavetaIntegrante from './GavetaIntegrante';
import CopiarElenco from './CopiarElenco';
import { competicoesService, isErroApi } from '@/services/competicoes';
import type { EquipeDetalhe, IntegranteDetalhe, EstadoEdicao } from '@/types/competicoes';

interface GestaoEquipesProps {
  idEdicaoCompeticao: number;
}

export default function GestaoEquipes({ idEdicaoCompeticao }: GestaoEquipesProps) {
  const [equipes, setEquipes] = useState<EquipeDetalhe[]>([]);
  const [estadoEdicao, setEstadoEdicao] = useState<EstadoEdicao>('RASCUNHO');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Expansão de equipes (quais mostram seus integrantes)
  const [equipesExpandidas, setEquipesExpandidas] = useState<Set<number>>(new Set());

  // Modal de Nova Equipe
  const [modalNovaEquipeAberta, setModalNovaEquipeAberta] = useState(false);
  const [nomeNovaEquipe, setNomeNovaEquipe] = useState('');
  const [siglaNovaEquipe, setSiglaNovaEquipe] = useState('');
  const [criandoEquipe, setCriandoEquipe] = useState(false);
  const [erroNovaEquipe, setErroNovaEquipe] = useState<string | null>(null);

  // Gaveta de Integrante
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [equipeSelecionada, setEquipeSelecionada] = useState<EquipeDetalhe | null>(null);
  const [integranteParaEditar, setIntegranteParaEditar] = useState<IntegranteDetalhe | null>(null);

  // Modal de Copiar Elenco
  const [modalCopiarAberta, setModalCopiarAberta] = useState(false);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      // Carrega equipes e estado da edição
      const [listaEquipes, edicao] = await Promise.all([
        competicoesService.listarEquipes(idEdicaoCompeticao),
        competicoesService.obterEdicao(idEdicaoCompeticao).catch(() => null),
      ]);

      setEquipes(listaEquipes || []);
      if (edicao) {
        setEstadoEdicao(edicao.estado);
      }


    } catch (err) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else {
        setErro('Erro ao carregar equipes da edição.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const toggleExpansao = (idEquipe: number) => {
    setEquipesExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(idEquipe)) {
        next.delete(idEquipe);
      } else {
        next.add(idEquipe);
      }
      return next;
    });
  };

  const abrirGavetaNovoIntegrante = (equipe: EquipeDetalhe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEquipeSelecionada(equipe);
    setIntegranteParaEditar(null);
    setGavetaAberta(true);
    // Garante que a equipe fique expandida
    setEquipesExpandidas((prev) => new Set(prev).add(equipe.id_equipe));
  };

  const abrirGavetaEditarIntegrante = (equipe: EquipeDetalhe, integrante: IntegranteDetalhe) => {
    setEquipeSelecionada(equipe);
    setIntegranteParaEditar(integrante);
    setGavetaAberta(true);
  };

  const handleCriarEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovaEquipe.trim()) {
      setErroNovaEquipe('O nome da equipe é obrigatório.');
      return;
    }

    setCriandoEquipe(true);
    setErroNovaEquipe(null);

    try {
      const nova = await competicoesService.criarEquipe(idEdicaoCompeticao, {
        nome: nomeNovaEquipe.trim(),
        sigla: siglaNovaEquipe.trim() || undefined,
      });

      setNomeNovaEquipe('');
      setSiglaNovaEquipe('');
      setModalNovaEquipeAberta(false);

      await carregarDados();
      // Expande a nova equipe criada
      setEquipesExpandidas((prev) => new Set(prev).add(nova.id_equipe));
    } catch (err) {
      if (isErroApi(err)) {
        setErroNovaEquipe(err.mensagem);
      } else {
        setErroNovaEquipe('Erro ao criar equipe na edição.');
      }
    } finally {
      setCriandoEquipe(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra Superior de Ações */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <Users className="text-indigo-600" size={24} />
            Equipes e Elencos
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            {equipes.length} equipe(s) cadastrada(s) nesta edição
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalCopiarAberta(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Copy size={16} />
            Copiar Elenco
          </button>

          <button
            type="button"
            onClick={() => {
              setErroNovaEquipe(null);
              setModalNovaEquipeAberta(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus size={16} />
            Nova Equipe
          </button>
        </div>
      </div>

      {/* Alerta de Erro */}
      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={carregarDados}
            className="text-xs font-semibold text-red-800 hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Estado Carregando */}
      {carregando && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-3">
          <Loader2 size={28} className="animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm">Carregando equipes e elencos...</p>
        </div>
      )}

      {/* Estado Vazio */}
      {!carregando && equipes.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
            <Shield size={32} />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-800">Nenhuma equipe cadastrada</h3>
            <p className="text-slate-500 text-xs mt-1">
              Cadastre a primeira equipe desta edição ou copie os elencos de uma edição anterior.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalCopiarAberta(true)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Copy size={14} />
              Copiar Elenco Anterior
            </button>
            <button
              type="button"
              onClick={() => setModalNovaEquipeAberta(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus size={14} />
              Criar Nova Equipe
            </button>
          </div>
        </div>
      )}

      {/* Lista de Equipes Accordion / Cards */}
      {!carregando && equipes.length > 0 && (
        <div className="space-y-4">
          {equipes.map((equipe) => {
            const isExpandida = equipesExpandidas.has(equipe.id_equipe);
            const totalIntegrantes = equipe.integrantes?.length || 0;
            const integrantesAtivos =
              equipe.integrantes?.filter((i) => i.situacao === 'ATIVO').length || 0;

            return (
              <div
                key={equipe.id_equipe}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Cabeçalho da Equipe */}
                <div
                  onClick={() => toggleExpansao(equipe.id_equipe)}
                  className="p-5 flex items-center justify-between cursor-pointer select-none bg-slate-50/40 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                      {equipe.sigla || equipe.nome.slice(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-800 flex items-center gap-2">
                        {equipe.nome}
                        {equipe.sigla && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                            {equipe.sigla}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {totalIntegrantes} integrante(s) ({integrantesAtivos} ativo{integrantesAtivos !== 1 ? 's' : ''})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`Adicionar integrante na equipe ${equipe.nome}`}
                      data-testid={`btn-add-integrante-${equipe.id_equipe}`}
                      onClick={(e) => abrirGavetaNovoIntegrante(equipe, e)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <UserPlus size={14} />
                      Adicionar Integrante
                    </button>

                    <button
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                      {isExpandida ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {/* Tabela de Integrantes da Equipe Expandida */}
                {isExpandida && (
                  <div className="border-t border-slate-200 p-5 bg-white">
                    {totalIntegrantes === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm space-y-2">
                        <User size={24} className="mx-auto text-slate-300" />
                        <p>Nenhum integrante inscrito nesta equipe.</p>
                        <button
                          type="button"
                          onClick={() => abrirGavetaNovoIntegrante(equipe)}
                          className="text-indigo-600 hover:underline text-xs font-semibold"
                        >
                          Adicionar o primeiro atleta
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                              <th className="py-2.5 px-3">Camisa</th>
                              <th className="py-2.5 px-3">Nome Esportivo</th>
                              <th className="py-2.5 px-3">Posição</th>
                              <th className="py-2.5 px-3">Situação</th>
                              <th className="py-2.5 px-3 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {equipe.integrantes.map((integrante) => (
                              <tr
                                key={integrante.id_integrante}
                                className="hover:bg-slate-50/70 transition-colors"
                              >
                                <td className="py-2.5 px-3 font-bold text-slate-800">
                                  {integrante.numero_camisa !== null
                                    ? `#${integrante.numero_camisa}`
                                    : '-'}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {integrante.nome_esportivo}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {integrante.posicao || '-'}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                      integrante.situacao === 'ATIVO'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {integrante.situacao}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      abrirGavetaEditarIntegrante(equipe, integrante)
                                    }
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                                  >
                                    Gerenciar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nova Equipe */}
      {modalNovaEquipeAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nova Equipe"
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 relative animate-in zoom-in-95"
          >
            <button
              type="button"
              onClick={() => setModalNovaEquipeAberta(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Plus size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Nova Equipe</h3>
                <p className="text-xs text-slate-500">Cadastrar equipe nesta edição esportiva</p>
              </div>
            </div>

            {erroNovaEquipe && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{erroNovaEquipe}</span>
              </div>
            )}

            <form onSubmit={handleCriarEquipe} className="space-y-4">
              <div>
                <label htmlFor="nome-equipe" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da equipe *
                </label>
                <input
                  id="nome-equipe"
                  type="text"
                  required
                  value={nomeNovaEquipe}
                  onChange={(e) => setNomeNovaEquipe(e.target.value)}
                  placeholder="Ex: Falcões Dourados"
                  aria-label="Nome da equipe"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="sigla-equipe" className="block text-xs font-semibold text-slate-700 mb-1">
                  Sigla (opcional)
                </label>
                <input
                  id="sigla-equipe"
                  type="text"
                  maxLength={10}
                  value={siglaNovaEquipe}
                  onChange={(e) => setSiglaNovaEquipe(e.target.value.toUpperCase())}
                  placeholder="Ex: FAL"
                  aria-label="Sigla"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovaEquipeAberta(false)}
                  disabled={criandoEquipe}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criandoEquipe || !nomeNovaEquipe.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors"
                >
                  {criandoEquipe && <Loader2 size={16} className="animate-spin" />}
                  Criar Equipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gaveta de Inscrição / Detalhes de Integrante */}
      {equipeSelecionada && (
        <GavetaIntegrante
          equipe={equipeSelecionada}
          isOpen={gavetaAberta}
          integranteParaEditar={integranteParaEditar}
          onClose={() => {
            setGavetaAberta(false);
            setEquipeSelecionada(null);
            setIntegranteParaEditar(null);
          }}
          onSalvo={() => {
            carregarDados();
          }}
        />
      )}

      {/* Diálogo de Copiar Elenco */}
      <CopiarElenco
        idEdicaoCompeticao={idEdicaoCompeticao}
        estadoEdicao={estadoEdicao}
        isOpen={modalCopiarAberta}
        onClose={() => setModalCopiarAberta(false)}
        onCopiado={() => {
          carregarDados();
        }}
      />
    </div>
  );
}
