'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { 
  Users, 
  Swords, 
  Trophy, 
  Plus, 
  CalendarPlus, 
  Wand2, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Calendar, 
  MapPin, 
  User, 
  FileText, 
  Filter, 
  Sparkles,
  Layers,
  UploadCloud,
  FileCheck2
} from 'lucide-react';
import api from '@/lib/api';
import { competicaoService } from '@/services/competicoes';
import { 
  Competicao, 
  EquipeCompeticao, 
  Confronto, 
  ClassificacaoEquipesResponse 
} from '@/types/competicoes';
import ModalNovaEquipeCompeticao from './ModalNovaEquipeCompeticao';
import ModalConfrontoPlacar from './ModalConfrontoPlacar';
import ModalAgendarConfronto from './ModalAgendarConfronto';
import TabelaClassificacaoEquipes from './TabelaClassificacaoEquipes';
import ArvoreMataMata from './ArvoreMataMata';

interface Props {
  competicao: Competicao;
  mutateCompeticao: () => Promise<any>;
}

export default function CompeticaoEquipesView({ competicao, mutateCompeticao }: Props) {
  // Aba Ativa Principal
  const [activeTab, setActiveTab] = useState<'equipes' | 'confrontos' | 'classificacao'>('equipes');

  // Subaba da Classificação (relevante para Mata-Mata)
  const [subAbaMataMata, setSubAbaMataMata] = useState<'arvore' | 'tabela'>('arvore');

  // Estados dos Modais
  const [isNovaEquipeModalOpen, setIsNovaEquipeModalOpen] = useState(false);
  const [isAgendarConfrontoModalOpen, setIsAgendarConfrontoModalOpen] = useState(false);
  const [selectedConfrontoForPlacar, setSelectedConfrontoForPlacar] = useState<Confronto | null>(null);
  const [isGerarModalOpen, setIsGerarModalOpen] = useState(false);

  // Estados de Operação / Mensagens
  const [gerandoConfrontos, setGerandoConfrontos] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Filtros de Confrontos
  const [filtroFase, setFiltroFase] = useState<string>('');
  const [filtroGrupo, setFiltroGrupo] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');

  // Parâmetros do Modal de Geração Automática
  const [gerarDataInicio, setGerarDataInicio] = useState(
    competicao.data_inicio ? competicao.data_inicio.substring(0, 10) : ''
  );
  const [gerarHoraPadrao, setGerarHoraPadrao] = useState('14:00');
  const [gerarFaseInicial, setGerarFaseInicial] = useState('Quartas');

  // Busca de Dados via SWR
  const {
    data: equipes,
    isLoading: loadingEquipes,
    mutate: mutateEquipes,
  } = useSWR<EquipeCompeticao[]>(
    competicao.id_competicao ? `/competicoes/${competicao.id_competicao}/equipes` : null,
    () => competicaoService.listarEquipes(competicao.id_competicao)
  );

  const {
    data: confrontos,
    isLoading: loadingConfrontos,
    mutate: mutateConfrontos,
  } = useSWR<Confronto[]>(
    competicao.id_competicao ? `/competicoes/${competicao.id_competicao}/confrontos` : null,
    () => competicaoService.listarConfrontos(competicao.id_competicao)
  );

  const {
    data: classificacao,
    mutate: mutateClassificacao,
  } = useSWR<ClassificacaoEquipesResponse>(
    competicao.id_competicao ? `/competicoes/${competicao.id_competicao}/classificacao-equipes` : null,
    () => competicaoService.obterClassificacaoEquipes(competicao.id_competicao)
  );

  const exibirAlerta = (msg: string, tipo: 'sucesso' | 'erro') => {
    if (tipo === 'sucesso') {
      setMensagemSucesso(msg);
      setTimeout(() => setMensagemSucesso(null), 4500);
    } else {
      setMensagemErro(msg);
      setTimeout(() => setMensagemErro(null), 5500);
    }
  };

  // Exclusão de Equipe
  const handleExcluirEquipe = async (equipe: EquipeCompeticao) => {
    if (
      !confirm(
        `Deseja realmente remover a equipe "${equipe.nome}" da competição? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    try {
      await competicaoService.excluirEquipe(equipe.id_equipe);
      await mutateEquipes();
      await mutateClassificacao();
      exibirAlerta(`Equipe "${equipe.nome}" removida com sucesso!`, 'sucesso');
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        'Erro ao remover equipe. Verifique se ela possui confrontos já disputados.';
      exibirAlerta(typeof msg === 'string' ? msg : JSON.stringify(msg), 'erro');
    }
  };

  // Exclusão de Confronto
  const handleExcluirConfronto = async (confronto: Confronto) => {
    if (
      !confirm(
        `Deseja realmente excluir o confronto #${confronto.id_confronto}? Confrontos finalizados podem afetar a classificação.`
      )
    ) {
      return;
    }

    try {
      await competicaoService.excluirConfronto(confronto.id_confronto);
      await mutateConfrontos();
      await mutateClassificacao();
      exibirAlerta(`Confronto #${confronto.id_confronto} excluído com sucesso!`, 'sucesso');
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        'Erro ao excluir confronto. Apenas confrontos sem dependências ativas podem ser excluídos.';
      exibirAlerta(typeof msg === 'string' ? msg : JSON.stringify(msg), 'erro');
    }
  };

  // Geração Automática de Confrontos
  const handleConfirmarGerarConfrontos = async () => {
    if (competicao.status === 'RASCUNHO') {
      exibirAlerta(
        'A competição está em status RASCUNHO. Inicie a competição antes de gerar os confrontos.',
        'erro'
      );
      return;
    }

    if (!equipes || equipes.length < 2) {
      exibirAlerta(
        'É necessário cadastrar pelo menos 2 equipes para gerar os confrontos da competição.',
        'erro'
      );
      return;
    }

    setGerandoConfrontos(true);
    try {
      const payload: any = {};
      if (gerarDataInicio) payload.data_inicio = gerarDataInicio;
      if (gerarHoraPadrao) payload.hora_padrao = `${gerarHoraPadrao}:00`;
      if (competicao.formato === 'MATA_MATA' && gerarFaseInicial) {
        payload.fase_inicial = gerarFaseInicial;
      }

      await competicaoService.gerarConfrontos(competicao.id_competicao, payload);
      await mutateConfrontos();
      await mutateClassificacao();
      setIsGerarModalOpen(false);
      exibirAlerta('Confrontos gerados com sucesso!', 'sucesso');
      setActiveTab('confrontos');
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        'Erro ao gerar confrontos automaticamente. Verifique se as equipes atendem ao formato.';
      exibirAlerta(typeof msg === 'string' ? msg : JSON.stringify(msg), 'erro');
    } finally {
      setGerandoConfrontos(false);
    }
  };

  // Upload de Súmula
  const handleUploadSumula = async (idConfronto: number, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/confrontos/${idConfronto}/sumula`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await mutateConfrontos();
      exibirAlerta('Súmula enviada com sucesso!', 'sucesso');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao enviar arquivo de súmula.';
      exibirAlerta(typeof msg === 'string' ? msg : JSON.stringify(msg), 'erro');
    }
  };

  // Extrair Fases e Grupos Únicos para Filtros
  const fasesDisponiveis = useMemo(() => {
    if (!confrontos) return [];
    const list = confrontos.map((c) => c.fase).filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [confrontos]);

  const gruposDisponiveis = useMemo(() => {
    if (!confrontos) return [];
    const list = confrontos.map((c) => c.grupo).filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [confrontos]);

  // Confrontos Filtrados
  const confrontosFiltrados = useMemo(() => {
    if (!confrontos) return [];
    return confrontos.filter((c) => {
      if (filtroFase && c.fase !== filtroFase) return false;
      if (filtroGrupo && c.grupo !== filtroGrupo) return false;
      if (filtroStatus && c.status !== filtroStatus) return false;
      return true;
    });
  }, [confrontos, filtroFase, filtroGrupo, filtroStatus]);

  const statusColors: Record<string, string> = {
    Agendado: 'bg-slate-100 text-slate-700 border-slate-200',
    Agendada: 'bg-slate-100 text-slate-700 border-slate-200',
    'Em Andamento': 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse',
    Finalizado: 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold',
    Finalizada: 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold',
    Cancelado: 'bg-rose-100 text-rose-800 border-rose-200',
    Cancelada: 'bg-rose-100 text-rose-800 border-rose-200',
  };

  return (
    <div className="space-y-6">
      {/* Alertas de Notificação */}
      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 animate-in fade-in shadow-sm">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
          <span className="text-sm font-semibold">{mensagemSucesso}</span>
        </div>
      )}
      {mensagemErro && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 animate-in fade-in shadow-sm">
          <AlertTriangle size={20} className="shrink-0 text-rose-600" />
          <span className="text-sm font-semibold">{mensagemErro}</span>
        </div>
      )}

      {/* Barra Superior de Abas */}
      <div className="bg-white rounded-3xl border border-slate-100 p-2 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Aba Equipes */}
          <button
            onClick={() => setActiveTab('equipes')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'equipes'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users size={16} />
            Equipes ({equipes?.length || 0})
          </button>

          {/* Aba Confrontos */}
          <button
            onClick={() => setActiveTab('confrontos')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'confrontos'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Swords size={16} />
            Confrontos ({confrontos?.length || 0})
          </button>

          {/* Aba Classificação / Chaveamento */}
          <button
            onClick={() => setActiveTab('classificacao')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'classificacao'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Trophy size={16} />
            {competicao.formato === 'MATA_MATA' ? 'Chaveamento & Pódio' : 'Classificação'}
          </button>
        </div>

        {/* Botão de Inscrição Rápida */}
        {activeTab === 'equipes' && (
          <button
            onClick={() => setIsNovaEquipeModalOpen(true)}
            className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-2xl text-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            Inscrever Equipe
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: EQUIPES INSCRITAS */}
      {/* ========================================================================= */}
      {activeTab === 'equipes' && (
        <div className="space-y-6">
          {loadingEquipes ? (
            <div className="p-16 text-center bg-white rounded-3xl border border-slate-100">
              <Loader2 className="animate-spin text-blue-600 mx-auto mb-2" size={32} />
              <p className="text-xs text-slate-400 font-medium">Carregando equipes participantes...</p>
            </div>
          ) : !equipes || equipes.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
              <Users size={48} className="mx-auto text-slate-300 mb-3 opacity-60" />
              <h3 className="text-base font-bold text-slate-700">Nenhuma equipe inscrita ainda</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-6">
                Inscreva as equipes participantes para começar a agendar ou gerar os confrontos do torneio.
              </p>
              <button
                onClick={() => setIsNovaEquipeModalOpen(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-blue-100 inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                Inscrever Primeira Equipe
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipes.map((equipe) => (
                <div
                  key={equipe.id_equipe}
                  className="bg-white border border-slate-100 hover:border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm shrink-0">
                          {equipe.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm truncate max-w-[180px]" title={equipe.nome}>
                            {equipe.nome}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-medium">
                            ID: #{equipe.id_equipe}
                          </span>
                        </div>
                      </div>

                      {equipe.grupo && (
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-black text-[11px] uppercase tracking-wider border border-purple-100 shrink-0">
                          Grupo {equipe.grupo}
                        </span>
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl text-xs text-slate-500 mb-4 flex items-center justify-between">
                      <span className="font-medium">Integrantes cadastrados:</span>
                      <strong className="text-slate-800 font-black">
                        {equipe.participantes?.length || 0}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleExcluirEquipe(equipe)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Excluir equipe"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: CONFRONTOS */}
      {/* ========================================================================= */}
      {activeTab === 'confrontos' && (
        <div className="space-y-6">
          {/* Barra de Ações e Aviso de Rascunho */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Gerenciamento de Confrontos
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Gere a tabela automaticamente conforme o formato da competição ou agende jogos manualmente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Botão Gerar Confrontos Automaticamente */}
              {competicao.status === 'RASCUNHO' ? (
                <div className="relative group">
                  <button
                    disabled
                    className="px-4 py-2.5 bg-slate-100 text-slate-400 font-bold rounded-2xl text-xs cursor-not-allowed flex items-center gap-2 border border-slate-200/60"
                  >
                    <Wand2 size={16} />
                    Gerar Confrontos
                  </button>
                  {/* Tooltip Amigável de Bloqueio em Rascunho */}
                  <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-2xl shadow-xl z-20 font-medium">
                    <AlertTriangle size={14} className="text-amber-400 mb-1 inline mr-1.5" />
                    A competição precisa ser <strong>iniciada</strong> antes de gerar confrontos.
                    Clique em &quot;Iniciar Competição&quot; no cabeçalho superior.
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsGerarModalOpen(true)}
                  disabled={gerandoConfrontos}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-100 disabled:opacity-50"
                >
                  {gerandoConfrontos ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Wand2 size={16} />
                  )}
                  Gerar Confrontos
                </button>
              )}

              {/* Botão Agendar Confronto Manual */}
              <button
                onClick={() => setIsAgendarConfrontoModalOpen(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-100"
              >
                <CalendarPlus size={16} />
                Agendar Jogo Manual
              </button>
            </div>
          </div>

          {/* Filtros de Confrontos */}
          {confrontos && confrontos.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px]">
                <Filter size={14} />
                Filtrar:
              </div>

              {/* Filtro Fase */}
              {fasesDisponiveis.length > 0 && (
                <select
                  value={filtroFase}
                  onChange={(e) => setFiltroFase(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                >
                  <option value="">Todas as Fases</option>
                  {fasesDisponiveis.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              )}

              {/* Filtro Grupo */}
              {gruposDisponiveis.length > 0 && (
                <select
                  value={filtroGrupo}
                  onChange={(e) => setFiltroGrupo(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                >
                  <option value="">Todos os Grupos</option>
                  {gruposDisponiveis.map((g) => (
                    <option key={g} value={g}>
                      Grupo {g}
                    </option>
                  ))}
                </select>
              )}

              {/* Filtro Status */}
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="">Todos os Status</option>
                <option value="Agendado">Agendado</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Cancelado">Cancelado</option>
              </select>

              {(filtroFase || filtroGrupo || filtroStatus) && (
                <button
                  onClick={() => {
                    setFiltroFase('');
                    setFiltroGrupo('');
                    setFiltroStatus('');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold ml-auto cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          )}

          {/* Lista de Confrontos */}
          {loadingConfrontos ? (
            <div className="p-16 text-center bg-white rounded-3xl border border-slate-100">
              <Loader2 className="animate-spin text-blue-600 mx-auto mb-2" size={32} />
              <p className="text-xs text-slate-400 font-medium">Carregando confrontos agendados...</p>
            </div>
          ) : !confrontos || confrontos.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
              <Swords size={48} className="mx-auto text-slate-300 mb-3 opacity-60" />
              <h3 className="text-base font-bold text-slate-700">Nenhum confronto gerado ainda</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-6">
                Cadastre as equipes participantes e clique em &quot;Gerar Confrontos&quot; para criar o calendário do campeonato.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {confrontosFiltrados.map((confronto) => {
                const finalizada =
                  confronto.status === 'Finalizado' || confronto.status === 'Finalizada';
                const mandanteNome = confronto.equipe_mandante?.nome || 'Mandante (A definir)';
                const visitanteNome = confronto.equipe_visitante?.nome || 'Visitante (A definir)';

                return (
                  <div
                    key={confronto.id_confronto}
                    className="bg-white border border-slate-100 hover:border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                  >
                    {/* Placar e Equipes */}
                    <div className="flex-1 flex items-center justify-between sm:justify-start gap-4">
                      {/* Mandante */}
                      <div className="w-36 sm:w-44 text-right truncate font-bold text-slate-800 text-sm" title={mandanteNome}>
                        {mandanteNome}
                      </div>

                      {/* Caixa de Placar */}
                      <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 shrink-0">
                        <span className="text-xl font-black text-slate-800">
                          {finalizada || confronto.status === 'Em Andamento'
                            ? confronto.placar_mandante
                            : '-'}
                        </span>
                        <span className="text-slate-400 text-[11px] font-black uppercase">VS</span>
                        <span className="text-xl font-black text-slate-800">
                          {finalizada || confronto.status === 'Em Andamento'
                            ? confronto.placar_visitante
                            : '-'}
                        </span>
                      </div>

                      {/* Visitante */}
                      <div className="w-36 sm:w-44 text-left truncate font-bold text-slate-800 text-sm" title={visitanteNome}>
                        {visitanteNome}
                      </div>
                    </div>

                    {/* Metadados da Partida (Data, Local, Fase, Status) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-500 border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data e Hora</p>
                        <p className="font-bold text-slate-700 mt-0.5 flex items-center gap-1 truncate">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          {confronto.data
                            ? new Date(confronto.data + 'T00:00:00').toLocaleDateString()
                            : 'A definir'}{' '}
                          {confronto.hora ? `- ${confronto.hora.substring(0, 5)}` : ''}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Local</p>
                        <p className="font-semibold text-slate-700 mt-0.5 truncate max-w-[120px]" title={confronto.local?.loca_nome}>
                          {confronto.local?.loca_nome || 'A definir'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fase / Grupo</p>
                        <p className="font-semibold text-blue-600 mt-0.5 truncate">
                          {confronto.fase || 'Fase única'} {confronto.grupo ? `(Gr. ${confronto.grupo})` : ''}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border mt-0.5 ${
                            statusColors[confronto.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {confronto.status}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2 border-t lg:border-t-0 border-slate-100 pt-3 lg:pt-0 justify-end">
                      {/* Botão de Lançamento de Placar */}
                      <button
                        onClick={() => setSelectedConfrontoForPlacar(confronto)}
                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        {finalizada ? 'Editar Placar' : 'Lançar Placar'}
                      </button>

                      {/* Botão de Upload de Súmula */}
                      <label
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer relative"
                        title={confronto.sumula_arquivo ? 'Substituir Súmula' : 'Anexar Súmula'}
                      >
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleUploadSumula(confronto.id_confronto, e.target.files[0]);
                            }
                          }}
                        />
                        {confronto.sumula_arquivo ? (
                          <FileCheck2 size={18} className="text-emerald-600" />
                        ) : (
                          <UploadCloud size={18} />
                        )}
                      </label>

                      {/* Botão de Excluir Confronto */}
                      <button
                        onClick={() => handleExcluirConfronto(confronto)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Excluir confronto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: CLASSIFICAÇÃO / CHAVEAMENTO ELIMINATÓRIO */}
      {/* ========================================================================= */}
      {activeTab === 'classificacao' && (
        <div className="space-y-6">
          {/* Se for MATA_MATA, permite alternar entre Árvore de Confrontos e Tabela */}
          {competicao.formato === 'MATA_MATA' && (
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
              <button
                onClick={() => setSubAbaMataMata('arvore')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  subAbaMataMata === 'arvore'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles size={14} className="text-amber-500" />
                Chaveamento Eliminatório (Árvore)
              </button>
              <button
                onClick={() => setSubAbaMataMata('tabela')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  subAbaMataMata === 'tabela'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Trophy size={14} />
                Quadro de Classificação
              </button>
            </div>
          )}

          {/* Renderização Condicional */}
          {competicao.formato === 'MATA_MATA' && subAbaMataMata === 'arvore' ? (
            <ArvoreMataMata
              confrontos={confrontos || []}
              onLancarPlacar={(c) => setSelectedConfrontoForPlacar(c)}
              campeao={classificacao?.campeao || classificacao?.mata_mata?.campeao}
              viceCampeao={classificacao?.vice_campeao || classificacao?.mata_mata?.vice_campeao}
              semifinalistas={classificacao?.semifinalistas || classificacao?.mata_mata?.semifinalistas}
            />
          ) : (
            <TabelaClassificacaoEquipes
              idCompeticao={competicao.id_competicao}
              formato={competicao.formato}
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INSCREVER NOVA EQUIPE */}
      {/* ========================================================================= */}
      {isNovaEquipeModalOpen && (
        <ModalNovaEquipeCompeticao
          idCompeticao={competicao.id_competicao}
          idEdicao={competicao.id_edicao}
          formato={competicao.formato}
          onClose={() => setIsNovaEquipeModalOpen(false)}
          onSuccess={async () => {
            setIsNovaEquipeModalOpen(false);
            await mutateEquipes();
            await mutateClassificacao();
            exibirAlerta('Equipe inscrita com sucesso!', 'sucesso');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LANÇAR PLACAR DO CONFRONTO */}
      {/* ========================================================================= */}
      {selectedConfrontoForPlacar && (
        <ModalConfrontoPlacar
          confronto={selectedConfrontoForPlacar}
          formatoCompeticao={competicao.formato}
          onClose={() => setSelectedConfrontoForPlacar(null)}
          onSuccess={async () => {
            setSelectedConfrontoForPlacar(null);
            await mutateConfrontos();
            await mutateClassificacao();
            exibirAlerta('Placar e status atualizados com sucesso!', 'sucesso');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: AGENDAR CONFRONTO MANUAL */}
      {/* ========================================================================= */}
      {isAgendarConfrontoModalOpen && (
        <ModalAgendarConfronto
          idCompeticao={competicao.id_competicao}
          equipes={equipes || []}
          formatoCompeticao={competicao.formato}
          onClose={() => setIsAgendarConfrontoModalOpen(false)}
          onSuccess={async () => {
            setIsAgendarConfrontoModalOpen(false);
            await mutateConfrontos();
            await mutateClassificacao();
            exibirAlerta('Confronto agendado com sucesso!', 'sucesso');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: GERAR CONFRONTOS AUTOMÁTICOS */}
      {/* ========================================================================= */}
      {isGerarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100 relative">
            <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
              <Wand2 className="text-emerald-600" size={26} />
              Gerar Confrontos
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              O sistema irá montar automaticamente a tabela ou chaveamento para as{' '}
              <strong>{equipes?.length || 0} equipes</strong> participantes no formato{' '}
              <strong>{competicao.formato}</strong>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Data de Início dos Jogos
                </label>
                <input
                  type="date"
                  value={gerarDataInicio}
                  onChange={(e) => setGerarDataInicio(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Horário Padrão dos Jogos
                </label>
                <input
                  type="time"
                  value={gerarHoraPadrao}
                  onChange={(e) => setGerarHoraPadrao(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {competicao.formato === 'MATA_MATA' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Fase Inicial Eliminatória
                  </label>
                  <select
                    value={gerarFaseInicial}
                    onChange={(e) => setGerarFaseInicial(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="Final">Final (2 Equipes)</option>
                    <option value="Semifinal">Semifinal (4 Equipes)</option>
                    <option value="Quartas">Quartas de Final (8 Equipes)</option>
                    <option value="Oitavas">Oitavas de Final (16 Equipes)</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGerarModalOpen(false)}
                  disabled={gerandoConfrontos}
                  className="flex-1 py-3 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarGerarConfrontos}
                  disabled={gerandoConfrontos}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {gerandoConfrontos ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Gerando...</span>
                    </>
                  ) : (
                    'Gerar Tabela'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
