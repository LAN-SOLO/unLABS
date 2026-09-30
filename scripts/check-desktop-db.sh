#!/bin/bash
# Verifies that the desktop app ships every piece of game content that lives
# in the local Supabase Docker database.
#
# The desktop build bundles supabase/migrations/*.sql and replays them into an
# embedded PostgreSQL on first launch. This script replays the same migrations
# into a scratch database inside the Docker container and compares every
# content table (public tables without a user/player/owner/profile column,
# logs excluded) with the Docker database — ignoring timestamps, uuids and
# serial ids, which differ per install by design. Player data (profiles,
# saves, balances, history) is per account and intentionally not shipped.
#
# Usage: bash scripts/check-desktop-db.sh   (exit 1 when content differs)
set -uo pipefail
cd "$(dirname "$0")/.."

CONTAINER="${UNLABS_DB_CONTAINER:-supabase_db_unlabs}"
SCRATCH="desktop_seed_check"

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  echo "[db-check] Docker container $CONTAINER is not running — skipping the content check."
  exit 0
fi

P() { docker exec -i "$CONTAINER" psql -U postgres -q -X "$@"; }

P -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH" -c "CREATE DATABASE $SCRATCH" >/dev/null 2>&1
trap 'P -d postgres -c "DROP DATABASE IF EXISTS '"$SCRATCH"'" >/dev/null 2>&1' EXIT

# Auth/extensions schemas as the app provides them (GoTrue creates auth.* at runtime).
docker exec "$CONTAINER" pg_dump -U postgres -d postgres --schema-only --schema=auth --schema=extensions 2>/dev/null |
  P -d "$SCRATCH" >/dev/null 2>&1

errors=0
for f in supabase/migrations/*.sql; do
  out=$(P -d "$SCRATCH" -v ON_ERROR_STOP=1 <"$f" 2>&1 >/dev/null) || {
    echo "[db-check] migration failed: $f"
    echo "$out" | grep -m3 ERROR
    errors=$((errors + 1))
  }
done

tables=$(P -d postgres -Atc "
  SELECT t.tablename FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename !~ '(log|history|transactions|snapshots)$'
    AND t.tablename <> 'profiles' -- one row per account (id = auth.users.id)
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t.tablename
        AND c.column_name IN ('user_id', 'player_id', 'owner_id', 'profile_id', 'seller_id', 'buyer_id'))
  ORDER BY 1")

checked=0
for t in $tables; do
  cols=$(P -d postgres -Atc "
    SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '$t'
      AND column_name !~ '(_at|_time)$' AND column_name <> 'id'
      AND data_type NOT IN ('uuid', 'timestamp with time zone', 'timestamp without time zone')")
  [ -z "$cols" ] && continue
  q="SELECT count(*) || ' ' || coalesce(md5(string_agg(r::text, '|' ORDER BY r::text)), '-') FROM (SELECT $cols FROM public.$t) r"
  a=$(P -d postgres -Atc "$q" 2>&1)
  b=$(P -d "$SCRATCH" -Atc "$q" 2>&1)
  checked=$((checked + 1))
  if [ "$a" != "$b" ]; then
    echo "[db-check] content differs: $t (docker ${a%% *} rows, shipped ${b%% *} rows)"
    errors=$((errors + 1))
  fi
done

if [ "$errors" -gt 0 ]; then
  echo "[db-check] FAILED — $errors problem(s). Put the missing content into a migration (pnpm db:new) before building."
  exit 1
fi
echo "[db-check] OK — $checked content tables in Docker are fully covered by the bundled migrations."
