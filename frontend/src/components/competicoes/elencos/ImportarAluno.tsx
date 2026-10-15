'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Info, Search, Download, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { alunoService } from '@/services';
import { competicoesService, isErroApi } from '@/services/competicoes';
import type { CompetidorDetalhe } from '@/types/competicoes';

interface AlunoEscolarMinimo {
  id_aluno: number;
  nome_completo: string;
  data_nascimento?: string;
}

interface ImportarAlunoProps {
  onAlunoImportado: (competidor: CompetidorDetalhe) => void;
  onCancel?: () => void;
}

export default function ImportarAluno({ onAlunoImportado, onCancel }: ImportarAlunoProps) {
  const { user } = useAuth();
  const [alunos, setAlunos] = useState<AlunoEscolarMinimo[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [importandoId, setImportandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const temPermissao = user?.role === 'admin' || user?.role === 'coordenador';

  useEffect(() => {
    if (!temPermissao) return;

    let ativo = true;
    async function carregarAlunos() {
      setCarregando(true);
      setErro(null);
      try {
        const dados = await alunoService.getAll();
        if (ativo && Array.isArray(dados)) {
          // Extrai estritamente apenas dados públicos esportivos: ID, Nome, Nascimento
          const minimos: AlunoEscolarMinimo[] = dados.map((a: any) => ({
            id_aluno: a.id_aluno,
            nome_completo: a.nome_completo,
            data_nascimento: a.data_nascimento,
          }));
          setAlunos(minimos);
        }
      } catch (err) {
        if (ativo) {
          setErro('Não foi possível carregar a lista de alunos da escola.');
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarAlunos();
    return () => {
      ativo = false;
    };
  }, [temPermissao]);

  if (!temPermissao) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert size={18} />
          <span>Acesso Restrito</span>
        </div>
        <p>
          Apenas coordenadores e administradores possuem autorização para importar registros de alunos da escolinha como competidores esportivos.
        </p>
      </div>
    );
  }

  const handleImportar = async (aluno: AlunoEscolarMinimo) => {
    setImportandoId(aluno.id_aluno);
    setErro(null);
    setSucesso(null);

    try {
      const competidor = await competicoesService.importarAluno(aluno.id_aluno);
      setSucesso(`Aluno "${competidor.nome}" importado com sucesso!`);
      onAlunoImportado(competidor);
    } catch (err) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else {
        setErro(`Erro ao importar o aluno "${aluno.nome_completo}".`);
      }
    } finally {
      setImportandoId(null);
    }
  };

  const alunosFiltrados = alunos.filter((a) =>
    a.nome_completo.toLowerCase().includes(busca.toLowerCase().trim())
  );

  return (
    <div className="space-y-4">
      {/* Banner Informativo de Desacoplamento e Preservação */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex gap-2.5">
        <Info size={18} className="shrink-0 text-blue-600 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-800">Preservação de Histórico Esportivo</p>
          <p className="text-blue-700 leading-relaxed">
            A importação cria um perfil esportivo autônomo. O histórico e as participações deste atleta na competição serão integralmente preservados mesmo se o aluno for futuramente desvinculado da escola.
          </p>
        </div>
      </div>

      {erro && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{erro}</span>
        </div>
      )}

      {sucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{sucesso}</span>
        </div>
      )}

      {/* Campo de Busca */}
      <div className="relative">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno por nome..."
          aria-label="Buscar aluno"
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Lista de Alunos Elegíveis */}
      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto bg-white">
        {carregando && (
          <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin text-indigo-600" />
            <span>Carregando alunos da escola...</span>
          </div>
        )}

        {!carregando && alunosFiltrados.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nenhum aluno encontrado para importação.
          </div>
        )}

        {!carregando &&
          alunosFiltrados.map((aluno) => {
            const estaImportando = importandoId === aluno.id_aluno;
            return (
              <div
                key={aluno.id_aluno}
                className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {aluno.nome_completo}
                  </div>
                  {aluno.data_nascimento && (
                    <div className="text-xs text-slate-500">
                      Nascimento: {aluno.data_nascimento}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={estaImportando}
                  onClick={() => handleImportar(aluno)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {estaImportando ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  Importar como Competidor
                </button>
              </div>
            );
          })}
      </div>

      {onCancel && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );
}
