import axios from 'axios';
import api from '@/lib/api';
import type {
  AlunoImportar,
  CompeticaoAtualizar,
  CompeticaoComEdicaoCriar,
  CompeticaoDetalhe,
  CompetidorAtualizar,
  CompetidorCriar,
  CompetidorDetalhe,
  DetalheCampo,
  EdicaoCompeticaoAtualizar,
  EdicaoCompeticaoCriar,
  EdicaoCompeticaoDetalhe,
  EdicaoEventoAtualizar,
  EdicaoEventoCriar,
  EdicaoEventoDetalhe,
  EquipeCriar,
  EquipeDetalhe,
  EquipesCopiar,
  ErroApi,
  EventoAtualizar,
  EventoComEdicaoCriar,
  EventoDetalhe,
  IntegranteAtualizar,
  IntegranteCriar,
  IntegranteDetalhe,
  PaginaCompeticoes,
  PaginaCompetidores,
  PaginaEventos,
  PublicacaoAtualizar,
  EstruturaDisputaDetalhe,
  PartidaAgendar,
  ResultadoSimples,
  PartidaDetalhe,
  TabelaClassificacaoDetalhe,
  SumulaDetalhe,
  OcorrenciaCriar,
  OcorrenciaAutorAtualizar,
  PartidaFinalizar,
  TabelaArtilhariaDetalhe,
  PainelDisciplinarDetalhe,
  SuspensaoDetalhe,
  SuspensaoManualCriar,
  SuspensaoAjustar,
  CumprimentoCriar,
  DecisaoClassificacaoCriar,
  DecisaoClassificacaoDetalhe,
  EdicaoEventoExcluir,
  EquipeAtualizar,
  EventoExcluir,
  OrigemCopiaEquipes,
  PartidaElegivelCumprimento,
  PreviaExclusaoEvento,
  VinculoEdicaoCriar,
} from '@/types/competicoes';

// ==========================================
// Tratamento de Erros da API
// ==========================================

export class ApiError extends Error implements ErroApi {
  codigo: string;
  mensagem: string;
  campos?: string[];
  detalhes?: DetalheCampo[];
  status?: number;

  constructor(erro: ErroApi, status?: number) {
    super(erro.mensagem);
    this.name = 'ApiError';
    this.codigo = erro.codigo;
    this.mensagem = erro.mensagem;
    this.campos = erro.campos;
    this.detalhes = erro.detalhes;
    this.status = status;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isErroApi(erro: unknown): erro is ErroApi {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'codigo' in erro &&
    'mensagem' in erro
  );
}

function normalizarErro(error: unknown): never {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as Record<string, unknown>;
    if (typeof data === 'object' && data !== null && 'codigo' in data && 'mensagem' in data) {
      throw new ApiError({
        codigo: String(data.codigo),
        mensagem: String(data.mensagem),
        campos: Array.isArray(data.campos) ? data.campos.map(String) : undefined,
        detalhes: Array.isArray(data.detalhes) ? (data.detalhes as DetalheCampo[]) : undefined,
      }, error.response.status);
    }
  }
  throw error;
}

// ==========================================
// Parâmetros de Listagem
// ==========================================

export interface ListarFiltrosPaginados {
  pagina?: number;
  tamanho?: number;
  busca?: string;
  incluir_arquivados?: boolean;
}

// ==========================================
// Organização: Eventos
// ==========================================

