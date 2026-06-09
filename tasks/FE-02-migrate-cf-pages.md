---
id: FE-02
title: Frontend — Cloudflare Pages миграция + лендинг под Mantle
status: done
owner: coder
area: FE
priority: P0
branch: feat/FE-02-migrate-cf-pages
pr: https://github.com/StasPodyachev/molebot_mantle/pull/20
depends_on: []
created: 2026-06-03
---

# FE-02 — Frontend: Cloudflare Pages миграция + лендинг под Mantle

## Контекст
Текущий фронтенд (`mantle.molebot.org`) — Next.js, запущенный в Docker на VPS.
Это вызывает 502 при падении контейнера. React #311 от Privy SSR.

Решение: **разнести** — статика frontend на Cloudflare Pages (CDN, GitHub-deploy),
VPS только под API/LLM. Переписать контент лендинга под Mantle в стиле `molebot.org`.

## Acceptance criteria
- [ ] `mantle.molebot.org` раздаётся с Cloudflare Pages (статический Next.js или Vite SPA)
- [ ] Деплой из GitHub — push в main → авто-деплой на CF Pages
- [ ] VPS обслуживает только: `/api/*` → `mantle-agent:3002`, `/v1/*` → `llm-gateway:3010`
- [ ] На VPS больше нет контейнера `frontend` (Caddy проксит /api на mantle-agent напрямую)
- [ ] Лендинг стилизован как `molebot.org` (тёмная тема, purple primary, анимации, иконка крота)
- [ ] Тексты переписаны под Mantle, а не Solana
- [ ] Privy логин работает (Private Dashboard → Allowed Origins + CF Pages domain)
- [ ] `/favicon.ico` отдаётся (уже есть)
- [ ] Страница грузится без ошибок (нет #311), гидратация на клиенте

## Scope
**В scope:**
- Настройка проекта Cloudflare Pages из GitHub репозитория
- Сборка статики (`next build` с `output: 'export'` или миграция на Vite SPA)
- Конфигурация роутинга CF Pages (`/api/*` → VPS, `/v1/*` → VPS)
- Удаление frontend из `docker-compose.mantle.yml`
- Переписывание контента лендинга (text copy, hero, features, mint CTA)
- Подгонка стилей под визуал `molebot.org`

**НЕ в scope:**
- Функционал дашборда/чата (FE-01 уже сделан) — переносится как есть
- Миграция backend/mantle-agent/llm-gateway — остаются на VPS
- Смена домена или DNS — только реконфиг Cloudflare

## Контент лендинга (план)

Стиль как на `molebot.org`:
- **Тёмная тема**, `--color-primary: #9945ff`, элементы с градиентом и glow
- **Hero**: иконка крота 🦔 + "Molebot Mantle" + "Твой автономный торговый агент на Mantle"
- **Features**: карточки с иконками (DEX trading, On-chain decisions, NFT evolution, AI chat)
- **How it works**: Mint → Activate → Trade → Evolve (с анимациями)
- **Mint CTA**: "Твой крот ждёт. Создаёшь один раз — и он работает сам." + кнопка Mint
- **Footer**: ссылки (Whitepaper, GitHub, Mantle Explorer, DoraHacks)

### Цветовая схема (как molebot.org)
```
--color-bg: #0d0c0b;
--color-primary: #9945ff;
--color-success: #14f195;
--color-gold: #ffd166;
— шрифты: Cabinet Grotesk (display), Satoshi (body)
```

## Технический план (два варианта)

### Вариант A (легко): Static Next.js export
```bash
# next.config.mjs
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```
- Минимальные изменения
- `npm run build` → `out/` → залить на CF Pages
- `/api/*` и `/v1/*` → rewrite на VPS в `_redirects` или `_headers`

### Вариант B (чисто): Vite SPA как molebot.org
- Мигрировать frontend на Vite + React (как molebot.org)
- Единый стиль между Solana и Mantle версиями
- Переиспользовать компоненты Privy, ChatPanel, MintButton

## Затронутые файлы (план)
- `frontend/next.config.mjs` (добавить `output: 'export'`)
- `frontend/app/layout.tsx` (вернуть Server Component, убрать `ssr: false` костыль)
- `frontend/public/_redirects` (CF Pages: `/api/* https://vps.molebot.org/api/* 200`)
- `infra/docker-compose.mantle.yml` (удалить сервис `frontend`)
- `infra/Caddyfile` (на хосте убрать reverse_proxy frontend:3000, оставить только API)
- GitHub Actions: `.github/workflows/deploy-cf-pages.yml`

## Зависимости / блокеры
- 🔴 Аккаунт Cloudflare Pages (связать с GitHub репозиторием)
- Privy Dashboard: добавить CF Pages domain (если отличается от mantle.molebot.org)
- DNS: mantle.molebot.org → Cloudflare (уже есть, проверить настройку CF Pages)

## Notes / лог
- (planning) Создано 2026-06-03 по запросу owner'а.
- Диагностика: 502 = контейнер не запущен. React #311 = Privy SSR.
- Решение: вынести фронт из Docker на CF Pages.
