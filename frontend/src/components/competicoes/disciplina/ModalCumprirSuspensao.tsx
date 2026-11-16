'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CircleCheck } from 'lucide-react';
import { Alert, Button, Dialog, DialogContent, DialogFooter, Field, Select } from '@/components/ui';
import { rotuloDoEstado } from '@/lib/rotulos';
import { cumprirSuspensao, isErroApi } from '@/services/competicoes';
import type { SuspensaoDetalhe, PartidaDetalhe } from '@/types/competicoes';
import { ResumoSuspensao } from './ResumoSuspensao';

interface ModalCumprirSuspensaoProps {
  suspensao: SuspensaoDetalhe | null;
  partidas: PartidaDetalhe[];
  isOpen: boolean;
  onClose: () => void;
  onSucesso: () => void;
}

function rotuloPartida(p: PartidaDetalhe): string {
  const mandante = p.nome_mandante || 'Mandante';
  const visitante = p.nome_visitante || 'Visitante';
  const rodada = p.rodada ? ` (Rodada ${p.rodada})` : '';
  return `Jogo ${p.numero_partida}${rodada}: ${mandante} × ${visitante} · ${rotuloDoEstado('partida', p.status)}`;
}

export default function ModalCumprirSuspensao({
  suspensao,
  partidas,
  isOpen,
  onClose,
  onSucesso,
}: ModalCumprirSuspensaoProps) {
  const [idPartida, setIdPartida] = useState<number | ''>('');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  // Filtra partidas da equipe do atleta
  const { partidasEquipe, outrasPartidas } = useMemo(() => {
    if (!suspensao?.id_equipe) {
      return { partidasEquipe: partidas, outrasPartidas: [] };
    }
    const equipe = partidas.filter(
      (p) =>
        p.id_equipe_mandante === suspensao.id_equipe ||
        p.id_equipe_visitante === suspensao.id_equipe
    );
    const outras = partidas.filter(
      (p) =>
        p.id_equipe_mandante !== suspensao.id_equipe &&
        p.id_equipe_visitante !== suspensao.id_equipe
    );
    return { partidasEquipe: equipe, outrasPartidas: outras };
  }, [suspensao?.id_equipe, partidas]);

  useEffect(() => {
    if (!isOpen || !suspensao) return;

    setErro(null);
    setSalvando(false);

    // Seleciona preferencialmente uma partida finalizada da equipe
    const candidata =
      partidasEquipe.find((p) => p.status === 'FINALIZADA') ||
      partidasEquipe[0] ||
      partidas[0];

    if (candidata) {
      setIdPartida(candidata.id_partida);
    } else {
      setIdPartida('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, suspensao?.id_suspensao]);

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspensao) return;
    if (!idPartida) {
      setErro('Selecione uma partida válida para cumprir a suspensão.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      await cumprirSuspensao(suspensao.id_suspensao, {
        id_partida: Number(idPartida),
      });
      onSucesso();
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao registrar o cumprimento da suspensão.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      open={isOpen && suspensao !== null}
      onOpenChange={(aberto) => (!aberto && !salvando ? onClose() : undefined)}
    >
      {suspensao && (
        <DialogContent title="Registrar cumprimento" description={`Suspensão #${suspensao.id_suspensao}`}>
          <form id="form-cumprir-suspensao" onSubmit={handleConfirmar} className="space-y-4">
            {erro && (
              <Alert tone="danger" data-testid="alerta-erro-cumprimento">
                {erro}
              </Alert>
            )}

            <ResumoSuspensao
              itens={[
                {
                  rotulo: 'Atleta',
                  valor: suspensao.nome_esportivo || `Integrante #${suspensao.id_integrante}`,
                },
                ...(suspensao.nome_equipe ? [{ rotulo: 'Equipe', valor: suspensao.nome_equipe }] : []),
                { rotulo: 'Motivo', valor: suspensao.motivo, truncar: true },
                {
                  rotulo: 'Progresso',
                  valor: `${suspensao.jogos_cumpridos} de ${suspensao.jogos} ${
                    suspensao.jogos === 1 ? 'jogo cumprido' : 'jogos cumpridos'
                  }`,
                  numerico: true,
                },
              ]}
            />

            <Field
              label="Partida em que cumpriu a suspensão"
              htmlFor="select-partida-cumprimento"
              hint="O cumprimento deve ser registrado em uma partida finalizada posterior da equipe do atleta."
              required
            >
              <Select
                id="select-partida-cumprimento"
                data-testid="select-partida-cumprimento"
                value={idPartida}
                onChange={(e) => setIdPartida(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Selecione a partida…</option>
                {partidasEquipe.length > 0 && outrasPartidas.length > 0 ? (
                  <>
                    <optgroup label={`Partidas de ${suspensao.nome_equipe || 'Equipe'}`}>
                      {partidasEquipe.map((p) => (
                        <option key={p.id_partida} value={p.id_partida}>
                          {rotuloPartida(p)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Outras partidas da edição">
                      {outrasPartidas.map((p) => (
                        <option key={p.id_partida} value={p.id_partida}>
                          {rotuloPartida(p)}
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  (partidasEquipe.length > 0 ? partidasEquipe : partidas).map((p) => (
                    <option key={p.id_partida} value={p.id_partida}>
                      {rotuloPartida(p)}
                    </option>
                  ))
                )}
              </Select>
            </Field>
          </form>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={salvando}
              data-testid="btn-cancelar-cumprimento"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-cumprir-suspensao"
              loading={salvando}
              disabled={!idPartida}
              data-testid="btn-confirmar-cumprimento"
              leftIcon={<CircleCheck className="size-4" />}
            >
              Confirmar cumprimento
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
