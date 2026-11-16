'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GitFork, RefreshCw } from 'lucide-react';
import { obterDisputa, listarEquipes, listarPartidas, isErroApi } from '@/services/competicoes';
import type { EstruturaDisputaDetalhe, EquipeDetalhe, PartidaDetalhe } from '@/types/competicoes';
import { Alert, Button, EmptyState, IconButton, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ChaveFases, duelosDaDisputa } from '@/components/competicoes/visual';

interface ChaveamentoEliminatorioProps {
  idEdicaoCompeticao: number;
}

export default function ChaveamentoEliminatorio({ idEdicaoCompeticao }: ChaveamentoEliminatorioProps) {
  const [disputa, setDisputa] = useState<EstruturaDisputaDetalhe | null>(null);
  const [equipes, setEquipes] = useState<EquipeDetalhe[]>([]);
  const [partidas, setPartidas] = useState<PartidaDetalhe[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarChaveamento = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      // Carrega estrutura de disputa, equipes (para mapear nomes) e partidas (para placares)
      const [dadosDisputa, dadosEquipes, dadosPartidas] = await Promise.all([
        obterDisputa(idEdicaoCompeticao),
        listarEquipes(idEdicaoCompeticao).catch(() => [] as EquipeDetalhe[]),
        listarPartidas(idEdicaoCompeticao).catch(() => [] as PartidaDetalhe[]),
      ]);

      setDisputa(dadosDisputa);
      setEquipes(dadosEquipes);
      setPartidas(dadosPartidas);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar o chaveamento eliminatório.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarChaveamento();
  }, [carregarChaveamento]);

  const duelos = useMemo(
    () => duelosDaDisputa(disputa?.duelos ?? [], partidas, equipes, disputa?.grupos ?? []),
    [disputa, partidas, equipes],
  );

  if (carregando && !disputa) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Carregando chaveamento eliminatório">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (erro) {
    return (
      <Alert
        tone="danger"
        title="Erro ao carregar chaveamento"
        action={
          <Button variant="secondary" size="sm" onClick={carregarChaveamento}>
            Tentar novamente
          </Button>
        }
      >
        {erro}
      </Alert>
    );
  }

  // Sem duelos gerados ou formato não eliminatório
  if (duelos.length === 0) {
    return (
      <EmptyState
        icon={<GitFork />}
        title="Chaveamento eliminatório indisponível"
        description="Não há duelos eliminatórios nesta edição. Competições só de pontos corridos não têm mata-mata, ou a tabela de confrontos ainda não foi gerada."
      />
    );
  }

  return (
    <section aria-label="Chaveamento eliminatório" className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg">Chaveamento eliminatório</h3>
          <p className="mt-0.5 text-sm text-fg-muted">Caminho dos confrontos até a final.</p>
        </div>
        <IconButton
          variant="secondary"
          aria-label="Atualizar chaveamento"
          title="Atualizar chaveamento"
          onClick={carregarChaveamento}
          disabled={carregando}
        >
          <RefreshCw aria-hidden="true" className={cn(carregando && 'motion-safe:animate-spin')} />
        </IconButton>
      </div>

      <ChaveFases duelos={duelos} />
    </section>
  );
}
