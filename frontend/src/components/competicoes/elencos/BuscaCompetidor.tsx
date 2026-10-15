'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, PlusCircle, UserCheck, User, AlertCircle, Loader2 } from 'lucide-react';
import { competicoesService, isErroApi } from '@/services/competicoes';
import type { CompetidorDetalhe, PaginaCompetidores } from '@/types/competicoes';

interface BuscaCompetidorProps {
  onSelectCompetidor: (competidor: CompetidorDetalhe) => void;
  competidorSelecionado?: CompetidorDetalhe | null;
}

export default function BuscaCompetidor({
  onSelectCompetidor,
  competidorSelecionado,
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

  return (
    <div className="space-y-4">
      {/* Seletor de Modo */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setModo('busca')}
          className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            modo === 'busca'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Search size={16} />
            Buscar Competidor
          </span>
        </button>
        <button
          type="button"
          onClick={() => setModo('novo')}
          className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            modo === 'novo'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <PlusCircle size={16} />
            Novo Terceiro (Avulso)
          </span>
        </button>
      </div>

      {/* Modo: Busca de Competidor */}
      {modo === 'busca' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
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
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
            <button
              type="button"
              disabled={carregando}
              onClick={() => {
                setPagina(1);
                executarBusca(termoBusca, 1);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              {carregando ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
            </button>
          </div>

          {erroBusca && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{erroBusca}</span>
            </div>
          )}

          {/* Lista de Resultados */}
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {carregando && (
              <div className="p-6 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin text-indigo-600" />
                <span>Buscando competidores...</span>
              </div>
            )}

            {!carregando && resultado && resultado.itens.length === 0 && (
              <div className="p-6 text-center text-slate-500 text-sm">
                Nenhum competidor encontrado.{' '}
                <button
                  type="button"
                  onClick={() => setModo('novo')}
                  className="text-indigo-600 hover:underline font-medium"
                >
                  Cadastrar novo terceiro
                </button>
              </div>
            )}

            {!carregando &&
              resultado?.itens.map((c) => {
                const isSelected = competidorSelecionado?.id_competidor === c.id_competidor;
                return (
                  <div
                    key={c.id_competidor}
                    className={`p-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                        <User size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                          {c.nome}
                          {c.id_aluno_origem ? (
                            <span className="text-[11px] font-normal px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                              Aluno Escola
                            </span>
                          ) : (
                            <span className="text-[11px] font-normal px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                              Terceiro
                            </span>
                          )}
                        </div>
                        {c.documento && (
                          <div className="text-xs text-slate-500">Doc: {c.documento}</div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectCompetidor(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <UserCheck size={14} /> Selecionado
                        </>
                      ) : (
                        'Selecionar'
                      )}
                    </button>
                  </div>
                );
              })}
          </div>

          {/* Paginação */}
          {resultado && resultado.total > resultado.tamanho && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>
                Total: {resultado.total} competidor(es)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="px-2 py-1">Página {pagina}</span>
                <button
                  type="button"
                  disabled={pagina * resultado.tamanho >= resultado.total}
                  onClick={() => setPagina((p) => p + 1)}
                  className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modo: Cadastro de Terceiro Avulso */}
      {modo === 'novo' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-600">
            Cadastre um competidor comunitário avulso (sem matrícula escolar).
          </div>

          {erroCriacao && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{erroCriacao}</span>
            </div>
          )}

          <div>
            <label htmlFor="nome-terceiro" className="block text-xs font-medium text-slate-700 mb-1">
              Nome do competidor *
            </label>
            <input
              id="nome-terceiro"
              type="text"
              required
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="Ex: João da Silva"
              aria-label="Nome do competidor"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="doc-terceiro" className="block text-xs font-medium text-slate-700 mb-1">
                Documento (RG/CPF)
              </label>
              <input
                id="doc-terceiro"
                type="text"
                value={docNovo}
                onChange={(e) => setDocNovo(e.target.value)}
                placeholder="Ex: 12345678"
                aria-label="Documento"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="nasc-terceiro" className="block text-xs font-medium text-slate-700 mb-1">
                Data de Nascimento
              </label>
              <input
                id="nasc-terceiro"
                type="date"
                value={nascNovo}
                onChange={(e) => setNascNovo(e.target.value)}
                aria-label="Data de nascimento"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModo('busca')}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={criando || !nomeNovo.trim()}
              onClick={handleCriarTerceiro}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {criando && <Loader2 size={14} className="animate-spin" />}
              Cadastrar e Selecionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
