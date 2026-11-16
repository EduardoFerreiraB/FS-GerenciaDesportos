'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import EstadoCarga from '@/components/publico/EstadoCarga';
import ListaEdicoes from '@/components/publico/ListaEdicoes';
import { usarPublico } from '@/components/publico/usarPublico';
import { PageHeader, Select } from '@/components/ui';
import { formatarPeriodo } from '@/lib/formatos';
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
      <EstadoCarga
        carregando={evento.carregando}
        erro={evento.erro}
        temDados={evento.dados !== undefined}
        onTentarNovamente={evento.recarregar}
        recurso="o evento"
      >
        {evento.dados && selecionada && (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Competições', href: '/' }, { label: evento.dados.nome }]}
              title={evento.dados.nome}
              description={evento.dados.descricao}
              actions={
                edicoes.length > 1 ? (
                  <label className="flex items-center gap-2 text-sm text-fg-muted">
                    Edição
                    <Select
                      value={selecionada.id_edicao_evento}
                      onChange={(e) => setIdSelecionado(Number(e.target.value))}
                    >
                      {edicoes.map((e) => (
                        <option key={e.id_edicao_evento} value={e.id_edicao_evento}>
                          {e.identificacao}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : undefined
              }
            />
            <p className="mb-4 text-sm text-fg-muted">
              {selecionada.identificacao} · {formatarPeriodo(selecionada.data_inicio, selecionada.data_fim)}
            </p>
            <ListaEdicoes edicoes={selecionada.competicoes} />
          </>
        )}
      </EstadoCarga>
    </PaginaPublica>
  );
}
