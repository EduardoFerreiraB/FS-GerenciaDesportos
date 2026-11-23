'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogFooter } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Alert } from './alert';
import { extrairErro } from '@/lib/erros';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmText?: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmLabel,
  tone = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  const [digitado, setDigitado] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDigitado('');
      setErro(null);
      setCarregando(false);
    }
  }, [open]);

  // Espaços nas pontas do texto digitado são ignorados de propósito (trim):
  // evita travar o usuário por um espaço acidental ao colar o nome.
  const liberado = confirmText === undefined || digitado.trim() === confirmText;

  async function confirmar() {
    if (!liberado || carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      // Erro lançado pela própria tela (new Error('texto')) mantém o texto; erro da API passa por extrairErro.
      const proprio = e instanceof Error && !('response' in e) && !('codigo' in e) && e.message;
      setErro(proprio || extrairErro(e, { padrao: 'Não foi possível concluir a ação.' }).mensagem);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (carregando ? undefined : onOpenChange(v))}>
      <DialogContent title={title} description={description} size="sm">
        <div className="space-y-4">
          {confirmText !== undefined ? (
            <div className="space-y-2">
              <label htmlFor="confirmacao-exclusao" className="block text-sm text-fg-muted">
                Digite <strong className="font-semibold text-fg break-all">{confirmText}</strong> para confirmar
              </label>
              <Input
                id="confirmacao-exclusao"
                data-testid="input-confirmacao-exclusao"
                value={digitado}
                autoComplete="off"
                onChange={(e) => setDigitado(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void confirmar();
                  }
                }}
              />
            </div>
          ) : null}
          {erro ? (
            <Alert tone="danger">
              {erro}
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={carregando}>
            Cancelar
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            data-testid="btn-confirmar-exclusao"
            disabled={!liberado}
            loading={carregando}
            onClick={() => void confirmar()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
