import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const controlClasses =
  'w-full rounded-lg border border-line-strong bg-surface text-sm text-fg placeholder:text-fg-subtle transition-colors duration-150 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-focus disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 aria-invalid:border-danger';

export interface InputProps extends ComponentProps<'input'> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid ? true : undefined}
      className={cn(controlClasses, 'h-10 px-3', className)}
      {...props}
    />
  );
}
