from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import Optional, List, Union, Any, Dict
from datetime import date, time, datetime
from enum import Enum

class RoleEnum(str, Enum):
    admin = "admin"
    coordenador = "coordenador"
    professor = "professor"
    assistente = "assistente"

class TipoParticipanteEnum(str, Enum):
    Aluno = "Aluno"
    Atleta = "Atleta"

class statusPresencaEnum(str, Enum):
    Presente = "Presente"
    Ausente = "Ausente"
    Justificado = "Justificado" 

class DiaSemanaEnum(str, Enum):
    SEG = "SEG"
    TER = "TER"
    QUA = "QUA"
    QUI = "QUI"
    SEX = "SEX"
    SAB = "SAB"
    DOM = "DOM"

class StatusPartidaEnum(str, Enum):
    Agendada = "Agendada"
    EmAndamento = "Em Andamento"
    Finalizada = "Finalizada"
    Cancelada = "Cancelada"

class StatusConfrontoEnum(str, Enum):
    Agendado = "Agendado"
    EmAndamento = "Em Andamento"
    Finalizado = "Finalizado"
    Cancelado = "Cancelado"

class StatusProvaEnum(str, Enum):
    Agendada = "Agendada"
    EmAndamento = "Em Andamento"
    Finalizada = "Finalizada"
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
    must_change_password: bool = True
    class Config:
        from_attributes = True

class UsuarioResponse(UsuarioBase):
    id_usuario: int
    must_change_password: bool
    class Config:
        from_attributes = True

class ChangePassword(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)
    confirm_password: str = Field(..., min_length=6)

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

class TurmaSimples(BaseModel):
    id_turma: int
    descricao: Optional[str]
    categoria_idade: str
    modalidade: Modalidade 
    class Config:
        from_attributes = True

class MatriculaNoAluno(BaseModel):
    id_matricula: int
    data_matricula: date
    ativo: bool
    turma: Optional[TurmaSimples] = None
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
    foto: Optional[str] = None
    documento_pessoal: Optional[str] = None
    atestado_medico: Optional[str] = None

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
    matriculas: List[MatriculaNoAluno] = []

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

class PresencaItem(BaseModel):
    id_matricula: int
    status: statusPresencaEnum
    observacao: Optional[str] = None

class ListaPresenca(BaseModel):
    data_aula: date
    id_turma: int
    presencas: List[PresencaItem]

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

class TipoCompeticaoEnum(str, Enum):
    PontosCorridos = "Pontos Corridos"
    MataMata = "Mata-Mata"
    Grupos = "Grupos"

class FaseInicialEnum(str, Enum):
    Oitavas = "Oitavas"
    Quartas = "Quartas"
    Semifinal = "Semifinal"
    Final = "Final"

class EventoBase(BaseModel):
    even_nome: str = Field(..., max_length=150)
    descricao: Optional[str] = None

class EventoCreate(EventoBase):
    modalidade_ids: List[int] = []

class EventoUpdate(EventoBase):
    modalidade_ids: Optional[List[int]] = None

class Evento(EventoBase):
    id_evento: int
    modalidades: List[Modalidade] = []
    class Config:
        from_attributes = True

class EdicaoBase(BaseModel):
    id_evento: int
    edic_ano: int
    tipo_competicao: TipoCompeticaoEnum = TipoCompeticaoEnum.PontosCorridos
    fase_inicial: Optional[FaseInicialEnum] = None
    data_inicio: date
    data_fim: date

class EdicaoCreate(EdicaoBase):
    pass

class Edicao(EdicaoBase):
    id_edicao: int
    evento: Optional[Evento] = None
    class Config:
        from_attributes = True

class ModoInscricaoCompeticaoEnum(str, Enum):
    EQUIPE = "EQUIPE"
    INDIVIDUAL = "INDIVIDUAL"

