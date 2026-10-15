'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  Shield,
  Flag,
  RotateCcw,
  Trophy
} from 'lucide-react';
import { ConfrontoV2, OcorrenciaPartidaV2, JogadorV2, TipoOcorrencia } from '@/types/competicoesV2';
import { competicoesV2Service } from '@/services/competicoesV2';

interface ModalSumulaAoVivoProps {
  confronto: ConfrontoV2 | null;
  isOpen: boolean;
  onClose: () => void;
  onAtualizado: () => void;
}

type ModalAcao = 'GOL' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO' | 'FINALIZAR' | null;

export default function ModalSumulaAoVivo({
  confronto,
  isOpen,
  onClose,
  onAtualizado,
}: ModalSumulaAoVivoProps) {
  const [partida, setPartida] = useState<ConfrontoV2 | null>(confronto);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaPartidaV2[]>([]);
  const [jogadoresMandante, setJogadoresMandante] = useState<JogadorV2[]>([]);
  const [jogadoresVisitante, setJogadoresVisitante] = useState<JogadorV2[]>([]);
  const [carregandoJogadores, setCarregandoJogadores] = useState(false);

  // Submodais de ação
  const [acaoAtual, setAcaoAtual] = useState<ModalAcao>(null);
  const [timeSelecionado, setTimeSelecionado] = useState<'MANDANTE' | 'VISITANTE'>('MANDANTE');
  const [idJogadorSelecionado, setIdJogadorSelecionado] = useState<string>('');
  const [minutoInput, setMinutoInput] = useState<string>('');
  const [golContra, setGolContra] = useState(false);
  const [observacaoInput, setObservacaoInput] = useState('');

  // Pênaltis para finalização
  const [penaltisMandante, setPenaltisMandante] = useState<string>('');
  const [penaltisVisitante, setPenaltisVisitante] = useState<string>('');

  const [loadingAcao, setLoadingAcao] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Sincroniza estado inicial com a prop confronto
  useEffect(() => {
    if (confronto) {
      setPartida(confronto);
      setOcorrencias(confronto.ocorrencias || []);
      carregarJogadores(confronto);
    }
  }, [confronto]);

  const carregarJogadores = async (conf: ConfrontoV2) => {
    setCarregandoJogadores(true);
    try {
      const [jm, jv] = await Promise.all([
        conf.id_equipe_mandante ? competicoesV2Service.listarJogadores(conf.id_equipe_mandante).catch(() => []) : [],
        conf.id_equipe_visitante ? competicoesV2Service.listarJogadores(conf.id_equipe_visitante).catch(() => []) : [],
      ]);
      setJogadoresMandante(jm);
      setJogadoresVisitante(jv);
    } catch {
      // Falha silenciosa de jogadores
    } finally {
      setCarregandoJogadores(false);
    }
  };

  const recarregarPartida = async () => {
    if (!partida) return;
    try {
      const confrontos = await competicoesV2Service.listarConfrontos(partida.id_competicao);
      const atualizado = confrontos.find((c) => c.id_confronto === partida.id_confronto);
      if (atualizado) {
        setPartida(atualizado);
        setOcorrencias(atualizado.ocorrencias || []);
      }
      onAtualizado();
    } catch (err: any) {
      console.error('Erro ao recarregar confronto:', err);
    }
  };

  if (!isOpen || !partida) return null;

  const nomeMandante = partida.equipe_mandante?.nome || `Equipe #${partida.id_equipe_mandante}`;
  const nomeVisitante = partida.equipe_visitante?.nome || `Equipe #${partida.id_equipe_visitante}`;
  const placarMandante = partida.placar_mandante ?? 0;
  const placarVisitante = partida.placar_visitante ?? 0;
  const isFinalizado = partida.status === 'Finalizado';

  const abrirAcao = (acao: ModalAcao) => {
    setAcaoAtual(acao);
    setTimeSelecionado('MANDANTE');
    setIdJogadorSelecionado('');
    setMinutoInput('');
    setGolContra(false);
    setObservacaoInput('');
    setMensagemErro(null);
    setMensagemSucesso(null);
  };

  const fecharAcao = () => {
    setAcaoAtual(null);
    setLoadingAcao(false);
  };

  const jogadoresDisponiveis = timeSelecionado === 'MANDANTE' ? jogadoresMandante : jogadoresVisitante;
  const idEquipeAlvo = timeSelecionado === 'MANDANTE' ? partida.id_equipe_mandante : partida.id_equipe_visitante;

  const handleSalvarOcorrencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acaoAtual || acaoAtual === 'FINALIZAR') return;

    setLoadingAcao(true);
    setMensagemErro(null);

    try {
      let tipo: TipoOcorrencia = 'GOL';
      if (acaoAtual === 'GOL') {
        tipo = golContra ? 'GOL_CONTRA' : 'GOL';
      } else if (acaoAtual === 'CARTAO_AMARELO') {
        tipo = 'CARTAO_AMARELO';
      } else if (acaoAtual === 'CARTAO_VERMELHO') {
        tipo = 'CARTAO_VERMELHO';
      }

      const minutoNum = minutoInput.trim() ? parseInt(minutoInput, 10) : undefined;
      const jogadorId = idJogadorSelecionado ? parseInt(idJogadorSelecionado, 10) : undefined;

      await competicoesV2Service.adicionarOcorrencia(partida.id_confronto, {
        id_equipe: idEquipeAlvo,
        id_jogador: jogadorId || null,
        tipo,
        minuto: minutoNum,
        observacao: observacaoInput.trim() || undefined,
      });

      setMensagemSucesso(
        acaoAtual === 'GOL'
          ? 'Gol registrado com sucesso!'
          : 'Cartão registrado com sucesso!'
      );
      fecharAcao();
      await recarregarPartida();
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao registrar evento. Verifique os dados.';
      setMensagemErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoadingAcao(false);
    }
  };

  const handleRemoverOcorrencia = async (idOcorrencia: number) => {
    if (!confirm('Deseja realmente estornar este evento da súmula?')) return;
    setMensagemErro(null);
    try {
      await competicoesV2Service.removerOcorrencia(idOcorrencia);
      setMensagemSucesso('Evento estornado com sucesso!');
      await recarregarPartida();
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao estornar ocorrência.';
      setMensagemErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleFinalizarPartida = async () => {
    setLoadingAcao(true);
    setMensagemErro(null);
    try {
      const penM = penaltisMandante.trim() ? parseInt(penaltisMandante, 10) : null;
      const penV = penaltisVisitante.trim() ? parseInt(penaltisVisitante, 10) : null;

      await competicoesV2Service.finalizarConfronto(partida.id_confronto, {
        penaltis_mandante: penM,
        penaltis_visitante: penV,
        observacoes: observacaoInput.trim() || undefined,
      });

      setMensagemSucesso('Partida finalizada com sucesso!');
      fecharAcao();
      await recarregarPartida();
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao finalizar partida.';
      setMensagemErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoadingAcao(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-700 w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header do Modal */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <Clock size={20} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                Súmula Beira de Campo
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isFinalizado
                      ? 'bg-purple-900/60 text-purple-300 border border-purple-700'
                      : partida.status === 'Em Andamento'
                      ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700 animate-pulse'
                      : 'bg-blue-900/60 text-blue-300 border border-blue-700'
                  }`}
                >
                  {partida.status}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {partida.fase || 'Fase Única'}
                {partida.rodada ? ` • Rodada ${partida.rodada}` : ''}
                {partida.grupo ? ` • Grupo ${partida.grupo}` : ''}
                {partida.ordem_jogo === 2 ? ' • Jogo de Volta' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* Feedback Messages */}
        {mensagemSucesso && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-2xl flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{mensagemSucesso}</span>
          </div>
        )}
        {mensagemErro && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/80 border border-rose-700 text-rose-300 rounded-2xl flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{mensagemErro}</span>
          </div>
        )}

        {/* Placar Gigante no Topo */}
        <div className="p-6 bg-gradient-to-b from-slate-800/60 to-slate-900/40 border-b border-slate-800">
          <div className="grid grid-cols-5 items-center text-center gap-2 sm:gap-4">
            {/* Mandante */}
            <div className="col-span-2 flex flex-col items-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-950 border border-blue-600/40 flex items-center justify-center font-black text-xl text-blue-400 shadow-inner mb-2">
                {nomeMandante.substring(0, 2).toUpperCase()}
              </div>
              <span className="font-extrabold text-sm sm:text-base text-slate-100 line-clamp-2">
                {nomeMandante}
              </span>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mt-0.5">
                Mandante
              </span>
            </div>

            {/* Placar Central */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 sm:gap-3 bg-slate-950/90 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl border border-slate-700 shadow-inner">
                <span className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                  {placarMandante}
                </span>
                <span className="text-slate-500 font-bold text-xl sm:text-2xl">x</span>
                <span className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                  {placarVisitante}
                </span>
              </div>
              {(partida.penaltis_mandante !== null && partida.penaltis_mandante !== undefined) && (
                <div className="mt-2 text-xs text-amber-400 font-bold tracking-wide">
                  (Pên: {partida.penaltis_mandante} x {partida.penaltis_visitante})
                </div>
              )}
            </div>

            {/* Visitante */}
            <div className="col-span-2 flex flex-col items-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-950 border border-emerald-600/40 flex items-center justify-center font-black text-xl text-emerald-400 shadow-inner mb-2">
                {nomeVisitante.substring(0, 2).toUpperCase()}
              </div>
              <span className="font-extrabold text-sm sm:text-base text-slate-100 line-clamp-2">
                {nomeVisitante}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-0.5">
                Visitante
              </span>
            </div>
          </div>
        </div>

        {/* Botões de Ação Rápida */}
        {!isFinalizado && (
          <div className="px-6 py-4 bg-slate-800/40 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => abrirAcao('GOL')}
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
            >
              <Plus size={18} />
              + Gol
            </button>
            <button
              onClick={() => abrirAcao('CARTAO_AMARELO')}
              className="py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950 transition-all cursor-pointer"
            >
              <div className="w-3.5 h-4.5 bg-amber-300 rounded-[2px] border border-amber-900" />
              Amarelo
            </button>
            <button
              onClick={() => abrirAcao('CARTAO_VERMELHO')}
              className="py-3 px-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950 transition-all cursor-pointer"
            >
              <div className="w-3.5 h-4.5 bg-rose-300 rounded-[2px] border border-rose-900" />
              Vermelho
            </button>
            <button
              onClick={() => abrirAcao('FINALIZAR')}
              className="py-3 px-4 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-950 transition-all cursor-pointer"
            >
              <Flag size={18} />
              Finalizar
            </button>
          </div>
        )}

        {/* Submodal / Painel de Ação Ativa */}
        {acaoAtual && (
          <div className="p-6 bg-slate-800/90 border-b border-slate-700 animate-in fade-in slide-in-from-top-4">
            {acaoAtual === 'FINALIZAR' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Flag size={18} className="text-purple-400" />
                    Encerrar Partida
                  </h3>
                  <button
                    onClick={fecharAcao}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Cancelar
                  </button>
                </div>
                <p className="text-xs text-slate-300">
                  Deseja confirmar o encerramento do confronto? O placar regular será fixado em{' '}
                  <strong className="text-white">
                    {placarMandante} x {placarVisitante}
                  </strong>
                  .
                </p>

                {/* Se empate, permite informar cobrança de pênaltis */}
                {placarMandante === placarVisitante && (
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Trophy size={14} />
                      Partida empatada. Houve disputa de pênaltis?
                    </span>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Pênaltis {nomeMandante}:
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={penaltisMandante}
                          onChange={(e) => setPenaltisMandante(e.target.value)}
                          placeholder="Ex: 5"
                          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Pênaltis {nomeVisitante}:
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={penaltisVisitante}
                          onChange={(e) => setPenaltisVisitante(e.target.value)}
                          placeholder="Ex: 4"
                          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Observações da arbitragem (opcional):
                  </label>
                  <input
                    type="text"
                    value={observacaoInput}
                    onChange={(e) => setObservacaoInput(e.target.value)}
                    placeholder="Ex: Jogo transcorreu sem intercorrências..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={fecharAcao}
                    className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={loadingAcao}
                    onClick={handleFinalizarPartida}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingAcao ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
                    Confirmar Encerramento
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSalvarOcorrencia} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {acaoAtual === 'GOL' && <Plus size={18} className="text-emerald-400" />}
                    {acaoAtual === 'CARTAO_AMARELO' && (
                      <div className="w-3.5 h-4.5 bg-amber-400 rounded-[2px]" />
                    )}
                    {acaoAtual === 'CARTAO_VERMELHO' && (
                      <div className="w-3.5 h-4.5 bg-rose-500 rounded-[2px]" />
                    )}
                    Lançar{' '}
                    {acaoAtual === 'GOL'
                      ? 'Novo Gol'
                      : acaoAtual === 'CARTAO_AMARELO'
                      ? 'Cartão Amarelo'
                      : 'Cartão Vermelho'}
                  </h3>
                  <button
                    type="button"
                    onClick={fecharAcao}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Cancelar
                  </button>
                </div>

                {/* Seleção de Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Selecione a Equipe:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTimeSelecionado('MANDANTE');
                        setIdJogadorSelecionado('');
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                        timeSelecionado === 'MANDANTE'
                          ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {nomeMandante}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimeSelecionado('VISITANTE');
                        setIdJogadorSelecionado('');
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                        timeSelecionado === 'VISITANTE'
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {nomeVisitante}
                    </button>
                  </div>
                </div>

                {/* Seleção de Jogador e Minuto */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Atleta:
                    </label>
                    {carregandoJogadores ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                        <Loader2 size={14} className="animate-spin" /> Carregando elenco...
                      </div>
                    ) : (
                      <select
                        value={idJogadorSelecionado}
                        onChange={(e) => setIdJogadorSelecionado(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">
                          {acaoAtual === 'GOL' ? 'Não identificado / Desconhecido' : 'Selecione o atleta...'}
                        </option>
                        {jogadoresDisponiveis.map((j) => (
                          <option key={j.id_jogador} value={j.id_jogador}>
                            {j.numero_camisa ? `#${j.numero_camisa} - ` : ''}
                            {j.nome}
                            {j.posicao ? ` (${j.posicao})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Minuto do Jogo:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="150"
                      value={minutoInput}
                      onChange={(e) => setMinutoInput(e.target.value)}
                      placeholder="Ex: 34"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Checkbox Gol Contra */}
                {acaoAtual === 'GOL' && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-400">
                    <input
                      type="checkbox"
                      checked={golContra}
                      onChange={(e) => setGolContra(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>Gol Contra (favorece o adversário)</span>
                  </label>
                )}

                {/* Observação / Motivo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Observação / Motivo (opcional):
                  </label>
                  <input
                    type="text"
                    value={observacaoInput}
                    onChange={(e) => setObservacaoInput(e.target.value)}
                    placeholder={
                      acaoAtual === 'GOL'
                        ? 'Ex: De cabeça, pênalti, falta...'
                        : 'Ex: Falta tática, reclamação excessiva...'
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={fecharAcao}
                    className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAcao}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 disabled:opacity-50 shadow-md"
                  >
                    {loadingAcao ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Salvar Evento
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Linha do Tempo / Histórico de Eventos */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Clock size={14} />
              Linha do Tempo de Ocorrências ({ocorrencias.length})
            </h3>
            <span className="text-[11px] text-slate-500">Ordem cronológica</span>
          </div>

          {ocorrencias.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <Clock size={28} className="text-slate-700" />
              Nenhum gol ou cartão lançado até o momento.
            </div>
          ) : (
            <div className="space-y-2">
              {ocorrencias
                .slice()
                .sort((a, b) => (a.minuto || 0) - (b.minuto || 0))
                .map((oc) => {
                  const isMandante = oc.id_equipe === partida.id_equipe_mandante;
                  const isGol = oc.tipo === 'GOL';
                  const isGolContra = oc.tipo === 'GOL_CONTRA';
                  const isAmarelo = oc.tipo === 'CARTAO_AMARELO';
                  const isVermelho = oc.tipo === 'CARTAO_VERMELHO';

                  return (
                    <div
                      key={oc.id_ocorrencia}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
                        isGol
                          ? 'bg-emerald-950/40 border-emerald-900/60'
                          : isGolContra
                          ? 'bg-rose-950/40 border-rose-900/60'
                          : isAmarelo
                          ? 'bg-amber-950/40 border-amber-900/60'
                          : 'bg-rose-950/40 border-rose-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Minuto */}
                        <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 font-black text-[11px] min-w-[36px] text-center border border-slate-700">
                          {oc.minuto ? `${oc.minuto}'` : '—'}
                        </span>

                        {/* Ícone do evento */}
                        <div className="shrink-0">
                          {isGol && (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              ⚽ Gol
                            </span>
                          )}
                          {isGolContra && (
                            <span className="text-rose-400 font-bold flex items-center gap-1">
                              ⚽ (Contra)
                            </span>
                          )}
                          {isAmarelo && (
                            <div className="w-3.5 h-4.5 bg-amber-400 rounded-[2px] shadow" />
                          )}
                          {isVermelho && (
                            <div className="w-3.5 h-4.5 bg-rose-500 rounded-[2px] shadow" />
                          )}
                        </div>

                        {/* Descrição do Atleta e Equipe */}
                        <div>
                          <div className="font-bold text-slate-100 flex items-center gap-2">
                            <span>{oc.nome_jogador || 'Atleta não identificado'}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                isMandante
                                  ? 'bg-blue-900/60 text-blue-300'
                                  : 'bg-emerald-900/60 text-emerald-300'
                              }`}
                            >
                              {oc.nome_equipe || (isMandante ? nomeMandante : nomeVisitante)}
                            </span>
                          </div>
                          {oc.observacao && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {oc.observacao}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botão de Estorno */}
                      {!isFinalizado && (
                        <button
                          onClick={() => handleRemoverOcorrencia(oc.id_ocorrencia)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Estornar ocorrência"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 bg-slate-800/80 border-t border-slate-700 flex justify-between items-center text-xs text-slate-400">
          <span>ID do Confronto: #{partida.id_confronto}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
          >
            Fechar Súmula
          </button>
        </div>
      </div>
    </div>
  );
}
