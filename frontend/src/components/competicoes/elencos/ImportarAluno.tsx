'use client';

import React, { useState, useEffect } from 'react';
import { Search, Download, UserX } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Input, Spinner } from '@/components/ui';
import { formatarData } from '@/lib/formatos';
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
  idsCompetidoresInscritos?: Set<number>;
}

export default function ImportarAluno({
  onAlunoImportado,
  onCancel,
  idsCompetidoresInscritos,
}: ImportarAlunoProps) {
  const { user } = useAuth();
  const [alunos, setAlunos] = useState<AlunoEscolarMinimo[]>([]);
  const [mapaAlunoCompetidor, setMapaAlunoCompetidor] = useState<Map<number, number>>(new Map());
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
        const [dados, paginaCompetidores] = await Promise.all([
          alunoService.getAll(),
          competicoesService.listarCompetidores({ pagina: 1, tamanho: 200 }).catch(() => null),
        ]);
        if (ativo && Array.isArray(dados)) {
          // Extrai estritamente apenas dados públicos esportivos: ID, Nome, Nascimento
          const minimos: AlunoEscolarMinimo[] = dados.map((a: any) => ({
            id_aluno: a.id_aluno,
            nome_completo: a.nome_completo,
            data_nascimento: a.data_nascimento,
          }));
          setAlunos(minimos);
        }
        if (ativo && paginaCompetidores) {
          const mapa = new Map<number, number>();
          for (const c of paginaCompetidores.itens) {
            if (c.id_aluno_origem != null) {
              mapa.set(c.id_aluno_origem, c.id_competidor);
            }
          }
          // Caso existam mais páginas, busca as páginas restantes (até um limite seguro)
          const totalPaginas = Math.min(Math.ceil(paginaCompetidores.total / paginaCompetidores.tamanho), 10);
          if (totalPaginas > 1) {
            const paginasExtras = await Promise.all(
              Array.from({ length: totalPaginas - 1 }, (_, idx) =>
                competicoesService.listarCompetidores({ pagina: idx + 2, tamanho: 200 }).catch(() => null),
              ),
            );
            for (const p of paginasExtras) {
              if (!p) continue;
              for (const c of p.itens) {
                if (c.id_aluno_origem != null) {
                  mapa.set(c.id_aluno_origem, c.id_competidor);
                }
              }
            }
          }
          if (ativo) {
            setMapaAlunoCompetidor(mapa);
          }
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
      <Alert tone="warning" title="Acesso restrito">
        Apenas coordenadores e administradores possuem autorização para importar registros de alunos da escolinha como competidores esportivos.
      </Alert>
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
      <Alert tone="info" title="Preservação de histórico esportivo">
        A importação cria um perfil esportivo autônomo. O histórico e as participações deste atleta na competição serão integralmente preservados mesmo se o aluno for futuramente desvinculado da escola.
      </Alert>

      {erro && <Alert tone="danger">{erro}</Alert>}
      {sucesso && <Alert tone="success">{sucesso}</Alert>}

      <div className="relative">
        <Input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno por nome..."
          aria-label="Buscar aluno"
          className="pl-9"
        />
        <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
      </div>

      <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
        {carregando && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-fg-muted">
            <Spinner size="sm" />
            <span>Carregando alunos da escola...</span>
          </div>
        )}

        {!carregando && alunosFiltrados.length === 0 && (
          <EmptyState
            className="border-0"
            icon={<UserX />}
            title="Nenhum aluno encontrado"
            description="Nenhum aluno encontrado para importação."
          />
        )}

        {!carregando &&
          alunosFiltrados.map((aluno) => {
            const idCompetidor = mapaAlunoCompetidor.get(aluno.id_aluno);
            const jaInscrito =
              idCompetidor !== undefined && (idsCompetidoresInscritos?.has(idCompetidor) ?? false);
            const jaImportado = idCompetidor !== undefined && !jaInscrito;

            return (
              <div
                key={aluno.id_aluno}
                className="flex items-center justify-between gap-3 p-3 transition-colors duration-150 hover:bg-surface-muted/60"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                    <span className="truncate">{aluno.nome_completo}</span>
                    {jaInscrito && <Badge tone="neutral">Já inscrito</Badge>}
                    {jaImportado && <Badge tone="primary">Já importado</Badge>}
                  </div>
                  {aluno.data_nascimento && (
                    <div className="text-xs text-fg-muted">Nascimento: {formatarData(aluno.data_nascimento)}</div>
                  )}
                </div>
                {jaInscrito ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled
                    aria-label={`${aluno.nome_completo} já inscrito nesta edição`}
                  >
                    Já inscrito
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    loading={importandoId === aluno.id_aluno}
                    leftIcon={<Download className="size-3.5" />}
                    onClick={() => handleImportar(aluno)}
                  >
                    Importar como Competidor
                  </Button>
                )}
              </div>
            );
          })}
      </div>

      {onCancel && (
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Voltar
          </Button>
        </div>
      )}
    </div>
  );
}
