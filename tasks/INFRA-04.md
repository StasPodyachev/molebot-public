---
id: INFRA-04
title: API Proxy — HTTPS для VPS (mixed content fix + POST через CF)
status: done
owner: coder
area: INFRA
priority: P0
branch:
pr:
depends_on: []
created: 2026-06-05
---

# INFRA-04 — API Proxy: HTTPS для VPS

## Контекст
Фронтенд на `https://mantle.molebot.org` вызывает API напрямую на VPS:
`http://178.105.123.110/api/chat/session` и `http://178.105.123.110/chat/quota`.

Браузер блокирует эти запросы из-за Mixed Content (HTTPS → HTTP):

```
Mixed Content: The page at 'https://mantle.molebot.org/' was loaded over HTTPS,
but requested an insecure resource 'http://178.105.123.110/chat/session'.
This request has been blocked; the content must be served over HTTPS.
```

## Причина
CSP `connect-src` разрешает `http://178.105.123.110`, но Mixed Content — отдельный
механизм браузера, который CSP не обходит. Единственный способ: HTTPS.

## Варианты решения

### Вариант A: Cloudflare DNS + Proxy (рекомендуется)
Создать A-запись `vps` → `178.105.123.110` с оранжевым облаком (proxied).
Cloudflare автоматически:
- Выдаёт HTTPS-сертификат
- Терминирует HTTPS на своей стороне
- Проксирует HTTP-запросы на VPS (порт 80)

После этого:
- `_redirects`: `/api/* https://vps.molebot.org/api/:splat 200` — GET работает
- `connect-src` в CSP: `https://vps.molebot.org` вместо `http://178.105.123.110`
- POST через CF Pages _redirects НЕ работает (см. FE-26), но теперь
  фронт может вызывать `https://vps.molebot.org/api/chat/session` напрямую
  через HTTPS (mixed content не блокируется)

### Вариант B: Caddy HTTPS на VPS
Настроить Caddy на VPS с Let's Encrypt для домена `vps.molebot.org`.
Требует DNS A-запись (без прокси, серое облако).

### Вариант C: Cloudflare Worker Route
Задеплоить Worker `molebot-api-proxy` (уже есть на Cloudflare)
и добавить route `mantle.molebot.org/api/*` через Dashboard.

## Acceptance criteria
- [ ] POST `https://mantle.molebot.org/api/chat/session` возвращает не 405
- [ ] Чат: подписать сессию → создать сессию → отправить сообщение → получить ответ
- [ ] Net tab в браузере: нет Mixed Content warnings
- [ ] `npm run build` проходит

## Состояние (2026-06-05)
- Worker `molebot-api-proxy` задеплоен на Cloudflare, routes не добавлены
  (токен не имеет прав Workers Routes для зоны molebot.org)
- Код в `workers/api-proxy/src/index.js` — удалён из репы, не нужен
- DNS запись `vps.molebot.org` — НЕ создана
- Текущий обход: напрямую `http://178.105.123.110` — блокируется mixed content

## Затронутые файлы
- `frontend/components/ChatPanel.tsx` — apiBase: `http://178.105.123.110` → `https://vps.molebot.org`
- `frontend/lib/mantle-chain.ts` — если нужно
- `frontend/index.html` — CSP connect-src
- `frontend/public/_redirects` — если будет Worker/proxy route

## План
1. Создать A-запись `vps` → `178.105.123.110` (orange cloud) в Cloudflare DNS
2. Включить Always Use HTTPS в Cloudflare для molebot.org
3. Обновить CSP: `http://178.105.123.110` → `https://vps.molebot.org`
4. Обновить apiBase: `http://178.105.123.110` → `https://vps.molebot.org`
5. Пересобрать, смержить, деплой
