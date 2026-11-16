'use client';

import { ChevronRight, UserPlus, Users } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyState,
  StatusBadge,
} from '@/components/ui';
import type { EquipeDetalhe, IntegranteDetalhe } from '@/types/competicoes';

interface GavetaElencoProps {
  equipe: EquipeDetalhe | null;
  onClose: () => void;
  onAdicionar: (equipe: EquipeDetalhe) => void;
  onGerenciar: (equipe: EquipeDetalhe, integrante: IntegranteDetalhe) => void;
}

/** Gaveta lateral com o elenco de uma equipe (camisa, nome, posição e situação). */
export default function GavetaElenco({ equipe, onClose, onAdicionar, onGerenciar }: GavetaElencoProps) {
  const integrantes = equipe?.integrantes ?? [];
  const ativos = integrantes.filter((i) => i.situacao === 'ATIVO').length;

  return (
    <Dialog open={equipe !== null} onOpenChange={(aberto) => (!aberto ? onClose() : undefined)}>
      {equipe && (
        <DialogContent
          side="right"
          title={equipe.nome}
          description={
            <>
              {equipe.sigla ? `${equipe.sigla} · ` : ''}
              {integrantes.length} {integrantes.length === 1 ? 'atleta' : 'atletas'} ({ativos}{' '}
              {ativos === 1 ? 'ativo' : 'ativos'})
            </>
          }
        >
          {integrantes.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="Nenhum atleta inscrito"
              description="Use “Adicionar integrante” para inscrever o primeiro atleta desta equipe."
            />
          ) : (
            <ul className="-mx-2 divide-y divide-line" aria-label={`Elenco de ${equipe.nome}`}>
              {integrantes.map((integrante) => (
                <li key={integrante.id_integrante}>
                  <button
                    type="button"
                    onClick={() => onGerenciar(equipe, integrante)}
                    title={`Gerenciar ${integrante.nome_esportivo}`}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-surface-muted focus-visible:ring-4 focus-visible:ring-focus"
                  >
                    <span className="inline-flex h-8 min-w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted px-1.5 text-sm font-semibold tabular-nums text-fg">
                      {integrante.numero_camisa !== null && integrante.numero_camisa !== undefined
                        ? `#${integrante.numero_camisa}`
                        : '—'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">
                        {integrante.nome_esportivo}
                      </span>
                      <span className="block truncate text-xs text-fg-muted">
                        {integrante.posicao || 'Posição a definir'}
                      </span>
                    </span>
                    <StatusBadge tipo="integrante" valor={integrante.situacao} />
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button
              aria-label={`Adicionar integrante na equipe ${equipe.nome}`}
              leftIcon={<UserPlus className="size-4" />}
              onClick={() => onAdicionar(equipe)}
            >
              Adicionar integrante
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
