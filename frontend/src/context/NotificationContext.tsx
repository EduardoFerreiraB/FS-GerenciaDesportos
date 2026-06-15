'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';

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
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
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

      {/* Floating Toasts Stack */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
        {toasts.map((t) => {
          const Icon = {
            success: CheckCircle2,
            error: AlertTriangle,
            warning: AlertTriangle,
            info: Info
          }[t.type];

          return (
            <div
              key={t.id}
              className={clsx(
                "p-4 rounded-2xl shadow-lg border flex items-start gap-3 pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-300 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50",
                {
                  "border-l-4 border-l-emerald-500": t.type === 'success',
                  "border-l-4 border-l-red-500": t.type === 'error',
                  "border-l-4 border-l-amber-500": t.type === 'warning',
                  "border-l-4 border-l-blue-500": t.type === 'info',
                }
              )}
            >
              <div className={clsx("mt-0.5 rounded-full p-1", {
                "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10": t.type === 'success',
                "text-red-500 bg-red-50 dark:bg-red-500/10": t.type === 'error',
                "text-amber-500 bg-amber-50 dark:bg-amber-500/10": t.type === 'warning',
                "text-blue-500 bg-blue-50 dark:bg-blue-500/10": t.type === 'info',
              })}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-150 leading-tight">
                  {t.type === 'success' && 'Sucesso'}
                  {t.type === 'error' && 'Erro'}
                  {t.type === 'warning' && 'Atenção'}
                  {t.type === 'info' && 'Informativo'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <HelpCircle size={28} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{confirmModal.title}</h2>
            </div>
            
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelAction}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-sm active:scale-95 transition-all cursor-pointer"
              >
                {confirmModal.cancelText || 'Cancelar'}
              </button>
              <button
                onClick={handleConfirmAction}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-100 dark:shadow-none active:scale-95 transition-all cursor-pointer text-sm"
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);
