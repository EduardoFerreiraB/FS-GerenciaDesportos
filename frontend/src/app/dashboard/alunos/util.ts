import api from '@/lib/api';

export function somenteDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

/** Formata telefone brasileiro com DDD: (62) 99999-1234 ou (62) 3333-4444. */
export function formatarTelefone(valor: string | null | undefined): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Monta a URL completa de um arquivo servido pela API usando NEXT_PUBLIC_API_URL. */
export function montarUrlArquivo(caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  if (/^https?:\/\//i.test(caminho)) return caminho;
  const base = (process.env.NEXT_PUBLIC_API_URL || api.defaults.baseURL || '').replace(/\/$/, '');
  const limpo = caminho.replace(/^\/+/, '');
  return base ? `${base}/${limpo}` : `/${limpo}`;
}
