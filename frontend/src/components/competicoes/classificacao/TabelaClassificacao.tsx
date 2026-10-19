'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  obterClassificacao,
  listarDecisoesClassificacao,
  registrarDecisaoClassificacao,
  isErroApi,
} from '@/services/competicoes';
import type {
  TabelaClassificacaoDetalhe,
  GrupoClassificacaoDetalhe,
  LinhaClassificacao,
  DecisaoClassificacaoDetalhe,
  DecisaoClassificacaoCriar,
} from '@/types/competicoes';
import {
  Trophy,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Info,
  Medal,
  Users,
  Scale,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  X,
  History,
  AlertCircle,
} from 'lucide-react';

interface TabelaClassificacaoProps {
  idEdicaoCompeticao: number;
  formato?: string;
}

export default function TabelaClassificacao({
  idEdicaoCompeticao,
  formato,
}: TabelaClassificacaoProps) {
  const [classificacao, setClassificacao] = useState<TabelaClassificacaoDetalhe | null>(null);
  const [decisoes, setDecisoes] = useState<DecisaoClassificacaoDetalhe[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Estado do Modal de Resolução Manual de Empate
  const [modalDesempateAberto, setModalDesempateAberto] = useState<boolean>(false);
  const [grupoDesempateId, setGrupoDesempateId] = useState<number | null>(null);
  const [equipesDesempate, setEquipesDesempate] = useState<LinhaClassificacao[]>([]);
  const [motivoDesempate, setMotivoDesempate] = useState<string>('');
  const [salvandoDesempate, setSalvandoDesempate] = useState<boolean>(false);
  const [erroDesempate, setErroDesempate] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    if (formato === 'MATA_MATA') {
      setCarregando(false);
      return;
    }
    try {
      setCarregando(true);
      setErro(null);

      const [classifRes, decisoesRes] = await Promise.all([
        obterClassificacao(idEdicaoCompeticao),
        listarDecisoesClassificacao(idEdicaoCompeticao).catch(() => [] as DecisaoClassificacaoDetalhe[]),
      ]);

      setClassificacao(classifRes);
      setDecisoes(decisoesRes || []);
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else if (err instanceof Error) {
        setErro(err.message);
      } else {
        setErro('Falha ao carregar a tabela de classificação.');
      }
    } finally {
      setCarregando(false);
    }
  }, [idEdicaoCompeticao]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Mapa de Nomes das Equipes para exibir nas decisões
  const mapaNomesEquipes = useMemo(() => {
    const map = new Map<number, string>();
    if (classificacao?.linhas) {
      classificacao.linhas.forEach((l) => map.set(l.id_equipe, l.nome_equipe));
    }
    if (classificacao?.grupos) {
      classificacao.grupos.forEach((g) => {
        g.linhas.forEach((l) => map.set(l.id_equipe, l.nome_equipe));
      });
    }
    return map;
  }, [classificacao]);

  const temGrupos = Boolean(classificacao?.grupos && classificacao.grupos.length > 0);
  const temLinhas = Boolean(classificacao?.linhas && classificacao.linhas.length > 0);
  const possuiEmpatePersistente = Boolean(
    classificacao?.possui_empate_persistente ||
      classificacao?.grupos?.some((g) => g.possui_empate_persistente)
  );

  // Inicializa a lista de equipes para desempate
  const inicializarDesempate = useCallback(
    (idGrupo: number | null, classif: TabelaClassificacaoDetalhe | null) => {
      let linhasAlvo: LinhaClassificacao[] = [];

      if (idGrupo !== null && classif?.grupos) {
        const grupo = classif.grupos.find((g) => g.id_grupo === idGrupo);
        linhasAlvo = grupo?.linhas || [];
      } else if (classif?.linhas) {
        linhasAlvo = classif.linhas;
      }

      // Filtrar equipes empatadas; se não houver flag explícita, usa todas do escopo
      const empatadas = linhasAlvo.filter((l) => l.empate_persistente);
      const listaFinal = empatadas.length >= 2 ? empatadas : linhasAlvo;

      setGrupoDesempateId(idGrupo);
      setEquipesDesempate([...listaFinal]);
      setMotivoDesempate('');
      setErroDesempate(null);
    },
    []
  );

  // Handler: Abrir modal de desempate manual
  const handleAbrirModalDesempate = () => {
    if (temGrupos && classificacao?.grupos) {
      const grupoComEmpate =
        classificacao.grupos.find((g) => g.possui_empate_persistente) ||
        classificacao.grupos[0];
      inicializarDesempate(grupoComEmpate ? grupoComEmpate.id_grupo : null, classificacao);
    } else {
      inicializarDesempate(null, classificacao);
    }
    setModalDesempateAberto(true);
  };

  // Handler: Troca de grupo no modal de desempate
  const handleTrocarGrupoDesempate = (idGrupo: number) => {
    inicializarDesempate(idGrupo, classificacao);
  };

  // Handler: Mover equipe para cima ou para baixo
  const handleMoverEquipe = (index: number, direcao: 'cima' | 'baixo') => {
    const novoIndex = direcao === 'cima' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= equipesDesempate.length) return;

    const novaLista = [...equipesDesempate];
    const [removido] = novaLista.splice(index, 1);
    novaLista.splice(novoIndex, 0, removido);
    setEquipesDesempate(novaLista);
  };

  // Handler: Salvar Decisão Manual de Desempate
  const handleSalvarDesempate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroDesempate(null);

    if (motivoDesempate.trim().length < 3) {
      setErroDesempate('Informe uma justificativa com no mínimo 3 caracteres.');
      return;
    }

    if (equipesDesempate.length < 2) {
      setErroDesempate('É necessário ter ao menos duas equipes para registrar um desempate.');
      return;
    }

    try {
      setSalvandoDesempate(true);

      const dados: DecisaoClassificacaoCriar = {
        id_grupo: grupoDesempateId,
        conjunto_equipes: equipesDesempate.map((eq) => eq.id_equipe),
        ordem_escolhida: equipesDesempate.map((eq) => eq.id_equipe),
        motivo: motivoDesempate.trim(),
      };

      await registrarDecisaoClassificacao(idEdicaoCompeticao, dados);
      setModalDesempateAberto(false);
      setSucesso('Decisão manual de desempate registrada com sucesso! A classificação foi recalculada.');
      await carregarDados();
    } catch (err: unknown) {
      if (isErroApi(err)) {
        setErroDesempate(err.mensagem);
      } else if (err instanceof Error) {
        setErroDesempate(err.message);
      } else {
        setErroDesempate('Erro ao registrar decisão de desempate.');
      }
    } finally {
      setSalvandoDesempate(false);
    }
  };

  // Caso 1: Formato puramente MATA_MATA (eliminatório direto)
  if (formato === 'MATA_MATA') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto py-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">
            Competição em Formato Mata-Mata
          </h3>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Competições exclusivamente eliminatórias não possuem tabela de classificação pontuada ou
            fase de pontos corridos. O avanço das equipes e a definição dos campeões ocorrem diretamente
            através do chaveamento de duelos.
          </p>
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="text-left">
              Acesse a aba <strong>Jogos & Súmula</strong> para acompanhar a árvore de confrontos,
              agendamentos e resultados de cada fase eliminatória.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Estado de carregamento
  if (carregando && !classificacao) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Carregando classificação esportiva...</p>
      </div>
    );
  }

  // Estado de erro crítico inicial
  if (erro && !classificacao) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <div>
          <h4 className="font-bold text-red-800">Erro ao carregar classificação</h4>
          <p className="text-sm text-red-600 mt-1">{erro}</p>
        </div>
        <button
          type="button"
          onClick={carregarDados}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerta de Sucesso / Feedback */}
      {sucesso && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{sucesso}</span>
          </div>
          <button
            type="button"
            onClick={() => setSucesso(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1 rounded-md"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cabeçalho da Seção com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Tabela de Classificação</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe a pontuação, estatísticas de jogos e zonas de classificação das equipes.
          </p>
        </div>

        <button
          type="button"
          onClick={carregarDados}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          title="Atualizar tabela de classificação"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Banner de Empate Persistente */}
      {possuiEmpatePersistente && (
        <div
          role="alert"
          aria-label="Aviso de empates persistentes"
          className="p-4 bg-amber-50 border-l-4 border-amber-500 border-y border-r border-amber-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-amber-900"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-amber-800 text-sm">
                Critérios de Desempate Empatados
              </p>
              <p className="text-amber-700 leading-relaxed">
                Atenção: existem empates pontuais que não puderam ser desempáticos pelos critérios técnicos do regulamento. Uma resolução manual ou sorteio pode ser necessária.
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="btn-resolver-empate"
            onClick={handleAbrirModalDesempate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow-xs shrink-0 self-start md:self-auto"
          >
            <Scale size={15} />
            <span>Resolver Empate Manualmente</span>
          </button>
        </div>
      )}

      {/* Exibição por Grupos (GRUPOS_MATA_MATA) */}
      {temGrupos && classificacao?.grupos && (
        <div className="space-y-8">
          {classificacao.grupos.map((grupo) => (
            <TabelaGrupoCard
              key={grupo.id_grupo}
              grupo={grupo}
              limiteClassificacao={2}
            />
          ))}
        </div>
      )}

      {/* Exibição Geral de Pontos Corridos (PONTOS_CORRIDOS) */}
      {!temGrupos && temLinhas && classificacao?.linhas && (
        <TabelaGeralCard
          linhas={classificacao.linhas}
          limiteClassificacao={4}
          possuiEmpatePersistente={classificacao.possui_empate_persistente}
        />
      )}

      {/* Estado vazio quando não há grupos nem linhas computadas */}
      {!temGrupos && !temLinhas && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="font-bold text-slate-700">Classificação ainda não disponível</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Nenhuma pontuação foi registrada ainda. As posições serão calculadas automaticamente
            conforme os resultados das partidas forem lançados.
          </p>
        </div>
      )}

      {/* Histórico de Decisões Manuais de Desempate */}
      {decisoes.length > 0 && (
        <div
          data-testid="lista-decisoes-classificacao"
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-slate-800 text-sm">
                Decisões Manuais de Classificação Registradas ({decisoes.length})
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">
              Registros com auditoria de integridade
            </span>
          </div>

          <div className="space-y-2.5">
            {decisoes.map((dec) => {
              const grupoNome =
                dec.id_grupo != null && classificacao?.grupos
                  ? classificacao.grupos.find((g) => g.id_grupo === dec.id_grupo)?.nome ||
                    `Grupo ${dec.id_grupo}`
                  : 'Classificação Geral';

              return (
                <div
                  key={dec.id_decisao}
                  data-testid={`item-decisao-${dec.id_decisao}`}
                  className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">
                        {grupoNome}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 text-[11px]">
                        Decisão #{dec.id_decisao}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        dec.valida
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {dec.valida ? 'Válida' : 'Invalidada por alteração de resultados'}
                    </span>
                  </div>

                  {/* Ordem Escolhida */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="font-semibold text-slate-600 text-[11px]">Ordem definida:</span>
                    {dec.ordem_escolhida.map((idEq, idx) => {
                      const nome = mapaNomesEquipes.get(idEq) || `Equipe #${idEq}`;
                      return (
                        <span
                          key={idEq}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 text-[11px] font-medium"
                        >
                          <span className="font-bold text-slate-900">{idx + 1}º</span>
                          <span>{nome}</span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Justificativa / Motivo */}
                  <p className="text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100 text-[11px]">
                    <strong className="not-italic text-slate-700">Motivo:</strong> {dec.motivo}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda dos Critérios */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-slate-700">Legenda:</span>
          <span><strong>PTS</strong>: Pontos</span>
          <span><strong>J</strong>: Jogos</span>
          <span><strong>V</strong>: Vitórias</span>
          <span><strong>E</strong>: Empates</span>
          <span><strong>D</strong>: Derrotas</span>
          <span><strong>GP</strong>: Gols Pró</span>
          <span><strong>GC</strong>: Gols Contra</span>
          <span><strong>SG</strong>: Saldo de Gols</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shrink-0" />
          <span>Equipes na zona verde avançam para a fase eliminatória / classificação direta.</span>
        </div>
      </div>

      {/* Modal de Resolução Manual de Empate */}
      {modalDesempateAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-desempate-titulo"
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-5 animate-in zoom-in-95 max-h-[92vh] flex flex-col"
          >
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 shrink-0">
                  <Scale size={22} />
                </div>
                <div>
                  <h3 id="modal-desempate-titulo" className="text-base font-bold text-slate-800">
                    Resolver Empate Manualmente
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina a ordem oficial de classificação com justificativa
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="btn-fechar-modal-desempate"
                onClick={() => setModalDesempateAberto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo com rolagem se necessário */}
            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              {/* Mensagem de Erro */}
              {erroDesempate && (
                <div
                  data-testid="alerta-erro-desempate"
                  className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-medium flex items-start gap-2 animate-in fade-in"
                >
                  <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
                  <span>{erroDesempate}</span>
                </div>
              )}

              {/* Seletor de Grupo (se houver grupos) */}
              {temGrupos && classificacao?.grupos && (
                <div>
                  <label
                    htmlFor="select-grupo-desempate"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Selecione o Grupo com Empate *
                  </label>
                  <select
                    id="select-grupo-desempate"
                    data-testid="select-grupo-desempate"
                    value={grupoDesempateId ?? ''}
                    onChange={(e) => handleTrocarGrupoDesempate(Number(e.target.value))}
                    className="w-full text-xs font-medium px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {classificacao.grupos.map((g) => (
                      <option key={g.id_grupo} value={g.id_grupo}>
                        {g.nome} {g.possui_empate_persistente ? '⚠️ (Empate pendente)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reordenação das Equipes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ordem Final Desejada das Equipes *
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Use os botões para mover as equipes para cima ou para baixo até a ordem desejada.
                </p>

                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                  {equipesDesempate.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-2">
                      Nenhuma equipe encontrada para desempate neste escopo.
                    </p>
                  ) : (
                    equipesDesempate.map((eq, index) => (
                      <div
                        key={eq.id_equipe}
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs">
                            {index + 1}º
                          </span>
                          <span className="font-bold text-slate-800">
                            {eq.nome_equipe}
                          </span>
                          {eq.empate_persistente && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                              Empatada
                            </span>
                          )}
                        </div>

                        {/* Botões Subir / Descer */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            data-testid={`btn-subir-${eq.id_equipe}`}
                            disabled={index === 0 || salvandoDesempate}
                            onClick={() => handleMoverEquipe(index, 'cima')}
                            title="Subir posição"
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            data-testid={`btn-descer-${eq.id_equipe}`}
                            disabled={index === equipesDesempate.length - 1 || salvandoDesempate}
                            onClick={() => handleMoverEquipe(index, 'baixo')}
                            title="Descer posição"
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Justificativa / Motivo */}
              <div>
                <label
                  htmlFor="input-motivo-desempate"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Justificativa / Ata do Desempate * <span className="text-slate-400">(mín. 3 caracteres)</span>
                </label>
                <textarea
                  id="input-motivo-desempate"
                  data-testid="input-motivo-desempate"
                  rows={3}
                  value={motivoDesempate}
                  onChange={(e) => setMotivoDesempate(e.target.value)}
                  placeholder="Ex: Sorteio presencial realizado com os representantes dos clubes conforme item 4.2 do regulamento..."
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
                <div className="flex justify-between items-center mt-1 text-[11px] text-slate-400">
                  <span>{motivoDesempate.trim().length} caractere(s)</span>
                  {motivoDesempate.length > 0 && motivoDesempate.trim().length < 3 && (
                    <span className="text-amber-600 font-medium">Mínimo de 3 caracteres</span>
                  )}
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setModalDesempateAberto(false)}
                disabled={salvandoDesempate}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="btn-salvar-desempate"
                disabled={salvandoDesempate || motivoDesempate.trim().length < 3 || equipesDesempate.length < 2}
                onClick={handleSalvarDesempate}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvandoDesempate ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    <span>Registrar Desempate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Subcomponente: Card e Tabela de um Grupo
// ==========================================

function TabelaGrupoCard({
  grupo,
  limiteClassificacao = 2,
}: {
  grupo: GrupoClassificacaoDetalhe;
  limiteClassificacao?: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <h4 className="font-bold text-slate-800 text-base">{grupo.nome}</h4>
          <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
            {grupo.linhas.length} equipes
          </span>
        </div>

        {grupo.possui_empate_persistente && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Empate nos critérios</span>
          </span>
        )}
      </div>

      <TabelaCorpo linhas={grupo.linhas} limiteClassificacao={limiteClassificacao} />
    </div>
  );
}

// ==========================================
// Subcomponente: Card e Tabela Geral
// ==========================================

function TabelaGeralCard({
  linhas,
  limiteClassificacao = 4,
  possuiEmpatePersistente,
}: {
  linhas: LinhaClassificacao[];
  limiteClassificacao?: number;
  possuiEmpatePersistente?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Medal className="w-4 h-4 text-amber-500" />
          <h4 className="font-bold text-slate-800 text-base">Classificação Geral</h4>
          <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
            {linhas.length} equipes
          </span>
        </div>

        {possuiEmpatePersistente && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Empate nos critérios</span>
          </span>
        )}
      </div>

      <TabelaCorpo linhas={linhas} limiteClassificacao={limiteClassificacao} />
    </div>
  );
}

// ==========================================
// Subcomponente: Corpo da Tabela Responsiva
// ==========================================

function TabelaCorpo({
  linhas,
  limiteClassificacao = 2,
}: {
  linhas: LinhaClassificacao[];
  limiteClassificacao?: number;
}) {
  if (linhas.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Nenhuma equipe pontuada neste grupo.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse" role="table">
        <thead>
          <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
            <th scope="col" className="py-3 px-4 w-14 text-center">
              Pos
            </th>
            <th scope="col" className="py-3 px-4">
              Equipe
            </th>
            <th scope="col" className="py-3 px-3 text-center w-16 bg-blue-50/60 text-blue-900 font-bold">
              PTS
            </th>
            <th scope="col" className="py-3 px-3 text-center w-12" title="Jogos disputados">
              J
            </th>
            <th scope="col" className="py-3 px-3 text-center w-12" title="Vitórias">
              V
            </th>
            <th scope="col" className="py-3 px-3 text-center w-12" title="Empates">
              E
            </th>
            <th scope="col" className="py-3 px-3 text-center w-12" title="Derrotas">
              D
            </th>
            <th scope="col" className="py-3 px-3 text-center w-14" title="Gols Pró">
              GP
            </th>
            <th scope="col" className="py-3 px-3 text-center w-14" title="Gols Contra">
              GC
            </th>
            <th scope="col" className="py-3 px-3 text-center w-14" title="Saldo de Gols">
              SG
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {linhas.map((linha) => {
            const naZona = linha.posicao <= limiteClassificacao;
            const linhaEmpatada = (linha as unknown as { empate_persistente?: boolean }).empate_persistente;

            return (
              <tr
                key={linha.id_equipe}
                className={`transition hover:bg-slate-50/80 ${
                  naZona ? 'bg-emerald-50/20' : ''
                }`}
              >
                {/* Posição */}
                <td className="py-3 px-4 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                        linha.posicao === 1
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : naZona
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {linha.posicao}º
                    </span>
                  </div>
                </td>

                {/* Nome da Equipe */}
                <td className="py-3 px-4 font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 hover:text-blue-600">
                      {linha.nome_equipe}
                    </span>
                    {linhaEmpatada && (
                      <span
                        title="Empate persistente com outra equipe"
                        className="inline-flex items-center text-amber-600"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {naZona && (
                      <span className="hidden sm:inline-block text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                        Zona
                      </span>
                    )}
                  </div>
                </td>

                {/* Pontos */}
                <td className="py-3 px-3 text-center font-bold text-slate-900 bg-blue-50/40 text-base">
                  {linha.pontos}
                </td>

                {/* Jogos */}
                <td className="py-3 px-3 text-center text-slate-600">{linha.jogos}</td>

                {/* Vitórias */}
                <td className="py-3 px-3 text-center font-medium text-emerald-700">
                  {linha.vitorias}
                </td>

                {/* Empates */}
                <td className="py-3 px-3 text-center text-slate-500">{linha.empates}</td>

                {/* Derrotas */}
                <td className="py-3 px-3 text-center text-rose-600">{linha.derrotas}</td>

                {/* Gols Pró */}
                <td className="py-3 px-3 text-center text-slate-600">{linha.gols_pro}</td>

                {/* Gols Contra */}
                <td className="py-3 px-3 text-center text-slate-600">{linha.gols_contra}</td>

                {/* Saldo de Gols */}
                <td
                  className={`py-3 px-3 text-center font-semibold ${
                    linha.saldo_gols > 0
                      ? 'text-emerald-600'
                      : linha.saldo_gols < 0
                      ? 'text-rose-600'
                      : 'text-slate-500'
                  }`}
                >
                  {linha.saldo_gols > 0 ? `+${linha.saldo_gols}` : linha.saldo_gols}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
