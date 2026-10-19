"""O script de limpeza so remove o que os testes E2E geram, nunca dado real."""

import sys
from datetime import date
from pathlib import Path

from competicoes.modelos import Competicao, Competidor, Equipe, Evento, IntegranteEquipe

from .factories import (
    criar_aluno,
    criar_competicao,
    criar_competidor,
    criar_edicao_competicao,
    criar_edicao_evento,
    criar_equipe,
    criar_evento,
    criar_integrante,
)

RAIZ = Path(__file__).resolve().parents[2]
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

from scripts.limpar_dados_e2e import apagar_dados_e2e, encontrar_dados_e2e  # noqa: E402

TS = "1760900000000"


def test_remove_so_dados_de_teste_e_preserva_os_reais(db, usuario):
    import models

    # Dados gerados pelos testes E2E
    teste = criar_competicao(db, nome=f"Torneio Disciplina E2E {TS}")
    edicao_teste = criar_edicao_competicao(db, teste)
    equipe_teste = criar_equipe(db, edicao_teste)
    atleta_teste = criar_competidor(db, nome=f"Carlos Falcão {TS}")
    criar_integrante(db, equipe_teste, atleta_teste)
    evento_teste = criar_evento(db, nome=f"Jogos da Primavera {TS}")
    criar_edicao_evento(db, evento_teste)
    aluno_ficticio = criar_aluno(db, nome="Aluno Escolar Teste E2E")
    aluno_ficticio.escola, aluno_ficticio.nome_mae = "Escola Municipal Sigilosa", "Mãe Privada"
    importado_ficticio = criar_competidor(db, nome="Aluno Escolar Teste E2E", id_aluno_origem=aluno_ficticio.id_aluno)
    criar_integrante(db, equipe_teste, importado_ficticio)

    # Aluno real importado por um teste antigo: informado, não apagado
    aluno_real = criar_aluno(db, nome="Maria Real")
    importado_real = criar_competidor(db, nome="Maria Real", id_aluno_origem=aluno_real.id_aluno)
    criar_integrante(db, equipe_teste, importado_real)

    # Dados reais, inclusive com nomes parecidos
    real = criar_competicao(db, nome="Torneio Disciplina E2E")
    edicao_real = criar_edicao_competicao(db, real)
    atleta_real = criar_competidor(db, nome="Carlos Falcão")
    criar_integrante(db, criar_equipe(db, edicao_real), atleta_real)
    homonimo = criar_aluno(db, nome="Aluno Repetido")  # sem a impressão digital do teste
    db.commit()

    dados = encontrar_dados_e2e(db)
    assert [c.nome for c in dados.competicoes] == [teste.nome]
    assert [e.nome for e in dados.eventos] == [evento_teste.nome]
    assert {c.id_competidor for c in dados.competidores} == {
        atleta_teste.id_competidor, importado_ficticio.id_competidor,
    }
    assert [a.id_aluno for a in dados.alunos] == [aluno_ficticio.id_aluno]
    assert [c.id_competidor for c in dados.alunos_reais_importados] == [importado_real.id_competidor]

    ids = {
        "competicao_real": real.id_competicao, "atleta_real": atleta_real.id_competidor,
        "importado_real": importado_real.id_competidor, "aluno_real": aluno_real.id_aluno,
        "homonimo": homonimo.id_aluno, "teste": teste.id_competicao,
        "aluno_ficticio": aluno_ficticio.id_aluno,
    }
    apagar_dados_e2e(db, dados, usuario)
    db.commit()

    assert db.get(Competicao, ids["teste"]) is None
    assert db.query(Evento).filter(Evento.nome.like("Jogos da Primavera %")).count() == 0
    assert db.get(models.Aluno, ids["aluno_ficticio"]) is None
    assert db.get(Competicao, ids["competicao_real"]) is not None
    assert db.get(Competidor, ids["atleta_real"]) is not None
    assert db.get(Competidor, ids["importado_real"]) is not None
    assert db.get(models.Aluno, ids["aluno_real"]) is not None
    assert db.get(models.Aluno, ids["homonimo"]) is not None
    assert db.query(IntegranteEquipe).count() == 1
    assert db.query(Equipe).count() == 1
    assert encontrar_dados_e2e(db).vazio()
