import type { ComponentProps } from 'react';
import { rotuloDoEstado, tomDoEstado, type TipoEstado } from '@/lib/rotulos';
import { Badge } from './badge';

export interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, 'tone' | 'dot' | 'children'> {
  tipo: TipoEstado;
  valor: string;
}

export function StatusBadge({ tipo, valor, ...props }: StatusBadgeProps) {
  return (
    <Badge tone={tomDoEstado(tipo, valor)} dot {...props}>
      {rotuloDoEstado(tipo, valor)}
    </Badge>
  );
}
