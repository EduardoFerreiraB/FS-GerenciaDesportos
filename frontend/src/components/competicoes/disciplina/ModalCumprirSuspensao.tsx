'use client';

import React, { useState, useEffect } from 'react';
import { CircleCheck } from 'lucide-react';
import { Alert, Button, Dialog, DialogContent, DialogFooter, Field, Select } from '@/components/ui';
import { useNotification } from '@/context/NotificationContext';
import { extrairErro } from '@/lib/erros';
import {
  cumprirSuspensao,
  listarPartidasElegiveisCumprimento,
} from '@/services/competicoes';
import type {
  SuspensaoDetalhe,
  PartidaDetalhe,
  PartidaElegivelCumprimento,
} from '@/types/competicoes';
import { ResumoSuspensao } from './ResumoSuspensao';

interface ModalCumprirSuspensaoProps {
  suspensao: SuspensaoDetalhe | null;
  partidas?: PartidaDetalhe[];
  isOpen: boolean;
  onClose: () => void;
  onSucesso: () => void;
}

export default function ModalCumprirSuspensao({
  suspensao,
  isOpen,
  onClose,
  onSucesso,
}: ModalCumprirSuspensaoProps) {
  const { toast } = useNotification();
  const [partidasElegiveis, setPartidasElegiveis] = useState<PartidaElegivelCumprimento[]>([]);
  const [carregandoPartidas, setCarregandoPartidas] = useState<boolean>(false);
  const [idPartida, setIdPartida] = useState<number | ''>('');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !suspensao) return;

    let ativo = true;
    setErro(null);
    setSalvando(false);
    setPartidasElegiveis([]);
    setIdPartida('');
    setCarregandoPartidas(true);

    listarPartidasElegiveisCumprimento(suspensao.id_suspensao)
      .then((lista) => {
        if (!ativo) return;
        setPartidasElegiveis(lista);
        if (lista.length > 0) {
          setIdPartida(lista[0].id_partida);
        }
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        setErro(
          extrairErro(err, { padrao: 'Não foi possível carregar as partidas elegíveis.' }).mensagem,
        );
      })
      .finally(() => {
        if (ativo) setCarregandoPartidas(false);
      });

    return () => {
      ativo = false;
    };
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
      toast('Cumprimento registrado com sucesso.', 'success');
      onSucesso();
      onClose();
    } catch (err: unknown) {
      setErro(
        extrairErro(err, { padrao: 'Falha ao registrar o cumprimento da suspensão.' }).mensagem,
      );
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
              hint={
                carregandoPartidas
                  ? 'Buscando partidas elegíveis…'
                  : 'Apenas partidas finalizadas da equipe, posteriores à origem e sem participação do atleta.'
              }
              required
            >
              <Select
                id="select-partida-cumprimento"
                data-testid="select-partida-cumprimento"
                value={idPartida}
                onChange={(e) => setIdPartida(e.target.value ? Number(e.target.value) : '')}
                disabled={carregandoPartidas || partidasElegiveis.length === 0}
              >
                {carregandoPartidas ? (
                  <option value="">Carregando partidas…</option>
                ) : partidasElegiveis.length === 0 ? (
                  <option value="">Nenhuma partida elegível disponível para esta suspensão</option>
                ) : (
                  <>
                    <option value="">Selecione a partida…</option>
                    {partidasElegiveis.map((p) => (
                      <option key={p.id_partida} value={p.id_partida}>
                        {p.rotulo}
                      </option>
                    ))}
                  </>
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
              disabled={!idPartida || carregandoPartidas}
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
