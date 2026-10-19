/** Rótulos em português e tons de cor dos enums de competições (nenhum valor técnico na tela). */

export type Tom = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export type TipoEstado = 'edicao' | 'partida' | 'duelo' | 'suspensao' | 'integrante';

export const ROTULO_FORMATO: Record<string, string> = {
  PONTOS_CORRIDOS: 'Pontos corridos',
  GRUPOS_MATA_MATA: 'Grupos + mata-mata',
  MATA_MATA: 'Mata-mata',
};

export const ROTULO_ESTADO_EDICAO: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

export const ROTULO_ESTADO_PARTIDA: Record<string, string> = {
  AGENDADA: 'Agendada',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

export const ROTULO_ESTADO_DUELO: Record<string, string> = {
  PENDENTE: 'Pendente',
  DEFINIDO: 'Definido',
  RESOLVIDO: 'Resolvido',
};

export const ROTULO_SITUACAO_SUSPENSAO: Record<string, string> = {
  ATIVA: 'Ativa',
  CUMPRIDA: 'Cumprida',
  EM_REVISAO: 'Em revisão',
  CANCELADA: 'Cancelada',
};

export const ROTULO_SITUACAO_INTEGRANTE: Record<string, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
};

export const ROTULO_SITUACAO_EQUIPE: Record<string, string> = {
  ATIVA: 'Ativa',
  INATIVA: 'Inativa',
};

export const ROTULO_ORIGEM_SUSPENSAO: Record<string, string> = {
  ACUMULO_AMARELOS: 'Acúmulo de amarelos',
  VERMELHO_DIRETO: 'Vermelho direto',
  SEGUNDO_AMARELO: 'Segundo amarelo',
  MANUAL: 'Manual',
};

export const ROTULO_TIPO_OCORRENCIA: Record<string, string> = {
  GOL: 'Gol',
  GOL_CONTRA: 'Gol contra',
  CARTAO_AMARELO: 'Cartão amarelo',
  CARTAO_VERMELHO_DIRETO: 'Cartão vermelho',
  EXPULSAO_SEGUNDO_AMARELO: 'Expulsão (segundo amarelo)',
};

const ROTULO_FASE: Record<string, string> = {
  FINAL: 'Final',
  SEMIFINAL: 'Semifinal',
  QUARTAS: 'Quartas de final',
  OITAVAS: 'Oitavas de final',
  DEZESSEIS_AVOS: '16 avos de final',
  TRINTA_E_DOIS_AVOS: '32 avos de final',
  SESSENTA_E_QUATRO_AVOS: '64 avos de final',
  TERCEIRO_LUGAR: 'Disputa de 3º lugar',
  FASE_DE_GRUPOS: 'Fase de grupos',
  PONTOS_CORRIDOS: 'Pontos corridos',
};

export function rotuloFase(fase: string | null | undefined): string {
  if (!fase) return '';
  return ROTULO_FASE[fase] ?? capitalizar(fase);
}

function capitalizar(valor: string): string {
  const texto = valor.replaceAll('_', ' ').toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const TABELA_ROTULOS: Record<TipoEstado, Record<string, string>> = {
  edicao: ROTULO_ESTADO_EDICAO,
  partida: ROTULO_ESTADO_PARTIDA,
  duelo: ROTULO_ESTADO_DUELO,
  suspensao: ROTULO_SITUACAO_SUSPENSAO,
  integrante: ROTULO_SITUACAO_INTEGRANTE,
};

const TABELA_TONS: Record<TipoEstado, Record<string, Tom>> = {
  edicao: { RASCUNHO: 'neutral', EM_ANDAMENTO: 'primary', FINALIZADA: 'success', CANCELADA: 'danger' },
  partida: { AGENDADA: 'neutral', EM_ANDAMENTO: 'primary', FINALIZADA: 'success', CANCELADA: 'danger' },
  duelo: { PENDENTE: 'neutral', DEFINIDO: 'primary', RESOLVIDO: 'success' },
  suspensao: { ATIVA: 'danger', CUMPRIDA: 'success', EM_REVISAO: 'warning', CANCELADA: 'neutral' },
  integrante: { ATIVO: 'success', INATIVO: 'neutral' },
};

export function rotuloDoEstado(tipo: TipoEstado, valor: string): string {
  return TABELA_ROTULOS[tipo]?.[valor] ?? capitalizar(valor);
}

export function tomDoEstado(tipo: TipoEstado, valor: string): Tom {
  return TABELA_TONS[tipo]?.[valor] ?? 'neutral';
}
