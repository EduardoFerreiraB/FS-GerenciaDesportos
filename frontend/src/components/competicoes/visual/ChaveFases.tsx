/**
 * ChaveFases — chaveamento eliminatório em colunas por fase, com linhas conectoras
 * (apresentação pura, sem API).
 *
 * Props:
 * - `duelos: DueloChave[]` — duelos normalizados. Gere com os adaptadores de `./adaptadores`:
 *   `duelosDaDisputa(estrutura.duelos, partidas, equipes?, grupos?)` (administração) ou
 *   `duelosPublicos(chaveamento.duelos)` (portal). Cada duelo:
 *     · `id`, `fase` (valor técnico, ex. "SEMIFINAL" — traduzido com `rotuloFase`), `ordem` na fase;
 *     · `status` (PENDENTE | DEFINIDO | RESOLVIDO …, vira `StatusBadge` tipo "duelo");
 *     · `idaVolta?`, `idVencedor?`, `detalhe?` (ex.: "Agregado 3 × 2");
 *     · `vagas: VagaChave[]` — `{ idEquipe?, nome?, sigla?, pendente?, gols?, penaltis? }`;
 *       sem `nome`, a vaga mostra `pendente` (ex.: "Vencedor de Semifinal 1") ou "A definir".
 * - `className?: string`
 *
 * A disputa de 3º lugar (`fase === "TERCEIRO_LUGAR"`) é exibida num bloco separado abaixo da chave.
 * Cada duelo é um `<article>` com nome acessível "<Fase> <ordem>" (ou só "<Fase>" quando a fase
 * tem um único duelo). O vencedor fica destacado (troféu + negrito + fundo de sucesso).
 */
