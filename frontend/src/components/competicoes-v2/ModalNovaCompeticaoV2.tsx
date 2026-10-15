'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trophy, 
  Calendar, 
  SlidersHorizontal, 
  Loader2, 
  AlertTriangle,
  ListOrdered,
  Layers,
  GitBranch,
  CheckCircle2,
  Users,
  Info
} from 'lucide-react';
import { competicoesV2Service } from '@/services/competicoesV2';
import { modalidadeService } from '@/services';
import { 
  CompeticaoV2, 
  FormatoCompeticao,
  RegrasPontosCorridos,
  RegrasGruposMataMata,
  RegrasMataMata
} from '@/types/competicoesV2';
import { useNotification } from '@/context/NotificationContext';

interface ModalNovaCompeticaoV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (competicao: CompeticaoV2) => void;
  idGrupoPredefinido?: number | null;
}

interface ModalidadeItem {
  id_modalidade: number;
  nome: string;
  tipo?: string;
}

export default function ModalNovaCompeticaoV2({
  isOpen,
  onClose,
  onSuccess,
  idGrupoPredefinido = null,
}: ModalNovaCompeticaoV2Props) {
  const { toast } = useNotification();

  // Opções carregadas da API
  const [modalidades, setModalidades] = useState<ModalidadeItem[]>([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // Estados dos campos principais
  const [nome, setNome] = useState('');
  const [idModalidade, setIdModalidade] = useState<number | ''>('');
  const [categoria, setCategoria] = useState('');
  const [formato, setFormato] = useState<FormatoCompeticao>('PONTOS_CORRIDOS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Regras Pontos Corridos
  const [pcTurnoReturno, setPcTurnoReturno] = useState(false);
  const [pcVitoriaPontos, setPcVitoriaPontos] = useState(3);
  const [pcEmpatePontos, setPcEmpatePontos] = useState(1);
  const [pcDerrotaPontos, setPcDerrotaPontos] = useState(0);
  const [pcCriterios, setPcCriterios] = useState<string[]>([
    'vitorias',
    'saldo_gols',
    'gols_pro',
    'confronto_direto',
  ]);

  // Regras Grupos + Mata-Mata
  const [gmmQtdGrupos, setGmmQtdGrupos] = useState(2);
  const [gmmClassificadosPorGrupo, setGmmClassificadosPorGrupo] = useState(2);
  const [gmmIdaVoltaGrupo, setGmmIdaVoltaGrupo] = useState(false);
  const [gmmIdaVoltaMataMata, setGmmIdaVoltaMataMata] = useState(false);
  const [gmmDisputa3Lugar, setGmmDisputa3Lugar] = useState(false);
  const [gmmPenaltis, setGmmPenaltis] = useState(true);

  // Regras Mata-Mata Direto
  const [mmFaseInicial, setMmFaseInicial] = useState('Quartas');
  const [mmIdaVolta, setMmIdaVolta] = useState(false);
  const [mmDisputa3Lugar, setMmDisputa3Lugar] = useState(false);
  const [mmPenaltis, setMmPenaltis] = useState(true);

  // Carrega modalidades ao abrir modal
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setCarregandoOpcoes(true);
    setErroForm(null);

    modalidadeService.getAll()
      .then((mods) => {
        if (!isMounted) return;
        setModalidades(mods || []);
        if (mods && mods.length > 0 && idModalidade === '') {
          setIdModalidade(mods[0].id_modalidade);
        }
      })
      .catch(() => {
        if (isMounted) setModalidades([]);
      })
      .finally(() => {
        if (isMounted) setCarregandoOpcoes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleCriterio = (criterioKey: string) => {
    if (pcCriterios.includes(criterioKey)) {
      if (pcCriterios.length === 1) {
        toast('Ao menos um critério de desempate deve ser mantido.', 'warning');
        return;
      }
      setPcCriterios(pcCriterios.filter((c) => c !== criterioKey));
    } else {
      setPcCriterios([...pcCriterios, criterioKey]);
    }
  };

  const handleSubmeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm(null);

    if (!nome.trim()) {
      setErroForm('Informe o nome da competição.');
      return;
    }

    if (!idModalidade) {
      setErroForm('Selecione uma modalidade esportiva.');
      return;
    }

    // Monta o payload de regras do formato conforme a escolha
    let regrasFormatoPayload: any = null;

    if (formato === 'PONTOS_CORRIDOS') {
      const regras: RegrasPontosCorridos = {
        turno_e_returno: pcTurnoReturno,
        vitoria_pontos: Number(pcVitoriaPontos),
        empate_pontos: Number(pcEmpatePontos),
        derrota_pontos: Number(pcDerrotaPontos),
        criterios_desempate: pcCriterios,
      };
      regrasFormatoPayload = regras;
    } else if (formato === 'GRUPOS_MATA_MATA') {
      const regras: RegrasGruposMataMata = {
        qtd_grupos: Number(gmmQtdGrupos),
        classificados_por_grupo: Number(gmmClassificadosPorGrupo),
        jogos_ida_volta_grupo: gmmIdaVoltaGrupo,
        jogos_ida_volta_mata_mata: gmmIdaVoltaMataMata,
        disputa_terceiro_lugar: gmmDisputa3Lugar,
        penaltis_desempate: gmmPenaltis,
      };
      regrasFormatoPayload = regras;
    } else if (formato === 'MATA_MATA') {
      const regras: RegrasMataMata = {
        fase_inicial: mmFaseInicial,
        jogos_ida_volta: mmIdaVolta,
        disputa_terceiro_lugar: mmDisputa3Lugar,
        penaltis_desempate: mmPenaltis,
      };
      regrasFormatoPayload = regras;
    }

    const payload = {
      nome: nome.trim(),
      id_modalidade: Number(idModalidade),
      id_grupo: idGrupoPredefinido ?? null,
      categoria: categoria.trim() || null,
      modo_inscricao: 'EQUIPE' as const,
      formato,
      criterio_resultado: 'PONTOS',
      data_inicio: dataInicio ? dataInicio : null,
      data_fim: dataFim ? dataFim : null,
      regras_formato: regrasFormatoPayload,
    };

    setSalvando(true);
    try {
      const novaCompeticao = await competicoesV2Service.criarCompeticao(payload);
      toast('Competição criada com sucesso!', 'success');
      if (onSuccess) {
        onSuccess(novaCompeticao);
      }
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        'Erro ao criar competição. Verifique os campos e tente novamente.';
      setErroForm(typeof msg === 'string' ? msg : JSON.stringify(msg));
      toast('Não foi possível criar a competição.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const listaCriteriosDisponiveis = [
    { key: 'vitorias', label: 'Vitórias (V)' },
    { key: 'saldo_gols', label: 'Saldo de Gols (SG)' },
    { key: 'gols_pro', label: 'Gols Pró (GP)' },
    { key: 'confronto_direto', label: 'Confronto Direto (CD)' },
    { key: 'menos_cartoes', label: 'Menos Pontos Disciplinares (Cartões)' },
    { key: 'menos_vermelhos', label: 'Menos Cartões Vermelhos' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 my-8 border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          disabled={salvando}
          className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Fechar"
        >
          <X size={20} />
        </button>

        {/* Cabeçalho */}
        <div className="mb-6 flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
            <Trophy size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Nova Competição</h2>
            <p className="text-sm text-slate-500">
              Crie uma competição independente ou vincule a um evento agregador.
            </p>
          </div>
        </div>

        {/* Banner de Erro */}
        {erroForm && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start gap-3 text-sm animate-in fade-in">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{erroForm}</div>
          </div>
        )}

        {carregandoOpcoes ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-400">
            <Loader2 className="animate-spin text-amber-500" size={36} />
            <p className="text-sm font-medium">Carregando modalidades e configurações...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmeter} className="space-y-6">
            {/* Bloco 1: Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Informações Básicas
              </h3>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Nome da Competição <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Campeonato Municipal de Futsal 2026"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 text-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Modalidade <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={idModalidade}
                    onChange={(e) => setIdModalidade(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 text-sm transition-all cursor-pointer"
                  >
                    <option value="">Selecione uma modalidade</option>
                    {modalidades.map((m) => (
                      <option key={m.id_modalidade} value={m.id_modalidade}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Categoria</label>
                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex: Adulto Livre, Sub-17, Master"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 text-sm transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Data de Início (Opcional)</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 text-sm transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Data de Fim (Opcional)</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 text-sm transition-all"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Bloco 2: Seletor de Formato */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Formato da Disputa
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Pontos Corridos */}
                <button
                  type="button"
                  onClick={() => setFormato('PONTOS_CORRIDOS')}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${
                    formato === 'PONTOS_CORRIDOS'
                      ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-1 ring-amber-500'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <ListOrdered
                      className={
                        formato === 'PONTOS_CORRIDOS' ? 'text-amber-600' : 'text-slate-400'
                      }
                      size={22}
                    />
                    {formato === 'PONTOS_CORRIDOS' && (
                      <CheckCircle2 size={16} className="text-amber-600" />
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Pontos Corridos</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    Turno único ou ida e volta (todos contra todos).
                  </p>
                </button>

                {/* Grupos + Mata-Mata */}
                <button
                  type="button"
                  onClick={() => setFormato('GRUPOS_MATA_MATA')}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${
                    formato === 'GRUPOS_MATA_MATA'
                      ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-1 ring-amber-500'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Layers
                      className={
                        formato === 'GRUPOS_MATA_MATA' ? 'text-amber-600' : 'text-slate-400'
                      }
                      size={22}
                    />
                    {formato === 'GRUPOS_MATA_MATA' && (
                      <CheckCircle2 size={16} className="text-amber-600" />
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Grupos + Mata-Mata</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    Classificatória em chaves com playoffs finais.
                  </p>
                </button>

                {/* Mata-Mata Direto */}
                <button
                  type="button"
                  onClick={() => setFormato('MATA_MATA')}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${
                    formato === 'MATA_MATA'
                      ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-1 ring-amber-500'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <GitBranch
                      className={formato === 'MATA_MATA' ? 'text-amber-600' : 'text-slate-400'}
                      size={22}
                    />
                    {formato === 'MATA_MATA' && (
                      <CheckCircle2 size={16} className="text-amber-600" />
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">Mata-Mata Direto</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    Chaveamento eliminatório simples direto.
                  </p>
                </button>
              </div>
            </div>

            {/* Bloco 3: Opções Dinâmicas por Formato */}
            <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <SlidersHorizontal size={14} />
                <span>
                  Regulamento Específico:{' '}
                  {formato === 'PONTOS_CORRIDOS'
                    ? 'Pontos Corridos'
                    : formato === 'GRUPOS_MATA_MATA'
                    ? 'Grupos + Mata-Mata'
                    : 'Mata-Mata Direto'}
                </span>
              </div>

              {/* Opções de PONTOS_CORRIDOS */}
              {formato === 'PONTOS_CORRIDOS' && (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={pcTurnoReturno}
                      onChange={(e) => setPcTurnoReturno(e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-800 block">
                        Turno e Returno
                      </span>
                      <span className="text-xs text-slate-500 block">
                        Confrontos de ida e volta entre todas as equipes.
                      </span>
                    </div>
                  </label>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Pontuação por Partida
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-xs font-semibold text-emerald-700 block mb-1">
                          Vitória
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={pcVitoriaPontos}
                          onChange={(e) => setPcVitoriaPontos(Number(e.target.value))}
                          className="w-full text-center text-lg font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-xs font-semibold text-blue-700 block mb-1">
                          Empate
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={pcEmpatePontos}
                          onChange={(e) => setPcEmpatePontos(Number(e.target.value))}
                          className="w-full text-center text-lg font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-xs font-semibold text-slate-500 block mb-1">
                          Derrota
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={pcDerrotaPontos}
                          onChange={(e) => setPcDerrotaPontos(Number(e.target.value))}
                          className="w-full text-center text-lg font-bold text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Critérios de Desempate (Prioridade)
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Clique para ativar/desativar
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {listaCriteriosDisponiveis.map((crit) => {
                        const ativo = pcCriterios.includes(crit.key);
                        const index = pcCriterios.indexOf(crit.key);
                        return (
                          <button
                            type="button"
                            key={crit.key}
                            onClick={() => toggleCriterio(crit.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                              ativo
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            {ativo && (
                              <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                                {index + 1}
                              </span>
                            )}
                            {crit.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Opções de GRUPOS_MATA_MATA */}
              {formato === 'GRUPOS_MATA_MATA' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Quantidade de Grupos
                      </label>
                      <select
                        value={gmmQtdGrupos}
                        onChange={(e) => setGmmQtdGrupos(Number(e.target.value))}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                      >
                        <option value={2}>2 Grupos (A e B)</option>
                        <option value={4}>4 Grupos (A, B, C e D)</option>
                        <option value={6}>6 Grupos (A a F)</option>
                        <option value={8}>8 Grupos (A a H)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Classificados por Grupo
                      </label>
                      <select
                        value={gmmClassificadosPorGrupo}
                        onChange={(e) => setGmmClassificadosPorGrupo(Number(e.target.value))}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                      >
                        <option value={1}>1º de cada grupo (Direto para fase final)</option>
                        <option value={2}>2 melhores de cada grupo (Padrão)</option>
                        <option value={3}>3 melhores de cada grupo</option>
                        <option value={4}>4 melhores de cada grupo</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200/60">
                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={gmmIdaVoltaGrupo}
                        onChange={(e) => setGmmIdaVoltaGrupo(e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        Jogos de Ida e Volta na Fase de Grupos
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={gmmIdaVoltaMataMata}
                        onChange={(e) => setGmmIdaVoltaMataMata(e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        Jogos de Ida e Volta no Mata-Mata
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={gmmDisputa3Lugar}
                        onChange={(e) => setGmmDisputa3Lugar(e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        Haverá Disputa de 3º Lugar
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={gmmPenaltis}
                        onChange={(e) => setGmmPenaltis(e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        Decisão por Pênaltis em caso de empate nos playoffs
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Opções de MATA_MATA Direto */}
              {formato === 'MATA_MATA' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Fase Inicial</label>
                    <select
                      value={mmFaseInicial}
                      onChange={(e) => setMmFaseInicial(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                    >
                      <option value="Final">Final (2 equipes)</option>
                      <option value="Semifinal">Semifinal (4 equipes)</option>
                      <option value="Quartas">Quartas de Final (8 equipes)</option>
                      <option value="Oitavas">Oitavas de Final (16 equipes)</option>
                    </select>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200/60">
                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={mmIdaVolta}
                        onChange={(e) => setMmIdaVolta(e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        Jogos de Ida e Volta nas fases eliminatórias
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={mmDisputa3Lugar}
                        onChange={(e) => setMmDisputa3Lugar(e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        Haverá Disputa de 3º Lugar
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={mmPenaltis}
                        onChange={(e) => setMmPenaltis(e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        Decisão por Pênaltis em caso de empate
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Ações do Modal */}
            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2 disabled:opacity-60 text-sm cursor-pointer"
              >
                {salvando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Criando Competição...</span>
                  </>
                ) : (
                  <span>Criar Competição</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
