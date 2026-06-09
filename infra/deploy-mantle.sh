#!/usr/bin/env bash
# =============================================================================
# deploy-mantle.sh — deploy Molebot.Mantle стек на VPS
# Запускается из GitHub Actions или вручную.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1
LOG="/tmp/mantle-deploy-$(date +%Y%m%d-%H%M%S).log"

log() { echo "[deploy] $*" | tee -a "$LOG"; }

# ── Проверить обязательные переменные ──────────────────────────────
: "${NFT_CONTRACT_ADDRESS:?NFT_CONTRACT_ADDRESS required}"
: "${AGENT_WALLET_ADDRESS:?AGENT_WALLET_ADDRESS required}"

SERVICE="${SERVICE:-all}"
log "Deploying service: $SERVICE"

# ── Git pull ────────────────────────────────────────────────────────
log "Updating repo..."
cd /home/x/molebot_mantle
git fetch origin main
git reset --hard origin/main

# ── Deploy LLM Gateway ──────────────────────────────────────────────
if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "llm-gateway" ]; then
  log "Building llm-gateway..."
  cd packages/llm-gateway && npm ci --ignore-scripts && npm run build
  cd ../..
  docker build -t mantle-llm-gateway:latest -f packages/llm-gateway/Dockerfile packages/llm-gateway/
  log "llm-gateway built ✅"
fi

# ── Deploy frontend ─────────────────────────────────────────────────
if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "frontend" ]; then
  log "Building frontend..."
  cd frontend && npx next build && cd ..
  docker build -t mantle-frontend:latest -f frontend/Dockerfile frontend/
  log "Frontend built ✅"
fi

# ── Deploy agent ────────────────────────────────────────────────────
if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "agent" ]; then
  log "Building agent..."
  cd agent && npm ci --ignore-scripts && npm run build && cd ..
  # Dockerfile в корне репозитория, контекст сборки — корень
  docker build -t mantle-agent:latest -f Dockerfile .
  log "Agent built ✅"
fi

# ── Restart services ────────────────────────────────────────────────
log "Restarting services..."
cd /home/x/molebot_mantle
docker compose -f infra/docker-compose.mantle.yml up -d --remove-orphans

log "✅ Deploy complete!"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
