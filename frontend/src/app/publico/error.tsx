'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import { Alert, Button } from '@/components/ui';

export default function ErroPortal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PaginaPublica>
      <Alert
        tone="danger"
        title="Algo deu errado ao exibir esta página."
        action={
          <Button type="button" variant="secondary" size="sm" onClick={reset} leftIcon={<RefreshCw className="size-3.5" />}>
            Tentar novamente
          </Button>
        }
      >
        Nenhum dado foi perdido. Tente carregar a página de novo.
      </Alert>
    </PaginaPublica>
  );
}
