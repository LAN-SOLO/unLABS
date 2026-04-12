#!/usr/bin/env bash
# make-dev.sh — grant an account dev-area access.
#
# Usage:
#   ./scripts/make-dev.sh <username>
#   ./scripts/make-dev.sh --email you@example.com
#   ./scripts/make-dev.sh --list           # show all dev users
#   ./scripts/make-dev.sh --revoke <username>
#
# Requires the local Supabase Docker stack to be running
# (container name: supabase_db_unlabs).

set -euo pipefail

CONTAINER="supabase_db_unlabs"

run_sql() {
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$1"
}

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ Container '${CONTAINER}' is not running. Start Supabase first." >&2
  exit 1
fi

case "${1:-}" in
  "")
    echo "Usage: $0 <username> | --email <email> | --list | --revoke <username>" >&2
    exit 1
    ;;
  --list)
    run_sql "select username, is_dev, current_episode from public.profiles where is_dev = true order by username;"
    ;;
  --email)
    EMAIL="${2:?email required}"
    run_sql "update public.profiles set is_dev = true where id = (select id from auth.users where email = '${EMAIL}') returning username, is_dev;"
    ;;
  --revoke)
    USERNAME="${2:?username required}"
    run_sql "update public.profiles set is_dev = false where username = '${USERNAME}' returning username, is_dev;"
    ;;
  *)
    USERNAME="$1"
    run_sql "update public.profiles set is_dev = true where username = '${USERNAME}' returning username, is_dev;"
    ;;
esac
