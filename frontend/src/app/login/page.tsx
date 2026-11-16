'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Alert, Button, Field, Input } from '@/components/ui';

interface FormLogin {
  username: string;
  password: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormLogin>();

  const onSubmit = async (data: FormLogin) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('username', data.username);
      formData.append('password', data.password);

      const response = await api.post('/token', formData);
      const token = response.data.access_token;
      const refreshToken = response.data.refresh_token;
      await login(token, refreshToken);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Usuário ou senha incorretos');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-canvas text-fg">
      <aside className="hidden flex-1 flex-col justify-between bg-primary-solid p-12 text-on-primary lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-on-primary/15 text-base font-bold">GE</div>
          <span className="text-lg font-semibold tracking-tight">Gerencia Esporte</span>
        </div>
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight">Gestão de escolinhas e competições esportivas</p>
        </div>
        <p className="text-sm opacity-80">© 2026 Gerencia Esporte</p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary-solid text-base font-bold text-on-primary">GE</div>
            <span className="text-lg font-semibold tracking-tight">Gerencia Esporte</span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-6 shadow-xs sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
            <p className="mt-1 text-sm text-fg-muted">Acesse sua conta para continuar.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              {error && <Alert tone="danger">{error}</Alert>}

              <Field label="Usuário" htmlFor="username" error={errors.username && 'Informe o usuário'}>
                <Input id="username" autoComplete="username" placeholder="Seu usuário" {...register('username', { required: true })} />
              </Field>

              <Field label="Senha" htmlFor="password" error={errors.password && 'Informe a senha'}>
                <div className="relative">
                  <Input
                    id="password"
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pr-10"
                    {...register('password', { required: true })}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? 'Ocultar caracteres' : 'Mostrar caracteres'}
                    className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-muted outline-none transition-colors hover:text-fg focus-visible:ring-4 focus-visible:ring-focus"
                  >
                    {mostrarSenha ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                </div>
              </Field>

              <Button type="submit" size="lg" className="w-full" loading={isLoading}>
                Acessar Sistema
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm">
            <Link href="/" className="text-primary hover:underline">
              Ver competições públicas
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
