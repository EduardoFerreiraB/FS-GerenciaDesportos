/**
 * CartaoPlacar — cartão de placar de uma partida (apresentação pura, sem API).
 *
 * Props:
 * - `partida: PartidaPlacar` — dados normalizados da partida. Gere com os adaptadores de
 *   `./adaptadores`: `placarDePartida(p: PartidaDetalhe)` (administração) ou
 *   `placarDePartidaPublica(p: PartidaPublica)` (portal).
 *     · `numero?` → "Jogo N" no cabeçalho (numero_jogo da API, nunca o id);
 *     · `mandante` / `visitante` → `{ nome?, sigla? }` (nome ausente = "A definir");
 *     · `golsMandante` / `golsVisitante` → `null` mostra "×" no lugar do placar;
 *     · `penaltisMandante` / `penaltisVisitante` → exibidos abaixo do placar quando ambos existem;
 *     · `status` → `StatusPartida` (vira `StatusBadge` traduzido);
 *     · `data` (ISO "AAAA-MM-DD…"), `hora` ("HH:MM[:SS]"), `local`, `campo` → ausentes = "a definir".
 * - `rotulo?: ReactNode` — contexto do jogo no cabeçalho (ex.: "Grupo A · Rodada 2", "Semifinal").
 * - `aoVivo?: boolean` — mostra "● Ao vivo" com pulsação discreta (desligada em prefers-reduced-motion).
 * - `acoes?: ReactNode` — botões da administração no rodapé; o portal não passa nada.
 * - `compacto?: boolean` — reduz espaçamentos e o tamanho do placar (listas densas / celular).
 * - demais props de `<article>` (ex.: `data-testid`) são repassadas.
 *
 * Seletores estáveis internos: `status-partida`, `gols-mandante`, `gols-visitante`.
 */
import type { ComponentProps, ReactNode } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarData, formatarHora } from '@/lib/formatos';
import { EscudoIniciais } from './EscudoIniciais';

export interface EquipePlacar {
  nome?: string | null;
  sigla?: string | null;
}

export interface PartidaPlacar {
  numero?: number | null;
  mandante: EquipePlacar;
  visitante: EquipePlacar;
  golsMandante: number | null;
  golsVisitante: number | null;
  penaltisMandante?: number | null;
  penaltisVisitante?: number | null;
  status: string;
  data?: string | null;
  hora?: string | null;
  local?: string | null;
  campo?: string | null;
}

export interface CartaoPlacarProps extends Omit<ComponentProps<'article'>, 'children'> {
  partida: PartidaPlacar;
  rotulo?: ReactNode;
  aoVivo?: boolean;
  acoes?: ReactNode;
  compacto?: boolean;
}

