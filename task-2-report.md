# Task 2 — legacy team-clone endpoint

The edition-only `POST /edicoes/{edicao_id}/clonar-equipes` path now rejects
the operation with HTTP 409. The service raises a clear `ValueError` stating
that cloning is unavailable until a competition-targeted clone exists, so no
teams can be persisted without a competition scope. Existing edition/team
read paths are unchanged.

Tests added/updated:

- `tests/test_legacy_clone_equipes_rejeitado.py` covers service and endpoint
  rejection and the explanatory message.
- Existing service/router expectations now assert rejection (`409`).

Verification:

- `python -m compileall -q app tests/test_legacy_clone_equipes_rejeitado.py` — passed.
- Direct service/router rejection checks — passed.
- Pytest collection was blocked in this environment because `app.main` retries
  a MySQL connection to `localhost`, which is unavailable in the sandbox.
