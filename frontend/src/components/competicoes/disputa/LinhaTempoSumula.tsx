/**
 * LinhaTempoSumula — linha do tempo das ocorrências da súmula, por minuto, com as equipes lado a
 * lado (mandante à esquerda, visitante à direita; no celular vira lista única). Apresentação pura.
 *
 * Props:
 * - `ocorrencias: OcorrenciaDetalhe[]` — ordenadas aqui por minuto (sem minuto vão para o fim).
 * - `idMandante?: number | null` — define o lado de cada ocorrência por `id_equipe_beneficiada`.
 * - `nomeMandante`, `nomeVisitante`: string — usados no texto auxiliar de leitores de tela.
 * - `nomeAtleta(oc)` / `camisaAtleta(oc)` — resolvem o atleta (a súmula pode não trazer o nome).
 * - `acoes?(oc): ReactNode` — botões por ocorrência (identificar autor, remover).
 */
import type { ReactNode } from 'react';
import type { OcorrenciaDetalhe } from '@/types/competicoes';
import { cn } from '@/lib/cn';
import { ROTULO_TIPO_OCORRENCIA } from '@/lib/rotulos';
import { IconeOcorrencia } from '@/components/competicoes/visual';

interface LinhaTempoSumulaProps {
  ocorrencias: OcorrenciaDetalhe[];
  idMandante?: number | null;
  nomeMandante: string;
  nomeVisitante: string;
  nomeAtleta: (oc: OcorrenciaDetalhe) => string | null | undefined;
  camisaAtleta: (oc: OcorrenciaDetalhe) => number | null | undefined;
  acoes?: (oc: OcorrenciaDetalhe) => ReactNode;
}

export function ordenarPorMinuto(ocorrencias: OcorrenciaDetalhe[]): OcorrenciaDetalhe[] {
  return ocorrencias
    .map((oc, i) => ({ oc, i }))
    .sort((a, b) => {
      const ma = a.oc.minuto ?? Number.POSITIVE_INFINITY;
      const mb = b.oc.minuto ?? Number.POSITIVE_INFINITY;
      return ma === mb ? a.i - b.i : ma - mb;
    })
    .map(({ oc }) => oc);
}

export default function LinhaTempoSumula({
  ocorrencias,
  idMandante,
  nomeMandante,
  nomeVisitante,
  nomeAtleta,
  camisaAtleta,
  acoes,
}: LinhaTempoSumulaProps) {
  return (
    <div data-testid="linha-tempo-sumula" className="space-y-3">
      <div className="hidden grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] gap-3 text-xs font-medium text-fg-muted sm:grid">
        <span className="truncate text-right" title={nomeMandante}>
          {nomeMandante}
        </span>
        <span className="text-center">Min</span>
        <span className="truncate" title={nomeVisitante}>
          {nomeVisitante}
        </span>
      </div>

      <ol className="relative space-y-2">
        <span aria-hidden="true" className="absolute inset-y-0 left-7 w-px bg-line sm:left-1/2" />
        {ordenarPorMinuto(ocorrencias).map((oc) => {
          const mandante = oc.id_equipe_beneficiada === idMandante;
          const nome = nomeAtleta(oc);
          const camisa = camisaAtleta(oc);
          const rotulo = ROTULO_TIPO_OCORRENCIA[oc.tipo] ?? oc.tipo;
          const extra = acoes?.(oc);

          return (
            <li
              key={oc.id_ocorrencia}
              className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)]"
            >
              <div className="col-start-1 row-start-1 flex justify-center sm:col-start-2">
                <span className="relative rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-fg-muted">
                  {oc.minuto != null ? `${oc.minuto}'` : '—'}
                </span>
              </div>

              <div
                className={cn(
                  'col-start-2 row-start-1 flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-3 sm:flex-row sm:items-center',
                  mandante ? 'sm:col-start-1 sm:flex-row-reverse sm:text-right' : 'sm:col-start-3',
                )}
              >
                <div className={cn('flex min-w-0 flex-1 items-start gap-2.5', mandante && 'sm:flex-row-reverse')}>
                  <IconeOcorrencia tipo={oc.tipo} className="mt-0.5" />
                  <div className="min-w-0 space-y-0.5 text-sm">
                    <p className="font-semibold text-fg">{rotulo}</p>
                    {nome ? (
                      <p className="truncate text-fg" title={nome}>
                        {camisa != null ? <span className="tabular-nums text-fg-muted">#{camisa} </span> : null}
                        {nome}
                      </p>
                    ) : (
                      <p className="italic text-warning">Sem autoria definida</p>
                    )}
                    <p className="text-xs text-fg-subtle">
                      <span className="sr-only">Para {mandante ? nomeMandante : nomeVisitante}. </span>
                      {oc.periodo ?? null}
                      {oc.periodo && oc.observacao ? ' · ' : null}
                      {oc.observacao ?? null}
                    </p>
                  </div>
                </div>
                {extra ? (
                  <div className={cn('flex shrink-0 flex-wrap gap-1.5', mandante ? 'sm:justify-start' : 'sm:justify-end')}>
                    {extra}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
