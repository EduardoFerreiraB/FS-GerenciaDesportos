/**
 * Adaptadores puros (sem API) que convertem os tipos devolvidos pela API — administração
 * (`@/types/competicoes`) e portal (`@/types/publico`) — nas props dos componentes de `visual/`.
 *
 * - `placarDePartida(p: PartidaDetalhe): PartidaPlacar` → `CartaoPlacar`
 * - `placarDePartidaPublica(p: PartidaPublica): PartidaPlacar` → `CartaoPlacar`
 * - `duelosDaDisputa(duelos, partidas?, equipes?, grupos?): DueloChave[]` → `ChaveFases`
 * - `duelosPublicos(duelos: DueloPublico[]): DueloChave[]` → `ChaveFases`
 */
import type {
  DueloEliminatorioDetalhe,
  EquipeDetalhe,
  GrupoDisputaDetalhe,
  PartidaDetalhe,
  VagaDueloDetalhe,
} from '@/types/competicoes';
import type { DueloPublico, PartidaPublica } from '@/types/publico';
import { descreverOrigem } from '@/lib/formatos';
import { rotuloFase } from '@/lib/rotulos';
import type { PartidaPlacar } from './CartaoPlacar';
import type { DueloChave, VagaChave } from './ChaveFases';

/** Campos legados que algumas respostas da API ainda trazem junto de `PartidaDetalhe`. */
type PartidaComLegado = PartidaDetalhe & {
  data?: string | null;
  hora?: string | null;
  ordem_jogo?: number;
  estado?: string;
};

export function placarDePartida(partida: PartidaDetalhe): PartidaPlacar {
  const p = partida as PartidaComLegado;
  const status = p.status || p.estado || 'AGENDADA';
  const gm = p.placar?.gols_mandante ?? 0;
  const gv = p.placar?.gols_visitante ?? 0;
  const mostraPlacar = status === 'FINALIZADA' || status === 'EM_ANDAMENTO' || gm > 0 || gv > 0;

  let hora = p.hora ?? null;
  if (!hora && p.data_hora && p.data_hora.includes('T')) hora = p.data_hora.split('T')[1] || null;

  return {
    numero: p.numero_partida || p.ordem_jogo || p.id_partida,
    mandante: { nome: p.nome_mandante, sigla: p.sigla_mandante },
    visitante: { nome: p.nome_visitante, sigla: p.sigla_visitante },
    golsMandante: mostraPlacar ? gm : null,
    golsVisitante: mostraPlacar ? gv : null,
    penaltisMandante: p.placar?.penaltis_mandante ?? null,
    penaltisVisitante: p.placar?.penaltis_visitante ?? null,
    status,
    data: p.data || p.data_hora || null,
    hora,
    local: p.local ?? null,
    campo: p.campo ?? null,
  };
}

export function placarDePartidaPublica(p: PartidaPublica): PartidaPlacar {
  return {
    numero: null,
    mandante: { nome: p.nome_mandante },
    visitante: { nome: p.nome_visitante },
    golsMandante: p.gols_mandante,
    golsVisitante: p.gols_visitante,
    penaltisMandante: p.penaltis_mandante,
    penaltisVisitante: p.penaltis_visitante,
    status: p.estado,
    data: p.data,
    hora: p.hora,
    local: p.local,
    campo: null,
  };
}

// ------------------------------------------------------------------
// Chaveamento (administração)
// ------------------------------------------------------------------

type DueloComLegado = DueloEliminatorioDetalhe & { posicao_chave?: number; estado?: string; ida_volta?: boolean };
type VagaComLegado = VagaDueloDetalhe & {
  origem?: string;
  posicao_grupo?: number;
  nome_grupo?: string;
  posicao_duelo_origem?: number;
  id_equipe_resolvida?: number;
};

function ordemDoDuelo(d: DueloEliminatorioDetalhe): number {
  return (d as DueloComLegado).posicao_chave ?? d.ordem_na_fase ?? 1;
}

function descreverDueloOrigem(id: number | null | undefined, duelos: DueloEliminatorioDetalhe[]): string | null {
  if (id == null) return null;
  const origem = duelos.find((d) => d.id_duelo === id);
  if (!origem) return `jogo ${id}`;
  const naFase = duelos.filter((d) => d.fase === origem.fase).length;
  const rotulo = rotuloFase(origem.fase.toUpperCase());
  return naFase > 1 ? `${rotulo} ${ordemDoDuelo(origem)}` : rotulo;
}

