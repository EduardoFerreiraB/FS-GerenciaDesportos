'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { UploadCloud, Image as ImageIcon, X, FileCheck, CircleAlert, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import useSWR, { mutate } from 'swr';
import { cn } from '@/lib/cn';
import { formatarTelefone, montarUrlArquivo, somenteDigitos } from '@/app/dashboard/alunos/util';
import { useNotification } from '@/context/NotificationContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Field,
  IconButton,
  Input,
  PageHeader,
  Textarea,
} from '@/components/ui';

const fetcher = (url: string) => api.get(url).then((res) => res.data);

interface MatriculaNoAluno {
  id_matricula: number;
  data_matricula?: string;
  ativo: boolean;
  turma?: {
    id_turma: number;
    descricao?: string | null;
    categoria_idade?: string | null;
  } | null;
}

interface AlunoFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export default function AlunoForm({ initialData, isEditing = false }: AlunoFormProps) {
  const router = useRouter();
  const { toast } = useNotification();
  useBreadcrumb([
    { label: 'Alunos', href: '/dashboard/alunos' },
    { label: isEditing ? (initialData?.nome_completo ?? 'Editar aluno') : 'Novo aluno' },
  ]);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onChange',
  });

  const [selectedTurmas, setSelectedTurmas] = useState<number[]>([]);
  const [matriculasAtivas, setMatriculasAtivas] = useState<MatriculaNoAluno[]>([]);
  const [matriculaParaCancelar, setMatriculaParaCancelar] = useState<MatriculaNoAluno | null>(null);
  const { data: turmasDisponiveis } = useSWR('/turmas/', fetcher);

  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [removerFoto, setRemoverFoto] = useState(false);

  const [atestadoFile, setAtestadoFile] = useState<File | null>(null);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);

  const [erroAtestado, setErroAtestado] = useState<string | null>(null);
  const [erroDocumento, setErroDocumento] = useState<string | null>(null);
  const [erroTurmas, setErroTurmas] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      const camposTexto = [
        'nome_completo',
        'data_nascimento',
        'escola',
        'serie_ano',
        'nome_mae',
        'nome_pai',
        'endereco',
        'recomendacoes_medicas',
      ];
      camposTexto.forEach((key) => {
        setValue(key, initialData[key] ?? '');
      });
      setValue('telefone_1', formatarTelefone(initialData.telefone_1));
      setValue('telefone_2', formatarTelefone(initialData.telefone_2));

      const ativas: MatriculaNoAluno[] = (initialData.matriculas ?? []).filter(
        (m: MatriculaNoAluno) => m.ativo && m.turma,
      );
      setMatriculasAtivas(ativas);
      if (ativas.length > 0) {
        setSelectedTurmas(ativas.map((m) => m.turma!.id_turma));
      } else if (Array.isArray(initialData.ids_turmas)) {
        setSelectedTurmas(initialData.ids_turmas);
      } else {
        setSelectedTurmas([]);
      }

      if (initialData.foto && typeof initialData.foto === 'string') {
        setFotoPreview(montarUrlArquivo(initialData.foto));
      } else {
        setFotoPreview(null);
      }
      setFotoFile(null);
      setRemoverFoto(false);
    }
  }, [initialData, setValue]);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      setRemoverFoto(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAtestadoChange = (file: File | null) => {
    setAtestadoFile(file);
    if (file) setErroAtestado(null);
  };

  const handleDocumentoChange = (file: File | null) => {
    setDocumentoFile(file);
    if (file) setErroDocumento(null);
  };

  const validarExtrasCadastro = (): boolean => {
    if (isEditing) return true;
    let valido = true;
    if (!atestadoFile) {
      setErroAtestado('Atestado médico é obrigatório.');
      valido = false;
    } else {
      setErroAtestado(null);
    }
    if (!documentoFile) {
      setErroDocumento('Documento pessoal é obrigatório.');
      valido = false;
    } else {
      setErroDocumento(null);
    }
    if (selectedTurmas.length === 0) {
      setErroTurmas('Selecione pelo menos uma turma.');
      valido = false;
    } else {
      setErroTurmas(null);
    }
    return valido;
  };

  const confirmarCancelamentoMatricula = async () => {
    if (!matriculaParaCancelar || !initialData?.id_aluno) return;
    const idMatricula = matriculaParaCancelar.id_matricula;
    const idTurma = matriculaParaCancelar.turma?.id_turma;
    try {
      await api.delete(`/matriculas/${idMatricula}`);
      setMatriculasAtivas((prev) => prev.filter((m) => m.id_matricula !== idMatricula));
      if (idTurma !== undefined) {
        setSelectedTurmas((prev) => prev.filter((id) => id !== idTurma));
      }
      await mutate(`/alunos/${initialData.id_aluno}`);
      await mutate('/alunos/');
      toast('Matrícula cancelada com sucesso.', 'success');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      throw new Error(typeof detail === 'string' && detail ? detail : 'Erro ao cancelar matrícula.');
    }
  };

  const onSubmit = async (data: any) => {
    if (!validarExtrasCadastro()) {
      return;
    }

    try {
      if (isEditing) {
        const formData = new FormData();
        formData.append('nome_completo', data.nome_completo ?? '');
        formData.append('data_nascimento', data.data_nascimento ?? '');
        formData.append('escola', data.escola ?? '');
        formData.append('serie_ano', data.serie_ano ?? '');
        formData.append('nome_mae', (data.nome_mae ?? '').trim());
        formData.append('nome_pai', (data.nome_pai ?? '').trim());
        formData.append('telefone_1', somenteDigitos(data.telefone_1));
        formData.append('telefone_2', somenteDigitos(data.telefone_2));
        formData.append('endereco', data.endereco ?? '');
        formData.append('recomendacoes_medicas', (data.recomendacoes_medicas ?? '').trim());

        if (fotoFile) {
          formData.append('foto', fotoFile);
        } else if (removerFoto) {
          formData.append('remover_foto', 'true');
        }
        if (documentoFile) formData.append('documento', documentoFile);
        if (atestadoFile) formData.append('atestado', atestadoFile);

        await api.put(`/alunos/${initialData.id_aluno}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        // Sincronizar alterações de turmas (novas matrículas e cancelamentos via checkbox)
        const idsAtuais = new Set(
          matriculasAtivas.map((m) => m.turma?.id_turma).filter((id): id is number => id !== undefined),
        );
        const idsParaAdicionar = selectedTurmas.filter((id) => !idsAtuais.has(id));
        const matriculasParaCancelar = matriculasAtivas.filter(
          (m) => m.turma && !selectedTurmas.includes(m.turma.id_turma),
        );

        try {
          for (const m of matriculasParaCancelar) {
            await api.delete(`/matriculas/${m.id_matricula}`);
          }
          for (const idTurma of idsParaAdicionar) {
            await api.post('/matriculas/', {
              id_aluno: initialData.id_aluno,
              id_turma: idTurma,
            });
          }
        } catch {
          await mutate(`/alunos/${initialData.id_aluno}`);
          await mutate('/alunos/');
          toast('Dados salvos, mas não foi possível atualizar as turmas.', 'warning');
          return;
        }

        await mutate(`/alunos/${initialData.id_aluno}`);
        await mutate('/alunos/');
        toast('Aluno atualizado com sucesso!', 'success');
      } else {
        const formData = new FormData();

        formData.append('nome_completo', data.nome_completo ?? '');
        formData.append('data_nascimento', data.data_nascimento ?? '');
        formData.append('escola', data.escola ?? '');
        formData.append('serie_ano', data.serie_ano ?? '');
        formData.append('nome_mae', (data.nome_mae ?? '').trim());

        if (data.nome_pai) formData.append('nome_pai', data.nome_pai.trim());
        formData.append('telefone_1', somenteDigitos(data.telefone_1));
        if (data.telefone_2) formData.append('telefone_2', somenteDigitos(data.telefone_2));
        formData.append('endereco', data.endereco ?? '');
        if (data.recomendacoes_medicas) formData.append('recomendacoes_medicas', data.recomendacoes_medicas.trim());

        formData.append('ids_turmas', selectedTurmas.join(','));

        if (fotoFile) formData.append('foto', fotoFile);
        if (documentoFile) formData.append('documento', documentoFile);
        if (atestadoFile) formData.append('atestado', atestadoFile);

        await api.post('/alunos/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        await mutate('/alunos/');
        toast('Aluno cadastrado com sucesso!', 'success');
      }

      router.push('/dashboard/alunos');
    } catch (error: any) {
      console.error('Erro ao salvar aluno (Response):', error.response?.data);
      if (isEditing && initialData?.id_aluno) {
        await mutate(`/alunos/${initialData.id_aluno}`);
      }
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.msg || `${e.loc?.join('.')} - ${e.msg}`).join('\n')
        : detail;
      toast(msg || 'Erro ao salvar aluno.', 'error');
    }
  };

  const toggleTurma = (id: number) => {
    setSelectedTurmas((prev) => {
      const proximo = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id];
      if (proximo.length > 0) setErroTurmas(null);
      return proximo;
    });
  };

  const phoneRegisterOptions = {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = formatarTelefone(e.target.value);
    },
  };

  const msgErro = (e: any) => e?.message as string | undefined;

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Editar aluno' : 'Novo aluno'}
        description={
          isEditing
            ? 'Atualize os dados do aluno abaixo.'
            : 'Preencha os dados abaixo para cadastrar um novo aluno.'
        }
      />
      <form onSubmit={handleSubmit(onSubmit, validarExtrasCadastro)} noValidate className="space-y-6">
        <Secao titulo="Foto do aluno">
          <div className="flex flex-col items-center gap-6 md:flex-row">
            <div className="relative">
              <div className="flex size-28 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-muted">
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Pré-visualização da foto" className="size-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-fg-subtle">
                    <ImageIcon className="size-8" aria-hidden="true" />
                    <span className="mt-1 text-xs">Sem foto</span>
                  </div>
                )}
              </div>
              {fotoPreview && (
                <IconButton
                  type="button"
                  aria-label="Remover foto"
                  variant="danger"
                  size="sm"
                  className="absolute -right-2 -top-2 rounded-full"
                  onClick={() => {
                    setFotoPreview(null);
                    setFotoFile(null);
                    setRemoverFoto(true);
                  }}
                >
                  <X />
                </IconButton>
              )}
            </div>
            <label className="flex h-28 w-full flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-muted/40 transition-colors hover:border-primary">
              <UploadCloud className="mb-2 size-6 text-fg-subtle" aria-hidden="true" />
              <p className="text-sm text-fg-muted">
                <span className="font-medium text-primary">Clique para selecionar</span> a foto
              </p>
              <p className="mt-1 text-xs text-fg-subtle">JPG, PNG ou WEBP (máx. 5 MB)</p>
              <input
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFotoChange}
                aria-label="Foto do aluno"
              />
            </label>
          </div>
        </Secao>

        <Secao titulo="Dados pessoais">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Nome completo" htmlFor="nome_completo" required error={msgErro(errors.nome_completo)}>
              <Input
                id="nome_completo"
                placeholder="Ex: João Pedro Silva"
                {...register('nome_completo', { required: 'Nome é obrigatório' })}
              />
            </Field>
            <Field label="Data de nascimento" htmlFor="data_nascimento" required error={msgErro(errors.data_nascimento)}>
              <Input
                id="data_nascimento"
                type="date"
                {...register('data_nascimento', { required: 'Data é obrigatória' })}
              />
            </Field>
            <Field label="Escola" htmlFor="escola" required error={msgErro(errors.escola)}>
              <Input
                id="escola"
                placeholder="Nome da escola"
                {...register('escola', { required: 'Escola é obrigatória' })}
              />
            </Field>
            <Field label="Série / Ano" htmlFor="serie_ano" required error={msgErro(errors.serie_ano)}>
              <Input
                id="serie_ano"
                placeholder="Ex: 7º Ano"
                {...register('serie_ano', { required: 'Série/Ano é obrigatório' })}
              />
            </Field>
          </div>
        </Secao>

        <Secao titulo="Responsável">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Nome da mãe" htmlFor="nome_mae" required error={msgErro(errors.nome_mae)}>
              <Input
                id="nome_mae"
                placeholder="Nome completo da mãe"
                {...register('nome_mae', { required: 'Nome da mãe é obrigatório' })}
              />
            </Field>
            <Field label="Nome do pai" htmlFor="nome_pai">
              <Input id="nome_pai" placeholder="Nome completo do pai" {...register('nome_pai')} />
            </Field>
          </div>
        </Secao>

        <Secao titulo="Contato">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Telefone 1 (principal)" htmlFor="telefone_1" required error={msgErro(errors.telefone_1)}>
              <Input
                id="telefone_1"
                inputMode="tel"
                maxLength={15}
                placeholder="(62) 99999-1234"
                {...register('telefone_1', { required: 'Telefone é obrigatório', ...phoneRegisterOptions })}
              />
            </Field>
            <Field label="Telefone 2 (opcional)" htmlFor="telefone_2">
              <Input
                id="telefone_2"
                inputMode="tel"
                maxLength={15}
                placeholder="(62) 99999-1234"
                {...register('telefone_2', phoneRegisterOptions)}
              />
            </Field>
            <Field
              label="Endereço completo"
              htmlFor="endereco"
              required
              error={msgErro(errors.endereco)}
              className="md:col-span-2"
            >
              <Input
                id="endereco"
                placeholder="Rua, número, bairro, cidade - UF"
                {...register('endereco', { required: 'Endereço é obrigatório' })}
              />
            </Field>
          </div>
        </Secao>

        <Secao titulo="Saúde e documentos">
          <div className="space-y-5">
            <Field label="Recomendações médicas / alergias" htmlFor="recomendacoes_medicas">
              <Textarea
                id="recomendacoes_medicas"
                rows={3}
                placeholder="Liste alergias, medicamentos controlados ou restrições..."
                {...register('recomendacoes_medicas')}
              />
            </Field>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FileUploadField
                id="atestado"
                label="Atestado médico"
                file={atestadoFile}
                onFileChange={handleAtestadoChange}
                accept=".pdf,image/*"
                required={!isEditing}
                error={erroAtestado ?? undefined}
              />
              <FileUploadField
                id="documento"
                label="Documento (RG/CPF/Certidão)"
                file={documentoFile}
                onFileChange={handleDocumentoChange}
                accept=".pdf,image/*"
                required={!isEditing}
                error={erroDocumento ?? undefined}
              />
            </div>
          </div>
        </Secao>

        <Secao titulo="Matrícula" required={!isEditing}>
          {isEditing && matriculasAtivas.length > 0 && (
            <div className="mb-5 space-y-2">
              <p className="text-sm font-medium text-fg">Matrículas ativas</p>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {matriculasAtivas.map((m) => {
                  const nomeTurma = m.turma?.descricao || `Turma #${m.turma?.id_turma}`;
                  return (
                    <li
                      key={m.id_matricula}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{nomeTurma}</p>
                        {m.turma?.categoria_idade && (
                          <p className="text-xs text-fg-muted">{m.turma.categoria_idade}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        leftIcon={<Trash2 className="size-3.5" />}
                        onClick={() => setMatriculaParaCancelar(m)}
                      >
                        Cancelar matrícula
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="mb-4 text-sm text-fg-muted">
            {isEditing
              ? 'Marque ou desmarque as turmas desejadas e salve as alterações.'
              : 'Selecione pelo menos uma turma em que o aluno será matriculado.'}
            {!isEditing && (
              <span aria-hidden="true" className="ml-0.5 text-danger">
                *
              </span>
            )}
          </p>

          {turmasDisponiveis ? (
            <div
              role="group"
              aria-label="Turmas disponíveis"
              aria-required={!isEditing}
              aria-invalid={Boolean(erroTurmas)}
              className={cn(
                'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3',
                erroTurmas && 'rounded-xl ring-1 ring-danger p-2',
              )}
            >
              {turmasDisponiveis.map((turma: any) => {
                const marcada = selectedTurmas.includes(turma.id_turma);
                return (
                  <label
                    key={turma.id_turma}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150',
                      marcada ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <Checkbox checked={marcada} onChange={() => toggleTurma(turma.id_turma)} className="mt-0.5" />
                    <span>
                      <span className={cn('block text-sm font-medium', marcada ? 'text-primary' : 'text-fg')}>
                        {turma.descricao || `Turma #${turma.id_turma}`}
                      </span>
                      <span className="block text-xs text-fg-muted">{turma.categoria_idade}</span>
                    </span>
                  </label>
                );
              })}
              {turmasDisponiveis.length === 0 && <p className="text-sm text-fg-muted">Nenhuma turma cadastrada.</p>}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">Carregando turmas...</p>
          )}

          {erroTurmas && (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-danger">
              <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
              {erroTurmas}
            </p>
          )}
        </Secao>

        <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 border-t border-line bg-canvas/90 px-1 py-4 backdrop-blur">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Salvar alterações' : 'Cadastrar aluno'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={!!matriculaParaCancelar}
        onOpenChange={(v) => !v && setMatriculaParaCancelar(null)}
        title="Cancelar matrícula?"
        description={
          <>
            A matrícula de <strong>{initialData?.nome_completo}</strong> na turma{' '}
            <strong>
              {matriculaParaCancelar?.turma?.descricao || `Turma #${matriculaParaCancelar?.turma?.id_turma}`}
            </strong>{' '}
            será cancelada.
          </>
        }
        confirmLabel="Cancelar matrícula"
        onConfirm={confirmarCancelamentoMatricula}
      />
    </div>
  );
}

function Secao({
  titulo,
  required,
  children,
}: {
  titulo: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        title={
          required ? (
            <span>
              {titulo}
              <span aria-hidden="true" className="ml-0.5 text-danger">
                *
              </span>
            </span>
          ) : (
            titulo
          )
        }
      />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function FileUploadField({ id, label, file, onFileChange, accept, required, error }: any) {
  return (
    <Field label={label} htmlFor={id} required={required} error={error}>
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted/40 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{file.name}</p>
              <p className="text-xs text-fg-muted tabular-nums">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <IconButton type="button" aria-label={`Remover ${label}`} size="sm" onClick={() => onFileChange(null)}>
            <X />
          </IconButton>
        </div>
      ) : (
        <div className="relative">
          <input
            id={id}
            type="file"
            aria-required={required}
            aria-invalid={Boolean(error)}
            className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
            accept={accept}
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg border border-dashed bg-surface px-4 py-3 text-sm text-fg-muted',
              error ? 'border-danger' : 'border-line-strong',
            )}
          >
            <UploadCloud className="size-4 text-fg-subtle" aria-hidden="true" />
            <span>Selecione o arquivo (PDF ou imagem)</span>
          </div>
        </div>
      )}
    </Field>
  );
}
