'use client';

import { Alert, Button } from '@/components/ui';

export default function ErroEventos({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-6">
      <Alert
        tone="danger"
        title="Algo deu errado nesta tela"
        action={
          <Button size="sm" variant="secondary" onClick={() => reset()}>
            Tentar novamente
          </Button>
        }
      >
        Não foi possível exibir os eventos. Tente novamente em instantes.
      </Alert>
    </div>
  );
}
