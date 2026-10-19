import { rotuloFase } from './rotulos';

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

/** Troca nomes técnicos de fase dentro de descrições como "Vencedor de SEMIFINAL 1". */
export function descreverOrigem(descricao: string | null): string | null {
  if (!descricao) return null;
  return descricao.replace(/de ([A-Z_]+) (\d+)$/, (_, fase: string, n: string) => `de ${rotuloFase(fase)} ${n}`);
}

/** Data e hora "dd/mm/aaaa HH:MM" a partir de um ISO com horário; só a data se não houver hora. */
export function formatarDataHora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const data = formatarData(iso);
  if (!data) return null;
  const hora = iso.length > 10 ? formatarHora(iso.slice(11)) : null;
  return hora ? `${data} ${hora}` : data;
}
