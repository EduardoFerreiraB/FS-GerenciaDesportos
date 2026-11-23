'use client';

import React from 'react';
import { Users } from 'lucide-react';
import type { EquipePublica, GrupoPublico } from '@/types/publico';
import { Badge, EmptyState } from '@/components/ui';

function sigla(equipe: EquipePublica): string {
  if (equipe.sigla) return equipe.sigla.slice(0, 4).toUpperCase();
  return equipe.nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

function CartaoEquipe({ equipe, grupo }: { equipe: EquipePublica; grupo?: string }) {
  const total = equipe.integrantes.length;
  return (
    <section
      aria-labelledby={`equipe-publica-${equipe.id_equipe}`}
      className="flex flex-col rounded-xl border border-line bg-surface shadow-xs"
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary"
        >
          {sigla(equipe) || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`equipe-publica-${equipe.id_equipe}`} className="truncate text-base font-semibold text-fg" title={equipe.nome}>
            {equipe.nome}
          </h3>
          <p className="text-xs text-fg-subtle">
            {total === 1 ? '1 atleta' : `${total} atletas`}
          </p>
        </div>
        {grupo ? <Badge tone="neutral">{grupo}</Badge> : null}
      </header>
      {total === 0 ? (
        <p className="px-4 py-4 text-sm text-fg-subtle">Elenco não divulgado.</p>
      ) : (
        <ul className="divide-y divide-line">
          {equipe.integrantes.map((i, indice) => (
            <li key={`${i.nome_esportivo}-${indice}`} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-fg-subtle">
                {i.numero_camisa ?? '—'}
              </span>
              <span className="min-w-0 flex-1 truncate text-fg" title={i.nome_esportivo}>
                {i.nome_esportivo}
              </span>
              {i.posicao ? <span className="shrink-0 text-xs text-fg-muted">{i.posicao}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function EquipesPublicas({ equipes, grupos }: { equipes: EquipePublica[]; grupos: GrupoPublico[] }) {
  if (equipes.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="Nenhuma equipe inscrita até agora."
        description="As equipes aparecem aqui assim que forem confirmadas pela organização."
      />
    );
  }
  const nomeGrupo = new Map(grupos.map((g) => [g.id_grupo, g.nome]));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {equipes.map((equipe) => (
        <CartaoEquipe
          key={equipe.id_equipe}
          equipe={equipe}
          grupo={equipe.id_grupo !== null ? nomeGrupo.get(equipe.id_grupo) : undefined}
        />
      ))}
    </div>
  );
}
