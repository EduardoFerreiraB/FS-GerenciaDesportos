/**
 * Parâmetros da página guardados no endereço (DF-RT10-02): recarregar ou compartilhar o link
 * mantém a edição e a aba abertas. Usa `history.replaceState` para não poluir o histórico.
 */
export function lerParametroUrl(nome: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(nome);
}

export function gravarParametroUrl(nome: string, valor: string | number | null): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (valor === null || valor === '') url.searchParams.delete(nome);
  else url.searchParams.set(nome, String(valor));
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}
