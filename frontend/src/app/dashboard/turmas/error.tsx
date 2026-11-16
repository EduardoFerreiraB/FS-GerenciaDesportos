'use client';

import { Alert, Button } from '@/components/ui';

export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div>
      <Alert
        tone="danger"
        title="Algo deu errado"
        action={<Button variant="secondary" size="sm" onClick={() => reset()}>Tentar novamente</Button>}
      >
        Não foi possível exibir esta página.
      </Alert>
    </div>
  );
}