import { useId } from 'react';
import { Trophy } from 'lucide-react';
import { StatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { rotuloFase } from '@/lib/rotulos';
import { EscudoIniciais } from './EscudoIniciais';

export interface VagaChave {
  idEquipe?: number | null;
  nome?: string | null;
  sigla?: string | null;
  /** Descrição da vaga ainda não definida, ex.: "Vencedor de Semifinal 1". */
  pendente?: string | null;
  gols?: number | null;
  penaltis?: number | null;
}

export interface DueloChave {
  id: number;
  fase: string;
  ordem: number;
  status: string;
  idaVolta?: boolean;
  idVencedor?: number | null;
  detalhe?: string | null;
  vagas: VagaChave[];
}

export interface ChaveFasesProps {
  duelos: DueloChave[];
  className?: string;
}

/** Ordem canônica das fases eliminatórias (da primeira até a final). */
export const ORDEM_FASES: Record<string, number> = {
  SESSENTA_E_QUATRO_AVOS: 1,
  TRINTA_E_DOIS_AVOS: 2,
  DEZESSEIS_AVOS: 3,
  OITAVAS: 4,
  QUARTAS: 5,
  SEMIFINAL: 6,
  FINAL: 7,
};

const TERCEIRO_LUGAR = 'TERCEIRO_LUGAR';

/** Agrupa por fase (exceto 3º lugar) na ordem do torneio; fases desconhecidas mantêm a ordem de chegada. */
export function agruparPorFase(duelos: DueloChave[]): { fase: string; duelos: DueloChave[] }[] {
  const mapa = new Map<string, DueloChave[]>();
  const primeiraAparicao = new Map<string, number>();
  duelos.forEach((d, i) => {
    const fase = d.fase.toUpperCase();
    if (fase === TERCEIRO_LUGAR) return;
    if (!mapa.has(fase)) {
      mapa.set(fase, []);
      primeiraAparicao.set(fase, i);
    }
    mapa.get(fase)!.push(d);
  });
  return Array.from(mapa.entries())
    .sort(([a], [b]) => {
      const oa = ORDEM_FASES[a] ?? 50 + (primeiraAparicao.get(a) ?? 0) / 1000;
      const ob = ORDEM_FASES[b] ?? 50 + (primeiraAparicao.get(b) ?? 0) / 1000;
      return oa - ob;
    })
    .map(([fase, lista]) => ({ fase, duelos: [...lista].sort((x, y) => x.ordem - y.ordem) }));
}

function nomeDoDuelo(duelo: DueloChave, totalNaFase: number): string {
  const rotulo = rotuloFase(duelo.fase.toUpperCase());
  return totalNaFase > 1 ? `${rotulo} ${duelo.ordem}` : rotulo;
}

function LinhaVaga({ vaga, vencedora, perdedora }: { vaga: VagaChave; vencedora: boolean; perdedora: boolean }) {
  const definido = Boolean(vaga.nome);
  const texto = vaga.nome ?? vaga.pendente ?? 'A definir';
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-2 text-sm',
        vencedora && 'bg-success-soft',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {definido ? (
          <EscudoIniciais nome={vaga.nome} sigla={vaga.sigla} tamanho="sm" className="size-6 rounded-md text-[9px]" />
        ) : (
          <span aria-hidden="true" className="size-6 shrink-0 rounded-md border border-dashed border-line-strong" />
        )}
        <span
          className={cn(
            'truncate',
            !definido && 'italic text-fg-subtle',
            definido && vencedora && 'font-semibold text-fg',
            definido && perdedora && 'text-fg-subtle',
            definido && !vencedora && !perdedora && 'font-medium text-fg',
          )}
          title={texto}
        >
          {texto}
        </span>
        {vencedora ? (
          <>
            <Trophy aria-hidden="true" className="size-3.5 shrink-0 text-success" />
            <span className="sr-only">(vencedor)</span>
          </>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
        {vaga.penaltis != null ? <span className="text-xs text-fg-subtle">({vaga.penaltis})</span> : null}
        <span
          className={cn(
            'min-w-5 text-right font-semibold',
            vaga.gols == null ? 'text-fg-subtle' : vencedora ? 'text-success' : perdedora ? 'text-fg-subtle' : 'text-fg',
          )}
        >
          {vaga.gols ?? '–'}
        </span>
      </div>
    </div>
  );
}

function CartaoDuelo({ duelo, nome }: { duelo: DueloChave; nome: string }) {
  const vagas = duelo.vagas.length > 0 ? duelo.vagas : [{}, {}];
  return (
    <article
      aria-label={nome}
      className="w-full overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition-colors duration-150 hover:border-line-strong"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-muted px-3 py-1.5 text-xs">
        <span className="truncate font-medium text-fg-muted">
          {nome}
          {duelo.idaVolta ? <span className="text-fg-subtle"> · ida e volta</span> : null}
        </span>
        <StatusBadge tipo="duelo" valor={duelo.status} className="px-2 py-0 text-[11px]" />
      </header>
      <div className="divide-y divide-line">
        {vagas.map((vaga, i) => {
          const vencedora = duelo.idVencedor != null && vaga.idEquipe === duelo.idVencedor;
          const perdedora = duelo.idVencedor != null && vaga.idEquipe != null && vaga.idEquipe !== duelo.idVencedor;
          return <LinhaVaga key={i} vaga={vaga} vencedora={vencedora} perdedora={perdedora} />;
        })}
      </div>
      {duelo.detalhe ? (
        <footer className="border-t border-line px-3 py-1 text-[11px] tabular-nums text-fg-muted">{duelo.detalhe}</footer>
      ) : null}
    </article>
  );
}

const LINHA = 'bg-line-strong';

export function ChaveFases({ duelos, className }: ChaveFasesProps) {
  const fases = agruparPorFase(duelos);
  const terceiro = duelos.filter((d) => d.fase.toUpperCase() === TERCEIRO_LUGAR);
  const idTerceiro = useId();

  return (
    <div className={cn('space-y-6', className)}>
      {fases.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-canvas p-4 sm:p-6">
          <div className="flex min-w-max items-stretch gap-6">
            {fases.map(({ fase, duelos: lista }, iFase) => {
              const ultima = iFase === fases.length - 1;
              const primeira = iFase === 0;
              // Pares de duelos que alimentam um mesmo duelo da fase seguinte.
              const pares: DueloChave[][] = [];
              for (let i = 0; i < lista.length; i += ultima ? 1 : 2) pares.push(lista.slice(i, i + (ultima ? 1 : 2)));

              return (
                <section key={fase} aria-label={rotuloFase(fase)} className="flex w-64 flex-col">
                  <div className="mb-3 flex h-9 flex-col items-center justify-center text-center">
                    <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                      {ultima ? <Trophy aria-hidden="true" className="size-3.5 text-primary" /> : null}
                      {rotuloFase(fase)}
                    </h4>
                    <p className="text-[11px] text-fg-subtle">
                      {lista.length} {lista.length === 1 ? 'confronto' : 'confrontos'}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col">
                    {pares.map((par, iPar) => (
                      <div key={iPar} className="relative flex flex-1 flex-col">
                        {par.map((duelo) => (
                          <div key={duelo.id} className="relative flex flex-1 items-center py-2">
                            {!primeira ? (
                              <span aria-hidden="true" className={cn('absolute right-full top-1/2 h-px w-3', LINHA)} />
                            ) : null}
                            <CartaoDuelo duelo={duelo} nome={nomeDoDuelo(duelo, lista.length)} />
                            {!ultima ? (
                              <span aria-hidden="true" className={cn('absolute left-full top-1/2 h-px w-3', LINHA)} />
                            ) : null}
                          </div>
                        ))}
                        {!ultima && par.length === 2 ? (
                          <span
                            aria-hidden="true"
                            className={cn('absolute bottom-1/4 left-[calc(100%+0.75rem)] top-1/4 w-px', LINHA)}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {terceiro.length > 0 ? (
        <section aria-labelledby={idTerceiro} className="space-y-3">
          <h4 id={idTerceiro} className="text-sm font-semibold text-fg">
            {rotuloFase(TERCEIRO_LUGAR)}
          </h4>
          <div className="grid max-w-md gap-3">
            {terceiro.map((duelo) => (
              <CartaoDuelo key={duelo.id} duelo={duelo} nome={nomeDoDuelo(duelo, terceiro.length)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
