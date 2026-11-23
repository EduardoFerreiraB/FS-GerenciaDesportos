'use client';

import React, { useState, useEffect } from 'react';
import { Copy } from 'lucide-react';
import { Alert, Button, Dialog, DialogContent, DialogFooter, Field, Select } from '@/components/ui';
import { useNotification } from '@/context/NotificationContext';
import { extrairErro } from '@/lib/erros';
import { rotuloDoEstado } from '@/lib/rotulos';
import { competicoesService } from '@/services/competicoes';
import type { EstadoEdicao, OrigemCopiaEquipes } from '@/types/competicoes';

interface CopiarElencoProps {
  idEdicaoCompeticao: number;
  isOpen: boolean;
  onClose: () => void;
  onCopiado: () => void;
  estadoEdicao?: EstadoEdicao;
}

export default function CopiarElenco({
  idEdicaoCompeticao,
  isOpen,
  onClose,
  onCopiado,
  estadoEdicao = 'RASCUNHO',
}: CopiarElencoProps) {
  const { toast } = useNotification();
  const [idOrigemSelecionada, setIdOrigemSelecionada] = useState<string>('');
  const [origens, setOrigens] = useState<OrigemCopiaEquipes[]>([]);
  const [carregandoOrigens, setCarregandoOrigens] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const isRascunho = estadoEdicao === 'RASCUNHO';

  useEffect(() => {
    if (!isOpen) return;

    setIdOrigemSelecionada('');
    setOrigens([]);
    setErro(null);

    let ativo = true;
    async function carregarOrigens() {
      setCarregandoOrigens(true);
      try {
        const lista = await competicoesService.listarOrigensCopiaEquipes(idEdicaoCompeticao);
        if (!ativo) return;
        setOrigens(lista);
        if (lista.length > 0) {
          setIdOrigemSelecionada(String(lista[0].id_edicao_competicao));
        }
      } catch (err) {
        if (!ativo) return;
        setErro(
          extrairErro(err, { padrao: 'Não foi possível carregar as edições disponíveis para cópia.' })
            .mensagem,
        );
      } finally {
        if (ativo) setCarregandoOrigens(false);
      }
    }

    carregarOrigens();
    return () => {
      ativo = false;
    };
  }, [idEdicaoCompeticao, isOpen]);

  const handleCopiar = async (e: React.FormEvent) => {
    e.preventDefault();
    const idOrigem = parseInt(idOrigemSelecionada, 10);
    if (!idOrigem || isNaN(idOrigem)) {
      setErro('Selecione uma edição de origem válida.');
      return;
    }

    if (!isRascunho) {
      setErro('A cópia de equipes e elencos só é permitida enquanto a edição de destino estiver em rascunho.');
      return;
    }

    setCopiando(true);
    setErro(null);

    try {
      await competicoesService.copiarEquipes(idEdicaoCompeticao, idOrigem);
      toast('Elencos copiados com sucesso.', 'success');
      onCopiado();
      onClose();
    } catch (err) {
      setErro(
        extrairErro(err, { padrao: 'Erro ao copiar elencos da edição de origem.' }).mensagem,
      );
    } finally {
      setCopiando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => (!aberto && !copiando ? onClose() : undefined)}>
      <DialogContent
        title="Copiar Elenco"
        description="Replica as equipes e os integrantes ativos de uma edição anterior para a edição atual."
        size="md"
      >
        <form id="form-copiar-elenco" onSubmit={handleCopiar} className="space-y-4">
          {!isRascunho && (
            <Alert tone="danger" title="Ação bloqueada">
              A cópia de elencos só é permitida quando a edição de destino estiver em rascunho. A edição atual está{' '}
              {rotuloDoEstado('edicao', estadoEdicao).toLowerCase()}.
            </Alert>
          )}

          <Alert tone="warning" title="Escopo da cópia">
            Apenas equipes e integrantes ativos são copiados; integrantes inativos, partidas e punições não são copiados.
          </Alert>

          {erro && <Alert tone="danger">{erro}</Alert>}

          <Field
            label="Edição de origem"
            htmlFor="edicao-origem-select"
            required
            hint={
              carregandoOrigens
                ? 'Buscando edições disponíveis...'
                : origens.length === 0
                  ? 'Nenhuma outra edição com equipes cadastradas está disponível para cópia.'
                  : 'Escolha a edição de onde deseja copiar as equipes e integrantes ativos.'
            }
          >
            <Select
              id="edicao-origem-select"
              data-testid="select-origem-copia"
              value={idOrigemSelecionada}
              onChange={(e) => setIdOrigemSelecionada(e.target.value)}
              disabled={!isRascunho || copiando || carregandoOrigens || origens.length === 0}
            >
              {origens.length === 0 ? (
                <option value="">
                  {carregandoOrigens ? 'Carregando edições…' : 'Nenhuma edição disponível'}
                </option>
              ) : (
                origens.map((origem) => (
                  <option key={origem.id_edicao_competicao} value={origem.id_edicao_competicao}>
                    {origem.rotulo} ({origem.equipes}{' '}
                    {origem.equipes === 1 ? 'equipe' : 'equipes'})
                  </option>
                ))
              )}
            </Select>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={copiando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-copiar-elenco"
            loading={copiando}
            disabled={!isRascunho || !idOrigemSelecionada.trim() || origens.length === 0}
            leftIcon={<Copy className="size-4" />}
          >
            Confirmar Cópia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
