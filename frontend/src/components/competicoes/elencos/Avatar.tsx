import { cn } from '@/lib/cn';

/** Círculo com as iniciais do nome (uso interno dos elencos). */
export function Avatar({ nome, className }: { nome: string; className?: string }) {
  const iniciais = nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary',
        className,
      )}
    >
      {iniciais || '?'}
    </span>
  );
}
