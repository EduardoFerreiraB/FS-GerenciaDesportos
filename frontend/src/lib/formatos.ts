import type { EstadoEdicaoPublico, FormatoPublico } from '@/types/publico';

/** Datas da API chegam como "AAAA-MM-DD"; formatadas sem fuso para não mudar o dia. */
export function formatarData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : null;
}

export function formatarHora(hora: string | null | undefined): string | null {
  return hora ? hora.slice(0, 5) : null;
}

export function formatarPeriodo(inicio: string, fim: string): string {
  return `${formatarData(inicio)} a ${formatarData(fim)}`;
}

export const ROTULO_FORMATO: Record<FormatoPublico, string> = {
  PONTOS_CORRIDOS: 'Pontos corridos',
  GRUPOS_MATA_MATA: 'Grupos + mata-mata',
  MATA_MATA: 'Mata-mata',
};

export const ROTULO_ESTADO_EDICAO: Record<EstadoEdicaoPublico, string> = {
  RASCUNHO: 'Em preparação',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const ROTULO_FASE: Record<string, string> = {
  FINAL: 'Final',
  SEMIFINAL: 'Semifinal',
  QUARTAS: 'Quartas de final',
  OITAVAS: 'Oitavas de final',
  DEZESSEIS_AVOS: '16 avos de final',
  TRINTA_E_DOIS_AVOS: '32 avos de final',
  SESSENTA_E_QUATRO_AVOS: '64 avos de final',
  TERCEIRO_LUGAR: 'Disputa de 3º lugar',
};

export function rotuloFase(fase: string | null | undefined): string {
  if (!fase) return '';
  return ROTULO_FASE[fase] ?? fase.replaceAll('_', ' ').toLowerCase();
}

/** Troca nomes técnicos de fase dentro de descrições como "Vencedor de SEMIFINAL 1". */
export function descreverOrigem(descricao: string | null): string | null {
  if (!descricao) return null;
  return descricao.replace(/de ([A-Z_]+) (\d+)$/, (_, fase: string, n: string) => `de ${rotuloFase(fase)} ${n}`);
}
