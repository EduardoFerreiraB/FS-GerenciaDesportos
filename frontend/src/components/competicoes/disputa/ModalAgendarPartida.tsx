'use client';

import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Alert, Button, Dialog, DialogContent, DialogFooter, Field, Input } from '@/components/ui';
import { agendarPartida, isErroApi } from '@/services/competicoes';
import type { PartidaDetalhe, PartidaAgendar } from '@/types/competicoes';

interface PartidaEstendida extends PartidaDetalhe {
  data?: string | null;
  hora?: string | null;
  ordem_jogo?: number;
}

interface ModalAgendarPartidaProps {
  partida: PartidaDetalhe | null;
  isOpen: boolean;
  onClose: () => void;
  onSucesso: (partidaAtualizada: PartidaDetalhe) => void;
}

export default function ModalAgendarPartida({
  partida,
  isOpen,
  onClose,
  onSucesso,
}: ModalAgendarPartidaProps) {
  const p = partida as PartidaEstendida | null;

  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [local, setLocal] = useState('');
  const [campo, setCampo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // DF-RT12-08: o erro anterior some quando o usuário altera os dados.
  useEffect(() => {
    setErro(null);
  }, [data, hora, local, campo]);

  useEffect(() => {
    if (!isOpen || !p) return;

    let initData = '';
    let initHora = '';

    if (p.data) {
      initData = String(p.data);
    } else if (p.data_hora) {
      initData = p.data_hora.split('T')[0] || '';
    }

    if (p.hora) {
      initHora = String(p.hora).slice(0, 5);
    } else if (p.data_hora && p.data_hora.includes('T')) {
      const partHora = p.data_hora.split('T')[1];
      if (partHora) {
        initHora = partHora.slice(0, 5);
      }
    }

    setData(initData);
    setHora(initHora);
    setLocal(p.local || '');
    setCampo(p.campo || '');
    setErro(null);
  }, [isOpen, p]);

  if (!p) return null;

  const temAgendamentoExistente = Boolean(p.data || p.data_hora || p.local || p.campo);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      const payload: PartidaAgendar = {
        data: data || null,
        hora: hora ? (hora.length === 5 ? `${hora}:00` : hora) : null,
        local: local.trim() || null,
        campo: campo.trim() || null,
      };

      const partidaAtualizada = await agendarPartida(p.id_partida, payload);
      onSucesso(partidaAtualizada);
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao agendar a partida. Verifique os dados e tente novamente.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleLimpar = async () => {
    setLimpando(true);
    setErro(null);

    try {
      const payload: PartidaAgendar = {
        data: null,
        hora: null,
        local: null,
        campo: null,
      };

      const partidaAtualizada = await agendarPartida(p.id_partida, payload);
      onSucesso(partidaAtualizada);
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Erro ao limpar agendamento da partida.');
      }
    } finally {
      setLimpando(false);
    }
  };

  const tituloJogo = `${p.nome_mandante || 'Mandante'} × ${p.nome_visitante || 'Visitante'}`;
  const numeroJogo = p.numero_jogo;
  const ocupado = salvando || limpando;

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => (!aberto && !ocupado ? onClose() : undefined)}>
      <DialogContent title="Agendar Partida" description={`Jogo ${numeroJogo} · ${tituloJogo}`} size="md">
        <form id="form-agendar-partida" onSubmit={handleSalvar} className="space-y-4">
          {erro && <Alert tone="danger">{erro}</Alert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Data do jogo" htmlFor="agendamento-data">
              <Input
                id="agendamento-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                disabled={ocupado}
              />
            </Field>
            <Field label="Horário" htmlFor="agendamento-hora">
              <Input
                id="agendamento-hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                disabled={ocupado}
              />
            </Field>
          </div>

          <Field label="Local / praça esportiva" htmlFor="agendamento-local">
            <Input
              id="agendamento-local"
              type="text"
              placeholder="Ex.: Estádio Municipal, Centro Esportivo"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              disabled={ocupado}
            />
          </Field>

          <Field label="Campo / quadra" htmlFor="agendamento-campo">
            <Input
              id="agendamento-campo"
              type="text"
              placeholder="Ex.: Campo 1, Quadra principal"
              value={campo}
              onChange={(e) => setCampo(e.target.value)}
              disabled={ocupado}
            />
          </Field>
        </form>

        <DialogFooter className="sm:justify-between">
          <div>
            {temAgendamentoExistente && (
              <Button
                variant="danger-outline"
                onClick={handleLimpar}
                loading={limpando}
                disabled={salvando}
                leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
                className="w-full sm:w-auto"
              >
                Limpar Agendamento
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onClose} disabled={ocupado}>
              Cancelar
            </Button>
            <Button type="submit" form="form-agendar-partida" loading={salvando} disabled={limpando}>
              Salvar Agendamento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
