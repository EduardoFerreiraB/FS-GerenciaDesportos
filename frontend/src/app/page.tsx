'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Search, Trophy } from 'lucide-react';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import AtualizadoHa from '@/components/publico/AtualizadoHa';
import EstadoCarga from '@/components/publico/EstadoCarga';
import LinhaViva from '@/components/publico/LinhaViva';
import SeloEstadoEdicaoPublica from '@/components/publico/SeloEstadoEdicaoPublica';
import { usarPublico } from '@/components/publico/usarPublico';
import { EmptyState, Input } from '@/components/ui';
import { formatarPeriodo } from '@/lib/formatos';
import { ROTULO_FORMATO } from '@/lib/rotulos';
import { servicoPublico } from '@/services/publico';
import type { CompeticaoPublica, EdicaoPublicaResumo, EstadoEdicaoPublico } from '@/types/publico';

function contem(texto: string, termo: string): boolean {
  return texto.toLocaleLowerCase('pt-BR').includes(termo.trim().toLocaleLowerCase('pt-BR'));
}

interface EdicaoDaVitrine {
  competicao: CompeticaoPublica;
  edicao: EdicaoPublicaResumo;
}

/** Seções sem edições ficam ocultas; canceladas não aparecem na vitrine. */
const SECOES: { estado: EstadoEdicaoPublico; titulo: string }[] = [
  { estado: 'EM_ANDAMENTO', titulo: 'Em andamento' },
  { estado: 'RASCUNHO', titulo: 'Próximas' },
  { estado: 'FINALIZADA', titulo: 'Encerradas' },
];

function CartaoEdicao({ item }: { item: EdicaoDaVitrine }) {
  const { competicao, edicao } = item;
  return (
    <li>
      <Link
        href={`/publico/competicao/${competicao.slug}`}
        className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs outline-none transition-colors duration-150 hover:border-line-strong focus-visible:ring-4 focus-visible:ring-focus"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-fg" title={competicao.nome}>
              {competicao.nome}
            </p>
            <p className="text-sm text-fg-muted">{competicao.modalidade}</p>
          </div>
          <SeloEstadoEdicaoPublica estado={edicao.estado} />
        </div>
        <p className="text-sm text-fg-muted">
          {edicao.identificacao}
          {edicao.categoria ? ` · ${edicao.categoria}` : ''} · {ROTULO_FORMATO[edicao.formato]}
        </p>
        {edicao.estado === 'EM_ANDAMENTO' ? <LinhaViva idEdicao={edicao.id_edicao_competicao} /> : null}
        <p className="mt-auto flex items-center justify-between gap-2 text-xs text-fg-subtle">
          <span>{formatarPeriodo(edicao.data_inicio, edicao.data_fim)}</span>
          <ChevronRight aria-hidden="true" className="size-4" />
        </p>
      </Link>
    </li>
  );
}

export default function PortalPublicoPage() {
  const [busca, setBusca] = useState('');
  const competicoes = usarPublico('publico/competicoes', servicoPublico.listarCompeticoes);
  const eventos = usarPublico('publico/eventos', servicoPublico.listarEventos);

  const competicoesFiltradas = (competicoes.dados ?? []).filter((c) => contem(c.nome, busca));
  const eventosFiltrados = (eventos.dados ?? []).filter((e) => contem(e.nome, busca));

  const itens: EdicaoDaVitrine[] = competicoesFiltradas.flatMap((competicao) =>
    competicao.edicoes.map((edicao) => ({ competicao, edicao })),
  );
  const porEstado = (estado: EstadoEdicaoPublico) => itens.filter((i) => i.edicao.estado === estado);
  const semResultado = itens.length === 0;

  const faixa = (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-fg">Competições</h1>
          <AtualizadoHa instante={competicoes.atualizadoEm} />
        </div>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">
          Tabelas, jogos, classificação, chaveamento e artilharia das competições publicadas.
        </p>
        <div className="relative mt-6 max-w-lg">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            type="search"
            aria-label="Buscar por nome"
            placeholder="Buscar competição ou evento..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-12 pl-10"
          />
        </div>
      </div>
    </section>
  );

  return (
    <PaginaPublica faixa={faixa}>
      <div className="space-y-12">
        <EstadoCarga
          carregando={competicoes.carregando}
          erro={competicoes.erro}
          temDados={competicoes.dados !== undefined}
          onTentarNovamente={competicoes.recarregar}
          recurso="as competições"
        >
          {semResultado ? (
            <EmptyState
              icon={<Trophy />}
              title={busca ? 'Nenhuma competição corresponde à busca.' : 'Nenhuma competição publicada no momento.'}
            />
          ) : (
            SECOES.map(({ estado, titulo }) => {
              const lista = porEstado(estado);
              if (lista.length === 0) return null;
              return (
                <section key={estado} aria-labelledby={`secao-${estado}`} data-testid={`secao-${estado}`}>
                  <h2 id={`secao-${estado}`} className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-fg">
                    {titulo}
                    <span className="text-sm font-normal tabular-nums text-fg-subtle">{lista.length}</span>
                  </h2>
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {lista.map((item) => (
                      <CartaoEdicao key={item.edicao.id_edicao_competicao} item={item} />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </EstadoCarga>

        <section aria-labelledby="secao-eventos">
          <h2 id="secao-eventos" className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-fg">
            <CalendarDays aria-hidden="true" className="size-5 text-fg-subtle" /> Eventos
          </h2>
          <EstadoCarga
            carregando={eventos.carregando}
            erro={eventos.erro}
            temDados={eventos.dados !== undefined}
            onTentarNovamente={eventos.recarregar}
            recurso="os eventos"
          >
            {eventosFiltrados.length === 0 ? (
              <EmptyState
                icon={<CalendarDays />}
                title={busca ? 'Nenhum evento corresponde à busca.' : 'Nenhum evento com competição publicada no momento.'}
              />
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {eventosFiltrados.map((evento) => (
                  <li key={evento.slug}>
                    <Link
                      href={`/publico/evento/${evento.slug}`}
                      className="block h-full rounded-xl border border-line bg-surface p-5 shadow-xs outline-none transition-colors duration-150 hover:border-line-strong focus-visible:ring-4 focus-visible:ring-focus"
                    >
                      <p className="truncate text-base font-semibold text-fg" title={evento.nome}>
                        {evento.nome}
                      </p>
                      {evento.descricao && (
                        <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{evento.descricao}</p>
                      )}
                      <p className="mt-3 text-xs text-fg-subtle">
                        {evento.edicoes[0].identificacao} ·{' '}
                        {formatarPeriodo(evento.edicoes[0].data_inicio, evento.edicoes[0].data_fim)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </EstadoCarga>
        </section>
      </div>
    </PaginaPublica>
  );
}
