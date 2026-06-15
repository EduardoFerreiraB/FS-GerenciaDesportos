'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Trophy, Search, Loader2, AlertTriangle, LogIn, Dumbbell, ShieldCheck, Sun, Moon } from 'lucide-react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function PortalPublicoPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: eventos, error, isLoading } = useSWR('/publico/eventos', fetcher);
  const { theme, toggleTheme } = useTheme();

  const filteredEventos = eventos?.filter((e: any) =>
    e.even_nome.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 sticky top-0 z-15 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-200 dark:shadow-none">
            GE
          </div>
          <div>
            <h1 className="font-bold text-slate-850 dark:text-slate-100 text-lg leading-none">Portal Esportivo</h1>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Acompanhe as competições</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            title="Alterar Tema"
          >
            {theme === 'dark' ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} />}
          </button>

          <Link href="/login">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-100 dark:shadow-none active:scale-95 cursor-pointer">
              <LogIn size={14} />
              Área Restrita
            </button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-12 text-center space-y-4 animate-in fade-in duration-300">
        <h2 className="text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
          Acompanhe Seus <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Campeonatos Favoritos</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
          Veja tabelas de classificação, chaves de mata-mata, confrontos em tempo real, resultados e estatísticas de atletas.
        </p>
      </section>

      {/* Search and Grid */}
      <main className="max-w-6xl mx-auto px-6 pb-20 space-y-8">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 max-w-md mx-auto">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={20} />
            </span>
            <input
              type="text"
              placeholder="Buscar campeonato pelo nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-700 dark:text-slate-250 text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={40} className="animate-spin mb-4 text-blue-600" />
            <p>Carregando competições disponíveis...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-500">
            <AlertTriangle size={40} className="mb-4" />
            <p>Erro ao conectar ao servidor de competições.</p>
          </div>
        ) : filteredEventos.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 max-w-md mx-auto">
            <Trophy size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum evento ativo encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEventos.map((evento: any) => (
              <div
                key={evento.id_evento}
                className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden hover:shadow-md dark:hover:border-slate-600 transition-all group flex flex-col"
              >
                <div className="p-6 flex-1 space-y-4">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1 group-hover:text-blue-600 transition-colors">
                      {evento.even_nome}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                      {evento.descricao || 'Sem descrição adicional.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {evento.modalidades?.map((m: any) => (
                      <span
                        key={m.id_modalidade}
                        className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1"
                      >
                        <Dumbbell size={10} />
                        {m.nome}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t border-slate-50 dark:border-slate-700/40 bg-slate-50/30 dark:bg-slate-800/10">
                  <Link href={`/eventos-publico/${evento.id_evento}`}>
                    <button className="w-full py-3 bg-white dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-98">
                      <Trophy size={16} />
                      Acompanhar Competição
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-150 dark:border-slate-800 py-8 text-center text-xs text-slate-400">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ShieldCheck size={14} className="text-blue-500" />
          <span>Portal Público - Dados protegidos segundo as normas de privacidade</span>
        </div>
        <p>© 2026 Gerencia Esporte. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}