'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  obterClassificacao,
  listarDecisoesClassificacao,
  registrarDecisaoClassificacao,
  isErroApi,
} from '@/services/competicoes';
import type {
  TabelaClassificacaoDetalhe,
  LinhaClassificacao,
  DecisaoClassificacaoDetalhe,
  DecisaoClassificacaoCriar,
} from '@/types/competicoes';
import { ArrowDown, ArrowUp, GitFork, History, RefreshCw, Scale, ShieldAlert, X } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyState,
  Field,
  IconButton,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { TabelaClassificacaoVisual } from '@/components/competicoes/visual';
import { formatarDataHora } from '@/lib/formatos';

interface TabelaClassificacaoProps {
  idEdicaoCompeticao: number;
  formato?: string;
  /** Quantos avançam de cada grupo (configuração da edição); marca a zona da tabela. */
  classificadosPorGrupo?: number;
}

export default function TabelaClassificacao({
  idEdicaoCompeticao,
  formato,
  classificadosPorGrupo = 2,
}: TabelaClassificacaoProps) {
  const [classificacao, setClassificacao] = useState<TabelaClassificacaoDetalhe | null>(null);
  const [decisoes, setDecisoes] = useState<DecisaoClassificacaoDetalhe[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Estado do Modal de Resolução Manual de Empate
  const [modalDesempateAberto, setModalDesempateAberto] = useState<boolean>(false);
  const [grupoDesempateId, setGrupoDesempateId] = useState<number | null>(null);
  const [equipesDesempate, setEquipesDesempate] = useState<LinhaClassificacao[]>([]);
  const [motivoDesempate, setMotivoDesempate] = useState<string>('');
  const [salvandoDesempate, setSalvandoDesempate] = useState<boolean>(false);
  const [erroDesempate, setErroDesempate] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    if (formato === 'MATA_MATA') {
      setCarregando(false);
      return;
    }
    try {
      setCarregando(true);
      setErro(null);

      const [classifRes, decisoesRes] = await Promise.all([
        obterClassificacao(idEdicaoCompeticao),
        listarDecisoesClassificacao(idEdicaoCompeticao).catch(() => [] as DecisaoClassificacaoDetalhe[]),
      ]);

      setClassificacao(classifRes);
      setDecisoes(decisoesRes || []);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar a tabela de classificação.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Equipes com posição definida por decisão válida (marca na linha, DF-RT13-04).
  const equipesDecididas = useMemo(
    () => new Set(decisoes.filter((d) => d.valida).flatMap((d) => d.conjunto_equipes)),
    [decisoes],
  );

  // Mapa de Nomes das Equipes para exibir nas decisões
  const mapaNomesEquipes = useMemo(() => {
    const map = new Map<number, string>();
    if (classificacao?.linhas) {
      classificacao.linhas.forEach((l) => map.set(l.id_equipe, l.nome_equipe));
    }
    if (classificacao?.grupos) {
      classificacao.grupos.forEach((g) => {
        g.linhas.forEach((l) => map.set(l.id_equipe, l.nome_equipe));
      });
    }
    return map;
  }, [classificacao]);

  const temGrupos = Boolean(classificacao?.grupos && classificacao.grupos.length > 0);
  const temLinhas = Boolean(classificacao?.linhas && classificacao.linhas.length > 0);
  const possuiEmpatePersistente = Boolean(
    classificacao?.possui_empate_persistente ||
      classificacao?.grupos?.some((g) => g.possui_empate_persistente)
  );

  // Inicializa a lista de equipes para desempate
  const inicializarDesempate = useCallback(
    (idGrupo: number | null, classif: TabelaClassificacaoDetalhe | null) => {
      let linhasAlvo: LinhaClassificacao[] = [];

      if (idGrupo !== null && classif?.grupos) {
        const grupo = classif.grupos.find((g) => g.id_grupo === idGrupo);
        linhasAlvo = grupo?.linhas || [];
      } else if (classif?.linhas) {
        linhasAlvo = classif.linhas;
      }

      // Filtrar equipes empatadas; se não houver flag explícita, usa todas do escopo
      const empatadas = linhasAlvo.filter((l) => l.empate_persistente);
      const listaFinal = empatadas.length >= 2 ? empatadas : linhasAlvo;

      setGrupoDesempateId(idGrupo);
      setEquipesDesempate([...listaFinal]);
      setMotivoDesempate('');
      setErroDesempate(null);
    },
    []
  );

  // Handler: Abrir modal de desempate manual
  const handleAbrirModalDesempate = () => {
    if (temGrupos && classificacao?.grupos) {
      const grupoComEmpate =
        classificacao.grupos.find((g) => g.possui_empate_persistente) ||
        classificacao.grupos[0];
      inicializarDesempate(grupoComEmpate ? grupoComEmpate.id_grupo : null, classificacao);
    } else {
      inicializarDesempate(null, classificacao);
    }
    setModalDesempateAberto(true);
  };

  // Handler: Troca de grupo no modal de desempate
  const handleTrocarGrupoDesempate = (idGrupo: number) => {
    inicializarDesempate(idGrupo, classificacao);
  };

  // Handler: Mover equipe para cima ou para baixo
  const handleMoverEquipe = (index: number, direcao: 'cima' | 'baixo') => {
    const novoIndex = direcao === 'cima' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= equipesDesempate.length) return;

    const novaLista = [...equipesDesempate];
    const [removido] = novaLista.splice(index, 1);
    novaLista.splice(novoIndex, 0, removido);
    setEquipesDesempate(novaLista);
  };

  // Handler: Salvar Decisão Manual de Desempate
  const handleSalvarDesempate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroDesempate(null);

    if (motivoDesempate.trim().length < 3) {
      setErroDesempate('Informe uma justificativa com no mínimo 3 caracteres.');
      return;
    }

    if (equipesDesempate.length < 2) {
      setErroDesempate('É necessário ter ao menos duas equipes para registrar um desempate.');
      return;
    }

    try {
      setSalvandoDesempate(true);

      const dados: DecisaoClassificacaoCriar = {
        id_grupo: grupoDesempateId,
        conjunto_equipes: equipesDesempate.map((eq) => eq.id_equipe),
        ordem_escolhida: equipesDesempate.map((eq) => eq.id_equipe),
        motivo: motivoDesempate.trim(),
      };

      await registrarDecisaoClassificacao(idEdicaoCompeticao, dados);
      setModalDesempateAberto(false);
      setSucesso('Decisão manual de desempate registrada com sucesso! A classificação foi recalculada.');
      await carregarDados();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroDesempate(err.mensagem);
      } else if (err instanceof Error) {
        setErroDesempate(err.message);
      } else {
        setErroDesempate('Erro ao registrar decisão de desempate.');
      }
    } finally {
      setSalvandoDesempate(false);
    }
  };

  // Caso 1: Formato puramente MATA_MATA (eliminatório direto)
  if (formato === 'MATA_MATA') {
    return (
      <EmptyState
        icon={<GitFork />}
        title="Competição em formato mata-mata"
        description={
          <>
            Competições só eliminatórias não têm tabela de pontos. Acesse a aba <strong>Jogos</strong> para
            acompanhar o chaveamento, os agendamentos e os resultados de cada fase.
          </>
        }
      />
    );
  }

  // Estado de carregamento
  if (carregando && !classificacao) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Carregando classificação">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  // Estado de erro crítico inicial
  if (erro && !classificacao) {
    return (
      <Alert
        tone="danger"
        title="Erro ao carregar classificação"
        action={
          <Button variant="secondary" size="sm" onClick={carregarDados}>
            Tentar novamente
          </Button>
        }
      >
        {erro}
      </Alert>
    );
  }

  const grupoSelecionado = classificacao?.grupos?.find((g) => g.id_grupo === grupoDesempateId);

  return (
    <div className="space-y-6">
      {sucesso && (
        <Alert
          tone="success"
          action={
            <IconButton aria-label="Fechar aviso" size="sm" onClick={() => setSucesso(null)}>
              <X aria-hidden="true" />
            </IconButton>
          }
        >
          {sucesso}
        </Alert>
      )}

      {/* Cabeçalho da seção */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg">Classificação</h3>
          <p className="mt-0.5 text-sm text-fg-muted">
            {formato === 'GRUPOS_MATA_MATA'
              ? 'Pontuação, estatísticas e classificados de cada grupo.'
              : 'Pontuação e estatísticas das equipes.'}
          </p>
        </div>
        <IconButton
          variant="secondary"
          aria-label="Atualizar tabela de classificação"
          title="Atualizar tabela de classificação"
          onClick={carregarDados}
          disabled={carregando}
        >
          <RefreshCw aria-hidden="true" className={cn(carregando && 'motion-safe:animate-spin')} />
        </IconButton>
      </div>

      {/* Empate persistente */}
      {possuiEmpatePersistente && (
        <Alert
          tone="warning"
          role="alert"
          aria-label="Aviso de empates persistentes"
          title="Empate não resolvido pelos critérios"
          action={
            <Button
              variant="secondary"
              size="sm"
              data-testid="btn-resolver-empate"
              onClick={handleAbrirModalDesempate}
              leftIcon={<Scale className="size-4" aria-hidden="true" />}
            >
              Resolver Empate Manualmente
            </Button>
          }
        >
          Há equipes empatadas que os critérios de desempate do regulamento não separaram. Registre a ordem
          decidida pela organização (por exemplo, por sorteio).
        </Alert>
      )}

      {/* Por grupos (GRUPOS_MATA_MATA) */}
      {temGrupos && classificacao?.grupos && (
        // DF-RT13-10: duas colunas só em telas muito largas, para nenhuma coluna ficar escondida.
        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-2">
          {classificacao.grupos.map((grupo) => (
            <TabelaClassificacaoVisual
              key={grupo.id_grupo}
              titulo={grupo.nome}
              descricao={`${grupo.linhas.length} equipes`}
              linhas={grupo.linhas}
              classificados={classificadosPorGrupo}
              rotuloZona="Classificados para o mata-mata"
              decididas={equipesDecididas}
            />
          ))}
        </div>
      )}

      {/* Geral (PONTOS_CORRIDOS) */}
      {!temGrupos && temLinhas && classificacao?.linhas && (
        <TabelaClassificacaoVisual
          titulo="Classificação geral"
          descricao={`${classificacao.linhas.length} equipes`}
          linhas={classificacao.linhas}
          // DF-RT13-03: pontos corridos não tem zona de classificação.
          classificados={0}
          decididas={equipesDecididas}
        />
      )}

      {/* Vazio */}
      {!temGrupos && !temLinhas && (
        <EmptyState
          icon={<ShieldAlert />}
          title="Classificação ainda não disponível"
          description="Nenhuma pontuação foi registrada. As posições são calculadas conforme os resultados forem lançados."
        />
      )}

      {/* Histórico de decisões manuais */}
      {decisoes.length > 0 && (
        <section
          data-testid="lista-decisoes-classificacao"
          aria-labelledby="titulo-decisoes"
          className="space-y-3 rounded-xl border border-line bg-surface p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h4 id="titulo-decisoes" className="inline-flex items-center gap-2 text-sm font-semibold text-fg">
              <History aria-hidden="true" className="size-4 text-fg-subtle" />
              Decisões manuais registradas (<span className="tabular-nums">{decisoes.length}</span>)
            </h4>
            <span className="text-xs text-fg-subtle">Registros com auditoria de integridade</span>
          </div>

          <ul className="space-y-3">
            {decisoes.map((dec) => {
              const grupoNome =
                dec.id_grupo != null && classificacao?.grupos
                  ? classificacao.grupos.find((g) => g.id_grupo === dec.id_grupo)?.nome || `Grupo ${dec.id_grupo}`
                  : 'Classificação geral';

              return (
                <li
                  key={dec.id_decisao}
                  data-testid={`item-decisao-${dec.id_decisao}`}
                  className="space-y-2 rounded-lg border border-line bg-surface-muted p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-fg">{grupoNome}</span>
                    <Badge tone={dec.valida ? 'success' : 'danger'} dot>
                      {dec.valida ? 'Válida' : 'Invalidada por alteração de resultados'}
                    </Badge>
                  </div>

                  <ol className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-fg-muted">Ordem definida:</span>
                    {dec.ordem_escolhida.map((idEq, idx) => (
                      <li
                        key={idEq}
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-xs text-fg"
                      >
                        <span className="font-semibold tabular-nums">{idx + 1}º</span>
                        {mapaNomesEquipes.get(idEq) || `Equipe #${idEq}`}
                      </li>
                    ))}
                  </ol>

                  <p className="text-xs text-fg-muted">
                    <span className="font-medium text-fg">Motivo:</span> {dec.motivo}
                  </p>
                  <p className="text-xs text-fg-subtle" data-testid="responsavel-decisao">
                    Registrada por {dec.responsavel_nome ?? 'responsável não informado'}
                    {dec.criado_em ? ` em ${formatarDataHora(dec.criado_em)}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Modal de resolução manual de empate */}
      <Dialog
        open={modalDesempateAberto}
        onOpenChange={(aberto) => (!aberto && !salvandoDesempate ? setModalDesempateAberto(false) : undefined)}
      >
        <DialogContent
          title="Resolver Empate Manualmente"
          description="Defina a ordem oficial de classificação e registre a justificativa."
          size="md"
        >
          <form id="form-desempate" onSubmit={handleSalvarDesempate} className="space-y-4">
            {erroDesempate && (
              <Alert tone="danger" data-testid="alerta-erro-desempate">
                {erroDesempate}
              </Alert>
            )}

            {temGrupos && classificacao?.grupos && (
              <Field label="Grupo com empate" htmlFor="select-grupo-desempate" required>
                <Select
                  id="select-grupo-desempate"
                  data-testid="select-grupo-desempate"
                  value={grupoDesempateId ?? ''}
                  onChange={(e) => handleTrocarGrupoDesempate(Number(e.target.value))}
                >
                  {classificacao.grupos.map((g) => (
                    <option key={g.id_grupo} value={g.id_grupo}>
                      {g.nome}
                      {g.possui_empate_persistente ? ' (empate pendente)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">
                Ordem final das equipes
                <span aria-hidden="true" className="ml-0.5 text-danger">
                  *
                </span>
              </legend>
              <p className="text-xs text-fg-subtle">
                Use as setas para mover as equipes até a ordem desejada
                {grupoSelecionado ? ` (${grupoSelecionado.nome})` : ''}.
              </p>

              {equipesDesempate.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong p-4 text-center text-sm text-fg-muted">
                  Nenhuma equipe encontrada para desempate neste escopo.
                </p>
              ) : (
                <ol className="divide-y divide-line rounded-lg border border-line">
                  {equipesDesempate.map((eq, index) => (
                    <li key={eq.id_equipe} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-fg-muted">
                          {index + 1}º
                        </span>
                        <span className="truncate text-sm font-medium text-fg" title={eq.nome_equipe}>
                          {eq.nome_equipe}
                        </span>
                        {eq.empate_persistente && <Badge tone="warning">Empatada</Badge>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <IconButton
                          size="sm"
                          variant="secondary"
                          aria-label={`Subir ${eq.nome_equipe}`}
                          data-testid={`btn-subir-${eq.id_equipe}`}
                          disabled={index === 0 || salvandoDesempate}
                          onClick={() => handleMoverEquipe(index, 'cima')}
                        >
                          <ArrowUp aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          size="sm"
                          variant="secondary"
                          aria-label={`Descer ${eq.nome_equipe}`}
                          data-testid={`btn-descer-${eq.id_equipe}`}
                          disabled={index === equipesDesempate.length - 1 || salvandoDesempate}
                          onClick={() => handleMoverEquipe(index, 'baixo')}
                        >
                          <ArrowDown aria-hidden="true" />
                        </IconButton>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </fieldset>

            <Field
              label="Justificativa / ata do desempate"
              htmlFor="input-motivo-desempate"
              required
              hint={`${motivoDesempate.trim().length} caractere(s) · mínimo de 3`}
              error={
                motivoDesempate.length > 0 && motivoDesempate.trim().length < 3 ? 'Mínimo de 3 caracteres' : undefined
              }
            >
              <Textarea
                id="input-motivo-desempate"
                data-testid="input-motivo-desempate"
                rows={3}
                value={motivoDesempate}
                onChange={(e) => setMotivoDesempate(e.target.value)}
                placeholder="Ex.: sorteio presencial com os representantes dos clubes, conforme item 4.2 do regulamento..."
                className="resize-none"
              />
            </Field>
          </form>

          <DialogFooter>
            <Button
              variant="secondary"
              data-testid="btn-fechar-modal-desempate"
              onClick={() => setModalDesempateAberto(false)}
              disabled={salvandoDesempate}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-desempate"
              data-testid="btn-salvar-desempate"
              loading={salvandoDesempate}
              disabled={motivoDesempate.trim().length < 3 || equipesDesempate.length < 2}
            >
              Registrar Desempate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
