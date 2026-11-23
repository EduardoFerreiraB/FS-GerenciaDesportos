'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface EventoResumoSelo {
  id_evento: number;
  nome: string;
  identificacao_edicao?: string | null;
}

export interface SeloEventoProps {
  evento: EventoResumoSelo | null | undefined;
  className?: string;
}

/**
 * Selo interativo exibido no cabeçalho de competições vinculadas a um evento.
 * Mantém link direto para a página do evento no painel administrativo.
 */
export function SeloEvento({ evento, className }: SeloEventoProps) {
  if (!evento) return null;

  return (
    <Link
      href={`/dashboard/eventos/${evento.id_evento}`}
      data-testid="selo-evento"
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
        className,
      )}
    >
      <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {evento.nome}
        {evento.identificacao_edicao ? ` · ${evento.identificacao_edicao}` : ''}
      </span>
    </Link>
  );
}

export default SeloEvento;
