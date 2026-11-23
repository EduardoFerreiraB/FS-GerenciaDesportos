'use client';

import React, { useState } from 'react';
import type {
  Configuracao,
  ConfiguracaoPontosCorridos,
  ConfiguracaoGruposMataMata,
  ConfiguracaoMataMata,
  FormatoCompeticao,
  CriterioDesempate,
  PontuacaoConfig,
  DisciplinaConfig,
} from '@/types/competicoes';
import { ArrowDown, ArrowUp, TriangleAlert, X } from 'lucide-react';
import { ROTULO_FORMATO } from '@/lib/rotulos';
import {
  Button,
  Checkbox,
  IconButton,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Select,
} from '@/components/ui';

export const PONTUACAO_PADRAO: PontuacaoConfig = {
  vitoria: 3,
  empate: 1,
  derrota: 0,
};

export const DISCIPLINA_PADRAO: DisciplinaConfig = {
  limite_amarelos: 3,
  jogos_por_acumulo: 1,
  jogos_por_vermelho: 1,
  jogos_por_segundo_amarelo: 1,
  zerar_amarelos_ao_encerrar_grupos: false,
};

export const DESEMPATES_PADRAO: CriterioDesempate[] = [
  'VITORIAS',
  'SALDO_GOLS',
  'GOLS_PRO',
  'CONFRONTO_DIRETO',
];

export const ROTULO_DESEMPATE: Record<CriterioDesempate, string> = {
  VITORIAS: 'Número de vitórias',
  SALDO_GOLS: 'Saldo de gols',
  GOLS_PRO: 'Gols marcados',
  CONFRONTO_DIRETO: 'Confronto direto',
  MENOS_CARTOES_VERMELHOS: 'Menos cartões vermelhos',
  MENOS_CARTOES_AMARELOS: 'Menos cartões amarelos',
};

const TODOS_DESEMPATES = Object.keys(ROTULO_DESEMPATE) as CriterioDesempate[];

export function criarConfiguracaoPadrao(formato: FormatoCompeticao): Configuracao {
  switch (formato) {
    case 'PONTOS_CORRIDOS':
      return {
        formato: 'PONTOS_CORRIDOS',
        pontuacao: { ...PONTUACAO_PADRAO },
        desempates: [...DESEMPATES_PADRAO],
        disciplina: { ...DISCIPLINA_PADRAO },
        turno_e_returno: false,
      };
    case 'GRUPOS_MATA_MATA':
      return {
        formato: 'GRUPOS_MATA_MATA',
        pontuacao: { ...PONTUACAO_PADRAO },
        desempates: [...DESEMPATES_PADRAO],
        disciplina: { ...DISCIPLINA_PADRAO },
        quantidade_grupos: 2,
        classificados_por_grupo: 2,
        turno_e_returno_grupos: false,
        ida_volta_eliminatoria: false,
        final_unica: true,
        terceiro_lugar: false,
      };
    case 'MATA_MATA':
      return {
        formato: 'MATA_MATA',
        disciplina: { ...DISCIPLINA_PADRAO },
        ida_volta: false,
        final_unica: true,
        terceiro_lugar: false,
      };
  }
}

interface FormularioConfiguracaoProps {
  formato: FormatoCompeticao;
  onFormatoChange?: (novoFormato: FormatoCompeticao) => void;
  configuracao: Configuracao;
  onChange: (novaConfiguracao: Configuracao) => void;
  desabilitado?: boolean;
}

