'use client';

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { 
  X, 
  UserPlus, 
  Search, 
  Hash, 
  AlertCircle, 
  Loader2, 
  Check, 
  User, 
  GraduationCap, 
  ShieldAlert 
} from 'lucide-react';
import api from '@/lib/api';
import { competicaoService } from '@/services/competicoes';
import { InscricaoIndividual } from '@/types/competicoes';

const fetcher = (url: string) => api.get(url).then(res => res.data);

interface ModalInscricaoIndividualProps {
  isOpen: boolean;
  onClose: () => void;
  idCompeticao: number;
  inscricoesAtuais: InscricaoIndividual[];
  onSuccess: () => void;
}

interface ParticipanteOpcao {
  id_participante: number;
  nome_completo: string;
  tipo: 'aluno' | 'atleta';
  documento?: string;
  detalhe?: string;
}

export default function ModalInscricaoIndividual({
  isOpen,
  onClose,
  idCompeticao,
  inscricoesAtuais,
  onSuccess,
}: ModalInscricaoIndividualProps) {
  const { data: atletas, isLoading: loadingAtletas } = useSWR<any[]>('/atletas/', fetcher);
  const { data: alunos, isLoading: loadingAlunos } = useSWR<any[]>('/alunos', fetcher);

  const [busca, setBusca] = useState('');
  const [participanteSelecionado, setParticipanteSelecionado] = useState<number | null>(null);
  const [numeroPeito, setNumeroPeito] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Set de IDs já inscritos para conferência rápida
  const inscritosIds = useMemo(() => {
    return new Set(inscricoesAtuais.map(i => i.id_participante));
  }, [inscricoesAtuais]);

  // Lista unificada de participantes
  const todasOpcoes = useMemo<ParticipanteOpcao[]>(() => {
    const lista: ParticipanteOpcao[] = [];

    if (atletas && Array.isArray(atletas)) {
      atletas.forEach(at => {
        if (at.id_participante) {
          lista.push({
            id_participante: at.id_participante,
            nome_completo: at.nome_completo,
            tipo: 'atleta',
            documento: at.documento_pessoal,
            detalhe: at.contato ? `Contato: ${at.contato}` : undefined,
          });
        }
      });
    }

    if (alunos && Array.isArray(alunos)) {
      alunos.forEach(al => {
        if (al.id_participante) {
          lista.push({
            id_participante: al.id_participante,
            nome_completo: al.nome_completo,
            tipo: 'aluno',
            documento: al.documento_pessoal,
            detalhe: al.escola ? `Escola: ${al.escola}` : undefined,
          });
        }
      });
    }

    return lista.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
  }, [atletas, alunos]);

  // Opções filtradas pela busca
  const opcoesFiltradas = useMemo(() => {
    if (!busca.trim()) return todasOpcoes.slice(0, 30);
    const termo = busca.toLowerCase();
    return todasOpcoes.filter(
      p =>
        p.nome_completo.toLowerCase().includes(termo) ||
        (p.documento && p.documento.toLowerCase().includes(termo))
    );
  }, [todasOpcoes, busca]);

  if (!isOpen) return null;

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participanteSelecionado) {
      setErro('Por favor, selecione um atleta para inscrever.');
      return;
    }

    let peitoParsed: number | undefined = undefined;
    if (numeroPeito.trim()) {
      const num = parseInt(numeroPeito.trim(), 10);
      if (isNaN(num) || num <= 0) {
        setErro('O número de peito deve ser um número inteiro positivo.');
        return;
      }
      peitoParsed = num;
    }

    setSalvando(true);
    setErro(null);

    try {
      await competicaoService.inscreverAtleta(idCompeticao, {
        id_participante: participanteSelecionado,
        numero_peito: peitoParsed,
      });

      onSuccess();
      handleFechar();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erro ao inscrever atleta. Verifique se o atleta já está inscrito.';
      setErro(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSalvando(false);
    }
  };

  const handleFechar = () => {
    setBusca('');
    setParticipanteSelecionado(null);
    setNumeroPeito('');
    setErro(null);
    onClose();
  };

  const loadingGeral = loadingAtletas || loadingAlunos;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 border border-slate-100 relative max-h-[90vh] flex flex-col">
        <button
          onClick={handleFechar}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="mb-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <UserPlus className="text-purple-600" size={26} />
            Inscrever Atleta
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Selecione o participante cadastrado para competir nesta modalidade individual.
          </p>
        </div>

        {erro && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>{erro}</div>
          </div>
        )}

        <form onSubmit={handleSalvar} className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Número de Peito (Opcional) */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
              <Hash size={14} className="text-purple-600" />
              Número de Peito (Opcional)
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Dorsal / número fixo impresso na camiseta do atleta durante as provas.
            </p>
            <input
              type="number"
              min="1"
              max="99999"
              placeholder="Ex: 104"
              value={numeroPeito}
              onChange={e => setNumeroPeito(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-mono font-bold text-slate-800 bg-white"
            />
          </div>

          {/* Seleção de Participante */}
          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Selecionar Participante *
            </label>

            {/* Barra de Busca */}
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou documento..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Lista com Rolagem */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl p-2 divide-y divide-slate-100 max-h-56 bg-slate-50/40">
              {loadingGeral ? (
                <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
                  <Loader2 size={16} className="animate-spin text-purple-600" />
                  Carregando lista de atletas e alunos...
                </div>
              ) : opcoesFiltradas.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhum participante encontrado.
                </div>
              ) : (
                opcoesFiltradas.map(opcao => {
                  const jaInscrito = inscritosIds.has(opcao.id_participante);
                  const isSelecionado = participanteSelecionado === opcao.id_participante;

                  return (
                    <button
                      key={opcao.id_participante}
                      type="button"
                      disabled={jaInscrito}
                      onClick={() => setParticipanteSelecionado(opcao.id_participante)}
                      className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors ${
                        jaInscrito
                          ? 'opacity-40 cursor-not-allowed bg-slate-100/50'
                          : isSelecionado
                          ? 'bg-purple-100/70 border border-purple-300'
                          : 'hover:bg-white cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            opcao.tipo === 'atleta'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {opcao.tipo === 'atleta' ? <User size={14} /> : <GraduationCap size={14} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-tight">
                            {opcao.nome_completo}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {opcao.tipo === 'atleta' ? 'Atleta Externo' : 'Aluno'}
                            {opcao.documento ? ` • Doc: ${opcao.documento}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {jaInscrito ? (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-200/80 px-2 py-0.5 rounded-md">
                            Já inscrito
                          </span>
                        ) : isSelecionado ? (
                          <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Rodapé e Ações */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleFechar}
              className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !participanteSelecionado}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-100 transition-all flex items-center gap-2 cursor-pointer"
            >
              {salvando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Inscrevendo...
                </>
              ) : (
                'Confirmar Inscrição'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
