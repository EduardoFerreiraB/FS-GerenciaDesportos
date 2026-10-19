'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import EstadoCarga from '@/components/publico/EstadoCarga';
import { usarPublico } from '@/components/publico/usarPublico';
import JogosPublicos from '@/components/publico/JogosPublicos';
import ClassificacaoPublica from '@/components/publico/ClassificacaoPublica';
import ChaveamentoPublico from '@/components/publico/ChaveamentoPublico';
import ArtilhariaPublica from '@/components/publico/ArtilhariaPublica';
import EquipesPublicas from '@/components/publico/EquipesPublicas';
import { formatarPeriodo, ROTULO_ESTADO_EDICAO, ROTULO_FORMATO } from '@/components/publico/formatos';
import { servicoPublico } from '@/services/publico';
import type { EdicaoPublicaDetalhe, FormatoPublico } from '@/types/publico';

type Aba = 'jogos' | 'classificacao' | 'chaveamento' | 'artilharia' | 'equipes';

const ROTULO_ABA: Record<Aba, string> = {
  jogos: 'Jogos',
  classificacao: 'Classificação',
  chaveamento: 'Chaveamento',
  artilharia: 'Artilharia',
  equipes: 'Equipes',
};

function abasDoFormato(formato: FormatoPublico): Aba[] {
  const abas: Aba[] = ['jogos'];
  if (formato !== 'MATA_MATA') abas.push('classificacao');
  if (formato !== 'PONTOS_CORRIDOS') abas.push('chaveamento');
  abas.push('artilharia', 'equipes');
  return abas;
}

function AbaJogos({ id }: { id: number }) {
  const c = usarPublico(`publico/edicao/${id}/partidas`, () => servicoPublico.listarPartidas(id));
  return (
    <EstadoCarga carregando={c.carregando} erro={c.erro} temDados={c.dados !== undefined} onTentarNovamente={c.recarregar} recurso="os jogos">
      {c.dados && <JogosPublicos partidas={c.dados} />}
    </EstadoCarga>
  );
}

function AbaClassificacao({ id }: { id: number }) {
  const c = usarPublico(`publico/edicao/${id}/classificacao`, () => servicoPublico.obterClassificacao(id));
  return (
    <EstadoCarga carregando={c.carregando} erro={c.erro} temDados={c.dados !== undefined} onTentarNovamente={c.recarregar} recurso="a classificação">
      {c.dados && <ClassificacaoPublica classificacao={c.dados} />}
    </EstadoCarga>
  );
}

function AbaChaveamento({ id }: { id: number }) {
  const c = usarPublico(`publico/edicao/${id}/chaveamento`, () => servicoPublico.obterChaveamento(id));
  return (
    <EstadoCarga carregando={c.carregando} erro={c.erro} temDados={c.dados !== undefined} onTentarNovamente={c.recarregar} recurso="o chaveamento">
      {c.dados && <ChaveamentoPublico chaveamento={c.dados} />}
    </EstadoCarga>
  );
}

function AbaArtilharia({ id }: { id: number }) {
  const c = usarPublico(`publico/edicao/${id}/artilharia`, () => servicoPublico.obterArtilharia(id));
  return (
    <EstadoCarga carregando={c.carregando} erro={c.erro} temDados={c.dados !== undefined} onTentarNovamente={c.recarregar} recurso="a artilharia">
      {c.dados && <ArtilhariaPublica artilharia={c.dados} />}
    </EstadoCarga>
  );
}

function Cabecalho({ edicao }: { edicao: EdicaoPublicaDetalhe }) {
  return (
    <header className="mb-6">
      <Link
        href={`/publico/competicao/${edicao.competicao.slug}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 mb-3"
      >
        <ArrowLeft size={14} /> {edicao.competicao.nome}
      </Link>
      <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">
        {edicao.competicao.nome} · {edicao.identificacao}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        {[
          edicao.categoria,
          ROTULO_FORMATO[edicao.formato],
          formatarPeriodo(edicao.data_inicio, edicao.data_fim),
          ROTULO_ESTADO_EDICAO[edicao.estado],
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {edicao.edicao_evento && (
        <Link
          href={`/publico/evento/${edicao.edicao_evento.evento.slug}`}
          className="text-xs font-semibold text-blue-600 hover:underline"
        >
          Parte de {edicao.edicao_evento.evento.nome} · {edicao.edicao_evento.identificacao}
        </Link>
      )}
    </header>
  );
}

export default function EdicaoPublicaPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valido = Number.isInteger(id) && id > 0;
  const edicao = usarPublico(valido ? `publico/edicao/${id}` : null, () => servicoPublico.obterEdicao(id));
  const [aba, setAba] = useState<Aba>('jogos');

  if (!valido) {
    return (
      <PaginaPublica>
        <p className="py-16 text-center font-semibold text-slate-700 dark:text-slate-200">Não encontrado</p>
      </PaginaPublica>
    );
  }

  const abas = edicao.dados ? abasDoFormato(edicao.dados.formato) : [];

  return (
    <PaginaPublica>
      <EstadoCarga
        carregando={edicao.carregando}
        erro={edicao.erro}
        temDados={edicao.dados !== undefined}
        onTentarNovamente={edicao.recarregar}
        recurso="a edição"
      >
        {edicao.dados && (
          <>
            <Cabecalho edicao={edicao.dados} />
            <nav role="tablist" className="flex gap-2 overflow-x-auto mb-6 border-b border-slate-200 dark:border-slate-700">
              {abas.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="tab"
                  aria-selected={aba === a}
                  onClick={() => setAba(a)}
                  className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px cursor-pointer ${
                    aba === a
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {ROTULO_ABA[a]}
                </button>
              ))}
            </nav>
            {aba === 'jogos' && <AbaJogos id={id} />}
            {aba === 'classificacao' && <AbaClassificacao id={id} />}
            {aba === 'chaveamento' && <AbaChaveamento id={id} />}
            {aba === 'artilharia' && <AbaArtilharia id={id} />}
            {aba === 'equipes' && <EquipesPublicas equipes={edicao.dados.equipes} grupos={edicao.dados.grupos} />}
          </>
        )}
      </EstadoCarga>
    </PaginaPublica>
  );
}
