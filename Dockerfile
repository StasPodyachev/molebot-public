# =============================================================================
# Dockerfile — molebot_mantle agent (chat API)
#
# tsx runtime — TypeScript компиляция падает из-за:
#   - session.spendLimit possibly undefined (FE-24 optional поля)
#   - cross-package импорты из packages/elizaos вне rootDir
# Вместо tsc собираем node_modules + сорцы и запускаем через tsx.
# =============================================================================
FROM node:22-alpine

RUN apk add --no-cache tini

WORKDIR /app

# deps
COPY agent/package*.json ./
RUN npm ci --ignore-scripts

# source — весь agent + пакеты для runtime (replenishCredits и др.)
COPY agent/ ./agent/
COPY packages/ ./packages/

RUN mkdir -p data

EXPOSE 3002
ENV NODE_ENV=production
ENV API_PORT=3002

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "agent/src/index.ts"]
