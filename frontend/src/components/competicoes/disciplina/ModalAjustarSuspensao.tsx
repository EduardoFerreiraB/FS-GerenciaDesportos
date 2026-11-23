'use client';

import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { ROTULO_ORIGEM_SUSPENSAO, ROTULO_SITUACAO_SUSPENSAO } from '@/lib/rotulos';
import { useNotification } from '@/context/NotificationContext';
import { extrairErro } from '@/lib/erros';
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
import { ResumoSuspensao } from './ResumoSuspensao';

interface ModalAjustarSuspensaoProps {
  suspensao: SuspensaoDetalhe | null; // null = Criar Manual, non-null = Ajustar
  idEdicaoCompeticao: number;
  equipes: EquipeDetalhe[];
  isOpen: boolean;
  onClose: () => void;
  onSucesso: () => void;
}

const SITUACOES: SituacaoSuspensao[] = ['ATIVA', 'CUMPRIDA', 'EM_REVISAO', 'CANCELADA'];

export default function ModalAjustarSuspensao({
  suspensao,
  idEdicaoCompeticao,
  equipes,
  isOpen,
  onClose,
  onSucesso,
}: ModalAjustarSuspensaoProps) {
  const { toast } = useNotification();
  const modoAjustar = suspensao !== null;

  // Estados do formulário
  const [idIntegrante, setIdIntegrante] = useState<number | ''>('');
  const [jogos, setJogos] = useState<number>(1);
  const [situacao, setSituacao] = useState<SituacaoSuspensao>('ATIVA');
  const [motivo, setMotivo] = useState<string>('');

  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroSituacao, setErroSituacao] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setErro(null);
    setErroSituacao(null);
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

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setErroSituacao(null);

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

      toast(
        modoAjustar
          ? 'Suspensão atualizada com sucesso.'
          : 'Suspensão manual criada com sucesso.',
        'success',
      );
      onSucesso();
      onClose();
    } catch (err: unknown) {
      const parsed = extrairErro(err, {
        camposConhecidos: ['situacao'],
        padrao: 'Falha ao processar suspensão.',
      });
      const camposLista = isErroApi(err) ? (err.campos ?? []) : [];
      const msgSituacao =
        parsed.campos['situacao'] ??
        (camposLista.includes('situacao') ? parsed.mensagem : null);
      if (msgSituacao) {
        setErroSituacao(msgSituacao);
      } else {
        setErro(parsed.mensagem);
      }
    } finally {
      setSalvando(false);
    }
  };

  const idMotivo = modoAjustar ? 'input-motivo-ajuste' : 'input-motivo-suspensao';

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => (!aberto && !salvando ? onClose() : undefined)}>
      <DialogContent
        title={modoAjustar ? 'Ajustar / revisar suspensão' : 'Nova suspensão manual'}
        description={
          modoAjustar && suspensao
            ? `Suspensão #${suspensao.id_suspensao} — justificativa obrigatória`
            : 'Aplicação administrativa de punição disciplinar.'
        }
      >
        <form id="form-ajustar-suspensao" onSubmit={handleSalvar} className="space-y-4">
          {erro && (
            <Alert tone="danger" data-testid="alerta-erro-ajuste">
              {erro}
            </Alert>
          )}

          {/* Modo ajustar: resumo dos dados atuais */}
          {modoAjustar && suspensao && (
            <ResumoSuspensao
              itens={[
                {
                  rotulo: 'Atleta',
                  valor: suspensao.nome_esportivo || `Integrante #${suspensao.id_integrante}`,
                },
                ...(suspensao.nome_equipe ? [{ rotulo: 'Equipe', valor: suspensao.nome_equipe }] : []),
                {
                  rotulo: 'Origem',
                  valor: ROTULO_ORIGEM_SUSPENSAO[suspensao.origem] ?? 'Outra',
                },
                {
                  rotulo: 'Jogos cumpridos',
                  valor: `${suspensao.jogos_cumpridos} de ${suspensao.jogos}`,
                  numerico: true,
                },
              ]}
            />
          )}

          {/* Modo criar manual: seleção do integrante */}
          {!modoAjustar && (
            <Field label="Atleta" htmlFor="select-integrante" required>
              <Select
                id="select-integrante"
                data-testid="select-integrante"
                value={idIntegrante}
                onChange={(e) => setIdIntegrante(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">Selecione um atleta…</option>
                {equipes.map((eq) => (
                  <optgroup key={eq.id_equipe} label={eq.nome}>
                    {(eq.integrantes || []).map((i) => (
                      <option key={i.id_integrante} value={i.id_integrante}>
                        {i.nome_esportivo} ({eq.nome})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
          )}

          <div className={modoAjustar ? 'grid grid-cols-1 gap-4 sm:grid-cols-2' : undefined}>
            <Field
              label="Quantidade de jogos"
              htmlFor="input-jogos-suspensao"
              required
              hint={
                modoAjustar && suspensao && suspensao.jogos_cumpridos > 0
                  ? `Não pode ser menor que os ${suspensao.jogos_cumpridos} jogos já cumpridos.`
                  : undefined
              }
            >
              <Input
                id="input-jogos-suspensao"
                data-testid="input-jogos-suspensao"
                type="number"
                inputMode="numeric"
                min={modoAjustar && suspensao ? Math.max(1, suspensao.jogos_cumpridos) : 1}
                value={jogos}
                onChange={(e) => setJogos(Number(e.target.value))}
                className="tabular-nums"
                required
              />
            </Field>

            {/* Situação da suspensão (apenas em modo Ajustar) */}
            {modoAjustar && (
              <Field
                label="Situação"
                htmlFor="select-situacao-suspensao"
                required
                error={erroSituacao ?? undefined}
              >
                <Select
                  id="select-situacao-suspensao"
                  data-testid="select-situacao-suspensao"
                  value={situacao}
                  onChange={(e) => {
                    setSituacao(e.target.value as SituacaoSuspensao);
                    setErroSituacao(null);
                    setErro(null);
                  }}
                >
                  {SITUACOES.map((s) => (
                    <option key={s} value={s}>
                      {ROTULO_SITUACAO_SUSPENSAO[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <Field
            label={modoAjustar ? 'Justificativa do ajuste' : 'Motivo da suspensão'}
            htmlFor={idMotivo}
            hint="Mínimo de 3 caracteres."
            required
          >
            <Textarea
              id={idMotivo}
              data-testid={idMotivo}
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                modoAjustar
                  ? 'Explique o motivo do ajuste, julgamento do TJD ou retificação…'
                  : 'Descreva a infração ou o motivo da aplicação manual…'
              }
              required
            />
          </Field>
        </form>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={salvando}
            data-testid="btn-cancelar-ajuste"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-ajustar-suspensao"
            loading={salvando}
            disabled={(!modoAjustar && !idIntegrante) || motivo.trim().length < 3}
            data-testid={modoAjustar ? 'btn-salvar-ajuste' : 'btn-salvar-suspensao'}
            leftIcon={<Save className="size-4" />}
          >
            {modoAjustar ? 'Salvar ajuste' : 'Criar suspensão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
