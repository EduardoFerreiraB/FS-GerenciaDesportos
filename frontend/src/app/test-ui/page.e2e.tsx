'use client';

import { useState } from 'react';
import { Inbox, MoreHorizontal, Moon, Sun, Users } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
  StatCard,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TR,
} from '@/components/ui';

const TEXTO_LONGO =
  'Campeonato Intermunicipal de Futebol de Campo Categoria Sub-17 Masculino da Região Metropolitana e Adjacências';

export default function VitrinePage() {
  const { theme, setTheme } = useTheme();
  const [segundo, setSegundo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarFalha, setConfirmarFalha] = useState(false);
  const [resultado, setResultado] = useState('');
  const [ultimaAcao, setUltimaAcao] = useState('');
  const [aba, setAba] = useState('geral');

  return (
    <main data-ui="" className="mx-auto max-w-6xl space-y-8 bg-canvas p-6 text-fg">
      <PageHeader
        title="Vitrine de componentes"
        description="Todas as variantes nos temas claro e escuro."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Vitrine' }]}
        actions={
          <div role="group" aria-label="Tema" className="flex gap-2">
            <Button
              variant={theme === 'light' ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={<Sun className="size-4" />}
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
            >
              Claro
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={<Moon className="size-4" />}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
            >
              Escuro
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader title="Botões" description="Variantes, tamanhos e estados" />
        <CardBody className="flex flex-wrap items-center gap-3">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="danger">Perigo</Button>
          <Button variant="danger-outline">Perigo contornado</Button>
          <Button size="sm">Pequeno</Button>
          <Button size="lg">Grande</Button>
          <Button loading>Carregando</Button>
          <Button disabled>Desabilitado</Button>
          <Tooltip content="Ação de exemplo">
            <IconButton aria-label="Ação com dica" variant="secondary">
              <Users className="size-4" />
            </IconButton>
          </Tooltip>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Etiquetas e estados" />
        <CardBody className="flex flex-wrap items-center gap-3">
          <Badge>Neutro</Badge>
          <Badge tone="primary" dot>Primário</Badge>
          <Badge tone="success" dot>Sucesso</Badge>
          <Badge tone="warning" dot>Alerta</Badge>
          <Badge tone="danger" dot>Perigo</Badge>
          <StatusBadge tipo="edicao" valor="EM_ANDAMENTO" />
          <StatusBadge tipo="edicao" valor="FINALIZADA" />
          <StatusBadge tipo="edicao" valor="RASCUNHO" />
          <StatusBadge tipo="edicao" valor="CANCELADA" />
          <StatusBadge tipo="suspensao" valor="EM_REVISAO" />
          <Spinner />
          <Skeleton className="h-6 w-32" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Campos" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="v-nome" required hint="Como aparece no portal">
            <Input id="v-nome" placeholder="Nome da competição" />
          </Field>
          <Field label="E-mail" htmlFor="v-email" error="Informe um e-mail válido">
            <Input id="v-email" invalid defaultValue="invalido" />
          </Field>
          <Field label="Modalidade" htmlFor="v-mod">
            <Select id="v-mod" defaultValue="futsal">
              <option value="futsal">Futsal</option>
              <option value="volei">Vôlei</option>
            </Select>
          </Field>
          <Field label="Observações" htmlFor="v-obs">
            <Textarea id="v-obs" rows={2} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox defaultChecked /> Aceito os termos
          </label>
          <Field label="Texto longo" htmlFor="v-longo">
            <Input id="v-longo" defaultValue={TEXTO_LONGO} />
          </Field>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Equipes inscritas" value="16" icon={<Users className="size-4" />} hint="2 sem elenco" />
        <StatCard label={TEXTO_LONGO} value="1.250" icon={<Users className="size-4" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Alert tone="info" title="Informação">Mensagem informativa.</Alert>
        <Alert tone="danger" title="Erro" action={<Button size="sm" variant="secondary">Tentar novamente</Button>}>
          Não foi possível carregar os dados.
        </Alert>
        <EmptyState icon={<Inbox className="size-6" />} title="Nada por aqui" description="Cadastre o primeiro item." action={<Button size="sm">Novo item</Button>} />
      </div>

      <Card>
        <CardHeader title="Abas" />
        <CardBody>
          <Tabs value={aba} onValueChange={setAba}>
            <TabsList aria-label="Seções">
              <TabsTrigger value="geral">Visão geral</TabsTrigger>
              <TabsTrigger value="jogos">Jogos</TabsTrigger>
              <TabsTrigger value="tabela">Classificação</TabsTrigger>
            </TabsList>
            <TabsContent value="geral">Conteúdo de Visão geral</TabsContent>
            <TabsContent value="jogos">Conteúdo de Jogos</TabsContent>
            <TabsContent value="tabela">Conteúdo de Classificação</TabsContent>
          </Tabs>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sobreposições" />
        <CardBody className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Abrir modal</Button>
            </DialogTrigger>
            <DialogContent title="Modal de exemplo" description="Corpo com rolagem própria.">
              <p className="text-sm text-fg-muted">{TEXTO_LONGO}</p>
              <div className="mt-4 space-y-2">
                {Array.from({ length: 30 }, (_, i) => (
                  <p key={i} className="text-sm">Linha {i + 1} do conteúdo longo do modal.</p>
                ))}
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setSegundo(true)}>Abrir segundo modal</Button>
              </DialogFooter>
              <Dialog open={segundo} onOpenChange={setSegundo}>
                <DialogContent title="Segundo modal" size="sm">
                  <p className="text-sm">Modal sobre modal.</p>
                </DialogContent>
              </Dialog>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Modal com campo (abrir)</Button>
            </DialogTrigger>
            <DialogContent title="Modal com campo">
              <Field label="Nome no modal" htmlFor="v-campo-modal">
                <Input id="v-campo-modal" data-testid="campo-modal" />
              </Field>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Abrir gaveta</Button>
            </DialogTrigger>
            <DialogContent title="Gaveta lateral" side="right" description="Altura total.">
              <p className="text-sm">Elenco, detalhes etc.</p>
            </DialogContent>
          </Dialog>

          <Button variant="danger-outline" onClick={() => setConfirmar(true)}>Excluir competição</Button>
          <Button variant="danger-outline" onClick={() => setConfirmarFalha(true)}>Excluir com falha</Button>
          <span data-testid="resultado-confirmacao" className="text-sm text-fg-muted">{resultado}</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label="Mais ações" variant="secondary">
                <MoreHorizontal className="size-4" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setUltimaAcao('Editar')}>Editar</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setUltimaAcao('Duplicar')}>Duplicar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={() => setUltimaAcao('Excluir')}>Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span data-testid="ultima-acao" className="text-sm text-fg-muted">{ultimaAcao}</span>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title="Excluir competição"
        description="Esta ação não pode ser desfeita."
        confirmText="Copa Municipal"
        confirmLabel="Excluir"
        onConfirm={async () => setResultado('Confirmado')}
      />
      <ConfirmDialog
        open={confirmarFalha}
        onOpenChange={setConfirmarFalha}
        title="Excluir com falha"
        description="Simula erro do servidor."
        confirmLabel="Excluir"
        onConfirm={async () => {
          throw new Error('Falha simulada');
        }}
      />

      <Card data-testid="tabela-larga">
        <CardHeader title="Tabela de 10 colunas" />
        <Table>
          <THead>
            <TR>
              {Array.from({ length: 10 }, (_, i) => (
                <TH key={i}>Coluna {i + 1}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {Array.from({ length: 3 }, (_, l) => (
              <TR key={l}>
                {Array.from({ length: 10 }, (_, c) => (
                  <TD key={c} className="whitespace-nowrap">
                    {c === 0 ? TEXTO_LONGO : `Valor ${l + 1}.${c + 1}`}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </main>
  );
}
