'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Play,
  RotateCw,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  Sparkles,
  Trophy
} from 'lucide-react';
import { ConfrontoV2 } from '@/types/competicoesV2';
import { competicoesV2Service } from '@/services/competicoesV2';
import ModalSumulaAoVivo from './ModalSumulaAoVivo';

interface TabelaJogosConfrontosProps {
  idCompeticao: number;
  statusCompeticao: string;
  onConfrontosAtualizados?: () => void;
}

export default function TabelaJogosConfrontos({
  idCompeticao,
  statusCompeticao,
  onConfrontosAtualizados,
}: TabelaJogosConfrontosProps) {
  const [confrontos, setConfrontos] = useState<ConfrontoV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [modalConfirmarGeracao, setModalConfirmarGeracao] = useState(false);
  const [confrontoSelecionado, setConfrontoSelecionado] = useState<ConfrontoV2 | null>(null);
  const [modalSumulaAberto, setModalSumulaAberto] = useState(false);

  // Filtros
  const [filtroRodada, setFiltroRodada] = useState<string>('TODAS');
  const [filtroFase, setFiltroFase] = useState<string>('TODAS');
  const [filtroGrupo, setFiltroGrupo] = useState<string>('TODOS');

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const carregarConfrontos = async () => {
    setLoading(true);
    setMensagemErro(null);
    try {
      const dados = await competicoesV2Service.listarConfrontos(idCompeticao);
      setConfrontos(dados);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao carregar confrontos.';
      setMensagemErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (idCompeticao) {
      carregarConfrontos();
    }
  }, [idCompeticao]);

  const handleGerarConfrontos = async () => {
    setGerando(true);
    setMensagemErro(null);
    try {
      await competicoesV2Service.gerarConfrontos(idCompeticao);
      setMensagemSucesso('Tabela de jogos e confrontos gerada com sucesso!');
      setModalConfirmarGeracao(false);
      await carregarConfrontos();
      onConfrontosAtualizados?.();
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao gerar confrontos. Verifique se há equipes suficientes cadastradas.';
      setMensagemErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setGerando(false);
    }
  };

  const abrirSumula = (confronto: ConfrontoV2) => {
    setConfrontoSelecionado(confronto);
    setModalSumulaAberto(true);
  };

  const handleSumulaAtualizada = () => {
    carregarConfrontos();
    onConfrontosAtualizados?.();
  };

  // Listas para os filtros
  const rodadasDisponiveis = useMemo(() => {
    const rounds = new Set<number>();
    confrontos.forEach((c) => {
      if (c.rodada !== null && c.rodada !== undefined) rounds.add(c.rodada);
    });
    return Array.from(rounds).sort((a, b) => a - b);
  }, [confrontos]);

  const fasesDisponiveis = useMemo(() => {
    const phases = new Set<string>();
    confrontos.forEach((c) => {
      if (c.fase) phases.add(c.fase);
    });
    return Array.from(phases);
  }, [confrontos]);

  const gruposDisponiveis = useMemo(() => {
    const groups = new Set<string>();
    confrontos.forEach((c) => {
      if (c.grupo) groups.add(c.grupo);
    });
    return Array.from(groups).sort();
  }, [confrontos]);

  // Confrontos filtrados
  const confrontosFiltrados = useMemo(() => {
    return confrontos.filter((c) => {
      if (filtroRodada !== 'TODAS' && c.rodada !== parseInt(filtroRodada, 10)) {
        return false;
      }
      if (filtroFase !== 'TODAS' && c.fase !== filtroFase) {
        return false;
      }
      if (filtroGrupo !== 'TODOS' && c.grupo !== filtroGrupo) {
        return false;
      }
      return true;
    });
  }, [confrontos, filtroRodada, filtroFase, filtroGrupo]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Em Andamento':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
            Ao Vivo
          </span>
        );
      case 'Finalizado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            Encerrado
          </span>
        );
      case 'Cancelado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            Agendado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensagens de Notificação */}
      {mensagemSucesso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-center gap-3">
          <CheckCircle2 size={20} className="shrink-0" />
          <span className="text-sm font-semibold">{mensagemSucesso}</span>
        </div>
      )}
      {mensagemErro && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-3">
          <AlertTriangle size={20} className="shrink-0" />
          <span className="text-sm font-semibold">{mensagemErro}</span>
        </div>
      )}

      {/* Barra de Ações e Filtros */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Controles de Filtro */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Filter size={14} /> Filtros:
          </div>

          {/* Filtro por Fase */}
          {fasesDisponiveis.length > 0 && (
            <select
              value={filtroFase}
              onChange={(e) => setFiltroFase(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="TODAS">Todas as Fases</option>
              {fasesDisponiveis.map((f) => (
                <option key={f} value={f}>
                  Fase: {f}
                </option>
              ))}
            </select>
          )}

          {/* Filtro por Rodada */}
          {rodadasDisponiveis.length > 0 && (
            <select
              value={filtroRodada}
              onChange={(e) => setFiltroRodada(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="TODAS">Todas as Rodadas</option>
              {rodadasDisponiveis.map((r) => (
                <option key={r} value={r.toString()}>
                  Rodada {r}
                </option>
              ))}
            </select>
          )}

          {/* Filtro por Grupo */}
          {gruposDisponiveis.length > 0 && (
            <select
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="TODOS">Todos os Grupos</option>
              {gruposDisponiveis.map((g) => (
                <option key={g} value={g}>
                  Grupo {g}
                </option>
              ))}
            </select>
          )}

          {(filtroFase !== 'TODAS' || filtroRodada !== 'TODAS' || filtroGrupo !== 'TODOS') && (
            <button
              onClick={() => {
                setFiltroFase('TODAS');
                setFiltroRodada('TODAS');
                setFiltroGrupo('TODOS');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Botão de Geração de Confrontos */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalConfirmarGeracao(true)}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-blue-100 transition-all cursor-pointer"
          >
            <Sparkles size={16} />
            {confrontos.length > 0 ? 'Regerar Confrontos' : 'Gerar Confrontos'}
          </button>
          <button
            onClick={carregarConfrontos}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-colors cursor-pointer"
            title="Recarregar jogos"
          >
            <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Modal de Confirmação de Geração */}
      {modalConfirmarGeracao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Gerar Tabela de Confrontos
            </h3>
            <p className="text-sm text-slate-600">
              O motor automático irá sortear as rodadas ou chaveamentos com base no formato da competição e nas equipes cadastradas.
              {confrontos.length > 0 && (
                <span className="block mt-2 font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs">
                  Atenção: Já existem {confrontos.length} confrontos criados. Ao regerar, confrontos sem resultados registrados poderão ser atualizados ou substituídos.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmarGeracao(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={gerando}
                onClick={handleGerarConfrontos}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {gerando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Confirmar e Gerar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listagem de Confrontos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 size={36} className="animate-spin text-blue-600" />
          <p className="text-slate-500 text-xs font-medium">Carregando confrontos...</p>
        </div>
      ) : confrontosFiltrados.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Calendar size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-700">Nenhum confronto encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {confrontos.length === 0
              ? 'Esta competição ainda não tem jogos gerados. Cadastre as equipes e clique em "Gerar Confrontos".'
              : 'Nenhum jogo corresponde aos filtros selecionados. Tente ajustar os filtros acima.'}
          </p>
          {confrontos.length === 0 && (
            <button
              onClick={() => setModalConfirmarGeracao(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-2xl text-xs inline-flex items-center gap-2 shadow-md shadow-blue-100 cursor-pointer"
            >
              <Sparkles size={16} />
              Gerar Confrontos Agora
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {confrontosFiltrados.map((confronto) => {
            const mandanteNome =
              confronto.equipe_mandante?.nome || `Equipe #${confronto.id_equipe_mandante}`;
            const visitanteNome =
              confronto.equipe_visitante?.nome || `Equipe #${confronto.id_equipe_visitante}`;
            const isFinalizado = confronto.status === 'Finalizado';
            const isEmAndamento = confronto.status === 'Em Andamento';

            const placarM = confronto.placar_mandante !== null ? confronto.placar_mandante : '-';
            const placarV = confronto.placar_visitante !== null ? confronto.placar_visitante : '-';

            return (
              <div
                key={confronto.id_confronto}
                className="bg-white rounded-3xl border border-slate-100 hover:border-blue-200 transition-all shadow-sm hover:shadow-md overflow-hidden flex flex-col justify-between"
              >
                {/* Cabeçalho do Card */}
                <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <span className="font-bold text-slate-800">
                      {confronto.fase || 'Fase Única'}
                    </span>
                    {confronto.rodada && (
                      <span className="text-slate-400 font-normal">
                        • Rodada {confronto.rodada}
                      </span>
                    )}
                    {confronto.grupo && (
                      <span className="px-2 py-0.5 bg-slate-200/70 rounded-md text-[11px] font-bold text-slate-700">
                        Grupo {confronto.grupo}
                      </span>
                    )}
                    {confronto.ordem_jogo === 2 && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-[11px] font-bold">
                        Volta
                      </span>
                    )}
                  </div>
                  <div>{statusBadge(confronto.status)}</div>
                </div>

                {/* Corpo do Confronto (Placar) */}
                <div className="p-5 flex items-center justify-between gap-4">
                  {/* Mandante */}
                  <div className="flex-1 text-right">
                    <h4 className="font-bold text-sm text-slate-800 line-clamp-2">
                      {mandanteNome}
                    </h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Mandante
                    </span>
                  </div>

                  {/* Placar Central */}
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <div className="px-4 py-2 bg-slate-900 text-white rounded-2xl font-black text-xl flex items-center gap-2 shadow-inner">
                      <span>{placarM}</span>
                      <span className="text-slate-500 text-sm font-normal">x</span>
                      <span>{placarV}</span>
                    </div>

                    {confronto.penaltis_mandante !== null &&
                      confronto.penaltis_mandante !== undefined && (
                        <span className="text-[11px] font-bold text-amber-600 mt-1">
                          (Pên: {confronto.penaltis_mandante} x {confronto.penaltis_visitante})
                        </span>
                      )}
                  </div>

                  {/* Visitante */}
                  <div className="flex-1 text-left">
                    <h4 className="font-bold text-sm text-slate-800 line-clamp-2">
                      {visitanteNome}
                    </h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Visitante
                    </span>
                  </div>
                </div>

                {/* Rodapé e Botão Súmula */}
                <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-slate-500">
                    {(confronto.data || confronto.data_hora) && (
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        {confronto.data || confronto.data_hora}
                      </span>
                    )}
                    {confronto.hora && (
                      <span className="flex items-center gap-1">
                        <Clock size={13} className="text-slate-400" />
                        {confronto.hora}
                      </span>
                    )}
                    {confronto.local && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-slate-400" />
                        {typeof confronto.local === 'object'
                          ? confronto.local.nome
                          : confronto.local}
                      </span>
                    )}
                  </div>

                  {/* Botão em Destaque Súmula / Ao Vivo */}
                  <button
                    onClick={() => abrirSumula(confronto)}
                    className="ml-auto bg-slate-900 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <FileText size={14} />
                    Súmula / Ao Vivo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Súmula Beira de Campo */}
      <ModalSumulaAoVivo
        confronto={confrontoSelecionado}
        isOpen={modalSumulaAberto}
        onClose={() => {
          setModalSumulaAberto(false);
          setConfrontoSelecionado(null);
        }}
        onAtualizado={handleSumulaAtualizada}
      />
    </div>
  );
}
