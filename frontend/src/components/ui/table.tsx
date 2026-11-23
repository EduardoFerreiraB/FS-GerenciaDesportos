import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** `embutida`: sem borda/cantos próprios, para uso dentro de um Card (evita borda dupla). */
export function Table({ className, embutida = false, ...props }: ComponentProps<'table'> & { embutida?: boolean }) {
  return (
    <div className={cn('w-full overflow-x-auto bg-surface', !embutida && 'rounded-xl border border-line')}>
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-surface-muted', className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-line', className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('transition-colors duration-150 hover:bg-surface-muted/60', className)} {...props} />;
}

export function TH({ className, scope = 'col', ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope={scope}
      className={cn(
        'whitespace-nowrap border-b border-line px-4 py-3 text-xs font-medium uppercase tracking-wide text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-4 py-3 align-middle text-fg', className)} {...props} />;
}
