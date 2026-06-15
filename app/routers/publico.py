from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, time
from pydantic import BaseModel
from database import get_db
import models
import schemas

router = APIRouter(
    prefix="/publico",
    tags=["Público"]
)

# --- PUBLIC PYDANTIC SCHEMAS ---

class ModalidadePublica(BaseModel):
    id_modalidade: int
    nome: str
    descricao: Optional[str]
    class Config:
        from_attributes = True

class EventoPublico(BaseModel):
    id_evento: int
    even_nome: str
    descricao: Optional[str]
    modalidades: List[ModalidadePublica] = []
    class Config:
        from_attributes = True

class EdicaoPublica(BaseModel):
    id_edicao: int
    id_evento: int
    edic_ano: int
    tipo_competicao: str
    fase_inicial: Optional[str] = None
    data_inicio: date
    data_fim: date
    class Config:
        from_attributes = True

class JogadorPublico(BaseModel):
    id_participante: int
    nome_completo: str

class EquipePublica(BaseModel):
    id_equipe: int
    nome: str
    jogadores: List[JogadorPublico] = []

class LocalPublico(BaseModel):
    id_local: int
    loca_nome: str
    loca_descricao: Optional[str]
    class Config:
        from_attributes = True

class ArbitroPublico(BaseModel):
    id_arbitro: int
    apito_nome: str
    class Config:
        from_attributes = True

class EquipeSimplesPublica(BaseModel):
    id_equipe: int
    nome: str
    class Config:
        from_attributes = True

class PartidaPublica(BaseModel):
    id_partida: int
    id_edicao: int
    id_local: int
    id_arbitro: int
    id_modalidade: int
    id_equipe_casa: Optional[int]
    id_equipe_visitante: Optional[int]
    id_proxima_partida: Optional[int]
    fase: Optional[str]
    part_data: date
    part_hora: time
    placar_casa: int
    placar_visitante: int
    status: str
    sumula_arquivo: Optional[str]
    observacoes: Optional[str]
    local: Optional[LocalPublico]
    arbitro: Optional[ArbitroPublico]
    equipe_casa: Optional[EquipeSimplesPublica]
    equipe_visitante: Optional[EquipeSimplesPublica]
    class Config:
        from_attributes = True

class EstatisticaPublica(BaseModel):
    id_estatistica: int
    id_partida: int
    id_participante: int
    gols: int
    cartoes_amarelos: int
    cartoes_vermelhos: int
    assistencias: int
    nome_jogador: str

# --- ROUTE IMPLEMENTATIONS ---

@router.get("/eventos", response_model=List[EventoPublico])
def listar_eventos_publicos(db: Session = Depends(get_db)):
    return db.query(models.Evento).all()

@router.get("/eventos/{id_evento}", response_model=EventoPublico)
def obter_evento_publico(id_evento: int, db: Session = Depends(get_db)):
    evento = db.query(models.Evento).filter(models.Evento.id_evento == id_evento).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return evento

@router.get("/edicoes", response_model=List[EdicaoPublica])
def listar_edicoes_publicas(db: Session = Depends(get_db)):
    return db.query(models.Edicao).all()

@router.get("/edicoes/{id_edicao}/equipes", response_model=List[EquipePublica])
def listar_equipes_publicas(id_edicao: int, db: Session = Depends(get_db)):
    equipes = db.query(models.Equipe).filter(models.Equipe.id_edicao == id_edicao).all()
    
    equipes_publicas = []
    for eq in equipes:
        jogadores = []
        for part in eq.participantes:
            nome = "Jogador Desconhecido"
            if part.tipo == "aluno" and part.aluno:
                nome = part.aluno.nome_completo
            elif part.tipo == "atleta" and part.atleta:
                nome = part.atleta.nome_completo
            jogadores.append(JogadorPublico(id_participante=part.id_participante, nome_completo=nome))
            
        equipes_publicas.append(EquipePublica(
            id_equipe=eq.id_equipe,
            nome=eq.nome,
            jogadores=jogadores
        ))
        
    return equipes_publicas

@router.get("/edicoes/{id_edicao}/partidas", response_model=List[PartidaPublica])
def listar_partidas_publicas(id_edicao: int, db: Session = Depends(get_db)):
    return db.query(models.Partida).filter(models.Partida.id_edicao == id_edicao).all()

@router.get("/partidas/{id_partida}/estatisticas", response_model=List[EstatisticaPublica])
def listar_estatisticas_publicas(id_partida: int, db: Session = Depends(get_db)):
    stats = db.query(models.EstatisticaPartida).filter(models.EstatisticaPartida.id_partida == id_partida).all()
    
    stats_publicas = []
    for s in stats:
        nome = "Jogador Desconhecido"
        part = s.participante
        if part:
            if part.tipo == "aluno" and part.aluno:
                nome = part.aluno.nome_completo
            elif part.tipo == "atleta" and part.atleta:
                nome = part.atleta.nome_completo
                
        stats_publicas.append(EstatisticaPublica(
            id_estatistica=s.id_estatistica,
            id_partida=s.id_partida,
            id_participante=s.id_participante,
            gols=s.gols,
            cartoes_amarelos=s.cartoes_amarelos,
            cartoes_vermelhos=s.cartoes_vermelhos,
            assistencias=s.assistencias,
            nome_jogador=nome
        ))
        
    return stats_publicas

@router.get("/edicoes/{id_edicao}/estatisticas", response_model=List[EstatisticaPublica])
def listar_estatisticas_edicao_publicas(id_edicao: int, db: Session = Depends(get_db)):
    stats = db.query(models.EstatisticaPartida)\
              .join(models.Partida)\
              .filter(models.Partida.id_edicao == id_edicao).all()
              
    stats_publicas = []
    for s in stats:
        nome = "Jogador Desconhecido"
        part = s.participante
        if part:
            if part.tipo == "aluno" and part.aluno:
                nome = part.aluno.nome_completo
            elif part.tipo == "atleta" and part.atleta:
                nome = part.atleta.nome_completo
                
        stats_publicas.append(EstatisticaPublica(
            id_estatistica=s.id_estatistica,
            id_partida=s.id_partida,
            id_participante=s.id_participante,
            gols=s.gols,
            cartoes_amarelos=s.cartoes_amarelos,
            cartoes_vermelhos=s.cartoes_vermelhos,
            assistencias=s.assistencias,
            nome_jogador=nome
        ))
        
    return stats_publicas
