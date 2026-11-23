/**
 * IconeOcorrencia — ícones próprios das ocorrências de súmula (gol, gol contra, cartões).
 *
 * Props:
 * - `tipo: TipoOcorrencia | string` — GOL, GOL_CONTRA, CARTAO_AMARELO, CARTAO_VERMELHO_DIRETO,
 *   EXPULSAO_SEGUNDO_AMARELO (valores desconhecidos caem num ponto neutro).
 * - `className?: string` — tamanho (padrão `size-5`).
 *
 * Decorativo (`aria-hidden`): quem usa deve exibir o rótulo em texto ao lado
 * (`ROTULO_TIPO_OCORRENCIA` de `@/lib/rotulos`).
 */
import type { TipoOcorrencia } from '@/types/competicoes';
import { cn } from '@/lib/cn';

export interface IconeOcorrenciaProps {
  tipo: TipoOcorrencia | string;
  className?: string;
}

function Bola({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.2 13.4 8.7 12.1 12.7H7.9L6.6 8.7Z" fill="currentColor" />
      <path
        d="M10 6.2V2.4M13.4 8.7l3.6-1.2M12.1 12.7l2.2 3.1M7.9 12.7l-2.2 3.1M6.6 8.7 3 7.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Cartao({ className, cor }: { className?: string; cor: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <rect x="5" y="2.5" width="10" height="15" rx="2" className={cor} fill="currentColor" />
    </svg>
  );
}

function DoisCartoes({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <rect x="3" y="2.5" width="9" height="13.5" rx="1.8" className="text-cartao-amarelo" fill="currentColor" />
      <rect
        x="8"
        y="4"
        width="9"
        height="13.5"
        rx="1.8"
        className="text-cartao-vermelho"
        fill="currentColor"
        stroke="var(--surface)"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function IconeOcorrencia({ tipo, className }: IconeOcorrenciaProps) {
  const tamanho = cn('size-5 shrink-0', className);
  switch (tipo) {
    case 'GOL':
      return <Bola className={cn(tamanho, 'text-fg')} />;
    case 'GOL_CONTRA':
      return <Bola className={cn(tamanho, 'text-danger')} />;
    case 'CARTAO_AMARELO':
      return <Cartao className={tamanho} cor="text-cartao-amarelo" />;
    case 'CARTAO_VERMELHO_DIRETO':
      return <Cartao className={tamanho} cor="text-cartao-vermelho" />;
    case 'EXPULSAO_SEGUNDO_AMARELO':
      return <DoisCartoes className={tamanho} />;
    default:
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true" className={cn(tamanho, 'text-fg-subtle')}>
          <circle cx="10" cy="10" r="3" fill="currentColor" />
        </svg>
      );
  }
}
