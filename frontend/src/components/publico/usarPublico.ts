import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ehNaoEncontrado, INTERVALO_ATUALIZACAO_MS } from '@/services/publico';

/**
 * Leitura pública com atualização periódica e ao voltar à aba.
 * 404 não é retentado: significa "não publicado ou inexistente".
 * `atualizadoEm` é o instante (ms) do último sucesso.
 */
export function usarPublico<T>(chave: string | null, buscar: () => Promise<T>) {
  const consulta = useSWR<T>(chave, buscar, {
    refreshInterval: INTERVALO_ATUALIZACAO_MS,
    revalidateOnFocus: true,
    shouldRetryOnError: (erro: unknown) => !ehNaoEncontrado(erro),
    errorRetryCount: 2,
  });
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null);
  const { data, error, isValidating } = consulta;

  useEffect(() => {
    if (data !== undefined && !error && !isValidating) setAtualizadoEm(Date.now());
  }, [data, error, isValidating]);

  return {
    dados: data,
    erro: error as unknown,
    carregando: consulta.isLoading,
    atualizadoEm,
    recarregar: () => consulta.mutate(),
  };
}