export async function listarEventos(params?: ListarFiltrosPaginados): Promise<PaginaEventos> {
  try {
    const response = await api.get<PaginaEventos>('/competicoes/eventos', { params });
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function criarEventoComEdicao(dados: EventoComEdicaoCriar): Promise<EventoDetalhe> {
  try {
    const response = await api.post<EventoDetalhe>('/competicoes/eventos', dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function obterEvento(idEvento: number): Promise<EventoDetalhe> {
  try {
    const response = await api.get<EventoDetalhe>(`/competicoes/eventos/${idEvento}`);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function atualizarEvento(idEvento: number, dados: EventoAtualizar): Promise<EventoDetalhe> {
  try {
    const response = await api.patch<EventoDetalhe>(`/competicoes/eventos/${idEvento}`, dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function arquivarEvento(idEvento: number): Promise<EventoDetalhe> {
  return atualizarEvento(idEvento, { arquivado: true });
}

export async function criarEdicaoEvento(idEvento: number, dados: EdicaoEventoCriar): Promise<EdicaoEventoDetalhe> {
  try {
    const response = await api.post<EdicaoEventoDetalhe>(`/competicoes/eventos/${idEvento}/edicoes`, dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function atualizarEdicaoEvento(
  idEdicaoEvento: number,
  dados: EdicaoEventoAtualizar
): Promise<EdicaoEventoDetalhe> {
  try {
    const response = await api.patch<EdicaoEventoDetalhe>(`/competicoes/edicoes-evento/${idEdicaoEvento}`, dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

// ==========================================
// Organização: Competições e Edições
// ==========================================

export async function listarCompeticoes(params?: ListarFiltrosPaginados): Promise<PaginaCompeticoes> {
  try {
    const response = await api.get<PaginaCompeticoes>('/competicoes/competicoes', { params });
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function criarCompeticaoComEdicao(dados: CompeticaoComEdicaoCriar): Promise<CompeticaoDetalhe> {
  try {
    const response = await api.post<CompeticaoDetalhe>('/competicoes/competicoes', dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function obterCompeticao(idCompeticao: number): Promise<CompeticaoDetalhe> {
  try {
    const response = await api.get<CompeticaoDetalhe>(`/competicoes/competicoes/${idCompeticao}`);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function atualizarCompeticao(
  idCompeticao: number,
  dados: CompeticaoAtualizar
): Promise<CompeticaoDetalhe> {
  try {
    const response = await api.patch<CompeticaoDetalhe>(`/competicoes/competicoes/${idCompeticao}`, dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function arquivarCompeticao(idCompeticao: number): Promise<CompeticaoDetalhe> {
  return atualizarCompeticao(idCompeticao, { arquivado: true });
}

/** Exclui a competição e, em cascata, todas as suas edições. */
export async function excluirCompeticao(idCompeticao: number): Promise<void> {
  try {
    await api.delete(`/competicoes/competicoes/${idCompeticao}`);
  } catch (error) {
    normalizarErro(error);
  }
}

export async function criarEdicaoCompeticao(
  idCompeticao: number,
  dados: EdicaoCompeticaoCriar
): Promise<EdicaoCompeticaoDetalhe> {
  try {
    const response = await api.post<EdicaoCompeticaoDetalhe>(`/competicoes/competicoes/${idCompeticao}/edicoes`, dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function obterEdicao(idEdicaoCompeticao: number): Promise<EdicaoCompeticaoDetalhe> {
  try {
    const response = await api.get<EdicaoCompeticaoDetalhe>(`/competicoes/edicoes/${idEdicaoCompeticao}`);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function atualizarEdicao(
  idEdicaoCompeticao: number,
  dados: EdicaoCompeticaoAtualizar
): Promise<EdicaoCompeticaoDetalhe> {
  try {
    const response = await api.put<EdicaoCompeticaoDetalhe>(`/competicoes/edicoes/${idEdicaoCompeticao}`, dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function publicarEdicao(
  idEdicaoCompeticao: number,
  publicada: boolean
): Promise<EdicaoCompeticaoDetalhe> {
  try {
    const payload: PublicacaoAtualizar = { publicada };
    const response = await api.post<EdicaoCompeticaoDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/publicar`,
      payload
    );
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function excluirEdicao(idEdicaoCompeticao: number): Promise<void> {
  try {
    await api.delete(`/competicoes/edicoes/${idEdicaoCompeticao}`);
  } catch (error) {
    normalizarErro(error);
  }
}

// ==========================================
// Elencos: Competidores
// ==========================================

export async function listarCompetidores(params?: {
  pagina?: number;
  tamanho?: number;
  busca?: string;
}): Promise<PaginaCompetidores> {
  try {
    const response = await api.get<PaginaCompetidores>('/competicoes/competidores', { params });
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function criarCompetidor(dados: CompetidorCriar): Promise<CompetidorDetalhe> {
  try {
    const response = await api.post<CompetidorDetalhe>('/competicoes/competidores', dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function importarAluno(idAluno: number): Promise<CompetidorDetalhe> {
  try {
    const payload: AlunoImportar = { id_aluno: idAluno };
    const response = await api.post<CompetidorDetalhe>('/competicoes/competidores/importar-aluno', payload);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function renomearCompetidor(idCompetidor: number, nome: string): Promise<CompetidorDetalhe> {
  try {
    const payload: CompetidorAtualizar = { nome };
    const response = await api.patch<CompetidorDetalhe>(`/competicoes/competidores/${idCompetidor}`, payload);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

// ==========================================
// Elencos: Equipes e Integrantes
// ==========================================

export async function listarEquipes(idEdicaoCompeticao: number): Promise<EquipeDetalhe[]> {
  try {
    const response = await api.get<EquipeDetalhe[]>(`/competicoes/edicoes/${idEdicaoCompeticao}/equipes`);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function criarEquipe(idEdicaoCompeticao: number, dados: EquipeCriar): Promise<EquipeDetalhe> {
  try {
    const response = await api.post<EquipeDetalhe>(`/competicoes/edicoes/${idEdicaoCompeticao}/equipes`, dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function inscreverIntegrante(idEquipe: number, dados: IntegranteCriar): Promise<IntegranteDetalhe> {
  try {
    const response = await api.post<IntegranteDetalhe>(`/competicoes/equipes/${idEquipe}/integrantes`, dados);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

/** Exclui a equipe e seus atletas (inscrições); só com a edição em rascunho. */
export async function excluirEquipe(idEquipe: number): Promise<void> {
  try {
    await api.delete(`/competicoes/equipes/${idEquipe}`);
  } catch (error) {
    normalizarErro(error);
  }
}

export async function inativarIntegrante(idIntegrante: number): Promise<IntegranteDetalhe> {
  try {
    const payload: IntegranteAtualizar = { situacao: 'INATIVO' };
    const response = await api.patch<IntegranteDetalhe>(`/competicoes/integrantes/${idIntegrante}`, payload);
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

export async function copiarEquipes(idEdicaoDestino: number, idEdicaoOrigem: number): Promise<EquipeDetalhe[]> {
  try {
    const payload: EquipesCopiar = { id_edicao_origem: idEdicaoOrigem };
    const response = await api.post<EquipeDetalhe[]>(
      `/competicoes/edicoes/${idEdicaoDestino}/copiar-equipes`,
      payload
    );
    return response.data;
  } catch (error) {
    normalizarErro(error);
  }
}

// ==========================================
// Fatia 2: Disputa e Chaveamento
// ==========================================

export async function gerarTabela(
  idEdicaoCompeticao: number,
  payload: Record<string, unknown> = {}
): Promise<EstruturaDisputaDetalhe> {
  try {
    const res = await api.post<EstruturaDisputaDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/gerar-tabela`,
      payload
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function desfazerTabela(
  idEdicaoCompeticao: number
): Promise<void> {
  try {
    await api.delete(`/competicoes/edicoes/${idEdicaoCompeticao}/tabela`);
  } catch (err) {
    normalizarErro(err);
  }
}

export async function obterDisputa(
  idEdicaoCompeticao: number
): Promise<EstruturaDisputaDetalhe> {
  try {
    const res = await api.get<EstruturaDisputaDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/disputa`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function encerrarFaseGrupos(
  idEdicaoCompeticao: number
): Promise<EstruturaDisputaDetalhe> {
  try {
    const res = await api.post<EstruturaDisputaDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/encerrar-grupos`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

// ==========================================
// Fatia 2: Partidas, Agendamento e Placar Simples
// ==========================================

export async function listarPartidas(
  idEdicaoCompeticao: number,
  filtros?: { id_grupo?: number; fase?: string; rodada?: number }
): Promise<PartidaDetalhe[]> {
  try {
    const res = await api.get<PartidaDetalhe[]>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/partidas`,
      { params: filtros }
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function agendarPartida(
  idPartida: number,
  dados: PartidaAgendar
): Promise<PartidaDetalhe> {
  try {
    const res = await api.patch<PartidaDetalhe>(
      `/competicoes/partidas/${idPartida}/agendamento`,
      dados
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function registrarResultadoSimples(
  idPartida: number,
  dados: ResultadoSimples,
  idempotencyKey?: string
): Promise<PartidaDetalhe> {
  try {
    const chave =
      idempotencyKey ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `res-${Date.now()}-${Math.random()}`);
    const res = await api.post<PartidaDetalhe>(
      `/competicoes/partidas/${idPartida}/resultado-simples`,
      dados,
      {
        headers: {
          'Idempotency-Key': chave,
        },
      }
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

// ==========================================
// Fatia 2: Classificação
// ==========================================

export async function obterClassificacao(
  idEdicaoCompeticao: number
): Promise<TabelaClassificacaoDetalhe> {
  try {
    const res = await api.get<TabelaClassificacaoDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/classificacao`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

// ==========================================
// Fatia 3: Ciclo de Vida da Edição e Fase de Grupos
// ==========================================

export async function iniciarEdicao(
  idEdicaoCompeticao: number
): Promise<EdicaoCompeticaoDetalhe> {
  try {
    const res = await api.post<EdicaoCompeticaoDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/iniciar`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function finalizarEdicao(
  idEdicaoCompeticao: number
): Promise<EdicaoCompeticaoDetalhe> {
  try {
    const res = await api.post<EdicaoCompeticaoDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/finalizar`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function reabrirEdicao(
  idEdicaoCompeticao: number,
  motivo: string
): Promise<EdicaoCompeticaoDetalhe> {
  try {
    const res = await api.post<EdicaoCompeticaoDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/reabrir`,
      { motivo }
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function cancelarEdicao(
  idEdicaoCompeticao: number,
  motivo: string
): Promise<EdicaoCompeticaoDetalhe> {
  try {
    const res = await api.post<EdicaoCompeticaoDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/cancelar`,
      { motivo }
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function reabrirFaseGrupos(
  idEdicaoCompeticao: number,
  motivo: string
): Promise<EstruturaDisputaDetalhe> {
  try {
    const res = await api.post<EstruturaDisputaDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/reabrir-fase-grupos`,
      { motivo }
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

// ==========================================
// Fatia 3: Súmula Detalhada, Ocorrências, Ciclo de Partida e Artilharia
// ==========================================

export async function obterSumula(idPartida: number): Promise<SumulaDetalhe> {
  try {
    const res = await api.get<SumulaDetalhe>(
      `/competicoes/partidas/${idPartida}/sumula`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function iniciarPartida(idPartida: number): Promise<PartidaDetalhe> {
  try {
    const res = await api.post<PartidaDetalhe>(
      `/competicoes/partidas/${idPartida}/iniciar`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function finalizarPartida(
  idPartida: number,
  dados?: PartidaFinalizar
): Promise<PartidaDetalhe> {
  try {
    const res = await api.post<PartidaDetalhe>(
      `/competicoes/partidas/${idPartida}/finalizar`,
      dados || {}
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function reabrirPartida(
  idPartida: number,
  motivo: string
): Promise<PartidaDetalhe> {
  try {
    const res = await api.post<PartidaDetalhe>(
      `/competicoes/partidas/${idPartida}/reabrir`,
      { motivo }
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function cancelarPartida(
  idPartida: number,
  motivo: string
): Promise<PartidaDetalhe> {
  try {
    const res = await api.post<PartidaDetalhe>(
      `/competicoes/partidas/${idPartida}/cancelar`,
      { motivo }
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function registrarOcorrencia(
  idPartida: number,
  dados: OcorrenciaCriar,
  idempotencyKey?: string
): Promise<SumulaDetalhe> {
  try {
    const chave =
      idempotencyKey ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `oc-${Date.now()}-${Math.random()}`);
    const res = await api.post<SumulaDetalhe>(
      `/competicoes/partidas/${idPartida}/ocorrencias`,
      dados,
      {
        headers: {
          'Idempotency-Key': chave,
        },
      }
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function atribuirAutorOcorrencia(
  idOcorrencia: number,
  dados: OcorrenciaAutorAtualizar
): Promise<SumulaDetalhe> {
  try {
    const res = await api.put<SumulaDetalhe>(
      `/competicoes/ocorrencias/${idOcorrencia}/autor`,
      dados
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function removerOcorrencia(
  idOcorrencia: number,
  motivo?: string
): Promise<SumulaDetalhe> {
  try {
    const res = await api.delete<SumulaDetalhe>(
      `/competicoes/ocorrencias/${idOcorrencia}`,
      {
        params: motivo ? { motivo } : undefined,
      }
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function obterArtilharia(
  idEdicaoCompeticao: number
): Promise<TabelaArtilhariaDetalhe> {
  try {
    const res = await api.get<TabelaArtilhariaDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/artilharia`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

// ==========================================
// Fatia 3: Disciplina e Decisões de Classificação
// ==========================================

export async function obterPainelDisciplinar(
  idEdicaoCompeticao: number
): Promise<PainelDisciplinarDetalhe> {
  try {
    const res = await api.get<PainelDisciplinarDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/disciplinar`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function criarSuspensaoManual(
  idEdicaoCompeticao: number,
  dados: SuspensaoManualCriar
): Promise<SuspensaoDetalhe> {
  try {
    const res = await api.post<SuspensaoDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/suspensoes`,
      dados
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function cumprirSuspensao(
  idSuspensao: number,
  dados: CumprimentoCriar
): Promise<SuspensaoDetalhe> {
  try {
    const res = await api.post<SuspensaoDetalhe>(
      `/competicoes/suspensoes/${idSuspensao}/cumprimentos`,
      dados
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function ajustarSuspensao(
  idSuspensao: number,
  dados: SuspensaoAjustar
): Promise<SuspensaoDetalhe> {
  try {
    const res = await api.put<SuspensaoDetalhe>(
      `/competicoes/suspensoes/${idSuspensao}`,
      dados
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function listarDecisoesClassificacao(
  idEdicaoCompeticao: number
): Promise<DecisaoClassificacaoDetalhe[]> {
  try {
    const res = await api.get<DecisaoClassificacaoDetalhe[]>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/decisoes-classificacao`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function registrarDecisaoClassificacao(
  idEdicaoCompeticao: number,
  dados: DecisaoClassificacaoCriar
): Promise<DecisaoClassificacaoDetalhe> {
  try {
    const res = await api.post<DecisaoClassificacaoDetalhe>(
      `/competicoes/edicoes/${idEdicaoCompeticao}/decisoes-classificacao`,
      dados
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

// ==========================================
// Correções dos testes manuais (contratos da T0.2; endpoints entregues em T1/T2b/T5)
// ==========================================

export async function obterPreviaExclusaoEvento(idEvento: number): Promise<PreviaExclusaoEvento> {
  try {
    const res = await api.get<PreviaExclusaoEvento>(`/competicoes/eventos/${idEvento}/exclusao/previa`);
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

/** Exclui o evento e toda a árvore (edições, competições vinculadas, jogos). Exige o nome exato. */
export async function excluirEvento(idEvento: number, confirmacaoNome: string): Promise<void> {
  try {
    const dados: EventoExcluir = { confirmacao_nome: confirmacaoNome };
    await api.delete(`/competicoes/eventos/${idEvento}`, { data: dados });
  } catch (err) {
    normalizarErro(err);
  }
}

export async function excluirEdicaoEvento(idEdicaoEvento: number, confirmacaoIdentificacao: string): Promise<void> {
  try {
    const dados: EdicaoEventoExcluir = { confirmacao_identificacao: confirmacaoIdentificacao };
    await api.delete(`/competicoes/edicoes-evento/${idEdicaoEvento}`, { data: dados });
  } catch (err) {
    normalizarErro(err);
  }
}

export async function vincularEdicaoAoEvento(
  idEdicaoEvento: number,
  idEdicaoCompeticao: number
): Promise<EdicaoEventoDetalhe> {
  try {
    const dados: VinculoEdicaoCriar = { id_edicao_competicao: idEdicaoCompeticao };
    const res = await api.post<EdicaoEventoDetalhe>(`/competicoes/edicoes-evento/${idEdicaoEvento}/vinculos`, dados);
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function desvincularEdicaoDoEvento(
  idEdicaoEvento: number,
  idEdicaoCompeticao: number
): Promise<EdicaoEventoDetalhe> {
  try {
    const res = await api.delete<EdicaoEventoDetalhe>(
      `/competicoes/edicoes-evento/${idEdicaoEvento}/vinculos/${idEdicaoCompeticao}`
    );
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function atualizarEquipe(idEquipe: number, dados: EquipeAtualizar): Promise<EquipeDetalhe> {
  try {
    const res = await api.patch<EquipeDetalhe>(`/competicoes/equipes/${idEquipe}`, dados);
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function atualizarIntegrante(idIntegrante: number, dados: IntegranteAtualizar): Promise<IntegranteDetalhe> {
  try {
    const res = await api.patch<IntegranteDetalhe>(`/competicoes/integrantes/${idIntegrante}`, dados);
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function reativarIntegrante(idIntegrante: number): Promise<IntegranteDetalhe> {
  return atualizarIntegrante(idIntegrante, { situacao: 'ATIVO' });
}

export async function listarOrigensCopiaEquipes(idEdicaoDestino: number): Promise<OrigemCopiaEquipes[]> {
  try {
    const res = await api.get<OrigemCopiaEquipes[]>(`/competicoes/edicoes/${idEdicaoDestino}/copiar-equipes/origens`);
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

export async function listarPartidasElegiveisCumprimento(idSuspensao: number): Promise<PartidaElegivelCumprimento[]> {
  try {
    const res = await api.get<PartidaElegivelCumprimento[]>(`/competicoes/suspensoes/${idSuspensao}/partidas-elegiveis`);
    return res.data;
  } catch (err) {
    normalizarErro(err);
  }
}

// ==========================================
// Objeto de Serviço Agrupado
// ==========================================

export const competicoesService = {
  // Eventos
  listarEventos,
  criarEventoComEdicao,
  obterEvento,
  atualizarEvento,
  arquivarEvento,
  criarEdicaoEvento,
  atualizarEdicaoEvento,

  // Competições e Edições
  listarCompeticoes,
  criarCompeticaoComEdicao,
  obterCompeticao,
  atualizarCompeticao,
  arquivarCompeticao,
  criarEdicaoCompeticao,
  obterEdicao,
  atualizarEdicao,
  publicarEdicao,
  excluirEdicao,
  excluirCompeticao,

  // Competidores
  listarCompetidores,
  criarCompetidor,
  importarAluno,
  renomearCompetidor,

  // Equipes e Integrantes
  listarEquipes,
  criarEquipe,
  inscreverIntegrante,
  excluirEquipe,
  inativarIntegrante,
  copiarEquipes,

  // Fatia 2: Disputa, Partidas e Classificação
  gerarTabela,
  desfazerTabela,
  obterDisputa,
  encerrarFaseGrupos,
  listarPartidas,
  agendarPartida,
  registrarResultadoSimples,
  obterClassificacao,

  // Fatia 3: Súmula, Disciplina, Artilharia, Decisões e Ciclo de Vida
  iniciarEdicao,
  finalizarEdicao,
  reabrirEdicao,
  cancelarEdicao,
  reabrirFaseGrupos,
  obterSumula,
  iniciarPartida,
  finalizarPartida,
  reabrirPartida,
  cancelarPartida,
  registrarOcorrencia,
  atribuirAutorOcorrencia,
  removerOcorrencia,
  obterArtilharia,
  obterPainelDisciplinar,
  criarSuspensaoManual,
  cumprirSuspensao,
  ajustarSuspensao,
  listarDecisoesClassificacao,
  registrarDecisaoClassificacao,

  // Correções dos testes manuais
  obterPreviaExclusaoEvento,
  excluirEvento,
  excluirEdicaoEvento,
  vincularEdicaoAoEvento,
  desvincularEdicaoDoEvento,
  atualizarEquipe,
  atualizarIntegrante,
  reativarIntegrante,
  listarOrigensCopiaEquipes,
  listarPartidasElegiveisCumprimento,
};

export const competicaoService = competicoesService;
export default competicoesService;

