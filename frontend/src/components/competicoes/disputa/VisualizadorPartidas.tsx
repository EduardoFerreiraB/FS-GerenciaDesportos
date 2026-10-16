'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Filter,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  PlusCircle,
  Edit3,
  CalendarCheck,
  X,
} from 'lucide-react';
import {
  listarPartidas,
  gerarTabela,
  desfazerTabela,
  encerrarFaseGrupos,
  obterDisputa,
  isErroApi,
} from '@/services/competicoes';
import type {
  PartidaDetalhe,
  StatusPartida,
  EstruturaDisputaDetalhe,
  GrupoDisputaDetalhe,
} from '@/types/competicoes';
import ModalAgendarPartida from './ModalAgendarPartida';
import ModalResultadoSimples from './ModalResultadoSimples';

interface PartidaEstendida extends PartidaDetalhe {
  data?: string | null;
  hora?: string | null;
  ordem_jogo?: number;
  estado?: string;
}

interface VisualizadorPartidasProps {
  idEdicaoCompeticao: number;
  estado?: string;
  formato?: string;
}

function formatarData(dataStr?: string | null): string {
  if (!dataStr) return '';
  const parteData = dataStr.split('T')[0];
  const partes = parteData.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataStr;
}

function formatarHora(horaStr?: string | null, dataHoraStr?: string | null): string {
  if (horaStr) {
    return horaStr.slice(0, 5);
  }
  if (dataHoraStr && dataHoraStr.includes('T')) {
    const part = dataHoraStr.split('T')[1];
    return part ? part.slice(0, 5) : '';
  }
  return '';
}

