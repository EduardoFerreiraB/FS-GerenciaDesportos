'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import EstadoCarga from '@/components/publico/EstadoCarga';
import ListaEdicoes from '@/components/publico/ListaEdicoes';
import { usarPublico } from '@/components/publico/usarPublico';
import { formatarPeriodo } from '@/components/publico/formatos';
import { servicoPublico } from '@/services/publico';

export default function EventoPublicoPage() {
  const { slug } = useParams<{ slug: string }>();
  const evento = usarPublico(`publico/evento/${slug}`, () => servicoPublico.obterEvento(slug));
  const [idSelecionado, setIdSelecionado] = useState<number | null>(null);

  // A API só devolve edições de evento com alguma disputa publicada.
  const edicoes = evento.dados?.edicoes ?? [];
  const selecionada = edicoes.find((e) => e.id_edicao_evento === idSelecionado) ?? edicoes[0];

  return (
    <PaginaPublica>
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 mb-6">
        <ArrowLeft size={14} /> Início
      </Link>
      <EstadoCarga
        carregando={evento.carregando}
        erro={evento.erro}
        temDados={evento.dados !== undefined}
        onTentarNovamente={evento.recarregar}
        recurso="o evento"
      >
        {evento.dados && selecionada && (
          <>
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{evento.dados.nome}</h1>
                {evento.dados.descricao && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{evento.dados.descricao}</p>
                )}
              </div>
              {edicoes.length > 1 && (
                <label className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  Edição
                  <select
                    value={selecionada.id_edicao_evento}
                    onChange={(e) => setIdSelecionado(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                  >
                    {edicoes.map((e) => (
                      <option key={e.id_edicao_evento} value={e.id_edicao_evento}>
                        {e.identificacao}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </header>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {selecionada.identificacao} · {formatarPeriodo(selecionada.data_inicio, selecionada.data_fim)}
            </p>
            <ListaEdicoes edicoes={selecionada.competicoes} />
          </>
        )}
      </EstadoCarga>
    </PaginaPublica>
  );
}
