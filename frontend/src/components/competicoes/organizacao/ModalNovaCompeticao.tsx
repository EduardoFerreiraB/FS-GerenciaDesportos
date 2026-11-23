'use client';

import React, { useState, useEffect } from 'react';
import { formatarPeriodo } from '@/lib/formatos';
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
import {
  criarCompeticaoComEdicao,
  listarEventos,
  isErroApi,
} from '@/services/competicoes';
import { modalidadeService } from '@/services';
import { useNotification } from '@/context/NotificationContext';
import { extrairErro } from '@/lib/erros';
import type {
  CompeticaoDetalhe,
  FormatoCompeticao,
  Configuracao,
  EventoDetalhe,
} from '@/types/competicoes';
import FormularioConfiguracao, {
  criarConfiguracaoPadrao,
} from './FormularioConfiguracao';

interface ModalNovaCompeticaoProps {
  aberto: boolean;
  onClose: () => void;
  onSuccess: (competicao: CompeticaoDetalhe) => void;
  idEdicaoEventoInicial?: number | null;
}

interface ModalidadeItem {
  id_modalidade: number;
  nome: string;
}

export default function ModalNovaCompeticao({
  aberto,
  onClose,
  onSuccess,
  idEdicaoEventoInicial = null,
}: ModalNovaCompeticaoProps) {
  const { toast } = useNotification();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [idModalidade, setIdModalidade] = useState<number | ''>('');
  const [modalidades, setModalidades] = useState<ModalidadeItem[]>([]);

  // Primeira Edição
  const [identificacao, setIdentificacao] = useState('1ª Edição');
  const [categoria, setCategoria] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [formato, setFormato] = useState<FormatoCompeticao>('GRUPOS_MATA_MATA');
  const [configuracao, setConfiguracao] = useState<Configuracao>(
    criarConfiguracaoPadrao('GRUPOS_MATA_MATA')
  );

  // Vínculo com evento
  const [idEdicaoEvento, setIdEdicaoEvento] = useState<number | null>(
    idEdicaoEventoInicial
  );
  const [eventos, setEventos] = useState<EventoDetalhe[]>([]);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroDataFim, setErroDataFim] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setNome('');
      setDescricao('');
      setIdentificacao('1ª Edição');
      setCategoria('');
      setDataInicio('');
      setDataFim('');
      setFormato('GRUPOS_MATA_MATA');
      setConfiguracao(criarConfiguracaoPadrao('GRUPOS_MATA_MATA'));
      setIdEdicaoEvento(idEdicaoEventoInicial ?? null);
      setErro(null);
      setErroNome(null);
      setErroDataFim(null);

      modalidadeService
        .getAll()
        .then((res: unknown) => {
          const mods = Array.isArray(res) ? (res as ModalidadeItem[]) : [];
          setModalidades(mods);
          if (mods.length > 0) {
            setIdModalidade((prev) => (prev === '' ? mods[0].id_modalidade : prev));
          }
        })
        .catch(() => {});

      listarEventos({ tamanho: 100 })
        .then((res) => {
          setEventos(res.itens);
        })
        .catch(() => {});
    }
  }, [aberto, idEdicaoEventoInicial]);

  useEffect(() => {
    if (idEdicaoEventoInicial !== undefined) {
      setIdEdicaoEvento(idEdicaoEventoInicial);
    }
  }, [idEdicaoEventoInicial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setErroDataFim(null);

    if (!nome.trim()) {
      setErro('O nome da competição é obrigatório.');
      return;
    }
    if (!idModalidade) {
      setErro('A modalidade é obrigatória.');
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
    if (dataFim < dataInicio) {
      setErroDataFim('A data de término não pode ser anterior à data de início.');
      return;
    }

    try {
      setCarregando(true);
      const novaCompeticao = await criarCompeticaoComEdicao({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        id_modalidade: Number(idModalidade),
        edicao: {
          identificacao: identificacao.trim(),
          data_inicio: dataInicio,
          data_fim: dataFim,
          categoria: categoria.trim() || null,
          formato,
          configuracao,
          id_edicao_evento: idEdicaoEvento || null,
        },
      });
      toast('Competição criada com sucesso.', 'success');
      onSuccess(novaCompeticao);
      onClose();
    } catch (err: unknown) {
      const parsed = extrairErro(err, {
        camposConhecidos: ['nome', 'edicao.data_fim', 'data_fim'],
        padrao: 'Ocorreu um erro ao criar a competição.',
      });
      const camposLista = isErroApi(err) ? (err.campos ?? []) : [];
      const msgNome = parsed.campos['nome'] ?? (camposLista.includes('nome') ? parsed.mensagem : null);
      const msgDataFim =
        parsed.campos['edicao.data_fim'] ??
        parsed.campos['data_fim'] ??
        (camposLista.includes('edicao.data_fim') || camposLista.includes('data_fim')
          ? parsed.mensagem
          : null);
      if (msgNome) setErroNome(msgNome);
      if (msgDataFim) setErroDataFim(msgDataFim);
      if (!msgNome && !msgDataFim) {
        setErro(parsed.mensagem);
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
        size="lg"
        title="Nova Competição"
        description="Cadastre a competição e a primeira edição dela."
      >
        <form id="form-nova-competicao" onSubmit={handleSubmit} className="space-y-6">
          {erro ? <Alert tone="danger">{erro}</Alert> : null}

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-fg">Competição</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Nome da Competição"
                htmlFor="nome-competicao"
                required
                error={erroNome ?? undefined}
              >
                <Input
                  id="nome-competicao"
                  type="text"
                  required
                  placeholder="Ex: Campeonato Municipal"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setErroNome(null);
                    setErro(null);
                  }}
                />
              </Field>

              <Field label="Modalidade" htmlFor="modalidade-competicao" required>
                <Select
                  id="modalidade-competicao"
                  required
                  value={idModalidade}
                  onChange={(e) => setIdModalidade(Number(e.target.value))}
                >
                  <option value="" disabled>
                    Selecione a modalidade
                  </option>
                  {modalidades.map((mod) => (
                    <option key={mod.id_modalidade} value={mod.id_modalidade}>
                      {mod.nome}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Descrição (Opcional)" htmlFor="descricao-competicao">
              <Textarea
                id="descricao-competicao"
                rows={2}
                placeholder="Detalhes sobre a competição..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </Field>

            {/* Vínculo opcional com evento esportivo */}
            {eventos.length > 0 && !idEdicaoEventoInicial && (
              <Field
                label="Vincular a Edição de Evento (Opcional)"
                htmlFor="evento-vinculo"
                hint="As datas da edição precisam caber no período do evento."
              >
                <Select
                  id="evento-vinculo"
                  value={idEdicaoEvento ?? ''}
                  onChange={(e) => setIdEdicaoEvento(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Nenhum (Competição Independente)</option>
                  {eventos.map((ev) =>
                    ev.edicoes.map((ed) => (
                      <option key={ed.id_edicao_evento} value={ed.id_edicao_evento}>
                        {ev.nome} - {ed.identificacao} ({formatarPeriodo(ed.data_inicio, ed.data_fim)})
                      </option>
                    )),
                  )}
                </Select>
              </Field>
            )}
          </section>

          <section className="space-y-4 border-t border-line pt-6">
            <h3 className="text-sm font-semibold text-fg">Primeira edição</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <Field label="Categoria (Opcional)" htmlFor="categoria-edicao">
                <Input
                  id="categoria-edicao"
                  type="text"
                  placeholder="Ex: Sub-17, Adulto Principal"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
              </Field>

              <Field label="Data de Início" htmlFor="data-inicio-edicao" required>
                <Input
                  id="data-inicio-edicao"
                  type="date"
                  required
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setErroDataFim(null);
                    setErro(null);
                  }}
                />
              </Field>

              <Field
                label="Data de Término"
                htmlFor="data-fim-edicao"
                required
                error={erroDataFim ?? undefined}
              >
                <Input
                  id="data-fim-edicao"
                  type="date"
                  required
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setErroDataFim(null);
                    setErro(null);
                  }}
                />
              </Field>
            </div>

            <FormularioConfiguracao
              formato={formato}
              onFormatoChange={setFormato}
              configuracao={configuracao}
              onChange={setConfiguracao}
            />
          </section>
        </form>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={carregando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-nova-competicao" loading={carregando}>
            Criar Competição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
