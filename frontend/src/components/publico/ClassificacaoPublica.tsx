'use client';

import React from 'react';
import { ListOrdered } from 'lucide-react';
import type { ClassificacaoPublica as Classificacao } from '@/types/publico';
import { TabelaClassificacaoVisual } from '@/components/competicoes/visual';
import { Alert, EmptyState } from '@/components/ui';

export default function ClassificacaoPublica({ classificacao }: { classificacao: Classificacao }) {
  const grupos = classificacao.grupos ?? [];
  const geral = classificacao.linhas ?? [];

  if (grupos.length === 0 && geral.length === 0) {
    return (
      <EmptyState
        icon={<ListOrdered />}
        title="A classificação ainda não está disponível."
        description="Ela aparece assim que houver equipes na tabela."
      />
    );
  }

  return (
    <div className="space-y-4">
      {classificacao.possui_empate_persistente ? (
        <Alert tone="warning" title="Empate não resolvido">
          Há empate que os critérios de desempate não resolveram. A ordem entre essas equipes ainda será decidida pela
          organização.
        </Alert>
      ) : null}
      {grupos.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {grupos.map((g) => (
            <TabelaClassificacaoVisual key={g.id_grupo} titulo={g.nome} linhas={g.linhas} className="min-w-0" />
          ))}
        </div>
      ) : (
        <TabelaClassificacaoVisual linhas={geral} />
      )}
    </div>
  );
}
