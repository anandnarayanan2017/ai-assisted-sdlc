#!/usr/bin/env bash
# Start (or reuse) a throwaway Postgres 16 for running the pipeline without Docker.
# Prints the DATABASE_URL to export. Usage: local-postgres.sh [start|stop]
set -euo pipefail
PORT="${PGPORT:-5432}"
DATA="${SDLC_PGDATA:-${TMPDIR:-/tmp}/sdlc-pg}"
URL="postgres://postgres:postgres@localhost:${PORT}/rooms"

BIN="$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl 2>/dev/null | sort -V | tail -1)")"
[ -x "$BIN/pg_ctl" ] || { echo "no Postgres binaries found (need pg_ctl); use Docker instead" >&2; exit 1; }

# Postgres refuses to run as root: drop to the postgres user when we are root.
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/sh -c "$*"; else sh -c "$*"; fi; }

if [ "${1:-start}" = stop ]; then
  as_pg "'$BIN/pg_ctl' -D '$DATA' stop -m fast" || true
  exit 0
fi

if pg_isready -h localhost -p "$PORT" -q 2>/dev/null; then
  echo "Postgres already listening on $PORT" >&2
else
  if [ ! -s "$DATA/PG_VERSION" ]; then
    mkdir -p "$DATA"
    [ "$(id -u)" = 0 ] && chown postgres "$DATA"
    PW="$(mktemp)"; echo postgres > "$PW"; chmod 644 "$PW"
    as_pg "'$BIN/initdb' -D '$DATA' -U postgres --pwfile='$PW' -A md5 >/dev/null"
    rm -f "$PW"
  fi
  as_pg "'$BIN/pg_ctl' -D '$DATA' -o '-p $PORT -k /tmp' -l '$DATA/server.log' -w start >/dev/null"
fi

PGPASSWORD=postgres psql -h localhost -p "$PORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='rooms'" | grep -q 1 \
  || PGPASSWORD=postgres psql -h localhost -p "$PORT" -U postgres -qc "CREATE DATABASE rooms"
echo "$URL"
