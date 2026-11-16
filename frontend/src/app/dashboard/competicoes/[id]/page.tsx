'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CalendarPlus, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import {
  obterCompeticao,
  criarEdicaoCompeticao,
  excluirCompeticao,
  isErroApi,
} from '@/services/competicoes';
import { modalidadeService } from '@/services';
import type { CompeticaoDetalhe, FormatoCompeticao, Configuracao } from '@/types/competicoes';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { ROTULO_ESTADO_EDICAO } from '@/lib/rotulos';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/ui';
import PainelEdicao from '@/components/competicoes/organizacao/PainelEdicao';
import ModalConfirmarExclusao from '@/components/competicoes/organizacao/ModalConfirmarExclusao';
import FormularioConfiguracao, {
  criarConfiguracaoPadrao,
} from '@/components/competicoes/organizacao/FormularioConfiguracao';

interface ModalidadeItem {
  id_modalidade: number;
  nome: string;
}

export default function CompeticaoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const idCompeticao = Number(params?.id);

  const [competicao, setCompeticao] = useState<CompeticaoDetalhe | null>(null);
  const [modalidades, setModalidades] = useState<ModalidadeItem[]>([]);
  const [edicaoSelecionadaId, setEdicaoSelecionadaId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Modal Nova Edição
  const [modalNovaEdicaoAberto, setModalNovaEdicaoAberto] = useState(false);
  const [identificacaoNova, setIdentificacaoNova] = useState('');
  const [dataInicioNova, setDataInicioNova] = useState('');
  const [dataFimNova, setDataFimNova] = useState('');
  const [categoriaNova, setCategoriaNova] = useState('');
  const [formatoNovo, setFormatoNovo] = useState<FormatoCompeticao>('GRUPOS_MATA_MATA');
  const [configNovo, setConfigNovo] = useState<Configuracao>(
    criarConfiguracaoPadrao('GRUPOS_MATA_MATA')
  );
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroNovaEdicao, setErroNovaEdicao] = useState<string | null>(null);

  useBreadcrumb([
    { label: 'Competições', href: '/dashboard/competicoes' },
    ...(competicao ? [{ label: competicao.nome }] : []),
  ]);

  const carregarCompeticao = useCallback(async () => {
    if (isNaN(idCompeticao)) {
      setErro('ID de competição inválido.');
      setCarregando(false);
      return;
    }
    try {
      setCarregando(true);
      setErro(null);
      const dados = await obterCompeticao(idCompeticao);
      setCompeticao(dados);
      if (dados.edicoes && dados.edicoes.length > 0) {
        setEdicaoSelecionadaId((prev) => {
          if (prev && dados.edicoes.some((e) => e.id_edicao_competicao === prev)) {
            return prev;
          }
          return dados.edicoes[dados.edicoes.length - 1].id_edicao_competicao;
        });
      } else {
        setEdicaoSelecionadaId(null);
      }
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar detalhes da competição.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idCompeticao]);

  useEffect(() => {
    carregarCompeticao();
  }, [carregarCompeticao]);

  useEffect(() => {
    modalidadeService
      .getAll()
      .then((res: unknown) => {
        if (Array.isArray(res)) setModalidades(res as ModalidadeItem[]);
      })
      .catch(() => {});
  }, []);

  const handleCriarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificacaoNova.trim() || !dataInicioNova || !dataFimNova) {
      setErroNovaEdicao('Preencha os campos obrigatórios da edição.');
      return;
    }
    try {
      setSalvandoEdicao(true);
      setErroNovaEdicao(null);
      const novaEdicao = await criarEdicaoCompeticao(idCompeticao, {
        identificacao: identificacaoNova.trim(),
        data_inicio: dataInicioNova,
        data_fim: dataFimNova,
        categoria: categoriaNova.trim() || null,
        formato: formatoNovo,
        configuracao: configNovo,
      });

      setModalNovaEdicaoAberto(false);
      setIdentificacaoNova('');
      setDataInicioNova('');
      setDataFimNova('');
      setCategoriaNova('');
      await carregarCompeticao();
      setEdicaoSelecionadaId(novaEdicao.id_edicao_competicao);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroNovaEdicao(err.mensagem);
      } else if (err instanceof Error) {
        setErroNovaEdicao(err.message);
      } else {
        setErroNovaEdicao('Falha ao criar nova edição.');
      }
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Esqueleto só na primeira carga: recarregar depois de uma ação não desmonta a edição aberta.
  if (carregando && !competicao) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Carregando competição">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (erro || !competicao) {
    return (
      <div className="space-y-6">
        <Alert
          tone="danger"
          title="Erro ao carregar competição"
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard/competicoes">Voltar para competições</Link>
              </Button>
              <Button size="sm" variant="secondary" onClick={carregarCompeticao}>
                Tentar novamente
              </Button>
            </div>
          }
        >
          {erro}
        </Alert>
      </div>
    );
  }

  const modalidade = modalidades.find((m) => m.id_modalidade === competicao.id_modalidade)?.nome;
  const totalEdicoes = competicao.edicoes.length;
  const descricao = [modalidade, competicao.descricao].filter(Boolean).join(' · ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="block break-words">{competicao.nome}</span>}
        description={descricao || undefined}
        actions={
          <>
            <Button
              leftIcon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setModalNovaEdicaoAberto(true)}
            >
              Nova edição
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton aria-label="Mais ações da competição" variant="secondary" data-testid="menu-acoes-competicao">
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  tone="danger"
                  data-testid="btn-excluir-competicao"
                  onSelect={() => setModalExclusaoAberto(true)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Excluir competição
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {totalEdicoes > 0 ? (
        <div className="max-w-sm">
          <Field label="Edição" htmlFor="seletor-edicao">
            <Select
              id="seletor-edicao"
              data-testid="seletor-edicao"
              value={edicaoSelecionadaId ?? ''}
              onChange={(e) => setEdicaoSelecionadaId(Number(e.target.value))}
            >
              {competicao.edicoes.map((ed) => (
                <option key={ed.id_edicao_competicao} value={ed.id_edicao_competicao}>
                  {ed.identificacao} · {ROTULO_ESTADO_EDICAO[ed.estado] ?? ed.estado}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {edicaoSelecionadaId ? (
        <PainelEdicao
          idEdicaoCompeticao={edicaoSelecionadaId}
          onEdicaoAtualizada={carregarCompeticao}
          onEdicaoExcluida={() => {
            setEdicaoSelecionadaId(null);
            carregarCompeticao();
          }}
        />
      ) : (
        <EmptyState
          icon={<CalendarPlus />}
          title="Nenhuma edição cadastrada"
          description="Crie a primeira edição desta competição para começar a definir regulamentos e equipes."
          action={
            <Button
              leftIcon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setModalNovaEdicaoAberto(true)}
            >
              Criar primeira edição
            </Button>
          }
        />
      )}

      <ModalConfirmarExclusao
        aberto={modalExclusaoAberto}
        titulo="Excluir competição"
        textoConfirmacao={competicao.nome}
        descricao={
          <>
            <span className="block">
              A competição <strong>{competicao.nome}</strong> será apagada junto com{' '}
              <strong>{totalEdicoes === 1 ? '1 edição' : `${totalEdicoes} edições`}</strong> e tudo o que
              pertence a elas: equipes, elencos, jogos, súmulas, classificação e suspensões.
            </span>
            <span className="block">
              Para encerrar só um campeonato e manter a competição, use <strong>Cancelar edição</strong> ou{' '}
              <strong>Excluir edição</strong> no menu da edição. Os competidores cadastrados não são apagados.
            </span>
          </>
        }
        onFechar={() => setModalExclusaoAberto(false)}
        onConfirmar={async () => {
          await excluirCompeticao(competicao.id_competicao);
          router.push('/dashboard/competicoes');
        }}
      />

      <Dialog
        open={modalNovaEdicaoAberto}
        onOpenChange={(aberto) => {
          if (!aberto && !salvandoEdicao) setModalNovaEdicaoAberto(false);
        }}
      >
        <DialogContent
          size="lg"
          title="Nova Edição da Competição"
          description={`Mais uma edição de ${competicao.nome}, com regulamento próprio.`}
        >
          <form id="form-nova-edicao" onSubmit={handleCriarEdicao} className="space-y-6">
            {erroNovaEdicao ? <Alert tone="danger">{erroNovaEdicao}</Alert> : null}

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-fg">Dados da edição</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Identificação da Edição" htmlFor="nova-edicao-identificacao" required>
                  <Input
                    id="nova-edicao-identificacao"
                    type="text"
                    required
                    placeholder="Ex: 2026 ou 2ª Edição"
                    value={identificacaoNova}
                    onChange={(e) => setIdentificacaoNova(e.target.value)}
                  />
                </Field>
                <Field label="Categoria (Opcional)" htmlFor="nova-edicao-categoria">
                  <Input
                    id="nova-edicao-categoria"
                    type="text"
                    placeholder="Ex: Sub-17"
                    value={categoriaNova}
                    onChange={(e) => setCategoriaNova(e.target.value)}
                  />
                </Field>
                <Field label="Data de Início" htmlFor="nova-edicao-data-inicio" required>
                  <Input
                    id="nova-edicao-data-inicio"
                    type="date"
                    required
                    value={dataInicioNova}
                    onChange={(e) => setDataInicioNova(e.target.value)}
                  />
                </Field>
                <Field label="Data de Término" htmlFor="nova-edicao-data-fim" required>
                  <Input
                    id="nova-edicao-data-fim"
                    type="date"
                    required
                    value={dataFimNova}
                    onChange={(e) => setDataFimNova(e.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4 border-t border-line pt-6">
              <h3 className="text-sm font-semibold text-fg">Regulamento</h3>
              <FormularioConfiguracao
                formato={formatoNovo}
                onFormatoChange={setFormatoNovo}
                configuracao={configNovo}
                onChange={setConfigNovo}
              />
            </section>
          </form>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setModalNovaEdicaoAberto(false)}
              disabled={salvandoEdicao}
            >
              Cancelar
            </Button>
            <Button type="submit" form="form-nova-edicao" loading={salvandoEdicao}>
              Salvar Edição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
