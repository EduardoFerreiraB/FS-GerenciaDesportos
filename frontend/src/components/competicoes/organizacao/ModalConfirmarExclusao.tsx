'use client';

import React from 'react';
import { ConfirmDialog } from '@/components/ui';
import { isErroApi } from '@/services/competicoes';

interface ModalConfirmarExclusaoProps {
  aberto: boolean;
  titulo: string;
  /** O que será apagado, em linguagem do usuário. */
  descricao: React.ReactNode;
  /** Texto que o usuário precisa digitar para liberar o botão (ex.: o nome). */
  textoConfirmacao: string;
  onConfirmar: () => Promise<void>;
  onFechar: () => void;
}

/**
 * Exclusão é irreversível e em cascata: o botão só libera depois de digitar o
 * nome exato, para não apagar um campeonato com um clique errado.
 * Invólucro do `ConfirmDialog` (mesmos `data-testid` de confirmação).
 */
export default function ModalConfirmarExclusao({
  aberto,
  titulo,
  descricao,
  textoConfirmacao,
  onConfirmar,
  onFechar,
}: ModalConfirmarExclusaoProps) {
  return (
    <ConfirmDialog
      open={aberto}
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
      title={titulo}
      description={
        <span className="block space-y-2">
          {descricao}
          <span className="block font-medium text-danger">Esta ação não pode ser desfeita.</span>
        </span>
      }
      confirmText={textoConfirmacao.trim()}
      confirmLabel="Excluir definitivamente"
      tone="danger"
      onConfirm={async () => {
        try {
          await onConfirmar();
        } catch (err: unknown) {
          throw new Error(
            isErroApi(err) ? err.mensagem : 'Não foi possível excluir. Tente novamente.',
          );
        }
      }}
    />
  );
}
