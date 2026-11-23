'use client';

import React, { useEffect, useState } from 'react';

/** "Atualizado há N s" a partir do último sucesso da leitura. */
export default function AtualizadoHa({ instante }: { instante: number | null }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (instante === null) return null;
  const s = Math.max(0, Math.round((agora - instante) / 1000));
  return (
    <span className="text-xs tabular-nums text-fg-subtle" aria-live="off">
      Atualizado há {s} s
    </span>
  );
}