class FormatoCompeticaoEnum(str, Enum):
    PONTOS_CORRIDOS = "PONTOS_CORRIDOS"
    GRUPOS = "GRUPOS"
    MATA_MATA = "MATA_MATA"
    PROVAS = "PROVAS"

class CriterioResultadoCompeticaoEnum(str, Enum):
    PLACAR = "PLACAR"
    TEMPO = "TEMPO"
    PONTOS = "PONTOS"
    POSICAO = "POSICAO"

def validar_modo_formato_competicao(modo_inscricao, formato):
    if formato in (FormatoCompeticaoEnum.PROVAS, "TABELA_UNICA") and modo_inscricao != ModoInscricaoCompeticaoEnum.INDIVIDUAL:
        raise ValueError("O formato PROVAS requer inscrição INDIVIDUAL.")
    if formato in {
        FormatoCompeticaoEnum.PONTOS_CORRIDOS,
        FormatoCompeticaoEnum.GRUPOS,
        FormatoCompeticaoEnum.MATA_MATA,
    } and modo_inscricao != ModoInscricaoCompeticaoEnum.EQUIPE:
        raise ValueError("PONTOS_CORRIDOS, GRUPOS e MATA_MATA requerem inscrição EQUIPE.")

class GrupoCompeticoesBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    descricao: Optional[str] = None
    slug: str = Field(..., min_length=1, max_length=120)
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    status: str = Field("ATIVO", max_length=20)


class GrupoCompeticoesCreate(GrupoCompeticoesBase):
    pass


class GrupoCompeticoesUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=100)
    descricao: Optional[str] = None
    slug: Optional[str] = Field(None, min_length=1, max_length=120)
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    status: Optional[str] = Field(None, max_length=20)


class GrupoCompeticoesResponse(GrupoCompeticoesBase):
    id_grupo: int
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)


class RegrasPontosCorridosSchema(BaseModel):
    turno_e_returno: bool = False
    vitoria_pontos: int = 3
    empate_pontos: int = 1
    derrota_pontos: int = 0
    criterios_desempate: list[str] = ["pontos", "vitorias", "saldo_gols", "gols_pro", "confronto_direto"]


class RegrasGruposMataMataSchema(BaseModel):
    qtd_grupos: int = Field(..., ge=1)
    times_por_grupo: Optional[int] = None
    classificados_por_grupo: int = Field(..., ge=1)
    jogos_ida_volta_grupo: bool = False
    jogos_ida_volta_mata_mata: bool = False
    disputa_terceiro_lugar: bool = True
    penaltis_desempate: bool = True


class RegrasMataMataSchema(BaseModel):
    fase_inicial: str = "FINAL"
    jogos_ida_volta: bool = False
    disputa_terceiro_lugar: bool = True
    penaltis_desempate: bool = True


class CompeticaoBase(BaseModel):
    id_modalidade: int
    id_grupo: Optional[int] = None
    nome: str = Field(..., max_length=200)
    categoria: str = Field(..., min_length=1, max_length=100)
    modo_inscricao: Optional[ModoInscricaoCompeticaoEnum] = None
    formato: Optional[FormatoCompeticaoEnum] = None
    criterio_resultado: Optional[CriterioResultadoCompeticaoEnum] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    regras: Optional[str] = None
    regras_formato: Optional[Union[dict, Any]] = None
    status: Optional[str] = Field(None, max_length=50)

    @field_validator("formato", mode="before")
    @classmethod
    def normalizar_formato(cls, value):
        if value == "TABELA_UNICA":
            return "PROVAS"
        return value

    @field_validator("nome", "categoria")
    @classmethod
    def campos_textuais_nao_vazios(cls, value):
        if not value.strip():
            raise ValueError("O campo não pode ser vazio.")
        return value.strip()

    @model_validator(mode="after")
    def validar_modo_e_formato(self):
        if self.modo_inscricao is not None and self.formato is not None:
            validar_modo_formato_competicao(self.modo_inscricao, self.formato)
        if self.data_inicio is not None and self.data_fim is not None and self.data_inicio > self.data_fim:
            raise ValueError("A data de início não pode ser posterior à data de fim.")
        return self


