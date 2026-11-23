'use client';

/**
 * ModalEditarEdicao — corrige identificação, categoria e datas da edição (PD-RT10-01).
 * Os erros da API aparecem abaixo do campo correspondente (PD-RT09-01).
 */
import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogContent, DialogFooter, Field, Input } from '@/components/ui';
import { atualizarEdicao } from '@/services/competicoes';
import type { EdicaoCompeticaoDetalhe } from '@/types/competicoes';
import { extrairErro } from '@/lib/erros';

const CAMPOS = ['identificacao', 'categoria', 'data_inicio', 'data_fim'] as const;

interface ModalEditarEdicaoProps {
  edicao: EdicaoCompeticaoDetalhe;
  aberto: boolean;
  onFechar: () => void;
  onSalvo: (edicao: EdicaoCompeticaoDetalhe) => void;
}

export default function ModalEditarEdicao({ edicao, aberto, onFechar, onSalvo }: ModalEditarEdicaoProps) {
  const [identificacao, setIdentificacao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!aberto) return;
    setIdentificacao(edicao.identificacao);
    setCategoria(edicao.categoria ?? '');
    setDataInicio(edicao.data_inicio ?? '');
    setDataFim(edicao.data_fim ?? '');
    setErro(null);
    setErros({});
  }, [aberto, edicao]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const locais: Record<string, string> = {};
    if (!identificacao.trim()) locais.identificacao = 'Informe a identificação.';
    if (!dataInicio) locais.data_inicio = 'Informe a data de início.';
    if (!dataFim) locais.data_fim = 'Informe a data de término.';
    if (dataInicio && dataFim && dataFim < dataInicio) {
      locais.data_fim = 'A data de término deve ser igual ou posterior à data de início.';
    }
    setErros(locais);
    setErro(null);
    if (Object.keys(locais).length > 0) return;

    setSalvando(true);
    try {
      const atualizada = await atualizarEdicao(edicao.id_edicao_competicao, {
        identificacao: identificacao.trim(),
        categoria: categoria.trim() || null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        formato: edicao.formato,
        configuracao: edicao.configuracao,
        id_edicao_evento: edicao.id_edicao_evento,
        revisao: edicao.revisao,
      });
      onSalvo(atualizada);
      onFechar();
    } catch (err) {
      const extraido = extrairErro(err, { camposConhecidos: CAMPOS });
      setErros(extraido.campos);
      setErro(extraido.mensagem);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => (!v && !salvando ? onFechar() : undefined)}>
      <DialogContent title="Editar edição" description="Identificação, categoria e período da edição." size="md">
        <form id="form-editar-edicao" onSubmit={salvar} className="space-y-4" noValidate>
          {erro && <Alert tone="danger">{erro}</Alert>}
          <Field label="Identificação" htmlFor="editar-edicao-identificacao" required error={erros.identificacao}>
            <Input
              id="editar-edicao-identificacao"
              value={identificacao}
              onChange={(e) => setIdentificacao(e.target.value)}
            />
          </Field>
          <Field label="Categoria" htmlFor="editar-edicao-categoria" error={erros.categoria}>
            <Input id="editar-edicao-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Data de início" htmlFor="editar-edicao-inicio" required error={erros.data_inicio}>
              <Input
                id="editar-edicao-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </Field>
            <Field label="Data de término" htmlFor="editar-edicao-fim" required error={erros.data_fim}>
              <Input id="editar-edicao-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-editar-edicao" loading={salvando}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
