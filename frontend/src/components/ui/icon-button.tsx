import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-150 outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary-solid text-on-primary hover:bg-primary-solid-hover',
        secondary: 'border border-line-strong bg-surface text-fg hover:bg-surface-muted',
        ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg',
        danger: 'bg-danger-solid text-on-primary hover:bg-danger-solid-hover',
        'danger-outline': 'border border-danger bg-surface text-danger hover:bg-danger-soft',
      },
      size: {
        sm: 'size-8 [&_svg]:size-4',
        md: 'size-10 [&_svg]:size-5',
        lg: 'size-11 [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export interface IconButtonProps
  extends ComponentProps<'button'>,
    VariantProps<typeof iconButtonVariants> {
  'aria-label': string;
}

export function IconButton({ variant, size, className, type, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
