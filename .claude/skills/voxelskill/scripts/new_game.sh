#!/usr/bin/env bash
# Create a new voxel game project from the skill template.
# Usage: new_game.sh <target-dir> [--no-install]
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:?usage: new_game.sh <target-dir> [--no-install]}"
INSTALL=1
[ "${2:-}" = "--no-install" ] && INSTALL=0

if [ -e "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
  echo "error: $TARGET exists and is not empty" >&2
  exit 1
fi

mkdir -p "$TARGET"
# Copy template without build artefacts.
(cd "$SKILL_DIR/assets/template" && tar --exclude node_modules --exclude dist -cf - .) | (cd "$TARGET" && tar -xf -)
mv "$TARGET/gitignore" "$TARGET/.gitignore"

NAME="$(basename "$(cd "$TARGET" && pwd)" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
sed -i.bak "s/\"name\": \"voxel-game\"/\"name\": \"${NAME:-voxel-game}\"/" "$TARGET/package.json" && rm "$TARGET/package.json.bak"

# Demo props, generated so they always match the parser.
python3 "$SKILL_DIR/scripts/make_vox.py" --demo all --out "$TARGET/public/models" >/dev/null

if [ "$INSTALL" = 1 ]; then
  command -v pnpm >/dev/null || { echo "error: pnpm not found (npm i -g pnpm)" >&2; exit 1; }
  (cd "$TARGET" && pnpm install --silent)
fi

echo "created $TARGET"
echo "next: cd \"$TARGET\" && pnpm dev    (verify: pnpm check)"