export default function FormularioConfiguracao({
  formato,
  onFormatoChange,
  configuracao,
  onChange,
  desabilitado = false,
}: FormularioConfiguracaoProps) {
  const [formatoPendente, setFormatoPendente] = useState<FormatoCompeticao | null>(null);
  const [mostrarDialogoDescarte, setMostrarDialogoDescarte] = useState(false);

  const handleTentativaMudarFormato = (novoFormato: FormatoCompeticao) => {
    if (novoFormato === formato) return;

    // Se estiver mudando de formato e houver dados específicos preenchidos, pedir confirmação
    const temDadosGrupos =
      formato === 'GRUPOS_MATA_MATA' &&
      ((configuracao as ConfiguracaoGruposMataMata).quantidade_grupos !== 2 ||
        (configuracao as ConfiguracaoGruposMataMata).classificados_por_grupo !== 2 ||
        (configuracao as ConfiguracaoGruposMataMata).quantidade_grupos > 0);

    const temDadosPontos =
      formato === 'PONTOS_CORRIDOS' &&
      (configuracao as ConfiguracaoPontosCorridos).turno_e_returno === true;

    if (temDadosGrupos || temDadosPontos || formato !== novoFormato) {
      setFormatoPendente(novoFormato);
      setMostrarDialogoDescarte(true);
      return;
    }

    aplicarTrocaFormato(novoFormato);
  };

  const aplicarTrocaFormato = (novoFormato: FormatoCompeticao) => {
    const novaConfig = criarConfiguracaoPadrao(novoFormato);
    if (onFormatoChange) {
      onFormatoChange(novoFormato);
    }
    onChange(novaConfig);
    setMostrarDialogoDescarte(false);
    setFormatoPendente(null);
  };

  const cancelarTrocaFormato = () => {
    setMostrarDialogoDescarte(false);
    setFormatoPendente(null);
  };

  const grupos = configuracao as ConfiguracaoGruposMataMata;
  const pontos = configuracao as ConfiguracaoPontosCorridos;
  const mata = configuracao as ConfiguracaoMataMata;
  const usaPontuacao = formato === 'PONTOS_CORRIDOS' || formato === 'GRUPOS_MATA_MATA';
  const pontuacaoAtual =
    formato === 'PONTOS_CORRIDOS' ? pontos.pontuacao : formato === 'GRUPOS_MATA_MATA' ? grupos.pontuacao : undefined;

  const atualizarPontuacao = (campo: keyof PontuacaoConfig, val: number) => {
    if (formato === 'PONTOS_CORRIDOS') {
      onChange({ ...pontos, pontuacao: { ...pontos.pontuacao, [campo]: val } });
    } else {
      onChange({ ...grupos, pontuacao: { ...grupos.pontuacao, [campo]: val } });
    }
  };

  return (
    <div className="space-y-4">
      <Bloco titulo="Formato da disputa">
        <Field
          label="Formato"
          htmlFor="formato"
          hint="Define as regras estruturais de fases e partidas desta competição."
        >
          <Select
            id="formato"
            value={formatoPendente ?? formato}
            disabled={desabilitado}
            onChange={(e) => handleTentativaMudarFormato(e.target.value as FormatoCompeticao)}
          >
            <option value="GRUPOS_MATA_MATA">{ROTULO_FORMATO.GRUPOS_MATA_MATA}</option>
            <option value="PONTOS_CORRIDOS">{ROTULO_FORMATO.PONTOS_CORRIDOS}</option>
            <option value="MATA_MATA">{ROTULO_FORMATO.MATA_MATA}</option>
          </Select>
        </Field>
      </Bloco>

      {/* Confirmação de descarte da configuração do formato anterior */}
      <Dialog
        open={mostrarDialogoDescarte}
        onOpenChange={(aberto) => {
          if (!aberto) cancelarTrocaFormato();
        }}
      >
        <DialogContent size="sm" title="Descartar configuração atual?">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            <p className="text-sm text-fg-muted">
              Alterar o formato para{' '}
              <strong className="text-fg">{formatoPendente ? ROTULO_FORMATO[formatoPendente] : ''}</strong>{' '}
              descartará os campos e regras específicos do formato anterior. Deseja continuar?
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={cancelarTrocaFormato}>
              Cancelar
            </Button>
            <Button onClick={() => formatoPendente && aplicarTrocaFormato(formatoPendente)}>
              Descartar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {formato === 'GRUPOS_MATA_MATA' && (
        <Bloco titulo="Estrutura da fase de grupos">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Quantidade de grupos" htmlFor="quantidade_grupos">
              <Input
                id="quantidade_grupos"
                type="number"
                min={1}
                max={32}
                disabled={desabilitado}
                value={grupos.quantidade_grupos ?? 2}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  onChange({ ...grupos, quantidade_grupos: val });
                }}
              />
            </Field>
            <Field label="Classificados por grupo" htmlFor="classificados_por_grupo">
              <Input
                id="classificados_por_grupo"
                type="number"
                min={1}
                max={16}
                disabled={desabilitado}
                value={grupos.classificados_por_grupo ?? 2}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  onChange({ ...grupos, classificados_por_grupo: val });
                }}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Opcao
              rotulo="Turno e returno nos grupos"
              disabled={desabilitado}
              checked={!!grupos.turno_e_returno_grupos}
              onChange={(v) => onChange({ ...grupos, turno_e_returno_grupos: v })}
            />
            <Opcao
              rotulo="Ida e volta no mata-mata"
              disabled={desabilitado}
              checked={!!grupos.ida_volta_eliminatoria}
              onChange={(v) => onChange({ ...grupos, ida_volta_eliminatoria: v })}
            />
            <Opcao
              rotulo="Final única"
              disabled={desabilitado}
              checked={!!grupos.final_unica}
              onChange={(v) => onChange({ ...grupos, final_unica: v })}
            />
            <Opcao
              rotulo="Disputa de 3º lugar"
              disabled={desabilitado}
              checked={!!grupos.terceiro_lugar}
              onChange={(v) => onChange({ ...grupos, terceiro_lugar: v })}
            />
          </div>
        </Bloco>
      )}

      {formato === 'PONTOS_CORRIDOS' && (
        <Bloco titulo="Regras de turno">
          <Opcao
            rotulo="Turno e returno (ida e volta)"
            disabled={desabilitado}
            checked={!!pontos.turno_e_returno}
            onChange={(v) => onChange({ ...pontos, turno_e_returno: v })}
          />
        </Bloco>
      )}

      {formato === 'MATA_MATA' && (
        <Bloco titulo="Regras eliminatórias">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Opcao
              rotulo="Confrontos em ida e volta"
              disabled={desabilitado}
              checked={!!mata.ida_volta}
              onChange={(v) => onChange({ ...mata, ida_volta: v })}
            />
            <Opcao
              rotulo="Final única"
              disabled={desabilitado}
              checked={!!mata.final_unica}
              onChange={(v) => onChange({ ...mata, final_unica: v })}
            />
            <Opcao
              rotulo="Disputa de 3º lugar"
              disabled={desabilitado}
              checked={!!mata.terceiro_lugar}
              onChange={(v) => onChange({ ...mata, terceiro_lugar: v })}
            />
          </div>
        </Bloco>
      )}

      {usaPontuacao && (
        <Bloco titulo="Pontuação das partidas" descricao="Pontos que cada equipe recebe por resultado.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Vitória" htmlFor="pts_vitoria">
              <Input
                id="pts_vitoria"
                type="number"
                min={0}
                disabled={desabilitado}
                className="tabular-nums"
                value={pontuacaoAtual?.vitoria ?? 3}
                onChange={(e) => atualizarPontuacao('vitoria', parseInt(e.target.value, 10) || 0)}
              />
            </Field>
            <Field label="Empate" htmlFor="pts_empate">
              <Input
                id="pts_empate"
                type="number"
                min={0}
                disabled={desabilitado}
                className="tabular-nums"
                value={pontuacaoAtual?.empate ?? 1}
                onChange={(e) => atualizarPontuacao('empate', parseInt(e.target.value, 10) || 0)}
              />
            </Field>
            <Field label="Derrota" htmlFor="pts_derrota">
              <Input
                id="pts_derrota"
                type="number"
                min={0}
                disabled={desabilitado}
                className="tabular-nums"
                value={pontuacaoAtual?.derrota ?? 0}
                onChange={(e) => atualizarPontuacao('derrota', parseInt(e.target.value, 10) || 0)}
              />
            </Field>
          </div>
        </Bloco>
      )}

      {formato !== 'MATA_MATA' && (
        <Bloco
          titulo="Ordem dos critérios de desempate"
          descricao="Aplicados nesta ordem quando equipes empatam em pontos. Persistindo o empate, a organização registra uma decisão."
        >
          <OrdemDesempates
            criterios={((configuracao as ConfiguracaoPontosCorridos | ConfiguracaoGruposMataMata).desempates ?? []) as CriterioDesempate[]}
            desabilitado={desabilitado}
            onChange={(desempates) => onChange({ ...configuracao, desempates } as Configuracao)}
          />
        </Bloco>
      )}

      <Bloco titulo="Regras disciplinares" descricao="Quando um atleta passa a cumprir suspensão por cartões.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Limite para suspensão por cartões amarelos" htmlFor="limite_amarelos">
            <Input
              id="limite_amarelos"
              type="number"
              min={1}
              disabled={desabilitado}
              value={configuracao.disciplina?.limite_amarelos ?? 3}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 3;
                onChange({
                  ...configuracao,
                  disciplina: { ...configuracao.disciplina, limite_amarelos: val },
                });
              }}
            />
          </Field>
          <Field label="Jogos de suspensão por acúmulo de amarelos" htmlFor="jogos_por_acumulo">
            <Input
              id="jogos_por_acumulo"
              type="number"
              min={1}
              disabled={desabilitado}
              value={configuracao.disciplina?.jogos_por_acumulo ?? 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 1;
                onChange({
                  ...configuracao,
                  disciplina: { ...configuracao.disciplina, jogos_por_acumulo: val },
                });
              }}
            />
          </Field>
          <Field label="Jogos de suspensão por expulsão com o 2º amarelo" htmlFor="jogos_por_segundo_amarelo">
            <Input
              id="jogos_por_segundo_amarelo"
              type="number"
              min={1}
              disabled={desabilitado}
              value={configuracao.disciplina?.jogos_por_segundo_amarelo ?? 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 1;
                onChange({
                  ...configuracao,
                  disciplina: { ...configuracao.disciplina, jogos_por_segundo_amarelo: val },
                });
              }}
            />
          </Field>
          <Field label="Jogos de suspensão por cartão vermelho" htmlFor="jogos_por_vermelho">
            <Input
              id="jogos_por_vermelho"
              type="number"
              min={1}
              disabled={desabilitado}
              value={configuracao.disciplina?.jogos_por_vermelho ?? 1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 1;
                onChange({
                  ...configuracao,
                  disciplina: { ...configuracao.disciplina, jogos_por_vermelho: val },
                });
              }}
            />
          </Field>
        </div>
        {formato === 'GRUPOS_MATA_MATA' && (
          <Opcao
            rotulo="Zerar contagem de amarelos ao encerrar a fase de grupos"
            disabled={desabilitado}
            checked={!!configuracao.disciplina?.zerar_amarelos_ao_encerrar_grupos}
            onChange={(v) =>
              onChange({
                ...configuracao,
                disciplina: { ...configuracao.disciplina, zerar_amarelos_ao_encerrar_grupos: v },
              })
            }
          />
        )}
      </Bloco>
    </div>
  );
}

