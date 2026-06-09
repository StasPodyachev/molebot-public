#!/bin/bash
# =============================================================================
# start-mantle.sh — Запуск Molebot Mantle стека с секретами из Infisical
#
# 1. Генерирует .env из Infisical (+ INFISICAL_TOKEN из ~/.infisical/token)
# 2. Запускает docker compose up -d
# 3. Infisical Agent синхронизирует секреты на shared volume
#
# Использование:
#   ./start-mantle.sh                         # prod
#   INFISICAL_ENV=dev ./start-mantle.sh       # dev
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.mantle.yml"
TOKEN_FILE="${HOME}/.infisical/token"
ENV_FILE="${SCRIPT_DIR}/../.env"

# Проверяем токен
if [ ! -f "$TOKEN_FILE" ]; then
  echo "ERROR: Infisical token not found at $TOKEN_FILE" >&2
  echo "Создай Service Token в Infisical и сохрани в ~/.infisical/token" >&2
  exit 1
fi

INFISICAL_TOKEN="$(cat "$TOKEN_FILE")"
ENV="${INFISICAL_ENV:-prod}"

# ── 1. Генерируем .env из Infisical ──────────────────────────────────
echo "🔐 Fetching secrets from Infisical (env=$ENV)..."

# Сначала через CLI получаем все секреты
infisical export --env="$ENV" --token="$INFISICAL_TOKEN" --format=dotenv 2>/dev/null > "$ENV_FILE"

# Добавляем INFISICAL_TOKEN для agent sidecar
echo "INFISICAL_TOKEN=${INFISICAL_TOKEN}" >> "$ENV_FILE"

if [ ! -s "$ENV_FILE" ]; then
  echo "ERROR: .env is empty — Infisical fetch failed" >&2
  exit 1
fi

echo "✅ .env generated ($(grep -c '=' "$ENV_FILE") entries)"

# ── 2. Запускаем compose ─────────────────────────────────────────────
echo "🚀 Starting docker stack..."

cd "${SCRIPT_DIR}/.."
docker compose -f "${COMPOSE_FILE}" up -d

echo ""
echo "✅ Stack started"
echo "   docker compose -f ${COMPOSE_FILE} ps"
echo "   docker compose -f ${COMPOSE_FILE} logs -f infisical-agent"
