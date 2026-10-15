'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  Configuracao,
  ConfiguracaoPontosCorridos,
  ConfiguracaoGruposMataMata,
  ConfiguracaoMataMata,
  FormatoCompeticao,
  CriterioDesempate,
  PontuacaoConfig,
  DisciplinaConfig,
} from '@/types/competicoes';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export const PONTUACAO_PADRAO: PontuacaoConfig = {
  vitoria: 3,
  empate: 1,
  derrota: 0,
};

export const DISCIPLINA_PADRAO: DisciplinaConfig = {
  limite_amarelos: 3,
  jogos_por_acumulo: 1,
  jogos_por_vermelho: 1,
  jogos_por_segundo_amarelo: 1,
  zerar_amarelos_ao_encerrar_grupos: false,
};

export const DESEMPATES_PADRAO: CriterioDesempate[] = [
  'VITORIAS',
  'SALDO_GOLS',
  'GOLS_PRO',
  'CONFRONTO_DIRETO',
];

export function criarConfiguracaoPadrao(formato: FormatoCompeticao): Configuracao {
  switch (formato) {
    case 'PONTOS_CORRIDOS':
      return {
        formato: 'PONTOS_CORRIDOS',
        pontuacao: { ...PONTUACAO_PADRAO },
        desempates: [...DESEMPATES_PADRAO],
        disciplina: { ...DISCIPLINA_PADRAO },
        turno_e_returno: false,
      };
    case 'GRUPOS_MATA_MATA':
      return {
        formato: 'GRUPOS_MATA_MATA',
        pontuacao: { ...PONTUACAO_PADRAO },
        desempates: [...DESEMPATES_PADRAO],
        disciplina: { ...DISCIPLINA_PADRAO },
        quantidade_grupos: 2,
        classificados_por_grupo: 2,
        turno_e_returno_grupos: false,
        ida_volta_eliminatoria: false,
        final_unica: true,
        terceiro_lugar: false,
      };
    case 'MATA_MATA':
      return {
        formato: 'MATA_MATA',
        disciplina: { ...DISCIPLINA_PADRAO },
        ida_volta: false,
        final_unica: true,
        terceiro_lugar: false,
      };
  }
}

interface FormularioConfiguracaoProps {
  formato: FormatoCompeticao;
  onFormatoChange?: (novoFormato: FormatoCompeticao) => void;
  configuracao: Configuracao;
  onChange: (novaConfiguracao: Configuracao) => void;
  desabilitado?: boolean;
}

