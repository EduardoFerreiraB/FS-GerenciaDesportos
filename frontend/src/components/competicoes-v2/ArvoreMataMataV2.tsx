'use client';

import React, { useMemo } from 'react';
import { Trophy, Award, CheckCircle2, ChevronRight, Shield } from 'lucide-react';
import { ConfrontoV2 } from '@/types/competicoesV2';

interface ArvoreMataMataV2Props {
  confrontos: ConfrontoV2[];
}

interface DueloAgregado {
  idDuelo: string;
  fase: string;
  equipe1: { id: number; nome: string };
  equipe2: { id: number; nome: string };
  confrontoIda?: ConfrontoV2;
  confrontoVolta?: ConfrontoV2;
  confrontoUnico?: ConfrontoV2;
  placarAgregado1: number;
  placarAgregado2: number;
  penaltis1?: number | null;
  penaltis2?: number | null;
  idVencedor?: number | null;
  finalizado: boolean;
}

export default function ArvoreMataMataV2({ confrontos }: ArvoreMataMataV2Props) {
  // Processamento e agrupamento dos duelos por fase
  const { fasesOrdenadas, duelosPorFase, disputaTerceiroLugar } = useMemo(() => {
    // Filtra confrontos eliminatórios (ignora fase de grupos pura se houver)
    const eliminatorios = confrontos.filter((c) => {
      if (!c.fase) return false;
      const f = c.fase.toLowerCase();
      return !f.includes('grupo') && !f.includes('pontos');
    });

    // Mapeamento para unir jogos de Ida e Volta
    const duelosMap = new Map<string, DueloAgregado>();
    let dueloTerceiro: DueloAgregado | null = null;

    // Primeiro passo: identificar jogos de ida e volta
    const confrontosIdaMap = new Map<number, ConfrontoV2>();
    eliminatorios.forEach((c) => {
      if (c.ordem_jogo === 1) {
        confrontosIdaMap.set(c.id_confronto, c);
      }
    });

    eliminatorios.forEach((c) => {
      const faseNome = c.fase || 'Eliminatória';
      const is3Lugar =
        faseNome.toLowerCase().includes('3') ||
        faseNome.toLowerCase().includes('terceir') ||
        faseNome.toLowerCase().includes('bronze');

      // Se for jogo de volta ligado a uma ida
      if (c.ordem_jogo === 2 && c.id_confronto_ida && confrontosIdaMap.has(c.id_confronto_ida)) {
        const ida = confrontosIdaMap.get(c.id_confronto_ida)!;
        const eq1Id = ida.id_equipe_mandante;
        const eq2Id = ida.id_equipe_visitante;
        const chave = `${faseNome}-${Math.min(eq1Id, eq2Id)}-${Math.max(eq1Id, eq2Id)}`;

        const nome1 = ida.equipe_mandante?.nome || `Equipe #${eq1Id}`;
        const nome2 = ida.equipe_visitante?.nome || `Equipe #${eq2Id}`;

        // No jogo de volta, mandante e visitante invertem
        const golsIda1 = ida.placar_mandante ?? 0;
        const golsIda2 = ida.placar_visitante ?? 0;
        const golsVolta1 = c.id_equipe_mandante === eq1Id ? (c.placar_mandante ?? 0) : (c.placar_visitante ?? 0);
        const golsVolta2 = c.id_equipe_mandante === eq2Id ? (c.placar_mandante ?? 0) : (c.placar_visitante ?? 0);

        const total1 = golsIda1 + golsVolta1;
        const total2 = golsIda2 + golsVolta2;

        let vencId: number | null | undefined = c.id_equipe_vencedora || c.id_vencedor;
        if (!vencId && c.status === 'Finalizado' && ida.status === 'Finalizado') {
          if (total1 > total2) vencId = eq1Id;
          else if (total2 > total1) vencId = eq2Id;
          else if (c.penaltis_mandante != null && c.penaltis_visitante != null) {
            vencId =
              c.penaltis_mandante > c.penaltis_visitante
                ? c.id_equipe_mandante
                : c.id_equipe_visitante;
          }
        }

        const duelo: DueloAgregado = {
          idDuelo: chave,
          fase: faseNome,
          equipe1: { id: eq1Id, nome: nome1 },
          equipe2: { id: eq2Id, nome: nome2 },
          confrontoIda: ida,
          confrontoVolta: c,
          placarAgregado1: total1,
          placarAgregado2: total2,
          penaltis1: c.id_equipe_mandante === eq1Id ? c.penaltis_mandante : c.penaltis_visitante,
          penaltis2: c.id_equipe_mandante === eq2Id ? c.penaltis_mandante : c.penaltis_visitante,
          idVencedor: vencId,
          finalizado: c.status === 'Finalizado',
        };

        if (is3Lugar) {
          dueloTerceiro = duelo;
        } else {
          duelosMap.set(chave, duelo);
        }
        return;
      }

      // Se for jogo único ou ida ainda não vinculada
      if (c.ordem_jogo !== 2) {
        const eq1Id = c.id_equipe_mandante;
        const eq2Id = c.id_equipe_visitante;
        const chave = `${faseNome}-${c.id_confronto}`;

        const nome1 = c.equipe_mandante?.nome || `Equipe #${eq1Id}`;
        const nome2 = c.equipe_visitante?.nome || `Equipe #${eq2Id}`;

        const placar1 = c.placar_mandante ?? 0;
        const placar2 = c.placar_visitante ?? 0;

        let vencId = c.id_equipe_vencedora || c.id_vencedor;
        if (!vencId && c.status === 'Finalizado') {
          if (placar1 > placar2) vencId = eq1Id;
          else if (placar2 > placar1) vencId = eq2Id;
          else if (c.penaltis_mandante != null && c.penaltis_visitante != null) {
            vencId =
              c.penaltis_mandante > c.penaltis_visitante ? eq1Id : eq2Id;
          }
        }

        const duelo: DueloAgregado = {
          idDuelo: chave,
          fase: faseNome,
          equipe1: { id: eq1Id, nome: nome1 },
          equipe2: { id: eq2Id, nome: nome2 },
          confrontoUnico: c,
          placarAgregado1: placar1,
          placarAgregado2: placar2,
          penaltis1: c.penaltis_mandante,
          penaltis2: c.penaltis_visitante,
          idVencedor: vencId,
          finalizado: c.status === 'Finalizado',
        };

        if (is3Lugar) {
          dueloTerceiro = duelo;
        } else {
          duelosMap.set(chave, duelo);
        }
      }
    });

    // Ordem esperada das fases eliminatórias
    const pesoFase = (nome: string) => {
      const n = nome.toLowerCase();
      if (n.includes('oitav') || n.includes('16')) return 1;
      if (n.includes('quart') || n.includes('8')) return 2;
      if (n.includes('semi') || n.includes('4')) return 3;
      if (n.includes('final')) return 4;
      return 0;
    };

    const porFase: Record<string, DueloAgregado[]> = {};
    duelosMap.forEach((d) => {
      if (!porFase[d.fase]) porFase[d.fase] = [];
      porFase[d.fase].push(d);
    });

    const fases = Object.keys(porFase).sort((a, b) => pesoFase(a) - pesoFase(b));

    return {
      fasesOrdenadas: fases,
      duelosPorFase: porFase,
      disputaTerceiroLugar: dueloTerceiro,
    };
  }, [confrontos]);

  if (fasesOrdenadas.length === 0 && !disputaTerceiroLugar) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center space-y-3">
        <Trophy size={40} className="mx-auto text-slate-300" />
        <h3 className="text-base font-bold text-slate-700">Chaveamento Eliminatório Indisponível</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Não foram identificados confrontos eliminatórios (Oitavas, Quartas, Semifinal ou Final) nesta competição.
          Para competições de pontos corridos, consulte a aba de Classificação.
        </p>
      </div>
    );
  }

  const renderCardDuelo = (duelo: DueloAgregado) => {
    const isVolta = !!duelo.confrontoVolta;
    const venceu1 = duelo.idVencedor === duelo.equipe1.id;
    const venceu2 = duelo.idVencedor === duelo.equipe2.id;

    return (
      <div
        key={duelo.idDuelo}
        className="w-72 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 transition-all shadow-sm overflow-hidden flex flex-col"
      >
        {/* Header do Duelo */}
        <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600">
          <span>{duelo.fase}</span>
          {isVolta ? (
            <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded-full">
              Ida & Volta
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">Jogo Único</span>
          )}
        </div>

        {/* Detalhes dos confrontos se Ida e Volta */}
        {isVolta && duelo.confrontoIda && duelo.confrontoVolta && (
          <div className="px-3 py-1.5 bg-slate-100/60 border-b border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>
              Ida: {duelo.confrontoIda.placar_mandante ?? 0} x {duelo.confrontoIda.placar_visitante ?? 0}
            </span>
            <span>
              Volta: {duelo.confrontoVolta.placar_mandante ?? 0} x {duelo.confrontoVolta.placar_visitante ?? 0}
            </span>
          </div>
        )}

        {/* Linha Equipe 1 */}
        <div
          className={`px-3.5 py-2.5 flex items-center justify-between transition-colors ${
            venceu1 ? 'bg-emerald-50/70 font-bold text-emerald-900' : 'text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {venceu1 && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
            <span className="text-xs truncate">{duelo.equipe1.nome}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-sm font-black px-2 py-0.5 rounded-lg ${
                venceu1 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {duelo.placarAgregado1}
            </span>
            {duelo.penaltis1 !== null && duelo.penaltis1 !== undefined && (
              <span className="text-[10px] text-amber-600 font-bold">
                ({duelo.penaltis1})
              </span>
            )}
          </div>
        </div>

        <div className="h-[1px] bg-slate-100" />

        {/* Linha Equipe 2 */}
        <div
          className={`px-3.5 py-2.5 flex items-center justify-between transition-colors ${
            venceu2 ? 'bg-emerald-50/70 font-bold text-emerald-900' : 'text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {venceu2 && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
            <span className="text-xs truncate">{duelo.equipe2.nome}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-sm font-black px-2 py-0.5 rounded-lg ${
                venceu2 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {duelo.placarAgregado2}
            </span>
            {duelo.penaltis2 !== null && duelo.penaltis2 !== undefined && (
              <span className="text-[10px] text-amber-600 font-bold">
                ({duelo.penaltis2})
              </span>
            )}
          </div>
        </div>

        {/* Rodapé status */}
        <div className="px-3.5 py-1 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>{duelo.finalizado ? 'Confronto Concluído' : 'A Disputar'}</span>
          {duelo.idVencedor && (
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <Trophy size={11} /> Classificado
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Título e Legenda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="text-amber-500" size={20} />
            Árvore Eliminatória (Mata-Mata)
          </h2>
          <p className="text-xs text-slate-500">
            Acompanhe o caminho rumo ao título com duelos consolidados e placares agregados.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Vencedor / Classificado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pênaltis
          </span>
        </div>
      </div>

      {/* Árvore em Colunas Horizontais */}
      <div className="overflow-x-auto pb-6">
        <div className="flex items-stretch gap-8 min-w-max">
          {fasesOrdenadas.map((faseNome, idx) => {
            const duelos = duelosPorFase[faseNome] || [];
            const isFinal = faseNome.toLowerCase().includes('final') && !faseNome.toLowerCase().includes('semi');

            return (
              <div key={faseNome} className="flex flex-col">
                {/* Header da Fase */}
                <div className="mb-4 text-center">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                      isFinal
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {isFinal && <Trophy size={13} className="text-amber-600" />}
                    {faseNome}
                  </span>
                </div>

                {/* Coluna com os cards dos duelos */}
                <div className="flex-1 flex flex-col justify-around gap-6 py-2">
                  {duelos.map((duelo) => renderCardDuelo(duelo))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Disputa de 3º Lugar se existir */}
      {disputaTerceiroLugar && (
        <div className="bg-gradient-to-r from-amber-50/80 to-slate-50 rounded-3xl border border-amber-200/80 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Award className="text-amber-700" size={20} />
            <h3 className="text-sm font-extrabold text-amber-950 uppercase tracking-wide">
              Disputa de 3º Lugar (Medalha de Bronze)
            </h3>
          </div>
          <div className="flex justify-start">
            {renderCardDuelo(disputaTerceiroLugar)}
          </div>
        </div>
      )}
    </div>
  );
}
