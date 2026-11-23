import React from 'react';
import { Badge, StatusBadge } from '@/components/ui';
import type { EstadoEdicaoPublico } from '@/types/publico';

/** No portal público, edições em rascunho aparecem como "Em breve" (nunca o termo interno "Rascunho"). */
export default function SeloEstadoEdicaoPublica({ estado }: { estado: EstadoEdicaoPublico }) {
  if (estado === 'RASCUNHO') {
    return (
      <Badge tone="neutral" dot>
        Em breve
      </Badge>
    );
  }
  return <StatusBadge tipo="edicao" valor={estado} />;
}
