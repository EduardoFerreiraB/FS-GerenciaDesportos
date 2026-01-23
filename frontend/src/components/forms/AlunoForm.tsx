'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { 
  UserPlus, 
  UploadCloud, 
  Image as ImageIcon, 
  FileText, 
  Save, 
  X,
  AlertCircle,
  FileCheck,
  Pencil
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';
import useSWR from 'swr';

const fetcher = (url: string) => api.get(url).then(res => res.data);

interface AlunoFormProps {
  initialData?: any; 
  isEditing?: boolean;
}

export default function AlunoForm({ initialData, isEditing = false }: AlunoFormProps) {
  const router = useRouter();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm();
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
    try {
      if (isEditing) {
        const jsonPayload = {
          nome_completo: data.nome_completo,
          data_nascimento: data.data_nascimento,
          escola: data.escola || null,
          serie_ano: data.serie_ano || null,
          nome_mae: data.nome_mae || null,
          nome_pai: data.nome_pai || null,
          telefone_1: data.telefone_1,
          telefone_2: data.telefone_2 || null,
          endereco: data.endereco,
          recomendacoes_medicas: data.recomendacoes_medicas || null,
        };

        await api.put(`/alunos/${initialData.id_aluno}`, jsonPayload);
        alert('Aluno atualizado com sucesso!');
      } else {
        const formData = new FormData();

        formData.append('nome_completo', data.nome_completo);
        formData.append('data_nascimento', data.data_nascimento);
        

        if (data.escola) formData.append('escola', data.escola);
        if (data.serie_ano) formData.append('serie_ano', data.serie_ano);
        if (data.nome_mae) formData.append('nome_mae', data.nome_mae);
        if (data.nome_pai) formData.append('nome_pai', data.nome_pai);
        if (data.telefone_1) formData.append('telefone_1', data.telefone_1);
        if (data.telefone_2) formData.append('telefone_2', data.telefone_2);
        if (data.endereco) formData.append('endereco', data.endereco);
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
        alert('Aluno cadastrado com sucesso!');
      }
      
      router.push('/dashboard/alunos');
    } catch (error: any) {
      console.error("Erro ao salvar aluno (Response):", error.response?.data);
      console.error("Erro ao salvar aluno (Status):", error.response?.status);
      
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((e: any) => `${e.loc.join('.')} - ${e.msg}`).join('\n') : detail;
      alert(msg || 'Erro ao salvar aluno.');
    }
  };

  const toggleTurma = (id: number) => {
    setSelectedTurmas(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-12">
      
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          {isEditing ? <Pencil className="text-primary" size={28} /> : <UserPlus className="text-primary" size={28} />}
          {isEditing ? 'Editar Aluno' : 'Nova Matrícula'}
        </h1>
        <p className="text-slate-500 mt-1">
          {isEditing ? 'Atualize os dados do aluno abaixo.' : 'Preencha os dados abaixo para matricular um novo aluno.'}
        </p>
      </div>

      {/* 1. Foto do Aluno */}
      <CardSection title="Foto do Aluno" icon={ImageIcon}>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-2xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-slate-300 flex flex-col items-center">
                  <ImageIcon size={40} />
                  <span className="text-[10px] uppercase font-bold mt-1">Sem Foto</span>
                </div>
              )}
            </div>
            {fotoPreview && (
              <button 
                type="button"
                onClick={() => {
                    setFotoPreview(null);
                    setFotoFile(null);
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-primary/50 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="text-slate-400 group-hover:text-primary mb-2 transition-colors" size={28} />
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-primary">Clique para selecionar</span> ou arraste a foto
                </p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG ou WEBP (Máx. 5MB)</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFotoChange} />
            </label>
          </div>
        </div>
      </CardSection>

      {/* 2. Dados Pessoais */}
      <CardSection title="Dados Pessoais" icon={UserPlus}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input 
            label="Nome Completo" 
            placeholder="Ex: João Pedro Silva" 
            register={register('nome_completo', { required: 'Nome é obrigatório' })}
            error={errors.nome_completo}
          />
          <Input 
            label="Data de Nascimento" 
            type="date"
            register={register('data_nascimento', { required: 'Data é obrigatória' })}
            error={errors.data_nascimento}
          />
          <Input 
            label="Escola" 
            placeholder="Nome da escola" 
            register={register('escola')}
          />
          <Input 
            label="Série / Ano" 
            placeholder="Ex: 7º Ano" 
            register={register('serie_ano')}
          />
        </div>
      </CardSection>

      {/* 3. Responsáveis */}
      <CardSection title="Dados dos Responsáveis" icon={UserPlus}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Input label="Nome da Mãe" placeholder="Nome completo da mãe" register={register('nome_mae')} />
          <Input label="Nome do Pai" placeholder="Nome completo do pai" register={register('nome_pai')} />
          <Input 
            label="Telefone 1 (Principal)" 
            placeholder="(00) 00000-0000" 
            register={register('telefone_1', { required: 'Telefone é obrigatório' })}
            error={errors.telefone_1}
          />
          <Input label="Telefone 2 (Opcional)" placeholder="(00) 00000-0000" register={register('telefone_2')} />
        </div>
        <div className="w-full">
          <Input 
            label="Endereço Completo" 
            placeholder="Rua, Número, Bairro, Cidade - UF" 
            register={register('endereco', { required: 'Endereço é obrigatório' })}
            error={errors.endereco}
          />
        </div>
      </CardSection>

      {/* 4. Informações de Saúde */}
      <CardSection title="Informações de Saúde" icon={FileText}>
        <div className="space-y-6">
          <TextArea 
            label="Recomendações Médicas / Alergias" 
            placeholder="Liste alergias, medicamentos controlados ou restrições..." 
            register={register('recomendacoes_medicas')}
          />
          
          <FileUploadField 
            label="Atestado Médico"
            file={atestadoFile}
            onFileChange={setAtestadoFile}
            accept=".pdf,image/*"
          />
        </div>
      </CardSection>

      {/* 5. Documentos Pessoais */}
      <CardSection title="Documentos Pessoais" icon={FileText}>
        <FileUploadField 
          label="Documento (RG/CPF/Certidão)"
          file={documentoFile}
          onFileChange={setDocumentoFile}
          accept=".pdf,image/*"
        />
      </CardSection>

      {/* 6. Seleção de Turmas */}
      <CardSection title="Turmas" icon={UserPlus}>
        <p className="text-sm text-slate-500 mb-4">Selecione as turmas em que o aluno será matriculado:</p>
        
        {turmasDisponiveis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {turmasDisponiveis.map((turma: any) => (
              <div 
                key={turma.id_turma}
                onClick={() => toggleTurma(turma.id_turma)}
                className={clsx(
                  "cursor-pointer p-4 rounded-xl border transition-all flex items-start gap-3",
                  selectedTurmas.includes(turma.id_turma)
                    ? "bg-blue-50 border-primary shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <div className={clsx(
                  "w-5 h-5 rounded border flex items-center justify-center mt-0.5 transition-colors",
                  selectedTurmas.includes(turma.id_turma) ? "bg-primary border-primary" : "border-slate-300 bg-white"
                )}>
                  {selectedTurmas.includes(turma.id_turma) && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <div>
                  <p className={clsx("font-semibold text-sm", selectedTurmas.includes(turma.id_turma) ? "text-primary" : "text-slate-700")}>
                    {turma.descricao || `Turma #${turma.id_turma}`}
                  </p>
                  <p className="text-xs text-slate-500">{turma.categoria_idade}</p>
                </div>
              </div>
            ))}
            {turmasDisponiveis.length === 0 && <p className="text-slate-400 text-sm italic">Nenhuma turma cadastrada.</p>}
          </div>
        ) : (
          <p className="text-slate-400 text-sm animate-pulse">Carregando turmas...</p>
        )}
      </CardSection>

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors flex items-center gap-2"
        >
          <X size={20} />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-8 py-3 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-blue-200 hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <span className="animate-spin">⏳</span> : <Save size={20} />}
          {isEditing ? 'Salvar Alterações' : 'Cadastrar Aluno'}
        </button>
      </div>

    </form>
  );
}

