'use client';

import React from 'react';
import type { PartidaPublica } from '@/types/publico';
import { SinalAoVivo } from '@/components/competicoes/visual';
import { rotuloFase } from '@/lib/rotulos';
import { ehFaseEliminatoria, ordenarPartidasPublicas } from './JogosPublicos';
import { usarPublico } from './usarPublico';
import { servicoPublico } from '@/services/publico';

/**
 * Descreve o andamento real da competição:
 * - Com mata-mata: "Mata-mata concluído" se todos os jogos eliminatórios terminaram,
 *   ou o rótulo da fase eliminatória em aberto mais cedo (ex.: "Semifinal", "Final").
 * - Apenas grupos / pontos corridos: "X de Y jogos" assim que há jogos finalizados,
 *   ou "Rodada 1 de N" antes do primeiro resultado.
 */
export function descreverAndamento(partidas: PartidaPublica[]): string | null {
  const validas = partidas.filter((p) => p.estado !== 'CANCELADA');
  if (validas.length === 0) return null;

  const mataMata = ordenarPartidasPublicas(validas.filter((p) => ehFaseEliminatoria(p.fase)));
  if (mataMata.length > 0) {
    const abertasMataMata = mataMata.filter((p) => p.estado !== 'FINALIZADA');
    if (abertasMataMata.length === 0) return 'Mata-mata concluído';
    return rotuloFase(abertasMataMata[0].fase);
  }

  const finalizadas = validas.filter((p) => p.estado === 'FINALIZADA');
  if (finalizadas.length > 0) {
    const rotuloJogos = validas.length === 1 ? 'jogo' : 'jogos';
    return `${finalizadas.length} de ${validas.length} ${rotuloJogos}`;
  }

  const rodadas = validas.map((p) => p.rodada).filter((r): r is number => r !== null);
  if (rodadas.length > 0) {
    const total = Math.max(...rodadas);
    const primeira = Math.min(...rodadas);
    return `Rodada ${primeira} de ${total}`;
  }

  const rotuloJogos = validas.length === 1 ? 'jogo' : 'jogos';
  return `0 de ${validas.length} ${rotuloJogos}`;
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
