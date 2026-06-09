# =============================================================================
# Dockerfile — LLM Gateway (Node.js)
# =============================================================================
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app
RUN apk add --no-cache tini

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

ENV NODE_ENV=production
ENV LLM_GATEWAY_PORT=3010
EXPOSE 3010

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
