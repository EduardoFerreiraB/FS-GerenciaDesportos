import type { ComponentProps, ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const alertVariants = cva('flex items-start gap-3 rounded-xl border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-primary/30 bg-primary-soft text-primary',
      success: 'border-success/30 bg-success-soft text-success',
      warning: 'border-warning/30 bg-warning-soft text-warning',
      danger: 'border-danger/30 bg-danger-soft text-danger',
    },
  },
  defaultVariants: { tone: 'info' },
});

const icones = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const;

export interface AlertProps
  extends Omit<ComponentProps<'div'>, 'title'>,
    VariantProps<typeof alertVariants> {
  title?: ReactNode;
  action?: ReactNode;
}

export function Alert({ tone, title, action, className, children, ...props }: AlertProps) {
  const Icone = icones[tone ?? 'info'];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn(alertVariants({ tone }), className)} {...props}>
      <Icone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title ? 'mt-0.5' : undefined, 'text-fg-muted')}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
