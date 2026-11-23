'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import useSWR, { mutate } from 'swr';
import { Dumbbell, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
  DropdownMenuSeparator,
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

function extrairMensagemApi(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail[0]?.msg || fallback;
  }
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  return fallback;
}

export default function ModalidadesPage() {
  const { toast } = useNotification();
  useBreadcrumb([{ label: 'Dashboard', href: '/dashboard' }, { label: 'Modalidades' }]);
  const { data: modalidades, error, isLoading, mutate: recarregar } = useSWR('/modalidades/', fetcher);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalidadeToEdit, setModalidadeToEdit] = useState<any>(null);
  const [modalidadeToDelete, setModalidadeToDelete] = useState<any>(null);

  const filteredModalidades = modalidades?.filter((m: any) =>
    m.nome.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const confirmDelete = async () => {
    if (!modalidadeToDelete) return;
    try {
      await api.delete(`/modalidades/${modalidadeToDelete.id_modalidade}`);
    } catch (err: any) {
      throw new Error(
        extrairMensagemApi(err, 'Erro ao excluir modalidade. Verifique se existem turmas vinculadas.'),
      );
    }
    mutate('/modalidades/');
    toast('Modalidade excluída.', 'success');
    setModalidadeToDelete(null);
  };

  const handleSaveModalidade = async (data: any) => {
    try {
      if (modalidadeToEdit) {
        await api.put(`/modalidades/${modalidadeToEdit.id_modalidade}`, data);
        mutate('/modalidades/');
        setModalidadeToEdit(null);
        toast('Modalidade atualizada.', 'success');
      } else {
        await api.post('/modalidades/', data);
        mutate('/modalidades/');
        setIsModalOpen(false);
        toast('Modalidade cadastrada.', 'success');
      }
    } catch (err: any) {
      console.error(err);
      const msg = extrairMensagemApi(
        err,
        modalidadeToEdit ? 'Erro ao atualizar modalidade.' : 'Erro ao criar modalidade.',
      );
      toast(msg, 'error');
      throw new Error(msg);
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
                      <DropdownMenuItem onSelect={() => setModalidadeToEdit(modalidade)}>
                        <Pencil className="size-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem tone="danger" onSelect={() => setModalidadeToDelete(modalidade)}>
                        <Trash2 className="size-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog
        open={isModalOpen || !!modalidadeToEdit}
        onOpenChange={(v) => {
          if (!v) {
            setIsModalOpen(false);
            setModalidadeToEdit(null);
          }
        }}
      >
        {isModalOpen || modalidadeToEdit ? (
          <ModalModalidade
            initialData={modalidadeToEdit}
            onClose={() => {
              setIsModalOpen(false);
              setModalidadeToEdit(null);
            }}
            onSave={handleSaveModalidade}
          />
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

function ModalModalidade({
  initialData,
  onClose,
  onSave,
}: {
  initialData?: any;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const isEditing = Boolean(initialData);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    mode: 'onChange',
    defaultValues: {
      nome: initialData?.nome ?? '',
      descricao: initialData?.descricao ?? '',
    },
  });

  const onSubmit = async (data: any) => {
    setErroEnvio(null);
    try {
      await onSave(data);
    } catch (err: any) {
      setErroEnvio(err?.message || 'Erro ao salvar modalidade.');
    }
  };

  return (
    <DialogContent
      title={isEditing ? 'Editar modalidade' : 'Nova modalidade'}
      description={isEditing ? 'Atualize o nome e a descrição da modalidade.' : 'Adicione um novo esporte ao sistema.'}
    >
      <form id="form-modalidade" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {erroEnvio ? <Alert tone="danger">{erroEnvio}</Alert> : null}
        <Field label="Nome da Modalidade" htmlFor="modalidade-nome" required error={errors.nome ? 'Campo obrigatório' : undefined}>
          <Input id="modalidade-nome" placeholder="Ex: Judô" {...register('nome', { required: true })} />
        </Field>
        <Field label="Descrição Curta" htmlFor="modalidade-descricao">
          <Textarea id="modalidade-descricao" placeholder="Ex: Aulas para iniciantes e avançados" {...register('descricao')} />
        </Field>
      </form>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" form="form-modalidade" loading={isSubmitting}>
          {isEditing ? 'Salvar alterações' : 'Salvar'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
