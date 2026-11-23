/**
 * Componentes de APRESENTAÇÃO PUROS de competições (sem chamada de API, sem estado de servidor),
 * compartilhados pela administração (`components/competicoes/*`) e pelo portal (`components/publico/*`).
 * As props de cada componente estão documentadas no topo do respectivo arquivo.
 */
export { CartaoPlacar, Placar, SinalAoVivo } from './CartaoPlacar';
export type { CartaoPlacarProps, EquipePlacar, PartidaPlacar } from './CartaoPlacar';

export { TabelaClassificacaoVisual, LinhaClassificacaoVisual } from './TabelaClassificacaoVisual';
export type {
  TabelaClassificacaoVisualProps,
  LinhaClassificacaoVisualProps,
  LinhaClassificacaoBase,
  ColunaExtraClassificacao,
} from './TabelaClassificacaoVisual';

export { ChaveFases, agruparPorFase, ORDEM_FASES } from './ChaveFases';
export type { ChaveFasesProps, DueloChave, VagaChave } from './ChaveFases';

export { EscudoIniciais, iniciaisDaEquipe } from './EscudoIniciais';
export type { EscudoIniciaisProps } from './EscudoIniciais';

export { EscudoEquipe } from './EscudoEquipe';
export type { EscudoEquipeProps } from './EscudoEquipe';

export { IconeOcorrencia } from './IconeOcorrencia';
export type { IconeOcorrenciaProps } from './IconeOcorrencia';

export { placarDePartida, placarDePartidaPublica, duelosDaDisputa, duelosPublicos } from './adaptadores';
