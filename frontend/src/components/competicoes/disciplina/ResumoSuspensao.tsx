import { cn } from '@/lib/cn';

export interface ItemResumo {
  rotulo: string;
  valor: string;
  truncar?: boolean;
  numerico?: boolean;
}

/** Lista de rótulo/valor com os dados atuais de uma suspensão (uso interno dos modais). */
export function ResumoSuspensao({ itens }: { itens: ItemResumo[] }) {
  return (
    <dl className="divide-y divide-line rounded-xl border border-line bg-surface-muted px-4 text-sm">
      {itens.map((item) => (
        <div key={item.rotulo} className="flex items-center justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-fg-muted">{item.rotulo}</dt>
          <dd
            className={cn(
              'min-w-0 text-right font-medium text-fg',
              item.truncar && 'truncate',
              item.numerico && 'tabular-nums',
            )}
            title={item.truncar ? item.valor : undefined}
          >
            {item.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}
