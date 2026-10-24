#!/usr/bin/env bash
# Runs the migrations and RLS tests against a throwaway local Postgres (16+).
# Usage: supabase/tests/run.sh      (needs initdb/pg_ctl/psql on PATH or in /usr/lib/postgresql/*/bin)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
tmp="$(mktemp -d)"
cleanup() { "$bin/pg_ctl" -D "$tmp/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
if [ "$(id -u)" = 0 ]; then chown -R nobody "$tmp"; run() { su nobody -s /bin/bash -c "$*"; }; else run() { bash -c "$*"; }; fi
run "'$bin/initdb' -D '$tmp/data' -U postgres -A trust >/dev/null"
run "'$bin/pg_ctl' -D '$tmp/data' -o '-k $tmp -p 54329 -c listen_addresses=' -l '$tmp/log' start -w >/dev/null"
psql=(psql -h "$tmp" -p 54329 -U postgres -v ON_ERROR_STOP=1 -q -t -A)
"${psql[@]}" -c 'create database qa_test' postgres
"${psql[@]}" -d qa_test -f "$here/00_supabase_shim.sql"
for f in "$here"/../migrations/*.sql; do "${psql[@]}" -d qa_test -f "$f"; done
"${psql[@]}" -d qa_test -f "$here/10_rls.sql" 2>&1 | sed -e 's/^psql:[^:]*:[0-9]*: NOTICE:  //' -e '/^$/d'
