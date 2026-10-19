import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps extends Omit<ComponentProps<'div'>, 'title'> {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-fg-subtle [&_svg]:size-6"
      >
        {icon}
      </div>
      <div className="max-w-sm">
        <p className="text-base font-semibold text-fg">{title}</p>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
