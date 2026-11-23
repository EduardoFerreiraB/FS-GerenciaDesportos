'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  Link2,
  Pencil,
  Trash2,
  Trophy,
  Unlink,
} from 'lucide-react';
import {
  obterEvento,
  criarEdicaoEvento,
  atualizarEvento,
  atualizarEdicaoEvento,
  obterPreviaExclusaoEvento,
  excluirEvento,
  listarCompeticoes,
  vincularEdicaoAoEvento,
  desvincularEdicaoDoEvento,
} from '@/services/competicoes';
import type {
  CompeticaoDetalhe,
  CompeticaoVinculada,
  EdicaoEventoDetalhe,
  EventoDetalhe,
  PreviaExclusaoEvento,
} from '@/types/competicoes';
import ModalNovaCompeticao from '@/components/competicoes/organizacao/ModalNovaCompeticao';
import ModalConfirmarExclusao from '@/components/competicoes/organizacao/ModalConfirmarExclusao';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useNotification } from '@/context/NotificationContext';
import { extrairErro } from '@/lib/erros';
import { formatarPeriodo } from '@/lib/formatos';
import { cn } from '@/lib/cn';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
} from '@/components/ui';

export default function EventoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const { toast, confirm } = useNotification();
  const idEvento = Number(params?.id);

  const [evento, setEvento] = useState<EventoDetalhe | null>(null);
  const [edicaoEventoSelecionadaId, setEdicaoEventoSelecionadaId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal Nova Edição do Evento
  const [modalNovaEdicaoAberto, setModalNovaEdicaoAberto] = useState(false);
  const [identificacaoEdicao, setIdentificacaoEdicao] = useState('');
  const [dataInicioEdicao, setDataInicioEdicao] = useState('');
  const [dataFimEdicao, setDataFimEdicao] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [erroDataFimNovaEdicao, setErroDataFimNovaEdicao] = useState<string | null>(null);

  // Modal Editar Evento
  const [modalEditarEventoAberto, setModalEditarEventoAberto] = useState(false);
  const [nomeEditarEvento, setNomeEditarEvento] = useState('');
  const [descricaoEditarEvento, setDescricaoEditarEvento] = useState('');
  const [salvandoEvento, setSalvandoEvento] = useState(false);
  const [erroEditarEvento, setErroEditarEvento] = useState<string | null>(null);
  const [erroNomeEditarEvento, setErroNomeEditarEvento] = useState<string | null>(null);
  const [arquivandoEvento, setArquivandoEvento] = useState(false);

  // Modal Excluir Evento em Cascata
  const [modalExcluirEventoAberto, setModalExcluirEventoAberto] = useState(false);
  const [previaExclusao, setPreviaExclusao] = useState<PreviaExclusaoEvento | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);

  // Modal Editar Edição do Evento
  const [edicaoParaEditar, setEdicaoParaEditar] = useState<EdicaoEventoDetalhe | null>(null);
  const [identificacaoEditarEdicao, setIdentificacaoEditarEdicao] = useState('');
  const [dataInicioEditarEdicao, setDataInicioEditarEdicao] = useState('');
  const [dataFimEditarEdicao, setDataFimEditarEdicao] = useState('');
  const [salvandoEdicaoExistente, setSalvandoEdicaoExistente] = useState(false);
  const [erroEditarEdicao, setErroEditarEdicao] = useState<string | null>(null);
  const [erroDataFimEditarEdicao, setErroDataFimEditarEdicao] = useState<string | null>(null);

  // Modal Vincular Competição Existente
  const [modalVincularAberto, setModalVincularAberto] = useState(false);
  const [competicoesDisponiveis, setCompeticoesDisponiveis] = useState<CompeticaoDetalhe[]>([]);
  const [carregandoCompeticoes, setCarregandoCompeticoes] = useState(false);
  const [idEdicaoParaVincular, setIdEdicaoParaVincular] = useState<string>('');
  const [vinculando, setVinculando] = useState(false);
  const [erroVincular, setErroVincular] = useState<string | null>(null);
  const [erroCampoVincular, setErroCampoVincular] = useState<string | null>(null);
  const [desvinculandoId, setDesvinculandoId] = useState<number | null>(null);

  // Modal Adicionar Competição (Nova)
  const [modalAdicionarCompeticaoAberto, setModalAdicionarCompeticaoAberto] = useState(false);

  useBreadcrumb([
    { label: 'Eventos', href: '/dashboard/eventos' },
    ...(evento ? [{ label: evento.nome }] : []),
  ]);

  const carregarEvento = useCallback(async () => {
    if (isNaN(idEvento)) {
      setErro('ID de evento inválido.');
      setCarregando(false);
      return;
    }
    try {
      setCarregando(true);
      setErro(null);
      const dados = await obterEvento(idEvento);
      setEvento(dados);
      if (dados.edicoes && dados.edicoes.length > 0) {
        setEdicaoEventoSelecionadaId((prev) => {
          if (prev && dados.edicoes.some((e) => e.id_edicao_evento === prev)) {
            return prev;
          }
          return dados.edicoes[dados.edicoes.length - 1].id_edicao_evento;
        });
      }
    } catch (err: unknown) {
      setErro(extrairErro(err, { padrao: 'Falha ao carregar detalhes do evento.' }).mensagem);
    } finally {
      setCarregando(false);
    }
  }, [idEvento]);

  useEffect(() => {
    carregarEvento();
  }, [carregarEvento]);

  const abrirModalNovaEdicao = () => {
    setIdentificacaoEdicao('');
    setDataInicioEdicao('');
    setDataFimEdicao('');
    setErroEdicao(null);
    setErroDataFimNovaEdicao(null);
    setModalNovaEdicaoAberto(true);
  };

  const abrirModalEditarEvento = () => {
    if (!evento) return;
    setNomeEditarEvento(evento.nome);
    setDescricaoEditarEvento(evento.descricao ?? '');
    setErroEditarEvento(null);
    setErroNomeEditarEvento(null);
    setModalEditarEventoAberto(true);
  };

  const abrirModalExcluirEvento = async () => {
    if (!evento) return;
    setCarregandoPrevia(true);
    setPreviaExclusao(null);
    try {
      const previa = await obterPreviaExclusaoEvento(evento.id_evento);
      setPreviaExclusao(previa);
      setModalExcluirEventoAberto(true);
    } catch (err: unknown) {
      toast(
        extrairErro(err, { padrao: 'Não foi possível consultar o impacto da exclusão.' }).mensagem,
        'error',
      );
    } finally {
      setCarregandoPrevia(false);
    }
  };

  const abrirModalEditarEdicao = (ed: EdicaoEventoDetalhe) => {
    setEdicaoParaEditar(ed);
    setIdentificacaoEditarEdicao(ed.identificacao);
    setDataInicioEditarEdicao(ed.data_inicio);
    setDataFimEditarEdicao(ed.data_fim);
    setErroEditarEdicao(null);
    setErroDataFimEditarEdicao(null);
  };

  const abrirModalVincularCompeticao = async () => {
    setErroVincular(null);
    setErroCampoVincular(null);
    setIdEdicaoParaVincular('');
    setModalVincularAberto(true);
    setCarregandoCompeticoes(true);
    try {
      const res = await listarCompeticoes({ tamanho: 100 });
      setCompeticoesDisponiveis(res.itens ?? []);
    } catch (err: unknown) {
      setErroVincular(
        extrairErro(err, { padrao: 'Não foi possível carregar as competições disponíveis.' })
          .mensagem,
      );
    } finally {
      setCarregandoCompeticoes(false);
    }
  };

  const handleCriarEdicaoEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroEdicao(null);
    setErroDataFimNovaEdicao(null);

    if (!identificacaoEdicao.trim() || !dataInicioEdicao || !dataFimEdicao) {
      setErroEdicao('Preencha todos os campos obrigatórios da edição.');
      return;
    }
    if (dataFimEdicao < dataInicioEdicao) {
      setErroDataFimNovaEdicao('A data de término deve ser igual ou posterior à data de início.');
      return;
    }

    try {
      setSalvandoEdicao(true);
      const novaEdicao = await criarEdicaoEvento(idEvento, {
        identificacao: identificacaoEdicao.trim(),
        data_inicio: dataInicioEdicao,
        data_fim: dataFimEdicao,
      });

      toast('Edição do evento criada com sucesso.', 'success');
      setModalNovaEdicaoAberto(false);
      setIdentificacaoEdicao('');
      setDataInicioEdicao('');
      setDataFimEdicao('');
      await carregarEvento();
      setEdicaoEventoSelecionadaId(novaEdicao.id_edicao_evento);
    } catch (err: unknown) {
      const parsed = extrairErro(err, {
        camposConhecidos: ['data_fim'],
        padrao: 'Falha ao criar nova edição do evento.',
      });
      if (parsed.campos['data_fim']) {
        setErroDataFimNovaEdicao(parsed.campos['data_fim']);
      } else {
        setErroEdicao(parsed.mensagem);
      }
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleEditarEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroEditarEvento(null);
    setErroNomeEditarEvento(null);

    if (!nomeEditarEvento.trim()) {
      setErroNomeEditarEvento('O nome do evento é obrigatório.');
      return;
    }

    try {
      setSalvandoEvento(true);
      const atualizado = await atualizarEvento(idEvento, {
        nome: nomeEditarEvento.trim(),
        descricao: descricaoEditarEvento.trim() || null,
      });
      setEvento(atualizado);
      toast('Evento atualizado com sucesso.', 'success');
      setModalEditarEventoAberto(false);
    } catch (err: unknown) {
      const parsed = extrairErro(err, {
        camposConhecidos: ['nome'],
        padrao: 'Falha ao atualizar o evento.',
      });
      if (parsed.campos['nome']) {
        setErroNomeEditarEvento(parsed.campos['nome']);
      } else {
        setErroEditarEvento(parsed.mensagem);
      }
    } finally {
      setSalvandoEvento(false);
    }
  };

  const handleArquivarEvento = () => {
    if (!evento) return;
    const novoEstadoArquivado = !evento.arquivado;
    confirm({
      title: novoEstadoArquivado ? 'Arquivar evento' : 'Reativar evento',
      message: novoEstadoArquivado
        ? `Deseja arquivar o evento "${evento.nome}"? Ele deixará de aparecer na listagem ativa.`
        : `Deseja reativar o evento "${evento.nome}"?`,
      confirmText: novoEstadoArquivado ? 'Arquivar' : 'Reativar',
      onConfirm: async () => {
        try {
          setArquivandoEvento(true);
          const atualizado = await atualizarEvento(idEvento, {
            arquivado: novoEstadoArquivado,
          });
          setEvento(atualizado);
          toast(
            novoEstadoArquivado
              ? 'Evento arquivado com sucesso.'
              : 'Evento reativado com sucesso.',
            'success',
          );
          if (novoEstadoArquivado) {
            router.push('/dashboard/eventos');
          }
        } catch (err: unknown) {
          toast(
            extrairErro(err, { padrao: 'Não foi possível alterar o arquivamento do evento.' })
              .mensagem,
            'error',
          );
        } finally {
          setArquivandoEvento(false);
        }
      },
    });
  };

  const handleConfirmarExclusaoEvento = async () => {
    if (!evento) return;
    await excluirEvento(evento.id_evento, evento.nome);
    toast('Evento excluído com sucesso.', 'success');
    setModalExcluirEventoAberto(false);
    router.push('/dashboard/eventos');
  };

  const handleEditarEdicaoEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edicaoParaEditar) return;
    setErroEditarEdicao(null);
    setErroDataFimEditarEdicao(null);

    if (
      !identificacaoEditarEdicao.trim() ||
      !dataInicioEditarEdicao ||
      !dataFimEditarEdicao
    ) {
      setErroEditarEdicao('Preencha todos os campos obrigatórios da edição.');
      return;
    }
    if (dataFimEditarEdicao < dataInicioEditarEdicao) {
      setErroDataFimEditarEdicao('A data de término deve ser igual ou posterior à data de início.');
      return;
    }

    try {
      setSalvandoEdicaoExistente(true);
      await atualizarEdicaoEvento(edicaoParaEditar.id_edicao_evento, {
        identificacao: identificacaoEditarEdicao.trim(),
        data_inicio: dataInicioEditarEdicao,
        data_fim: dataFimEditarEdicao,
      });
      toast('Edição do evento atualizada com sucesso.', 'success');
      setEdicaoParaEditar(null);
      await carregarEvento();
    } catch (err: unknown) {
      const parsed = extrairErro(err, {
        camposConhecidos: ['data_fim'],
        padrao: 'Falha ao atualizar a edição do evento.',
      });
      if (parsed.campos['data_fim']) {
        setErroDataFimEditarEdicao(parsed.campos['data_fim']);
      } else {
        setErroEditarEdicao(parsed.mensagem);
      }
    } finally {
      setSalvandoEdicaoExistente(false);
    }
  };

  const handleVincularCompeticao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edicaoEventoSelecionadaId) return;
    const idEdComp = Number(idEdicaoParaVincular);
    if (!idEdComp) {
      setErroCampoVincular('Selecione uma edição de competição para vincular.');
      return;
    }

    setVinculando(true);
    setErroVincular(null);
    setErroCampoVincular(null);

    try {
      await vincularEdicaoAoEvento(edicaoEventoSelecionadaId, idEdComp);
      toast('Competição vinculada com sucesso.', 'success');
      setModalVincularAberto(false);
      await carregarEvento();
    } catch (err: unknown) {
      const parsed = extrairErro(err, {
        camposConhecidos: ['id_edicao_competicao'],
        padrao: 'Não foi possível vincular a competição ao evento.',
      });
      if (parsed.campos['id_edicao_competicao']) {
        setErroCampoVincular(parsed.campos['id_edicao_competicao']);
      } else {
        setErroVincular(parsed.mensagem);
      }
    } finally {
      setVinculando(false);
    }
  };

  const handleDesvincularCompeticao = async (comp: CompeticaoVinculada) => {
    if (!edicaoEventoSelecionadaId) return;
    setDesvinculandoId(comp.id_edicao_competicao);
    try {
      await desvincularEdicaoDoEvento(edicaoEventoSelecionadaId, comp.id_edicao_competicao);
      toast('Competição desvinculada com sucesso.', 'success');
      await carregarEvento();
    } catch (err: unknown) {
      toast(
        extrairErro(err, { padrao: 'Não foi possível desvincular a competição.' }).mensagem,
        'error',
      );
    } finally {
      setDesvinculandoId(null);
    }
  };

  if (carregando && !evento) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Carregando evento">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (erro || !evento) {
    return (
      <div className="space-y-6">
        <Alert
          tone="danger"
          title="Erro ao carregar evento"
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard/eventos">Voltar para eventos</Link>
              </Button>
              <Button size="sm" variant="secondary" onClick={carregarEvento}>
                Tentar novamente
              </Button>
            </div>
          }
        >
          {erro}
        </Alert>
      </div>
    );
  }

  const edicaoAtiva = evento.edicoes.find(
    (e) => e.id_edicao_evento === edicaoEventoSelecionadaId
  );

  const competicoesVinculadas = edicaoAtiva?.competicoes ?? [];
  const idsJaVinculadas = new Set(competicoesVinculadas.map((c) => c.id_edicao_competicao));
  const opcoesParaVincular = competicoesDisponiveis.flatMap((comp) =>
    (comp.edicoes ?? [])
      .filter((ed) => !idsJaVinculadas.has(ed.id_edicao_competicao))
      .map((ed) => {
        const avisoEvento = ed.evento ? ` — já vinculada a ${ed.evento.nome}` : '';
        return {
          id_edicao_competicao: ed.id_edicao_competicao,
          rotulo: `${comp.nome} · ${ed.identificacao} (${formatarPeriodo(ed.data_inicio, ed.data_fim)})${avisoEvento}`,
        };
      }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="block break-words">{evento.nome}</span>}
        description={evento.descricao || undefined}
        actions={
          <>
            <Button
              variant="secondary"
              data-testid="btn-editar-evento"
              leftIcon={<Pencil className="size-4" aria-hidden="true" />}
              onClick={abrirModalEditarEvento}
            >
              Editar evento
            </Button>
            <Button
              variant="secondary"
              data-testid="btn-arquivar-evento"
              loading={arquivandoEvento}
              leftIcon={
                evento.arquivado ? (
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                ) : (
                  <Archive className="size-4" aria-hidden="true" />
                )
              }
              onClick={handleArquivarEvento}
            >
              {evento.arquivado ? 'Reativar' : 'Arquivar'}
            </Button>
            <Button
              variant="danger"
              data-testid="btn-excluir-evento"
              loading={carregandoPrevia}
              leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={abrirModalExcluirEvento}
            >
              Excluir evento
            </Button>
            <Button
              variant="secondary"
              leftIcon={<CalendarPlus className="size-4" aria-hidden="true" />}
              onClick={abrirModalNovaEdicao}
            >
              Adicionar edição de evento
            </Button>
            <Button
              leftIcon={<Trophy className="size-4" aria-hidden="true" />}
              onClick={() => setModalAdicionarCompeticaoAberto(true)}
            >
              Nova competição
            </Button>
          </>
        }
      />

      <section className="space-y-3" aria-labelledby="titulo-edicoes-evento">
        <h2 id="titulo-edicoes-evento" className="text-base font-semibold text-fg">
          Edições do evento
        </h2>
        {evento.edicoes && evento.edicoes.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {evento.edicoes.map((ed) => {
              const selecionada = ed.id_edicao_evento === edicaoEventoSelecionadaId;
              const qtdCompeticoes = ed.competicoes?.length ?? 0;
              return (
                <li key={ed.id_edicao_evento}>
                  <button
                    type="button"
                    aria-pressed={selecionada}
                    onClick={() => setEdicaoEventoSelecionadaId(ed.id_edicao_evento)}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-xl border bg-surface p-4 text-left outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-focus',
                      selecionada ? 'border-primary bg-primary-soft' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <strong className="min-w-0 truncate text-sm font-semibold text-fg" title={ed.identificacao}>
                        {ed.identificacao}
                      </strong>
                      {selecionada ? <Badge tone="primary">Selecionada</Badge> : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm text-fg-muted tabular-nums">
                      <CalendarDays className="size-4 text-fg-subtle" aria-hidden="true" />
                      {formatarPeriodo(ed.data_inicio, ed.data_fim)}
                    </span>
                    <span className="text-xs text-fg-subtle tabular-nums">
                      {qtdCompeticoes}{' '}
                      {qtdCompeticoes === 1 ? 'competição vinculada' : 'competições vinculadas'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<CalendarDays />}
            title="Nenhuma edição cadastrada"
            description="Adicione uma edição para vincular competições a este evento."
          />
        )}
      </section>

      {edicaoAtiva && (
        <Card data-testid="card-competicoes-vinculadas">
          <CardHeader
            title={`Competições vinculadas a ${edicaoAtiva.identificacao}`}
            description={`Período oficial: ${formatarPeriodo(edicaoAtiva.data_inicio, edicaoAtiva.data_fim)}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  data-testid="btn-editar-edicao-evento"
                  leftIcon={<Pencil className="size-4" aria-hidden="true" />}
                  onClick={() => abrirModalEditarEdicao(edicaoAtiva)}
                >
                  Editar edição
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  data-testid="btn-vincular-competicao"
                  leftIcon={<Link2 className="size-4" aria-hidden="true" />}
                  onClick={abrirModalVincularCompeticao}
                >
                  Vincular competição
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-4">
            <p className="text-sm text-fg-muted">
              Todas as competições vinculadas a esta edição devem respeitar o período do evento (
              <span className="tabular-nums">{formatarPeriodo(edicaoAtiva.data_inicio, edicaoAtiva.data_fim)}</span>).
            </p>

            {competicoesVinculadas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface-muted/50 px-4 py-6 text-center">
                <p className="text-sm font-medium text-fg">
                  Nenhuma competição vinculada a esta edição
                </p>
                <p className="mt-1 text-xs text-fg-muted">
                  Use &quot;Vincular competição&quot; para associar uma edição existente ou &quot;Nova competição&quot; para criar uma do zero.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {competicoesVinculadas.map((comp) => (
                  <li
                    key={comp.id_edicao_competicao}
                    data-testid={`competicao-vinculada-${comp.id_edicao_competicao}`}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/competicoes/${comp.id_competicao}?edicao=${comp.id_edicao_competicao}`}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg hover:text-primary hover:underline"
                        >
                          <Trophy className="size-4 shrink-0 text-primary" aria-hidden="true" />
                          <span>{comp.nome}</span>
                          <ExternalLink className="size-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
                        </Link>
                        <Badge tone="neutral">{comp.identificacao}</Badge>
                        <StatusBadge tipo="edicao" valor={comp.estado} />
                        {comp.publicada ? <Badge tone="success">Publicada</Badge> : null}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`btn-desvincular-${comp.id_edicao_competicao}`}
                      loading={desvinculandoId === comp.id_edicao_competicao}
                      leftIcon={<Unlink className="size-4" aria-hidden="true" />}
                      onClick={() => handleDesvincularCompeticao(comp)}
                    >
                      Desvincular
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {/* Modal Vincular Competição Existente */}
      <Dialog
        open={modalVincularAberto}
        onOpenChange={(aberto) => {
          if (!aberto && !vinculando) setModalVincularAberto(false);
        }}
      >
        <DialogContent
          size="md"
          title="Vincular competição existente"
          description="Escolha uma edição de competição já cadastrada para associar a esta edição do evento."
        >
          <form id="form-vincular-competicao" onSubmit={handleVincularCompeticao} className="space-y-4">
            {erroVincular ? <Alert tone="danger">{erroVincular}</Alert> : null}
            <Field
              label="Edição de competição"
              htmlFor="select-edicao-vincular"
              required
              error={erroCampoVincular ?? undefined}
              hint={
                carregandoCompeticoes
                  ? 'Carregando competições...'
                  : opcoesParaVincular.length === 0
                    ? 'Não há outras edições de competição disponíveis para vincular.'
                    : 'As datas da edição selecionada devem caber no período do evento.'
              }
            >
              <Select
                id="select-edicao-vincular"
                data-testid="select-edicao-vincular"
                value={idEdicaoParaVincular}
                onChange={(e) => {
                  setIdEdicaoParaVincular(e.target.value);
                  setErroCampoVincular(null);
                  setErroVincular(null);
                }}
                disabled={carregandoCompeticoes || vinculando || opcoesParaVincular.length === 0}
              >
                <option value="">
                  {carregandoCompeticoes
                    ? 'Carregando…'
                    : opcoesParaVincular.length === 0
                      ? 'Nenhuma edição disponível'
                      : 'Selecione uma edição…'}
                </option>
                {opcoesParaVincular.map((op) => (
                  <option key={op.id_edicao_competicao} value={op.id_edicao_competicao}>
                    {op.rotulo}
                  </option>
                ))}
              </Select>
            </Field>
          </form>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setModalVincularAberto(false)}
              disabled={vinculando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-vincular-competicao"
              loading={vinculando}
              disabled={!idEdicaoParaVincular}
              leftIcon={<Link2 className="size-4" aria-hidden="true" />}
            >
              Confirmar vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nova Edição do Evento */}
      <Dialog
        open={modalNovaEdicaoAberto}
        onOpenChange={(aberto) => {
          if (!aberto && !salvandoEdicao) setModalNovaEdicaoAberto(false);
        }}
      >
        <DialogContent size="md" title="Nova Edição do Evento">
          <form id="form-edicao-evento" onSubmit={handleCriarEdicaoEvento} className="space-y-4">
            {erroEdicao ? <Alert tone="danger">{erroEdicao}</Alert> : null}
            <Field label="Identificação da Edição" htmlFor="edicao-evento-identificacao" required>
              <Input
                id="edicao-evento-identificacao"
                type="text"
                required
                placeholder="Ex: 2027 ou 2ª Edição"
                value={identificacaoEdicao}
                onChange={(e) => {
                  setIdentificacaoEdicao(e.target.value);
                  setErroEdicao(null);
                }}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Data de Início" htmlFor="edicao-evento-inicio" required>
                <Input
                  id="edicao-evento-inicio"
                  type="date"
                  required
                  value={dataInicioEdicao}
                  onChange={(e) => {
                    setDataInicioEdicao(e.target.value);
                    setErroDataFimNovaEdicao(null);
                    setErroEdicao(null);
                  }}
                />
              </Field>
              <Field
                label="Data de Término"
                htmlFor="edicao-evento-fim"
                required
                error={erroDataFimNovaEdicao ?? undefined}
              >
                <Input
                  id="edicao-evento-fim"
                  type="date"
                  required
                  value={dataFimEdicao}
                  onChange={(e) => {
                    setDataFimEdicao(e.target.value);
                    setErroDataFimNovaEdicao(null);
                    setErroEdicao(null);
                  }}
                />
              </Field>
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setModalNovaEdicaoAberto(false)}
              disabled={salvandoEdicao}
            >
              Cancelar
            </Button>
            <Button type="submit" form="form-edicao-evento" loading={salvandoEdicao}>
              Salvar Edição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Evento */}
      <Dialog
        open={modalEditarEventoAberto}
        onOpenChange={(aberto) => {
          if (!aberto && !salvandoEvento) setModalEditarEventoAberto(false);
        }}
      >
        <DialogContent size="md" title="Editar Evento">
          <form id="form-editar-evento" onSubmit={handleEditarEvento} className="space-y-4">
            {erroEditarEvento ? <Alert tone="danger">{erroEditarEvento}</Alert> : null}
            <Field
              label="Nome do Evento"
              htmlFor="editar-evento-nome"
              required
              error={erroNomeEditarEvento ?? undefined}
            >
              <Input
                id="editar-evento-nome"
                type="text"
                required
                value={nomeEditarEvento}
                onChange={(e) => {
                  setNomeEditarEvento(e.target.value);
                  setErroNomeEditarEvento(null);
                  setErroEditarEvento(null);
                }}
              />
            </Field>
            <Field label="Descrição (Opcional)" htmlFor="editar-evento-descricao">
              <Textarea
                id="editar-evento-descricao"
                rows={3}
                value={descricaoEditarEvento}
                onChange={(e) => setDescricaoEditarEvento(e.target.value)}
              />
            </Field>
          </form>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setModalEditarEventoAberto(false)}
              disabled={salvandoEvento}
            >
              Cancelar
            </Button>
            <Button type="submit" form="form-editar-evento" loading={salvandoEvento}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Edição do Evento */}
      <Dialog
        open={edicaoParaEditar !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !salvandoEdicaoExistente) setEdicaoParaEditar(null);
        }}
      >
        <DialogContent size="md" title="Editar Edição do Evento">
          <form
            id="form-editar-edicao-evento"
            onSubmit={handleEditarEdicaoEvento}
            className="space-y-4"
          >
            {erroEditarEdicao ? <Alert tone="danger">{erroEditarEdicao}</Alert> : null}
            <Field
              label="Identificação da Edição"
              htmlFor="editar-edicao-evento-identificacao"
              required
            >
              <Input
                id="editar-edicao-evento-identificacao"
                type="text"
                required
                value={identificacaoEditarEdicao}
                onChange={(e) => {
                  setIdentificacaoEditarEdicao(e.target.value);
                  setErroEditarEdicao(null);
                }}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Data de Início" htmlFor="editar-edicao-evento-inicio" required>
                <Input
                  id="editar-edicao-evento-inicio"
                  type="date"
                  required
                  value={dataInicioEditarEdicao}
                  onChange={(e) => {
                    setDataInicioEditarEdicao(e.target.value);
                    setErroDataFimEditarEdicao(null);
                    setErroEditarEdicao(null);
                  }}
                />
              </Field>
              <Field
                label="Data de Término"
                htmlFor="editar-edicao-evento-fim"
                required
                error={erroDataFimEditarEdicao ?? undefined}
              >
                <Input
                  id="editar-edicao-evento-fim"
                  type="date"
                  required
                  value={dataFimEditarEdicao}
                  onChange={(e) => {
                    setDataFimEditarEdicao(e.target.value);
                    setErroDataFimEditarEdicao(null);
                    setErroEditarEdicao(null);
                  }}
                />
              </Field>
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setEdicaoParaEditar(null)}
              disabled={salvandoEdicaoExistente}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-editar-edicao-evento"
              loading={salvandoEdicaoExistente}
            >
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Evento em Cascata */}
      <ModalConfirmarExclusao
        aberto={modalExcluirEventoAberto}
        titulo={`Excluir evento "${evento.nome}"?`}
        textoConfirmacao={evento.nome}
        descricao={
          previaExclusao ? (
            <span className="block space-y-1.5" data-testid="previa-exclusao-evento">
              <span className="block">
                A exclusão em cascata removerá definitivamente:
              </span>
              <span className="block text-fg">
                • <strong>{previaExclusao.edicoes_evento}</strong>{' '}
                {previaExclusao.edicoes_evento === 1 ? 'edição do evento' : 'edições do evento'}
              </span>
              <span className="block text-fg">
                • <strong>{previaExclusao.edicoes_competicao}</strong>{' '}
                {previaExclusao.edicoes_competicao === 1
                  ? 'edição de competição vinculada'
                  : 'edições de competição vinculadas'}
              </span>
              <span className="block text-fg">
                • <strong>{previaExclusao.equipes}</strong>{' '}
                {previaExclusao.equipes === 1 ? 'equipe' : 'equipes'} e{' '}
                <strong>{previaExclusao.partidas}</strong>{' '}
                {previaExclusao.partidas === 1 ? 'partida' : 'partidas'}
              </span>
              {previaExclusao.publicadas > 0 ? (
                <span className="block font-medium text-warning">
                  Atenção: {previaExclusao.publicadas}{' '}
                  {previaExclusao.publicadas === 1
                    ? 'edição está publicada'
                    : 'edições estão publicadas'}{' '}
                  no portal público.
                </span>
              ) : null}
            </span>
          ) : (
            <span>Todas as edições e competições vinculadas a este evento serão removidas.</span>
          )
        }
        onConfirmar={handleConfirmarExclusaoEvento}
        onFechar={() => setModalExcluirEventoAberto(false)}
      />

      <ModalNovaCompeticao
        aberto={modalAdicionarCompeticaoAberto}
        onClose={() => setModalAdicionarCompeticaoAberto(false)}
        onSuccess={() => {
          setModalAdicionarCompeticaoAberto(false);
          carregarEvento();
        }}
        idEdicaoEventoInicial={edicaoEventoSelecionadaId}
      />
    </div>
  );
}
