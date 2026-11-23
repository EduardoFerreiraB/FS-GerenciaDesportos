'use client';

/**
 * ModalEditarCompeticao — corrige nome e descrição da competição (PD-RT10-01).
 * Nome repetido (409 DUPLICIDADE) aparece abaixo do campo Nome (PD-RT09-01/03).
 */
import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogContent, DialogFooter, Field, Input, Textarea } from '@/components/ui';
import { atualizarCompeticao } from '@/services/competicoes';
import type { CompeticaoDetalhe } from '@/types/competicoes';
import { extrairErro } from '@/lib/erros';

interface ModalEditarCompeticaoProps {
  competicao: CompeticaoDetalhe;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: (competicao: CompeticaoDetalhe) => void;
}

export default function ModalEditarCompeticao({ competicao, aberto, onFechar, onSalvo }: ModalEditarCompeticaoProps) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!aberto) return;
    setNome(competicao.nome);
    setDescricao(competicao.descricao ?? '');
    setErro(null);
    setErros({});
  }, [aberto, competicao]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) {
      setErros({ nome: 'Informe o nome da competição.' });
      return;
    }
    setErros({});
    setSalvando(true);
    try {
      const atualizada = await atualizarCompeticao(competicao.id_competicao, {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
      });
      onSalvo(atualizada);
      onFechar();
    } catch (err) {
      const extraido = extrairErro(err, { camposConhecidos: ['nome', 'descricao'] });
      setErros(extraido.campos);
      setErro(Object.keys(extraido.campos).length > 0 ? null : extraido.mensagem);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => (!v && !salvando ? onFechar() : undefined)}>
      <DialogContent title="Editar competição" description="Nome e descrição exibidos no painel e no portal." size="md">
        <form id="form-editar-competicao" onSubmit={salvar} className="space-y-4" noValidate>
          {erro && <Alert tone="danger">{erro}</Alert>}
          <Field label="Nome" htmlFor="editar-competicao-nome" required error={erros.nome}>
            <Input id="editar-competicao-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Descrição" htmlFor="editar-competicao-descricao" error={erros.descricao}>
            <Textarea
              id="editar-competicao-descricao"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-editar-competicao" loading={salvando}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
