'use client';

import React, { useState, useEffect } from 'react';
import { UserX } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { Avatar } from './Avatar';
import BuscaCompetidor from './BuscaCompetidor';
import ImportarAluno from './ImportarAluno';
import { competicoesService, isErroApi } from '@/services/competicoes';
import type { EquipeDetalhe, IntegranteDetalhe, CompetidorDetalhe } from '@/types/competicoes';

interface GavetaIntegranteProps {
  equipe: EquipeDetalhe;
  isOpen: boolean;
  onClose: () => void;
  onSalvo: () => void;
  integranteParaEditar?: IntegranteDetalhe | null;
}

export default function GavetaIntegrante({
  equipe,
  isOpen,
  onClose,
  onSalvo,
  integranteParaEditar,
}: GavetaIntegranteProps) {
  const [competidorSelecionado, setCompetidorSelecionado] = useState<CompetidorDetalhe | null>(null);
  const [nomeEsportivo, setNomeEsportivo] = useState('');
  const [numeroCamisa, setNumeroCamisa] = useState<string>('');
  const [posicao, setPosicao] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [inativando, setInativando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abaOrigem, setAbaOrigem] = useState<'busca' | 'importar'>('busca');

  // Inicializa estado quando abrir
  useEffect(() => {
    if (isOpen) {
      setErro(null);
      if (integranteParaEditar) {
        setNomeEsportivo(integranteParaEditar.nome_esportivo);
        setNumeroCamisa(
          integranteParaEditar.numero_camisa !== null && integranteParaEditar.numero_camisa !== undefined
            ? String(integranteParaEditar.numero_camisa)
            : ''
        );
        setPosicao(integranteParaEditar.posicao || '');
      } else {
        setCompetidorSelecionado(null);
        setNomeEsportivo('');
        setNumeroCamisa('');
        setPosicao('');
        setAbaOrigem('busca');
      }
    }
  }, [isOpen, integranteParaEditar]);

  // Regra de camisa repetida na equipe
  const camisaNumero = numeroCamisa.trim() !== '' ? parseInt(numeroCamisa, 10) : null;
  const isCamisaRepetida =
    camisaNumero !== null &&
    !isNaN(camisaNumero) &&
    equipe.integrantes.some(
      (i) =>
        i.situacao === 'ATIVO' &&
        i.numero_camisa === camisaNumero &&
        i.id_integrante !== integranteParaEditar?.id_integrante
    );

  const handleSelectCompetidor = (c: CompetidorDetalhe) => {
    setCompetidorSelecionado(c);
    setNomeEsportivo(c.nome);
    setErro(null);
  };

  const handleSalvarInscricao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!integranteParaEditar && !competidorSelecionado) {
      setErro('Selecione ou cadastre um competidor para inscrever na equipe.');
      return;
    }
    if (!nomeEsportivo.trim()) {
      setErro('O nome esportivo é obrigatório.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      if (integranteParaEditar) {
        // Modo de visualização/edição: caso a API suporte edição futura
        onSalvo();
        onClose();
      } else if (competidorSelecionado) {
        await competicoesService.inscreverIntegrante(equipe.id_equipe, {
          id_competidor: competidorSelecionado.id_competidor,
          nome_esportivo: nomeEsportivo.trim(),
          numero_camisa: camisaNumero,
          posicao: posicao.trim() || undefined,
        });
        onSalvo();
        onClose();
      }
    } catch (err) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else {
        setErro('Erro ao inscrever integrante na equipe.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleInativarIntegrante = async () => {
    if (!integranteParaEditar) return;
    setInativando(true);
    setErro(null);

    try {
      await competicoesService.inativarIntegrante(integranteParaEditar.id_integrante);
      onSalvo();
      onClose();
    } catch (err) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else {
        setErro('Erro ao inativar integrante.');
      }
    } finally {
      setInativando(false);
    }
  };

  const titulo = integranteParaEditar ? 'Detalhes do Integrante' : 'Adicionar Integrante';

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => (!aberto ? onClose() : undefined)}>
      <DialogContent
        side="right"
        title={titulo}
        description={
          <>
            Equipe: <span className="font-medium text-fg">{equipe.nome}</span>
          </>
        }
      >
        <div className="space-y-6">
          {erro && <Alert tone="danger">{erro}</Alert>}

          {integranteParaEditar ? (
            <div className="space-y-6">
              <div className="space-y-4 rounded-xl border border-line bg-surface-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nome={integranteParaEditar.nome_esportivo} className="size-10 text-sm" />
                    <span className="truncate text-base font-semibold text-fg">
                      {integranteParaEditar.nome_esportivo}
                    </span>
                  </div>
                  <StatusBadge tipo="integrante" valor={integranteParaEditar.situacao} />
                </div>

                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-fg-muted">Camisa</dt>
                    <dd className="text-sm font-semibold tabular-nums text-fg">
                      {integranteParaEditar.numero_camisa !== null
                        ? `#${integranteParaEditar.numero_camisa}`
                        : 'Sem número'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted">Posição</dt>
                    <dd className="text-sm font-semibold text-fg">
                      {integranteParaEditar.posicao || 'Não definida'}
                    </dd>
                  </div>
                </dl>
              </div>

              {integranteParaEditar.situacao === 'ATIVO' && (
                <div className="space-y-2 border-t border-line pt-4">
                  <Button
                    variant="danger-outline"
                    className="w-full"
                    loading={inativando}
                    leftIcon={<UserX className="size-4" />}
                    onClick={handleInativarIntegrante}
                  >
                    Inativar Integrante da Equipe
                  </Button>
                  <p className="text-center text-xs text-fg-muted">
                    O integrante será marcado como inativo, preservando o histórico de jogos e súmulas.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form id="form-integrante" onSubmit={handleSalvarInscricao} className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-fg">1. Selecionar atleta</h3>

                {competidorSelecionado ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-soft p-3.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar nome={competidorSelecionado.nome} className="size-9 bg-primary-solid text-on-primary" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-fg">{competidorSelecionado.nome}</div>
                        <div className="text-xs text-fg-muted">
                          {competidorSelecionado.id_aluno_origem
                            ? 'Aluno Escolar Importado'
                            : 'Competidor Comunitário (Terceiro)'}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setCompetidorSelecionado(null)}>
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <Tabs value={abaOrigem} onValueChange={(v) => setAbaOrigem(v as 'busca' | 'importar')}>
                    <TabsList>
                      <TabsTrigger value="busca">Buscar / Novo Terceiro</TabsTrigger>
                      <TabsTrigger value="importar">Importar Aluno da Escola</TabsTrigger>
                    </TabsList>
                    <TabsContent value="busca">
                      <BuscaCompetidor
                        onSelectCompetidor={handleSelectCompetidor}
                        competidorSelecionado={competidorSelecionado}
                      />
                    </TabsContent>
                    <TabsContent value="importar">
                      <ImportarAluno onAlunoImportado={handleSelectCompetidor} />
                    </TabsContent>
                  </Tabs>
                )}
              </section>

              <section className="space-y-4 border-t border-line pt-4">
                <h3 className="text-sm font-semibold text-fg">2. Dados da inscrição na equipe</h3>

                <Field label="Nome esportivo (na camisa / súmula)" htmlFor="nome-esportivo" required>
                  <Input
                    id="nome-esportivo"
                    type="text"
                    value={nomeEsportivo}
                    onChange={(e) => setNomeEsportivo(e.target.value)}
                    placeholder="Ex: Romário, Ronaldinho"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Número da camisa" htmlFor="numero-camisa">
                    <Input
                      id="numero-camisa"
                      type="number"
                      min="0"
                      max="999"
                      value={numeroCamisa}
                      onChange={(e) => setNumeroCamisa(e.target.value)}
                      placeholder="Ex: 10"
                    />
                  </Field>
                  <Field label="Posição" htmlFor="posicao">
                    <Input
                      id="posicao"
                      type="text"
                      value={posicao}
                      onChange={(e) => setPosicao(e.target.value)}
                      placeholder="Ex: Atacante, Goleiro"
                    />
                  </Field>
                </div>

                {/* Regra de camisa repetida: aviso amigável, sem bloqueio */}
                {isCamisaRepetida && (
                  <Alert tone="warning" title="Número repetido na equipe">
                    Outro atleta desta equipe já está registrado com o número {camisaNumero}. A numeração duplicada é
                    permitida pelas regras da competição, mas certifique-se da identificação correta na súmula.
                  </Alert>
                )}
              </section>
            </form>
          )}
        </div>
        {!integranteParaEditar && (
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-integrante"
              loading={salvando}
              disabled={!competidorSelecionado || !nomeEsportivo.trim()}
            >
              Salvar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