class CompeticaoCreate(CompeticaoBase):
    @model_validator(mode="after")
    def aceitar_apenas_status_rascunho(self):
        if self.status not in (None, "RASCUNHO"):
            raise ValueError("O status é definido pelo ciclo da competição.")
        return self


class CompeticaoUpdate(BaseModel):
    id_modalidade: Optional[int] = None
    id_grupo: Optional[int] = None
    nome: Optional[str] = Field(None, max_length=200)
    categoria: Optional[str] = Field(None, min_length=1, max_length=100)
    modo_inscricao: Optional[ModoInscricaoCompeticaoEnum] = None
    formato: Optional[FormatoCompeticaoEnum] = None
    criterio_resultado: Optional[CriterioResultadoCompeticaoEnum] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    regras: Optional[str] = None
    regras_formato: Optional[Union[dict, Any]] = None
    status: Optional[str] = Field(None, max_length=50)

    @field_validator("formato", mode="before")
    @classmethod
    def normalizar_formato(cls, value):
        if value == "TABELA_UNICA":
            return "PROVAS"
        return value

    @field_validator("nome", "categoria")
    @classmethod
    def campos_textuais_nao_vazios(cls, value):
        if value is not None and not value.strip():
            raise ValueError("O campo não pode ser vazio.")
        return value.strip() if value is not None else value

    @model_validator(mode="after")
    def validar_par_completo(self):
        for field in ("id_modalidade", "nome", "categoria"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} não pode ser nulo.")
        if "status" in self.model_fields_set:
            raise ValueError("O status não pode ser alterado por atualização.")
        if self.modo_inscricao is not None and self.formato is not None:
            validar_modo_formato_competicao(self.modo_inscricao, self.formato)
        if self.data_inicio is not None and self.data_fim is not None and self.data_inicio > self.data_fim:
            raise ValueError("A data de início não pode ser posterior à data de fim.")
        return self


class Competicao(CompeticaoBase):
    id_competicao: int
    id_edicao: Optional[int] = None
    modalidade: Optional[Modalidade] = None
    grupo: Optional[GrupoCompeticoesResponse] = None

    class Config:
        from_attributes = True


class CompeticaoV2Create(BaseModel):
    nome: str = Field(..., min_length=1, max_length=200)
    id_modalidade: int
    id_grupo: Optional[int] = None
    id_edicao: Optional[int] = None
    categoria: Optional[str] = Field(None, max_length=100)
    modo_inscricao: str = "EQUIPE"
    formato: str
    criterio_resultado: Optional[str] = "PONTOS"
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    regras_formato: Optional[Union[dict, Any]] = None


class CompeticaoV2Response(BaseModel):
    id_competicao: int
    nome: str
    id_modalidade: int
    id_grupo: Optional[int] = None
    id_edicao: Optional[int] = None
    categoria: Optional[str] = None
    modo_inscricao: Optional[str] = None
    formato: Optional[str] = None
    criterio_resultado: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    status: Optional[str] = None
    regras_formato: Optional[Union[dict, Any]] = None
    modalidade: Optional[Modalidade] = None
    grupo: Optional[GrupoCompeticoesResponse] = None

    model_config = ConfigDict(from_attributes=True)


class CompeticaoV2Update(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=200)
    id_modalidade: Optional[int] = None
    id_grupo: Optional[int] = None
    id_edicao: Optional[int] = None
    categoria: Optional[str] = Field(None, max_length=100)
    modo_inscricao: Optional[str] = None
    formato: Optional[str] = None
    criterio_resultado: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    status: Optional[str] = None
    regras_formato: Optional[Union[dict, Any]] = None


class GrupoCompeticoesDetalhadoResponse(GrupoCompeticoesResponse):
    competicoes: List[CompeticaoV2Response] = []

