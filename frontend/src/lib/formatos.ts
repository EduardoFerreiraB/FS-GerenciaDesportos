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

export function somenteDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

/** Telefone brasileiro com DDD: "(62) 99999-1234" ou "(62) 3333-4444"; formata parcialmente durante a digitação. */
export function formatarTelefone(valor: string | null | undefined): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** CPF "000.000.000-00"; formata parcialmente durante a digitação. */
export function formatarCpf(valor: string | null | undefined): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
