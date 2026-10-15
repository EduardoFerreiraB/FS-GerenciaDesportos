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
} from '@/types/competicoes';

// ==========================================
// Tratamento de Erros da API
// ==========================================

export class ApiError extends Error implements ErroApi {
  codigo: string;
  mensagem: string;
  campos?: string[];

  constructor(erro: ErroApi) {
    super(erro.mensagem);
    this.name = 'ApiError';
    this.codigo = erro.codigo;
    this.mensagem = erro.mensagem;
    this.campos = erro.campos;
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
      });
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

  // Competidores
  listarCompetidores,
  criarCompetidor,
  importarAluno,
  renomearCompetidor,

  // Equipes e Integrantes
  listarEquipes,
  criarEquipe,
  inscreverIntegrante,
  inativarIntegrante,
  copiarEquipes,
};

export const competicaoService = competicoesService;
export default competicoesService;
