'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CalendarX,
  CircleCheck,
  Crown,
  Goal,
  ListChecks,
  PlayCircle,
  Scale,
  ShieldAlert,
  Swords,
  Table2,
  UserX,
  Users,
} from 'lucide-react';
import {
  listarEquipes,
  listarPartidas,
  obterArtilharia,
  obterClassificacao,
  obterPainelDisciplinar,
} from '@/services/competicoes';
import type {
  EquipeDetalhe,
  EstadoEdicao,
  FormatoCompeticao,
  LinhaClassificacao,
  PainelDisciplinarDetalhe,
  PartidaDetalhe,
  TabelaArtilhariaDetalhe,
  TabelaClassificacaoDetalhe,
} from '@/types/competicoes';
import { formatarDataHora } from '@/lib/formatos';
import { Alert, Button, Card, CardBody, CardHeader, Skeleton, StatCard, StatusBadge } from '@/components/ui';

export type AbaEdicao = 'visao_geral' | 'configuracao' | 'equipes' | 'jogos' | 'classificacao' | 'disciplina';

interface VisaoGeralEdicaoProps {
  idEdicaoCompeticao: number;
  estado: EstadoEdicao;
  formato: FormatoCompeticao;
  /** Leva o usuário à aba onde a pendência é resolvida. */
  onIrParaAba?: (aba: AbaEdicao) => void;
}

/** Resultado de uma busca: `undefined` = falhou (mostra "—"), sem derrubar a aba. */
interface Dados {
  equipes?: EquipeDetalhe[];
  partidas?: PartidaDetalhe[];
  classificacao?: TabelaClassificacaoDetalhe | null;
  artilharia?: TabelaArtilhariaDetalhe;
  disciplina?: PainelDisciplinarDetalhe;
}

interface Pendencia {
  chave: string;
  texto: string;
  icone: React.ReactNode;
  aba: AbaEdicao;
}

const SEM_DADO = '—';

function plural(n: number, singular: string, pluralTexto: string) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

function valor<T>(r: PromiseSettledResult<T>): T | undefined {
  return r.status === 'fulfilled' ? r.value : undefined;
}

/** Líder: tabela única, ou o 1º do primeiro grupo (com o nome do grupo). */
function obterLider(tabela: TabelaClassificacaoDetalhe): { linha: LinhaClassificacao; grupo?: string } | null {
  const ordenar = (linhas: LinhaClassificacao[]) => [...linhas].sort((a, b) => a.posicao - b.posicao);
  if (tabela.linhas && tabela.linhas.length > 0) {
    return { linha: ordenar(tabela.linhas)[0] };
  }
  const grupo = tabela.grupos?.find((g) => g.linhas.length > 0);
  if (grupo) return { linha: ordenar(grupo.linhas)[0], grupo: grupo.nome };
  return null;
}

/** Busca tudo em paralelo; o que falhar fica `undefined` e aparece como "—". */
async function buscarDados(
  idEdicaoCompeticao: number,
  formato: FormatoCompeticao,
): Promise<{ dados: Dados; falha: boolean }> {
  const usaClassificacao = formato !== 'MATA_MATA';
  const [equipes, partidas, classificacao, artilharia, disciplina] = await Promise.allSettled([
    listarEquipes(idEdicaoCompeticao),
    listarPartidas(idEdicaoCompeticao),
    usaClassificacao ? obterClassificacao(idEdicaoCompeticao) : Promise.resolve(null),
    obterArtilharia(idEdicaoCompeticao),
    obterPainelDisciplinar(idEdicaoCompeticao),
  ]);
  return {
    falha: [equipes, partidas, classificacao, artilharia, disciplina].some((r) => r.status === 'rejected'),
    dados: {
      equipes: valor(equipes),
      partidas: valor(partidas),
      classificacao: valor(classificacao),
      artilharia: valor(artilharia),
      disciplina: valor(disciplina),
    },
  };
}

function NomeDestaque({ nome }: { nome: string }) {
  return (
    <span className="block truncate text-xl" title={nome}>
      {nome}
    </span>
  );
}

