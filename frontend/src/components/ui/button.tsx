import type { ComponentProps, ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

export const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
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
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  asChild?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  leftIcon,
  rightIcon,
  asChild = false,
  className,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot
        className={classes}
        aria-disabled={disabled || loading || undefined}
        tabIndex={disabled || loading ? -1 : props.tabIndex}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  // Durante o loading o conteúdo continua ocupando espaço (invisível) e o
  // spinner fica sobreposto, assim a largura do botão não muda.
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {leftIcon ? <span className={cn('inline-flex', loading && 'opacity-0')}>{leftIcon}</span> : null}
      <span className={cn(loading && 'opacity-0')}>{children}</span>
      {rightIcon ? <span className={cn('inline-flex', loading && 'opacity-0')}>{rightIcon}</span> : null}
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner aria-hidden="true" role="presentation" aria-label={undefined} size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      ) : null}
    </button>
  );
}
