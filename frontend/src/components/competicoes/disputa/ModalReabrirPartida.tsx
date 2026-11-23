'use client';

import React, { useState, useEffect } from 'react';
import { Alert, Button, Dialog, DialogContent, DialogFooter, Field, Textarea } from '@/components/ui';
import {
  reabrirPartida,
  cancelarPartida,
  reabrirFaseGrupos,
  isErroApi,
} from '@/services/competicoes';
import type { PartidaDetalhe } from '@/types/competicoes';

export type ModoReabertura = 'REABRIR_PARTIDA' | 'CANCELAR_PARTIDA' | 'REABRIR_GRUPOS';

export interface ModalReabrirPartidaProps {
  isOpen: boolean;
  modo: ModoReabertura;
  partida?: PartidaDetalhe | null;
  idEdicaoCompeticao: number;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalReabrirPartida({
  isOpen,
  modo,
  partida,
  idEdicaoCompeticao,
  onClose,
  onSucesso,
}: ModalReabrirPartidaProps) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setErro(null);
      setSalvando(false);
    }
  }, [isOpen]);

  let titulo = 'Reabrir Partida';
  let descricao =
    'Esta ação reabrirá a partida finalizada para o status Em Andamento, permitindo alterações no placar e súmula. Duelos eliminatórios seguintes que dependem deste resultado serão resetados caso ainda não tenham sido iniciados.';
  let textoBotao = 'Confirmar Reabertura';
  let tomBotao: 'primary' | 'danger' = 'primary';

  if (modo === 'CANCELAR_PARTIDA') {
    titulo = partida ? `Cancelar Jogo ${partida.numero_jogo}` : 'Cancelar Jogo';
    descricao =
      'Esta ação cancelará a partida agendada. Apenas partidas que ainda não possuem ocorrências registradas podem ser canceladas.';
    textoBotao = 'Confirmar Cancelamento';
    tomBotao = 'danger';
  } else if (modo === 'REABRIR_GRUPOS') {
    titulo = 'Reabrir Fase de Grupos';
    descricao =
      'Esta ação desfaz o encerramento da fase de grupos, permitindo reabrir partidas dos grupos e retificar resultados. Caso o chaveamento mata-mata já tenha duelos com partidas iniciadas, a operação será bloqueada.';
    textoBotao = 'Confirmar Reabertura de Grupos';
  } else if (partida) {
    titulo = `Reabrir Jogo ${partida.numero_jogo} (${partida.nome_mandante || 'Mandante'} × ${partida.nome_visitante || 'Visitante'})`;
  }

  const motivoValido = motivo.trim().length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!motivoValido) {
      setErro('Informe uma justificativa com no mínimo 3 caracteres.');
      return;
    }

    try {
      setSalvando(true);

      if (modo === 'REABRIR_PARTIDA') {
        if (!partida) {
          throw new Error('Nenhuma partida informada para reabertura.');
        }
        await reabrirPartida(partida.id_partida, motivo.trim());
      } else if (modo === 'CANCELAR_PARTIDA') {
        if (!partida) {
          throw new Error('Nenhuma partida informada para cancelamento.');
        }
        await cancelarPartida(partida.id_partida, motivo.trim());
      } else if (modo === 'REABRIR_GRUPOS') {
        await reabrirFaseGrupos(idEdicaoCompeticao, motivo.trim());
      }

      onSucesso();
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Ocorreu um erro ao processar a operação.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => (!aberto && !salvando ? onClose() : undefined)}>
      <DialogContent title={titulo} description="Operação registrada em auditoria." size="md">
        <form id="form-reabrir-partida" onSubmit={handleSubmit} className="space-y-4">
          <p className="rounded-lg border border-line bg-surface-muted p-3 text-sm text-fg-muted">{descricao}</p>

          {/* Erro (inclui o conflito 409 de jogos descendentes) */}
          {erro && (
            <Alert tone="danger" title="Não foi possível concluir" data-testid="alerta-erro-reabertura">
              {erro}
            </Alert>
          )}

          <Field
            label="Justificativa / motivo"
            htmlFor="input-motivo"
            required
            hint={`${motivo.trim().length} caractere(s) · mínimo de 3`}
            error={!motivoValido && motivo.length > 0 ? 'Mínimo de 3 caracteres exigido' : undefined}
          >
            <Textarea
              id="input-motivo"
              data-testid="input-motivo-reabertura"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo desta alteração para registro em auditoria..."
              className="resize-none"
              autoFocus
            />
          </Field>
        </form>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-reabrir-partida"
            variant={tomBotao}
            data-testid="btn-confirmar-reabertura"
            loading={salvando}
            disabled={!motivoValido}
          >
            {textoBotao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
