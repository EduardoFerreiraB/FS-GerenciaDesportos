'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, SearchX } from 'lucide-react';
import { ehNaoEncontrado } from '@/services/publico';
import { Alert, Button, EmptyState, Skeleton } from '@/components/ui';

interface EstadoCargaProps {
  carregando: boolean;
  erro: unknown;
  temDados: boolean;
  onTentarNovamente: () => void;
  /** Ex.: "a classificação". Usado nas mensagens. */
  recurso: string;
  children: React.ReactNode;
}

function BotaoTentarNovamente({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick} leftIcon={<RefreshCw className="size-3.5" />}>
      Tentar novamente
    </Button>
  );
}

/**
 * Falha é falha: erro de carregamento nunca vira lista vazia. Sem dados, mostra
 * o erro com retentativa; com dados já em tela, mantém os dados e avisa.
 */
export default function EstadoCarga({
  carregando,
  erro,
  temDados,
  onTentarNovamente,
  recurso,
  children,
}: EstadoCargaProps) {
  if (!temDados && erro) {
    if (ehNaoEncontrado(erro)) {
      return (
        <div role="status">
          <EmptyState
            icon={<SearchX />}
            title="Não encontrado"
            description="Este conteúdo não existe ou não está publicado."
            action={
              <Button asChild variant="secondary">
                <Link href="/">Competições</Link>
              </Button>
            }
          />
        </div>
      );
    }
    return (
      <div role="alert">
        <EmptyState
          icon={<AlertTriangle />}
          title={`Não foi possível carregar ${recurso}.`}
          description="Verifique sua conexão. Nenhum dado foi perdido."
          action={<BotaoTentarNovamente onClick={onTentarNovamente} />}
        />
      </div>
    );
  }

  if (!temDados && carregando) {
    return (
      <div role="status" aria-busy="true" className="space-y-3">
        <span className="sr-only">Carregando {recurso}...</span>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <>
      {erro && !ehNaoEncontrado(erro) ? (
        <Alert
          tone="warning"
          className="mb-4"
          action={<BotaoTentarNovamente onClick={onTentarNovamente} />}
        >
          Não foi possível atualizar {recurso}. Os dados exibidos podem estar desatualizados.
        </Alert>
      ) : null}
      {children}
    </>
  );
}
