'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle, ListX, PlusCircle, ShieldAlert, Trash2, UserCheck, X } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
} from '@/components/ui';
import { EscudoIniciais } from '@/components/competicoes/visual';
import LinhaTempoSumula from './LinhaTempoSumula';
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

  const nomeMandante = partida.nome_mandante || 'Mandante';
  const nomeVisitante = partida.nome_visitante || 'Visitante';
  const totalOcorrencias = sumula?.ocorrencias?.length || 0;

  return (
    <Dialog open onOpenChange={(aberto) => (!aberto ? onClose() : undefined)}>
      <DialogContent
        title={`Súmula Detalhada do Jogo #${partida.numero_partida || partida.id_partida}`}
        description={`${nomeMandante} vs ${nomeVisitante}`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Avisos */}
          {sucesso && (
            <Alert
              tone="success"
              action={
                <IconButton aria-label="Fechar aviso" size="sm" onClick={() => setSucesso(null)}>
                  <X aria-hidden="true" />
                </IconButton>
              }
            >
              {sucesso}
            </Alert>
          )}
          {erro && (
            <Alert
              tone="danger"
              action={
                <IconButton aria-label="Fechar aviso" size="sm" onClick={() => setErro(null)}>
                  <X aria-hidden="true" />
                </IconButton>
              }
            >
              {erro}
            </Alert>
          )}

          {/* Placar com as equipes lado a lado */}
          <section aria-label="Placar" className="rounded-xl border border-line bg-surface-muted p-4 sm:p-5">
            <div className="mb-3 flex justify-center">
              <StatusBadge tipo="partida" valor={statusAtual} data-testid="badge-status-sumula" />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
              <div className="flex min-w-0 flex-row-reverse items-center gap-3 text-right">
                <EscudoIniciais nome={partida.nome_mandante} sigla={partida.sigla_mandante} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg sm:text-lg" title={nomeMandante}>
                    {nomeMandante}
                  </p>
                  <p className="text-xs text-fg-subtle">Mandante</p>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-3 leading-none">
                  <span data-testid="placar-mandante" className="text-4xl font-semibold tabular-nums text-fg">
                    {golsMandante}
                  </span>
                  <span aria-hidden="true" className="text-lg text-fg-subtle">
                    ×
                  </span>
                  <span data-testid="placar-visitante" className="text-4xl font-semibold tabular-nums text-fg">
                    {golsVisitante}
                  </span>
                </div>
                {partidaAtual.placar?.penaltis_mandante != null && partidaAtual.placar?.penaltis_visitante != null && (
                  <span className="mt-2 text-xs tabular-nums text-fg-muted">
                    Pênaltis {partidaAtual.placar.penaltis_mandante} × {partidaAtual.placar.penaltis_visitante}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <EscudoIniciais nome={partida.nome_visitante} sigla={partida.sigla_visitante} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg sm:text-lg" title={nomeVisitante}>
                    {nomeVisitante}
                  </p>
                  <p className="text-xs text-fg-subtle">Visitante</p>
                </div>
              </div>
            </div>
          </section>

          {/* Alerta disciplinar (informativo, não bloqueia) */}
          {sumula?.alertas_suspensos && sumula.alertas_suspensos.length > 0 && (
            <Alert
              tone="warning"
              role="alert"
              aria-label="Alerta de atletas suspensos"
              title="Alerta Disciplinar: Atletas com Suspensão Ativa"
            >
              <p>
                Estes atletas têm suspensão pendente. O alerta é informativo: não bloqueia a súmula nem a
                participação do atleta.
              </p>
              <ul className="mt-2 divide-y divide-warning/20">
                {sumula.alertas_suspensos.map((alerta) => (
                  <li key={alerta.id_suspensao} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0">
                      <span className="font-semibold text-fg">{alerta.nome_esportivo}</span>{' '}
                      <span>
                        ({alerta.id_equipe === partida.id_equipe_mandante ? partida.nome_mandante : partida.nome_visitante})
                      </span>{' '}
                      <span className="text-fg-subtle">— {alerta.motivo}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                      <ShieldAlert aria-hidden="true" className="size-3.5" />
                      <span className="tabular-nums">{alerta.jogos_pendentes}</span> jogo(s) pendente(s)
                    </span>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Registro de ocorrência */}
          {podeRegistrar ? (
            <section aria-labelledby="sumula-registrar" className="space-y-4 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="sumula-registrar" className="text-sm font-semibold text-fg">
                  Registrar ocorrência
                </h3>
                <span className="text-xs text-fg-subtle">
                  {statusAtual === 'AGENDADA' ? 'A partida será iniciada ao lançar' : 'Partida em andamento'}
                </span>
              </div>

              <form onSubmit={handleRegistrarOcorrencia} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Tipo de ocorrência" htmlFor="ocorrencia-tipo" required>
                    <Select
                      id="ocorrencia-tipo"
                      data-testid="select-tipo-ocorrencia"
                      value={tipoOcorrencia}
                      onChange={(e) => setTipoOcorrencia(e.target.value as TipoOcorrenciaLancamento)}
                    >
                      <option value="GOL">Gol</option>
                      <option value="GOL_CONTRA">Gol contra (a favor do adversário)</option>
                      <option value="CARTAO_AMARELO">Cartão amarelo</option>
                      <option value="CARTAO_VERMELHO_DIRETO">Cartão vermelho direto</option>
                    </Select>
                  </Field>

                  <Field label="Equipe do atleta" htmlFor="ocorrencia-equipe" required>
                    <Select
                      id="ocorrencia-equipe"
                      data-testid="select-equipe-ocorrencia"
                      value={idEquipeSelecionada}
                      onChange={(e) => {
                        setIdEquipeSelecionada(Number(e.target.value));
                        setIdIntegranteSelecionado('');
                      }}
                    >
                      {partida.id_equipe_mandante && (
                        <option value={partida.id_equipe_mandante}>{nomeMandante} (mandante)</option>
                      )}
                      {partida.id_equipe_visitante && (
                        <option value={partida.id_equipe_visitante}>{nomeVisitante} (visitante)</option>
                      )}
                    </Select>
                  </Field>

                  <Field
                    label={tipoOcorrencia === 'GOL' ? 'Atleta (opcional para autoria)' : 'Atleta'}
                    htmlFor="ocorrencia-integrante"
                    required={tipoOcorrencia !== 'GOL'}
                  >
                    <Select
                      id="ocorrencia-integrante"
                      data-testid="select-integrante-ocorrencia"
                      value={idIntegranteSelecionado}
                      onChange={(e) => setIdIntegranteSelecionado(e.target.value)}
                    >
                      <option value="">
                        {tipoOcorrencia === 'GOL' ? 'Sem autoria definida' : 'Selecione o atleta'}
                      </option>
                      {integrantesEquipeSelecionada.map((integ) => (
                        <option key={integ.id_integrante} value={integ.id_integrante}>
                          {integ.numero_camisa != null ? `#${integ.numero_camisa} ` : ''}
                          {integ.nome_esportivo}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-end">
                  <Field label="Minuto" htmlFor="ocorrencia-minuto">
                    <Input
                      id="ocorrencia-minuto"
                      data-testid="input-minuto-ocorrencia"
                      type="number"
                      min={0}
                      max={150}
                      placeholder="Ex.: 35"
                      value={minuto}
                      onChange={(e) => setMinuto(e.target.value)}
                      className="tabular-nums"
                    />
                  </Field>

                  <Field label="Período" htmlFor="ocorrencia-periodo">
                    <Select
                      id="ocorrencia-periodo"
                      data-testid="select-periodo-ocorrencia"
                      value={periodo}
                      onChange={(e) => setPeriodo(e.target.value)}
                    >
                      <option value="1º Tempo">1º tempo</option>
                      <option value="2º Tempo">2º tempo</option>
                      <option value="Prorrogação 1T">Prorrogação 1º tempo</option>
                      <option value="Prorrogação 2T">Prorrogação 2º tempo</option>
                      <option value="Disputa de Pênaltis">Disputa de pênaltis</option>
                    </Select>
                  </Field>

                  <Field label="Observação (opcional)" htmlFor="ocorrencia-obs" className="sm:col-span-2 md:col-span-1">
                    <Input
                      id="ocorrencia-obs"
                      data-testid="input-obs-ocorrencia"
                      type="text"
                      placeholder="Ex.: falta tática, pênalti sofrido..."
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                    />
                  </Field>

                  <Button
                    type="submit"
                    data-testid="btn-registrar-ocorrencia"
                    loading={salvandoOcorrencia}
                    leftIcon={<PlusCircle className="size-4" aria-hidden="true" />}
                    className="sm:col-span-2 md:col-span-1"
                  >
                    Lançar
                  </Button>
                </div>
              </form>
            </section>
          ) : (
            <Alert tone="info">
              Partida {statusAtual === 'FINALIZADA' ? 'finalizada' : 'cancelada'}: novos lançamentos estão
              bloqueados. Para lançar ocorrências, reabra a partida.
            </Alert>
          )}

          {/* Linha do tempo */}
          <section aria-labelledby="sumula-ocorrencias" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="sumula-ocorrencias" className="text-sm font-semibold text-fg">
                Ocorrências do jogo (<span className="tabular-nums">{totalOcorrencias}</span>)
              </h3>
              <span className="text-xs text-fg-subtle">Gols e cartões computados oficialmente</span>
            </div>

            {carregando && !sumula ? (
              <div className="space-y-2" aria-busy="true" aria-label="Carregando súmula">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : !sumula?.ocorrencias || sumula.ocorrencias.length === 0 ? (
              <EmptyState
                icon={<ListX />}
                title="Nenhuma ocorrência registrada"
                description="Gols e cartões lançados aparecem aqui em ordem de minuto."
                className="py-8"
              />
            ) : (
              <LinhaTempoSumula
                ocorrencias={sumula.ocorrencias}
                idMandante={partida.id_equipe_mandante}
                nomeMandante={nomeMandante}
                nomeVisitante={nomeVisitante}
                nomeAtleta={(oc) =>
                  oc.nome_integrante || (oc.id_integrante ? mapaIntegrantes.get(oc.id_integrante)?.nome : null)
                }
                camisaAtleta={(oc) =>
                  oc.numero_camisa ?? (oc.id_integrante ? mapaIntegrantes.get(oc.id_integrante)?.camisa : null)
                }
                acoes={(oc) => {
                  const isExpulsaoDerivada = oc.tipo === 'EXPULSAO_SEGUNDO_AMARELO';
                  const podeAutor = !oc.id_integrante || oc.tipo === 'GOL';
                  const podeRemover = statusAtual === 'EM_ANDAMENTO' && !isExpulsaoDerivada;
                  if (!podeAutor && !podeRemover) return null;
                  return (
                    <>
                      {podeAutor && (
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`btn-identificar-autor-${oc.id_ocorrencia}`}
                          onClick={() => handleAbrirAtribuirAutor(oc)}
                          leftIcon={<UserCheck className="size-3.5" aria-hidden="true" />}
                        >
                          {oc.id_integrante ? 'Alterar Autor' : 'Identificar Autor'}
                        </Button>
                      )}
                      {podeRemover && (
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`btn-remover-ocorrencia-${oc.id_ocorrencia}`}
                          loading={removendoId === oc.id_ocorrencia}
                          onClick={() => handleRemoverOcorrencia(oc.id_ocorrencia)}
                          title="Remover ocorrência"
                          leftIcon={<Trash2 className="size-3.5" aria-hidden="true" />}
                          className="text-danger hover:bg-danger-soft hover:text-danger"
                        >
                          Remover
                        </Button>
                      )}
                    </>
                  );
                }}
              />
            )}
          </section>

          {/* Finalização da partida */}
          {podeRegistrar && (
            <section
              aria-labelledby="sumula-finalizar"
              className="flex flex-col gap-4 rounded-xl border border-line bg-surface-muted p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h3 id="sumula-finalizar" className="text-sm font-semibold text-fg">
                  Finalizar partida
                </h3>
                <p className="text-xs text-fg-muted">
                  Ao finalizar, o placar e as estatísticas são consolidados no campeonato.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Mata-mata empatado exige a disputa de pênaltis */}
                {empateMataMata && (
                  <fieldset className="flex items-center gap-2">
                    <legend className="sr-only">Placar da disputa de pênaltis</legend>
                    <span className="text-sm font-medium text-fg">Pênaltis</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Mand."
                      aria-label={`Pênaltis ${nomeMandante}`}
                      value={penaltisMandante}
                      onChange={(e) => setPenaltisMandante(e.target.value)}
                      data-testid="input-penaltis-mandante"
                      className="w-20 text-center tabular-nums"
                    />
                    <span aria-hidden="true" className="text-fg-subtle">
                      ×
                    </span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Visit."
                      aria-label={`Pênaltis ${nomeVisitante}`}
                      value={penaltisVisitante}
                      onChange={(e) => setPenaltisVisitante(e.target.value)}
                      data-testid="input-penaltis-visitante"
                      className="w-20 text-center tabular-nums"
                    />
                  </fieldset>
                )}

                <Button
                  data-testid="btn-finalizar-partida"
                  loading={finalizando}
                  onClick={handleFinalizarPartida}
                  leftIcon={<CheckCircle className="size-4" aria-hidden="true" />}
                >
                  Finalizar Partida
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* Atribuir ou corrigir autor: modal aninhado (Esc / clique fora fecham só este) */}
        <Dialog
          open={Boolean(ocorrenciaEditandoAutor)}
          onOpenChange={(aberto) => (!aberto && !salvandoAutor ? setOcorrenciaEditandoAutor(null) : undefined)}
        >
          {ocorrenciaEditandoAutor && (
            <DialogContent title="Identificar / Alterar Autor do Gol" size="sm">
              <form id="form-autor-ocorrencia" onSubmit={handleSalvarAutor} className="space-y-4">
                <Field label="Atleta" htmlFor="autor-select">
                  <Select
                    id="autor-select"
                    data-testid="select-novo-autor"
                    value={novoAutorId}
                    onChange={(e) => setNovoAutorId(e.target.value)}
                  >
                    <option value="">Sem autoria (remover autor)</option>
                    {(
                      equipes.find((e) => e.id_equipe === ocorrenciaEditandoAutor.id_equipe_beneficiada)?.integrantes || []
                    ).map((integ) => (
                      <option key={integ.id_integrante} value={integ.id_integrante}>
                        {integ.numero_camisa != null ? `#${integ.numero_camisa} ` : ''}
                        {integ.nome_esportivo}
                      </option>
                    ))}
                  </Select>
                </Field>

                {/* Motivo obrigatório se a partida estiver finalizada */}
                {isFinalizada && (
                  <Field
                    label="Justificativa da alteração"
                    htmlFor="autor-motivo"
                    required
                    hint="Mínimo de 3 caracteres."
                  >
                    <Textarea
                      id="autor-motivo"
                      data-testid="input-motivo-autor"
                      rows={2}
                      placeholder="Informe o motivo da alteração de autoria em partida finalizada..."
                      value={motivoAutor}
                      onChange={(e) => setMotivoAutor(e.target.value)}
                      className="resize-none"
                    />
                  </Field>
                )}
              </form>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setOcorrenciaEditandoAutor(null)} disabled={salvandoAutor}>
                  Cancelar
                </Button>
                <Button type="submit" form="form-autor-ocorrencia" data-testid="btn-salvar-autor" loading={salvandoAutor}>
                  Confirmar Autor
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        <DialogFooter className="items-center sm:justify-between">
          <span className="hidden text-xs text-fg-muted sm:inline">
            <span className="tabular-nums">{totalOcorrencias}</span> ocorrência(s) registrada(s)
          </span>
          <Button variant="secondary" data-testid="btn-fechar-sumula" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
