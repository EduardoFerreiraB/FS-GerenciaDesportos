'use client';

import React, { useState, useEffect } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogContent, DialogFooter, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { registrarResultadoSimples, isErroApi } from '@/services/competicoes';
import type { PartidaDetalhe, ResultadoSimples } from '@/types/competicoes';

interface PartidaEstendida extends PartidaDetalhe {
  ordem_jogo?: number;
}

interface ModalResultadoSimplesProps {
  partida: PartidaDetalhe | null;
  isOpen: boolean;
  onClose: () => void;
  onSucesso: (partidaAtualizada: PartidaDetalhe) => void;
}

export default function ModalResultadoSimples({
  partida,
  isOpen,
  onClose,
  onSucesso,
}: ModalResultadoSimplesProps) {
  const p = partida as PartidaEstendida | null;

  const [golsMandante, setGolsMandante] = useState<number>(0);
  const [golsVisitante, setGolsVisitante] = useState<number>(0);

  const [temPenaltis, setTemPenaltis] = useState<boolean>(false);
  const [penaltisMandante, setPenaltisMandante] = useState<string>('');
  const [penaltisVisitante, setPenaltisVisitante] = useState<string>('');

  const [ehWo, setEhWo] = useState<boolean>(false);
  const [equipeDerrotadaWo, setEquipeDerrotadaWo] = useState<number | null>(null);

  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !p) return;

    setGolsMandante(p.placar?.gols_mandante ?? 0);
    setGolsVisitante(p.placar?.gols_visitante ?? 0);

    const temPen = p.placar?.penaltis_mandante != null || p.placar?.penaltis_visitante != null;
    setTemPenaltis(temPen);
    setPenaltisMandante(p.placar?.penaltis_mandante != null ? String(p.placar.penaltis_mandante) : '');
    setPenaltisVisitante(p.placar?.penaltis_visitante != null ? String(p.placar.penaltis_visitante) : '');

    setEhWo(false);
    setEquipeDerrotadaWo(null);
    setErro(null);
  }, [isOpen, p]);

  // DF-RT12-08: o erro de uma tentativa anterior some assim que o usuário corrige os dados.
  useEffect(() => {
    setErro(null);
  }, [golsMandante, golsVisitante, temPenaltis, penaltisMandante, penaltisVisitante, ehWo, equipeDerrotadaWo]);

  if (!p) return null;

  // DF-RT12-09: pênaltis só existem em confronto eliminatório.
  const ehEliminatorio = p.id_duelo != null;

  const nomeMandante = p.nome_mandante || 'Mandante';
  const nomeVisitante = p.nome_visitante || 'Visitante';
  const numeroJogo = p.numero_jogo;

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      let payload: ResultadoSimples;

      if (ehWo) {
        if (!equipeDerrotadaWo) {
          setErro('Selecione a equipe que cometeu ou sofreu o W.O.');
          setSalvando(false);
          return;
        }

        payload = {
          wo: true,
          equipe_wo_id: equipeDerrotadaWo,
          gols_mandante: 0,
          gols_visitante: 0,
        };
      } else {
        const gm = Math.max(0, Math.floor(Number(golsMandante) || 0));
        const gv = Math.max(0, Math.floor(Number(golsVisitante) || 0));

        let pm: number | null = null;
        let pv: number | null = null;

        if (temPenaltis && ehEliminatorio) {
          if (penaltisMandante.trim() === '' || penaltisVisitante.trim() === '') {
            setErro('Preencha os pênaltis convertidos por ambas as equipes.');
            setSalvando(false);
            return;
          }

          pm = Math.max(0, Math.floor(Number(penaltisMandante) || 0));
          pv = Math.max(0, Math.floor(Number(penaltisVisitante) || 0));

          if (pm === pv) {
            setErro('A disputa por pênaltis não pode terminar empatada.');
            setSalvando(false);
            return;
          }
        }

        payload = {
          gols_mandante: gm,
          gols_visitante: gv,
          penaltis_mandante: pm,
          penaltis_visitante: pv,
          wo: false,
        };
      }

      const partidaAtualizada = await registrarResultadoSimples(p.id_partida, payload);
      onSucesso(partidaAtualizada);
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao registrar o resultado da partida. Verifique o estado da competição.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const radioClasses =
    'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg transition-colors duration-150 hover:bg-surface-muted has-[:checked]:border-warning has-[:checked]:bg-warning-soft';

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => (!aberto && !salvando ? onClose() : undefined)}>
      <DialogContent title="Lançar Placar Simples" description={`Jogo ${numeroJogo} · registro oficial de resultado`} size="md">
        <form id="form-resultado-simples" onSubmit={handleSalvar} className="space-y-5">
          {erro && <Alert tone="danger">{erro}</Alert>}

          {/* Placar mandante × visitante */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3 rounded-xl border border-line bg-surface-muted p-4">
            <div className="flex min-w-0 flex-col items-center gap-2">
              <span className="max-w-full truncate text-xs font-medium text-fg-muted" title={nomeMandante}>
                {p.sigla_mandante ? `${p.sigla_mandante} · ` : ''}
                {nomeMandante}
              </span>
              <Input
                type="number"
                min="0"
                max="99"
                disabled={ehWo || salvando}
                value={ehWo ? '' : golsMandante}
                onChange={(e) => setGolsMandante(Math.max(0, parseInt(e.target.value, 10) || 0))}
                aria-label={`Gols ${nomeMandante}`}
                className="h-14 w-20 text-center text-3xl font-semibold tabular-nums"
              />
            </div>
            <span aria-hidden="true" className="pb-3 text-xl text-fg-subtle">
              ×
            </span>
            <div className="flex min-w-0 flex-col items-center gap-2">
              <span className="max-w-full truncate text-xs font-medium text-fg-muted" title={nomeVisitante}>
                {p.sigla_visitante ? `${p.sigla_visitante} · ` : ''}
                {nomeVisitante}
              </span>
              <Input
                type="number"
                min="0"
                max="99"
                disabled={ehWo || salvando}
                value={ehWo ? '' : golsVisitante}
                onChange={(e) => setGolsVisitante(Math.max(0, parseInt(e.target.value, 10) || 0))}
                aria-label={`Gols ${nomeVisitante}`}
                className="h-14 w-20 text-center text-3xl font-semibold tabular-nums"
              />
            </div>
          </div>

          {/* Disputa por pênaltis */}
          {!ehWo && ehEliminatorio && (
            <div className="space-y-3 rounded-xl border border-line p-4">
              <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm font-medium text-fg">
                <Checkbox
                  checked={temPenaltis}
                  onChange={(e) => setTemPenaltis(e.target.checked)}
                  disabled={salvando}
                />
                Decisão por pênaltis (desempate eliminatório)
              </label>

              {temPenaltis && (
                <div className="grid grid-cols-2 gap-4 border-t border-line pt-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate text-xs font-medium text-fg-muted" title={nomeMandante}>
                      Pênaltis {nomeMandante}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      value={penaltisMandante}
                      onChange={(e) => setPenaltisMandante(e.target.value)}
                      placeholder="0"
                      aria-label={`Pênaltis ${nomeMandante}`}
                      disabled={salvando}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate text-xs font-medium text-fg-muted" title={nomeVisitante}>
                      Pênaltis {nomeVisitante}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      value={penaltisVisitante}
                      onChange={(e) => setPenaltisVisitante(e.target.value)}
                      placeholder="0"
                      aria-label={`Pênaltis ${nomeVisitante}`}
                      disabled={salvando}
                      className="tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* W.O. */}
          <div className={cn('space-y-3 rounded-xl border p-4', ehWo ? 'border-warning/40 bg-warning-soft' : 'border-line')}>
            <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm font-medium text-fg">
              <Checkbox
                checked={ehWo}
                onChange={(e) => {
                  const check = e.target.checked;
                  setEhWo(check);
                  if (check) {
                    setTemPenaltis(false);
                    if (p.id_equipe_mandante && !equipeDerrotadaWo) {
                      setEquipeDerrotadaWo(p.id_equipe_mandante);
                    }
                  }
                }}
                disabled={salvando}
              />
              Declarar Resultado por W.O.
            </label>

            {ehWo && (
              <fieldset className="space-y-2 border-t border-line pt-3">
                <legend className="mb-2 text-xs text-fg-muted">
                  Selecione a equipe ausente/infratora (derrotada por W.O.). A outra equipe recebe vitória
                  regulamentar de 3 × 0.
                </legend>
                {p.id_equipe_mandante && (
                  <label className={radioClasses}>
                    <input
                      type="radio"
                      name="equipe_wo"
                      value={p.id_equipe_mandante}
                      checked={equipeDerrotadaWo === p.id_equipe_mandante}
                      onChange={() => setEquipeDerrotadaWo(p.id_equipe_mandante!)}
                      className="size-4 accent-primary"
                    />
                    <span className="truncate">{nomeMandante} (derrotada por W.O.)</span>
                  </label>
                )}
                {p.id_equipe_visitante && (
                  <label className={radioClasses}>
                    <input
                      type="radio"
                      name="equipe_wo"
                      value={p.id_equipe_visitante}
                      checked={equipeDerrotadaWo === p.id_equipe_visitante}
                      onChange={() => setEquipeDerrotadaWo(p.id_equipe_visitante!)}
                      className="size-4 accent-primary"
                    />
                    <span className="truncate">{nomeVisitante} (derrotada por W.O.)</span>
                  </label>
                )}
              </fieldset>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-resultado-simples" loading={salvando}>
            Confirmar Placar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
