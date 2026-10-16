'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  obterDisputa,
  listarEquipes,
  listarPartidas,
  isErroApi,
} from '@/services/competicoes';
import type {
  EstruturaDisputaDetalhe,
  DueloEliminatorioDetalhe,
  VagaDueloDetalhe,
  EquipeDetalhe,
  PartidaDetalhe,
} from '@/types/competicoes';
import {
  Trophy,
  GitFork,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  Calendar,
  MapPin,
  ArrowRight,
  Medal,
  Layers,
} from 'lucide-react';

interface ChaveamentoEliminatorioProps {
  idEdicaoCompeticao: number;
}

// Ordem canônica de progressão das fases eliminatórias (da mais antiga até a grande final)
const ORDEM_FASES: Record<string, number> = {
  SESSENTA_E_QUATRO_AVOS: 1,
  TRINTA_E_DOIS_AVOS: 2,
  DEZESSEIS_AVOS: 3,
  OITAVAS: 4,
  QUARTAS: 5,
  SEMIFINAL: 6,
  FINAL: 7,
};

const NOMES_FASES_FORMATADOS: Record<string, string> = {
  SESSENTA_E_QUATRO_AVOS: '64 avos de Final',
  TRINTA_E_DOIS_AVOS: '32 avos de Final',
  DEZESSEIS_AVOS: '16 avos de Final',
  OITAVAS: 'Oitavas de Final',
  QUARTAS: 'Quartas de Final',
  SEMIFINAL: 'Semifinais',
  FINAL: 'Grande Final',
  TERCEIRO_LUGAR: 'Disputa de 3º Lugar',
};

