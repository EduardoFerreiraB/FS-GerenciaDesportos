'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import useSWR, { mutate } from 'swr';
import { Dumbbell, MoreHorizontal, Plus, Search } from 'lucide-react';
import api from '@/lib/api';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useNotification } from '@/context/NotificationContext';
import {
  Alert,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
} from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(res => res.data);

function iniciais(nome: string) {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
}

export default function ModalidadesPage() {
  const { toast } = useNotification();
  useBreadcrumb([{ label: 'Modalidades' }]);
  const { data: modalidades, error, isLoading, mutate: recarregar } = useSWR('/modalidades/', fetcher);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalidadeToDelete, setModalidadeToDelete] = useState<any>(null);

  const filteredModalidades = modalidades?.filter((m: any) =>
    m.nome.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const confirmDelete = async () => {
    if (!modalidadeToDelete) return;
    try {
      await api.delete(`/modalidades/${modalidadeToDelete.id_modalidade}`);
    } catch {
      throw new Error('Erro ao excluir modalidade. Verifique se existem turmas vinculadas.');
    }
    mutate('/modalidades/');
    toast('Modalidade excluída.', 'success');
    setModalidadeToDelete(null);
  };

  const handleAddModalidade = async (data: any) => {
    try {
      await api.post('/modalidades/', data);
      mutate('/modalidades/');
      setIsModalOpen(false);
      toast('Modalidade cadastrada.', 'success');
    } catch (error: any) {
      console.error(error);
      toast('Erro ao criar modalidade.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Modalidades"
        description="Gerencie os esportes oferecidos pela escola."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setIsModalOpen(true)}>
            Nova modalidade
          </Button>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="text"
          aria-label="Buscar modalidade"
          placeholder="Buscar modalidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <Alert tone="danger" title="Erro ao carregar modalidades" action={<Button variant="secondary" size="sm" onClick={() => recarregar()}>Tentar novamente</Button>}>
          Não foi possível obter a lista de modalidades.
        </Alert>
      ) : filteredModalidades.length === 0 ? (
        <EmptyState
          icon={<Dumbbell />}
          title={searchTerm ? 'Nenhuma modalidade encontrada' : 'Nenhuma modalidade cadastrada'}
          description={searchTerm ? 'Tente outro termo de busca.' : 'Cadastre o primeiro esporte para criar turmas.'}
          action={!searchTerm ? <Button leftIcon={<Plus className="size-4" />} onClick={() => setIsModalOpen(true)}>Nova modalidade</Button> : undefined}
        />
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Modalidade</TH>
              <TH>Descrição</TH>
              <TH className="w-12"><span className="sr-only">Ações</span></TH>
            </TR>
          </THead>
          <TBody>
            {filteredModalidades.map((modalidade: any) => (
              <TR key={modalidade.id_modalidade}>
                <TD>
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                      {iniciais(modalidade.nome)}
                    </span>
                    <span className="font-medium text-fg">{modalidade.nome}</span>
                  </div>
                </TD>
                <TD className="max-w-md text-fg-muted">
                  <span className="block truncate" title={modalidade.descricao || undefined}>
                    {modalidade.descricao || '—'}
                  </span>
                </TD>
                <TD>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton aria-label={`Mais ações de ${modalidade.nome}`} size="sm"><MoreHorizontal /></IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem tone="danger" onSelect={() => setModalidadeToDelete(modalidade)}>Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        {isModalOpen ? (
          <ModalCadastro onClose={() => setIsModalOpen(false)} onSave={handleAddModalidade} />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={!!modalidadeToDelete}
        onOpenChange={(v) => { if (!v) setModalidadeToDelete(null); }}
        title="Excluir modalidade"
        description="Modalidades com turmas vinculadas não podem ser excluídas. Esta ação não pode ser desfeita."
        confirmText={modalidadeToDelete?.nome}
        confirmLabel="Excluir modalidade"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ModalCadastro({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    mode: 'onChange'
  });

  return (
    <DialogContent title="Nova modalidade" description="Adicione um novo esporte ao sistema.">
      <form id="form-modalidade" onSubmit={handleSubmit(onSave)} className="space-y-4">
        <Field label="Nome da Modalidade" htmlFor="modalidade-nome" required error={errors.nome ? 'Campo obrigatório' : undefined}>
          <Input id="modalidade-nome" placeholder="Ex: Judô" {...register('nome', { required: true })} />
        </Field>
        <Field label="Descrição Curta" htmlFor="modalidade-descricao">
          <Textarea id="modalidade-descricao" placeholder="Ex: Aulas para iniciantes e avançados" {...register('descricao')} />
        </Field>
      </form>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="form-modalidade" loading={isSubmitting}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