class AtletaBase(BaseModel):
    nome_completo: str = Field(..., max_length=500)
    data_nascimento: date
    documento_pessoal: str = Field(..., max_length=50)
    contato: Optional[str] = Field(None, max_length=20)
    endereco: Optional[str] = None
    foto: Optional[str] = None

class AtletaCreate(AtletaBase):
    pass

class AtletaUpdate(BaseModel):
    nome_completo: Optional[str] = Field(None, max_length=500)
    data_nascimento: Optional[date] = None
    documento_pessoal: Optional[str] = Field(None, max_length=50)
    contato: Optional[str] = Field(None, max_length=20)
    endereco: Optional[str] = None

class Atleta(AtletaBase):
    id_atleta: int
    id_participante: int
    class Config:
        from_attributes = True

class ParticipanteResponse(BaseModel):
    id_participante: int
    tipo: str
    aluno: Optional[Aluno] = None
    atleta: Optional[Atleta] = None
    class Config:
        from_attributes = True

class EquipeBase(BaseModel):
    nome: str = Field(..., max_length=200)
    id_edicao: Optional[int] = None
    grupo: Optional[str] = Field(None, max_length=50)

class EquipeCreate(EquipeBase):
    # Transitional payload for the deprecated legacy endpoint. The route
    # requires id_competicao and derives the edition from that competition.
    id_edicao: Optional[int] = None
    id_competicao: Optional[int] = None

class EquipeCompeticaoCreate(BaseModel):
    nome: str = Field(..., max_length=200)
    grupo: Optional[str] = Field(None, max_length=50)

class EquipeUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=200)
    grupo: Optional[str] = Field(None, max_length=50)

class JogadorBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    numero_camisa: Optional[int] = None
    posicao: Optional[str] = Field(None, max_length=50)
    documento: Optional[str] = Field(None, max_length=30)
    data_nascimento: Optional[date] = None
    foto_url: Optional[str] = Field(None, max_length=255)
    ativo: bool = True


class JogadorCreate(JogadorBase):
    pass


class JogadorUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=100)
    numero_camisa: Optional[int] = None
    posicao: Optional[str] = Field(None, max_length=50)
    documento: Optional[str] = Field(None, max_length=30)
    data_nascimento: Optional[date] = None
    foto_url: Optional[str] = Field(None, max_length=255)
    ativo: Optional[bool] = None


class JogadorResponse(JogadorBase):
    id_jogador: int
    id_equipe: int
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)


class Equipe(EquipeBase):
    id_equipe: int
    id_competicao: Optional[int] = None
    edicao: Optional[Edicao] = None
    participantes: List[ParticipanteResponse] = []
    jogadores: List[JogadorResponse] = []
    class Config:
        from_attributes = True

class PartidaBase(BaseModel):
    id_edicao: int
    id_local: int
    id_arbitro: int
    id_modalidade: int
    id_equipe_casa: Optional[int] = None
    id_equipe_visitante: Optional[int] = None
    part_data: date
    part_hora: time
    placar_casa: int = 0
    placar_visitante: int = 0
    status: StatusPartidaEnum = StatusPartidaEnum.Agendada
    observacoes: Optional[str] = None

class LocalInline(BaseModel):
    loca_nome: str = Field(..., max_length=200)
    loca_descricao: Optional[str] = None

class ArbitroInline(BaseModel):
    apito_nome: str = Field(..., max_length=200)
    apito_doc: str = Field(..., max_length=100)
    apito_tel: str = Field(..., max_length=20)

class PartidaCreate(BaseModel):
    id_edicao: int
    id_local: Optional[int] = None
    id_arbitro: Optional[int] = None
    local_inline: Optional[LocalInline] = None
    arbitro_inline: Optional[ArbitroInline] = None
    id_modalidade: int
    id_equipe_casa: Optional[int] = None
    id_equipe_visitante: Optional[int] = None
    id_proxima_partida: Optional[int] = None
    fase: Optional[str] = None
    part_data: date
    part_hora: time
    placar_casa: int = 0
    placar_visitante: int = 0
    status: StatusPartidaEnum = StatusPartidaEnum.Agendada
    observacoes: Optional[str] = None

