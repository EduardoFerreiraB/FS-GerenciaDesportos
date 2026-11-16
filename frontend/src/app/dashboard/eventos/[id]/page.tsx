'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, CalendarPlus, Plus, Trophy } from 'lucide-react';
import {
  obterEvento,
  criarEdicaoEvento,
  isErroApi,
} from '@/services/competicoes';
import type { EventoDetalhe } from '@/types/competicoes';
import ModalNovaCompeticao from '@/components/competicoes/organizacao/ModalNovaCompeticao';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
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
  Skeleton,
} from '@/components/ui';

export default function EventoDetalhePage() {
  const params = useParams();
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

  // Modal Adicionar Competição
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
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar detalhes do evento.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEvento]);

  useEffect(() => {
    carregarEvento();
  }, [carregarEvento]);

  const handleCriarEdicaoEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificacaoEdicao.trim() || !dataInicioEdicao || !dataFimEdicao) {
      setErroEdicao('Preencha todos os campos obrigatórios da edição.');
      return;
    }
    try {
      setSalvandoEdicao(true);
      setErroEdicao(null);
      const novaEdicao = await criarEdicaoEvento(idEvento, {
        identificacao: identificacaoEdicao.trim(),
        data_inicio: dataInicioEdicao,
        data_fim: dataFimEdicao,
      });

      setModalNovaEdicaoAberto(false);
      setIdentificacaoEdicao('');
      setDataInicioEdicao('');
      setDataFimEdicao('');
      await carregarEvento();
      setEdicaoEventoSelecionadaId(novaEdicao.id_edicao_evento);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroEdicao(err.mensagem);
      } else if (err instanceof Error) {
        setErroEdicao(err.message);
      } else {
        setErroEdicao('Falha ao criar nova edição do evento.');
      }
    } finally {
      setSalvandoEdicao(false);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="block break-words">{evento.nome}</span>}
        description={evento.descricao || undefined}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<CalendarPlus className="size-4" aria-hidden="true" />}
              onClick={() => setModalNovaEdicaoAberto(true)}
            >
              Adicionar edição de evento
            </Button>
            <Button
              leftIcon={<Trophy className="size-4" aria-hidden="true" />}
              onClick={() => setModalAdicionarCompeticaoAberto(true)}
            >
              Adicionar competição
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
        <Card>
          <CardHeader
            title={`Competições vinculadas a ${edicaoAtiva.identificacao}`}
            description={`Período oficial: ${formatarPeriodo(edicaoAtiva.data_inicio, edicaoAtiva.data_fim)}`}
            actions={
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => setModalAdicionarCompeticaoAberto(true)}
              >
                Vincular competição
              </Button>
            }
          />
          <CardBody>
            <p className="text-sm text-fg-muted">
              Todas as competições criadas nesta edição devem respeitar o período do evento (
              <span className="tabular-nums">{formatarPeriodo(edicaoAtiva.data_inicio, edicaoAtiva.data_fim)}</span>).
            </p>
          </CardBody>
        </Card>
      )}

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
                onChange={(e) => setIdentificacaoEdicao(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Data de Início" htmlFor="edicao-evento-inicio" required>
                <Input
                  id="edicao-evento-inicio"
                  type="date"
                  required
                  value={dataInicioEdicao}
                  onChange={(e) => setDataInicioEdicao(e.target.value)}
                />
              </Field>
              <Field label="Data de Término" htmlFor="edicao-evento-fim" required>
                <Input
                  id="edicao-evento-fim"
                  type="date"
                  required
                  value={dataFimEdicao}
                  onChange={(e) => setDataFimEdicao(e.target.value)}
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
