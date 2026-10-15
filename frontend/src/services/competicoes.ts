import api from '@/lib/api';
import {
  Competicao,
  CompeticaoCreatePayload,
  CompeticaoUpdatePayload,
  EquipeCompeticao,
  Confronto,
  InscricaoIndividual,
  Prova,
  ResultadoProva,
  ClassificacaoEquipesResponse,
  ClassificacaoIndividualResponse,
} from '@/types/competicoes';

export const competicaoService = {
  // --- Competições ---
  listarPorEdicao: async (idEdicao: number): Promise<Competicao[]> => {
    const response = await api.get(`/edicoes/${idEdicao}/competicoes`);
    return response.data;
  },

  obterPorId: async (idCompeticao: number): Promise<Competicao> => {
    const response = await api.get(`/competicoes/${idCompeticao}`);
    return response.data;
  },

  criar: async (data: CompeticaoCreatePayload & { id_edicao: number }): Promise<Competicao> => {
    const response = await api.post('/competicoes/', data);
    return response.data;
  },

  atualizar: async (idCompeticao: number, data: CompeticaoUpdatePayload): Promise<Competicao> => {
    const response = await api.put(`/competicoes/${idCompeticao}`, data);
    return response.data;
  },

  iniciar: async (idCompeticao: number): Promise<Competicao> => {
    const response = await api.post(`/competicoes/${idCompeticao}/iniciar`);
    return response.data;
  },

  excluir: async (idCompeticao: number): Promise<void> => {
    await api.delete(`/competicoes/${idCompeticao}`);
  },

  // --- Equipes de Competição (Modo EQUIPE) ---
  listarEquipes: async (idCompeticao: number): Promise<EquipeCompeticao[]> => {
    const response = await api.get(`/competicoes/${idCompeticao}/equipes`);
    return response.data;
  },

  criarEquipe: async (data: { nome: string; id_competicao: number; id_edicao?: number; grupo?: string }): Promise<EquipeCompeticao> => {
    const response = await api.post('/equipes/', data);
    return response.data;
  },

  excluirEquipe: async (idEquipe: number): Promise<void> => {
    await api.delete(`/equipes/${idEquipe}`);
  },

  // --- Confrontos (Modo EQUIPE) ---
  listarConfrontos: async (
    idCompeticao: number,
    filtros?: { fase?: string; rodada?: string; grupo?: string }
  ): Promise<Confronto[]> => {
    const params = new URLSearchParams();
    if (filtros?.fase) params.append('fase', filtros.fase);
    if (filtros?.rodada) params.append('rodada', filtros.rodada);
    if (filtros?.grupo) params.append('grupo', filtros.grupo);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/competicoes/${idCompeticao}/confrontos${query}`);
    return response.data;
  },

  gerarConfrontos: async (
    idCompeticao: number,
    data?: { fase_inicial?: string; data_inicio?: string; hora_padrao?: string; id_local_padrao?: number; id_arbitro_padrao?: number }
  ): Promise<{ message: string; total_confrontos: number; confrontos: Confronto[] }> => {
    const response = await api.post(`/competicoes/${idCompeticao}/gerar-confrontos`, data || {});
    return response.data;
  },

  criarConfronto: async (data: {
    id_competicao: number;
    id_local: number;
    id_arbitro: number;
    data: string;
    hora: string;
    fase?: string;
    rodada?: string | number;
    grupo?: string;
    id_equipe_mandante?: number;
    id_equipe_visitante?: number;
    observacoes?: string;
  }): Promise<Confronto> => {
    try {
      const response = await api.post(`/competicoes/${data.id_competicao}/confrontos`, data);
      return response.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        const response = await api.post('/confrontos/', data);
        return response.data;
      }
      throw err;
    }
  },

  atualizarConfronto: async (
    idConfronto: number,
    data: {
      placar_mandante?: number;
      placar_visitante?: number;
      status?: string;
      data?: string;
      hora?: string;
      id_local?: number;
      id_arbitro?: number;
      sumula_arquivo?: string;
      observacoes?: string;
    }
  ): Promise<Confronto> => {
    const response = await api.put(`/confrontos/${idConfronto}`, data);
    return response.data;
  },

  excluirConfronto: async (idConfronto: number): Promise<void> => {
    await api.delete(`/confrontos/${idConfronto}`);
  },

  // --- Inscrições Individuais (Modo INDIVIDUAL) ---
  listarInscricoes: async (idCompeticao: number): Promise<InscricaoIndividual[]> => {
    const response = await api.get(`/competicoes/${idCompeticao}/inscricoes`);
    return response.data;
  },

  inscreverAtleta: async (
    idCompeticao: number,
    data: { id_participante: number; numero_peito?: number }
  ): Promise<InscricaoIndividual> => {
    const response = await api.post(`/competicoes/${idCompeticao}/inscricoes`, data);
    return response.data;
  },

  removerInscricao: async (idCompeticao: number, idParticipante: number): Promise<void> => {
    await api.delete(`/competicoes/${idCompeticao}/inscricoes/${idParticipante}`);
  },

  // --- Provas (Modo INDIVIDUAL) ---
  listarProvas: async (idCompeticao: number): Promise<Prova[]> => {
    const response = await api.get(`/competicoes/${idCompeticao}/provas`);
    return response.data;
  },

  criarProva: async (
    idCompeticao: number,
    data: {
      nome: string;
      data?: string;
      hora?: string;
      id_local?: number;
      status?: string;
      observacoes?: string;
    }
  ): Promise<Prova> => {
    const response = await api.post(`/competicoes/${idCompeticao}/provas`, data);
    return response.data;
  },

  atualizarProva: async (
    idProva: number,
    data: {
      nome?: string;
      data?: string;
      hora?: string;
      id_local?: number;
      status?: string;
      observacoes?: string;
    }
  ): Promise<Prova> => {
    const response = await api.put(`/provas/${idProva}`, data);
    return response.data;
  },

  excluirProva: async (idProva: number): Promise<void> => {
    await api.delete(`/provas/${idProva}`);
  },

  // --- Resultados de Provas (Modo INDIVIDUAL) ---
  listarResultados: async (idProva: number): Promise<ResultadoProva[]> => {
    const response = await api.get(`/provas/${idProva}/resultados`);
    return response.data;
  },

  lancarResultado: async (
    idProva: number,
    data: {
      id_participante: number;
      tempo_ms: number;
      desqualificado?: boolean;
      motivo_desqualificacao?: string;
      observacoes?: string;
    }
  ): Promise<ResultadoProva> => {
    const response = await api.post(`/provas/${idProva}/resultados`, data);
    return response.data;
  },

  atualizarResultado: async (
    idResultado: number,
    data: {
      tempo_ms?: number;
      desqualificado?: boolean;
      motivo_desqualificacao?: string;
      observacoes?: string;
    },
    idProva?: number
  ): Promise<ResultadoProva> => {
    const url = idProva ? `/provas/${idProva}/resultados/${idResultado}` : `/provas/resultados/${idResultado}`;
    const response = await api.put(url, data);
    return response.data;
  },

  excluirResultado: async (idResultado: number, idProva?: number): Promise<void> => {
    const url = idProva ? `/provas/${idProva}/resultados/${idResultado}` : `/provas/resultados/${idResultado}`;
    await api.delete(url);
  },

  // --- Classificação Centralizada ---
  obterClassificacao: async (idCompeticao: number): Promise<any> => {
    const response = await api.get(`/competicoes/${idCompeticao}/classificacao`);
    return response.data;
  },

  obterClassificacaoEquipes: async (idCompeticao: number): Promise<ClassificacaoEquipesResponse> => {
    const response = await api.get(`/competicoes/${idCompeticao}/classificacao-equipes`);
    return response.data;
  },

  obterClassificacaoIndividual: async (idCompeticao: number): Promise<ClassificacaoIndividualResponse> => {
    const response = await api.get(`/competicoes/${idCompeticao}/classificacao-individual`);
    return response.data;
  },

  obterClassificacaoProva: async (idProva: number): Promise<any> => {
    const response = await api.get(`/provas/${idProva}/classificacao`);
    return response.data;
  },
};