class PartidaUpdate(BaseModel):
    id_local: Optional[int] = None
    id_arbitro: Optional[int] = None
    id_equipe_casa: Optional[int] = None
    id_equipe_visitante: Optional[int] = None
    id_proxima_partida: Optional[int] = None
    fase: Optional[str] = None
    part_data: Optional[date] = None
    part_hora: Optional[time] = None
    placar_casa: Optional[int] = None
    placar_visitante: Optional[int] = None
    status: Optional[StatusPartidaEnum] = None
    observacoes: Optional[str] = None

class Partida(PartidaBase):
    id_partida: int
    id_proxima_partida: Optional[int] = None
    fase: Optional[str] = None
    sumula_arquivo: Optional[str] = None
    edicao: Optional[Edicao] = None
    local: Optional[Local] = None
    arbitro: Optional[Arbitro] = None
    modalidade: Optional[Modalidade] = None
    equipe_casa: Optional[Equipe] = None
    equipe_visitante: Optional[Equipe] = None
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class TokenData(BaseModel):
    username: Optional[str] = None

class GerarConfrontosRequest(BaseModel):
    id_modalidade: int
    part_hora: Optional[time] = None

class EstatisticaPartidaBase(BaseModel):
    id_participante: int
    gols: int = 0
    cartoes_amarelos: int = 0
    cartoes_vermelhos: int = 0
    assistencias: int = 0

class EstatisticaPartidaCreate(EstatisticaPartidaBase):
    pass

class EstatisticaPartidaResponse(EstatisticaPartidaBase):
    id_estatistica: int
    id_partida: int
    participante: Optional[ParticipanteResponse] = None
    class Config:
        from_attributes = True

class OcorrenciaPartidaBase(BaseModel):
    id_equipe: int
    id_jogador: Optional[int] = None
    tipo: str = Field(..., max_length=30)
    minuto: Optional[int] = None
    tempo_jogo: Optional[str] = Field("1T", max_length=10)
    observacao: Optional[str] = Field(None, max_length=200)


class OcorrenciaPartidaCreate(OcorrenciaPartidaBase):
    contra: Optional[bool] = False


class FinalizarConfrontoRequest(BaseModel):
    penaltis_mandante: Optional[int] = None
    penaltis_visitante: Optional[int] = None
    observacoes: Optional[str] = None


class OcorrenciaPartidaResponse(OcorrenciaPartidaBase):
    id_ocorrencia: int
    id_confronto: int
    criado_em: datetime
    nome_jogador: Optional[str] = None
    nome_equipe: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ConfrontoBase(BaseModel):
    id_equipe_mandante: Optional[int] = None
    id_equipe_visitante: Optional[int] = None
    id_proximo_confronto: Optional[int] = None
    fase: Optional[str] = None
    rodada: Optional[int] = None
    grupo: Optional[str] = None
    data: date
    hora: time
    id_local: int
    id_arbitro: int
    placar_mandante: int = 0
    placar_visitante: int = 0
    id_equipe_vencedora: Optional[int] = None
    status: StatusConfrontoEnum = StatusConfrontoEnum.Agendado
    observacoes: Optional[str] = None
    ordem_jogo: int = 1
    penaltis_mandante: Optional[int] = None
    penaltis_visitante: Optional[int] = None
    id_confronto_ida: Optional[int] = None


class ConfrontoCreate(BaseModel):
    id_equipe_mandante: Optional[int] = None
    id_equipe_visitante: Optional[int] = None
    id_proximo_confronto: Optional[int] = None
    fase: Optional[str] = None
    rodada: Optional[int] = None
    grupo: Optional[str] = None
    data: date
    hora: time
    id_local: int
    id_arbitro: int
    placar_mandante: int = 0
    placar_visitante: int = 0
    status: StatusConfrontoEnum = StatusConfrontoEnum.Agendado
    observacoes: Optional[str] = None
    ordem_jogo: Optional[int] = 1
    penaltis_mandante: Optional[int] = None
    penaltis_visitante: Optional[int] = None
    id_confronto_ida: Optional[int] = None


