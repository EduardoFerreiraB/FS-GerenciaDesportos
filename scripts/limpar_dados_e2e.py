"""Remove do banco os dados criados pelos testes E2E de competicoes.

Ate 2026-10-19 o Playwright podia reaproveitar um backend de desenvolvimento ja
aberto na porta 8000 e gravar nele. O ambiente E2E agora e isolado (portas
8001/3001, banco frontend/e2e.db recriado a cada execucao); este script limpa o
que ficou para tras.

Reconhece somente o padrao exato que os testes geram: nome fixo seguido do
timestamp de 13+ digitos (ex.: "Torneio Disciplina E2E 1760900000000"), e os
alunos ficticios com a "impressao digital" do teste (escola e nome da mae
ficticios). Nada com nome digitado por pessoas casa com esses padroes.

Uso (a partir da raiz do projeto; usa o DATABASE_URL do ambiente ou do .env):

    .venv/bin/python scripts/limpar_dados_e2e.py            # so lista
    .venv/bin/python scripts/limpar_dados_e2e.py --apagar   # apaga, numa transacao

Faca backup antes de usar --apagar.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
if str(RAIZ / "app") not in sys.path:
    sys.path.insert(0, str(RAIZ / "app"))

from sqlalchemy import delete, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

PADRAO_COMPETICAO = re.compile(
    r"^(Torneio Jogos E2E|Torneio Disciplina E2E|Copa Portal|Torneio de Continuidade"
    r"|Copa Integrantes|Copa Idempot[eê]ncia|Copa Conflito|Copa Camisas|Copa Metropolitana"
    r"|Futebol da Primavera) \d{13,16}$"
)
PADRAO_EVENTO = re.compile(r"^Jogos da Primavera \d{13,16}$")
PADRAO_COMPETIDOR = re.compile(
    r"^(Atleta Falc[aã]o|Atleta Tubar[aã]o|Carlos Falc[aã]o|Bruno Tubar[aã]o|Marcos Tubar[aã]o"
    r"|Jogador Disputado|Craque Antigo|Pel[eé] Primeiro|Neymar Segundo|Competidor Terceiro"
    r"|Pessoa (?:[ÁA]guias|Corujas)) \d{13,16}$"
)
# Aluno ficticio criado por frontend/e2e/elencos.spec.ts.
ALUNOS_FICTICIOS = {"Aluno Escolar Teste E2E", "Aluno Repetido"}
ESCOLA_FICTICIA = "Escola Municipal Sigilosa"
MAE_FICTICIA = "Mãe Privada"


@dataclass
class DadosE2E:
    competicoes: list = field(default_factory=list)
    eventos: list = field(default_factory=list)
    competidores: list = field(default_factory=list)
    alunos: list = field(default_factory=list)
    alunos_reais_importados: list = field(default_factory=list)

    def vazio(self) -> bool:
        return not (self.competicoes or self.eventos or self.competidores or self.alunos)


def encontrar_dados_e2e(db: Session) -> DadosE2E:
    import models
    from competicoes.modelos import Competicao, Competidor, Evento, IntegranteEquipe

    dados = DadosE2E()
    dados.competicoes = [c for c in db.scalars(select(Competicao)) if PADRAO_COMPETICAO.match(c.nome)]
    dados.eventos = [e for e in db.scalars(select(Evento)) if PADRAO_EVENTO.match(e.nome)]
    dados.alunos = [
        a for a in db.scalars(select(models.Aluno).where(models.Aluno.nome_completo.in_(ALUNOS_FICTICIOS)))
        if a.escola == ESCOLA_FICTICIA and a.nome_mae == MAE_FICTICIA
    ]
    ids_alunos_ficticios = {a.id_aluno for a in dados.alunos}

    ids_edicoes_e2e = {e.id_edicao_competicao for c in dados.competicoes for e in c.edicoes}
    for competidor in db.scalars(select(Competidor)):
        inscricoes = db.scalars(
            select(IntegranteEquipe.id_edicao_competicao).where(
                IntegranteEquipe.id_competidor == competidor.id_competidor
            )
        ).all()
        so_em_edicoes_e2e = all(i in ids_edicoes_e2e for i in inscricoes)
        if competidor.id_aluno_origem is None:
            if PADRAO_COMPETIDOR.match(competidor.nome) and so_em_edicoes_e2e:
                dados.competidores.append(competidor)
        elif competidor.id_aluno_origem in ids_alunos_ficticios:
            if so_em_edicoes_e2e:
                dados.competidores.append(competidor)
        elif inscricoes and so_em_edicoes_e2e:
            # Aluno real importado por um teste antigo: so informa, nao apaga a pessoa.
            dados.alunos_reais_importados.append(competidor)
    return dados


def apagar_dados_e2e(db: Session, dados: DadosE2E, responsavel) -> None:
    """Apaga tudo numa transacao; o chamador faz commit."""
    import models
    from competicoes.infra import registrar_auditoria
    from competicoes.modelos import Competidor, EdicaoEvento, Evento
    from competicoes.servicos.exclusao import apagar_competicao

    for competicao in dados.competicoes:
        registrar_auditoria(
            db, entidade="competicoes", id_entidade=competicao.id_competicao, acao="EXCLUIR",
            antes={"nome": competicao.nome, "slug": competicao.slug}, depois=None,
            id_edicao_competicao=None, responsavel=responsavel, motivo="Limpeza de dados de teste E2E",
        )
        apagar_competicao(db, competicao.id_competicao)

    for evento in dados.eventos:
        db.execute(delete(EdicaoEvento).where(EdicaoEvento.id_evento == evento.id_evento))
        db.execute(delete(Evento).where(Evento.id_evento == evento.id_evento))

    for competidor in dados.competidores:
        db.execute(delete(Competidor).where(Competidor.id_competidor == competidor.id_competidor))

    for aluno in dados.alunos:
        id_participante = aluno.id_participante
        db.execute(delete(models.Aluno).where(models.Aluno.id_aluno == aluno.id_aluno))
        db.execute(delete(models.Participante).where(models.Participante.id_participante == id_participante))
    db.expunge_all()


def _resumo(dados: DadosE2E) -> str:
    linhas = []
    for titulo, itens, rotulo in (
        ("Competições (com todas as edições, equipes e jogos)", dados.competicoes, lambda c: c.nome),
        ("Eventos", dados.eventos, lambda e: e.nome),
        ("Competidores sem outra inscrição", dados.competidores, lambda c: c.nome),
        ("Alunos fictícios", dados.alunos, lambda a: f"{a.nome_completo} (id {a.id_aluno})"),
    ):
        linhas.append(f"{titulo}: {len(itens)}")
        linhas.extend(f"  - {rotulo(i)}" for i in itens)
    if dados.alunos_reais_importados:
        linhas.append(
            "ATENÇÃO — alunos reais importados como competidor por testes antigos "
            "(o competidor NÃO é apagado; revise e exclua manualmente se quiser):"
        )
        linhas.extend(f"  - {c.nome} (competidor {c.id_competidor}, aluno {c.id_aluno_origem})"
                      for c in dados.alunos_reais_importados)
    return "\n".join(linhas)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apagar", action="store_true", help="apaga de fato (sem isso, só lista)")
    parser.add_argument("--usuario", default="admin", help="usuário registrado como responsável na auditoria")
    args = parser.parse_args()

    import models
    from database import SessionLocal, engine

    print(f"Banco: {engine.url.render_as_string(hide_password=True)}")
    with SessionLocal() as db:
        dados = encontrar_dados_e2e(db)
        print(_resumo(dados))
        if dados.vazio():
            print("Nada a limpar.")
            return 0
        if not args.apagar:
            print("\nNada foi apagado. Rode novamente com --apagar (faça backup antes).")
            return 0
        responsavel = db.scalar(select(models.Usuario).where(models.Usuario.username == args.usuario))
        if responsavel is None:
            print(f"Usuário '{args.usuario}' não encontrado; use --usuario.")
            return 1
        try:
            apagar_dados_e2e(db, dados, responsavel)
            db.commit()
        except Exception:
            db.rollback()
            raise
        print("\nDados de teste E2E apagados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