function LadoEquipe({
  equipe,
  lado,
  compacto,
}: {
  equipe: EquipePlacar;
  lado: 'mandante' | 'visitante';
  compacto?: boolean;
}) {
  const nome = equipe.nome?.trim() || null;
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2.5 sm:gap-3',
        lado === 'mandante' ? 'flex-row-reverse text-right' : 'text-left',
      )}
    >
      <EscudoIniciais nome={nome} sigla={equipe.sigla} tamanho={compacto ? 'sm' : 'md'} />
      <div className="min-w-0">
        <p
          className={cn(
            'truncate font-semibold',
            compacto ? 'text-sm' : 'text-sm sm:text-base',
            nome ? 'text-fg' : 'italic font-normal text-fg-subtle',
          )}
          title={nome ?? 'A definir'}
        >
          {nome ?? 'A definir'}
        </p>
        {equipe.sigla && nome ? (
          <p className="truncate text-xs font-medium uppercase text-fg-subtle">{equipe.sigla}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Placar({
  golsMandante,
  golsVisitante,
  penaltisMandante,
  penaltisVisitante,
  compacto,
}: Pick<PartidaPlacar, 'golsMandante' | 'golsVisitante' | 'penaltisMandante' | 'penaltisVisitante'> & {
  compacto?: boolean;
}) {
  const temPlacar = golsMandante != null && golsVisitante != null;
  const temPenaltis = penaltisMandante != null && penaltisVisitante != null;
  const numero = compacto ? 'text-2xl' : 'text-3xl';

  if (!temPlacar) {
    return (
      <div className="flex flex-col items-center px-1">
        <span aria-hidden="true" className={cn('font-light leading-none text-fg-subtle', numero)}>
          ×
        </span>
        <span className="sr-only">contra</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-1">
      <div className="flex items-center gap-2 leading-none sm:gap-3">
        <span data-testid="gols-mandante" className={cn('font-semibold tabular-nums text-fg', numero)}>
          {golsMandante}
        </span>
        <span aria-hidden="true" className="text-base text-fg-subtle">
          ×
        </span>
        <span className="sr-only">a</span>
        <span data-testid="gols-visitante" className={cn('font-semibold tabular-nums text-fg', numero)}>
          {golsVisitante}
        </span>
      </div>
      {temPenaltis ? (
        <span className="mt-1.5 whitespace-nowrap text-xs tabular-nums text-fg-muted">
          Pênaltis {penaltisMandante} × {penaltisVisitante}
        </span>
      ) : null}
    </div>
  );
}

export function SinalAoVivo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold text-danger', className)}>
      {/* Único movimento contínuo do sistema: opacidade, desligado em prefers-reduced-motion. */}
      <span aria-hidden="true" className="size-2 rounded-full bg-danger motion-safe:animate-pulse" />
      Ao vivo
    </span>
  );
}

function Agendamento({ partida }: { partida: PartidaPlacar }) {
  const data = formatarData(partida.data);
  const hora = formatarHora(partida.hora);
  const local = partida.local?.trim() || null;
  const campo = partida.campo?.trim() || null;

  if (!data && !local && !campo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-fg-subtle">
        <Calendar aria-hidden="true" className="size-3.5" />
        Data e local a definir
      </span>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-fg-muted">
      <span className="inline-flex items-center gap-1.5">
        <Calendar aria-hidden="true" className="size-3.5 text-fg-subtle" />
        {data ? <span className="tabular-nums">{data}</span> : <span className="text-fg-subtle">Data a definir</span>}
      </span>
      {hora ? (
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-3.5 text-fg-subtle" />
          <span className="tabular-nums">{hora}</span>
        </span>
      ) : null}
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />
        {local || campo ? (
          <span className="truncate" title={[local, campo].filter(Boolean).join(' · ')}>
            {[local ?? 'Local a definir', campo].filter(Boolean).join(' · ')}
          </span>
        ) : (
          <span className="text-fg-subtle">Local a definir</span>
        )}
      </span>
    </div>
  );
}

export function CartaoPlacar({
  partida,
  rotulo,
  aoVivo = false,
  acoes,
  compacto = false,
  className,
  ...props
}: CartaoPlacarProps) {
  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border border-line bg-surface text-fg shadow-xs transition-colors duration-150 hover:border-line-strong',
        className,
      )}
      {...props}
    >
      <header
        className={cn(
          'flex items-center justify-between gap-3 border-b border-line text-xs',
          compacto ? 'px-3 py-2' : 'px-4 py-2.5',
        )}
      >
        <div className="flex min-w-0 items-center gap-2 text-fg-muted">
          {partida.numero != null ? (
            <span className="shrink-0 font-semibold text-fg">Jogo {partida.numero}</span>
          ) : null}
          {partida.numero != null && rotulo ? (
            <span aria-hidden="true" className="text-fg-subtle">
              ·
            </span>
          ) : null}
          {rotulo ? (
            <span className="truncate" title={typeof rotulo === 'string' ? rotulo : undefined}>
              {rotulo}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {aoVivo ? <SinalAoVivo /> : null}
          <StatusBadge tipo="partida" valor={partida.status} data-testid="status-partida" />
        </div>
      </header>

      <div
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4',
          compacto ? 'px-3 py-3' : 'px-4 py-5',
        )}
      >
        <LadoEquipe equipe={partida.mandante} lado="mandante" compacto={compacto} />
        <Placar
          golsMandante={partida.golsMandante}
          golsVisitante={partida.golsVisitante}
          penaltisMandante={partida.penaltisMandante}
          penaltisVisitante={partida.penaltisVisitante}
          compacto={compacto}
        />
        <LadoEquipe equipe={partida.visitante} lado="visitante" compacto={compacto} />
      </div>

      <footer
        className={cn(
          'mt-auto flex flex-col gap-3 border-t border-line text-xs sm:flex-row sm:items-center sm:justify-between',
          compacto ? 'px-3 py-2' : 'px-4 py-3',
        )}
      >
        <Agendamento partida={partida} />
        {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{acoes}</div> : null}
      </footer>
    </article>
  );
}