class ConfrontoUpdate(BaseModel):
    id_equipe_mandante: Optional[int] = None
    id_equipe_visitante: Optional[int] = None
    id_proximo_confronto: Optional[int] = None
    fase: Optional[str] = None
    rodada: Optional[int] = None
    grupo: Optional[str] = None
    data: Optional[date] = None
    hora: Optional[time] = None
    id_local: Optional[int] = None
    id_arbitro: Optional[int] = None
    placar_mandante: Optional[int] = None
    placar_visitante: Optional[int] = None
    id_equipe_vencedora: Optional[int] = None
    status: Optional[StatusConfrontoEnum] = None
    observacoes: Optional[str] = None
    ordem_jogo: Optional[int] = None
    penaltis_mandante: Optional[int] = None
    penaltis_visitante: Optional[int] = None
    id_confronto_ida: Optional[int] = None


class Confronto(ConfrontoBase):
    id_confronto: int
    id_competicao: int
    sumula_arquivo: Optional[str] = None
    equipe_mandante: Optional[Equipe] = None
    equipe_visitante: Optional[Equipe] = None
    equipe_vencedora: Optional[Equipe] = None
    local: Optional[Local] = None
    arbitro: Optional[Arbitro] = None
    ocorrencias: List[OcorrenciaPartidaResponse] = []

    class Config:
        from_attributes = True

class GerarConfrontosCompeticaoRequest(BaseModel):
    fase_inicial: Optional[str] = None
    data_inicio: Optional[date] = None
    hora_padrao: Optional[time] = None
    id_local_padrao: Optional[int] = None
    id_arbitro_padrao: Optional[int] = None


class InscricaoIndividualBase(BaseModel):
    id_participante: int
    numero_peito: Optional[int] = None


class InscricaoIndividualCreate(InscricaoIndividualBase):
    pass


class InscricaoIndividual(InscricaoIndividualBase):
    id_inscricao: int
    id_competicao: int
    participante: Optional[ParticipanteResponse] = None

    class Config:
        from_attributes = True


class ResultadoProvaBase(BaseModel):
    id_participante: int
    tempo_ms: int = Field(..., gt=0)
    desqualificado: bool = False
    motivo_desqualificacao: Optional[str] = Field(None, max_length=255)
    observacoes: Optional[str] = None


class ResultadoProvaCreate(ResultadoProvaBase):
    pass


class ResultadoProvaUpdate(BaseModel):
    tempo_ms: Optional[int] = Field(None, gt=0)
    desqualificado: Optional[bool] = None
    motivo_desqualificacao: Optional[str] = Field(None, max_length=255)
    observacoes: Optional[str] = None


class ResultadoProva(ResultadoProvaBase):
    id_resultado: int
    id_prova: int
    posicao: Optional[int] = None
    participante: Optional[ParticipanteResponse] = None

    class Config:
        from_attributes = True


class ProvaBase(BaseModel):
    nome: str = Field(..., max_length=200)
    data: Optional[date] = None
    hora: Optional[time] = None
    id_local: Optional[int] = None
    status: StatusProvaEnum = StatusProvaEnum.Agendada
    observacoes: Optional[str] = None


class ProvaCreate(ProvaBase):
    pass


class ProvaUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=200)
    data: Optional[date] = None
    hora: Optional[time] = None
    id_local: Optional[int] = None
    status: Optional[StatusProvaEnum] = None
    observacoes: Optional[str] = None


class Prova(ProvaBase):
    id_prova: int
    id_competicao: int
    local: Optional[Local] = None
    resultados: List[ResultadoProva] = []

    class Config:
        from_attributes = True

