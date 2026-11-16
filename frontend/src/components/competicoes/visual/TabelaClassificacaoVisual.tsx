/**
 * TabelaClassificacaoVisual — tabela de classificação (apresentação pura, sem API).
 *
 * Props:
 * - `linhas: LinhaClassificacaoBase[]` — aceita direto `LinhaClassificacao` (`@/types/competicoes`)
 *   e `LinhaClassificacaoPublica` (`@/types/publico`): posição, equipe, J, V, E, D, GP, GC, SG,
 *   pontos, `aproveitamento?` (0–100) e `empate_persistente?`.
 * - `titulo?: ReactNode` — título acima da tabela (ex.: nome do grupo, "Classificação geral").
 * - `descricao?: ReactNode` — linha de apoio ao lado do título.
 * - `classificados?: number` — as N primeiras posições recebem a barra fina à esquerda
 *   (zona de classificação). 0/ausente = sem zona.
 * - `rotuloZona?: string` — texto da legenda da zona (padrão "Zona de classificação").
 * - `colunaExtra?: { titulo: string; render: (linha) => ReactNode }` — coluna à direita para a
 *   administração injetar ações; o portal não passa nada.
 * - `vazio?: ReactNode` — conteúdo quando `linhas` está vazio.
 * - `className?: string`
 *
 * Colunas: Pos, Equipe, P, J, V, E, D, GP, GC, SG, %. Equipe com empate não resolvido recebe
 * ícone de alerta e a explicação aparece na legenda abaixo da tabela.
 */
import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface LinhaClassificacaoBase {
  posicao: number;
  id_equipe: number;
  nome_equipe: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  saldo_gols: number;
  pontos: number;
  aproveitamento?: number | null;
  empate_persistente?: boolean | null;
}

export interface ColunaExtraClassificacao<L extends LinhaClassificacaoBase = LinhaClassificacaoBase> {
  titulo: string;
  render: (linha: L) => ReactNode;
}

export interface TabelaClassificacaoVisualProps<L extends LinhaClassificacaoBase = LinhaClassificacaoBase> {
  linhas: L[];
  titulo?: ReactNode;
  descricao?: ReactNode;
  classificados?: number;
  rotuloZona?: string;
  colunaExtra?: ColunaExtraClassificacao<L>;
  vazio?: ReactNode;
  className?: string;
}

const COLUNAS: { chave: keyof LinhaClassificacaoBase; rotulo: string; titulo: string }[] = [
  { chave: 'jogos', rotulo: 'J', titulo: 'Jogos' },
  { chave: 'vitorias', rotulo: 'V', titulo: 'Vitórias' },
  { chave: 'empates', rotulo: 'E', titulo: 'Empates' },
  { chave: 'derrotas', rotulo: 'D', titulo: 'Derrotas' },
  { chave: 'gols_pro', rotulo: 'GP', titulo: 'Gols pró' },
  { chave: 'gols_contra', rotulo: 'GC', titulo: 'Gols contra' },
];

const EXPLICACAO_EMPATE = 'Empate não resolvido pelos critérios de desempate; a ordem será decidida pela organização.';

function formatarSaldo(saldo: number): string {
  return saldo > 0 ? `+${saldo}` : String(saldo);
}

export interface LinhaClassificacaoVisualProps<L extends LinhaClassificacaoBase = LinhaClassificacaoBase> {
  linha: L;
  naZona?: boolean;
  colunaExtra?: ColunaExtraClassificacao<L>;
}

