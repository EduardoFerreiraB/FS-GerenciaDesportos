/**
 * Leitura única dos erros da API para as telas.
 *
 * Formatos aceitos:
 * - Competições: `{ codigo, mensagem, campos, detalhes: [{ campo, mensagem }] }`.
 * - Escolinha (FastAPI padrão): `{ detail: "texto" }` ou `{ detail: [{ loc, msg, type }] }`.
 * - Erro com código fora de /competicoes (ex.: troca de senha): `{ detail, codigo }`.
 * - Sem resposta (servidor fora do ar, rede): mensagem de conexão.
 */

export const MENSAGEM_SEM_CONEXAO = 'Não foi possível conectar ao servidor.';
export const MENSAGEM_PADRAO = 'Não foi possível concluir a operação. Tente novamente.';

export interface ErroExtraido {
  /** Texto para o alerta do topo do formulário ou para a notificação. Nunca vazio. */
  mensagem: string;
  /** Mensagem por campo (caminho com pontos, ex.: "edicao.data_fim"). */
  campos: Record<string, string>;
  /** Código estável da API quando houver (ex.: "DUPLICIDADE"). */
  codigo?: string;
  /** Status HTTP quando houve resposta. */
  status?: number;
}

export interface OpcoesExtrairErro {
  /**
   * Campos que a tela sabe mostrar abaixo do input. Detalhes de campos fora desta lista
   * entram no texto de `mensagem` para não serem descartados. Sem a lista, todos os
   * detalhes entram em `campos` e também em `mensagem`.
   */
  camposConhecidos?: readonly string[];
  /** Mensagem quando a resposta não traz texto utilizável. */
  padrao?: string;
}

interface DetalheCampo {
  campo: string;
  mensagem: string;
}

const MENSAGENS_PYDANTIC: Record<string, string> = {
  missing: 'Campo obrigatório.',
  string_too_short: 'Texto muito curto.',
  string_too_long: 'Texto muito longo.',
  greater_than_equal: 'Valor abaixo do mínimo.',
  greater_than: 'Valor abaixo do mínimo.',
  less_than_equal: 'Valor acima do máximo.',
  less_than: 'Valor acima do máximo.',
  int_parsing: 'Informe um número inteiro.',
  date_parsing: 'Informe uma data válida.',
  enum: 'Opção inválida.',
};

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

/** Converte a lista de erros padrão do FastAPI em detalhes por campo. */
function detalhesPydantic(lista: unknown[]): DetalheCampo[] {
  return lista.filter(ehObjeto).map((item) => {
    const loc = Array.isArray(item.loc) ? item.loc.map(String) : [];
    const caminho = ['body', 'query', 'path', 'header', 'cookie'].includes(loc[0] ?? '') ? loc.slice(1) : loc;
    const tipo = typeof item.type === 'string' ? item.type : '';
    const msg = texto(item.msg)?.replace(/^Value error, /, '');
    return {
      campo: caminho.join('.') || 'requisicao',
      mensagem: tipo === 'value_error' && msg ? msg : MENSAGENS_PYDANTIC[tipo] ?? msg ?? 'Valor inválido.',
    };
  });
}

function rotuloCampo(campo: string): string {
  const ultimo = campo.split('.').pop() ?? campo;
  const legivel = ultimo.replace(/_/g, ' ');
  return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}

export function extrairErro(erro: unknown, opcoes: OpcoesExtrairErro = {}): ErroExtraido {
  const padrao = opcoes.padrao ?? MENSAGEM_PADRAO;
  // `ApiError` de services/competicoes já vem normalizado: trata como corpo de resposta.
  const jaNormalizado = ehObjeto(erro) && !ehObjeto(erro.response) && 'codigo' in erro && 'mensagem' in erro;
  const resposta = jaNormalizado
    ? { status: (erro as Record<string, unknown>).status, data: erro }
    : ehObjeto(erro) && ehObjeto(erro.response) ? erro.response : undefined;

  if (!resposta) {
    // Axios sem resposta = rede/servidor; qualquer outro erro inesperado usa o padrão.
    const ehAxios = ehObjeto(erro) && (erro.isAxiosError === true || 'request' in erro);
    return { mensagem: ehAxios ? MENSAGEM_SEM_CONEXAO : padrao, campos: {} };
  }

  const status = typeof resposta.status === 'number' ? resposta.status : undefined;
  const dados = resposta.data;
  let mensagem: string | undefined;
  let codigo: string | undefined;
  let detalhes: DetalheCampo[] = [];

  if (ehObjeto(dados)) {
    codigo = texto(dados.codigo);
    if (Array.isArray(dados.detalhes)) {
      detalhes = dados.detalhes
        .filter(ehObjeto)
        .map((d) => ({ campo: String(d.campo ?? ''), mensagem: texto(d.mensagem) ?? 'Valor inválido.' }));
    }
    if (Array.isArray(dados.detail)) {
      detalhes = detalhesPydantic(dados.detail);
      mensagem = 'Dados inválidos. Verifique os campos destacados.';
    }
    mensagem = texto(dados.mensagem) ?? texto(dados.detail) ?? mensagem;
  }
  // Corpo que não é JSON (ex.: página HTML de erro 500) não serve como mensagem.

  const campos: Record<string, string> = {};
  const soltos: string[] = [];
  for (const { campo, mensagem: msg } of detalhes) {
    const conhecido = opcoes.camposConhecidos ? opcoes.camposConhecidos.includes(campo) : true;
    if (conhecido && campo) campos[campo] = msg;
    if (!opcoes.camposConhecidos || !conhecido) soltos.push(campo ? `${rotuloCampo(campo)}: ${msg}` : msg);
  }

  const partes = [mensagem ?? padrao, ...soltos.filter((s) => s !== mensagem)];
  return { mensagem: partes.join(' '), campos, codigo, status };
}
