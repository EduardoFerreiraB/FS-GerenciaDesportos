'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import EstadoCarga from '@/components/publico/EstadoCarga';
import ListaEdicoes from '@/components/publico/ListaEdicoes';
import { usarPublico } from '@/components/publico/usarPublico';
import { servicoPublico } from '@/services/publico';

export default function CompeticaoPublicaPage() {
  const { slug } = useParams<{ slug: string }>();
  const competicao = usarPublico(`publico/competicao/${slug}`, () => servicoPublico.obterCompeticao(slug));

  return (
    <PaginaPublica>
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 mb-6">
        <ArrowLeft size={14} /> Todas as competições
      </Link>
      <EstadoCarga
        carregando={competicao.carregando}
        erro={competicao.erro}
        temDados={competicao.dados !== undefined}
        onTentarNovamente={competicao.recarregar}
        recurso="a competição"
      >
        {competicao.dados && (
          <>
            <header className="mb-6">
              <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{competicao.dados.nome}</h1>
              <p className="text-xs text-slate-400 uppercase font-semibold">{competicao.dados.modalidade}</p>
              {competicao.dados.descricao && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{competicao.dados.descricao}</p>
              )}
            </header>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide mb-3">
              Edições
            </h2>
            <ListaEdicoes edicoes={competicao.dados.edicoes} />
          </>
        )}
      </EstadoCarga>
    </PaginaPublica>
  );
}
