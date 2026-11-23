'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, CalendarRange, Goal, ListOrdered, Network, SearchX, Shirt } from 'lucide-react';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import AtualizadoHa from '@/components/publico/AtualizadoHa';
import EstadoCarga from '@/components/publico/EstadoCarga';
import { usarPublico } from '@/components/publico/usarPublico';
import JogosPublicos from '@/components/publico/JogosPublicos';
import ClassificacaoPublica from '@/components/publico/ClassificacaoPublica';
import ChaveamentoPublico from '@/components/publico/ChaveamentoPublico';
import ArtilhariaPublica from '@/components/publico/ArtilhariaPublica';
import EquipesPublicas from '@/components/publico/EquipesPublicas';
import SeloEstadoEdicaoPublica from '@/components/publico/SeloEstadoEdicaoPublica';
import { Button, EmptyState, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { formatarPeriodo } from '@/lib/formatos';
import { ROTULO_FORMATO } from '@/lib/rotulos';
import { servicoPublico } from '@/services/publico';
import type { EdicaoPublicaDetalhe, FormatoPublico, PartidaPublica } from '@/types/publico';

type Aba = 'jogos' | 'classificacao' | 'chaveamento' | 'artilharia' | 'equipes';

const ABAS: Record<Aba, { rotulo: string; icone: React.ReactNode }> = {
  jogos: { rotulo: 'Jogos', icone: <CalendarDays className="size-4" /> },
  classificacao: { rotulo: 'Classificação', icone: <ListOrdered className="size-4" /> },
  chaveamento: { rotulo: 'Chaveamento', icone: <Network className="size-4" /> },
  artilharia: { rotulo: 'Artilharia', icone: <Goal className="size-4" /> },
  equipes: { rotulo: 'Equipes', icone: <Shirt className="size-4" /> },
};

function abasDoFormato(formato: FormatoPublico): Aba[] {
  const abas: Aba[] = ['jogos'];
  if (formato !== 'MATA_MATA') abas.push('classificacao');
  if (formato !== 'PONTOS_CORRIDOS') abas.push('chaveamento');
  abas.push('artilharia', 'equipes');
  return abas;
}

/** Jogos em andamento sobem para o topo; o resto mantém a ordem da API. */
function aoVivoPrimeiro(partidas: PartidaPublica[]): PartidaPublica[] {
  const aoVivo = partidas.filter((p) => p.estado === 'EM_ANDAMENTO');
  if (aoVivo.length === 0) return partidas;
  return [...aoVivo, ...partidas.filter((p) => p.estado !== 'EM_ANDAMENTO')];
}

function Atualizacao({ instante }: { instante: number | null }) {
  return (
    <div className="mb-4 flex min-h-4 justify-end">
      <AtualizadoHa instante={instante} />
    </div>
  );
}

function AbaJogos({ id }: { id: number }) {
  const c = usarPublico(`publico/edicao/${id}/partidas`, () => servicoPublico.listarPartidas(id));
  return (
    <EstadoCarga carregando={c.carregando} erro={c.erro} temDados={c.dados !== undefined} onTentarNovamente={c.recarregar} recurso="os jogos">
      <Atualizacao instante={c.atualizadoEm} />
      {c.dados && <JogosPublicos partidas={aoVivoPrimeiro(c.dados)} />}
    </EstadoCarga>
  );
}

function AbaClassificacao({ id }: { id: number }) {
  const c = usarPublico(`publico/edicao/${id}/classificacao`, () => servicoPublico.obterClassificacao(id));
  return (
    <EstadoCarga carregando={c.carregando} erro={c.erro} temDados={c.dados !== undefined} onTentarNovamente={c.recarregar} recurso="a classificação">
      <Atualizacao instante={c.atualizadoEm} />
      {c.dados && <ClassificacaoPublica classificacao={c.dados} />}
    </EstadoCarga>
  );
}

function AbaChaveamento({ id }: { id: number }) {
  const c = usarPublico(`publico/edicao/${id}/chaveamento`, () => servicoPublico.obterChaveamento(id));
  return (
    <EstadoCarga carregando={c.carregando} erro={c.erro} temDados={c.dados !== undefined} onTentarNovamente={c.recarregar} recurso="o chaveamento">
      <Atualizacao instante={c.atualizadoEm} />
      {c.dados && <ChaveamentoPublico chaveamento={c.dados} />}
    </EstadoCarga>
  );
}

function AbaArtilharia({ id }: { id: number }) {
  const c = usarPublico(`publico/edicao/${id}/artilharia`, () => servicoPublico.obterArtilharia(id));
  return (
    <EstadoCarga carregando={c.carregando} erro={c.erro} temDados={c.dados !== undefined} onTentarNovamente={c.recarregar} recurso="a artilharia">
      <Atualizacao instante={c.atualizadoEm} />
      {c.dados && <ArtilhariaPublica artilharia={c.dados} />}
    </EstadoCarga>
  );
}

function Cabecalho({ edicao }: { edicao: EdicaoPublicaDetalhe }) {
  const { competicao } = edicao;
  return (
    <PageHeader
      breadcrumbs={[
        { label: 'Competições', href: '/' },
        { label: competicao.nome, href: `/publico/competicao/${competicao.slug}` },
        { label: edicao.identificacao },
      ]}
      title={<span className="block break-words">{competicao.nome}</span>}
      description={
        <span className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-fg">
              {edicao.identificacao}
              {edicao.categoria ? ` · ${edicao.categoria}` : ''}
            </span>
            <span>{ROTULO_FORMATO[edicao.formato]}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange aria-hidden="true" className="size-4 text-fg-subtle" />
              {formatarPeriodo(edicao.data_inicio, edicao.data_fim)}
            </span>
            <SeloEstadoEdicaoPublica estado={edicao.estado} />
          </span>
          {edicao.edicao_evento ? (
            <Link
              href={`/publico/evento/${edicao.edicao_evento.evento.slug}`}
              className="w-fit rounded text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-focus"
            >
              Parte de {edicao.edicao_evento.evento.nome} · {edicao.edicao_evento.identificacao}
            </Link>
          ) : null}
        </span>
      }
    />
  );
}

function NaoEncontrado() {
  return (
    <div role="status">
      <EmptyState
        icon={<SearchX />}
        title="Não encontrado"
        description="Este conteúdo não existe ou não está publicado."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Competições</Link>
          </Button>
        }
      />
    </div>
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
        <NaoEncontrado />
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
            <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
              <TabsList aria-label="Seções da edição" className="-mx-4 px-4 sm:mx-0 sm:px-0">
                {abas.map((a) => (
                  <TabsTrigger key={a} value={a} icon={ABAS[a].icone} data-testid={`aba-publica-${a}`}>
                    {ABAS[a].rotulo}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="jogos">
                <AbaJogos id={id} />
              </TabsContent>
              <TabsContent value="classificacao">
                <AbaClassificacao id={id} />
              </TabsContent>
              <TabsContent value="chaveamento">
                <AbaChaveamento id={id} />
              </TabsContent>
              <TabsContent value="artilharia">
                <AbaArtilharia id={id} />
              </TabsContent>
              <TabsContent value="equipes">
                <EquipesPublicas equipes={edicao.dados.equipes} grupos={edicao.dados.grupos} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </EstadoCarga>
    </PaginaPublica>
  );
}
