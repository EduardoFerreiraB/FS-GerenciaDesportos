'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface ItemTrilha {
  label: string;
  href?: string;
}

interface BreadcrumbContextType {
  itens: ItemTrilha[] | null;
  definir: (itens: ItemTrilha[] | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType>({ itens: null, definir: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ItemTrilha[] | null>(null);
  const valor = useMemo(() => ({ itens, definir: setItens }), [itens]);
  return <BreadcrumbContext.Provider value={valor}>{children}</BreadcrumbContext.Provider>;
}

/** Lido pela Topbar: itens publicados pela página, ou null para usar a trilha padrão. */
export const useBreadcrumbItens = () => useContext(BreadcrumbContext).itens;

/** Publica a trilha da página (ex.: Competições / Copa Municipal). Limpa ao desmontar. */
export function useBreadcrumb(itens: ItemTrilha[]): void {
  const { definir } = useContext(BreadcrumbContext);
  const chave = JSON.stringify(itens);
  const ultima = useRef(chave);
  ultima.current = chave;

  useEffect(() => {
    definir(JSON.parse(ultima.current) as ItemTrilha[]);
  }, [chave, definir]);

  useEffect(() => () => definir(null), [definir]);
}
