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

class DiaSemanaEnum(str, Enum):
    SEG = "SEG",
    TER = "TER",
    QUA = "QUA",
    QUI = "QUI",
    SEX = "SEX",
    SAB = "SAB",
    DOM = "DOM"

class StatusPartidaEnum(str, Enum):
    Agendada = "Agendada",
    EmAndamento = "Em Andamento",
    Finalizada = "Finalizada",
    Cancelada = "Cancelada"

class ModalidadeBase(BaseModel):
    nome: str = Field(..., max_length=100)
    descricao: Optional[str] = Field(None, max_length=500)

class ModalidadeCreate(ModalidadeBase):
    pass

class ModalidadeUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=100)
    descricao: Optional[str] = Field(None, max_length=500)

class Modalidade(ModalidadeBase):
    id_modalidade: int
    
    class Config:
        from_attributes = True

class UsuarioBase(BaseModel):
    username: str = Field(..., max_length=150)
    role: RoleEnum = RoleEnum.professor

class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=6)

class UsuarioUpdateRole(BaseModel):
    role: RoleEnum

class Usuario(UsuarioBase):
    id_usuario: int

    class Config:
        from_attributes = True

class UsuarioResponse(UsuarioBase):
    id_usuario: int
    
    class Config:
        from_attributes = True

class ProfessorBase(BaseModel):
    nome: str = Field(..., max_length=200)
    cpf: str
    contato: Optional[str] = Field(None, max_length=20)

class ProfessorCreate(ProfessorBase):
    username: str = Field(..., max_length=150)
    password: str = Field(..., min_length=6)

class ProfessorUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=200)
    cpf: Optional[str] = None
    contato: Optional[str] = Field(None, max_length=20)

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
    dias_semana: List[DiaSemanaEnum] = []
    id_modalidade: int
    id_professor: int

class TurmaCreate(TurmaBase):
    pass

class TurmaUpdate(BaseModel):
    descricao: Optional[str] = Field(None, max_length=100)
    categoria_idade: Optional[str] = Field(None, max_length=50)
    horario_inicio: Optional[time] = None
    horario_fim: Optional[time] = None
    dias_semana: Optional[List[DiaSemanaEnum]] = None
    id_modalidade: Optional[int] = None
    id_professor: Optional[int] = None

class Turma(TurmaBase):
    id_turma: int
    dias_semana: str | List[DiaSemanaEnum]
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
    ids_turmas: List[int]

class AlunoUpdate(BaseModel):
    nome_completo: Optional[str] = Field(None, max_length=500)
    data_nascimento: Optional[date] = None
    escola: Optional[str] = Field(None, max_length=100)
    serie_ano: Optional[str] = None
    nome_mae: Optional[str] = None
    nome_pai: Optional[str] = None
    telefone_1: Optional[str] = None
    telefone_2: Optional[str] = None
    endereco: Optional[str] = None
    recomendacoes_medicas: Optional[str] = None

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

class LocalBase(BaseModel):
    loca_nome: str = Field(..., max_length=200)
    loca_descricao: Optional[str] = None
    ativo: bool = True

class LocalCreate(LocalBase):
    pass

class Local(LocalBase):
    id_local: int

    class Config:
        from_attributes = True
    
class ArbitroBase(BaseModel):
    apito_nome: str
    apito_doc: Optional[str] = None
    apito_tel: Optional[str] = None

class ArbitroCreate(ArbitroBase):
    pass

class Arbitro(ArbitroBase):
    id_arbitro: int
    
    class Config:
        from_attributes = True

class EventoBase(BaseModel):
    even_nome: str = Field(..., max_length=150)
    descricao: Optional[str] = None

class EventoCreate(EventoBase):
    modalidade_ids: List[int] = []

class Evento(EventoBase):
    id_evento: int
    modalidades: List[Modalidade] = []

    class Config:
        from_attributes = True

class EdicaoBase(BaseModel):
    id_evento: int
    edic_ano: int
    data_inicio: date
    data_fim: date

class EdicaoCreate(EdicaoBase):
    pass

class Edicao(EdicaoBase):
    id_edicao: int
    evento: Optional[Evento] = None

    class Config:
        from_attributes = True

class PartidaBase(BaseModel):
    id_edicao: int
    id_local: int
    id_arbitro: int
    id_modalidade: int
    part_data: date
    status: StatusPartidaEnum = StatusPartidaEnum.Agendada
    part_hora: time

class PartidaCreate(PartidaBase):
    pass

class Partida(PartidaBase):
    id_partida: int
    edicao: Optional[Edicao] = None
    local: Optional[Local] = None
    arbitro: Optional[Arbitro] = None
    modalidade: Optional[Modalidade] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None