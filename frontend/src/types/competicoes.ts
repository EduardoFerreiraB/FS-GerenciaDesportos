/**
 * Contratos TypeScript estritos para o domínio de competições esportivas (fatia 1).
 * Espelha fielmente os modelos Pydantic de app/competicoes/contratos.
 */

// ==========================================
// Comuns e Erros
// ==========================================

export interface ErroApi {
  codigo: string;
  mensagem: string;
  campos?: string[];
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanho: number;
}

// ==========================================
// Configuração de Modalidade / Formato (Futebol)
// ==========================================

export type FormatoCompeticao = "PONTOS_CORRIDOS" | "GRUPOS_MATA_MATA" | "MATA_MATA";

export type CriterioDesempate =
  | "VITORIAS"
  | "SALDO_GOLS"
  | "GOLS_PRO"
  | "CONFRONTO_DIRETO";

export interface PontuacaoConfig {
  vitoria: number;
  empate: number;
  derrota: number;
}

export interface DisciplinaConfig {
  limite_amarelos?: number | null;
  jogos_por_acumulo: number;
  jogos_por_vermelho: number;
  jogos_por_segundo_amarelo: number;
  zerar_amarelos_ao_encerrar_grupos: boolean;
}

export interface ConfiguracaoPontosCorridos {
  formato: "PONTOS_CORRIDOS";
  pontuacao: PontuacaoConfig;
  desempates: CriterioDesempate[];
  disciplina: DisciplinaConfig;
  turno_e_returno?: boolean;
}

export interface ConfiguracaoGruposMataMata {
  formato: "GRUPOS_MATA_MATA";
  pontuacao: PontuacaoConfig;
  desempates: CriterioDesempate[];
  disciplina: DisciplinaConfig;
  quantidade_grupos: number;
  classificados_por_grupo: number;
  turno_e_returno_grupos?: boolean;
  ida_volta_eliminatoria?: boolean;
  final_unica?: boolean;
  terceiro_lugar?: boolean;
}

export interface ConfiguracaoMataMata {
  formato: "MATA_MATA";
  disciplina: DisciplinaConfig;
  ida_volta?: boolean;
  final_unica?: boolean;
  terceiro_lugar?: boolean;
}

export type Configuracao =
  | ConfiguracaoPontosCorridos
  | ConfiguracaoGruposMataMata
  | ConfiguracaoMataMata;

// ==========================================
// Organização: Eventos, Competições e Edições
// ==========================================

export type EstadoEdicao = "RASCUNHO" | "EM_ANDAMENTO" | "FINALIZADA" | "CANCELADA";

export interface EventoCriar {
  nome: string;
  descricao?: string | null;
}

export interface EventoAtualizar {
  nome?: string | null;
  descricao?: string | null;
  arquivado?: boolean | null;
}

export interface EdicaoEventoCriar {
  identificacao: string;
  data_inicio: string;
  data_fim: string;
}

