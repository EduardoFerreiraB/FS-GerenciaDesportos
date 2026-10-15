'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { 
  Users, 
  Clock, 
  Trophy, 
  Award, 
  Plus, 
  Search, 
  Trash2, 
  Pencil, 
  ChevronRight, 
  Calendar, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  UserCheck, 
  Hash, 
  AlertTriangle 
} from 'lucide-react';
import { Competicao, Prova, InscricaoIndividual, ResultadoProva } from '@/types/competicoes';
import { competicaoService } from '@/services/competicoes';
import ModalInscricaoIndividual from './ModalInscricaoIndividual';
import ModalProvaForm from './ModalProvaForm';
import ModalLancarResultadoProva from './ModalLancarResultadoProva';
import TabelaClassificacaoProva from './TabelaClassificacaoProva';
import QuadroMedalhasCompeticao from './QuadroMedalhasCompeticao';

interface Props {
  competicao: Competicao;
  mutateCompeticao: () => Promise<any>;
}

export default function CompeticaoIndividuaisView({ competicao, mutateCompeticao }: Props) {
  const idCompeticao = competicao.id_competicao;

  // Abas principais
  const [activeTab, setActiveTab] = useState<'atletas' | 'provas' | 'resultados' | 'medalhas'>('atletas');

  // Filtros de busca
  const [buscaAtleta, setBuscaAtleta] = useState('');
  const [buscaProva, setBuscaProva] = useState('');

  // Prova selecionada na aba de Resultados
  const [idProvaSelecionada, setIdProvaSelecionada] = useState<number | null>(null);

  // Estados de Modais
  const [isModalInscricaoOpen, setIsModalInscricaoOpen] = useState(false);
  const [isModalProvaOpen, setIsModalProvaOpen] = useState(false);
  const [provaParaEditar, setProvaParaEditar] = useState<Prova | null>(null);

  const [isModalResultadoOpen, setIsModalResultadoOpen] = useState(false);
  const [resultadoParaEditar, setResultadoParaEditar] = useState<ResultadoProva | null>(null);
  const [provaParaResultado, setProvaParaResultado] = useState<Prova | null>(null);

  // Feedback de notificações
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSucessoMsg(msg);
    setTimeout(() => setSucessoMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErroMsg(msg);
    setTimeout(() => setErroMsg(null), 5000);
  };

  // Carregamento de Inscrições
  const { 
    data: inscricoes = [], 
    isLoading: loadingInscricoes, 
    mutate: mutateInscricoes 
  } = useSWR<InscricaoIndividual[]>(
    idCompeticao ? `/competicoes/${idCompeticao}/inscricoes` : null,
    () => competicaoService.listarInscricoes(idCompeticao)
  );

  // Carregamento de Provas
  const { 
    data: provas = [], 
    isLoading: loadingProvas, 
    mutate: mutateProvas 
  } = useSWR<Prova[]>(
    idCompeticao ? `/competicoes/${idCompeticao}/provas` : null,
    () => competicaoService.listarProvas(idCompeticao)
  );

  // Prova ativa para a aba de resultados
  const provaAtiva = useMemo(() => {
    if (!provas || provas.length === 0) return null;
    if (idProvaSelecionada) {
      const encontrada = provas.find(p => p.id_prova === idProvaSelecionada);
      if (encontrada) return encontrada;
    }
    return provas[0];
  }, [provas, idProvaSelecionada]);

  // Filtragem de Atletas
  const inscricoesFiltradas = useMemo(() => {
    if (!buscaAtleta.trim()) return inscricoes;
    const termo = buscaAtleta.toLowerCase();
    return inscricoes.filter(i => {
      const nome = i.participante?.atleta?.nome_completo || i.participante?.aluno?.nome_completo || '';
      const peito = i.numero_peito ? i.numero_peito.toString() : '';
      return nome.toLowerCase().includes(termo) || peito.includes(termo);
    });
  }, [inscricoes, buscaAtleta]);

  // Filtragem de Provas
  const provasFiltradas = useMemo(() => {
    if (!buscaProva.trim()) return provas;
    const termo = buscaProva.toLowerCase();
    return provas.filter(p => p.nome.toLowerCase().includes(termo));
  }, [provas, buscaProva]);

  // Exclusão de Inscrição
  const handleRemoverInscricao = async (idParticipante: number, nomeAtleta: string) => {
    if (!confirm(`Deseja realmente remover a inscrição de "${nomeAtleta}" desta competição?`)) {
      return;
    }

    try {
      await competicaoService.removerInscricao(idCompeticao, idParticipante);
      await mutateInscricoes();
      showSuccess('Inscrição removida com sucesso!');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao remover inscrição.';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  // Exclusão de Prova
  const handleExcluirProva = async (idProva: number, nomeProva: string) => {
    if (!confirm(`Deseja realmente excluir a prova "${nomeProva}" e todos os seus resultados?`)) {
      return;
    }

    try {
      await competicaoService.excluirProva(idProva);
      await mutateProvas();
      if (idProvaSelecionada === idProva) {
        setIdProvaSelecionada(null);
      }
      showSuccess('Prova excluída com sucesso!');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao excluir prova.';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  // Exclusão de Resultado
  const handleExcluirResultado = async (idResultado: number) => {
    try {
      await competicaoService.excluirResultado(idResultado, provaAtiva?.id_prova);
      await mutateProvas();
      showSuccess('Resultado removido com sucesso!');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao remover resultado.';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  // Atalho para abrir modal de resultado
  const handleAbrirLancarResultado = (p: Prova) => {
    setProvaParaResultado(p);
    setResultadoParaEditar(null);
    setIsModalResultadoOpen(true);
  };

  const handleAbrirEditarResultado = (p: Prova, r: ResultadoProva) => {
    setProvaParaResultado(p);
    setResultadoParaEditar(r);
    setIsModalResultadoOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Notificações */}
      {sucessoMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 size={20} className="shrink-0" />
          <span className="text-sm font-semibold">{sucessoMsg}</span>
        </div>
      )}
      {erroMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-3 animate-in fade-in">
          <AlertCircle size={20} className="shrink-0" />
          <span className="text-sm font-semibold">{erroMsg}</span>
        </div>
      )}

      {/* Navegação por Abas Principais */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-4">
        {/* Aba 1: Atletas Inscritos */}
        <button
          onClick={() => setActiveTab('atletas')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'atletas'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'
          }`}
        >
          <Users size={16} />
          Atletas Inscritos
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'atletas' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {inscricoes.length}
          </span>
        </button>

        {/* Aba 2: Provas */}
        <button
          onClick={() => setActiveTab('provas')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'provas'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'
          }`}
        >
          <Clock size={16} />
          Provas Individuais
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'provas' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {provas.length}
          </span>
        </button>

        {/* Aba 3: Resultados e Pódios */}
        <button
          onClick={() => setActiveTab('resultados')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'resultados'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'
          }`}
        >
          <Award size={16} />
          Resultados e Pódios
        </button>

        {/* Aba 4: Quadro Geral de Medalhas */}
        <button
          onClick={() => setActiveTab('medalhas')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'medalhas'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'
          }`}
        >
          <Trophy size={16} />
          Quadro Geral de Medalhas
        </button>
      </div>

      {/* ========================================================================= */}
      {/* CONTEÚDO ABA 1: ATLETAS INSCRITOS */}
      {/* ========================================================================= */}
      {activeTab === 'atletas' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <UserCheck className="text-purple-600" size={22} />
                  Atletas Inscritos na Competição
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atletas aptos a disputar as provas desta competição individual.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Campo de Busca */}
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome ou número..."
                    value={buscaAtleta}
                    onChange={e => setBuscaAtleta(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>

                <button
                  onClick={() => setIsModalInscricaoOpen(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-100 shrink-0 cursor-pointer"
                >
                  <Plus size={16} />
                  Inscrever Atleta
                </button>
              </div>
            </div>

            {loadingInscricoes ? (
              <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
                <Loader2 size={20} className="animate-spin text-purple-600" />
                <span className="text-xs font-medium">Carregando inscrições...</span>
              </div>
            ) : inscricoes.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Users size={32} />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">
                  Nenhum atleta inscrito ainda
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                  Inscreva os participantes para que possam disputar as provas e registrar seus tempos.
                </p>
                <button
                  onClick={() => setIsModalInscricaoOpen(true)}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-purple-100 transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  Inscrever Primeiro Atleta
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-6">Nº de Peito</th>
                      <th className="py-3.5 px-6">Atleta / Participante</th>
                      <th className="py-3.5 px-6">Categoria / Tipo</th>
                      <th className="py-3.5 px-6">Documento / Info</th>
                      <th className="py-3.5 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {inscricoesFiltradas.map(inscricao => {
                      const atleta = inscricao.participante?.atleta;
                      const aluno = inscricao.participante?.aluno;
                      const nome = atleta?.nome_completo || aluno?.nome_completo || `Atleta #${inscricao.id_participante}`;
                      const tipo = inscricao.participante?.tipo || 'atleta';

                      return (
                        <tr key={inscricao.id_inscricao} className="hover:bg-slate-50/80 transition-colors">
                          {/* Número de Peito */}
                          <td className="py-4 px-6 whitespace-nowrap">
                            {inscricao.numero_peito ? (
                              <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200/80 rounded-xl font-mono font-bold text-xs flex items-center gap-1 w-fit">
                                <Hash size={12} />
                                {inscricao.numero_peito}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                Sem dorsal
                              </span>
                            )}
                          </td>

                          {/* Atleta */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {nome.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-900">
                                {nome}
                              </span>
                            </div>
                          </td>

                          {/* Tipo */}
                          <td className="py-4 px-6 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                tipo === 'aluno'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {tipo === 'aluno' ? 'Aluno da Rede' : 'Atleta Externo'}
                            </span>
                          </td>

                          {/* Data de Nascimento / Info */}
                          <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                            {atleta?.data_nascimento || aluno?.data_nascimento
                              ? `Nascimento: ${new Date(atleta?.data_nascimento || aluno?.data_nascimento || '').toLocaleDateString()}`
                              : '-'}
                          </td>

                          {/* Ações */}
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleRemoverInscricao(inscricao.id_participante, nome)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Remover Inscrição"
                            >
                              <Trash2 size={16} />
                            </button>
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

      {/* ========================================================================= */}
      {/* CONTEÚDO ABA 2: PROVAS INDIVIDUAIS */}
      {/* ========================================================================= */}
      {activeTab === 'provas' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="text-purple-600" size={22} />
                  Provas da Competição
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Baterias e modalidades individuais programadas para este evento.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Campo de Busca */}
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar prova..."
                    value={buscaProva}
                    onChange={e => setBuscaProva(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>

                <button
                  onClick={() => {
                    setProvaParaEditar(null);
                    setIsModalProvaOpen(true);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-100 shrink-0 cursor-pointer"
                >
                  <Plus size={16} />
                  Nova Prova
                </button>
              </div>
            </div>

            {loadingProvas ? (
              <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
                <Loader2 size={20} className="animate-spin text-purple-600" />
                <span className="text-xs font-medium">Carregando provas...</span>
              </div>
            ) : provas.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Clock size={32} />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">
                  Nenhuma prova cadastrada nesta competição
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                  Cadastre as provas específicas (ex: 100 Metros Rasos, 50m Livre) para iniciar o registro dos tempos e classificação.
                </p>
                <button
                  onClick={() => {
                    setProvaParaEditar(null);
                    setIsModalProvaOpen(true);
                  }}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-purple-100 transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  Cadastrar Primeira Prova
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {provasFiltradas.map(prova => {
                  const qtdResultados = prova.resultados?.length || 0;
                  const statusColors: Record<string, string> = {
                    Agendada: 'bg-blue-50 text-blue-700 border-blue-200',
                    'Em Andamento': 'bg-amber-50 text-amber-700 border-amber-200',
                    Finalizada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    Cancelada: 'bg-rose-50 text-rose-700 border-rose-200',
                  };

                  return (
                    <div
                      key={prova.id_prova}
                      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-bold text-base text-slate-800 leading-snug">
                            {prova.nome}
                          </h4>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              statusColors[prova.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {prova.status}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-slate-500">
                          {prova.data && (
                            <div className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-slate-400" />
                              <span>{new Date(prova.data).toLocaleDateString()}</span>
                              {prova.hora && <span>às {prova.hora}</span>}
                            </div>
                          )}

                          {prova.local?.loca_nome && (
                            <div className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-slate-400" />
                              <span>{prova.local.loca_nome}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl">
                          {qtdResultados} {qtdResultados === 1 ? 'tempo registrado' : 'tempos registrados'}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setIdProvaSelecionada(prova.id_prova);
                              setActiveTab('resultados');
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Ver Resultados e Pódio"
                          >
                            Resultados
                            <ChevronRight size={14} />
                          </button>

                          <button
                            onClick={() => {
                              setProvaParaEditar(prova);
                              setIsModalProvaOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar Prova"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            onClick={() => handleExcluirProva(prova.id_prova, prova.nome)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir Prova"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONTEÚDO ABA 3: RESULTADOS E PÓDIOS */}
      {/* ========================================================================= */}
      {activeTab === 'resultados' && (
        <div className="space-y-6">
          {provas.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
              <Clock size={36} className="mx-auto text-purple-600 mb-3" />
              <h4 className="text-base font-bold text-slate-800 mb-1">
                Nenhuma prova disponível para lançamento de resultados
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                Crie as provas na aba &quot;Provas Individuais&quot; antes de homologar os tempos dos atletas.
              </p>
              <button
                onClick={() => setActiveTab('provas')}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-purple-100 transition-all cursor-pointer"
              >
                Ir para Provas
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Seletor de Provas */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
                    Selecionar Prova:
                  </label>
                  <select
                    value={provaAtiva ? provaAtiva.id_prova : ''}
                    onChange={e => setIdProvaSelecionada(Number(e.target.value))}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    {provas.map(p => (
                      <option key={p.id_prova} value={p.id_prova}>
                        {p.nome} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>

                {provaAtiva && (
                  <button
                    onClick={() => handleAbrirLancarResultado(provaAtiva)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-purple-100 transition-all cursor-pointer shrink-0"
                  >
                    <Plus size={15} />
                    Lançar Resultado nesta Prova
                  </button>
                )}
              </div>

              {/* Tabela e Pódio da Prova Selecionada */}
              {provaAtiva && (
                <TabelaClassificacaoProva
                  prova={provaAtiva}
                  onLancarResultado={() => handleAbrirLancarResultado(provaAtiva)}
                  onEditarResultado={resultado => handleAbrirEditarResultado(provaAtiva, resultado)}
                  onExcluirResultado={handleExcluirResultado}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONTEÚDO ABA 4: QUADRO GERAL DE MEDALHAS */}
      {/* ========================================================================= */}
      {activeTab === 'medalhas' && (
        <div className="space-y-6">
          <QuadroMedalhasCompeticao idCompeticao={idCompeticao} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAIS */}
      {/* ========================================================================= */}
      {/* Modal de Inscrição Individual */}
      <ModalInscricaoIndividual
        isOpen={isModalInscricaoOpen}
        onClose={() => setIsModalInscricaoOpen(false)}
        idCompeticao={idCompeticao}
        inscricoesAtuais={inscricoes}
        onSuccess={() => {
          mutateInscricoes();
          showSuccess('Atleta inscrito com sucesso!');
        }}
      />

      {/* Modal de Formulário de Prova */}
      <ModalProvaForm
        isOpen={isModalProvaOpen}
        onClose={() => {
          setIsModalProvaOpen(false);
          setProvaParaEditar(null);
        }}
        idCompeticao={idCompeticao}
        prova={provaParaEditar}
        onSuccess={() => {
          mutateProvas();
          showSuccess(provaParaEditar ? 'Prova atualizada com sucesso!' : 'Prova cadastrada com sucesso!');
        }}
      />

      {/* Modal de Lançar/Editar Resultado */}
      {provaParaResultado && (
        <ModalLancarResultadoProva
          isOpen={isModalResultadoOpen}
          onClose={() => {
            setIsModalResultadoOpen(false);
            setResultadoParaEditar(null);
            setProvaParaResultado(null);
          }}
          idProva={provaParaResultado.id_prova}
          nomeProva={provaParaResultado.nome}
          resultado={resultadoParaEditar}
          inscritos={inscricoes}
          resultadosExistentes={provaParaResultado.resultados || []}
          onSuccess={() => {
            mutateProvas();
            showSuccess(resultadoParaEditar ? 'Resultado atualizado com sucesso!' : 'Resultado registrado com sucesso!');
          }}
        />
      )}
    </div>
  );
}
