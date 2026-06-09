---
id: AI-03
title: ElizaOS LLM provider → Gateway
status: done
owner: coder
area: AI
priority: P0
branch: feat/AI-03-gateway-config
pr: https://github.com/StasPodyachev/molebot_mantle/pull/14
depends_on: [AI-02, H-1.7]
created: 2026-05-31
source: OC_Obsidian/Molebot.Mantle/C-tasks/C-AI-03-elizaos-llm-gateway.md
code_location: agent/ (ElizaOS runtime — ранее molebot-agents)
---

# AI-03 — ElizaOS LLM provider = Gateway

> ⚠️ Код агентского рантайма раньше жил в отдельном repo `molebot-agents`.
> В новой модели **трекинг задачи** живёт здесь (single SoT). Код правится в пакете
> агента внутри molebot_mantle (или в подмодуле), но статус/ревью — через этот таск.

## Контекст
Переключить ElizaOS так, чтобы все LLM-запросы шли через LLM Gateway (AI-02), а не напрямую в DeepSeek. Меняется только endpoint/provider, логика и промпты не трогаются.

## Acceptance criteria
- [ ] В конфиге ElizaOS (`character.json` / `agent/config.ts`) LLM endpoint = `http://llm-gateway:3010/v1/chat/completions`.
- [ ] Все запросы агента к LLM идут через Gateway.
- [ ] При недоступности Gateway (timeout/5xx) — fail-fast с понятной ошибкой, без прямого обращения к DeepSeek.
- [ ] Gateway использует тот же `DEEPSEEK_API_KEY`.
- [ ] Unit-тесты: конфиг грузится с Gateway URL; fallback при недоступности Gateway.

## Scope
**В scope:** конфиг modelProvider/endpoint ElizaOS (переиспользовать встроенный `openai`-провайдер, заменив `OPENAI_API_URL` на Gateway).
**НЕ в scope:** логика обработки ответов, промпты, actions.

## Зависимости / блокеры
- 🔴 blocked: ждёт AI-02 (Gateway должен существовать). Снять блок → status: ready после мержа AI-02.

## Notes / лог
- (migrated) Перенесён из C-AI-03 (был repo: molebot-agents). critical_path: true.
