'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Trophy, 
  Search, 
  Plus, 
  Trash2, 
  Calendar, 
  Users, 
  ArrowRight, 
  Loader2, 
  AlertTriangle, 
  X, 
  ListOrdered, 
  Layers, 
  GitBranch, 
  Filter, 
  Sparkles,
  CheckCircle2,
  Swords,
  Play
} from 'lucide-react';
import { competicoesV2Service } from '@/services/competicoesV2';
import { modalidadeService } from '@/services';
import { CompeticaoV2, FormatoCompeticao, StatusCompeticao } from '@/types/competicoesV2';
import ModalNovaCompeticaoV2 from '@/components/competicoes-v2/ModalNovaCompeticaoV2';
import { useNotification } from '@/context/NotificationContext';

export default function CompeticoesV2Page() {
  const router = useRouter();
  const { toast, confirm } = useNotification();

  const [competicoes, setCompeticoes] = useState<CompeticaoV2[]>([]);
  const [modalidades, setModalidades] = useState<{ id_modalidade: number; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroModalidade, setFiltroModalidade] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroFormato, setFiltroFormato] = useState<string>('todos');

  // Carregar dados da API
  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [compsData, modsData] = await Promise.all([
        competicoesV2Service.listarCompeticoes(),
        modalidadeService.getAll().catch(() => []),
      ]);
      setCompeticoes(compsData || []);
      setModalidades(modsData || []);
    } catch (error) {
      toast('Erro ao carregar competições.', 'error');
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Excluir competição
  const handleExcluirCompeticao = (e: React.MouseEvent, comp: CompeticaoV2) => {
    e.stopPropagation();
    e.preventDefault();

    confirm({
      title: 'Excluir Competição',
      message: `Tem certeza que deseja excluir a competição "${comp.nome}"? Todas as equipes, elencos e confrontos agendados vinculados serão permanentemente removidos.`,
      confirmText: 'Excluir Definitivamente',
      onConfirm: async () => {
        try {
          await competicoesV2Service.excluirCompeticao(comp.id_competicao);
          toast('Competição excluída com sucesso!', 'success');
          carregarDados();
        } catch (error: any) {
          const msg =
            error.response?.data?.detail ||
            'Não é possível excluir esta competição. Verifique se há jogos em andamento ou finalizados.';
          toast(typeof msg === 'string' ? msg : 'Erro ao excluir competição.', 'error');
        }
      },
    });
  };

  // Filtragem
  const competicoesFiltradas = useMemo(() => {
    return competicoes.filter((c) => {
      // Busca textual
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const bateNome = c.nome.toLowerCase().includes(termo);
        const bateModalidade = c.modalidade?.nome.toLowerCase().includes(termo) ?? false;
        const bateCategoria = c.categoria?.toLowerCase().includes(termo) ?? false;
        if (!bateNome && !bateModalidade && !bateCategoria) return false;
      }

      // Filtro Modalidade
      if (filtroModalidade !== 'todas') {
        if (c.id_modalidade !== Number(filtroModalidade)) return false;
      }

      // Filtro Status
      if (filtroStatus !== 'todos') {
        if (c.status !== filtroStatus) return false;
      }

      // Filtro Formato
      if (filtroFormato !== 'todos') {
        if (c.formato !== filtroFormato) return false;
      }

      return true;
    });
  }, [competicoes, busca, filtroModalidade, filtroStatus, filtroFormato]);

  // Contadores para métricas
  const totalEmAndamento = competicoes.filter((c) => c.status === 'EM_ANDAMENTO').length;
  const totalAbertas = competicoes.filter((c) => c.status === 'ABERTA').length;
  const totalRascunho = competicoes.filter((c) => c.status === 'RASCUNHO').length;

  const getStatusBadge = (status: StatusCompeticao | string) => {
    switch (status) {
      case 'EM_ANDAMENTO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Em Andamento
          </span>
        );
      case 'ABERTA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
            Aberta
          </span>
        );
      case 'FINALIZADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
            Finalizada
          </span>
        );
      case 'CANCELADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
            Cancelada
          </span>
        );
      case 'RASCUNHO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
            Rascunho
          </span>
        );
    }
  };

  const getFormatoBadge = (formato: FormatoCompeticao | string) => {
    switch (formato) {
      case 'PONTOS_CORRIDOS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <ListOrdered size={12} />
            Pontos Corridos
          </span>
        );
      case 'GRUPOS_MATA_MATA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Layers size={12} />
            Grupos + Mata-Mata
          </span>
        );
      case 'MATA_MATA':
      case 'MATA_MATA_DIRETO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <GitBranch size={12} />
            Mata-Mata Direto
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
            {formato}
          </span>
        );
    }
  };

  const formatarData = (dataStr?: string | null) => {
    if (!dataStr) return null;
    try {
      const d = new Date(dataStr + 'T00:00:00');
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dataStr;
    }
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-amber-50 border border-amber-200/60 rounded-2xl text-amber-600">
              <Trophy size={28} />
            </div>
            Competições & Torneios
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão reativa de ligas, copas, regulamentos esportivos, equipes e confrontos.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-amber-200/60 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-sm shrink-0"
        >
          <Plus size={18} />
          + Nova Competição
        </button>
      </div>

      {/* Cartões de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Trophy size={20} />
          </div>
          <div>
            <span className="text-xl font-bold text-slate-800 block leading-tight">
              {competicoes.length}
            </span>
            <span className="text-xs text-slate-400 font-medium">Total de Torneios</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Play size={20} />
          </div>
          <div>
            <span className="text-xl font-bold text-emerald-700 block leading-tight">
              {totalEmAndamento}
            </span>
            <span className="text-xs text-slate-400 font-medium">Em Andamento</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-xl font-bold text-blue-700 block leading-tight">
              {totalAbertas}
            </span>
            <span className="text-xs text-slate-400 font-medium">Inscrições Abertas</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <span className="text-xl font-bold text-amber-700 block leading-tight">
              {totalRascunho}
            </span>
            <span className="text-xs text-slate-400 font-medium">Em Rascunho</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Busca Textual */}
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Buscar competição por nome, modalidade ou categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro por Modalidade */}
          <div className="w-full md:w-56">
            <select
              value={filtroModalidade}
              onChange={(e) => setFiltroModalidade(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
            >
              <option value="todas">Todas as Modalidades</option>
              {modalidades.map((m) => (
                <option key={m.id_modalidade} value={m.id_modalidade}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Status */}
          <div className="w-full md:w-48">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="ABERTA">Aberta</option>
              <option value="EM_ANDAMENTO">Em Andamento</option>
              <option value="FINALIZADA">Finalizada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>

          {/* Filtro por Formato */}
          <div className="w-full md:w-52">
            <select
              value={filtroFormato}
              onChange={(e) => setFiltroFormato(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
            >
              <option value="todos">Todos os Formatos</option>
              <option value="PONTOS_CORRIDOS">Pontos Corridos</option>
              <option value="GRUPOS_MATA_MATA">Grupos + Mata-Mata</option>
              <option value="MATA_MATA">Mata-Mata Direto</option>
            </select>
          </div>
        </div>

        {/* Resumo de Filtros Ativos */}
        {(busca ||
          filtroModalidade !== 'todas' ||
          filtroStatus !== 'todos' ||
          filtroFormato !== 'todos') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Exibindo <strong>{competicoesFiltradas.length}</strong> de{' '}
              <strong>{competicoes.length}</strong> competições.
            </span>
            <button
              onClick={() => {
                setBusca('');
                setFiltroModalidade('todas');
                setFiltroStatus('todos');
                setFiltroFormato('todos');
              }}
              className="text-amber-600 hover:text-amber-700 font-semibold underline cursor-pointer"
            >
              Limpar todos os filtros
            </button>
          </div>
        )}
      </div>

      {/* Grid de Cards de Competições */}
      {carregando ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-400">
          <Loader2 size={40} className="animate-spin text-amber-500" />
          <p className="text-sm font-medium">Carregando competições esportivas...</p>
        </div>
      ) : competicoesFiltradas.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
            <Trophy size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Nenhuma competição encontrada</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {busca ||
            filtroModalidade !== 'todas' ||
            filtroStatus !== 'todos' ||
            filtroFormato !== 'todos'
              ? 'Nenhum torneio corresponde aos filtros aplicados. Tente ajustar os parâmetros de pesquisa.'
              : 'Você ainda não possui competições cadastradas. Comece criando seu primeiro campeonato com regulamento reativo!'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors shadow-md shadow-amber-100 cursor-pointer"
          >
            <Plus size={16} />
            Criar Nova Competição
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competicoesFiltradas.map((comp) => {
            const dataIn = formatarData(comp.data_inicio);
            const dataFi = formatarData(comp.data_fim);

            return (
              <div
                key={comp.id_competicao}
                onClick={() => router.push(`/dashboard/competicoes/${comp.id_competicao}`)}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all duration-300 flex flex-col justify-between group overflow-hidden cursor-pointer relative"
              >
                {/* Faixa superior de destaque */}
                <div className="p-6 pb-4">
                  {/* Linha de Badges: Modalidade & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                        {comp.modalidade?.nome || 'Modalidade'}
                      </span>
                      {comp.categoria && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                          {comp.categoria}
                        </span>
                      )}
                    </div>

                    {getStatusBadge(comp.status)}
                  </div>

                  {/* Nome da Competição */}
                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-amber-600 transition-colors line-clamp-2 leading-snug mb-2">
                    {comp.nome}
                  </h3>

                  {/* Grupo / Evento Agregador se houver */}
                  {comp.grupo && (
                    <p className="text-[11px] font-medium text-slate-400 mb-3 flex items-center gap-1">
                      <span>Evento:</span>
                      <strong className="text-slate-600">{comp.grupo.nome}</strong>
                    </p>
                  )}

                  {/* Formato e Modo */}
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {getFormatoBadge(comp.formato)}
                    <span className="text-[11px] font-semibold text-slate-500 px-2 py-0.5 bg-slate-50 rounded-md border border-slate-200/60">
                      {comp.modo_inscricao === 'EQUIPE' ? 'Coletivo (Equipes)' : 'Individual'}
                    </span>
                  </div>

                  {/* Detalhes rápidos (Equipes e Período) */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users size={14} className="text-slate-400" />
                        Equipes Inscritas:
                      </span>
                      <strong className="text-slate-700">
                        {comp.equipes ? comp.equipes.length : 0}
                      </strong>
                    </div>

                    {(dataIn || dataFi) && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          Período:
                        </span>
                        <span className="font-medium text-slate-700 text-[11px]">
                          {dataIn ? dataIn : '...'} {dataFi ? `a ${dataFi}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé do Card com Ações */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-600 group-hover:text-amber-700 flex items-center gap-1">
                    Acessar Torneio
                    <ArrowRight
                      size={14}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleExcluirCompeticao(e, comp)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Excluir Competição"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Competição V2 */}
      {isModalOpen && (
        <ModalNovaCompeticaoV2
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={(novaComp) => {
            carregarDados();
            router.push(`/dashboard/competicoes/${novaComp.id_competicao}`);
          }}
        />
      )}
    </div>
  );
}
