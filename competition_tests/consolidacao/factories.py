"""Fabricas minimas do dominio novo de competicoes.

Reusadas pelos testes das tarefas seguintes. Cada fabrica so faz ``flush``;
commit e rollback ficam com o teste.
"""

from __future__ import annotations

from datetime import date
from itertools import count

from sqlalchemy import text

_sequencia = count(1)


def _n() -> int:
    return next(_sequencia)


def criar_modalidade(db, nome: str | None = None):
    import models

    modalidade = models.Modalidade(nome=nome or f"Futebol {_n()}", duracao_minutos=90)
    db.add(modalidade)
    db.flush()
    return modalidade


def criar_evento(db, **campos):
    from competicoes.modelos import Evento

    n = _n()
    evento = Evento(**({"nome": f"Evento {n}", "slug": f"evento-{n}"} | campos))
    db.add(evento)
    db.flush()
    return evento


def criar_edicao_evento(db, evento=None, **campos):
    from competicoes.modelos import EdicaoEvento

    evento = evento or criar_evento(db)
    edicao = EdicaoEvento(
        **(
            {
                "id_evento": evento.id_evento,
                "identificacao": "2026",
                "data_inicio": date(2026, 1, 1),
                "data_fim": date(2026, 12, 31),
            }
            | campos
        )
    )
    db.add(edicao)
    db.flush()
    return edicao


def criar_competicao(db, modalidade=None, **campos):
    from competicoes.modelos import Competicao

    modalidade = modalidade or criar_modalidade(db)
    n = _n()
    competicao = Competicao(
        **(
            {
                "nome": f"Copa {n}",
                "slug": f"copa-{n}",
                "id_modalidade": modalidade.id_modalidade,
            }
            | campos
        )
    )
    db.add(competicao)
    db.flush()
    return competicao


def criar_edicao_competicao(db, competicao=None, **campos):
    from competicoes.modelos import EdicaoCompeticao

    competicao = competicao or criar_competicao(db)
    edicao = EdicaoCompeticao(
        **(
            {
                "id_competicao": competicao.id_competicao,
                "identificacao": "2026",
                "data_inicio": date(2026, 3, 1),
                "data_fim": date(2026, 6, 30),
                "formato": "PONTOS_CORRIDOS",
                "configuracao": {},
            }
            | campos
        )
    )
    db.add(edicao)
    db.flush()
    return edicao


def criar_competidor(db, **campos):
    from competicoes.modelos import Competidor

    competidor = Competidor(**({"nome": f"Competidor {_n()}"} | campos))
    db.add(competidor)
    db.flush()
    return competidor


def criar_equipe(db, edicao=None, **campos):
    from competicoes.modelos import Equipe

    edicao = edicao or criar_edicao_competicao(db)
    equipe = Equipe(
        **({"id_edicao_competicao": edicao.id_edicao_competicao, "nome": f"Equipe {_n()}"} | campos)
    )
    db.add(equipe)
    db.flush()
    return equipe


def novo_integrante(equipe, competidor, **campos):
    """Integrante ainda nao adicionado a sessao (para testes de constraint)."""
    from competicoes.modelos import IntegranteEquipe

    return IntegranteEquipe(
        **(
            {
                "id_edicao_competicao": equipe.id_edicao_competicao,
                "id_equipe": equipe.id_equipe,
                "id_competidor": competidor.id_competidor,
                "nome_esportivo": competidor.nome,
            }
            | campos
        )
    )


def criar_integrante(db, equipe=None, competidor=None, **campos):
    equipe = equipe or criar_equipe(db)
    competidor = competidor or criar_competidor(db)
    integrante = novo_integrante(equipe, competidor, **campos)
    db.add(integrante)
    db.flush()
    return integrante


def criar_aluno(db, nome: str = "Aluno Origem"):
    import models

    participante = models.Participante(tipo="aluno")
    db.add(participante)
    db.flush()
    aluno = models.Aluno(
        id_participante=participante.id_participante,
        nome_completo=nome,
        data_nascimento=date(2012, 5, 1),
        escola="Escola",
        serie_ano="8",
        telefone_1="0000",
        endereco="Rua",
    )
    db.add(aluno)
    db.flush()
    return aluno


# ---------------------------------------------------------------------------
# Snapshot sintetico no schema do baseline 20261015_0100 (SQL cru: o ORM atual
# ja nao conhece as tabelas esportivas antigas).
# ---------------------------------------------------------------------------

TABELAS_ESCOLINHAS = (
    "usuarios", "refresh_tokens", "professores", "modalidades", "turmas",
    "turmas_dias", "participantes", "alunos", "atletas", "matriculas",
    "presencas", "locais", "arbitros",
)

