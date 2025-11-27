from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, time, datetime
from enum import Enum

class RoleEnum(str, Enum):
    admin = "admin",
    coordenador = "coordenador",
    professor = "professor",
    assistente = "assistente"

class TipoParticipanteEnum(str, Enum):
    Aluno = "Aluno",
    Atleta = "Atleta"

class statusPresencaEnum(str, Enum):
    Presente = "Presente",
    Ausente = "Ausente",
    Justificado = "Justificado" 

class ModalidadeBase(BaseModel):
    nome: str = Field(..., max_length=100)
    descricao: Optional[str] = Field(None, max_length=500)

class ModalidadeCreate(ModalidadeBase):
    pass

class Modalidade(ModalidadeBase):
    id_modalidade: int
    
    class Config:
        from_attributes = True

class UsuarioBase(BaseModel):
    username: str = Field(..., max_length=150)
    role: RoleEnum = RoleEnum.professor

class Usuario(UsuarioBase):
    id_usuario: int

    class Config:
        from_attributes = True

class ProfessorBase(BaseModel):
    nome: str = Field(..., max_length=200)
    cpf: str
    contato: Optional[str] = Field(None, max_length=20)

class ProfessorCreate(ProfessorBase):
    pass

class Professor(ProfessorBase):
    id_professor: int
    usuario: Optional[Usuario] = None

    class Config:
        from_attributes = True

class ProfessorCreatedResponse(Professor):
    senha_temporaria: str

class TurmaBase(BaseModel):
    descricao: Optional[str] = Field(None, max_length=100)
    categoria_idade: str = Field(..., max_length=50)
    horario_inicio: time
    horario_fim: time
    dias_semana: str = Field(..., max_length=200)
    id_modalidade: int
    id_professor: int

class TurmaCreate(TurmaBase):
    pass

class Turma(TurmaBase):
    id_turma: int
    modalidade: Modalidade
    professor: Professor

    class Config:
        from_attributes = True

class AlunoBase(BaseModel):
    nome_completo: str = Field(..., max_length=500)
    data_nascimento: date
    escola: Optional[str] = Field(None, max_length=100)
    serie_ano: Optional[str] = None
    nome_mae: Optional[str] = None
    nome_pai: Optional[str] = None
    telefone_1: Optional[str] = None
    telefone_2: Optional[str] = None
    endereco: Optional[str] = None
    recomendacoes_medicas: Optional[str] = None

class AlunoCreate(AlunoBase):
    id_turma: int

class Aluno(AlunoBase):
    id_aluno: int
    id_participante: int

    class Config:
        from_attributes = True

class MatriculaBase(BaseModel):
    id_aluno: int
    id_turma: int


class MatriculaCreate(MatriculaBase):
    pass


class Matricula(MatriculaBase):
    id_matricula: int
    data_matricula: date
    ativo: bool
    aluno: Optional[Aluno] = None
    turma: Optional[Turma] = None

    class Config:
        from_attributes = True


class PresencaBase(BaseModel):
    id_matricula: int
    data_aula: date
    status: statusPresencaEnum = statusPresencaEnum.Presente
    observacao: Optional[str] = None


class PresencaCreate(PresencaBase):
    pass


class Presenca(PresencaBase):
    id_presenca: int

    class Config:
        from_attributes = True