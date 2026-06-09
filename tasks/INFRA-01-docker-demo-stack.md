---
id: INFRA-01
title: Docker Compose демо-стек (llm-gateway + agent + web)
status: done
owner: coder
area: INFRA
priority: P0
branch: feat/INFRA-01-docker-stack
pr: https://github.com/StasPodyachev/molebot_mantle/pull/16
depends_on: [H-1.6, AI-02, INFRA-03]
created: 2026-05-31
source: OC_Obsidian/Molebot.Mantle/C-tasks/C-INFRA-01-docker-llm-gateway.md
---

# INFRA-01 — Docker Compose демо-стек

## Контекст
Поднять весь демо-стенд одной командой: llm-gateway + mantle-agent + web + redis, в одной сети, env из `.env.demo`.

## Acceptance criteria
- [ ] `docker-compose.demo.yml` (или дополнен `docker-compose.mantle.yml`).
- [ ] Сервисы: `llm-gateway` (из `packages/llm-gateway/`), `mantle-agent` (есть), `web` (Next.js из `frontend/`), `redis` (есть).
- [ ] Все в сети `mantle_internal`; env из `.env.demo` (INFRA-03).
- [ ] `llm-gateway` знает redis и mantle-agent; `web` знает mantle-agent (`NEXT_PUBLIC_API_URL`).
- [ ] `docker-compose up -d` поднимает стек, healthcheck-и зелёные.
- [ ] Smoke-тест (bash/curl): healthcheck всех сервисов OK.

## Scope
**В scope:** compose-файл + Dockerfile для llm-gateway (Node 20-alpine, multi-stage) + Dockerfile для web (Next.js); порты `llm-gateway:3010`, `mantle-agent:3002`, `web:3000`.
**НЕ в scope:** существующий `mantle-agent` сервис и его env (только добавлять новое).

## Затронутые файлы (план)
- `infra/docker-compose.demo.yml`
- `packages/llm-gateway/Dockerfile` (по образцу `agent/Dockerfile`)
- `frontend/Dockerfile`

## Зависимости / блокеры
- 🔴 blocked: ждёт AI-02 (llm-gateway существует) и INFRA-03 (env). H-1.6 (VPS) — done.
- Проверка: `docker compose -f infra/docker-compose.demo.yml config`.

## Уже есть
- `packages/llm-gateway/Dockerfile` — создан в AI-02
- `frontend/Dockerfile` — существует
- `Dockerfile` — mantle-agent (корень)
- `infra/docker-compose.mantle.yml` — существующий compose

## Notes / лог
- (migrated) Перенесён из C-INFRA-01. critical_path: true.
- 2026-06-01: Разблокирован (AI-02, INFRA-03 done).