export default function ChaveamentoEliminatorio({
  idEdicaoCompeticao,
}: ChaveamentoEliminatorioProps) {
  const [disputa, setDisputa] = useState<EstruturaDisputaDetalhe | null>(null);
  const [equipes, setEquipes] = useState<EquipeDetalhe[]>([]);
  const [partidas, setPartidas] = useState<PartidaDetalhe[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarChaveamento = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      // Carrega estrutura de disputa, equipes (para mapear nomes) e partidas (para scores)
      const [dadosDisputa, dadosEquipes, dadosPartidas] = await Promise.all([
        obterDisputa(idEdicaoCompeticao),
        listarEquipes(idEdicaoCompeticao).catch(() => [] as EquipeDetalhe[]),
        listarPartidas(idEdicaoCompeticao).catch(() => [] as PartidaDetalhe[]),
      ]);

      setDisputa(dadosDisputa);
      setEquipes(dadosEquipes);
      setPartidas(dadosPartidas);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar o chaveamento eliminatório.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarChaveamento();
  }, [carregarChaveamento]);

  // Mapa de equipes por ID para resolução rápida de nomes e siglas
  const equipesMap = useMemo(() => {
    const mapa = new Map<number, EquipeDetalhe>();
    for (const eq of equipes) {
      mapa.set(eq.id_equipe, eq);
    }
    return mapa;
  }, [equipes]);

  // Mapa de partidas por ID de duelo
  const partidasPorDuelo = useMemo(() => {
    const mapa = new Map<number, PartidaDetalhe[]>();
    for (const p of partidas) {
      if (p.id_duelo != null) {
        const lista = mapa.get(p.id_duelo) || [];
        lista.push(p);
        mapa.set(p.id_duelo, lista);
      }
    }
    return mapa;
  }, [partidas]);

  // Organização dos duelos por fase
  const { fasesOrdenadas, duelosTerceiroLugar, temDuelos } = useMemo(() => {
    const todosDuelos = disputa?.duelos || [];
    if (todosDuelos.length === 0) {
      return { fasesOrdenadas: [], duelosTerceiroLugar: [], temDuelos: false };
    }

    const gruposFase = new Map<string, DueloEliminatorioDetalhe[]>();
    const terceiroLugar: DueloEliminatorioDetalhe[] = [];

    for (const d of todosDuelos) {
      const faseUpper = d.fase.toUpperCase();
      if (faseUpper === 'TERCEIRO_LUGAR') {
        terceiroLugar.push(d);
      } else {
        const lista = gruposFase.get(faseUpper) || [];
        lista.push(d);
        gruposFase.set(faseUpper, lista);
      }
    }

    // Ordena as fases na sequência do torneio
    const chavesFases = Array.from(gruposFase.keys()).sort((a, b) => {
      const ordemA = ORDEM_FASES[a] ?? 99;
      const ordemB = ORDEM_FASES[b] ?? 99;
      return ordemA - ordemB;
    });

    // Dentro de cada fase, ordena duelos pela posição da chave
    const ordenadas = chavesFases.map((fase) => {
      const duelos = gruposFase.get(fase) || [];
      duelos.sort((a, b) => {
        const ordemA = (a as unknown as { posicao_chave?: number }).posicao_chave ?? a.ordem_na_fase ?? 0;
        const ordemB = (b as unknown as { posicao_chave?: number }).posicao_chave ?? b.ordem_na_fase ?? 0;
        return ordemA - ordemB;
      });
      return {
        fase,
        nomeFormatado: NOMES_FASES_FORMATADOS[fase] || fase.replace(/_/g, ' '),
        duelos,
      };
    });

    return {
      fasesOrdenadas: ordenadas,
      duelosTerceiroLugar: terceiroLugar,
      temDuelos: true,
    };
  }, [disputa?.duelos]);

  if (carregando) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Carregando chaveamento eliminatório...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <div>
          <h4 className="font-bold text-red-800">Erro ao carregar chaveamento</h4>
          <p className="text-sm text-red-600 mt-1">{erro}</p>
        </div>
        <button
          type="button"
          onClick={carregarChaveamento}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  // Se não houver duelos gerados ou formato não eliminatório
  if (!temDuelos) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <GitFork className="w-7 h-7" />
        </div>
        <h4 className="font-bold text-slate-800 text-lg">Chaveamento Eliminatório Indisponível</h4>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Não há duelos eliminatórios cadastrados nesta edição. Competições exclusivamente de pontos
          corridos não possuem mata-mata, ou a tabela de confrontos ainda não foi gerada no sistema.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Chaveamento Eliminatório" className="space-y-6">
      {/* Cabeçalho do Chaveamento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Chaveamento Eliminatório (Mata-Mata)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe o caminho dos confrontos desde as fases classificatórias até a grande decisão.
          </p>
        </div>

        <button
          type="button"
          onClick={carregarChaveamento}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          title="Atualizar chaveamento"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Diagrama Visual de Bracket Esportivo (Scroll Horizontal) */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-inner overflow-x-auto">
        <div className="flex items-stretch gap-8 min-w-max pb-4">
          {fasesOrdenadas.map((faseInfo, idxFase) => {
            const ehUltimaFase = idxFase === fasesOrdenadas.length - 1;

            return (
              <div key={faseInfo.fase} className="flex flex-col min-w-[280px] max-w-[320px]">
                {/* Cabeçalho da Fase */}
                <div className="mb-4 text-center">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-xs ${
                      ehUltimaFase
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {ehUltimaFase && <Trophy className="w-3.5 h-3.5 text-amber-600" />}
                    <span>{faseInfo.nomeFormatado}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {faseInfo.duelos.length} {faseInfo.duelos.length === 1 ? 'confronto' : 'confrontos'}
                  </p>
                </div>

                {/* Coluna de Duelos alinhados verticalmente */}
                <div className="flex flex-col justify-around flex-1 gap-6">
                  {faseInfo.duelos.map((duelo) => {
                    const partidasDuelo = partidasPorDuelo.get(duelo.id_duelo) || [];

                    return (
                      <CardDuelo
                        key={duelo.id_duelo}
                        duelo={duelo}
                        equipesMap={equipesMap}
                        partidasDuelo={partidasDuelo}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Disputa de 3º Lugar (caso exista) */}
      {duelosTerceiroLugar.length > 0 && (
        <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Medal className="w-5 h-5 text-amber-600" />
            <div>
              <h4 className="font-bold text-amber-900 text-base">
                Disputa de 3º Lugar (Medalha de Bronze)
              </h4>
              <p className="text-xs text-amber-700">
                Confronto entre os semifinalistas que não avançaram para a grande final.
              </p>
            </div>
          </div>

          <div className="max-w-md">
            {duelosTerceiroLugar.map((duelo) => (
              <CardDuelo
                key={duelo.id_duelo}
                duelo={duelo}
                equipesMap={equipesMap}
                partidasDuelo={partidasPorDuelo.get(duelo.id_duelo) || []}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ==========================================
// Subcomponente: Card Individual de Duelo
// ==========================================

interface CardDueloProps {
  duelo: DueloEliminatorioDetalhe;
  equipesMap: Map<number, EquipeDetalhe>;
  partidasDuelo: PartidaDetalhe[];
}

function CardDuelo({ duelo, equipesMap, partidasDuelo }: CardDueloProps) {
  const dAny = duelo as unknown as {
    posicao_chave?: number;
    estado?: string;
    ida_volta?: boolean;
  };

  const posicaoChave = dAny.posicao_chave ?? duelo.ordem_na_fase ?? 1;
  const status = (duelo.status || dAny.estado || 'PENDENTE').toUpperCase();
  const idaVolta = Boolean(duelo.ida_e_volta ?? dAny.ida_volta);
  const idVencedor = duelo.id_equipe_vencedora;

  // Garante a ordenação das 2 vagas (posição 1 e posição 2)
  const vagas = [...(duelo.vagas || [])].sort((a, b) => a.posicao - b.posicao);
  const vaga1: VagaDueloDetalhe | undefined = vagas[0];
  const vaga2: VagaDueloDetalhe | undefined = vagas[1];

  const part1Info = extrairParticipanteInfo(vaga1, equipesMap);
  const part2Info = extrairParticipanteInfo(vaga2, equipesMap);

  // Computa placar se houver partidas associadas
  const placar = extrairPlacarDuelo(partidasDuelo, part1Info.idEquipe, part2Info.idEquipe);

  // Status visual do duelo
  const ehResolvido = status === 'RESOLVIDO' || status === 'FINALIZADA' || Boolean(idVencedor);
  const ehEmAndamento = status === 'EM_ANDAMENTO';

  return (
    <article
      aria-label={`Duelo ${duelo.id_duelo}`}
      className="bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition overflow-hidden"
    >
      {/* Cabeçalho do Card */}
      <header className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
          <span>Jogo {posicaoChave}</span>
          <span className="text-slate-300">•</span>
          <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded font-medium">
            {idaVolta ? 'Ida e Volta' : 'Jogo Único'}
          </span>
        </div>

        {/* Badge de Status */}
        <div>
          {ehResolvido ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              <span>Resolvido</span>
            </span>
          ) : ehEmAndamento ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 animate-pulse">
              <Clock className="w-3 h-3" />
              <span>Em jogo</span>
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Pendente
            </span>
          )}
        </div>
      </header>

      {/* Participantes */}
      <div className="divide-y divide-slate-100 text-xs">
        {/* Participante 1 */}
        <LinhaParticipante
          info={part1Info}
          ehVencedor={Boolean(idVencedor && part1Info.idEquipe === idVencedor)}
          ehPerdedor={Boolean(idVencedor && part1Info.idEquipe && part1Info.idEquipe !== idVencedor)}
          score={placar?.scoreMandante}
          scorePenaltis={placar?.penaltisMandante}
        />

        {/* Participante 2 */}
        <LinhaParticipante
          info={part2Info}
          ehVencedor={Boolean(idVencedor && part2Info.idEquipe === idVencedor)}
          ehPerdedor={Boolean(idVencedor && part2Info.idEquipe && part2Info.idEquipe !== idVencedor)}
          score={placar?.scoreVisitante}
          scorePenaltis={placar?.penaltisVisitante}
        />
      </div>

      {/* Rodapé / Informação da Partida */}
      {placar?.infoExtra && (
        <footer className="px-3 py-1 bg-slate-50/60 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
          <span>{placar.infoExtra}</span>
          {placar.detalheAgregado && (
            <span className="font-semibold text-slate-600">{placar.detalheAgregado}</span>
          )}
        </footer>
      )}
    </article>
  );
}

// ==========================================
// Subcomponente: Linha do Participante no Duelo
// ==========================================

interface LinhaParticipanteProps {
  info: {
    nome: string;
    sigla?: string | null;
    resolvido: boolean;
    idEquipe?: number | null;
  };
  ehVencedor: boolean;
  ehPerdedor: boolean;
  score?: number | string | null;
  scorePenaltis?: number | null;
}

function LinhaParticipante({
  info,
  ehVencedor,
  ehPerdedor,
  score,
  scorePenaltis,
}: LinhaParticipanteProps) {
  return (
    <div
      className={`px-3 py-2 flex items-center justify-between gap-2 transition ${
        ehVencedor
          ? 'bg-emerald-50/70 text-emerald-950 font-bold border-l-4 border-l-emerald-500'
          : ehPerdedor
          ? 'text-slate-400 opacity-80'
          : 'text-slate-700'
      }`}
    >
      <div className="flex items-center gap-1.5 truncate">
        {ehVencedor && (
          <Trophy className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        )}

        <span
          className={`truncate ${
            !info.resolvido ? 'italic text-slate-400 text-[11px]' : 'font-medium'
          }`}
          title={info.nome}
        >
          {info.nome}
        </span>

        {info.sigla && info.resolvido && (
          <span className="text-[10px] text-slate-400 font-normal">({info.sigla})</span>
        )}
      </div>

      {/* Score / Placar */}
      <div className="flex items-center gap-1 flex-shrink-0 font-bold">
        {scorePenaltis != null && (
          <span className="text-[10px] text-slate-400 font-normal">
            ({scorePenaltis})
          </span>
        )}
        {score != null ? (
          <span
            className={`w-5 text-center text-xs px-1 py-0.5 rounded ${
              ehVencedor ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {score}
          </span>
        ) : (
          <span className="text-slate-300 text-xs px-1">-</span>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Helpers de Resolução de Participantes e Placares
// ==========================================

function extrairParticipanteInfo(
  vaga: VagaDueloDetalhe | undefined,
  equipesMap: Map<number, EquipeDetalhe>
): { nome: string; sigla?: string | null; resolvido: boolean; idEquipe?: number | null } {
  if (!vaga) {
    return { nome: 'Aguardando definição', resolvido: false, idEquipe: null };
  }

  const vAny = vaga as unknown as {
    origem?: string;
    posicao_grupo?: number;
    nome_grupo?: string;
    fase_origem?: string;
    posicao_duelo_origem?: number;
    id_equipe_resolvida?: number;
  };

  const idEquipe = vaga.id_equipe ?? vAny.id_equipe_resolvida ?? null;

  if (idEquipe != null) {
    const equipe = equipesMap.get(idEquipe);
    if (equipe) {
      return { nome: equipe.nome, sigla: equipe.sigla, resolvido: true, idEquipe };
    }
    if (vaga.nome_equipe) {
      return { nome: vaga.nome_equipe, resolvido: true, idEquipe };
    }
    return { nome: `Equipe #${idEquipe}`, resolvido: true, idEquipe };
  }

  if (vaga.nome_equipe) {
    return { nome: vaga.nome_equipe, resolvido: true, idEquipe: null };
  }

  // Se não foi resolvida a equipe, gera o placeholder descritivo
  const origem = (vAny.origem || vaga.origem_tipo || '').toUpperCase();
  const posGrupo = vAny.posicao_grupo;
  const nomeGrupo = vAny.nome_grupo;
  const posDuelo = vAny.posicao_duelo_origem ?? vaga.origem_id;

  if (origem.includes('GRUPO') || posGrupo != null) {
    const prefixo = posGrupo != null ? `${posGrupo}º ` : '';
    const rotuloGrupo = nomeGrupo ? `Grupo ${nomeGrupo}` : (vaga.origem_id ? `Grupo #${vaga.origem_id}` : 'Grupo');
    return { nome: `${prefixo}${rotuloGrupo}`, resolvido: false, idEquipe: null };
  }

  if (origem.includes('VENCEDOR') || origem === 'DUELO_VENCEDOR') {
    if (posDuelo) {
      return { nome: `Venc. Jogo ${posDuelo}`, resolvido: false, idEquipe: null };
    }
    return { nome: 'Aguardando Vencedor', resolvido: false, idEquipe: null };
  }

  if (origem.includes('PERDEDOR') || origem === 'DUELO_PERDEDOR') {
    if (posDuelo) {
      return { nome: `Perd. Jogo ${posDuelo}`, resolvido: false, idEquipe: null };
    }
    return { nome: 'Aguardando Perdedor', resolvido: false, idEquipe: null };
  }

  if (origem.includes('FOLGA')) {
    return { nome: 'Folga (Avança direto)', resolvido: false, idEquipe: null };
  }

  return { nome: 'A definir', resolvido: false, idEquipe: null };
}

function extrairPlacarDuelo(
  partidasDuelo: PartidaDetalhe[],
  idEquipe1?: number | null,
  idEquipe2?: number | null
): {
  scoreMandante: number | string | null;
  scoreVisitante: number | string | null;
  penaltisMandante?: number | null;
  penaltisVisitante?: number | null;
  infoExtra?: string;
  detalheAgregado?: string;
} | null {
  if (!partidasDuelo || partidasDuelo.length === 0) {
    return null;
  }

  // Jogo único
  if (partidasDuelo.length === 1) {
    const p = partidasDuelo[0];
    const temPlacar = p.placar && p.status === 'FINALIZADA';
    if (!temPlacar) {
      return null;
    }

    // Alinha score com a ordem dos participantes vaga1 e vaga2
    let s1 = p.placar.gols_mandante;
    let s2 = p.placar.gols_visitante;
    let p1 = p.placar.penaltis_mandante;
    let p2 = p.placar.penaltis_visitante;

    if (idEquipe1 && p.id_equipe_visitante === idEquipe1) {
      // Inverteu mando
      s1 = p.placar.gols_visitante;
      s2 = p.placar.gols_mandante;
      p1 = p.placar.penaltis_visitante;
      p2 = p.placar.penaltis_mandante;
    }

    return {
      scoreMandante: s1,
      scoreVisitante: s2,
      penaltisMandante: p1,
      penaltisVisitante: p2,
      infoExtra: p.status === 'FINALIZADA' ? 'Placar Final' : 'Em andamento',
    };
  }

  // Ida e volta (2 partidas)
  if (partidasDuelo.length >= 2) {
    const p1 = partidasDuelo[0];
    const p2 = partidasDuelo[1];

    let totalEq1 = 0;
    let totalEq2 = 0;
    let jogado = false;

    for (const p of [p1, p2]) {
      if (p.placar && p.status === 'FINALIZADA') {
        jogado = true;
        if (p.id_equipe_mandante === idEquipe1) {
          totalEq1 += p.placar.gols_mandante;
          totalEq2 += p.placar.gols_visitante;
        } else {
          totalEq1 += p.placar.gols_visitante;
          totalEq2 += p.placar.gols_mandante;
        }
      }
    }

    if (!jogado) return null;

    return {
      scoreMandante: totalEq1,
      scoreVisitante: totalEq2,
      detalheAgregado: `Agregado: ${totalEq1} x ${totalEq2}`,
      infoExtra: 'Ida e Volta',
    };
  }

  return null;
}
