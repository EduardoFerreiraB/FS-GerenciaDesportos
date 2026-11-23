'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Calendar, Plus, Search, Trophy } from 'lucide-react';
import { listarEventos, isErroApi } from '@/services/competicoes';
import type { EventoDetalhe } from '@/types/competicoes';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { Alert, Button, EmptyState, Input, PageHeader } from '@/components/ui';
import ModalNovoEvento from '@/components/competicoes/organizacao/ModalNovoEvento';
import {
  CartaoEvento,
  GradeCarregando,
  Paginacao,
} from '@/components/competicoes/organizacao/CartoesOrganizacao';

const TAMANHO_PAGINA = 12;

export default function EventosPage() {
  useBreadcrumb([{ label: 'Eventos' }]);

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
        tamanho: TAMANHO_PAGINA,
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
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Eventos que agrupam competições, como jogos escolares, semanas esportivas e olimpíadas."
        actions={
          <>
            <Button asChild variant="secondary" leftIcon={<Trophy className="size-4" aria-hidden="true" />}>
              <Link href="/dashboard/competicoes">Ver competições</Link>
            </Button>
            <Button
              leftIcon={<Plus className="size-4" aria-hidden="true" />}
              onClick={() => setModalNovoEventoAberto(true)}
            >
              Novo evento
            </Button>
          </>
        }
      />

      <div className="relative w-full sm:max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        />
        <Input
          type="search"
          aria-label="Buscar eventos"
          placeholder="Buscar eventos..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(1);
          }}
          className="pl-9"
        />
      </div>

      {carregando ? (
        <GradeCarregando />
      ) : erro ? (
        <Alert
          tone="danger"
          title="Falha ao carregar eventos"
          action={
            <Button size="sm" variant="secondary" onClick={carregarEventos}>
              Tentar novamente
            </Button>
          }
        >
          {erro}
        </Alert>
      ) : eventos.length === 0 ? (
        <EmptyState
          icon={<Calendar />}
          title="Nenhum evento esportivo encontrado"
          description={
            busca
              ? 'Nenhum evento corresponde ao termo pesquisado.'
              : 'Organize suas edições criando seu primeiro evento esportivo.'
          }
          action={
            busca ? undefined : (
              <Button
                leftIcon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => setModalNovoEventoAberto(true)}
              >
                Criar primeiro evento
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {eventos.map((evento) => (
              <li key={evento.id_evento}>
                <CartaoEvento evento={evento} />
              </li>
            ))}
          </ul>
          <Paginacao
            pagina={pagina}
            total={total}
            tamanho={TAMANHO_PAGINA}
            rotulo={(n) => (n === 1 ? 'evento' : 'eventos')}
            onMudar={setPagina}
          />
        </>
      )}

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
