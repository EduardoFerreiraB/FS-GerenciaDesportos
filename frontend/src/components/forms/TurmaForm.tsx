'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { CircleAlert, Save } from 'lucide-react';
import useSWR from 'swr';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useNotification } from '@/context/NotificationContext';
import { Button, Card, CardBody, CardHeader, Field, Input, PageHeader, Select } from '@/components/ui';

const fetcher = (url: string) => api.get(url).then(res => res.data);

const diasSemana = [
  { id: 'SEG', label: 'Segunda' },
  { id: 'TER', label: 'Terça' },
  { id: 'QUA', label: 'Quarta' },
  { id: 'QUI', label: 'Quinta' },
  { id: 'SEX', label: 'Sexta' },
  { id: 'SAB', label: 'Sábado' },
  { id: 'DOM', label: 'Domingo' },
];

interface TurmaFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export default function TurmaForm({ initialData, isEditing = false }: TurmaFormProps) {
  const router = useRouter();
  const { toast } = useNotification();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    mode: 'onChange'
  });
  const [selectedDias, setSelectedDias] = useState<string[]>([]);
  const [tentouEnviar, setTentouEnviar] = useState(false);

  const nomeTurma = initialData?.descricao || (initialData?.id_turma ? `Turma #${initialData.id_turma}` : 'Turma');
  useBreadcrumb(
    isEditing && initialData
      ? [
          { label: 'Turmas', href: '/dashboard/turmas' },
          { label: nomeTurma, href: `/dashboard/turmas/${initialData.id_turma}` },
          { label: 'Editar' },
        ]
      : [{ label: 'Turmas', href: '/dashboard/turmas' }, { label: 'Nova turma' }],
  );

  // Buscar dados reais para os selects
  const { data: modalidades } = useSWR('/modalidades/', fetcher);
  const { data: professores } = useSWR('/professores/', fetcher);

  useEffect(() => {
    if (initialData) {
      Object.keys(initialData).forEach(key => {
        if (key !== 'dias_semana') {
          // Mapeamento de IDs para os nomes dos campos do formulário
          if (key === 'id_modalidade') setValue('modalidade_id', initialData[key].toString());
          else if (key === 'id_professor') setValue('professor_id', initialData[key].toString());
          else setValue(key, initialData[key]);
        }
      });

      // Ajuste: A API provavelmente retorna string "SEG,QUA" ou JSON. O form usa array.
      if (initialData.dias_semana) {
        if (Array.isArray(initialData.dias_semana)) {
          setSelectedDias(initialData.dias_semana);
        } else if (typeof initialData.dias_semana === 'string') {
          try {
            // Tenta limpar aspas simples se vier do Python string representation
            const cleanStr = initialData.dias_semana.replace(/'/g, '"');
            if (cleanStr.startsWith('[')) {
                 const parsed = JSON.parse(cleanStr);
                 setSelectedDias(Array.isArray(parsed) ? parsed : [initialData.dias_semana]);
            } else {
                 setSelectedDias(initialData.dias_semana.split(',').map((d:string) => d.trim()));
            }
          } catch {
             setSelectedDias(initialData.dias_semana.split(',').map((d:string) => d.trim()));
          }
        }
      }
    }
  }, [initialData, setValue]);

  // Os <select> só têm as opções depois que as listas chegam; reaplica o valor
  // inicial para o navegador não ficar preso em "Selecione...".
  useEffect(() => {
    if (initialData?.id_modalidade != null && modalidades) setValue('modalidade_id', initialData.id_modalidade.toString());
  }, [initialData, modalidades, setValue]);
  useEffect(() => {
    if (initialData?.id_professor != null && professores) setValue('professor_id', initialData.id_professor.toString());
  }, [initialData, professores, setValue]);

  const toggleDia = (id: string) => {
    setSelectedDias(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const onSubmit = async (data: any) => {
    setTentouEnviar(true);
    if (selectedDias.length === 0) {
      toast('Selecione pelo menos um dia da semana.', 'warning');
      return;
    }

    try {
      // Limpeza de horários para garantir HH:MM:SS
      const inicio = data.horario_inicio.length === 5 ? data.horario_inicio + ":00" : data.horario_inicio;
      const fim = data.horario_fim.length === 5 ? data.horario_fim + ":00" : data.horario_fim;

      const payload = {
        descricao: data.descricao,
        categoria_idade: data.categoria_idade,
        horario_inicio: inicio,
        horario_fim: fim,
        dias_semana: selectedDias,
        id_modalidade: parseInt(data.modalidade_id),
        id_professor: parseInt(data.professor_id)
      };

      if (isEditing) {
        // Ao atualizar, usamos o ID da URL ou do initialData
        await api.put(`/turmas/${initialData.id_turma}`, payload);
        toast('Turma atualizada com sucesso!', 'success');
      } else {
        await api.post('/turmas/', payload);
        toast('Turma criada com sucesso!', 'success');
      }
      router.push('/dashboard/turmas');
    } catch (error: any) {
      console.error("Erro detalhado:", error.response?.data);

      // Tratamento melhorado para exibir o erro real do Pydantic (422) ou lógica (400)
      let errorMessage = 'Erro ao salvar turma.';
      if (error.response?.data?.detail) {
          const detail = error.response.data.detail;
          if (Array.isArray(detail)) {
              // Erro de validação Pydantic (422)
              errorMessage = detail.map((e: any) => `${e.loc[1]}: ${e.msg}`).join('\n');
          } else {
              // Erro de lógica (400)
              errorMessage = detail;
          }
      }

      toast(errorMessage, 'error');
    }
  };

  const erroDias = tentouEnviar && selectedDias.length === 0;

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Editar Turma' : 'Nova Turma'}
        description={isEditing ? 'Altere os dados da turma abaixo.' : 'Preencha os dados para criar uma nova turma.'}
      />

      <form
        onSubmit={(e) => { setTentouEnviar(true); return handleSubmit(onSubmit)(e); }}
        className="space-y-6"
        noValidate
      >
        <Card>
          <CardHeader title="Informações da Turma" description="Modalidade, responsável e identificação da turma." />
          <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Modalidade" htmlFor="modalidade_id" required error={errors.modalidade_id?.message as string}>
              <Select id="modalidade_id" {...register('modalidade_id', { required: 'Selecione uma modalidade' })}>
                <option value="">Selecione...</option>
                {modalidades?.map((m: any) => (
                  <option key={m.id_modalidade} value={m.id_modalidade}>{m.nome}</option>
                ))}
              </Select>
            </Field>

            <Field label="Professor Responsável" htmlFor="professor_id" required error={errors.professor_id?.message as string}>
              <Select id="professor_id" {...register('professor_id', { required: 'Selecione um professor' })}>
                <option value="">Selecione...</option>
                {professores?.map((p: any) => (
                  <option key={p.id_professor} value={p.id_professor}>{p.nome}</option>
                ))}
              </Select>
            </Field>

            <Field label="Categoria / Idade" htmlFor="categoria_idade" required error={errors.categoria_idade?.message as string}>
              <Input
                id="categoria_idade"
                placeholder="Ex: Sub-11, Adulto..."
                {...register('categoria_idade', { required: 'A categoria é obrigatória' })}
              />
            </Field>

            <Field label="Descrição / Nome da Turma" htmlFor="descricao" required error={errors.descricao?.message as string}>
              <Input
                id="descricao"
                placeholder="Ex: Futebol Manhã Iniciante"
                {...register('descricao', { required: 'O nome/descrição é obrigatório' })}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Horários e Dias" description="Quando as aulas acontecem." />
          <CardBody className="space-y-5">
            <fieldset aria-describedby={selectedDias.length === 0 ? "dias-semana-ajuda" : undefined}>
              <legend className="mb-2 text-sm font-medium text-fg">
                Dias da Semana
                <span aria-hidden="true" className="ml-0.5 text-danger">*</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {diasSemana.map((dia) => {
                  const ativo = selectedDias.includes(dia.id);
                  return (
                    <button
                      key={dia.id}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => toggleDia(dia.id)}
                      className={cn(
                        'h-10 rounded-lg border px-4 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-focus',
                        ativo
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-line-strong bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg',
                      )}
                    >
                      {dia.label}
                    </button>
                  );
                })}
              </div>
              {erroDias ? (
                <p id="dias-semana-ajuda" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
                  <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                  Selecione pelo menos um dia.
                </p>
              ) : selectedDias.length === 0 ? (
                <p id="dias-semana-ajuda" className="mt-1.5 text-xs text-fg-subtle">Selecione pelo menos um dia.</p>
              ) : null}
            </fieldset>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Horário de Início" htmlFor="horario_inicio" required error={errors.horario_inicio ? 'Campo obrigatório' : undefined}>
                <Input id="horario_inicio" type="time" className="tabular-nums" {...register('horario_inicio', { required: 'Obrigatório' })} />
              </Field>
              <Field label="Horário de Fim" htmlFor="horario_fim" required error={errors.horario_fim ? 'Campo obrigatório' : undefined}>
                <Input id="horario_fim" type="time" className="tabular-nums" {...register('horario_fim', { required: 'Obrigatório' })} />
              </Field>
            </div>
          </CardBody>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-2 border-t border-line bg-canvas px-1 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting} leftIcon={<Save className="size-4" />}>
            {isEditing ? 'Salvar Alterações' : 'Criar Turma'}
          </Button>
        </div>
      </form>
    </div>
  );
}