export default function VisaoGeralEdicao({
  idEdicaoCompeticao,
  estado,
  formato,
  onIrParaAba,
}: VisaoGeralEdicaoProps) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [houveFalha, setHouveFalha] = useState(false);

  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    buscarDados(idEdicaoCompeticao, formato).then((r) => {
      if (!ativo) return;
      setDados(r.dados);
      setHouveFalha(r.falha);
    });
    return () => {
      ativo = false;
    };
  }, [idEdicaoCompeticao, formato, tentativa]);

  const tentarNovamente = () => {
    setDados(null);
    setHouveFalha(false);
    setTentativa((t) => t + 1);
  };

  if (!dados) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Carregando visão geral">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const { equipes, partidas, classificacao, artilharia, disciplina } = dados;

  // Equipes
  const equipesAtivas = equipes?.filter((e) => e.situacao === 'ATIVA');
  const atletas = equipesAtivas?.reduce(
    (soma, e) => soma + e.integrantes.filter((i) => i.situacao === 'ATIVO').length,
    0,
  );
  const equipesSemAtletas = equipesAtivas?.filter((e) => !e.integrantes.some((i) => i.situacao === 'ATIVO')).length;

  // Jogos
  const jogosValidos = partidas?.filter((p) => p.status !== 'CANCELADA');
  const realizados = jogosValidos?.filter((p) => p.status === 'FINALIZADA').length;
  const emAndamento = jogosValidos?.filter((p) => p.status === 'EM_ANDAMENTO').length;
  const semData = jogosValidos?.filter((p) => p.status === 'AGENDADA' && !p.data_hora).length;
  const proximoJogo = jogosValidos
    ?.filter((p) => p.status === 'AGENDADA' && p.data_hora)
    .sort((a, b) => (a.data_hora ?? '').localeCompare(b.data_hora ?? ''))[0];

  // Classificação e artilharia
  const lider = classificacao ? obterLider(classificacao) : null;
  const liderComJogos = lider && lider.linha.jogos > 0 ? lider : null;
  const artilheiro = artilharia?.artilheiros.find((a) => a.gols > 0);

  // Disciplina
  const emRevisao = disciplina?.suspensoes.filter((s) => s.situacao === 'EM_REVISAO').length;

  const pendencias: Pendencia[] = [];
  if (estado === 'RASCUNHO' && equipesAtivas && equipesAtivas.length < 2) {
    pendencias.push({
      chave: 'poucas-equipes',
      texto: 'Inscreva pelo menos 2 equipes para gerar a tabela',
      icone: <Users />,
      aba: 'equipes',
    });
  }
  if (equipesSemAtletas) {
    pendencias.push({
      chave: 'sem-atletas',
      texto: plural(equipesSemAtletas, 'equipe sem atletas', 'equipes sem atletas'),
      icone: <UserX />,
      aba: 'equipes',
    });
  }
  if (estado === 'RASCUNHO' && jogosValidos && jogosValidos.length === 0) {
    pendencias.push({
      chave: 'sem-tabela',
      texto: 'Tabela de jogos ainda não gerada',
      icone: <Table2 />,
      aba: 'jogos',
    });
  }
  if (semData) {
    pendencias.push({
      chave: 'sem-data',
      texto: plural(semData, 'jogo sem data', 'jogos sem data'),
      icone: <CalendarX />,
      aba: 'jogos',
    });
  }
  if (emAndamento) {
    pendencias.push({
      chave: 'em-andamento',
      texto: plural(emAndamento, 'jogo em andamento', 'jogos em andamento'),
      icone: <PlayCircle />,
      aba: 'jogos',
    });
  }
  if (emRevisao) {
    pendencias.push({
      chave: 'em-revisao',
      texto: plural(emRevisao, 'suspensão em revisão', 'suspensões em revisão'),
      icone: <ShieldAlert />,
      aba: 'disciplina',
    });
  }
  if (classificacao?.possui_empate_persistente) {
    pendencias.push({
      chave: 'empate',
      texto: 'Empate na classificação aguardando decisão',
      icone: <Scale />,
      aba: 'classificacao',
    });
  }

  const falhou = (d: unknown) => d === undefined;

  return (
    <div className="space-y-6" data-testid="visao-geral-edicao">
      {houveFalha ? (
        <Alert
          tone="warning"
          title="Alguns dados não puderam ser carregados"
          action={
            <Button size="sm" variant="secondary" onClick={tentarNovamente}>
              Tentar novamente
            </Button>
          }
        >
          Os indicadores sem informação aparecem com &quot;—&quot;.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          data-testid="visao-equipes"
          label="Equipes inscritas"
          icon={<Users />}
          value={equipesAtivas ? equipesAtivas.length : SEM_DADO}
          hint={atletas !== undefined ? plural(atletas, 'atleta ativo', 'atletas ativos') : undefined}
        />
        <StatCard
          data-testid="visao-jogos-realizados"
          label="Jogos realizados"
          icon={<Swords />}
          value={jogosValidos && realizados !== undefined ? `${realizados}/${jogosValidos.length}` : SEM_DADO}
          hint={
            jogosValidos
              ? jogosValidos.length === 0
                ? 'Nenhum jogo gerado'
                : `${Math.round(((realizados ?? 0) / jogosValidos.length) * 100)}% concluído`
              : undefined
          }
        />
        <StatCard
          data-testid="visao-lider"
          label="Líder da classificação"
          icon={<Crown />}
          value={liderComJogos ? <NomeDestaque nome={liderComJogos.linha.nome_equipe} /> : SEM_DADO}
          hint={
            liderComJogos
              ? `${plural(liderComJogos.linha.pontos, 'ponto', 'pontos')}${
                  liderComJogos.grupo ? ` · ${liderComJogos.grupo}` : ''
                }`
              : formato === 'MATA_MATA'
                ? 'Formato sem tabela de pontos'
                : falhou(classificacao)
                  ? undefined
                  : 'Nenhum jogo disputado'
          }
        />
        <StatCard
          data-testid="visao-artilheiro"
          label="Artilheiro"
          icon={<Goal />}
          value={artilheiro ? <NomeDestaque nome={artilheiro.nome_esportivo} /> : SEM_DADO}
          hint={
            artilheiro
              ? `${plural(artilheiro.gols, 'gol', 'gols')} · ${artilheiro.nome_equipe}`
              : falhou(artilharia)
                ? undefined
                : 'Nenhum gol registrado'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card data-testid="visao-proximo-jogo">
          <CardHeader title="Próximo jogo agendado" />
          <CardBody>
            {falhou(partidas) ? (
              <p className="text-sm text-fg-muted">{SEM_DADO}</p>
            ) : proximoJogo ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-fg">
                    <span className="min-w-0 truncate" title={proximoJogo.nome_mandante ?? undefined}>
                      {proximoJogo.nome_mandante ?? 'A definir'}
                    </span>
                    <span className="shrink-0 text-fg-subtle" aria-label="contra">
                      ×
                    </span>
                    <span className="min-w-0 truncate" title={proximoJogo.nome_visitante ?? undefined}>
                      {proximoJogo.nome_visitante ?? 'A definir'}
                    </span>
                  </p>
                  <StatusBadge tipo="partida" valor={proximoJogo.status} />
                </div>
                <p className="flex items-center gap-2 text-sm text-fg-muted">
                  <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
                  <span className="tabular-nums">{formatarDataHora(proximoJogo.data_hora)}</span>
                  {proximoJogo.local ? <span className="truncate">· {proximoJogo.local}</span> : null}
                </p>
                <p className="text-xs text-fg-subtle">Jogo #{proximoJogo.numero_partida}</p>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Nenhum jogo com data marcada.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pendências" description="O que ainda precisa de atenção nesta edição." />
          <CardBody>
            {pendencias.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-success" data-testid="pendencias-edicao">
                <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
                Nenhuma pendência no momento.
              </p>
            ) : (
              <ul className="divide-y divide-line" data-testid="pendencias-edicao">
                {pendencias.map((p) => (
                  <li key={p.chave} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
                      <span aria-hidden="true" className="inline-flex text-warning [&_svg]:size-4">
                        {p.icone}
                      </span>
                      <span className="min-w-0">{p.texto}</span>
                    </span>
                    {onIrParaAba ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        rightIcon={<ArrowRight aria-hidden="true" className="size-3.5" />}
                        onClick={() => onIrParaAba(p.aba)}
                        aria-label={`Resolver: ${p.texto}`}
                      >
                        Ver
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {pendencias.length === 0 ? null : (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-subtle">
                <ListChecks aria-hidden="true" className="size-3.5" />
                {plural(pendencias.length, 'item pendente', 'itens pendentes')}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
