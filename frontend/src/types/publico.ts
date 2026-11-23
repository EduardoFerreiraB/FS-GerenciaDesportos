/**
 * Tipos do portal público. Espelham `app/competicoes/contratos/publico.py`
 * campo a campo: nada aqui existe fora da allowlist do backend.
 */

export interface IntegrantePublico {
  nome_esportivo: string;
  numero_camisa: number | null;
  posicao: string | null;
}

export interface EquipePublica {
  id_equipe: number;
  nome: string;
  sigla: string | null;
  id_grupo: number | null;
  integrantes: IntegrantePublico[];
}

export interface GrupoPublico {
  id_grupo: number;
  nome: string;
  ordem: number;
}

export interface CompeticaoRef {
  slug: string;
  nome: string;
}

export interface EventoRef {
  slug: string;
  nome: string;
}

export interface EdicaoEventoRef {
  identificacao: string;
  evento: EventoRef;
}

export type FormatoPublico = 'PONTOS_CORRIDOS' | 'GRUPOS_MATA_MATA' | 'MATA_MATA';
export type EstadoEdicaoPublico = 'RASCUNHO' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';
export type EstadoPartidaPublico = 'AGENDADA' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';

export interface EdicaoPublicaResumo {
  id_edicao_competicao: number;
  identificacao: string;
  categoria: string | null;
  data_inicio: string;
  data_fim: string;
  formato: FormatoPublico;
  estado: EstadoEdicaoPublico;
}

export interface EdicaoPublicaDetalhe extends EdicaoPublicaResumo {
  competicao: CompeticaoRef;
  edicao_evento: EdicaoEventoRef | null;
  grupos: GrupoPublico[];
  equipes: EquipePublica[];
}

export interface CompeticaoPublica {
  slug: string;
  nome: string;
  descricao: string | null;
  modalidade: string;
  edicoes: EdicaoPublicaResumo[];
}

export interface EdicaoCompeticaoNoEvento extends EdicaoPublicaResumo {
  competicao: CompeticaoRef;
}

export interface EdicaoEventoPublica {
  id_edicao_evento: number;
  identificacao: string;
  data_inicio: string;
  data_fim: string;
  competicoes: EdicaoCompeticaoNoEvento[];
}

export interface EventoPublico {
  slug: string;
  nome: string;
  descricao: string | null;
  edicoes: EdicaoEventoPublica[];
}

export interface PartidaPublica {
  id_partida: number;
  id_grupo: number | null;
  nome_grupo: string | null;
  fase: string | null;
  rodada: number | null;
  ordem_jogo: number;
  /** Número exibido ao usuário ("Jogo 7"); a lista já vem ordenada por ele. */
  numero_jogo: number;
  id_equipe_mandante: number;
  nome_mandante: string;
  sigla_mandante: string | null;
  id_equipe_visitante: number;
  nome_visitante: string;
  sigla_visitante: string | null;
  data: string | null;
  hora: string | null;
  local: string | null;
  estado: EstadoPartidaPublico;
  /** null enquanto o jogo não começou. */
  gols_mandante: number | null;
  gols_visitante: number | null;
  penaltis_mandante: number | null;
  penaltis_visitante: number | null;
}

export interface LinhaClassificacaoPublica {
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
  aproveitamento: number;
  empate_persistente: boolean;
}

export interface GrupoClassificacaoPublico {
  id_grupo: number;
  nome: string;
  linhas: LinhaClassificacaoPublica[];
}

export interface ClassificacaoPublica {
  linhas: LinhaClassificacaoPublica[] | null;
  grupos: GrupoClassificacaoPublico[] | null;
  possui_empate_persistente: boolean;
}

export interface VagaPublica {
  posicao: number;
  origem: string;
  id_equipe: number | null;
  nome_equipe: string | null;
  /** "Grupo A" nas vagas vindas de posição de grupo. */
  nome_grupo: string | null;
  /** Texto legível: "1º do Grupo A", "Vencedor da Semifinal 1". */
  descricao_origem: string | null;
}

/** Placar agregado do duelo na ordem das vagas (ida e volta somadas). */
export interface PlacarDueloPublico {
  gols: [number | null, number | null];
  penaltis: [number | null, number | null];
}

export interface DueloPublico {
  id_duelo: number;
  fase: string;
  posicao_chave: number;
  estado: 'PENDENTE' | 'DEFINIDO' | 'RESOLVIDO';
  ida_volta: boolean;
  id_equipe_vencedora: number | null;
  vagas: VagaPublica[];
  /** null enquanto nenhum jogo do duelo começou. */
  placar: PlacarDueloPublico | null;
}

export interface ChaveamentoPublico {
  duelos: DueloPublico[];
}

export interface ArtilheiroPublico {
  posicao: number;
  nome_esportivo: string;
  numero_camisa: number | null;
  id_equipe: number;
  nome_equipe: string;
  gols: number;
  gols_em_andamento: number;
}

export interface ArtilhariaPublica {
  possui_jogos_em_andamento: boolean;
  artilheiros: ArtilheiroPublico[];
}
