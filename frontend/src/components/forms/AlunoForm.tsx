'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { UploadCloud, Image as ImageIcon, X, FileCheck } from 'lucide-react';
import api from '@/lib/api';
import useSWR from 'swr';
import { cn } from '@/lib/cn';
import { useNotification } from '@/context/NotificationContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { Button, Card, CardBody, CardHeader, Checkbox, Field, IconButton, Input, PageHeader, Textarea } from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(res => res.data);

interface AlunoFormProps {
  initialData?: any; 
  isEditing?: boolean;
}

export default function AlunoForm({ initialData, isEditing = false }: AlunoFormProps) {
  const router = useRouter();
  const { toast } = useNotification();
  useBreadcrumb([
    { label: 'Alunos', href: '/dashboard/alunos' },
    { label: isEditing ? (initialData?.nome_completo ?? 'Editar aluno') : 'Nova matrícula' },
  ]);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    mode: 'onChange'
  });
  const [selectedTurmas, setSelectedTurmas] = useState<number[]>([]);
  const { data: turmasDisponiveis } = useSWR('/turmas/', fetcher);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [atestadoFile, setAtestadoFile] = useState<File | null>(null);
  const [documentoFile, setDocumentoFile] = useState<File | null>(null);

  useEffect(() => {
    if (initialData) {
      Object.keys(initialData).forEach(key => {
        setValue(key, initialData[key]);
      });
      if (initialData.ids_turmas) setSelectedTurmas(initialData.ids_turmas);
      
      if (initialData.foto && typeof initialData.foto === 'string') {
        setFotoPreview(`http://localhost:8000/${initialData.foto}`); 
      }
    }
  }, [initialData, setValue]);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: any) => {
    if (!isEditing && (!atestadoFile || !documentoFile)) {
      toast('Atestado Médico e Documento Pessoal são obrigatórios para novos cadastros.', 'warning');
      return;
    }

    try {
      if (isEditing) {
        const formData = new FormData();
        formData.append('nome_completo', data.nome_completo);
        formData.append('data_nascimento', data.data_nascimento);
        formData.append('escola', data.escola);
        formData.append('serie_ano', data.serie_ano);
        formData.append('nome_mae', data.nome_mae);
        
        if (data.nome_pai) formData.append('nome_pai', data.nome_pai);
        formData.append('telefone_1', data.telefone_1);
        if (data.telefone_2) formData.append('telefone_2', data.telefone_2);
        formData.append('endereco', data.endereco);
        if (data.recomendacoes_medicas) formData.append('recomendacoes_medicas', data.recomendacoes_medicas);
        
        if (fotoFile) formData.append('foto', fotoFile);
        if (documentoFile) formData.append('documento', documentoFile);
        if (atestadoFile) formData.append('atestado', atestadoFile);

        await api.put(`/alunos/${initialData.id_aluno}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        toast('Aluno atualizado com sucesso!', 'success');
      } else {
        const formData = new FormData();

        formData.append('nome_completo', data.nome_completo);
        formData.append('data_nascimento', data.data_nascimento);
        formData.append('escola', data.escola);
        formData.append('serie_ano', data.serie_ano);
        formData.append('nome_mae', data.nome_mae);
        
        if (data.nome_pai) formData.append('nome_pai', data.nome_pai);
        formData.append('telefone_1', data.telefone_1);
        if (data.telefone_2) formData.append('telefone_2', data.telefone_2);
        formData.append('endereco', data.endereco);
        if (data.recomendacoes_medicas) formData.append('recomendacoes_medicas', data.recomendacoes_medicas);
        
        if (selectedTurmas.length > 0) {
          formData.append('ids_turmas', selectedTurmas.join(','));
        } else {
          formData.append('ids_turmas', ''); 
        }
        
        if (fotoFile) formData.append('foto', fotoFile);
        if (documentoFile) formData.append('documento', documentoFile);
        if (atestadoFile) formData.append('atestado', atestadoFile);

        await api.post('/alunos/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        toast('Aluno cadastrado com sucesso!', 'success');
      }
      
      router.push('/dashboard/alunos');
    } catch (error: any) {
      console.error("Erro ao salvar aluno (Response):", error.response?.data);
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((e: any) => `${e.loc.join('.')} - ${e.msg}`).join('\n') : detail;
      toast(msg || 'Erro ao salvar aluno.', 'error');
    }
  };

  const toggleTurma = (id: number) => {
    setSelectedTurmas(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const phoneRegisterOptions = {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    }
  };

  const msgErro = (e: any) => (e?.message as string | undefined);

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Editar aluno' : 'Nova matrícula'}
        description={isEditing ? 'Atualize os dados do aluno abaixo.' : 'Preencha os dados abaixo para matricular um novo aluno.'}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
              <input type="file" className="sr-only" accept="image/*" onChange={handleFotoChange} aria-label="Foto do aluno" />
            </label>
          </div>
        </Secao>

        <Secao titulo="Dados pessoais">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Nome completo" htmlFor="nome_completo" required error={msgErro(errors.nome_completo)}>
              <Input id="nome_completo" placeholder="Ex: João Pedro Silva" {...register('nome_completo', { required: 'Nome é obrigatório' })} />
            </Field>
            <Field label="Data de nascimento" htmlFor="data_nascimento" required error={msgErro(errors.data_nascimento)}>
              <Input id="data_nascimento" type="date" {...register('data_nascimento', { required: 'Data é obrigatória' })} />
            </Field>
            <Field label="Escola" htmlFor="escola" required error={msgErro(errors.escola)}>
              <Input id="escola" placeholder="Nome da escola" {...register('escola', { required: 'Escola é obrigatória' })} />
            </Field>
            <Field label="Série / Ano" htmlFor="serie_ano" required error={msgErro(errors.serie_ano)}>
              <Input id="serie_ano" placeholder="Ex: 7º Ano" {...register('serie_ano', { required: 'Série/Ano é obrigatório' })} />
            </Field>
          </div>
        </Secao>

        <Secao titulo="Responsável">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Nome da mãe" htmlFor="nome_mae" required error={msgErro(errors.nome_mae)}>
              <Input id="nome_mae" placeholder="Nome completo da mãe" {...register('nome_mae', { required: 'Nome da mãe é obrigatório' })} />
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
                inputMode="numeric"
                placeholder="Apenas números"
                {...register('telefone_1', { required: 'Telefone é obrigatório', ...phoneRegisterOptions })}
              />
            </Field>
            <Field label="Telefone 2 (opcional)" htmlFor="telefone_2">
              <Input id="telefone_2" inputMode="numeric" placeholder="Apenas números" {...register('telefone_2', phoneRegisterOptions)} />
            </Field>
            <Field label="Endereço completo" htmlFor="endereco" required error={msgErro(errors.endereco)} className="md:col-span-2">
              <Input id="endereco" placeholder="Rua, número, bairro, cidade - UF" {...register('endereco', { required: 'Endereço é obrigatório' })} />
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
              <FileUploadField id="atestado" label="Atestado médico" file={atestadoFile} onFileChange={setAtestadoFile} accept=".pdf,image/*" required={!isEditing} />
              <FileUploadField id="documento" label="Documento (RG/CPF/Certidão)" file={documentoFile} onFileChange={setDocumentoFile} accept=".pdf,image/*" required={!isEditing} />
            </div>
          </div>
        </Secao>

        <Secao titulo="Matrícula">
          <p className="mb-4 text-sm text-fg-muted">Selecione as turmas em que o aluno será matriculado.</p>
          {turmasDisponiveis ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={titulo} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function FileUploadField({ id, label, file, onFileChange, accept, required }: any) {
  return (
    <Field label={label} htmlFor={id} required={required}>
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
            className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
            accept={accept}
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-3 text-sm text-fg-muted">
            <UploadCloud className="size-4 text-fg-subtle" aria-hidden="true" />
            <span>Selecione o arquivo (PDF ou imagem)</span>
          </div>
        </div>
      )}
    </Field>
  );
}