/** Bloco titulado do formulário. */
function Bloco({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-line p-4">
      <div>
        <h4 className="text-sm font-semibold text-fg">{titulo}</h4>
        {descricao ? <p className="mt-0.5 text-xs text-fg-subtle">{descricao}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Opção liga/desliga com o rótulo clicável (mantém o nome acessível do checkbox). */
function Opcao({
  rotulo,
  checked,
  disabled,
  onChange,
}: {
  rotulo: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-fg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <Checkbox checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {rotulo}
    </label>
  );
}

/** Lista ordenável dos critérios de desempate (DF-RT13-01, PD-RT13-02). */
function OrdemDesempates({
  criterios,
  desabilitado,
  onChange,
}: {
  criterios: CriterioDesempate[];
  desabilitado?: boolean;
  onChange: (criterios: CriterioDesempate[]) => void;
}) {
  const disponiveis = TODOS_DESEMPATES.filter((c) => !criterios.includes(c));

  const mover = (indice: number, direcao: -1 | 1) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= criterios.length) return;
    const nova = [...criterios];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    onChange(nova);
  };

  return (
    <div className="space-y-3">
      <ol className="space-y-2" data-testid="lista-desempates">
        {criterios.map((criterio, i) => (
          <li
            key={criterio}
            className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
          >
            <span className="w-6 shrink-0 tabular-nums text-fg-subtle">{i + 1}º</span>
            <span className="min-w-0 flex-1 truncate">{ROTULO_DESEMPATE[criterio] ?? criterio}</span>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={`Subir ${ROTULO_DESEMPATE[criterio] ?? criterio}`}
              disabled={desabilitado || i === 0}
              onClick={() => mover(i, -1)}
            >
              <ArrowUp aria-hidden="true" />
            </IconButton>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={`Descer ${ROTULO_DESEMPATE[criterio] ?? criterio}`}
              disabled={desabilitado || i === criterios.length - 1}
              onClick={() => mover(i, 1)}
            >
              <ArrowDown aria-hidden="true" />
            </IconButton>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={`Remover ${ROTULO_DESEMPATE[criterio] ?? criterio}`}
              disabled={desabilitado || criterios.length <= 1}
              onClick={() => onChange(criterios.filter((c) => c !== criterio))}
            >
              <X aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ol>
      {disponiveis.length > 0 && (
        <Field label="Adicionar critério" htmlFor="adicionar-desempate">
          <Select
            id="adicionar-desempate"
            value=""
            disabled={desabilitado}
            onChange={(e) => {
              const valor = e.target.value as CriterioDesempate;
              if (valor) onChange([...criterios, valor]);
            }}
          >
            <option value="">Selecione…</option>
            {disponiveis.map((c) => (
              <option key={c} value={c}>
                {ROTULO_DESEMPATE[c]}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}
