'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  obterEdicao,
  atualizarEdicao,
  publicarEdicao,
  finalizarEdicao,
  reabrirEdicao,
  cancelarEdicao,
  excluirEdicao,
  isErroApi,
} from '@/services/competicoes';
import type {
  EdicaoCompeticaoDetalhe,
  Configuracao,
  FormatoCompeticao,
} from '@/types/competicoes';
import GestaoEquipes from '@/components/competicoes/elencos/GestaoEquipes';
import VisualizadorPartidas from '@/components/competicoes/disputa/VisualizadorPartidas';
import ChaveamentoEliminatorio from '@/components/competicoes/disputa/ChaveamentoEliminatorio';
import TabelaClassificacao from '@/components/competicoes/classificacao/TabelaClassificacao';
import PainelDisciplina from '@/components/competicoes/disciplina/PainelDisciplina';
import FormularioConfiguracao from './FormularioConfiguracao';
import ModalConfirmarExclusao from './ModalConfirmarExclusao';
import VisaoGeralEdicao, { type AbaEdicao } from './VisaoGeralEdicao';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  IconButton,
  Input,
  Skeleton,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { formatarPeriodo } from '@/lib/formatos';
import { ROTULO_FORMATO } from '@/lib/rotulos';
import {
  CalendarDays,
  Flag,
  Globe,
  LayoutDashboard,
  Lock,
  MoreHorizontal,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Swords,
  Table2,
  Trash2,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';

interface PainelEdicaoProps {
  idEdicaoCompeticao: number;
  onEdicaoAtualizada?: (edicao: EdicaoCompeticaoDetalhe) => void;
  /** Chamado depois que a edição foi excluída; a competição continua existindo. */
  onEdicaoExcluida?: (idEdicaoCompeticao: number) => void;
}

export default function PainelEdicao({
  idEdicaoCompeticao,
  onEdicaoAtualizada,
  onEdicaoExcluida,
}: PainelEdicaoProps) {
  const [edicao, setEdicao] = useState<EdicaoCompeticaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<AbaEdicao>('visao_geral');

  // Estado da aba de configuração
  const [formatoEdit, setFormatoEdit] = useState<FormatoCompeticao>('GRUPOS_MATA_MATA');
  const [configEdit, setConfigEdit] = useState<Configuracao | null>(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [mensagemSucessoConfig, setMensagemSucessoConfig] = useState<string | null>(null);
  const [erroConfig, setErroConfig] = useState<string | null>(null);

  // Estado de publicação e ciclo de vida
  const [alterandoPublicacao, setAlterandoPublicacao] = useState(false);
  const [erroPublicacao, setErroPublicacao] = useState<string | null>(null);
  const [modalCicloAcao, setModalCicloAcao] = useState<'REABRIR' | 'CANCELAR' | null>(null);
  const [motivoCiclo, setMotivoCiclo] = useState('');
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);

  const carregarEdicao = useCallback(async () => {
    try {
      setCarregando(true);
      setErroCarregamento(null);
      const dados = await obterEdicao(idEdicaoCompeticao);
      setEdicao(dados);
      setFormatoEdit(dados.formato);
      setConfigEdit(dados.configuracao);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroCarregamento(err.mensagem);
      } else if (err instanceof Error) {
        setErroCarregamento(err.message);
      } else {
        setErroCarregamento('Falha ao carregar detalhes da edição.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarEdicao();
  }, [carregarEdicao]);

  /**
   * Ao trocar de aba, atualiza o cabeçalho em silêncio: gerar/desfazer a tabela
   * na aba Jogos muda o estado da edição sem passar por este painel.
   */
  const trocarAba = (aba: AbaEdicao) => {
    setAbaAtiva(aba);
    obterEdicao(idEdicaoCompeticao)
      .then((dados) => setEdicao(dados))
      .catch(() => {});
  };

  const handleAlternarPublicacao = async () => {
    if (!edicao) return;
    try {
      setAlterandoPublicacao(true);
      setErroPublicacao(null);
      const novaPublicada = !edicao.publicada;
      const atualizada = await publicarEdicao(edicao.id_edicao_competicao, novaPublicada);
      setEdicao(atualizada);
      if (onEdicaoAtualizada) {
        onEdicaoAtualizada(atualizada);
      }
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroPublicacao(err.mensagem);
      } else if (err instanceof Error) {
        setErroPublicacao(err.message);
      } else {
        setErroPublicacao('Falha ao alterar publicação da edição.');
      }
    } finally {
      setAlterandoPublicacao(false);
    }
  };

  const handleFinalizarEdicao = async () => {
    if (!edicao) return;
    try {
      setAlterandoPublicacao(true);
      setErroPublicacao(null);
      const atualizada = await finalizarEdicao(edicao.id_edicao_competicao);
      setEdicao(atualizada);
      if (onEdicaoAtualizada) onEdicaoAtualizada(atualizada);
    } catch (err: unknown) {
      setErroPublicacao(isErroApi(err) ? err.mensagem : 'Falha ao finalizar edição.');
    } finally {
      setAlterandoPublicacao(false);
    }
  };

  const handleConfirmarCiclo = async () => {
    if (!edicao || !modalCicloAcao) return;
    if (motivoCiclo.trim().length < 3) {
      setErroPublicacao('Informe uma justificativa de pelo menos 3 caracteres.');
      return;
    }
    try {
      setAlterandoPublicacao(true);
      setErroPublicacao(null);
      const atualizada =
        modalCicloAcao === 'REABRIR'
          ? await reabrirEdicao(edicao.id_edicao_competicao, motivoCiclo.trim())
          : await cancelarEdicao(edicao.id_edicao_competicao, motivoCiclo.trim());
      setEdicao(atualizada);
      setModalCicloAcao(null);
      setMotivoCiclo('');
      if (onEdicaoAtualizada) onEdicaoAtualizada(atualizada);
    } catch (err: unknown) {
      setErroPublicacao(isErroApi(err) ? err.mensagem : 'Falha ao alterar estado da edição.');
    } finally {
      setAlterandoPublicacao(false);
    }
  };

  const abrirCiclo = (acao: 'REABRIR' | 'CANCELAR') => {
    setErroPublicacao(null);
    setModalCicloAcao(acao);
    setMotivoCiclo('');
  };

  const handleSalvarConfiguracao = async () => {
    if (!edicao || !configEdit) return;
    try {
      setSalvandoConfig(true);
      setErroConfig(null);
      setMensagemSucessoConfig(null);

      const edicaoAtualizada = await atualizarEdicao(edicao.id_edicao_competicao, {
        identificacao: edicao.identificacao,
        data_inicio: edicao.data_inicio,
        data_fim: edicao.data_fim,
        categoria: edicao.categoria,
        formato: formatoEdit,
        configuracao: configEdit,
        id_edicao_evento: edicao.id_edicao_evento,
        revisao: edicao.revisao,
      });

      setEdicao(edicaoAtualizada);
      setFormatoEdit(edicaoAtualizada.formato);
      setConfigEdit(edicaoAtualizada.configuracao);
      setMensagemSucessoConfig('Configuração salva com sucesso!');
      if (onEdicaoAtualizada) {
        onEdicaoAtualizada(edicaoAtualizada);
      }
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroConfig(err.mensagem);
      } else if (err instanceof Error) {
        setErroConfig(err.message);
      } else {
        setErroConfig('Falha ao salvar configuração da edição.');
      }
    } finally {
      setSalvandoConfig(false);
    }
  };

  if (carregando) {
    return (
      <Card className="space-y-4 p-6" aria-busy="true" aria-label="Carregando edição">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  if (erroCarregamento || !edicao) {
    return (
      <Alert
        tone="danger"
        title="Erro ao carregar edição"
        action={
          <Button size="sm" variant="secondary" onClick={carregarEdicao}>
            Tentar novamente
          </Button>
        }
      >
        {erroCarregamento || 'Não foi possível encontrar as informações desta edição.'}
      </Alert>
    );
  }

  // Uma única ação primária, conforme o estado da edição.
  const acaoPrimaria =
    edicao.estado === 'RASCUNHO' ? (
      <Button leftIcon={<Table2 className="size-4" aria-hidden="true" />} onClick={() => trocarAba('jogos')}>
        Gerar tabela
      </Button>
    ) : edicao.estado === 'EM_ANDAMENTO' ? (
      <Button
        data-testid="btn-finalizar-edicao"
        leftIcon={<Flag className="size-4" aria-hidden="true" />}
        onClick={handleFinalizarEdicao}
        loading={alterandoPublicacao && !modalCicloAcao}
        disabled={alterandoPublicacao}
      >
        Finalizar edição
      </Button>
    ) : edicao.estado === 'FINALIZADA' ? (
      <Button
        data-testid="btn-reabrir-edicao"
        leftIcon={<RotateCcw className="size-4" aria-hidden="true" />}
        onClick={() => abrirCiclo('REABRIR')}
        disabled={alterandoPublicacao}
      >
        Reabrir edição
      </Button>
    ) : null;

  return (
    <Card className="overflow-hidden">
      {/* Cabeçalho da edição */}
      <div className="border-b border-line p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight text-fg" title={edicao.identificacao}>
                {edicao.identificacao}
              </h2>
              <StatusBadge tipo="edicao" valor={edicao.estado} data-testid="badge-estado-edicao" />
              <Badge tone={edicao.publicada ? 'success' : 'neutral'} data-testid="badge-publicacao-edicao">
                {edicao.publicada ? (
                  <Globe className="size-3" aria-hidden="true" />
                ) : (
                  <Lock className="size-3" aria-hidden="true" />
                )}
                {edicao.publicada ? 'Publicada' : 'Não publicada'}
              </Badge>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <CalendarDays className="size-4 text-fg-subtle" aria-hidden="true" />
                {formatarPeriodo(edicao.data_inicio, edicao.data_fim)}
              </span>
              <span>{ROTULO_FORMATO[edicao.formato] ?? edicao.formato}</span>
              {edicao.categoria ? <span>Categoria: {edicao.categoria}</span> : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {acaoPrimaria}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton aria-label="Mais ações da edição" variant="secondary" data-testid="menu-acoes-edicao">
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  data-testid="btn-publicar-edicao"
                  disabled={alterandoPublicacao}
                  onSelect={() => void handleAlternarPublicacao()}
                >
                  {edicao.publicada ? (
                    <Lock className="size-4" aria-hidden="true" />
                  ) : (
                    <Globe className="size-4" aria-hidden="true" />
                  )}
                  {edicao.publicada ? 'Despublicar edição' : 'Publicar edição'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {edicao.estado !== 'CANCELADA' ? (
                  <DropdownMenuItem
                    tone="danger"
                    data-testid="btn-cancelar-edicao"
                    disabled={alterandoPublicacao}
                    onSelect={() => abrirCiclo('CANCELAR')}
                  >
                    <XCircle className="size-4" aria-hidden="true" />
                    Cancelar edição
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  tone="danger"
                  data-testid="btn-excluir-edicao"
                  disabled={alterandoPublicacao}
                  title="Apaga esta edição; a competição e as outras edições continuam"
                  onSelect={() => setModalExclusaoAberto(true)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Excluir edição
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {erroPublicacao && !modalCicloAcao ? (
          <Alert tone="danger" className="mt-4">
            {erroPublicacao}
          </Alert>
        ) : null}
      </div>

      {/* Abas */}
      <Tabs value={abaAtiva} onValueChange={(v) => trocarAba(v as AbaEdicao)}>
        <TabsList aria-label="Seções da edição" className="px-3 sm:px-5">
          <TabsTrigger value="visao_geral" data-testid="tab-visao-geral" icon={<LayoutDashboard className="size-4" />}>
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="configuracao" data-testid="tab-configuracao" icon={<Settings className="size-4" />}>
            Configuração
          </TabsTrigger>
          <TabsTrigger value="equipes" data-testid="tab-equipes" icon={<Users className="size-4" />}>
            Equipes
          </TabsTrigger>
          <TabsTrigger value="jogos" data-testid="tab-jogos" icon={<Swords className="size-4" />}>
            Jogos
          </TabsTrigger>
          <TabsTrigger value="classificacao" data-testid="tab-classificacao" icon={<Trophy className="size-4" />}>
            Classificação
          </TabsTrigger>
          <TabsTrigger value="disciplina" data-testid="tab-disciplina" icon={<ShieldAlert className="size-4" />}>
            Disciplina
          </TabsTrigger>
        </TabsList>

        <div className="p-5 sm:p-6">
          <TabsContent value="visao_geral" className="pt-0">
            <VisaoGeralEdicao
              idEdicaoCompeticao={edicao.id_edicao_competicao}
              estado={edicao.estado}
              formato={edicao.formato}
              onIrParaAba={trocarAba}
            />
          </TabsContent>

          <TabsContent value="configuracao" className="pt-0">
            <div className="space-y-6">
              <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-fg">Regras e estrutura da edição</h3>
                  <p className="text-sm text-fg-muted">
                    Ajuste o formato, fases, regras de pontuação e critérios disciplinares.
                  </p>
                </div>
                <Button
                  onClick={handleSalvarConfiguracao}
                  loading={salvandoConfig}
                  disabled={edicao.estado === 'FINALIZADA'}
                  leftIcon={<Save className="size-4" aria-hidden="true" />}
                >
                  Salvar Configuração
                </Button>
              </div>

              {edicao.estado === 'FINALIZADA' ? (
                <Alert tone="info">Edição finalizada: a configuração fica somente para consulta.</Alert>
              ) : null}
              {mensagemSucessoConfig ? <Alert tone="success">{mensagemSucessoConfig}</Alert> : null}
              {erroConfig ? <Alert tone="danger">{erroConfig}</Alert> : null}

              {configEdit && (
                <FormularioConfiguracao
                  formato={formatoEdit}
                  onFormatoChange={setFormatoEdit}
                  configuracao={configEdit}
                  onChange={setConfigEdit}
                  desabilitado={edicao.estado === 'FINALIZADA'}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="equipes" className="pt-0">
            <GestaoEquipes idEdicaoCompeticao={edicao.id_edicao_competicao} />
          </TabsContent>

          <TabsContent value="jogos" className="pt-0">
            <div className="space-y-6">
              <VisualizadorPartidas
                idEdicaoCompeticao={edicao.id_edicao_competicao}
                estado={edicao.estado}
                formato={edicao.formato}
              />
              {edicao.formato !== 'PONTOS_CORRIDOS' && (
                <ChaveamentoEliminatorio idEdicaoCompeticao={edicao.id_edicao_competicao} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="classificacao" className="pt-0">
            <TabelaClassificacao idEdicaoCompeticao={edicao.id_edicao_competicao} formato={edicao.formato} />
          </TabsContent>

          <TabsContent value="disciplina" className="pt-0">
            <PainelDisciplina idEdicaoCompeticao={edicao.id_edicao_competicao} estadoEdicao={edicao.estado} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Reabrir / cancelar exigem justificativa */}
      <Dialog
        open={modalCicloAcao !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !alterandoPublicacao) {
            setModalCicloAcao(null);
            setErroPublicacao(null);
          }
        }}
      >
        <DialogContent
          size="sm"
          title={modalCicloAcao === 'REABRIR' ? 'Reabrir edição finalizada' : 'Cancelar edição'}
          description={
            modalCicloAcao === 'REABRIR'
              ? 'A edição volta a ficar em andamento. A justificativa fica registrada.'
              : 'A edição deixa de valer, mas os dados são mantidos. A justificativa fica registrada.'
          }
        >
          <form
            id="form-ciclo-edicao"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleConfirmarCiclo();
            }}
          >
            <Field label="Justificativa" htmlFor="motivo-ciclo-edicao" required error={erroPublicacao ?? undefined}>
              <Input
                id="motivo-ciclo-edicao"
                data-testid="input-motivo-ciclo-edicao"
                value={motivoCiclo}
                autoComplete="off"
                onChange={(e) => setMotivoCiclo(e.target.value)}
                placeholder="Informe a justificativa obrigatória..."
              />
            </Field>
          </form>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setModalCicloAcao(null);
                setErroPublicacao(null);
              }}
              disabled={alterandoPublicacao}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              form="form-ciclo-edicao"
              data-testid="btn-confirmar-ciclo-edicao"
              variant={modalCicloAcao === 'CANCELAR' ? 'danger' : 'primary'}
              loading={alterandoPublicacao}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModalConfirmarExclusao
        aberto={modalExclusaoAberto}
        titulo="Excluir edição"
        textoConfirmacao={edicao.identificacao}
        descricao={
          <>
            <span className="block">
              A edição <strong>{edicao.identificacao}</strong> será apagada com todas as suas equipes,
              elencos, jogos, súmulas, classificação e suspensões.
            </span>
            <span className="block">
              A competição e as outras edições continuam existindo. Os competidores cadastrados não são apagados.
            </span>
          </>
        }
        onFechar={() => setModalExclusaoAberto(false)}
        onConfirmar={async () => {
          await excluirEdicao(edicao.id_edicao_competicao);
          setModalExclusaoAberto(false);
          onEdicaoExcluida?.(edicao.id_edicao_competicao);
        }}
      />
    </Card>
  );
}
