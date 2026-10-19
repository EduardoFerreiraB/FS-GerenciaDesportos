import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps extends Omit<ComponentProps<'header'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions, className, ...props }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-3', className)} {...props}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Trilha de navegação">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
            {breadcrumbs.map((item, i) => {
              const ultimo = i === breadcrumbs.length - 1;
              return (
                <li key={`${item.label}-${i}`} className="flex items-center gap-1">
                  {item.href && !ultimo ? (
                    <Link href={item.href} className="rounded transition-colors hover:text-fg focus-visible:ring-4 focus-visible:ring-focus outline-none">
                      {item.label}
                    </Link>
                  ) : (
                    <span aria-current={ultimo ? 'page' : undefined} className={ultimo ? 'text-fg' : undefined}>
                      {item.label}
                    </span>
                  )}
                  {!ultimo ? <ChevronRight aria-hidden="true" className="size-3.5 text-fg-subtle" /> : null}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
