import sys
import os
from datetime import datetime, timedelta

sys.path.append(os.path.abspath('app'))
sys.path.append(os.path.abspath('tests'))

import models
from conftest import MockSession
import sqlalchemy

mock_db = MockSession()
user = models.Usuario(username="refresh_user", password_hash="hash", role="professor")
mock_db.add(user)

old_revoked = models.RefreshToken(
    id_usuario=user.id_usuario,
    token="old_revoked",
    expires_at=datetime.utcnow() + timedelta(days=5),
    revoked=True
)
old_expired = models.RefreshToken(
    id_usuario=user.id_usuario,
    token="old_expired",
    expires_at=datetime.utcnow() - timedelta(days=1),
    revoked=False
)
mock_db.add_all([old_revoked, old_expired])

# Now replicate create_refresh_token
token_str = "new_token_123"
expires_at = datetime.utcnow() + timedelta(days=7)

db_token = models.RefreshToken(
    id_usuario=user.id_usuario,
    token=token_str,
    expires_at=expires_at,
    revoked=False
)
mock_db.add(db_token)

now = datetime.utcnow()
query = mock_db.query(models.RefreshToken).filter(
    models.RefreshToken.id_usuario == user.id_usuario,
    (models.RefreshToken.revoked == True) | 
    (models.RefreshToken.expires_at < now)
)

print("All items before delete:")
for item in mock_db.objects[models.RefreshToken]:
    print(f"Token: {item.token}, Revoked: {item.revoked}, Expired: {item.expires_at < now}")

print("\nEvaluating criteria:")
for item in mock_db.objects[models.RefreshToken]:
    c1 = query._evaluate_criterion(item, models.RefreshToken.id_usuario == user.id_usuario)
    c2 = query._evaluate_criterion(item, (models.RefreshToken.revoked == True) | (models.RefreshToken.expires_at < now))
    print(f"Token: {item.token} | C1 (id_usuario eq): {c1} | C2 (OR expr): {c2}")

query.delete()
print("\nItems after delete:")
for item in mock_db.objects[models.RefreshToken]:
    print(f"Token: {item.token}")
