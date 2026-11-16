'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useNotification } from '@/context/NotificationContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { Button, Card, CardBody, Field, Input, PageHeader, Select } from '@/components/ui';

export default function NovoUsuarioPage() {
  const router = useRouter();
  const { toast } = useNotification();
  useBreadcrumb([{ label: 'Usuários', href: '/dashboard/usuarios' }, { label: 'Novo usuário' }]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onChange', defaultValues: { username: '', password: '', role: 'coordenador' } });

  const onSubmit = async (data: any) => {
    try {
      await api.post('/register', data);
      toast('Usuário criado com sucesso!', 'success');
      router.push('/dashboard/usuarios');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || 'Erro ao criar usuário.';
      toast(Array.isArray(msg) ? msg[0].msg : msg, 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Novo usuário" description="Crie contas administrativas ou de coordenação." />
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
        <Card>
          <CardBody className="space-y-5">
            <Field label="Nome de usuário" htmlFor="username" required error={errors.username?.message as string}>
              <Input id="username" placeholder="Ex: coordenador.joao" {...register('username', { required: 'Obrigatório' })} />
            </Field>
            <Field label="Senha" htmlFor="password" required error={errors.password?.message as string}>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password', { required: 'Obrigatório', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
              />
            </Field>
            <Field label="Perfil de acesso" htmlFor="role" required hint="Professores são criados pela tela de Professores.">
              <Select id="role" {...register('role', { required: true })}>
                <option value="coordenador">Coordenador</option>
                <option value="admin">Administrador</option>
                <option value="assistente">Assistente</option>
              </Select>
            </Field>
          </CardBody>
        </Card>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Criar usuário
          </Button>
        </div>
      </form>
    </div>
  );
}
