'use client';

import React, { useState, useEffect } from 'react';
import { Copy } from 'lucide-react';
import { Alert, Button, Dialog, DialogContent, DialogFooter, Field, Input, Select } from '@/components/ui';
import { rotuloDoEstado } from '@/lib/rotulos';
import { competicoesService, isErroApi } from '@/services/competicoes';
import type { EstadoEdicao, EdicaoCompeticaoDetalhe } from '@/types/competicoes';

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
  const [idOrigemInput, setIdOrigemInput] = useState<string>('');
  const [edicoesDisponiveis, setEdicoesDisponiveis] = useState<EdicaoCompeticaoDetalhe[]>([]);
  const [carregandoEdicoes, setCarregandoEdicoes] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const isRascunho = estadoEdicao === 'RASCUNHO';

  useEffect(() => {
    if (!isOpen) return;

    setIdOrigemInput('');
    setErro(null);

    let ativo = true;
    async function carregarHistoricoEdicoes() {
      setCarregandoEdicoes(true);
      try {
        const edicaoAtual = await competicoesService.obterEdicao(idEdicaoCompeticao);
        if (!ativo || !edicaoAtual) return;

        const comp = await competicoesService.obterCompeticao(edicaoAtual.id_competicao);
        if (ativo && comp?.edicoes) {
          const outras = comp.edicoes.filter(
            (e) => e.id_edicao_competicao !== idEdicaoCompeticao
          );
          setEdicoesDisponiveis(outras);
          if (outras.length > 0) {
            setIdOrigemInput(String(outras[0].id_edicao_competicao));
          }
        }
      } catch (err) {
        // Falha não crítica se for ambiente mock ou sem edição pai
      } finally {
        if (ativo) setCarregandoEdicoes(false);
      }
    }

    carregarHistoricoEdicoes();
    return () => {
      ativo = false;
    };
  }, [idEdicaoCompeticao, isOpen]);

  const handleCopiar = async (e: React.FormEvent) => {
    e.preventDefault();
    const idOrigem = parseInt(idOrigemInput, 10);
    if (!idOrigem || isNaN(idOrigem)) {
      setErro('Informe ou selecione uma edição de origem válida.');
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
      onCopiado();
      onClose();
    } catch (err) {
      if (isErroApi(err)) {
        setErro(err.mensagem);
      } else {
        setErro('Erro ao copiar elencos da edição de origem.');
      }
    } finally {
      setCopiando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => (!aberto && !copiando ? onClose() : undefined)}>
      <DialogContent
        title="Copiar Elenco"
        description="Replica as equipes e as inscrições de atletas de uma edição anterior para a edição atual."
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
            Apenas equipes e inscrições de competidores são copiadas; partidas e punições não são copiadas.
          </Alert>

          {erro && <Alert tone="danger">{erro}</Alert>}

          {edicoesDisponiveis.length > 0 && (
            <Field label="Edições desta competição" htmlFor="edicao-origem-select">
              <Select
                id="edicao-origem-select"
                value={idOrigemInput}
                onChange={(e) => setIdOrigemInput(e.target.value)}
                disabled={!isRascunho || copiando}
              >
                {edicoesDisponiveis.map((ed) => (
                  <option key={ed.id_edicao_competicao} value={ed.id_edicao_competicao}>
                    Edição {ed.identificacao} ({rotuloDoEstado('edicao', ed.estado)})
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field
            label="Edição de origem"
            htmlFor="edicao-origem"
            required
            hint={
              carregandoEdicoes
                ? 'Buscando edições da competição...'
                : edicoesDisponiveis.length > 0
                  ? 'Ou digite o ID da edição de origem.'
                  : 'Informe o ID da edição de origem.'
            }
          >
            <Input
              id="edicao-origem"
              type="number"
              value={idOrigemInput}
              onChange={(e) => setIdOrigemInput(e.target.value)}
              placeholder="Ex: 1"
              disabled={!isRascunho || copiando}
            />
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
            disabled={!isRascunho || !idOrigemInput.trim()}
            leftIcon={<Copy className="size-4" />}
          >
            Confirmar Cópia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
