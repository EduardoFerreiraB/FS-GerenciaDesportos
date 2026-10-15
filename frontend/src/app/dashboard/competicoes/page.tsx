'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { listarCompeticoes, isErroApi } from '@/services/competicoes';
import { modalidadeService } from '@/services';
import type { CompeticaoDetalhe } from '@/types/competicoes';
import ModalNovaCompeticao from '@/components/competicoes/organizacao/ModalNovaCompeticao';
import ModalNovoEvento from '@/components/competicoes/organizacao/ModalNovoEvento';

interface ModalidadeItem {
  id_modalidade: number;
  nome: string;
}

export default function CompeticoesPage() {
  const router = useRouter();
  const [competicoes, setCompeticoes] = useState<CompeticaoDetalhe[]>([]);
  const [modalidades, setModalidades] = useState<ModalidadeItem[]>([]);
  const [filtroModalidade, setFiltroModalidade] = useState<number | ''>('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalCompeticaoAberto, setModalCompeticaoAberto] = useState(false);
  const [modalEventoAberto, setModalEventoAberto] = useState(false);

  const carregarCompeticoes = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const res = await listarCompeticoes({
        pagina,
        tamanho: 10,
        busca: busca.trim() || undefined,
      });
      setCompeticoes(res.itens);
      setTotal(res.total);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar lista de competições.');
      }
    } finally {
      setCarregando(false);
    }
  }, [pagina, busca]);

  useEffect(() => {
    carregarCompeticoes();
  }, [carregarCompeticoes]);

  useEffect(() => {
    modalidadeService
      .getAll()
      .then((res: unknown) => {
        if (Array.isArray(res)) setModalidades(res as ModalidadeItem[]);
      })
      .catch(() => {});
  }, []);

  const competicoesFiltradas = competicoes.filter((comp) => {
    if (filtroModalidade !== '' && comp.id_modalidade !== filtroModalidade) {
      return false;
    }
    return true;
  });

  const getNomeModalidade = (idMod: number) => {
    const m = modalidades.find((mod) => mod.id_modalidade === idMod);
    return m ? m.nome : `Modalidade #${idMod}`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="text-amber-500 w-7 h-7" />
            Competições Esportivas
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestão unificada de campeonatos, torneios e suas respectivas edições
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/eventos"
            className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-sm transition flex items-center gap-2"
          >
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Ver Eventos</span>
          </Link>
          <button
            type="button"
            onClick={() => setModalCompeticaoAberto(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nova competição</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar competições..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={filtroModalidade}
            onChange={(e) =>
              setFiltroModalidade(e.target.value === '' ? '' : Number(e.target.value))
            }
            className="w-full sm:w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as modalidades</option>
            {modalidades.map((mod) => (
              <option key={mod.id_modalidade} value={mod.id_modalidade}>
                {mod.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {carregando ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-sm text-slate-500">Carregando competições...</p>
        </div>
      ) : erro ? (
        <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-red-800">Falha ao carregar competições</h3>
          <p className="text-sm text-red-600 max-w-md mx-auto">{erro}</p>
          <button
            type="button"
            onClick={carregarCompeticoes}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar novamente</span>
          </button>
        </div>
      ) : competicoesFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <Trophy className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-700">Nenhuma competição encontrada</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {busca || filtroModalidade !== ''
              ? 'Nenhuma competição corresponde aos filtros informados.'
              : 'Comece criando a primeira competição esportiva da sua organização.'}
          </p>
          <button
            type="button"
            onClick={() => setModalCompeticaoAberto(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Criar primeira competição</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competicoesFiltradas.map((comp) => {
            const ultimaEdicao = comp.edicoes?.[comp.edicoes.length - 1];

            return (
              <Link
                key={comp.id_competicao}
                href={`/dashboard/competicoes/${comp.id_competicao}`}
                className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {getNomeModalidade(comp.id_modalidade)}
                    </span>
                    {comp.arquivado && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        Arquivada
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition">
                    {comp.nome}
                  </h3>

                  {comp.descricao && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {comp.descricao}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  {ultimaEdicao ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Edição ativa:</span>
                        <strong className="text-slate-700">{ultimaEdicao.identificacao}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            ultimaEdicao.estado === 'RASCUNHO'
                              ? 'bg-amber-100 text-amber-800'
                              : ultimaEdicao.estado === 'EM_ANDAMENTO'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {ultimaEdicao.estado}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            ultimaEdicao.publicada
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {ultimaEdicao.publicada ? 'Publicada' : 'Não publicada'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Nenhuma edição cadastrada</div>
                  )}

                  <div className="mt-4 flex items-center justify-end text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition">
                    <span>Acessar edição</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modais */}
      <ModalNovaCompeticao
        aberto={modalCompeticaoAberto}
        onClose={() => setModalCompeticaoAberto(false)}
        onSuccess={(novaComp) => {
          setModalCompeticaoAberto(false);
          router.push(`/dashboard/competicoes/${novaComp.id_competicao}`);
        }}
      />

      <ModalNovoEvento
        aberto={modalEventoAberto}
        onClose={() => setModalEventoAberto(false)}
        onSuccess={() => {
          setModalEventoAberto(false);
          carregarCompeticoes();
        }}
      />
    </div>
  );
}
