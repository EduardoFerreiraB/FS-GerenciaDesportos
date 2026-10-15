from sqlalchemy.orm import Session

import models
import schemas


class CompeticaoErroConfiguracao(ValueError):
    pass


class CompeticaoErroConflito(ValueError):
    pass


def _validar_configuracao(dados):
    modo = dados.get("modo_inscricao")
    formato = dados.get("formato")
    inicio = dados.get("data_inicio")
    fim = dados.get("data_fim")
    if modo is not None and formato is not None:
        try:
            schemas.validar_modo_formato_competicao(modo, formato)
        except ValueError as exc:
            raise CompeticaoErroConfiguracao(str(exc)) from exc
    if inicio is not None and fim is not None and inicio > fim:
        raise CompeticaoErroConfiguracao("A data de início não pode ser posterior à data de fim.")


def _tem_equipes(db: Session, competicao: models.Competicao) -> bool:
    return db.query(models.Equipe.id_equipe).filter(
        models.Equipe.id_competicao == competicao.id_competicao
    ).first() is not None


def criar_competicao(db: Session, id_edicao: int, competicao: schemas.CompeticaoCreate):
    dados = competicao.model_dump(exclude={"status"})
    _validar_configuracao(dados)
    db_competicao = models.Competicao(id_edicao=id_edicao, status="RASCUNHO", **dados)
    db.add(db_competicao)
    db.commit()
    db.refresh(db_competicao)
    return db_competicao


def listar_competicao(db: Session, id_competicao: int):
    return db.query(models.Competicao).filter(models.Competicao.id_competicao == id_competicao).first()


def listar_competicoes_edicao(db: Session, id_edicao: int):
    return db.query(models.Competicao).filter(models.Competicao.id_edicao == id_edicao).all()


def atualizar_competicao(db: Session, db_competicao: models.Competicao, competicao: schemas.CompeticaoUpdate):
    dados = competicao.model_dump(exclude_unset=True)
    if db_competicao.status != "RASCUNHO":
        raise CompeticaoErroConflito("A competição iniciada não pode ser alterada.")
    if _tem_equipes(db, db_competicao) and any(
        campo in dados and dados[campo] != getattr(db_competicao, campo)
        for campo in ("id_modalidade", "modo_inscricao")
    ):
        raise CompeticaoErroConflito("Não é possível alterar modalidade ou modo com equipes associadas.")
    resultado = {
        campo: dados.get(campo, getattr(db_competicao, campo))
        for campo in ("modo_inscricao", "formato", "criterio_resultado", "data_inicio", "data_fim")
    }
    _validar_configuracao(resultado)
    for chave, valor in dados.items():
        setattr(db_competicao, chave, valor)
    db.commit()
    db.refresh(db_competicao)
    return db_competicao


def excluir_competicao(db: Session, db_competicao: models.Competicao):
    if db_competicao.status != "RASCUNHO":
        raise CompeticaoErroConflito("A competição iniciada não pode ser excluída.")
    if _tem_equipes(db, db_competicao):
        raise CompeticaoErroConflito("Não é possível excluir competição com equipes associadas.")
    db.delete(db_competicao)
    db.commit()


def iniciar_competicao(db: Session, db_competicao: models.Competicao):
    if db_competicao.status != "RASCUNHO":
        raise CompeticaoErroConflito("A competição não está em rascunho.")
    dados = {
        campo: getattr(db_competicao, campo)
        for campo in ("modo_inscricao", "formato", "criterio_resultado", "data_inicio", "data_fim")
    }
    if any(valor is None for valor in dados.values()):
        raise CompeticaoErroConfiguracao("A competição precisa de modo, formato, critério e datas para iniciar.")
    _validar_configuracao(dados)
    db_competicao.status = "EM_ANDAMENTO"
    db.commit()
    db.refresh(db_competicao)
    return db_competicao

