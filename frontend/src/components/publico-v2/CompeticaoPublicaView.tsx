'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { 
  Trophy, 
  Calendar, 
  MapPin, 
  Award, 
  RotateCw, 
  Loader2, 
  AlertCircle, 
  Clock, 
  Shield, 
  Sparkles, 
  Swords 
} from 'lucide-react';
import { competicoesV2Service } from '@/services/competicoesV2';

export interface CompeticaoPublicaViewProps {
  idCompeticao: number;
  nomeCompeticao: string;
  formato: string;
}

export interface GolPublico {
  id_ocorrencia: number;
  id_equipe: number;
  nome_equipe?: string | null;
  id_jogador?: number | null;
  nome_jogador?: string | null;
  tipo: 'GOL' | 'GOL_CONTRA';
  minuto?: number | null;
  tempo_jogo?: string | null;
  observacao?: string | null;
}

export interface JogoPublico {
  id_confronto: number;
  id_competicao: number;
  fase?: string | null;
  rodada?: number | null;
  grupo?: string | null;
  data?: string | null;
  hora?: string | null;
  id_local?: number | null;
  local?: { id_local: number; loca_nome: string } | null;
  id_equipe_mandante: number;
  equipe_mandante?: { id_equipe: number; nome: string } | null;
  nome_equipe_mandante?: string | null;
  id_equipe_visitante: number;
  equipe_visitante?: { id_equipe: number; nome: string } | null;
  nome_equipe_visitante?: string | null;
  placar_mandante?: number | null;
  placar_visitante?: number | null;
  penaltis_mandante?: number | null;
  penaltis_visitante?: number | null;
  id_equipe_vencedora?: number | null;
  status: string;
  gols?: GolPublico[];
}

export interface TabelaRowPublica {
  posicao?: number;
  id_equipe?: number;
  nome_equipe?: string;
  equipe?: string;
  pontos?: number;
  jogos?: number;
  vitorias?: number;
  empates?: number;
  derrotas?: number;
  gols_pro?: number;
  gols_contra?: number;
  saldo_gols?: number;
  aproveitamento?: number;
  classificado?: boolean;
}

export interface PodioPublico {
  id_equipe?: number;
  nome_equipe?: string;
  nome?: string;
}

export interface FaseEliminatoriaPublica {
  campeao?: PodioPublico | null;
  vice_campeao?: PodioPublico | null;
  terceiro_colocado?: PodioPublico | null;
  fases?: Record<string, JogoPublico[]>;
  arvore?: JogoPublico[];
}

export interface ClassificacaoPublicaResponse {
  id_competicao?: number;
  nome_competicao?: string;
  formato?: string;
  total_equipes?: number;
  confrontos_disputados?: number;
  classificacao?: TabelaRowPublica[];
  tabela?: TabelaRowPublica[];
  grupos?: Record<string, TabelaRowPublica[]>;
  fase_eliminatoria?: FaseEliminatoriaPublica;
  campeao?: PodioPublico | null;
  vice_campeao?: PodioPublico | null;
  terceiro_colocado?: PodioPublico | null;
  fases?: Record<string, JogoPublico[]>;
  arvore?: JogoPublico[];
}

export interface ArtilheiroPublico {
  rank?: number;
  posicao?: number;
  id_jogador: number;
  nome_jogador: string;
  numero_camisa?: number | null;
  posicao_jogo?: string | null;
  id_equipe: number;
  equipe?: string;
  nome_equipe?: string;
  gols: number;
}

