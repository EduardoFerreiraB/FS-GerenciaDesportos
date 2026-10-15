'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  Search,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronRight,
  Trophy,
} from 'lucide-react';
import { listarEventos, isErroApi } from '@/services/competicoes';
import type { EventoDetalhe } from '@/types/competicoes';
import ModalNovoEvento from '@/components/competicoes/organizacao/ModalNovoEvento';

export default function EventosPage() {
  const [eventos, setEventos] = useState<EventoDetalhe[]>([]);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [modalNovoEventoAberto, setModalNovoEventoAberto] = useState(false);

  const carregarEventos = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const res = await listarEventos({
        pagina,
        tamanho: 10,
        busca: busca.trim() || undefined,
      });
      setEventos(res.itens);
      setTotal(res.total);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar lista de eventos esportivos.');
      }
    } finally {
      setCarregando(false);
    }
  }, [pagina, busca]);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="text-blue-600 w-7 h-7" />
            Eventos Esportivos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestão de grandes eventos agregadores (jogos escolares, semanas esportivas e olimpíadas)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/competicoes"
            className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-sm transition flex items-center gap-2"
          >
            <Trophy className="w-4 h-4 text-slate-500" />
            <span>Ver Competições</span>
          </Link>
          <button
            type="button"
            onClick={() => setModalNovoEventoAberto(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Novo evento</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros / Busca */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar eventos..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Lista Principal */}
      {carregando ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-sm text-slate-500">Carregando eventos esportivos...</p>
        </div>
      ) : erro ? (
        <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-red-800">Falha ao carregar eventos</h3>
          <p className="text-sm text-red-600 max-w-md mx-auto">{erro}</p>
          <button
            type="button"
            onClick={carregarEventos}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar novamente</span>
          </button>
        </div>
      ) : eventos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-700">Nenhum evento esportivo encontrado</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {busca
              ? 'Nenhum evento corresponde ao termo pesquisado.'
              : 'Organize suas edições criando seu primeiro evento esportivo.'}
          </p>
          <button
            type="button"
            onClick={() => setModalNovoEventoAberto(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Criar primeiro evento</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventos.map((evento) => {
            const ultimaEdicao = evento.edicoes?.[evento.edicoes.length - 1];

            return (
              <Link
                key={evento.id_evento}
                href={`/dashboard/eventos/${evento.id_evento}`}
                className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {evento.edicoes?.length || 0} edição(ões)
                    </span>
                    {evento.arquivado && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        Arquivado
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition">
                    {evento.nome}
                  </h3>

                  {evento.descricao && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {evento.descricao}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  {ultimaEdicao ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Última edição:</span>
                        <strong className="text-slate-700">{ultimaEdicao.identificacao}</strong>
                      </div>
                      <div className="text-xs text-slate-500">
                        Período: {ultimaEdicao.data_inicio} até {ultimaEdicao.data_fim}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Sem edições registradas</div>
                  )}

                  <div className="mt-4 flex items-center justify-end text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition">
                    <span>Ver detalhes do evento</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal Novo Evento */}
      <ModalNovoEvento
        aberto={modalNovoEventoAberto}
        onClose={() => setModalNovoEventoAberto(false)}
        onSuccess={() => {
          setModalNovoEventoAberto(false);
          carregarEventos();
        }}
      />
    </div>
  );
}
