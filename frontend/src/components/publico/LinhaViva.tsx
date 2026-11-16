'use client';

import React from 'react';
import type { PartidaPublica } from '@/types/publico';
import { SinalAoVivo } from '@/components/competicoes/visual';
import { rotuloFase } from '@/lib/rotulos';
import { usarPublico } from './usarPublico';
import { servicoPublico } from '@/services/publico';

const ENCERRADA = ['FINALIZADA', 'CANCELADA'];

/** "Rodada 3 de 7" ou "Semifinal"; null quando não há o que dizer. */
export function descreverAndamento(partidas: PartidaPublica[]): string | null {
  if (partidas.length === 0) return null;
  const abertas = partidas.filter((p) => !ENCERRADA.includes(p.estado));
  const ref = abertas[0] ?? partidas[partidas.length - 1];
  const rodadas = partidas.map((p) => p.rodada).filter((r): r is number => r !== null);
  if (ref.fase && rodadas.length === 0) return rotuloFase(ref.fase);
  if (rodadas.length === 0) return null;
  const total = Math.max(...rodadas);
  const atual = abertas.length
    ? Math.min(...abertas.map((p) => p.rodada).filter((r): r is number => r !== null))
    : total;
  if (!Number.isFinite(atual)) return ref.fase ? rotuloFase(ref.fase) : null;
  return `Rodada ${atual} de ${total}`;
}

/** Falha ao buscar os jogos oculta a linha, sem erro no cartão. */
export default function LinhaViva({ idEdicao }: { idEdicao: number }) {
  const c = usarPublico(`publico/edicao/${idEdicao}/partidas`, () => servicoPublico.listarPartidas(idEdicao));
  if (c.erro || !c.dados) return null;
  const texto = descreverAndamento(c.dados);
  if (!texto) return null;
  const aoVivo = c.dados.some((p) => p.estado === 'EM_ANDAMENTO');
  return (
    <p className="flex items-center gap-2 text-sm text-fg-muted">
      {aoVivo ? <SinalAoVivo className="text-sm" /> : null}
      <span>{texto}</span>
    </p>
  );
}
