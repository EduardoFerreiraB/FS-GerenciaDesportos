'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import TurmaForm from '@/components/forms/TurmaForm';
import useSWR from 'swr';
import api from '@/lib/api';
import { Alert, Button, Skeleton } from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function EditarTurmaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const { data: turma, error, isLoading, mutate } = useSWR(id ? `/turmas/${id}` : null, fetcher);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Alert
          tone="danger"
          title="Erro ao carregar"
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => mutate()}>Tentar novamente</Button>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/turmas')}>Voltar para a lista</Button>
            </div>
          }
        >
          Não foi possível encontrar os dados desta turma.
        </Alert>
      </div>
    );
  }

  return <TurmaForm initialData={turma} isEditing={true} />;
}