export interface EdicaoEventoAtualizar {
  identificacao?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export interface EdicaoEventoDetalhe extends EdicaoEventoCriar {
  id_edicao_evento: number;
  id_evento: number;
  criado_em: string;
}

export interface EventoComEdicaoCriar extends EventoCriar {
  edicao: EdicaoEventoCriar;
}

export interface EventoDetalhe extends EventoCriar {
  id_evento: number;
  slug: string;
  arquivado: boolean;
  criado_em: string;
  edicoes: EdicaoEventoDetalhe[];
}

export type PaginaEventos = Pagina<EventoDetalhe>;

export interface CompeticaoCriar {
  nome: string;
  descricao?: string | null;
  id_modalidade: number;
}

export interface CompeticaoAtualizar {
  nome?: string | null;
  descricao?: string | null;
  arquivado?: boolean | null;
  id_modalidade?: number | null;
}

export interface EdicaoCompeticaoCriar extends EdicaoEventoCriar {
  id_edicao_evento?: number | null;
  categoria?: string | null;
  formato: FormatoCompeticao;
  configuracao: Configuracao;
}

export interface EdicaoCompeticaoAtualizar extends EdicaoCompeticaoCriar {
  revisao: number;
}

export interface EdicaoCompeticaoDetalhe extends EdicaoCompeticaoCriar {
  id_edicao_competicao: number;
  id_competicao: number;
  estado: EstadoEdicao;
  publicada: boolean;
  revisao: number;
  criado_em: string;
}

export interface CompeticaoComEdicaoCriar extends CompeticaoCriar {
  edicao: EdicaoCompeticaoCriar;
}

export interface CompeticaoDetalhe extends CompeticaoCriar {
  id_competicao: number;
  slug: string;
  arquivado: boolean;
  criado_em: string;
  edicoes: EdicaoCompeticaoDetalhe[];
}

export interface PublicacaoAtualizar {
  publicada: boolean;
}

export type PaginaCompeticoes = Pagina<CompeticaoDetalhe>;

// ==========================================
// Elencos: Competidores, Equipes e Integrantes
// ==========================================

export type SituacaoEquipe = "ATIVA" | "INATIVA";
export type SituacaoIntegrante = "ATIVO" | "INATIVO";

export interface CompetidorCriar {
  nome: string;
  data_nascimento?: string | null;
  documento?: string | null;
  foto_url?: string | null;
  ativo?: boolean;
}

export interface CompetidorAtualizar {
  nome?: string | null;
  data_nascimento?: string | null;
  documento?: string | null;
  foto_url?: string | null;
  ativo?: boolean | null;
}

export interface CompetidorDetalhe {
  id_competidor: number;
  nome: string;
  data_nascimento?: string | null;
  documento?: string | null;
  foto_url?: string | null;
  ativo: boolean;
  id_aluno_origem?: number | null;
  criado_em: string;
}

export type PaginaCompetidores = Pagina<CompetidorDetalhe>;

export interface AlunoImportar {
  id_aluno: number;
}

export interface EquipeCriar {
  nome: string;
  sigla?: string | null;
}

export interface EquipesCopiar {
  id_edicao_origem: number;
}

export interface IntegranteCriar {
  id_competidor: number;
  nome_esportivo: string;
  numero_camisa?: number | null;
  posicao?: string | null;
}

export interface IntegranteAtualizar {
  situacao: SituacaoIntegrante;
}

export interface IntegranteDetalhe extends IntegranteCriar {
  id_integrante: number;
  id_edicao_competicao: number;
  id_equipe: number;
  situacao: SituacaoIntegrante;
  criado_em: string;
}

export interface EquipeDetalhe extends EquipeCriar {
  id_equipe: number;
  id_edicao_competicao: number;
  situacao: SituacaoEquipe;
  criado_em: string;
  integrantes: IntegranteDetalhe[];
}

// ==========================================
// Fatia 2: Estrutura da Disputa, Duelos e Chaveamento
// ==========================================

export interface GrupoDisputaDetalhe {
  id_grupo: number;
  id_edicao_competicao: number;
  nome: string;
  numero_ordem: number;
  equipes: EquipeDetalhe[];
}

export type OrigemVaga = "MANUAL" | "GRUPO" | "DUELO_VENCEDOR" | "DUELO_PERDEDOR";

export interface VagaDueloDetalhe {
  id_vaga: number;
  id_duelo: number;
  posicao: number;
  origem_tipo: OrigemVaga;
  origem_id?: number | null;
  id_equipe?: number | null;
  nome_equipe?: string | null;
}

export interface DueloEliminatorioDetalhe {
  id_duelo: number;
  id_edicao_competicao: number;
  fase: string;
  ordem_na_fase: number;
  ida_e_volta: boolean;
  status: string;
  id_equipe_vencedora?: number | null;
  vagas: VagaDueloDetalhe[];
}

export interface EstruturaDisputaDetalhe {
  id_edicao_competicao: number;
  grupos: GrupoDisputaDetalhe[];
  duelos: DueloEliminatorioDetalhe[];
  total_partidas: number;
}

// ==========================================
// Fatia 2: Partidas, Agendamento e Placar Simples
// ==========================================

export type StatusPartida = "AGENDADA" | "EM_ANDAMENTO" | "FINALIZADA" | "CANCELADA";

export interface PartidaAgendar {
  data_hora?: string | null;
  data?: string | null;
  hora?: string | null;
  local?: string | null;
  campo?: string | null;
  id_local?: number | null;
}

export interface ResultadoSimples {
  gols_mandante: number;
  gols_visitante: number;
  penaltis_mandante?: number | null;
  penaltis_visitante?: number | null;
  wo?: boolean;
  equipe_wo_id?: number | null;
}

export interface PlacarPartida {
  gols_mandante: number;
  gols_visitante: number;
  penaltis_mandante?: number | null;
  penaltis_visitante?: number | null;
}

export interface PartidaDetalhe {
  id_partida: number;
  id_edicao_competicao: number;
  id_grupo?: number | null;
  id_duelo?: number | null;
  id_equipe_mandante?: number | null;
  id_equipe_visitante?: number | null;
  nome_mandante?: string | null;
  nome_visitante?: string | null;
  sigla_mandante?: string | null;
  sigla_visitante?: string | null;
  rodada?: number | null;
  turno?: number | null;
  numero_partida: number;
  data_hora?: string | null;
  local?: string | null;
  campo?: string | null;
  status: StatusPartida;
  placar: PlacarPartida;
  vencedor_id?: number | null;
  revisao: number;
}

// ==========================================
// Fatia 2: Classificação Pontuada
// ==========================================

export interface LinhaClassificacao {
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
}

export interface GrupoClassificacaoDetalhe {
  id_grupo: number;
  nome: string;
  linhas: LinhaClassificacao[];
  possui_empate_persistente: boolean;
}

export interface TabelaClassificacaoDetalhe {
  linhas?: LinhaClassificacao[] | null;
  grupos?: GrupoClassificacaoDetalhe[] | null;
  possui_empate_persistente: boolean;
}

// ==========================================
// Aliases Canônicos de Domínio
// ==========================================

export type Evento = EventoDetalhe;
export type EdicaoEvento = EdicaoEventoDetalhe;
export type Competicao = CompeticaoDetalhe;
export type EdicaoCompeticao = EdicaoCompeticaoDetalhe;
export type Competidor = CompetidorDetalhe;
export type Equipe = EquipeDetalhe;
export type IntegranteEquipe = IntegranteDetalhe;
export type Partida = PartidaDetalhe;
export type Duelo = DueloEliminatorioDetalhe;
export type GrupoDisputa = GrupoDisputaDetalhe;