// --- Componentes Reutilizáveis (Internos) ---

function CardSection({ title, icon: Icon, children }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
        <div className="bg-blue-100 text-primary p-2 rounded-lg">
          <Icon size={20} />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function FileUploadField({ label, file, onFileChange, accept }: any) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 transition-all">
      <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">{label}</label>
      
      {file ? (
        <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-primary/20 shadow-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-blue-50 text-primary p-2 rounded-md">
              <FileCheck size={20} />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => onFileChange(null)}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input 
            type="file" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            accept={accept}
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
          <div className="flex items-center gap-4 px-4 py-3 bg-white border border-slate-300 border-dashed rounded-lg text-sm text-slate-500 hover:border-primary/50 hover:bg-blue-50/30 transition-all">
            <UploadCloud size={18} className="text-slate-400" />
            <span>Selecione o arquivo (PDF ou Imagem)</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, type = "text", placeholder, register, error }: any) {
  return (
    <div className="w-full space-y-1.5">
      <label className="text-sm font-semibold text-slate-700 ml-1">{label}</label>
      <input
        type={type}
        className={clsx(
          "w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-slate-400",
          error ? "border-red-300 focus:ring-red-200 focus:border-red-400" : "border-slate-200 focus:ring-primary/20 focus:border-primary"
        )}
        placeholder={placeholder}
        {...register}
      />
      {error && <p className="text-xs text-red-500 flex items-center gap-1 ml-1"><AlertCircle size={12} />{error.message}</p>}
    </div>
  );
}

function TextArea({ label, placeholder, register }: any) {
  return (
    <div className="w-full space-y-1.5">
      <label className="text-sm font-semibold text-slate-700 ml-1">{label}</label>
      <textarea
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400 min-h-[100px]"
        placeholder={placeholder}
        {...register}
      />
    </div>
  );
}
