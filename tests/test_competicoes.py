import pytest
from security import get_password_hash
import models
from datetime import time, date

def setup_edicao_locais_arbitros_e_equipes(db, num_equipes=4):
    # 1. Evento e Modalidade
    mod = models.Modalidade(nome="Futebol", duracao_minutos=90)
    db.add(mod)
    db.flush()

    evt = models.Evento(even_nome="Copa Local")
    db.add(evt)
    db.flush()

    db.execute(models.modalidades_evento.insert().values(id_evento=evt.id_evento, id_modalidade=mod.id_modalidade))

    # 2. Edição
    edicao = models.Edicao(
        id_evento=evt.id_evento,
        edic_ano=2026,
        tipo_competicao="Mata-Mata",
        fase_inicial="Semifinal",
        data_inicio=date(2026, 7, 1),
        data_fim=date(2026, 7, 15)
    )
    db.add(edicao)
    db.flush()

    # 3. Local e Árbitro
    local = models.Local(loca_nome="Estádio Principal", ativo=True)
    db.add(local)
    arbitro = models.Arbitro(apito_nome="Árbitro Central", apito_doc="123", apito_tel="123")
    db.add(arbitro)
    db.flush()

    # 4. Equipes
    equipes = []
    for i in range(num_equipes):
        eq = models.Equipe(nome=f"Equipe {i+1}", id_edicao=edicao.id_edicao)
        db.add(eq)
        db.flush()
        equipes.append(eq)

    db.commit()
    return edicao, mod, equipes

def test_geracao_mata_mata_excesso_equipes(client, db):
    # Setup coordenador
    coord_user = models.Usuario(
        username="coord_c",
        password_hash=get_password_hash("coord123"),
        role="coordenador",
        must_change_password=False
    )
    db.add(coord_c := coord_user)
    db.commit()

    login_response = client.post("/token", data={"username": "coord_c", "password": "coord123"})
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Setup com 5 equipes para uma semifinal (limite de 4)
    edicao, mod, _ = setup_edicao_locais_arbitros_e_equipes(db, num_equipes=5)

    # Chamar rota para gerar confrontos
    response = client.post(
        f"/edicoes/{edicao.id_edicao}/gerar-confrontos",
        json={"id_modalidade": mod.id_modalidade},
        headers=headers
    )
    assert response.status_code == 400
    assert "excede o limite" in response.json()["detail"]

def test_promocao_e_bloqueio_retroativo_mata_mata(client, db):
    # Setup coordenador
    coord_user = models.Usuario(
        username="coord_d",
        password_hash=get_password_hash("coord123"),
        role="coordenador",
        must_change_password=False
    )
    db.add(coord_d := coord_user)
    db.commit()

    login_response = client.post("/token", data={"username": "coord_d", "password": "coord123"})
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Setup com 4 equipes para semifinal
    edicao, mod, equipes = setup_edicao_locais_arbitros_e_equipes(db, num_equipes=4)

    # 1. Gerar confrontos com sucesso
    response = client.post(
        f"/edicoes/{edicao.id_edicao}/gerar-confrontos",
        json={"id_modalidade": mod.id_modalidade},
        headers=headers
    )
    assert response.status_code == 200

    # 2. Buscar as partidas geradas
    partidas = db.query(models.Partida).filter(models.Partida.id_edicao == edicao.id_edicao).all()
    semis = [p for p in partidas if p.fase == "Semifinal"]
    finais = [p for p in partidas if p.fase == "Final"]
    assert len(semis) == 2
    assert len(finais) == 1

    semi1 = semis[0]
    final = finais[0]

    # 3. Finalizar semifinal 1 com vitória da equipe da casa (Equipe 1 bate Equipe 2)
    res_finalizar = client.put(
        f"/partidas/{semi1.id_partida}",
        json={
            "placar_casa": 3,
            "placar_visitante": 1,
            "status": "Finalizada"
        },
        headers=headers
    )
    assert res_finalizar.status_code == 200

    # Certificar promoção
    db.refresh(final)
    assert final.id_equipe_casa == semi1.id_equipe_casa

    # 4. Alterar retroativamente o vencedor da semifinal 1 (Equipe 2 vence Equipe 1)
    res_alterar = client.put(
        f"/partidas/{semi1.id_partida}",
        json={
            "placar_casa": 1,
            "placar_visitante": 2,
            "status": "Finalizada"
        },
        headers=headers
    )
    assert res_alterar.status_code == 200

    # Certificar mudança na final
    db.refresh(final)
    assert final.id_equipe_casa == semi1.id_equipe_visitante

    # 5. Iniciar a partida final (status: Em Andamento)
    client.put(
        f"/partidas/{final.id_partida}",
        json={"status": "Em Andamento"},
        headers=headers
    )

    # 6. Tentar reabrir ou alterar o vencedor da semifinal 1 após o início da final -> DEVE FALHAR!
    res_bloqueio = client.put(
        f"/partidas/{semi1.id_partida}",
        json={
            "placar_casa": 4,
            "placar_visitante": 0,
            "status": "Finalizada"
        },
        headers=headers
    )
    assert res_bloqueio.status_code == 400
    assert "Não é possível alterar o vencedor" in res_bloqueio.json()["detail"]