export default function CompeticaoPublicaView({
  idCompeticao,
  nomeCompeticao,
  formato,
}: CompeticaoPublicaViewProps) {
  // Aba ativa interna
  const [subAba, setSubAba] = useState<'jogos' | 'classificacao' | 'artilharia'>('jogos');
  const [faseOuRodadaFiltro, setFaseOuRodadaFiltro] = useState<string>('TODAS');
  const [abaGrupoAtivo, setAbaGrupoAtivo] = useState<string>('todos');

  // Buscar Jogos
  const {
    data: jogos,
    error: errorJogos,
    isLoading: loadingJogos,
    mutate: mutateJogos,
  } = useSWR<JogoPublico[]>(
    idCompeticao ? ['publico-jogos', idCompeticao] : null,
    () => competicoesV2Service.obterJogosPublicos(idCompeticao),
    { refreshInterval: 15000 } // Auto refresh a cada 15s para placares ao vivo
  );

  // Buscar Classificação
  const {
    data: classificacaoData,
    error: errorClassificacao,
    isLoading: loadingClassificacao,
    mutate: mutateClassificacao,
  } = useSWR<ClassificacaoPublicaResponse>(
    idCompeticao ? ['publico-classificacao', idCompeticao] : null,
    () => competicoesV2Service.obterClassificacaoPublica(idCompeticao)
  );

  // Buscar Artilharia
  const {
    data: artilharia,
    error: errorArtilharia,
    isLoading: loadingArtilharia,
    mutate: mutateArtilharia,
  } = useSWR<ArtilheiroPublico[]>(
    idCompeticao ? ['publico-artilharia', idCompeticao] : null,
    () => competicoesV2Service.obterArtilhariaPublica(idCompeticao)
  );

  // Lista de fases/rodadas distintas para filtro nos jogos
  const fasesOuRodadas = useMemo(() => {
    if (!jogos || !Array.isArray(jogos)) return [];
    const setFases = new Set<string>();
    jogos.forEach((j) => {
      if (j.rodada) {
        setFases.add(`Rodada ${j.rodada}`);
      } else if (j.fase) {
        setFases.add(j.fase);
      }
    });
    return Array.from(setFases);
  }, [jogos]);

  // Jogos filtrados
  const jogosFiltrados = useMemo(() => {
    if (!jogos || !Array.isArray(jogos)) return [];
    if (faseOuRodadaFiltro === 'TODAS') return jogos;

    return jogos.filter((j) => {
      const label = j.rodada ? `Rodada ${j.rodada}` : j.fase;
      return label === faseOuRodadaFiltro;
    });
  }, [jogos, faseOuRodadaFiltro]);

  // Identificar se há jogos em andamento nesta competição
  const temJogosAoVivo = useMemo(() => {
    if (!jogos || !Array.isArray(jogos)) return false;
    return jogos.some((j) => j.status === 'Em Andamento');
  }, [jogos]);

  const formatoNormalizado = (formato || '').toUpperCase();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Cabeçalho da Competição com Sub-Abas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-slate-900 dark:text-white">
              {nomeCompeticao}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {formatoNormalizado.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setSubAba('jogos')}
            type="button"
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
              subAba === 'jogos'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700'
            }`}
          >
            <Calendar size={16} />
            <span>Jogos & Resultados</span>
            {temJogosAoVivo && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}
          </button>

          <button
            onClick={() => setSubAba('classificacao')}
            type="button"
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
              subAba === 'classificacao'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700'
            }`}
          >
            <Trophy size={16} />
            <span>Classificação & Chave</span>
          </button>

          <button
            onClick={() => setSubAba('artilharia')}
            type="button"
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
              subAba === 'artilharia'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700'
            }`}
          >
            <Award size={16} />
            <span>Artilharia</span>
          </button>

          {/* Botão de Atualizar Manual */}
          <button
            onClick={() => {
              mutateJogos();
              mutateClassificacao();
              mutateArtilharia();
            }}
            type="button"
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm cursor-pointer ml-1"
            title="Recarregar dados"
          >
            <RotateCw size={15} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ABA JOGOS & RESULTADOS */}
      {/* ========================================================================= */}
      {subAba === 'jogos' && (
        <div className="space-y-6">
          {/* Filtro por Rodada/Fase */}
          {fasesOuRodadas.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setFaseOuRodadaFiltro('TODAS')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  faseOuRodadaFiltro === 'TODAS'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                Todas as Rodadas ({jogos?.length || 0})
              </button>

              {fasesOuRodadas.map((fr) => (
                <button
                  key={fr}
                  onClick={() => setFaseOuRodadaFiltro(fr)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    faseOuRodadaFiltro === fr
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {fr}
                </button>
              ))}
            </div>
          )}

          {/* Lista de Partidas */}
          {loadingJogos ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
              <Loader2 className="animate-spin text-blue-600" size={36} />
              <p className="text-xs font-semibold text-slate-400">Carregando calendário de jogos...</p>
            </div>
          ) : errorJogos ? (
            <div className="p-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-3xl text-center space-y-3">
              <AlertCircle size={32} className="mx-auto text-rose-500" />
              <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                Não foi possível carregar os jogos desta competição.
              </p>
              <button
                onClick={() => mutateJogos()}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 text-xs font-bold text-rose-600 rounded-xl cursor-pointer"
              >
                Tentar novamente
              </button>
            </div>
          ) : jogosFiltrados.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
              <Calendar size={42} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Nenhum confronto agendado
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Assim que a tabela for divulgada pela organização, os jogos e placares aparecerão aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jogosFiltrados.map((jogo) => (
                <CardJogoPublico key={jogo.id_confronto} jogo={jogo} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ABA CLASSIFICAÇÃO & CHAVEAMENTO */}
      {/* ========================================================================= */}
      {subAba === 'classificacao' && (
        <div className="space-y-6">
          {loadingClassificacao ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
              <Loader2 className="animate-spin text-blue-600" size={36} />
              <p className="text-xs font-semibold text-slate-400">Calculando tabela de classificação...</p>
            </div>
          ) : errorClassificacao || !classificacaoData ? (
            <div className="p-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-3xl text-center space-y-3">
              <AlertCircle size={32} className="mx-auto text-rose-500" />
              <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                Classificação ainda não disponível para esta competição.
              </p>
            </div>
          ) : (
            <RenderClassificacaoView 
              data={classificacaoData} 
              formato={formatoNormalizado}
              abaGrupoAtivo={abaGrupoAtivo}
              setAbaGrupoAtivo={setAbaGrupoAtivo}
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ABA ARTILHARIA */}
      {/* ========================================================================= */}
      {subAba === 'artilharia' && (
        <div className="space-y-6">
          {loadingArtilharia ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
              <Loader2 className="animate-spin text-blue-600" size={36} />
              <p className="text-xs font-semibold text-slate-400">Carregando artilharia...</p>
            </div>
          ) : errorArtilharia ? (
            <div className="p-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-3xl text-center space-y-3">
              <AlertCircle size={32} className="mx-auto text-rose-500" />
              <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                Não foi possível carregar a artilharia da competição.
              </p>
            </div>
          ) : !artilharia || artilharia.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
              <Award size={42} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Nenhum gol registrado
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Conforme os gols forem confirmados nas súmulas rápidas das partidas, o ranking de artilharia será atualizado aqui.
              </p>
            </div>
          ) : (
            <TabelaArtilhariaPublica artilharia={artilharia} />
          )}
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// SUB-COMPONENTE: CARD DE JOGO PÚBLICO
// ==============================================================================
function CardJogoPublico({ jogo }: { jogo: JogoPublico }) {
  const isFinalizado = jogo.status === 'Finalizado' || jogo.status === 'Finalizada';
  const isAoVivo = jogo.status === 'Em Andamento';
  const isCancelado = jogo.status === 'Cancelado' || jogo.status === 'Cancelada';

  const mandanteNome = jogo.equipe_mandante?.nome || 'A definir';
  const visitanteNome = jogo.equipe_visitante?.nome || 'A definir';

  const formatarData = (dataStr?: string | null) => {
    if (!dataStr) return null;
    try {
      const d = new Date(dataStr.includes('T') ? dataStr : `${dataStr}T00:00:00`);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return null;
    }
  };

  const dataFormatada = formatarData(jogo.data);
  const horaFormatada = jogo.hora ? jogo.hora.substring(0, 5) : null;

  const mandanteVenceu = isFinalizado && (jogo.placar_mandante ?? 0) > (jogo.placar_visitante ?? 0);
  const visitanteVenceu = isFinalizado && (jogo.placar_visitante ?? 0) > (jogo.placar_mandante ?? 0);

  // Separar gols do mandante e do visitante (conformidade LGPD: somente nome do atleta e tempo)
  const golsMandante = (jogo.gols || []).filter((g) => g.id_equipe === jogo.id_equipe_mandante);
  const golsVisitante = (jogo.gols || []).filter((g) => g.id_equipe === jogo.id_equipe_visitante);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-150 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md transition-all space-y-4">
      {/* Topo do Card: Fase, Data, Local e Badge de Status */}
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-400 pb-3 border-b border-slate-100 dark:border-slate-700/40">
        <div className="flex items-center gap-2 font-bold truncate">
          <span className="text-slate-700 dark:text-slate-300 font-extrabold">
            {jogo.rodada ? `Rodada ${jogo.rodada}` : jogo.fase || 'Partida'}
          </span>
          {jogo.grupo && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
              Gr. {jogo.grupo}
            </span>
          )}
        </div>

        {/* Badge de Status */}
        <div>
          {isAoVivo ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-black uppercase tracking-wider animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Ao Vivo
            </span>
          ) : isFinalizado ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-wider">
              Encerrado
            </span>
          ) : isCancelado ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 text-[10px] font-black uppercase tracking-wider">
              Cancelado
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider">
              Agendado
            </span>
          )}
        </div>
      </div>

      {/* Confronto e Placar */}
      <div className="grid grid-cols-7 items-center gap-2">
        {/* Mandante */}
        <div className="col-span-3 text-right">
          <p className={`text-sm sm:text-base truncate ${mandanteVenceu ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
            {mandanteNome}
          </p>
          <span className="text-[10px] uppercase font-bold text-slate-400">Mandante</span>
        </div>

        {/* Placar Central */}
        <div className="col-span-1 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-2xl shadow-inner min-w-[64px]">
            <span className={`text-lg sm:text-xl font-black font-mono ${mandanteVenceu ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
              {isFinalizado || isAoVivo ? jogo.placar_mandante ?? 0 : '-'}
            </span>
            <span className="text-xs text-slate-300 dark:text-slate-600 font-black">x</span>
            <span className={`text-lg sm:text-xl font-black font-mono ${visitanteVenceu ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
              {isFinalizado || isAoVivo ? jogo.placar_visitante ?? 0 : '-'}
            </span>
          </div>

          {/* Decisão por Pênaltis */}
          {(jogo.penaltis_mandante !== null && jogo.penaltis_mandante !== undefined && jogo.penaltis_visitante !== null && jogo.penaltis_visitante !== undefined) && (
            <p className="text-[10px] font-black text-slate-400 mt-1 whitespace-nowrap">
              (pên. {jogo.penaltis_mandante} x {jogo.penaltis_visitante})
            </p>
          )}
        </div>

        {/* Visitante */}
        <div className="col-span-3 text-left">
          <p className={`text-sm sm:text-base truncate ${visitanteVenceu ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
            {visitanteNome}
          </p>
          <span className="text-[10px] uppercase font-bold text-slate-400">Visitante</span>
        </div>
      </div>

      {/* Autores dos Gols (se houver) */}
      {jogo.gols && jogo.gols.length > 0 && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/40 grid grid-cols-2 gap-3 text-[11px]">
          {/* Gols Mandante */}
          <div className="space-y-1 text-right">
            {golsMandante.map((g) => (
              <p key={g.id_ocorrencia} className="text-slate-600 dark:text-slate-400 font-medium truncate">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {g.nome_jogador || 'Gol'}
                </span>
                {g.minuto ? ` ${g.minuto}'` : ''}
                {g.tipo === 'GOL_CONTRA' && <span className="text-rose-500 font-bold ml-1">(GC)</span>}
                {' '}⚽
              </p>
            ))}
          </div>

          {/* Gols Visitante */}
          <div className="space-y-1 text-left">
            {golsVisitante.map((g) => (
              <p key={g.id_ocorrencia} className="text-slate-600 dark:text-slate-400 font-medium truncate">
                ⚽{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {g.nome_jogador || 'Gol'}
                </span>
                {g.minuto ? ` ${g.minuto}'` : ''}
                {g.tipo === 'GOL_CONTRA' && <span className="text-rose-500 font-bold ml-1">(GC)</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Rodapé do Card: Horário e Local do Jogo */}
      {(dataFormatada || horaFormatada || jogo.local) && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          {(dataFormatada || horaFormatada) && (
            <span className="flex items-center gap-1 font-semibold">
              <Clock size={12} className="text-slate-400" />
              {dataFormatada && `${dataFormatada}`}
              {horaFormatada && ` às ${horaFormatada}`}
            </span>
          )}

          {jogo.local?.loca_nome && (
            <span className="flex items-center gap-1 font-semibold truncate max-w-[180px]" title={jogo.local.loca_nome}>
              <MapPin size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{jogo.local.loca_nome}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// SUB-COMPONENTE: RENDERIZADOR DE CLASSIFICAÇÃO & CHAVEAMENTO
// ==============================================================================
function RenderClassificacaoView({
  data,
  formato,
  abaGrupoAtivo,
  setAbaGrupoAtivo,
}: {
  data: ClassificacaoPublicaResponse;
  formato: string;
  abaGrupoAtivo: string;
  setAbaGrupoAtivo: (v: string) => void;
}) {
  const temGrupos = Boolean(data.grupos && Object.keys(data.grupos).length > 0);
  const temMataMata = Boolean(data.fase_eliminatoria || data.arvore || formato.includes('MATA_MATA'));

  const campeao = data.campeao || data.fase_eliminatoria?.campeao;
  const viceCampeao = data.vice_campeao || data.fase_eliminatoria?.vice_campeao;
  const terceiroColocado = data.terceiro_colocado || data.fase_eliminatoria?.terceiro_colocado;

  return (
    <div className="space-y-8">
      {/* Banner de Honra / Pódio para Mata-Mata */}
      {campeao && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl">
              <Trophy size={40} className="text-yellow-100 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start text-xs font-black uppercase tracking-widest text-yellow-100">
                <Sparkles size={16} />
                <span>Grande Campeão</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
                {campeao.nome_equipe || campeao.nome || 'Campeão'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {viceCampeao && (
              <div className="px-5 py-3 bg-black/15 backdrop-blur-sm rounded-2xl border border-white/20 text-center sm:text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-200">
                  Vice-Campeão 🥈
                </p>
                <p className="text-sm font-bold mt-0.5 text-white">
                  {viceCampeao.nome_equipe || viceCampeao.nome}
                </p>
              </div>
            )}

            {terceiroColocado && (
              <div className="px-5 py-3 bg-black/15 backdrop-blur-sm rounded-2xl border border-white/20 text-center sm:text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-200">
                  3º Colocado 🥉
                </p>
                <p className="text-sm font-bold mt-0.5 text-white">
                  {terceiroColocado.nome_equipe || terceiroColocado.nome}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Caso haja Grupos: Abas de navegação por grupo */}
      {temGrupos && data.grupos && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setAbaGrupoAtivo('todos')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                abaGrupoAtivo === 'todos'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Todos os Grupos
            </button>

            {Object.keys(data.grupos).map((gNome) => (
              <button
                key={gNome}
                onClick={() => setAbaGrupoAtivo(gNome)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  abaGrupoAtivo === gNome
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Grupo {gNome}
              </button>
            ))}

            {data.classificacao && data.classificacao.length > 0 && (
              <button
                onClick={() => setAbaGrupoAtivo('geral')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  abaGrupoAtivo === 'geral'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Classificação Geral
              </button>
            )}
          </div>

          {/* Renderização das Tabelas dos Grupos */}
          {abaGrupoAtivo === 'todos' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(data.grupos).map(([gNome, linhas]) => (
                <div key={gNome} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                      Grupo {gNome}
                    </h3>
                  </div>
                  <TabelaPontosPublica rows={linhas} />
                </div>
              ))}
            </div>
          ) : abaGrupoAtivo === 'geral' ? (
            <div className="space-y-2">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 px-1">
                Classificação Geral Unificada
              </h3>
              <TabelaPontosPublica rows={data.classificacao || []} />
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 px-1">
                Tabela do Grupo {abaGrupoAtivo}
              </h3>
              <TabelaPontosPublica rows={data.grupos[abaGrupoAtivo] || []} />
            </div>
          )}
        </div>
      )}

      {/* Caso seja Pontos Corridos Puro */}
      {!temGrupos && !formato.includes('MATA_MATA') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
              Tabela de Pontos Corridos
            </h3>
            <span className="text-xs text-slate-400 font-semibold">
              {data.total_equipes || data.classificacao?.length || 0} equipes
            </span>
          </div>
          <TabelaPontosPublica rows={data.classificacao || data.tabela || []} />
        </div>
      )}

      {/* Chaveamento Gráfico do Mata-Mata */}
      {temMataMata && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 px-1">
            <Swords size={18} className="text-blue-600" />
            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200">
              Árvore da Fase Eliminatória (Chaveamento)
            </h3>
          </div>

          <ArvoreMataMataPublica 
            fases={data.fases || data.fase_eliminatoria?.fases}
            arvore={data.arvore || data.fase_eliminatoria?.arvore}
          />
        </div>
      )}
    </div>
  );
}

// ==============================================================================
// SUB-COMPONENTE: TABELA DE PONTOS PÚBLICA
// ==============================================================================
function TabelaPontosPublica({ rows }: { rows: TabelaRowPublica[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/60 text-xs text-slate-400">
        Nenhuma equipe pontuada nesta tabela.
      </div>
    );
  }

  const getPosBadge = (pos: number) => {
    if (pos === 1) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 font-black';
    if (pos === 2) return 'bg-slate-200 text-slate-800 dark:bg-slate-600/30 dark:text-slate-300 font-bold';
    if (pos === 3) return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400 font-bold';
    return 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-150 dark:border-slate-700/60 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700/50 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-3 text-center w-12">Pos</th>
              <th className="py-3 px-4">Equipe</th>
              <th className="py-3 px-2 text-center font-black text-blue-600 dark:text-blue-400">PTS</th>
              <th className="py-3 px-2 text-center">J</th>
              <th className="py-3 px-2 text-center text-emerald-600">V</th>
              <th className="py-3 px-2 text-center text-slate-400">E</th>
              <th className="py-3 px-2 text-center text-rose-500">D</th>
              <th className="py-3 px-2 text-center">GP</th>
              <th className="py-3 px-2 text-center">GC</th>
              <th className="py-3 px-2 text-center font-bold">SG</th>
              <th className="py-3 px-3 text-center">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 font-semibold text-slate-700 dark:text-slate-300">
            {rows.map((row, idx) => {
              const pos = row.posicao ?? idx + 1;
              const nome = row.nome_equipe || row.equipe || 'Equipe';
              const classificado = Boolean(row.classificado);

              return (
                <tr
                  key={row.id_equipe || idx}
                  className={`hover:bg-slate-50/70 dark:hover:bg-slate-700/20 transition-colors ${
                    classificado ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs ${getPosBadge(pos)}`}>
                      {pos}º
                    </span>
                  </td>

                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[150px] sm:max-w-[200px]" title={nome}>
                        {nome}
                      </span>
                      {classificado && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-black uppercase">
                          Classificado
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-2 text-center font-black text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10">
                    {row.pontos ?? 0}
                  </td>
                  <td className="py-3 px-2 text-center">{row.jogos ?? 0}</td>
                  <td className="py-3 px-2 text-center text-emerald-600 dark:text-emerald-400">{row.vitorias ?? 0}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{row.empates ?? 0}</td>
                  <td className="py-3 px-2 text-center text-rose-500">{row.derrotas ?? 0}</td>
                  <td className="py-3 px-2 text-center">{row.gols_pro ?? 0}</td>
                  <td className="py-3 px-2 text-center">{row.gols_contra ?? 0}</td>
                  <td className={`py-3 px-2 text-center font-bold ${
                    (row.saldo_gols ?? 0) > 0 ? 'text-emerald-600' : (row.saldo_gols ?? 0) < 0 ? 'text-rose-500' : 'text-slate-400'
                  }`}>
                    {(row.saldo_gols ?? 0) > 0 ? `+${row.saldo_gols}` : row.saldo_gols ?? 0}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400 font-medium">
                    {typeof row.aproveitamento === 'number' ? `${row.aproveitamento.toFixed(0)}%` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legenda de Rodapé */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/40 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 font-semibold">
        <span><strong className="text-slate-600 dark:text-slate-300">PTS:</strong> Pontos</span>
        <span><strong className="text-slate-600 dark:text-slate-300">J:</strong> Jogos</span>
        <span><strong className="text-slate-600 dark:text-slate-300">V:</strong> Vitórias</span>
        <span><strong className="text-slate-600 dark:text-slate-300">E:</strong> Empates</span>
        <span><strong className="text-slate-600 dark:text-slate-300">D:</strong> Derrotas</span>
        <span><strong className="text-slate-600 dark:text-slate-300">GP:</strong> Gols Pró</span>
        <span><strong className="text-slate-600 dark:text-slate-300">GC:</strong> Gols Contra</span>
        <span><strong className="text-slate-600 dark:text-slate-300">SG:</strong> Saldo de Gols</span>
      </div>
    </div>
  );
}

// ==============================================================================
// SUB-COMPONENTE: ÁRVORE MATA-MATA PÚBLICA
// ==============================================================================
function ArvoreMataMataPublica({
  fases,
  arvore,
}: {
  fases?: Record<string, JogoPublico[]>;
  arvore?: JogoPublico[];
}) {
  // Organiza fases em ordem
  const fasesArray = useMemo(() => {
    if (fases && Object.keys(fases).length > 0) {
      const rankFase = (nome: string) => {
        const l = nome.toLowerCase();
        if (l.includes('oitava')) return 1;
        if (l.includes('quarta')) return 2;
        if (l.includes('semi')) return 3;
        if (l.includes('final') && !l.includes('3') && !l.includes('semi') && !l.includes('quarta')) return 4;
        if (l.includes('3') || l.includes('terceir')) return 5;
        return 10;
      };

      return Object.entries(fases)
        .sort(([a], [b]) => rankFase(a) - rankFase(b))
        .map(([nome, jogos]) => ({ fase: nome, jogos }));
    }

    if (arvore && arvore.length > 0) {
      const map: Record<string, JogoPublico[]> = {};
      arvore.forEach((c) => {
        const f = c.fase || 'Eliminatória';
        if (!map[f]) map[f] = [];
        map[f].push(c);
      });
      return Object.entries(map).map(([fase, jogos]) => ({ fase, jogos }));
    }

    return [];
  }, [fases, arvore]);

  if (fasesArray.length === 0) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-150 dark:border-slate-700/60 text-xs text-slate-400">
        Chaveamento eliminatório ainda não definido.
      </div>
    );
  }

  return (
    <div className="bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 overflow-x-auto shadow-inner">
      <div className="flex items-stretch gap-6 sm:gap-8 min-w-max pb-2">
        {fasesArray.map(({ fase, jogos }) => (
          <div key={fase} className="flex flex-col w-64 sm:w-72 shrink-0">
            {/* Cabeçalho da Fase */}
            <div className="mb-4 text-center">
              <span className="inline-block px-4 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 shadow-sm">
                {fase}
              </span>
            </div>

            {/* Jogos da Fase */}
            <div className="flex flex-col justify-around gap-4 h-full">
              {jogos.map((jogo) => {
                const finalizado = jogo.status === 'Finalizado' || jogo.status === 'Finalizada';
                const mandanteNome = jogo.nome_equipe_mandante || jogo.equipe_mandante?.nome || 'A definir';
                const visitanteNome = jogo.nome_equipe_visitante || jogo.equipe_visitante?.nome || 'A definir';

                const pm = jogo.placar_mandante ?? 0;
                const pv = jogo.placar_visitante ?? 0;
                const mandanteVenceu = finalizado && (jogo.id_equipe_vencedora === jogo.id_equipe_mandante || (pm > pv));
                const visitanteVenceu = finalizado && (jogo.id_equipe_vencedora === jogo.id_equipe_visitante || (pv > pm));

                return (
                  <div
                    key={jogo.id_confronto}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 shadow-sm space-y-2"
                  >
                    {/* Mandante */}
                    <div className={`flex items-center justify-between p-1.5 rounded-xl ${
                      mandanteVenceu ? 'bg-emerald-50/80 dark:bg-emerald-950/40 font-black text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      <span className="truncate pr-2 text-xs" title={mandanteNome}>
                        {mandanteNome}
                      </span>
                      <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-black shrink-0 ${
                        finalizado
                          ? mandanteVenceu
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-400'
                      }`}>
                        {finalizado ? jogo.placar_mandante : '-'}
                      </span>
                    </div>

                    {/* Visitante */}
                    <div className={`flex items-center justify-between p-1.5 rounded-xl ${
                      visitanteVenceu ? 'bg-emerald-50/80 dark:bg-emerald-950/40 font-black text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      <span className="truncate pr-2 text-xs" title={visitanteNome}>
                        {visitanteNome}
                      </span>
                      <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-black shrink-0 ${
                        finalizado
                          ? visitanteVenceu
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-400'
                      }`}>
                        {finalizado ? jogo.placar_visitante : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==============================================================================
// SUB-COMPONENTE: TABELA DE ARTILHARIA PÚBLICA (LGPD COMPLIANT)
// ==============================================================================
function TabelaArtilhariaPublica({ artilharia }: { artilharia: ArtilheiroPublico[] }) {
  const getMedalha = (pos: number) => {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return `${pos}º`;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-150 dark:border-slate-700/60 overflow-hidden shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
            <Award size={22} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Ranking de Artilheiros
            </h3>
            <p className="text-xs text-slate-400">Goleadores oficiais da competição</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700/50 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
              <th className="py-3.5 px-4 text-center w-14">Rank</th>
              <th className="py-3.5 px-4">Atleta</th>
              <th className="py-3.5 px-4">Equipe / Clube</th>
              <th className="py-3.5 px-6 text-center font-black">Gols</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 font-semibold text-slate-700 dark:text-slate-300">
            {artilharia.map((item, idx) => {
              const pos = item.rank || item.posicao || idx + 1;
              const nomeJogador = item.nome_jogador || 'Atleta';
              const nomeEquipe = item.nome_equipe || item.equipe || 'Equipe';

              return (
                <tr
                  key={item.id_jogador || idx}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-700/20 transition-colors"
                >
                  <td className="py-3.5 px-4 text-center font-bold text-sm">
                    {getMedalha(pos)}
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-100 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{nomeJogador}</span>
                      {item.numero_camisa && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono">
                          #{item.numero_camisa}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Shield size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{nomeEquipe}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-6 text-center">
                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 px-3 py-1 rounded-xl font-mono text-sm font-black shadow-sm">
                      ⚽ {item.gols ?? 0}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
