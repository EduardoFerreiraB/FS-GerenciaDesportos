'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  FileText,
  Filter,
  MoreHorizontal,
  Play,
  RefreshCw,
  RotateCcw,
  Trophy,
  Undo2,
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
import {
  Alert,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Select,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { ROTULO_FORMATO, rotuloFase } from '@/lib/rotulos';
import { CartaoPlacar, ORDEM_FASES, placarDePartida } from '@/components/competicoes/visual';
import ModalAgendarPartida from './ModalAgendarPartida';
import ModalResultadoSimples from './ModalResultadoSimples';
import ModalSumulaDetalhada from './ModalSumulaDetalhada';
import ModalReabrirPartida, { type ModoReabertura } from './ModalReabrirPartida';

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

function mensagemDeErro(err: unknown, padrao: string): string {
  if (isErroApi(err)) return err.mensagem;
  if (err instanceof Error) return err.message;
  return padrao;
}

interface GrupoDeJogos {
  chave: string;
  titulo: string;
  ordem: number;
  partidas: PartidaEstendida[];
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

  // Diálogos de confirmação
  const [confirmarDesfazerAberto, setConfirmarDesfazerAberto] = useState(false);
  const [confirmarEncerrarGruposAberto, setConfirmarEncerrarGruposAberto] = useState(false);

  // Modais de Ação em Partida
  const [partidaAgendando, setPartidaAgendando] = useState<PartidaEstendida | null>(null);
  const [partidaPlacar, setPartidaPlacar] = useState<PartidaEstendida | null>(null);
  const [partidaSumula, setPartidaSumula] = useState<PartidaDetalhe | null>(null);
  const [modalReabertura, setModalReabertura] = useState<{
    isOpen: boolean;
    modo: ModoReabertura;
    partida?: PartidaDetalhe | null;
  }>({
    isOpen: false,
    modo: 'REABRIR_PARTIDA',
    partida: null,
  });

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
      setErro(mensagemDeErro(err, 'Falha ao carregar as partidas da edição.'));
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
      setErro(mensagemDeErro(err, 'Erro ao gerar tabela da competição.'));
    } finally {
      setGerandoTabela(false);
    }
  };

  // Handler: Desfazer Tabela (erros sobem para o ConfirmDialog exibir)
  const handleConfirmarDesfazer = async () => {
    setErro(null);
    setSucesso(null);
    try {
      await desfazerTabela(idEdicaoCompeticao);
    } catch (err: unknown) {
      throw new Error(mensagemDeErro(err, 'Não foi possível desfazer a tabela.'));
    }
    setEstadoAtual('RASCUNHO');
    setPartidas([]);
    setEstrutura(null);
    setSucesso('Tabela de jogos desfeita com sucesso. A edição retornou ao estado Rascunho.');
  };

  // Handler: Encerrar Fase de Grupos
  const handleConfirmarEncerrarGrupos = async () => {
    setErro(null);
    setSucesso(null);
    try {
      await encerrarFaseGrupos(idEdicaoCompeticao);
    } catch (err: unknown) {
      throw new Error(
        mensagemDeErro(err, 'Erro ao encerrar a fase de grupos. Verifique se todos os jogos foram concluídos.'),
      );
    }
    setSucesso('Fase de grupos encerrada! As equipes classificadas foram alocadas no chaveamento eliminatório.');
    await carregarDados();
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

  // Agrupamento visual: rodadas em ordem, depois as fases eliminatórias na ordem do torneio.
  const gruposDeJogos = useMemo<GrupoDeJogos[]>(() => {
    const mapa = new Map<string, GrupoDeJogos>();
    for (const p of partidasFiltradas) {
      let chave = 'outros';
      let titulo = 'Outros jogos';
      let ordem = 9999;
      if (p.id_duelo) {
        const fase = (mapaDuelos.get(p.id_duelo) || '').toUpperCase();
        chave = `fase-${fase || 'mata-mata'}`;
        titulo = fase ? rotuloFase(fase) : 'Mata-mata';
        ordem = 1000 + (fase === 'TERCEIRO_LUGAR' ? 6.5 : (ORDEM_FASES[fase] ?? 50));
      } else if (p.rodada != null) {
        chave = `rodada-${p.rodada}`;
        titulo = `Rodada ${p.rodada}`;
        ordem = p.rodada;
      }
      if (!mapa.has(chave)) mapa.set(chave, { chave, titulo, ordem, partidas: [] });
      mapa.get(chave)!.partidas.push(p);
    }
    return Array.from(mapa.values()).sort((a, b) => a.ordem - b.ordem);
  }, [partidasFiltradas, mapaDuelos]);

  const temTabelaGerada = partidas.length > 0;
  const isRascunho = estadoAtual === 'RASCUNHO';
  const isEmAndamento = estadoAtual === 'EM_ANDAMENTO';
  const isGruposMataMata = formato === 'GRUPOS_MATA_MATA';
  const filtrosAtivos = filtroRodada !== 'TODAS' || filtroGrupo !== 'TODOS' || filtroStatus !== 'TODOS';
  const temMaisAcoes = isEmAndamento;

  const limparFiltros = () => {
    setFiltroRodada('TODAS');
    setFiltroGrupo('TODOS');
    setFiltroStatus('TODOS');
  };

  const botaoGerar = (
    <Button onClick={handleGerarTabela} loading={gerandoTabela} leftIcon={<Play className="size-4" aria-hidden="true" />}>
      Gerar Calendário / Tabela
    </Button>
  );

  return (
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
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={carregarDados}>
                Tentar novamente
              </Button>
              <IconButton aria-label="Fechar aviso" size="sm" onClick={() => setErro(null)}>
                <X aria-hidden="true" />
              </IconButton>
            </div>
          }
        >
          {erro}
        </Alert>
      )}

      {/* Cabeçalho da área: estado e ações de tabela */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-base font-semibold text-fg">Jogos</h3>
            <StatusBadge tipo="edicao" valor={estadoAtual} />
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            <span className="tabular-nums">{partidas.length}</span> {partidas.length === 1 ? 'jogo' : 'jogos'}
            {formato ? ` · ${ROTULO_FORMATO[formato] ?? formato}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRascunho && temTabelaGerada && botaoGerar}

          {isGruposMataMata && isEmAndamento && (
            <Button
              variant="secondary"
              onClick={() => setConfirmarEncerrarGruposAberto(true)}
              leftIcon={<Trophy className="size-4" aria-hidden="true" />}
            >
              Encerrar Fase de Grupos
            </Button>
          )}

          <IconButton
            variant="secondary"
            aria-label="Recarregar partidas"
            title="Recarregar partidas"
            onClick={carregarDados}
            disabled={carregando}
          >
            <RefreshCw aria-hidden="true" className={cn(carregando && 'motion-safe:animate-spin')} />
          </IconButton>

          {temMaisAcoes && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <IconButton variant="secondary" aria-label="Mais ações de jogos">
                  <MoreHorizontal aria-hidden="true" />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {isGruposMataMata && (
                  <DropdownMenuItem
                    data-testid="btn-reabrir-grupos"
                    onSelect={() =>
                      setModalReabertura({
                        isOpen: true,
                        modo: 'REABRIR_GRUPOS',
                        partida: null,
                      })
                    }
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reabrir Fase de Grupos
                  </DropdownMenuItem>
                )}
                {isGruposMataMata && <DropdownMenuSeparator />}
                <DropdownMenuItem tone="danger" onSelect={() => setConfirmarDesfazerAberto(true)}>
                  <Undo2 className="size-4" aria-hidden="true" />
                  Desfazer Tabela
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Barra única de filtros */}
      {temTabelaGerada && (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="hidden items-center gap-1.5 self-center text-xs font-medium text-fg-muted sm:flex">
            <Filter aria-hidden="true" className="size-4 text-fg-subtle" />
            Filtrar
          </div>

          {rodadasDisponiveis.length > 0 && (
            <div className="flex flex-col gap-1 sm:w-44">
              <label htmlFor="filtro-rodada" className="text-xs font-medium text-fg-muted">
                Rodada
              </label>
              <Select id="filtro-rodada" value={filtroRodada} onChange={(e) => setFiltroRodada(e.target.value)}>
                <option value="TODAS">Todas as rodadas</option>
                {rodadasDisponiveis.map((r) => (
                  <option key={r} value={r}>
                    Rodada {r}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {gruposDisponiveis.length > 0 && (
            <div className="flex flex-col gap-1 sm:w-44">
              <label htmlFor="filtro-grupo" className="text-xs font-medium text-fg-muted">
                Grupo
              </label>
              <Select id="filtro-grupo" value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
                <option value="TODOS">Todos os grupos</option>
                {gruposDisponiveis.map((g) => (
                  <option key={g.id_grupo} value={g.id_grupo}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1 sm:w-44">
            <label htmlFor="filtro-status" className="text-xs font-medium text-fg-muted">
              Situação
            </label>
            <Select id="filtro-status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="TODOS">Todas</option>
              <option value="AGENDADA">Agendadas</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="FINALIZADA">Finalizadas</option>
              <option value="CANCELADA">Canceladas</option>
            </Select>
          </div>

          {filtrosAtivos && (
            <Button variant="ghost" onClick={limparFiltros} className="sm:ml-auto">
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Carregando */}
      {carregando && partidas.length === 0 && (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando partidas da edição">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {/* Vazio 1: edição em rascunho, tabela não gerada */}
      {!carregando && !temTabelaGerada && isRascunho && (
        <EmptyState
          icon={<CalendarDays />}
          title="Tabela de jogos não gerada"
          description="Confira as equipes e o formato na configuração e gere os confrontos e o calendário oficial de partidas."
          action={botaoGerar}
        />
      )}

      {/* Vazio 2: em andamento mas sem partidas */}
      {!carregando && !temTabelaGerada && !isRascunho && (
        <EmptyState icon={<CalendarDays />} title="Nenhuma partida cadastrada para esta edição." />
      )}

      {/* Vazio 3: filtro sem resultados */}
      {!carregando && temTabelaGerada && partidasFiltradas.length === 0 && (
        <EmptyState
          icon={<Filter />}
          title="Nenhuma partida encontrada para os filtros selecionados."
          action={
            <Button variant="secondary" onClick={limparFiltros}>
              Redefinir filtros
            </Button>
          }
        />
      )}

      {/* Jogos agrupados por rodada / fase */}
      {!carregando && partidasFiltradas.length > 0 && (
        <div className="space-y-8">
          {gruposDeJogos.map((grupo) => (
            <section key={grupo.chave} aria-label={grupo.titulo} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h4 className="text-sm font-semibold text-fg">{grupo.titulo}</h4>
                <span className="text-xs tabular-nums text-fg-subtle">
                  {grupo.partidas.length} {grupo.partidas.length === 1 ? 'jogo' : 'jogos'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {grupo.partidas.map((partida) => {
                  const statusMatch = (partida.status || partida.estado || 'AGENDADA') as StatusPartida;
                  const isFinalizada = statusMatch === 'FINALIZADA';
                  // Jogo finalizado só é corrigido pela reabertura justificada.
                  const podeLancarPlacar =
                    Boolean(partida.id_equipe_mandante && partida.id_equipe_visitante) &&
                    statusMatch !== 'CANCELADA' &&
                    !isFinalizada;
                  const rotulo = partida.id_grupo
                    ? mapaGrupos.get(partida.id_grupo) || `Grupo ${partida.id_grupo}`
                    : undefined;

                  return (
                    <CartaoPlacar
                      key={partida.id_partida}
                      data-testid={`cartao-partida-${partida.id_partida}`}
                      partida={placarDePartida(partida)}
                      rotulo={rotulo}
                      aoVivo={statusMatch === 'EM_ANDAMENTO'}
                      acoes={
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => setPartidaAgendando(partida)}
                            leftIcon={<CalendarCheck className="size-4" aria-hidden="true" />}
                          >
                            Agendar
                          </Button>
                          <Button
                            variant="secondary"
                            data-testid={`btn-sumula-${partida.id_partida}`}
                            onClick={() => setPartidaSumula(partida)}
                            title="Abrir súmula detalhada do jogo"
                            leftIcon={<FileText className="size-4" aria-hidden="true" />}
                          >
                            Súmula
                          </Button>
                          {!isFinalizada && (
                            <Button
                              onClick={() => setPartidaPlacar(partida)}
                              disabled={!podeLancarPlacar}
                              title={!podeLancarPlacar ? 'Equipes mandante e visitante devem estar definidas' : undefined}
                              leftIcon={<Trophy className="size-4" aria-hidden="true" />}
                            >
                              Lançar Placar
                            </Button>
                          )}
                          {isFinalizada && (
                            <Button
                              variant="secondary"
                              data-testid={`btn-reabrir-${partida.id_partida}`}
                              onClick={() =>
                                setModalReabertura({
                                  isOpen: true,
                                  modo: 'REABRIR_PARTIDA',
                                  partida,
                                })
                              }
                              title="Reabrir jogo com justificativa"
                              leftIcon={<RotateCcw className="size-4" aria-hidden="true" />}
                            >
                              Reabrir Jogo
                            </Button>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            </section>
          ))}
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

      {/* Modal de Súmula Detalhada */}
      {partidaSumula && (
        <ModalSumulaDetalhada
          partida={partidaSumula}
          idEdicaoCompeticao={idEdicaoCompeticao}
          onClose={() => setPartidaSumula(null)}
          onSucesso={async () => {
            await carregarDados();
          }}
        />
      )}

      {/* Modal de Reabertura Justificada */}
      <ModalReabrirPartida
        isOpen={modalReabertura.isOpen}
        modo={modalReabertura.modo}
        partida={modalReabertura.partida}
        idEdicaoCompeticao={idEdicaoCompeticao}
        onClose={() => setModalReabertura((prev) => ({ ...prev, isOpen: false }))}
        onSucesso={async () => {
          setSucesso('Operação de reabertura realizada com sucesso!');
          await carregarDados();
        }}
      />

      {/* Confirmação: Desfazer Tabela */}
      <ConfirmDialog
        open={confirmarDesfazerAberto}
        onOpenChange={setConfirmarDesfazerAberto}
        title="Desfazer tabela de jogos?"
        description="Todas as partidas agendadas, grupos e chaveamentos desta edição serão excluídos e a edição voltará ao estado Rascunho. Partidas já iniciadas ou com súmula impedem esta ação."
        confirmLabel="Confirmar e Desfazer"
        tone="danger"
        onConfirm={handleConfirmarDesfazer}
      />

      {/* Confirmação: Encerrar Fase de Grupos */}
      <ConfirmDialog
        open={confirmarEncerrarGruposAberto}
        onOpenChange={setConfirmarEncerrarGruposAberto}
        title="Encerrar fase de grupos?"
        description="A classificação de cada grupo será consolidada e as equipes classificadas serão alocadas nos cruzamentos do mata-mata. Todas as partidas da fase de grupos precisam estar finalizadas."
        confirmLabel="Confirmar Encerramento"
        tone="primary"
        onConfirm={handleConfirmarEncerrarGrupos}
      />
    </div>
  );
}
