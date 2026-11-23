import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { controlClasses } from './input';

export interface TextareaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid ? true : undefined}
      className={cn(controlClasses, 'min-h-20 px-3 py-2', className)}
      {...props}
    />
  );
}
