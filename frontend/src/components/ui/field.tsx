import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

type PropsControle = { 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' };

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const idAjuda = `${htmlFor}-ajuda`;
  const idErro = `${htmlFor}-erro`;
  const temErro = Boolean(error);
  const temAjuda = !temErro && Boolean(hint);

  let controle = children;
  if (isValidElement<PropsControle>(children)) {
    const existente = children.props['aria-describedby'];
    const ids = [existente, temAjuda ? idAjuda : null, temErro ? idErro : null].filter(Boolean).join(' ');
    controle = cloneElement(children as ReactElement<PropsControle>, {
      'aria-describedby': ids || undefined,
      'aria-invalid': children.props['aria-invalid'] ?? (temErro ? true : undefined),
    });
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
      </label>
      {controle}
      {temErro ? (
        <p id={idErro} role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : temAjuda ? (
        <p id={idAjuda} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
