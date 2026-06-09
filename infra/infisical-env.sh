#!/bin/bash
# =============================================================================
# infisical-env.sh — Generate .env from Infisical for docker-compose
#
# Использование:
#   ./infisical-env.sh            # напечатает .env в stdout
#   ./infisical-env.sh > .env     # сохранить в .env для docker compose
#
# Требует: infisical CLI (npm install -g @infisical/cli)
# Токен: ~/.infisical/token
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="${HOME}/.infisical/token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ERROR: Infisical token not found at $TOKEN_FILE" >&2
  exit 1
fi

INFISICAL_TOKEN="$(cat "$TOKEN_FILE")"
ENV="${INFISICAL_ENV:-prod}"

# Export all secrets as KEY=VALUE for docker-compose .env
# infisical export gives: KEY=value lines
infisical export --env="$ENV" --token="$INFISICAL_TOKEN" --format=dotenv 2>/dev/null
