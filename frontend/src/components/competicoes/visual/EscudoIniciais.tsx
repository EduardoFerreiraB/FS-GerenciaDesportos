/**
 * EscudoIniciais — "escudo" quadrado com a sigla da equipe (ou as iniciais do nome).
 *
 * Props:
 * - `nome?: string | null` — nome da equipe; usado para as iniciais quando não há sigla.
 * - `sigla?: string | null` — sigla curta (até 3 caracteres são exibidos).
 * - `tamanho?: 'sm' | 'md'` — `sm` = 32 px, `md` = 40 px (padrão).
 * - `className?: string`
 *
 * Puramente decorativo (`aria-hidden`): o nome da equipe sempre aparece em texto ao lado.
 */
import { cn } from '@/lib/cn';

export interface EscudoIniciaisProps {
  nome?: string | null;
  sigla?: string | null;
  tamanho?: 'sm' | 'md';
  className?: string;
}

export function iniciaisDaEquipe(nome?: string | null, sigla?: string | null): string {
  const s = sigla?.trim();
  if (s) return s.slice(0, 3).toUpperCase();
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export function EscudoIniciais({ nome, sigla, tamanho = 'md', className }: EscudoIniciaisProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted font-semibold tracking-tight text-fg-muted',
        tamanho === 'sm' ? 'size-8 text-[10px]' : 'size-10 text-xs',
        className,
      )}
    >
      {iniciaisDaEquipe(nome, sigla)}
    </span>
  );
}
