import Link from 'next/link';
import { CalendarX2 } from 'lucide-react';
import { PaginaPublica } from '@/components/publico/CabecalhoPublico';
import { Button, EmptyState } from '@/components/ui';

/** Rota antiga de eventos públicos: mantida só para não quebrar links antigos. */
export default function EventoPublicoDetalhesPage() {
  return (
    <PaginaPublica>
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          className="w-full max-w-md"
          icon={<CalendarX2 />}
          title="Recurso descontinuado"
          description="Esta página de eventos públicos foi substituída pelo novo portal de competições."
          action={
            <Button asChild variant="secondary">
              <Link href="/">Competições</Link>
            </Button>
          }
        />
      </div>
    </PaginaPublica>
  );
}
