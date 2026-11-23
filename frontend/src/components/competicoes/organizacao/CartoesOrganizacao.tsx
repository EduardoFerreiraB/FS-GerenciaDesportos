'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import type { CompeticaoDetalhe, EventoDetalhe } from '@/types/competicoes';
import { formatarPeriodo } from '@/lib/formatos';
import { Badge, Button, Card, Skeleton, StatusBadge } from '@/components/ui';

const classeCartao =
  'flex h-full flex-col transition-colors duration-150 group-hover:border-line-strong';

function contarEdicoes(n: number) {
  return `${n} ${n === 1 ? 'edição' : 'edições'}`;
}

/** Cartão da lista de competições: nome, modalidade, nº de edições e a edição mais recente. */
export function CartaoCompeticao({
  competicao,
  modalidade,
}: {
  competicao: CompeticaoDetalhe;
  modalidade: string;
}) {
  const recente = competicao.edicoes?.[competicao.edicoes.length - 1];
  const totalEdicoes = competicao.edicoes?.length ?? 0;

  return (
    <Link href={`/dashboard/competicoes/${competicao.id_competicao}`} className="group block h-full rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-focus">
      <Card className={classeCartao}>
        <div className="flex-1 space-y-2 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{modalidade}</Badge>
            {competicao.arquivado ? <Badge>Arquivada</Badge> : null}
          </div>
          <h3
            className="truncate text-base font-semibold text-fg transition-colors duration-150 group-hover:text-primary"
            title={competicao.nome}
          >
            {competicao.nome}
          </h3>
          {competicao.descricao ? (
            <p className="line-clamp-2 text-sm text-fg-muted" title={competicao.descricao}>
              {competicao.descricao}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-line px-5 py-4 text-sm">
          <p className="flex items-center gap-1.5 text-fg-muted">
            <Layers className="size-4 text-fg-subtle" aria-hidden="true" />
            {contarEdicoes(totalEdicoes)}
          </p>
          {recente ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-fg" title={recente.identificacao}>
                  {recente.identificacao}
                </span>
                <StatusBadge tipo="edicao" valor={recente.estado} />
              </div>
              <p className="flex items-center gap-1.5 text-fg-muted tabular-nums">
                <CalendarDays className="size-4 text-fg-subtle" aria-hidden="true" />
                {formatarPeriodo(recente.data_inicio, recente.data_fim)}
              </p>
            </>
          ) : (
            <p className="text-fg-subtle">Nenhuma edição cadastrada</p>
          )}
        </div>
      </Card>
    </Link>
  );
}

/** Cartão da lista de eventos, no mesmo padrão das competições. */
export function CartaoEvento({ evento }: { evento: EventoDetalhe }) {
  const recente = evento.edicoes?.[evento.edicoes.length - 1];
  const totalEdicoes = evento.edicoes?.length ?? 0;

  return (
    <Link href={`/dashboard/eventos/${evento.id_evento}`} className="group block h-full rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-focus">
      <Card className={classeCartao}>
        <div className="flex-1 space-y-2 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{contarEdicoes(totalEdicoes)}</Badge>
            {evento.arquivado ? <Badge>Arquivado</Badge> : null}
          </div>
          <h3
            className="truncate text-base font-semibold text-fg transition-colors duration-150 group-hover:text-primary"
            title={evento.nome}
          >
            {evento.nome}
          </h3>
          {evento.descricao ? (
            <p className="line-clamp-2 text-sm text-fg-muted" title={evento.descricao}>
              {evento.descricao}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-line px-5 py-4 text-sm">
          {recente ? (
            <>
              <p className="flex items-center justify-between gap-2">
                <span className="text-fg-muted">Última edição</span>
                <span className="min-w-0 truncate font-medium text-fg" title={recente.identificacao}>
                  {recente.identificacao}
                </span>
              </p>
              <p className="flex items-center gap-1.5 text-fg-muted tabular-nums">
                <CalendarDays className="size-4 text-fg-subtle" aria-hidden="true" />
                {formatarPeriodo(recente.data_inicio, recente.data_fim)}
              </p>
            </>
          ) : (
            <p className="text-fg-subtle">Sem edições registradas</p>
          )}
        </div>
      </Card>
    </Link>
  );
}

/** Esqueleto da grade de cartões. */
export function GradeCarregando({ quantidade = 6 }: { quantidade?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: quantidade }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Paginação simples (Anterior / Próxima) para listas paginadas pela API. */
export function Paginacao({
  pagina,
  total,
  tamanho,
  rotulo,
  onMudar,
}: {
  pagina: number;
  total: number;
  tamanho: number;
  rotulo: (n: number) => string;
  onMudar: (pagina: number) => void;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted">
      <p className="tabular-nums">
        {total} {rotulo(total)}
      </p>
      {totalPaginas > 1 ? (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ChevronLeft className="size-4" aria-hidden="true" />}
            disabled={pagina <= 1}
            onClick={() => onMudar(pagina - 1)}
          >
            Anterior
          </Button>
          <span className="tabular-nums">
            Página {pagina} de {totalPaginas}
          </span>
          <Button
            variant="secondary"
            size="sm"
            rightIcon={<ChevronRight className="size-4" aria-hidden="true" />}
            disabled={pagina >= totalPaginas}
            onClick={() => onMudar(pagina + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
