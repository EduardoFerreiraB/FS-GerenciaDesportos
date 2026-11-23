import models
from security import get_password_hash


def _criar_usuario_e_logar(client, db, username: str, role: str, must_change_password: bool = False):
    usuario = models.Usuario(
        username=username,
        password_hash=get_password_hash("senha123"),
        role=role,
        must_change_password=must_change_password,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    resp = client.post("/token", data={"username": username, "password": "senha123"})
    assert resp.status_code == 200
    dados = resp.json()
    headers = {"Authorization": f"Bearer {dados['access_token']}"}
    return usuario, dados, headers


def _extrair_payload_erro(resp):
    body = resp.json()
    if isinstance(body.get("detail"), dict):
        return body["detail"]
    return body


def test_usuario_com_troca_pendente_bloqueado_na_api(client, db):
    _, _, headers = _criar_usuario_e_logar(
        client, db, "admin_pendente", "admin", must_change_password=True
    )

    for rota in ("/alunos", "/turmas", "/users"):
        resp = client.get(rota, headers=headers)
        assert resp.status_code == 403, f"Esperado 403 em {rota}, obtido {resp.status_code}"
        payload = _extrair_payload_erro(resp)
        assert payload.get("codigo") == "SENHA_TROCA_OBRIGATORIA"
        assert payload.get("detail") == "Troque sua senha para continuar."


def test_usuario_com_troca_pendente_pode_trocar_senha_e_ver_me(client, db):
    _, tokens, headers = _criar_usuario_e_logar(
        client, db, "prof_pendente", "professor", must_change_password=True
    )

    # GET /users/me continua liberado
    resp_me = client.get("/users/me", headers=headers)
    assert resp_me.status_code == 200
    assert resp_me.json()["username"] == "prof_pendente"
    assert resp_me.json()["must_change_password"] is True

    # POST /refresh continua liberado
    resp_refresh = client.post("/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert resp_refresh.status_code == 200
    novo_headers = {"Authorization": f"Bearer {resp_refresh.json()['access_token']}"}

    # Ainda bloqueado antes de trocar a senha
    resp_bloqueado = client.get("/alunos", headers=novo_headers)
    assert resp_bloqueado.status_code == 403

    # POST /change-password continua liberado e desbloqueia a conta
    resp_troca = client.post(
        "/change-password",
        json={
            "old_password": "senha123",
            "new_password": "novasenha123",
            "confirm_password": "novasenha123",
        },
        headers=novo_headers,
    )
    assert resp_troca.status_code == 200

    resp_me_pos = client.get("/users/me", headers=novo_headers)
    assert resp_me_pos.status_code == 200
    assert resp_me_pos.json()["must_change_password"] is False

    # Agora a API esta liberada
    resp_alunos = client.get("/alunos", headers=novo_headers)
    assert resp_alunos.status_code == 200


def test_coordenador_lista_usuarios(client, db):
    _, _, headers_coord = _criar_usuario_e_logar(
        client, db, "coord_list", "coordenador", must_change_password=False
    )
    _, _, headers_prof = _criar_usuario_e_logar(
        client, db, "prof_list", "professor", must_change_password=False
    )
    _, _, headers_assist = _criar_usuario_e_logar(
        client, db, "assist_list", "assistente", must_change_password=False
    )

    resp_coord = client.get("/users", headers=headers_coord)
    assert resp_coord.status_code == 200
    usernames = {u["username"] for u in resp_coord.json()}
    assert {"coord_list", "prof_list", "assist_list"}.issubset(usernames)

    assert client.get("/users", headers=headers_prof).status_code == 403
    assert client.get("/users", headers=headers_assist).status_code == 403


def test_coordenador_nao_promove_a_admin(client, db):
    _, _, headers_coord = _criar_usuario_e_logar(
        client, db, "coord_role", "coordenador", must_change_password=False
    )
    _criar_usuario_e_logar(client, db, "admin_alvo", "admin", must_change_password=False)
    _criar_usuario_e_logar(client, db, "coord_alvo", "coordenador", must_change_password=False)
    _criar_usuario_e_logar(client, db, "prof_alvo", "professor", must_change_password=False)

    # Nao pode promover professor a admin ou coordenador
    assert (
        client.put("/users/prof_alvo/role", json={"role": "admin"}, headers=headers_coord).status_code
        == 403
    )
    assert (
        client.put(
            "/users/prof_alvo/role", json={"role": "coordenador"}, headers=headers_coord
        ).status_code
        == 403
    )

    # Nao pode alterar perfil de admin nem de outro coordenador
    assert (
        client.put(
            "/users/admin_alvo/role", json={"role": "professor"}, headers=headers_coord
        ).status_code
        == 403
    )
    assert (
        client.put(
            "/users/coord_alvo/role", json={"role": "professor"}, headers=headers_coord
        ).status_code
        == 403
    )

    # Pode alterar entre professor e assistente
    resp_ok = client.put(
        "/users/prof_alvo/role", json={"role": "assistente"}, headers=headers_coord
    )
    assert resp_ok.status_code == 200
    assert resp_ok.json()["role"] == "assistente"


def test_coordenador_cria_apenas_professor_e_assistente(client, db):
    _, _, headers_coord = _criar_usuario_e_logar(
        client, db, "coord_cria", "coordenador", must_change_password=False
    )

    resp_prof = client.post(
        "/register",
        json={"username": "novo_prof_coord", "password": "password123", "role": "professor"},
        headers=headers_coord,
    )
    assert resp_prof.status_code == 201
    assert resp_prof.json()["must_change_password"] is True

    resp_assist = client.post(
        "/register",
        json={"username": "novo_assist_coord", "password": "password123", "role": "assistente"},
        headers=headers_coord,
    )
    assert resp_assist.status_code == 201
    assert resp_assist.json()["must_change_password"] is True

    assert (
        client.post(
            "/register",
            json={"username": "novo_admin_coord", "password": "password123", "role": "admin"},
            headers=headers_coord,
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/register",
            json={"username": "novo_coord_coord", "password": "password123", "role": "coordenador"},
            headers=headers_coord,
        ).status_code
        == 403
    )
