/**
 * EscudoEquipe — escudo da equipe com a sigla cadastrada; sem sigla, cai para as iniciais do nome
 * (DF-RT12-06). Mesmo visual do `EscudoIniciais`, com nome que deixa clara a regra.
 *
 * Props: `sigla?`, `nome?`, `tamanho?: 'sm' | 'md'`, `className?`. Decorativo (`aria-hidden`):
 * o nome da equipe sempre aparece em texto ao lado.
 */
import { EscudoIniciais, type EscudoIniciaisProps } from './EscudoIniciais';

export type EscudoEquipeProps = EscudoIniciaisProps;

export function EscudoEquipe(props: EscudoEquipeProps) {
  return <EscudoIniciais {...props} />;
}
