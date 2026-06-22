import pytest
import models
from datetime import datetime, timedelta
from security import get_password_hash
import uuid

# Helpers
def get_unique_name(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def test_integration_flow_auth(client, db):
    # 1. Create users for all roles
    u_admin = get_unique_name("admin")
    u_coord = get_unique_name("coord")
    u_prof = get_unique_name("prof")
    u_assist = get_unique_name("assist")

    # Add users to database directly
    pwd_hash = get_password_hash("password123")
    user_admin = models.Usuario(username=u_admin, password_hash=pwd_hash, role="admin", must_change_password=False)
    user_coord = models.Usuario(username=u_coord, password_hash=pwd_hash, role="coordenador", must_change_password=False)
    user_prof = models.Usuario(username=u_prof, password_hash=pwd_hash, role="professor", must_change_password=False)
    user_assist = models.Usuario(username=u_assist, password_hash=pwd_hash, role="assistente", must_change_password=False)

    db.add(user_admin)
    db.add(user_coord)
    db.add(user_prof)
    db.add(user_assist)
    db.commit()

    # 2. Login to obtain access and refresh tokens
    tokens = {}
    for role, username in [("admin", u_admin), ("coord", u_coord), ("prof", u_prof), ("assist", u_assist)]:
        res = client.post("/token", data={"username": username, "password": "password123"})
        assert res.status_code == 200
        data = res.json()
        tokens[role] = {
            "access_token": data["access_token"],
            "refresh_token": data["refresh_token"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}
        }

    # 3. Access matrix validation
    # Admin can list users, others cannot
    res = client.get("/users", headers=tokens["admin"]["headers"])
    assert res.status_code == 200
    
    for role in ["coord", "prof", "assist"]:
        res = client.get("/users", headers=tokens[role]["headers"])
        assert res.status_code == 403

    # Coordinator can register professors or assistants, but not admins
    new_prof_username = get_unique_name("new_p")
    res = client.post(
        "/register",
        json={"username": new_prof_username, "password": "password123", "role": "professor"},
        headers=tokens["coord"]["headers"]
    )
    assert res.status_code == 201

    res = client.post(
        "/register",
        json={"username": get_unique_name("new_adm"), "password": "password123", "role": "admin"},
        headers=tokens["coord"]["headers"]
    )
    assert res.status_code == 403

    # Professor/Assistente cannot register anyone
    res = client.post(
        "/register",
        json={"username": get_unique_name("new_p2"), "password": "password123", "role": "professor"},
        headers=tokens["prof"]["headers"]
    )
    assert res.status_code == 403

    # 4. Refresh token flow
    refresh_req = {"refresh_token": tokens["coord"]["refresh_token"]}
    res = client.post("/refresh", json=refresh_req)
    assert res.status_code == 200
    assert "access_token" in res.json()

    # 5. Password change flow
    change_req = {
        "old_password": "password123",
        "new_password": "newpassword123",
        "confirm_password": "newpassword123"
    }
    res = client.post("/change-password", json=change_req, headers=tokens["prof"]["headers"])
    assert res.status_code == 200

    # Old password no longer works for Professor
    res = client.post("/token", data={"username": u_prof, "password": "password123"})
    assert res.status_code == 401

    # New password works
    res = client.post("/token", data={"username": u_prof, "password": "newpassword123"})
    assert res.status_code == 200
