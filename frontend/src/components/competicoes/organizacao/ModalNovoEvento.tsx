'use client';

import React, { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Textarea,
} from '@/components/ui';
import { criarEventoComEdicao, isErroApi } from '@/services/competicoes';
import type { EventoDetalhe } from '@/types/competicoes';

interface ModalNovoEventoProps {
  aberto: boolean;
  onClose: () => void;
  onSuccess: (evento: EventoDetalhe) => void;
}

export default function ModalNovoEvento({
  aberto,
  onClose,
  onSuccess,
}: ModalNovoEventoProps) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [identificacao, setIdentificacao] = useState('1ª Edição');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('O nome do evento é obrigatório.');
      return;
    }
    if (!identificacao.trim()) {
      setErro('A identificação da edição é obrigatória.');
      return;
    }
    if (!dataInicio || !dataFim) {
      setErro('As datas de início e término são obrigatórias.');
      return;
    }

    try {
      setCarregando(true);
      const novoEvento = await criarEventoComEdicao({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        edicao: {
          identificacao: identificacao.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim,
        },
      });
      onSuccess(novoEvento);
      onClose();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Ocorreu um erro ao criar o evento.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v && !carregando) onClose();
      }}
    >
      <DialogContent
        size="md"
        title="Novo Evento Esportivo"
        description="Eventos agrupam competições, como jogos escolares e olimpíadas."
      >
        <form id="form-novo-evento" onSubmit={handleSubmit} className="space-y-6">
          {erro ? <Alert tone="danger">{erro}</Alert> : null}

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-fg">Evento</h3>
            <Field label="Nome do Evento" htmlFor="nome-evento" required>
              <Input
                id="nome-evento"
                type="text"
                required
                placeholder="Ex: Jogos da Primavera 2026"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </Field>

            <Field label="Descrição (Opcional)" htmlFor="descricao-evento">
              <Textarea
                id="descricao-evento"
                rows={2}
                placeholder="Informações gerais sobre o evento..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </Field>
          </section>

          <section className="space-y-4 border-t border-line pt-6">
            <h3 className="text-sm font-semibold text-fg">Primeira edição do evento</h3>
            <Field label="Identificação da Edição" htmlFor="identificacao-edicao" required>
              <Input
                id="identificacao-edicao"
                type="text"
                required
                placeholder="Ex: 2026 ou 1ª Edição"
                value={identificacao}
                onChange={(e) => setIdentificacao(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Data de Início" htmlFor="data-inicio-edicao" required>
                <Input
                  id="data-inicio-edicao"
                  type="date"
                  required
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </Field>
              <Field label="Data de Término" htmlFor="data-fim-edicao" required>
                <Input
                  id="data-fim-edicao"
                  type="date"
                  required
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </Field>
            </div>
          </section>
        </form>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={carregando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-novo-evento" loading={carregando}>
            Criar Evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
