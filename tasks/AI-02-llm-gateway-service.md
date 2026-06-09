---
id: AI-02
title: LLM Gateway — прокси между агентом и DeepSeek с биллингом кредитов
status: ready
owner: coder
area: AI
priority: P0
branch:
pr:
depends_on: [SC-03, H-1.3, H-1.4, H-1.7]
created: 2026-05-31
source: OC_Obsidian/Molebot.Mantle/C-tasks/C-AI-02-llm-gateway-service.md
---

# AI-02 — LLM Gateway: production mode

## Контекст
Пакет `packages/llm-gateway/` **уже существует**, но работает в stubMode:
- `AICreditsService.onChainCheck()` кидает `Error('AICredits not deployed yet')`
- `LLMProxyService.stubResponse()` возвращает мок-ответы
- В `routes/index.ts` блок проверки AICredits закомментирован (`TODO`)

**Сейчас AICredits.sol задеплоен** (`0x15Fa9046d2db9E38308Ed9bbA8F8e872beBF6B64`), DeepSeek ключ есть.
Задача: перевести Gateway в production mode — реальный on-chain AICredits + DeepSeek.

## Acceptance criteria
- [ ] `AICreditsService.onChainCheck()` — читает `balanceOf()` через viem (Mantle Sepolia).
- [ ] `AICreditsService.onChainSpend()` — вызывает `spendCredits()` от имени agentAddress (нужен подписанный клиент или relay).
- [ ] В `POST /v1/chat/completions` — блок проверки AICredits включён (раскомментировать TODO).
- [ ] `POST /v1/credits/check` — реальный on-chain запрос, не заглушка.
- [ ] `GET /health` — возвращает `stubMode: false`.
- [ ] In-memory кэш ответов LLM (TTL 60с) работает.
- [ ] `LLM_STUB_MODE=false` — проксирует в DeepSeek, а не возвращает мок.
- [ ] Интеграционные тесты: healthcheck → 200, chat success → 200, credits check → 200/402, невалидный запрос → 400.

## Scope
**В scope:** доработка существующего `packages/llm-gateway/`:
  - `src/services/ai-credits.ts` — on-chain вызовы через viem
  - `src/routes/index.ts` — раскомментировать AICredits check
  - `src/services/llm-proxy.ts` — убрать stub, оставить только proxyToLLM
  - `src/config.ts` — обновить дефолты
  - `test/*` — vitest тесты
  - `Dockerfile` — если нет (по образу agent/Dockerfile)
**НЕ в scope:** изменение AICredits ABI/адресов; Redis; фронтенд; ElizaOS.

## Затронутые файлы
- `packages/llm-gateway/src/services/ai-credits.ts` — переписать onChainCheck/onChainSpend
- `packages/llm-gateway/src/routes/index.ts` — раскомментировать credits check
- `packages/llm-gateway/src/services/llm-proxy.ts` — удалить stubResponse
- `packages/llm-gateway/src/config.ts` — stubMode=false по умолчанию
- `packages/llm-gateway/test/*.test.ts` — новые тесты
- `packages/llm-gateway/Dockerfile` — новый Dockerfile

## Зависимости
- SC-03 ✅ done — AICredits задеплоен
- H-1.3 — DeepSeek ключ (есть в infra/.env.mantle)
- INFRA-03 ✅ done — AGNI_* и env стандарт
- ⚠️ Проблема: spendCredits требует подписанной tx от agentAddress. 
  Если приватный ключ агента недоступен, можно:
  (а) сделать relay через Agent Wallet (требует ключа)
  (б) пока оставить spendCredits в stub (только проверка баланса через view)
  Решение — обсудить со Стасом.

## Notes / лог
- (migrated) Перенесён из C-AI-02. critical_path: true. Готов к coding после мержа SC-03.
