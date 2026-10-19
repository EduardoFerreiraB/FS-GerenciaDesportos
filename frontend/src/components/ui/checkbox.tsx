import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  invalid?: boolean;
}

export function Checkbox({ invalid, className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      aria-invalid={invalid ? true : undefined}
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded border-line-strong bg-surface accent-primary outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:outline aria-invalid:outline-1 aria-invalid:outline-danger',
        className,
      )}
      {...props}
    />
  );
}