export default function FormularioConfiguracao({
  formato,
  onFormatoChange,
  configuracao,
  onChange,
  desabilitado = false,
}: FormularioConfiguracaoProps) {
  const [formatoPendente, setFormatoPendente] = useState<FormatoCompeticao | null>(null);
  const [mostrarDialogoDescarte, setMostrarDialogoDescarte] = useState(false);

  const handleTentativaMudarFormato = (novoFormato: FormatoCompeticao) => {
    if (novoFormato === formato) return;

    // Se estiver mudando de formato e houver dados específicos preenchidos, pedir confirmação
    const temDadosGrupos =
      formato === 'GRUPOS_MATA_MATA' &&
      ((configuracao as ConfiguracaoGruposMataMata).quantidade_grupos !== 2 ||
        (configuracao as ConfiguracaoGruposMataMata).classificados_por_grupo !== 2 ||
        (configuracao as ConfiguracaoGruposMataMata).quantidade_grupos > 0);

    const temDadosPontos =
      formato === 'PONTOS_CORRIDOS' &&
      (configuracao as ConfiguracaoPontosCorridos).turno_e_returno === true;

    if (temDadosGrupos || temDadosPontos || formato !== novoFormato) {
      setFormatoPendente(novoFormato);
      setMostrarDialogoDescarte(true);
      return;
    }

    aplicarTrocaFormato(novoFormato);
  };

  const aplicarTrocaFormato = (novoFormato: FormatoCompeticao) => {
    const novaConfig = criarConfiguracaoPadrao(novoFormato);
    if (onFormatoChange) {
      onFormatoChange(novoFormato);
    }
    onChange(novaConfig);
    setMostrarDialogoDescarte(false);
    setFormatoPendente(null);
  };

  const cancelarTrocaFormato = () => {
    setMostrarDialogoDescarte(false);
    setFormatoPendente(null);
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Formato */}
      <div>
        <label htmlFor="formato" className="block text-sm font-semibold text-slate-700 mb-1">
          Formato
        </label>
        <select
          id="formato"
          value={formatoPendente ?? formato}
          disabled={desabilitado}
          onChange={(e) => handleTentativaMudarFormato(e.target.value as FormatoCompeticao)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-500"
        >
          <option value="GRUPOS_MATA_MATA">Grupos + Mata-mata</option>
          <option value="PONTOS_CORRIDOS">Pontos Corridos</option>
          <option value="MATA_MATA">Mata-mata</option>
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Define as regras estruturais de fases e partidas desta competição.
        </p>
      </div>

      {/* Diálogo de confirmação de descarte de configuração */}
      {mostrarDialogoDescarte && typeof window !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-label="Descartar configurações incompatíveis"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          >
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-amber-200">
              <div className="flex items-center gap-3 mb-4 text-amber-600">
                <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                <h3 className="text-lg font-bold text-slate-900">Descartar configuração atual?</h3>
              </div>
              <p className="text-sm text-slate-600 mb-6">
                Alterar o formato para{' '}
                <strong className="text-slate-900">
                  {formatoPendente === 'PONTOS_CORRIDOS'
                    ? 'Pontos Corridos'
                    : formatoPendente === 'GRUPOS_MATA_MATA'
                    ? 'Grupos + Mata-mata'
                    : 'Mata-mata'}
                </strong>{' '}
                descartará os campos e regras específicos do formato anterior. Deseja continuar?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelarTrocaFormato}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => formatoPendente && aplicarTrocaFormato(formatoPendente)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm transition shadow-sm"
                >
                  Descartar alterações
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Campos Específicos de Grupos + Mata-mata */}
      {formato === 'GRUPOS_MATA_MATA' && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
          <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            Estrutura da Fase de Grupos
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantidade_grupos" className="block text-sm font-medium text-slate-700 mb-1">
                Quantidade de grupos
              </label>
              <input
                id="quantidade_grupos"
                type="number"
                min={1}
                max={32}
                disabled={desabilitado}
                value={(configuracao as ConfiguracaoGruposMataMata).quantidade_grupos ?? 2}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  onChange({
                    ...(configuracao as ConfiguracaoGruposMataMata),
                    quantidade_grupos: val,
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="classificados_por_grupo" className="block text-sm font-medium text-slate-700 mb-1">
                Classificados por grupo
              </label>
              <input
                id="classificados_por_grupo"
                type="number"
                min={1}
                max={16}
                disabled={desabilitado}
                value={(configuracao as ConfiguracaoGruposMataMata).classificados_por_grupo ?? 2}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  onChange({
                    ...(configuracao as ConfiguracaoGruposMataMata),
                    classificados_por_grupo: val,
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={desabilitado}
                checked={!!(configuracao as ConfiguracaoGruposMataMata).turno_e_returno_grupos}
                onChange={(e) =>
                  onChange({
                    ...(configuracao as ConfiguracaoGruposMataMata),
                    turno_e_returno_grupos: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              Turno e returno nos grupos
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={desabilitado}
                checked={!!(configuracao as ConfiguracaoGruposMataMata).ida_volta_eliminatoria}
                onChange={(e) =>
                  onChange({
                    ...(configuracao as ConfiguracaoGruposMataMata),
                    ida_volta_eliminatoria: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              Ida e volta no mata-mata
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={desabilitado}
                checked={!(configuracao as ConfiguracaoGruposMataMata).final_unica === false}
                onChange={(e) =>
                  onChange({
                    ...(configuracao as ConfiguracaoGruposMataMata),
                    final_unica: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              Final única
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={desabilitado}
                checked={!!(configuracao as ConfiguracaoGruposMataMata).terceiro_lugar}
                onChange={(e) =>
                  onChange({
                    ...(configuracao as ConfiguracaoGruposMataMata),
                    terceiro_lugar: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              Disputa de 3º lugar
            </label>
          </div>
        </div>
      )}

      {/* Campos Específicos de Pontos Corridos */}
      {formato === 'PONTOS_CORRIDOS' && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
          <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            Regras de Turno
          </h4>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={desabilitado}
              checked={!!(configuracao as ConfiguracaoPontosCorridos).turno_e_returno}
              onChange={(e) =>
                onChange({
                  ...(configuracao as ConfiguracaoPontosCorridos),
                  turno_e_returno: e.target.checked,
                })
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            Turno e returno (ida e volta)
          </label>
        </div>
      )}

      {/* Campos Específicos de Mata-mata */}
      {formato === 'MATA_MATA' && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
          <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            Regras Eliminatórias
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={desabilitado}
                checked={!!(configuracao as ConfiguracaoMataMata).ida_volta}
                onChange={(e) =>
                  onChange({
                    ...(configuracao as ConfiguracaoMataMata),
                    ida_volta: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              Confrontos em ida e volta
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={desabilitado}
                checked={!(configuracao as ConfiguracaoMataMata).final_unica === false}
                onChange={(e) =>
                  onChange({
                    ...(configuracao as ConfiguracaoMataMata),
                    final_unica: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              Final única
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={desabilitado}
                checked={!!(configuracao as ConfiguracaoMataMata).terceiro_lugar}
                onChange={(e) =>
                  onChange({
                    ...(configuracao as ConfiguracaoMataMata),
                    terceiro_lugar: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              Disputa de 3º lugar
            </label>
          </div>
        </div>
      )}

      {/* Pontuação e Desempate (Pontos Corridos ou Grupos) */}
      {(formato === 'PONTOS_CORRIDOS' || formato === 'GRUPOS_MATA_MATA') && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
          <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            Pontuação das Partidas
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="pts_vitoria" className="block text-xs font-medium text-slate-600 mb-1">
                Vitória
              </label>
              <input
                id="pts_vitoria"
                type="number"
                min={0}
                disabled={desabilitado}
                value={
                  formato === 'PONTOS_CORRIDOS'
                    ? (configuracao as ConfiguracaoPontosCorridos).pontuacao?.vitoria ?? 3
                    : (configuracao as ConfiguracaoGruposMataMata).pontuacao?.vitoria ?? 3
                }
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  if (formato === 'PONTOS_CORRIDOS') {
                    onChange({
                      ...(configuracao as ConfiguracaoPontosCorridos),
                      pontuacao: {
                        ...(configuracao as ConfiguracaoPontosCorridos).pontuacao,
                        vitoria: val,
                      },
                    });
                  } else {
                    onChange({
                      ...(configuracao as ConfiguracaoGruposMataMata),
                      pontuacao: {
                        ...(configuracao as ConfiguracaoGruposMataMata).pontuacao,
                        vitoria: val,
                      },
                    });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="pts_empate" className="block text-xs font-medium text-slate-600 mb-1">
                Empate
              </label>
              <input
                id="pts_empate"
                type="number"
                min={0}
                disabled={desabilitado}
                value={
                  formato === 'PONTOS_CORRIDOS'
                    ? (configuracao as ConfiguracaoPontosCorridos).pontuacao?.empate ?? 1
                    : (configuracao as ConfiguracaoGruposMataMata).pontuacao?.empate ?? 1
                }
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  if (formato === 'PONTOS_CORRIDOS') {
                    onChange({
                      ...(configuracao as ConfiguracaoPontosCorridos),
                      pontuacao: {
                        ...(configuracao as ConfiguracaoPontosCorridos).pontuacao,
                        empate: val,
                      },
                    });
                  } else {
                    onChange({
                      ...(configuracao as ConfiguracaoGruposMataMata),
                      pontuacao: {
                        ...(configuracao as ConfiguracaoGruposMataMata).pontuacao,
                        empate: val,
                      },
                    });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label htmlFor="pts_derrota" className="block text-xs font-medium text-slate-600 mb-1">
                Derrota
              </label>
              <input
                id="pts_derrota"
                type="number"
                min={0}
                disabled={desabilitado}
                value={
                  formato === 'PONTOS_CORRIDOS'
                    ? (configuracao as ConfiguracaoPontosCorridos).pontuacao?.derrota ?? 0
                    : (configuracao as ConfiguracaoGruposMataMata).pontuacao?.derrota ?? 0
                }
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  if (formato === 'PONTOS_CORRIDOS') {
                    onChange({
                      ...(configuracao as ConfiguracaoPontosCorridos),
                      pontuacao: {
                        ...(configuracao as ConfiguracaoPontosCorridos).pontuacao,
                        derrota: val,
                      },
                    });
                  } else {
                    onChange({
                      ...(configuracao as ConfiguracaoGruposMataMata),
                      pontuacao: {
                        ...(configuracao as ConfiguracaoGruposMataMata).pontuacao,
                        derrota: val,
                      },
                    });
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Regras Disciplinares */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
        <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
          Regras Disciplinares (Cartões)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="limite_amarelos" className="block text-xs font-medium text-slate-600 mb-1">
              Limite para suspensão por cartões amarelos
            </label>
            <input
              id="limite_amarelos"
              type="number"
              min={1}
              disabled={desabilitado}
              value={configuracao.disciplina?.limite_amarelos ?? 3}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 3;
                onChange({
                  ...configuracao,
                  disciplina: {
                    ...configuracao.disciplina,
                    limite_amarelos: val,
                  },
                });
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label htmlFor="jogos_por_vermelho" className="block text-xs font-medium text-slate-600 mb-1">
              Jogos de suspensão por cartão vermelho
            </label>
            <input
              id="jogos_por_vermelho"
              type="number"
              min={1}
              disabled={desabilitado}
              value={configuracao.disciplina?.jogos_por_vermelho ?? 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 1;
                onChange({
                  ...configuracao,
                  disciplina: {
                    ...configuracao.disciplina,
                    jogos_por_vermelho: val,
                  },
                });
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>
        {formato === 'GRUPOS_MATA_MATA' && (
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 pt-1">
            <input
              type="checkbox"
              disabled={desabilitado}
              checked={!!configuracao.disciplina?.zerar_amarelos_ao_encerrar_grupos}
              onChange={(e) =>
                onChange({
                  ...configuracao,
                  disciplina: {
                    ...configuracao.disciplina,
                    zerar_amarelos_ao_encerrar_grupos: e.target.checked,
                  },
                })
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            Zerar contagem de amarelos ao encerrar a fase de grupos
          </label>
        )}
      </div>
    </div>
  );
}
