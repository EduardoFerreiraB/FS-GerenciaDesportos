'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Search, Trophy } from 'lucide-react';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import EstadoCarga from '@/components/publico/EstadoCarga';
import { usarPublico } from '@/components/publico/usarPublico';
import { formatarPeriodo } from '@/lib/formatos';
import { ROTULO_ESTADO_EDICAO, ROTULO_FORMATO } from '@/lib/rotulos';
import { servicoPublico } from '@/services/publico';

function contem(texto: string, termo: string): boolean {
  return texto.toLocaleLowerCase('pt-BR').includes(termo.trim().toLocaleLowerCase('pt-BR'));
}

export default function PortalPublicoPage() {
  const [busca, setBusca] = useState('');
  const competicoes = usarPublico('publico/competicoes', servicoPublico.listarCompeticoes);
  const eventos = usarPublico('publico/eventos', servicoPublico.listarEventos);

  const competicoesFiltradas = (competicoes.dados ?? []).filter((c) => contem(c.nome, busca));
  const eventosFiltrados = (eventos.dados ?? []).filter((e) => contem(e.nome, busca));

  return (
    <PaginaPublica>
      <section className="text-center space-y-3 mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
          Acompanhe os campeonatos
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm">
          Tabelas, jogos, classificação, chaveamento e artilharia das competições publicadas.
        </p>
      </section>

      <div className="max-w-md mx-auto mb-10 relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="Buscar por nome"
          placeholder="Buscar competição ou evento..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-700 dark:text-slate-200"
        />
      </div>

      <section className="mb-12">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Trophy size={18} className="text-blue-600" /> Competições
        </h2>
        <EstadoCarga
          carregando={competicoes.carregando}
          erro={competicoes.erro}
          temDados={competicoes.dados !== undefined}
          onTentarNovamente={competicoes.recarregar}
          recurso="as competições"
        >
          {competicoesFiltradas.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
              {busca ? 'Nenhuma competição corresponde à busca.' : 'Nenhuma competição publicada no momento.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {competicoesFiltradas.map((competicao) => (
                <article
                  key={competicao.slug}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-5 flex flex-col gap-3"
                >
                  <div>
                    <Link
                      href={`/publico/competicao/${competicao.slug}`}
                      className="text-lg font-bold text-slate-800 dark:text-slate-100 hover:text-blue-600"
                    >
                      {competicao.nome}
                    </Link>
                    <p className="text-xs text-slate-400 uppercase font-semibold">{competicao.modalidade}</p>
                  </div>
                  <ul className="space-y-2">
                    {competicao.edicoes.slice(0, 3).map((edicao) => (
                      <li key={edicao.id_edicao_competicao}>
                        <Link
                          href={`/publico/edicao/${edicao.id_edicao_competicao}`}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-700 px-3 py-2 text-sm hover:border-blue-400"
                        >
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {edicao.identificacao}
                            {edicao.categoria ? ` · ${edicao.categoria}` : ''}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            {ROTULO_FORMATO[edicao.formato]} · {ROTULO_ESTADO_EDICAO[edicao.estado]}
                            <ChevronRight size={14} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {competicao.edicoes.length > 3 && (
                    <Link
                      href={`/publico/competicao/${competicao.slug}`}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Ver todas as {competicao.edicoes.length} edições
                    </Link>
                  )}
                </article>
              ))}
            </div>
          )}
        </EstadoCarga>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-blue-600" /> Eventos
        </h2>
        <EstadoCarga
          carregando={eventos.carregando}
          erro={eventos.erro}
          temDados={eventos.dados !== undefined}
          onTentarNovamente={eventos.recarregar}
          recurso="os eventos"
        >
          {eventosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
              {busca ? 'Nenhum evento corresponde à busca.' : 'Nenhum evento com competição publicada no momento.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {eventosFiltrados.map((evento) => (
                <Link
                  key={evento.slug}
                  href={`/publico/evento/${evento.slug}`}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 p-5 hover:border-blue-400 block"
                >
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{evento.nome}</p>
                  {evento.descricao && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{evento.descricao}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-3">
                    {evento.edicoes[0].identificacao} · {formatarPeriodo(evento.edicoes[0].data_inicio, evento.edicoes[0].data_fim)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </EstadoCarga>
      </section>
    </PaginaPublica>
  );
}
