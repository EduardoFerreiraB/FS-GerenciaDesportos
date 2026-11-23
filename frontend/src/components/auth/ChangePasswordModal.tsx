'use client';

import React, { type RefObject } from 'react';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useNotificacao } from '@/context/NotificationContext';
import { Button, Dialog, DialogContent, DialogFooter, Field, Input } from '@/components/ui';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
  forceChange?: boolean;
  /** Elemento que recebe o foco quando o diálogo fecha (DF-RT08-04). */
  focoAoFechar?: RefObject<HTMLElement | null>;
}

interface FormSenha {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export default function ChangePasswordModal({ onClose, onSuccess, forceChange = false, focoAoFechar }: ChangePasswordModalProps) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormSenha>();
  const notificacao = useNotificacao();

  const onSubmit = async (data: FormSenha) => {
    try {
      await api.post('/change-password', {
        old_password: data.old_password,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      });
      notificacao.sucesso('Senha alterada com sucesso!');
      onSuccess();
    } catch (error) {
      notificacao.erro(error);
    }
  };

  const bloquear = (e: Event) => {
    if (forceChange) e.preventDefault();
  };

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto && !forceChange) onClose(); }}>
      <DialogContent
        size="sm"
        title={forceChange ? 'Alteração obrigatória' : 'Alterar senha'}
        description={
          forceChange
            ? 'Por segurança, você precisa alterar sua senha no primeiro acesso.'
            : 'Digite sua senha atual e a nova senha.'
        }
        semFechar={forceChange}
        onEscapeKeyDown={bloquear}
        onPointerDownOutside={bloquear}
        onInteractOutside={bloquear}
        onCloseAutoFocus={(e) => {
          if (focoAoFechar?.current) {
            e.preventDefault();
            focoAoFechar.current.focus();
          }
        }}
      >
        <form id="form-alterar-senha" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Senha atual" htmlFor="old_password" required error={errors.old_password && 'Campo obrigatório'}>
            <Input id="old_password" type="password" autoComplete="current-password" {...register('old_password', { required: true })} />
          </Field>
          <Field label="Nova senha" htmlFor="new_password" required error={errors.new_password?.type === 'minLength' ? 'Mínimo 6 caracteres' : errors.new_password && 'Campo obrigatório'}>
            <Input id="new_password" type="password" autoComplete="new-password" {...register('new_password', { required: true, minLength: 6 })} />
          </Field>
          <Field label="Confirmar nova senha" htmlFor="confirm_password" required error={errors.confirm_password?.type === 'validate' ? 'As senhas não conferem' : errors.confirm_password && 'Campo obrigatório'}>
            <Input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              {...register('confirm_password', { required: true, validate: (v) => watch('new_password') === v })}
            />
          </Field>
        </form>
        <DialogFooter>
          {!forceChange && (
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          )}
          <Button type="submit" form="form-alterar-senha" loading={isSubmitting}>
            Alterar senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
