'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Trophy,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle,
  PlusCircle,
  Trash2,
  UserCheck,
  ShieldAlert,
  Clock,
  Flag,
  User,
} from 'lucide-react';
import {
  obterSumula,
  listarEquipes,
  registrarOcorrencia,
  atribuirAutorOcorrencia,
  removerOcorrencia,
  finalizarPartida,
  isErroApi,
} from '@/services/competicoes';
import type {
  PartidaDetalhe,
  SumulaDetalhe,
  EquipeDetalhe,
  OcorrenciaDetalhe,
  TipoOcorrenciaLancamento,
  OcorrenciaCriar,
  PartidaFinalizar,
} from '@/types/competicoes';

export interface ModalSumulaDetalhadaProps {
  partida: PartidaDetalhe;
  idEdicaoCompeticao: number;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalSumulaDetalhada({
  partida,
  idEdicaoCompeticao,
  onClose,
  onSucesso,
}: ModalSumulaDetalhadaProps) {
  const [sumula, setSumula] = useState<SumulaDetalhe | null>(null);
  const [equipes, setEquipes] = useState<EquipeDetalhe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Formulário de Nova Ocorrência
  const [tipoOcorrencia, setTipoOcorrencia] = useState<TipoOcorrenciaLancamento>('GOL');
  const [idEquipeSelecionada, setIdEquipeSelecionada] = useState<number>(
    partida.id_equipe_mandante || 0
  );
  const [idIntegranteSelecionado, setIdIntegranteSelecionado] = useState<string>('');
  const [minuto, setMinuto] = useState<string>('');
  const [periodo, setPeriodo] = useState<string>('1º Tempo');
  const [observacao, setObservacao] = useState<string>('');
  const [salvandoOcorrencia, setSalvandoOcorrencia] = useState(false);

  // Estado para Atribuição/Correção de Autor
  const [ocorrenciaEditandoAutor, setOcorrenciaEditandoAutor] = useState<OcorrenciaDetalhe | null>(null);
  const [novoAutorId, setNovoAutorId] = useState<string>('');
  const [motivoAutor, setMotivoAutor] = useState<string>('');
  const [salvandoAutor, setSalvandoAutor] = useState(false);

  // Estado de Remoção de Ocorrência
  const [removendoId, setRemovendoId] = useState<number | null>(null);

  // Estado de Finalização de Partida
  const [finalizando, setFinalizando] = useState(false);
  const [penaltisMandante, setPenaltisMandante] = useState<string>('');
  const [penaltisVisitante, setPenaltisVisitante] = useState<string>('');

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const [sumulaRes, equipesRes] = await Promise.all([
        obterSumula(partida.id_partida),
        listarEquipes(idEdicaoCompeticao),
      ]);

      setSumula(sumulaRes);

      // Filtra as equipes desta partida
      const equipesPartida = (equipesRes || []).filter(
        (eq) =>
          eq.id_equipe === partida.id_equipe_mandante ||
          eq.id_equipe === partida.id_equipe_visitante
      );
      setEquipes(equipesPartida);

      if (partida.id_equipe_mandante && !idEquipeSelecionada) {
        setIdEquipeSelecionada(partida.id_equipe_mandante);
      }
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao carregar a súmula detalhada da partida.');
      }
    } finally {
      setCarregando(false);
    }
  }, [partida.id_partida, partida.id_equipe_mandante, partida.id_equipe_visitante, idEdicaoCompeticao, idEquipeSelecionada]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const partidaAtual = sumula?.partida || partida;
  const statusAtual = partidaAtual.status || 'AGENDADA';
  const podeRegistrar = statusAtual === 'AGENDADA' || statusAtual === 'EM_ANDAMENTO';
  const isFinalizada = statusAtual === 'FINALIZADA';

  // Integrantes da equipe selecionada para o formulário
  const integrantesEquipeSelecionada = useMemo(() => {
    const equipe = equipes.find((e) => e.id_equipe === Number(idEquipeSelecionada));
    if (!equipe || !equipe.integrantes) return [];
    return equipe.integrantes.filter((i) => i.situacao === 'ATIVO' || !i.situacao);
  }, [equipes, idEquipeSelecionada]);

  // Mapa de integrantes para exibição geral
  const mapaIntegrantes = useMemo(() => {
    const map = new Map<number, { nome: string; camisa?: number | null; equipeId: number }>();
    equipes.forEach((eq) => {
      eq.integrantes?.forEach((integ) => {
        map.set(integ.id_integrante, {
          nome: integ.nome_esportivo,
          camisa: integ.numero_camisa,
          equipeId: eq.id_equipe,
        });
      });
    });
    return map;
  }, [equipes]);

  // Equipes mandante e visitante
  const equipeMandante = useMemo(
    () => equipes.find((e) => e.id_equipe === partida.id_equipe_mandante),
    [equipes, partida.id_equipe_mandante]
  );
  const equipeVisitante = useMemo(
    () => equipes.find((e) => e.id_equipe === partida.id_equipe_visitante),
    [equipes, partida.id_equipe_visitante]
  );

  const golsMandante = partidaAtual.placar?.gols_mandante ?? 0;
  const golsVisitante = partidaAtual.placar?.gols_visitante ?? 0;
  const ehMataMata = partidaAtual.id_duelo != null;
  const empateMataMata = ehMataMata && golsMandante === golsVisitante;

  // Handler: Adicionar Ocorrência
  const handleRegistrarOcorrencia = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    // Validações locais
    if (!idEquipeSelecionada) {
      setErro('Selecione a equipe da ocorrência.');
      return;
    }

    if (tipoOcorrencia !== 'GOL' && !idIntegranteSelecionado) {
      setErro('Selecione o atleta para registrar este tipo de ocorrência.');
      return;
    }

    try {
      setSalvandoOcorrencia(true);

      const dados: OcorrenciaCriar = {
        tipo: tipoOcorrencia,
        id_equipe: Number(idEquipeSelecionada),
        id_integrante: idIntegranteSelecionado ? Number(idIntegranteSelecionado) : null,
        minuto: minuto ? Number(minuto) : null,
        periodo: periodo || null,
        observacao: observacao.trim() || null,
      };

      const sumulaAtualizada = await registrarOcorrencia(partida.id_partida, dados);
      setSumula(sumulaAtualizada);
      setSucesso('Ocorrência registrada com sucesso!');

      // Reset dos campos de atleta/minuto/observação
      setIdIntegranteSelecionado('');
      setMinuto('');
      setObservacao('');
      onSucesso();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao registrar ocorrência na súmula.');
      }
    } finally {
      setSalvandoOcorrencia(false);
    }
  };

  // Handler: Remover Ocorrência
  const handleRemoverOcorrencia = async (idOcorrencia: number) => {
    setErro(null);
    setSucesso(null);

    try {
      setRemovendoId(idOcorrencia);
      const sumulaAtualizada = await removerOcorrencia(idOcorrencia);
      setSumula(sumulaAtualizada);
      setSucesso('Ocorrência removida com sucesso!');
      onSucesso();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao remover ocorrência.');
      }
    } finally {
      setRemovendoId(null);
    }
  };

  // Handler: Abrir atribuição de autor
  const handleAbrirAtribuirAutor = (oc: OcorrenciaDetalhe) => {
    setOcorrenciaEditandoAutor(oc);
    setNovoAutorId(oc.id_integrante ? String(oc.id_integrante) : '');
    setMotivoAutor('');
    setErro(null);
  };

  // Handler: Salvar Atribuição/Correção de Autor
  const handleSalvarAutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocorrenciaEditandoAutor) return;

    if (isFinalizada && (!motivoAutor || motivoAutor.trim().length < 3)) {
      setErro('Informe um motivo com ao menos 3 caracteres para corrigir autoria em partida finalizada.');
      return;
    }

    try {
      setSalvandoAutor(true);
      setErro(null);

      const sumulaAtualizada = await atribuirAutorOcorrencia(
        ocorrenciaEditandoAutor.id_ocorrencia,
        {
          id_integrante: novoAutorId ? Number(novoAutorId) : null,
          motivo: isFinalizada ? motivoAutor.trim() : undefined,
        }
      );

      setSumula(sumulaAtualizada);
      setOcorrenciaEditandoAutor(null);
      setSucesso('Autoria atualizada com sucesso!');
      onSucesso();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao atualizar autor da ocorrência.');
      }
    } finally {
      setSalvandoAutor(false);
    }
  };

  // Handler: Finalizar Partida
  const handleFinalizarPartida = async () => {
    setErro(null);
    setSucesso(null);

    let dadosFinalizacao: PartidaFinalizar | undefined = undefined;

    if (empateMataMata) {
      if (penaltisMandante.trim() === '' || penaltisVisitante.trim() === '') {
        setErro('Em partidas de mata-mata empatadas, informe o placar da disputa de pênaltis.');
        return;
      }
      const pm = Number(penaltisMandante);
      const pv = Number(penaltisVisitante);
      if (isNaN(pm) || isNaN(pv) || pm < 0 || pv < 0) {
        setErro('Os gols de pênalti devem ser números válidos.');
        return;
      }
      if (pm === pv) {
        setErro('A disputa de pênaltis não pode terminar empatada.');
        return;
      }
      dadosFinalizacao = { penaltis_mandante: pm, penaltis_visitante: pv };
    }

    try {
      setFinalizando(true);
      await finalizarPartida(partida.id_partida, dadosFinalizacao);
      setSucesso('Partida finalizada com sucesso!');
      await carregarDados();
      onSucesso();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao finalizar a partida.');
      }
    } finally {
      setFinalizando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sumula-titulo"
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden"
      >
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Trophy size={20} />
            </div>
            <div>
              <h2 id="sumula-titulo" className="text-lg font-bold text-slate-800">
                Súmula Detalhada do Jogo #{partida.numero_partida || partida.id_partida}
              </h2>
              <p className="text-xs text-slate-500">
                {partida.nome_mandante || 'Mandante'} vs {partida.nome_visitante || 'Visitante'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              data-testid="badge-status-sumula"
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                statusAtual === 'AGENDADA'
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : statusAtual === 'EM_ANDAMENTO'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : statusAtual === 'FINALIZADA'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {statusAtual}
            </span>
            <button
              type="button"
              data-testid="btn-fechar-sumula"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Mensagens de Sucesso / Erro */}
          {sucesso && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                <span>{sucesso}</span>
              </div>
              <button
                type="button"
                onClick={() => setSucesso(null)}
                className="text-emerald-600 hover:text-emerald-800 p-1"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {erro && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-600 shrink-0" />
                <span>{erro}</span>
              </div>
              <button
                type="button"
                onClick={() => setErro(null)}
                className="text-red-600 hover:text-red-800 p-1"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Destaque do Placar */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md">
            <div className="grid grid-cols-12 items-center gap-4">
              {/* Mandante */}
              <div className="col-span-5 text-right">
                <h3 className="font-extrabold text-base md:text-xl truncate" title={partida.nome_mandante || 'Mandante'}>
                  {partida.nome_mandante || 'Mandante'}
                </h3>
                {partida.sigla_mandante && (
                  <span className="text-xs text-slate-400 font-semibold uppercase">
                    {partida.sigla_mandante}
                  </span>
                )}
              </div>

              {/* Placar Central */}
              <div className="col-span-2 flex flex-col items-center justify-center">
                <div className="flex items-center gap-3">
                  <span
                    data-testid="placar-mandante"
                    className="text-3xl md:text-4xl font-black text-amber-400"
                  >
                    {golsMandante}
                  </span>
                  <span className="text-slate-500 font-bold text-xl">x</span>
                  <span
                    data-testid="placar-visitante"
                    className="text-3xl md:text-4xl font-black text-amber-400"
                  >
                    {golsVisitante}
                  </span>
                </div>
                {partidaAtual.placar?.penaltis_mandante != null &&
                  partidaAtual.placar?.penaltis_visitante != null && (
                    <span className="text-xs text-slate-300 font-medium mt-1">
                      (Pên: {partidaAtual.placar.penaltis_mandante} x{' '}
                      {partidaAtual.placar.penaltis_visitante})
                    </span>
                  )}
              </div>

              {/* Visitante */}
              <div className="col-span-5 text-left">
                <h3 className="font-extrabold text-base md:text-xl truncate" title={partida.nome_visitante || 'Visitante'}>
                  {partida.nome_visitante || 'Visitante'}
                </h3>
                {partida.sigla_visitante && (
                  <span className="text-xs text-slate-400 font-semibold uppercase">
                    {partida.sigla_visitante}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Banner de Alerta Disciplinar (Atletas Suspensos) */}
          {sumula?.alertas_suspensos && sumula.alertas_suspensos.length > 0 && (
            <div
              role="alert"
              aria-label="Alerta de atletas suspensos"
              className="p-4 bg-amber-50 border-l-4 border-amber-500 border-y border-r border-amber-200 rounded-xl space-y-2"
            >
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <ShieldAlert size={18} className="text-amber-600 shrink-0" />
                <span>Alerta Disciplinar: Atletas com Suspensão Ativa</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Os seguintes atletas vinculados a esta partida possuem suspensão automática ou disciplinar pendente.
                <span className="font-semibold ml-1">
                  Nota informativa (Ruling R33): Este alerta não bloqueia a súmula nem a participação do atleta.
                </span>
              </p>
              <ul className="text-xs text-amber-900 divide-y divide-amber-200/60 pt-1">
                {sumula.alertas_suspensos.map((alerta) => (
                  <li key={alerta.id_suspensao} className="py-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold">{alerta.nome_esportivo}</span>
                      <span className="text-amber-700 ml-1">
                        ({alerta.id_equipe === partida.id_equipe_mandante ? partida.nome_mandante : partida.nome_visitante})
                      </span>
                      <span className="text-amber-600 ml-2 italic">— {alerta.motivo}</span>
                    </div>
                    <span className="font-semibold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded text-[11px]">
                      {alerta.jogos_pendentes} jogo(s) pendente(s)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Formulário de Registro de Ocorrência */}
          {podeRegistrar ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <PlusCircle size={16} className="text-blue-600" />
                  <span>Registrar Ocorrência na Súmula</span>
                </h4>
                <span className="text-[11px] text-slate-500">
                  Partida {statusAtual === 'AGENDADA' ? 'será iniciada ao lançar' : 'em andamento'}
                </span>
              </div>

              <form onSubmit={handleRegistrarOcorrencia} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Tipo de Ocorrência */}
                  <div className="md:col-span-4">
                    <label
                      htmlFor="ocorrencia-tipo"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Tipo de Ocorrência *
                    </label>
                    <select
                      id="ocorrencia-tipo"
                      data-testid="select-tipo-ocorrencia"
                      value={tipoOcorrencia}
                      onChange={(e) => setTipoOcorrencia(e.target.value as TipoOcorrenciaLancamento)}
                      className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="GOL">⚽ Gol</option>
                      <option value="GOL_CONTRA">🥅 Gol Contra (a favor adversário)</option>
                      <option value="CARTAO_AMARELO">🟨 Cartão Amarelo</option>
                      <option value="CARTAO_VERMELHO_DIRETO">🟥 Cartão Vermelho Direto</option>
                    </select>
                  </div>

                  {/* Equipe */}
                  <div className="md:col-span-4">
                    <label
                      htmlFor="ocorrencia-equipe"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Equipe do Atleta *
                    </label>
                    <select
                      id="ocorrencia-equipe"
                      data-testid="select-equipe-ocorrencia"
                      value={idEquipeSelecionada}
                      onChange={(e) => {
                        setIdEquipeSelecionada(Number(e.target.value));
                        setIdIntegranteSelecionado('');
                      }}
                      className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {partida.id_equipe_mandante && (
                        <option value={partida.id_equipe_mandante}>
                          {partida.nome_mandante || 'Mandante'} (Mandante)
                        </option>
                      )}
                      {partida.id_equipe_visitante && (
                        <option value={partida.id_equipe_visitante}>
                          {partida.nome_visitante || 'Visitante'} (Visitante)
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Atleta / Integrante */}
                  <div className="md:col-span-4">
                    <label
                      htmlFor="ocorrencia-integrante"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Atleta {tipoOcorrencia === 'GOL' ? '(opcional para autoria)' : '*'}
                    </label>
                    <select
                      id="ocorrencia-integrante"
                      data-testid="select-integrante-ocorrencia"
                      value={idIntegranteSelecionado}
                      onChange={(e) => setIdIntegranteSelecionado(e.target.value)}
                      className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">
                        {tipoOcorrencia === 'GOL' ? '-- Sem autoria definida --' : '-- Selecione o atleta --'}
                      </option>
                      {integrantesEquipeSelecionada.map((integ) => (
                        <option key={integ.id_integrante} value={integ.id_integrante}>
                          {integ.numero_camisa != null ? `#${integ.numero_camisa} ` : ''}
                          {integ.nome_esportivo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Minuto */}
                  <div className="md:col-span-2">
                    <label
                      htmlFor="ocorrencia-minuto"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Minuto
                    </label>
                    <input
                      id="ocorrencia-minuto"
                      data-testid="input-minuto-ocorrencia"
                      type="number"
                      min={0}
                      max={150}
                      placeholder="Ex: 35"
                      value={minuto}
                      onChange={(e) => setMinuto(e.target.value)}
                      className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Período */}
                  <div className="md:col-span-3">
                    <label
                      htmlFor="ocorrencia-periodo"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Período
                    </label>
                    <select
                      id="ocorrencia-periodo"
                      data-testid="select-periodo-ocorrencia"
                      value={periodo}
                      onChange={(e) => setPeriodo(e.target.value)}
                      className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="1º Tempo">1º Tempo</option>
                      <option value="2º Tempo">2º Tempo</option>
                      <option value="Prorrogação 1T">Prorrogação 1T</option>
                      <option value="Prorrogação 2T">Prorrogação 2T</option>
                      <option value="Disputa de Pênaltis">Disputa de Pênaltis</option>
                    </select>
                  </div>

                  {/* Observação */}
                  <div className="md:col-span-5">
                    <label
                      htmlFor="ocorrencia-obs"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Observação (opcional)
                    </label>
                    <input
                      id="ocorrencia-obs"
                      data-testid="input-obs-ocorrencia"
                      type="text"
                      placeholder="Ex: Falta tática, pênalti sofrido..."
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Botão Salvar Ocorrência */}
                  <div className="md:col-span-2 flex items-end">
                    <button
                      type="submit"
                      data-testid="btn-registrar-ocorrencia"
                      disabled={salvandoOcorrencia}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition shadow-sm disabled:opacity-50 h-[34px]"
                    >
                      {salvandoOcorrencia ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <PlusCircle size={14} />
                      )}
                      <span>Lançar</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
              <span>
                Partida <strong className="uppercase">{statusAtual}</strong>. Novos lançamentos de ocorrência estão bloqueados.
              </span>
              <span className="text-[11px] text-slate-400">Para lançar ocorrências, reabra a partida.</span>
            </div>
          )}

          {/* Listagem de Ocorrências Registradas */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-sm flex items-center justify-between">
              <span>Ocorrências do Jogo ({sumula?.ocorrencias?.length || 0})</span>
              <span className="text-xs font-normal text-slate-500">
                Gols e cartões computados oficialmente
              </span>
            </h4>

            {carregando && !sumula ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <Loader2 size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Carregando súmula...</p>
              </div>
            ) : !sumula?.ocorrencias || sumula.ocorrencias.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                Nenhuma ocorrência registrada nesta partida até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {sumula.ocorrencias.map((oc) => {
                  const isExpulsaoDerivada = oc.tipo === 'EXPULSAO_SEGUNDO_AMARELO';
                  const equipeBeneficiadaNome =
                    oc.id_equipe_beneficiada === partida.id_equipe_mandante
                      ? partida.nome_mandante || 'Mandante'
                      : partida.nome_visitante || 'Visitante';

                  let badgeInfo = {
                    texto: 'Gol',
                    cor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                  };
                  if (oc.tipo === 'GOL_CONTRA') {
                    badgeInfo = {
                      texto: 'Gol Contra',
                      cor: 'bg-rose-100 text-rose-800 border-rose-200',
                    };
                  } else if (oc.tipo === 'CARTAO_AMARELO') {
                    badgeInfo = {
                      texto: 'Cartão Amarelo',
                      cor: 'bg-amber-100 text-amber-800 border-amber-200',
                    };
                  } else if (oc.tipo === 'CARTAO_VERMELHO_DIRETO') {
                    badgeInfo = {
                      texto: 'Vermelho Direto',
                      cor: 'bg-red-100 text-red-800 border-red-200',
                    };
                  } else if (oc.tipo === 'EXPULSAO_SEGUNDO_AMARELO') {
                    badgeInfo = {
                      texto: 'Expulsão 2º Amarelo',
                      cor: 'bg-red-200 text-red-900 border-red-300 font-bold',
                    };
                  }

                  const nomeAtleta =
                    oc.nome_integrante ||
                    (oc.id_integrante ? mapaIntegrantes.get(oc.id_integrante)?.nome : null);
                  const camisaAtleta =
                    oc.numero_camisa ??
                    (oc.id_integrante ? mapaIntegrantes.get(oc.id_integrante)?.camisa : null);

                  return (
                    <div
                      key={oc.id_ocorrencia}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${badgeInfo.cor}`}
                        >
                          {badgeInfo.texto}
                        </span>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {nomeAtleta ? (
                              <span className="font-bold text-slate-800">
                                {camisaAtleta != null ? `#${camisaAtleta} ` : ''}
                                {nomeAtleta}
                              </span>
                            ) : (
                              <span className="font-semibold text-amber-600 italic">
                                Sem autoria definida
                              </span>
                            )}

                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-medium">
                              Beneficiou: <strong>{equipeBeneficiadaNome}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                            {oc.minuto != null && (
                              <span>
                                {oc.minuto}&apos;
                                {oc.periodo ? ` (${oc.periodo})` : ''}
                              </span>
                            )}
                            {oc.observacao && <span>• {oc.observacao}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Ações da Ocorrência */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {/* Botão Identificar / Editar Autor */}
                        {(!oc.id_integrante || oc.tipo === 'GOL') && (
                          <button
                            type="button"
                            data-testid={`btn-identificar-autor-${oc.id_ocorrencia}`}
                            onClick={() => handleAbrirAtribuirAutor(oc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                          >
                            <UserCheck size={13} />
                            <span>{oc.id_integrante ? 'Alterar Autor' : 'Identificar Autor'}</span>
                          </button>
                        )}

                        {/* Botão Remover Ocorrência */}
                        {statusAtual === 'EM_ANDAMENTO' && !isExpulsaoDerivada && (
                          <button
                            type="button"
                            data-testid={`btn-remover-ocorrencia-${oc.id_ocorrencia}`}
                            disabled={removendoId === oc.id_ocorrencia}
                            onClick={() => handleRemoverOcorrencia(oc.id_ocorrencia)}
                            title="Remover ocorrência"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition disabled:opacity-50"
                          >
                            {removendoId === oc.id_ocorrencia ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            <span>Remover</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção de Finalização da Partida (se AGENDADA ou EM_ANDAMENTO) */}
          {podeRegistrar && (
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Finalizar Partida</h4>
                  <p className="text-xs text-slate-500">
                    Ao finalizar, o placar e as estatísticas serão consolidados no campeonato.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Se for mata-mata e estiver empatado, exige disputa de pênaltis */}
                  {empateMataMata && (
                    <div className="flex items-center gap-2 text-xs bg-white p-2 border border-slate-200 rounded-xl">
                      <span className="font-bold text-slate-700">Pênaltis:</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Mandante"
                        value={penaltisMandante}
                        onChange={(e) => setPenaltisMandante(e.target.value)}
                        data-testid="input-penaltis-mandante"
                        className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-bold"
                      />
                      <span>x</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Visitante"
                        value={penaltisVisitante}
                        onChange={(e) => setPenaltisVisitante(e.target.value)}
                        data-testid="input-penaltis-visitante"
                        className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-bold"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    data-testid="btn-finalizar-partida"
                    disabled={finalizando}
                    onClick={handleFinalizarPartida}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                  >
                    {finalizando ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Finalizando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={15} />
                        <span>Finalizar Partida</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500">
            {sumula?.ocorrencias?.length || 0} ocorrência(s) registrada(s)
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition"
          >
            Fechar
          </button>
        </div>

        {/* Sub-Modal / Popover: Atribuir ou Corrigir Autor */}
        {ocorrenciaEditandoAutor && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-in fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="autor-titulo"
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 id="autor-titulo" className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <UserCheck size={16} className="text-blue-600" />
                  <span>Identificar / Alterar Autor do Gol</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setOcorrenciaEditandoAutor(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSalvarAutor} className="space-y-4 text-xs">
                <div>
                  <label htmlFor="autor-select" className="block font-semibold text-slate-700 mb-1">
                    Selecione o Atleta
                  </label>
                  <select
                    id="autor-select"
                    data-testid="select-novo-autor"
                    value={novoAutorId}
                    onChange={(e) => setNovoAutorId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- Sem autoria / Remover autor --</option>
                    {(
                      equipes.find(
                        (e) => e.id_equipe === ocorrenciaEditandoAutor.id_equipe_beneficiada
                      )?.integrantes || []
                    ).map((integ) => (
                      <option key={integ.id_integrante} value={integ.id_integrante}>
                        {integ.numero_camisa != null ? `#${integ.numero_camisa} ` : ''}
                        {integ.nome_esportivo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Motivo obrigatório se a partida estiver FINALIZADA */}
                {isFinalizada && (
                  <div>
                    <label htmlFor="autor-motivo" className="block font-semibold text-slate-700 mb-1">
                      Justificativa da Alteração * (mín. 3 caracteres)
                    </label>
                    <textarea
                      id="autor-motivo"
                      data-testid="input-motivo-autor"
                      rows={2}
                      placeholder="Informe o motivo da alteração de autoria em partida finalizada..."
                      value={motivoAutor}
                      onChange={(e) => setMotivoAutor(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOcorrenciaEditandoAutor(null)}
                    disabled={salvandoAutor}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    data-testid="btn-salvar-autor"
                    disabled={salvandoAutor}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition shadow-xs disabled:opacity-50"
                  >
                    {salvandoAutor && <Loader2 size={13} className="animate-spin" />}
                    <span>Confirmar Autor</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