/** Uma linha `<tr>` da tabela; útil para quem monta a própria `<table>`. */
export function LinhaClassificacaoVisual<L extends LinhaClassificacaoBase>({
  linha,
  naZona = false,
  colunaExtra,
}: LinhaClassificacaoVisualProps<L>) {
  return (
    <TR>
      <TD className="relative w-14 whitespace-nowrap pl-5 text-center font-semibold tabular-nums text-fg-muted">
        {naZona ? (
          <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary" />
        ) : null}
        {linha.posicao}º
        {naZona ? <span className="sr-only"> (zona de classificação)</span> : null}
      </TD>
      <TD className="min-w-40 max-w-64">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-fg" title={linha.nome_equipe}>
            {linha.nome_equipe}
          </span>
          {linha.empate_persistente ? (
            <span title={EXPLICACAO_EMPATE} className="inline-flex shrink-0 text-warning">
              <TriangleAlert aria-hidden="true" className="size-4" />
              <span className="sr-only">{EXPLICACAO_EMPATE}</span>
            </span>
          ) : null}
        </div>
      </TD>
      <TD className="text-center font-semibold tabular-nums">{linha.pontos}</TD>
      {COLUNAS.map((c) => (
        <TD key={c.chave} className="text-center tabular-nums text-fg-muted">
          {linha[c.chave] as number}
        </TD>
      ))}
      <TD
        className={cn(
          'text-center font-medium tabular-nums',
          linha.saldo_gols > 0 ? 'text-success' : linha.saldo_gols < 0 ? 'text-danger' : 'text-fg-muted',
        )}
      >
        {formatarSaldo(linha.saldo_gols)}
      </TD>
      <TD className="text-center tabular-nums text-fg-muted">
        {linha.aproveitamento != null ? Math.round(linha.aproveitamento) : '—'}
      </TD>
      {colunaExtra ? <TD className="text-right">{colunaExtra.render(linha)}</TD> : null}
    </TR>
  );
}

export function TabelaClassificacaoVisual<L extends LinhaClassificacaoBase>({
  linhas,
  titulo,
  descricao,
  classificados = 0,
  rotuloZona = 'Zona de classificação',
  colunaExtra,
  vazio,
  className,
}: TabelaClassificacaoVisualProps<L>) {
  const temEmpate = linhas.some((l) => l.empate_persistente);
  const temZona = classificados > 0 && linhas.some((l) => l.posicao <= classificados);

  return (
    <section className={cn('space-y-3', className)}>
      {titulo || descricao ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {titulo ? <h3 className="text-base font-semibold text-fg">{titulo}</h3> : null}
          {descricao ? <p className="text-sm text-fg-muted">{descricao}</p> : null}
        </div>
      ) : null}

      {linhas.length === 0 ? (
        (vazio ?? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-fg-muted">
            Nenhuma equipe pontuada ainda.
          </p>
        ))
      ) : (
        <Table>
          <THead>
            <tr>
              <TH className="w-14 pl-5 text-center">Pos</TH>
              <TH>Equipe</TH>
              <TH className="text-center">
                <abbr title="Pontos" className="no-underline">
                  P
                </abbr>
              </TH>
              {COLUNAS.map((c) => (
                <TH key={c.chave} className="text-center">
                  <abbr title={c.titulo} className="no-underline">
                    {c.rotulo}
                  </abbr>
                </TH>
              ))}
              <TH className="text-center">
                <abbr title="Saldo de gols" className="no-underline">
                  SG
                </abbr>
              </TH>
              <TH className="text-center">
                <abbr title="Aproveitamento" className="no-underline">
                  %
                </abbr>
              </TH>
              {colunaExtra ? (
                <TH className="text-right">
                  <span className="sr-only">{colunaExtra.titulo}</span>
                </TH>
              ) : null}
            </tr>
          </THead>
          <TBody>
            {linhas.map((linha) => (
              <LinhaClassificacaoVisual
                key={linha.id_equipe}
                linha={linha}
                naZona={classificados > 0 && linha.posicao <= classificados}
                colunaExtra={colunaExtra}
              />
            ))}
          </TBody>
        </Table>
      )}

      {linhas.length > 0 && (temZona || temEmpate) ? (
        <div className="flex flex-col gap-1.5 text-xs text-fg-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
          {temZona ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-1 rounded-full bg-primary" />
              {rotuloZona}
            </span>
          ) : null}
          {temEmpate ? (
            <span className="inline-flex items-start gap-1.5">
              <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0 text-warning" />
              {EXPLICACAO_EMPATE}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
