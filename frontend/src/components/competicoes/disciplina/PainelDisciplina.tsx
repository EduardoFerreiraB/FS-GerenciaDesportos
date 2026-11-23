'use client';

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  obterPainelDisciplinar,
  obterArtilharia,
  listarPartidas,
  listarEquipes,
  isErroApi,
} from '@/services/competicoes';
import type {
  EstadoEdicao,
  PainelDisciplinarDetalhe,
  TabelaArtilhariaDetalhe,
  PartidaDetalhe,
  EquipeDetalhe,
  SuspensaoDetalhe,
} from '@/types/competicoes';
import {
  Award,
  CircleCheck,
  ClipboardCheck,
  History,
  MoreHorizontal,
  Plus,
  RectangleVertical,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  TriangleAlert,
  Trophy,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Skeleton,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { ROTULO_ORIGEM_SUSPENSAO, rotuloDoEstado } from '@/lib/rotulos';
import ModalCumprirSuspensao from './ModalCumprirSuspensao';
import ModalAjustarSuspensao from './ModalAjustarSuspensao';

interface PainelDisciplinaProps {
  idEdicaoCompeticao: number;
  estadoEdicao?: EstadoEdicao;
}

type SubAbaDisciplina = 'suspensoes' | 'cartoes' | 'artilharia';

function Contador({ valor }: { valor: number }) {
  if (valor <= 0) return null;
  return (
    <Badge tone="neutral" className="px-1.5 py-0 tabular-nums">
      {valor}
    </Badge>
  );
}

function CabecalhoSecao({
  titulo,
  descricao,
  extra,
}: {
  titulo: string;
  descricao: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-fg">{titulo}</h3>
        <p className="mt-0.5 text-sm text-fg-muted">{descricao}</p>
      </div>
      {extra}
    </div>
  );
}

function EtiquetaSituacao({ s }: { s: SuspensaoDetalhe }) {
  if (s.situacao === 'EM_REVISAO') {
    return (
      <Badge tone="warning" data-testid={`badge-em-revisao-${s.id_suspensao}`}>
        <TriangleAlert aria-hidden="true" className="size-3.5" />
        {rotuloDoEstado('suspensao', s.situacao)}
      </Badge>
    );
  }
  return (
    <StatusBadge
      tipo="suspensao"
      valor={s.situacao}
      data-testid={`badge-situacao-${s.id_suspensao}`}
    />
  );
}

export default function PainelDisciplina({
  idEdicaoCompeticao,
}: PainelDisciplinaProps) {
  const [subAba, setSubAba] = useState<SubAbaDisciplina>('suspensoes');

  // Dados carregados da API
  const [painel, setPainel] = useState<PainelDisciplinarDetalhe | null>(null);
  const [artilharia, setArtilharia] = useState<TabelaArtilhariaDetalhe | null>(null);
  const [partidas, setPartidas] = useState<PartidaDetalhe[]>([]);
  const [equipes, setEquipes] = useState<EquipeDetalhe[]>([]);

  // Estados de controle
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de modais
  const [modalCumprirAberto, setModalCumprirAberto] = useState<boolean>(false);
  const [suspensaoParaCumprir, setSuspensaoParaCumprir] =
    useState<SuspensaoDetalhe | null>(null);

  const [modalAjustarAberto, setModalAjustarAberto] = useState<boolean>(false);
  const [suspensaoParaAjustar, setSuspensaoParaAjustar] =
    useState<SuspensaoDetalhe | null>(null);

  const [suspensaoHistorico, setSuspensaoHistorico] =
    useState<SuspensaoDetalhe | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const [resPainel, resArtilharia, resPartidas, resEquipes] =
        await Promise.all([
          obterPainelDisciplinar(idEdicaoCompeticao),
          obterArtilharia(idEdicaoCompeticao),
          listarPartidas(idEdicaoCompeticao),
          listarEquipes(idEdicaoCompeticao),
        ]);

      setPainel(resPainel);
      setArtilharia(resArtilharia);
      setPartidas(resPartidas);
      setEquipes(resEquipes);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar os dados disciplinares e de artilharia.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const abrirCumprir = (s: SuspensaoDetalhe) => {
    setSuspensaoParaCumprir(s);
    setModalCumprirAberto(true);
  };

  const abrirAjustar = (s: SuspensaoDetalhe) => {
    setSuspensaoParaAjustar(s);
    setModalAjustarAberto(true);
  };

  const abrirNovaSuspensaoManual = () => {
    setSuspensaoParaAjustar(null);
    setModalAjustarAberto(true);
  };

  const suspensoes = painel?.suspensoes ?? [];
  const resumoCartoes = painel?.resumo_cartoes ?? [];
  const artilheiros = artilharia?.artilheiros ?? [];

  const temSuspensoesEmRevisao = suspensoes.some((s) => s.situacao === 'EM_REVISAO');
  const totalSuspensoesAtivas = suspensoes.filter((s) => s.situacao === 'ATIVA').length;

  // Sem dados ainda (primeira carga ou falha): mostra esqueleto ou só o erro.
  const semDados = painel === null;

  return (
    <div className="space-y-4" data-testid="painel-disciplina">
      <Tabs value={subAba} onValueChange={(v) => setSubAba(v as SubAbaDisciplina)}>
        {/* Sub-abas e ações */}
        <div className="flex flex-col-reverse gap-3 border-b border-line sm:flex-row sm:items-end sm:justify-between">
          <TabsList aria-label="Disciplina" className="min-w-0 border-b-0">
            <TabsTrigger
              value="suspensoes"
              data-testid="subtab-suspensoes"
              icon={<ShieldAlert className="size-4" />}
            >
              Suspensões
              <Contador valor={suspensoes.length} />
            </TabsTrigger>
            <TabsTrigger
              value="cartoes"
              data-testid="subtab-cartoes"
              icon={<RectangleVertical className="size-4" />}
            >
              Cartões
              <Contador valor={resumoCartoes.length} />
            </TabsTrigger>
            <TabsTrigger
              value="artilharia"
              data-testid="subtab-artilharia"
              icon={<Trophy className="size-4" />}
            >
              Artilharia
              <Contador valor={artilheiros.length} />
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 self-end pb-2 sm:self-auto">
            {subAba === 'suspensoes' && (
              <Button
                data-testid="btn-nova-suspensao"
                leftIcon={<Plus className="size-4" />}
                onClick={abrirNovaSuspensaoManual}
              >
                Nova suspensão manual
              </Button>
            )}
            <IconButton
              variant="secondary"
              data-testid="btn-recarregar-disciplina"
              onClick={carregarDados}
              disabled={carregando}
              aria-label="Atualizar dados"
            >
              <RefreshCw aria-hidden="true" className={cn(carregando && 'motion-safe:animate-spin')} />
            </IconButton>
          </div>
        </div>

        {/* Erro geral */}
        {erro && (
          <Alert
            tone="danger"
            data-testid="erro-disciplina"
            className="mt-4"
            title="Não foi possível carregar a disciplina"
            action={
              <Button variant="secondary" size="sm" onClick={carregarDados}>
                Tentar novamente
              </Button>
            }
          >
            {erro}
          </Alert>
        )}

        {/* Carregamento inicial */}
        {carregando && semDados && (
          <div data-testid="carregando-disciplina" className="space-y-3 pt-4" aria-busy="true">
            <span className="sr-only">Carregando dados de disciplina e artilharia…</span>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        )}

        {!semDados && (
          <>
            {/* Sub-aba 1: Suspensões e cumprimentos */}
            <TabsContent value="suspensoes" className="space-y-4">
              {temSuspensoesEmRevisao && (
                <Alert
                  tone="warning"
                  data-testid="alerta-em-revisao"
                  title="Suspensões em revisão administrativa"
                >
                  Isso ocorre quando um cartão de origem foi removido ou alterado depois de cumprimentos já
                  registrados na súmula. Use <strong className="font-semibold text-fg">Revisar</strong> no menu
                  de ações da suspensão para confirmar a punição, cancelá-la ou alterar a quantidade de jogos,
                  com a devida justificativa.
                </Alert>
              )}

              <CabecalhoSecao
                titulo="Suspensões da edição"
                descricao="Punições automáticas (por cartões) e manuais (administrativas)."
                extra={
                  <p className="text-sm text-fg-muted">
                    Ativas: <strong className="font-semibold tabular-nums text-fg">{totalSuspensoesAtivas}</strong>
                    <span aria-hidden="true"> · </span>
                    Total: <strong className="font-semibold tabular-nums text-fg">{suspensoes.length}</strong>
                  </p>
                }
              />

              {suspensoes.length === 0 ? (
                <EmptyState
                  data-testid="sem-suspensoes"
                  icon={<ShieldAlert />}
                  title="Nenhuma suspensão registrada"
                  description="Suspensões por acúmulo de cartões ou expulsões aparecem aqui automaticamente após o encerramento das súmulas."
                />
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Atleta</TH>
                      <TH>Equipe</TH>
                      <TH>Origem</TH>
                      <TH>Motivo</TH>
                      <TH className="text-center">Cumprimento</TH>
                      <TH>Situação</TH>
                      <TH className="text-right">
                        <span className="sr-only">Ações</span>
                      </TH>
                    </tr>
                  </THead>
                  <TBody>
                    {suspensoes.map((s) => {
                      const ehEmRevisao = s.situacao === 'EM_REVISAO';
                      const nome = s.nome_esportivo || `Integrante #${s.id_integrante}`;
                      return (
                        <TR
                          key={s.id_suspensao}
                          data-testid={`linha-suspensao-${s.id_suspensao}`}
                          className={cn(ehEmRevisao && 'bg-warning-soft')}
                        >
                          <TD className="whitespace-nowrap font-medium">{nome}</TD>
                          <TD className="whitespace-nowrap text-fg-muted">{s.nome_equipe || '—'}</TD>
                          <TD className="whitespace-nowrap">
                            <Badge tone="neutral">{ROTULO_ORIGEM_SUSPENSAO[s.origem] ?? 'Outra'}</Badge>
                          </TD>
                          <TD className="max-w-xs truncate text-fg-muted" title={s.motivo}>
                            {s.motivo}
                          </TD>
                          <TD className="whitespace-nowrap text-center tabular-nums">
                            <span>
                              <span className="font-semibold text-fg">{s.jogos_cumpridos}</span>
                              <span className="text-fg-muted"> / {s.jogos} jogos</span>
                            </span>
                          </TD>
                          <TD className="whitespace-nowrap">
                            <EtiquetaSituacao s={s} />
                          </TD>
                          <TD className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <IconButton
                                  aria-label={`Mais ações da suspensão de ${nome}`}
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`btn-acoes-suspensao-${s.id_suspensao}`}
                                >
                                  <MoreHorizontal aria-hidden="true" />
                                </IconButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {s.situacao === 'ATIVA' && (
                                  <DropdownMenuItem
                                    data-testid={`btn-cumprir-${s.id_suspensao}`}
                                    onSelect={() => abrirCumprir(s)}
                                  >
                                    <CircleCheck aria-hidden="true" className="size-4" />
                                    Cumprir
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  data-testid={`btn-ajustar-${s.id_suspensao}`}
                                  onSelect={() => abrirAjustar(s)}
                                >
                                  {ehEmRevisao ? (
                                    <ClipboardCheck aria-hidden="true" className="size-4" />
                                  ) : (
                                    <SlidersHorizontal aria-hidden="true" className="size-4" />
                                  )}
                                  {ehEmRevisao ? 'Revisar' : 'Ajustar'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  data-testid={`btn-historico-${s.id_suspensao}`}
                                  onSelect={() => setSuspensaoHistorico(s)}
                                >
                                  <History aria-hidden="true" className="size-4" />
                                  Histórico
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              )}
            </TabsContent>

            {/* Sub-aba 2: Controle de cartões */}
            <TabsContent value="cartoes" className="space-y-4">
              {/* Nota informativa (spec 7.4) */}
              <Alert tone="info" data-testid="nota-segundo-amarelo">
                Os cartões amarelos que resultaram em expulsão por 2º amarelo na mesma partida não somam no saldo para acúmulo de amarelos.
              </Alert>

              <CabecalhoSecao
                titulo="Resumo de cartões da edição"
                descricao="Saldo acumulado para suspensão automática e contagem estatística oficial."
              />

              {resumoCartoes.length === 0 ? (
                <EmptyState
                  data-testid="sem-cartoes"
                  icon={<CircleCheck />}
                  title="Nenhum cartão registrado"
                  description="Os cartões lançados nas súmulas desta edição aparecem aqui."
                />
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Atleta</TH>
                      <TH>Equipe</TH>
                      <TH className="text-center">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className="inline-block h-3.5 w-2.5 rounded-sm bg-warning" />
                          Amarelos
                        </span>
                      </TH>
                      <TH className="text-center">Saldo p/ acúmulo</TH>
                      <TH className="text-center">2º amarelo</TH>
                      <TH className="text-center">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className="inline-block h-3.5 w-2.5 rounded-sm bg-danger" />
                          Vermelhos diretos
                        </span>
                      </TH>
                      <TH>Situação</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {resumoCartoes.map((r) => (
                      <TR key={r.id_integrante} data-testid={`linha-cartoes-${r.id_integrante}`}>
                        <TD className="whitespace-nowrap font-medium">{r.nome_esportivo}</TD>
                        <TD className="whitespace-nowrap text-fg-muted">{r.nome_equipe}</TD>
                        <TD className="text-center tabular-nums">{r.amarelos_estatisticos}</TD>
                        <TD className="text-center font-semibold tabular-nums text-warning">
                          {r.amarelos_acumulo_atual}
                        </TD>
                        <TD className="text-center tabular-nums">{r.expulsoes_segundo_amarelo}</TD>
                        <TD className="text-center font-semibold tabular-nums text-danger">
                          {r.vermelhos_diretos}
                        </TD>
                        <TD className="whitespace-nowrap">
                          {r.suspenso_atualmente ? (
                            <Badge tone="danger" dot data-testid="badge-suspenso">
                              Suspenso
                            </Badge>
                          ) : (
                            <Badge tone="success" dot data-testid="badge-regular">
                              Regular
                            </Badge>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </TabsContent>

            {/* Sub-aba 3: Artilharia da edição */}
            <TabsContent value="artilharia" className="space-y-4">
              {artilharia?.possui_jogos_em_andamento && (
                <Alert tone="info" data-testid="aviso-jogos-em-andamento">
                  Existem partidas em andamento nesta edição. Gols marcados em partidas não finalizadas estão indicados separadamente.
                </Alert>
              )}

              <CabecalhoSecao
                titulo="Ranking oficial de artilharia"
                descricao="Total de gols marcados pelos atletas na edição."
              />

              {artilheiros.length === 0 ? (
                <EmptyState
                  data-testid="sem-artilheiros"
                  icon={<Award />}
                  title="Nenhum gol registrado"
                  description="Os gols lançados nas súmulas desta edição aparecem aqui."
                />
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH className="w-16 text-center">Pos.</TH>
                      <TH>Atleta</TH>
                      <TH className="w-20 text-center">Nº</TH>
                      <TH>Equipe</TH>
                      <TH className="w-28 text-center">Gols</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {artilheiros.map((a) => {
                      const posicao = a.posicao;
                      return (
                        <TR key={a.id_integrante} data-testid={`linha-artilheiro-${a.id_integrante}`}>
                          <TD className="text-center">
                            <span
                              data-testid={`posicao-artilheiro-${a.id_integrante}`}
                              className={cn(
                                'inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                                posicao === 1 && 'bg-warning-soft text-warning',
                                (posicao === 2 || posicao === 3) && 'bg-surface-muted text-fg',
                                posicao > 3 && 'text-fg-muted',
                              )}
                            >
                              {posicao}
                            </span>
                          </TD>
                          <TD className={cn('whitespace-nowrap', posicao <= 3 ? 'font-semibold' : 'font-medium')}>
                            {a.nome_esportivo}
                          </TD>
                          <TD className="text-center tabular-nums text-fg-muted">
                            {a.numero_camisa != null ? a.numero_camisa : '—'}
                          </TD>
                          <TD className="whitespace-nowrap text-fg-muted">{a.nome_equipe}</TD>
                          <TD className="whitespace-nowrap text-center">
                            <span className="text-base font-semibold tabular-nums text-fg">{a.gols}</span>
                            {a.gols_em_andamento > 0 && (
                              <span
                                className="ml-1 text-xs font-medium tabular-nums text-primary"
                                title="Gols em partidas em andamento"
                              >
                                (+{a.gols_em_andamento})
                              </span>
                            )}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Modais */}
      <ModalCumprirSuspensao
        suspensao={suspensaoParaCumprir}
        partidas={partidas}
        isOpen={modalCumprirAberto}
        onClose={() => {
          setModalCumprirAberto(false);
          setSuspensaoParaCumprir(null);
        }}
        onSucesso={carregarDados}
      />

      <ModalAjustarSuspensao
        suspensao={suspensaoParaAjustar}
        idEdicaoCompeticao={idEdicaoCompeticao}
        equipes={equipes}
        isOpen={modalAjustarAberto}
        onClose={() => {
          setModalAjustarAberto(false);
          setSuspensaoParaAjustar(null);
        }}
        onSucesso={carregarDados}
      />

      {/* Modal Histórico da Suspensão (DF-RT14-05) */}
      <Dialog
        open={suspensaoHistorico !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setSuspensaoHistorico(null);
        }}
      >
        {suspensaoHistorico && (
          <DialogContent
            size="md"
            title="Histórico da suspensão"
            description={`${suspensaoHistorico.nome_esportivo || `Integrante #${suspensaoHistorico.id_integrante}`}${suspensaoHistorico.nome_equipe ? ` · ${suspensaoHistorico.nome_equipe}` : ''}`}
          >
            <div className="space-y-4" data-testid="modal-historico-suspensao">
              {suspensaoHistorico.responsavel_nome && (
                <p className="text-sm text-fg-muted">
                  Responsável pelo registro:{' '}
                  <strong className="font-semibold text-fg">
                    {suspensaoHistorico.responsavel_nome}
                  </strong>
                </p>
              )}

              {(suspensaoHistorico.historico ?? []).length === 0 ? (
                <p className="text-sm text-fg-muted">
                  Nenhum evento registrado no histórico desta suspensão.
                </p>
              ) : (
                <ol className="space-y-3 border-l-2 border-line pl-4">
                  {(suspensaoHistorico.historico ?? []).map((item, idx) => (
                    <li key={`${item.em}-${idx}`} className="space-y-1 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-fg">{item.acao}</span>
                        {item.em ? (
                          <span className="text-xs tabular-nums text-fg-subtle">
                            {new Date(item.em).toLocaleString('pt-BR')}
                          </span>
                        ) : null}
                      </div>
                      {item.responsavel_nome ? (
                        <p className="text-xs text-fg-muted">
                          Responsável: <span className="font-medium text-fg">{item.responsavel_nome}</span>
                        </p>
                      ) : null}
                      {item.situacao_anterior || item.situacao_nova ? (
                        <p className="text-xs text-fg-muted">
                          Situação:{' '}
                          {item.situacao_anterior
                            ? rotuloDoEstado('suspensao', item.situacao_anterior)
                            : '—'}{' '}
                          →{' '}
                          <span className="font-medium text-fg">
                            {item.situacao_nova
                              ? rotuloDoEstado('suspensao', item.situacao_nova)
                              : '—'}
                          </span>
                        </p>
                      ) : null}
                      {item.justificativa ? (
                        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-fg">
                          {item.justificativa}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setSuspensaoHistorico(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
