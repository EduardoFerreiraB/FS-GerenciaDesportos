'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Shield, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  UserPlus, 
  Search, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  Hash,
  FileText
} from 'lucide-react';
import { competicoesV2Service } from '@/services/competicoesV2';
import { EquipeV2, JogadorV2 } from '@/types/competicoesV2';
import { useNotification } from '@/context/NotificationContext';

interface GestaoEquipesElencosProps {
  idCompeticao: number;
  formato?: string;
  onEquipesAtualizadas?: () => void;
}

const POSICOES_PADRAO = [
  'Goleiro',
  'Zagueiro',
  'Lateral',
  'Volante',
  'Meia',
  'Atacante',
  'Pivô',
  'Fixo',
  'Ala',
  'Levantador',
  'Líbero',
  'Oposto',
  'Central',
  'Outro',
];

export default function GestaoEquipesElencos({
  idCompeticao,
  formato,
  onEquipesAtualizadas,
}: GestaoEquipesElencosProps) {
  const { toast, confirm } = useNotification();

  const [equipes, setEquipes] = useState<EquipeV2[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  
  // Controle de accordion (equipes abertas)
  const [equipesAbertas, setEquipesAbertas] = useState<Record<number, boolean>>({});
  
  // Jogadores carregados por equipe: id_equipe -> JogadorV2[]
  const [jogadoresPorEquipe, setJogadoresPorEquipe] = useState<Record<number, JogadorV2[]>>({});
  const [carregandoJogadores, setCarregandoJogadores] = useState<Record<number, boolean>>({});

  // Modal Nova Equipe
  const [modalEquipeAberto, setModalEquipeAberto] = useState(false);
  const [nomeNovaEquipe, setNomeNovaEquipe] = useState('');
  const [grupoNovaEquipe, setGrupoNovaEquipe] = useState('');
  const [salvandoEquipe, setSalvandoEquipe] = useState(false);

  // Form de Novo Jogador por equipe: id_equipe -> FormState
  const [formNovoJogador, setFormNovoJogador] = useState<
    Record<
      number,
      {
        aberto: boolean;
        nome: string;
        numero_camisa: string;
        posicao: string;
        documento: string;
        salvando: boolean;
      }
    >
  >({});

  // Carrega lista de equipes
  const carregarEquipes = useCallback(async () => {
    if (!idCompeticao) return;
    setCarregando(true);
    try {
      const data = await competicoesV2Service.listarEquipes(idCompeticao);
      setEquipes(data || []);

      // Se equipes já vierem com jogadores, inicializa cache
      const initialJogadores: Record<number, JogadorV2[]> = {};
      data.forEach((eq) => {
        if (eq.jogadores && Array.isArray(eq.jogadores)) {
          initialJogadores[eq.id_equipe] = eq.jogadores;
        }
      });
      if (Object.keys(initialJogadores).length > 0) {
        setJogadoresPorEquipe((prev) => ({ ...prev, ...initialJogadores }));
      }
    } catch (error) {
      toast('Erro ao carregar equipes da competição.', 'error');
    } finally {
      setCarregando(false);
    }
  }, [idCompeticao, toast]);

  useEffect(() => {
    carregarEquipes();
  }, [carregarEquipes]);

  // Carrega jogadores de uma equipe específica
  const carregarJogadoresEquipe = async (idEquipe: number) => {
    setCarregandoJogadores((prev) => ({ ...prev, [idEquipe]: true }));
    try {
      const lista = await competicoesV2Service.listarJogadores(idEquipe);
      setJogadoresPorEquipe((prev) => ({ ...prev, [idEquipe]: lista || [] }));
    } catch (error) {
      toast('Não foi possível carregar os jogadores desta equipe.', 'error');
    } finally {
      setCarregandoJogadores((prev) => ({ ...prev, [idEquipe]: false }));
    }
  };

  // Alterna accordion da equipe
  const toggleEquipe = (idEquipe: number) => {
    const estaAberta = !!equipesAbertas[idEquipe];
    setEquipesAbertas((prev) => ({ ...prev, [idEquipe]: !estaAberta }));

    // Se está abrindo e ainda não tem lista de jogadores ou quer atualizar, busca da API
    if (!estaAberta) {
      carregarJogadoresEquipe(idEquipe);
    }
  };

  // Cadastrar nova equipe
  const handleCriarEquipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovaEquipe.trim()) {
      toast('Informe o nome da equipe.', 'warning');
      return;
    }

    setSalvandoEquipe(true);
    try {
      const payload = {
        nome: nomeNovaEquipe.trim(),
        grupo: grupoNovaEquipe.trim() ? grupoNovaEquipe.trim().toUpperCase() : undefined,
      };
      await competicoesV2Service.criarEquipe(idCompeticao, payload);
      toast('Equipe cadastrada com sucesso!', 'success');
      setNomeNovaEquipe('');
      setGrupoNovaEquipe('');
      setModalEquipeAberto(false);
      await carregarEquipes();
      if (onEquipesAtualizadas) onEquipesAtualizadas();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Erro ao cadastrar equipe.';
      toast(typeof msg === 'string' ? msg : 'Erro ao cadastrar equipe.', 'error');
    } finally {
      setSalvandoEquipe(false);
    }
  };

  // Adicionar jogador à equipe
  const handleAdicionarJogador = async (idEquipe: number, e: React.FormEvent) => {
    e.preventDefault();
    const form = formNovoJogador[idEquipe];
    if (!form || !form.nome.trim()) {
      toast('Informe o nome completo do jogador.', 'warning');
      return;
    }

    setFormNovoJogador((prev) => ({
      ...prev,
      [idEquipe]: { ...prev[idEquipe], salvando: true },
    }));

    try {
      await competicoesV2Service.adicionarJogador(idEquipe, {
        nome: form.nome.trim(),
        numero_camisa: form.numero_camisa ? Number(form.numero_camisa) : null,
        posicao: form.posicao || null,
        documento: form.documento.trim() || null,
        ativo: true,
      });

      toast('Jogador adicionado ao elenco com sucesso!', 'success');

      // Limpa formulário daquela equipe mantendo aberto
      setFormNovoJogador((prev) => ({
        ...prev,
        [idEquipe]: {
          aberto: true,
          nome: '',
          numero_camisa: '',
          posicao: 'Atacante',
          documento: '',
          salvando: false,
        },
      }));

      // Recarrega jogadores da equipe
      await carregarJogadoresEquipe(idEquipe);
      if (onEquipesAtualizadas) onEquipesAtualizadas();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Erro ao adicionar jogador.';
      toast(typeof msg === 'string' ? msg : 'Erro ao adicionar jogador.', 'error');
      setFormNovoJogador((prev) => ({
        ...prev,
        [idEquipe]: { ...prev[idEquipe], salvando: false },
      }));
    }
  };

  // Remover jogador
  const handleRemoverJogador = (idEquipe: number, idJogador: number, nomeJogador: string) => {
    confirm({
      title: 'Excluir Jogador',
      message: `Tem certeza que deseja remover "${nomeJogador}" desta equipe? O registro será excluído permanentemente.`,
      confirmText: 'Remover Atleta',
      onConfirm: async () => {
        try {
          await competicoesV2Service.removerJogador(idJogador);
          toast('Jogador removido com sucesso!', 'success');
          await carregarJogadoresEquipe(idEquipe);
          if (onEquipesAtualizadas) onEquipesAtualizadas();
        } catch (error: any) {
          const msg = error.response?.data?.detail || 'Erro ao remover jogador.';
          toast(typeof msg === 'string' ? msg : 'Erro ao remover jogador.', 'error');
        }
      },
    });
  };

  // Filtro de equipes na tela
  const equipesFiltradas = equipes.filter((eq) => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return true;
    const bateNome = eq.nome.toLowerCase().includes(termo);
    const bateGrupo = eq.grupo ? eq.grupo.toLowerCase().includes(termo) : false;
    return bateNome || bateGrupo;
  });

  // Estilo por posição
  const getBadgePosicaoColor = (posicao?: string | null) => {
    if (!posicao) return 'bg-slate-100 text-slate-700 border-slate-200';
    const p = posicao.toLowerCase();
    if (p.includes('goleiro')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (p.includes('zagueiro')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (p.includes('lateral')) return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (p.includes('volante')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (p.includes('meia')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (p.includes('atacante') || p.includes('pivô')) return 'bg-rose-100 text-rose-800 border-rose-200';
    return 'bg-purple-100 text-purple-800 border-purple-200';
  };

  return (
    <div className="space-y-6">
      {/* Barra de Ações Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-amber-500" size={24} />
            Equipes & Elencos ({equipes.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastre as equipes participantes e gerencie os atletas inscritos no elenco de cada uma.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalEquipeAberto(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-amber-100 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            + Nova Equipe
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 max-w-md">
        <Search size={18} className="text-slate-400 ml-2 shrink-0" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar equipe pelo nome ou grupo..."
          className="w-full text-xs font-medium text-slate-700 outline-none bg-transparent"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full text-xs"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lista de Equipes */}
      {carregando ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-400">
          <Loader2 size={36} className="animate-spin text-amber-500" />
          <p className="text-sm font-medium">Carregando equipes inscritas...</p>
        </div>
      ) : equipesFiltradas.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-10 text-center space-y-3">
          <Users size={40} className="mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">Nenhuma equipe encontrada</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {busca
              ? 'Nenhuma equipe corresponde ao termo pesquisado. Tente outra busca.'
              : 'Esta competição ainda não possui equipes cadastradas. Clique em "+ Nova Equipe" para adicionar os participantes.'}
          </p>
          {!busca && (
            <button
              onClick={() => setModalEquipeAberto(true)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors shadow-sm"
            >
              <Plus size={14} />
              Cadastrar Primeira Equipe
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {equipesFiltradas.map((equipe) => {
            const aberta = !!equipesAbertas[equipe.id_equipe];
            const listaJogadores = jogadoresPorEquipe[equipe.id_equipe] || equipe.jogadores || [];
            const carregandoEsta = !!carregandoJogadores[equipe.id_equipe];
            const formJogador = formNovoJogador[equipe.id_equipe] || {
              aberto: false,
              nome: '',
              numero_camisa: '',
              posicao: 'Atacante',
              documento: '',
              salvando: false,
            };

            return (
              <div
                key={equipe.id_equipe}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Cabeçalho do Card da Equipe (Accordion Trigger) */}
                <div
                  onClick={() => toggleEquipe(equipe.id_equipe)}
                  className="p-4 md:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-700 flex items-center justify-center font-black text-sm shrink-0">
                      {equipe.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-800 truncate">
                          {equipe.nome}
                        </h3>
                        {equipe.grupo && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                            {equipe.grupo.startsWith('Grupo') ? equipe.grupo : `Grupo ${equipe.grupo}`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {listaJogadores.length}{' '}
                        {listaJogadores.length === 1 ? 'atleta inscrito' : 'atletas inscritos'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500 hidden sm:inline-block">
                      {aberta ? 'Ocultar Elenco' : 'Gerenciar Elenco'}
                    </span>
                    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                      {aberta ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Conteúdo Expansível: Gestão do Elenco */}
                {aberta && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 md:p-6 space-y-5 animate-in fade-in">
                    {/* Barra de Ações do Elenco */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/70">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Users size={16} className="text-amber-500" />
                          Elenco de Jogadores
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {listaJogadores.length} jogadores cadastrados na equipe {equipe.nome}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setFormNovoJogador((prev) => ({
                            ...prev,
                            [equipe.id_equipe]: {
                              aberto: !formJogador.aberto,
                              nome: formJogador.nome || '',
                              numero_camisa: formJogador.numero_camisa || '',
                              posicao: formJogador.posicao || 'Atacante',
                              documento: formJogador.documento || '',
                              salvando: false,
                            },
                          }))
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          formJogador.aberto
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        }`}
                      >
                        <UserPlus size={14} />
                        {formJogador.aberto ? 'Fechar Formulário' : '+ Adicionar Atleta'}
                      </button>
                    </div>

                    {/* Formulário de Adicionar Jogador (Inline Expansível) */}
                    {formJogador.aberto && (
                      <form
                        onSubmit={(e) => handleAdicionarJogador(equipe.id_equipe, e)}
                        className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-sm space-y-3 animate-in fade-in"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <UserPlus size={14} />
                            Novo Atleta para {equipe.nome}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormNovoJogador((prev) => ({
                                ...prev,
                                [equipe.id_equipe]: { ...formJogador, aberto: false },
                              }))
                            }
                            className="text-slate-400 hover:text-slate-600 text-xs"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-[11px] font-bold text-slate-600">
                              Nome Completo <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Gabriel Barbosa"
                              value={formJogador.nome}
                              onChange={(e) =>
                                setFormNovoJogador((prev) => ({
                                  ...prev,
                                  [equipe.id_equipe]: {
                                    ...formJogador,
                                    nome: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600">
                              Nº Camisa
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              placeholder="Ex: 10"
                              value={formJogador.numero_camisa}
                              onChange={(e) =>
                                setFormNovoJogador((prev) => ({
                                  ...prev,
                                  [equipe.id_equipe]: {
                                    ...formJogador,
                                    numero_camisa: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600">Posição</label>
                            <select
                              value={formJogador.posicao}
                              onChange={(e) =>
                                setFormNovoJogador((prev) => ({
                                  ...prev,
                                  [equipe.id_equipe]: {
                                    ...formJogador,
                                    posicao: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                            >
                              {POSICOES_PADRAO.map((pos) => (
                                <option key={pos} value={pos}>
                                  {pos}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600">
                              Documento / CPF (Opcional)
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: 000.000.000-00 ou RG"
                              value={formJogador.documento}
                              onChange={(e) =>
                                setFormNovoJogador((prev) => ({
                                  ...prev,
                                  [equipe.id_equipe]: {
                                    ...formJogador,
                                    documento: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </div>

                          <div className="flex items-end justify-end">
                            <button
                              type="submit"
                              disabled={formJogador.salvando}
                              className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                            >
                              {formJogador.salvando ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>Salvando...</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={14} />
                                  <span>Salvar no Elenco</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Tabela / Lista de Atletas */}
                    {carregandoEsta ? (
                      <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                        <Loader2 size={18} className="animate-spin text-amber-500" />
                        <span className="text-xs font-medium">Carregando elenco...</span>
                      </div>
                    ) : listaJogadores.length === 0 ? (
                      <div className="bg-white rounded-xl p-8 text-center border border-slate-200/60">
                        <p className="text-xs text-slate-400">
                          Nenhum atleta inscrito nesta equipe ainda.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                                <th className="py-2.5 px-3 w-14 text-center">Nº</th>
                                <th className="py-2.5 px-4">Nome do Atleta</th>
                                <th className="py-2.5 px-4">Posição</th>
                                <th className="py-2.5 px-4">Documento</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                                <th className="py-2.5 px-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {listaJogadores.map((jogador) => (
                                <tr
                                  key={jogador.id_jogador}
                                  className="hover:bg-slate-50/80 transition-colors"
                                >
                                  {/* Número da Camisa */}
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200">
                                      {jogador.numero_camisa != null ? jogador.numero_camisa : '-'}
                                    </span>
                                  </td>

                                  {/* Nome */}
                                  <td className="py-2.5 px-4 font-bold text-slate-800">
                                    {jogador.nome}
                                  </td>

                                  {/* Posição */}
                                  <td className="py-2.5 px-4">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgePosicaoColor(
                                        jogador.posicao
                                      )}`}
                                    >
                                      {jogador.posicao || 'Não definida'}
                                    </span>
                                  </td>

                                  {/* Documento */}
                                  <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                                    {jogador.documento || '-'}
                                  </td>

                                  {/* Status */}
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        jogador.ativo
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          jogador.ativo ? 'bg-emerald-500' : 'bg-slate-400'
                                        }`}
                                      />
                                      {jogador.ativo ? 'Ativo' : 'Inativo'}
                                    </span>
                                  </td>

                                  {/* Ações */}
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoverJogador(
                                          equipe.id_equipe,
                                          jogador.id_jogador,
                                          jogador.nome
                                        )
                                      }
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Remover jogador do elenco"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Cadastro de Equipe */}
      {modalEquipeAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-8 border border-slate-100 relative animate-in zoom-in-95">
            <button
              onClick={() => setModalEquipeAberto(false)}
              disabled={salvandoEquipe}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-6 flex items-start gap-3.5">
              <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                <Shield size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Nova Equipe</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cadastre uma equipe participante nesta competição.
                </p>
              </div>
            </div>

            <form onSubmit={handleCriarEquipe} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Nome da Equipe <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Real Esporte Clube"
                  value={nomeNovaEquipe}
                  onChange={(e) => setNomeNovaEquipe(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>

              {formato === 'GRUPOS_MATA_MATA' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Grupo de Alocação
                  </label>
                  <select
                    value={grupoNovaEquipe}
                    onChange={(e) => setGrupoNovaEquipe(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer transition-all"
                  >
                    <option value="">Distribuição Automática / A definir</option>
                    <option value="A">Grupo A</option>
                    <option value="B">Grupo B</option>
                    <option value="C">Grupo C</option>
                    <option value="D">Grupo D</option>
                    <option value="E">Grupo E</option>
                    <option value="F">Grupo F</option>
                    <option value="G">Grupo G</option>
                    <option value="H">Grupo H</option>
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Se não informado, as equipes poderão ser distribuídas automaticamente ao gerar os confrontos.
                  </p>
                </div>
              )}

              {formato !== 'GRUPOS_MATA_MATA' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Chave / Identificador (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Chave 1, Grupo Geral"
                    value={grupoNovaEquipe}
                    onChange={(e) => setGrupoNovaEquipe(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEquipeAberto(false)}
                  disabled={salvandoEquipe}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoEquipe}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-lg shadow-amber-100 text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  {salvandoEquipe ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <span>Cadastrar Equipe</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
