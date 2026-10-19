import useSWR from 'swr';
import { ehNaoEncontrado, INTERVALO_ATUALIZACAO_MS } from '@/services/publico';

/**
 * Leitura pública com atualização periódica e ao voltar à aba.
 * 404 não é retentado: significa "não publicado ou inexistente".
 */
export function usarPublico<T>(chave: string | null, buscar: () => Promise<T>) {
  const consulta = useSWR<T>(chave, buscar, {
    refreshInterval: INTERVALO_ATUALIZACAO_MS,
    revalidateOnFocus: true,
    shouldRetryOnError: (erro: unknown) => !ehNaoEncontrado(erro),
    errorRetryCount: 2,
  });
  return {
    dados: consulta.data,
    erro: consulta.error as unknown,
    carregando: consulta.isLoading,
    recarregar: () => consulta.mutate(),
  };
}
