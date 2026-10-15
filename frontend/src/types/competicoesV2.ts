export type FormatoCompeticao = 'PONTOS_CORRIDOS' | 'GRUPOS_MATA_MATA' | 'MATA_MATA';
export type StatusCompeticao = 'RASCUNHO' | 'ABERTA' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';
export type StatusConfronto = 'Agendado' | 'Em Andamento' | 'Finalizado' | 'Cancelado';
export type TipoOcorrencia = 'GOL' | 'GOL_CONTRA' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO';

export interface RegrasPontosCorridos {
  turno_e_returno: boolean;
  vitoria_pontos: number;
  empate_pontos: number;
  derrota_pontos: number;
  criterios_desempate: string[];
}

export interface RegrasGruposMataMata {
  qtd_grupos: number;
  times_por_grupo?: number | null;
  classificados_por_grupo: number;
  jogos_ida_volta_grupo: boolean;
  jogos_ida_volta_mata_mata: boolean;
  disputa_terceiro_lugar: boolean;
  penaltis_desempate: boolean;
}

export interface RegrasMataMata {
  fase_inicial: string;
  jogos_ida_volta: boolean;
  disputa_terceiro_lugar: boolean;
  penaltis_desempate: boolean;
}

export interface GrupoCompeticoes {
  id_grupo: number;
  nome: string;
  descricao?: string | null;
  slug: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  status: string;
  criado_em: string;
  competicoes?: CompeticaoV2[];
}

export interface JogadorV2 {
  id_jogador: number;
  id_equipe: number;
  nome: string;
  numero_camisa?: number | null;
  posicao?: string | null;
  documento?: string | null;
  data_nascimento?: string | null;
  foto_url?: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface EquipeV2 {
  id_equipe: number;
  id_competicao: number;
  id_edicao?: number | null;
  nome: string;
  grupo?: string | null;
  jogadores?: JogadorV2[];
}

export interface OcorrenciaPartidaV2 {
  id_ocorrencia: number;
  id_confronto: number;
  id_equipe: number;
  id_jogador?: number | null;
  tipo: TipoOcorrencia;
  minuto?: number | null;
  tempo_jogo?: string | null;
  observacao?: string | null;
  criado_em: string;
  nome_jogador?: string | null;
  nome_equipe?: string | null;
}

export interface ConfrontoV2 {
  id_confronto: number;
  id_competicao: number;
  id_equipe_mandante: number;
  id_equipe_visitante: number;
  rodada?: number | null;
  fase?: string | null;
  grupo?: string | null;
  data_hora?: string | null;
  data?: string | null;
  hora?: string | null;
  local?: string | { id_local?: number; nome?: string } | null;
  arbitro?: string | { id_arbitro?: number; nome?: string } | null;
  placar_mandante?: number | null;
  placar_visitante?: number | null;
  penaltis_mandante?: number | null;
  penaltis_visitante?: number | null;
  ordem_jogo?: number;
  id_confronto_ida?: number | null;
  id_proximo_confronto?: number | null;
  status: StatusConfronto;
  id_vencedor?: number | null;
  id_equipe_vencedora?: number | null;
  equipe_mandante?: { id_equipe: number; nome: string } | null;
  equipe_visitante?: { id_equipe: number; nome: string } | null;
  equipe_vencedora?: { id_equipe: number; nome: string } | null;
  ocorrencias?: OcorrenciaPartidaV2[];
}

export interface CompeticaoV2 {
  id_competicao: number;
  id_modalidade: number;
  id_grupo?: number | null;
  id_edicao?: number | null;
  nome: string;
  categoria?: string | null;
  modo_inscricao: 'EQUIPE' | 'INDIVIDUAL';
  formato: FormatoCompeticao;
  criterio_resultado?: string | null;
  status: StatusCompeticao;
  data_inicio?: string | null;
  data_fim?: string | null;
  regras_formato?: RegrasPontosCorridos | RegrasGruposMataMata | RegrasMataMata | Record<string, any> | null;
  modalidade?: { id_modalidade: number; nome: string } | null;
  grupo?: GrupoCompeticoes | null;
  equipes?: EquipeV2[];
  confrontos?: ConfrontoV2[];
}

export interface ClassificacaoEquipeItem {
  posicao: number;
  id_equipe: number;
  nome_equipe: string;
  grupo?: string | null;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  saldo_gols: number;
  pontos: number;
  aproveitamento: number;
  classificado?: boolean;
}

export interface ArtilheiroItem {
  posicao: number;
  id_jogador: number;
  nome_jogador: string;
  numero_camisa?: number | null;
  id_equipe: number;
  nome_equipe: string;
  gols: number;
}

export interface DisciplinarItem {
  id_jogador: number;
  nome_jogador: string;
  id_equipe: number;
  nome_equipe: string;
  amarelos?: number;
  cartoes_amarelos?: number;
  vermelhos?: number;
  cartoes_vermelhos?: number;
  pontos_disciplinares?: number;
  pontos_disciplinar?: number;
  suspenso: boolean;
  motivo_suspensao?: string | null;
}
