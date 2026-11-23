'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogFooter } from '@/components/ui';
import { cn } from '@/lib/cn';
import { extrairErro } from '@/lib/erros';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface NotificationContextType {
  toast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  confirm: (options: ConfirmOptions) => void;
}

const NotificationContext = createContext<NotificationContextType>({} as NotificationContextType);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions & { isOpen: boolean } | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    // No máximo um erro visível: o novo substitui o anterior (DF-RT02-03).
    setToasts((prev) => [...(type === 'error' ? prev.filter((t) => t.type !== 'error') : prev), { id, message, type }]);
    setTimeout(() => removeToast(id), type === 'error' ? 6000 : 4000);
  }, [removeToast]);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmModal({
      ...options,
      isOpen: true
    });
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.alert = (message: string) => {
        const lower = String(message).toLowerCase();
        let type: 'success' | 'error' | 'warning' | 'info' = 'info';
        if (
          lower.includes('sucesso') || 
          lower.includes('salvo') || 
          lower.includes('registrada') || 
          lower.includes('registrado') || 
          lower.includes('criada') || 
          lower.includes('criado') || 
          lower.includes('atualizada') || 
          lower.includes('atualizado') || 
          lower.includes('excluído') || 
          lower.includes('excluída') || 
          lower.includes('excluida') || 
          lower.includes('enviada') || 
          lower.includes('clonadas')
        ) {
          type = 'success';
        } else if (
          lower.includes('erro') || 
          lower.includes('falha') || 
          lower.includes('inválido') || 
          lower.includes('invalido') || 
          lower.includes('deletar') || 
          lower.includes('obrigatório') || 
          lower.includes('obrigatorio')
        ) {
          type = 'error';
        } else if (
          lower.includes('atenção') || 
          lower.includes('atencao') || 
          lower.includes('aviso') || 
          lower.includes('selecione')
        ) {
          type = 'warning';
        }
        toast(message, type);
      };
    }
  }, [toast]);

  const handleConfirmAction = () => {
    if (confirmModal) {
      confirmModal.onConfirm();
      setConfirmModal(null);
    }
  };

  const handleCancelAction = () => {
    if (confirmModal) {
      if (confirmModal.onCancel) confirmModal.onCancel();
      setConfirmModal(null);
    }
  };

  return (
    <NotificationContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts no canto superior direito: longe do rodapé dos diálogos (DF-RT04-02).
          `data-notificacao` faz o diálogo aberto ignorar cliques aqui. O portal só existe
          enquanto há aviso: montado depois de um diálogo abrir, ele não herda o
          aria-hidden que o diálogo aplica ao resto da página. */}
      {toasts.length > 0 && typeof document !== 'undefined' && createPortal(
      <div
        data-notificacao
        className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6"
      >
        {toasts.map((t) => {
          const Icon = { success: CheckCircle2, error: AlertTriangle, warning: AlertTriangle, info: Info }[t.type];
          const titulo = { success: 'Sucesso', error: 'Erro', warning: 'Atenção', info: 'Informação' }[t.type];
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-fg shadow-lg"
            >
              <Icon
                aria-hidden="true"
                className={cn('mt-0.5 size-5 shrink-0', {
                  'text-success': t.type === 'success',
                  'text-danger': t.type === 'error',
                  'text-warning': t.type === 'warning',
                  'text-primary': t.type === 'info',
                })}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{titulo}</p>
                <p className="mt-1 break-words text-sm text-fg-muted">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Fechar notificação"
                className="rounded p-0.5 text-fg-subtle outline-none transition-colors hover:text-fg focus-visible:ring-4 focus-visible:ring-focus"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>,
      document.body,
      )}

      <Dialog open={Boolean(confirmModal?.isOpen)} onOpenChange={(aberto) => { if (!aberto) handleCancelAction(); }}>
        {confirmModal && (
          <DialogContent size="sm" title={confirmModal.title} description={confirmModal.message}>
            <DialogFooter>
              <Button variant="secondary" onClick={handleCancelAction}>
                {confirmModal.cancelText || 'Cancelar'}
              </Button>
              <Button variant="danger" onClick={handleConfirmAction}>
                {confirmModal.confirmText || 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);

/** Atalho com a leitura de erro padronizada: `erro(e)` aceita o erro da API diretamente. */
export function useNotificacao() {
  const { toast } = useContext(NotificationContext);
  return React.useMemo(
    () => ({
      sucesso: (mensagem: string) => toast(mensagem, 'success'),
      aviso: (mensagem: string) => toast(mensagem, 'warning'),
      erro: (erro: unknown) => toast(typeof erro === 'string' ? erro : extrairErro(erro).mensagem, 'error'),
    }),
    [toast],
  );
}
