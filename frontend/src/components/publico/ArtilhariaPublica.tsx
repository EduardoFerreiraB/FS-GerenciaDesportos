'use client';

import React from 'react';
import { Goal, Trophy } from 'lucide-react';
import type { ArtilhariaPublica as Artilharia, ArtilheiroPublico } from '@/types/publico';
import { Badge, EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';

function chave(a: ArtilheiroPublico): string {
  return `${a.id_equipe}-${a.posicao}-${a.nome_esportivo}`;
}

function Gols({ artilheiro, grande }: { artilheiro: ArtilheiroPublico; grande?: boolean }) {
  return (
    <span className="shrink-0 text-right">
      <span className={cn('font-semibold tabular-nums text-fg', grande ? 'text-3xl' : 'text-lg')}>
        {artilheiro.gols}
      </span>
      <span className="ml-1 text-xs text-fg-subtle">{artilheiro.gols === 1 ? 'gol' : 'gols'}</span>
      {artilheiro.gols_em_andamento > 0 ? (
        <span className="block text-xs text-warning">{artilheiro.gols_em_andamento} em andamento</span>
      ) : null}
    </span>
  );
}

function Identificacao({ artilheiro }: { artilheiro: ArtilheiroPublico }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-semibold text-fg" title={artilheiro.nome_esportivo}>
        {artilheiro.nome_esportivo}
        {artilheiro.numero_camisa !== null ? (
          <span className="font-normal tabular-nums text-fg-subtle"> · {artilheiro.numero_camisa}</span>
        ) : null}
      </span>
      <span className="block truncate text-xs text-fg-muted" title={artilheiro.nome_equipe}>
        {artilheiro.nome_equipe}
      </span>
    </span>
  );
}

/** Cartões do pódio (até a 3ª posição, empates incluídos). */
function Podio({ artilheiros }: { artilheiros: ArtilheiroPublico[] }) {
  return (
    <ol aria-label="Destaques da artilharia" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {artilheiros.map((a) => {
        const lider = a.posicao === 1;
        return (
          <li
            key={chave(a)}
            className={cn(
              'flex flex-col gap-3 rounded-xl border bg-surface p-4 shadow-xs',
              lider ? 'border-primary/40' : 'border-line',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold tabular-nums',
                  lider ? 'bg-primary-solid text-on-primary' : 'bg-primary-soft text-primary',
                )}
              >
                {lider ? <Trophy aria-hidden="true" className="size-3.5" /> : null}
                {a.posicao}º
              </span>
              <Gols artilheiro={a} grande />
            </div>
            <Identificacao artilheiro={a} />
          </li>
        );
      })}
    </ol>
  );
}

export default function ArtilhariaPublica({ artilharia }: { artilharia: Artilharia }) {
  if (artilharia.artilheiros.length === 0) {
    return (
      <EmptyState
        icon={<Goal />}
        title="Nenhum gol com autoria registrada até agora."
        description="O ranking aparece assim que os gols forem lançados nas súmulas."
      />
    );
  }

  const podio = artilharia.artilheiros.filter((a) => a.posicao <= 3);
  const demais = artilharia.artilheiros.filter((a) => a.posicao > 3);

  return (
    <div className="space-y-4">
      {artilharia.possui_jogos_em_andamento ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Badge tone="warning">Parcial</Badge>
          Inclui gols de jogos em andamento, sinalizados abaixo do total.
        </p>
      ) : null}
      {podio.length > 0 ? <Podio artilheiros={podio} /> : null}
      {demais.length > 0 ? (
        <ol
          aria-label="Demais artilheiros"
          className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs"
        >
          {demais.map((a) => (
            <li key={chave(a)} className="flex items-center gap-4 px-4 py-3 text-sm">
              <span className="w-8 shrink-0 text-center font-semibold tabular-nums text-fg-subtle">{a.posicao}º</span>
              <Identificacao artilheiro={a} />
              <Gols artilheiro={a} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
