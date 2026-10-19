'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, AlertCircle, Loader2, Save, User } from 'lucide-react';
import {
  criarSuspensaoManual,
  ajustarSuspensao,
  isErroApi,
} from '@/services/competicoes';
import type {
  SuspensaoDetalhe,
  EquipeDetalhe,
  SituacaoSuspensao,
} from '@/types/competicoes';

interface ModalAjustarSuspensaoProps {
  suspensao: SuspensaoDetalhe | null; // null = Criar Manual, non-null = Ajustar
  idEdicaoCompeticao: number;
  equipes: EquipeDetalhe[];
  isOpen: boolean;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalAjustarSuspensao({
  suspensao,
  idEdicaoCompeticao,
  equipes,
  isOpen,
  onClose,
  onSucesso,
}: ModalAjustarSuspensaoProps) {
  const modoAjustar = suspensao !== null;

  // Estados do formulário
  const [idIntegrante, setIdIntegrante] = useState<number | ''>('');
  const [jogos, setJogos] = useState<number>(1);
  const [situacao, setSituacao] = useState<SituacaoSuspensao>('ATIVA');
  const [motivo, setMotivo] = useState<string>('');

  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setErro(null);
    setSalvando(false);

    if (suspensao) {
      setJogos(suspensao.jogos);
      setSituacao((suspensao.situacao as SituacaoSuspensao) || 'ATIVA');
      setMotivo('');
      setIdIntegrante(suspensao.id_integrante);
    } else {
      setIdIntegrante('');
      setJogos(1);
      setSituacao('ATIVA');
      setMotivo('');
    }
  }, [isOpen, suspensao]);

  if (!isOpen) return null;

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const motivoTrim = motivo.trim();
    if (motivoTrim.length < 3) {
      setErro('Informe uma justificativa com no mínimo 3 caracteres.');
      return;
    }

    if (jogos < 1) {
      setErro('A quantidade de jogos deve ser no mínimo 1.');
      return;
    }

    setSalvando(true);

    try {
      if (modoAjustar && suspensao) {
        await ajustarSuspensao(suspensao.id_suspensao, {
          jogos,
          situacao,
          motivo: motivoTrim,
        });
      } else {
        if (!idIntegrante) {
          setErro('Selecione um integrante da edição.');
          setSalvando(false);
          return;
        }
        await criarSuspensaoManual(idEdicaoCompeticao, {
          id_integrante: Number(idIntegrante),
          jogos,
          motivo: motivoTrim,
        });
      }

      onSucesso();
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao processar suspensão.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-ajustar-titulo"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="modal-ajustar-titulo"
                className="text-lg font-bold text-slate-800"
              >
                {modoAjustar
                  ? 'Ajustar / Revisar Suspensão'
                  : 'Nova Suspensão Manual'}
              </h2>
              <p className="text-xs text-slate-500">
                {modoAjustar
                  ? `Suspensão #${suspensao.id_suspensao} — Justificativa obrigatória`
                  : 'Aplicação administrativa de punição disciplinar'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Fechar"
            data-testid="btn-fechar-modal-ajustar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSalvar} className="p-6 space-y-4">
          {erro && (
            <div
              className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2.5 animate-in fade-in"
              role="alert"
              data-testid="alerta-erro-ajuste"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{erro}</div>
            </div>
          )}

          {/* Se modo ajustar: exibe resumo dos dados atuais */}
          {modoAjustar && suspensao && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Atleta
                </span>
                <span className="font-bold text-slate-800">
                  {suspensao.nome_esportivo || `Integrante #${suspensao.id_integrante}`}
                </span>
              </div>
              {suspensao.nome_equipe && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Equipe
                  </span>
                  <span className="font-medium text-slate-700">
                    {suspensao.nome_equipe}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Origem Registrada
                </span>
                <span className="font-medium text-slate-700">
                  {suspensao.origem}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Jogos Cumpridos
                </span>
                <span className="font-semibold text-blue-700">
                  {suspensao.jogos_cumpridos} jogos
                </span>
              </div>
            </div>
          )}

          {/* Se modo criar manual: seleção do integrante */}
          {!modoAjustar && (
            <div>
              <label
                htmlFor="select-integrante"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Atleta / Integrante <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="select-integrante"
                  data-testid="select-integrante"
                  value={idIntegrante}
                  onChange={(e) => setIdIntegrante(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  required
                >
                  <option value="">Selecione um atleta...</option>
                  {equipes.map((eq) => (
                    <optgroup key={eq.id_equipe} label={eq.nome}>
                      {(eq.integrantes || []).map((i) => (
                        <option key={i.id_integrante} value={i.id_integrante}>
                          {i.nome_esportivo} ({eq.nome})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Quantidade de Jogos */}
          <div>
            <label
              htmlFor="input-jogos-suspensao"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Quantidade de Jogos <span className="text-red-500">*</span>
            </label>
            <input
              id="input-jogos-suspensao"
              data-testid="input-jogos-suspensao"
              type="number"
              min={modoAjustar && suspensao ? Math.max(1, suspensao.jogos_cumpridos) : 1}
              value={jogos}
              onChange={(e) => setJogos(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              required
            />
            {modoAjustar && suspensao && suspensao.jogos_cumpridos > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Não é permitido definir quantidade inferior aos {suspensao.jogos_cumpridos} jogos já cumpridos.
              </p>
            )}
          </div>

          {/* Situação da Suspensão (apenas em modo Ajustar) */}
          {modoAjustar && (
            <div>
              <label
                htmlFor="select-situacao-suspensao"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Situação da Suspensão <span className="text-red-500">*</span>
              </label>
              <select
                id="select-situacao-suspensao"
                data-testid="select-situacao-suspensao"
                value={situacao}
                onChange={(e) => setSituacao(e.target.value as SituacaoSuspensao)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              >
                <option value="ATIVA">ATIVA</option>
                <option value="CUMPRIDA">CUMPRIDA</option>
                <option value="EM_REVISAO">EM_REVISAO</option>
                <option value="CANCELADA">CANCELADA</option>
              </select>
            </div>
          )}

          {/* Motivo / Justificativa */}
          <div>
            <label
              htmlFor={modoAjustar ? 'input-motivo-ajuste' : 'input-motivo-suspensao'}
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              {modoAjustar ? 'Justificativa do Ajuste' : 'Motivo da Suspensão'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              id={modoAjustar ? 'input-motivo-ajuste' : 'input-motivo-suspensao'}
              data-testid={modoAjustar ? 'input-motivo-ajuste' : 'input-motivo-suspensao'}
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                modoAjustar
                  ? 'Explique o motivo do ajuste, julgamento do TJD ou retificação...'
                  : 'Descreva a infração ou motivo da aplicação manual...'
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              required
            />
            <p className="mt-1 text-xs text-slate-400">Mínimo de 3 caracteres.</p>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              data-testid="btn-cancelar-ajuste"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || (!modoAjustar && !idIntegrante) || motivo.trim().length < 3}
              data-testid={modoAjustar ? 'btn-salvar-ajuste' : 'btn-salvar-suspensao'}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {modoAjustar ? 'Salvar Ajuste' : 'Criar Suspensão'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