function vagaDaDisputa(
  vaga: VagaDueloDetalhe | undefined,
  duelos: DueloEliminatorioDetalhe[],
  equipes: Map<number, EquipeDetalhe>,
  grupos: GrupoDisputaDetalhe[],
): VagaChave {
  if (!vaga) return { pendente: 'A definir' };
  const v = vaga as VagaComLegado;
  const idEquipe = vaga.id_equipe ?? v.id_equipe_resolvida ?? null;

  if (idEquipe != null) {
    const equipe = equipes.get(idEquipe);
    return {
      idEquipe,
      nome: equipe?.nome ?? vaga.nome_equipe ?? `Equipe #${idEquipe}`,
      sigla: equipe?.sigla ?? null,
    };
  }
  if (vaga.nome_equipe) return { idEquipe: null, nome: vaga.nome_equipe };

  const origem = (v.origem || vaga.origem_tipo || '').toUpperCase();
  const idOrigem = v.posicao_duelo_origem ?? vaga.origem_id;

  if (origem.includes('GRUPO') || v.posicao_grupo != null) {
    const grupo = grupos.find((g) => g.id_grupo === vaga.origem_id);
    const nomeGrupo = grupo?.nome ?? (v.nome_grupo ? `Grupo ${v.nome_grupo}` : 'grupo');
    return { pendente: v.posicao_grupo != null ? `${v.posicao_grupo}º do ${nomeGrupo}` : `Classificado do ${nomeGrupo}` };
  }
  if (origem.includes('VENCEDOR')) {
    const desc = descreverDueloOrigem(idOrigem, duelos);
    return { pendente: desc ? `Vencedor de ${desc}` : 'Aguardando vencedor' };
  }
  if (origem.includes('PERDEDOR')) {
    const desc = descreverDueloOrigem(idOrigem, duelos);
    return { pendente: desc ? `Perdedor de ${desc}` : 'Aguardando perdedor' };
  }
  if (origem.includes('FOLGA')) return { pendente: 'Folga (avança direto)' };
  return { pendente: 'A definir' };
}

/** Soma os placares das partidas finalizadas do duelo na ordem das vagas (jogo único ou ida e volta). */
function aplicarPlacar(vagas: VagaChave[], partidasDuelo: PartidaDetalhe[]): string | null {
  const [v1, v2] = vagas;
  if (!v1 || !v2) return null;
  const finalizadas = partidasDuelo.filter((p) => p.placar && p.status === 'FINALIZADA');
  if (finalizadas.length === 0) return null;

  if (partidasDuelo.length === 1) {
    const p = finalizadas[0];
    const invertido = v1.idEquipe != null && p.id_equipe_visitante === v1.idEquipe;
    v1.gols = invertido ? p.placar.gols_visitante : p.placar.gols_mandante;
    v2.gols = invertido ? p.placar.gols_mandante : p.placar.gols_visitante;
    v1.penaltis = invertido ? p.placar.penaltis_visitante : p.placar.penaltis_mandante;
    v2.penaltis = invertido ? p.placar.penaltis_mandante : p.placar.penaltis_visitante;
    return null;
  }

  let t1 = 0;
  let t2 = 0;
  for (const p of partidasDuelo.slice(0, 2)) {
    if (!p.placar || p.status !== 'FINALIZADA') continue;
    if (p.id_equipe_mandante === v1.idEquipe) {
      t1 += p.placar.gols_mandante;
      t2 += p.placar.gols_visitante;
    } else {
      t1 += p.placar.gols_visitante;
      t2 += p.placar.gols_mandante;
    }
  }
  v1.gols = t1;
  v2.gols = t2;
  return `Agregado ${t1} × ${t2}`;
}

export function duelosDaDisputa(
  duelos: DueloEliminatorioDetalhe[],
  partidas: PartidaDetalhe[] = [],
  equipes: EquipeDetalhe[] = [],
  grupos: GrupoDisputaDetalhe[] = [],
): DueloChave[] {
  const mapaEquipes = new Map(equipes.map((e) => [e.id_equipe, e]));
  const porDuelo = new Map<number, PartidaDetalhe[]>();
  for (const p of partidas) {
    if (p.id_duelo == null) continue;
    porDuelo.set(p.id_duelo, [...(porDuelo.get(p.id_duelo) ?? []), p]);
  }

  return duelos.map((duelo) => {
    const d = duelo as DueloComLegado;
    const ordenadas = [...(duelo.vagas ?? [])].sort((a, b) => a.posicao - b.posicao);
    const vagas = [ordenadas[0], ordenadas[1]].map((v) => vagaDaDisputa(v, duelos, mapaEquipes, grupos));
    const detalhe = aplicarPlacar(vagas, porDuelo.get(duelo.id_duelo) ?? []);
    const bruto = (duelo.status || d.estado || 'PENDENTE').toUpperCase();
    const status = duelo.id_equipe_vencedora != null || bruto === 'FINALIZADA' ? 'RESOLVIDO' : bruto;

    return {
      id: duelo.id_duelo,
      fase: duelo.fase,
      ordem: ordemDoDuelo(duelo),
      status,
      idaVolta: Boolean(duelo.ida_e_volta ?? d.ida_volta),
      idVencedor: duelo.id_equipe_vencedora ?? null,
      detalhe,
      vagas,
    };
  });
}

// ------------------------------------------------------------------
// Chaveamento (portal)
// ------------------------------------------------------------------

export function duelosPublicos(duelos: DueloPublico[]): DueloChave[] {
  return duelos.map((d) => ({
    id: d.id_duelo,
    fase: d.fase,
    ordem: d.posicao_chave,
    status: d.estado,
    idaVolta: d.ida_volta,
    idVencedor: d.id_equipe_vencedora,
    vagas: [...d.vagas]
      .sort((a, b) => a.posicao - b.posicao)
      .map((v) => ({
        idEquipe: v.id_equipe,
        nome: v.nome_equipe,
        pendente: descreverOrigem(v.descricao_origem) ?? 'A definir',
      })),
  }));
}
