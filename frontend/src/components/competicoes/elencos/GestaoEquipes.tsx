'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Copy, MoreHorizontal, Pencil, Plus, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  Skeleton,
} from '@/components/ui';
import { useNotification } from '@/context/NotificationContext';
import { extrairErro } from '@/lib/erros';
import GavetaIntegrante from './GavetaIntegrante';
import GavetaElenco from './GavetaElenco';
import CopiarElenco from './CopiarElenco';
import { competicoesService, isErroApi } from '@/services/competicoes';
import type { EquipeDetalhe, IntegranteDetalhe, EstadoEdicao } from '@/types/competicoes';

interface GestaoEquipesProps {
  idEdicaoCompeticao: number;
}

interface GavetaAberta {
  equipe: EquipeDetalhe;
  integrante: IntegranteDetalhe | null;
  /** Aberta a partir do elenco: ao fechar, volta para o elenco da equipe. */
  voltarAoElenco: boolean;
}

export default function GestaoEquipes({ idEdicaoCompeticao }: GestaoEquipesProps) {
  const { toast } = useNotification();
  const [equipes, setEquipes] = useState<EquipeDetalhe[]>([]);
  const [estadoEdicao, setEstadoEdicao] = useState<EstadoEdicao>('RASCUNHO');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Gaveta lateral com o elenco de uma equipe
  const [idEquipeElenco, setIdEquipeElenco] = useState<number | null>(null);

  // Modal de Nova Equipe
  const [modalNovaEquipeAberta, setModalNovaEquipeAberta] = useState(false);
  const [nomeNovaEquipe, setNomeNovaEquipe] = useState('');
  const [siglaNovaEquipe, setSiglaNovaEquipe] = useState('');
  const [criandoEquipe, setCriandoEquipe] = useState(false);
  const [erroNovaEquipe, setErroNovaEquipe] = useState<string | null>(null);

  // Modal de Editar Equipe
  const [equipeParaEditar, setEquipeParaEditar] = useState<EquipeDetalhe | null>(null);
  const [nomeEditarEquipe, setNomeEditarEquipe] = useState('');
  const [siglaEditarEquipe, setSiglaEditarEquipe] = useState('');
  const [salvandoEquipe, setSalvandoEquipe] = useState(false);
  const [erroEditarEquipe, setErroEditarEquipe] = useState<string | null>(null);
  const [erroCamposEditarEquipe, setErroCamposEditarEquipe] = useState<Record<string, string>>({});

  // Gaveta de Integrante (inscrição / detalhes)
  const [gaveta, setGaveta] = useState<GavetaAberta | null>(null);
  const salvouNaGaveta = useRef(false);

  // Modal de Copiar Elenco
  const [modalCopiarAberta, setModalCopiarAberta] = useState(false);

  // Exclusão de equipe
  const [equipeParaExcluir, setEquipeParaExcluir] = useState<EquipeDetalhe | null>(null);

  const isRascunho = estadoEdicao === 'RASCUNHO';

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      // Carrega equipes e estado da edição
      const [listaEquipes, edicao] = await Promise.all([
        competicoesService.listarEquipes(idEdicaoCompeticao),
        competicoesService.obterEdicao(idEdicaoCompeticao).catch(() => null),
      ]);

      setEquipes(listaEquipes || []);
      if (edicao) {
        setEstadoEdicao(edicao.estado);
      }
    } catch (err) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else {
        setErro('Erro ao carregar equipes da edição.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const equipeElenco = equipes.find((e) => e.id_equipe === idEquipeElenco) ?? null;

  const idsCompetidoresInscritos = useMemo(
    () => new Set(equipes.flatMap((eq) => (eq.integrantes ?? []).map((i) => i.id_competidor))),
    [equipes],
  );

  const abrirNovaEquipe = () => {
    setErroNovaEquipe(null);
    setModalNovaEquipeAberta(true);
  };

  const abrirEditarEquipe = (equipe: EquipeDetalhe) => {
    setEquipeParaEditar(equipe);
    setNomeEditarEquipe(equipe.nome);
    setSiglaEditarEquipe(equipe.sigla ?? '');
    setErroEditarEquipe(null);
    setErroCamposEditarEquipe({});
  };

  const handleEditarEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipeParaEditar) return;
    if (!nomeEditarEquipe.trim()) {
      setErroCamposEditarEquipe({ nome: 'O nome da equipe é obrigatório.' });
      return;
    }

    setSalvandoEquipe(true);
    setErroEditarEquipe(null);
    setErroCamposEditarEquipe({});

    try {
      await competicoesService.atualizarEquipe(equipeParaEditar.id_equipe, {
        nome: nomeEditarEquipe.trim(),
        sigla: siglaEditarEquipe.trim() || null,
      });
      toast('Equipe atualizada com sucesso.', 'success');
      setEquipeParaEditar(null);
      await carregarDados();
    } catch (err) {
      const parsed = extrairErro(err, {
        camposConhecidos: ['nome', 'sigla'],
        padrao: 'Erro ao atualizar equipe.',
      });
      setErroCamposEditarEquipe(parsed.campos);
      if (!parsed.campos.nome && !parsed.campos.sigla) {
        setErroEditarEquipe(parsed.mensagem);
      }
    } finally {
      setSalvandoEquipe(false);
    }
  };

  const abrirGavetaNovoIntegrante = (equipe: EquipeDetalhe, voltarAoElenco = false) => {
    salvouNaGaveta.current = false;
    setIdEquipeElenco(null);
    setGaveta({ equipe, integrante: null, voltarAoElenco });
  };

  const abrirGavetaEditarIntegrante = (equipe: EquipeDetalhe, integrante: IntegranteDetalhe) => {
    salvouNaGaveta.current = false;
    setIdEquipeElenco(null);
    setGaveta({ equipe, integrante, voltarAoElenco: true });
  };

  const fecharGaveta = () => {
    const anterior = gaveta;
    setGaveta(null);
    // Depois de salvar (ou quando veio do elenco) volta para o elenco atualizado.
    if (anterior && (anterior.voltarAoElenco || salvouNaGaveta.current)) {
      setIdEquipeElenco(anterior.equipe.id_equipe);
    }
    salvouNaGaveta.current = false;
  };

  const handleCriarEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovaEquipe.trim()) {
      setErroNovaEquipe('O nome da equipe é obrigatório.');
      return;
    }

    setCriandoEquipe(true);
    setErroNovaEquipe(null);

    try {
      await competicoesService.criarEquipe(idEdicaoCompeticao, {
        nome: nomeNovaEquipe.trim(),
        sigla: siglaNovaEquipe.trim() || undefined,
      });

      setNomeNovaEquipe('');
      setSiglaNovaEquipe('');
      setModalNovaEquipeAberta(false);

      await carregarDados();
    } catch (err) {
      if (isErroApi(err)) {
        setErroNovaEquipe(err.mensagem);
      } else {
        setErroNovaEquipe('Erro ao criar equipe na edição.');
      }
    } finally {
      setCriandoEquipe(false);
    }
  };

  const confirmarExclusaoEquipe = async () => {
    if (!equipeParaExcluir) return;
    try {
      await competicoesService.excluirEquipe(equipeParaExcluir.id_equipe);
    } catch (err) {
      throw new Error(isErroApi(err) ? err.mensagem : 'Não foi possível excluir a equipe.');
    }
    await carregarDados();
  };

  const carregandoInicial = carregando && equipes.length === 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho da aba */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg">Equipes e elencos</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            {carregandoInicial
              ? 'Carregando equipes…'
              : `${equipes.length} ${equipes.length === 1 ? 'equipe cadastrada' : 'equipes cadastradas'} nesta edição`}
          </p>
        </div>

        {equipes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Copy className="size-4" />}
              onClick={() => setModalCopiarAberta(true)}
            >
              Copiar elenco
            </Button>
            <Button leftIcon={<Plus className="size-4" />} onClick={abrirNovaEquipe}>
              Nova equipe
            </Button>
          </div>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <Alert
          tone="danger"
          title="Não foi possível carregar as equipes"
          action={
            <Button variant="secondary" size="sm" onClick={carregarDados}>
              Tentar novamente
            </Button>
          }
        >
          {erro}
        </Alert>
      )}

      {/* Carregando */}
      {carregandoInicial && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      )}

      {/* Vazio */}
      {!carregando && !erro && equipes.length === 0 && (
        <EmptyState
          icon={<Shield />}
          title="Nenhuma equipe cadastrada"
          description="Cadastre a primeira equipe desta edição ou copie os elencos de uma edição anterior."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="secondary"
                leftIcon={<Copy className="size-4" />}
                onClick={() => setModalCopiarAberta(true)}
              >
                Copiar elenco
              </Button>
              <Button leftIcon={<Plus className="size-4" />} onClick={abrirNovaEquipe}>
                Nova equipe
              </Button>
            </div>
          }
        />
      )}

      {/* Grade de equipes */}
      {equipes.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {equipes.map((equipe) => {
            const totalIntegrantes = equipe.integrantes?.length || 0;
            const integrantesAtivos =
              equipe.integrantes?.filter((i) => i.situacao === 'ATIVO').length || 0;
            const sigla = equipe.sigla || equipe.nome.slice(0, 3).toUpperCase();

            return (
              <li key={equipe.id_equipe}>
                <Card className="flex h-full flex-col transition-colors duration-150 hover:border-line-strong">
                  <div className="flex items-start gap-3 p-4">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-semibold text-primary"
                    >
                      {sigla}
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setIdEquipeElenco(equipe.id_equipe)}
                        title={equipe.nome}
                        className="block max-w-full truncate rounded text-left text-base font-semibold text-fg outline-none transition-colors duration-150 hover:text-primary focus-visible:ring-4 focus-visible:ring-focus"
                      >
                        {equipe.nome}
                      </button>
                      <p className="mt-0.5 text-sm text-fg-muted">
                        <span className="tabular-nums">{totalIntegrantes}</span>{' '}
                        {totalIntegrantes === 1 ? 'atleta' : 'atletas'}
                        <span aria-hidden="true"> · </span>
                        <span className="tabular-nums">{integrantesAtivos}</span>{' '}
                        {integrantesAtivos === 1 ? 'ativo' : 'ativos'}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          aria-label={`Mais ações da equipe ${equipe.nome}`}
                          variant="ghost"
                          size="sm"
                          data-testid={`btn-acoes-equipe-${equipe.id_equipe}`}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </IconButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setIdEquipeElenco(equipe.id_equipe)}>
                          <Users aria-hidden="true" className="size-4" /> Ver elenco
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          data-testid={`btn-editar-equipe-${equipe.id_equipe}`}
                          onSelect={() => abrirEditarEquipe(equipe)}
                        >
                          <Pencil aria-hidden="true" className="size-4" /> Editar equipe
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => abrirGavetaNovoIntegrante(equipe)}>
                          <UserPlus aria-hidden="true" className="size-4" /> Adicionar integrante
                        </DropdownMenuItem>
                        {isRascunho && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              tone="danger"
                              data-testid={`btn-excluir-equipe-${equipe.id_equipe}`}
                              onSelect={() => setEquipeParaExcluir(equipe)}
                            >
                              <Trash2 aria-hidden="true" className="size-4" /> Excluir equipe
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Users className="size-4" />}
                      onClick={() => setIdEquipeElenco(equipe.id_equipe)}
                    >
                      Ver elenco
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-auto"
                      aria-label={`Adicionar integrante na equipe ${equipe.nome}`}
                      data-testid={`btn-add-integrante-${equipe.id_equipe}`}
                      leftIcon={<UserPlus className="size-4" />}
                      onClick={() => abrirGavetaNovoIntegrante(equipe)}
                    >
                      Adicionar integrante
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal: Nova Equipe */}
      <Dialog
        open={modalNovaEquipeAberta}
        onOpenChange={(aberto) => (criandoEquipe ? undefined : setModalNovaEquipeAberta(aberto))}
      >
        <DialogContent title="Nova equipe" description="Cadastre uma equipe nesta edição." size="sm">
          <form id="form-nova-equipe" onSubmit={handleCriarEquipe} className="space-y-4">
            {erroNovaEquipe && <Alert tone="danger">{erroNovaEquipe}</Alert>}

            <Field label="Nome da equipe" htmlFor="nome-equipe" required>
              <Input
                id="nome-equipe"
                type="text"
                required
                value={nomeNovaEquipe}
                onChange={(e) => setNomeNovaEquipe(e.target.value)}
                placeholder="Ex.: Falcões Dourados"
                autoFocus
              />
            </Field>

            <Field label="Sigla" htmlFor="sigla-equipe" hint="Opcional, até 10 caracteres.">
              <Input
                id="sigla-equipe"
                type="text"
                maxLength={10}
                value={siglaNovaEquipe}
                onChange={(e) => setSiglaNovaEquipe(e.target.value.toUpperCase())}
                placeholder="Ex.: FAL"
              />
            </Field>
          </form>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setModalNovaEquipeAberta(false)}
              disabled={criandoEquipe}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-nova-equipe"
              loading={criandoEquipe}
              disabled={!nomeNovaEquipe.trim()}
            >
              Criar equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Equipe */}
      <Dialog
        open={equipeParaEditar !== null}
        onOpenChange={(aberto) => (!aberto && !salvandoEquipe ? setEquipeParaEditar(null) : undefined)}
      >
        <DialogContent
          title="Editar equipe"
          description="Atualize o nome ou a sigla da equipe nesta edição."
          size="sm"
        >
          <form id="form-editar-equipe" onSubmit={handleEditarEquipe} className="space-y-4">
            {erroEditarEquipe && <Alert tone="danger">{erroEditarEquipe}</Alert>}

            <Field
              label="Nome da equipe"
              htmlFor="editar-nome-equipe"
              required
              error={erroCamposEditarEquipe.nome}
            >
              <Input
                id="editar-nome-equipe"
                type="text"
                required
                value={nomeEditarEquipe}
                onChange={(e) => {
                  setNomeEditarEquipe(e.target.value);
                  setErroCamposEditarEquipe((prev) => ({ ...prev, nome: '' }));
                }}
              />
            </Field>

            <Field
              label="Sigla"
              htmlFor="editar-sigla-equipe"
              hint="Opcional, até 10 caracteres."
              error={erroCamposEditarEquipe.sigla}
            >
              <Input
                id="editar-sigla-equipe"
                type="text"
                maxLength={10}
                value={siglaEditarEquipe}
                onChange={(e) => {
                  setSiglaEditarEquipe(e.target.value.toUpperCase());
                  setErroCamposEditarEquipe((prev) => ({ ...prev, sigla: '' }));
                }}
              />
            </Field>
          </form>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setEquipeParaEditar(null)}
              disabled={salvandoEquipe}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-editar-equipe"
              loading={salvandoEquipe}
              disabled={!nomeEditarEquipe.trim()}
            >
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gaveta lateral: elenco da equipe */}
      <GavetaElenco
        equipe={equipeElenco}
        onClose={() => setIdEquipeElenco(null)}
        onAdicionar={(equipe) => abrirGavetaNovoIntegrante(equipe, true)}
        onGerenciar={abrirGavetaEditarIntegrante}
      />

      {/* Gaveta de Inscrição / Detalhes de Integrante */}
      {gaveta && (
        <GavetaIntegrante
          equipe={gaveta.equipe}
          isOpen
          integranteParaEditar={gaveta.integrante}
          idsCompetidoresInscritos={idsCompetidoresInscritos}
          onClose={fecharGaveta}
          onSalvo={() => {
            salvouNaGaveta.current = true;
            carregarDados();
          }}
        />
      )}

      {/* Diálogo de Copiar Elenco */}
      <CopiarElenco
        idEdicaoCompeticao={idEdicaoCompeticao}
        estadoEdicao={estadoEdicao}
        isOpen={modalCopiarAberta}
        onClose={() => setModalCopiarAberta(false)}
        onCopiado={() => {
          carregarDados();
        }}
      />

      {/* Exclusão de equipe (só com a edição em rascunho) */}
      <ConfirmDialog
        open={equipeParaExcluir !== null}
        onOpenChange={(aberto) => (!aberto ? setEquipeParaExcluir(null) : undefined)}
        title="Excluir equipe?"
        description={
          <>
            A equipe <strong className="font-semibold text-fg">{equipeParaExcluir?.nome}</strong> e as
            inscrições dos seus atletas serão removidas. Os competidores continuam cadastrados. Essa ação não
            pode ser desfeita.
          </>
        }
        confirmText={equipeParaExcluir?.nome}
        confirmLabel="Excluir equipe"
        onConfirm={confirmarExclusaoEquipe}
      />
    </div>
  );
}
