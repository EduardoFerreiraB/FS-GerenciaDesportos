export type ModoInscricao = 'EQUIPE' | 'INDIVIDUAL';
export type FormatoCompeticao = 'PONTOS_CORRIDOS' | 'GRUPOS' | 'MATA_MATA' | 'TABELA_UNICA';
export type CriterioResultado = 'PONTOS' | 'TEMPO' | 'GOLS_SETS';
export type StatusCompeticao = 'RASCUNHO' | 'PLANEJADA' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';
export type StatusConfronto = 'Agendada' | 'Em Andamento' | 'Finalizada' | 'Cancelada' | 'Agendado' | 'Finalizado' | 'Cancelado';
export type StatusProva = 'Agendada' | 'Em Andamento' | 'Finalizada' | 'Cancelada';

export interface ModalidadeSimples {
  id_modalidade: number;
  nome: string;
  duracao_minutos?: number | null;
  descricao?: string | null;
}

export interface LocalSimples {
  id_local: number;
  loca_nome: string;
  loca_descricao?: string | null;
}

export interface ArbitroSimples {
  id_arbitro: number;
  apito_nome: string;
  apito_doc?: string | null;
  apito_tel?: string | null;
}

export interface Competicao {
  id_competicao: number;
  id_edicao: number;
  id_modalidade: number;
  nome: string;
  categoria: string;
  modo_inscricao: ModoInscricao | null;
  formato: FormatoCompeticao | null;
  criterio_resultado: CriterioResultado | null;
  data_inicio: string | null;
  data_fim: string | null;
  regras: string | null;
  status: StatusCompeticao;
  modalidade?: ModalidadeSimples | null;
}

export interface CompeticaoCreatePayload {
  id_modalidade: number;
  nome: string;
  categoria: string;
  modo_inscricao?: ModoInscricao | null;
  formato?: FormatoCompeticao | null;
  criterio_resultado?: CriterioResultado | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  regras?: string | null;
  status?: 'RASCUNHO';
}

export interface CompeticaoUpdatePayload {
  id_modalidade?: number;
  nome?: string;
  categoria?: string;
  modo_inscricao?: ModoInscricao | null;
  formato?: FormatoCompeticao | null;
  criterio_resultado?: CriterioResultado | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  regras?: string | null;
}

export interface EquipeCompeticao {
  id_equipe: number;
  nome: string;
  id_edicao: number;
  id_competicao: number | null;
  grupo?: string | null;
  participantes?: Array<{
    id_participante: number;
    tipo: 'aluno' | 'atleta';
    aluno?: { id_aluno: number; nome_completo: string };
    atleta?: { id_atleta: number; nome_completo: string };
  }>;
}

export interface Confronto {
  id_confronto: number;
  id_competicao: number;
  fase: string | null;
  rodada: string | null;
  grupo: string | null;
  data: string;
  hora: string;
  id_local: number;
  id_arbitro: number;
  id_equipe_mandante: number | null;
  id_equipe_visitante: number | null;
  placar_mandante: number;
  placar_visitante: number;
  id_equipe_vencedora: number | null;
  id_proximo_confronto: number | null;
  status: StatusConfronto;
  sumula_arquivo: string | null;
  observacoes: string | null;
  equipe_mandante?: { id_equipe: number; nome: string } | null;
  equipe_visitante?: { id_equipe: number; nome: string } | null;
  equipe_vencedora?: { id_equipe: number; nome: string } | null;
  local?: LocalSimples | null;
  arbitro?: ArbitroSimples | null;
}

export interface InscricaoIndividual {
  id_inscricao: number;
  id_competicao: number;
  id_participante: number;
  numero_peito: number | null;
  participante?: {
    id_participante: number;
    tipo: 'aluno' | 'atleta';
    aluno?: { id_aluno: number; nome_completo: string; data_nascimento?: string };
    atleta?: { id_atleta: number; nome_completo: string; data_nascimento?: string };
  };
}

export interface ResultadoProva {
  id_resultado: number;
  id_prova: number;
  id_participante: number;
  tempo_ms: number;
  tempo_formatado?: string;
  posicao: number | null;
  podio?: 'ouro' | 'prata' | 'bronze' | null;
  desqualificado: boolean;
  motivo_desqualificacao: string | null;
  observacoes: string | null;
  participante?: {
    id_participante: number;
    tipo: 'aluno' | 'atleta';
    aluno?: { id_aluno: number; nome_completo: string };
    atleta?: { id_atleta: number; nome_completo: string };
  };
}

export interface Prova {
  id_prova: number;
  id_competicao: number;
  nome: string;
  data: string | null;
  hora: string | null;
  id_local: number | null;
  status: StatusProva;
  observacoes: string | null;
  local?: LocalSimples | null;
  resultados?: ResultadoProva[];
}

export interface ClassificacaoEquipeRow {
  posicao: number;
  id_equipe: number;
  nome_equipe: string;
  grupo?: string | null;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gols_pro: number;
  gols_contra: number;
  saldo_gols: number;
  aproveitamento: number;
}

export interface ClassificacaoEquipesResponse {
  formato: FormatoCompeticao;
  total_equipes: number;
  confrontos_disputados: number;
  classificacao?: ClassificacaoEquipeRow[];
  grupos?: Record<string, ClassificacaoEquipeRow[]>;
  classificacao_por_grupo?: Array<{ grupo: string; classificacao: ClassificacaoEquipeRow[] }>;
  campeao?: { id_equipe: number; nome_equipe: string } | null;
  vice_campeao?: { id_equipe: number; nome_equipe: string } | null;
  semifinalistas?: Array<{ id_equipe: number; nome_equipe: string }>;
  arvore?: any[];
  mata_mata?: {
    campeao: { id_equipe: number; nome_equipe: string } | null;
    vice_campeao: { id_equipe: number; nome_equipe: string } | null;
    semifinalistas: Array<{ id_equipe: number; nome_equipe: string }>;
    total_confrontos: number;
    finalizados: number;
    arvore?: any[];
  };
}

export interface AtletaMedalhasRow {
  id_participante: number;
  nome_participante: string;
  numero_peito?: number | null;
  ouros: number;
  pratas: number;
  bronzes: number;
  total_medalhas: number;
  provas_disputadas: number;
  melhor_posicao?: number | null;
  posicao?: number | null;
}

export interface ClassificacaoIndividualResponse {
  id_competicao: number;
  nome: string;
  modo_inscricao: 'INDIVIDUAL';
  total_provas: number;
  provas: Array<{
    id_prova: number;
    nome: string;
    status: string;
    resultados: ResultadoProva[];
    podio: {
      ouro?: ResultadoProva | null;
      prata?: ResultadoProva | null;
      bronze?: ResultadoProva | null;
    };
  }>;
  quadro_medalhas: AtletaMedalhasRow[];
  ranking_geral: AtletaMedalhasRow[];
}
