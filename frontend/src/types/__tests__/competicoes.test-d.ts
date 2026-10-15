import type { Configuracao, EdicaoCompeticao } from "../competicoes";

// @ts-expect-error formato inexistente
const invalido: Configuracao = { formato: "PROVAS" };

// @ts-expect-error quantidade_grupos não existe em PONTOS_CORRIDOS
const errado: Configuracao = { formato: "PONTOS_CORRIDOS", quantidade_grupos: 4 };

const ok: Configuracao = {
  formato: "GRUPOS_MATA_MATA",
  pontuacao: { vitoria: 3, empate: 1, derrota: 0 },
  desempates: ["SALDO_GOLS"],
  quantidade_grupos: 2,
  classificados_por_grupo: 2,
  disciplina: {
    limite_amarelos: 3,
    jogos_por_acumulo: 1,
    jogos_por_vermelho: 1,
    jogos_por_segundo_amarelo: 1,
    zerar_amarelos_ao_encerrar_grupos: false,
  },
};

const edicao: EdicaoCompeticao = { ...ok } as unknown as EdicaoCompeticao;
void [invalido, errado, edicao];
