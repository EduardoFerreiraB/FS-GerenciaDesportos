'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProfessorForm from '@/components/forms/ProfessorForm';
import useSWR from 'swr';
import api from '@/lib/api';
import { Alert, Button, Skeleton } from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function EditarProfessorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const { data: professor, error, isLoading } = useSWR(id ? `/professores/${id}` : null, fetcher);

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
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
            <Button size="sm" variant="secondary" onClick={() => router.push('/dashboard/professores')}>
              Voltar para a lista
            </Button>
          }
        >
          Não foi possível encontrar os dados deste professor.
        </Alert>
      </div>
    );
  }

  return <ProfessorForm initialData={professor} isEditing={true} />;
}