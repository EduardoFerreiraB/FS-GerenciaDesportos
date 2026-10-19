import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from './card';

export interface StatCardProps extends Omit<ComponentProps<typeof Card>, 'children'> {
  label: ReactNode;
  value: ReactNode;
  icon: ReactNode;
  hint?: ReactNode;
}

export function StatCard({ label, value, icon, hint, className, ...props }: StatCardProps) {
  return (
    <Card className={cn('flex items-start justify-between gap-4 p-5', className)} {...props}>
      <div className="min-w-0">
        <p className="text-sm text-fg-muted">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
        {hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
      </div>
      <div
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted [&_svg]:size-5"
      >
        {icon}
      </div>
    </Card>
  );
}
