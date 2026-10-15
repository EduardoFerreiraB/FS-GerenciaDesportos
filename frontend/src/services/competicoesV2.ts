import api from '@/lib/api';
import {
  CompeticaoV2,
  GrupoCompeticoes,
  EquipeV2,
  JogadorV2,
  ConfrontoV2,
  OcorrenciaPartidaV2,
  ClassificacaoEquipeItem,
  ArtilheiroItem,
  DisciplinarItem,
} from '@/types/competicoesV2';

export const competicoesV2Service = {
  // ==========================================
  // 1. Grupos de Competições (Eventos Agregadores)
  // ==========================================
  listarGrupos: async (): Promise<GrupoCompeticoes[]> => {
    const response = await api.get('/v2/grupos-competicoes');
    return response.data;
  },

  obterGrupo: async (idGrupo: number): Promise<GrupoCompeticoes> => {
    const response = await api.get(`/v2/grupos-competicoes/${idGrupo}`);
    return response.data;
  },

  criarGrupo: async (data: {
    nome: string;
    slug: string;
    descricao?: string;
    data_inicio?: string;
    data_fim?: string;
    status?: string;
  }): Promise<GrupoCompeticoes> => {
    const response = await api.post('/v2/grupos-competicoes', data);
    return response.data;
  },

  // ==========================================
  // 2. Competições V2
  // ==========================================
  listarCompeticoes: async (filtros?: {
    id_modalidade?: number;
    status?: string;
    id_grupo?: number;
  }): Promise<CompeticaoV2[]> => {
    const params = new URLSearchParams();
    if (filtros?.id_modalidade) params.append('id_modalidade', filtros.id_modalidade.toString());
    if (filtros?.status) params.append('status', filtros.status);
    if (filtros?.id_grupo) params.append('id_grupo', filtros.id_grupo.toString());

    const response = await api.get(`/v2/competicoes?${params.toString()}`);
    return response.data;
  },

  obterCompeticao: async (id: number): Promise<CompeticaoV2> => {
    const response = await api.get(`/v2/competicoes/${id}`);
    return response.data;
  },

  criarCompeticao: async (data: {
    nome: string;
    id_modalidade: number;
    id_grupo?: number | null;
    id_edicao?: number | null;
    categoria?: string | null;
    modo_inscricao?: string;
    formato: string;
    criterio_resultado?: string;
    data_inicio?: string | null;
    data_fim?: string | null;
    regras_formato?: any;
  }): Promise<CompeticaoV2> => {
    const response = await api.post('/v2/competicoes', data);
    return response.data;
  },

  atualizarCompeticao: async (id: number, data: Partial<CompeticaoV2>): Promise<CompeticaoV2> => {
    const response = await api.put(`/v2/competicoes/${id}`, data);
    return response.data;
  },

  excluirCompeticao: async (id: number): Promise<void> => {
    await api.delete(`/v2/competicoes/${id}`);
  },

  // ==========================================
  // 3. Equipes e Elencos (Jogadores)
  // ==========================================
  listarEquipes: async (idCompeticao: number): Promise<EquipeV2[]> => {
    const response = await api.get(`/v2/competicoes/${idCompeticao}/equipes`);
    return response.data;
  },

  criarEquipe: async (idCompeticao: number, data: { nome: string; grupo?: string }): Promise<EquipeV2> => {
    const response = await api.post(`/v2/competicoes/${idCompeticao}/equipes`, data);
    return response.data;
  },

  listarJogadores: async (idEquipe: number): Promise<JogadorV2[]> => {
    const response = await api.get(`/v2/equipes/${idEquipe}/jogadores`);
    return response.data;
  },

  adicionarJogador: async (
    idEquipe: number,
    data: {
      nome: string;
      numero_camisa?: number | null;
      posicao?: string | null;
      documento?: string | null;
      data_nascimento?: string | null;
      foto_url?: string | null;
      ativo?: boolean;
    }
  ): Promise<JogadorV2> => {
    const response = await api.post(`/v2/equipes/${idEquipe}/jogadores`, data);
    return response.data;
  },

  removerJogador: async (idJogador: number): Promise<void> => {
    await api.delete(`/v2/jogadores/${idJogador}`);
  },

  // ==========================================
  // 4. Confrontos e Súmula Rápida
  // ==========================================
  gerarConfrontos: async (
    idCompeticao: number,
    parametros?: {
      fase_inicial?: string;
      data_inicio?: string;
      hora_padrao?: string;
      id_local_padrao?: number;
      id_arbitro_padrao?: number;
    }
  ): Promise<any> => {
    const response = await api.post(`/v2/competicoes/${idCompeticao}/gerar-confrontos`, parametros || {});
    return response.data;
  },

  listarConfrontos: async (
    idCompeticao: number,
    filtros?: { rodada?: number; fase?: string; grupo?: string }
  ): Promise<ConfrontoV2[]> => {
    const params = new URLSearchParams();
    if (filtros?.rodada) params.append('rodada', filtros.rodada.toString());
    if (filtros?.fase) params.append('fase', filtros.fase);
    if (filtros?.grupo) params.append('grupo', filtros.grupo);

    const response = await api.get(`/v2/competicoes/${idCompeticao}/confrontos?${params.toString()}`);
    return response.data;
  },

  adicionarOcorrencia: async (
    idConfronto: number,
    data: {
      id_equipe: number;
      id_jogador?: number | null;
      tipo: 'GOL' | 'GOL_CONTRA' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO';
      minuto?: number | null;
      tempo_jogo?: string | null;
      observacao?: string | null;
    }
  ): Promise<OcorrenciaPartidaV2> => {
    const response = await api.post(`/v2/confrontos/${idConfronto}/ocorrencias`, data);
    return response.data;
  },

  removerOcorrencia: async (idOcorrencia: number): Promise<void> => {
    await api.delete(`/v2/confrontos/ocorrencias/${idOcorrencia}`);
  },

  finalizarConfronto: async (
    idConfronto: number,
    data?: {
      penaltis_mandante?: number | null;
      penaltis_visitante?: number | null;
      observacoes?: string | null;
    }
  ): Promise<ConfrontoV2> => {
    const response = await api.post(`/v2/confrontos/${idConfronto}/finalizar`, data || {});
    return response.data;
  },

  // ==========================================
  // 5. Classificação, Artilharia e Disciplinar
  // ==========================================
  obterClassificacao: async (idCompeticao: number): Promise<any> => {
    const response = await api.get(`/v2/competicoes/${idCompeticao}/classificacao`);
    return response.data;
  },

  obterArtilharia: async (idCompeticao: number): Promise<ArtilheiroItem[]> => {
    const response = await api.get(`/v2/competicoes/${idCompeticao}/artilharia`);
    return response.data;
  },

  obterDisciplinar: async (idCompeticao: number): Promise<any> => {
    const response = await api.get(`/v2/competicoes/${idCompeticao}/disciplinar`);
    return response.data;
  },

  // ==========================================
  // 6. Endpoints Públicos Agregadores
  // ==========================================
  obterGrupoPublico: async (slug: string): Promise<any> => {
    const response = await api.get(`/v2/publico/grupos/${slug}`);
    return response.data;
  },

  obterCompeticaoPublica: async (idCompeticao: number): Promise<any> => {
    const response = await api.get(`/v2/publico/competicoes/${idCompeticao}`);
    return response.data;
  },

  obterJogosPublicos: async (idCompeticao: number): Promise<any[]> => {
    const response = await api.get(`/v2/publico/competicoes/${idCompeticao}/jogos`);
    return response.data;
  },

  obterClassificacaoPublica: async (idCompeticao: number): Promise<any> => {
    const response = await api.get(`/v2/publico/competicoes/${idCompeticao}/classificacao`);
    return response.data;
  },

  obterArtilhariaPublica: async (idCompeticao: number): Promise<any[]> => {
    const response = await api.get(`/v2/publico/competicoes/${idCompeticao}/artilharia`);
    return response.data;
  },
};
