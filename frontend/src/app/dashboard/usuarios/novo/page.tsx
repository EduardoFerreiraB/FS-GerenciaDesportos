'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { Alert, Button, Card, CardBody, Field, Input, PageHeader, Select } from '@/components/ui';

export default function NovoUsuarioPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useNotification();
  useBreadcrumb([
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Usuários', href: '/dashboard/usuarios' },
    { label: 'Novo usuário' },
  ]);

  const ehCoordenador = user?.role === 'coordenador';
  const podeAcessar = user?.role === 'admin' || ehCoordenador;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      username: '',
      password: '',
      role: ehCoordenador ? 'professor' : 'coordenador',
    },
  });

  useEffect(() => {
    if (ehCoordenador) {
      setValue('role', 'professor');
    }
  }, [ehCoordenador, setValue]);

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

  if (!authLoading && user && !podeAcessar) {
    return (
      <div className="space-y-6">
        <PageHeader title="Novo usuário" description="Cadastro de contas do sistema." />
        <Alert tone="warning" title="Acesso restrito">
          Apenas administradores e coordenadores podem cadastrar novos usuários.
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Novo usuário"
        description={
          ehCoordenador
            ? 'Crie contas de acesso para professores ou assistentes.'
            : 'Crie contas administrativas, de coordenação ou de apoio.'
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
        <Card>
          <CardBody className="space-y-5">
            <Field label="Nome de usuário" htmlFor="username" required error={errors.username?.message as string}>
              <Input
                id="username"
                placeholder={ehCoordenador ? 'Ex: assistente.maria' : 'Ex: coordenador.joao'}
                {...register('username', { required: 'Obrigatório' })}
              />
            </Field>
            <Field label="Senha" htmlFor="password" required error={errors.password?.message as string}>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password', { required: 'Obrigatório', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
              />
            </Field>
            <Field
              label="Perfil de acesso"
              htmlFor="role"
              required
              hint={
                ehCoordenador
                  ? 'Coordenadores podem cadastrar usuários com perfil Professor ou Assistente.'
                  : 'Professores com cadastro docente completo também podem ser criados na tela de Professores.'
              }
            >
              <Select id="role" {...register('role', { required: true })}>
                {ehCoordenador ? (
                  <>
                    <option value="professor">Professor</option>
                    <option value="assistente">Assistente</option>
                  </>
                ) : (
                  <>
                    <option value="coordenador">Coordenador</option>
                    <option value="admin">Administrador</option>
                    <option value="professor">Professor</option>
                    <option value="assistente">Assistente</option>
                  </>
                )}
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