export default function VisualizadorPartidas({
  idEdicaoCompeticao,
  estado: estadoInicial = 'RASCUNHO',
  formato,
}: VisualizadorPartidasProps) {
  const [estadoAtual, setEstadoAtual] = useState<string>(estadoInicial);
  const [partidas, setPartidas] = useState<PartidaEstendida[]>([]);
  const [estrutura, setEstrutura] = useState<EstruturaDisputaDetalhe | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Ações de Tabela
  const [gerandoTabela, setGerandoTabela] = useState(false);
  const [desfazendoTabela, setDesfazendoTabela] = useState(false);
  const [encerrandoGrupos, setEncerrandoGrupos] = useState(false);

  // Diálogos de confirmação
  const [confirmarDesfazerAberto, setConfirmarDesfazerAberto] = useState(false);
  const [confirmarEncerrarGruposAberto, setConfirmarEncerrarGruposAberto] = useState(false);

  // Modais de Ação em Partida
  const [partidaAgendando, setPartidaAgendando] = useState<PartidaEstendida | null>(null);
  const [partidaPlacar, setPartidaPlacar] = useState<PartidaEstendida | null>(null);

  // Filtros
  const [filtroRodada, setFiltroRodada] = useState<string>('TODAS');
  const [filtroGrupo, setFiltroGrupo] = useState<string>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');

  // Atualiza estadoAtual caso a prop externa mude
  useEffect(() => {
    if (estadoInicial) {
      setEstadoAtual(estadoInicial);
    }
  }, [estadoInicial]);

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const [partidasRes, disputaRes] = await Promise.allSettled([
        listarPartidas(idEdicaoCompeticao),
        obterDisputa(idEdicaoCompeticao),
      ]);

      if (partidasRes.status === 'fulfilled' && Array.isArray(partidasRes.value)) {
        setPartidas(partidasRes.value as PartidaEstendida[]);
      } else {
        setPartidas([]);
      }

      if (disputaRes.status === 'fulfilled' && disputaRes.value) {
        setEstrutura(disputaRes.value);
      } else {
        setEstrutura(null);
      }
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar as partidas da edição.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Handler: Gerar Tabela
  const handleGerarTabela = async () => {
    try {
      setGerandoTabela(true);
      setErro(null);
      setSucesso(null);

      await gerarTabela(idEdicaoCompeticao);
      setEstadoAtual('EM_ANDAMENTO');
      setSucesso('Tabela de jogos e chaveamento gerados com sucesso!');
      await carregarDados();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao gerar tabela da competição.');
      }
    } finally {
      setGerandoTabela(false);
    }
  };

  // Handler: Desfazer Tabela
  const handleConfirmarDesfazer = async () => {
    try {
      setDesfazendoTabela(true);
      setErro(null);
      setSucesso(null);

      await desfazerTabela(idEdicaoCompeticao);
      setEstadoAtual('RASCUNHO');
      setPartidas([]);
      setEstrutura(null);
      setConfirmarDesfazerAberto(false);
      setSucesso('Tabela de jogos desfeita com sucesso. A edição retornou ao estado Rascunho.');
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Não foi possível desfazer a tabela.');
      }
    } finally {
      setDesfazendoTabela(false);
    }
  };

  // Handler: Encerrar Fase de Grupos
  const handleConfirmarEncerrarGrupos = async () => {
    try {
      setEncerrandoGrupos(true);
      setErro(null);
      setSucesso(null);

      await encerrarFaseGrupos(idEdicaoCompeticao);
      setConfirmarEncerrarGruposAberto(false);
      setSucesso('Fase de grupos encerrada! As equipes classificadas foram alocadas no chaveamento eliminatório.');
      await carregarDados();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao encerrar a fase de grupos. Verifique se todos os jogos foram concluídos.');
      }
    } finally {
      setEncerrandoGrupos(false);
    }
  };

  // Callbacks de atualização de partida
  const handlePartidaAgendada = (atualizada: PartidaDetalhe) => {
    setPartidas((prev) =>
      prev.map((item) => (item.id_partida === atualizada.id_partida ? (atualizada as PartidaEstendida) : item))
    );
    setSucesso(`Agendamento do jogo #${atualizada.numero_partida || atualizada.id_partida} salvo com sucesso!`);
  };

  const handlePlacarRegistrado = (atualizada: PartidaDetalhe) => {
    setPartidas((prev) =>
      prev.map((item) => (item.id_partida === atualizada.id_partida ? (atualizada as PartidaEstendida) : item))
    );
    setSucesso(`Placar do jogo #${atualizada.numero_partida || atualizada.id_partida} registrado com sucesso!`);
    // Recarrega estrutura para atualizar eventuais avanços de duelos eliminatórios
    carregarDados();
  };

  // Mapeamentos e Filtros
  const mapaGrupos = useMemo(() => {
    const map = new Map<number, string>();
    if (estrutura?.grupos) {
      estrutura.grupos.forEach((g) => map.set(g.id_grupo, g.nome));
    }
    return map;
  }, [estrutura]);

  const mapaDuelos = useMemo(() => {
    const map = new Map<number, string>();
    if (estrutura?.duelos) {
      estrutura.duelos.forEach((d) => map.set(d.id_duelo, d.fase));
    }
    return map;
  }, [estrutura]);

  const rodadasDisponiveis = useMemo(() => {
    const setR = new Set<number>();
    partidas.forEach((p) => {
      if (p.rodada != null) setR.add(p.rodada);
    });
    return Array.from(setR).sort((a, b) => a - b);
  }, [partidas]);

  const gruposDisponiveis = useMemo(() => {
    if (estrutura?.grupos && estrutura.grupos.length > 0) {
      return estrutura.grupos;
    }
    const setG = new Set<number>();
    partidas.forEach((p) => {
      if (p.id_grupo != null) setG.add(p.id_grupo);
    });
    return Array.from(setG).map((id) => ({
      id_grupo: id,
      id_edicao_competicao: idEdicaoCompeticao,
      nome: `Grupo ${id}`,
      numero_ordem: id,
      equipes: [],
    })) as GrupoDisputaDetalhe[];
  }, [estrutura, partidas, idEdicaoCompeticao]);

  const partidasFiltradas = useMemo(() => {
    return partidas.filter((p) => {
      if (filtroRodada !== 'TODAS' && p.rodada !== Number(filtroRodada)) {
        return false;
      }
      if (filtroGrupo !== 'TODOS' && p.id_grupo !== Number(filtroGrupo)) {
        return false;
      }
      if (filtroStatus !== 'TODOS' && (p.status || p.estado) !== filtroStatus) {
        return false;
      }
      return true;
    });
  }, [partidas, filtroRodada, filtroGrupo, filtroStatus]);

  const temTabelaGerada = partidas.length > 0;
  const isRascunho = estadoAtual === 'RASCUNHO';
  const isEmAndamento = estadoAtual === 'EM_ANDAMENTO';
  const isGruposMataMata = formato === 'GRUPOS_MATA_MATA';

  return (
    <div className="space-y-6">
      {/* Barra de Notificações de Sucesso / Erro */}
      {sucesso && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{sucesso}</span>
          </div>
          <button
            type="button"
            onClick={() => setSucesso(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1 rounded-md"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {erro && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-medium flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={() => setErro(null)}
            className="text-red-600 hover:text-red-800 p-1 rounded-md"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Barra Superior: Status e Controles de Ação de Tabela */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-bold text-slate-800">Jogos & Calendário de Partidas</h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                isRascunho
                  ? 'bg-amber-100 text-amber-800'
                  : isEmAndamento
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {estadoAtual}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total de jogos: <span className="font-semibold text-slate-700">{partidas.length}</span>
            {formato && ` • Formato: ${formato.replace(/_/g, ' ')}`}
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Gerar Tabela (quando RASCUNHO) */}
          {isRascunho && (
            <button
              type="button"
              onClick={handleGerarTabela}
              disabled={gerandoTabela}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition shadow-sm disabled:opacity-50"
            >
              {gerandoTabela ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Gerando Calendário...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Gerar Calendário / Tabela</span>
                </>
              )}
            </button>
          )}

          {/* Botão Encerrar Fase de Grupos (quando GRUPOS_MATA_MATA e EM_ANDAMENTO) */}
          {isGruposMataMata && isEmAndamento && (
            <button
              type="button"
              onClick={() => setConfirmarEncerrarGruposAberto(true)}
              disabled={encerrandoGrupos}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold rounded-lg text-sm transition disabled:opacity-50"
            >
              <Trophy size={16} />
              <span>Encerrar Fase de Grupos</span>
            </button>
          )}

          {/* Botão Desfazer Tabela (quando EM_ANDAMENTO) */}
          {isEmAndamento && (
            <button
              type="button"
              onClick={() => setConfirmarDesfazerAberto(true)}
              disabled={desfazendoTabela}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 font-semibold rounded-lg text-sm transition disabled:opacity-50"
            >
              <RotateCcw size={16} />
              <span>Desfazer Tabela</span>
            </button>
          )}

          {/* Botão Recarregar */}
          <button
            type="button"
            onClick={carregarDados}
            disabled={carregando}
            title="Recarregar partidas"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
          >
            <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Barra de Filtros (quando houver partidas) */}
      {temTabelaGerada && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <Filter size={14} className="text-slate-400" />
            <span>Filtrar:</span>
          </div>

          {/* Filtro de Rodada */}
          {rodadasDisponiveis.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="filtro-rodada" className="text-xs text-slate-500 font-medium">
                Rodada:
              </label>
              <select
                id="filtro-rodada"
                value={filtroRodada}
                onChange={(e) => setFiltroRodada(e.target.value)}
                className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="TODAS">Todas as Rodadas</option>
                {rodadasDisponiveis.map((r) => (
                  <option key={r} value={r}>
                    Rodada {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro de Grupo */}
          {gruposDisponiveis.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="filtro-grupo" className="text-xs text-slate-500 font-medium">
                Grupo:
              </label>
              <select
                id="filtro-grupo"
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value)}
                className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="TODOS">Todos os Grupos</option>
                {gruposDisponiveis.map((g) => (
                  <option key={g.id_grupo} value={g.id_grupo}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro de Status */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filtro-status" className="text-xs text-slate-500 font-medium">
              Status:
            </label>
            <select
              id="filtro-status"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="AGENDADA">Agendadas</option>
              <option value="EM_ANDAMENTO">Em Andamento</option>
              <option value="FINALIZADA">Finalizadas</option>
              <option value="CANCELADA">Canceladas</option>
            </select>
          </div>

          {(filtroRodada !== 'TODAS' || filtroGrupo !== 'TODOS' || filtroStatus !== 'TODOS') && (
            <button
              type="button"
              onClick={() => {
                setFiltroRodada('TODAS');
                setFiltroGrupo('TODOS');
                setFiltroStatus('TODOS');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Conteúdo de Carregamento */}
      {carregando && partidas.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
          <Loader2 size={32} className="animate-spin text-blue-600 mb-2" />
          <p className="text-sm text-slate-500">Carregando partidas da edição...</p>
        </div>
      )}

      {/* Estado Vazio 1: Edição em Rascunho e Tabela Não Gerada */}
      {!carregando && !temTabelaGerada && isRascunho && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 border-dashed space-y-4">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Calendar size={28} />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-800">Tabela de Jogos Não Gerada</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Para gerar os confrontos e o calendário oficial de partidas, certifique-se de que as equipes e formato estejam configurados e clique em &ldquo;Gerar Calendário / Tabela&rdquo;.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGerarTabela}
            disabled={gerandoTabela}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm disabled:opacity-50"
          >
            {gerandoTabela ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} />
            )}
            <span>Gerar Calendário / Tabela</span>
          </button>
        </div>
      )}

      {/* Estado Vazio 2: Em andamento mas sem partidas */}
      {!carregando && !temTabelaGerada && !isRascunho && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <p className="text-sm">Nenhuma partida cadastrada para esta edição.</p>
        </div>
      )}

      {/* Estado Vazio 3: Filtro sem resultados */}
      {!carregando && temTabelaGerada && partidasFiltradas.length === 0 && (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-2">
          <p className="text-sm font-medium text-slate-700">Nenhuma partida encontrada para os filtros selecionados.</p>
          <button
            type="button"
            onClick={() => {
              setFiltroRodada('TODAS');
              setFiltroGrupo('TODOS');
              setFiltroStatus('TODOS');
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            Redefinir filtros
          </button>
        </div>
      )}

      {/* Listagem de Partidas */}
      {!carregando && partidasFiltradas.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {partidasFiltradas.map((partida) => {
            const statusMatch = (partida.status || partida.estado || 'AGENDADA') as StatusPartida;
            const numeroJogo = partida.numero_partida || partida.ordem_jogo || partida.id_partida;

            // Determina Fase ou Grupo
            let labelContexto = '';
            if (partida.id_grupo) {
              const grupoNome = mapaGrupos.get(partida.id_grupo) || `Grupo ${partida.id_grupo}`;
              labelContexto = partida.rodada ? `${grupoNome} • Rodada ${partida.rodada}` : grupoNome;
            } else if (partida.id_duelo) {
              const faseDuelo = mapaDuelos.get(partida.id_duelo) || 'Mata-Mata';
              labelContexto = partida.rodada ? `${faseDuelo} • Rodada ${partida.rodada}` : faseDuelo;
            } else if (partida.rodada) {
              labelContexto = `Rodada ${partida.rodada}`;
            }

            const dataFormatada = formatarData(partida.data || partida.data_hora);
            const horaFormatada = formatarHora(partida.hora, partida.data_hora);
            const temAgendamento = Boolean(dataFormatada || partida.local || partida.campo);

            const isFinalizada = statusMatch === 'FINALIZADA';
            const golsMandante = partida.placar?.gols_mandante ?? 0;
            const golsVisitante = partida.placar?.gols_visitante ?? 0;
            const temPenaltis =
              partida.placar?.penaltis_mandante != null &&
              partida.placar?.penaltis_visitante != null;

            const podeLancarPlacar =
              Boolean(partida.id_equipe_mandante && partida.id_equipe_visitante) &&
              statusMatch !== 'CANCELADA';

            return (
              <div
                key={partida.id_partida}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all overflow-hidden"
              >
                {/* Cabeçalho do Card */}
                <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Jogo #{numeroJogo}</span>
                    {labelContexto && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="font-semibold text-slate-600">{labelContexto}</span>
                      </>
                    )}
                  </div>

                  {/* Badge de Status */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider text-[11px] border ${
                      statusMatch === 'AGENDADA'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : statusMatch === 'EM_ANDAMENTO'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : statusMatch === 'FINALIZADA'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {statusMatch}
                  </span>
                </div>

                {/* Corpo do Card: Equipes e Placar */}
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
                    {/* Mandante */}
                    <div className="md:col-span-4 flex items-center md:justify-end gap-3 text-right">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm md:text-base truncate" title={partida.nome_mandante || 'A definir'}>
                          {partida.nome_mandante || 'A definir'}
                        </p>
                        {partida.sigla_mandante && (
                          <span className="text-xs text-slate-400 font-semibold uppercase">
                            {partida.sigla_mandante}
                          </span>
                        )}
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                        {partida.sigla_mandante || (partida.nome_mandante ? partida.nome_mandante.slice(0, 3).toUpperCase() : 'MAN')}
                      </div>
                    </div>

                    {/* Placar Central */}
                    <div className="md:col-span-4 flex flex-col items-center justify-center py-2 md:py-0">
                      {isFinalizada || golsMandante > 0 || golsVisitante > 0 ? (
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                              {golsMandante}
                            </span>
                            <span className="text-slate-300 font-bold text-lg">x</span>
                            <span className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                              {golsVisitante}
                            </span>
                          </div>

                          {temPenaltis && (
                            <span className="text-xs text-slate-500 font-medium mt-0.5">
                              (Pên: {partida.placar.penaltis_mandante} x {partida.placar.penaltis_visitante})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500 uppercase tracking-widest">
                          VS
                        </div>
                      )}
                    </div>

                    {/* Visitante */}
                    <div className="md:col-span-4 flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                        {partida.sigla_visitante || (partida.nome_visitante ? partida.nome_visitante.slice(0, 3).toUpperCase() : 'VIS')}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm md:text-base truncate" title={partida.nome_visitante || 'A definir'}>
                          {partida.nome_visitante || 'A definir'}
                        </p>
                        {partida.sigla_visitante && (
                          <span className="text-xs text-slate-400 font-semibold uppercase">
                            {partida.sigla_visitante}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rodapé do Card: Data/Local e Botões de Ação */}
                <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  {/* Agendamento */}
                  <div className="flex flex-wrap items-center gap-3 text-slate-600">
                    {temAgendamento ? (
                      <>
                        {dataFormatada && (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{dataFormatada}</span>
                          </span>
                        )}
                        {horaFormatada && (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Clock size={13} className="text-slate-400" />
                            <span>{horaFormatada}</span>
                          </span>
                        )}
                        {(partida.local || partida.campo) && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <MapPin size={13} className="text-slate-400" />
                            <span>{partida.local || 'Local Definido'}{partida.campo ? ` (${partida.campo})` : ''}</span>
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 italic flex items-center gap-1">
                        <Calendar size={13} />
                        <span>Data e local a definir</span>
                      </span>
                    )}
                  </div>

                  {/* Ações da Partida */}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setPartidaAgendando(partida)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition shadow-2xs hover:border-slate-300"
                    >
                      <CalendarCheck size={14} className="text-blue-600" />
                      <span>Agendar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPartidaPlacar(partida)}
                      disabled={!podeLancarPlacar}
                      title={!podeLancarPlacar ? 'Equipes mandante e visitante devem estar definidas' : ''}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trophy size={14} />
                      <span>{isFinalizada ? 'Editar Placar' : 'Lançar Placar'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Agendamento */}
      <ModalAgendarPartida
        partida={partidaAgendando}
        isOpen={Boolean(partidaAgendando)}
        onClose={() => setPartidaAgendando(null)}
        onSucesso={handlePartidaAgendada}
      />

      {/* Modal de Placar Simples */}
      <ModalResultadoSimples
        partida={partidaPlacar}
        isOpen={Boolean(partidaPlacar)}
        onClose={() => setPartidaPlacar(null)}
        onSucesso={handlePlacarRegistrado}
      />

      {/* Diálogo de Confirmação: Desfazer Tabela */}
      {confirmarDesfazerAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-desfazer-titulo"
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 relative animate-in zoom-in-95"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 id="dialog-desfazer-titulo" className="text-base font-bold text-slate-800">
                  Desfazer Tabela de Jogos?
                </h3>
                <p className="text-xs text-slate-500">Ação destrutiva</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Ao desfazer a tabela, todas as partidas agendadas, grupos e chaveamentos desta edição serão excluídos e a edição retornará ao estado <span className="font-semibold text-slate-800">Rascunho</span>. Partidas já iniciadas ou com súmulas não permitirão esta ação.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmarDesfazerAberto(false)}
                disabled={desfazendoTabela}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarDesfazer}
                disabled={desfazendoTabela}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {desfazendoTabela ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Desfazendo...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} />
                    <span>Confirmar e Desfazer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmação: Encerrar Fase de Grupos */}
      {confirmarEncerrarGruposAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-grupos-titulo"
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 relative animate-in zoom-in-95"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <Trophy size={24} />
              </div>
              <div>
                <h3 id="dialog-grupos-titulo" className="text-base font-bold text-slate-800">
                  Encerrar Fase de Grupos?
                </h3>
                <p className="text-xs text-slate-500">Transição para Mata-Mata</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              A classificação final de cada grupo será consolidada e as equipes classificadas serão automaticamente alocadas nos cruzamentos do mata-mata. Todas as partidas da fase de grupos devem estar com resultado lançado e finalizadas.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmarEncerrarGruposAberto(false)}
                disabled={encerrandoGrupos}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEncerrarGrupos}
                disabled={encerrandoGrupos}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {encerrandoGrupos ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Encerrando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    <span>Confirmar Encerramento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
