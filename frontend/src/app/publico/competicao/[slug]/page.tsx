'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import EstadoCarga from '@/components/publico/EstadoCarga';
import ListaEdicoes from '@/components/publico/ListaEdicoes';
import { usarPublico } from '@/components/publico/usarPublico';
import { PageHeader } from '@/components/ui';
import { servicoPublico } from '@/services/publico';

export default function CompeticaoPublicaPage() {
  const { slug } = useParams<{ slug: string }>();
  const competicao = usarPublico(`publico/competicao/${slug}`, () => servicoPublico.obterCompeticao(slug));

  return (
    <PaginaPublica>
      <EstadoCarga
        carregando={competicao.carregando}
        erro={competicao.erro}
        temDados={competicao.dados !== undefined}
        onTentarNovamente={competicao.recarregar}
        recurso="a competição"
      >
        {competicao.dados && (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Competições', href: '/' }, { label: competicao.dados.nome }]}
              title={competicao.dados.nome}
              description={[competicao.dados.modalidade, competicao.dados.descricao].filter(Boolean).join(' · ')}
            />
            <h2 className="mb-3 text-base font-semibold text-fg">Edições</h2>
            <ListaEdicoes edicoes={competicao.dados.edicoes} />
          </>
        )}
      </EstadoCarga>
    </PaginaPublica>
  );
}
