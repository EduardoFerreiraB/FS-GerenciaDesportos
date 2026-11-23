'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useNotification } from '@/context/NotificationContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, PageHeader } from '@/components/ui';

interface ProfessorFormProps {
  initialData?: any;
  isEditing?: boolean;
}

function formatarCpf(valor: string | null | undefined): string {
  const d = (valor || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatarTelefone(valor: string | null | undefined): string {
  const d = (valor || '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function ProfessorForm({ initialData, isEditing = false }: ProfessorFormProps) {
  const router = useRouter();
  const { toast } = useNotification();
  useBreadcrumb([
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Professores', href: '/dashboard/professores' },
    { label: isEditing ? (initialData?.nome ?? 'Editar professor') : 'Novo professor' },
  ]);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    mode: 'onChange'
  });

  useEffect(() => {
    if (initialData) {
      Object.keys(initialData).forEach(key => {
        if (key === 'cpf') {
          setValue('cpf', formatarCpf(initialData.cpf));
        } else if (key === 'contato') {
          setValue('contato', formatarTelefone(initialData.contato));
        } else {
          setValue(key, initialData[key]);
        }
      });
      if (initialData.usuario) {
        setValue('username', initialData.usuario.username);
      }
    }
  }, [initialData, setValue]);

  const onSubmit = async (data: any) => {
    try {
      const payload = {
        ...data,
        cpf: (data.cpf || '').replace(/\D/g, ''),
        contato: (data.contato || '').replace(/\D/g, ''),
      };
      if (isEditing) {
        await api.put(`/professores/${initialData.id_professor}`, payload);
        toast('Professor atualizado com sucesso!', 'success');
      } else {
        await api.post('/professores/', payload);
        toast('Professor cadastrado com sucesso!', 'success');
      }
      router.push('/dashboard/professores');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || 'Erro ao salvar professor.';
      toast(Array.isArray(msg) ? msg[0].msg : msg, 'error');
    }
  };

  const cpfRegisterOptions = {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = formatarCpf(e.target.value);
    }
  };

  const telefoneRegisterOptions = {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = formatarTelefone(e.target.value);
    }
  };

  const msgErro = (e: any) => (e?.message as string | undefined);

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Editar professor' : 'Novo professor'}
        description={isEditing ? 'Atualize as informações do professor.' : 'Adicione um novo membro à equipe e configure seu acesso.'}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Dados pessoais" />
            <CardBody className="space-y-5">
              <Field label="Nome completo" htmlFor="nome" required error={msgErro(errors.nome)}>
                <Input id="nome" placeholder="Ex: Ricardo Oliveira" {...register('nome', { required: 'O nome é obrigatório' })} />
              </Field>
              <Field label="CPF" htmlFor="cpf" required error={msgErro(errors.cpf)}>
                <Input id="cpf" inputMode="numeric" placeholder="000.000.000-00" {...register('cpf', { required: 'O CPF é obrigatório', ...cpfRegisterOptions })} />
              </Field>
              <Field label="WhatsApp / contato" htmlFor="contato" required error={msgErro(errors.contato)}>
                <Input id="contato" inputMode="tel" placeholder="(62) 99999-1234" {...register('contato', { required: 'O contato é obrigatório', ...telefoneRegisterOptions })} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Acesso ao sistema" />
            <CardBody className="space-y-5">
              <Field label="Nome de usuário" htmlFor="username" required error={msgErro(errors.username)}>
                <Input id="username" placeholder="Ex: ricardo.oliveira" disabled={isEditing} {...register('username', { required: 'O usuário é obrigatório' })} />
              </Field>
              {!isEditing && (
                <Field label="Senha inicial" htmlFor="password" required error={msgErro(errors.password)}>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register('password', { required: 'A senha é obrigatória', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
                  />
                </Field>
              )}
              <Alert tone="info">
                Este usuário terá acesso de <strong>Professor</strong>: poderá visualizar suas turmas, alunos vinculados e realizar chamadas.
              </Alert>
            </CardBody>
          </Card>
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 border-t border-line bg-canvas/90 px-1 py-4 backdrop-blur">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar alterações' : 'Cadastrar professor'}
          </Button>
        </div>
      </form>
    </div>
  );
}