_SNAPSHOT = [
    "INSERT INTO usuarios (id_usuario, username, password_hash, role, must_change_password)"
    " VALUES (1, 'coord', 'h1', 'coordenador', 0), (2, 'prof', 'h2', 'professor', 1)",
    "INSERT INTO refresh_tokens (id_token, id_usuario, token, expires_at, revoked)"
    " VALUES (1, 1, 'tok-1', '2030-01-01 00:00:00', 0)",
    "INSERT INTO professores (id_professor, id_usuario, nome, cpf, contato)"
    " VALUES (1, 2, 'Prof', '111.444.777-35', '9999')",
    "INSERT INTO modalidades (id_modalidade, nome, descricao, duracao_minutos)"
    " VALUES (1, 'Futebol', 'campo', 90), (2, 'Natacao', NULL, 60)",
    "INSERT INTO turmas (id_turma, id_modalidade, id_professor, descricao, categoria_idade,"
    " horario_inicio, horario_fim) VALUES (1, 1, 1, 'Sub 13', 'Sub 13', '08:00:00', '09:00:00')",
    "INSERT INTO turmas_dias (id_turma, dia_semana) VALUES (1, 'SEG'), (1, 'QUA')",
    "INSERT INTO participantes (id_participante, tipo) VALUES (1, 'aluno'), (2, 'aluno'), (3, 'atleta')",
    "INSERT INTO alunos (id_aluno, id_participante, nome_completo, data_nascimento, escola,"
    " serie_ano, telefone_1, endereco, ativo) VALUES"
    " (1, 1, 'Ana', '2012-01-01', 'E1', '7', '1', 'R1', 1),"
    " (2, 2, 'Bruno', '2011-02-02', 'E2', '8', '2', 'R2', 0)",
    "INSERT INTO atletas (id_atleta, id_participante, nome_completo, data_nascimento,"
    " documento_pessoal) VALUES (1, 3, 'Carlos', '2000-03-03', 'DOC3')",
    "INSERT INTO matriculas (id_matricula, id_aluno, id_turma, data_matricula, ativo)"
    " VALUES (1, 1, 1, '2026-02-01', 1), (2, 2, 1, '2026-02-02', 0)",
    "INSERT INTO presencas (id_presenca, id_matricula, data_aula, status, observacao)"
    " VALUES (1, 1, '2026-03-02', 'Presente', NULL), (2, 2, '2026-03-02', 'Justificado', 'atestado')",
    "INSERT INTO locais (id_local, loca_nome, loca_descricao, ativo) VALUES (1, 'Campo 1', NULL, 1)",
    "INSERT INTO arbitros (id_arbitro, apito_nome, apito_doc, apito_tel) VALUES (1, 'Juiz', 'J1', '3')",
    # Dominio esportivo antigo, ligado aos cadastros compartilhados.
    "INSERT INTO eventos (id_evento, even_nome, descricao) VALUES (1, 'Jogos', NULL)",
    "INSERT INTO modalidades_evento (id_evento, id_modalidade) VALUES (1, 1)",
    "INSERT INTO edicoes (id_edicao, id_evento, edic_ano, tipo_competicao, data_inicio, data_fim)"
    " VALUES (1, 1, 2025, 'Pontos Corridos', '2025-01-01', '2025-12-31')",
    "INSERT INTO grupos_competicoes (id_grupo, nome, slug, status, criado_em)"
    " VALUES (1, 'G', 'g', 'ATIVO', '2025-01-01 00:00:00')",
    "INSERT INTO competicoes (id_competicao, id_edicao, id_modalidade, id_grupo, nome, categoria,"
    " status) VALUES (1, 1, 1, 1, 'Copa antiga', 'Livre', 'RASCUNHO')",
    "INSERT INTO equipes (id_equipe, nome, id_edicao, id_competicao) VALUES (1, 'A', 1, 1), (2, 'B', 1, 1)",
    "INSERT INTO equipes_participantes (id_equipe, id_participante) VALUES (1, 1), (2, 3)",
    "INSERT INTO jogadores (id_jogador, id_equipe, nome, ativo, criado_em)"
    " VALUES (1, 1, 'Ana', 1, '2025-01-01 00:00:00')",
    "INSERT INTO confrontos (id_confronto, id_competicao, id_equipe_mandante, id_equipe_visitante,"
    " data, hora, id_local, id_arbitro, placar_mandante, placar_visitante, status, ordem_jogo)"
    " VALUES (1, 1, 1, 2, '2025-05-01', '10:00:00', 1, 1, 2, 1, 'Finalizado', 1)",
    "INSERT INTO ocorrencias_partida (id_ocorrencia, id_confronto, id_equipe, id_jogador, tipo,"
    " criado_em) VALUES (1, 1, 1, 1, 'GOL', '2025-05-01 10:10:00')",
    "INSERT INTO partidas (id_partida, id_edicao, id_local, id_arbitro, id_modalidade, part_data,"
    " part_hora) VALUES (1, 1, 1, 1, 1, '2025-05-02', '10:00:00')",
    "INSERT INTO estatisticas_partida (id_estatistica, id_partida, id_participante, gols,"
    " cartoes_amarelos, cartoes_vermelhos, assistencias) VALUES (1, 1, 1, 1, 0, 0, 0)",
    "INSERT INTO inscricoes_individuais (id_inscricao, id_competicao, id_participante)"
    " VALUES (1, 1, 3)",
    "INSERT INTO provas (id_prova, id_competicao, nome, status) VALUES (1, 1, '50m', 'Agendada')",
    "INSERT INTO resultados_prova (id_resultado, id_prova, id_participante, tempo_ms,"
    " desqualificado) VALUES (1, 1, 3, 30000, 0)",
    "INSERT INTO migracao_equipes_origem (id_migracao, id_equipe_origem, status) VALUES (1, 1, 'OK')",
    "INSERT INTO migracao_partidas_origem (id_migracao, id_partida_origem, status) VALUES (1, 1, 'OK')",
]


def popular_snapshot_sintetico(engine) -> None:
    with engine.begin() as conexao:
        for instrucao in _SNAPSHOT:
            conexao.execute(text(instrucao))


def ler_tabelas(engine, tabelas=TABELAS_ESCOLINHAS) -> dict[str, list[tuple]]:
    """Conteudo completo de cada tabela, ordenado, para comparar antes/depois."""
    with engine.connect() as conexao:
        return {
            tabela: sorted(
                (tuple(linha) for linha in conexao.execute(text(f"SELECT * FROM {tabela}"))),
                key=repr,
            )
            for tabela in tabelas
        }
