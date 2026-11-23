/**
 * Contratos TypeScript estritos para o domínio de competições esportivas (fatia 1).
 * Espelha fielmente os modelos Pydantic de app/competicoes/contratos.
 */

// ==========================================
// Comuns e Erros
// ==========================================

export interface DetalheCampo {
  /** Caminho do campo com pontos (ex.: "edicao.data_fim"). */
  campo: string;
  mensagem: string;
}

export interface ErroApi {
  codigo: string;
  mensagem: string;
  campos?: string[];
  /** Mensagem legível por campo (T0.2); ler sempre via `extrairErro` de `@/lib/erros`. */
  detalhes?: DetalheCampo[];
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
  | "CONFRONTO_DIRETO"
  | "MENOS_CARTOES_VERMELHOS"
  | "MENOS_CARTOES_AMARELOS";

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

/** Competição vinculada a uma edição de evento (T1). */
export interface CompeticaoVinculada {
  id_competicao: number;
  nome: string;
  id_edicao_competicao: number;
  identificacao: string;
  estado: EstadoEdicao;
  publicada: boolean;
}

export interface EdicaoEventoDetalhe extends EdicaoEventoCriar {
  id_edicao_evento: number;
  id_evento: number;
  criado_em: string;
  /** Preenchido pela API a partir da T1. */
  competicoes?: CompeticaoVinculada[];
}

/** `POST /competicoes/edicoes-evento/{id}/vinculos` (T1). */
export interface VinculoEdicaoCriar {
  id_edicao_competicao: number;
}

/** `DELETE /competicoes/eventos/{id}` (T1): o nome precisa bater exatamente. */
export interface EventoExcluir {
  confirmacao_nome: string;
}

/** `DELETE /competicoes/edicoes-evento/{id}` (T1). */
export interface EdicaoEventoExcluir {
  confirmacao_identificacao: string;
}

/** `GET /competicoes/eventos/{id}/exclusao/previa` (T1): impacto mostrado no diálogo. */
export interface PreviaExclusaoEvento {
  edicoes_evento: number;
  edicoes_competicao: number;
  partidas: number;
  equipes: number;
  publicadas: number;
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

/** Evento vinculado à edição (selo no cabeçalho da competição). */
export interface EventoResumo {
  id_evento: number;
  nome: string;
  identificacao_edicao: string;
}

export interface EdicaoCompeticaoDetalhe extends EdicaoCompeticaoCriar {
  evento?: EventoResumo | null;
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

/** `PATCH /competicoes/equipes/{id}` (T2b): editável em qualquer estado da edição. */
export interface EquipeAtualizar {
  nome?: string;
  sigla?: string | null;
}

/** `GET /competicoes/edicoes/{id}/copiar-equipes/origens` (T2b). */
export interface OrigemCopiaEquipes {
  id_edicao_competicao: number;
  /** Ex.: "Copa X · 2026". */
  rotulo: string;
  equipes: number;
}

export interface IntegranteCriar {
  id_competidor: number;
  nome_esportivo: string;
  numero_camisa?: number | null;
  posicao?: string | null;
}

/** `PATCH /competicoes/integrantes/{id}`: todos opcionais a partir da T2b. */
export interface IntegranteAtualizar {
  situacao?: SituacaoIntegrante;
  nome_esportivo?: string;
  numero_camisa?: number | null;
  posicao?: string | null;
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
  /** Equipe definida depois da origem (vencedor do duelo, colocado do grupo). */
  id_equipe_resolvida?: number | null;
  nome_equipe?: string | null;
  /** "Grupo A" nas vagas vindas de posição de grupo (T3). */
  nome_grupo?: string | null;
  /** Texto legível da origem: "1º do Grupo A", "Vencedor da Semifinal 1" (T3). */
  descricao_origem?: string | null;
}

/** Placar agregado do duelo na ordem das vagas (T3); ida e volta somadas. */
export interface PlacarDuelo {
  gols: [number | null, number | null];
  penaltis: [number | null, number | null];
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
  /** Preenchido pela API a partir da T3. */
  placar?: PlacarDuelo | null;
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
  ordem_jogo?: number;
  /** Número exibido ao usuário ("Jogo 7"): 1..N por edição, grupos antes do mata-mata. */
  numero_jogo: number;
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
  aproveitamento?: number;
  empate_persistente?: boolean;
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
// Fatia 3: Súmula Detalhada, Artilharia e Reabertura
// ==========================================

export type TipoOcorrencia =
  | "GOL"
  | "GOL_CONTRA"
  | "CARTAO_AMARELO"
  | "CARTAO_VERMELHO_DIRETO"
  | "EXPULSAO_SEGUNDO_AMARELO";

export type TipoOcorrenciaLancamento =
  | "GOL"
  | "GOL_CONTRA"
  | "CARTAO_AMARELO"
  | "CARTAO_VERMELHO_DIRETO";

export interface OcorrenciaCriar {
  tipo: TipoOcorrenciaLancamento;
  id_equipe: number;
  id_integrante?: number | null;
  minuto?: number | null;
  periodo?: string | null;
  observacao?: string | null;
  motivo?: string | null;
}

export interface OcorrenciaAutorAtualizar {
  id_integrante?: number | null;
  motivo?: string | null;
}

export interface OcorrenciaDetalhe {
  id_ocorrencia: number;
  id_partida: number;
  tipo: TipoOcorrencia | string;
  id_equipe_beneficiada: number;
  id_integrante?: number | null;
  nome_integrante?: string | null;
  numero_camisa?: number | null;
  minuto?: number | null;
  periodo?: string | null;
  observacao?: string | null;
  id_ocorrencia_origem?: number | null;
  criado_em?: string | null;
}

export interface AlertaSuspensoPartida {
  id_integrante: number;
  nome_esportivo: string;
  id_equipe: number;
  id_suspensao: number;
  jogos_pendentes: number;
  motivo: string;
}

export interface SumulaDetalhe {
  partida: PartidaDetalhe;
  ocorrencias: OcorrenciaDetalhe[];
  alertas_suspensos: AlertaSuspensoPartida[];
}

export interface PartidaFinalizar {
  penaltis_mandante?: number | null;
  penaltis_visitante?: number | null;
}

export interface MotivoOperacao {
  motivo: string;
}

export interface ArtilheiroDetalhe {
  posicao: number;
  id_integrante: number;
  id_competidor: number;
  nome_esportivo: string;
  numero_camisa?: number | null;
  id_equipe: number;
  nome_equipe: string;
  gols: number;
  gols_em_andamento: number;
}

export interface TabelaArtilhariaDetalhe {
  id_edicao_competicao: number;
  possui_jogos_em_andamento: boolean;
  artilheiros: ArtilheiroDetalhe[];
}

// ==========================================
// Fatia 3: Disciplina, Suspensões, Cumprimentos e Decisões
// ==========================================

export type OrigemSuspensao =
  | "ACUMULO_AMARELOS"
  | "VERMELHO_DIRETO"
  | "SEGUNDO_AMARELO"
  | "MANUAL";

export type SituacaoSuspensao =
  | "ATIVA"
  | "CUMPRIDA"
  | "EM_REVISAO"
  | "CANCELADA";

export interface CumprimentoDetalhe {
  id_cumprimento: number;
  id_suspensao: number;
  id_integrante: number;
  id_partida: number;
  criado_em?: string | null;
  /** T5. */
  responsavel_nome?: string | null;
}

/** Linha do histórico de uma suspensão, lida da auditoria (T5). */
export interface HistoricoSuspensao {
  em: string;
  responsavel_nome?: string | null;
  acao: string;
  situacao_anterior?: SituacaoSuspensao | string | null;
  situacao_nova?: SituacaoSuspensao | string | null;
  justificativa?: string | null;
}

/** `GET /competicoes/suspensoes/{id}/partidas-elegiveis` (T5). */
export interface PartidaElegivelCumprimento {
  id_partida: number;
  numero_jogo: number;
  /** Ex.: "Jogo 6 · Final · Leões RT × Tigres RT". */
  rotulo: string;
}

export interface SuspensaoDetalhe {
  id_suspensao: number;
  id_edicao_competicao: number;
  id_integrante: number;
  nome_esportivo?: string | null;
  id_equipe?: number | null;
  nome_equipe?: string | null;
  id_partida_origem?: number | null;
  id_ocorrencia_origem?: number | null;
  motivo: string;
  origem: OrigemSuspensao | string;
  chave_origem?: string | null;
  jogos: number;
  jogos_cumpridos: number;
  jogos_pendentes: number;
  situacao: SituacaoSuspensao | string;
  cumprimentos: CumprimentoDetalhe[];
  criado_em?: string | null;
  /** T5. */
  responsavel_nome?: string | null;
  historico?: HistoricoSuspensao[];
}

/** Corpo de `DELETE /competicoes/ocorrencias/{id}` (T5): motivo obrigatório se a partida já foi finalizada. */
export interface OcorrenciaRemover {
  motivo?: string;
}

export interface SuspensaoManualCriar {
  id_integrante: number;
  jogos: number;
  motivo: string;
}

export interface SuspensaoAjustar {
  jogos?: number | null;
  situacao?: SituacaoSuspensao | null;
  motivo: string;
}

export interface CumprimentoCriar {
  id_partida: number;
}

export interface ResumoCartoesIntegrante {
  id_integrante: number;
  nome_esportivo: string;
  id_equipe: number;
  nome_equipe: string;
  amarelos_estatisticos: number;
  amarelos_acumulo_atual: number;
  vermelhos_diretos: number;
  expulsoes_segundo_amarelo: number;
  suspenso_atualmente: boolean;
}

export interface PainelDisciplinarDetalhe {
  id_edicao_competicao: number;
  suspensoes: SuspensaoDetalhe[];
  resumo_cartoes: ResumoCartoesIntegrante[];
}

export interface DecisaoClassificacaoCriar {
  id_grupo?: number | null;
  conjunto_equipes: number[];
  ordem_escolhida: number[];
  motivo: string;
}

export interface DecisaoClassificacaoDetalhe {
  id_decisao: number;
  id_edicao_competicao: number;
  id_grupo?: number | null;
  conjunto_equipes: number[];
  ordem_escolhida: number[];
  motivo: string;
  revisao_resultados: string;
  valida: boolean;
  criado_em?: string | null;
  /** T4. */
  responsavel_nome?: string | null;
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

