"""Serviços de domínio para competidores, equipes e elencos."""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

import models
from competicoes.contratos.elencos import (
    CompetidorAtualizar,
    CompetidorCriar,
    CompetidorDetalhe,
    EquipeCriar,
    EquipeDetalhe,
    IntegranteAtualizar,
    IntegranteCriar,
    IntegranteDetalhe,
    PaginaCompetidores,
)
from competicoes.erros import ConflitoEstado, Duplicidade, NaoEncontrado
from competicoes.infra import (
    bloquear_edicao,
    registrar_auditoria,
    transacao,
)
from competicoes.servicos.exclusao import apagar_integrantes_de_equipes
from competicoes.modelos import (
    Competidor,
    EdicaoCompeticao,
    Equipe,
    IntegranteEquipe,
)


def _competidor_para_detalhe(c: Competidor) -> CompetidorDetalhe:
    return CompetidorDetalhe(
        id_competidor=c.id_competidor,
        nome=c.nome,
        data_nascimento=c.data_nascimento,
        documento=c.documento,
        foto_url=c.foto_url,
        ativo=c.ativo,
        id_aluno_origem=c.id_aluno_origem,
        criado_em=c.criado_em,
    )


def _integrante_para_detalhe(i: IntegranteEquipe) -> IntegranteDetalhe:
    return IntegranteDetalhe(
        id_integrante=i.id_integrante,
        id_edicao_competicao=i.id_edicao_competicao,
        id_equipe=i.id_equipe,
        id_competidor=i.id_competidor,
        nome_esportivo=i.nome_esportivo,
        numero_camisa=i.numero_camisa,
        posicao=i.posicao,
        situacao=i.situacao,
        criado_em=i.criado_em,
    )


def _equipe_para_detalhe(e: Equipe) -> EquipeDetalhe:
    return EquipeDetalhe(
        id_equipe=e.id_equipe,
        id_edicao_competicao=e.id_edicao_competicao,
        nome=e.nome,
        sigla=e.sigla,
        situacao=e.situacao,
        criado_em=e.criado_em,
        integrantes=[_integrante_para_detalhe(i) for i in (e.integrantes or [])],
    )


