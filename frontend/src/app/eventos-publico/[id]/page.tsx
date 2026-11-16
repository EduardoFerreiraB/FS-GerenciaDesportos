import Link from 'next/link';
import { CalendarX2 } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

/** Rota antiga de eventos públicos: mantida só para não quebrar links antigos. */
export default function EventoPublicoDetalhesPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-fg">
      <EmptyState
        className="w-full max-w-md"
        icon={<CalendarX2 />}
        title="Recurso descontinuado"
        description="Esta página de eventos públicos foi substituída pelo novo portal de competições."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Ver competições públicas</Link>
          </Button>
        }
      />
    </main>
  );
}
