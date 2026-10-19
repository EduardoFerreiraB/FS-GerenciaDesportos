import axios from 'axios';
import api from '@/lib/api';
import type {
  ArtilhariaPublica,
  ChaveamentoPublico,
  ClassificacaoPublica,
  CompeticaoPublica,
  EdicaoPublicaDetalhe,
  EventoPublico,
  PartidaPublica,
} from '@/types/publico';

/** Intervalo da atualização periódica do portal (sem WebSocket). */
export const INTERVALO_ATUALIZACAO_MS = 30000;

const BASE = '/competicoes/publico';

async function obter<T>(caminho: string): Promise<T> {
  const resposta = await api.get<T>(`${BASE}${caminho}`);
  return resposta.data;
}

/** 404 do portal significa "não publicado ou inexistente" — nunca falha de rede. */
export function ehNaoEncontrado(erro: unknown): boolean {
  return axios.isAxiosError(erro) && erro.response?.status === 404;
}

export const servicoPublico = {
  listarCompeticoes: () => obter<CompeticaoPublica[]>('/competicoes'),
  obterCompeticao: (slug: string) => obter<CompeticaoPublica>(`/competicoes/${encodeURIComponent(slug)}`),
  listarEventos: () => obter<EventoPublico[]>('/eventos'),
  obterEvento: (slug: string) => obter<EventoPublico>(`/eventos/${encodeURIComponent(slug)}`),
  obterEdicao: (id: number) => obter<EdicaoPublicaDetalhe>(`/edicoes/${id}`),
  listarPartidas: (id: number) => obter<PartidaPublica[]>(`/edicoes/${id}/partidas`),
  obterClassificacao: (id: number) => obter<ClassificacaoPublica>(`/edicoes/${id}/classificacao`),
  obterChaveamento: (id: number) => obter<ChaveamentoPublico>(`/edicoes/${id}/chaveamento`),
  obterArtilharia: (id: number) => obter<ArtilhariaPublica>(`/edicoes/${id}/artilharia`),
};