def criar_competidor(
    db: Session, dados: CompetidorCriar, responsavel: models.Usuario
) -> CompetidorDetalhe:
    """Cria um competidor terceiro, sem vínculo de origem com aluno."""
    with transacao(db):
        competidor = Competidor(
            nome=dados.nome,
            data_nascimento=dados.data_nascimento,
            documento=dados.documento,
            foto_url=dados.foto_url,
            ativo=dados.ativo,
            id_aluno_origem=None,
        )
        db.add(competidor)
        db.flush()

        detalhe = _competidor_para_detalhe(competidor)
        registrar_auditoria(
            db,
            entidade="competidores",
            id_entidade=competidor.id_competidor,
            acao="CRIAR",
            antes=None,
            depois=detalhe.model_dump(mode="json"),
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        return detalhe


def _importar_aluno(
    db: Session, id_aluno: int, responsavel: models.Usuario
) -> tuple[CompetidorDetalhe, bool]:
    """Importa aluno como competidor ou devolve o existente (idempotente)."""
    with transacao(db):
        aluno = db.get(models.Aluno, id_aluno)
        if aluno is None:
            raise NaoEncontrado("Aluno nao encontrado.", campos=["id_aluno"])

        criado = False
        competidor = None

        try:
            with db.begin_nested():
                competidor = Competidor(
                    nome=aluno.nome_completo,
                    data_nascimento=aluno.data_nascimento,
                    documento=None,  # R26: anexo escolar não vira documento
                    foto_url=aluno.foto,
                    ativo=True,
                    id_aluno_origem=id_aluno,
                )
                db.add(competidor)
                db.flush()
                criado = True
        except IntegrityError:
            competidor = db.execute(
                select(Competidor).where(Competidor.id_aluno_origem == id_aluno)
            ).scalar_one_or_none()
            if competidor is None:
                raise

        detalhe = _competidor_para_detalhe(competidor)
        if criado:
            registrar_auditoria(
                db,
                entidade="competidores",
                id_entidade=competidor.id_competidor,
                acao="CRIAR",
                antes=None,
                depois=detalhe.model_dump(mode="json"),
                id_edicao_competicao=None,
                responsavel=responsavel,
            )
        return detalhe, criado


def importar_aluno(
    db: Session, id_aluno: int, responsavel: models.Usuario
) -> CompetidorDetalhe:
    """Importa aluno como competidor de forma idempotente."""
    detalhe, _ = _importar_aluno(db, id_aluno, responsavel)
    return detalhe


def listar_competidores(
    db: Session, busca: str | None = None, pagina: int = 1, tamanho: int = 50
) -> PaginaCompetidores:
    """Lista competidores cadastrados com busca textual e paginação."""
    with transacao(db):
        consulta = select(Competidor)
        if busca and busca.strip():
            consulta = consulta.where(Competidor.nome.ilike(f"%{busca.strip()}%"))

        total = db.scalar(select(func.count()).select_from(consulta.subquery())) or 0
        consulta = consulta.order_by(Competidor.nome.asc(), Competidor.id_competidor.asc())
        itens_db = db.execute(consulta.offset((pagina - 1) * tamanho).limit(tamanho)).scalars().all()
        return PaginaCompetidores(
            itens=[_competidor_para_detalhe(c) for c in itens_db],
            total=total,
            pagina=pagina,
            tamanho=tamanho,
        )


def atualizar_competidor(
    db: Session, id_competidor: int, dados: CompetidorAtualizar, responsavel: models.Usuario
) -> CompetidorDetalhe:
    """Atualiza cadastro de competidor. Nunca altera nome_esportivo de elencos."""
    with transacao(db):
        competidor = db.get(Competidor, id_competidor)
        if competidor is None:
            raise NaoEncontrado("Competidor nao encontrado.", campos=["id_competidor"])

        antes = _competidor_para_detalhe(competidor).model_dump(mode="json")
        valores = dados.model_dump(exclude_unset=True)
        for campo, valor in valores.items():
            setattr(competidor, campo, valor)
        db.flush()

        depois = _competidor_para_detalhe(competidor).model_dump(mode="json")
        registrar_auditoria(
            db,
            entidade="competidores",
            id_entidade=competidor.id_competidor,
            acao="ATUALIZAR",
            antes=antes,
            depois=depois,
            id_edicao_competicao=None,
            responsavel=responsavel,
        )
        return _competidor_para_detalhe(competidor)


def renomear_competidor(
    db: Session, id_competidor: int, nome: str, responsavel: models.Usuario
) -> CompetidorDetalhe:
    """Renomeia competidor sem alterar nome_esportivo já registrado."""
    return atualizar_competidor(db, id_competidor, CompetidorAtualizar(nome=nome), responsavel)


def criar_equipe(
    db: Session, id_edicao_competicao: int, dados: EquipeCriar, responsavel: models.Usuario
) -> EquipeDetalhe:
    """Cria equipe em edição com estado RASCUNHO."""
    with transacao(db):
        edicao = bloquear_edicao(db, id_edicao_competicao)
        if edicao.estado != "RASCUNHO":
            raise ConflitoEstado("Apenas edicoes em rascunho aceitam novas equipes.", campos=["estado"])

        existente = db.execute(
            select(Equipe).where(
                Equipe.id_edicao_competicao == id_edicao_competicao,
                Equipe.nome == dados.nome,
            )
        ).scalar_one_or_none()
        if existente is not None:
            raise Duplicidade(f"Ja existe uma equipe chamada '{dados.nome}' nesta edicao.", campos=["nome"])

        equipe = Equipe(
            id_edicao_competicao=id_edicao_competicao,
            nome=dados.nome,
            sigla=dados.sigla,
            situacao="ATIVA",
        )
        try:
            db.add(equipe)
            db.flush()
        except IntegrityError:
            raise Duplicidade(f"Ja existe uma equipe chamada '{dados.nome}' nesta edicao.", campos=["nome"])

        detalhe = _equipe_para_detalhe(equipe)
        registrar_auditoria(
            db,
            entidade="equipes",
            id_entidade=equipe.id_equipe,
            acao="CRIAR",
            antes=None,
            depois=detalhe.model_dump(mode="json"),
            id_edicao_competicao=id_edicao_competicao,
            responsavel=responsavel,
        )
        return detalhe


def listar_equipes(db: Session, id_edicao_competicao: int) -> list[EquipeDetalhe]:
    """Lista equipes e seus integrantes para uma dada edição."""
    with transacao(db):
        edicao = db.get(EdicaoCompeticao, id_edicao_competicao)
        if edicao is None:
            raise NaoEncontrado("Edicao de competicao nao encontrada.", campos=["id_edicao_competicao"])

        consulta = (
            select(Equipe)
            .where(Equipe.id_edicao_competicao == id_edicao_competicao)
            .options(selectinload(Equipe.integrantes))
            .order_by(Equipe.nome.asc(), Equipe.id_equipe.asc())
        )
        equipes = db.execute(consulta).scalars().all()
        return [_equipe_para_detalhe(e) for e in equipes]


def inscrever_integrante(
    db: Session, id_equipe: int, dados: IntegranteCriar, responsavel: models.Usuario
) -> IntegranteDetalhe:
    """Inscreve competidor na equipe, congelando nome_esportivo e derivando edição."""
    with transacao(db):
        equipe = db.get(Equipe, id_equipe)
        if equipe is None:
            raise NaoEncontrado("Equipe nao encontrada.", campos=["id_equipe"])
        if equipe.situacao != "ATIVA":
            raise ConflitoEstado("Apenas equipes ativas aceitam novos integrantes.", campos=["situacao"])

        edicao = bloquear_edicao(db, equipe.id_edicao_competicao)
        if edicao.estado != "RASCUNHO":
            raise ConflitoEstado("Apenas edicoes em rascunho aceitam novas inscricoes.", campos=["estado"])

        competidor = db.get(Competidor, dados.id_competidor)
        if competidor is None:
            raise NaoEncontrado("Competidor nao encontrado.", campos=["id_competidor"])

        ja_inscrito = db.execute(
            select(IntegranteEquipe).where(
                IntegranteEquipe.id_edicao_competicao == equipe.id_edicao_competicao,
                IntegranteEquipe.id_competidor == dados.id_competidor,
            )
        ).scalar_one_or_none()
        if ja_inscrito is not None:
            raise Duplicidade(
                "Competidor ja esta inscrito em uma equipe nesta edicao.",
                campos=["id_competidor"],
            )

        integrante = IntegranteEquipe(
            id_edicao_competicao=equipe.id_edicao_competicao,
            id_equipe=equipe.id_equipe,
            id_competidor=dados.id_competidor,
            nome_esportivo=dados.nome_esportivo,
            numero_camisa=dados.numero_camisa,
            posicao=dados.posicao,
            situacao="ATIVO",
        )
        try:
            db.add(integrante)
            db.flush()
        except IntegrityError:
            raise Duplicidade(
                "Competidor ja esta inscrito em uma equipe nesta edicao.",
                campos=["id_competidor"],
            )

        detalhe = _integrante_para_detalhe(integrante)
        registrar_auditoria(
            db,
            entidade="integrantes_equipe",
            id_entidade=integrante.id_integrante,
            acao="CRIAR",
            antes=None,
            depois=detalhe.model_dump(mode="json"),
            id_edicao_competicao=equipe.id_edicao_competicao,
            responsavel=responsavel,
        )
        return detalhe


def excluir_equipe(db: Session, id_equipe: int, responsavel: models.Usuario) -> None:
    """Exclui a equipe e seus atletas (inscrições); os competidores permanecem.

    Só em edição em rascunho: com a tabela gerada a equipe já tem jogos, e a
    composição da tabela é estrutural (spec 7.5).
    """
    with transacao(db):
        equipe = db.get(Equipe, id_equipe)
        if equipe is None:
            raise NaoEncontrado("Equipe nao encontrada.", campos=["id_equipe"])
        edicao = bloquear_edicao(db, equipe.id_edicao_competicao)
        if edicao.estado != "RASCUNHO":
            raise ConflitoEstado(
                "Equipes só podem ser excluídas com a edição em rascunho. Desfaça a tabela antes.",
                campos=["estado"],
            )

        db.refresh(equipe, attribute_names=["integrantes"])
        registrar_auditoria(
            db,
            entidade="equipes",
            id_entidade=equipe.id_equipe,
            acao="EXCLUIR",
            antes=_equipe_para_detalhe(equipe).model_dump(mode="json"),
            depois=None,
            id_edicao_competicao=equipe.id_edicao_competicao,
            responsavel=responsavel,
        )
        apagar_integrantes_de_equipes(db, [id_equipe])
        db.execute(
            delete(Equipe).where(Equipe.id_equipe == id_equipe).execution_options(synchronize_session=False)
        )
        db.expunge(equipe)


def inativar_integrante(
    db: Session, id_integrante: int, responsavel: models.Usuario
) -> IntegranteDetalhe:
    """Inativa integrante preservando registro histórico."""
    return atualizar_integrante(db, id_integrante, IntegranteAtualizar(situacao="INATIVO"), responsavel)


def atualizar_integrante(
    db: Session, id_integrante: int, dados: IntegranteAtualizar, responsavel: models.Usuario
) -> IntegranteDetalhe:
    """Atualiza situação do integrante de equipe."""
    with transacao(db):
        integrante = db.get(IntegranteEquipe, id_integrante)
        if integrante is None:
            raise NaoEncontrado("Integrante nao encontrado.", campos=["id_integrante"])

        antes = _integrante_para_detalhe(integrante).model_dump(mode="json")
        integrante.situacao = dados.situacao
        db.flush()
        depois = _integrante_para_detalhe(integrante).model_dump(mode="json")

        registrar_auditoria(
            db,
            entidade="integrantes_equipe",
            id_entidade=integrante.id_integrante,
            acao="ATUALIZAR",
            antes=antes,
            depois=depois,
            id_edicao_competicao=integrante.id_edicao_competicao,
            responsavel=responsavel,
        )
        return _integrante_para_detalhe(integrante)


def copiar_equipes(
    db: Session, id_edicao_origem: int, id_edicao_destino: int, responsavel: models.Usuario
) -> list[EquipeDetalhe]:
    """Copia equipes e inscrições de uma edição para outra de forma atômica."""
    with transacao(db):
        edicao_destino = bloquear_edicao(db, id_edicao_destino)
        if edicao_destino.estado != "RASCUNHO":
            raise ConflitoEstado(
                "Apenas edicoes em rascunho podem receber equipes copiadas.",
                campos=["estado"],
            )

        edicao_origem = db.get(EdicaoCompeticao, id_edicao_origem)
        if edicao_origem is None:
            raise NaoEncontrado("Edicao de origem nao encontrada.", campos=["id_edicao_origem"])

        equipes_origem = db.execute(
            select(Equipe)
            .where(Equipe.id_edicao_competicao == id_edicao_origem)
            .options(selectinload(Equipe.integrantes))
            .order_by(Equipe.id_equipe.asc())
        ).scalars().all()

        equipes_criadas: list[Equipe] = []
        try:
            for eq_origem in equipes_origem:
                existente = db.execute(
                    select(Equipe).where(
                        Equipe.id_edicao_competicao == id_edicao_destino,
                        Equipe.nome == eq_origem.nome,
                    )
                ).scalar_one_or_none()
                if existente is not None:
                    raise Duplicidade(
                        f"Ja existe uma equipe chamada '{eq_origem.nome}' na edicao de destino.",
                        campos=["nome"],
                    )

                nova_equipe = Equipe(
                    id_edicao_competicao=id_edicao_destino,
                    nome=eq_origem.nome,
                    sigla=eq_origem.sigla,
                    situacao="ATIVA",
                )
                db.add(nova_equipe)
                db.flush()

                registrar_auditoria(
                    db,
                    entidade="equipes",
                    id_entidade=nova_equipe.id_equipe,
                    acao="CRIAR",
                    antes=None,
                    depois=_equipe_para_detalhe(nova_equipe).model_dump(mode="json"),
                    id_edicao_competicao=id_edicao_destino,
                    responsavel=responsavel,
                )

                for int_origem in eq_origem.integrantes:
                    novo_integrante = IntegranteEquipe(
                        id_edicao_competicao=id_edicao_destino,
                        equipe=nova_equipe,
                        id_competidor=int_origem.id_competidor,
                        nome_esportivo=int_origem.nome_esportivo,
                        numero_camisa=int_origem.numero_camisa,
                        posicao=int_origem.posicao,
                        situacao="ATIVO",
                    )
                    db.add(novo_integrante)
                    db.flush()

                    registrar_auditoria(
                        db,
                        entidade="integrantes_equipe",
                        id_entidade=novo_integrante.id_integrante,
                        acao="CRIAR",
                        antes=None,
                        depois=_integrante_para_detalhe(novo_integrante).model_dump(mode="json"),
                        id_edicao_competicao=id_edicao_destino,
                        responsavel=responsavel,
                    )

                equipes_criadas.append(nova_equipe)
        except IntegrityError:
            raise Duplicidade(
                "Conflito de unicidade ao copiar equipes.",
                campos=["nome"],
            )

        ids_equipes = [eq.id_equipe for eq in equipes_criadas]
        if not ids_equipes:
            return []
        consulta = (
            select(Equipe)
            .where(Equipe.id_equipe.in_(ids_equipes))
            .options(selectinload(Equipe.integrantes))
            .order_by(Equipe.id_equipe.asc())
        )
        equipes_recarregadas = db.execute(consulta).scalars().all()
        return [_equipe_para_detalhe(eq) for eq in equipes_recarregadas]
