'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Check, Pencil, PlusCircle, Search, UserCheck, X } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Field, IconButton, Input, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';
import { competicoesService, isErroApi } from '@/services/competicoes';
import type { CompetidorDetalhe, PaginaCompetidores } from '@/types/competicoes';

interface BuscaCompetidorProps {
  onSelectCompetidor: (competidor: CompetidorDetalhe) => void;
  competidorSelecionado?: CompetidorDetalhe | null;
  idsCompetidoresInscritos?: Set<number>;
}

export default function BuscaCompetidor({
  onSelectCompetidor,
  competidorSelecionado,
  idsCompetidoresInscritos,
}: BuscaCompetidorProps) {
  const [modo, setModo] = useState<'busca' | 'novo'>('busca');

  // Estado de busca
  const [termoBusca, setTermoBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<PaginaCompetidores | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  // Estado de criação de terceiro avulso
  const [nomeNovo, setNomeNovo] = useState('');
  const [docNovo, setDocNovo] = useState('');
  const [nascNovo, setNascNovo] = useState('');
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);

  // Estado de edição inline do nome do competidor
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const executarBusca = useCallback(async (termo: string, pag: number) => {
    setCarregando(true);
    setErroBusca(null);
    try {
      const data = await competicoesService.listarCompetidores({
        busca: termo.trim() || undefined,
        pagina: pag,
        tamanho: 10,
      });
      setResultado(data);
    } catch (err) {
      if (isErroApi(err)) {
        setErroBusca(err.mensagem);
      } else {
        setErroBusca('Erro ao buscar competidores.');
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (modo === 'busca') {
      executarBusca(termoBusca, pagina);
    }
  }, [executarBusca, modo, pagina, termoBusca]);

  const handleSubmeterBusca = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    executarBusca(termoBusca, 1);
  };

  const handleCriarTerceiro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovo.trim()) {
      setErroCriacao('O nome do competidor é obrigatório.');
      return;
    }

    setCriando(true);
    setErroCriacao(null);
    try {
      const novo = await competicoesService.criarCompetidor({
        nome: nomeNovo.trim(),
        documento: docNovo.trim() || undefined,
        data_nascimento: nascNovo || undefined,
        ativo: true,
      });
      // Limpa os campos e seleciona automaticamente
      setNomeNovo('');
      setDocNovo('');
      setNascNovo('');
      onSelectCompetidor(novo);
    } catch (err) {
      if (isErroApi(err)) {
        setErroCriacao(err.mensagem);
      } else {
        setErroCriacao('Erro ao cadastrar novo competidor.');
      }
    } finally {
      setCriando(false);
    }
  };

  const iniciarEdicaoNome = (c: CompetidorDetalhe) => {
    setEditandoId(c.id_competidor);
    setNomeEdicao(c.nome);
    setErroEdicao(null);
  };

  const cancelarEdicaoNome = () => {
    setEditandoId(null);
    setNomeEdicao('');
    setErroEdicao(null);
  };

  const handleSalvarNome = async (idCompetidor: number) => {
    const novoNome = nomeEdicao.trim();
    if (!novoNome) {
      setErroEdicao('O nome do competidor é obrigatório.');
      return;
    }

    setSalvandoNome(true);
    setErroEdicao(null);
    try {
      const atualizado = await competicoesService.renomearCompetidor(idCompetidor, novoNome);
      setResultado((prev) =>
        prev
          ? {
              ...prev,
              itens: prev.itens.map((item) =>
                item.id_competidor === idCompetidor ? atualizado : item,
              ),
            }
          : prev,
      );
      setEditandoId(null);
      setNomeEdicao('');
    } catch (err) {
      if (isErroApi(err)) {
        setErroEdicao(err.mensagem);
      } else {
        setErroEdicao('Erro ao atualizar o nome do competidor.');
      }
    } finally {
      setSalvandoNome(false);
    }
  };

  const classeModo = (ativo: boolean) =>
    cn(
      '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-focus',
      ativo ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-fg',
    );

  return (
    <div className="space-y-4">
      <div className="flex border-b border-line">
        <button type="button" onClick={() => setModo('busca')} className={classeModo(modo === 'busca')}>
          <Search className="size-4" aria-hidden="true" />
          Buscar Competidor
        </button>
        <button type="button" onClick={() => setModo('novo')} className={classeModo(modo === 'novo')}>
          <PlusCircle className="size-4" aria-hidden="true" />
          Novo Terceiro (Avulso)
        </button>
      </div>

      {modo === 'busca' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setPagina(1);
                    executarBusca(termoBusca, 1);
                  }
                }}
                placeholder="Buscar competidor por nome..."
                aria-label="Buscar competidor"
                className="pl-9"
              />
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            </div>
            <Button
              variant="secondary"
              loading={carregando}
              onClick={() => {
                setPagina(1);
                executarBusca(termoBusca, 1);
              }}
            >
              Buscar
            </Button>
          </div>

          {erroBusca && <Alert tone="danger">{erroBusca}</Alert>}
          {erroEdicao && <Alert tone="danger">{erroEdicao}</Alert>}

          <div className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
            {carregando && (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-fg-muted">
                <Spinner size="sm" />
                <span>Buscando competidores...</span>
              </div>
            )}

            {!carregando && resultado && resultado.itens.length === 0 && (
              <EmptyState
                className="border-0 py-8"
                icon={<Search />}
                title="Nenhum competidor encontrado"
                action={
                  <Button variant="secondary" size="sm" onClick={() => setModo('novo')}>
                    Cadastrar novo terceiro
                  </Button>
                }
              />
            )}

            {!carregando &&
              resultado?.itens.map((c) => {
                const isSelected = competidorSelecionado?.id_competidor === c.id_competidor;
                const jaInscrito = idsCompetidoresInscritos?.has(c.id_competidor) ?? false;
                const emEdicao = editandoId === c.id_competidor;

                if (emEdicao) {
                  return (
                    <div key={c.id_competidor} className="flex items-center gap-2 bg-surface-muted/60 p-3">
                      <Input
                        type="text"
                        value={nomeEdicao}
                        onChange={(e) => setNomeEdicao(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleSalvarNome(c.id_competidor);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelarEdicaoNome();
                          }
                        }}
                        aria-label={`Novo nome de ${c.nome}`}
                        placeholder="Nome do competidor"
                        autoFocus
                        className="h-8 flex-1 text-sm"
                      />
                      <IconButton
                        aria-label="Salvar nome do competidor"
                        variant="ghost"
                        size="sm"
                        disabled={salvandoNome || !nomeEdicao.trim()}
                        onClick={() => void handleSalvarNome(c.id_competidor)}
                      >
                        <Check aria-hidden="true" className="size-4 text-success" />
                      </IconButton>
                      <IconButton
                        aria-label="Cancelar edição do nome"
                        variant="ghost"
                        size="sm"
                        disabled={salvandoNome}
                        onClick={cancelarEdicaoNome}
                      >
                        <X aria-hidden="true" className="size-4" />
                      </IconButton>
                    </div>
                  );
                }

                return (
                  <div
                    key={c.id_competidor}
                    className={cn(
                      'flex items-center justify-between gap-3 p-3 transition-colors duration-150 hover:bg-surface-muted/60',
                      isSelected && 'bg-primary-soft',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar nome={c.nome} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                          <span className="truncate">{c.nome}</span>
                          {c.id_aluno_origem ? (
                            <Badge tone="primary">Aluno Escola</Badge>
                          ) : (
                            <Badge tone="warning">Terceiro</Badge>
                          )}
                          {jaInscrito && <Badge tone="neutral">Já inscrito</Badge>}
                        </div>
                        {c.documento && <div className="text-xs text-fg-muted">Doc: {c.documento}</div>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <IconButton
                        aria-label={`Renomear competidor ${c.nome}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => iniciarEdicaoNome(c)}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </IconButton>
                      {jaInscrito ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled
                          aria-label={`${c.nome} já inscrito nesta edição`}
                        >
                          Já inscrito
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={isSelected ? 'secondary' : 'primary'}
                          leftIcon={isSelected ? <UserCheck className="size-3.5" /> : undefined}
                          onClick={() => onSelectCompetidor(c)}
                        >
                          {isSelected ? 'Selecionado' : 'Selecionar'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {resultado && resultado.total > resultado.tamanho && (
            <div className="flex items-center justify-between pt-1 text-xs text-fg-muted">
              <span>Total: {resultado.total} competidor(es)</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span>Página {pagina}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagina * resultado.tamanho >= resultado.total}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {modo === 'novo' && (
        <div className="space-y-3 rounded-xl border border-line bg-surface-muted p-4">
          <p className="text-xs text-fg-muted">
            Cadastre um competidor comunitário avulso (sem matrícula escolar).
          </p>

          {erroCriacao && <Alert tone="danger">{erroCriacao}</Alert>}

          <Field label="Nome do competidor" htmlFor="nome-terceiro" required>
            <Input
              id="nome-terceiro"
              type="text"
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="Ex: João da Silva"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Documento (RG/CPF)" htmlFor="doc-terceiro">
              <Input
                id="doc-terceiro"
                type="text"
                value={docNovo}
                onChange={(e) => setDocNovo(e.target.value)}
                placeholder="Ex: 12345678"
              />
            </Field>
            <Field label="Data de nascimento" htmlFor="nasc-terceiro">
              <Input id="nasc-terceiro" type="date" value={nascNovo} onChange={(e) => setNascNovo(e.target.value)} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setModo('busca')}>
              Cancelar
            </Button>
            <Button size="sm" loading={criando} disabled={!nomeNovo.trim()} onClick={handleCriarTerceiro}>
              Cadastrar e Selecionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
