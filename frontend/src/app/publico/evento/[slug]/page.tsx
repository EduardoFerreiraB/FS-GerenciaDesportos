'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { 
  Trophy, 
  ArrowLeft, 
  Loader2, 
  AlertTriangle, 
  Sun, 
  Moon, 
  Layers, 
  ExternalLink,
  RotateCw
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { competicoesV2Service } from '@/services/competicoesV2';
import HeaderEventoPublico from '@/components/publico-v2/HeaderEventoPublico';
import CompeticaoPublicaView from '@/components/publico-v2/CompeticaoPublicaView';
import { GrupoCompeticoes, CompeticaoV2 } from '@/types/competicoesV2';

export default function PortalPublicoEventoPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const { theme, toggleTheme } = useTheme();

  // Buscar dados públicos do grupo/evento agregador
  const {
    data: grupo,
    error,
    isLoading,
    mutate,
  } = useSWR<GrupoCompeticoes>(
    slug ? ['publico-grupo', slug] : null,
    () => competicoesV2Service.obterGrupoPublico(slug),
    { revalidateOnFocus: true }
  );

  // Competição ativa selecionada pelo usuário
  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);

  // Lista de competições públicas válidas
  const competicoes: CompeticaoV2[] = useMemo(() => {
    if (!grupo?.competicoes || !Array.isArray(grupo.competicoes)) return [];
    return grupo.competicoes;
  }, [grupo]);

  // Competição ativa derivada sem efeito colateral
  const activeCompeticao = useMemo(() => {
    if (competicoes.length === 0) return null;
    if (selectedCompId !== null) {
      const encontrada = competicoes.find((c) => c.id_competicao === selectedCompId);
      if (encontrada) return encontrada;
    }
    return competicoes[0] || null;
  }, [competicoes, selectedCompId]);

  const activeCompId = activeCompeticao?.id_competicao || null;

  // Checagem de jogos ao vivo para alimentar o badge pulsante no Header
  const { data: jogosAtivos } = useSWR(
    activeCompId ? ['publico-jogos-header', activeCompId] : null,
    () => competicoesV2Service.obterJogosPublicos(activeCompId!),
    { refreshInterval: 15000 }
  );

  const temJogosAoVivo = useMemo(() => {
    if (!jogosAtivos || !Array.isArray(jogosAtivos)) return false;
    return jogosAtivos.some((j: { status?: string }) => j.status === 'Em Andamento');
  }, [jogosAtivos]);

  // Estado de Carregamento
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center p-6 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-blue-600/10 dark:bg-blue-500/10 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={36} />
          </div>
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Carregando portal esportivo...
          </h2>
          <p className="text-xs text-slate-400">
            Buscando competições, chaves e placares ao vivo.
          </p>
        </div>
      </div>
    );
  }

  // Estado de Não Encontrado (404) ou Erro
  if (error || !grupo) {
    const is404 = (error as { response?: { status?: number } })?.response?.status === 404;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/60 p-8 shadow-xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-800 dark:text-white">
              {is404 ? 'Evento não encontrado' : 'Falha ao carregar evento'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {is404
                ? `O evento com identificador "${slug}" não existe ou ainda não foi disponibilizado publicamente.`
                : 'Ocorreu um erro ao consultar as informações do evento. Verifique sua conexão e tente novamente.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => router.push('/')}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              Voltar ao Início
            </button>
            {!is404 && (
              <button
                onClick={() => mutate()}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCw size={14} />
                Tentar Novamente
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Barra de Navegação Pública Superior */}
      <nav className="bg-white/80 dark:bg-slate-850/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/50 sticky top-0 z-30 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"
            title="Página Inicial"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-md shadow-blue-500/20">
              GE
            </div>
            <div>
              <p className="font-extrabold text-xs text-slate-800 dark:text-white leading-tight">
                Gerencia Esporte
              </p>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Portal Público
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Alternador de Tema Escuro / Claro */}
          <button
            onClick={toggleTheme}
            type="button"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            title="Alternar Tema"
          >
            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
          </button>

          {/* Link para Área Administrativa */}
          <Link href="/login">
            <button
              type="button"
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 sm:px-4 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Área Restrita</span>
              <ExternalLink size={12} className="opacity-60" />
            </button>
          </Link>
        </div>
      </nav>

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 animate-in fade-in duration-300">
        {/* Banner Oficial do Evento Agregador */}
        <HeaderEventoPublico grupo={grupo} temJogosAoVivo={temJogosAoVivo} />

        {/* Barra de Abas Horizontais com as Competições Vinculadas */}
        {competicoes.length > 0 ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-blue-600" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Selecione a Modalidade / Categoria
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {competicoes.length} {competicoes.length === 1 ? 'competição' : 'competições'}
                </span>
              </div>

              {/* Lista com Rolagem Horizontal Suave */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                {competicoes.map((comp) => {
                  const isSelected = comp.id_competicao === activeCompeticao?.id_competicao;
                  const modalidadeNome = comp.modalidade?.nome || comp.categoria;

                  return (
                    <button
                      key={comp.id_competicao}
                      onClick={() => setSelectedCompId(comp.id_competicao)}
                      type="button"
                      className={`group relative shrink-0 px-5 py-3 rounded-2xl text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 scale-[1.02]'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black tracking-tight truncate max-w-[200px]">
                          {comp.nome}
                        </span>
                      </div>

                      {modalidadeNome && (
                        <p className={`text-[11px] font-semibold mt-0.5 truncate ${
                          isSelected ? 'text-blue-100' : 'text-slate-400'
                        }`}>
                          {modalidadeNome}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Painel da Competição Selecionada */}
            {activeCompeticao ? (
              <CompeticaoPublicaView
                key={activeCompeticao.id_competicao}
                idCompeticao={activeCompeticao.id_competicao}
                nomeCompeticao={activeCompeticao.nome}
                formato={activeCompeticao.formato}
              />
            ) : (
              <div className="p-16 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-150 dark:border-slate-700/60">
                <p className="text-sm text-slate-400 font-semibold">
                  Selecione uma competição acima para visualizar jogos, classificação e artilharia.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-20 px-6 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 space-y-4">
            <Trophy size={48} className="mx-auto text-slate-300 dark:text-slate-600" />
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
                Nenhuma competição pública disponível
              </h3>
              <p className="text-xs text-slate-400">
                Este evento agregador ainda não possui competições publicadas. Assim que forem ativadas pela comissão organizadora, elas ficarão visíveis aqui.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé do Portal Público */}
      <footer className="mt-16 border-t border-slate-200/80 dark:border-slate-800 py-8 px-6 text-center text-xs text-slate-400 space-y-2">
        <p className="font-semibold text-slate-600 dark:text-slate-400">
          {grupo.nome} • Gerência de Desportos
        </p>
        <p className="text-[11px] text-slate-400">
          Dados esportivos atualizados em tempo real conforme as súmulas oficiais. Conforme LGPD, dados sensíveis de atletas são protegidos.
        </p>
      </footer>
    </div>
  );
}
