'use client';

import { Children, isValidElement, type ComponentProps, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const larguras = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export interface DialogContentProps
  extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  size?: keyof typeof larguras;
  side?: 'center' | 'right';
}

export function DialogContent({
  title,
  description,
  size = 'md',
  side = 'center',
  className,
  children,
  ...props
}: DialogContentProps) {
  const posicao =
    side === 'right'
      ? 'inset-y-0 right-0 h-full w-full max-w-md rounded-l-xl border-l'
      : cn(
          'left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border',
          larguras[size],
        );

  // O rodapé fica fora da área rolável para ficar sempre visível. Para isso o
  // `DialogFooter` precisa ser FILHO DIRETO do `DialogContent` (dentro de outro
  // elemento ou componente ele não é reconhecido e rola junto com o corpo).
  const itens = Children.toArray(children);
  const rodape = itens.filter((c) => isValidElement(c) && c.type === DialogFooter);
  const corpo = itens.filter((c) => !(isValidElement(c) && c.type === DialogFooter));

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-ui="" className="fixed inset-0 z-50 bg-fg/40 data-[state=open]:animate-overlay-in" />
      <DialogPrimitive.Content
        data-ui=""
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'fixed z-50 flex flex-col border-line bg-surface text-fg shadow-lg outline-none',
          side === 'right'
            ? 'data-[state=open]:animate-overlay-in'
            : 'data-[state=open]:animate-content-in',
          posicao,
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-base font-semibold text-fg break-words">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-fg-muted break-words">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-muted outline-none transition-colors duration-150 hover:bg-surface-muted hover:text-fg focus-visible:ring-4 focus-visible:ring-focus"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{corpo}</div>
        {rodape}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}
