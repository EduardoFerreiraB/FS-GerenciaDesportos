import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { EdicaoPublicaResumo } from '@/types/publico';
import { formatarPeriodo } from '@/lib/formatos';
import { ROTULO_ESTADO_EDICAO, ROTULO_FORMATO } from '@/lib/rotulos';

interface ListaEdicoesProps {
  edicoes: (EdicaoPublicaResumo & { competicao?: { nome: string } })[];
}

export default function ListaEdicoes({ edicoes }: ListaEdicoesProps) {
  return (
    <ul className="space-y-3">
      {edicoes.map((edicao) => (
        <li key={edicao.id_edicao_competicao}>
          <Link
            href={`/publico/edicao/${edicao.id_edicao_competicao}`}
            className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 px-5 py-4 hover:border-blue-400"
          >
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {edicao.competicao ? `${edicao.competicao.nome} · ` : ''}
                {edicao.identificacao}
                {edicao.categoria ? ` · ${edicao.categoria}` : ''}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatarPeriodo(edicao.data_inicio, edicao.data_fim)} · {ROTULO_FORMATO[edicao.formato]}
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              {ROTULO_ESTADO_EDICAO[edicao.estado]}
              <ChevronRight size={16} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
