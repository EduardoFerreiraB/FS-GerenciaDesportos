from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Date,
    Time,
    Text,
    ForeignKey,
    Enum,
    TIMESTAMP,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Modalidade(Base):
    __tablename__ = "modalidades"

    id_modalidade = Column(Integer, primary_key=True, index=True)
    nome = Column(String(500), unique=True, nullable=False)
    descricao = Column(Text, nullable=True)

    turmas = relationship("Turma", back_populates="modalidade")

class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("admin", "coordenador", "professor", "assistente"), default="professor", nullable=False)

    professores = relationship("Professor", back_populates="usuario", uselist=False)

class Professor(Base):
    __tablename__ = "professores"

    id_professor = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    nome = Column(String(500), nullable=False)
    cpf = Column(String(14), unique=True, nullable=False)
    contato = Column(String(20), nullable=False)

    usuario = relationship("Usuario", back_populates="professores")
    turmas = relationship("Turma", back_populates="professor")

class Turma(Base):
    __tablename__ = "turmas"

    id_turma = Column(Integer, primary_key=True, index=True)
    id_modalidade = Column(Integer, ForeignKey("modalidades.id_modalidade"), nullable=False)
    id_professor = Column(Integer, ForeignKey("professores.id_professor"), nullable=False)
    descricao = Column(String(100), nullable=True)
    categoria_idade = Column(String(50), nullable=False)
    horario_inicio = Column(Time, nullable=False)
    horario_fim = Column(Time, nullable=False)
    dias_semana = Column(String(50), nullable=False)

    modalidade = relationship("Modalidade", back_populates="turmas")
    professor = relationship("Professor", back_populates="turmas")
    matriculas = relationship("Matricula", back_populates="turma")

class Participante(Base):
    __tablename__ = "participantes"

    id_participante = Column(Integer, primary_key=True, index=True)
    tipo = Column(Enum("aluno", "atleta"), nullable=False)

    aluno = relationship("Aluno", back_populates="participante", uselist=False)

class Aluno(Base):
    __tablename__ = "alunos"

    id_aluno = Column(Integer, primary_key=True, index=True)
    id_participante = Column(
        Integer,
        ForeignKey("participantes.id_participante"),
        unique=True,
        nullable=False,
    )
    nome_completo = Column(String(500), nullable=False)
    data_nascimento = Column(Date, nullable=False)
    escola = Column(String(100), nullable=False)
    serie_ano = Column(String(50), nullable=False)
    nome_mae = Column(String(500), nullable=True)
    nome_pai = Column(String(500), nullable=True)
    telefone_1 = Column(String(20), nullable=False)
    telefone_2 = Column(String(20), nullable=True)
    endereco = Column(Text, nullable=False)
    recomendacoes_medicas = Column(Text, nullable=False)
    participante = relationship("Participante", back_populates="aluno")
    matriculas = relationship("Matricula", back_populates="aluno")

class Matricula(Base):
    __tablename__ = "matriculas"

    id_matricula = Column(Integer, primary_key=True, index=True)
    id_aluno = Column(Integer, ForeignKey("alunos.id_aluno"), nullable=False)
    id_turma = Column(Integer, ForeignKey("turmas.id_turma"), nullable=False)
    data_matricula = Column(Date, server_default=func.current_date())
    ativo = Column(Boolean, default=True)

    aluno = relationship("Aluno", back_populates="matriculas")
    turma = relationship("Turma", back_populates="matriculas")
    presencas = relationship("Presenca", back_populates="matricula")

class Presenca(Base):
    __tablename__ = "presencas"

    id_presenca = Column(Integer, primary_key=True, index=True)
    id_matricula = Column(Integer, ForeignKey("matriculas.id_matricula"), nullable=False)
    data_aula = Column(Date, nullable=False)
    status = Column(Enum("Presente", "Ausente", "Justificado"), default="Presente")

    matricula = relationship("Matricula", back_populates="presencas")

class Local(Base):
    __tablename__ = "locais"

    id_local = Column(Integer, primary_key=True, index=True)
    loca_nome = Column(String(200), nullable=False)
    loca_descricao = Column(Text, nullable=True)
    ativo = Column(Boolean, default=True)

class Arbitro(Base):
    __tablename__ = "arbitros"

    id_arbitro = Column(Integer, primary_key=True, index=True)
    apito_nome = Column(String(200), nullable=False)
    apito_doc = Column(String(100), nullable=False)
    apito_tel = Column(String(20), nullable=False)
