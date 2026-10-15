'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Timer, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  Loader2, 
  User, 
  Check, 
  FileText, 
  Zap,
  ShieldAlert
} from 'lucide-react';
import { competicaoService } from '@/services/competicoes';
import { InscricaoIndividual, ResultadoProva } from '@/types/competicoes';

interface ModalLancarResultadoProvaProps {
  isOpen: boolean;
  onClose: () => void;
  idProva: number;
  nomeProva?: string;
  resultado?: ResultadoProva | null;
  inscritos: InscricaoIndividual[];
  resultadosExistentes?: ResultadoProva[];
  onSuccess: () => void;
}

export default function ModalLancarResultadoProva({
  isOpen,
  onClose,
  idProva,
  nomeProva,
  resultado,
  inscritos,
  resultadosExistentes = [],
  onSuccess,
}: ModalLancarResultadoProvaProps) {
  const isEditando = Boolean(resultado);

  // Participante selecionado (ao criar)
  const [participanteSelecionado, setParticipanteSelecionado] = useState<number | ''>('');

  // Campos de tempo amigáveis
  const [minutos, setMinutos] = useState<number | ''>('');
  const [segundos, setSegundos] = useState<number | ''>('');
  const [milissegundos, setMilissegundos] = useState<number | ''>('');

  // Entrada direta de ms (sincronizada)
  const [tempoMsDireto, setTempoMsDireto] = useState<number | ''>('');
  const [modoEntrada, setModoEntrada] = useState<'amigavel' | 'direto'>('amigavel');

  // Desqualificação
  const [desqualificado, setDesqualificado] = useState<boolean>(false);
  const [motivoDesqualificacao, setMotivoDesqualificacao] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  // Estados de controle
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Participantes que já possuem resultado nesta prova
  const jaLancadosIds = useMemo(() => {
    return new Set(
      resultadosExistentes
        .filter(r => !resultado || r.id_resultado !== resultado.id_resultado)
        .map(r => r.id_participante)
    );
  }, [resultadosExistentes, resultado]);

  // Inicializar estado ao abrir
  useEffect(() => {
    if (isOpen) {
      setErro(null);
      if (resultado) {
        setParticipanteSelecionado(resultado.id_participante);
        setDesqualificado(Boolean(resultado.desqualificado));
        setMotivoDesqualificacao(resultado.motivo_desqualificacao || '');
        setObservacoes(resultado.observacoes || '');

        const ms = resultado.tempo_ms || 0;
        setTempoMsDireto(ms);
        const min = Math.floor(ms / 60000);
        const resto = ms % 60000;
        const sec = Math.floor(resto / 1000);
        const milli = resto % 1000;
        setMinutos(min > 0 ? min : '');
        setSegundos(sec > 0 ? sec : (min > 0 ? 0 : ''));
        setMilissegundos(milli > 0 ? milli : '');
      } else {
        // Encontrar primeiro inscrito sem resultado lançado
        const primeiroDisponivel = inscritos.find(i => !jaLancadosIds.has(i.id_participante));
        setParticipanteSelecionado(primeiroDisponivel ? primeiroDisponivel.id_participante : '');
        setMinutos('');
        setSegundos('');
        setMilissegundos('');
        setTempoMsDireto('');
        setDesqualificado(false);
        setMotivoDesqualificacao('');
        setObservacoes('');
      }
    }
  }, [isOpen, resultado, inscritos, jaLancadosIds]);

  // Calcular tempo_ms a partir dos inputs amigáveis
  const tempoMsCalculado = useMemo(() => {
    if (modoEntrada === 'direto') {
      return typeof tempoMsDireto === 'number' ? tempoMsDireto : 0;
    }
    const m = typeof minutos === 'number' ? minutos : 0;
    const s = typeof segundos === 'number' ? segundos : 0;
    const ms = typeof milissegundos === 'number' ? milissegundos : 0;
    return (m * 60 + s) * 1000 + ms;
  }, [modoEntrada, tempoMsDireto, minutos, segundos, milissegundos]);

  // Atualizar entrada direta quando muda tempo amigável
  const handleTempoAmigavelChange = (
    novoMin: number | '',
    novoSec: number | '',
    novoMs: number | ''
  ) => {
    setMinutos(novoMin);
    setSegundos(novoSec);
    setMilissegundos(novoMs);
    const m = typeof novoMin === 'number' ? novoMin : 0;
    const s = typeof novoSec === 'number' ? novoSec : 0;
    const ms = typeof novoMs === 'number' ? novoMs : 0;
    const total = (m * 60 + s) * 1000 + ms;
    setTempoMsDireto(total > 0 ? total : '');
  };

  // Atualizar inputs amigáveis quando muda ms direto
  const handleTempoDiretoChange = (novoTotal: number | '') => {
    setTempoMsDireto(novoTotal);
    if (typeof novoTotal === 'number' && novoTotal >= 0) {
      const min = Math.floor(novoTotal / 60000);
      const resto = novoTotal % 60000;
      const sec = Math.floor(resto / 1000);
      const ms = resto % 1000;
      setMinutos(min > 0 ? min : '');
      setSegundos(sec);
      setMilissegundos(ms);
    } else {
      setMinutos('');
      setSegundos('');
      setMilissegundos('');
    }
  };

  // String formatada em tempo real para pré-visualização
  const tempoFormatadoPreview = useMemo(() => {
    if (tempoMsCalculado <= 0) return '00.000s (0 ms)';
    if (tempoMsCalculado < 60000) {
      const seg = Math.floor(tempoMsCalculado / 1000);
      const ms = tempoMsCalculado % 1000;
      return `${seg.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}s (${tempoMsCalculado} ms)`;
    }
    const min = Math.floor(tempoMsCalculado / 60000);
    const resto = tempoMsCalculado % 60000;
    const seg = Math.floor(resto / 1000);
    const ms = resto % 1000;
    return `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')} (${tempoMsCalculado} ms)`;
  }, [tempoMsCalculado]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!participanteSelecionado) {
      setErro('Selecione o atleta que disputou a prova.');
      return;
    }

    // Validação de tempo:
    // Se não for desqualificado, o tempo deve ser maior que zero.
    // Se for desqualificado mas não informou tempo, usamos pelo menos 1 ms para satisfazer gt=0 do backend schema.
    let tempoFinal = tempoMsCalculado;
    if (desqualificado) {
      if (tempoFinal <= 0) {
        tempoFinal = 1; // 1 ms simbólico para atender a restrição gt=0 do backend
      }
    } else {
      if (tempoFinal <= 0) {
        setErro('Informe o tempo de conclusão da prova (deve ser maior que zero).');
        return;
      }
    }

    setSalvando(true);
    try {
      if (isEditando && resultado) {
        await competicaoService.atualizarResultado(
          resultado.id_resultado,
          {
            tempo_ms: tempoFinal,
            desqualificado,
            motivo_desqualificacao: desqualificado ? motivoDesqualificacao.trim() || undefined : undefined,
            observacoes: observacoes.trim() || undefined,
          },
          idProva
        );
      } else {
        await competicaoService.lancarResultado(idProva, {
          id_participante: Number(participanteSelecionado),
          tempo_ms: tempoFinal,
          desqualificado,
          motivo_desqualificacao: desqualificado ? motivoDesqualificacao.trim() || undefined : undefined,
          observacoes: observacoes.trim() || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao registrar resultado da prova. Verifique os valores.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  };

  const getNomeInscrito = (inscricao: InscricaoIndividual) => {
    if (inscricao.participante?.atleta?.nome_completo) {
      return inscricao.participante.atleta.nome_completo;
    }
    if (inscricao.participante?.aluno?.nome_completo) {
      return inscricao.participante.aluno.nome_completo;
    }
    return `Atleta #${inscricao.id_participante}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-3">
          <Timer className="text-purple-600" size={26} />
          {isEditando ? 'Editar Resultado' : 'Lançar Resultado da Prova'}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {nomeProva ? `Prova: ${nomeProva}` : 'Registre o tempo oficial ou desqualificação do competidor.'}
        </p>

        {erro && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>{erro}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Seleção do Atleta */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Atleta Competidor *
            </label>
            {isEditando ? (
              <div className="px-4 py-3 bg-slate-100 rounded-2xl text-slate-700 text-sm font-semibold flex items-center gap-2">
                <User size={16} className="text-slate-400" />
                <span>
                  {resultado?.participante?.atleta?.nome_completo ||
                    resultado?.participante?.aluno?.nome_completo ||
                    `Participante #${resultado?.id_participante}`}
                </span>
              </div>
            ) : (
              <select
                value={participanteSelecionado}
                onChange={e => setParticipanteSelecionado(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium text-slate-800 bg-white"
                required
              >
                <option value="">Selecione um atleta inscrito...</option>
                {inscritos.map(insc => {
                  const jaTemResultado = jaLancadosIds.has(insc.id_participante);
                  return (
                    <option
                      key={insc.id_participante}
                      value={insc.id_participante}
                      disabled={jaTemResultado}
                    >
                      {getNomeInscrito(insc)}
                      {insc.numero_peito ? ` (Nº ${insc.numero_peito})` : ''}
                      {jaTemResultado ? ' - [Resultado Já Lançado]' : ''}
                    </option>
                  );
                })}
              </select>
            )}
            {inscritos.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Nenhum atleta inscrito nesta competição ainda.
              </p>
            )}
          </div>

          {/* Seção de Entrada de Tempo */}
          <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                <Clock size={14} className="text-purple-600" />
                Tempo de Conclusão {desqualificado ? '(Opcional se DSQ)' : '*'}
              </label>

              <button
                type="button"
                onClick={() => setModoEntrada(modoEntrada === 'amigavel' ? 'direto' : 'amigavel')}
                className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 underline flex items-center gap-1 cursor-pointer"
              >
                {modoEntrada === 'amigavel' ? 'Digitar em Milissegundos' : 'Modo Min/Seg/Ms'}
              </button>
            </div>

            {modoEntrada === 'amigavel' ? (
              <div className="grid grid-cols-3 gap-3">
                {/* Minutos */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Minutos (m)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="599"
                    placeholder="0"
                    value={minutos}
                    onChange={e =>
                      handleTempoAmigavelChange(
                        e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0,
                        segundos,
                        milissegundos
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                  />
                </div>

                {/* Segundos */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Segundos (s)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="00"
                    value={segundos}
                    onChange={e =>
                      handleTempoAmigavelChange(
                        minutos,
                        e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0,
                        milissegundos
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                  />
                </div>

                {/* Milissegundos */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Milissegundos (ms)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    placeholder="000"
                    value={milissegundos}
                    onChange={e =>
                      handleTempoAmigavelChange(
                        minutos,
                        segundos,
                        e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Tempo Bruto em Milissegundos (ms)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ex: 62450 (1m 02s 450ms)"
                  value={tempoMsDireto}
                  onChange={e =>
                    handleTempoDiretoChange(
                      e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0
                    )
                  }
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                />
              </div>
            )}

            {/* Pré-visualização do tempo calculado */}
            <div className="flex items-center justify-between pt-2 border-t border-purple-100 text-xs">
              <span className="text-slate-500">Tempo oficial computado:</span>
              <span className="font-mono font-bold text-purple-700 bg-white px-2.5 py-1 rounded-lg border border-purple-200/60 shadow-sm">
                {tempoFormatadoPreview}
              </span>
            </div>
          </div>

          {/* Desqualificação */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={desqualificado}
                onChange={e => setDesqualificado(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldAlert size={14} className={desqualificado ? 'text-rose-600' : 'text-slate-400'} />
                  Atleta Desqualificado (DSQ / DNF / Queima de Largada)
                </span>
                <p className="text-[11px] text-slate-500">
                  Atletas desqualificados são posicionados no final da classificação sem pódio.
                </p>
              </div>
            </label>

            {desqualificado && (
              <div className="pt-2 border-t border-slate-200/60 animate-in fade-in">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-1">
                  Motivo da Desqualificação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Queima de largada (falsa saída), invasão de raia, não comparecimento."
                  value={motivoDesqualificacao}
                  onChange={e => setMotivoDesqualificacao(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white text-slate-800"
                />
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" />
              Observações
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Vento favorável (+0.8 m/s), cronometragem manual de conferência."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800 resize-none"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-100 transition-all flex items-center gap-2 cursor-pointer"
            >
              {salvando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : isEditando ? (
                'Salvar Alterações'
              ) : (
                'Registrar Resultado'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
