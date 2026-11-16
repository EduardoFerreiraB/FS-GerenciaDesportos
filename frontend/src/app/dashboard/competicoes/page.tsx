'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Plus, Search, CalendarPlus } from 'lucide-react';
import { listarCompeticoes, isErroApi } from '@/services/competicoes';
import { modalidadeService } from '@/services';
import type { CompeticaoDetalhe } from '@/types/competicoes';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { Alert, Button, EmptyState, Input, PageHeader, Select } from '@/components/ui';
import ModalNovaCompeticao from '@/components/competicoes/organizacao/ModalNovaCompeticao';
import ModalNovoEvento from '@/components/competicoes/organizacao/ModalNovoEvento';
import {
  CartaoCompeticao,
  GradeCarregando,
  Paginacao,
} from '@/components/competicoes/organizacao/CartoesOrganizacao';

interface ModalidadeItem {
  id_modalidade: number;
  nome: string;
}

const TAMANHO_PAGINA = 12;

export default function CompeticoesPage() {
  const router = useRouter();
  useBreadcrumb([{ label: 'Competições' }]);

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
        tamanho: TAMANHO_PAGINA,
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

  const competicoesFiltradas = competicoes.filter(
    (comp) => filtroModalidade === '' || comp.id_modalidade === filtroModalidade,
  );

  const nomeModalidade = (idMod: number) =>
    modalidades.find((mod) => mod.id_modalidade === idMod)?.nome ?? 'Modalidade';

  const filtrando = Boolean(busca.trim()) || filtroModalidade !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competições"
        description="Campeonatos, torneios e as edições de cada um."
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<CalendarPlus className="size-4" aria-hidden="true" />}
              onClick={() => setModalEventoAberto(true)}
            >
              Novo evento
            </Button>
            <Button
              leftIcon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setModalCompeticaoAberto(true)}
            >
              Nova competição
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            type="search"
            aria-label="Buscar competições"
            placeholder="Buscar competições..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            aria-label="Filtrar por esporte"
            value={filtroModalidade}
            onChange={(e) => setFiltroModalidade(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Todas as modalidades</option>
            {modalidades.map((mod) => (
              <option key={mod.id_modalidade} value={mod.id_modalidade}>
                {mod.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {carregando ? (
        <GradeCarregando />
      ) : erro ? (
        <Alert
          tone="danger"
          title="Falha ao carregar competições"
          action={
            <Button size="sm" variant="secondary" onClick={carregarCompeticoes}>
              Tentar novamente
            </Button>
          }
        >
          {erro}
        </Alert>
      ) : competicoesFiltradas.length === 0 ? (
        <EmptyState
          icon={<Trophy />}
          title="Nenhuma competição encontrada"
          description={
            filtrando
              ? 'Nenhuma competição corresponde aos filtros informados.'
              : 'Comece criando a primeira competição esportiva da sua organização.'
          }
          action={
            filtrando ? undefined : (
              <Button
                leftIcon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => setModalCompeticaoAberto(true)}
              >
                Criar primeira competição
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {competicoesFiltradas.map((comp) => (
              <li key={comp.id_competicao}>
                <CartaoCompeticao competicao={comp} modalidade={nomeModalidade(comp.id_modalidade)} />
              </li>
            ))}
          </ul>
          <Paginacao
            pagina={pagina}
            total={total}
            tamanho={TAMANHO_PAGINA}
            rotulo={(n) => (n === 1 ? 'competição' : 'competições')}
            onMudar={setPagina}
          />
        </>
      )}

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
