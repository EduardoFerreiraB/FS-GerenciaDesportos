import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { EdicaoPublicaResumo } from '@/types/publico';
import { formatarPeriodo } from '@/lib/formatos';
import { ROTULO_FORMATO } from '@/lib/rotulos';
import { StatusBadge } from '@/components/ui';

interface ListaEdicoesProps {
  edicoes: (EdicaoPublicaResumo & { competicao?: { nome: string } })[];
}

export default function ListaEdicoes({ edicoes }: ListaEdicoesProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {edicoes.map((edicao) => (
        <li key={edicao.id_edicao_competicao}>
          <Link
            href={`/publico/edicao/${edicao.id_edicao_competicao}`}
            className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs outline-none transition-colors duration-150 hover:border-line-strong focus-visible:ring-4 focus-visible:ring-focus"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-fg">
                {edicao.competicao ? `${edicao.competicao.nome} · ` : ''}
                {edicao.identificacao}
                {edicao.categoria ? ` · ${edicao.categoria}` : ''}
              </p>
              <StatusBadge tipo="edicao" valor={edicao.estado} />
            </div>
            <p className="flex items-center justify-between gap-2 text-sm text-fg-muted">
              <span>
                {formatarPeriodo(edicao.data_inicio, edicao.data_fim)} · {ROTULO_FORMATO[edicao.formato]}
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
