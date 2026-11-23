#!/usr/bin/env bash
# Captura as telas de referência. Uso, a partir de qualquer pasta:
#   bash frontend/e2e/visual/capturar.sh <pasta-saida> [filtro]
# <pasta-saida> relativa à raiz do repositório (ou absoluta). filtro: ids separados por vírgula
# (ex.: "competicao-jogos,portal"); a numeração dos arquivos é sempre a do conjunto completo.
# ATENÇÃO: o banco E2E (frontend/e2e.db) é APAGADO E RECRIADO a cada execução.
# Serializa com flock (e2e.lock) e sobe/derruba backend (8001) e frontend (3001) sozinho.
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LOCK="$RAIZ/.superpowers/sdd/2026-10-19-redesign-frontend/e2e.lock"
mkdir -p "$(dirname "$LOCK")"
exec 9>"$LOCK"
flock 9

SAIDA="${1:?informe a pasta de saída}"; shift
case "$SAIDA" in /*) ;; *) SAIDA="$RAIZ/$SAIDA" ;; esac
LOGS="${TMPDIR:-/tmp}/capturar-visual"; mkdir -p "$LOGS"

PID_API=""; PID_WEB=""
limpar() {
  for p in $PID_API $PID_WEB; do
    pkill -TERM -P "$p" 2>/dev/null; kill "$p" 2>/dev/null
  done
  sleep 1
  for p in $PID_API $PID_WEB; do pkill -KILL -P "$p" 2>/dev/null; kill -9 "$p" 2>/dev/null; done
}
trap limpar EXIT

cd "$RAIZ" || exit 1
DATABASE_URL=sqlite:///./frontend/e2e.db .venv/bin/python frontend/e2e/setup-db.py > "$LOGS/setup.log" 2>&1 \
  || { cat "$LOGS/setup.log"; exit 1; }

PYTHONPATH=app DATABASE_URL=sqlite:///./frontend/e2e.db SECRET_KEY=e2e-playwright-secret-key-1234567890 \
  ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001 \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 > "$LOGS/api.log" 2>&1 &
PID_API=$!

cd "$RAIZ/frontend" || exit 1
E2E_HARNESS=1 NEXT_PUBLIC_API_URL=http://127.0.0.1:8001 npx next dev -p 3001 > "$LOGS/web.log" 2>&1 &
PID_WEB=$!

curl -s -o /dev/null --retry 60 --retry-delay 2 --retry-connrefused http://127.0.0.1:8001/docs || { echo "backend não subiu"; exit 1; }
curl -s -o /dev/null --retry 60 --retry-delay 2 --retry-connrefused http://127.0.0.1:3001/login || { echo "frontend não subiu"; exit 1; }

node e2e/visual/capturar-telas.mjs "$SAIDA" "$@"
