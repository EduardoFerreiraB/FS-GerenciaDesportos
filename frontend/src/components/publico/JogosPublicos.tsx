'use client';

import React from 'react';
import { CalendarDays } from 'lucide-react';
import type { PartidaPublica } from '@/types/publico';
import { CartaoPlacar, placarDePartidaPublica } from '@/components/competicoes/visual';
import { EmptyState } from '@/components/ui';
import { rotuloFase } from '@/lib/rotulos';

const FASES_NAO_ELIMINATORIAS = new Set(['FASE_DE_GRUPOS', 'PONTOS_CORRIDOS']);

export function ehFaseEliminatoria(fase: string | null | undefined): fase is string {
  return Boolean(fase && !FASES_NAO_ELIMINATORIAS.has(fase));
}

/**
 * Ordena partidas públicas pela numeração sequencial da API (`numero_jogo`),
 * que já garante grupos → Oitavas → Quartas → Semifinal → 3º lugar → Final.
 */
export function ordenarPartidasPublicas(partidas: PartidaPublica[]): PartidaPublica[] {
  return [...partidas].sort((a, b) => {
    if (a.numero_jogo !== b.numero_jogo) return a.numero_jogo - b.numero_jogo;
    return a.id_partida - b.id_partida;
  });
}

function contexto(partida: PartidaPublica): string {
  if (ehFaseEliminatoria(partida.fase)) {
    const jogo = partida.ordem_jogo === 2 ? ' · volta' : '';
    return `${rotuloFase(partida.fase)}${jogo}`;
  }
  const partes = [partida.nome_grupo, partida.rodada ? `Rodada ${partida.rodada}` : null];
  return partes.filter(Boolean).join(' · ');
}

/** Agrupa por rodada ou fase eliminatória, já na ordem cronológica da competição. */
function agrupar(partidas: PartidaPublica[]): { titulo: string; partidas: PartidaPublica[] }[] {
  const ordenadas = ordenarPartidasPublicas(partidas);
  const grupos = new Map<string, PartidaPublica[]>();
  for (const p of ordenadas) {
    const chave = ehFaseEliminatoria(p.fase)
      ? rotuloFase(p.fase)
      : p.rodada
        ? `Rodada ${p.rodada}`
        : p.fase
          ? rotuloFase(p.fase)
          : 'Jogos';
    grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
  }
  return [...grupos].map(([titulo, lista]) => ({ titulo, partidas: lista }));
}

function Grade({ partidas }: { partidas: PartidaPublica[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {partidas.map((p) => (
        <li key={p.id_partida} className="min-w-0">
          <CartaoPlacar
            partida={placarDePartidaPublica(p)}
            rotulo={contexto(p) || undefined}
            aoVivo={p.estado === 'EM_ANDAMENTO'}
            data-testid={`partida-publica-${p.id_partida}`}
            className="h-full"
          />
        </li>
      ))}
    </ul>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-3">
      <h3 className="text-sm font-semibold text-fg-muted">{titulo}</h3>
      {children}
    </section>
  );
}

/** Jogos em andamento chegam primeiro (a página ordena) e ficam numa seção própria no topo. */
export default function JogosPublicos({ partidas }: { partidas: PartidaPublica[] }) {
  if (partidas.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="A tabela de jogos ainda não foi gerada."
        description="Os jogos aparecem aqui assim que a organização montar a tabela."
      />
    );
  }

  const aoVivo = ordenarPartidasPublicas(partidas.filter((p) => p.estado === 'EM_ANDAMENTO'));
  const demais = partidas.filter((p) => p.estado !== 'EM_ANDAMENTO');

  return (
    <div className="space-y-8">
      {aoVivo.length > 0 ? (
        <Secao titulo="Acontecendo agora">
          <Grade partidas={aoVivo} />
        </Secao>
      ) : null}
      {agrupar(demais).map((g) => (
        <Secao key={g.titulo} titulo={g.titulo}>
          <Grade partidas={g.partidas} />
        </Secao>
      ))}
    </div>
  );
}
